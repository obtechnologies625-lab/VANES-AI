/* VANES AI — Premium hub: study-link shortener, student portal, per-subject study tracker,
   parent access and profile pictures. Premium is unlocked with the OB Tech-Labs upgrade
   code issued after the 3,500 TZS Airtel Money donation. Every server tool is enforced in
   src/premium.js against a verified Firebase session, so this file only paints the UI. */
(function(){
'use strict';
const PREMIUM='vanes-premium-v1',PENDING='vanes-premium-progress-v1',PROFILE2='vanes-learner-profile-v2',PROFILE1='vanes-learner-profile-v1',AVATAR='vanes-profile-picture-v1',ACTIVE_MODE='vanes-active-subject-v1',DEFAULT_AVATAR='assets/vanes-turbine-wheel.svg';
const read=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k));return v??f}catch(_){return f}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch(_){return false}};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const premium=()=>read(PREMIUM,null);
const profile=()=>read(PROFILE2,null)||read(PROFILE1,null);
const myName=()=>profile()?.name||window.VANES_ACCOUNT?.session?.()?.name||'VANES learner';
const apiBase=()=>String(window.VANES_CHAT_ENDPOINT||location.origin+'/api/chat').replace(/\/api\/chat$/,'');
/* Tanzania wall-clock day keys (EAT is UTC+3 all year), matching the Worker's counters. */
const eatDay=()=>new Date(Date.now()+3*3600000).toISOString().slice(0,10);
const dayWindow=n=>{const out=[];const now=Date.now()+3*3600000;for(let i=n-1;i>=0;i--)out.push(new Date(now-i*86400000).toISOString().slice(0,10));return out};
const fmtDur=s=>{s=Math.max(0,Math.round(Number(s)||0));const h=Math.floor(s/3600),m=Math.round(s%3600/60);return h?h+'h '+m+'m':m+' min'};
const fmtDate=iso=>{try{return new Date(iso).toLocaleString(undefined,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}catch(_){return ''}};
const svgURI=s=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(s);
const frame=(a,b,inner)=>svgURI('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="'+a+'"/><stop offset="1" stop-color="'+b+'"/></linearGradient></defs><rect width="200" height="200" rx="44" fill="url(#bg)"/>'+inner+'</svg>');
const AVATARS=[
 ['Turbine',frame('#08111f','#0e3b52','<g fill="none" stroke="#00e5ff" stroke-width="7" stroke-linecap="round"><path d="M100 100V34M100 100l57-33M100 100l57 33M100 100v66M100 100l-57 33M100 100L43 67"/></g><circle cx="100" cy="100" r="17" fill="#00e5ff"/>')],
 ['Atom',frame('#160b33','#2b1b5e','<g fill="none" stroke="#a78bfa" stroke-width="6"><ellipse cx="100" cy="100" rx="72" ry="28"/><ellipse cx="100" cy="100" rx="72" ry="28" transform="rotate(60 100 100)"/><ellipse cx="100" cy="100" rx="72" ry="28" transform="rotate(120 100 100)"/></g><circle cx="100" cy="100" r="13" fill="#a78bfa"/>')],
 ['Rocket',frame('#2a0a2e','#5a1450','<path d="M100 34c20 18 30 44 30 72l-18 14H88l-18-14c0-28 10-54 30-72z" fill="#ff4d9d"/><path d="M86 124l-18 28 26-8zM114 124l18 28-26-8z" fill="#ffd166"/><circle cx="100" cy="84" r="11" fill="#0b0f19"/><path d="M100 138c6 10 6 20 0 30-6-10-6-20 0-30z" fill="#ffd166"/>')],
 ['Flask',frame('#04170f','#0b3d2e','<path d="M84 42h32v36l34 62a14 14 0 0 1-12 21H62a14 14 0 0 1-12-21l34-62z" fill="none" stroke="#34d399" stroke-width="8" stroke-linejoin="round"/><path d="M70 122h60l10 18a8 8 0 0 1-7 12H67a8 8 0 0 1-7-12z" fill="#34d399"/>')],
 ['Book',frame('#061428','#123a63','<path d="M100 58c-14-10-34-14-52-12v96c18-2 38 2 52 12 14-10 34-14 52-12V46c-18-2-38 2-52 12z" fill="#60a5fa"/><path d="M100 58v96" stroke="#0b0f19" stroke-width="6"/>')],
 ['Star',frame('#241a02','#4a3406','<path d="M100 34l18 44 48 5-36 32 11 47-41-25-41 25 11-47-36-32 48-5z" fill="#facc15"/>')],
 ['Planet',frame('#220f04','#4a2208','<circle cx="100" cy="96" r="46" fill="#fb923c"/><ellipse cx="100" cy="104" rx="78" ry="22" fill="none" stroke="#fdba74" stroke-width="8" transform="rotate(-18 100 104)"/>')],
 ['Chip',frame('#04191c','#0b3a40','<rect x="58" y="58" width="84" height="84" rx="14" fill="none" stroke="#2dd4bf" stroke-width="8"/><g stroke="#2dd4bf" stroke-width="8" stroke-linecap="round"><path d="M76 32v24M100 32v24M124 32v24M76 144v24M100 144v24M124 144v24M32 76h24M32 100h24M32 124h24M144 76h24M144 100h24M144 124h24"/></g><rect x="86" y="86" width="28" height="28" rx="6" fill="#2dd4bf"/>')]
];

function css(){if(document.getElementById('vanes-premium-css'))return;const s=document.createElement('style');s.id='vanes-premium-css';s.textContent=
'#premiumRoot{display:grid;gap:14px}'+
'.pm-tabs{display:flex;flex-wrap:wrap;gap:8px}'+
'.pm-tab{padding:9px 15px;border-radius:999px;border:1px solid var(--line,#2a3b55);background:transparent;color:inherit;font:700 12.5px inherit;cursor:pointer}'+
'.pm-tab.on{border-color:#00e5ff;color:#00e5ff}'+
'.pm-card{padding:18px}'+
'.pm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}'+
'.pm-teasers{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin-top:12px}'+
'.pm-teaser{padding:12px;border:1px solid var(--line,#2a3b55);border-radius:14px}'+
'.pm-teaser b{display:block;margin-bottom:4px}'+
'.pm-teaser small{opacity:.75;line-height:1.5}'+
'.pm-card label{display:grid;gap:6px;margin-bottom:10px;font-size:12.5px;font-weight:700}'+
'.pm-card input,.pm-card select,.pm-card textarea{box-sizing:border-box;width:100%;padding:11px;border-radius:10px;border:1px solid #33425e;background:#fff;color:#111;font:inherit}'+
'.pm-card textarea{min-height:90px;resize:vertical}'+
'.pm-row{display:flex;gap:9px;flex-wrap:wrap;align-items:center}'+
'.pm-item{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:12px;border:1px solid var(--line,#2a3b55);border-radius:14px;margin-top:8px}'+
'.pm-item small{display:block;opacity:.72;margin-top:3px;word-break:break-all}'+
'.pm-empty{opacity:.75;font-size:13px;padding:8px 0}'+
'.pm-error{color:#ff9fca;font-size:12.5px;min-height:16px;margin:8px 0}'+
'.pm-ok{color:#7ef0c0;font-size:12.5px;min-height:16px;margin:8px 0}'+
'.pm-hist{display:flex;gap:6px;align-items:flex-end;height:190px;padding:12px 6px 0;overflow-x:auto}'+
'.pm-col{display:grid;grid-template-rows:1fr auto;gap:6px;justify-items:center;min-width:26px;height:100%}'+
'.pm-track{width:100%;display:flex;align-items:flex-end;height:100%}'+
'.pm-bar{width:100%;border-radius:6px 6px 2px 2px;background:linear-gradient(180deg,#00e5ff,#7c3aed);min-height:2px}'+
'.pm-bar.today{background:linear-gradient(180deg,#ffb84d,#ff4d9d)}'+
'.pm-col span{font-size:10px;opacity:.7}'+
'.pm-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:10px 0}'+
'.pm-metric{padding:12px;border:1px solid var(--line,#2a3b55);border-radius:14px}'+
'.pm-metric b{display:block;font-size:19px}'+
'.pm-metric small{opacity:.7}'+
'.pm-subject-list{display:grid;gap:6px;margin-top:10px}'+
'.pm-subject-row{display:flex;justify-content:space-between;gap:10px;padding:9px 11px;border:1px solid var(--line,#2a3b55);border-radius:11px;background:transparent;color:inherit;cursor:pointer;font:inherit;text-align:left;width:100%}'+
'.pm-subject-row.on{border-color:#00e5ff}'+
'.pm-code{font:800 26px/1.3 ui-monospace,monospace;letter-spacing:6px;color:#00e5ff;word-break:break-all}'+
'.pm-reply{padding:11px;border:1px solid var(--line,#2a3b55);border-radius:12px;margin-top:8px}'+
'.pm-reply.own{border-color:#7c3aed}'+
'.pm-avatar-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:10px;margin:12px 0}'+
'.pm-avatar{border:2px solid transparent;border-radius:50%;padding:0;width:64px;height:64px;cursor:pointer;overflow:hidden;background:transparent}'+
'.pm-avatar img{width:100%;height:100%;display:block}'+
'.pm-avatar.on{border-color:#00e5ff}'+
'.pm-avatar-preview{width:104px;height:104px;border-radius:50%;object-fit:cover;border:2px solid #00e5ff;background-size:cover;background-position:center}'+
'.vanes-avatar-image{background-size:cover!important;background-position:center!important}'+
'@media(max-width:560px){.pm-hist{height:160px}.pm-item{flex-direction:column;align-items:stretch}}';
document.head.appendChild(s)}

/* Every premium server call carries the Firebase ID token plus the upgrade code, exactly
   as src/premium.js's gate expects. */
async function api(path,opts={}){
 const headers={'Content-Type':'application/json',...(opts.headers||{})};
 let token='';try{token=await window.VANES_FB?.idToken?.()}catch(_){}
 if(token)headers.Authorization='Bearer '+token;
 const p=premium();if(p?.code)headers['X-VANES-Upgrade-Code']=String(p.code);
 try{
  const r=await fetch(apiBase()+path,{...opts,headers});
  let data=null;try{data=await r.json()}catch(_){}
  return {ok:r.ok,status:r.status,data};
 }catch(e){return {ok:false,status:0,data:{error:'Cannot reach VANES right now — check your connection.',code:'offline'}}}
}
function errText(r){
 const d=r.data||{};
 if(r.status===401)return (d.error||'Sign in to VANES to use premium tools.')+' Premium server tools need a cloud account — sign in with email or Google (a device-only account cannot reach the premium servers).';
 if(r.status===402)return 'VANES Premium is required for this tool. Donate 3,500 TZS with Airtel Money to unlock it.';
 if(r.status===503)return d.error||'The premium service is not ready on the server yet. Try again later.';
 return d.error||('Request failed ('+(r.status||'offline')+').');
}
async function copy(text,btn){
 try{await navigator.clipboard.writeText(text)}catch(_){
  const t=document.createElement('textarea');t.value=text;t.style.position='fixed';t.style.opacity='0';
  document.body.appendChild(t);t.select();try{document.execCommand('copy')}catch(_2){}t.remove();
 }
 if(btn){const old=btn.textContent;btn.textContent='Copied ✓';setTimeout(()=>{btn.textContent=old},1500)}
}

/* Profile pictures -------------------------------------------------------- */
function paintAvatar(src){
 const stored=src||localStorage.getItem(AVATAR);if(!stored)return;
 document.querySelectorAll('#profileAvatar').forEach(e=>{e.textContent='';e.style.backgroundImage='url("'+stored+'")';e.classList.add('vanes-avatar-image')});
 document.querySelectorAll('.vp-photo').forEach(e=>{e.src=stored});
 const preview=document.getElementById('pmAvatarPreview');
 if(preview)preview.style.backgroundImage='url("'+stored+'")';
}
function saveAvatar(dataURL){
 try{localStorage.setItem(AVATAR,dataURL)}catch(_){return false}
 paintAvatar(dataURL);return true;
}
function shrinkPhoto(file,done){
 const url=URL.createObjectURL(file),img=new Image();
 img.onload=()=>{
  URL.revokeObjectURL(url);
  const scale=Math.min(256/img.width,256/img.height,1);
  const c=document.createElement('canvas');
  c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));
  c.getContext('2d').drawImage(img,0,0,c.width,c.height);
  let data='';try{data=c.toDataURL('image/jpeg',.82)}catch(_){}
  done(data);
 };
 img.onerror=()=>{URL.revokeObjectURL(url);done('')};
 img.src=url;
}

