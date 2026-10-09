import { handleAnalytics, handleAdminAnalytics } from './analytics.js';
import { handleContact } from './contact.js';
import { adminPage } from './admin-page.js';
import { bearerToken, verifyIdToken, firebaseProjectId } from './firebase-auth.js';
import { readQuota, consumeQuota } from './quota.js';
import { handlePayAirtel, handlePayStatus, handlePayCallback, airtelConfigured, donationAmount, donationName } from './airtel.js';
import { handlePayVerify } from './payverify.js';
import { handleLinks, redirectShort, handlePortal, handleProgress, handleParentCode, handleParentView } from './premium.js';
import { parentPage } from './parent-page.js';
// Keep chat requests below the user's remaining provider credit allowance.
// The upstream API can reject a request before generation when max_tokens
// exceeds the currently affordable amount, so VANES uses a conservative default.
const DEFAULT_MAX_TOKENS = 1200;
const MAX_BODY = 9000000;
function json(data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...extra}})}
/* Expose-Headers matters because the app is served from a different origin than the
   Worker: without it the browser hides X-VANES-Answers-Left from the client's meter. */
function cors(origin){return {"Access-Control-Allow-Origin":origin||"*","Access-Control-Allow-Headers":"Content-Type,Authorization,X-VANES-Upgrade-Code","Access-Control-Allow-Methods":"GET,POST,DELETE,OPTIONS","Access-Control-Expose-Headers":"X-VANES-Model,X-VANES-Answers-Left","Vary":"Origin"}}
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
  if(!env.MISTRAL_API_KEY)return json({error:"VANES AI is not configured yet. Add MISTRAL_API_KEY to the Cloudflare Worker secrets."},500,headers);
  /* A signed-in learner sends a Firebase ID token; verifying it makes the free-trial count
     tamper-proof, because clearing localStorage can no longer reset it. Anonymous requests
     (no token) keep working so the device-only fallback still gets answers. */
  let uid="";
  const token=bearerToken(request);
  if(token){
    try{uid=(await verifyIdToken(token,env)).uid}
    catch(error){
      /* Google's signing keys being unreachable is our outage, not the learner's fault:
         serve the answer unverified rather than locking everyone out of VANES. */
      if(error?.code!=="keys-unavailable")return json({error:error?.message||"Your VANES session is not valid.",code:error?.code||"invalid-token"},401,headers);
    }
  }
  const upgradeCode=request.headers.get("X-VANES-Upgrade-Code")||"";
  const quota=uid?await readQuota(env.DB,uid,env,upgradeCode).catch(()=>null):null;
  if(quota&&!quota.premium&&quota.left<=0)return json({error:"Your free trial of "+quota.limit+" AI answers is finished. Support VANES to continue.",code:"trial-exhausted",quota},402,headers);
  let body;try{body=await request.json()}catch{return json({error:"Invalid JSON body."},400,headers)}
  if(!Array.isArray(body?.messages)||!body.messages.length)return json({error:"Please send a question."},400,headers);
  const messages=body.messages.slice(-18);
  const systemMessage=messages.find(m=>m?.role==="system");
  const systemPrompt=typeof systemMessage?.content==="string"?systemMessage.content:"You are VANES AI, a careful educational AI assistant. Give complete, useful answers and explain clearly.";
  const hasImage=messages.some(m=>Array.isArray(m?.content)&&m.content.some(p=>p&&p.type==="image_url"&&typeof p?.image_url?.url==="string"&&p.image_url.url));
  const model=hasImage?(typeof env.VANES_VISION_MODEL==="string"&&env.VANES_VISION_MODEL.trim()?env.VANES_VISION_MODEL.trim():"pixtral-12b-2409"):(typeof env.MISTRAL_MODEL==="string"&&env.MISTRAL_MODEL.trim()?env.MISTRAL_MODEL.trim():"codestral-latest");
  const n=Number(body.max_tokens);const maxTokens=Number.isFinite(n)?Math.min(Math.max(n,256),1400):1200;
  const mistralMessages=[{role:"system",content:systemPrompt},...messages.filter(m=>m?.role!=="system")];
  try{
    const upstream=await fetch("https://api.mistral.ai/v1/chat/completions",{
      method:"POST",
      headers:{Authorization:"Bearer "+env.MISTRAL_API_KEY,"Content-Type":"application/json"},
      body:JSON.stringify({model,messages:mistralMessages,temperature:.3,max_tokens:maxTokens,stream:false})
    });
    const raw=await upstream.text();let data=null;try{data=raw?JSON.parse(raw):null}catch(_){}
    if(!upstream.ok)return json({error:"VANES could not produce an answer.",detail:readableError(data?.error||data,raw||("Mistral returned HTTP "+upstream.status)),code:upstream.status,provider:"Mistral",model},upstream.status,headers);
    const content=extractText(data).trim();
    if(!content)return json({error:"VANES could not produce an answer.",detail:"Mistral returned no answer text.",code:502,provider:"Mistral",model},502,headers);
    const spent=uid?await consumeQuota(env.DB,uid,env,upgradeCode).catch(()=>null):null;
    return json({choices:[{message:{role:"assistant",content},finish_reason:data?.choices?.[0]?.finish_reason==="length"?"length":"stop"}],model,provider:"Mistral",quota:spent},200,{...headers,"X-VANES-Model":model,...(spent?{"X-VANES-Answers-Left":String(spent.left)}:{})});
  }catch(error){return json({error:"VANES could not produce an answer.",detail:error?.message||"Network error contacting Mistral.",code:502,provider:"Mistral",model},502,headers)}
}
async function handleImage(request,env){const headers=cors(request.headers.get("Origin"));if(request.method==="OPTIONS")return new Response(null,{status:204,headers});if(request.method!=="POST")return json({error:"Method not allowed"},405,headers);if(!env.MISTRAL_API_KEY)return json({error:"VANES image generation is not configured. Add MISTRAL_API_KEY to the Cloudflare Worker secrets."},500,headers);let body;try{body=await request.json()}catch{return json({error:"Invalid JSON body."},400,headers)}const prompt=typeof body?.prompt==="string"?body.prompt.trim():"";if(!prompt)return json({error:"Please describe the image you want."},400,headers);const model=typeof env.MISTRAL_IMAGE_MODEL==="string"&&env.MISTRAL_IMAGE_MODEL.trim()?env.MISTRAL_IMAGE_MODEL.trim():(env.MISTRAL_MODEL||"codestral-latest");const imagePrompt=`Create ONE self-contained SVG illustration for this request: ${prompt}\nReturn ONLY valid SVG markup. Use a 1200x800 viewBox. Make it polished, clear and faithful to the request. Use shapes, paths, gradients and filters where useful. Only include text if explicitly requested. Do not use script, foreignObject, iframe, object, embed, external URLs, external images or HTML.`;try{const upstream=await fetch("https://api.mistral.ai/v1/chat/completions",{method:"POST",headers:{Authorization:"Bearer "+env.MISTRAL_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({model,messages:[{role:"system",content:"You generate safe, self-contained SVG images."},{role:"user",content:imagePrompt}],temperature:.4,max_tokens:2200,stream:false})});const raw=await upstream.text();let data=null;try{data=raw?JSON.parse(raw):null}catch(_){}if(!upstream.ok)return json({error:"VANES could not generate the image.",detail:readableError(data?.error||data,raw||("Mistral returned HTTP "+upstream.status)),code:upstream.status,provider:"Mistral",model},upstream.status,headers);let svg=extractText(data).trim().replace(/^\`\`\`(?:svg|xml)?\s*/i,"").replace(/\s*\`\`\`$/,"").trim();const match=svg.match(/<svg\b[\s\S]*?<\/svg>/i);if(match)svg=match[0];if(!/^<svg\b/i.test(svg)||!/<\/svg>\s*$/i.test(svg))return json({error:"Mistral returned an invalid image. Please try again.",provider:"Mistral",model},502,headers);if(/<\/?(?:script|foreignObject|iframe|object|embed)\b/i.test(svg)||/\s(?:href|xlink:href)\s*=\s*["']https?:/i.test(svg))return json({error:"The generated image failed the safety check. Please try again.",provider:"Mistral",model},502,headers);return json({ok:true,provider:"Mistral",model,image:"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg),format:"svg"},200,headers)}catch(error){return json({error:"VANES could not generate the image.",detail:error?.message||"Network error contacting Mistral.",code:502,provider:"Mistral",model},502,headers)}}
/* GET reads the count the Worker enforces; POST is the same read but first records the
   upgrade code in the X-VANES-Upgrade-Code header, so a code only unlocks Premium here if
   it is one the owner listed in VANES_PREMIUM_CODES. */
async function handleQuota(request,env){
  const headers=cors(request.headers.get("Origin"));
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(request.method!=="GET"&&request.method!=="POST")return json({error:"Method not allowed"},405,headers);
  const token=bearerToken(request);
  if(!token)return json({error:"Sign in to VANES to read your answer count.",code:"missing-token"},401,headers);
  let uid;
  try{uid=(await verifyIdToken(token,env)).uid}
  catch(error){return json({error:error?.message||"Your VANES session is not valid.",code:error?.code||"invalid-token"},401,headers)}
  if(!env.DB)return json({error:"The answer-count database is not configured yet.",code:"no-database"},503,headers);
  const quota=await readQuota(env.DB,uid,env,request.headers.get("X-VANES-Upgrade-Code")||"").catch(()=>null);
  if(!quota)return json({error:"Could not read your answer count.",code:"quota-read-failed"},500,headers);
  return json({ok:true,quota},200,headers);
}
/* The dashboard lives in the Worker rather than the asset bundle so that a request without
   the correct key is indistinguishable from a path that does not exist. */
function handleAdminPage(url,env){
  const key=url.searchParams.get("key")||"";
  const token=typeof env.ADMIN_ANALYTICS_TOKEN==="string"?env.ADMIN_ANALYTICS_TOKEN:"";
  if(!token||key!==token)return new Response("Not found",{status:404,headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}});
  return new Response(adminPage(key),{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow"}});
}
export default {async fetch(request,env){const url=new URL(request.url);if(url.pathname==="/admin-analytics.html")return handleAdminPage(url,env);if(url.pathname==="/api/health")return json({ok:true,worker:"vanes-ai",mistralConfigured:Boolean(env.MISTRAL_API_KEY),analyticsEnabled:Boolean(env.DB),adminAnalyticsConfigured:Boolean(env.ADMIN_ANALYTICS_TOKEN),firebaseProject:firebaseProjectId(env),quotaEnabled:Boolean(env.DB),premiumCodesConfigured:Boolean(env.VANES_PREMIUM_CODES),premiumDays:Number(env.VANES_PREMIUM_DAYS)>0?Number(env.VANES_PREMIUM_DAYS):30,codeCounterEnabled:Boolean(env.DB),airtelConfigured:airtelConfigured(env),donationAmount:donationAmount(env),manualAirtelNumber:Boolean(env.VANES_AIRTEL_NUMBER),manualAirtelName:donationName(env),trialHours:Number(env.VANES_TRIAL_HOURS)>0?Number(env.VANES_TRIAL_HOURS):(Number(env.VANES_TRIAL_DAYS)>0?Number(env.VANES_TRIAL_DAYS)*24:24),chatProvider:"Mistral / Codestral",chatModel:env.MISTRAL_MODEL||"codestral-latest",contactDelivery:{resend:Boolean(env.RESEND_API_KEY),web3forms:Boolean(env.WEB3FORMS_ACCESS_KEY),formsubmit:true,twilio:Boolean(env.TWILIO_ACCOUNT_SID&&env.TWILIO_AUTH_TOKEN&&env.TWILIO_FROM_NUMBER&&env.OWNER_PHONE_NUMBER)},visionModel:env.VANES_VISION_MODEL||"pixtral-12b-2409",maxTokens:DEFAULT_MAX_TOKENS,imageMaxTokens:2200,imageModel:env.MISTRAL_IMAGE_MODEL||env.MISTRAL_MODEL||"codestral-latest"});if(url.pathname==="/api/contact")return handleContact(request,env);if(url.pathname==="/api/analytics")return handleAnalytics(request,env);if(url.pathname==="/api/admin/analytics")return handleAdminAnalytics(request,env);if(url.pathname==="/api/quota")return handleQuota(request,env);
if(url.pathname==="/api/pay/airtel")return handlePayAirtel(request,env);if(url.pathname==="/api/pay/airtel/status")return handlePayStatus(request,env,url);if(url.pathname==="/api/pay/airtel/callback")return handlePayCallback(request,env);if(url.pathname==="/api/pay/verify")return handlePayVerify(request,env);
if(url.pathname==="/api/links")return handleLinks(request,env,url);if(url.pathname==="/api/portal")return handlePortal(request,env,url);if(url.pathname==="/api/track/progress")return handleProgress(request,env,url);
if(url.pathname==="/api/parent/code")return handleParentCode(request,env,url);if(url.pathname==="/api/parent/view")return handleParentView(request,env,url);
if(url.pathname==="/api/chat")return handleChat(request,env);if(url.pathname==="/api/image")return handleImage(request,env);
/* The parent page is rendered by the Worker and readable without an account: the code
   in the link is the only secret, so nothing on this page is discoverable by URL guessing. */
if(url.pathname==="/parent")return new Response(parentPage(),{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow"}});
/* Short links answer with a plain 302 to the untouched destination URL, so the video
   quality and every query parameter stay exactly as the student saved them. */
if(url.pathname.startsWith("/s/")){let code=url.pathname.slice(3);try{code=decodeURIComponent(code)}catch(_){}return redirectShort(env,code)}
return env.ASSETS.fetch(request)}};
