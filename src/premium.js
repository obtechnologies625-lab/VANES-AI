import { bearerToken, verifyIdToken } from './firebase-auth.js';
import { readQuota } from './quota.js';

/* VANES Premium utilities: study-link shortener, student portal, per-subject progress
   tracking and parent access. Every endpoint except the public short-link redirect and the
   parent view (whose secret is the code itself) is gated on a verified Firebase session
   with a premium quota. */

function json(data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...extra}})}
function cors(origin){return {"Access-Control-Allow-Origin":origin||"*","Access-Control-Allow-Headers":"Content-Type,Authorization,X-VANES-Upgrade-Code","Access-Control-Allow-Methods":"GET,POST,DELETE,OPTIONS","Vary":"Origin"}}

const SAFE="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SHORT_LEN=6,PARENT_LEN=8;

function randomCode(len){
  const bytes=new Uint8Array(len);crypto.getRandomValues(bytes);
  let out="";for(const b of bytes)out+=SAFE[b%SAFE.length];
  return out;
}
function clean(v,max){return String(v??"").trim().slice(0,max)}
function int(v,max){const n=Math.floor(Number(v));return Number.isFinite(n)&&n>0?Math.min(n,max):0}

let tablesReady=false;
async function ensureTables(db){
  if(tablesReady)return;
  await db.prepare("CREATE TABLE IF NOT EXISTS vanes_short_links (code TEXT PRIMARY KEY, url TEXT NOT NULL, title TEXT, subject TEXT, uid TEXT NOT NULL, clicks INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, last_click_at TEXT)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS vanes_portal_posts (id TEXT PRIMARY KEY, uid TEXT NOT NULL, author TEXT, subject TEXT, title TEXT NOT NULL, body TEXT NOT NULL, reply_count INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS vanes_portal_replies (id TEXT PRIMARY KEY, post_id TEXT NOT NULL, uid TEXT NOT NULL, author TEXT, body TEXT NOT NULL, created_at TEXT NOT NULL)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS vanes_progress_daily (uid TEXT NOT NULL, day TEXT NOT NULL, subject TEXT NOT NULL, level TEXT, seconds INTEGER NOT NULL DEFAULT 0, ai_questions INTEGER NOT NULL DEFAULT 0, questions INTEGER NOT NULL DEFAULT 0, correct INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, PRIMARY KEY (uid,day,subject))").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS vanes_parent_codes (code TEXT PRIMARY KEY, uid TEXT NOT NULL, learner_name TEXT, learner_level TEXT, created_at TEXT NOT NULL, revoked INTEGER NOT NULL DEFAULT 0)").run();
  tablesReady=true;
}

/* Shared gate: signed-in + premium, or a ready-to-return error Response. */
async function gate(request,env){
  const headers=cors(request.headers.get("Origin"));
  if(request.method==="OPTIONS")return {preflight:new Response(null,{status:204,headers}),headers};
  if(!env.DB)return {error:json({error:"The premium database is not configured yet.",code:"no-database"},503,headers)};
  const token=bearerToken(request);
  if(!token)return {error:json({error:"Sign in to VANES to use premium tools.",code:"missing-token"},401,headers)};
  let uid="";
  try{uid=(await verifyIdToken(token,env)).uid}
  catch(error){
    if(error?.code==="keys-unavailable")return {error:json({error:"VANES cannot verify your session right now. Please try again in a moment.",code:"keys-unavailable"},503,headers)};
    return {error:json({error:error?.message||"Your VANES session is not valid.",code:error?.code||"invalid-token"},401,headers)};
  }
  const quota=await readQuota(env.DB,uid,env,request.headers.get("X-VANES-Upgrade-Code")||"").catch(()=>null);
  if(!quota)return {error:json({error:"Could not read your VANES account.",code:"quota-read-failed"},500,headers)};
  if(!quota.premium)return {error:json({error:"VANES Premium is required for this tool. Support VANES to unlock it.",code:"premium-required"},402,headers)};
  await ensureTables(env.DB);
  return {uid,headers,quota};
}

/* Day keys follow Tanzania wall-clock (EAT is UTC+3 all year, no DST). */
function dayKeys(days){
  const now=Date.now()+3*3600000,out=[];
  for(let i=days-1;i>=0;i--)out.push(new Date(now-i*86400000).toISOString().slice(0,10));
  return out;
}

