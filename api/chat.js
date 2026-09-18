// VANES AI — direct Mistral / Codestral question-answer endpoint.
const MISTRAL_URL="https://api.mistral.ai/v1/chat/completions";
function textOf(data){const c=data?.choices?.[0]?.message?.content;return typeof c==="string"?c:Array.isArray(c)?c.map(x=>typeof x==="string"?x:(x?.text||"")).filter(Boolean).join("\n"):""}
function errOf(data,raw){return String(data?.message||data?.error?.message||data?.error||data?.detail||raw||"Mistral request failed.").slice(0,800)}
export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
 const key=process.env.MISTRAL_API_KEY;if(!key)return res.status(500).json({error:"VANES AI server is missing MISTRAL_API_KEY."});
 let body;try{body=typeof req.body==="string"?JSON.parse(req.body):(req.body||{})}catch{return res.status(400).json({error:"Invalid JSON body."})}
 if(!Array.isArray(body.messages)||!body.messages.length)return res.status(400).json({error:"Please send a question."});
 const messages=body.messages.slice(-18),system=messages.find(m=>m?.role==="system");
 const systemPrompt=typeof system?.content==="string"?system.content:"You are VANES AI, a careful educational AI assistant. Give complete, useful answers.";
 const model=process.env.MISTRAL_MODEL||"codestral-latest";
 const n=Number(body.max_tokens),maxTokens=Number.isFinite(n)?Math.min(Math.max(n,256),1400):1200;
 try{
  const r=await fetch(MISTRAL_URL,{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model,messages:[{role:"system",content:systemPrompt},...messages.filter(m=>m?.role!=="system")],temperature:.3,max_tokens:maxTokens,stream:false})});
  const raw=await r.text();let data=null;try{data=raw?JSON.parse(raw):null}catch(_){}
  if(!r.ok)return res.status(r.status).json({error:"VANES could not produce an answer.",detail:errOf(data?.error||data,raw),code:r.status,provider:"Mistral",model});
  const answer=textOf(data).trim();if(!answer)return res.status(502).json({error:"VANES could not produce an answer.",detail:"Mistral returned no answer text.",code:502,provider:"Mistral",model});
  return res.status(200).json({choices:[{message:{role:"assistant",content:answer},finish_reason:data?.choices?.[0]?.finish_reason==="length"?"length":"stop"}],model,provider:"Mistral"});
 }catch(e){return res.status(502).json({error:"VANES could not produce an answer.",detail:e?.message||"Network error contacting Mistral.",code:502,provider:"Mistral",model})}
}
