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

let tablesReady=false,columnsReady=false;
async function ensureTables(db){
  if(tablesReady)return;
  await db.prepare("CREATE TABLE IF NOT EXISTS vanes_short_links (code TEXT PRIMARY KEY, url TEXT NOT NULL, title TEXT, subject TEXT, uid TEXT NOT NULL, clicks INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, last_click_at TEXT)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS vanes_portal_posts (id TEXT PRIMARY KEY, uid TEXT NOT NULL, author TEXT, subject TEXT, title TEXT NOT NULL, body TEXT NOT NULL, reply_count INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS vanes_portal_replies (id TEXT PRIMARY KEY, post_id TEXT NOT NULL, uid TEXT NOT NULL, author TEXT, body TEXT NOT NULL, created_at TEXT NOT NULL)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS vanes_progress_daily (uid TEXT NOT NULL, day TEXT NOT NULL, subject TEXT NOT NULL, level TEXT, seconds INTEGER NOT NULL DEFAULT 0, ai_questions INTEGER NOT NULL DEFAULT 0, questions INTEGER NOT NULL DEFAULT 0, correct INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, PRIMARY KEY (uid,day,subject))").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS vanes_parent_codes (code TEXT PRIMARY KEY, uid TEXT NOT NULL, learner_name TEXT, learner_level TEXT, created_at TEXT NOT NULL, revoked INTEGER NOT NULL DEFAULT 0)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS vanes_parent_links (code TEXT PRIMARY KEY, uid TEXT NOT NULL, parent_phone TEXT NOT NULL, learner_name TEXT, learner_level TEXT, created_at TEXT NOT NULL, revoked INTEGER NOT NULL DEFAULT 0)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS vanes_portal_profiles (uid TEXT PRIMARY KEY, name TEXT, level TEXT, combination TEXT, updated_at TEXT NOT NULL)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS vanes_portal_dms (id TEXT PRIMARY KEY, from_uid TEXT NOT NULL, to_uid TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL, read_at TEXT)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS vanes_portal_dms_pair ON vanes_portal_dms (from_uid,to_uid,created_at)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS vanes_portal_dms_to ON vanes_portal_dms (to_uid,read_at)").run();
  tablesReady=true;
}

/* Databases created before the social portal and the monthly pass are upgraded in place. */
async function ensureColumns(db){
  if(columnsReady)return;
  const sqls=[
    "ALTER TABLE vanes_portal_posts ADD COLUMN level TEXT",
    "ALTER TABLE vanes_portal_posts ADD COLUMN combination TEXT",
    "ALTER TABLE vanes_progress_daily ADD COLUMN sessions INTEGER NOT NULL DEFAULT 0"
  ];
  for(const sql of sqls){try{await db.prepare(sql).run()}catch(_){}}
  columnsReady=true;
}

/* Keeps a tiny public card per learner (name, level, combination) so classmates can be
   searched and messaged. Nothing else from the account is ever copied here. */
async function rememberProfile(db,uid,name,level,combination){
  if(!uid||(!name&&!level&&!combination))return;
  try{
    await db.prepare("INSERT INTO vanes_portal_profiles (uid,name,level,combination,updated_at) VALUES (?1,?2,?3,?4,?5) ON CONFLICT(uid) DO UPDATE SET name=COALESCE(NULLIF(excluded.name,''),vanes_portal_profiles.name), level=COALESCE(NULLIF(excluded.level,''),vanes_portal_profiles.level), combination=COALESCE(NULLIF(excluded.combination,''),vanes_portal_profiles.combination), updated_at=excluded.updated_at").bind(uid,name||"",level||"",combination||"",new Date().toISOString()).run();
  }catch(_){}
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
  await ensureColumns(env.DB);
  return {uid,headers,quota};
}

/* Day keys follow Tanzania wall-clock (EAT is UTC+3 all year, no DST). */
function dayKeys(days){
  const now=Date.now()+3*3600000,out=[];
  for(let i=days-1;i>=0;i--)out.push(new Date(now-i*86400000).toISOString().slice(0,10));
  return out;
}

