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
    if(existing.querySelector('.settings-grid')){style();wire();return;}
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
function style(){if(document.getElementById('vanes-settings-style'))return;const s=document.createElement('style');s.id='vanes-settings-style';s.textContent=`#settings .settings-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.settings-card{display:grid;gap:11px}.settings-card label{display:grid;gap:6px;font-size:13px;font-weight:700}.settings-card input,.settings-card select,.settings-card textarea{width:100%;box-sizing:border-box;padding:11px 12px;border:1px solid #d8dbe3;border-radius:11px;background:#fff;color:#111;font:inherit}.settings-card textarea{min-height:120px;resize:vertical}.amounts{display:flex;flex-wrap:wrap;gap:8px}.amounts button{border:1px solid #d8dbe3;background:#fff;color:#111;border-radius:10px;padding:9px 12px;cursor:pointer}.settings-status{min-height:22px;font-size:13px;font-weight:700}.settings-help{font-size:12px;opacity:.75;line-height:1.5;margin:0}.settings-card h2{margin:0}.settings-card>.secondary-button,.settings-card>.primary-button{width:100%}@media(max-width:800px){#settings .settings-grid{grid-template-columns:1fr}}`;document.head.appendChild(s)}
async function directFormSubmit(type,payload){
  const subjects={
    donation:'VANES donation request',
    family:'VANES family membership request',
    field:'OB Tech-Labs field interest',
    feedback:'VANES app feedback'
  };
  const subject=subjects[type]||'VANES request';
  let message='';
  if(type==='donation'){
    message=[
      'VANES DONATION REQUEST',
      'Amount: '+(payload.amount||'')+' '+(payload.currency||'TZS'),
      'Method: '+(payload.method||''),
      'Name: '+(payload.name||''),
      'Phone: '+(payload.phone||''),
      'Email: '+(payload.email||'')
    ].join('\\n');
  }else if(type==='family'){
    message=[
      'VANES FAMILY MEMBERSHIP REQUEST',
      'Name: '+(payload.name||''),
      'Phone: '+(payload.phone||''),
      'Email: '+(payload.email||'')
    ].join('\\n');
  }else if(type==='field'){
    message=[
      'OB TECH-LABS FIELD INTEREST',
      'Name: '+(payload.name||''),
      'Phone: '+(payload.phone||''),
      'Email: '+(payload.email||'')
    ].join('\\n');
  }else{
    message=[
      'VANES FEEDBACK',
      'Comment: '+(payload.comment||''),
      'Email: '+(payload.email||'')
    ].join('\\n');
  }
  const form=new URLSearchParams({
    name:payload.name||'',
    email:payload.email||'',
    phone:payload.phone||'',
    subject,
    message,
    _captcha:'false',
    _template:'table'
  });
  const r=await fetch('https://formsubmit.co/ajax/obtechnologies625@gmail.com',{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:form
  });
  const raw=await r.text();
  let d={};
  try{d=raw?JSON.parse(raw):{}}catch(_){}
  if(!r.ok||d.success===false){
    throw new Error('Direct FormSubmit HTTP '+r.status+': '+(d.message||d.error||raw||'Request failed.'));
  }
  return d;
}
async function send(type,payload,status){
  status.textContent='Sending securely…';
  try{
    const r=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,payload})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok){
      if(r.status===429||d?.detail?.includes('FormSubmit HTTP 429')){
        status.textContent='Using direct delivery fallback…';
        const direct=await directFormSubmit(type,payload);
        window.VANES_TRACK?.('settings_'+type+'_submitted',{method:'formsubmit-direct'});
        status.textContent=direct?.message||'Sent successfully. Thank you.';
        return direct;
      }
      const detail=d.detail?\` — \${d.detail}\`:'';
      throw new Error((d.error||'Request could not be sent.')+detail)
    }
    window.VANES_TRACK?.('settings_'+type+'_submitted',{method:payload?.method||null});
    status.textContent=d.message||'Sent successfully. Thank you.';
    return d
  }catch(e){status.textContent=e.message||'Unable to send right now.'}
}
function wire(){
 const x=read(), theme=document.querySelector('#setTheme');
 document.querySelector('#settingsProfileSummary').textContent=profileSummary();
 theme.value=x.theme||localStorage.getItem('vanes-theme')||'light';theme.onchange=()=>{const v=read();v.theme=theme.value;save(v);applyTheme(theme.value)};
 ['setStyle','setLanguage','setDetail'].forEach(id=>{const el=document.getElementById(id);el.value=id==='setStyle'?x.style:id==='setLanguage'?x.language:x.detail});
 document.getElementById('saveAiSettings').onclick=()=>{const v=read();v.style=document.getElementById('setStyle').value;v.language=document.getElementById('setLanguage').value;v.detail=document.getElementById('setDetail').value;save(v);document.getElementById('settingsSaved').textContent='AI preferences saved.'};
 const edit=()=>{document.getElementById('changeName')?.click()};
 document.getElementById('settingsEditProfile').onclick=edit;document.getElementById('settingsOpenProfile').onclick=edit;
 const ns=notifyState();document.getElementById('notifyInterval').value=String(ns.minutes||60);updateNotificationUI();
 document.getElementById('settingsNotifyButton').onclick=toggleNotifications;document.getElementById('settingsOpenNotifications').onclick=()=>document.getElementById('settingsNotifyButton').click();
 document.getElementById('notifyInterval').onchange=()=>{const v=notifyState();v.minutes=Number(document.getElementById('notifyInterval').value);localStorage.setItem('vanes-notification-settings-v1',JSON.stringify(v));updateNotificationUI()};
 document.querySelectorAll('.amounts button').forEach(b=>b.onclick=()=>document.getElementById('donateAmount').value=b.dataset.amount);
 document.getElementById('clearLocalData').onclick=()=>{if(confirm('Clear local VANES data on this device?')){['vanes-user-name','vanes-learner-profile-v1','vanes-learner-profile-v2','vanes-chat-conversations-v1','vanes-chat-active-v1','vanes-saved-study-plans-v1','vanes-study-tracking-v2','vanes-study-summaries-v1','vanes-daily-streak-v2','vanes-settings-v1','vanes-theme','vanes-notification-settings-v1','vanes-anonymous-id-v1','vanes-profile-picture-v1'].forEach(k=>localStorage.removeItem(k));location.reload()}};
 document.getElementById('donateForm').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget;if(!f.reportValidity())return;const amount=Number(document.getElementById('donateAmount').value);if(!amount||amount<500){document.getElementById('donateStatus').textContent='Enter a valid donation amount.';return}await send('donation',{amount,currency:'TZS',method:document.getElementById('donateMethod').value,name:document.getElementById('donorName').value.trim(),phone:document.getElementById('donorPhone').value.trim(),email:document.getElementById('donorEmail').value.trim()},document.getElementById('donateStatus'))};
 document.getElementById('familyForm').onsubmit=e=>{e.preventDefault();const f=e.currentTarget;if(!f.reportValidity())return;return send('family',{name:document.getElementById('familyName').value.trim(),phone:document.getElementById('familyPhone').value.trim(),email:document.getElementById('familyEmail').value.trim()},document.getElementById('familyStatus'))};
 document.getElementById('fieldForm').onsubmit=(e)=>{e.preventDefault();const form=e.currentTarget;if(!form.reportValidity())return;return send('field',{name:document.getElementById('fieldName').value.trim(),phone:document.getElementById('fieldPhone').value.trim(),email:document.getElementById('fieldEmail').value.trim()},document.getElementById('fieldStatus'))};
 document.getElementById('feedbackForm').onsubmit=e=>{e.preventDefault();const f=e.currentTarget;if(!f.reportValidity())return;const text=document.getElementById('feedbackText').value.trim();return send('feedback',{comment:text,email:document.getElementById('feedbackEmail').value.trim()},document.getElementById('feedbackStatus'))};
}
function route(){const id=location.hash.slice(1);if(id==='settings')go('settings')}
function ensureSettings(){
  const section=document.getElementById('settings');
  if(!section){
    inject();
    return;
  }
  if(!section.querySelector('.settings-grid')){
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
