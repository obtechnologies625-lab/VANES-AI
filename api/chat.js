// VANES AI — clean Vercel question-answer endpoint.
const URL="https://openrouter.ai/api/v1/chat/completions";
const MODELS=["openrouter/free","qwen/qwen3-32b:free","meta-llama/llama-3.3-70b-instruct:free","google/gemma-3-27b-it:free"];
function textOf(data){const c=data?.choices?.[0]?.message?.content;if(typeof c==="string")return c;if(Array.isArray(c))return c.map(x=>typeof x==="string"?x:x?.text||"").join("\n");return data?.output_text||data?.choices?.[0]?.text||""}
function errOf(data,raw){return String(data?.error?.message||data?.error||data?.detail||raw||"OpenRouter request failed.").slice(0,800)}
export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
 const key=process.env.OPENROUTER_API_KEY;if(!key)return res.status(500).json({error:"VANES AI server is missing OPENROUTER_API_KEY."});
 let body;try{body=typeof req.body==="string"?JSON.parse(req.body):(req.body||{})}catch{return res.status(400).json({error:"Invalid JSON body."})}
 if(!Array.isArray(body.messages)||!body.messages.length)return res.status(400).json({error:"Please send a question."});
 const messages=body.messages.slice(-18);
 const hasImage=messages.some(m=>Array.isArray(m?.content)&&m.content.some(p=>p?.type==="image_url"||p?.type==="input_image"));
 const models=hasImage?["google/gemma-3-27b-it:free","openrouter/free"]:MODELS;
 let lastStatus=502,lastDetail="No model returned an answer.";
 for(const model of models){
  try{
   const r=await fetch(URL,{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json","HTTP-Referer":process.env.APP_URL||"https://vanes-ai.vercel.app","X-Title":"VANES AI"},body:JSON.stringify({model,messages,stream:false,temperature:.3,max_tokens:Math.min(Math.max(Number(body.max_tokens)||1200,256),1200)})});
   const raw=await r.text();let data=null;try{data=raw?JSON.parse(raw):null}catch(_){}
   if(r.ok){const answer=textOf(data).trim();if(answer)return res.status(200).json({choices:[{message:{role:"assistant",content:answer}}],model});lastStatus=502;lastDetail="Model "+model+" returned no answer text.";continue}
   lastStatus=r.status;lastDetail=errOf(data,raw);continue;
  }catch(e){lastStatus=502;lastDetail=e?.message||"Network error contacting OpenRouter.";continue}
 }
 return res.status(lastStatus>=400&&lastStatus<600?lastStatus:502).json({error:"VANES could not produce an answer.",detail:lastDetail,code:lastStatus});
}
