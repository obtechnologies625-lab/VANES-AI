/* VANES AI — brand splash, account gate and free-trial meter.
   Sign-in is Firebase Auth when the Firebase project is reachable (see vanes-firebase.js);
   with no Firebase the gate falls back to accounts stored on this device so the PWA still
   opens offline. The free-trial counter here is the on-device copy — the Worker keeps the
   authoritative one. */
(function(){
'use strict';
const ACCOUNTS='vanes-accounts-v1',SESSION='vanes-session-v1',USAGE='vanes-usage-v1',PREMIUM='vanes-premium-v1';
const FREE_LIMIT=15,TRIAL_HOURS=24;
const read=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k));return v??f}catch(_){return f}};
const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function digest(pw,salt){const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(salt+'::'+pw));return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('')}
const fb=()=>window.VANES_FB;
let deviceMode=false;
const fbReady=()=>!deviceMode&&!!(fb()&&fb().ok);
const session=()=>read(SESSION,null);
/* Premium is a one-month pass: the local mirror carries the same end date the Worker keeps
   in premium_until, so once the month is over the account is back to the normal free one. */
const premium=()=>{const p=read(PREMIUM,null);if(!p)return null;const until=Number(p.until)||0;return until&&until<=Date.now()?null:p};
const premiumDaysLeft=()=>{const p=read(PREMIUM,null);const until=Number(p?.until)||0;return until?Math.max(0,Math.ceil((until-Date.now())/86400000)):null};
/* The free trial resets every 24 hours; expiry restarts the window from now. */
function usage(){const u=read(USAGE,null);const now=Date.now();if(!u||now-Number(u.since||0)>TRIAL_HOURS*3600000)return {used:0,since:now};return u}
/* The Worker's limit wins once it has been read, so VANES_FREE_LIMIT can be changed on the
   server without shipping a new client. */
let serverLimit=0,serverRenewsHours=0;
const limitNow=()=>serverLimit||FREE_LIMIT;
function left(){return premium()?Infinity:Math.max(0,limitNow()-usage().used)}