/* Study tracker observation ------------------------------------------------ */
/* vanes-study-system.js is module-private, so its /api/analytics calls are observed as they
   pass through fetch and mirrored into a small per-day buffer that syncs to the Worker. */
let flushTimer=0,flushing=false;
function scheduleFlush(delay){clearTimeout(flushTimer);flushTimer=setTimeout(()=>{void flushProgress()},delay||4000)}
function pendingCount(){const p=read(PENDING,null)?.pending||{};let n=0;for(const d of Object.keys(p))for(const s of Object.keys(p[d]))n++;return n}
function bufferAdd(day,subject,level,delta){
 if(!premium())return;
 const keys=['seconds','aiQuestions','questions','correct'];
 let sum=0;for(const k of keys)sum+=Math.max(0,Number(delta[k])||0);
 if(!sum)return;
 const all=read(PENDING,null)||{pending:{}};
 all.pending=all.pending||{};
 const d=all.pending[day]=all.pending[day]||{};
 const s=d[subject]=d[subject]||{level:level||'',seconds:0,aiQuestions:0,questions:0,correct:0};
 if(level)s.level=level;
 for(const k of keys)s[k]=(Number(s[k])||0)+Math.max(0,Number(delta[k])||0);
 write(PENDING,all);
 scheduleFlush();
}
function observeAnalytics(url,init){
 if(!/\/api\/analytics(?:\?|$)/.test(url))return;
 if(String(init?.method||'GET').toUpperCase()!=='POST'||typeof init?.body!=='string')return;
 let body=null;try{body=JSON.parse(init.body)}catch(_){return}
 const ev=String(body?.event||''),p=body?.payload||{},mode=read(ACTIVE_MODE,null);
 const subject=p.subject||mode?.subject||'General study',level=p.level||mode?.level||'',day=eatDay();
 if(ev==='chat_request')bufferAdd(day,subject,level,{aiQuestions:1});
 else if(ev==='question_session_completed')bufferAdd(day,subject,level,{questions:Number(p.total)||0,correct:Math.min(Number(p.score)||0,Number(p.total)||0)});
 else if(ev==='study_session_completed')bufferAdd(day,subject,level,{seconds:Math.max(0,Number(p.durationSeconds)||0)});
}
function hookFetch(){
 if(window.__vanesPremiumObserver)return;
 window.__vanesPremiumObserver=true;
 const nativeFetch=window.fetch.bind(window);
 window.fetch=function(input,init){
  try{observeAnalytics(typeof input==='string'?input:(input?.url||''),init)}catch(_){}
  return nativeFetch(input,init);
 };
}
async function flushProgress(){
 if(flushing)return {sent:0,ok:false};
 if(!premium())return {sent:0,ok:false};
 if(!(window.VANES_FB?.ok&&window.VANES_FB.user()))return {sent:0,ok:false};
 const all=read(PENDING,null);if(!all?.pending)return {sent:0,ok:false};
 const entries=[],sent=[];
 outer:for(const day of Object.keys(all.pending)){
  for(const subject of Object.keys(all.pending[day])){
   const v=all.pending[day][subject];if(!v)continue;
   entries.push({day,subject,level:v.level||'',seconds:v.seconds||0,aiQuestions:v.aiQuestions||0,questions:v.questions||0,correct:v.correct||0});
   sent.push({day,subject,v:{...v}});
   if(entries.length>=60)break outer;
  }
 }
 if(!entries.length)return {sent:0,ok:false};
 flushing=true;
 try{
  const r=await api('/api/track/progress',{method:'POST',body:JSON.stringify({entries})});
  if(r.ok){
   const cur=read(PENDING,{pending:{}});
   const keys=['seconds','aiQuestions','questions','correct'];
   for(const item of sent){
    const day=cur.pending?.[item.day];if(!day||!day[item.subject])continue;
    const t=day[item.subject];let zero=true;
    for(const k of keys){t[k]=Math.max(0,(Number(t[k])||0)-(Number(item.v[k])||0));if(t[k]>0)zero=false}
    if(zero)delete day[item.subject];
    if(day&&!Object.keys(day).length)delete cur.pending[item.day];
   }
   write(PENDING,cur);
   return {sent:entries.length,ok:true};
  }
  return {sent:0,ok:false};
 }catch(_){return {sent:0,ok:false}}finally{flushing=false}
}

