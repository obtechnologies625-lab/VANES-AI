/* VANES AI — Firebase Auth and Firestore bridge.
   ES module loaded from index.html; classic scripts read window.VANES_FB.
   The web config below is a public identifier, not a credential: Firebase ships it
   to every browser. Access is governed by the Firestore rules in firestore.rules. */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  updateProfile,
  signOut,
  onAuthStateChanged,
  browserLocalPersistence,
  setPersistence
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyC5Orh5ubOLVLbkBOp-H9oSneNBOgTvlQk',
  authDomain: 'vanes-ai.firebaseapp.com',
  projectId: 'vanes-ai',
  storageBucket: 'vanes-ai.firebasestorage.app',
  messagingSenderId: '473661888059',
  appId: '1:473661888059:web:0e71ea21406f4e29b46e1e'
};

const SDK = '12.19.0';
const COLLECTION = 'learners';
let auth = null, db = null, initError = null;

try {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  setPersistence(auth, browserLocalPersistence).catch(() => {});
} catch (e) {
  initError = e;
}

const MESSAGES = {
  'auth/email-already-in-use': 'That email already has a VANES account — use Sign in instead.',
  'auth/invalid-email': 'That email address is not valid.',
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/user-not-found': 'No VANES account with that email yet — create one first.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Wait a minute, then try again.',
  'auth/network-request-failed': 'Cannot reach Firebase right now. VANES still works offline with this device’s profile.',
  'auth/configuration-not-found': 'Sign-in is not switched on yet: Firebase console → Authentication → Sign-in method → enable Email/Password and Google.',
  'auth/operation-not-allowed': 'Email/password sign-in is switched off in Firebase: console → Build → Authentication → Sign-in method → Email/Password → Enable.',
  'auth/admin-restricted-operation': 'This sign-in method is restricted in Firebase: console → Build → Authentication → Sign-in method.',
  'auth/invalid-api-key': 'Firebase rejected the web config API key — recopy it from Project settings → Your apps.',
  'auth/api-key-not-valid': 'Firebase rejected the web config API key — recopy it from Project settings → Your apps.',
  'auth/invalid-project-id': 'The Firebase projectId in the web config does not exist.',
  'auth/unauthorized-domain': 'This domain is not authorised for Google sign-in: Firebase console → Authentication → Settings → Authorized domains.',
  'auth/operation-not-supported-in-this-environment': 'This browser blocks the Google pop-up. Add this domain under Authorized domains, or allow pop-ups for VANES.',
  'auth/popup-blocked': 'Your browser blocked the Google pop-up. Allow pop-ups for VANES and try again.',
  'auth/popup-closed-by-user': 'Google sign-in was cancelled before it finished.',
  'auth/cancelled-popup-request': 'Google sign-in was cancelled before it finished.',
  'auth/account-exists-with-different-credential': 'That Google account already belongs to a VANES account created another way — sign in the way you first used.',
  'auth/requires-recent-login': 'For security, sign in again before changing account details.',
  'permission-denied': 'Firestore refused this sync — the rules in firestore.rules are not published yet.',
  'unavailable': 'Firestore is unreachable (offline, or the database has not been created yet).',
  'failed-precondition': 'Firestore is not ready yet — create the database in the Firebase console, then reload.'
};

function friendly(err) {
  const code = err?.code || '';
  const bare = String(code).replace(/^auth\//, 'auth/');
  if (MESSAGES[code]) return MESSAGES[code];
  if (MESSAGES[bare]) return MESSAGES[bare];
  const text = String(err?.message || code || 'Sign-in failed.');
  for (const key of Object.keys(MESSAGES)) if (text.includes(key)) return MESSAGES[key];
  return text;
}

const account = user => user ? {
  uid: user.uid,
  email: user.email || '',
  name: user.displayName || (user.email || '').split('@')[0],
  phone: user.phoneNumber || '',
  photoURL: user.photoURL || '',
  provider: user.providerData?.[0]?.providerId || 'password',
  google: !!user.providerData?.some(p => p.providerId === 'google.com')
} : null;

/* Firestore retries a write forever while its backend is unavailable, so anything on the
   sign-in path must not await it — a learner would sit on a busy form that never finishes. */
function settle(promise, ms) {
  let t;
  return Promise.race([
    promise.finally(() => clearTimeout(t)),
    new Promise((_, rej) => { t = setTimeout(() => rej(Object.assign(new Error('Firestore did not respond in time.'), { code: 'unavailable' })), ms); })
  ]);
}

async function afterSignIn(user, extra) {
  if (!user || !db) return account(user);
  settle(setDoc(doc(db, COLLECTION, user.uid), {
    email: user.email || '',
    name: user.displayName || '',
    phone: user.phoneNumber || '',
    provider: extra?.provider || 'password',
    createdAt: extra?.createdAt || serverTimestamp(),
    lastSignInAt: serverTimestamp()
  }, { merge: true }), 8000).catch(() => {});
  return account(user);
}

async function signUp(email, password, name, phone) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (name) await updateProfile(cred.user, { displayName: name }).catch(() => {});
  const a = await afterSignIn(cred.user, { provider: 'password', createdAt: serverTimestamp() });
  return { ...a, name: name || a.name, phone: phone || '' };
}

async function signIn(email, password, phone) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const a = await afterSignIn(cred.user, { provider: 'password' });
  return { ...a, phone: phone || a.phone };
}

async function signInGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const cred = await signInWithPopup(auth, provider);
    return await afterSignIn(cred.user, { provider: 'google' });
  } catch (err) {
    const code = err?.code || '';
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw err;
  }
}

async function finishRedirect() {
  if (!auth) return null;
  try {
    const res = await getRedirectResult(auth);
    return res?.user ? await afterSignIn(res.user, { provider: 'google' }) : null;
  } catch (err) {
    return { error: friendly(err) };
  }
}

async function signOutNow() { if (auth) await signOut(auth); }

function watch(cb) {
  if (!auth) { cb(null); return () => {}; }
  return onAuthStateChanged(auth, user => cb(user ? account(user) : null));
}

/* The auth object is module-private on purpose — callers ask for user() so they cannot
   hold a stale reference after a sign-out. */
const user = () => (auth && auth.currentUser) || null;

async function idToken(force) {
  const current = user();
  if (!current) return '';
  return await current.getIdToken(!!force);
}

async function pull() {
  const current = user();
  if (!current || !db) return null;
  const snap = await settle(getDoc(doc(db, COLLECTION, current.uid)), 10000);
  return snap.exists() ? snap.data() : null;
}

async function push(patch) {
  const current = user();
  if (!current || !db) return false;
  await settle(setDoc(doc(db, COLLECTION, current.uid), { ...patch, syncedAt: serverTimestamp() }, { merge: true }), 12000);
  return true;
}

window.VANES_FB = {
  ok: !!auth,
  hasFirestore: !!db,
  sdk: SDK,
  collection: COLLECTION,
  projectId: firebaseConfig.projectId,
  initError: initError ? friendly(initError) : '',
  friendly, account, user,
  signUp, signIn, signInGoogle, finishRedirect, signOut: signOutNow,
  watch, idToken, pull, push
};
window.dispatchEvent(new CustomEvent('vanes-firebase-ready', { detail: { ok: !!auth } }));
