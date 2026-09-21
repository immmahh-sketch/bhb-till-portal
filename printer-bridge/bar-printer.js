// Bar printer bridge for the Black Horse Beamish room-service system.
//
// Runs on any machine on the same LAN as the printer (same reasoning as
// kitchen-printer.js — browsers can't open raw TCP sockets). Two things run
// on the same poll loop:
//
// 1. Automatic tickets: for each pending print_jobs row with destination
//    "bar", prints:
//      - bar-prep    - drinks only, plain (always)
//      - staff-copy  - full order, prices, charge, total, logo, sign-off
//                      (room service only - outside tables skip this, no
//                      room-delivery sign-off needed for a table the guest
//                      is sitting at)
//    Then marks the job "printed".
//
// 2. Guest receipts (on request): the guest-copy VAT receipt is NOT
//    automatic - see the guest app's "Need a receipt?" prompt and the
//    portal's reprint/email buttons. Whenever roomservice_orders.
//    receipt_requested_at is newer than receipt_printed_at (or the latter
//    is null), prints the guest-copy and stamps receipt_printed_at.
//
// Each job/order is atomically claimed before printing (see kitchen-printer.js
// for why - printing several tickets involves real mechanical feed/cut time
// that can exceed the poll interval).
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

async function printAutoTickets() {
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

      const isOutside = job.payload?.channel === "outside";
      const kinds = isOutside ? ["bar-prep"] : ["bar-prep", "staff-copy"];
      for (const kind of kinds) {
        const ticket = buildTicket(job, { kind });
        await printToDevice(ticket, PRINTER_IP, PRINTER_PORT);
      }
      await rest(`print_jobs?id=eq.${job.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "printed", printed_at: new Date().toISOString() }),
      });
      console.log(`[${new Date().toLocaleTimeString()}] printed ${label} (${kinds.join(" + ")})`);
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
      await printToDevice(ticket, PRINTER_IP, PRINTER_PORT);
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

console.log(`Bar printer bridge running — polling every ${POLL_MS / 1000}s, printing to ${PRINTER_IP}:${PRINTER_PORT}`);
pollOnce().catch((e) => console.error("poll error:", e.message));
setInterval(() => {
  pollOnce().catch((e) => console.error("poll error:", e.message));
}, POLL_MS);