function style(){if(document.querySelector('#vanes-access-style'))return;const s=document.createElement('style');s.id='vanes-access-style';s.textContent=
'html.vanes-locked .app-shell,html.vanes-locked .name-modal{visibility:hidden}'+
'#vanesSplash{position:fixed;inset:0;z-index:100001;display:grid;place-items:center;background:radial-gradient(circle at 50% 40%,#0a1730,#02040c 70%);transition:opacity .6s ease}'+
'#vanesSplash.gone{opacity:0;pointer-events:none}'+
'.vanes-splash-wheel{width:132px;height:132px;opacity:0;transform:scale(.82);transition:opacity .5s ease,transform .5s ease}'+
'.vanes-splash-made{position:absolute;display:grid;justify-items:center;gap:10px;opacity:0;transform:translateY(10px);transition:opacity .5s ease,transform .5s ease}'+
'.vanes-splash-made span{color:#7ea6c4;font:700 11px/1 "Space Grotesk",sans-serif;letter-spacing:4px}'+
'.vanes-splash-made img{width:270px;max-width:74vw}'+
'#vanesSplash.stage-wheel .vanes-splash-wheel{opacity:1;transform:scale(1)}'+
'#vanesSplash.stage-made .vanes-splash-wheel{opacity:0;transform:scale(.9)}'+
'#vanesSplash.stage-made .vanes-splash-made{opacity:1;transform:none}'+
'#vanesGate{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;padding:18px;background:radial-gradient(circle at 20% 10%,#0b1c38,#02040c 72%);overflow:auto}'+
'.vanes-gate-card{width:min(430px,100%);display:grid;gap:14px;padding:26px;border:1px solid #17547c;border-radius:18px;background:linear-gradient(150deg,#08182c,#0a1322);box-shadow:0 24px 70px rgba(0,0,0,.5)}'+
'.vanes-gate-brand{display:grid;justify-items:center;gap:8px}.vanes-gate-brand img{width:230px;max-width:70vw}'+
'.vanes-gate-tabs{display:flex;gap:8px}.vanes-gate-tabs button{flex:1;padding:9px;border:1px solid #24506e;border-radius:10px;background:#0b1d30;color:#9fdff0;font:700 12px inherit;cursor:pointer}'+
'.vanes-gate-tabs button.on{border-color:#00cfff;color:#eafcff;background:#0d2a44}'+
'.vanes-gate-card label{display:grid;gap:6px;color:#bfe0f2;font:700 11px inherit;letter-spacing:.4px}'+
'.vanes-gate-card input{padding:11px;border:1px solid #285776;border-radius:10px;background:#f7fbff;color:#111827;font:inherit}'+
'.vanes-gate-error{min-height:16px;color:#ff9eb5;font-size:11.5px}'+
'.vanes-gate-google{display:grid;gap:8px;justify-items:center;padding-top:4px;border-top:1px solid #17405e}'+
'.vanes-gate-google small{color:#7ea6c4;font-size:10.5px;text-align:center}'+
'.vanes-google-btn{display:flex;align-items:center;gap:9px;width:100%;padding:10px;border:1px solid #2b5f80;border-radius:10px;background:#f7fbff;color:#14202c;font:700 12.5px inherit;cursor:pointer}'+
'.vanes-google-btn svg{width:17px;height:17px;flex:0 0 auto}'+
'.vanes-gate-note{color:#6d8ba3;font-size:10.5px;line-height:1.5;text-align:center}'+
'.vanes-gate-busy{opacity:.6;pointer-events:none}'+
'#vanesUpgrade{position:fixed;inset:0;z-index:100002;display:grid;place-items:center;padding:18px;background:rgba(2,4,12,.82)}'+
'.vanes-upgrade-card{width:min(420px,100%);display:grid;gap:12px;padding:24px;border:1px solid #7c4dff;border-radius:18px;background:linear-gradient(150deg,#160b33,#0a1322)}'+
'.vanes-upgrade-card h2{margin:0;color:#f4fbff;font-size:21px}.vanes-upgrade-card p{margin:0;color:#b9cfe1;font-size:13px;line-height:1.6}'+
'.vanes-upgrade-row{display:flex;gap:9px;flex-wrap:wrap}.vanes-upgrade-row input{flex:1;min-width:160px;padding:10px;border:1px solid #285776;border-radius:10px;background:#f7fbff;color:#111827;font:inherit}'+
'.vanes-account-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}';
document.head.appendChild(s)}

function splash(done){
 const el=document.createElement('div');el.id='vanesSplash';
 el.innerHTML='<img class="vanes-splash-wheel" src="assets/vanes-turbine-wheel.svg" alt="VANES AI"><div class="vanes-splash-made"><span>MADE WITH</span><img src="assets/ob-technologies-lab.svg" alt="OB Tech-Labs"><span>OB TECH ORG</span></div>';
 document.body.appendChild(el);
 requestAnimationFrame(()=>el.classList.add('stage-wheel'));
 setTimeout(()=>el.classList.add('stage-made'),950);
 setTimeout(()=>{el.classList.add('gone');setTimeout(()=>{el.remove();done()},650)},2350);
}

const GOOGLE_G='<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.8 13.4-4.9l-6.2-5.2C29.1 35.4 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.2 5.2C36.9 40.2 44 35 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>';

