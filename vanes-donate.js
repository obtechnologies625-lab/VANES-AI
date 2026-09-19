/* VANES AI — donation support */
(function(){
'use strict';
const NUMBER='+255688346613';
const ANALYTICS='/api/analytics';
function anonymousId(){try{let id=localStorage.getItem('vanes-anonymous-id-v1');if(!id){id=(crypto.randomUUID?crypto.randomUUID():'vanes-'+Date.now()+'-'+Math.random().toString(36).slice(2));localStorage.setItem('vanes-anonymous-id-v1',id)}return id}catch(_){return 'vanes-session-'+Date.now()}}
function userName(){try{const p=JSON.parse(localStorage.getItem('vanes-learner-profile-v1')||'null');return String(p?.name||localStorage.getItem('vanes-user-name')||'').trim().slice(0,120)}catch(_){return ''}}
function track(event,payload){const data={event,anonymousId:anonymousId(),userName:userName(),payload:{...(payload||{})}};try{const key='vanes-local-activity-v1',items=JSON.parse(localStorage.getItem(key)||'[]');items.unshift({event,...data.payload,at:new Date().toISOString()});localStorage.setItem(key,JSON.stringify(items.slice(0,50)))}catch(_){}try{fetch(ANALYTICS,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),keepalive:true}).catch(()=>{})}catch(_){}}
function open(){
 let modal=document.getElementById('vanesDonateModal');
 if(!modal){
  modal=document.createElement('div');modal.id='vanesDonateModal';
  modal.innerHTML='<div class="vanes-donate-backdrop" data-donate-close></div><div class="vanes-donate-card" role="dialog" aria-modal="true" aria-labelledby="vanesDonateTitle"><button class="vanes-donate-close" type="button" data-donate-close aria-label="Close">×</button><div class="vanes-donate-icon">♥</div><p class="eyebrow">SUPPORT VANES AI</p><h2 id="vanesDonateTitle">Donate to VANES</h2><p>Your support helps OB Technologies Lab keep VANES AI available and improve its learning tools for students.</p><div class="vanes-donate-number"><span>Airtel Money</span><strong>'+NUMBER+'</strong></div><button type="button" class="primary-button" id="vanesCopyDonate">Copy number →</button><p class="vanes-donate-note">Open Airtel Money on your phone and send your chosen amount to this number.</p></div>';
  document.body.appendChild(modal);
  const style=document.createElement('style');style.textContent='#vanesDonateModal{position:fixed;inset:0;z-index:99999;display:grid;place-items:center}.vanes-donate-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.72);backdrop-filter:blur(6px)}.vanes-donate-card{position:relative;width:min(430px,calc(100% - 32px));padding:30px;border:1px solid rgba(255,255,255,.14);border-radius:24px;background:#101522;color:#fff;box-shadow:0 24px 80px rgba(0,0,0,.55);text-align:center}.vanes-donate-icon{font-size:34px;margin-bottom:8px}.vanes-donate-card h2{margin:4px 0 10px}.vanes-donate-card p{line-height:1.6;color:#c9d0dd}.vanes-donate-number{margin:22px 0;padding:18px;border-radius:16px;background:rgba(255,255,255,.07);display:flex;flex-direction:column;gap:5px}.vanes-donate-number span{font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#aeb8ca}.vanes-donate-number strong{font-size:24px;letter-spacing:.04em}.vanes-donate-close{position:absolute;right:14px;top:10px;border:0;background:transparent;color:#fff;font-size:28px;cursor:pointer}.vanes-donate-note{font-size:12px!important;margin-bottom:0}.vanes-donate-card .primary-button{width:100%;justify-content:center}';
  document.head.appendChild(style);
  modal.querySelectorAll('[data-donate-close]').forEach(el=>el.addEventListener('click',close));
  modal.querySelector('#vanesCopyDonate').addEventListener('click',async function(){track('donate_to_vanes_copy',{method:'Airtel Money',destination:'Airtel Money number'});try{await navigator.clipboard.writeText(NUMBER);this.textContent='Copied ✓';setTimeout(()=>this.textContent='Copy number →',1800)}catch(_){this.textContent=NUMBER}});
 }
 modal.hidden=false;track('donate_to_vanes_opened',{method:'Airtel Money'});
}
function close(){const m=document.getElementById('vanesDonateModal');if(m)m.hidden=true}
document.addEventListener('click',function(e){const trigger=e.target.closest?.('[data-donate-vanes]');if(trigger){e.preventDefault();open()}});
document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
function boot(){const sidebar=document.querySelector('.sidebar-bottom');if(sidebar&&!document.querySelector('[data-donate-vanes]')){const b=document.createElement('button');b.type='button';b.className='theme-button';b.setAttribute('data-donate-vanes','1');b.innerHTML='♥ <span>Donate to VANES</span>';sidebar.insertBefore(b,sidebar.querySelector('.profile'))}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();