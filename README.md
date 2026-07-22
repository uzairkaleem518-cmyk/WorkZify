
# WorkZify

A local professional marketplace connecting customers with verified local workers — plumbers, electricians, drivers, and other trades — in their neighborhood. Customers search by category and area, view worker ratings, and contact them directly. Workers register, get identity-reviewed and approved by an admin, and manage their own availability and profile.

---

## Table of Contents

- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Security](#security)
- [Local Development Setup](#local-development-setup)
- [Environment Variables](#environment-variables)
- [API Overview](#api-overview)
- [Testing](#testing)
- [Deployment](#deployment)
- [Known Product Decisions](#known-product-decisions)
- [Troubleshooting](#troubleshooting)
- [Roadmap Status](#roadmap-status)

---

## Project Structure

```
workzify/
├── frontend/                 React + Vite + Tailwind CSS
│   ├── src/
│   │   ├── pages/            Route-level pages (Home, WorkerRegister, AdminDashboard, etc.)
│   │   ├── components/       Reusable UI pieces (Navbar, WorkerCard, SearchBar, etc.)
│   │   ├── api/              Axios instance + interceptors
│   │   ├── context/          Theme (dark/light) context
│   │   └── utils/            Client-side validation helpers
│   ├── tests-e2e/            Playwright smoke tests
│   ├── vercel.json           Deployment routing/proxy config
│   └── vite.config.js
│
├── backend/                  Node.js + Express + MongoDB
│   ├── routes/                auth, worker, review, admin, upload endpoints
│   ├── models/                 Mongoose schemas (Worker, Customer, Admin, Review, Otp, BlacklistedToken)
│   ├── middleware/            JWT auth guards (protectWorker, protectAdmin, protectAny)
│   ├── utils/                  OTP, encryption, sanitization, login-lockout helpers
│   ├── config/                 MongoDB + Cloudinary connection setup
│   ├── tests/                  Vitest backend test suite
│   ├── api/index.js            Vercel serverless entry point
│   ├── netlify/functions/      Netlify Functions entry point (alternative deploy target)
│   ├── env.js                  Loads .env first, before any other import
│   ├── server.js               Express app definition + entry point
│   └── .env.example
│
└── README.md                  (this file)
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, React Router v6, Tailwind CSS, Axios |
| Backend | Node.js (ESM), Express, Mongoose (MongoDB Atlas) |
| Auth | JWT (access tokens), bcrypt password hashing, token-blacklist logout |
| Image storage | Cloudinary (public profile photos, private identity documents) |
| Testing | Vitest + Supertest (backend), Playwright (frontend smoke tests) |
| Deployment | Vercel (serverless functions for backend, static build for frontend) |

## Features

**Customer-facing**
- Search workers by category, area, and availability
- View worker profiles with ratings, fee, experience, languages
- Submit and read reviews (one review per customer per worker)

**Worker-facing**
- Registration with phone/email OTP verification
- Optional profile photo upload
- Optional CNIC + selfie identity documents (for admin trust verification)
- Profile editing, availability toggle, password change
- Dashboard showing verification status (pending / approved / rejected / suspended)

**Admin-facing**
- Approve / reject / suspend workers
- Review moderation (delete flagged reviews, with automatic rating recalculation)
- Dashboard stats (total workers, active workers, pending approvals, reviews, average rating)
- Decrypted CNIC view for identity review (never exposed on any public endpoint)

**Platform**
- DB-aware health-check endpoint (`/api/health`) for uptime monitoring
- Rate limiting on OTP requests and login attempts
- Account lockout after repeated failed login attempts
- JWT logout that blacklists the specific token used (other sessions stay valid)

## Security

- Passwords hashed with bcrypt (cost factor 12)
- CNIC numbers, when provided, are **encrypted at rest** (AES) with a separate keyed hash used only for duplicate-detection — never decrypted just to compare
- Identity documents (CNIC/selfie) stored as **Cloudinary private assets**, never public delivery URLs; admin views them via short-lived signed URLs (5-minute expiry)
- `express-mongo-sanitize` and `hpp` guard against NoSQL injection and HTTP parameter pollution
- `helmet` for standard security headers
- Generic error messages on login (doesn't reveal whether a phone number is registered)
- Malformed MongoDB ObjectIds rejected before hitting the database

## Local Development Setup

### Prerequisites
- Node.js 20.x (pinned in `backend/package.json` — using a different major version, especially 22+/24+, has caused MongoDB driver TLS issues on some platforms)
- A MongoDB Atlas cluster (free M0 tier is enough)
- A Cloudinary account (free tier)

### Backend

```bash
cd backend
npm install
```

Create `backend/.env` (see `.env.example` for the full annotated list). Minimum required:

```env
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<dbname>?retryWrites=true&w=majority
JWT_SECRET=<random string, 20+ characters>
JWT_REFRESH_SECRET=<random string, 20+ characters>
ENCRYPTION_KEY=<64-character hex string>
CLOUDINARY_CLOUD_NAME=<from Cloudinary dashboard>
CLOUDINARY_API_KEY=<from Cloudinary dashboard>
CLOUDINARY_API_SECRET=<from Cloudinary dashboard>
```

Generate `ENCRYPTION_KEY`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Seed an admin account:
```bash
npm run seed:admin
```

Run the backend:
```bash
npm run dev     # nodemon, restarts on file changes
npm start       # plain node, for production-like runs
```

Runs on `http://localhost:5000` by default (`PORT` env var overrides this).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:5173`. In dev, `/api/*` requests are proxied to `http://localhost:5000` (see `vite.config.js`) — **the backend must be running locally** for the frontend to work in dev mode.

## Environment Variables

Full reference lives in `backend/.env.example`. Key names to get exactly right:

| Variable | Notes |
|---|---|
| `MONGO_URI` | **Not** `MONGODB_URI` — a common typo that silently breaks the DB connection |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Minimum 20 characters, unique per environment (don't reuse dev secrets in production) |
| `ENCRYPTION_KEY` | Must be exactly 64 hex characters (32 bytes) |
| `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` | From Cloudinary dashboard — required for any image upload to work |
| `CLIENT_URL` | Must exactly match the deployed frontend origin (used for CORS) |
| `NODE_ENV` | Set to `production` on deployed environments |

## API Overview

Base path: `/api`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/health` | none | DB-aware health check |
| POST | `/auth/otp/send` | none (rate-limited) | Send OTP for registration/login |
| POST | `/auth/worker/register` | none | Register a new worker (pending approval) |
| POST | `/auth/worker/login` | none (rate-limited) | Worker login |
| PUT | `/auth/worker/change-password` | worker | Change password (revokes current session) |
| POST | `/auth/customer/register` | none | Lightweight customer registration |
| POST | `/auth/logout` | any | Revoke (blacklist) the current token |
| GET | `/workers` | none | Search/list approved workers |
| GET | `/workers/categories` | none | List available trade categories |
| GET | `/workers/:id` | none | Public worker profile |
| PUT | `/workers/me/profile` | worker | Edit own profile |
| POST | `/reviews` | customer | Submit a review (one per worker per customer) |
| POST | `/uploads` | none (rate-limited) | Upload a profile photo |
| POST | `/uploads/identity` | none (OTP-gated) | Upload CNIC/selfie (private asset) |
| POST | `/admin/login` | none (rate-limited) | Admin login |
| GET | `/admin/workers` | admin | List workers by status |
| PATCH | `/admin/workers/:id/approve` | admin | Approve a worker |
| PATCH | `/admin/workers/:id/reject` | admin | Reject a worker |
| PATCH | `/admin/workers/:id/suspend` | admin | Suspend a worker |
| GET | `/admin/reviews` | admin | List all reviews (moderation) |
| DELETE | `/admin/reviews/:id` | admin | Delete a review (recalculates rating) |
| GET | `/admin/stats` | admin | Dashboard KPIs |

## Testing

**Backend (Vitest + Supertest):**
```bash
cd backend
npm test
```
Covers registration (including OTP consumption), login success/failure, logout token-blacklisting, review duplicate handling, and upload success/failure — all against mocked models, no real database required.

**Frontend smoke tests (Playwright):**
```bash
cd frontend
npx playwright test
```
Covers home search, registration screens, dashboard navigation, and admin login. All `/api/*` calls are mocked (see `tests-e2e/mocks.js`) so these run without a live backend or database.

## Deployment

Both frontend and backend are deployed on **Vercel**, as two separate projects from the same GitHub repo (this is a monorepo — set each project's **Root Directory** accordingly).

| Project | Root Directory | What it deploys |
|---|---|---|
| Backend | `backend` | Serverless function via `api/index.js` |
| Frontend | `frontend` | Static Vite build, with `vercel.json` proxying `/api/*` to the backend URL |

**Deployment steps:**
1. Deploy the backend project first; set all env vars from `.env.example` in Vercel's dashboard.
2. Note the backend's deployed URL; verify `https://<backend-url>/api/health` returns `{"status":"ok","database":"connected"}`.
3. Update `frontend/vercel.json`'s rewrite destination to the backend URL, commit, push.
4. Deploy the frontend project.
5. Update the backend's `CLIENT_URL` env var to the frontend's deployed URL (required for CORS), then redeploy the backend.

An alternative backend deployment target (Netlify Functions) is also supported — see `backend/netlify.toml` and `backend/netlify/functions/api.js`. A Docker-based option (`backend/Dockerfile`) is available for container hosts like Back4app.

## Known Product Decisions

- **CNIC and selfie identity documents are optional** — both at worker registration and at admin approval. This was a deliberate scope reduction from the original design (which required both); profile photo remains optional as it always was.
- The project is intended to launch as a **controlled pilot**, not an immediate mass public release. Urdu/RTL localization and a small-scale pilot with real users are expected before a wider rollout.

## Troubleshooting

**"Must supply api_key" on image upload (local dev only):** Caused by `dotenv.config()` running after other modules (like Cloudinary's config) had already read `process.env` at import time. Fixed by loading env vars via a dedicated `env.js` imported as the *first* line in `server.js`. If this resurfaces, check that no new import was added above `import "./env.js";`.

**MongoDB "Could not connect to any servers" on Vercel:** Almost always either (a) the `MONGO_URI` env var name/value is wrong in Vercel's dashboard, or (b) a Node.js version mismatch — the project pins Node `20.x` via `package.json`'s `engines` field to avoid TLS incompatibilities with the MongoDB driver on newer Node versions.

**Vercel serves a 404 on every route:** Usually means `vercel.json` and/or `api/index.js` weren't pushed to GitHub before the deployment was created. Push them and trigger a redeploy.

**Direct navigation to a frontend route (e.g. `/admin/login`) 404s:** The frontend's `vercel.json` needs a SPA fallback rewrite (`"/((?!api/).*)" → "/index.html"`) in addition to the API proxy rule.

## Roadmap Status

- ✅ Core registration/auth/review/admin functionality
- ✅ Automated backend tests (Vitest) and frontend smoke tests (Playwright)
- ✅ Production deployment (Vercel)
- 🔄 Urdu/RTL localization (in progress)
- ⏳ Controlled pilot run with real users
