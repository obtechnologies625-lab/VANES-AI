/* VANES AI — brand splash, account gate and free-trial meter.
   Accounts live in this device's localStorage: there is no user database yet, so this gate
   personalises and meters the app, it is not server-side security. */
(function(){
'use strict';
const ACCOUNTS='vanes-accounts-v1',SESSION='vanes-session-v1',USAGE='vanes-usage-v1',PREMIUM='vanes-premium-v1',GCLIENT='vanes-google-client-id-v1';
const FREE_LIMIT=15,TRIAL_DAYS=30;
const read=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k));return v??f}catch(_){return f}};
const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function digest(pw,salt){const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(salt+'::'+pw));return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('')}
const session=()=>read(SESSION,null);
const premium=()=>read(PREMIUM,null);
function usage(){const u=read(USAGE,null);const now=Date.now();if(!u||now-Number(u.since||0)>TRIAL_DAYS*86400000)return {used:0,since:now};return u}
function left(){return premium()?Infinity:Math.max(0,FREE_LIMIT-usage().used)}

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
'.vanes-gate-note{color:#6d8ba3;font-size:10.5px;line-height:1.5;text-align:center}'+
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

function gate(){
 const el=document.createElement('div');el.id='vanesGate';
 el.innerHTML='<form class="vanes-gate-card" novalidate><div class="vanes-gate-brand"><img src="assets/vanes-logo-lockup.svg" alt="VANES AI"><img src="assets/ob-technologies-lab.svg" alt="OB Tech-Labs"></div>'+
 '<div class="vanes-gate-tabs"><button type="button" data-mode="in" class="on">Sign in</button><button type="button" data-mode="up">Create account</button></div>'+
 '<label data-f="name" hidden>Full name<input name="name" maxlength="60" placeholder="Your full name" autocomplete="name"></label>'+
 '<label>Phone number<input name="phone" type="tel" maxlength="25" placeholder="+255 7xx xxx xxx" autocomplete="tel" required></label>'+
 '<label>Email<input name="email" type="email" maxlength="120" placeholder="you@example.com" autocomplete="email" required></label>'+
 '<label>Password<input name="password" type="password" maxlength="120" placeholder="At least 6 characters" autocomplete="current-password" required></label>'+
 '<p class="vanes-gate-error" role="alert"></p>'+
 '<button class="primary-button" type="submit">Enter VANES AI →</button>'+
 '<div class="vanes-gate-google"><div id="vanesGoogleBtn"></div><button type="button" class="secondary-button" id="vanesGoogleCfg">Set up Google sign-in</button><small>Google sign-in needs a free Google Client ID from OB Tech-Labs; paste it once and it is stored on this device.</small></div>'+
 '<p class="vanes-gate-note">Accounts are stored on this device only, so your study space stays private to you.</p></form>';
 document.body.appendChild(el);
 document.documentElement.classList.add('vanes-locked');
 let mode='in';
 const card=el.querySelector('.vanes-gate-card'),err=el.querySelector('.vanes-gate-error');
 el.querySelectorAll('.vanes-gate-tabs button').forEach(b=>b.addEventListener('click',()=>{
  mode=b.dataset.mode;
  el.querySelectorAll('.vanes-gate-tabs button').forEach(x=>x.classList.toggle('on',x===b));
  card.querySelector('[data-f="name"]').hidden=mode!=='up';
  card.querySelector('[name="password"]').autocomplete=mode==='up'?'new-password':'current-password';
  err.textContent='';
 }));
 el.querySelector('#vanesGoogleCfg').addEventListener('click',()=>{
  const id=(prompt('Paste the Google OAuth Client ID for VANES AI (ends in .apps.googleusercontent.com):')||'').trim();
  if(!id)return;
  localStorage.setItem(GCLIENT,id);
  err.textContent='';loadGoogle(err);
 });
 loadGoogle(err);
 card.addEventListener('submit',async e=>{
  e.preventDefault();err.textContent='';
  const f=new FormData(card);
  const phone=String(f.get('phone')||'').trim(),email=String(f.get('email')||'').trim().toLowerCase(),pw=String(f.get('password')||''),name=String(f.get('name')||'').trim();
  if(!/^\+?[0-9][0-9 ()-]{7,24}$/.test(phone)){err.textContent='Enter a real phone number, e.g. +255 712 345 678.';return}
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){err.textContent='Enter a valid email address.';return}
  if(pw.length<6){err.textContent='Password must be at least 6 characters.';return}
  const accounts=read(ACCOUNTS,[]);const existing=accounts.find(a=>a.email===email);
  if(mode==='up'){
   if(existing){err.textContent='That email already has an account here — sign in instead.';return}
   const salt=crypto.randomUUID?crypto.randomUUID():String(Date.now());
   accounts.push({email:email,phone:phone,name:name,salt:salt,hash:await digest(pw,salt),createdAt:Date.now()});
   write(ACCOUNTS,accounts);
   write(SESSION,{email:email,phone:phone,name:name,provider:'password',at:Date.now()});
  }else{
   if(!existing){err.textContent='No account with that email on this device yet — create one first.';return}
   if(existing.hash!==await digest(pw,existing.salt)){err.textContent='Wrong password for this account.';return}
   existing.phone=phone;write(ACCOUNTS,accounts);
   write(SESSION,{email:email,phone:phone,name:existing.name||name,provider:'password',at:Date.now()});
  }
  unlock();
 });
}

