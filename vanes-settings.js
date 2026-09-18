/* VANES Settings Center — reliable navigation, profile, theme and notification controls. */
(function(){
'use strict';
const KEY='vanes-settings-v1';
const read=()=>{try{return JSON.parse(localStorage.getItem(KEY))||{style:'balanced',language:'Auto',detail:'standard',theme:localStorage.getItem('vanes-theme')||'light'}}catch{return{style:'balanced',language:'Auto',detail:'standard',theme:'light'}}};
const save=v=>localStorage.setItem(KEY,JSON.stringify(v));
const profile=()=>{try{return JSON.parse(localStorage.getItem('vanes-learner-profile-v1'))||null}catch{return null}};
function go(id){
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===id));
  document.querySelectorAll('.nav-link').forEach(a=>a.classList.toggle('active',a.dataset.view===id));
  document.querySelector('.sidebar')?.classList.remove('open');
  history.replaceState(null,'','#'+id);
  window.scrollTo(0,0);
}
window.VANES_SWITCH_VIEW=window.VANES_SWITCH_VIEW||go;
function applyTheme(mode){
  const actual=mode==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):mode;
  document.body.classList.toggle('dark',actual==='dark');
  localStorage.setItem('vanes-theme',mode);
  const t=document.querySelector('#themeToggle');
  if(t){const span=t.querySelector('span');if(span)span.textContent=actual==='dark'?'Light mode':'Dark mode';t.firstChild.textContent=actual==='dark'?'☀ ':'☾ ';}
}
function notifyState(){
  try{return JSON.parse(localStorage.getItem('vanes-notification-settings-v1'))||{enabled:false,minutes:60}}catch{return{enabled:false,minutes:60}}
}
function updateNotificationUI(){
  const x=notifyState(), status=document.querySelector('#settingsNotifyStatus'), button=document.querySelector('#settingsNotifyButton');
  if(status)status.textContent=x.enabled?`Notifications are ON · reminder every ${x.minutes||60} minutes`:'Notifications are OFF on this device.';
  if(button)button.textContent=x.enabled?'🔔 Turn notifications off':'🔔 Turn notifications on';
}
async function toggleNotifications(){
  const button=document.querySelector('#vanesNotifyButton');
  if(button){button.click();setTimeout(updateNotificationUI,150);return;}
  if(!('Notification'in window)){document.querySelector('#settingsNotifyStatus').textContent='This browser does not support device notifications.';return}
  const permission=Notification.permission==='granted'||await Notification.requestPermission()==='granted';
  if(!permission){document.querySelector('#settingsNotifyStatus').textContent='Notification permission was not granted.';return}
  const x=notifyState();x.enabled=!x.enabled;localStorage.setItem('vanes-notification-settings-v1',JSON.stringify(x));
  if(x.enabled)new Notification('VANES AI notifications enabled',{body:'Study reminders are enabled on this device.'});
  updateNotificationUI();
}
function profileSummary(){const p=profile();if(!p)return 'No learner profile saved yet.';return `${p.name} · ${p.level}${p.combination?' · '+p.combination:''}`}
function inject(){
  /* Settings markup is now part of index.html so it cannot disappear when
     dynamic scripts race during startup. Only create it dynamically as a
     legacy fallback when no Settings section exists. */
  const existing=document.getElementById('settings');
  if(existing){
    if(existing.querySelector('.settings-grid')||existing.querySelector('.settings-main')){style();wire();return;}
  }
  const nav=document.querySelector('.nav-links');
  if(nav&&!nav.querySelector('[data-view="settings"]')){const a=document.createElement('a');a.className='nav-link';a.href='#settings';a.dataset.view='settings';a.innerHTML='<span>⚙</span>Settings';nav.appendChild(a);}
  const main=document.querySelector('main');if(!main)return;
  const section=document.createElement('section');section.className='view';section.id='settings';
  section.innerHTML=`<div class="topbar"><div><p class="eyebrow">VANES AI CONTROL CENTER</p><h1>Settings</h1><p class="subtle">Personalise VANES, manage your learner profile, themes and device notifications.</p></div></div>
  <div class="settings-grid">
  <article class="panel settings-card"><p class="eyebrow">PROFILE</p><h2>Your learner profile</h2><div id="settingsProfileSummary" class="profile-context-badge"></div><button class="primary-button" id="settingsEditProfile">Edit name, level & subjects →</button><p class="settings-help">Changes here update the profile VANES uses for subject detection and personalised answers.</p></article>
  <article class="panel settings-card"><p class="eyebrow">THEME</p><h2>Appearance</h2><label>Theme<select id="setTheme"><option value="light">Light</option><option value="dark">Dark</option><option value="system">Use device setting</option></select></label><p class="settings-help">Your choice is saved on this device and applies immediately.</p></article>
  <article class="panel settings-card"><p class="eyebrow">NOTIFICATIONS</p><h2>Study reminders</h2><p>Allow VANES to send study reminders through your browser/device notification system.</p><button class="primary-button" id="settingsNotifyButton">🔔 Turn notifications on</button><label>Reminder interval<select id="notifyInterval"><option value="30">Every 30 minutes</option><option value="60">Every 1 hour</option><option value="120">Every 2 hours</option><option value="180">Every 3 hours</option></select></label><div id="settingsNotifyStatus" class="settings-status"></div><p class="settings-help">Browser permission is required. Remote push while the app is completely closed requires a configured push service.</p></article>
  <article class="panel settings-card"><p class="eyebrow">AI PERSONALISATION</p><h2>Make VANES work your way</h2><label>Response style<select id="setStyle"><option value="balanced">Balanced</option><option value="teacher">Teacher / step-by-step</option><option value="concise">Concise</option><option value="exam">Exam-focused</option><option value="deep">Deep analysis</option></select></label><label>Preferred language<select id="setLanguage"><option>Auto</option><option>English</option><option>Kiswahili</option></select></label><label>Answer detail<select id="setDetail"><option value="standard">Standard</option><option value="short">Short</option><option value="detailed">Detailed</option></select></label><button class="secondary-button" id="saveAiSettings">Save AI preferences</button><p id="settingsSaved" class="profile-context-badge"></p></article>
  <article class="panel settings-card"><p class="eyebrow">ACCOUNT & DEVICE</p><h2>Your controls</h2><button class="secondary-button" id="settingsOpenProfile">✎ Change profile</button><button class="secondary-button" id="settingsOpenNotifications">🔔 Notification settings</button><button class="secondary-button" id="clearLocalData">Clear local VANES data</button><p class="settings-help">Clearing data removes the local profile, chats, notes, study tracking and preferences from this device.</p></article>
  <article class="panel settings-card"><p class="eyebrow">DONATE TO VANES</p><h2>Support development</h2><p>Choose a contribution amount and payment method. VANES never asks you to type a card PIN or banking password into the app.</p><form id="donateForm"><div class="amounts"><button type="button" data-amount="5000">TZS 5,000</button><button type="button" data-amount="10000">TZS 10,000</button><button type="button" data-amount="25000">TZS 25,000</button><button type="button" data-amount="50000">TZS 50,000</button></div><label>Custom amount (TZS)<input id="donateAmount" type="number" min="500" step="500" placeholder="e.g. 15000" required></label><label>Payment method<select id="donateMethod"><option value="mobile">Mobile money</option><option value="card">Credit / debit card</option></select></label><label>Your name<input id="donorName" maxlength="80" required></label><label>Phone number<input id="donorPhone" type="tel" maxlength="25" placeholder="+255..." required></label><label>Email (optional)<input id="donorEmail" type="email" maxlength="120"></label><button class="primary-button" id="donateButton" type="submit">Continue donation →</button></form><div id="donateStatus" class="settings-status" role="status" aria-live="polite"></div></article>
  <article class="panel settings-card"><p class="eyebrow">BE PART OF THE FAMILY</p><h2>Join OB Tech-Labs</h2><p>Send your membership request directly to the VANES/OB Tech-Labs team.</p><form id="familyForm"><label>Name<input id="familyName" maxlength="80" required></label><label>Phone number<input id="familyPhone" type="tel" maxlength="25" required></label><label>Email<input id="familyEmail" type="email" maxlength="120" required></label><button class="primary-button" id="familyButton" type="submit">Send family request →</button></form><div id="familyStatus" class="settings-status" role="status" aria-live="polite"></div></article>
  <article class="panel settings-card"><p class="eyebrow">OB TECH-LABS OPPORTUNITIES</p><h2>Interested in the field?</h2><p>Enter your details and send an opportunity or collaboration request to the OB Tech-Labs team.</p><form id="fieldForm"><label>Name<input id="fieldName" name="name" maxlength="80" autocomplete="name" placeholder="Your full name" required></label><label>Phone number<input id="fieldPhone" name="phone" type="tel" maxlength="25" autocomplete="tel" placeholder="+255..." required></label><label>Email<input id="fieldEmail" name="email" type="email" maxlength="120" autocomplete="email" placeholder="you@example.com" required></label><button class="secondary-button" id="fieldButton" type="submit">Send opportunity request →</button></form><div id="fieldStatus" class="settings-status" role="status" aria-live="polite"></div></article>
  <article class="panel settings-card"><p class="eyebrow">FEEDBACK & IDEAS</p><h2>Help improve VANES AI</h2><form id="feedbackForm"><label>Comment / suggestion<textarea id="feedbackText" maxlength="3000" placeholder="Bugs, improvements, new features or ideas..." required></textarea></label><label>Email (optional)<input id="feedbackEmail" type="email" maxlength="120"></label><button class="primary-button" id="feedbackButton" type="submit">Send feedback →</button></form><div id="feedbackStatus" class="settings-status" role="status" aria-live="polite"></div></article>
  </div>`;
  main.appendChild(section);style();wire();
}
function style(){if(document.getElementById('vanes-settings-style'))return;const s=document.createElement('style');s.id='vanes-settings-style';s.textContent=`
#settings{--ios-blue:#0a84ff;--ios-purple:#7b3cff;--ios-bg:rgba(18,24,38,.82);max-width:1180px;margin:auto;padding:10px 10px 80px}
#settings .settings-ios-head{display:flex;justify-content:space-between;align-items:center;padding:30px 34px;margin-bottom:22px;border:1px solid rgba(76,185,255,.22);border-radius:30px;background:radial-gradient(circle at 85% 30%,rgba(76,185,255,.16),transparent 30%),linear-gradient(145deg,rgba(19,29,47,.96),rgba(7,12,22,.92));box-shadow:0 25px 70px rgba(0,0,0,.3);overflow:hidden}
#settings .settings-kicker{font-size:11px;letter-spacing:.22em;font-weight:900;color:#4ccfff}
#settings .settings-ios-head h1{margin:7px 0 5px;font-size:38px;letter-spacing:-.04em}
#settings .settings-ios-head p{margin:0;color:#9fb5d2}
#settings .settings-orb{display:grid;place-items:center;width:72px;height:72px;border-radius:23px;font-size:30px;background:linear-gradient(135deg,#0a84ff,#7b3cff);box-shadow:0 14px 35px rgba(10,132,255,.25)}
#settings .settings-ios-layout{display:grid;grid-template-columns:205px 1fr;gap:24px;align-items:start}
#settings .settings-sidebar{position:sticky;top:20px;display:grid;gap:7px;padding:10px;border:1px solid rgba(255,255,255,.09);border-radius:22px;background:rgba(12,18,30,.72);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px)}
#settings .settings-tab{display:flex;align-items:center;gap:11px;width:100%;padding:13px 14px;border:0;border-radius:14px;background:transparent;color:#aebed2;text-align:left;font:600 13px inherit;cursor:pointer}
#settings .settings-tab.active,#settings .settings-tab:hover{color:#fff;background:linear-gradient(100deg,rgba(10,132,255,.2),rgba(123,60,255,.13))}
#settings .settings-main{display:grid;gap:24px;min-width:0}
#settings .settings-ios-group{display:grid;gap:9px}
#settings .settings-group-title{padding-left:15px;font-size:11px;letter-spacing:.17em;font-weight:900;color:#6d88a8}
#settings .settings-card{padding:21px;border:1px solid rgba(255,255,255,.1);border-radius:23px;background:linear-gradient(145deg,rgba(22,30,45,.9),rgba(10,15,25,.82));box-shadow:0 18px 50px rgba(0,0,0,.2),inset 0 1px 0 rgba(255,255,255,.06);backdrop-filter:blur(25px);-webkit-backdrop-filter:blur(25px)}
#settings .ios-row{display:flex;align-items:center;gap:14px;min-width:0}
#settings .ios-copy{flex:1;min-width:0}.ios-copy h2{margin:0 0 4px;font-size:17px}.ios-copy p{margin:0;color:#91a8c4;font-size:13px;line-height:1.45}
#settings .ios-icon{flex:0 0 44px;width:44px;height:44px;display:grid;place-items:center;border-radius:14px;background:rgba(255,255,255,.08);font-size:19px}
#settings .ios-icon.blue{background:rgba(10,132,255,.16)}#settings .ios-icon.purple{background:rgba(123,60,255,.16)}#settings .ios-icon.cyan{background:rgba(0,210,255,.14)}#settings .ios-icon.orange{background:rgba(255,149,0,.15)}#settings .ios-icon.red{background:rgba(255,69,58,.15)}#settings .ios-icon.green{background:rgba(52,199,89,.15)}#settings .ios-icon.teal{background:rgba(48,209,88,.14)}#settings .ios-icon.yellow{background:rgba(255,214,10,.14)}
#settings select,#settings input,#settings textarea{box-sizing:border-box;width:100%;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(255,255,255,.06);color:#fff;padding:12px 14px;font:inherit;outline:0}
#settings .ios-row select{width:190px;flex:0 0 190px}#settings input:focus,#settings select:focus,#settings textarea:focus{border-color:#0a84ff;box-shadow:0 0 0 4px rgba(10,132,255,.12)}
#settings textarea{min-height:115px;resize:vertical}#settings label{display:grid;gap:7px;margin-top:13px;color:#c9d6e8;font-size:12px;font-weight:800}
#settings .ios-divider{height:1px;background:rgba(255,255,255,.08);margin:17px 0}
#settings .ios-primary{width:100%;margin-top:16px;padding:13px 16px;border:0;border-radius:15px;background:linear-gradient(135deg,#0a84ff,#7b3cff);color:#fff;font-weight:900;cursor:pointer;box-shadow:0 10px 28px rgba(10,132,255,.2)}
#settings .ios-switch{border:0;border-radius:999px;padding:10px 15px;background:#34c759;color:#fff;font-weight:900;cursor:pointer}
#settings .ios-amounts{display:flex;gap:8px;margin:15px 0}.ios-amounts button{flex:1;border:1px solid rgba(255,255,255,.11);border-radius:13px;padding:12px 8px;background:rgba(255,255,255,.06);color:#fff;font-weight:800;cursor:pointer}.ios-amounts button:hover{background:rgba(10,132,255,.18)}
#settings .ios-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 15px}
#settings .settings-two{display:grid;grid-template-columns:1fr 1fr;gap:20px}
#settings .support-banner{display:flex;justify-content:space-between;align-items:center;padding:18px;border-radius:18px;background:linear-gradient(120deg,rgba(10,132,255,.13),rgba(123,60,255,.12));border:1px solid rgba(255,255,255,.08)}.support-banner span{font-size:10px;letter-spacing:.16em;color:#5ccfff;font-weight:900}.support-banner h2{margin:5px 0;font-size:18px}.support-banner p{margin:0;color:#91a8c4;font-size:12px}.support-heart{font-size:32px}
#settings .rating-row{display:flex;gap:9px;margin:15px 0}.rating-row button{width:45px;height:45px;border:1px solid rgba(255,255,255,.1);border-radius:13px;background:rgba(255,255,255,.06);color:#ffd60a;font-size:20px;cursor:pointer}.rating-row button:hover{background:rgba(255,214,10,.14);transform:translateY(-2px)}
#settings .settings-status{min-height:20px;color:#75c7ff;font-size:12px;font-weight:800;margin-top:8px}
@media(max-width:850px){#settings .settings-ios-layout{grid-template-columns:1fr}#settings .settings-sidebar{position:static;display:flex;overflow:auto}.settings-tab{white-space:nowrap}.settings-tab span{display:inline!important}#settings .settings-two{grid-template-columns:1fr}#settings .ios-form-grid{grid-template-columns:1fr}}
@media(max-width:560px){#settings .settings-ios-head{padding:23px 20px;border-radius:23px}#settings .settings-ios-head h1{font-size:30px}#settings .settings-orb{width:55px;height:55px}.ios-row select{width:140px!important;flex-basis:140px!important}.settings-card{padding:17px!important}}
`;document.head.appendChild(s)}
async function send(type,payload,status){
  if(!status)return {ok:false};
  status.textContent='Sending securely…';
  try{
    const endpoint=window.VANES_CONTACT_ENDPOINT||'/api/contact';
    const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,payload})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok){const detail=d?.detail?' — '+d.detail:'';throw new Error((d?.error||'Request could not be sent.')+detail)}
    window.VANES_TRACK?.('settings_'+type+'_submitted',{method:payload?.method||null});
    status.textContent=d.message||'Sent successfully. Thank you.';
    return d;
  }catch(e){const message=e?.message||'Unable to send right now.';status.textContent=message;return {ok:false,error:message}}
}
function bindClick(id,handler){const el=document.getElementById(id);if(el)el.onclick=handler;return el}
function bindSubmit(id,handler){const form=document.getElementById(id);if(form)form.onsubmit=handler;return form}
function value(id){return String(document.getElementById(id)?.value||'').trim()}
function wire(){
 const x=read(), theme=document.querySelector('#setTheme');
 const summary=document.querySelector('#settingsProfileSummary');if(summary)summary.textContent=profileSummary();
 if(theme){theme.value=x.theme||localStorage.getItem('vanes-theme')||'light';theme.onchange=()=>{const v=read();v.theme=theme.value;save(v);applyTheme(theme.value)}}
 ['setStyle','setLanguage','setDetail'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=id==='setStyle'?x.style:id==='setLanguage'?x.language:x.detail});
 bindClick('saveAiSettings',()=>{const v=read();v.style=value('setStyle')||'balanced';v.language=value('setLanguage')||'Auto';v.detail=value('setDetail')||'standard';save(v);const saved=document.getElementById('settingsSaved');if(saved)saved.textContent='AI preferences saved.'});
 const edit=()=>document.getElementById('changeName')?.click();bindClick('settingsEditProfile',edit);bindClick('settingsOpenProfile',edit);
 const ns=notifyState(), interval=document.getElementById('notifyInterval');if(interval)interval.value=String(ns.minutes||60);updateNotificationUI();
 bindClick('settingsNotifyButton',toggleNotifications);bindClick('settingsOpenNotifications',()=>document.getElementById('settingsNotifyButton')?.click());
 if(interval)interval.onchange=()=>{const v=notifyState();v.minutes=Number(interval.value);localStorage.setItem('vanes-notification-settings-v1',JSON.stringify(v));updateNotificationUI()};
 document.querySelectorAll('#settings .amounts button').forEach(b=>b.onclick=()=>{const amount=document.getElementById('donateAmount');if(amount)amount.value=b.dataset.amount});
 bindClick('clearLocalData',()=>{if(confirm('Clear local VANES data on this device?')){['vanes-user-name','vanes-learner-profile-v1','vanes-learner-profile-v2','vanes-chat-conversations-v1','vanes-chat-active-v1','vanes-saved-study-plans-v1','vanes-study-tracking-v2','vanes-study-summaries-v1','vanes-daily-streak-v2','vanes-settings-v1','vanes-theme','vanes-notification-settings-v1','vanes-anonymous-id-v1','vanes-profile-picture-v1'].forEach(k=>localStorage.removeItem(k));location.reload()}});
 const donationSubmit=async e=>{e?.preventDefault();const amount=Number(value('donateAmount')),status=document.getElementById('donateStatus');if(!amount||amount<500){if(status)status.textContent='Enter a valid donation amount (minimum TZS 500).';return}return send('donation',{amount,currency:'TZS',method:value('donateMethod')||'mobile',name:value('donorName'),phone:value('donorPhone'),email:value('donorEmail')},status)};
 bindSubmit('donateForm',donationSubmit);bindClick('donateButton',donationSubmit);
 const familySubmit=async e=>{e?.preventDefault();const status=document.getElementById('familyStatus'),p={name:value('familyName'),phone:value('familyPhone'),email:value('familyEmail')};if(!p.name||!p.phone||!p.email){if(status)status.textContent='Please complete your name, phone number and email.';return}return send('family',p,status)};
 bindSubmit('familyForm',familySubmit);bindClick('familyButton',familySubmit);
 const fieldSubmit=async e=>{e?.preventDefault();const status=document.getElementById('fieldStatus'),p={name:value('fieldName'),phone:value('fieldPhone'),email:value('fieldEmail')};if(!p.name||!p.phone||!p.email){if(status)status.textContent='Please complete your name, phone number and email.';return}return send('field',p,status)};
 bindSubmit('fieldForm',fieldSubmit);bindClick('fieldButton',fieldSubmit);
 let selectedRating=0;const ratingButtons=document.querySelectorAll('#settings .rating-row button');
 ratingButtons.forEach((b,i)=>b.onclick=()=>{selectedRating=i+1;ratingButtons.forEach((x,j)=>x.setAttribute('aria-pressed',j<=i?'true':'false'));const status=document.getElementById('feedbackStatus');if(status)status.textContent='Rating selected: '+selectedRating+'/5. Add a comment if you want, then send.'});
 const feedbackSubmit=async e=>{e?.preventDefault();const status=document.getElementById('feedbackStatus'),comment=value('feedbackText'),email=value('feedbackEmail');if(!selectedRating&&!comment){if(status)status.textContent='Choose a rating or enter a comment first.';return}if(selectedRating)return send('rating',{rating:selectedRating,comment,email},status);return send('feedback',{comment,email},status)};
 bindSubmit('feedbackForm',feedbackSubmit);bindClick('feedbackButton',feedbackSubmit);
}function route(){const id=location.hash.slice(1);if(id==='settings')go('settings')}
function ensureSettings(){
  const section=document.getElementById('settings');
  if(!section){
    inject();
    return;
  }
  if(!section.querySelector('.settings-grid')&&!section.querySelector('.settings-main')){
    inject();
    return;
  }
  style();
  wire();
}
function boot(){
  /* Settings is a first-class view. Keep it present and re-bind it after
     other VANES modules finish their startup work. */
  ensureSettings();
  setTimeout(ensureSettings,50);
  setTimeout(ensureSettings,500);
  setTimeout(ensureSettings,1500);
  document.addEventListener('click',e=>{
    const a=e.target.closest?.('[data-view="settings"],[data-view-target="settings"]');
    if(a){
      e.preventDefault();
      e.stopImmediatePropagation();
      ensureSettings();
      go('settings');
    }
  },true);
  window.addEventListener('hashchange',route);
  route();
  const q=read();
  applyTheme(q.theme||localStorage.getItem('vanes-theme')||'light');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
