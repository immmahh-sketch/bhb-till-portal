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

  if (cfg.logo && LOGO) {
    chunks.push(LOGO);
    chunks.push(escBytes([0x0a]));
  }

  const tag = kindKey === "staff-copy" && (isOutside || isStaffFood) ? "STAFF COPY" : cfg.tag;
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
  push(`${isStaffFood ? "STAFF FOOD" : isOutside ? "OUTSIDE" : "ROOM SERVICE"}\n`);
  chunks.push(escBytes([0x1d, 0x21, 0x00])); // back to normal size
  push(isStaffFood ? "COLLECTING AT 12:30PM\n" : `${isOutside ? "Table " : "Room "}${p.room_number ?? "-"}\n`);
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
    push(priceRow(isOutside ? "Service charge (10%)" : "Tray charge", charge));
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

  if (cfg.signoff && !isOutside && !isStaffFood) {
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

  chunks.push(escBytes([0x0a, 0x0a, 0x0a, 0x0a])); // feed
  chunks.push(escBytes([0x1d, 0x56, 0x42, 0x00])); // feed + partial cut

  return Buffer.concat(chunks);
}

function printToDevice(buffer, ip, port) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(port, ip, () => {
      socket.write(buffer, () => {
        setTimeout(() => {
          socket.end();
          resolve();
        }, 300);
      });
    });
    socket.setTimeout(5000, () => {
      socket.destroy();
      reject(new Error("printer connection timed out"));
    });
    socket.on("error", reject);
  });
}

module.exports = { buildTicket, printToDevice, LINE_WIDTH };
