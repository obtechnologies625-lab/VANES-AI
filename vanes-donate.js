/* VANES AI — donation support via Airtel Money (fixed 3,500 TZS per user).
   The Worker pushes the USSD approval prompt to the donor's phone through the Airtel
   Money Collection API; the OB Tech-Labs counter issues the VANES-PRO upgrade code,
   which this modal shows and applies automatically once Airtel confirms the payment.
   When merchant credentials are not configured on the Worker, it falls back to the
   manual Airtel number (JULIUS FIKIRINI NKWABI): the learner pays with Airtel Money
   and uploads the receipt screenshot, which the Worker verifies automatically before
   the counter issues the code and the app applies it. */
(function(){
'use strict';
const AMOUNT=3500,DEFAULT_MANUAL='+255688346613',DEFAULT_MANUAL_NAME='JULIUS FIKIRINI NKWABI',USSD='*150*60#',POLL_MS=5000,MAX_POLLS=48;
const ANALYTICS='/api/analytics';
const apiBase=()=>String(window.VANES_CHAT_ENDPOINT||location.origin+'/api/chat').replace(/\/api\/chat$/,'');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let manualNumber=DEFAULT_MANUAL,manualName=DEFAULT_MANUAL_NAME,modal=null,pollTimer=null,polls=0,busy=false;
const state={ref:'',phone:'',done:false};
function anonymousId(){try{let id=localStorage.getItem('vanes-anonymous-id-v1');if(!id){id=(crypto.randomUUID?crypto.randomUUID():'vanes-'+Date.now()+'-'+Math.random().toString(36).slice(2));localStorage.setItem('vanes-anonymous-id-v1',id)}return id}catch(_){return 'vanes-session-'+Date.now()}}
function userName(){try{const p=JSON.parse(localStorage.getItem('vanes-learner-profile-v1')||'null');return String(p?.name||localStorage.getItem('vanes-user-name')||'').trim().slice(0,120)}catch(_){return ''}}
function track(event,payload){const data={event,anonymousId:anonymousId(),userName:userName(),payload:{...(payload||{})}};try{const key='vanes-local-activity-v1',items=JSON.parse(localStorage.getItem(key)||'[]');items.unshift({event,...data.payload,at:new Date().toISOString()});localStorage.setItem(key,JSON.stringify(items.slice(0,50)))}catch(_){}try{fetch(ANALYTICS,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),keepalive:true}).catch(()=>{})}catch(_){}}
/* The donation is bound to a signed-in learner when possible, so the Worker can throttle
   duplicate pending payments; anonymous device accounts can still donate. */
async function idToken(){const fb=window.VANES_FB;if(!fb||!fb.ok||!fb.user())return '';try{return await fb.idToken()}catch(_){return ''}}
function savedPhone(){try{return String(window.VANES_ACCOUNT?.session?.()?.phone||'').replace(/[^\d+ ]/g,'').slice(0,18)}catch(_){return ''}}