function gate(){
 const el=document.createElement('div');el.id='vanesGate';
 const cloud=fbReady();
 el.innerHTML='<form class="vanes-gate-card" novalidate><div class="vanes-gate-brand"><img src="assets/vanes-logo-lockup.svg" alt="VANES AI"><img src="assets/ob-technologies-lab.svg" alt="OB Tech-Labs"></div>'+
 '<div class="vanes-gate-tabs"><button type="button" data-mode="in" class="on">Sign in</button><button type="button" data-mode="up">Create account</button></div>'+
 '<label data-f="name" hidden>Full name<input name="name" maxlength="60" placeholder="Your full name" autocomplete="name"></label>'+
 '<label>Phone number<input name="phone" type="tel" maxlength="25" placeholder="+255 7xx xxx xxx" autocomplete="tel" required></label>'+
 '<label>Email<input name="email" type="email" maxlength="120" placeholder="you@example.com" autocomplete="email" required></label>'+
 '<label>Password<input name="password" type="password" maxlength="120" placeholder="At least 6 characters" autocomplete="current-password" required></label>'+
 '<p class="vanes-gate-error" role="alert"></p>'+
 '<button class="primary-button" type="submit">Enter VANES AI →</button>'+
 '<div class="vanes-gate-google">'+(cloud?'<button type="button" class="vanes-google-btn" id="vanesGoogle">'+GOOGLE_G+'<span>Continue with Google</span></button>':'')+'<small>'+(cloud?'Google sign-in uses your Google account — VANES never sees the password.':'Cloud sign-in is unavailable right now, so this device keeps its own account. Google sign-in returns when the connection does.')+'</small></div>'+
 '<p class="vanes-gate-note">'+(cloud?'Your learner profile, conversations and study shelf follow your account to any device. Anything already saved on this device is uploaded when you sign in.':'Accounts are stored on this device only, so your study space stays private to you.')+'</p></form>';
 document.body.appendChild(el);
 document.documentElement.classList.add('vanes-locked');
 let mode='in';
 const card=el.querySelector('.vanes-gate-card'),err=el.querySelector('.vanes-gate-error');
 const busy=on=>card.classList.toggle('vanes-gate-busy',!!on);
 el.querySelectorAll('.vanes-gate-tabs button').forEach(b=>b.addEventListener('click',()=>{
  mode=b.dataset.mode;
  el.querySelectorAll('.vanes-gate-tabs button').forEach(x=>x.classList.toggle('on',x===b));
  card.querySelector('[data-f="name"]').hidden=mode!=='up';
  card.querySelector('[name="password"]').autocomplete=mode==='up'?'new-password':'current-password';
  err.textContent='';
 }));
 const googleBtn=el.querySelector('#vanesGoogle');
 if(googleBtn)googleBtn.addEventListener('click',async()=>{
  busy(true);err.textContent='';
  try{
   const acct=await fb().signInGoogle();
   if(acct){setSession(acct);unlock()}
  }catch(e){err.textContent=fb().friendly(e)}finally{busy(false)}
 });
 card.addEventListener('submit',async e=>{
  e.preventDefault();err.textContent='';
  const f=new FormData(card);
  const phone=String(f.get('phone')||'').trim(),email=String(f.get('email')||'').trim().toLowerCase(),pw=String(f.get('password')||''),name=String(f.get('name')||'').trim();
  if(!/^\+?[0-9][0-9 ()-]{7,24}$/.test(phone)){err.textContent='Enter a real phone number, e.g. +255 712 345 678.';return}
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){err.textContent='Enter a valid email address.';return}
  if(pw.length<6){err.textContent='Password must be at least 6 characters.';return}
  if(fbReady()){
   busy(true);
   try{
    const acct=mode==='up'?await fb().signUp(email,pw,name,phone):await fb().signIn(email,pw,phone);
    setSession({...acct,phone:phone||acct.phone});
    unlock();
   }catch(e){
    err.textContent=fb().friendly(e);
    const code=String(e?.code||'');
    if(/^(auth\/operation-not-allowed|auth\/configuration-not-found|auth\/admin-restricted-operation|auth\/invalid-api-key|auth\/api-key-not-valid|auth\/invalid-project-id)$/.test(code))deviceEscape(err);
    else if(session()&&/offline|unavailable|reach Firebase/i.test(err.textContent))offlineEscape(err);
   }finally{busy(false)}
   return;
  }
  localSignIn(mode,{email:email,phone:phone,name:name,password:pw},err);
 });
}

