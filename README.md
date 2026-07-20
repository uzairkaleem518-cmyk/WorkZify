# WorkZify — MVP (MERN, Free-Tier Stack)

A hyper-local professional marketplace app — verified worker profiles,
search, ratings, and one-tap Call/WhatsApp contact. Built entirely on **free-tier
infrastructure**, with a distinctive visual identity and hardened backend security.

## Design — "truck-art trust seal"

Rather than a generic SaaS look, the UI takes its palette and signature motifs from
Pakistani truck art and official document stamps — a deliberate choice for an app whose
whole value proposition is *trust in a stranger's identity*.

- **Palette:** deep teal (primary/trust), marigold (availability/accent), rani-pink
  (alerts), on a warm ivory canvas in light mode and a dusk-market indigo in dark mode.
- **Type:** Baloo 2 (rounded, hand-painted-sign character) for headings, Inter for body
  text, Noto Nastaliq Urdu wired in for Urdu content.
- **Signature element:** a rosette "verified" seal (`VerifiedSeal.jsx`) modeled on
  CNIC/document approval stamps and truck-art rosettes, shown on every approved worker's
  photo. A scalloped divider (the truck-art panel-seam motif) separates the search hero
  from the results list.
- **Dark mode:** class-based (`darkMode: "class"` in Tailwind), toggled by
  `ThemeToggle.jsx`, persisted to `localStorage`, with an inline anti-flash script in
  `index.html` so the page never flashes the wrong theme on load. All colors are driven
  by CSS variables (`index.css`) so light/dark share one token system instead of two
  parallel class sets.
- Respects `prefers-reduced-motion`, has visible focus rings everywhere, and skeleton
  loading states instead of spinners.

## Security hardening

| Layer | Measure |
|---|---|
| Transport/headers | `helmet()`, `hpp()` (HTTP param pollution), `compression`, strict production CORS (only configured `CLIENT_URL` origins), 10kb JSON body limit |
| Injection | `express-mongo-sanitize` strips `$`/`.` operators from input; all Mongo `:id` params validated as ObjectIds before querying |
| XSS | Free-text fields (name, bio, review comments) stripped of HTML tags server-side (`utils/sanitize.js`) before storage |
| Auth | JWT with role claim, bcrypt cost factor 12, admin tokens expire in 12h vs 30d for workers/customers |
| Brute force | Per-IP rate limits on OTP send, login endpoints, and global API traffic (`express-rate-limit`); **per-account lockout** after 5 failed logins (15 min), tracked on the Worker/Admin models (`utils/loginGuard.js`) |
| OTP | Generated with `crypto.randomInt` (CSPRNG, not `Math.random`), **stored as a SHA-256 hash** (never plaintext), compared with `crypto.timingSafeEqual`, capped at 5 verify attempts, 10 min expiry |
| PII at rest | CNIC numbers encrypted with AES-256-GCM (`utils/crypto.js`) before being written to MongoDB; a separate keyed hash allows duplicate-CNIC detection without decrypting existing records; CNIC is **never** returned by any public/customer-facing endpoint, only decrypted for the admin verification screen |
| Mass assignment | Profile updates use an explicit field allow-list, not a deny-list |
| Enumeration | Login failures return one generic "Invalid credentials" message regardless of whether the account exists |
| Fail-fast config | Server refuses to start if `JWT_SECRET` or `ENCRYPTION_KEY` are missing/weak, so it can't run in a silently insecure state |
| Error handling | Generic error responses to clients; full stack traces only ever go to the server console, never the API response |

**Known tradeoff, documented on purpose:** tokens are kept in `localStorage` rather than
an httpOnly cookie, so the app avoids CSRF-token plumbing but is technically exposed to
token theft if an XSS bug ever slipped through. The XSS-stripping above is the primary
mitigation; if you need a stronger guarantee, switch to httpOnly cookie sessions before
handling real customer PII at scale.

## What's included

- **backend/** — Node.js + Express + MongoDB (Mongoose)
- **frontend/** — React (Vite) + Tailwind CSS, dark mode, truck-art design system

## Why this replaces the paid APIs from the original PRD

| PRD suggestion | Cost | Replaced with |
|---|---|---|
| D7 Networks / Twilio SMS OTP | ~$0.02–0.47/SMS | Email OTP via Gmail SMTP (free), console fallback for dev |
| NADRA Verisys CNIC check | ~PKR 15/check | Manual admin review of CNIC (now AES-256-GCM encrypted at rest) + uploaded docs |
| Tasdeeq background check | Paid/complex | Skipped for MVP — self-declaration + customer reporting/flagging |
| DigitalOcean/AWS hosting | $4–9/mo | MongoDB Atlas free M0 + Render/Railway free web service + Vercel/Netlify frontend |
| Domain | ~PKR 1,000/yr | Free subdomain from hosting provider until revenue starts |

## Setup

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env`:
- `MONGO_URI` — free connection string from [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) (M0 cluster)
- `JWT_SECRET` — generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `ENCRYPTION_KEY` — same command as above, generates the 64-hex-char key used to encrypt CNIC numbers at rest
- `EMAIL_USER` / `EMAIL_PASS` — optional: Gmail address + an [App Password](https://myaccount.google.com/apppasswords). Without it, OTPs print to the server console (fine for local dev)
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — first admin account (password must be 12+ chars, letters + numbers)

Then:

```bash
node seedAdmin.js
npm run dev
```

Backend runs on `http://localhost:5000`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:5173`, proxies `/api` to the backend, dark mode toggle in the
top-right of the nav bar.

### 3. Try it out

1. `/admin/login` → log in with your seeded admin credentials
2. `/worker/register` → register a test worker (use your own email for the OTP, or check the backend console)
3. Approve the worker from the admin dashboard (CNIC is decrypted for your review there, nowhere else)
4. `/` → the approved worker now appears in search
5. `/customer/login` → register as a customer, leave a review
6. Toggle dark mode from the nav bar — preference persists across reloads

## Deploying for free

- **Frontend:** Vercel or Netlify
- **Backend:** Render.com or Railway.app free web service (may sleep after inactivity — fine for an MVP pilot)
- **Database:** MongoDB Atlas free M0 cluster
- **Uptime monitoring:** UptimeRobot free plan
- **Analytics:** Google Analytics 4 (free)

In production, also set `NODE_ENV=production` (disables the dev-only OTP echo in API
responses) and serve everything over HTTPS — `helmet`'s HSTS header and secure cookies
(if you switch to cookie-based auth) both depend on it.

For production, `CLIENT_URL` is mandatory and may contain multiple comma-separated
HTTPS frontend origins. The server refuses to start without it, preventing an
accidentally open CORS policy.

## Next steps

- Image upload for photos/CNIC/selfie (Cloudinary free tier)
- Full Urdu UI localization (i18next) — font and RTL groundwork already in place
- Push notifications (Firebase Cloud Messaging — free)
- WhatsApp Cloud API (Meta, free tier) as an alternative OTP delivery channel