async function summary(db,uid,days){
  const keys=dayKeys(days),since=keys[0];
  const rows=await db.prepare("SELECT day,subject,level,seconds,ai_questions,questions,correct FROM vanes_progress_daily WHERE uid=?1 AND day>=?2 ORDER BY day").bind(uid,since).all();
  const map=new Map();
  for(const r of rows.results||[]){
    const key=clean(r.subject,40)||"General study";
    if(!map.has(key))map.set(key,{subject:key,level:clean(r.level,20),totals:{seconds:0,aiQuestions:0,questions:0,correct:0},byDay:{}});
    const s=map.get(key);
    s.byDay[r.day]={seconds:Number(r.seconds)||0,aiQuestions:Number(r.ai_questions)||0,questions:Number(r.questions)||0,correct:Number(r.correct)||0};
    s.totals.seconds+=Number(r.seconds)||0;
    s.totals.aiQuestions+=Number(r.ai_questions)||0;
    s.totals.questions+=Number(r.questions)||0;
    s.totals.correct+=Number(r.correct)||0;
    if(!s.level&&r.level)s.level=clean(r.level,20);
  }
  const subjects=[...map.values()].map(s=>({subject:s.subject,level:s.level,totals:s.totals,days:keys.map(day=>({day,...(s.byDay[day]||{seconds:0,aiQuestions:0,questions:0,correct:0})}))}));
  return {days:keys,subjects};
}

/* --- Study-link shortener ------------------------------------------------ */

export async function handleLinks(request,env,url){
  const ctx=await gate(request,env);
  if(ctx.preflight)return ctx.preflight;
  if(ctx.error)return ctx.error;
  const {uid,headers}=ctx,db=env.DB;
  if(request.method==="GET"){
    const rows=await db.prepare("SELECT code,url,title,subject,clicks,created_at FROM vanes_short_links WHERE uid=?1 ORDER BY created_at DESC LIMIT 100").bind(uid).all();
    return json({ok:true,links:rows.results||[]},200,headers);
  }
  if(request.method==="DELETE"){
    const code=clean(url.searchParams.get("code"),12).toUpperCase();
    if(!code)return json({error:"A link code is required.",code:"bad-code"},400,headers);
    const res=await db.prepare("DELETE FROM vanes_short_links WHERE code=?1 AND uid=?2").bind(code,uid).run();
    return json({ok:true,removed:Number(res?.meta?.changes||0)},200,headers);
  }
  if(request.method!=="POST")return json({error:"Method not allowed"},405,headers);
  let body;try{body=await request.json()}catch{return json({error:"Invalid JSON body."},400,headers)}
  let target;
  try{target=new URL(clean(body?.url,2000))}catch{return json({error:"Paste a full link starting with https://",code:"bad-url"},400,headers)}
  if(target.protocol!=="http:"&&target.protocol!=="https:")return json({error:"Only http and https links can be shortened.",code:"bad-url"},400,headers);
  if(target.origin===url.origin)return json({error:"That link already belongs to VANES.",code:"bad-url"},400,headers);
  const title=clean(body?.title,80),subject=clean(body?.subject,40);
  for(let attempt=0;attempt<4;attempt++){
    const code=randomCode(SHORT_LEN);
    try{
      await db.prepare("INSERT INTO vanes_short_links (code,url,title,subject,uid,created_at) VALUES (?1,?2,?3,?4,?5,?6)").bind(code,target.href,title||null,subject||null,uid,new Date().toISOString()).run();
      return json({ok:true,link:{code,url:target.href,title,subject,clicks:0},short:url.origin+"/s/"+code},200,headers);
    }catch(_){}
  }
  return json({error:"Could not create the short link. Please try again.",code:"create-failed"},500,headers);
}

/* Public redirect. A 302 keeps the destination URL byte-for-byte, so video quality and
   query parameters are never touched. */
export async function redirectShort(env,code){
  const header={"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow"};
  if(!env.DB)return new Response("Not found",{status:404,headers:header});
  const c=clean(code,12).toUpperCase();
  const row=await env.DB.prepare("SELECT url FROM vanes_short_links WHERE code=?1").bind(c).first().catch(()=>null);
  if(!row?.url)return new Response("This VANES link does not exist.",{status:404,headers:header});
  try{await env.DB.prepare("UPDATE vanes_short_links SET clicks=clicks+1, last_click_at=?1 WHERE code=?2").bind(new Date().toISOString(),c).run()}catch(_){}
  return new Response(null,{status:302,headers:{...header,Location:row.url}});
}

/* --- Student portal ------------------------------------------------------ */

