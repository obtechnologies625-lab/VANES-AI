# VANES AI

![VANES AI product showcase](assets/vanes-product-showcase.svg)

**VANES AI — Verseversatile Adaptive Neuro Emergent System** is an online, learner-friendly AI study companion designed around the Tanzanian secondary-school curriculum.

![VANES AI six turbine wheel](assets/vanes-turbine-wheel.svg)

**Made by OB Technologies Lab**

![OB Tech-Labs cyberpunk brain](assets/ob-tech-labs-brain.svg)

## 🚀 Use VANES online

The production app is deployed as a **Cloudflare Worker**:

**https://vanes-ai.obtechnologies625.workers.dev**

Students can open the app directly from a phone, tablet, or PC. No Command Prompt, Python, Node.js, or local server is required for normal use.

VANES is also an **installable PWA**. On a phone use the browser menu → *Add to Home screen*; in the app itself an **⬇ Install VANES AI** button appears at the bottom of the sidebar on browsers that support the install prompt (it hides automatically once the app is already installed). The app shell is cached by a service worker, so the interface, saved plans and study shelf still open with no connection — an offline banner explains that AI answers need the internet.

## 🎓 Personal learner profile

VANES asks for the learner profile when the app opens with a new or incomplete profile:

- Full name
- **O-Level / CSEE or Advanced / A-Level**
- O-Level: **all subjects the learner takes** can be selected
- A-Level: the learner chooses an Advanced combination
- A-Level common subjects: **Historia ya Tanzania** and **Academic Communication**
- Profile context is sent to the AI so answers respond to the learner's **level, combination and subjects**, not just their name
- Profile picture can be the VANES default, a picture from the device, or an AI-generated non-identifying avatar

Supported common Advanced combinations include **PCM, PCB, PGM, CBG, CBA, CBN, EGM, ECA, HGE, HGL, HKL, HKA, HEC and HGLi**, with an `OTHER` option for a school-specific combination.

## 🧠 AI Study Coach

- Chat, practise, analyse, mark, summarise and plan in a full-height coach workspace
- **Multiple saved conversations.** Start a new chat or reopen an earlier one from the **☰ History** list; up to 30 conversations are kept on the device, each titled from its first question, and the last 12 messages of the open conversation are sent as context
- **Upload study images for analysis.** Messages containing an image are routed to Mistral's vision model (`pixtral-12b-2409` by default); plain text stays on the chat model
- Generate educational images (returned as self-contained, safety-checked SVG) when the image service is available
- Continue working from subject topic maps

## 📚 Study plans, Study Shelf and tracked sessions

- Create a focused study plan from the planner
- **Save a plan** to the Study Shelf, or **Start** it to open the workspace with real topic chips for that subject
- Starting a plan creates or reuses a shelf entry and begins timing the session; completing it records the seconds studied against that subject and updates the shelf status (`Ready` → `In progress` → `Completed`)
- Keep up to 50 saved plans/sessions on the device and reopen them later with **Study again**

## 📤 Print and export

Every generated plan can be **printed** or **downloaded as Markdown**, and the whole Study Shelf can be printed or downloaded too. The printed sheet reproduces the same steps the learner sees on screen, with a clean black-on-white print stylesheet and `@page` margins so it is usable on paper in a classroom.

## 📊 Dashboard statistics

The dashboard numbers are calculated from study activity recorded on the device:

| Statistic | Meaning |
| --- | --- |
| Study time this week | Minutes studied since Monday, including the session currently running |
| Current streak | Consecutive days with recorded study, counted in **local time** (Tanzania is UTC+3, so an evening session counts for the right day) |
| Curriculum progress | Percentage of subjects at the learner's level that have been studied at least once |

Before any session is recorded these show `—` rather than a fake zero.

## 🧪 Tanzanian examination paper structure

VANES study cards show the paper structure used by its curriculum mapping:

