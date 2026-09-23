// ─────────────────────────────────────────────────────────────
// Kevcode_Cademy — Cloud Functions
// Deploy with: firebase deploy --only functions
// Requires: `firebase functions:config:set ai.key="YOUR_KEY"`
//   (or, for 2nd-gen functions, set AI_API_KEY as a secret with
//   `firebase functions:secrets:set AI_API_KEY`)
//
// This is the ONLY place an AI API key should ever live. It never
// reaches the browser.
// ─────────────────────────────────────────────────────────────
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

// ---- AI Tutor endpoint ----
// Called from /ai-tutor.html as a signed-in user (ID token in Authorization header).
exports.askTutor = onRequest({ secrets: ["AI_API_KEY"] }, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*"); // tighten to your real domain in production
  if (req.method === "OPTIONS") { res.set("Access-Control-Allow-Methods", "POST"); res.set("Access-Control-Allow-Headers", "Content-Type, Authorization"); return res.status(204).send(""); }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers.authorization || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: "Sign in required" });

  let uid;
  try {
    uid = (await admin.auth().verifyIdToken(idToken)).uid;
  } catch {
    return res.status(401).json({ error: "Invalid session" });
  }

  const question = (req.body?.question || "").toString().slice(0, 2000);
  if (!question.trim()) return res.status(400).json({ error: "Question is required" });

  // Lightweight per-user rate limit: max 30 questions/hour.
  const rlRef = db.collection("ai_rate_limits").doc(uid);
  const rlSnap = await rlRef.get();
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const data = rlSnap.exists ? rlSnap.data() : { count: 0, windowStart: now };
  const resetWindow = now - data.windowStart > windowMs;
  const count = resetWindow ? 0 : data.count;
  if (count >= 30) return res.status(429).json({ error: "Rate limit reached. Try again later." });
  await rlRef.set({ count: count + 1, windowStart: resetWindow ? now : data.windowStart });

  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "AI Tutor is not configured yet." });

  try {
    // Example using Anthropic's Messages API — swap for your provider of choice.
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        system: "You are a patient coding tutor for Kevcode_Cademy. Guide the student toward understanding — ask a clarifying question or explain the underlying concept before giving full code, unless they clearly just need a direct fix.",
        messages: [{ role: "user", content: question }]
      })
    });
    const aiData = await aiRes.json();
    const answer = aiData?.content?.[0]?.text || "I couldn't generate a response — please try rephrasing.";
    res.json({ answer });
  } catch (err) {
    console.error("askTutor error:", err);
    res.status(500).json({ error: "The tutor is temporarily unavailable." });
  }
});

// ---- Certificate issuance ----
// Triggered when an enrollment is updated; issues a certificate ONLY if
// progressPercent reaches 100 and one doesn't already exist. Client code
// can never write to /certificates directly (see firestore.rules).
exports.issueCertificateOnCompletion = onDocumentUpdated("enrollments/{enrollmentId}", async (event) => {
  const after = event.data.after.data();
  if (!after || after.progressPercent < 100) return;

  const certId = `${after.uid}_${after.courseId}`;
  const certRef = db.collection("certificates").doc(certId);
  const existing = await certRef.get();
  if (existing.exists) return;

  const [userSnap, courseSnap] = await Promise.all([
    db.collection("users").doc(after.uid).get(),
    db.collection("courses").doc(after.courseId).get()
  ]);

  await certRef.set({
    certificateId: certId,
    uid: after.uid,
    studentName: userSnap.data()?.name || "Student",
    courseId: after.courseId,
    courseTitle: courseSnap.data()?.title || "Course",
    issuedAt: admin.firestore.FieldValue.serverTimestamp()
  });
});
