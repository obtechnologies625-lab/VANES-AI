/* VANES AI learner-profile completeness guard. */
(function(){
'use strict';
const PROFILE='vanes-learner-profile-v2';
const COMMON=['Historia ya Tanzania','Academic Communication'];
const COMBOS=['PCM','PCB','PGM','CBG','CBA','CBN','EGM','ECA','HGE','HGL','HKL','HKA','HEC','HGLi','OTHER'];
function read(){try{return JSON.parse(localStorage.getItem(PROFILE)||localStorage.getItem('vanes-learner-profile-v1')||'null')}catch{return null}}
function complete(p){
 if(!p||!String(p.name||'').trim()||!['O-Level','A-Level'].includes(p.level))return false;
 if(p.level==='A-Level')return COMBOS.includes(p.combination)&&((p.combination==='OTHER'&&Array.isArray(p.subjects)&&p.subjects.length>0)||p.combination!=='OTHER');
 return Array.isArray(p.subjects)&&p.subjects.length>0;
}
/* The first-run dialog in vanes-profile.js collects the same fields; if it is on screen the
   guard must stay quiet, otherwise the learner gets two stacked forms for one profile. */
function firstRunOpen(){
 const m=document.getElementById('nameModal');
 if(!m||m.getAttribute('aria-hidden')==='true')return false;
 const r=m.getBoundingClientRect();
 return r.width>0&&r.height>0;
}
function enforce(){
 if(firstRunOpen())return false;
 const p=read(),modal=document.getElementById('vanesProfileUpgrade');
 if(!modal)return false;
 if(!complete(p)){
   modal.hidden=false;
   const title=modal.querySelector('h2');
   const intro=modal.querySelector('.vp-card>p:not(.eyebrow)');
   if(title)title.textContent='Complete your learner profile';
   if(intro)intro.innerHTML='Enter your <b>name, education level and subjects</b>. A-Level learners must also choose their <b>combination</b>. VANES uses this information to personalise every answer, plan and revision session.';
   return true;
 }
 return false;
}
function boot(){
 let tries=0;
 const timer=setInterval(()=>{if(firstRunOpen())return;if(enforce()||++tries>40)clearInterval(timer)},100);
 window.addEventListener('hashchange',()=>setTimeout(enforce,100));
 window.addEventListener('vanes:profile-saved',()=>setTimeout(enforce,150));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
