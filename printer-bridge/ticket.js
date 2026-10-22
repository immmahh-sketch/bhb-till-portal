// Shared ESC/POS ticket builder + raw-socket printing for the Black Horse
// Beamish room-service/outside-table system.
//
// Kitchen tickets fan out to four physical printers (see kitchen-printer.js):
//   kitchen -> printers 1-4: the full food check (every food line, no price,
//              no logo, no sign-off) - identical copy to all four, per the
//              Head Chef's request. Printer 4 (desserts) is the one
//              exception: kitchen-printer.js skips it entirely if the order
//              has no dessert item, using roomservice_menu_items.
//              kitchen_station (set per item in the portal's menu editor) to
//              tell whether a line is a dessert.
//
// Bar printer ticket (see bar-printer.js):
//   bar-check -> the FULL order, food and drinks together, no price/logo/
//                sign-off - headed "BAR" instead of "KITCHEN". Bar staff
//                need to see if food is on the order too, so they don't
//                make the drinks until the food's nearly ready.
//
// staff-copy (full priced "ROOM SERVICE"/"STAFF COPY" ticket, with guest
// sign-off for room service) and guest-copy (VAT receipt) print at Kitchen
// Printer 1 instead - see kitchen-printer.js. Comp orders (payload.is_comp,
// "Bob" / ?comp=1 in order/index.html) never show pricing on any ticket
// kind, since nothing is actually being charged.
//
// Used by kitchen-printer.js and bar-printer.js (the live pollers) and the
// one-off print-bar-test.js script.

const net = require("net");
const fs = require("fs");
const path = require("path");

const LINE_WIDTH = 32; // characters per line at the printer's default font/column setting
const VAT_RATE = 0.20; // matches CFG.DEFAULT_VAT in the till portal
const COMPANY_VAT_NO = "GB113205865"; // matches send-vat-receipt/index.ts

// This printer's command set has no GS v 0 (raster image) support, and its
// FS q/FS p NV bit image commands produced corrupted output on this unit
// (byte layout didn't match the documented spec closely enough to trust) —
// see manual_extract.txt for the command reference. ESC * (classic 8-dot
// band bit image mode) worked reliably instead, so the logo is pre-rendered
// as a ready-to-send ESC * byte sequence (see generate-logo-assets.py) and
// just inlined into each ticket that needs it.
const LOGO = (() => {
  try {
    return fs.readFileSync(path.join(__dirname, "assets", "bar-logo-escstar.bin"));
  } catch (e) {
    return null; // logo asset missing - tickets still print, just without it
  }
})();

const KIND = {
  kitchen: { heading: "KITCHEN", tag: null, category: "food", prices: false, logo: false, signoff: false, vat: false, allergyAlways: false },
  "bar-check": { heading: "BAR", tag: null, category: "all", prices: false, logo: false, signoff: false, vat: false, allergyAlways: false },
  "staff-copy": { heading: null, tag: "ROOM SERVICE COPY", category: "all", prices: true, logo: true, signoff: true, vat: false, allergyAlways: true },
  "guest-copy": { heading: null, tag: "GUEST COPY", category: "all", prices: true, logo: true, signoff: false, vat: true, allergyAlways: false },
};

// £ sent as a raw byte (0xA3) prints as the wrong glyph on this printer's
// default USA code table. ESC R 3 (UK international char set, set in
// buildTicket) remaps '#' (0x23) to £ instead, so amounts use '#' here and
// the printer does the substitution.
function money(n) {
  const neg = n < 0;
  const abs = (Math.round((Math.abs(n) + Number.EPSILON) * 100) / 100).toFixed(2);
  return (neg ? "-" : "") + "#" + abs;
}
function escBytes(bytes) { return Buffer.from(bytes); }
function rule() { return "-".repeat(LINE_WIDTH) + "\n"; }
function dottedLine(label) {
  const dots = Math.max(3, LINE_WIDTH - label.length);
  return label + ".".repeat(dots) + "\n";
}
function wrapText(text, width) {
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > width) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
// Left-aligned label, right-aligned amount, wraps to a second line if the
// label's too long to leave room for the amount on one line.
function priceRow(label, amount) {
  const amt = money(amount);
  if (label.length + 1 + amt.length > LINE_WIDTH) {
    return label + "\n" + amt.padStart(LINE_WIDTH) + "\n";
  }
  return label + amt.padStart(LINE_WIDTH - label.length) + "\n";
}

