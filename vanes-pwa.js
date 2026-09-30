/* VANES AI — offline indicator and install prompt. */
(function(){
'use strict';
let deferred=null;
function css(){if(document.querySelector('#vanes-pwa-style'))return;const s=document.createElement('style');s.id='vanes-pwa-style';s.textContent='#vanesOfflineBanner{position:fixed;left:50%;transform:translateX(-50%);bottom:14px;z-index:9999;max-width:min(92vw,560px);padding:10px 16px;border:1px solid #ff9f43;border-radius:999px;background:rgba(40,20,4,.94);color:#ffd9a8;font:700 12px/1.4 "DM Sans",Arial,sans-serif;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.45)}\n.install-app-button{margin:0 10px 10px;padding:10px 12px;border:1px solid #00cfff;border-radius:10px;background:linear-gradient(100deg,#0b2b46,#241a52);color:#eaf7ff;font:700 12px "DM Sans",Arial,sans-serif;cursor:pointer}\n.install-app-button:hover{border-color:#7c4dff;box-shadow:0 0 16px rgba(0,207,255,.25)}\n.install-app-button[hidden]{display:none}';document.head.appendChild(s)}
function banner(show){let b=document.querySelector('#vanesOfflineBanner');if(show&&!b){b=document.createElement('div');b.id='vanesOfflineBanner';b.setAttribute('role','status');b.textContent='You are offline. Saved pages still work; AI answers need a connection.';document.body.appendChild(b)}else if(!show&&b){b.remove()}}
function hideInstall(){const b=document.querySelector('#installAppButton');if(b)b.hidden=true}
function installButton(){let btn=document.querySelector('#installAppButton');if(!btn){btn=document.createElement('button');btn.type='button';btn.id='installAppButton';btn.className='install-app-button';btn.textContent='⬇ Install VANES AI';document.querySelector('.sidebar-bottom')?.prepend(btn)}btn.hidden=false;btn.onclick=async()=>{if(!deferred)return;const prompt=deferred;deferred=null;btn.hidden=true;prompt.prompt();const choice=await prompt.userChoice;if(choice?.outcome==='accepted')window.showToast?.('VANES AI installed ✓')};return btn}
function boot(){
 css();
 banner(!navigator.onLine);
 window.addEventListener('offline',()=>banner(true));
 window.addEventListener('online',()=>banner(false));
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;installButton()});
 window.addEventListener('appinstalled',()=>{deferred=null;hideInstall();window.showToast?.('VANES AI installed ✓')});
 if(window.matchMedia?.('(display-mode: standalone)').matches)hideInstall();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
