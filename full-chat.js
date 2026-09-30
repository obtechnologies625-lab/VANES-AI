/* VANES AI — focused ChatGPT-style cyberpunk chat client. */
(function(){
'use strict';
const API='https://vanes-ai.obtechnologies625.workers.dev/api/chat',IMAGE_API='https://vanes-ai.obtechnologies625.workers.dev/api/image';
const MAX_IMAGE=8*1024*1024, MAX_HISTORY=40, MAX_CONVOS=30, MAX_QUESTIONS=6,
 CONVOS_KEY='vanes-chat-conversations-v1', ACTIVE_KEY='vanes-chat-active-v1', LEGACY_KEY='vanes-chat-clean-v1';
function boot(){
 const panel=document.querySelector('#coach .chat-panel'),messages=document.querySelector('#messages'),form=document.querySelector('#chatForm'),input=document.querySelector('#chatInput'),upload=document.querySelector('#uploadButton'),generate=document.querySelector('#generateButton');
 if(!panel||!messages||!form||!input||panel.dataset.vanesCleanChat==='1')return;
 panel.dataset.vanesCleanChat='1';
 let convos=[],activeId=null,history=[];
 let imageData='',busy=false,aborter=null;
 let listEl=null,titleEl=null,countEl=null,queueEl=null,contextEl=null;
 function grow(){input.style.height='auto';input.style.height=Math.min(150,Math.max(48,input.scrollHeight))+'px'}
 function readJSON(k,f){try{const v=JSON.parse(localStorage.getItem(k)||'');return v??f}catch(_){return f}}
 function uid(){return crypto.randomUUID?.()||('c'+Date.now().toString(36)+Math.random().toString(36).slice(2,6))}
 function clean(msgs){return (Array.isArray(msgs)?msgs:[]).filter(m=>m&&(m.role==='user'||m.role==='assistant')&&!m.pending).slice(-MAX_HISTORY)}
 function titleFor(msgs){const first=msgs.find(m=>m.role==='user'&&typeof m.text==='string'&&m.text.trim());return first?first.text.replace(/\s+/g,' ').trim().slice(0,42):'New chat'}
 function persist(){const c=convos.find(x=>x.id===activeId);if(!c)return;c.messages=history.slice(-MAX_HISTORY);c.title=titleFor(c.messages);c.updatedAt=Date.now();convos.sort((a,b)=>b.updatedAt-a.updatedAt);convos=convos.slice(0,MAX_CONVOS);try{localStorage.setItem(CONVOS_KEY,JSON.stringify(convos));localStorage.setItem(ACTIVE_KEY,activeId)}catch(_){/* Generated images are inline data URLs, so the store can hit its quota; keep the newest conversations rather than losing them all. */try{convos=convos.slice(0,5);localStorage.setItem(CONVOS_KEY,JSON.stringify(convos))}catch(_){}}}
 function save(){persist();renderConvos()}
 function newChat(){const c={id:uid(),title:'New chat',updatedAt:Date.now(),messages:[]};convos.unshift(c);activeId=c.id;history=c.messages;persist();renderConvos();render()}
 function select(id){const c=convos.find(x=>x.id===id);if(!c)return;activeId=id;history=c.messages;try{localStorage.setItem(ACTIVE_KEY,id)}catch(_){}renderConvos();render()}
 function remove(id){const i=convos.findIndex(x=>x.id===id);if(i<0)return;convos.splice(i,1);try{localStorage.setItem(CONVOS_KEY,JSON.stringify(convos))}catch(_){}if(activeId===id){activeId=null;convos.length?select(convos[0].id):newChat()}else renderConvos()}
 function loadConvos(){
  convos=readJSON(CONVOS_KEY,[]).filter(c=>c&&c.id).map(c=>({id:String(c.id),title:String(c.title||'New chat'),updatedAt:Number(c.updatedAt)||0,messages:clean(c.messages)}));
  if(!convos.length){const legacy=clean(readJSON(LEGACY_KEY,[]));if(legacy.length)convos=[{id:uid(),title:titleFor(legacy),updatedAt:Date.now(),messages:legacy}]}
  localStorage.removeItem(LEGACY_KEY);
  activeId=localStorage.getItem(ACTIVE_KEY)||'';
  if(!convos.some(c=>c.id===activeId))activeId=convos[0]?.id||null;
  if(activeId)select(activeId);else newChat();
  persist();renderConvos();
 }
 function ago(ts){const s=Math.max(0,Math.floor((Date.now()-Number(ts||0))/1000));if(s<60)return 'just now';const m=Math.floor(s/60);if(m<60)return m+'m ago';const h=Math.floor(m/60);if(h<24)return h+'h ago';const d=Math.floor(h/24);return d===1?'yesterday':d+'d ago'}
 function renderConvos(){
  if(titleEl)titleEl.textContent=convos.find(c=>c.id===activeId)?.title||'New chat';
  if(countEl)countEl.textContent=convos.length?String(convos.length):'';
  if(!listEl)return;
  listEl.innerHTML=convos.length?convos.map(c=>'<div class="vanes-convo'+(c.id===activeId?' active':'')+'" data-convo="'+esc(c.id)+'"><div class="vanes-convo-copy"><strong>'+esc(c.title)+'</strong><small>'+esc(ago(c.updatedAt))+' · '+c.messages.length+' messages</small></div><button type="button" class="vanes-convo-delete" data-delete="'+esc(c.id)+'" aria-label="Delete conversation">✕</button></div>').join(''):'<p class="vanes-convo-empty">No saved conversations yet.</p>';
 }
 function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
 function md(v){
  let s=esc(v);
  s=s.replace(/^### (.*)$/gm,'<h4>$1</h4>').replace(/^## (.*)$/gm,'<h3>$1</h3>').replace(/^# (.*)$/gm,'<h2>$1</h2>');
  s=s.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\*([^*\n]+)\*/g,'<em>$1</em>');
  s=s.replace(/^\s*[-•] (.*)$/gm,'<li>$1</li>').replace(/(<li>.*<\/li>)/gs,'<ul>$1</ul>');
  s=s.replace(/\`([^\`]+)\`/g,'<code>$1</code>');
  return s.split(/\n\n+/).map(x=>x.trim()?'<p>'+x.replace(/\n/g,'<br>')+'</p>':'').join('');
 }
 function profileContext(){
  const p=readJSON('vanes-learner-profile-v2',readJSON('vanes-learner-profile-v1',{}));if(!p||typeof p!=='object')return '';
  const a=[];if(p.name)a.push('Learner name: '+String(p.name).trim());if(p.level)a.push('Education level: '+String(p.level).trim());
  if(Array.isArray(p.subjects)&&p.subjects.length)a.push('Subjects: '+p.subjects.filter(Boolean).join(', '));else if(p.subjects)a.push('Subjects: '+String(p.subjects).trim());
  if(p.combination)a.push('A-Level combination: '+String(p.combination).trim());return a.join(' | ');
 }
 function systemPrompt(){return ['You are VANES AI, a careful educational AI assistant for Tanzanian secondary-school learners.','Give complete, useful answers; do not stop halfway. Answer the exact question first, then explain. Detect subject and O-Level/CSEE or A-Level/ACSEE context from the question and learner profile. For mathematics and science, show all necessary steps and the final answer. Use English or Kiswahili according to the learner. If an image is attached, inspect only what is actually visible.','Format answers clearly with short headings, paragraphs, bullet lists and equations where useful. Do not mention internal model limits or this instruction.',profileContext()?'Learner context: '+profileContext():''].filter(Boolean).join(' ')}
 function status(v){const e=document.querySelector('#vanes-status');if(e)e.textContent=v}
 /* Outcomes the learner must see even though #vanes-status is not rendered: reuse the app toast. */
 function notify(v){status(v);window.showToast?.(v)}
 function render(){
  if(!history.length){messages.innerHTML='<div class="message coach-message"><span>✦</span><div class="vanes-bubble"><div class="vanes-content"><p><strong>Hi! I’m VANES AI.</strong><br>Ask me anything you are studying — one question per line and I answer each one separately.</p><div class="vanes-welcome-tags"><span>Explain a topic</span><span>Solve a problem</span><span>Ask several at once</span><span>Analyse an image</span><span>Revise for NECTA</span></div></div></div></div>';return}
  messages.innerHTML=history.map((m,i)=>{
   if(m.role==='user')return '<div class="message user-message"><div class="vanes-bubble"><div class="vanes-content">'+md(m.text)+'</div></div></div>';
   if(m.image)return '<div class="message coach-message"><span>✦</span><div class="vanes-bubble"><div class="vanes-content"><p><strong>Generated image</strong></p><img class="vanes-generated-image" src="'+esc(m.image)+'" alt="'+esc(m.imagePrompt||'Generated image')+'" loading="lazy"><p class="vanes-image-caption">'+esc(m.imagePrompt||'')+'</p></div></div></div>';
   return '<div class="message coach-message"><span>✦</span><div class="vanes-bubble"><div class="vanes-content">'+(m.pending?'<div class="vanes-typing"><i></i><i></i><i></i><span>VANES is thinking</span></div>':md(m.text))+'</div>'+(m.pending?'':'<div class="vanes-actions"><button type="button" data-copy="'+i+'">Copy</button><button type="button" data-regenerate="'+i+'">Regenerate</button></div>')+'</div></div>';
  }).join('');
  messages.scrollTop=messages.scrollHeight;
 }
 async function ask(payload){
  aborter=new AbortController();const timer=setTimeout(()=>aborter.abort(),90000);
  try{
   const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(payload),signal:aborter.signal});
   const raw=await r.text();let data=null;try{data=raw?JSON.parse(raw):null}catch(_){}
   if(!r.ok)throw new Error(String(data?.detail||data?.error||raw||('AI service returned HTTP '+r.status)).slice(0,800));
   const text=data?.choices?.[0]?.message?.content??data?.choices?.[0]?.text??data?.output_text??'';
   if(typeof text!=='string'||!text.trim())throw new Error('The AI service returned no answer text.');
   return text.trim();
  }finally{clearTimeout(timer);aborter=null}
 }
 async function generateImage(){if(busy)return;const prompt=input.value.trim();if(!prompt){input.focus();notify('Describe the image first');return}busy=true;input.disabled=true;status('VANES is generating your image…');history.push({role:'user',text:'Generate an image: '+prompt});const pending={role:'assistant',text:'',pending:true};history.push(pending);save();render();try{const controller=new AbortController();aborter=controller;const timer=setTimeout(()=>controller.abort(),90000);const r=await fetch(IMAGE_API,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({prompt}),signal:controller.signal});clearTimeout(timer);const raw=await r.text();let data=null;try{data=raw?JSON.parse(raw):null}catch(_){}if(!r.ok)throw new Error(String(data?.detail||data?.error||raw||('Image service returned HTTP '+r.status)).slice(0,800));if(!data?.image)throw new Error('The image service returned no image.');history.pop();history.push({role:'assistant',image:data.image,imagePrompt:prompt});input.value='';grow();save();render();notify('Image ready')}catch(e){history.pop();history.push({role:'assistant',text:'I could not generate that image. '+(e.name==='AbortError'?'The request timed out.':(e.message||'Please try again.'))});save();render();status('Ready')}finally{busy=false;input.disabled=false;aborter=null;input.focus()}}
 /* Learners paste whole homework lists at once. Each line becomes its own turn so every
    question gets a full, separate answer instead of one blended reply. */
 const ENUMERATOR=/^\s*(?:(?:q(?:uestion)?\s*)?\d{1,2}\s*[.):\-]|[a-h]\s*[.):]|[-*•‣])\s*/i;
 function stripEnumerator(s){return String(s).replace(ENUMERATOR,'').trim()}
 function splitQuestions(raw){
  const text=String(raw||'').replace(/\r/g,'').trim();
  if(!text)return [];
  let parts;
  const lines=text.split('\n').map(x=>x.trim()).filter(Boolean);
  if(lines.length>1){
   parts=lines.map(l=>({text:stripEnumerator(l)||l,listed:ENUMERATOR.test(l)})).filter(p=>p.text);
  }else{
   const chunks=text.split('?').map(x=>x.trim()).filter(Boolean);
   parts=chunks.length>1&&chunks.every(x=>x.split(/\s+/).length>=3)
    ?chunks.map(x=>({text:/[.!?]$/.test(x)?x:x+'?',listed:false}))
    :[{text:stripEnumerator(text),listed:false}];
  }
  /* "Thanks" or "answer in Kiswahili" is context for the previous question, not its own —
     but a numbered line is always its own question, and so is a short line that follows
     another short line ("Define acid" / "Define base" are two requests, not one). */
  const merged=[];
  parts.forEach((p,idx)=>{
   const prev=merged[merged.length-1];
   const short=p.text.split(/\s+/).length<4,question=/[?]$/.test(p.text);
   const trailing=idx===parts.length-1;
   if(prev&&!p.listed&&!prev.listed&&!question&&short&&(prev.text.split(/\s+/).length>=4||trailing))prev.text+=' '+p.text;
   else merged.push({text:p.text,listed:p.listed});
  });
  return merged.map(m=>m.text).filter(Boolean);
 }
 function ensureQueue(){if(queueEl)return queueEl;queueEl=document.createElement('div');queueEl.className='vanes-ask-queue';queueEl.hidden=true;panel.insertBefore(queueEl,form);return queueEl}
 function showQueue(list){const q=ensureQueue();q.hidden=false;q.innerHTML='<span class="vanes-queue-label"></span>'+list.map((x,i)=>'<span class="vanes-queue-chip" data-q="'+i+'" data-state="waiting"><b>'+(i+1)+'</b>'+esc(x.length>38?x.slice(0,38)+'…':x)+'</span>').join('')}
 function markQueue(i,state){if(!queueEl)return;const chip=queueEl.querySelector('[data-q="'+i+'"]');if(chip)chip.dataset.state=state;const label=queueEl.querySelector('.vanes-queue-label');if(label)label.textContent='Answering question '+(i+1)+' of '+queueEl.querySelectorAll('.vanes-queue-chip').length+' separately'}
 function hideQueue(){if(!queueEl)return;queueEl.hidden=true;queueEl.innerHTML=''}
 async function askTurn(text,useImage){
  history.push({role:'user',text:text||'Please analyse this study image.'});
  const pending={role:'assistant',text:'',pending:true};history.push(pending);save();render();
  const msgs=history.filter(m=>(m.role==='user'||m.role==='assistant')&&typeof m.text==='string'&&m.text.trim()&&!m.pending).slice(-12).map(m=>({role:m.role,content:m.text}));
  if(useImage&&imageData&&msgs.length)msgs[msgs.length-1].content=[{type:'text',text:text||'Analyse this study image carefully and explain what you find.'},{type:'image_url',image_url:{url:imageData}}];
  try{
   pending.text=await ask({model:'codestral-latest',messages:[{role:'system',content:systemPrompt()},...msgs],max_tokens:1400});
   pending.pending=false;
   if(useImage){imageData='';const p=document.querySelector('#imagePreview');if(p){p.hidden=true;p.innerHTML=''}}
   save();render();return true;
  }catch(e){
   pending.pending=false;pending.text='I could not complete that response. '+(e.name==='AbortError'?'The request timed out.':(e.message||'Please try again.'));save();render();return false;
  }
 }
 async function send(){
  if(busy)return;
  const all=splitQuestions(input.value),questions=all.slice(0,MAX_QUESTIONS),dropped=all.length-questions.length;
  if(!questions.length&&!imageData){notify('Type a question first');input.focus();return}
  busy=true;input.disabled=true;input.value='';grow();
  const withImage=Boolean(imageData);
  if(questions.length>1)showQueue(questions);
  try{
   for(let i=0;i<questions.length;i++){
    if(questions.length>1){markQueue(i,'asking');status('Answering question '+(i+1)+' of '+questions.length+'…')}
    else status('VANES is thinking…');
    const ok=await askTurn(questions[i],withImage&&i===0);
    if(questions.length>1)markQueue(i,ok?'done':'failed');
   }
   if(!questions.length&&withImage)await askTurn('',true);
   if(dropped>0)notify('Answered the first '+MAX_QUESTIONS+' questions · '+dropped+' left out');else status('Ready');
  }finally{busy=false;input.disabled=false;hideQueue();input.focus()}
 }
 function showImage(file){if(!file)return;if(file.size>MAX_IMAGE){alert('Please choose an image smaller than 8 MB.');return}const r=new FileReader();r.onload=()=>{imageData=String(r.result||'');const p=document.querySelector('#imagePreview');if(p){p.hidden=false;p.innerHTML='<img src="'+esc(imageData)+'" alt="Study image preview"><span>Image attached — send when ready.</span>'}};r.readAsDataURL(file)}
 const bar=document.createElement('div');bar.className='vanes-chat-bar vanes-ask-head';
 bar.innerHTML='<div class="vanes-ask-id"><span class="vanes-ask-icon" aria-hidden="true">✦</span><div class="vanes-ask-copy"><strong>Ask VANES</strong><small><span class="vanes-chat-title" id="vanesChatTitle"></span> <span class="vanes-ask-dot" aria-hidden="true">·</span> <span id="vanesAskContext"></span></small></div></div><div class="vanes-ask-actions"><button type="button" class="vanes-chat-btn" id="vanesNewChat" title="Start a new conversation">＋ New</button><button type="button" class="vanes-chat-btn" id="vanesHistoryToggle" aria-expanded="false" aria-controls="vanesConvoList" title="Your saved conversations">☰ History <span id="vanesConvoCount" class="vanes-convo-count"></span></button><button type="button" class="vanes-chat-btn vanes-clear-btn" id="vanesClearChat" title="Clear this conversation">⌫ Clear</button></div>';
 panel.insertBefore(bar,messages);
 listEl=document.createElement('div');listEl.className='vanes-convo-list';listEl.id='vanesConvoList';listEl.hidden=true;
 panel.insertBefore(listEl,messages);
 titleEl=bar.querySelector('#vanesChatTitle');countEl=bar.querySelector('#vanesConvoCount');contextEl=bar.querySelector('#vanesAskContext');
 const toggle=bar.querySelector('#vanesHistoryToggle');
 const clearBtn=bar.querySelector('#vanesClearChat');
 let clearArmed=false,clearTimer=null;
 function disarmClear(){clearArmed=false;clearTimeout(clearTimer);clearTimer=null;clearBtn.classList.remove('armed');clearBtn.textContent='⌫ Clear'}
 clearBtn.addEventListener('click',()=>{
  if(busy){notify('Wait for the current answer to finish');return}
  if(!history.length&&!input.value.trim()&&!imageData){notify('Nothing to clear');return}
  if(!clearArmed){clearArmed=true;clearBtn.classList.add('armed');clearBtn.textContent='⌫ Tap again to clear';clearTimer=setTimeout(disarmClear,3500);return}
  disarmClear();
  history.length=0;imageData='';input.value='';grow();
  const p=document.querySelector('#imagePreview');if(p){p.hidden=true;p.innerHTML=''}
  save();render();notify('Conversation cleared');input.focus();
 });
 bar.querySelector('#vanesNewChat').addEventListener('click',()=>{if(busy)return;newChat();listEl.hidden=true;toggle.setAttribute('aria-expanded','false');input.focus()});
 toggle.addEventListener('click',()=>{listEl.hidden=!listEl.hidden;toggle.setAttribute('aria-expanded',String(!listEl.hidden))});
 listEl.addEventListener('click',e=>{
  const del=e.target.closest?.('[data-delete]');
  if(del){remove(del.dataset.delete);if(!convos.length)listEl.hidden=true;return}
  const item=e.target.closest?.('[data-convo]');
  if(item&&item.dataset.convo!==activeId&&!busy){select(item.dataset.convo);listEl.hidden=true;toggle.setAttribute('aria-expanded','false');input.focus()}
 });
 let fileInput=document.querySelector('#vanesChatFile');if(!fileInput){fileInput=document.createElement('input');fileInput.type='file';fileInput.accept='image/*';fileInput.id='vanesChatFile';fileInput.hidden=true;panel.appendChild(fileInput)}
 upload?.addEventListener('click',()=>fileInput.click());fileInput.addEventListener('change',()=>showImage(fileInput.files?.[0]));generate?.addEventListener('click',generateImage);
 messages.addEventListener('click',e=>{
  const copy=e.target.closest?.('[data-copy]'),regen=e.target.closest?.('[data-regenerate]');
  if(copy){const m=history[Number(copy.dataset.copy)];if(m?.text)navigator.clipboard?.writeText(m.text).then(()=>notify('Copied'))}
  if(regen&&!busy){const i=Number(regen.dataset.regenerate),m=history[i],u=history.slice(0,i).reverse().find(x=>x.role==='user');if(m?.role==='assistant'&&u){history.splice(i,1);save();render();input.value=u.text;send()}}
 });
 form.addEventListener('submit',e=>{e.preventDefault();send()});
 input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();form.requestSubmit()}});
 input.addEventListener('input',grow);
 function refreshContext(){
  if(!contextEl)return;
  const p=readJSON('vanes-learner-profile-v2',readJSON('vanes-learner-profile-v1',null));
  if(!p||!p.level){contextEl.textContent='Tanzanian curriculum coach';return}
  const subs=Array.isArray(p.subjects)?p.subjects.filter(Boolean):[];
  contextEl.textContent=p.level+(p.combination?' · '+p.combination:'')+(subs.length?' · '+subs.slice(0,3).join(', ')+(subs.length>3?' +'+(subs.length-3):''):'');
 }
 window.addEventListener('storage',refreshContext);
 window.addEventListener('hashchange',refreshContext);
 window.addEventListener('vanes:profile-saved',refreshContext);
 loadConvos();refreshContext();grow();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();