- **Physics, Chemistry and Biology:** Paper 1, Paper 2 and Paper 3
- **Most two-paper Advanced subjects:** Paper 1 and Paper 2
- **Historia ya Tanzania:** Paper 1 only
- **Academic Communication:** Paper 1 only

## 🧭 Curriculum coverage

### O-Level / CSEE

Kiswahili, English Language, Basic Mathematics, Basic Applied Mathematics, History, Geography, Chemistry, Physics, Biology, Civics, Information and Computer Studies, Commerce, Bookkeeping, Agriculture, Food and Nutrition, Fine Art, Music, French, Arabic, Bible Knowledge, Islamic Knowledge, Physical Education, Economics, Business Studies and Computer Applications.

### Advanced / A-Level

Advanced Mathematics, Economics, History, Geography, Physics, Chemistry, Biology, Historia ya Tanzania, Academic Communication, Kiswahili, Computer Science, Accountancy, Commerce, Business Studies and Computer Applications, with combination-aware personalisation.

## 🎨 Cyberpunk identity

VANES AI uses a **six-turbine wheel** visual identity with a cyberpunk neon treatment. OB Technologies Lab uses a **brain surrounded by orbital halos**, also in a cyberpunk technology style. The same identity is used across the app dashboard, navigation branding, the installable icons (`assets/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`) and this README showcase.

## 🔐 AI security and configuration

The frontend talks to the server-side API proxy only; no provider key ever ships to the browser. The secret name depends on the deploy target: the Cloudflare Worker (`src/index.js`) and the Vercel function (`api/chat.js`) use `MISTRAL_API_KEY`, while the Cloudflare Pages function (`functions/api/chat.js`) uses `OPENROUTER_API_KEY`. Never commit a real API key to browser JavaScript, README files, screenshots, or GitHub.

Worker variables and secrets (`src/index.js`):

| Name | Required | Purpose / default |
| --- | --- | --- |
| `MISTRAL_API_KEY` | Yes | Powers `/api/chat` and `/api/image`. Without it both return a clear "not configured" error. |
| `MISTRAL_MODEL` | No | Text chat model. Default `codestral-latest`. |
| `VANES_VISION_MODEL` | No | Model used when a message contains an image. Default `pixtral-12b-2409`. |
| `MISTRAL_IMAGE_MODEL` | No | SVG image-generation model. Defaults to `MISTRAL_MODEL`. |
| `WEB3FORMS_ACCESS_KEY` | No | Contact-form delivery via Web3Forms. A FormSubmit fallback is always available. |
| `RESEND_API_KEY`, `CONTACT_FROM_EMAIL` | No | Alternative contact delivery via Resend. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `OWNER_PHONE_NUMBER`, `OWNER_AIRTEL_NUMBER` | No | SMS notification of contact/donation requests. |
| `DB` | No | D1 database binding for analytics — see [DATABASE_SETUP.md](DATABASE_SETUP.md). |
| `ADMIN_ANALYTICS_TOKEN` | No | Bearer token protecting `/api/admin/analytics`. |

`GET /api/health` reports which of these are actually configured — check it after any deploy rather than trusting a green CI badge.

## 🔒 Privacy

Learner profiles, saved plans, the Study Shelf, chat conversations and study activity are stored in the browser's `localStorage` on the learner's own device. Analytics events use an anonymous browser identifier; question and answer text is only included if the learner explicitly enables the anonymised-learning-data option in Settings. Names, phone numbers and payment credentials are not part of the analytics payload.

## 💻 Run it locally

The app is plain static files — serve the repository root with any static server:

```bash
python -m http.server 8123
# then open http://localhost:8123
```

There is no build step and no `package.json`. Client scripts call the production Worker for AI features, so chat and image analysis work locally as long as you have internet; only `/api/analytics` (which clients call on the same origin) will 404 against a plain static server.

When you change a cached file, bump its `?v=` cache-buster in `index.html`, and bump `const CACHE` in `sw.js` — otherwise an already-installed client keeps serving the old copy.

