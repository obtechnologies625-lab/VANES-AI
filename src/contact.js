const OWNER_EMAIL = "obtechnologies625@gmail.com";
const OWNER_AIRTEL_NUMBER = "";
const OWNER_AIRTEL_NETWORK = "Airtel";
const FORM_SUBMIT_URL = "https://formsubmit.co/ajax/" + encodeURIComponent(OWNER_EMAIL);
const allowed = new Set(["donation","family","field","feedback","rating"]);

function json(data,status=200){
  return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"POST,OPTIONS"}});
}
function clean(v,max=500){return String(v??"").trim().slice(0,max)}
function validEmail(v){return !v||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)}
function textFor(type,p){
  if(type==="donation")return `VANES DONATION REQUEST\nAmount: ${clean(p.amount,30)} ${clean(p.currency,10)}\nMethod: ${clean(p.method,30)}\nName: ${clean(p.name,100)}\nPhone: ${clean(p.phone,40)}\nEmail: ${clean(p.email,150)}`;
  if(type==="family")return `VANES FAMILY MEMBERSHIP REQUEST\nName: ${clean(p.name,100)}\nPhone: ${clean(p.phone,40)}\nEmail: ${clean(p.email,150)}`;
  if(type==="field")return `OB TECH-LABS FIELD INTEREST\nName: ${clean(p.name,100)}\nPhone: ${clean(p.phone,40)}\nEmail: ${clean(p.email,150)}`;
  if(type==="rating")return `VANES USER RATING\nRating: ${clean(p.rating,10)}/5\nComment: ${clean(p.comment,3000)}\nEmail: ${clean(p.email,150)}`;\n  return `VANES FEEDBACK\nComment: ${clean(p.comment,3000)}\nEmail: ${clean(p.email,150)}`;
}
async function email(text,subject,p){
  try{
    const form=new URLSearchParams();
    form.set("name",clean(p.name,100));
    form.set("email",clean(p.email,150));
    form.set("phone",clean(p.phone,40));
    form.set("subject",subject);
    form.set("message",text);
    form.set("_captcha","false");
    form.set("_template","table");
    const r=await fetch(FORM_SUBMIT_URL,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:form});
    const raw=await r.text();
    let data=null; try{data=raw?JSON.parse(raw):null}catch(_){}
    if(r.ok && data?.success !== false)return {ok:true};
    const detail=clean(data?.message||data?.error||raw||("HTTP "+r.status),500);
    return {ok:false,detail:`FormSubmit HTTP ${r.status}: ${detail}`};
  }catch(error){
    return {ok:false,detail:`FormSubmit network error: ${clean(error?.message||error,500)}`};
  }
}
async function sms(env,text){
  if(!env.TWILIO_ACCOUNT_SID||!env.TWILIO_AUTH_TOKEN||!env.TWILIO_FROM_NUMBER||!env.OWNER_PHONE_NUMBER)return {ok:false,configured:false};
  try{
    const body=new URLSearchParams({To:env.OWNER_PHONE_NUMBER,From:env.TWILIO_FROM_NUMBER,Body:text.slice(0,1500)});
    const auth=btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
    const r=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,{method:"POST",headers:{Authorization:"Basic "+auth,"Content-Type":"application/x-www-form-urlencoded"},body});
    return r.ok?{ok:true,configured:true}:{ok:false,configured:true,detail:`SMS HTTP ${r.status}`};
  }catch(error){return {ok:false,configured:true,detail:`SMS network error: ${clean(error?.message||error,300)}`}}
}
export async function handleContact(request,env){
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"POST,OPTIONS"}});
  if(request.method!=="POST")return json({error:"Method not allowed"},405);
  let b;try{b=await request.json()}catch{return json({error:"Invalid request."},400)}
  const type=clean(b?.type,30),p=b?.payload||{};
  if(!allowed.has(type))return json({error:"Unsupported request."},400);
  if(!clean(p.name,100)&&type!=="feedback")return json({error:"Name is required."},400);
  if(!clean(p.phone,40)&&type!=="feedback")return json({error:"Phone number is required."},400);
  if(type!=="feedback"&&!validEmail(clean(p.email,150)))return json({error:"Please enter a valid email."},400);
  if((type==="feedback"||type==="rating")&&!clean(p.comment,3000)&&type==="feedback")return json({error:"Comment is required."},400);\n  if(type==="rating" && !Number.isFinite(Number(p.rating)) || type==="rating" && Number(p.rating)<1 || type==="rating" && Number(p.rating)>5)return json({error:"Please choose a rating from 1 to 5."},400);
  const text=textFor(type,p);
  const subject={donation:"VANES donation request",family:"VANES family membership request",field:"OB Tech-Labs field interest",feedback:"VANES app feedback",rating:"VANES user rating"}[type];
  const ownerTransactionText=type==="donation"&&env.OWNER_AIRTEL_NUMBER?text+`\n\nPRIVATE OWNER PAYMENT ROUTING: ${OWNER_AIRTEL_NETWORK} ${env.OWNER_AIRTEL_NUMBER}`:text;
  let dbResult={ok:false};\n  if(env.DB){try{await env.DB.prepare("CREATE TABLE IF NOT EXISTS vanes_contact_submissions (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, name TEXT, email TEXT, phone TEXT, payload TEXT, created_at TEXT NOT NULL)").run();await env.DB.prepare("INSERT INTO vanes_contact_submissions (type,name,email,phone,payload,created_at) VALUES (?1,?2,?3,?4,?5,?6)").bind(type,clean(p.name,100)||null,clean(p.email,150)||null,clean(p.phone,40)||null,JSON.stringify(p),new Date().toISOString()).run();dbResult={ok:true}}catch(_){}}\n  const [emailResult,smsResult]=await Promise.all([email(ownerTransactionText,subject,p),sms(env,ownerTransactionText)]);
  if(!emailResult.ok&&!smsResult.ok&&!dbResult.ok){
    const details=[emailResult.detail,smsResult.detail].filter(Boolean).join(" | ");
    return json({error:"VANES could not deliver the request.",detail:details||"No delivery channel is configured.",code:503},503);
  }
  if(type==="donation")return json({ok:true,message:emailResult.ok?"Donation request received. Payment verification is not reported as successful until a supported payment gateway confirms it.":"Donation request received for review."});\n  if(type==="rating")return json({ok:true,message:emailResult.ok?"Rating received. Thank you for helping improve VANES.":"Rating saved for processing. Thank you."});
  return json({ok:true,message:emailResult.ok?"Sent to OB Technologies. Thank you.":"Request sent through the configured notification channel."});
}
