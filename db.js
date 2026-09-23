// ─────────────────────────────────────────────────────────────
// Kevcode_Cademy — Firestore data access
// Real reads/writes. No mock data — empty collections render
// empty states, not fabricated content.
// ─────────────────────────────────────────────────────────────
import { db } from "./firebase-config.js";
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ---- Courses ----
export async function listCourses(){
  const snap = await getDocs(query(collection(db, "courses"), where("published", "==", true)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function getCourse(courseId){
  const snap = await getDoc(doc(db, "courses", courseId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ---- Enrollment & progress ----
// Enrollment doc id = `${uid}_${courseId}` so a user can only ever hold one enrollment per course.
export async function enrollInCourse(uid, courseId){
  const ref = doc(db, "enrollments", `${uid}_${courseId}`);
  const existing = await getDoc(ref);
  if (existing.exists()) return existing.data();
  const data = {
    uid, courseId,
    enrolledAt: serverTimestamp(),
    completedLessonIds: [],
    lastLessonId: null,
    progressPercent: 0
  };
  await setDoc(ref, data);
  return data;
}
export async function getUserEnrollments(uid){
  const snap = await getDocs(query(collection(db, "enrollments"), where("uid", "==", uid)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function getEnrollment(uid, courseId){
  const snap = await getDoc(doc(db, "enrollments", `${uid}_${courseId}`));
  return snap.exists() ? snap.data() : null;
}
export async function markLessonComplete(uid, courseId, lessonId, totalLessons){
  const ref = doc(db, "enrollments", `${uid}_${courseId}`);
  const current = await getDoc(ref);
  if (!current.exists()) throw new Error("Not enrolled in this course.");
  const data = current.data();
  const completed = new Set(data.completedLessonIds || []);
  completed.add(lessonId);
  const percent = totalLessons ? Math.round((completed.size / totalLessons) * 100) : 0;
  await updateDoc(ref, {
    completedLessonIds: Array.from(completed),
    lastLessonId: lessonId,
    progressPercent: percent
  });
  return percent;
}

// ---- Contact / service inquiries ----
export async function submitContactMessage({ name, email, subject, message }){
  const ref = doc(collection(db, "messages"));
  await setDoc(ref, { name, email, subject, message, createdAt: serverTimestamp(), status: "new" });
  return ref.id;
}
export async function submitServiceInquiry({ service, name, email, details }){
  const ref = doc(collection(db, "services_inquiries"));
  await setDoc(ref, { service, name, email, details, createdAt: serverTimestamp(), status: "new" });
  return ref.id;
}