/* Hub shell --------------------------------------------------------------- */
let tab='links',paintToken=0;
const TABS=[['links','Study links'],['portal','Student portal'],['tracker','Study tracker'],['parents','Parent access'],['profile','Profile picture']];
function heroHTML(p){
 const s=window.VANES_ACCOUNT?.session?.()||{};
 const sync=s.uid?'synced to your cloud account':'this device only — sign in with email or Google so parents can follow your progress';
 return '<section class="panel pm-card"><div class="pm-row" style="justify-content:space-between"><div><p class="eyebrow">VANES PREMIUM</p><h2>Premium tools are unlocked</h2><p class="support-copy">Code '+esc(p.code)+' · '+esc(sync)+'.</p></div><button class="secondary-button" type="button" id="pmSyncNow">Sync progress</button></div></section>';
}
function lockedHTML(){
 return '<article class="panel pm-card"><p class="eyebrow">VANES PREMIUM</p><h2>Unlock the premium study tools</h2>'+
 '<p class="support-copy">One-time donation of 3,500 TZS per learner, paid with Airtel Money on your phone. The moment the payment is confirmed, the OB Tech-Labs code counter issues your VANES-PRO upgrade code on screen — and it unlocks everything below.</p>'+
 '<div class="pm-teasers">'+
 '<div class="pm-teaser"><b>Study-link shortener</b><small>Short VANES links for long study videos and articles — video quality and every parameter stay exactly the same.</small></div>'+
 '<div class="pm-teaser"><b>Student portal</b><small>Post questions and answer what other learners are solving.</small></div>'+
 '<div class="pm-teaser"><b>Study tracker</b><small>Minutes, question attempts and AI questions per subject, day by day as a histogram.</small></div>'+
 '<div class="pm-teaser"><b>Parent access</b><small>Give your parent a code so they can follow your progress from their phone.</small></div>'+
 '<div class="pm-teaser"><b>Profile pictures</b><small>Upload your own photo or pick one of the VANES avatars.</small></div>'+
 '</div>'+
 '<div class="pm-row" style="margin-top:14px"><button class="primary-button" type="button" id="pmDonate">Donate 3,500 TZS with Airtel Money →</button></div>'+
 '<div class="pm-row" style="margin-top:10px"><input id="pmCode" maxlength="40" placeholder="VANES-PRO upgrade code" style="flex:1;min-width:180px"><button class="secondary-button" type="button" id="pmApply">Unlock</button></div>'+
 '<div id="pmLockStatus" class="pm-error"></div>'+
 '<p class="support-copy">Premium server tools (links, portal, tracker and parent access) need a cloud VANES account — sign in with email or Google. The code is stored with the account, so signing in on another device restores Premium.</p></article>';
}
function bindLocked(root){
 root.querySelector('#pmDonate').addEventListener('click',()=>window.VANES_DONATE?.open?.({source:'premium'}));
 const input=root.querySelector('#pmCode'),status=root.querySelector('#pmLockStatus');
 root.querySelector('#pmApply').addEventListener('click',async()=>{
  status.textContent='Checking the code…';
  const r=await window.VANES_ACCOUNT?.applyCode?.(input.value);
  if(r?.ok){render();return}
  status.textContent=r?.error||'That code did not work.';
 });
}
function render(){
 const root=document.getElementById('premiumRoot');if(!root)return;
 const p=premium();
 if(!p){root.innerHTML=lockedHTML();bindLocked(root);return}
 root.innerHTML=heroHTML(p)+'<div class="pm-tabs" id="pmTabs">'+TABS.map(([id,label])=>'<button type="button" class="pm-tab'+(id===tab?' on':'')+'" data-tab="'+id+'">'+label+'</button>').join('')+'</div><div id="pmPanel"></div>';
 root.querySelectorAll('.pm-tab').forEach(b=>b.addEventListener('click',()=>{
  tab=b.dataset.tab;
  root.querySelectorAll('.pm-tab').forEach(x=>x.classList.toggle('on',x===b));
  paintTab();
 }));
 root.querySelector('#pmSyncNow')?.addEventListener('click',async e=>{
  e.target.textContent='Syncing…';
  const r=await flushProgress();
  e.target.textContent=r.sent?('Synced '+r.sent+' entr'+(r.sent===1?'y':'ies')+' ✓'):(window.VANES_FB?.ok&&window.VANES_FB.user()?'Nothing new to sync':'Sign in with a cloud account first');
  setTimeout(()=>{e.target.textContent='Sync progress'},2600);
 });
 paintTab();
}
function errorCard(r,note){
 return '<article class="panel pm-card"><h2>Premium tools</h2><p class="pm-error">'+esc(errText(r))+'</p>'+(note?'<p class="support-copy">'+esc(note)+'</p>':'')+'<div class="pm-row"><button class="primary-button" type="button" id="pmRetry">Try again</button><button class="secondary-button" type="button" id="pmDonate2">Get Premium — 3,500 TZS</button></div></article>';
}
function bindErrorCard(panel){
 panel.querySelector('#pmRetry')?.addEventListener('click',()=>paintTab());
 panel.querySelector('#pmDonate2')?.addEventListener('click',()=>window.VANES_DONATE?.open?.({source:'premium'}));
}
function paintTab(){
 const panel=document.getElementById('pmPanel');if(!panel)return;
 paintToken++;
 panel.innerHTML='<article class="panel pm-card"><p class="pm-empty">Opening…</p></article>';
 if(tab==='links')void renderLinks(panel);
 else if(tab==='portal')void renderPortal(panel);
 else if(tab==='tracker')void renderTracker(panel);
 else if(tab==='parents')void renderParents(panel);
 else renderProfile(panel);
}