function loadGoogle(err){
 const id=localStorage.getItem(GCLIENT);const host=document.querySelector('#vanesGoogleBtn');
 if(!id||!host)return;
 const cfgBtn=document.querySelector('#vanesGoogleCfg');if(cfgBtn)cfgBtn.hidden=true;
 const run=()=>{
  if(!window.google?.accounts?.id)return;
  google.accounts.id.initialize({client_id:id,callback:res=>{
   try{
    const payload=JSON.parse(decodeURIComponent(escape(atob(res.credential.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))));
    const accounts=read(ACCOUNTS,[]);
    if(!accounts.some(a=>a.email===payload.email))accounts.push({email:payload.email,phone:'',name:payload.name||'',salt:'google',hash:'google',createdAt:Date.now()});
    write(ACCOUNTS,accounts);
    write(SESSION,{email:payload.email,phone:'',name:payload.name||'',provider:'google',at:Date.now()});
    unlock();
   }catch(_){if(err)err.textContent='Google sign-in failed — check the Client ID.'}
  }});
  google.accounts.id.renderButton(host,{theme:'filled_black',size:'medium',text:'continue_with'});
 };
 if(window.google?.accounts?.id)return run();
 const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.onload=run;s.onerror=()=>{if(err)err.textContent='Could not reach Google sign-in on this network.'};document.head.appendChild(s);
}

function unlock(){
 document.documentElement.classList.remove('vanes-locked');
 const g=document.querySelector('#vanesGate');if(g)g.remove();
 const s=session();
 window.showToast?.('Karibu, '+(s?.name||s?.email||'learner')+' — VANES is ready ✓');
 const nameInput=document.querySelector('#nameInput');
 if(nameInput&&!nameInput.value&&s?.name)nameInput.value=s.name;
 renderAccountCard();
}