export async function handlePortal(request,env,url){
  const ctx=await gate(request,env);
  if(ctx.preflight)return ctx.preflight;
  if(ctx.error)return ctx.error;
  const {uid,headers}=ctx,db=env.DB;
  if(request.method==="GET"){
    const id=clean(url.searchParams.get("id"),40);
    if(id){
      const post=await db.prepare("SELECT id,author,subject,title,body,reply_count,created_at FROM vanes_portal_posts WHERE id=?1").bind(id).first();
      if(!post)return json({error:"That question was not found — it may have been removed.",code:"not-found"},404,headers);
      const replies=await db.prepare("SELECT id,author,body,created_at FROM vanes_portal_replies WHERE post_id=?1 ORDER BY created_at ASC LIMIT 100").bind(id).all();
      return json({ok:true,post,replies:replies.results||[]},200,headers);
    }
    const subject=clean(url.searchParams.get("subject"),40);
    const rows=subject
      ?await db.prepare("SELECT id,author,subject,title,substr(body,1,240) AS preview,reply_count,created_at FROM vanes_portal_posts WHERE subject=?1 ORDER BY created_at DESC LIMIT 50").bind(subject).all()
      :await db.prepare("SELECT id,author,subject,title,substr(body,1,240) AS preview,reply_count,created_at FROM vanes_portal_posts ORDER BY created_at DESC LIMIT 50").all();
    return json({ok:true,posts:rows.results||[]},200,headers);
  }
  if(request.method!=="POST")return json({error:"Method not allowed"},405,headers);
  let body;try{body=await request.json()}catch{return json({error:"Invalid JSON body."},400,headers)}
  const hourAgo=new Date(Date.now()-3600000).toISOString();
  const recent=await db.prepare("SELECT (SELECT COUNT(*) FROM vanes_portal_posts WHERE uid=?1 AND created_at>?2)+(SELECT COUNT(*) FROM vanes_portal_replies WHERE uid=?1 AND created_at>?2) AS n").bind(uid,hourAgo).first();
  if(Number(recent?.n||0)>=30)return json({error:"You have posted a lot in the last hour. Please try again later.",code:"rate-limited"},429,headers);
  const kind=clean(body?.kind,10)||"post",author=clean(body?.author,40),now=new Date().toISOString();
  if(kind==="reply"){
    const postId=clean(body?.postId,40),text=clean(body?.body,2000);
    if(text.length<2)return json({error:"Write your answer before posting.",code:"empty"},400,headers);
    const post=await db.prepare("SELECT id FROM vanes_portal_posts WHERE id=?1").bind(postId).first();
    if(!post)return json({error:"That question no longer exists.",code:"not-found"},404,headers);
    const id=crypto.randomUUID();
    await db.prepare("INSERT INTO vanes_portal_replies (id,post_id,uid,author,body,created_at) VALUES (?1,?2,?3,?4,?5,?6)").bind(id,postId,uid,author||null,text,now).run();
    await db.prepare("UPDATE vanes_portal_posts SET reply_count=reply_count+1 WHERE id=?1").bind(postId).run();
    return json({ok:true,reply:{id,author,body:text,created_at:now}},200,headers);
  }
  const title=clean(body?.title,120),text=clean(body?.body,2000),subject=clean(body?.subject,40)||"General study";
  if(title.length<4)return json({error:"Give your question a short title.",code:"empty"},400,headers);
  if(text.length<4)return json({error:"Describe what you need help with.",code:"empty"},400,headers);
  const id=crypto.randomUUID();
  await db.prepare("INSERT INTO vanes_portal_posts (id,uid,author,subject,title,body,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7)").bind(id,uid,author||null,subject,title,text,now).run();
  return json({ok:true,post:{id,author,subject,title,body:text,reply_count:0,created_at:now}},200,headers);
}

/* --- Progress tracking --------------------------------------------------- */

