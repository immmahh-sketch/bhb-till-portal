// Kitchen printer bridge for the Black Horse Beamish room-service system.
//
// Runs on any machine on the same LAN as the kitchen printers (this is
// necessary because the guest app and portal run in a browser, which can't
// open a raw TCP socket to a printer). Polls Supabase for print_jobs rows
// with destination "kitchen" and status "pending", plus (separately) for
// on-request guest receipts.
//
// Per the Head Chef: every kitchen printer gets an identical copy of the
// full food check (every food item, no drinks/price/logo) - no splitting by
// starter/main/dessert. The one exception is Kitchen Printer 4, which only
// prints if the order actually has a dessert on it (checked via
// roomservice_menu_items.kitchen_station, set per item in the portal's menu
// editor - not otherwise used for routing any more).
//
// Kitchen Printer 1 additionally acts as the hub for two more things:
//   - the full "ROOM SERVICE" check (everything, prices, logo, guest
//     sign-off for room service orders - see ticket.js "staff-copy")
//   - guest receipts, whenever one's requested (guest app's "Need a
//     receipt?" prompt, or the portal's reprint/email buttons)
//
// Each job/order is atomically claimed (pending -> printing, or a
// timestamp comparison for receipts) before it's actually printed, and a
// poll never overlaps a still-running one — printing several tickets
// involves real mechanical feed/cut time that can exceed the poll interval,
// and without this a job could get grabbed twice and printed twice (this
// happened once - see git history).
//
// Run with: node kitchen-printer.js   (needs Node 18+ for built-in fetch)

const { buildTicket, buildPreorderTicket, buildLunchTicket, printToDevice } = require("./ticket.js");
const wake = require("./wake.js");

const SUPABASE_URL = "https://safcrtrfdzsnftghibot.supabase.co";
const SUPABASE_KEY = "sb_publishable_RGaIB8W145BFCWzOxamQvA_7VIkTHMU";

const PRINTER_PORT = 9100;
const POLL_MS = 4000;     // how often to check when live updates aren't working
const SAFETY_MS = 60000;  // a safety check once a minute even when they are (see wake.js)

const PRINTER1_IP = "192.168.100.10"; // full food check + full ROOM SERVICE check + guest receipts
const PRINTER2_IP = "192.168.100.11"; // full food check
const PRINTER3_IP = "192.168.100.12"; // full food check
const PRINTER4_IP = "192.168.100.20"; // full food check, only when the order has a dessert

const FOOD_PRINTERS = [PRINTER1_IP, PRINTER2_IP, PRINTER3_IP]; // always get the identical full food check
const XMAS_PRINTER_IP = PRINTER1_IP; // the Christmas pre-order tickets (Print pre-orders via kitchen printer, in the Christmas tile) all go to Kitchen Printer 1

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
      is_test: order.is_test,
    },
  };
}

function hasFood(payload) {
  return (payload.lines || []).some((l) => l.category === "food");
}
function hasDessert(payload) {
  return (payload.lines || []).some((l) => l.category === "food" && l.station === "desserts");
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

      await withTestFlag(job);
      const printed = [];
      const payload = job.payload || {};

      if (hasFood(payload)) {
        const foodTicket = buildTicket(job, { kind: "kitchen" });
        for (const ip of FOOD_PRINTERS) {
          await printToDevice(foodTicket, ip, PRINTER_PORT);
        }
        printed.push(`food check x${FOOD_PRINTERS.length}`);
        if (hasDessert(payload)) {
          await printToDevice(foodTicket, PRINTER4_IP, PRINTER_PORT);
          printed.push("desserts");
        }
      }

      // Full ROOM SERVICE / FOH check always prints - it covers drinks and
      // pricing too, so it's needed even for a drinks-only order.
      await printToDevice(buildTicket(job, { kind: "staff-copy" }), PRINTER1_IP, PRINTER_PORT);
      printed.push("staff-copy");

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

// Christmas pre-order tickets (27 Oct 2026): their own print destination "xmas-kitchen", so a bridge that has not been updated ignores them. One job per ticket, in the order they were queued
// (every Kitchen copy, then every Pass copy, then every Host copy). A ticket that fails goes back to pending and is tried again.
async function printXmasTickets() {
  const jobs = await rest("print_jobs?destination=eq.xmas-kitchen&status=eq.pending&order=created_at.asc&limit=400&select=*");
  for (const job of jobs) {
    const p = job.payload || {}, label = `pre-order ${p.seq}/${p.total} ${p.copy} ${p.venue} ${p.time} ${p.name}`;
    try {
      const claimed = await rest(`print_jobs?id=eq.${job.id}&status=eq.pending`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "printing" }) });
      if (!Array.isArray(claimed) || claimed.length === 0) continue;
      await printToDevice(buildPreorderTicket(job), XMAS_PRINTER_IP, PRINTER_PORT);
      await rest(`print_jobs?id=eq.${job.id}`, { method: "PATCH", body: JSON.stringify({ status: "printed", printed_at: new Date().toISOString() }) });
      console.log(`[${new Date().toLocaleTimeString()}] printed ${label}`);
    } catch (e) {
      console.error(`[${new Date().toLocaleTimeString()}] FAILED to print ${label}: ${e.message}`);
      await rest(`print_jobs?id=eq.${job.id}&status=eq.printing`, { method: "PATCH", body: JSON.stringify({ status: "pending" }) }).catch(() => {});
      return;      // the printer is probably off or out of paper: stop here, try again next time, keep the order
    }
  }
}