/* Firebase unreachable but this device already has a signed-in learner: let them keep studying. */
function offlineEscape(err){
 const card=document.querySelector('#vanesGate .vanes-gate-card');
 if(!card||card.querySelector('#vanesOffline'))return;
 const b=document.createElement('button');b.type='button';b.id='vanesOffline';b.className='secondary-button';
 b.textContent='Continue offline with this device';
 b.addEventListener('click',()=>unlock());
 card.insertBefore(b,card.querySelector('.vanes-gate-google'));
 err.textContent+=' You can keep studying offline instead.';
}

/* Firebase is reachable but sign-in is not switched on in the project yet, or the web config
   is wrong. Fall back to a device-only account so nobody is locked out of the app. */
function deviceEscape(err){
 const card=document.querySelector('#vanesGate .vanes-gate-card');
 if(!card||card.querySelector('#vanesDeviceMode'))return;
 const b=document.createElement('button');b.type='button';b.id='vanesDeviceMode';b.className='secondary-button';
 b.textContent='Continue with a device-only account';
 b.addEventListener('click',()=>{
  deviceMode=true;
  const g=document.querySelector('#vanesGate');if(g)g.remove();
  gate();
  window.showToast?.('Device mode — this account stays on this device until cloud sign-in is switched on.');
 });
 card.insertBefore(b,card.querySelector('.vanes-gate-google'));
 err.textContent+=' Until that is switched on you can still use VANES on this device.';
}

async function localSignIn(mode,vals,err){
 const accounts=read(ACCOUNTS,[]);const existing=accounts.find(a=>a.email===vals.email);
 if(mode==='up'){
  if(existing){err.textContent='That email already has an account here — sign in instead.';return}
  const salt=crypto.randomUUID?crypto.randomUUID():String(Date.now());
  accounts.push({email:vals.email,phone:vals.phone,name:vals.name,salt:salt,hash:await digest(vals.password,salt),createdAt:Date.now()});
  write(ACCOUNTS,accounts);
  setSession({email:vals.email,phone:vals.phone,name:vals.name,provider:'password (this device)'});
 }else{
  if(!existing){err.textContent='No account with that email on this device yet — create one first.';return}
  if(existing.hash!==await digest(vals.password,existing.salt)){err.textContent='Wrong password for this account.';return}
  existing.phone=vals.phone;write(ACCOUNTS,accounts);
  setSession({email:vals.email,phone:vals.phone,name:existing.name||vals.name,provider:'password (this device)'});
 }
 unlock();
}

function setSession(acct){write(SESSION,{uid:acct.uid||'',email:acct.email||'',phone:acct.phone||'',name:acct.name||'',provider:acct.provider||'password',at:Date.now()})}

/* The first onAuthStateChanged callback can be slow on a cold cache, so give up and show the
   gate rather than leaving the learner staring at a locked app. */
function firstAuthState(ms){
 return new Promise(res=>{
  let done=false;const finish=v=>{if(done)return;done=true;res(v)};
  const off=fb().watch(a=>{finish(a);if(off)try{off()}catch(_){}});
  setTimeout(()=>finish(null),ms);
 });
}

function unlock(){
 document.documentElement.classList.remove('vanes-locked');
 const g=document.querySelector('#vanesGate');if(g)g.remove();
 const s=session();
 window.showToast?.('Karibu, '+(s?.name||s?.email||'learner')+' — VANES is ready ✓');
 const nameInput=document.querySelector('#nameInput');
 if(nameInput&&!nameInput.value&&s?.name)nameInput.value=s.name;
 window.VANES_SYNC?.start(s);
 renderAccountCard();
 syncQuota();
}