function buildTicket(job, opts = {}) {
  const kindKey = opts.kind || "kitchen";
  const cfg = KIND[kindKey];
  if (!cfg) throw new Error(`unknown ticket kind "${kindKey}"`);

  const p = job.payload || {};
  // Comp orders ("Bob" / ?comp=1 in order/index.html) are never paid for -
  // no pricing anywhere on the ticket, regardless of ticket kind.
  const showPrices = cfg.prices && !p.is_comp;
  const allLines = p.lines || [];
  const lines = cfg.category === "all" ? allLines : allLines.filter((l) =>
    cfg.category === "food" ? l.category === "food" : l.category !== "food"
  );
  const isOutside = p.channel === "outside";
  const isStaffFood = p.channel === "staff_food";
  // Camper vans: the guest's vehicle registration travels in room_number, and
  // the order is carried out to the vehicle in takeaway packaging - the ticket
  // has to make both impossible to miss, whichever strip of paper is torn off.
  const isCamper = p.channel === "camper";
  const camperReg = String(p.room_number ?? "-").toUpperCase().replace(/[^\x20-\x7e]/g, "").replace(/#/g, "").trim() || "-";
  const created = job.created_at ? new Date(job.created_at) : null;
  const date = created ? created.toLocaleDateString("en-GB") : "";
  const time = created ? created.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";

  const chunks = [];
  const push = (s) => chunks.push(Buffer.from(s, "ascii"));
  const lineNoPrice = (l) => push(`${l.qty} x ${l.name}\n`);
  const linePrice = (l) => push(priceRow(`${l.qty} x ${l.name}`, (Number(l.unit_price) || 0) * (Number(l.qty) || 0)));

  chunks.push(escBytes([0x1b, 0x40])); // initialize
  chunks.push(escBytes([0x1b, 0x52, 0x03])); // international char set: UK ('#' prints as £)
  chunks.push(escBytes([0x1b, 0x61, 0x01])); // center

  // Test orders (the Test purchase password in order/index.html) say so loudly at the top and bottom of every ticket,
  // so nobody makes the food or drinks.
  const isTest = !!(p.is_test || job.is_test);
  const testBanner = () => {
    chunks.push(escBytes([0x1b, 0x45, 0x01, 0x1d, 0x21, 0x11]));
    push("*** TEST ***\n");
    chunks.push(escBytes([0x1d, 0x21, 0x00]));
    push("DO NOT MAKE - TEST ORDER\n");
    chunks.push(escBytes([0x1b, 0x45, 0x00]));
    push(rule());
  };
  if (isTest) testBanner();

  if (cfg.logo && LOGO) {
    chunks.push(LOGO);
    chunks.push(escBytes([0x0a]));
  }

  const tag = kindKey === "staff-copy" && (isOutside || isCamper || isStaffFood) ? "STAFF COPY" : cfg.tag;
  if (tag) {
    chunks.push(escBytes([0x1b, 0x45, 0x01]));
    push(`${tag}\n`);
    chunks.push(escBytes([0x1b, 0x45, 0x00]));
  }

  chunks.push(escBytes([0x1b, 0x45, 0x01])); // bold on
  if (cfg.heading) {
    chunks.push(escBytes([0x1d, 0x21, 0x11])); // double height + width
    push(`${cfg.heading}\n`);
    chunks.push(escBytes([0x1d, 0x21, 0x00])); // back to normal size
  }
  chunks.push(escBytes([0x1d, 0x21, 0x11])); // double height + width
  push(`${isStaffFood ? "STAFF FOOD" : isCamper ? "CAMPER VAN" : isOutside ? "OUTSIDE" : "ROOM SERVICE"}\n`);
  chunks.push(escBytes([0x1d, 0x21, 0x00])); // back to normal size
  if (isCamper) {
    // Registration in triple size (10 chars/line); double if it's longer than that.
    chunks.push(escBytes([0x1d, 0x21, camperReg.length <= 10 ? 0x22 : 0x11]));
    push(`${camperReg}\n`);
    chunks.push(escBytes([0x1d, 0x21, 0x01])); // double height, normal width (32 chars/line)
    push("*** TAKEAWAY PACKAGING ***\n");
    push("DELIVER TO CAMPER VAN\n");
    chunks.push(escBytes([0x1d, 0x21, 0x00]));
  } else {
    push(isStaffFood ? "COLLECTING AT 12:30PM\n" : `${isOutside ? "Table " : "Room "}${p.room_number ?? "-"}\n`);
  }
  chunks.push(escBytes([0x1b, 0x45, 0x00])); // bold off
  push(rule());

  chunks.push(escBytes([0x1b, 0x61, 0x00])); // left align
  // "#" (0x23) is remapped to £ by the UK international char set above (see
  // money()), so it can't be used literally anywhere else on the ticket -
  // "Order No." instead of "Order #".
  push(`Order No. ${p.order_no ?? "-"}   ${date} ${time}\n`);
  if (p.guest_name) push(`${p.guest_name}\n`);
  push(rule());

  const food = lines.filter((l) => l.category === "food");
  const drink = lines.filter((l) => l.category !== "food");
  const printGroup = (label, items) => {
    if (!items.length) return;
    chunks.push(escBytes([0x1b, 0x45, 0x01]));
    push(`${label}\n`);
    chunks.push(escBytes([0x1b, 0x45, 0x00]));
    items.forEach(showPrices ? linePrice : lineNoPrice);
  };
  printGroup("FOOD", food);
  printGroup("DRINKS", drink);
  if (!food.length && !drink.length) push("(no lines)\n");

  if (p.notes) {
    push(rule());
    push(`Note: ${p.notes}\n`);
  }
  if (p.allergy_notes || cfg.allergyAlways) {
    push(rule());
    chunks.push(escBytes([0x1b, 0x45, 0x01]));
    push("ALLERGY / DIETARY\n");
    chunks.push(escBytes([0x1b, 0x45, 0x00]));
    push(`${p.allergy_notes || "N/A"}\n`);
  }

  if (showPrices) {
    const total = Number(p.subtotal) || 0;
    const charge = Number(p.tray_charge) || 0;
    const discountAmt = Number(p.discount_amount) || 0;
    const bundleAmt = Number(p.bundle_amount) || 0;
    push(rule());
    push(priceRow(isOutside || isCamper ? "Service charge (10%)" : "Tray charge", charge));
    if (bundleAmt > 0) {
      push(priceRow(p.bundle_label || "Deal savings", -bundleAmt));
    }
    if (discountAmt > 0) {
      push(priceRow(p.discount_label || "Discount", -discountAmt));
    }
    if (cfg.vat) {
      const net = total / (1 + VAT_RATE);
      const vat = total - net;
      push(priceRow("Subtotal (net)", net));
      push(priceRow(`VAT @ ${(VAT_RATE * 100).toFixed(0)}%`, vat));
    }
    push(rule());
    chunks.push(escBytes([0x1b, 0x45, 0x01]));
    push(priceRow("Total charged", total));
    chunks.push(escBytes([0x1b, 0x45, 0x00]));
    if (cfg.vat) {
      push("Payment: Paid online\n");
      push(rule());
      chunks.push(escBytes([0x1b, 0x61, 0x01])); // center
      push("Black Horse Beamish Ltd\n");
      push(`VAT reg. ${COMPANY_VAT_NO}\n`);
      chunks.push(escBytes([0x1b, 0x61, 0x00])); // left align
    }
  }

  if (cfg.signoff && !isOutside && !isCamper && !isStaffFood) {
    push(rule());
    chunks.push(escBytes([0x0a, 0x0a, 0x0a])); // gap before sign-off, further down the check
    chunks.push(escBytes([0x1b, 0x61, 0x00])); // left align
    wrapText("Please complete below to confirm you have received your full order", LINE_WIDTH)
      .forEach((l) => push(`${l}\n`));
    chunks.push(escBytes([0x0a]));
    push(dottedLine("Room Number "));
    chunks.push(escBytes([0x0a])); // increased spacing between fields
    push(dottedLine("Name "));
    chunks.push(escBytes([0x0a]));
    push(dottedLine("Signed "));
  }

  if (isCamper) {
    push(rule());
    chunks.push(escBytes([0x1b, 0x61, 0x01, 0x1b, 0x45, 0x01])); // center + bold
    push("CAMPER VAN - TAKEAWAY\n");
    push(`REG: ${camperReg}\n`);
    chunks.push(escBytes([0x1b, 0x45, 0x00, 0x1b, 0x61, 0x00]));
  }

  if (isTest) {
    chunks.push(escBytes([0x1b, 0x61, 0x01]));
    push(rule());
    testBanner();
  }

  chunks.push(escBytes([0x0a, 0x0a, 0x0a, 0x0a])); // feed
  chunks.push(escBytes([0x1d, 0x56, 0x42, 0x00])); // feed + partial cut

  return Buffer.concat(chunks);
}

// Black Horse Botanicals receipt (a separate business that sells in the pub: its own name, no VAT details, nothing about the pub's tills).
// The payload is the receipt JSON the Botanicals tablet sends: { business_name, address_lines[], footer, ts, receipt_no, team_member, is_refund, test, lines:[{name,qty,unit_price,line_total}], total }.
function plain(t, max) {
  return String(t == null ? "" : t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/#/g, "").replace(/[^\x20-\x7e]/g, "?").trim().slice(0, max || 200);
}
function buildBotanicalsReceipt(job) {
  const p = job.payload || {};
  const refund = !!p.is_refund, sign = refund ? -1 : 1;
  const when = p.ts ? new Date(p.ts) : (job.created_at ? new Date(job.created_at) : new Date());
  const date = when.toLocaleDateString("en-GB", { timeZone: "Europe/London" });
  const time = when.toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });
  const chunks = [];
  const push = (t) => chunks.push(Buffer.from(t, "ascii"));
  chunks.push(escBytes([0x1b, 0x40])); // initialize
  chunks.push(escBytes([0x1b, 0x52, 0x03])); // UK character set ('#' prints as the pound sign)
  chunks.push(escBytes([0x1b, 0x61, 0x01])); // centre
  if (p.test) {
    chunks.push(escBytes([0x1b, 0x45, 0x01]));
    push("*** TEST RECEIPT ***\n");
    chunks.push(escBytes([0x1b, 0x45, 0x00]));
    push(rule());
  }
  chunks.push(escBytes([0x1b, 0x45, 0x01, 0x1d, 0x21, 0x01])); // bold, double height
  wrapText(plain(p.business_name || "Black Horse Botanicals", 80).toUpperCase(), LINE_WIDTH).forEach((l) => push(l + "\n"));
  chunks.push(escBytes([0x1d, 0x21, 0x00, 0x1b, 0x45, 0x00]));
  (Array.isArray(p.address_lines) ? p.address_lines : []).slice(0, 6).forEach((l) => wrapText(plain(l, 120), LINE_WIDTH).forEach((x) => push(x + "\n")));
  push(rule());
  chunks.push(escBytes([0x1b, 0x61, 0x00])); // left
  push(`Receipt No. ${plain(p.receipt_no, 12) || "-"}   ${date} ${time}\n`);
  if (p.team_member) push(`Served by ${plain(p.team_member, 24)}\n`);
  if (refund) {
    chunks.push(escBytes([0x1b, 0x45, 0x01]));
    push("REFUND\n");
    chunks.push(escBytes([0x1b, 0x45, 0x00]));
  }
  push(rule());
  const lines = Array.isArray(p.lines) ? p.lines : [];
  lines.forEach((l) => {
    const qty = Math.abs(Number(l.qty) || 0), each = Number(l.unit_price) || 0;
    const value = sign * Math.abs(l.line_total != null ? Number(l.line_total) || 0 : qty * each);
    wrapText(`${qty} x ${plain(l.name, 60)}`, LINE_WIDTH - 9).forEach((x, i, all) => push(i === all.length - 1 ? priceRow(x, value) : x + "\n"));
  });
  if (!lines.length) push("(no items)\n");
  push(rule());
  chunks.push(escBytes([0x1b, 0x45, 0x01]));
  push(priceRow(refund ? "Total refunded" : "Total", sign * Math.abs(Number(p.total) || 0)));
  chunks.push(escBytes([0x1b, 0x45, 0x00]));
  push(refund ? "Refunded to card\n" : "Paid by card\n");
  if (p.footer) {
    push(rule());
    chunks.push(escBytes([0x1b, 0x61, 0x01]));
    wrapText(plain(p.footer, 200), LINE_WIDTH).forEach((x) => push(x + "\n"));
  }
  chunks.push(escBytes([0x0a, 0x0a, 0x0a, 0x0a])); // feed
  chunks.push(escBytes([0x1d, 0x56, 0x42, 0x00])); // feed + partial cut
  return Buffer.concat(chunks);
}

function printToDevice(buffer, ip, port) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(hard);
      if (err) { try { socket.destroy(); } catch (e) {} reject(err); } else resolve();
    };
    const socket = net.createConnection(port, ip, () => {
      socket.write(buffer, () => {
        setTimeout(() => {
          socket.end();
          finish();
        }, 300);
      });
    });
    socket.setTimeout(5000, () => finish(new Error("printer connection timed out")));
    socket.on("error", finish);
    // Whatever the socket does (an unreachable printer can sit in SYN retries far longer than the idle timeout), give up after 10 seconds
    // so the caller can put the job back to pending instead of waiting forever.
    const hard = setTimeout(() => finish(new Error(`no answer from printer ${ip} in 10 seconds`)), 10000);
  });
}

module.exports = { buildTicket, buildBotanicalsReceipt, printToDevice, LINE_WIDTH };