async function summary(db,uid,days){
  const keys=dayKeys(days),since=keys[0],todayKey=keys[keys.length-1];
  const rows=await db.prepare("SELECT day,subject,level,seconds,ai_questions,questions,correct,sessions,updated_at FROM vanes_progress_daily WHERE uid=?1 AND day>=?2 ORDER BY day").bind(uid,since).all();
  const zero=()=>({seconds:0,aiQuestions:0,questions:0,correct:0,sessions:0});
  const KEYS=["seconds","aiQuestions","questions","correct","sessions"];
  const map=new Map(),activeDays=new Set(),today=zero();
  let lastActivity=null;
  for(const r of rows.results||[]){
    const key=clean(r.subject,40)||"General study";
    if(!map.has(key))map.set(key,{subject:key,level:clean(r.level,20),totals:zero(),byDay:{}});
    const s=map.get(key);
    const cell={seconds:Number(r.seconds)||0,aiQuestions:Number(r.ai_questions)||0,questions:Number(r.questions)||0,correct:Number(r.correct)||0,sessions:Number(r.sessions)||0};
    s.byDay[r.day]=cell;
    for(const k of KEYS)s.totals[k]+=cell[k];
    if(!s.level&&r.level)s.level=clean(r.level,20);
    if(cell.seconds||cell.aiQuestions||cell.questions)activeDays.add(r.day);
    if(r.day===todayKey)for(const k of KEYS)today[k]+=cell[k];
    if(r.updated_at&&(!lastActivity||r.updated_at>lastActivity))lastActivity=r.updated_at;
  }
  /* Consecutive EAT days lived in the app, counting back from today (a quiet today does not
     break a streak that was alive yesterday). */
  let streakDays=0;
  const eatNow=Date.now()+3*3600000;
  for(let i=0;i<days;i++){
    const day=new Date(eatNow-i*86400000).toISOString().slice(0,10);
    if(activeDays.has(day))streakDays++;
    else if(i>0)break;
  }
  const subjects=[...map.values()].map(s=>({subject:s.subject,level:s.level,totals:s.totals,days:keys.map(day=>({day,...(s.byDay[day]||zero())}))}));
  return {days:keys,today,streakDays,lastActivity,subjects};
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

/* --- Student portal (social) --------------------------------------------- */

/* The feed, profiles and chats all live under /api/portal so the Worker router stays simple.
   GET ?search=, ?profile=, ?inbox=1, ?thread=, ?id=, and the combination-filtered list. */
export async function handlePortal(request,env,url){
  const ctx=await gate(request,env);
  if(ctx.preflight)return ctx.preflight;
  if(ctx.error)return ctx.error;
  const {uid,headers}=ctx,db=env.DB;
  await rememberProfile(db,uid,clean(url.searchParams.get("name"),40),clean(url.searchParams.get("level"),20),clean(url.searchParams.get("combination"),20).toUpperCase());
  if(request.method==="GET"){
    const search=clean(url.searchParams.get("search"),40);
    if(search.length>=2){
      const rows=await db.prepare("SELECT uid,name,level,combination FROM vanes_portal_profiles WHERE name LIKE ?1 AND uid<>?2 ORDER BY updated_at DESC LIMIT 25").bind("%"+search+"%",uid).all();
      return json({ok:true,users:rows.results||[]},200,headers);
    }
    const profileId=clean(url.searchParams.get("profile"),64);
    if(profileId){
      const p=await db.prepare("SELECT uid,name,level,combination FROM vanes_portal_profiles WHERE uid=?1").bind(profileId).first();
      const mine=profileId===uid;
      const posts=await db.prepare("SELECT id,subject,title,substr(body,1,240) AS preview,reply_count,created_at FROM vanes_portal_posts WHERE uid=?1 ORDER BY created_at DESC LIMIT 20").bind(profileId).all();
      return json({ok:true,profile:p||{uid:profileId,name:"VANES learner",level:"",combination:""},mine,posts:posts.results||[]},200,headers);
    }
    if(url.searchParams.get("inbox")){
      const rows=await db.prepare("SELECT from_uid,to_uid,body,created_at,read_at FROM vanes_portal_dms WHERE from_uid=?1 OR to_uid=?1 ORDER BY created_at DESC LIMIT 300").bind(uid).all();
      const conv=new Map();
      for(const m of rows.results||[]){
        const peer=m.from_uid===uid?m.to_uid:m.from_uid;
        if(!conv.has(peer))conv.set(peer,{uid:peer,last:clean(m.body,140),lastAt:m.created_at,unread:0});
        if(m.to_uid===uid&&!m.read_at)conv.get(peer).unread++;
      }
      const list=[...conv.values()].slice(0,50);
      if(list.length){
        const ph=list.map((_,i)=>"?"+(i+1)).join(",");
        const profs=await db.prepare("SELECT uid,name,level,combination FROM vanes_portal_profiles WHERE uid IN ("+ph+")").bind(...list.map(c=>c.uid)).all();
        const byUid=new Map((profs.results||[]).map(p=>[p.uid,p]));
        for(const c of list){const p=byUid.get(c.uid);c.name=p?.name||"VANES learner";c.level=p?.level||"";c.combination=p?.combination||""}
      }
      return json({ok:true,chats:list},200,headers);
    }
    const peer=clean(url.searchParams.get("thread"),64);
    if(peer){
      if(peer===uid)return json({error:"You cannot message yourself.",code:"self"},400,headers);
      const prof=await db.prepare("SELECT uid,name,level,combination FROM vanes_portal_profiles WHERE uid=?1").bind(peer).first();
      const rows=await db.prepare("SELECT id,from_uid,body,created_at FROM vanes_portal_dms WHERE (from_uid=?1 AND to_uid=?2) OR (from_uid=?2 AND to_uid=?1) ORDER BY created_at ASC LIMIT 200").bind(uid,peer).all();
      await db.prepare("UPDATE vanes_portal_dms SET read_at=?1 WHERE to_uid=?2 AND from_uid=?3 AND read_at IS NULL").bind(new Date().toISOString(),uid,peer).run();
      return json({ok:true,peer:prof||{uid:peer,name:"VANES learner",level:"",combination:""},messages:rows.results||[]},200,headers);
    }
    const id=clean(url.searchParams.get("id"),40);
    if(id){
      const post=await db.prepare("SELECT id,uid,author,subject,title,body,reply_count,created_at FROM vanes_portal_posts WHERE id=?1").bind(id).first();
      if(!post)return json({error:"That question was not found — it may have been removed.",code:"not-found"},404,headers);
      const replies=await db.prepare("SELECT id,uid,author,body,created_at FROM vanes_portal_replies WHERE post_id=?1 ORDER BY created_at ASC LIMIT 100").bind(id).all();
      return json({ok:true,post,replies:replies.results||[]},200,headers);
    }
    /* Feed: questions written for the learner's own combination stay on top; general posts
       (no level or no combination tagged) remain visible to everyone. */
    const subject=clean(url.searchParams.get("subject"),40);
    const level=clean(url.searchParams.get("level"),20);
    const combination=clean(url.searchParams.get("combination"),20).toUpperCase();
    const conds=[],args=[];
    const push=(sql,val)=>{args.push(val);conds.push(sql.replace("?",()=>"?"+args.length))};
    if(subject)push("subject=?",subject);
    if(level)push("(level IS NULL OR level='' OR level=?)",level);
    if(combination)push("(combination IS NULL OR combination='' OR combination=?)",combination);
    const where=conds.length?" WHERE "+conds.join(" AND "):"";
    const rows=await db.prepare("SELECT id,uid,author,subject,level,combination,title,substr(body,1,240) AS preview,reply_count,created_at FROM vanes_portal_posts"+where+" ORDER BY created_at DESC LIMIT 50").bind(...args).all();
    return json({ok:true,posts:rows.results||[]},200,headers);
  }
  if(request.method!=="POST")return json({error:"Method not allowed"},405,headers);
  let body;try{body=await request.json()}catch{return json({error:"Invalid JSON body."},400,headers)}
  const hourAgo=new Date(Date.now()-3600000).toISOString();
  const recent=await db.prepare("SELECT (SELECT COUNT(*) FROM vanes_portal_posts WHERE uid=?1 AND created_at>?2)+(SELECT COUNT(*) FROM vanes_portal_replies WHERE uid=?1 AND created_at>?2)+(SELECT COUNT(*) FROM vanes_portal_dms WHERE from_uid=?1 AND created_at>?2) AS n").bind(uid,hourAgo).first();
  if(Number(recent?.n||0)>=30)return json({error:"You have posted a lot in the last hour. Please try again later.",code:"rate-limited"},429,headers);
  const kind=clean(body?.kind,10)||"post",author=clean(body?.author,40),now=new Date().toISOString();
  if(kind==="dm"){
    const toUid=clean(body?.toUid,64),text=clean(body?.body,2000);
    if(!toUid||toUid===uid)return json({error:"Choose a classmate to message.",code:"bad-peer"},400,headers);
    if(text.length<1)return json({error:"Write a message before sending.",code:"empty"},400,headers);
    const peer=await db.prepare("SELECT uid FROM vanes_portal_profiles WHERE uid=?1").bind(toUid).first();
    if(!peer)return json({error:"That classmate is no longer on the portal.",code:"not-found"},404,headers);
    const id=crypto.randomUUID();
    await db.prepare("INSERT INTO vanes_portal_dms (id,from_uid,to_uid,body,created_at) VALUES (?1,?2,?3,?4,?5)").bind(id,uid,toUid,text,now).run();
    return json({ok:true,message:{id,from_uid:uid,to_uid:toUid,body:text,created_at:now}},200,headers);
  }
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
  const level=clean(body?.level,20),combination=clean(body?.combination,20).toUpperCase();
  if(title.length<4)return json({error:"Give your question a short title.",code:"empty"},400,headers);
  if(text.length<4)return json({error:"Describe what you need help with.",code:"empty"},400,headers);
  const id=crypto.randomUUID();
  await db.prepare("INSERT INTO vanes_portal_posts (id,uid,author,subject,level,combination,title,body,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)").bind(id,uid,author||null,subject,level||null,combination||null,title,text,now).run();
  return json({ok:true,post:{id,author,subject,level,combination,title,body:text,reply_count:0,created_at:now}},200,headers);
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
    const questions=int(entry?.questions,500),correct=Math.min(int(entry?.correct,500),questions),sessions=int(entry?.sessions,50);
    if(!seconds&&!aiQuestions&&!questions&&!correct&&!sessions)continue;
    await db.prepare("INSERT INTO vanes_progress_daily (uid,day,subject,level,seconds,ai_questions,questions,correct,sessions,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10) ON CONFLICT(uid,day,subject) DO UPDATE SET seconds=seconds+excluded.seconds, ai_questions=ai_questions+excluded.ai_questions, questions=questions+excluded.questions, correct=correct+excluded.correct, sessions=sessions+excluded.sessions, level=CASE WHEN excluded.level<>'' THEN excluded.level ELSE vanes_progress_daily.level END, updated_at=excluded.updated_at").bind(uid,day,subject,level||null,seconds,aiQuestions,questions,correct,sessions,now).run();
    saved++;
  }
  return json({ok:true,saved},200,headers);
}

