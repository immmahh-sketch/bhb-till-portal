// Kitchen printer bridge for the Black Horse Beamish room-service system.
//
// Runs on any machine on the same LAN as the Bixolon SRP-275IIIC (this is
// necessary because the guest app and portal run in a browser, which can't
// open a raw TCP socket to a printer). It polls Supabase for print_jobs rows
// with destination "kitchen" and status "pending", renders each one as ESC/POS
// bytes, sends it straight to the printer's network port, then marks the job
// "printed" — the same status the portal's virtual-printer "Mark printed"
// button sets, so both stay in sync.
//
// Kitchen tickets are plain (no logo, no guest sign-off) — those are a
// bar-receipt-only thing, see ticket.js / print-bar-test.js.
//
// Run with: node kitchen-printer.js   (needs Node 18+ for built-in fetch)

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
    "print_jobs?destination=eq.kitchen&status=eq.pending&order=created_at.asc&select=*"
  );
  for (const job of jobs) {
    const label = `order #${job.payload?.order_no ?? "?"}`;
    try {
      const ticket = buildTicket(job, { kind: "kitchen" });
      await printToDevice(ticket, PRINTER_IP, PRINTER_PORT);
      await rest(`print_jobs?id=eq.${job.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "printed", printed_at: new Date().toISOString() }),
      });
      console.log(`[${new Date().toLocaleTimeString()}] printed ${label}`);
    } catch (e) {
      console.error(`[${new Date().toLocaleTimeString()}] FAILED to print ${label}: ${e.message}`);
    }
  }
}

console.log(`Kitchen printer bridge running — polling every ${POLL_MS / 1000}s, printing to ${PRINTER_IP}:${PRINTER_PORT}`);
pollOnce().catch((e) => console.error("poll error:", e.message));
setInterval(() => {
  pollOnce().catch((e) => console.error("poll error:", e.message));
}, POLL_MS);
