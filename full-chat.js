/* VANES AI — focused ChatGPT-style cyberpunk chat client. */
(function(){
'use strict';
const API='https://vanes-ai.obtechnologies625.workers.dev/api/chat';
const MAX_IMAGE=8*1024*1024, MAX_HISTORY=40;
function boot(){
 const panel=document.querySelector('#coach .chat-panel'),messages=document.querySelector('#messages'),form=document.querySelector('#chatForm'),input=document.querySelector('#chatInput'),upload=document.querySelector('#uploadButton');
 if(!panel||!messages||!form||!input||panel.dataset.vanesCleanChat==='1')return;
 panel.dataset.vanesCleanChat='1';
 let history=readJSON('vanes-chat-clean-v1',[]);if(!Array.isArray(history))history=[];history=history.slice(-MAX_HISTORY);
 let imageData='',busy=false,aborter=null;
 function readJSON(k,f){try{const v=JSON.parse(localStorage.getItem(k)||'');return v??f}catch(_){return f}}
 function save(){try{localStorage.setItem('vanes-chat-clean-v1',JSON.stringify(history.slice(-MAX_HISTORY)))}catch(_){}}
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
 function render(){
  if(!history.length){messages.innerHTML='<div class="message coach-message"><span>✦</span><div class="vanes-bubble"><div class="vanes-content"><p><strong>Hi! I’m VANES AI.</strong><br>Ask me anything you are studying.</p><div class="vanes-welcome-tags"><span>Explain a topic</span><span>Solve a problem</span><span>Analyse an image</span><span>Revise for NECTA</span></div></div></div></div>';return}
  messages.innerHTML=history.map((m,i)=>{
   if(m.role==='user')return '<div class="message user-message"><div class="vanes-bubble"><div class="vanes-content">'+md(m.text)+'</div></div></div>';
   return '<div class="message coach-message"><span>✦</span><div class="vanes-bubble"><div class="vanes-content">'+(m.pending?'<div class="vanes-typing"><i></i><i></i><i></i><span>VANES is thinking</span></div>':md(m.text))+'</div>'+(m.pending?'':'<div class="vanes-actions"><button type="button" data-copy="'+i+'">Copy</button><button type="button" data-regenerate="'+i+'">Regenerate</button></div>')+'</div></div>';
  }).join('');
  messages.scrollTop=messages.scrollHeight;
 }
 async function ask(payload){
  aborter=new AbortController();const timer=setTimeout(()=>aborter.abort(),90000);
  try{
   const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(payload),signal:aborter.signal});
   const raw=await r.text();let data=null;try{data=raw?JSON.parse(raw):null}catch(_){}
   if(!r.ok)throw new Error(String(data?.error||data?.detail||raw||('AI service returned HTTP '+r.status)).slice(0,800));
   const text=data?.choices?.[0]?.message?.content??data?.choices?.[0]?.text??data?.output_text??'';
   if(typeof text!=='string'||!text.trim())throw new Error('The AI service returned no answer text.');
   return text.trim();
  }finally{clearTimeout(timer);aborter=null}
 }
 async function send(){
  if(busy)return;const question=input.value.trim();if(!question&&!imageData)return;
  busy=true;input.disabled=true;status('VANES is thinking…');history.push({role:'user',text:question||'Please analyse this study image.'});const pending={role:'assistant',text:'',pending:true};history.push(pending);save();render();
  const msgs=history.filter(m=>m.role==='user').slice(-12).map(m=>({role:'user',content:m.text}));
  if(imageData)msgs[msgs.length-1].content=[{type:'text',text:question||'Analyse this study image carefully and explain what you find.'},{type:'image_url',image_url:{url:imageData}}];
  try{
   pending.text=await ask({model:'gemini-2.5-flash',messages:[{role:'system',content:systemPrompt()},...msgs],max_tokens:1400});
   pending.pending=false;input.value='';imageData='';const p=document.querySelector('#imagePreview');if(p){p.hidden=true;p.innerHTML=''}save();render();status('Ready');
  }catch(e){pending.pending=false;pending.text='I could not complete that response. '+(e.name==='AbortError'?'The request timed out.':(e.message||'Please try again.'));save();render();status('Ready')}
  finally{busy=false;input.disabled=false;input.focus()}
 }
 function showImage(file){if(!file)return;if(file.size>MAX_IMAGE){alert('Please choose an image smaller than 8 MB.');return}const r=new FileReader();r.onload=()=>{imageData=String(r.result||'');const p=document.querySelector('#imagePreview');if(p){p.hidden=false;p.innerHTML='<img src="'+esc(imageData)+'" alt="Study image preview"><span>Image attached — send when ready.</span>'}};r.readAsDataURL(file)}
 let fileInput=document.querySelector('#vanesChatFile');if(!fileInput){fileInput=document.createElement('input');fileInput.type='file';fileInput.accept='image/*';fileInput.id='vanesChatFile';fileInput.hidden=true;panel.appendChild(fileInput)}
 upload?.addEventListener('click',()=>fileInput.click());fileInput.addEventListener('change',()=>showImage(fileInput.files?.[0]));
 messages.addEventListener('click',e=>{
  const copy=e.target.closest?.('[data-copy]'),regen=e.target.closest?.('[data-regenerate]');
  if(copy){const m=history[Number(copy.dataset.copy)];if(m?.text)navigator.clipboard?.writeText(m.text).then(()=>status('Copied'))}
  if(regen&&!busy){const i=Number(regen.dataset.regenerate),m=history[i],u=history.slice(0,i).reverse().find(x=>x.role==='user');if(m?.role==='assistant'&&u){history.splice(i,1);save();render();input.value=u.text;send()}}
 });
 form.addEventListener('submit',e=>{e.preventDefault();send()});
 input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();form.requestSubmit()}});
 render();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();