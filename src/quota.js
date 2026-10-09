import { codeUnlocks } from './codes.js';

/* Authoritative free-trial meter. The on-device counter in vanes-access.js is a
   convenience copy; this table in D1 is what actually decides whether a learner can ask
   another question, so clearing browser storage cannot buy more answers. */
const DEFAULT_FREE_LIMIT=15,DEFAULT_TRIAL_HOURS=24,DEFAULT_PREMIUM_DAYS=30;

function limit(env){
  const n=Number(env?.VANES_FREE_LIMIT);
  return Number.isFinite(n)&&n>0?Math.floor(n):DEFAULT_FREE_LIMIT;
}

/* Premium is a one-month pass: redeeming an upgrade code sets premium_until, and once that
   moment passes the account drops back to the free trial on its own — no manual step.
   VANES_PREMIUM_DAYS can shorten or lengthen the pass without a code change. */
function premiumMs(env){
  const d=Number(env?.VANES_PREMIUM_DAYS);
  return (Number.isFinite(d)&&d>0?d:DEFAULT_PREMIUM_DAYS)*86400000;
}

/* The free trial resets every 24 hours. VANES_TRIAL_HOURS fine-tunes that window;
   VANES_TRIAL_DAYS still works as a longer override for anyone who set it earlier. */
function periodMs(env){
  const h=Number(env?.VANES_TRIAL_HOURS);
  if(Number.isFinite(h)&&h>0)return h*3600000;
  const d=Number(env?.VANES_TRIAL_DAYS);
  if(Number.isFinite(d)&&d>0)return d*86400000;
  return DEFAULT_TRIAL_HOURS*3600000;
}

let tableReady=false;
async function ensureTable(db){
  if(tableReady)return;
  await db.prepare("CREATE TABLE IF NOT EXISTS vanes_quota (uid TEXT PRIMARY KEY, period_start INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0, premium INTEGER NOT NULL DEFAULT 0, premium_code TEXT, updated_at TEXT NOT NULL)").run();
  /* Older databases predate the monthly pass, so add the column in place when missing. */
  try{await db.prepare("ALTER TABLE vanes_quota ADD COLUMN premium_until INTEGER").run()}catch(_){}
  tableReady=true;
}

async function load(db,uid,env){
  const now=Date.now(),span=periodMs(env);
  const row=await db.prepare("SELECT period_start,used,premium,premium_code,premium_until FROM vanes_quota WHERE uid=?1").bind(uid).first();
  if(!row)return {uid,periodStart:now,used:0,premium:false,premiumCode:"",premiumUntil:0,fresh:true};
  const until=Number(row.premium_until)||0;
  const premium=!!row.premium&&(!until||until>now);
  const expired=!!row.premium&&!!until&&until<=now;
  const periodStart=Number(row.period_start)||now;
  if(now-periodStart>span)return {uid,periodStart:now,used:0,premium,premiumCode:row.premium_code||"",premiumUntil:premium?until:0,fresh:false,expired};
  return {uid,periodStart,used:Number(row.used)||0,premium,premiumCode:row.premium_code||"",premiumUntil:premium?until:0,fresh:false,expired};
}

async function save(db,state){
  await db.prepare("INSERT INTO vanes_quota (uid,period_start,used,premium,premium_code,premium_until,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7) ON CONFLICT(uid) DO UPDATE SET period_start=excluded.period_start,used=excluded.used,premium=excluded.premium,premium_code=excluded.premium_code,premium_until=excluded.premium_until,updated_at=excluded.updated_at")
    .bind(state.uid,state.periodStart,state.used,state.premium?1:0,state.premiumCode||null,state.premiumUntil||null,new Date().toISOString()).run();
}

function view(state,env){
  const max=limit(env);
  return {
    uid:state.uid,
    limit:max,
    used:state.used,
    left:state.premium?null:Math.max(0,max-state.used),
    premium:state.premium,
    premiumUntil:state.premium?state.premiumUntil||null:null,
    premiumDaysLeft:state.premium&&state.premiumUntil?Math.max(0,Math.ceil((state.premiumUntil-Date.now())/86400000)):null,
    renewsInHours:Math.max(0,Math.ceil((state.periodStart+periodMs(env)-Date.now())/3600000))
  };
}

/* Reads the learner's quota, honouring an upgrade code the Worker recognises.
   Codes come from the OB Tech-Labs counter (D1) or the VANES_PREMIUM_CODES secret.
   Returns null when enforcement is impossible (no database) so chat keeps working. */
export async function readQuota(db,uid,env,code){
  if(!db||!uid)return null;
  await ensureTable(db);
  const state=await load(db,uid,env);
  const offered=String(code||"").trim().toUpperCase();
  if(!state.premium&&offered&&await codeUnlocks(db,uid,env,offered)){
    state.premium=true;state.premiumCode=offered;
    state.premiumUntil=Date.now()+premiumMs(env);
    await save(db,state);
  }else if(state.expired){
    /* The month is over: write the downgrade so the record shows the free account again. */
    state.premium=false;
    await save(db,state);
  }
  return view(state,env);
}

/* Counts one delivered answer. Called only after the model answered successfully. */
export async function consumeQuota(db,uid,env,code){
  if(!db||!uid)return null;
  await ensureTable(db);
  const state=await load(db,uid,env);
  const offered=String(code||"").trim().toUpperCase();
  if(!state.premium&&offered&&await codeUnlocks(db,uid,env,offered)){
    state.premium=true;state.premiumCode=offered;
    state.premiumUntil=Date.now()+premiumMs(env);
  }
  if(!state.premium)state.used=Math.min(state.used+1,limit(env));
  await save(db,state);
  return view(state,env);
}