function ensureStyle(){
 if(document.getElementById('vanes-donate-style'))return;
 const s=document.createElement('style');s.id='vanes-donate-style';s.textContent=
 '#vanesDonateModal{position:fixed;inset:0;z-index:99999;display:grid;place-items:center}'+
 '#vanesDonateModal[hidden]{display:none}'+
 '.vanes-donate-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.72);backdrop-filter:blur(6px)}'+
 '.vanes-donate-card{position:relative;width:min(440px,calc(100% - 32px));max-height:90vh;overflow:auto;padding:30px;border:1px solid rgba(255,255,255,.14);border-radius:24px;background:#101522;color:#fff;box-shadow:0 24px 80px rgba(0,0,0,.55);text-align:center}'+
 '.vanes-donate-icon{font-size:34px;margin-bottom:8px}.vanes-donate-card h2{margin:4px 0 10px}.vanes-donate-card p{line-height:1.6;color:#c9d0dd}'+
 '.vanes-donate-number{margin:18px 0;padding:18px;border-radius:16px;background:rgba(255,255,255,.07);display:flex;flex-direction:column;gap:5px}.vanes-donate-number span{font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#aeb8ca}.vanes-donate-number strong{font-size:24px;letter-spacing:.04em}.vanes-donate-number small{color:#8fa7c7;font-size:11px}'+
 '.vanes-donate-close{position:absolute;right:14px;top:10px;border:0;background:transparent;color:#fff;font-size:28px;cursor:pointer}'+
 '.vanes-donate-note{font-size:12px!important;margin-bottom:0;color:#8fa7c7!important}'+
 '.vanes-donate-field{display:grid;gap:7px;margin:0 0 14px;text-align:left;color:#c9d6e8;font-size:12px;font-weight:800}'+
 '.vanes-donate-field input{width:100%;box-sizing:border-box;padding:12px 14px;border:1px solid #285776;border-radius:12px;background:#f7fbff;color:#111827;font:inherit}'+
 '.vanes-donate-card .primary-button,.vanes-donate-card .secondary-button{width:100%;justify-content:center}'+
 '.vanes-donate-wait{display:flex;align-items:center;justify-content:center;gap:10px;margin:16px 0;padding:14px;border-radius:14px;background:rgba(10,132,255,.12);border:1px solid rgba(10,132,255,.35);color:#9fd8ff;font-weight:700}'+
 '.vanes-donate-wait .spin{width:16px;height:16px;border:2px solid rgba(159,216,255,.35);border-top-color:#9fd8ff;border-radius:50%;animation:vanesSpin 1s linear infinite}'+
 '@keyframes vanesSpin{to{transform:rotate(360deg)}}'+
 '.vanes-donate-cancel{margin-top:10px;border:0;background:transparent;color:#8fa7c7;cursor:pointer;font:600 12px inherit}'+
 '.vanes-donate-copy{margin-left:6px;border:1px solid #285776;border-radius:9px;background:transparent;color:#9fd8ff;cursor:pointer;font:700 11px inherit;padding:4px 8px}'+
 '.vanes-donate-manual{margin-top:14px}'+
 '.vanes-donate-code{margin-top:14px;display:flex;gap:8px}.vanes-donate-code input{flex:1;min-width:0;padding:10px;border:1px solid #285776;border-radius:10px;background:#f7fbff;color:#111827;font:inherit;text-transform:uppercase}.vanes-donate-code button{width:auto!important;flex:0 0 auto}';
 document.head.appendChild(s);
}
function view(html){const body=modal?.querySelector('#vanesDonateBody');if(body)body.innerHTML=html}
function ensureModal(){
 if(modal)return modal;
 modal=document.createElement('div');modal.id='vanesDonateModal';modal.hidden=true;
 modal.innerHTML='<div class="vanes-donate-backdrop" data-donate-close></div><div class="vanes-donate-card" role="dialog" aria-modal="true" aria-labelledby="vanesDonateTitle"><button class="vanes-donate-close" type="button" data-donate-close aria-label="Close">×</button><div id="vanesDonateBody"></div></div>';
 document.body.appendChild(modal);ensureStyle();
 modal.querySelectorAll('[data-donate-close]').forEach(el=>el.addEventListener('click',close));
 return modal;
}
function stopPoll(){if(pollTimer){clearInterval(pollTimer);pollTimer=null}}
function copyManual(){
 const b=modal.querySelector('#vanesDonateCopy');
 track('donate_to_vanes_copy',{method:'Airtel Money',destination:'Airtel Money number'});
 const done=()=>{if(b){b.textContent='Copied ✓';setTimeout(()=>{if(b)b.textContent='Copy'},1800)}};
 try{navigator.clipboard.writeText(manualNumber).then(done).catch(()=>{if(b)b.textContent=manualNumber})}catch(_){if(b)b.textContent=manualNumber}
}

function form(){
 stopPoll();state.ref='';state.done=false;
 view('<div class="vanes-donate-icon">♥</div><p class="eyebrow">SUPPORT VANES AI</p><h2 id="vanesDonateTitle">Donate 3,500 TZS</h2>'+
 '<p>One <strong>3,500 TZS</strong> Airtel Money donation unlocks VANES Premium: unlimited AI answers, the study-link shortener, the student portal, study tracking and parent access.</p>'+
 '<div class="vanes-donate-number"><span>Donation</span><strong>3,500 TZS</strong><small>per user · one time</small></div>'+
 '<label class="vanes-donate-field">Your Airtel Money number<input id="vanesDonatePhone" type="tel" maxlength="17" placeholder="0712 345 678" value="'+esc(savedPhone())+'"></label>'+
 '<button type="button" class="primary-button" id="vanesDonateStart">Send payment request →</button>'+
 '<p class="vanes-donate-note" id="vanesDonateError"></p>'+
 '<p class="vanes-donate-note vanes-donate-manual">Or send it yourself to Airtel Money <strong id="vanesDonateManual">'+esc(manualNumber)+'</strong><button type="button" class="vanes-donate-copy" id="vanesDonateCopy">Copy</button></p>');
 modal.querySelector('#vanesDonateStart').addEventListener('click',start);
 modal.querySelector('#vanesDonateCopy').addEventListener('click',copyManual);
}

