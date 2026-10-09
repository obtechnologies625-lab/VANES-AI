import { issueCode } from './codes.js';
import { bearerToken, verifyIdToken } from './firebase-auth.js';

/* Airtel Money collection client for VANES donations (fixed amount, default 3,500 TZS).
   Merchant credentials exist only as Worker secrets (AIRTEL_CLIENT_ID / AIRTEL_CLIENT_SECRET);
   without them the app falls back to the manual Airtel number flow. Payment confirmation is
   never taken from a callback body — every success is re-checked against the Airtel status
   API before an OB Tech-Labs upgrade code is issued. */

const AUTH_URL="https://openapi.airtel.africa/auth/oauth2/token";
const PAY_URL="https://openapi.airtel.africa/merchant/v1/payments/";
const STATUS_URL="https://openapi.airtel.africa/standard/v1/payments/";
const DEFAULT_AMOUNT=3500;
const DEFAULT_MANUAL_NUMBER="+255688346613";
const PENDING_MAX_MS=30*60000;

let tokenCache={token:"",expiresAt:0};
let paymentsReady=false;

export function airtelConfigured(env){
  return Boolean(env?.AIRTEL_CLIENT_ID&&env.AIRTEL_CLIENT_SECRET);
}
export function donationAmount(env){
  const n=Number(env?.VANES_DONATION_TZS);
  return Number.isFinite(n)&&n>0?Math.floor(n):DEFAULT_AMOUNT;
}
export function donationNumber(env){
  const raw=typeof env?.VANES_AIRTEL_NUMBER==="string"?env.VANES_AIRTEL_NUMBER.trim():"";
  return raw||DEFAULT_MANUAL_NUMBER;
}
/* Tanzanian mobile numbers only: 0XXXXXXXXX or +255XXXXXXXXX with a 6/7 prefix. */
export function normalizePhone(raw){
  let d=String(raw||"").replace(/[^\d]/g,"");
  if(d.startsWith("255"))d=d.slice(3);
  else if(d.startsWith("0"))d=d.slice(1);
  if(!/^[67]\d{8}$/.test(d))return "";
  return "255"+d;
}
export function newReference(){
  const bytes=new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const body=[...bytes].map(b=>b.toString(16).padStart(2,"0")).join("").toUpperCase();
  return "VN"+body.slice(0,14);
}

async function token(env){
  const now=Date.now();
  if(tokenCache.token&&now<tokenCache.expiresAt)return tokenCache.token;
  const r=await fetch(AUTH_URL,{method:"POST",headers:{"Content-Type":"application/json",Accept:"*/*"},body:JSON.stringify({client_id:env.AIRTEL_CLIENT_ID,client_secret:env.AIRTEL_CLIENT_SECRET,grant_type:"client_credentials"})});
  const d=await r.json().catch(()=>({}));
  const access=typeof d?.access_token==="string"?d.access_token:"";
  if(!r.ok||!access)throw new Error("Airtel authentication failed.");
  const ttl=Number(d?.expires_in)||3600;
  tokenCache={token:access,expiresAt:now+Math.max(60,ttl-120)*1000};
  return access;
}

/* Pushes the USSD approval prompt to the payer's phone. */
export async function pushPayment(env,{reference,msisdn,amount,id}){
  const access=await token(env);
  const r=await fetch(PAY_URL,{method:"POST",headers:{"Content-Type":"application/json",Accept:"*/*","X-Country":"TZ","X-Currency":"TZS",Authorization:"Bearer "+access},body:JSON.stringify({reference,subscriber:{country:"TZ",currency:"TZS",msisdn},transaction:{amount,country:"TZ",currency:"TZS",id}})});
  const d=await r.json().catch(()=>({}));
  const ok=Boolean(d?.status?.success)||String(d?.status?.code||"")==="200";
  return {ok,airtelId:d?.data?.transaction?.id||id,status:String(d?.data?.transaction?.status||"").toUpperCase(),message:String(d?.status?.message||"")};
}

