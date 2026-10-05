/* Authoritative free-trial meter. The on-device counter in vanes-access.js is a
   convenience copy; this table in D1 is what actually decides whether a learner can ask
   another question, so clearing browser storage cannot buy more answers. */
const DEFAULT_FREE_LIMIT=15,DEFAULT_TRIAL_DAYS=30;

function limit(env){
  const n=Number(env?.VANES_FREE_LIMIT);
  return Number.isFinite(n)&&n>0?Math.floor(n):DEFAULT_FREE_LIMIT;
}

function periodMs(env){
  const d=Number(env?.VANES_TRIAL_DAYS);
  return (Number.isFinite(d)&&d>0?d:DEFAULT_TRIAL_DAYS)*86400000;
}

function premiumCodes(env){
  const raw=typeof env?.VANES_PREMIUM_CODES==="string"?env.VANES_PREMIUM_CODES:"";
  return new Set(raw.split(/[,\s]+/).map(c=>c.trim().toUpperCase()).filter(Boolean));
}

let tableReady=false;
async function ensureTable(db){
  if(tableReady)return;
  await db.prepare("CREATE TABLE IF NOT EXISTS vanes_quota (uid TEXT PRIMARY KEY, period_start INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0, premium INTEGER NOT NULL DEFAULT 0, premium_code TEXT, updated_at TEXT NOT NULL)").run();
  tableReady=true;
}

async function load(db,uid,env){
  const now=Date.now(),span=periodMs(env);
  const row=await db.prepare("SELECT period_start,used,premium,premium_code FROM vanes_quota WHERE uid=?1").bind(uid).first();
  if(!row)return {uid,periodStart:now,used:0,premium:false,premiumCode:"",fresh:true};
  const periodStart=Number(row.period_start)||now;
  if(now-periodStart>span)return {uid,periodStart:now,used:0,premium:!!row.premium,premiumCode:row.premium_code||"",fresh:false};
  return {uid,periodStart,used:Number(row.used)||0,premium:!!row.premium,premiumCode:row.premium_code||"",fresh:false};
}

async function save(db,state){
  await db.prepare("INSERT INTO vanes_quota (uid,period_start,used,premium,premium_code,updated_at) VALUES (?1,?2,?3,?4,?5,?6) ON CONFLICT(uid) DO UPDATE SET period_start=excluded.period_start,used=excluded.used,premium=excluded.premium,premium_code=excluded.premium_code,updated_at=excluded.updated_at")
    .bind(state.uid,state.periodStart,state.used,state.premium?1:0,state.premiumCode||null,new Date().toISOString()).run();
}

function view(state,env){
  const max=limit(env);
  return {
    uid:state.uid,
    limit:max,
    used:state.used,
    left:state.premium?null:Math.max(0,max-state.used),
    premium:state.premium,
    renewsInDays:Math.max(0,Math.ceil((state.periodStart+periodMs(env)-Date.now())/86400000))
  };
}

/* Reads the learner's quota, honouring an upgrade code the Worker recognises.
   Returns null when enforcement is impossible (no database) so chat keeps working. */
export async function readQuota(db,uid,env,code){
  if(!db||!uid)return null;
  await ensureTable(db);
  const state=await load(db,uid,env);
  const offered=String(code||"").trim().toUpperCase();
  if(!state.premium&&offered&&premiumCodes(env).has(offered)){
    state.premium=true;state.premiumCode=offered;
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
  if(!state.premium&&offered&&premiumCodes(env).has(offered)){state.premium=true;state.premiumCode=offered}
  if(!state.premium)state.used=Math.min(state.used+1,limit(env));
  await save(db,state);
  return view(state,env);
}