function upgradeOverlay(){
 if(document.querySelector('#vanesUpgrade'))return;
 const el=document.createElement('div');el.id='vanesUpgrade';
 el.innerHTML='<div class="vanes-upgrade-card"><h2>Your free trial is finished</h2><p>VANES gives every learner '+FREE_LIMIT+' free AI answers. To keep asking, supporting marking and generating question sets, support the app — every contribution keeps VANES free for the next student.</p>'+
 '<div class="vanes-upgrade-row"><button class="primary-button" type="button" id="vanesUpgradeDonate">Support VANES ♥</button><button class="secondary-button" type="button" id="vanesUpgradeLater">Not now</button></div>'+
 '<div class="vanes-upgrade-row"><input id="vanesUpgradeCode" placeholder="Upgrade code from OB Tech-Labs" maxlength="40"><button class="secondary-button" type="button" id="vanesUpgradeApply">Unlock</button></div>'+
 '<p class="vanes-upgrade-note" style="color:#8fa7c7;font-size:11px">After donating, OB Tech-Labs sends you an upgrade code by email or WhatsApp.</p></div>';
 document.body.appendChild(el);
 el.querySelector('#vanesUpgradeDonate').addEventListener('click',()=>{
  const t=document.createElement('button');t.setAttribute('data-donate-vanes','');t.hidden=true;document.body.appendChild(t);t.click();t.remove();
 });
 el.querySelector('#vanesUpgradeLater').addEventListener('click',()=>el.remove());
 el.querySelector('#vanesUpgradeApply').addEventListener('click',()=>{
  const code=el.querySelector('#vanesUpgradeCode').value.trim().toUpperCase();
  if(!/^VANES-PRO-[A-Z0-9]{4,10}$/.test(code)){el.querySelector('#vanesUpgradeCode').value='';el.querySelector('#vanesUpgradeCode').placeholder='Codes look like VANES-PRO-7K2M9';return}
  write(PREMIUM,{code:code,at:Date.now()});el.remove();
  window.showToast?.('VANES Premium unlocked — thank you for supporting the app ✓');renderAccountCard();
 });
}

/* Meter every AI call: chat turns, question sets and marking all pass through /api/chat. */
const nativeFetch=window.fetch.bind(window);
window.fetch=function(input,init){
 const url=typeof input==='string'?input:(input?.url||'');
 if(!/\/api\/chat(?:\?|$)/.test(url)||!init?.body)return nativeFetch(input,init);
 if(left()<=0){upgradeOverlay();return Promise.resolve(new Response(JSON.stringify({error:'Your free trial of '+FREE_LIMIT+' AI answers is finished. Support VANES to continue.'}),{status:402,headers:{'Content-Type':'application/json'}}))}
 return nativeFetch(input,init).then(r=>{if(r.ok){const u=usage();u.used=Number(u.used||0)+1;u.since=Number(u.since||Date.now());write(USAGE,u)}return r});
};

let accountCardPainter=null;
function repaintAccountCard(){if(accountCardPainter)accountCardPainter()}

function renderAccountCard(){
 const host=document.querySelector('#settings .settings-ios-group');
 if(!host)return;
 if(document.querySelector('#vanesAccountCard'))return void repaintAccountCard();
 const card=document.createElement('article');card.className='settings-card ios-card';card.id='vanesAccountCard';
 host.prepend(card);
 paint();
 function paint(){
  accountCardPainter=paint;
  const s=session(),u=usage(),p=premium();
  card.innerHTML='<div class="ios-row"><div class="ios-icon blue">👤</div><div class="ios-copy"><h2>Your VANES account</h2><p>'+
   (s?esc(s.name||s.email)+' · '+esc(s.phone||'no phone')+' · signed in with '+esc(s.provider||'password'):'Not signed in')+'</p>'+
   '<p>'+(p?'VANES Premium · code '+esc(p.code):'Free trial: '+Math.max(0,FREE_LIMIT-u.used)+' of '+FREE_LIMIT+' AI answers left this month')+'</p></div></div>'+
   '<div class="vanes-account-row"><button type="button" class="secondary-button" id="vanesSignOut">Sign out</button>'+
   (p?'':'<button type="button" class="secondary-button" id="vanesGoUpgrade">Get Premium</button>')+'</div>';
  card.querySelector('#vanesSignOut').addEventListener('click',()=>{localStorage.removeItem(SESSION);location.reload()});
  card.querySelector('#vanesGoUpgrade')?.addEventListener('click',upgradeOverlay);
 }
}

function boot(){
 style();
 const start=()=>{if(!session())gate();else renderAccountCard()};
 if(!session())document.documentElement.classList.add('vanes-locked');
 splash(start);
 window.VANES_ACCOUNT={session:session,left:left,premium:premium,upgrade:upgradeOverlay};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
