/* VANES AI — final Send/action routing fix. Keeps the UI on the same page while routing API actions to the live Worker. */
(function(){
'use strict';
const API='https://vanes-ai.obtechnologies625.workers.dev';
const PLANS_KEY='vanes-saved-study-plans-v1';

// The static app may be opened from GitHub Pages, a local server, or the Worker itself.
// Route VANES API calls to the live backend so Send buttons do not depend on a local /api route.
const originalFetch=window.fetch.bind(window);
window.fetch=function(input,init){
  try{
    const raw=typeof input==='string'?input:input?.url||'';
    if(/^\/api\/(chat|image|contact|analytics)(?:\?|$)/.test(raw)){
      const target=API+raw;
      if(typeof input==='string') return originalFetch(target,init);
      return originalFetch(new Request(target,input));
    }
  }catch(_){/* fall through to normal fetch */}
  return originalFetch(input,init);
};
window.VANES_CHAT_ENDPOINT=API+'/api/chat';
window.VANES_IMAGE_ENDPOINT=API+'/api/image';
window.VANES_CONTACT_ENDPOINT=API+'/api/contact';
window.VANES_ANALYTICS_ENDPOINT=API+'/api/analytics';

function planSubmit(e){
  const form=e.target.closest?.('#planForm');
  if(!form)return;
  e.preventDefault();
  e.stopImmediatePropagation();
  const result=document.querySelector('#planResult');
  const data=new FormData(form);
  const raw=String(data.get('subject')||'').trim();
  if(!raw){form.querySelector('[name="subject"]')?.focus();return;}
  const goal=String(data.get('goal')||'Study');
  const minutes=Number(data.get('time')||45);
  const title=raw.split(/\s+[—–-]\s+/)[0].trim()||raw;
  const steps=[
    `5 min — Recall what you already know about ${title}.`,
    `${Math.max(10,Math.round(minutes*0.45))} min — Learn and understand the key ideas.`,
    `${Math.max(5,Math.round(minutes*0.30))} min — Practise with questions or worked examples.`,
    `${Math.max(5,minutes-Math.max(10,Math.round(minutes*0.45))-Math.max(5,Math.round(minutes*0.30))-5)} min — Review mistakes and self-test.`
  ];
  if(result){
    result.innerHTML=`<div class="empty-illustration">✦</div><h2>${escapeHtml(title)} study plan</h2><p><strong>Goal:</strong> ${escapeHtml(goal)} · <strong>Time:</strong> ${minutes} minutes</p><ol>${steps.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ol><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="primary-button" type="button" id="startGeneratedPlan">Start this session →</button><button class="secondary-button" type="button" id="saveGeneratedPlan">Save this study plan</button></div>`;
    result.querySelector('#saveGeneratedPlan').onclick=()=>{
      let plans=[];try{plans=JSON.parse(localStorage.getItem(PLANS_KEY)||'[]')}catch(_){plans=[]}
      plans.unshift({id:crypto.randomUUID?.()||String(Date.now()),subject:raw,goal,time:minutes,createdAt:new Date().toISOString()});
      localStorage.setItem(PLANS_KEY,JSON.stringify(plans.slice(0,50)));
      result.querySelector('#saveGeneratedPlan').textContent='✓ Saved';
    };
    result.querySelector('#startGeneratedPlan').onclick=()=>{
      const topicMap=document.querySelector('#topicMap');
      const workspace=document.querySelector('#workspace');
      if(workspace&&topicMap){
        document.querySelector('#workspaceLabel').textContent=`${title.toUpperCase()} · O-Level`;
        document.querySelector('#workspaceTitle').textContent=title;
        document.querySelector('#workspaceDescription').textContent=`${raw} · ${goal}`;
        document.querySelector('#sessionTitle').textContent=`Start with ${title}`;
        topicMap.innerHTML=['Recall','Learn the core idea','Practice questions','Review and self-test'].map(x=>`<button class="topic-chip" type="button">${x}</button>`).join('');
        topicMap.querySelectorAll('.topic-chip').forEach(b=>b.onclick=()=>b.classList.toggle('active'));
        workspace.dataset.sessionStarted=Date.now();
        window.VANES_SWITCH_VIEW?.('workspace');
      }
    };
  }
}
function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

// Capture the actual form submission; the previous planner fix listened for a button id
// that the HTML did not have, so clicking "Create my plan" did nothing.
document.addEventListener('submit',planSubmit,true);

// Make ordinary action buttons keyboard/click friendly without changing their existing handlers.
document.addEventListener('click',function(e){
  const b=e.target.closest?.('#uploadButton,#generateButton,#settingsNotifyButton,#donateButton,#familyButton,#fieldButton,#feedbackButton,#saveAiSettings,#settingsEditProfile,#settingsOpenProfile,#settingsOpenNotifications,#clearLocalData');
  if(b) b.setAttribute('data-vanes-action-ready','true');
},true);
})();