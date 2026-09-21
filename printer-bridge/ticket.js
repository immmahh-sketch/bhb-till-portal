// Shared ESC/POS ticket builder + raw-socket printing for the Black Horse
// Beamish room-service/outside-table system.
//
// Kitchen tickets fan out to four physical printers (see kitchen-printer.js):
//   kitchen            -> printer 1 (master/pass): every food line, always printed
//   kitchen-starters   -> printer 2: food lines tagged station "starters" (incl. sandwiches)
//   kitchen-mains      -> printer 3: food lines tagged "mains" (mains, grill, sides - and
//                         the fallback for any line with no station set)
//   kitchen-desserts   -> printer 4: food lines tagged "desserts"
// The station tag comes from roomservice_menu_items.kitchen_station, set per
// item in the portal's menu editor.
//
// Bar tickets:
//   bar-prep   -> bar printer: drink lines only, no price, no logo, no sign-off
//   staff-copy -> bar printer: everything, with prices, tray/service charge,
//                 total, logo. Room service orders also get the guest
//                 sign-off section (proof of delivery to the room); outside
//                 table orders skip it (no delivery, guest's right there)
//                 but still get the full itemised copy so staff know what
//                 they're carrying out - tagged "STAFF COPY" instead of
//                 "ROOM SERVICE COPY" in that case.
//   guest-copy -> bar printer: everything, with prices, tray/service charge,
//                 total, logo, payment method, VAT breakdown - no sign-off
//                 (this is the guest's VAT receipt to keep)
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
  kitchen: { heading: "KITCHEN", tag: null, category: "food", station: null, prices: false, logo: false, signoff: false, vat: false, allergyAlways: false },
  "kitchen-starters": { heading: "STARTERS", tag: null, category: "food", station: "starters", prices: false, logo: false, signoff: false, vat: false, allergyAlways: false },
  "kitchen-mains": { heading: "MAINS", tag: null, category: "food", station: "mains", prices: false, logo: false, signoff: false, vat: false, allergyAlways: false },
  "kitchen-desserts": { heading: "DESSERTS", tag: null, category: "food", station: "desserts", prices: false, logo: false, signoff: false, vat: false, allergyAlways: false },
  "bar-prep": { heading: "BAR", tag: null, category: "drink", station: null, prices: false, logo: false, signoff: false, vat: false, allergyAlways: false },
  "staff-copy": { heading: null, tag: "ROOM SERVICE COPY", category: "all", station: null, prices: true, logo: true, signoff: true, vat: false, allergyAlways: true },
  "guest-copy": { heading: null, tag: "GUEST COPY", category: "all", station: null, prices: true, logo: true, signoff: false, vat: true, allergyAlways: false },
};

// £ sent as a raw byte (0xA3) prints as the wrong glyph on this printer's
// default USA code table. ESC R 3 (UK international char set, set in
// buildTicket) remaps '#' (0x23) to £ instead, so amounts use '#' here and
// the printer does the substitution.
function money(n) { return "#" + (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2); }
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
  const allLines = p.lines || [];
  const lines = allLines.filter((l) => {
    if (cfg.category === "food" && l.category !== "food") return false;
    if (cfg.category === "drink" && l.category === "food") return false;
    // Any food line with no station set (e.g. an off-menu "something else"
    // item) falls back to the mains printer so it's never silently dropped.
    if (cfg.station && (l.station || "mains") !== cfg.station) return false;
    return true;
  });
  const isOutside = p.channel === "outside";
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

  const tag = kindKey === "staff-copy" && isOutside ? "STAFF COPY" : cfg.tag;
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
  push(`${isOutside ? "OUTSIDE" : "ROOM SERVICE"}\n`);
  chunks.push(escBytes([0x1d, 0x21, 0x00])); // back to normal size
  push(`${isOutside ? "Table " : "Room "}${p.room_number ?? "-"}\n`);
  chunks.push(escBytes([0x1b, 0x45, 0x00])); // bold off
  push(rule());

  chunks.push(escBytes([0x1b, 0x61, 0x00])); // left align
  push(`Order #${p.order_no ?? "-"}   ${date} ${time}\n`);
  if (p.guest_name) push(`${p.guest_name}\n`);
  push(rule());

  const food = lines.filter((l) => l.category === "food");
  const drink = lines.filter((l) => l.category !== "food");
  const printGroup = (label, items) => {
    if (!items.length) return;
    chunks.push(escBytes([0x1b, 0x45, 0x01]));
    push(`${label}\n`);
    chunks.push(escBytes([0x1b, 0x45, 0x00]));
    items.forEach(cfg.prices ? linePrice : lineNoPrice);
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

  if (cfg.prices) {
    const total = Number(p.subtotal) || 0;
    const charge = Number(p.tray_charge) || 0;
    push(rule());
    push(priceRow(isOutside ? "Service charge (10%)" : "Tray charge", charge));
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

  if (cfg.signoff && !isOutside) {
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
