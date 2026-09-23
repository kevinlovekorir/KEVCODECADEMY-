// ─────────────────────────────────────────────────────────────
// Kevcode_Cademy — Authentication
// Wraps Firebase Auth. Every function here does a real network
// call against your Firebase project once firebase-config.js is filled in.
// ─────────────────────────────────────────────────────────────
import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  doc, setDoc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// Human-readable error messages — never show raw Firebase errors to users.
const ERROR_MESSAGES = {
  "auth/email-already-in-use": "That email already has an account. Try logging in instead.",
  "auth/invalid-email": "That doesn't look like a valid email address.",
  "auth/weak-password": "Password must be at least 6 characters.",
  "auth/user-not-found": "We couldn't find an account with that email.",
  "auth/wrong-password": "That password doesn't match this account.",
  "auth/invalid-credential": "Email or password is incorrect.",
  "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
  "auth/network-request-failed": "Network error. Check your connection and try again."
};
export function friendlyAuthError(err){
  return ERROR_MESSAGES[err?.code] || "Something went wrong. Please try again.";
}

// Creates the Firestore user profile doc the rest of the app reads from.
async function createUserDoc(user, extra = {}){
  const ref = doc(db, "users", user.uid);
  const existing = await getDoc(ref);
  if (existing.exists()) return;
  await setDoc(ref, {
    uid: user.uid,
    name: extra.name || user.displayName || "",
    email: user.email,
    role: "student",           // student | instructor | admin — set to admin only via Firebase Console or a trusted server script, never from client code
    createdAt: serverTimestamp(),
    xp: 0,
    streakCount: 0,
    lastActiveDate: null
  });
}

export async function signUp(name, email, password){
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await createUserDoc(cred.user, { name });
  try { await sendEmailVerification(cred.user); } catch (e) { /* non-fatal */ }
  return cred.user;
}

export async function logIn(email, password){
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logInWithGoogle(){
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  await createUserDoc(cred.user);
  return cred.user;
}

export async function logOut(){
  await signOut(auth);
}

export async function resetPassword(email){
  await sendPasswordResetEmail(auth, email);
}

export function getUserProfile(uid){
  return getDoc(doc(db, "users", uid)).then(snap => snap.exists() ? snap.data() : null);
}

// Call on any page: fires callback(user, profile|null) once auth state is known.
export function watchAuth(callback){
  return onAuthStateChanged(auth, async (user) => {
    if (!user) return callback(null, null);
    const profile = await getUserProfile(user.uid);
    callback(user, profile);
  });
}

// Guards a page: redirects to /login.html if not signed in.
// Usage at top of a protected page's script: requireAuth(user => { ...render... });
export function requireAuth(onReady){
  watchAuth((user, profile) => {
    if (!user) {
      window.location.href = "/login.html?next=" + encodeURIComponent(window.location.pathname);
      return;
    }
    onReady(user, profile);
  });
}

// Guards admin-only pages/sections.
export function requireAdmin(onReady, onDenied){
  requireAuth((user, profile) => {
    if (profile?.role !== "admin") {
      if (onDenied) onDenied();
      else window.location.href = "/dashboard.html";
      return;
    }
    onReady(user, profile);
  });
}