async function start(){
 if(busy)return;
 const input=modal.querySelector('#vanesDonatePhone'),err=modal.querySelector('#vanesDonateError');
 const phoneVal=String(input?.value||'').trim();
 if(!/^\+?[0-9][0-9 ()-]{7,16}$/.test(phoneVal)){if(err)err.textContent='Enter your Airtel number, e.g. 0712 345 678.';return}
 const btn=modal.querySelector('#vanesDonateStart');
 busy=true;if(btn){btn.disabled=true;btn.textContent='Sending request to Airtel…'}
 const token=await idToken();
 const headers={'Content-Type':'application/json'};if(token)headers.Authorization='Bearer '+token;
 let r=null,d={};
 try{r=await fetch(apiBase()+'/api/pay/airtel',{method:'POST',headers,body:JSON.stringify({phone:phoneVal})});d=await r.json().catch(()=>({}))}
 catch(_){d={error:'Could not reach VANES. Check your connection and try again.'}}
 busy=false;
 if(r&&r.ok&&d.reference){state.phone=phoneVal;state.ref=String(d.reference);track('donate_airtel_started',{reference:state.ref});waiting();return}
 if(r&&r.status===503&&d.manual){manualNumber=String(d.manual?.number||manualNumber||DEFAULT_MANUAL);if(d.manual?.name)manualName=String(d.manual.name);track('donate_airtel_manual',{reason:'not-configured'});manual('');return}
 if(r&&r.status===429&&state.ref){waiting();return}
 if(btn){btn.disabled=false;btn.textContent='Send payment request →'}
 if(err)err.textContent=String(d.error||'Could not start the payment. Please try again.')+(d.detail?' — '+d.detail:'');
}

function waiting(){
 stopPoll();polls=0;
 view('<div class="vanes-donate-icon">📲</div><p class="eyebrow">AIRTEL MONEY</p><h2>Approve on your phone</h2>'+
 '<p>Airtel sent a request for <strong>3,500 TZS</strong> to '+esc(state.phone||'your phone')+'. Enter your Airtel Money PIN on your phone to approve it.</p>'+
 '<div class="vanes-donate-wait"><span class="spin"></span> Waiting for Airtel to confirm…</div>'+
 '<button type="button" class="secondary-button" id="vanesDonateCheck">Check now</button>'+
 '<button type="button" class="vanes-donate-cancel" id="vanesDonateCancel">Cancel payment</button>'+
 '<p class="vanes-donate-note" id="vanesDonateError"></p>');
 modal.querySelector('#vanesDonateCheck').addEventListener('click',()=>pollOnce(true));
 modal.querySelector('#vanesDonateCancel').addEventListener('click',()=>{stopPoll();state.ref='';form()});
 pollTimer=setInterval(()=>{
  polls++;
  if(polls>MAX_POLLS){stopPoll();const err=modal.querySelector('#vanesDonateError');if(err)err.textContent='Airtel has not confirmed yet. If you approved the request, tap Check now — otherwise cancel and start again.';return}
  pollOnce();
 },POLL_MS);
 pollOnce();
}

async function pollOnce(manualTap){
 if(!state.ref||state.done)return;
 if(manualTap){const err=modal.querySelector('#vanesDonateError');if(err)err.textContent='Checking with Airtel…'}
 let r=null,d={};
 try{r=await fetch(apiBase()+'/api/pay/airtel/status?ref='+encodeURIComponent(state.ref),{cache:'no-store'});d=await r.json().catch(()=>({}))}
 catch(_){}
 if(!r)return;
 if(d.status==='SUCCESS'&&d.code){success(String(d.code));return}
 if(d.status==='FAILED'){stopPoll();track('donate_airtel_failed',{reference:state.ref});state.ref='';failed();return}
 const err=modal.querySelector('#vanesDonateError');
 if(err&&manualTap)err.textContent='Airtel is still processing. Keep this window open — it checks by itself.';
}