// Staff lunch orders (3 Nov 2026): destination "staff-lunch", one ticket each on Kitchen Printer 1 (the main printer, which also prints guest receipts).
async function printLunchTickets() {
  const jobs = await rest("print_jobs?destination=eq.staff-lunch&status=eq.pending&order=created_at.asc&limit=100&select=*");
  for (const job of jobs) {
    const p = job.payload || {}, label = `staff lunch #${p.order_no ?? "?"} ${p.name || ""}`;
    try {
      const claimed = await rest(`print_jobs?id=eq.${job.id}&status=eq.pending`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "printing" }) });
      if (!Array.isArray(claimed) || claimed.length === 0) continue;
      await printToDevice(buildLunchTicket(job), PRINTER1_IP, PRINTER_PORT);
      await rest(`print_jobs?id=eq.${job.id}`, { method: "PATCH", body: JSON.stringify({ status: "printed", printed_at: new Date().toISOString() }) });
      console.log(`[${new Date().toLocaleTimeString()}] printed ${label}`);
    } catch (e) {
      console.error(`[${new Date().toLocaleTimeString()}] FAILED to print ${label}: ${e.message}`);
      await rest(`print_jobs?id=eq.${job.id}&status=eq.printing`, { method: "PATCH", body: JSON.stringify({ status: "pending" }) }).catch(() => {});
      return;      // the printer is probably off or out of paper: stop here, try again next time, keep the order
    }
  }
}

// Carvery orders (Sundays, from 8 Nov 2026): destination "carvery", one print job per paid order holding only the starters, desserts and drinks (the carvery meals are collected at the carvery and never printed).
//   drinks only      -> 1 check  (bar)
//   food only        -> 2 checks (kitchen, pass)
//   food and drinks  -> 3 checks (bar, kitchen, pass)
// The bar check shows only drinks; the kitchen and pass checks show only food.
// Where they print comes from carvery-printers.txt in this folder, read afresh on every check so a change needs no restart: either one IP address on its own line (all
// the checks print there), or bar=, kitchen= and pass= lines, one IP each (a missing one falls back to a plain IP line if there is one). With no file the jobs just wait.
function carveryPrinters() {
  try {
    const out = {}; let all = null;
    for (const raw of require("fs").readFileSync(require("path").join(__dirname, "carvery-printers.txt"), "utf8").split(/\r?\n/)) {
      const t = raw.replace(/#.*/, "").trim(); if (!t) continue;
      const m = t.match(/^(bar|kitchen|pass)\s*[=:]\s*(\d{1,3}(?:\.\d{1,3}){3})$/i);
      if (m) out[m[1].toLowerCase()] = m[2]; else if (/^\d{1,3}(\.\d{1,3}){3}$/.test(t)) all = t;
    }
    return { bar: out.bar || all, kitchen: out.kitchen || all, pass: out.pass || all };
  } catch (e) { return { bar: null, kitchen: null, pass: null }; }
}
let carveryWarned = false;
async function printCarveryTickets() {
  const where = carveryPrinters();
  const jobs = await rest("print_jobs?destination=eq.carvery&status=eq.pending&order=created_at.asc&limit=100&select=*");
  if (!jobs.length) return;
  if (!where.bar && !where.kitchen && !where.pass) {
    if (!carveryWarned) { console.error(`[${new Date().toLocaleTimeString()}] ${jobs.length} carvery order(s) waiting: carvery-printers.txt is missing or has no IP address in it`); carveryWarned = true; }
    return;
  }
  carveryWarned = false;
  for (const job of jobs) {
    const label = `carvery order #${job.payload?.order_no ?? "?"} table ${job.payload?.room_number ?? "?"}`;
    try {
      const claimed = await rest(`print_jobs?id=eq.${job.id}&status=eq.pending`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "printing" }) });
      if (!Array.isArray(claimed) || claimed.length === 0) continue;
      await withTestFlag(job);
      const payload = job.payload || {};
      const done = Array.isArray(payload.printed) ? payload.printed.slice() : [];      // copies already out, if an earlier try stopped half way: they are not printed twice
      const wanted = [];
      if ((payload.lines || []).some((l) => l.category !== "food")) wanted.push(["bar", "carvery-bar"]);
      if (hasFood(payload)) wanted.push(["kitchen", "carvery-kitchen"], ["pass", "carvery-pass"]);
      for (const [copy, kind] of wanted) {
        if (done.includes(copy)) continue;
        if (!where[copy]) throw new Error(`no printer set for the ${copy} check in carvery-printers.txt`);
        await printToDevice(buildTicket(job, { kind }), where[copy], PRINTER_PORT);
        done.push(copy);
        await rest(`print_jobs?id=eq.${job.id}`, { method: "PATCH", body: JSON.stringify({ payload: { ...payload, printed: done } }) });
      }
      await rest(`print_jobs?id=eq.${job.id}`, { method: "PATCH", body: JSON.stringify({ status: "printed", printed_at: new Date().toISOString() }) });
      console.log(`[${new Date().toLocaleTimeString()}] printed ${label} (${done.join(" + ") || "nothing to print"})`);
    } catch (e) {
      console.error(`[${new Date().toLocaleTimeString()}] FAILED to print ${label}: ${e.message}`);
      await rest(`print_jobs?id=eq.${job.id}&status=eq.printing`, { method: "PATCH", body: JSON.stringify({ status: "pending" }) }).catch(() => {});
      return;      // a printer is probably off or out of paper: stop here, try again next time, keep the order
    }
  }
}

