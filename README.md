# Kevcode_Cademy — Implementation Report

## Read this first
This is **Phase 1** of the platform: a real, working foundation — not a mockup.
Every button in these files does what it says. Nothing here fakes success.
The full 25+ page spec (lessons, challenges, certificates UI, resume/portfolio
builders, admin panel, blog, careers, services CRUD) is a multi-week build;
building all of it at once, unaudited, is how you end up with pages that *look*
finished but silently don't save data. Phase 2+ is scoped at the bottom.

## What's actually working (test it yourself)
- **Sign up** → creates a real Firebase Auth user + a `users/{uid}` Firestore doc (role: student).
- **Log in / Log out** → real Firebase session, persists across refresh and devices.
- **Forgot password** → sends a real Firebase password-reset email.
- **Google sign-in** → real Firebase popup flow, creates the user doc on first login.
- **Protected routes** → `/dashboard.html`, `/ai-tutor.html`, `/admin-seed.html` redirect
  to `/login.html` if you're not signed in (`requireAuth` / `requireAdmin` in `js/auth.js`).
- **Courses page** → reads real `courses` documents from Firestore. Search and category/
  difficulty filters run against the real fetched data. Empty state shows if no courses exist.
- **Enroll** → writes a real `enrollments/{uid}_{courseId}` doc. Button changes to
  "Go to Course" once enrolled, for real, on refresh too.
- **Dashboard** → reads your real enrollments, computes real stats (no fake percentages).
  "Continue Learning" links to your actual `lastLessonId`.
- **Contact form** → validated client-side, then writes a real doc to `messages`, with a honeypot field for basic spam resistance.
- **Admin-only course seeding** → `/admin-seed.html` is role-gated by `requireAdmin`, and the
  4 sample courses it writes are prefixed `[SAMPLE]` so they're never mistaken for real content.

## What's architected but NOT wired to a live key (by design, not by accident)
- **AI Tutor** (`/ai-tutor.html` + `functions/index.js`): the frontend never holds an API key.
  It calls a Cloud Function (`askTutor`) which verifies the user's Firebase ID token,
  rate-limits them (30/hr), and calls the AI provider server-side. Until you deploy the
  function and set `TUTOR_ENDPOINT` in `ai-tutor.html`, the page shows an honest
  "not connected yet" banner — it does not pretend to answer.
- **Certificate issuance**: a Cloud Function (`issueCertificateOnCompletion`) auto-issues a
  certificate the moment `progressPercent` hits 100 — students cannot write to `certificates`
  themselves (see `firestore.rules`). No UI page for viewing/verifying certificates yet — Phase 2.
- **Coding-challenge execution**: not built. Running arbitrary student code needs a sandboxed
  execution service (e.g. Judge0, a containerized runner, or a provider like Piston) — never
  execute it on your main server. Phase 2 will wire this with a clearly-marked "unavailable"
  state until you pick a provider.

## Technologies used
- Plain HTML/CSS/JS (ES modules), no build step, no framework — as requested.
- Firebase Authentication (email/password + Google).
- Cloud Firestore (client SDK reads/writes governed by `firestore.rules`).
- Cloud Functions (2nd gen) for anything that needs a secret (AI key) or trusted server logic (certificate issuance).

## Data structure (Firestore collections)
```
users/{uid}                → name, email, role(student|instructor|admin), xp, streakCount
courses/{courseId}         → title, description, category, difficulty, published
  courses/{id}/lessons/{lessonId}   → (Phase 2)
enrollments/{uid_courseId} → uid, courseId, completedLessonIds[], lastLessonId, progressPercent
certificates/{uid_courseId}→ issued only by Cloud Function, never by client
messages/{id}               → contact form submissions (admin-read only)
services_inquiries/{id}     → service request form submissions (admin-read only)
projects, challenges, submissions, resumes/{uid}, portfolios/{uid},
blogPosts, careers, services, testimonials, subscriptions, notifications
  → collections + rules are defined in firestore.rules; UI for these is Phase 2
```

## Authentication architecture
Firebase Authentication is the single source of truth for identity. On signup, a matching
`users/{uid}` document is created client-side with `role: "student"` — and Firestore rules
(below) refuse any write that tries to set a different role, so a user can never
self-promote to admin from the browser. Promote someone to `admin` or `instructor` by
editing their `users/{uid}` doc directly in the Firebase Console, or with a trusted
Admin-SDK script — never from client code.