/* The Worker's vanes_quota table is the authoritative trial counter — clearing this
   browser's storage cannot reset it — so read it back and keep the local copy honest. */
const apiBase=()=>String(window.VANES_CHAT_ENDPOINT||location.origin+'/api/chat').replace(/\/api\/chat$/,'');
async function quotaRequest(method,code){
 if(!fbReady()||!fb().user())return null;
 let token='';try{token=await fb().idToken()}catch(_){}
 if(!token)return null;
 const headers={Authorization:'Bearer '+token};
 if(code)headers['X-VANES-Upgrade-Code']=code;
 else{const p=premium();if(p?.code)headers['X-VANES-Upgrade-Code']=String(p.code)}
 try{
  const r=await nativeFetch(apiBase()+'/api/quota',{method,headers});
  if(!r.ok)return null;
  const data=await r.json();
  return data?.quota||null;
 }catch(_){return null}
}
async function syncQuota(){
 const q=await quotaRequest('GET');
 if(!q)return;
 serverLimit=Number(q.limit)||FREE_LIMIT;
 serverRenewsHours=Number(q.renewsInHours)||0;
 const until=Number(q.premiumUntil)||0,p=premium();
 if(q.premium){
  /* Keep the local mirror in step with the Worker: same pass, same end date. */
  if(!p||until!==(Number(read(PREMIUM,null)?.until)||0))write(PREMIUM,{code:p?.code||read(PREMIUM,null)?.code||'',at:p?.at||Date.now(),until});
  if(!p)return void repaintAccountCard();
 }else if(p){
  /* The month ran out on the Worker — the account returns to the normal free account. */
  try{localStorage.removeItem(PREMIUM)}catch(_){}
  window.dispatchEvent(new Event('vanes-premium-expired'));
  return void repaintAccountCard();
 }
 const u=usage();
 u.used=Math.max(Number(u.used||0),Number(q.used)||0);
 u.since=Number(u.since||Date.now());
 write(USAGE,u);
 repaintAccountCard();
}

/* Applies an OB Tech-Labs upgrade code. A cloud account has its code checked on the Worker
   (OB Tech-Labs counter or VANES_PREMIUM_CODES), so editing localStorage cannot unlock
   Premium. Device-only accounts have no server identity, so their code is a local unlock. */
async function applyUpgradeCode(raw){
 const code=String(raw||'').trim().toUpperCase();
 if(!/^VANES-PRO-[A-Z0-9]{4,10}$/.test(code))return {ok:false,error:'Codes look like VANES-PRO-7K2M9'};
 let until=0;
 if(fbReady()&&fb().user()){
  const q=await quotaRequest('POST',code);
  if(!q)return {ok:false,error:'Cannot reach VANES to check that code — try again.'};
  if(!q.premium)return {ok:false,error:'That code is not recognised by VANES.'};
  serverLimit=Number(q.limit)||FREE_LIMIT;
  until=Number(q.premiumUntil)||0;
 }
 /* The pass runs for one month: keep the same end date the Worker stores, so the app and the
    server agree on when the account returns to the normal free account. */
 if(!until)until=Date.now()+30*86400000;
 write(PREMIUM,{code:code,at:Date.now(),until});
 window.VANES_SYNC?.pushNow();
 window.showToast?.('VANES Premium unlocked — thank you for supporting the app ✓ This pass ends '+new Date(until).toLocaleDateString()+'.');
 renderAccountCard();
 window.dispatchEvent(new Event('vanes-premium-unlocked'));
 return {ok:true};
}