/* TIP = in progress, TS = success, TF = failed. */
export async function paymentStatus(env,id){
  const access=await token(env);
  const r=await fetch(STATUS_URL+encodeURIComponent(id),{headers:{Accept:"*/*","X-Country":"TZ","X-Currency":"TZS",Authorization:"Bearer "+access}});
  const d=await r.json().catch(()=>({}));
  const t=d?.data?.transaction||{};
  return {status:String(t.status||"").toUpperCase(),airtelMoneyId:String(d?.data?.airtel_money_id||""),message:String(d?.status?.message||"")};
}

async function ensurePayments(db){
  if(paymentsReady)return;
  await db.prepare("CREATE TABLE IF NOT EXISTS vanes_payments (reference TEXT PRIMARY KEY, uid TEXT, phone TEXT, amount INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', provider TEXT NOT NULL DEFAULT 'airtel', airtel_id TEXT, code TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)").run();
  paymentsReady=true;
}

export async function createPayment(db,{uid,phone,amount}){
  await ensurePayments(db);
  for(let attempt=0;attempt<3;attempt++){
    const reference=newReference();
    try{
      const now=new Date().toISOString();
      await db.prepare("INSERT INTO vanes_payments (reference,uid,phone,amount,status,created_at,updated_at) VALUES (?1,?2,?3,?4,'PENDING',?5,?5)").bind(reference,uid||"",phone,amount,now).run();
      return reference;
    }catch(_){}
  }
  return "";
}

export async function loadPayment(db,reference){
  if(!db||!reference)return null;
  await ensurePayments(db);
  return db.prepare("SELECT reference,uid,phone,amount,status,airtel_id,code,created_at FROM vanes_payments WHERE reference=?1").bind(String(reference).toUpperCase()).first();
}

export async function saveAirtelId(db,reference,airtelId){
  await db.prepare("UPDATE vanes_payments SET airtel_id=?1, updated_at=?2 WHERE reference=?3").bind(airtelId,new Date().toISOString(),reference).run();
}

export async function recentPending(db,uid,withinMs=120000){
  if(!db||!uid)return false;
  await ensurePayments(db);
  const row=await db.prepare("SELECT reference FROM vanes_payments WHERE uid=?1 AND status='PENDING' ORDER BY created_at DESC LIMIT 1").bind(uid).first();
  if(!row)return false;
  const full=await loadPayment(db,row.reference);
  return Boolean(full&&Date.now()-Date.parse(full.created_at)<withinMs);
}

/* Called by both the polling status endpoint and the webhook. Re-verifies against Airtel,
   then issues exactly one counter code per payment (enforced by the code IS NULL guard). */
export async function confirmPayment(db,env,reference){
  const row=await loadPayment(db,reference);
  if(!row)return {status:"NOT_FOUND"};
  if(row.status==="SUCCESS"&&row.code)return {status:"SUCCESS",code:row.code};
  const age=Date.now()-Date.parse(row.created_at||"");
  if(row.status==="PENDING"&&Number.isFinite(age)&&age>PENDING_MAX_MS){
    await db.prepare("UPDATE vanes_payments SET status='FAILED', updated_at=?1 WHERE reference=?2").bind(new Date().toISOString(),reference).run();
    return {status:"FAILED",reason:"expired"};
  }
  if(row.status==="FAILED")return {status:"FAILED"};
  if(!airtelConfigured(env)||!row.airtel_id)return {status:"PENDING"};
  const check=await paymentStatus(env,row.airtel_id).catch(()=>null);
  if(!check||!check.status)return {status:"PENDING"};
  const now=new Date().toISOString();
  if(check.status==="TS"){
    const code=await issueCode(db,{source:"airtel",orderRef:String(reference).toUpperCase()});
    const result=await db.prepare("UPDATE vanes_payments SET status='SUCCESS', code=?1, updated_at=?2 WHERE reference=?3 AND code IS NULL").bind(code,now,String(reference).toUpperCase()).run();
    if(result?.meta?.changes)return {status:"SUCCESS",code};
    const again=await loadPayment(db,reference);
    if(again?.code)return {status:"SUCCESS",code:again.code};
    return {status:"SUCCESS",code};
  }
  if(check.status==="TF"){
    await db.prepare("UPDATE vanes_payments SET status='FAILED', updated_at=?1 WHERE reference=?2").bind(now,String(reference).toUpperCase()).run();
    return {status:"FAILED"};
  }
  return {status:"PENDING"};
}

/* --- HTTP handlers ------------------------------------------------------- */