/* --- Parent access ------------------------------------------------------- */

const phoneDigits=v=>String(v||"").replace(/[^0-9]/g,"");

/* A WhatsApp deep link addressed to the parent's own number, with the private progress
   link already written out — the learner just taps send. */
function waLink(origin,code,parentDigits,name){
  const who=clean(name,40)||"your child";
  const text="VANES AI study progress for "+who+": "+origin+"/parent?code="+code+" — open it any time to follow study minutes, questions and subjects. Keep this link private.";
  return "https://wa.me/"+parentDigits+"?text="+encodeURIComponent(text);
}

/* Up to two parents per learner. The parent's number must differ from the number on the
   learner's own VANES account, so the parent panel can never be opened with the student's
   sign-up number. POST links, GET lists, DELETE removes. */
export async function handleParentCode(request,env,url){
  const ctx=await gate(request,env);
  if(ctx.preflight)return ctx.preflight;
  if(ctx.error)return ctx.error;
  const {uid,headers}=ctx,db=env.DB;
  const active=async()=>(await db.prepare("SELECT code,parent_phone,learner_name,learner_level,created_at FROM vanes_parent_links WHERE uid=?1 AND revoked=0 ORDER BY created_at ASC").bind(uid).all()).results||[];
  const parents=(list,learnerName)=>list.map(x=>({code:x.code,parentPhone:x.parent_phone,learnerName:x.learner_name||learnerName||"",learnerLevel:x.learner_level||"",createdAt:x.created_at,url:url.origin+"/parent?code="+x.code,whatsapp:waLink(url.origin,x.code,phoneDigits(x.parent_phone),x.learner_name||learnerName)}));
  if(request.method==="GET"){
    const list=await active();
    return json({ok:true,max:2,parents:parents(list,""),count:list.length},200,headers);
  }
  if(request.method==="DELETE"){
    const code=clean(url.searchParams.get("code"),12).toUpperCase();
    if(!code)return json({error:"A parent code is required.",code:"bad-code"},400,headers);
    const res=await db.prepare("UPDATE vanes_parent_links SET revoked=1 WHERE code=?1 AND uid=?2 AND revoked=0").bind(code,uid).run();
    return json({ok:true,removed:Number(res?.meta?.changes||0)},200,headers);
  }
  if(request.method!=="POST")return json({error:"Method not allowed"},405,headers);
  let body;try{body=await request.json()}catch{return json({error:"Invalid JSON body."},400,headers)}
  const name=clean(body?.learnerName,40),level=clean(body?.learnerLevel,20);
  const parentPhone=clean(body?.parentPhone,25),learnerPhone=clean(body?.learnerPhone,25);
  const parentDigits=phoneDigits(parentPhone),learnerDigits=phoneDigits(learnerPhone);
  if(parentDigits.length<9||parentDigits.length>15)return json({error:"Enter the parent's phone number with country code, e.g. +255 7xx xxx xxx.",code:"bad-phone"},400,headers);
  if(learnerDigits&&parentDigits===learnerDigits)return json({error:"That is the number on this VANES account. Parent access needs the parent's own number instead.",code:"same-number"},400,headers);
  const list=await active();
  const dupe=list.find(x=>phoneDigits(x.parent_phone)===parentDigits);
  if(dupe){
    if(name||level)await db.prepare("UPDATE vanes_parent_links SET learner_name=COALESCE(NULLIF(?1,''),learner_name), learner_level=COALESCE(NULLIF(?2,''),learner_level) WHERE code=?3").bind(name,level,dupe.code).run();
    return json({ok:true,reused:true,code:dupe.code,count:list.length,parents:parents(list,name)},200,headers);
  }
  if(list.length>=2)return json({error:"Two parents are already linked. Remove one before adding another.",code:"limit"},409,headers);
  for(let attempt=0;attempt<4;attempt++){
    const code=randomCode(PARENT_LEN);
    try{
      await db.prepare("INSERT INTO vanes_parent_links (code,uid,parent_phone,learner_name,learner_level,created_at) VALUES (?1,?2,?3,?4,?5,?6)").bind(code,uid,parentPhone,name||null,level||null,new Date().toISOString()).run();
      const all=await active();
      return json({ok:true,code,count:all.length,parents:parents(all,name)},200,headers);
    }catch(_){}
  }
  return json({error:"Could not link this parent. Please try again.",code:"create-failed"},500,headers);
}