function upgradeOverlay(){
 if(document.querySelector('#vanesUpgrade'))return;
 const el=document.createElement('div');el.id='vanesUpgrade';
 el.innerHTML='<div class="vanes-upgrade-card"><h2>Your free answers are used up</h2><p>VANES gives every learner '+limitNow()+' free AI answers every 24 hours — they come back at no cost. To keep asking right now, support the app with a one-time '+((window.VANES_DONATE&&window.VANES_DONATE.amount)||3500)+' TZS Airtel Money donation; every contribution keeps VANES free for the next student.</p>'+
 '<div class="vanes-upgrade-row"><button class="primary-button" type="button" id="vanesUpgradeDonate">Support VANES ♥</button><button class="secondary-button" type="button" id="vanesUpgradeLater">Not now</button></div>'+
 '<div class="vanes-upgrade-row"><input id="vanesUpgradeCode" placeholder="Upgrade code from OB Tech-Labs" maxlength="40"><button class="secondary-button" type="button" id="vanesUpgradeApply">Unlock</button></div>'+
 '<p class="vanes-upgrade-note" style="color:#8fa7c7;font-size:11px">Donate with Airtel Money and your VANES-PRO upgrade code appears on screen the moment the payment is confirmed.</p></div>';
 document.body.appendChild(el);
 el.querySelector('#vanesUpgradeDonate').addEventListener('click',()=>{
  el.remove();
  if(window.VANES_DONATE?.open)return void window.VANES_DONATE.open();
  const t=document.createElement('button');t.setAttribute('data-donate-vanes','');t.hidden=true;document.body.appendChild(t);t.click();t.remove();
 });
 el.querySelector('#vanesUpgradeLater').addEventListener('click',()=>el.remove());
 el.querySelector('#vanesUpgradeApply').addEventListener('click',async()=>{
  const input=el.querySelector('#vanesUpgradeCode');
  input.disabled=true;
  const r=await applyUpgradeCode(input.value);
  input.disabled=false;
  if(!r.ok){input.value='';input.placeholder=r.error||'That code did not work.';return}
  el.remove();
 });
}

/* Meter every AI call: chat turns, question sets and marking all pass through /api/chat.
   Signed-in learners also send their Firebase ID token so the Worker can keep the
   tamper-proof count. */
const nativeFetch=window.fetch.bind(window);
window.fetch=async function(input,init){
 const url=typeof input==='string'?input:(input?.url||'');
 if(!/\/api\/chat(?:\?|$)/.test(url)||!init?.body)return nativeFetch(input,init);
 if(left()<=0){upgradeOverlay();return new Response(JSON.stringify({error:'Your free trial of '+limitNow()+' AI answers is finished. Support VANES to continue.'}),{status:402,headers:{'Content-Type':'application/json'}})}
 let token='';
 if(fbReady()&&fb().user()){try{token=await fb().idToken()}catch(_){}}
 const headers=new Headers(init.headers||{});
 if(token)headers.set('Authorization','Bearer '+token);
 const p=premium();
 if(p?.code)headers.set('X-VANES-Upgrade-Code',String(p.code));
 return nativeFetch(input,{...init,headers:headers}).then(r=>{
  if(r.status===402){upgradeOverlay();return r}
  if(r.ok){
   const u=usage();u.used=Number(u.used||0)+1;u.since=Number(u.since||Date.now());
   /* The Worker keeps the authoritative count; take whichever of the two is stricter so a
      cleared localStorage cannot hand out answers the account has already used. */
   const leftHeader=Number(r.headers.get('X-VANES-Answers-Left'));
   if(Number.isFinite(leftHeader)&&!premium())u.used=Math.max(u.used,limitNow()-leftHeader);
   write(USAGE,u);repaintAccountCard();
  }
  return r;
 });
};

let accountCardPainter=null;
function repaintAccountCard(){if(accountCardPainter)accountCardPainter()}
/* Sync resolves after the card is first painted, so the card follows its state changes. */
window.addEventListener('vanes-sync-state',()=>repaintAccountCard());

