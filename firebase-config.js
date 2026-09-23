// ─────────────────────────────────────────────────────────────
// Kevcode_Cademy — Firebase configuration
// ─────────────────────────────────────────────────────────────
// These values come from: Firebase Console → Project Settings →
// General → "Your apps" → Web app → SDK setup and configuration.
//
// IMPORTANT: This is NOT a secret file. Firebase web config values
// are safe to ship in frontend JS by design — real security comes
// from Firestore Security Rules (see /firestore.rules), not from
// hiding these values.
//
// Replace every REPLACE_ME below before deploying.
// ─────────────────────────────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME.appspot.com",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
