/* VANES AI — Firestore sync bridge for the learner's own data.
   localStorage stays the working store every module already reads; Firestore is the
   copy that follows the learner to another device. Newest syncedAt wins. */
(function(){
'use strict';
const SYNC_KEYS=['vanes-learner-profile-v2','vanes-learner-profile-v1','vanes-user-name','vanes-chat-conversations-v1','vanes-chat-active-v1','vanes-saved-study-plans-v1','vanes-study-shelf-v2','vanes-active-session-v2','vanes-study-tracking-v2','vanes-study-summaries-v1','vanes-daily-streak-v2','vanes-premium-v1'];
/* Deliberately device-local: theme, notification permissions, tutorial flag, anonymous id,
   the profile picture (a data URL that can exceed the 1 MiB document limit) and the trial
   counter, which is enforced by the Worker. */
const MAX_BYTES=850000,RELOAD_FLAG='vanes-sync-reload-v1';
const fb=()=>window.VANES_FB;
let enabled=false,failed='',connecting=false,timer=0,started=false;

/* The account card in Settings is painted before the first sync attempt resolves, so it
   has to be told when the state changes or it keeps promising cloud sync that failed. */
function announce(){
 window.dispatchEvent(new CustomEvent('vanes-sync-state',{detail:{enabled:enabled,failed:failed,connecting:connecting}}));
}

function collect(){
 const data={};
 for(const k of SYNC_KEYS){const v=localStorage.getItem(k);if(v!==null)data[k]=v}
 return data;
}

function bytes(data){return JSON.stringify(data).length}

/* Conversations are the only field that can outgrow a Firestore document, so trim them first. */
function fit(data){
 let out={...data};
 if(bytes(out)<=MAX_BYTES)return {data:out,trimmed:false};
 try{
  const raw=JSON.parse(out['vanes-chat-conversations-v1']||'[]');
  if(Array.isArray(raw)&&raw.length){
   const slim=raw.slice(0,8).map(c=>({...c,messages:Array.isArray(c.messages)?c.messages.slice(-40):c.messages}));
   out['vanes-chat-conversations-v1']=JSON.stringify(slim);
  }
 }catch(_){}
 if(bytes(out)<=MAX_BYTES)return {data:out,trimmed:true};
 delete out['vanes-chat-conversations-v1'];
 return {data:out,trimmed:true};
}

function applyRemote(remote){
 const data=remote&&remote.data?remote.data:null;
 if(!data)return 0;
 let n=0;
 for(const k of Object.keys(data)){
  if(!SYNC_KEYS.includes(k))continue;
  const v=data[k];
  if(typeof v==='string'&&localStorage.getItem(k)!==v){localStorage.setItem(k,v);n++}
 }
 return n;
}

function reloadOnce(){
 if(sessionStorage.getItem(RELOAD_FLAG))return false;
 sessionStorage.setItem(RELOAD_FLAG,'1');
 location.reload();
 return true;
}

async function pushNow(){
 if(!enabled||!fb()?.ok)return false;
 const {data,trimmed}=fit(collect());
 try{
  await fb().push({data:data});
  localStorage.setItem('vanes-synced-at-v1',String(Date.now()));
  failed='';connecting=false;announce();
  if(trimmed)window.showToast?.('Synced, but the oldest conversations stayed on this device — the cloud copy has a size limit.');
  return true;
 }catch(err){
  disable(fb().friendly(err));
  return false;
 }
}

function schedulePush(){
 if(!enabled)return;
 clearTimeout(timer);
 timer=setTimeout(pushNow,2500);
}

function disable(reason){
 enabled=false;connecting=false;failed=reason||'Sync is unavailable.';
 window.showToast?.('Cloud sync is off: '+failed);
 announce();
}

function hookStorage(){
 if(hookStorage.done)return;hookStorage.done=true;
 const nativeSet=Storage.prototype.setItem,nativeRemove=Storage.prototype.removeItem;
 Storage.prototype.setItem=function(k,v){nativeSet.apply(this,arguments);if(this===localStorage&&SYNC_KEYS.includes(k))schedulePush()};
 Storage.prototype.removeItem=function(k){nativeRemove.apply(this,arguments);if(this===localStorage&&SYNC_KEYS.includes(k))schedulePush()};
 window.addEventListener('pagehide',()=>{if(enabled)pushNow()});
 document.addEventListener('visibilitychange',()=>{if(enabled&&document.visibilityState==='hidden')pushNow()});
}

async function start(acct){
 if(started)return;
 if(!acct?.uid||!fb()?.ok||!fb().hasFirestore)return;
 started=true;enabled=true;connecting=true;hookStorage();
 announce();
 sessionStorage.removeItem(RELOAD_FLAG);
 try{
  const remote=await fb().pull();
  if(remote&&remote.data){
   const localAt=Number(localStorage.getItem('vanes-synced-at-v1')||0);
   const remoteAt=remote.syncedAt?.toMillis?remote.syncedAt.toMillis():Number(remote.syncedAt||0);
   if(remoteAt>localAt&&applyRemote(remote)>0){
    window.showToast?.('Restored your VANES data from your account ✓');
    if(!reloadOnce())await pushNow();
    return;
   }
  }
  await pushNow();
  window.showToast?.('Cloud sync is on — your VANES data follows your account ✓');
 }catch(err){
  disable(fb().friendly(err));
 }
}

function stop(){
 enabled=false;connecting=false;started=false;clearTimeout(timer);
 announce();
}

window.VANES_SYNC={start:start,stop:stop,pushNow:pushNow,keys:SYNC_KEYS,status:()=>({enabled:enabled,failed:failed,connecting:connecting})};
})();