function json(data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...extra}})}
function cors(origin){return {"Access-Control-Allow-Origin":origin||"*","Access-Control-Allow-Headers":"Content-Type,Authorization,X-VANES-Upgrade-Code","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Vary":"Origin"}}

/* Starts a payment: creates the record, then asks Airtel to push the USSD prompt.
   Without credentials the app is told to fall back to the manual Airtel number. */
export async function handlePayAirtel(request,env){
  const headers=cors(request.headers.get("Origin"));
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(request.method!=="POST")return json({error:"Method not allowed"},405,headers);
  const amount=donationAmount(env),manual={number:donationNumber(env),amount};
  if(!airtelConfigured(env)||!env.DB)return json({ok:false,configured:false,code:"airtel-not-configured",amount,manual},503,headers);
  let uid="";
  const token=bearerToken(request);
  if(token){try{uid=(await verifyIdToken(token,env)).uid}catch(_){}}
  let body;try{body=await request.json()}catch{return json({error:"Invalid JSON body."},400,headers)}
  const phone=normalizePhone(body?.phone);
  if(!phone)return json({error:"Enter a Tanzanian mobile number, e.g. 0712 345 678.",code:"bad-phone"},400,headers);
  if(uid&&await recentPending(env.DB,uid).catch(()=>false))return json({error:"A payment is already waiting for approval on your phone.",code:"pending-exists"},429,headers);
  const reference=await createPayment(env.DB,{uid,phone,amount});
  if(!reference)return json({error:"Could not start the payment. Please try again.",code:"payment-create-failed"},500,headers);
  try{
    const push=await pushPayment(env,{reference,msisdn:phone,amount,id:crypto.randomUUID()});
    if(push.airtelId)await saveAirtelId(env.DB,reference,push.airtelId);
    if(!push.ok)return json({error:push.message||"Airtel did not accept the payment request.",code:"push-failed",reference},502,headers);
    return json({ok:true,configured:true,reference,amount,phone},200,headers);
  }catch(error){
    return json({error:error?.message||"Could not reach Airtel. Check your connection and try again.",code:"airtel-unreachable",reference},502,headers);
  }
}

/* Polled by the app while the learner approves the USSD prompt. The reference is a random
   value only the payer's browser holds, so it acts as the capability to read this payment. */
export async function handlePayStatus(request,env,url){
  const headers=cors(request.headers.get("Origin"));
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(request.method!=="GET")return json({error:"Method not allowed"},405,headers);
  const reference=(url.searchParams.get("ref")||"").toUpperCase();
  if(!/^VN[A-Z0-9]{6,20}$/.test(reference))return json({error:"Unknown payment reference.",code:"bad-reference"},400,headers);
  if(!env.DB)return json({error:"The payment database is not configured yet.",code:"no-database"},503,headers);
  const result=await confirmPayment(env.DB,env,reference).catch(()=>({status:"PENDING"}));
  if(result.status==="NOT_FOUND")return json({error:"Unknown payment reference.",code:"bad-reference"},404,headers);
  return json({ok:result.status!=="FAILED",status:result.status,code:result.code||null,amount:donationAmount(env)},200,headers);
}

/* Airtel's callback body is only a hint — confirmPayment re-checks the status API before
   any code is issued, so a forged callback can never mint one. */
export async function handlePayCallback(request,env){
  const headers=cors(request.headers.get("Origin"));
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(request.method!=="POST")return json({error:"Method not allowed"},405,headers);
  let body=null;try{body=await request.json()}catch(_){}
  if(env.DB){
    const t=body?.transaction||body?.data?.transaction||{};
    const reference=String(t?.reference||body?.reference||"").toUpperCase();
    const airtelId=String(t?.id||body?.transaction_id||"").trim();
    if(/^VN[A-Z0-9]{6,20}$/.test(reference)){
      await confirmPayment(env.DB,env,reference).catch(()=>null);
    }else if(airtelId){
      const row=await env.DB.prepare("SELECT reference FROM vanes_payments WHERE airtel_id=?1 AND status='PENDING'").bind(airtelId).first().catch(()=>null);
      if(row?.reference)await confirmPayment(env.DB,env,row.reference).catch(()=>null);
    }
  }
  return json({ok:true},200,headers);
}