/* Study-link shortener ---------------------------------------------------- */
async function renderLinks(panel){
 const my=paintToken;
 const r=await api('/api/links');
 if(my!==paintToken||!panel.isConnected)return;
 if(!r.ok){panel.innerHTML=errorCard(r);bindErrorCard(panel);return}
 const subjects=[...new Set([...(profile()?.subjects||[]),'General study'])].sort();
 panel.innerHTML='<article class="panel pm-card"><h2>Study-link shortener</h2>'+
 '<p class="support-copy">Paste a long YouTube, article or PDF link. VANES returns a short VANES link that redirects straight to the original URL — byte for byte, so video quality and every query parameter stay exactly as you saved them.</p>'+
 '<form id="pmLinkForm"><label>Study link (YouTube, article, PDF…)<input id="pmLinkUrl" type="url" placeholder="https://…" maxlength="2000" required></label>'+
 '<div class="pm-grid"><label>Title (optional)<input id="pmLinkTitle" maxlength="80" placeholder="e.g. Organic chemistry revision"></label>'+
 '<label>Subject (optional)<input id="pmLinkSubject" list="pmSubjectList" maxlength="40" placeholder="e.g. Chemistry"><datalist id="pmSubjectList">'+subjects.map(s=>'<option value="'+esc(s)+'"></option>').join('')+'</datalist></label></div>'+
 '<div class="pm-row"><button class="primary-button" type="submit">Shorten link →</button><span id="pmLinkStatus" class="pm-ok"></span></div></form>'+
 '<div id="pmLinkList"></div></article>';
 const form=panel.querySelector('#pmLinkForm'),status=panel.querySelector('#pmLinkStatus');
 form.addEventListener('submit',async e=>{
  e.preventDefault();
  status.className='pm-ok';status.textContent='Creating…';
  const r2=await api('/api/links',{method:'POST',body:JSON.stringify({url:form.querySelector('#pmLinkUrl').value.trim(),title:form.querySelector('#pmLinkTitle').value.trim(),subject:form.querySelector('#pmLinkSubject').value.trim()})});
  if(!r2.ok){status.className='pm-error';status.textContent=errText(r2);return}
  status.textContent='Short link ready: '+r2.data.short;
  form.querySelector('#pmLinkUrl').value='';form.querySelector('#pmLinkTitle').value='';
  await fillLinks(panel);
 });
 await fillLinks(panel);
}
function linkRow(l){
 const short=apiBase()+'/s/'+l.code;
 return '<div class="pm-item" data-code="'+esc(l.code)+'"><div><b>'+esc(l.title||l.url)+'</b>'+(l.subject?' <small style="display:inline;opacity:.85">· '+esc(l.subject)+'</small>':'')+
 '<small>'+esc(l.url)+'</small><small>'+esc(short)+' · '+Number(l.clicks||0)+' click'+(Number(l.clicks)===1?'':'s')+'</small></div>'+
 '<div class="pm-row"><button type="button" class="secondary-button" data-copy="'+esc(short)+'">Copy</button><button type="button" class="secondary-button" data-open="'+esc(short)+'">Open</button><button type="button" class="secondary-button" data-del="'+esc(l.code)+'">Delete</button></div></div>';
}
async function fillLinks(panel){
 const box=panel.querySelector('#pmLinkList');if(!box)return;
 const r=await api('/api/links');
 if(!panel.isConnected)return;
 if(!r.ok){box.innerHTML='<p class="pm-error">'+esc(errText(r))+'</p>';return}
 const links=r.data?.links||[];
 box.innerHTML=links.length?'<div class="pm-subject-list">'+links.map(linkRow).join('')+'</div>':'<p class="pm-empty">No study links yet. Your first short link appears here with its click count.</p>';
 box.querySelectorAll('[data-copy]').forEach(b=>b.addEventListener('click',()=>copy(b.dataset.copy,b)));
 box.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>window.open(b.dataset.open,'_blank','noopener')));
 box.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',async()=>{
  b.disabled=true;
  const r2=await api('/api/links?code='+encodeURIComponent(b.dataset.del),{method:'DELETE'});
  if(r2.ok){b.closest('.pm-item')?.remove();window.showToast?.('Study link deleted')}
  else{b.disabled=false;window.showToast?.(errText(r2))}
 }));
}