### Project layout

| Path | Role |
| --- | --- |
| `index.html`, `styles.css`, `vanes-*.css` | App shell and styling |
| `vanes-runtime.js`, `vanes-study-system.js`, `full-chat.js` | Core app: views, planner/shelf/sessions, AI coach and conversations |
| `vanes-profile.js`, `vanes-product-upgrade.js`, `vanes-settings.js`, `vanes-donate.js`, `vanes-notifications.js`, `vanes-mobile.js` | Feature modules |
| `vanes-brand.js`, `vanes-send-fix.js`, `vanes-ai-context-fix.js`, `vanes-functional-fix-v2.js`, `vanes-profile-enforcer.js` | Patch layers loaded after the modules above |
| `vanes-pwa.js`, `sw.js`, `manifest.webmanifest`, `assets/icon-*.png` | Install prompt, offline banner, service worker and icons |
| `src/` | Cloudflare Worker: `index.js` (routes), `contact.js`, `analytics.js` |
| `functions/api/chat.js`, `api/chat.js` | Cloudflare Pages and Vercel fallbacks |
| `wrangler.toml`, `.assetsignore`, `vercel.json` | Deploy configuration |
| `docs/`, `google-apps-script/`, `schema.sql`, `admin-analytics.html` | Supporting material and the private analytics dashboard |

> **Patch layers matter.** `vanes-send-fix.js` listens for `submit` in the capture phase and calls `stopImmediatePropagation()`, so a `submit` handler bound to `#planForm` anywhere else never fires. New planner behaviour belongs inside that file, or behind a `window.VANES_*` hook it calls (the pattern used by `VANES_EXPORT`, `VANES_SAVE_PLAN_SESSION` and `VANES_START_PLAN_SESSION`).

## 🚢 Deployment

Pushing to `main` runs three workflows:

| Workflow | What it does |
| --- | --- |
| **Deploy VANES AI to Cloudflare Workers** | Production. `wrangler deploy` of `src/index.js` with the repo root as static assets. Needs the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets; without them the deploy step is **skipped but the run still reports success**, so always confirm the `Deploy Worker` step conclusion. |
| **Deploy VANES AI** | Publishes the same files to GitHub Pages. Pages has no Worker, so `/api/*` routes do not exist there — it is a mirror, not the production target. |
| **Node.js CI** | `node --check` on every JavaScript file under Node 20, 22 and 24. There is no test suite. |

Because static assets are the repository root, `.assetsignore` decides what is *not* published. Anything that must stay private — `src/`, `.github/`, `schema.sql`, `wrangler.toml`, `admin-analytics.html` — belongs there. Wrangler 4 has no `exclude` key under `[assets]`; adding one is silently ignored and would publish those files (and can also break the 25 MiB asset limit).

Verify a deploy:

```bash
curl -s https://vanes-ai.obtechnologies625.workers.dev/api/health
curl -s https://vanes-ai.obtechnologies625.workers.dev/sw.js | grep "const CACHE"
```

## 🧰 Known issues

- **Analytics are not stored.** The Worker has no `DB` (D1) binding, so every `/api/analytics` POST returns `503` and ratings are silently dropped. The error responses also omit CORS headers, so on a cross-origin deploy the browser reports a CORS failure instead of the real reason. Setup steps are in [DATABASE_SETUP.md](DATABASE_SETUP.md).
- **`/api/health` reports a stale `imageModel`.** Image *chat* routing uses `visionModel` (correct); the `imageModel` field only describes SVG generation.
- **`admin-analytics.html` is not reachable on the Worker** because it is listed in `.assetsignore`, even though `DATABASE_SETUP.md` points at `/admin-analytics.html`.

## 👨‍💻 Made by OB Technologies Lab

VANES AI is a project by **OB Technologies Lab** — building adaptive educational technology for Tanzanian learners.