async function printRequestedReceipts() {
  const orders = await rest(
    `roomservice_orders?select=*&receipt_requested_at=gte.${encodeURIComponent(new Date(Date.now() - 2 * 86400000).toISOString())}&order=receipt_requested_at.asc`
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

let busy = false, again = false;
async function pollOnce() {
  if (busy) { again = true; return; }
  busy = true;
  try {
    await printAutoTickets();
    await printXmasTickets();
    await printLunchTickets();
    await printCarveryTickets();
    await printRequestedReceipts();
  } finally {
    busy = false;
    if (again) { again = false; setImmediate(() => pollOnce().catch((e) => console.error("poll error:", e.message))); }
  }
}

console.log(`Kitchen printer bridge running — woken by live updates (checking every ${SAFETY_MS / 1000}s anyway, every ${POLL_MS / 1000}s without them), printers: ${FOOD_PRINTERS.join(", ")} (full food check), ${PRINTER4_IP} (desserts only), printer1 also gets staff-copy + receipts`);
// Checks when Supabase says something changed (wake.js), plus a safety check every minute; every 4 seconds
// whenever live updates aren't working (old Node, network blip), as it always used to.
// A job left "printing" can only mean this program stopped mid-print (it is the only thing that prints "kitchen" jobs), so on
// start-up put them back to pending and they print again, rather than sitting there for ever with nothing to retry them.
rest("print_jobs?destination=in.(kitchen,xmas-kitchen,staff-lunch,carvery)&status=eq.printing", { method: "PATCH", body: JSON.stringify({ status: "pending" }) })
  .then(() => console.log("start-up: released any jobs left half-printed"))
  .catch((e) => console.error("start-up release failed:", e.message));
let live = false, timer = null;
function schedule() { clearTimeout(timer); timer = setTimeout(tick, live ? SAFETY_MS : POLL_MS); }
function tick() { pollOnce().catch((e) => console.error("poll error:", e.message)).finally(schedule); }
wake.watch({ name: "kitchen", changes: [{ table: "print_jobs", filter: "destination=eq.kitchen" }, { table: "print_jobs", filter: "destination=eq.xmas-kitchen" }, { table: "print_jobs", filter: "destination=eq.staff-lunch" }, { table: "print_jobs", filter: "destination=eq.carvery" }, { table: "roomservice_orders" }], onChange: () => pollOnce().catch((e) => console.error("poll error:", e.message)), onStatus: (v) => { live = v; schedule(); } });
tick();