/* Student portal ---------------------------------------------------------- */
const portal={mode:'list',postId:'',subject:''};
function portalSubjects(){
 const set=new Set([...(profile()?.subjects||[]),'General study']);
 return [...set].sort();
}
async function renderPortal(panel){
 if(portal.mode==='thread')return renderThread(panel);
 const my=paintToken;
 const list=r=>api('/api/portal'+(r?'?subject='+encodeURIComponent(r):''));
 const first=await list(portal.subject);
 if(my!==paintToken||!panel.isConnected)return;
 if(!first.ok){panel.innerHTML=errorCard(first);bindErrorCard(panel);return}
 const subjects=portalSubjects();
 panel.innerHTML='<article class="panel pm-card"><h2>Student portal</h2>'+
 '<p class="support-copy">Ask a question and learners across VANES can answer it. Everything stays inside the curriculum community — be kind and show your working.</p>'+
 '<div class="pm-row"><select id="pmPortalSubject" style="max-width:240px"><option value="">All subjects</option>'+subjects.map(s=>'<option value="'+esc(s)+'"'+(s===portal.subject?' selected':'')+'>'+esc(s)+'</option>').join('')+'</select><button class="secondary-button" type="button" id="pmPortalRefresh">Refresh</button></div>'+
 '<details style="margin-top:12px"><summary style="cursor:pointer;font-weight:700">Ask the portal a question</summary>'+
 '<form id="pmPostForm" style="margin-top:12px"><label>Question title<input id="pmPostTitle" maxlength="120" placeholder="e.g. Why does aluminium resist corrosion?" required></label>'+
 '<div class="pm-grid"><label>Subject<select id="pmPostSubject">'+subjects.map(s=>'<option>'+esc(s)+'</option>').join('')+'</select></label>'+
 '<label>Your name<input id="pmPostAuthor" maxlength="40" value="'+esc(myName())+'"></label></div>'+
 '<label>What do you need help with?<textarea id="pmPostBody" maxlength="2000" placeholder="Explain the question and what you have tried…" required></textarea></label>'+
 '<div class="pm-row"><button class="primary-button" type="submit">Post question →</button><span id="pmPostStatus" class="pm-ok"></span></div></form></details>'+
 '<div id="pmPostList"></div></article>';
 const sSel=panel.querySelector('#pmPortalSubject');
 sSel.addEventListener('change',()=>{portal.subject=sSel.value;void renderPortal(panel)});
 panel.querySelector('#pmPortalRefresh').addEventListener('click',()=>void renderPortal(panel));
 const form=panel.querySelector('#pmPostForm'),status=panel.querySelector('#pmPostStatus');
 form.addEventListener('submit',async e=>{
  e.preventDefault();status.className='pm-ok';status.textContent='Posting…';
  const r2=await api('/api/portal',{method:'POST',body:JSON.stringify({kind:'post',title:form.querySelector('#pmPostTitle').value.trim(),subject:form.querySelector('#pmPostSubject').value,body:form.querySelector('#pmPostBody').value.trim(),author:form.querySelector('#pmPostAuthor').value.trim()})});
  if(!r2.ok){status.className='pm-error';status.textContent=errText(r2);return}
  window.showToast?.('Your question is on the portal ✓');
  portal.mode='thread';portal.postId=r2.data.post.id;void renderThread(panel);
 });
 fillPosts(panel,first);
}
function postRow(p){
 return '<button type="button" class="pm-subject-row" data-post="'+esc(p.id)+'" style="display:block;text-align:left"><b>'+esc(p.title)+'</b>'+
 '<small style="display:block;opacity:.72;margin-top:3px">'+esc(p.author||'VANES learner')+' · '+esc(p.subject||'General study')+' · '+esc(fmtDate(p.created_at))+' · '+Number(p.reply_count||0)+' repl'+(Number(p.reply_count)===1?'y':'ies')+'</small>'+
 (p.preview?'<small style="display:block;opacity:.6;margin-top:4px">'+esc(p.preview)+'</small>':'')+'</button>';
}
function fillPosts(panel,result){
 const box=panel.querySelector('#pmPostList');if(!box)return;
 const posts=result.data?.posts||[];
 box.innerHTML=posts.length?'<div class="pm-subject-list">'+posts.map(postRow).join('')+'</div>':'<p class="pm-empty">No questions here yet. Ask the first one — other learners will see it.</p>';
 box.querySelectorAll('[data-post]').forEach(b=>b.addEventListener('click',()=>{portal.mode='thread';portal.postId=b.dataset.post;void renderThread(panel)}));
}
async function renderThread(panel){
 const my=++paintToken;
 const r=await api('/api/portal?id='+encodeURIComponent(portal.postId));
 if(my!==paintToken||!panel.isConnected)return;
 if(!r.ok){panel.innerHTML=errorCard(r);bindErrorCard(panel);return}
 const post=r.data.post,replies=r.data.replies||[];
 panel.innerHTML='<article class="panel pm-card"><button type="button" class="secondary-button" id="pmBack">← Back to the portal</button>'+
 '<h2 style="margin-top:12px">'+esc(post.title)+'</h2>'+
 '<p class="support-copy">'+esc(post.author||'VANES learner')+' · '+esc(post.subject||'General study')+' · '+esc(fmtDate(post.created_at))+'</p>'+
 '<p style="white-space:pre-wrap">'+esc(post.body)+'</p>'+
 '<h3 style="margin-top:16px">Answers ('+replies.length+')</h3>'+
 (replies.length?replies.map(x=>'<div class="pm-reply'+(x.author===myName()?' own':'')+'"><b>'+esc(x.author||'VANES learner')+'</b> <small style="opacity:.7">'+esc(fmtDate(x.created_at))+'</small><p style="white-space:pre-wrap;margin:6px 0 0">'+esc(x.body)+'</p></div>').join(''):'<p class="pm-empty">No answers yet — be the first.</p>')+
 '<form id="pmReplyForm" style="margin-top:14px"><label>Your answer<textarea id="pmReplyBody" maxlength="2000" placeholder="Explain the answer step by step…" required></textarea></label>'+
 '<label>Your name<input id="pmReplyAuthor" maxlength="40" value="'+esc(myName())+'"></label>'+
 '<div class="pm-row"><button class="primary-button" type="submit">Send answer →</button><span id="pmReplyStatus" class="pm-ok"></span></div></form></article>';
 panel.querySelector('#pmBack').addEventListener('click',()=>{portal.mode='list';void renderPortal(panel)});
 const form=panel.querySelector('#pmReplyForm'),status=panel.querySelector('#pmReplyStatus');
 form.addEventListener('submit',async e=>{
  e.preventDefault();status.className='pm-ok';status.textContent='Sending…';
  const r2=await api('/api/portal',{method:'POST',body:JSON.stringify({kind:'reply',postId:post.id,body:form.querySelector('#pmReplyBody').value.trim(),author:form.querySelector('#pmReplyAuthor').value.trim()})});
  if(!r2.ok){status.className='pm-error';status.textContent=errText(r2);return}
  void renderThread(panel);
 });
}

