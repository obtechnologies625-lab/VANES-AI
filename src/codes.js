/* OB Tech-Labs premium code counter. A confirmed Airtel Money payment asks the counter
   for the next VANES-PRO code: the incrementing number is the counter record, and a short
   random suffix keeps the code impossible to guess. Redeeming binds the code to the first
   learner who uses it, so a leaked code cannot be shared endlessly. */
const SAFE='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PREFIX='VANES-PRO-';
let tablesReady=false;

async function ensureTables(db){
  if(tablesReady)return;
  await db.prepare("CREATE TABLE IF NOT EXISTS vanes_code_counter (id INTEGER PRIMARY KEY CHECK (id=1), count INTEGER NOT NULL DEFAULT 0)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS vanes_premium_codes (code TEXT PRIMARY KEY, counter INTEGER NOT NULL DEFAULT 0, source TEXT, order_ref TEXT, issued_at TEXT NOT NULL, redeemed_uid TEXT, redeemed_at TEXT)").run();
  tablesReady=true;
}

function randomSuffix(n=4){
  const bytes=new Uint8Array(n);
  crypto.getRandomValues(bytes);
  let out='';
  for(const b of bytes)out+=SAFE[b%SAFE.length];
  return out;
}

/* Issues the next code. Returns null only when the database is missing or every
   collision retry failed, so the caller can keep a paid order recoverable. */
export async function issueCode(db,{source='counter',orderRef=''}={}){
  if(!db)return null;
  await ensureTables(db);
  await db.prepare("INSERT INTO vanes_code_counter (id,count) VALUES (1,0) ON CONFLICT(id) DO NOTHING").run();
  await db.prepare("UPDATE vanes_code_counter SET count=count+1 WHERE id=1").run();
  const row=await db.prepare("SELECT count FROM vanes_code_counter WHERE id=1").first();
  let count=Number(row?.count)||1;
  for(let attempt=0;attempt<3;attempt++){
    const code=PREFIX+String(count).padStart(4,'0')+randomSuffix(4);
    try{
      await db.prepare("INSERT INTO vanes_premium_codes (code,counter,source,order_ref,issued_at) VALUES (?1,?2,?3,?4,?5)").bind(code,count,source,orderRef,new Date().toISOString()).run();
      return code;
    }catch(_){count++}
  }
  return null;
}

export function secretCodes(env){
  const raw=typeof env?.VANES_PREMIUM_CODES==="string"?env.VANES_PREMIUM_CODES:"";
  return new Set(raw.split(/[,\s]+/).map(c=>c.trim().toUpperCase()).filter(Boolean));
}

/* True when the code unlocks Premium for this learner. Codes listed in the
   VANES_PREMIUM_CODES secret still work; counter-issued codes are valid until first
   redeemed, then only for the learner who redeemed them. */
export async function codeUnlocks(db,uid,env,code){
  const c=String(code||"").trim().toUpperCase();
  if(!c)return false;
  if(secretCodes(env).has(c))return true;
  if(!db)return false;
  try{
    await ensureTables(db);
    const row=await db.prepare("SELECT redeemed_uid FROM vanes_premium_codes WHERE code=?1").bind(c).first();
    if(!row)return false;
    if(!row.redeemed_uid){
      const now=new Date().toISOString();
      const result=await db.prepare("UPDATE vanes_premium_codes SET redeemed_uid=?1,redeemed_at=?2 WHERE code=?3 AND redeemed_uid IS NULL").bind(uid,now,c).run();
      if(result?.meta?.changes)return true;
      const again=await db.prepare("SELECT redeemed_uid FROM vanes_premium_codes WHERE code=?1").bind(c).first();
      return again?.redeemed_uid===uid;
    }
    return row.redeemed_uid===uid;
  }catch(_){return false}
}

export async function listCodes(db,limit=50){
  if(!db)return {count:0,codes:[]};
  await ensureTables(db);
  const row=await db.prepare("SELECT count FROM vanes_code_counter WHERE id=1").first();
  const rows=await db.prepare("SELECT code,counter,source,order_ref,issued_at,redeemed_uid,redeemed_at FROM vanes_premium_codes ORDER BY counter DESC LIMIT ?1").bind(Math.min(Math.max(Number(limit)||50,1),200)).all();
  return {count:Number(row?.count)||0,codes:rows?.results||[]};
}