function failed(){
 view('<div class="vanes-donate-icon">✕</div><p class="eyebrow">AIRTEL MONEY</p><h2>Payment not completed</h2>'+
 '<p>The Airtel request was not approved, so nothing was charged. You can try again, or send the 3,500 TZS yourself using the number below.</p>'+
 '<button type="button" class="primary-button" id="vanesDonateRetry">Try again →</button>'+
 '<p class="vanes-donate-note vanes-donate-manual">Manual Airtel Money number: <strong>'+esc(manualNumber)+'</strong></p>');
 modal.querySelector('#vanesDonateRetry').addEventListener('click',form);
}

async function success(code,fromShot){
 state.done=true;stopPoll();track('donate_airtel_success',{reference:state.ref,code});
 view('<div class="vanes-donate-icon">✓</div><p class="eyebrow">'+(fromShot?'PAYMENT VERIFIED · RECORDED':'PAYMENT CONFIRMED')+'</p><h2>VANES Premium unlocked</h2>'+
 '<p>'+(fromShot?'Your Airtel Money receipt was verified and the payment is saved in the VANES database. Your OB Tech-Labs upgrade code:':'Thank you for supporting VANES AI. Your OB Tech-Labs counter upgrade code:')+'</p>'+
 '<div class="vanes-donate-number"><span>Upgrade code</span><strong>'+esc(code)+'</strong><small>Auto-applied to this account</small></div>'+
 '<p class="vanes-donate-note" id="vanesDonateNote">'+(fromShot?'Payment recorded in the VANES database. ':'')+'Keep this code safe — if VANES ever asks again after signing out, enter it under Support VANES.</p>'+
 '<button type="button" class="primary-button" id="vanesDonateDone">Continue studying →</button>');
 modal.querySelector('#vanesDonateDone').addEventListener('click',close);
 const result=await window.VANES_ACCOUNT?.applyCode?.(code);
 if(result&&!result.ok){const note=modal.querySelector('#vanesDonateNote');if(note)note.textContent='Keep this code safe — '+(result.error||'enter it again if VANES asks.')}
}

