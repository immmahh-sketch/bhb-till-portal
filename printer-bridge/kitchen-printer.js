// Kitchen printer bridge for the Black Horse Beamish room-service system.
//
// Runs on any machine on the same LAN as the kitchen printers (this is
// necessary because the guest app and portal run in a browser, which can't
// open a raw TCP socket to a printer). Polls Supabase for print_jobs rows
// with destination "kitchen" and status "pending", plus (separately) for
// on-request guest receipts.
//
// Four physical printers, one order fans out across up to four of them:
//   - Kitchen Printer 1 (192.168.100.10) is the hub: always gets the master
//     food check (every food item, no price - the Head Chef/pass copy) AND
//     the full "ROOM SERVICE" check (everything, prices, logo, guest
//     sign-off for room service orders - see ticket.js "staff-copy"). It
//     also prints the guest receipt whenever one's requested (guest app's
//     "Need a receipt?" prompt, or the portal's reprint/email buttons).
//   - Kitchen Printers 2/3/4 (192.168.100.11/.12/.20) each get only the food
//     lines tagged for their station (roomservice_menu_items.kitchen_station,
//     set per item in the portal's menu editor) - skipped entirely if the
//     order has nothing for that station, to avoid printing a blank ticket.
//
// Each job/order is atomically claimed (pending -> printing, or a
// timestamp comparison for receipts) before it's actually printed, and a
// poll never overlaps a still-running one — printing several tickets
// involves real mechanical feed/cut time that can exceed the poll interval,
// and without this a job could get grabbed twice and printed twice (this
// happened once - see git history).
//
// Run with: node kitchen-printer.js   (needs Node 18+ for built-in fetch)

const { buildTicket, printToDevice } = require("./ticket.js");

const SUPABASE_URL = "https://safcrtrfdzsnftghibot.supabase.co";
const SUPABASE_KEY = "sb_publishable_RGaIB8W145BFCWzOxamQvA_7VIkTHMU";

const PRINTER_PORT = 9100;
const POLL_MS = 4000;

const PRINTER1_IP = "192.168.100.10"; // master food check + full ROOM SERVICE check + guest receipts
const STATIONS = [
  { key: "starters", ip: "192.168.100.11", kind: "kitchen-starters" },
  { key: "mains", ip: "192.168.100.12", kind: "kitchen-mains" },
  { key: "desserts", ip: "192.168.100.20", kind: "kitchen-desserts" },
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

function orderAsJob(order) {
  return {
    created_at: order.created_at,
    payload: {
      order_no: order.order_no,
      guest_name: order.guest_name,
      room_number: order.room_number,
      channel: order.channel,
      notes: order.notes,
      allergy_notes: order.allergy_notes,
      subtotal: order.subtotal,
      tray_charge: order.tray_charge,
      lines: order.lines,
    },
  };
}

function hasFood(payload) {
  return (payload.lines || []).some((l) => l.category === "food");
}
function stationHasLines(payload, station) {
  return (payload.lines || []).some((l) => l.category === "food" && (l.station || "mains") === station.key);
}

async function printAutoTickets() {
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
      const payload = job.payload || {};

      if (hasFood(payload)) {
        await printToDevice(buildTicket(job, { kind: "kitchen" }), PRINTER1_IP, PRINTER_PORT);
        printed.push("master");
      }
      // Full ROOM SERVICE / FOH check always prints - it covers drinks and
      // pricing too, so it's needed even for a drinks-only order.
      await printToDevice(buildTicket(job, { kind: "staff-copy" }), PRINTER1_IP, PRINTER_PORT);
      printed.push("staff-copy");

      for (const station of STATIONS) {
        if (!stationHasLines(payload, station)) continue;
        await printToDevice(buildTicket(job, { kind: station.kind }), station.ip, PRINTER_PORT);
        printed.push(station.key);
      }

      await rest(`print_jobs?id=eq.${job.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "printed", printed_at: new Date().toISOString() }),
      });
      console.log(`[${new Date().toLocaleTimeString()}] printed ${label} (${printed.join(" + ")})`);
    } catch (e) {
      console.error(`[${new Date().toLocaleTimeString()}] FAILED to print ${label}: ${e.message}`);
      await rest(`print_jobs?id=eq.${job.id}&status=eq.printing`, {
        method: "PATCH",
        body: JSON.stringify({ status: "pending" }),
      }).catch(() => {});
    }
  }
}

async function printRequestedReceipts() {
  const orders = await rest(
    "roomservice_orders?select=*&receipt_requested_at=not.is.null&order=receipt_requested_at.asc"
  );
  for (const order of orders) {
    const needsPrint = !order.receipt_printed_at || order.receipt_printed_at < order.receipt_requested_at;
    if (!needsPrint) continue;
    const label = `order #${order.order_no}`;
    try {
      // Atomic-ish claim: only proceed if still not printed-up-to-date by the time we PATCH.
      const requestedAt = encodeURIComponent(order.receipt_requested_at);
      const claimed = await rest(
        `roomservice_orders?id=eq.${order.id}&or=(receipt_printed_at.is.null,receipt_printed_at.lt.${requestedAt})`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ receipt_printed_at: new Date().toISOString() }),
        }
      );
      if (!Array.isArray(claimed) || claimed.length === 0) continue;

      const ticket = buildTicket(orderAsJob(order), { kind: "guest-copy" });
      await printToDevice(ticket, PRINTER1_IP, PRINTER_PORT);
      console.log(`[${new Date().toLocaleTimeString()}] printed guest-copy for ${label} (requested)`);
    } catch (e) {
      console.error(`[${new Date().toLocaleTimeString()}] FAILED to print requested receipt for ${label}: ${e.message}`);
    }
  }
}

let busy = false;
async function pollOnce() {
  if (busy) return;
  busy = true;
  try {
    await printAutoTickets();
    await printRequestedReceipts();
  } finally {
    busy = false;
  }
}

console.log(`Kitchen printer bridge running — polling every ${POLL_MS / 1000}s, printer1=${PRINTER1_IP} (master+staff-copy+receipts), ${STATIONS.map((s) => `${s.key}=${s.ip}`).join(", ")}`);
pollOnce().catch((e) => console.error("poll error:", e.message));
setInterval(() => {
  pollOnce().catch((e) => console.error("poll error:", e.message));
}, POLL_MS);
