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
// Skipped entirely if the order has no drinks on it (food-only order) -
// same idea as kitchen-printer.js skipping the food check on a drinks-only
// order (see hasFood there). The job is still marked "printed" either way
// so it doesn't sit pending and trip the watchdog.
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

const { buildTicket, buildBotanicalsReceipt, printToDevice } = require("./ticket.js");
const wake = require("./wake.js");

const SUPABASE_URL = "https://safcrtrfdzsnftghibot.supabase.co";
const SUPABASE_KEY = "sb_publishable_RGaIB8W145BFCWzOxamQvA_7VIkTHMU";

// The bar printer: a Bixolon SRP-275III on the network at 192.168.100.130 (its self-test page, 22 Oct 2026). It prints the bar tickets for outside ordering, room service,
// Bob and camper van drinks, and the Black Horse Botanicals receipts. To use a different address without editing code, put the IP on the first line of a file called
// bar-printer-ip.txt in this folder and restart this program.
const PRINTER_IP = (() => {
  try {
    const t = require("fs").readFileSync(require("path").join(__dirname, "bar-printer-ip.txt"), "utf8").split(/\r?\n/)[0].trim();
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(t)) return t;
    console.error(`bar-printer-ip.txt does not hold an IP address (${JSON.stringify(t)}), using 192.168.100.130`);
  } catch (e) { /* no file: use the default */ }
  return "192.168.100.130";
})();
const PRINTER_PORT = 9100;
const POLL_MS = 4000;     // how often to check when live updates aren't working
const SAFETY_MS = 60000;  // a safety check once a minute even when they are (see wake.js)

async function rest(path, init = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    signal: AbortSignal.timeout(15000), // a dropped connection must not leave a job half-done and the bridge waiting for ever
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

// The payload on a print job doesn't say whether the order was a test (Test purchase password), but the order does.
async function withTestFlag(job) {
  if (job.order_id && !(job.payload && job.payload.is_test)) {
    const o = await rest(`roomservice_orders?id=eq.${job.order_id}&select=is_test`);
    if (Array.isArray(o) && o[0] && o[0].is_test) job.payload = { ...(job.payload || {}), is_test: true };
  }
  return job;
}

function hasDrinks(payload) {
  return (payload.lines || []).some((l) => l.category !== "food");
}

let busy = false, again = false;
async function pollOnce() {
  if (busy) { again = true; return; }
  busy = true;
  try {
    const jobs = await rest(
      "print_jobs?destination=in.(bar,botanicals)&status=eq.pending&order=created_at.asc&select=*"
    );
    for (const job of jobs) {
      const isBot = job.destination === "botanicals";
      const label = isBot ? `Botanicals receipt ${job.payload?.receipt_no ?? "?"}` : `order #${job.payload?.order_no ?? "?"}`;
      try {
        const claimed = await rest(`print_jobs?id=eq.${job.id}&status=eq.pending`, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ status: "printing" }),
        });
        if (!Array.isArray(claimed) || claimed.length === 0) continue; // another poller already got it

        if (isBot) {
          await printToDevice(buildBotanicalsReceipt(job), PRINTER_IP, PRINTER_PORT);
        } else {
          await withTestFlag(job);
          if (hasDrinks(job.payload || {})) {
            await printToDevice(buildTicket(job, { kind: "bar-check" }), PRINTER_IP, PRINTER_PORT);
          }
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
    if (again) { again = false; setImmediate(() => pollOnce().catch((e) => console.error("poll error:", e.message))); }
  }
}

console.log(`Bar printer bridge running — woken by live updates (checking every ${SAFETY_MS / 1000}s anyway, every ${POLL_MS / 1000}s without them), printing to ${PRINTER_IP}:${PRINTER_PORT}`);
// Checks when Supabase says something changed (wake.js), plus a safety check every minute; every 4 seconds
// whenever live updates aren't working (old Node, network blip), as it always used to.
// A job left "printing" can only mean this program stopped mid-print (it is the only thing that prints "bar" jobs), so on
// start-up put them back to pending and they print again, rather than sitting there for ever with nothing to retry them.
rest("print_jobs?destination=in.(bar,botanicals)&status=eq.printing", { method: "PATCH", body: JSON.stringify({ status: "pending" }) })
  .then(() => console.log("start-up: released any jobs left half-printed"))
  .catch((e) => console.error("start-up release failed:", e.message));
let live = false, timer = null;
function schedule() { clearTimeout(timer); timer = setTimeout(tick, live ? SAFETY_MS : POLL_MS); }
function tick() { pollOnce().catch((e) => console.error("poll error:", e.message)).finally(schedule); }
wake.watch({ name: "bar", changes: [{ table: "print_jobs", filter: "destination=eq.bar" }, { table: "print_jobs", filter: "destination=eq.botanicals" }], onChange: () => pollOnce().catch((e) => console.error("poll error:", e.message)), onStatus: (v) => { live = v; schedule(); } });
tick();
