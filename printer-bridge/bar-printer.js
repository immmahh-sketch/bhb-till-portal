// Bar printer bridge for the Black Horse Beamish room-service system.
//
// Runs on any machine on the same LAN as the bar printer (same reasoning as
// kitchen-printer.js — browsers can't open raw TCP sockets). For each
// pending print_jobs row with destination "bar", prints one "bar-check"
// ticket: the FULL order, food and drinks together, no price - so bar staff
// can see whether food is also on the order and hold off making the drinks
// until it's nearly ready, instead of a drinks-only ticket that hid that.
// The full priced/logo'd ROOM SERVICE check and guest receipts print at
// Kitchen Printer 1 instead (see kitchen-printer.js).
//
// The bar printer is currently wired straight into the till, not the
// network - this bridge targets the Bixolon (192.168.100.134) as a stand-in
// until a network port is found behind the bar for it. Until then, jobs will
// sit "pending" and the check-print-jobs watchdog will alert if they go
// stale for too long.
//
// Each job is atomically claimed (pending -> printing) before it's actually
// printed, and a poll never overlaps a still-running one — printing several
// tickets involves real mechanical feed/cut time that can exceed the poll
// interval, and without this a job could get grabbed twice and printed
// twice (this happened once - see git history).
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

function hasLines(payload) {
  return (payload.lines || []).length > 0;
}

let busy = false;
async function pollOnce() {
  if (busy) return;
  busy = true;
  try {
    const jobs = await rest(
      "print_jobs?destination=eq.bar&status=eq.pending&order=created_at.asc&select=*"
    );
    for (const job of jobs) {
      const label = `order #${job.payload?.order_no ?? "?"}`;
      try {
        const claimed = await rest(`print_jobs?id=eq.${job.id}&status=eq.pending`, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ status: "printing" }),
        });
        if (!Array.isArray(claimed) || claimed.length === 0) continue; // another poller already got it

        if (hasLines(job.payload || {})) {
          await printToDevice(buildTicket(job, { kind: "bar-check" }), PRINTER_IP, PRINTER_PORT);
        }
        await rest(`print_jobs?id=eq.${job.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "printed", printed_at: new Date().toISOString() }),
        });
        console.log(`[${new Date().toLocaleTimeString()}] printed ${label}`);
      } catch (e) {
        console.error(`[${new Date().toLocaleTimeString()}] FAILED to print ${label}: ${e.message}`);
        await rest(`print_jobs?id=eq.${job.id}&status=eq.printing`, {
          method: "PATCH",
          body: JSON.stringify({ status: "pending" }),
        }).catch(() => {});
      }
    }
  } finally {
    busy = false;
  }
}

console.log(`Bar printer bridge running — polling every ${POLL_MS / 1000}s, printing to ${PRINTER_IP}:${PRINTER_PORT}`);
pollOnce().catch((e) => console.error("poll error:", e.message));
setInterval(() => {
  pollOnce().catch((e) => console.error("poll error:", e.message));
}, POLL_MS);
