// VANES AI — Gemini question-answer endpoint.
function textOf(data){return (data?.candidates?.[0]?.content?.parts||[]).map(x=>typeof x?.text==="string"?x.text:"").filter(Boolean).join("\n")||""}
function errOf(data,raw){return String(data?.error?.message||data?.error||data?.detail||raw||"Gemini request failed.").slice(0,800)}
function toGeminiContents(messages){
 return messages.filter(m=>m?.role!=="system").map(m=>{
  const role=m?.role==="assistant"?"model":"user";
  const parts=Array.isArray(m?.content)?m.content.map(p=>{
   if(typeof p==="string")return {text:p};
   if(p?.type==="text")return {text:String(p.text||"")};
   const u=p?.image_url?.url||p?.image_url||p?.url;
   if(typeof u==="string"){const match=u.match(/^data:([^;]+);base64,(.+)$/s);if(match)return {inline_data:{mime_type:match[1],data:match[2]}}}
   return null;
  }).filter(Boolean):[{text:String(m?.content||"")}];
  return {role,parts:parts.length?parts:[{text:""}]};
 }).filter(x=>x.parts.some(p=>p.text||p.inline_data));
}
export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
 const key=process.env.GEMINI_API_KEY;if(!key)return res.status(500).json({error:"VANES AI server is missing GEMINI_API_KEY."});
 let body;try{body=typeof req.body==="string"?JSON.parse(req.body):(req.body||{})}catch{return res.status(400).json({error:"Invalid JSON body."})}
 if(!Array.isArray(body.messages)||!body.messages.length)return res.status(400).json({error:"Please send a question."});
 const messages=body.messages.slice(-18);
 const system=messages.find(m=>m?.role==="system");
 const systemPrompt=typeof system?.content==="string"?system.content:"You are VANES AI, a careful educational AI assistant. Give complete, useful answers.";
 const model=process.env.GEMINI_MODEL||"gemini-1.5-flash";
 const n=Number(body.max_tokens);const maxTokens=Number.isFinite(n)?Math.min(Math.max(n,256),1400):1200;
 const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
 try{
  const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({systemInstruction:{parts:[{text:systemPrompt}]},contents:toGeminiContents(messages),generationConfig:{temperature:.3,maxOutputTokens:maxTokens}})});
  const raw=await r.text();let data=null;try{data=raw?JSON.parse(raw):null}catch(_){}
  if(!r.ok)return res.status(r.status).json({error:"VANES could not produce an answer.",detail:errOf(data,raw),code:r.status,provider:"Gemini",model});
  const answer=textOf(data).trim();if(!answer)return res.status(502).json({error:"VANES could not produce an answer.",detail:data?.promptFeedback?.blockReason||data?.candidates?.[0]?.finishReason||"Gemini returned no answer text.",code:502,provider:"Gemini",model});
  return res.status(200).json({choices:[{message:{role:"assistant",content:answer},finish_reason:data?.candidates?.[0]?.finishReason==="MAX_TOKENS"?"length":"stop"}],model,provider:"Gemini"});
 }catch(e){return res.status(502).json({error:"VANES could not produce an answer.",detail:e?.message||"Network error contacting Gemini.",code:502,provider:"Gemini",model})}
}
