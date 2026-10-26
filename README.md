# UMD Tennis Court Alerts

Get email notifications when Eppley tennis court reservation slots open on UMD's Planyo booking system.

## Features

- **Live availability grid** — see which 1-hour slots have open courts (next 3 days)
- **Email verification** — confirm address before watches go live
- **Email alerts** — via [Resend](https://resend.com) when a slot opens or a court frees up
- **One-click unsubscribe** — in every alert email
- **Discord webhooks** — optional push to your phone
- **Browser notifications** — while the tab is open
- **Health endpoint** — `/api/health` for cron / uptime monitors
- **Deployable** — Vercel + Upstash Redis + a poll every 5 minutes

## Quick start (local)

```bash
npm install
cp .env.example .env.local
# Add RESEND_API_KEY from https://resend.com (free)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), click **Watch**, enter your email.

> With Resend's free `onboarding@resend.dev` sender, you can only email **your Resend account email** until you verify a domain.

## Deploy to Vercel

### 1. Create free accounts

| Service | Why |
|---------|-----|
| [Resend](https://resend.com) | Send email alerts |
| [Upstash Redis](https://upstash.com) | Persist watches (Vercel has no disk) |
| [Vercel](https://vercel.com) | Host the Next.js app |

### 2. Push & import

```bash
# from this repo
npx vercel
```

Or: Vercel Dashboard → Add New Project → Import `developer-az/tennis-court-reserve-umd`.

### 3. Set environment variables

In Vercel → Project → Settings → Environment Variables:

```
RESEND_API_KEY=re_...
EMAIL_FROM=UMD Tennis Alerts <onboarding@resend.dev>
UPSTASH_REDIS_REST_URL=https://....upstash.io
UPSTASH_REDIS_REST_TOKEN=...
CRON_SECRET=long-random-string
TOKEN_SECRET=another-long-random-string
APP_URL=https://YOUR-APP.vercel.app
```

Optional: `SENTRY_DSN` for error reporting.

Redeploy after saving.

### 4. Polling (important)

Vercel Hobby only runs the cron in `vercel.json` **once per day** (noon UTC). That is too slow for slot-open alerts: a court can book up in minutes, and `/api/health` treats data older than 15 minutes as stale.

**Option A — GitHub Actions every 5 minutes (recommended on Hobby)**

This repo’s public `Poll` workflow calls `POST /api/poll` on that cadence. GitHub’s shortest schedule is 5 minutes, which stays inside the health window and does not need another account. Upstash QStash’s free tier is 1,000 messages/day, so a true every-minute schedule (1,440/day) does not fit there.

After the workflow is on `master`, add repository secrets (Settings → Secrets and variables → Actions) with the same values as Vercel:

- `APP_URL` — `https://YOUR-APP.vercel.app`
- `CRON_SECRET` — the bearer token

You can run it once from the Actions tab with **Run workflow** to confirm. The daily Vercel cron stays as a backup if those secrets are missing; open alerts still fire once on that backup, but they will be late and health will show down for most of the day.

**Option B — Vercel Pro**

Change `vercel.json` to `* * * * *` for every-minute checks.

**Option C — any other scheduler**

`POST https://YOUR-APP.vercel.app/api/poll` with header `Authorization: Bearer YOUR_CRON_SECRET`. Do not put the secret in the query string.

Point an uptime monitor at `https://YOUR-APP.vercel.app/api/health` (expects `status: ok` when polling is fresh).

## How booking works

| Setting | Value |
|---------|-------|
| Courts | 8 |
| Hours | 6 AM – midnight |
| Slot length | 1 hour |
| Booking window | 48 hours ahead |

A Friday 4 PM slot opens for booking Wednesday 4 PM.

## Notifications

1. Click **Watch** on a slot
2. Enter your **email** and confirm via the verification link
3. Choose:
   - **On open** — when the 48h window opens
   - **On available** — when a court frees up (cancellation)

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/availability?days=3` | GET | Upcoming slot availability |
| `/api/watches?email=` | GET/POST/DELETE | Manage watches (scoped by email) |
| `/api/notifications?email=` | GET | Your recent alerts |
| `/api/poll` | GET/POST | Run checks (requires `CRON_SECRET` in production) |
| `/api/health` | GET | Poller / system health (for uptime monitors) |
| `/api/verify?token=` | GET | Confirm email (from verification message) |
| `/unsubscribe?token=` | GET | Cancel all watches for that email |
| `/api/slot?date=...&hour=...` | GET | Live Planyo slot search |

## Production hardening

- Email-scoped watches/notifications; cancel requires matching email
- Email verification before watches become active (when Resend is configured)
- Unsubscribe + re-opt-in via verify link
- Rate limits (Redis-backed with Upstash)
- Caps: 12 watches/email, 400 active watches total
- Durable notification cooldowns (Redis `SET NX`)
- Store write lock to reduce Redis race conditions
- Retention prune on each poll (old watches/notifications)
- Security headers (CSP, frame deny, nosniff)
- Optional Sentry via `SENTRY_DSN`
- Dependabot + GitHub Actions CI (`npm run ci`)

## CI

GitHub Actions runs typecheck, unit tests, and production build on every push/PR. Commits must not include Cursor/Claude agent attribution (`Co-authored-by: Cursor`, and similar); `npm install` enables `.githooks/commit-msg` to strip those trailers locally, and CI rejects them on push/PR.

## Local storage

Without Upstash, watches are stored in `data/store.json` (fine for local / Railway with disk).

## Brand mark

The header and browser-notification icon use `public/brand-mark.svg`, an original geometric turtle shell in red, gold, and black. This app is unofficial. It does not include UMD’s Terrapin logo, wordmark, or any other licensed university mark.

To use an officially licensed asset later, replace `public/brand-mark.svg` with a square SVG of the same name. The header and notification icon both load that path, so no component changes are required.

## Disclaimer

Unofficial community tool using public Planyo endpoints. Not affiliated with UMD, RecWell, or Planyo.