/* Study tracker ----------------------------------------------------------- */
const tracker={days:14,subject:'ALL',metric:'minutes'};
async function renderTracker(panel){
 const my=++paintToken;
 panel.innerHTML='<article class="panel pm-card"><h2>Study tracker</h2><p class="pm-empty">Collecting your progress…</p></article>';
 await flushProgress();
 const r=await api('/api/track/progress?days='+tracker.days);
 if(my!==paintToken||!panel.isConnected)return;
 if(!r.ok){panel.innerHTML=errorCard(r);bindErrorCard(panel);return}
 paintTracker(panel,r.data);
}
function progressModel(server){
 const map=new Map();
 const ensure=(name,level)=>{let s=map.get(name);if(!s){s={subject:name,level:level||'',totals:{seconds:0,aiQuestions:0,questions:0,correct:0},byDay:{}};map.set(name,s)}if(level&&!s.level)s.level=level;return s};
 const add=(day,subject,level,vals)=>{
  const s=ensure(subject||'General study',level);
  const d=s.byDay[day]=s.byDay[day]||{seconds:0,aiQuestions:0,questions:0,correct:0};
  for(const k of ['seconds','aiQuestions','questions','correct']){const v=Math.max(0,Number(vals[k])||0);d[k]+=v;s.totals[k]+=v}
 };
 for(const s of server?.subjects||[]){ensure(s.subject,s.level);for(const d of s.days||[])add(d.day,s.subject,s.level,d)}
 const pend=read(PENDING,null)?.pending||{};
 for(const day of Object.keys(pend))for(const subject of Object.keys(pend[day]))add(day,subject,pend[day][subject].level,pend[day][subject]);
 const days=(server?.days&&server.days.length?server.days:dayWindow(tracker.days)).slice(-tracker.days);
 return {days,subjects:[...map.values()]};
}
function paintTracker(panel,server){
 const model=progressModel(server);
 const subs=model.subjects.sort((a,b)=>b.totals.seconds-a.totals.seconds);
 let picked=tracker.subject==='ALL'?null:subs.find(s=>s.subject===tracker.subject);
 if(tracker.subject!=='ALL'&&!picked)tracker.subject='ALL';
 const series=model.days.map(day=>{
  const v={seconds:0,aiQuestions:0,questions:0,correct:0};
  for(const s of (picked?[picked]:subs)){const x=s.byDay[day];if(!x)continue;for(const k of Object.keys(v))v[k]+=x[k]}
  return v;
 });
 const metric=tracker.metric;
 const value=v=>metric==='minutes'?Math.round(v.seconds/60):metric==='questions'?v.questions:v.aiQuestions;
 const unit=metric==='minutes'?' min':(metric==='questions'?' questions':' AI questions');
 const max=Math.max(1,...series.map(value));
 const tot={seconds:0,aiQuestions:0,questions:0,correct:0};
 for(const v of series)for(const k of Object.keys(tot))tot[k]+=v[k];
 const activeDays=series.filter(v=>v.seconds||v.aiQuestions||v.questions).length;
 const pending=pendingCount();
 const today=eatDay();
 const bars=model.days.map((d,i)=>{
  const v=value(series[i]);
  const h=v>0?Math.max(4,Math.round(v/max*100)):0;
  return '<div class="pm-col" title="'+esc(d+' · '+v+unit+(picked?' · '+picked.subject:''))+'"><div class="pm-track"><div class="pm-bar'+(d===today?' today':'')+'" style="height:'+h+'%"></div></div><span>'+d.slice(8)+'</span></div>';
 }).join('');
 const subjectRows='<button type="button" class="pm-subject-row'+(tracker.subject==='ALL'?' on':'')+'" data-subject="ALL"><span>All subjects</span><small>'+fmtDur(tot.seconds)+' · '+tot.questions+' questions</small></button>'+
 subs.map(s=>'<button type="button" class="pm-subject-row'+(tracker.subject===s.subject?' on':'')+'" data-subject="'+esc(s.subject)+'"><span>'+esc(s.subject)+(s.level?' <small style="opacity:.6">('+esc(s.level)+')</small>':'')+'</span><small>'+fmtDur(s.totals.seconds)+' · '+s.totals.questions+' questions · '+(s.totals.questions?Math.round(s.totals.correct/s.totals.questions*100)+'% correct':'—')+'</small></button>').join('');
 panel.innerHTML='<article class="panel pm-card"><h2>Study tracker</h2>'+
 '<p class="support-copy">Built from your question attempts and your AI conversations, counted per subject and per day. Days follow Tanzania time (EAT), and today is highlighted in the histogram.</p>'+
 '<div class="pm-row"><select id="pmDays" style="max-width:170px"><option value="7">Last 7 days</option><option value="14">Last 14 days</option><option value="30">Last 30 days</option></select>'+
 '<select id="pmMetric" style="max-width:230px"><option value="minutes">Minutes studied</option><option value="questions">Questions attempted</option><option value="ai">AI questions asked</option></select>'+
 '<button class="secondary-button" type="button" id="pmTrackerRefresh">Refresh</button></div>'+
 '<div class="pm-metrics"><div class="pm-metric"><b>'+fmtDur(tot.seconds)+'</b><small>Study time</small></div>'+
 '<div class="pm-metric"><b>'+tot.questions+'</b><small>Questions attempted</small></div>'+
 '<div class="pm-metric"><b>'+(tot.questions?Math.round(tot.correct/tot.questions*100)+'%':'—')+'</b><small>Correct answers ('+tot.correct+')</small></div>'+
 '<div class="pm-metric"><b>'+tot.aiQuestions+'</b><small>AI questions asked</small></div>'+
 '<div class="pm-metric"><b>'+activeDays+'</b><small>Active days</small></div></div>'+
 '<div class="pm-hist">'+bars+'</div>'+
 '<div class="pm-subject-list">'+subjectRows+'</div>'+
 (pending?'<p class="pm-empty">'+pending+' local entr'+(pending===1?'y':'ies')+' still waiting to sync to your account.</p>':'')+
 '<p class="support-copy">Tip: your parent can follow this same view from their phone with a parent code — see the Parent access tab.</p></article>';
 const daysSel=panel.querySelector('#pmDays'),metSel=panel.querySelector('#pmMetric');
 daysSel.value=String(tracker.days);metSel.value=tracker.metric;
 daysSel.addEventListener('change',()=>{tracker.days=Number(daysSel.value)||14;void renderTracker(panel)});
 metSel.addEventListener('change',()=>{tracker.metric=metSel.value;void renderTracker(panel)});
 panel.querySelector('#pmTrackerRefresh').addEventListener('click',()=>void renderTracker(panel));
 panel.querySelectorAll('[data-subject]').forEach(b=>b.addEventListener('click',()=>{tracker.subject=b.dataset.subject;void renderTracker(panel)}));
}