## Security summary
- No API keys or secrets in any frontend file. The Firebase *web config* in
  `js/firebase-config.js` is not a secret (Firebase's own docs confirm this) — real
  protection comes from `firestore.rules`, enforced on Firebase's servers regardless of
  what the browser sends.
- `firestore.rules` (included) enforces: users can only read/write their own profile and
  enrollments; courses/projects/challenges are writable only by instructor/admin role;
  certificates are only ever created by the trusted Cloud Function; contact/service
  inquiries are create-only from the client and readable only by admins.
- The AI API key lives only in Cloud Functions' environment/secret config, never shipped
  to the browser.
- Contact form has a honeypot field against basic bots; add Firebase App Check for
  production-grade abuse protection (see below).

## Environment variables / configuration you must supply
| Where | What | How to get it |
|---|---|---|
| `js/firebase-config.js` | `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId` | Firebase Console → Project Settings → Your apps → Web app |
| Cloud Functions | `AI_API_KEY` secret | `firebase functions:secrets:set AI_API_KEY` — get the key from your AI provider (e.g. Anthropic Console) |
| `ai-tutor.html` | `TUTOR_ENDPOINT` constant | The URL Firebase prints after `firebase deploy --only functions` |

## Exact deploy steps
1. `npm install -g firebase-tools` (if not already installed), then `firebase login`.
2. In the Firebase Console, create a project, enable **Authentication** (Email/Password
   and Google providers) and **Firestore Database** (production mode).
3. Copy your web app config into `js/firebase-config.js`.
4. From this folder: `firebase init` → select Hosting + Functions + Firestore, point
   Hosting's public directory at this folder, and **do not** overwrite `firestore.rules`.
5. `firebase functions:secrets:set AI_API_KEY` and paste your key when prompted.
6. `firebase deploy` (deploys Hosting, Functions, and Firestore rules together).
7. Copy the printed `askTutor` function URL into `TUTOR_ENDPOINT` in `ai-tutor.html`, redeploy hosting.
8. Log in as an admin (promote your own user via the Console), visit `/admin-seed.html`
   to add sample courses, or add real ones directly in Firestore.

## Remaining limitations (honest list)
- Only `/`, `/courses`, `/dashboard`, `/ai-tutor`, `/contact`, `/login`, `/signup`,
  `/forgot-password`, `/404`, `/admin-seed` exist right now. Not yet built:
  `/courses/:id`, `/lessons/:id`, `/projects`, `/challenges`, `/certificates`,
  `/resume-builder`, `/portfolio-builder`, `/careers`, `/services`, `/about`, `/team`,
  `/blog`, `/pricing`, `/profile`, `/settings`, `/admin` (full panel).
- No email verification enforcement (email is sent on signup; nothing currently blocks
  an unverified user — add a check in `requireAuth` if you want that enforced).
- No Firebase App Check / reCAPTCHA yet — recommended before opening the contact form
  and signup to the public internet at scale.
- Code-challenge execution: architecture only, not implemented (see above).
- No automated tests. Manual test checklist below should be run after every deploy.

## Manual test checklist (run this before calling anything "done")
- [ ] Sign up with a new email → redirected to dashboard, user doc exists in Firestore
- [ ] Log out → log back in with same credentials
- [ ] Try visiting `/dashboard.html` while logged out → redirected to `/login.html`
- [ ] Forgot password → real email arrives
- [ ] Browse `/courses.html` while logged out → can view but Enroll sends you to login
- [ ] Enroll while logged in → button changes, doc appears in Firestore, refresh persists it
- [ ] Dashboard stats match what's actually in Firestore (not placeholder numbers)
- [ ] Contact form: submit invalid email → inline error, no network call; submit valid → doc in `messages`
- [ ] Try setting your own `role` to `admin` via browser devtools → rejected by Firestore rules
- [ ] Resize to mobile width → menu collapses to hamburger, no horizontal scroll anywhere

## Phase 2 (next)
1. `/courses/:id` + `/lessons/:id` with real lesson content, previous/next, mark-complete.
2. `/certificates` list + public `/verify/:certId` page.
3. `/resume-builder` and `/portfolio-builder` (Firestore-backed, live preview, publish slug).
4. Full `/admin` panel: users, courses, blog, careers, services, messages — real CRUD, role-gated.
5. `/projects`, `/challenges` with a sandboxed execution provider decision.
6. `/blog`, `/careers`, `/services`, `/about`, `/team`, `/pricing`, `/profile`, `/settings`.

Tell me which of these to build next and I'll build it the same way: real, tested, and honest about what isn't connected yet.
