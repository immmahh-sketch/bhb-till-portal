// Shared ESC/POS ticket builder + raw-socket printing for the Black Horse
// Beamish room-service/outside-table system. Used by kitchen-printer.js
// (the live poller) and the one-off bar test script.

const net = require("net");
const fs = require("fs");
const path = require("path");

const LINE_WIDTH = 32; // characters per line at the printer's default font/column setting

// This printer's command set has no GS v 0 (raster image) support, and its
// FS q/FS p NV bit image commands produced corrupted output on this unit
// (byte layout didn't match the documented spec closely enough to trust) —
// see manual_extract.txt for the command reference. ESC * (classic 8-dot
// band bit image mode) worked reliably instead, so the logo is pre-rendered
// as a ready-to-send ESC * byte sequence (see generate-logo-assets.py) and
// just inlined into each bar ticket.
const BAR_LOGO = (() => {
  try {
    return fs.readFileSync(path.join(__dirname, "assets", "bar-logo-escstar.bin"));
  } catch (e) {
    return null; // logo asset missing - tickets still print, just without it
  }
})();

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

// station: "KITCHEN" | "BAR"
// includeLogo / includeSignoff: bar tickets get both, kitchen gets neither
function buildTicket(job, opts = {}) {
  const { station = "KITCHEN", includeLogo = false, includeSignoff = false } = opts;
  const p = job.payload || {};
  const lines = p.lines || [];
  const food = lines.filter((l) => l.category === "food");
  const drink = lines.filter((l) => l.category !== "food");
  const isOutside = p.channel === "outside";
  const time = job.created_at
    ? new Date(job.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : "";

  const chunks = [];
  const push = (s) => chunks.push(Buffer.from(s, "ascii"));
  const line = (l) => push(`${l.qty} x ${l.name}\n`);

  chunks.push(escBytes([0x1b, 0x40])); // initialize
  chunks.push(escBytes([0x1b, 0x61, 0x01])); // center

  if (includeLogo && BAR_LOGO) {
    chunks.push(BAR_LOGO);
    chunks.push(escBytes([0x0a]));
  }

  chunks.push(escBytes([0x1b, 0x45, 0x01])); // bold on
  chunks.push(escBytes([0x1d, 0x21, 0x11])); // double height + width
  push(`${station}\n`);
  chunks.push(escBytes([0x1d, 0x21, 0x00])); // back to normal size
  push(`${isOutside ? "OUTSIDE" : "ROOM SERVICE"}\n`);
  push(`${isOutside ? "Table " : "Room "}${p.room_number ?? "-"}\n`);
  chunks.push(escBytes([0x1b, 0x45, 0x00])); // bold off
  push(rule());

  chunks.push(escBytes([0x1b, 0x61, 0x00])); // left align
  push(`Order #${p.order_no ?? "-"}   ${time}\n`);
  if (p.guest_name) push(`${p.guest_name}\n`);
  push(rule());

  if (food.length) {
    chunks.push(escBytes([0x1b, 0x45, 0x01]));
    push("FOOD\n");
    chunks.push(escBytes([0x1b, 0x45, 0x00]));
    food.forEach(line);
  }
  if (drink.length) {
    chunks.push(escBytes([0x1b, 0x45, 0x01]));
    push("DRINKS\n");
    chunks.push(escBytes([0x1b, 0x45, 0x00]));
    drink.forEach(line);
  }
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

  if (includeSignoff) {
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
