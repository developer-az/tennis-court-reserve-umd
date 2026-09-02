# UMD Tennis Court Alerts

Get notified when Eppley tennis court reservation slots open on UMD's Planyo booking system.

## Features

- **Live availability grid** — see which 1-hour slots have open courts (next 3 days)
- **Slot watches** — get alerted when a slot's 48-hour booking window opens
- **Cancellation alerts** — notified when a court becomes available (someone cancelled)
- **Discord webhooks** — push notifications to your phone via Discord
- **Browser notifications** — alerts while the tab is open
- **Auto-polling** — server checks every 30 seconds

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How booking works

UMD Eppley tennis courts use [Planyo](https://www.planyo.com/booking.php?calendar=36698):

| Setting | Value |
|---------|-------|
| Courts | 8 |
| Hours | 6 AM – midnight |
| Slot length | 1 hour |
| Booking window | 48 hours ahead |

A Friday 4 PM slot opens for booking Wednesday 4 PM.

## Notifications

1. Click **Watch** on any slot in the availability grid
2. Choose what to notify on:
   - **On open** — when the 48h window opens
   - **On available** — when a court frees up
3. Optionally add a **Discord webhook** URL for mobile push
4. Enable **browser notifications** for alerts while the tab is open

### Discord setup

1. In Discord: Server Settings → Integrations → Webhooks → New Webhook
2. Copy the webhook URL
3. Paste it when creating a watch

### Background polling (optional)

For notifications without keeping the browser open, run the standalone poller:

```bash
# Terminal 1
npm run dev

# Terminal 2
npm run poll
```

Or set `APP_URL` for production:

```bash
APP_URL=https://your-domain.com npm run poll
```

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/availability?days=3` | GET | Upcoming slot availability |
| `/api/availability?date=2026-09-05` | GET | Slots for a specific day |
| `/api/watches` | GET | List all watches |
| `/api/watches` | POST | Create a watch |
| `/api/watches?id=1` | DELETE | Cancel a watch |
| `/api/poll` | POST | Run notification check |
| `/api/slot?date=...&hour=...` | GET | Live slot search via Planyo |

## Data

Watches and notifications are stored in `data/store.json` (created automatically).

## Disclaimer

This is an unofficial tool that reads public Planyo endpoints. It is not affiliated with UMD RecWell. Use responsibly and follow university facility policies.
