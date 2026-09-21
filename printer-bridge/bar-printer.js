// Bar printer bridge for the Black Horse Beamish room-service system.
//
// Runs on any machine on the same LAN as the printer (same reasoning as
// kitchen-printer.js — browsers can't open raw TCP sockets). Polls Supabase
// for print_jobs rows with destination "bar" and status "pending", and
// prints THREE separate tickets per job:
//   1. bar-prep    - drinks only, plain (same style as the kitchen ticket)
//   2. staff-copy  - full order with prices, tray/service charge, total,
//                    logo, and the guest sign-off section
//   3. guest-copy  - full order with prices, tray/service charge, total,
//                    logo, payment method and VAT breakdown - the guest's
//                    VAT receipt to keep, no sign-off
//
// Then marks the job "printed", same as kitchen-printer.js.
//
// Run with: node bar-printer.js   (needs Node 18+ for built-in fetch)

const { buildTicket, printToDevice } = require("./ticket.js");

const SUPABASE_URL = "https://safcrtrfdzsnftghibot.supabase.co";
const SUPABASE_KEY = "sb_publishable_RGaIB8W145BFCWzOxamQvA_7VIkTHMU";

const PRINTER_IP = "192.168.100.134";
const PRINTER_PORT = 9100;
const POLL_MS = 4000;

async function rest(path, init = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!r.ok) throw new Error(`${path} -> ${r.status} ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

async function pollOnce() {
  const jobs = await rest(
    "print_jobs?destination=eq.bar&status=eq.pending&order=created_at.asc&select=*"
  );
  for (const job of jobs) {
    const label = `order #${job.payload?.order_no ?? "?"}`;
    try {
      for (const kind of ["bar-prep", "staff-copy", "guest-copy"]) {
        const ticket = buildTicket(job, { kind });
        await printToDevice(ticket, PRINTER_IP, PRINTER_PORT);
      }
      await rest(`print_jobs?id=eq.${job.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "printed", printed_at: new Date().toISOString() }),
      });
      console.log(`[${new Date().toLocaleTimeString()}] printed ${label} (bar-prep + staff-copy + guest-copy)`);
    } catch (e) {
      console.error(`[${new Date().toLocaleTimeString()}] FAILED to print ${label}: ${e.message}`);
    }
  }
}

console.log(`Bar printer bridge running — polling every ${POLL_MS / 1000}s, printing to ${PRINTER_IP}:${PRINTER_PORT}`);
pollOnce().catch((e) => console.error("poll error:", e.message));
setInterval(() => {
  pollOnce().catch((e) => console.error("poll error:", e.message));
}, POLL_MS);