/* Public: the 8-character code is the secret, checked in constant-ish time by D1 lookup.
   Old one-code links created before parent numbers existed keep working. */
export async function handleParentView(request,env,url){
  const headers=cors(request.headers.get("Origin"));
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(!env.DB)return json({error:"This service is not configured yet.",code:"no-database"},503,headers);
  const code=clean(url.searchParams.get("code"),12).toUpperCase();
  if(!/^[A-Z0-9]{6,12}$/.test(code))return json({error:"Enter the full parent code.",code:"bad-code"},400,headers);
  await ensureTables(env.DB);
  await ensureColumns(env.DB);
  let row=await env.DB.prepare("SELECT code,uid,learner_name,learner_level,created_at,revoked FROM vanes_parent_links WHERE code=?1").bind(code).first().catch(()=>null);
  if(!row)row=await env.DB.prepare("SELECT code,uid,learner_name,learner_level,created_at,revoked FROM vanes_parent_codes WHERE code=?1").bind(code).first();
  if(!row||Number(row.revoked))return json({error:"This parent code is not active. Ask your child for a new one.",code:"not-found"},404,headers);
  const days=Math.min(Math.max(Number(url.searchParams.get("days"))||14,7),30);
  const data=await summary(env.DB,row.uid,days);
  const latest=await env.DB.prepare("SELECT MAX(updated_at) AS last FROM vanes_progress_daily WHERE uid=?1").bind(row.uid).first().catch(()=>null);
  return json({ok:true,learner:{name:row.learner_name||"VANES learner",level:row.learner_level||"",since:row.created_at,lastActivity:data.lastActivity||latest?.last||null},...data},200,headers);
}
