/* Firebase ID tokens are verified against Google's public signing keys, so the Worker can
   trust a learner's uid without ever holding a Firebase service-account secret. */
const JWK_URL="https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const KEYS_TTL_MS=3600000,CLOCK_SKEW_SECONDS=60;
let keysCache={at:0,byKid:new Map()};

function b64urlBytes(segment){
  const b64=segment.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-(segment.length%4))%4);
  const binary=atob(b64);
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return bytes;
}

function decodePart(segment){
  return JSON.parse(new TextDecoder().decode(b64urlBytes(segment)));
}

async function signingKeys(){
  if(keysCache.at&&Date.now()-keysCache.at<KEYS_TTL_MS)return keysCache.byKid;
  const response=await fetch(JWK_URL,{cf:{cacheTtl:3600,cacheEverything:true}});
  if(!response.ok)throw new Error("Could not read Google's Firebase signing keys (HTTP "+response.status+").");
  const body=await response.json();
  const byKid=new Map();
  for(const key of body?.keys||[])if(key?.kid)byKid.set(key.kid,key);
  if(!byKid.size)throw new Error("Google returned no Firebase signing keys.");
  keysCache={at:Date.now(),byKid};
  return byKid;
}

export function bearerToken(request){
  const header=request.headers.get("Authorization")||"";
  return header.startsWith("Bearer ")?header.slice(7).trim():"";
}

export function firebaseProjectId(env){
  return typeof env?.FIREBASE_PROJECT_ID==="string"&&env.FIREBASE_PROJECT_ID.trim()?env.FIREBASE_PROJECT_ID.trim():"vanes-ai";
}

/* Throws on any token that is not a current, correctly-issued Firebase ID token. */
export async function verifyIdToken(token,env){
  if(typeof token!=="string"||!token)throw fail("missing","No Firebase ID token was sent.");
  const parts=token.split(".");
  if(parts.length!==3)throw fail("malformed","The Firebase ID token is not a JWT.");
  let header,payload;
  try{header=decodePart(parts[0]);payload=decodePart(parts[1])}catch{throw fail("malformed","The Firebase ID token could not be decoded.")}
  if(header?.alg!=="RS256")throw fail("algorithm","Unsupported token signature algorithm.");
  const projectId=firebaseProjectId(env);
  if(payload.iss!=="https://securetoken.google.com/"+projectId)throw fail("issuer","Token was not issued for the "+projectId+" Firebase project.");
  if(payload.aud!==projectId)throw fail("audience","Token audience does not match the Firebase project.");
  if(typeof payload.sub!=="string"||!payload.sub)throw fail("subject","Token has no user id.");
  const now=Math.floor(Date.now()/1000);
  if(!(Number(payload.exp)>now))throw fail("expired","Your VANES session has expired — sign in again.");
  if(!(Number(payload.iat)<=now+CLOCK_SKEW_SECONDS))throw fail("issued-in-future","Token was issued in the future; check the device clock.");
  if(payload.auth_time&&Number(payload.auth_time)>now+CLOCK_SKEW_SECONDS)throw fail("auth-in-future","Token auth time is in the future; check the device clock.");
  let jwk;
  try{const keys=await signingKeys();jwk=keys.get(header.kid)}catch(error){throw fail("keys-unavailable",error?.message||"Signing keys unavailable.")}
  if(!jwk)throw fail("unknown-key","The token was signed with a key Google no longer publishes.");
  let cryptoKey;
  try{
    cryptoKey=await crypto.subtle.importKey("jwk",{kty:jwk.kty,n:jwk.n,e:jwk.e,alg:"RS256",ext:true},{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
  }catch{throw fail("key-import","Signing key could not be imported.")}
  const valid=await crypto.subtle.verify({name:"RSASSA-PKCS1-v1_5"},cryptoKey,b64urlBytes(parts[2]),new TextEncoder().encode(parts[0]+"."+parts[1])).catch(()=>false);
  if(!valid)throw fail("signature","Token signature did not verify.");
  return {uid:payload.sub,email:typeof payload.email==="string"?payload.email:"",emailVerified:payload.email_verified===true};
}

function fail(code,message){
  const error=new Error(message);
  error.code=code;
  return error;
}