/* Parent access ----------------------------------------------------------- */
async function renderParents(panel){
 const my=++paintToken;
 panel.innerHTML='<article class="panel pm-card"><h2>Parent access</h2><p class="pm-empty">Preparing your parent code…</p></article>';
 const r=await api('/api/parent/code',{method:'POST',body:JSON.stringify({learnerName:myName(),learnerLevel:profile()?.level||''})});
 if(my!==paintToken||!panel.isConnected)return;
 if(!r.ok){panel.innerHTML=errorCard(r);bindErrorCard(panel);return}
 const code=r.data.code,url=r.data.url;
 const wa='https://wa.me/?text='+encodeURIComponent('Follow my VANES study progress: '+url);
 panel.innerHTML='<article class="panel pm-card"><h2>Parent access</h2>'+
 '<p class="support-copy">Give this code — or the link — to your parent. They open it in any phone browser, no VANES account needed, and they see your real progress: minutes studied, questions attempted and correct answers, per subject, with the daily histogram. The view updates automatically as you study while signed in to your cloud account.</p>'+
 '<div class="pm-metric" style="margin:12px 0"><small>Your parent code</small><div class="pm-code">'+esc(code)+'</div></div>'+
 '<div class="pm-item" style="align-items:center"><div><b>Parent link</b><small>'+esc(url)+'</small></div><div class="pm-row"><button class="secondary-button" type="button" id="pmParentCopy">Copy link</button><button class="secondary-button" type="button" id="pmParentOpen">Open</button><button class="secondary-button" type="button" id="pmParentWa">Share on WhatsApp</button></div></div>'+
 '<p class="support-copy" style="margin-top:12px">Keep the code private — anyone with the link can see this study view. If it ever leaks, contact OB Tech-Labs to have it replaced. Only the subjects you study are shown, never your private conversations.</p></article>';
 panel.querySelector('#pmParentCopy').addEventListener('click',e=>copy(url,e.target));
 panel.querySelector('#pmParentOpen').addEventListener('click',()=>window.open(url,'_blank','noopener'));
 panel.querySelector('#pmParentWa').addEventListener('click',()=>window.open(wa,'_blank','noopener'));
}

