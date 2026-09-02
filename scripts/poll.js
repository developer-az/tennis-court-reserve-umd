#!/usr/bin/env node
/**
 * Standalone poller — run alongside the app for server-side notifications.
 * Usage: npm run poll
 * Or set up a cron job: * * * * * node scripts/poll.js
 */

const BASE = process.env.APP_URL ?? "http://localhost:3000";

async function poll() {
  try {
    const res = await fetch(`${BASE}/api/poll`, { method: "POST" });
    const data = await res.json();
    const ts = new Date().toISOString();
    if (data.poll?.triggered > 0) {
      console.log(`[${ts}] Triggered ${data.poll.triggered} notification(s):`);
      for (const e of data.poll.events ?? []) {
        console.log(`  - Watch #${e.watchId}: ${e.type} — ${e.message}`);
      }
    } else {
      console.log(`[${ts}] Checked ${data.poll?.checked ?? 0} watches, no alerts`);
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Poll error:`, err.message);
  }
}

console.log(`Polling ${BASE}/api/poll every 30s...`);
poll();
setInterval(poll, 30_000);
