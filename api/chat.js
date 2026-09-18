// VANES AI — Mistral / Codestral question-answer endpoint.
const OR="https://openrouter.ai/api/v1/chat/completions";
function textOf(data){const c=data?.choices?.[0]?.message?.content;return typeof c==="string"?c:Array.isArray(c)?c.map(x=>typeof x==="string"?x:(x?.text||"")).filter(Boolean).join("\n"):""}
function errOf(data,raw){return String(data?.message||data?.error?.message||data?.error||data?.detail||raw||"OpenRouter request failed.").slice(0,800)}
export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
 const key=process.env.OPENROUTER_API_KEY;if(!key)return res.status(500).json({error:"VANES AI server is missing OPENROUTER_API_KEY."});
 let body;try{body=typeof req.body==="string"?JSON.parse(req.body):(req.body||{})}catch{return res.status(400).json({error:"Invalid JSON body."})}
 if(!Array.isArray(body.messages)||!body.messages.length)return res.status(400).json({error:"Please send a question."});
 const messages=body.messages.slice(-18),system=messages.find(m=>m?.role==="system");
 const systemPrompt=typeof system?.content==="string"?system.content:"You are VANES AI, a careful educational AI assistant. Give complete, useful answers.";
 const hasImage=messages.some(m=>Array.isArray(m?.content)&&m.content.some(p=>p?.image_url||p?.type==="image"));
 const textModel=process.env.VANES_CHAT_MODEL||"mistralai/codestral-2508";
 const imageModel=process.env.VANES_VISION_MODEL||"mistralai/pixtral-12b";
 const models=(hasImage?[imageModel,"mistralai/pixtral-12b","openrouter/free"]:[textModel,"mistralai/codestral-2508","mistralai/mistral-small-3.1-24b-instruct:free","openrouter/free"]).filter((m,i,a)=>m&&a.indexOf(m)===i);
 const n=Number(body.max_tokens),maxTokens=Number.isFinite(n)?Math.min(Math.max(n,256),1400):1200;
 let lastStatus=502,lastDetail="No OpenRouter model returned an answer.";
 for(const model of models)try{
  const r=await fetch(OR,{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json","HTTP-Referer":process.env.APP_URL||"https://vanes-ai.app","X-Title":"VANES AI"},body:JSON.stringify({model,messages:[{role:"system",content:systemPrompt},...messages.filter(m=>m?.role!=="system")],max_tokens:maxTokens,temperature:.3})});
  const raw=await r.text();let data=null;try{data=raw?JSON.parse(raw):null}catch(_){}
  if(!r.ok){lastStatus=r.status;lastDetail=errOf(data?.error||data,raw);continue}
  const answer=textOf(data).trim();if(!answer){lastStatus=502;lastDetail="OpenRouter returned no answer text.";continue}
  return res.status(200).json({choices:[{message:{role:"assistant",content:answer},finish_reason:data?.choices?.[0]?.finish_reason==="length"?"length":"stop"}],model,provider:"OpenRouter"});
 }catch(e){lastStatus=502;lastDetail=e?.message||"Network error contacting OpenRouter."}
 return res.status(lastStatus>=400&&lastStatus<600?lastStatus:502).json({error:"VANES could not produce an answer.",detail:lastDetail,code:lastStatus,provider:"OpenRouter",modelsTried:models});
}