/* Profile picture ---------------------------------------------------------- */
function renderProfile(panel){
 const stored=localStorage.getItem(AVATAR)||DEFAULT_AVATAR;
 panel.innerHTML='<article class="panel pm-card"><h2>Profile picture</h2>'+
 '<p class="support-copy">Upload a photo from this device or choose one of the VANES avatars. Your picture shows on your profile in the app.</p>'+
 '<div class="pm-row"><span class="pm-avatar-preview" id="pmAvatarPreview" aria-label="Current profile picture"></span>'+
 '<div><div class="pm-row"><button class="primary-button" type="button" id="pmUpload">Upload my photo →</button><button class="secondary-button" type="button" id="pmAvatarDefault">Use VANES default</button></div>'+
 '<p class="pm-empty" id="pmAvatarStatus"></p></div></div>'+
 '<p class="support-copy" style="margin-top:12px"><b>VANES avatars</b> — tap one to use it.</p>'+
 '<div class="pm-avatar-grid" id="pmAvatarGrid">'+AVATARS.map(([name,uri],i)=>'<button type="button" class="pm-avatar" title="'+esc(name)+'" aria-label="'+esc(name)+' avatar" data-avatar="'+i+'"><img src="'+uri+'" alt="'+esc(name)+' avatar"></button>').join('')+'</div>'+
 '<input id="pmAvatarFile" type="file" accept="image/*" hidden></article>';
 paintAvatar(stored);
 const status=panel.querySelector('#pmAvatarStatus');
 const file=panel.querySelector('#pmAvatarFile');
 const refresh=()=>{const now=localStorage.getItem(AVATAR)||DEFAULT_AVATAR;panel.querySelectorAll('.pm-avatar').forEach(b=>b.classList.toggle('on',AVATARS[Number(b.dataset.avatar)]?.[1]===now))};
 refresh();
 panel.querySelectorAll('.pm-avatar').forEach(b=>b.addEventListener('click',()=>{
  const uri=AVATARS[Number(b.dataset.avatar)]?.[1];if(!uri)return;
  const ok=saveAvatar(uri);
  status.className=ok?'pm-ok':'pm-error';
  status.textContent=ok?'Avatar saved ✓':'Could not save on this device.';
  refresh();
 }));
 panel.querySelector('#pmAvatarDefault').addEventListener('click',()=>{
  try{localStorage.removeItem(AVATAR)}catch(_){}
  paintAvatar(DEFAULT_AVATAR);refresh();
  status.className='pm-ok';status.textContent='VANES default picture restored.';
 });
 panel.querySelector('#pmUpload').addEventListener('click',()=>file.click());
 file.addEventListener('change',()=>{
  const f=file.files?.[0];if(!f)return;
  if(!/^image\//.test(f.type)){status.className='pm-error';status.textContent='Choose an image file.';return}
  status.className='pm-ok';status.textContent='Preparing your photo…';
  shrinkPhoto(f,data=>{
   if(!data){status.className='pm-error';status.textContent='Could not read that image — try another one.';return}
   const ok=saveAvatar(data);
   paintAvatar(data);refresh();
   status.className=ok?'pm-ok':'pm-error';
   status.textContent=ok?'Profile picture saved ✓':'This device refused to store the picture — try a smaller image.';
   file.value='';
  });
 });
}

/* Wiring ------------------------------------------------------------------- */
function init(){
 css();
 hookFetch();
 const stored=localStorage.getItem(AVATAR);
 if(stored)paintAvatar(stored);
 document.addEventListener('click',e=>{
  const t=e.target.closest&&e.target.closest('[data-view="premium"],[data-view-target="premium"]');
  if(t)setTimeout(render,80);
 });
 window.addEventListener('hashchange',()=>{if(location.hash==='#premium')setTimeout(render,80)});
 window.addEventListener('vanes-premium-unlocked',()=>{render();scheduleFlush(1200)});
 window.addEventListener('vanes-firebase-ready',()=>{if(document.getElementById('premium')?.classList.contains('active'))render()});
 window.addEventListener('online',()=>scheduleFlush(1500));
 if(location.hash==='#premium')render();
 window.VANES_PREMIUM={refresh:render,flush:flushProgress,avatars:AVATARS.map(a=>a[0])};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
