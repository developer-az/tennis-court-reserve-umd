# UMD Tennis Court Alerts

Get email notifications when Eppley tennis court reservation slots open on UMD's Planyo booking system.

## Features

- **Live availability grid** — see which 1-hour slots have open courts (next 3 days)
- **Email alerts** — via [Resend](https://resend.com) when a slot opens or a court frees up
- **Discord webhooks** — optional push to your phone
- **Browser notifications** — while the tab is open
- **Deployable** — Vercel + Upstash Redis + minute cron

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
```

Redeploy after saving.

### 4. Minute polling (important)

Vercel Hobby only runs crons **once per day**. For slot-open alerts you need **every minute**:

**Option A — free external cron (recommended on Hobby)**

1. Go to [cron-job.org](https://cron-job.org) (free)
2. Create a job every 1 minute
3. URL: `https://YOUR-APP.vercel.app/api/poll`
4. Header: `Authorization: Bearer YOUR_CRON_SECRET`

**Option B — Vercel Pro**

Change `vercel.json` cron to `* * * * *` for every-minute checks. Hobby only allows one run per day (currently noon UTC).

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
2. Enter your **email**
3. Choose:
   - **On open** — when the 48h window opens
   - **On available** — when a court frees up (cancellation)

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/availability?days=3` | GET | Upcoming slot availability |
| `/api/watches` | GET/POST/DELETE | Manage watches |
| `/api/notifications` | GET | Recent alerts |
| `/api/poll` | GET/POST | Run checks (protect with `CRON_SECRET`) |
| `/api/slot?date=...&hour=...` | GET | Live Planyo slot search |

## Local storage

Without Upstash, watches are stored in `data/store.json` (fine for local / Railway with disk).

## Disclaimer

Unofficial tool using public Planyo endpoints. Not affiliated with UMD RecWell.