function renderAccountCard(){
 const host=document.querySelector('#settings .settings-ios-group');
 if(!host)return;
 if(document.querySelector('#vanesAccountCard'))return void repaintAccountCard();
 const card=document.createElement('article');card.className='settings-card ios-card';card.id='vanesAccountCard';
 host.prepend(card);
 paint();
 function paint(){
  accountCardPainter=paint;
  const s=session(),u=usage(),p=premium(),daysLeft=premiumDaysLeft(),sync=window.VANES_SYNC?.status?.()||{enabled:false,failed:'',connecting:false};
  const how=s?.provider==='google'?'Google':(fbReady()?'email + password':'this device only');
  const pass=p?(daysLeft===null?'':' · '+(daysLeft>0?daysLeft+' day'+(daysLeft===1?'':'s')+' left':'less than a day left')+', then back to the normal free account'):'';
  card.innerHTML='<div class="ios-row"><div class="ios-icon blue">👤</div><div class="ios-copy"><h2>Your VANES account</h2><p>'+
   (s?esc(s.name||s.email)+' · '+esc(s.phone||'no phone')+' · signed in with '+esc(how):'Not signed in')+'</p>'+
   '<p>'+(p?'VANES Premium'+(p.code?' · code '+esc(p.code):'')+pass+' · thank you for supporting VANES ♥':'Free trial: '+Math.max(0,limitNow()-u.used)+' of '+limitNow()+' free AI answers · '+(serverRenewsHours>0?'renew in ~'+serverRenewsHours+'h':'renew every 24 hours'))+'</p>'+
   '<p>'+(sync.connecting?'Cloud sync: connecting to your account…':sync.enabled?'Cloud sync: on — your data follows this account':(s?.uid?'Cloud sync: off — '+esc(sync.failed||'not started'):'Cloud sync: off — device account only'))+'</p></div></div>'+
   '<div class="vanes-account-row"><button type="button" class="secondary-button" id="vanesSyncNow" '+(sync.enabled&&!sync.connecting?'':'hidden')+'>Sync now</button>'+
   '<button type="button" class="secondary-button" id="vanesSignOut">Sign out</button>'+
   (p?'':'<button type="button" class="secondary-button" id="vanesGoUpgrade">Get Premium</button>')+'</div>';
  card.querySelector('#vanesSignOut').addEventListener('click',async()=>{
   window.VANES_SYNC?.stop();
   localStorage.removeItem(SESSION);
   if(fbReady()&&fb().user()){try{await fb().signOut()}catch(_){}}
   location.reload();
  });
  card.querySelector('#vanesSyncNow')?.addEventListener('click',async e=>{
   e.target.textContent='Syncing…';
   const ok=await window.VANES_SYNC?.pushNow();
   e.target.textContent=ok?'Saved to your account ✓':'Sync now';
   setTimeout(()=>{e.target.textContent='Sync now'},2200);
  });
  card.querySelector('#vanesGoUpgrade')?.addEventListener('click',upgradeOverlay);
 }
}

async function boot(){
 style();
 if(!session())document.documentElement.classList.add('vanes-locked');
 const start=async()=>{
  if(fbReady()){
   const redirect=await fb().finishRedirect();
   if(redirect&&!redirect.error&&redirect.uid){setSession(redirect);unlock();return}
   const acct=await firstAuthState(2500);
   if(acct){const keep=session();setSession({...acct,phone:acct.phone||keep?.phone||''});unlock();return}
   if(redirect?.error)window.showToast?.(redirect.error);
   gate();return;
  }
  if(!session())gate();else unlock();
 };
 splash(start);
 window.VANES_ACCOUNT={session:session,left:left,premium:premium,upgrade:upgradeOverlay,applyCode:applyUpgradeCode,firebase:()=>({ready:fbReady(),detail:fbReady()?{projectId:fb().projectId,sdk:fb().sdk,uid:fb().user()?.uid||''}:{error:fb()?.initError||'Firebase module did not load'}}),signOut:async()=>{window.VANES_SYNC?.stop();localStorage.removeItem(SESSION);if(fbReady())await fb().signOut();location.reload()}};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
