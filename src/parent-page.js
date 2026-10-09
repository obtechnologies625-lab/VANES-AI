/* Parent progress page, rendered by the Worker so a parent only needs a browser and the
   8-character code — no install, no sign-in. The code is the secret; this page just reads
   /api/parent/view and draws a per-subject histogram of the last two weeks. */

export function parentPage(){return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#02040c">
<title>VANES AI · Parent progress</title>
<style>
:root{color-scheme:dark}
*{box-sizing:border-box}
body{font-family:'Segoe UI',Arial,sans-serif;background:radial-gradient(circle at 20% 0%,#0b1c38,#02040c 70%);color:#eef8ff;margin:0;padding:16px;min-height:100vh}
main{max-width:780px;margin:auto;padding-bottom:40px}
.brand{display:flex;align-items:center;gap:10px;margin:8px 0 4px}
.brand img{height:30px}
h1{font-size:21px;margin:0}
.sub{color:#8fb0c8;font-size:12.5px;margin:5px 0 0;line-height:1.5}
.card{background:linear-gradient(150deg,#0a1a2c,#071019);border:1px solid #17405e;border-radius:16px;padding:16px;margin:12px 0}
.card h2{margin:0 0 4px;font-size:15px}
.card p{margin:4px 0;color:#a9c4d8;font-size:12.5px;line-height:1.55}
.row{display:flex;gap:8px;flex-wrap:wrap}
input,button{font:inherit}
input{flex:1;min-width:150px;padding:12px;border:1px solid #285776;border-radius:10px;background:#f7fbff;color:#111;text-transform:uppercase;letter-spacing:2px}
button{padding:12px 16px;border:0;border-radius:10px;background:linear-gradient(135deg,#0a84ff,#7b3cff);color:#fff;font-weight:800;cursor:pointer}
button.ghost{background:#0b1d30;border:1px solid #285776;color:#a9f3ff;font-weight:700}
button.metric{border:1px solid #285776;border-radius:999px;background:#0b1d30;color:#9fdff0;padding:8px 12px;font-size:12px;font-weight:700}
button.metric.on{border-color:#00cfff;color:#eafcff;background:#0d2a44}
.error{color:#ff9eb5}
.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:9px;margin-top:10px}
.stat{background:#081827;border:1px solid #1b5276;border-radius:12px;padding:11px}
.stat strong{display:block;font-size:19px;color:#eafcff}
.stat span{font-size:10.5px;color:#8eb0c5;letter-spacing:.4px;text-transform:uppercase}
.chips{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0 2px}
.chip{border:1px solid #24506e;border-radius:999px;background:#0b1d30;color:#9fdff0;padding:8px 13px;font-size:12.5px;font-weight:700;cursor:pointer}
.chip.on{border-color:#00cfff;color:#eafcff;background:#0d2a44;box-shadow:0 0 18px rgba(0,207,255,.18)}
.hist{display:flex;align-items:flex-end;gap:4px;height:190px;padding:12px 6px 0;border-bottom:2px solid #24506e;margin-top:14px}
.bar{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:4px;height:100%}
.bar i{display:block;width:100%;max-width:30px;border-radius:6px 6px 2px 2px;background:linear-gradient(180deg,#00d5ff,#0a6cff);min-height:2px;transition:height .35s ease}
.bar i.zero{background:#12314a}
.bar em{font-size:9.5px;color:#7ea6c4;font-style:normal;white-space:nowrap}
.bar b{font-size:9.5px;color:#cfe6f4;font-weight:700}
.legend{display:flex;justify-content:space-between;color:#7ea6c4;font-size:10.5px;margin-top:7px}
.empty{padding:26px 12px;text-align:center;color:#8fb0c8;font-size:13px;line-height:1.6}
.foot{color:#5d7a93;font-size:10.5px;text-align:center;margin-top:18px;line-height:1.6}
@media(max-width:520px){.hist{height:150px}.bar em{display:none}.bar b{font-size:8.5px}}
</style>
</head><body><main>
<div class="brand"><img src="assets/vanes-logo-lockup.svg" alt="VANES AI"></div>
<h1>Parent progress</h1>
<p class="sub">Follow your child's study progress on VANES AI — per subject, day by day. This page updates as they study; keep the link private.</p>
<div class="card" id="codeCard">
 <h2>Have a parent code?</h2>
 <p>Enter the 8-character code from your child's VANES Premium account.</p>
 <div class="row"><input id="codeInput" maxlength="12" placeholder="e.g. K7QWM2PX" aria-label="Parent code"><button id="codeGo">View progress</button></div>
 <p class="error" id="codeError" role="alert"></p>
</div>
<div id="out"></div>
<p class="foot">VANES AI by OB Technologies Lab · Only the subjects your child studies are shown.<br>Pupil learning data is never sold or shared outside VANES.</p>
</main>
<script>
function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n}
function fmtMin(sec){var m=Math.round((Number(sec)||0)/60);return m>=60?(Math.floor(m/60)+'h '+(m%60)+'m'):m+' min'}
function dayLabel(day){try{var d=new Date(day+'T00:00:00+03:00');return ['Su','Mo','Tu','We','Th','Fr','Sa'][d.getDay()]+' '+d.getDate()}catch(e){return day}}
var METRICS=[['minutes','Study time'],['questions','Questions tried'],['ai','AI questions'],['correct','Correct answers']];
var state={code:'',days:14,metric:'minutes',subject:null,data:null};
var codeCard=document.getElementById('codeCard'),codeInput=document.getElementById('codeInput'),codeError=document.getElementById('codeError'),out=document.getElementById('out');
function value(m,d){if(m==='minutes')return Math.round((d.seconds||0)/60);if(m==='questions')return d.questions||0;if(m==='ai')return d.aiQuestions||0;return d.correct||0}
function metricTotal(s,m){if(m==='minutes')return fmtMin(s.totals.seconds);if(m==='questions')return String(s.totals.questions);if(m==='ai')return String(s.totals.aiQuestions);return s.totals.questions?s.totals.correct+'/'+s.totals.questions: '0'}
function render(){
 out.innerHTML='';
 var d=state.data;if(!d)return;
 var head=el('div','card');
 head.appendChild(el('h2',null,d.learner.name+(d.learner.level?' · '+d.learner.level:'')));
 head.appendChild(el('p',null,'Progress for the last '+state.days+' days · last activity '+(d.learner.lastActivity?String(d.learner.lastActivity).slice(0,16).replace('T',' '):'not yet')));
 out.appendChild(head);
 if(!d.subjects.length){var e=el('div','card');e.appendChild(el('div','empty','No study activity yet in this window. Once your child studies with VANES AI, each subject will appear here automatically.'));out.appendChild(e);return}
 var chips=el('div','chips');
 d.subjects.slice().sort(function(a,b){return b.totals.seconds-a.totals.seconds}).forEach(function(s){
  var c=el('button','chip'+(state.subject===s.subject?' on':''),s.subject);
  c.addEventListener('click',function(){state.subject=s.subject;render()});
  chips.appendChild(c);
 });
 var subj=d.subjects.filter(function(s){return s.subject===state.subject})[0]||d.subjects[0];state.subject=subj.subject;
 var card=el('div','card');
 card.appendChild(el('h2',null,subj.subject));
 var mrow=el('div','chips');
 METRICS.forEach(function(m){
  var b=el('button','metric'+(state.metric===m[0]?' on':''),m[1]);
  b.addEventListener('click',function(){state.metric=m[0];render()});
  mrow.appendChild(b);
 });
 card.appendChild(mrow);
 var max=0;subj.days.forEach(function(x){max=Math.max(max,value(state.metric,x))});
 var hist=el('div','hist');
 subj.days.forEach(function(x,i){
  var v=value(state.metric,x);
  var bar=el('div','bar');
  var fill=el('i',v?'':'zero');
  fill.style.height=(v&&max?Math.max(4,Math.round(v/max*100)):1)+'%';
  fill.title=dayLabel(x.day)+': '+v+(state.metric==='minutes'?' minutes':'');
  bar.appendChild(fill);
  bar.appendChild(el('b',null,v?String(v):'·'));
  bar.appendChild(el('em',null,i%2===0?dayLabel(x.day):''));
  hist.appendChild(bar);
 });
 card.appendChild(hist);
 var legend=el('div','legend');legend.appendChild(el('span',null,dayLabel(d.days[0])));legend.appendChild(el('span',null,'Day by day · '+dayLabel(d.days[d.days.length-1])));card.appendChild(legend);
 var stats=el('div','summary');
 [['Study time',metricTotal(subj,'minutes')],['Questions tried',String(subj.totals.questions)],['Correct',subj.totals.questions?Math.round(subj.totals.correct/subj.totals.questions*100)+'%':'—'],['AI questions',String(subj.totals.aiQuestions)]].forEach(function(p){
  var s=el('div','stat');s.appendChild(el('strong',null,p[1]));s.appendChild(el('span',null,p[0]));stats.appendChild(s);
 });
 card.appendChild(stats);
 out.appendChild(card);
}
function load(code){
 state.code=String(code||'').trim().toUpperCase();
 if(!/^[A-Z0-9]{6,12}$/.test(state.code)){codeCard.style.display='';codeError.textContent='Enter the full 8-character code.';return}
 codeCard.style.display='none';codeError.textContent='';
 out.innerHTML='<div class="card"><div class="empty">Loading progress…</div></div>';
 fetch('/api/parent/view?code='+encodeURIComponent(state.code)+'&days='+state.days,{cache:'no-store'}).then(function(r){return r.json().catch(function(){return{}}).then(function(d){if(!r.ok)throw new Error(d.error||('Request failed with HTTP '+r.status));return d})}).then(function(d){
  document.title='VANES AI · '+d.learner.name+' progress';
  state.data=d;if(!state.subject&&d.subjects.length)state.subject=d.subjects.slice().sort(function(a,b){return b.totals.seconds-a.totals.seconds})[0].subject;
  render();
 }).catch(function(e){out.innerHTML='';var c=el('div','card');c.appendChild(el('p','error',e.message||'Could not load progress.'));out.appendChild(c);codeCard.style.display=''});
}
document.getElementById('codeGo').addEventListener('click',function(){var c=codeInput.value;history.replaceState(null,'','/parent?code='+encodeURIComponent(c.trim().toUpperCase()));load(c)});
codeInput.addEventListener('keydown',function(e){if(e.key==='Enter')document.getElementById('codeGo').click()});
var fromUrl=new URLSearchParams(location.search).get('code')||'';
if(fromUrl){codeInput.value=fromUrl.toUpperCase();load(fromUrl)}else{codeCard.style.display=''}
</script></body></html>`}