export async function handleProgress(request,env,url){
  const ctx=await gate(request,env);
  if(ctx.preflight)return ctx.preflight;
  if(ctx.error)return ctx.error;
  const {uid,headers}=ctx,db=env.DB;
  if(request.method==="GET"){
    const days=Math.min(Math.max(Number(url.searchParams.get("days"))||14,7),30);
    return json({ok:true,...await summary(db,uid,days)},200,headers);
  }
  if(request.method!=="POST")return json({error:"Method not allowed"},405,headers);
  let body;try{body=await request.json()}catch{return json({error:"Invalid JSON body."},400,headers)}
  const entries=Array.isArray(body?.entries)?body.entries.slice(0,60):[];
  if(!entries.length)return json({error:"No progress entries were sent.",code:"empty"},400,headers);
  const now=new Date().toISOString(),allowed=new Set(dayKeys(60));
  let saved=0;
  for(const entry of entries){
    const day=clean(entry?.day,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!allowed.has(day))continue;
    const subject=clean(entry?.subject,40)||"General study",level=clean(entry?.level,20);
    const seconds=int(entry?.seconds,86400),aiQuestions=int(entry?.aiQuestions,500);
    const questions=int(entry?.questions,500),correct=Math.min(int(entry?.correct,500),questions);
    if(!seconds&&!aiQuestions&&!questions&&!correct)continue;
    await db.prepare("INSERT INTO vanes_progress_daily (uid,day,subject,level,seconds,ai_questions,questions,correct,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9) ON CONFLICT(uid,day,subject) DO UPDATE SET seconds=seconds+excluded.seconds, ai_questions=ai_questions+excluded.ai_questions, questions=questions+excluded.questions, correct=correct+excluded.correct, level=CASE WHEN excluded.level<>'' THEN excluded.level ELSE vanes_progress_daily.level END, updated_at=excluded.updated_at").bind(uid,day,subject,level||null,seconds,aiQuestions,questions,correct,now).run();
    saved++;
  }
  return json({ok:true,saved},200,headers);
}

/* --- Parent access ------------------------------------------------------- */

export async function handleParentCode(request,env,url){
  const ctx=await gate(request,env);
  if(ctx.preflight)return ctx.preflight;
  if(ctx.error)return ctx.error;
  const {uid,headers}=ctx,db=env.DB;
  if(request.method!=="POST")return json({error:"Method not allowed"},405,headers);
  let body;try{body=await request.json()}catch{return json({error:"Invalid JSON body."},400,headers)}
  const name=clean(body?.learnerName,40),level=clean(body?.learnerLevel,20);
  const existing=await db.prepare("SELECT code,learner_name,learner_level FROM vanes_parent_codes WHERE uid=?1 AND revoked=0 ORDER BY created_at DESC LIMIT 1").bind(uid).first();
  if(existing){
    if(name||level)await db.prepare("UPDATE vanes_parent_codes SET learner_name=COALESCE(NULLIF(?1,''),learner_name), learner_level=COALESCE(NULLIF(?2,''),learner_level) WHERE code=?3").bind(name,level,existing.code).run();
    return json({ok:true,code:existing.code,url:url.origin+"/parent?code="+existing.code,learnerName:name||existing.learner_name||"",learnerLevel:level||existing.learner_level||""},200,headers);
  }
  for(let attempt=0;attempt<4;attempt++){
    const code=randomCode(PARENT_LEN);
    try{
      await db.prepare("INSERT INTO vanes_parent_codes (code,uid,learner_name,learner_level,created_at) VALUES (?1,?2,?3,?4,?5)").bind(code,uid,name||null,level||null,new Date().toISOString()).run();
      return json({ok:true,code,url:url.origin+"/parent?code="+code,learnerName:name,learnerLevel:level},200,headers);
    }catch(_){}
  }
  return json({error:"Could not create a parent code. Please try again.",code:"create-failed"},500,headers);
}

/* Public: the 8-character code is the secret, checked in constant-ish time by D1 lookup. */
export async function handleParentView(request,env,url){
  const headers=cors(request.headers.get("Origin"));
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(!env.DB)return json({error:"This service is not configured yet.",code:"no-database"},503,headers);
  const code=clean(url.searchParams.get("code"),12).toUpperCase();
  if(!/^[A-Z0-9]{6,12}$/.test(code))return json({error:"Enter the full parent code.",code:"bad-code"},400,headers);
  await ensureTables(env.DB);
  const row=await env.DB.prepare("SELECT code,uid,learner_name,learner_level,created_at,revoked FROM vanes_parent_codes WHERE code=?1").bind(code).first();
  if(!row||Number(row.revoked))return json({error:"This parent code is not active. Ask your child for a new one.",code:"not-found"},404,headers);
  const days=Math.min(Math.max(Number(url.searchParams.get("days"))||14,7),30);
  const data=await summary(env.DB,row.uid,days);
  const latest=await env.DB.prepare("SELECT MAX(updated_at) AS last FROM vanes_progress_daily WHERE uid=?1").bind(row.uid).first().catch(()=>null);
  return json({ok:true,learner:{name:row.learner_name||"VANES learner",level:row.learner_level||"",since:row.created_at,lastActivity:latest?.last||null},...data},200,headers);
}
