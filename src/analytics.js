/* Every response needs the CORS headers, not just the preflight: without them the browser
   blocks a readable error body and reports a CORS failure instead of the real reason. */
function json(data,status=200,extra){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra}})}
function cors(origin){return {'Access-Control-Allow-Origin':origin||'*','Access-Control-Allow-Headers':'Content-Type,Authorization','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Vary':'Origin'}}
function clean(v,max=4000){return typeof v==='string'?v.slice(0,max):v}
export async function handleAnalytics(request,env){
 const headers={...cors(request.headers.get('Origin'))};
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return json({error:'Method not allowed'},405,headers);
 if(!env.DB)return json({ok:false,stored:false,error:'Analytics database is not configured yet.'},503,headers);
 let body;try{body=await request.json()}catch{return json({error:'Invalid JSON body.'},400,headers)};
 const event=clean(body?.event,80),anonymousId=clean(body?.anonymousId,120),userName=clean(body?.userName,120),payload=body?.payload&&typeof body.payload==='object'?body.payload:{};
 if(!event||!anonymousId)return json({error:'event and anonymousId are required.'},400,headers);
 const safe={...payload};
 if(safe.question) safe.question=clean(safe.question,4000);
 if(safe.answer) safe.answer=clean(safe.answer,4000);
 if(safe.comment) safe.comment=clean(safe.comment,1500);
 try{
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS vanes_users (anonymous_id TEXT PRIMARY KEY, user_name TEXT, level TEXT, combination TEXT, first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS vanes_events (id INTEGER PRIMARY KEY AUTOINCREMENT, anonymous_id TEXT NOT NULL, user_name TEXT, event TEXT NOT NULL, payload TEXT, created_at TEXT NOT NULL)').run();
  const now=String(body?.at||new Date().toISOString());
  await env.DB.prepare('INSERT INTO vanes_users (anonymous_id,user_name,level,combination,first_seen_at,last_seen_at) VALUES (?1,?2,?3,?4,?5,?5) ON CONFLICT(anonymous_id) DO UPDATE SET user_name=COALESCE(excluded.user_name,vanes_users.user_name),level=COALESCE(excluded.level,vanes_users.level),combination=COALESCE(excluded.combination,vanes_users.combination),last_seen_at=excluded.last_seen_at').bind(anonymousId,userName||null,safe.level||null,safe.combination||null,now).run();
  await env.DB.prepare('INSERT INTO vanes_events (anonymous_id,user_name,event,payload,created_at) VALUES (?1,?2,?3,?4,?5)').bind(anonymousId,userName||null,event,JSON.stringify(safe),now).run();
  return json({ok:true,stored:true},200,headers);
 }catch(e){return json({ok:false,stored:false,error:'Analytics database write failed.',detail:e?.message||String(e)},500,headers)}
}
export async function handleAdminAnalytics(request,env){
 const headers={...cors(request.headers.get('Origin'))};
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 const auth=request.headers.get('Authorization')||'';
 const token=auth.startsWith('Bearer ')?auth.slice(7):'';
 if(!env.ADMIN_ANALYTICS_TOKEN||token!==env.ADMIN_ANALYTICS_TOKEN)return json({error:env.ADMIN_ANALYTICS_TOKEN?'Unauthorized':'ADMIN_ANALYTICS_TOKEN is not configured on this Worker.'},401,headers);
 if(!env.DB)return json({error:'Analytics database is not configured.'},503,headers);
 try{
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS vanes_users (anonymous_id TEXT PRIMARY KEY, user_name TEXT, level TEXT, combination TEXT, first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL)').run();
  /* vanes_events must exist too, or the very first dashboard load on a fresh
     database fails on the SELECT before any learner has sent an event. */
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS vanes_events (id INTEGER PRIMARY KEY AUTOINCREMENT, anonymous_id TEXT NOT NULL, user_name TEXT, event TEXT NOT NULL, payload TEXT, created_at TEXT NOT NULL)').run();
  const totals=await env.DB.prepare('SELECT (SELECT COUNT(*) FROM vanes_events) AS events, (SELECT COUNT(*) FROM vanes_users) AS users').first();
  const users=await env.DB.prepare('SELECT anonymous_id,user_name,level,combination,first_seen_at,last_seen_at FROM vanes_users ORDER BY last_seen_at DESC LIMIT 200').all();
  const recent=await env.DB.prepare('SELECT anonymous_id,user_name,event,payload,created_at FROM vanes_events ORDER BY id DESC LIMIT 100').all();
  return json({ok:true,totals,users:users.results||[],recent:recent.results||[]},200,headers);
 }catch(e){return json({error:'Analytics database read failed.',detail:e?.message||String(e)},500,headers)}
}