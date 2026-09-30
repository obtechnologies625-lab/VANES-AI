/* VANES AI identity, onboarding and accessibility layer. */
(function(){
  const logo='assets/vanes-logo.svg';
  const obLogo='assets/ob-technologies-lab.svg';
  const style=document.createElement('link');style.rel='stylesheet';style.href='vanes-reference.css?v=20261001e';document.head.appendChild(style);
  document.querySelectorAll('.brand-mark').forEach(mark=>{mark.textContent='';const img=document.createElement('img');img.src=logo;img.alt='VANES AI';mark.appendChild(img);});
  const sidebar=document.querySelector('.sidebar');
  if(sidebar&&!sidebar.querySelector('.ob-brand')){const footer=document.createElement('div');footer.className='ob-brand';footer.innerHTML=`<span>Made by</span><img src="${obLogo}" alt="OB Technologies Lab">`;sidebar.appendChild(footer);}
  const modal=document.querySelector('#nameModal');
  if(modal){const card=modal.querySelector('.name-card');if(card){const oldP=card.querySelector('p:not(.eyebrow)');if(oldP)oldP.textContent='Tell VANES your name, education level and subjects so your dashboard can adapt to you.';if(!card.querySelector('.first-launch-note')){const note=document.createElement('div');note.className='first-launch-note';note.innerHTML='<strong>VANES = Versatile Adaptive Neuro Emergent System</strong><br>Study, analyse, practise, plan, create and learn with Tanzanian curriculum-aware AI.';card.appendChild(note);}}}
  const hero=document.querySelector('.hero-copy');
  if(hero&&!hero.querySelector('.vanes-definition')){const p=document.createElement('p');p.className='vanes-definition subtle';p.textContent='Versatile Adaptive Neuro Emergent System — adaptive learning that changes with the learner.';hero.insertBefore(p,hero.querySelector('.hero-meta'));}
  const theme=document.querySelector('#themeToggle');
  function applyTheme(mode){const m=mode==='light'?'light':'dark';document.body.classList.toggle('dark',m==='dark');document.body.dataset.theme=m;localStorage.setItem('vanes-theme',m);if(theme){const label=theme.querySelector('span');if(label)label.textContent=m==='dark'?'Light mode':'Dark mode';theme.firstChild.textContent=m==='dark'?'☀ ':'☾ ';}}
  applyTheme(localStorage.getItem('vanes-theme')||'dark');
  if(theme&&!theme.dataset.vanesBound){theme.dataset.vanesBound='1';theme.addEventListener('click',e=>{e.preventDefault();applyTheme(document.body.classList.contains('dark')?'light':'dark');});}
  const upgrade=document.createElement('script');upgrade.src='vanes-product-upgrade.js?v=20261001g';document.body.appendChild(upgrade);
  upgrade.onload=()=>{
    const context=document.createElement('script');context.src='vanes-ai-context-fix.js?v=20260914c';document.body.appendChild(context);
    const guard=document.createElement('script');guard.src='vanes-profile-enforcer.js?v=20261001d';document.body.appendChild(guard);
  };
})();
