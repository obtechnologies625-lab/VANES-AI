import { handleAnalytics, handleAdminAnalytics } from './analytics.js';
import { handleContact } from './contact.js';
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const RUNWAY_URL = "https://api.dev.runwayml.com/v1";
const DEFAULT_MODEL = "openai/gpt-4o-mini";
const DEFAULT_RUNWAY_MODEL = "gen3a_turbo";
// Keep chat requests below the user's remaining OpenRouter credit allowance.
// OpenRouter can reject a request before generation when max_tokens exceeds the
// currently affordable amount, so VANES uses a conservative default.
const DEFAULT_MAX_TOKENS = 1400;
const IMAGE_MAX_TOKENS = 200;
const MAX_BODY = 9000000;
function json(data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...extra}})}
function cors(origin){return {"Access-Control-Allow-Origin":origin||"*","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Vary":"Origin"}}
function toImage(value,mime="image/png"){if(typeof value!=="string")return null;const s=value.trim();if(/^https?:\/\//i.test(s)||/^data:image\//i.test(s))return s;const md=s.match(/!\[[^\]]*\]\((https?:\/\/[^\s)]+|data:image\/[^)]+)\)/i);if(md)return md[1];const url=s.match(/https?:\/\/[^\s<>"')]+/i);if(url)return url[0];if(s.length>100&&/^[A-Za-z0-9+/=_\-]+$/.test(s))return `data:${mime};base64,${s}`;return null}
function collectImages(value,output=[],mime="image/png",seen=new WeakSet()){if(value==null)return output;if(typeof value==="string"){const trimmed=value.trim();try{if(/^[\[{]/.test(trimmed))return collectImages(JSON.parse(trimmed),output,mime,seen)}catch{}const image=toImage(value,mime);if(image)output.push(image);return output}if(Array.isArray(value)){value.forEach(v=>collectImages(v,output,mime,seen));return output}if(typeof value!=="object"||seen.has(value))return output;seen.add(value);const localMime=value.mime_type||value.mimeType||value.media_type||value.content_type||value.contentType||mime;for(const key of ["url","image_url","imageUrl","image","images","output","outputs","result","results","content","data","file","files","artifact","artifacts","generated_images","generatedImages","response","tool_result","toolResult","source","uri"])if(value[key]!=null)collectImages(value[key],output,localMime,seen);for(const key of ["b64_json","base64","image_base64","imageData","image_data","bytes","base64_data","base64Data"])if(typeof value[key]==="string"){const image=toImage(value[key],localMime);if(image)output.push(image)}if(value.arguments)collectImages(value.arguments,output,localMime,seen);if(value.input)collectImages(value.input,output,localMime,seen);return output}
function extractImageUrls(data){const output=collectImages(data,[]),message=data?.choices?.[0]?.message;if(message){collectImages(message.images,output);collectImages(message.content,output);collectImages(message.tool_calls,output)}return [...new Set(output)]}
function extractText(data){const content=data?.choices?.[0]?.message?.content;if(typeof content==="string")return content;if(Array.isArray(content))return content.map(part=>typeof part==="string"?part:(part?.text||"")).filter(Boolean).join("\n");if(content&&typeof content==="object")return content.text||content.output_text||"";return ""}
function readableError(value,fallback="Image generation failed."){if(typeof value==="string"&&value.trim())return value.trim();if(!value||typeof value!=="object")return fallback;const nested=value.message||value.error||value.detail||value.reason;if(typeof nested==="string"&&nested.trim())return nested.trim();if(nested&&typeof nested==="object")return readableError(nested,fallback);try{const text=JSON.stringify(value);return text&&text!=="{}"?text:fallback}catch{return fallback}}
function hasCreditError(text=""){return /(no credits|not enough credits|requires more credits|insufficient credits|credit limit|out of credits|can only afford)/i.test(text)}
function hasEndpointError(text=""){return /(no endpoints found|no endpoints|model.*(not found|unavailable)|endpoint.*(not found|unavailable)|does not exist)/i.test(text)}
function enhanceImagePrompt(prompt){const raw=String(prompt||"").trim();return `Create a polished, high-quality image based on this user request: ${raw}. Preserve the requested subject and intent. Use strong composition, natural lighting, coherent anatomy and geometry, rich detail, clean edges, believable materials, depth, and professional visual storytelling. Do not add text, logos, watermarks, captions, or unrelated objects unless explicitly requested.`}
async function handleChat(request,env){
  const headers=cors(request.headers.get("Origin"));
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(request.method!=="POST")return json({error:"Method not allowed"},405,headers);
  if(!env.OPENROUTER_API_KEY)return json({error:"VANES AI server is missing OPENROUTER_API_KEY."},500,headers);
  let body;try{body=await request.json()}catch{return json({error:"Invalid JSON body."},400,headers)}
  if(!Array.isArray(body?.messages)||!body.messages.length)return json({error:"Please send a question."},400,headers);

  const messages=body.messages.slice(-18);
  const hasImage=messages.some(m=>Array.isArray(m?.content)&&m.content.some(p=>p?.type==="image_url"||p?.type==="input_image"));
  const models=hasImage
    ? ["google/gemma-3-27b-it:free","openrouter/free"]
    : ["qwen/qwen3-32b:free","meta-llama/llama-3.3-70b-instruct:free","google/gemma-3-27b-it:free","openrouter/free"];
  const requested=typeof body.model==="string"?body.model.trim():"";
  const ordered=requested&&models.includes(requested)?[requested,...models.filter(m=>m!==requested)]:models;
  const requestedTokens=Number(body.max_tokens);
  const maxTokens=Number.isFinite(requestedTokens)?Math.min(Math.max(requestedTokens,256),1600):1400;
  let lastStatus=503,lastDetail="No model returned an answer.";

  async function callModel(model,chatMessages,tokens){
    const upstream=await fetch(OPENROUTER_URL,{
      method:"POST",
      headers:{Authorization:"Bearer "+env.OPENROUTER_API_KEY,"Content-Type":"application/json","HTTP-Referer":env.APP_URL||new URL(request.url).origin,"X-Title":"VANES AI"},
      body:JSON.stringify({model,messages:chatMessages,stream:false,temperature:.3,max_tokens:tokens})
    });
    const raw=await upstream.text();let data=null;try{data=raw?JSON.parse(raw):null}catch(_){}
    if(!upstream.ok)return {ok:false,status:upstream.status,detail:readableError(data?.error||data,raw||("OpenRouter returned HTTP "+upstream.status))};
    const content=extractText(data).trim();
    if(!content)return {ok:false,status:502,detail:"Model returned HTTP 200 but no answer text."};
    return {ok:true,content,finishReason:data?.choices?.[0]?.finish_reason||null};
  }

  for(const model of ordered){
    try{
      let result=await callModel(model,messages,maxTokens);
      if(!result.ok){lastStatus=result.status;lastDetail=result.detail;continue}
      let content=result.content;
      // If the provider stopped because the token limit was reached, continue once
      // from the exact stopping point so long answers are not silently cut off.
      if(result.finishReason==="length"){
        const continuation=[...messages,
          {role:"assistant",content},
          {role:"user",content:"Continue exactly from where your previous answer stopped. Do not repeat any earlier text. Finish the explanation completely and include the remaining steps or conclusion."}
        ];
        const next=await callModel(model,continuation,Math.min(900,maxTokens));
        if(next.ok)content=content+"\n\n"+next.content;
      }
      return json({choices:[{message:{role:"assistant",content},finish_reason:"stop"}],model},200,{...headers,"X-VANES-Model":model});
    }catch(error){lastStatus=502;lastDetail=error?.message||"Network error contacting OpenRouter.";continue}
  }
  return json({error:"VANES could not produce an answer.",detail:lastDetail,code:lastStatus,provider:"OpenRouter"},lastStatus>=400&&lastStatus<600?lastStatus:502,headers);
}
async function handleImage(request,env){const headers=cors(request.headers.get("Origin"));if(request.method==="OPTIONS")return new Response(null,{status:204,headers});if(request.method!=="POST")return json({error:"Method not allowed"},405,headers);if(!env.OPENROUTER_API_KEY)return json({error:"The VANES image service is not configured. Add OPENROUTER_API_KEY in Cloudflare."},500,headers);let body;try{body=await request.json()}catch{return json({error:"Invalid JSON body."},400,headers)}const prompt=typeof body?.prompt==="string"?body.prompt.trim():"";if(!prompt)return json({error:"Please describe the image you want."},400,headers);const model=typeof env.VANES_IMAGE_MODEL==="string"&&env.VANES_IMAGE_MODEL.trim()?env.VANES_IMAGE_MODEL.trim():"google/gemini-2.5-flash-image";const enhancedPrompt=enhanceImagePrompt(prompt);try{const upstream=await fetch(OPENROUTER_URL,{method:"POST",headers:{Authorization:`Bearer ${env.OPENROUTER_API_KEY}`,"Content-Type":"application/json","HTTP-Referer":env.APP_URL||new URL(request.url).origin,"X-Title":"VANES AI Image Generator"},body:JSON.stringify({model,messages:[{role:"user",content:enhancedPrompt}],modalities:["text","image"],max_tokens:IMAGE_MAX_TOKENS})});const raw=await upstream.text();let data=null;try{data=JSON.parse(raw)}catch{}if(!upstream.ok){return json({error:readableError(data?.error||data,raw||`Image generation failed (${upstream.status}).`),provider:"OpenRouter",model},upstream.status,headers)}const images=extractImageUrls(data);const text=extractText(data);if(!images.length)return json({error:"The image model completed but returned no renderable image.",provider:"OpenRouter",model,details:text||null},502,headers);return json({ok:true,provider:"OpenRouter",model,images,text},200,headers)}catch(error){return json({error:readableError(error,"Unable to reach the image generation service."),provider:"OpenRouter",model},502,headers)}}
async function handleRunway(request,env){const headers=cors(request.headers.get("Origin"));if(request.method==="OPTIONS")return new Response(null,{status:204,headers});if(!env.RUNWAY_API_KEY)return json({error:"Runway is not connected to VANES yet. Configure the private Cloudflare secret RUNWAY_API_KEY."},503,headers);const url=new URL(request.url);const taskId=url.searchParams.get("task");const baseHeaders={Authorization:`Bearer ${env.RUNWAY_API_KEY}`,"Content-Type":"application/json","X-Runway-Version":env.RUNWAY_API_VERSION||"2024-11-06"};try{if(request.method==="GET"&&taskId){const r=await fetch(`${RUNWAY_URL}/tasks/${encodeURIComponent(taskId)}`,{headers:baseHeaders});const raw=await r.text();let data;try{data=JSON.parse(raw)}catch{data={error:raw}}return json(data,r.status,headers)}if(request.method!=="POST")return json({error:"Method not allowed"},405,headers);const length=Number(request.headers.get("Content-Length")||0);if(length>MAX_BODY)return json({error:"Video request is too large."},413,headers);let body;try{body=await request.json()}catch{return json({error:"Invalid JSON body."},400,headers)}const prompt=typeof body?.prompt==="string"?body.prompt.trim():"";if(!prompt)return json({error:"Please describe the learning visual or study animation you want."},400,headers);const educationalPrefix="VANES AI educational visual generation. Create a learning-focused visual for a Tanzanian secondary-school learner. Preserve the user’s study intent, factual meaning and age-appropriate presentation. Do not introduce unrelated entertainment, promotional content or unsupported academic claims. User request: ";const model=typeof body.model==="string"&&body.model.trim()?body.model.trim():(env.RUNWAY_MODEL||DEFAULT_RUNWAY_MODEL);const duration=[5,10].includes(Number(body.duration))?Number(body.duration):5;const ratio=["1280:720","720:1280","1104:832","832:1104","960:960"].includes(body.ratio)?body.ratio:"1280:720";const payload={model,promptText:educationalPrefix+prompt,duration,ratio};if(typeof body.image==="string"&&body.image.trim())payload.promptImage=body.image.trim();const r=await fetch(`${RUNWAY_URL}/image_to_video`,{method:"POST",headers:baseHeaders,body:JSON.stringify(payload)});const raw=await r.text();let data;try{data=JSON.parse(raw)}catch{data={error:raw}}if(!r.ok)return json({error:readableError(data?.error||data,raw||"Runway request failed.")},r.status,headers);return json({ok:true,taskId:data.id||data.task_id||data.taskId,provider:"Runway",status:data.status||"PENDING"},200,headers)}catch(error){return json({error:readableError(error,"Unable to reach Runway.")},502,headers)}}
export default {async fetch(request,env){const url=new URL(request.url);if(url.pathname==="/api/health")return json({ok:true,worker:"vanes-ai",openrouterConfigured:Boolean(env.OPENROUTER_API_KEY),runwayConfigured:Boolean(env.RUNWAY_API_KEY),maxTokens:DEFAULT_MAX_TOKENS,imageMaxTokens:IMAGE_MAX_TOKENS,imageModel:env.VANES_IMAGE_MODEL||"google/gemini-2.5-flash-image",imageFallback:"disabled",visionModels:["google/gemma-3-27b-it:free","openrouter/free"],runwayModel:env.RUNWAY_MODEL||DEFAULT_RUNWAY_MODEL});if(url.pathname==="/api/contact")return handleContact(request,env);if(url.pathname==="/api/analytics")return handleAnalytics(request,env);if(url.pathname==="/api/admin/analytics")return handleAdminAnalytics(request,env);if(url.pathname==="/api/chat")return handleChat(request,env);if(url.pathname==="/api/image")return handleImage(request,env);if(url.pathname==="/api/video")return handleRunway(request,env);return env.ASSETS.fetch(request)}};
