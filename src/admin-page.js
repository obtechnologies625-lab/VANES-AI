/* The admin dashboard is rendered by the Worker, not shipped as a static asset, so the
   token check in index.js cannot be bypassed by asset routing and the page is not
   discoverable without the key. `token` has already been verified against
   env.ADMIN_ANALYTICS_TOKEN before this is called. */
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

export function adminPage(token){return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>VANES AI · Admin analytics</title>
<style>body{font-family:Arial,sans-serif;background:#06101c;color:#eef8ff;margin:0;padding:30px}main{max-width:1100px;margin:auto}.card{background:#0b1a2a;border:1px solid #1b5a7d;border-radius:16px;padding:20px;margin:15px 0}input,button{padding:11px;border-radius:9px;border:1px solid #285776}input{width:70%;background:#fff;color:#111}button{background:#12314a;color:#fff;cursor:pointer}table{width:100%;border-collapse:collapse;font-size:12px}td,th{padding:9px;border-bottom:1px solid #1b3345;text-align:left;vertical-align:top}pre{white-space:pre-wrap;word-break:break-word}.err{border-color:#7d1b2e;color:#ffd0d8}</style>
</head><body><main>
<h1>VANES AI · Admin analytics</h1>
<p>Private developer dashboard. Data comes from <code>/api/admin/analytics</code>, protected by the <code>ADMIN_ANALYTICS_TOKEN</code> secret.</p>
<div class="card"><input id="token" type="password" placeholder="Admin analytics token" value="${esc(token)}"><button id="load">Load data</button></div>
<div id="out"></div>
</main>
<script>
const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const out=document.getElementById('out'),tokenInput=document.getElementById('token');
function card(title,body){return '<div class="card"><h2>'+title+'</h2>'+body+'</div>'}
async function load(){
 const token=tokenInput.value.trim();
 if(!token){out.innerHTML='<div class="card err">Enter your admin analytics token.</div>';return}
 out.textContent='Loading…';
 try{
  const r=await fetch('/api/admin/analytics',{cache:'no-store',headers:{Authorization:'Bearer '+token}});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.error?d.error+(d.detail?' — '+d.detail:''):'Request failed with HTTP '+r.status);
  out.innerHTML=card('Learners','<p>Registered learner identities: '+esc(d.totals?.users)+' · Events recorded: '+esc(d.totals?.events)+'</p>'+(d.users.length?'<table><thead><tr><th>Name</th><th>Level</th><th>Combination</th><th>First seen</th><th>Last activity</th></tr></thead><tbody>'+d.users.map(x=>'<tr><td><strong>'+esc(x.user_name||'Unnamed learner')+'</strong></td><td>'+esc(x.level||'—')+'</td><td>'+esc(x.combination||'—')+'</td><td>'+esc(x.first_seen_at)+'</td><td>'+esc(x.last_seen_at)+'</td></tr>').join('')+'</tbody></table>':'<p>No learners recorded yet.</p>'))
   +card('Verified payments','<p>Receipt checks: '+esc(d.payments?.checks||0)+' · Approved: '+esc(d.payments?.approved||0)+'</p>'+((d.payments?.claims||[]).length?'<table><thead><tr><th>Time</th><th>Verdict</th><th>Amount</th><th>Transaction</th><th>Code</th><th>Detail</th></tr></thead><tbody>'+(d.payments.claims||[]).map(x=>'<tr><td>'+esc(x.created_at)+'</td><td><strong>'+esc(x.verdict)+'</strong></td><td>'+esc(x.amount??'—')+'</td><td>'+esc(x.txn_id||'—')+'</td><td>'+esc(x.code||'—')+'</td><td>'+esc(x.reason||x.recipient||'')+'<br><small>uid '+esc(String(x.uid||'').slice(0,18))+'</small></td></tr>').join('')+'</tbody></table>':'<p>No receipt screenshots checked yet.</p>'))
   +card('Recent activity',d.recent.length?'<table><thead><tr><th>Time</th><th>User</th><th>Event</th><th>Data</th></tr></thead><tbody>'+d.recent.map(x=>'<tr><td>'+esc(x.created_at)+'</td><td><strong>'+esc(x.user_name||'Unnamed learner')+'</strong><br><small>'+esc(x.anonymous_id)+'</small></td><td>'+esc(x.event)+'</td><td><pre>'+esc(x.payload||'{}')+'</pre></td></tr>').join('')+'</tbody></table>':'<p>No events recorded yet.</p>');
 }catch(e){out.innerHTML='<div class="card err">'+esc(e.message)+'</div>'}
}
document.getElementById('load').onclick=load;
tokenInput.addEventListener('keydown',e=>{if(e.key==='Enter')load()});
if(tokenInput.value)load();
</script></body></html>`}
