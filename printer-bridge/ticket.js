// Shared ESC/POS ticket builder + raw-socket printing for the Black Horse
// Beamish room-service/outside-table system.
//
// Four ticket kinds come out of one order, printed across two stations:
//   kitchen    -> kitchen printer: food lines only, no price, no logo, no sign-off
//   bar-prep   -> bar printer: drink lines only, no price, no logo, no sign-off
//   staff-copy -> bar printer: everything, with prices, tray/service charge,
//                 total, logo, and the guest sign-off section
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
  kitchen: { tag: null, category: "food", prices: false, logo: false, signoff: false, vat: false },
  "bar-prep": { tag: null, category: "drink", prices: false, logo: false, signoff: false, vat: false },
  "staff-copy": { tag: "ROOM SERVICE COPY", category: "all", prices: true, logo: true, signoff: true, vat: false },
  "guest-copy": { tag: "GUEST COPY", category: "all", prices: true, logo: true, signoff: false, vat: true },
};

function money(n) { return "£" + (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2); }
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
  const lines = cfg.category === "all" ? allLines : allLines.filter((l) =>
    cfg.category === "food" ? l.category === "food" : l.category !== "food"
  );
  const isOutside = p.channel === "outside";
  const time = job.created_at
    ? new Date(job.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : "";

  const chunks = [];
  const push = (s) => chunks.push(Buffer.from(s, "ascii"));
  const lineNoPrice = (l) => push(`${l.qty} x ${l.name}\n`);
  const linePrice = (l) => push(priceRow(`${l.qty} x ${l.name}`, (Number(l.unit_price) || 0) * (Number(l.qty) || 0)));

  chunks.push(escBytes([0x1b, 0x40])); // initialize
  chunks.push(escBytes([0x1b, 0x61, 0x01])); // center

  if (cfg.logo && LOGO) {
    chunks.push(LOGO);
    chunks.push(escBytes([0x0a]));
  }

  if (cfg.tag) {
    chunks.push(escBytes([0x1b, 0x45, 0x01]));
    push(`${cfg.tag}\n`);
    chunks.push(escBytes([0x1b, 0x45, 0x00]));
  }

  chunks.push(escBytes([0x1b, 0x45, 0x01])); // bold on
  chunks.push(escBytes([0x1d, 0x21, 0x11])); // double height + width
  push(`${isOutside ? "OUTSIDE" : "ROOM SERVICE"}\n`);
  chunks.push(escBytes([0x1d, 0x21, 0x00])); // back to normal size
  push(`${isOutside ? "Table " : "Room "}${p.room_number ?? "-"}\n`);
  chunks.push(escBytes([0x1b, 0x45, 0x00])); // bold off
  push(rule());

  chunks.push(escBytes([0x1b, 0x61, 0x00])); // left align
  push(`Order #${p.order_no ?? "-"}   ${time}\n`);
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
  if (p.allergy_notes) {
    push(rule());
    chunks.push(escBytes([0x1b, 0x45, 0x01]));
    push("** ALLERGY / DIETARY **\n");
    push(`${p.allergy_notes}\n`);
    chunks.push(escBytes([0x1b, 0x45, 0x00]));
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

  if (cfg.signoff) {
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
