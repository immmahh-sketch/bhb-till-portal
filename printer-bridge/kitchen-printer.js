// Kitchen printer bridge for the Black Horse Beamish room-service system.
//
// Runs on any machine on the same LAN as the kitchen printers (this is
// necessary because the guest app and portal run in a browser, which can't
// open a raw TCP socket to a printer). Polls Supabase for print_jobs rows
// with destination "kitchen" and status "pending".
//
// Each order's food fans out to up to four physical printers:
//   - STATIONS.master always gets the full ticket (every food line) - the
//     pass/expo copy so the pass can track the whole order.
//   - STATIONS.starters/mains/desserts each get only the lines tagged for
//     that station (roomservice_menu_items.kitchen_station, set per item in
//     the portal's menu editor) - and are skipped entirely if the order has
//     no items for that station, to avoid printing a blank ticket.
//
// Each job is atomically claimed (pending -> printing) before it's actually
// printed, and a poll never overlaps a still-running one — printing several
// tickets involves real mechanical feed/cut time that can exceed the poll
// interval, and without this a job could get grabbed twice and printed
// twice (this happened once - see git history).
//
// Run with: node kitchen-printer.js   (needs Node 18+ for built-in fetch)

const { buildTicket, printToDevice } = require("./ticket.js");

const SUPABASE_URL = "https://safcrtrfdzsnftghibot.supabase.co";
const SUPABASE_KEY = "sb_publishable_RGaIB8W145BFCWzOxamQvA_7VIkTHMU";

const PRINTER_PORT = 9100;
const POLL_MS = 4000;

const STATIONS = [
  { key: "master", ip: "192.168.100.10", kind: "kitchen", always: true },
  { key: "starters", ip: "192.168.100.11", kind: "kitchen-starters", always: false },
  { key: "mains", ip: "192.168.100.12", kind: "kitchen-mains", always: false },
  { key: "desserts", ip: "192.168.100.20", kind: "kitchen-desserts", always: false },
];

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

// A station ticket is only worth printing if it actually has matching food
// lines (the master ticket always prints if there's any food at all).
function stationHasLines(payload, station) {
  const lines = payload.lines || [];
  if (station.always) return lines.some((l) => l.category === "food");
  return lines.some((l) => l.category === "food" && (l.station || "mains") === station.key);
}

let busy = false;
async function pollOnce() {
  if (busy) return;
  busy = true;
  try {
    const jobs = await rest(
      "print_jobs?destination=eq.kitchen&status=eq.pending&order=created_at.asc&select=*"
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

        const printed = [];
        for (const station of STATIONS) {
          if (!stationHasLines(job.payload || {}, station)) continue;
          const ticket = buildTicket(job, { kind: station.kind });
          await printToDevice(ticket, station.ip, PRINTER_PORT);
          printed.push(station.key);
        }
        await rest(`print_jobs?id=eq.${job.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "printed", printed_at: new Date().toISOString() }),
        });
        console.log(`[${new Date().toLocaleTimeString()}] printed ${label} (${printed.join(" + ") || "no food lines"})`);
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

console.log(`Kitchen printer bridge running — polling every ${POLL_MS / 1000}s, stations: ${STATIONS.map((s) => `${s.key}=${s.ip}`).join(", ")}`);
pollOnce().catch((e) => console.error("poll error:", e.message));
setInterval(() => {
  pollOnce().catch((e) => console.error("poll error:", e.message));
}, POLL_MS);