/* The screenshot is downscaled in the browser so the upload stays small on mobile data. */
function downscaleShot(file){
 return new Promise((resolve,reject)=>{
  const url=URL.createObjectURL(file),img=new Image();
  img.onload=()=>{
   URL.revokeObjectURL(url);
   try{
    const scale=Math.min(1,1600/Math.max(img.width||1,img.height||1));
    const w=Math.max(1,Math.round((img.width||1)*scale)),h=Math.max(1,Math.round((img.height||1)*scale));
    const c=document.createElement('canvas');c.width=w;c.height=h;
    const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);
    let data=c.toDataURL('image/jpeg',.85);
    if(data.length>4200000)data=c.toDataURL('image/jpeg',.7);
    resolve(data);
   }catch(err){reject(err)}
  };
  img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('image'))};
  img.src=url;
 });
}
const UPLOAD_LABEL='I have paid — verify my receipt 📷';
async function verifyShot(file){
 if(busy||!file)return;
 const status=modal.querySelector('#vanesDonateShotStatus'),up=modal.querySelector('#vanesDonateUpload'),err=modal.querySelector('#vanesDonateError');
 const say=t=>{if(status)status.textContent=t};
 if(err)err.textContent='';
 if(file.size>20*1024*1024){if(err)err.textContent='That photo is too large — upload the normal screenshot of the Airtel Money message.';return}
 if(!(window.VANES_FB&&window.VANES_FB.ok&&window.VANES_FB.user())){if(err)err.textContent='Sign in to VANES with email or Google first (Account → Sign in) so the verified Premium is saved to your account, then upload the screenshot again.';return}
 busy=true;if(up){up.disabled=true;up.textContent='Checking your payment…'}
 say('Reading your Airtel Money receipt…');
 let data='';
 try{data=await downscaleShot(file)}
 catch(_){busy=false;if(up){up.disabled=false;up.textContent=UPLOAD_LABEL}if(err)err.textContent='VANES could not read that image file. Take a fresh screenshot and try again.';return}
 const token=await idToken();
 let r=null,d={};
 try{r=await fetch(apiBase()+'/api/pay/verify',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({image:data})});d=await r.json().catch(()=>({}))}
 catch(_){d={error:'Could not reach VANES. Check your connection and try again.'}}
 busy=false;if(up){up.disabled=false;up.textContent=UPLOAD_LABEL}
 if(r&&r.ok&&d.ok&&d.code){track('donate_shot_verified',{transaction:d.transactionId||'',amount:d.amount||''});success(String(d.code),true);return}
 track('donate_shot_rejected',{code:d.code||'',reason:String(d.error||'').slice(0,80)});
 say('');
 if(err)err.textContent=String(d.error||'That screenshot could not be verified. Upload the receipt again, or type the code OB Tech-Labs sent you.');
}
function manual(reason){
 stopPoll();state.ref='';state.done=false;
 track('donate_airtel_manual',{reason:reason||'manual'});
 view('<div class="vanes-donate-icon">♥</div><p class="eyebrow">SUPPORT VANES AI</p><h2 id="vanesDonateTitle">Donate 3,500 TZS</h2>'+
 '<p>Send <strong>3,500 TZS</strong> with Airtel Money to <strong>'+esc(manualName)+'</strong> on the OB Tech-Labs number below — then upload the payment screenshot and VANES verifies it and opens Premium automatically.</p>'+
 '<div class="vanes-donate-number"><span>Airtel Money · '+esc(manualName)+'</span><strong>'+esc(manualNumber)+'</strong><small>Send exactly 3,500 TZS<button type="button" class="vanes-donate-copy" id="vanesDonateCopy">Copy</button></small></div>'+
 '<button type="button" class="primary-button" id="vanesDonatePay">Pay 3,500 TZS with Airtel Money →</button>'+
 '<p class="vanes-donate-note">Tap Pay, dial <strong>'+USSD+'</strong> → Send Money → <strong>'+esc(manualNumber)+'</strong> → 3,500 TZS.</p>'+
 '<button type="button" class="secondary-button" id="vanesDonateUpload" style="margin-top:12px">'+UPLOAD_LABEL+'</button>'+
 '<input id="vanesDonateFile" type="file" accept="image/*" hidden>'+
 '<p class="vanes-donate-note" id="vanesDonateShotStatus">Upload the Airtel Money receipt screenshot — VANES reads it, records the payment on the database and unlocks Premium on this account.</p>'+
 '<p class="vanes-donate-note" style="margin-top:14px">Already have an upgrade code from OB Tech-Labs? Type it here:</p>'+
 '<div class="vanes-donate-code"><input id="vanesDonateCodeInput" maxlength="40" placeholder="VANES-PRO-0001ABCD"><button type="button" class="secondary-button" id="vanesDonateCodeApply">Unlock</button></div>'+
 '<p class="vanes-donate-note" id="vanesDonateError"></p>');
 modal.querySelector('#vanesDonateCopy').addEventListener('click',copyManual);
 modal.querySelector('#vanesDonatePay').addEventListener('click',()=>{track('donate_pay_dial',{ussd:USSD});location.href='tel:'+encodeURIComponent(USSD)});
 modal.querySelector('#vanesDonateUpload').addEventListener('click',()=>modal.querySelector('#vanesDonateFile').click());
 modal.querySelector('#vanesDonateFile').addEventListener('change',e=>{const f=e.target.files&&e.target.files[0];e.target.value='';if(f)verifyShot(f)});
 modal.querySelector('#vanesDonateCodeApply').addEventListener('click',async()=>{
  const input=modal.querySelector('#vanesDonateCodeInput'),err=modal.querySelector('#vanesDonateError');
  const code=String(input?.value||'').trim().toUpperCase();
  if(!code){if(err)err.textContent='Enter the upgrade code you received.';return}
  if(err)err.textContent='Checking your code…';
  const result=await window.VANES_ACCOUNT?.applyCode?.(code);
  if(result?.ok)success(code);
  else if(err)err.textContent=result?.error||'That code did not work.';
 });
}

function open(opts){
 const m=ensureModal();m.hidden=false;
 track('donate_to_vanes_opened',{method:'Airtel Money',source:opts?.source||''});
 if(state.ref&&!state.done){waiting();return}
 form();
}
function close(){stopPoll();const m=document.getElementById('vanesDonateModal');if(m)m.hidden=true}
document.addEventListener('click',function(e){const trigger=e.target.closest?.('[data-donate-vanes]');if(trigger){e.preventDefault();open()}});
document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
function boot(){const sidebar=document.querySelector('.sidebar-bottom');if(sidebar&&!document.querySelector('[data-donate-vanes]')){const b=document.createElement('button');b.type='button';b.className='theme-button';b.setAttribute('data-donate-vanes','1');b.innerHTML='♥ <span>Donate to VANES</span>';sidebar.insertBefore(b,sidebar.querySelector('.profile'))}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.VANES_DONATE={open:open,close:close,amount:AMOUNT};
})();
