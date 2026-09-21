// Kitchen printer bridge for the Black Horse Beamish room-service system.
//
// Runs on any machine on the same LAN as the Bixolon SRP-275IIIC (this is
// necessary because the guest app and portal run in a browser, which can't
// open a raw TCP socket to a printer). It polls Supabase for print_jobs rows
// with destination "kitchen" and status "pending", renders each one as ESC/POS
// bytes, sends it straight to the printer's network port, then marks the job
// "printed" — the same status the portal's virtual-printer "Mark printed"
// button sets, so both stay in sync.
//
// Run with: node kitchen-printer.js   (needs Node 18+ for built-in fetch)

const net = require("net");

const SUPABASE_URL = "https://safcrtrfdzsnftghibot.supabase.co";
const SUPABASE_KEY = "sb_publishable_RGaIB8W145BFCWzOxamQvA_7VIkTHMU";

const PRINTER_IP = "192.168.100.134";
const PRINTER_PORT = 9100;
const POLL_MS = 4000;
const LINE_WIDTH = 32; // characters per line at the printer's default font/column setting

function escBytes(bytes) { return Buffer.from(bytes); }
function rule() { return "-".repeat(LINE_WIDTH) + "\n"; }

function buildTicket(job) {
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
  chunks.push(escBytes([0x1b, 0x45, 0x01])); // bold on
  chunks.push(escBytes([0x1d, 0x21, 0x11])); // double height + width
  push("KITCHEN\n");
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

  push(rule());
  chunks.push(escBytes([0x1b, 0x61, 0x01])); // center
  push("Guest sign-off - received\n");
  push("full order as above\n");
  push("_________________________\n");

  chunks.push(escBytes([0x0a, 0x0a, 0x0a, 0x0a])); // feed
  chunks.push(escBytes([0x1d, 0x56, 0x42, 0x00])); // feed + partial cut

  return Buffer.concat(chunks);
}

function printToDevice(buffer) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(PRINTER_PORT, PRINTER_IP, () => {
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

async function pollOnce() {
  const jobs = await rest(
    "print_jobs?destination=eq.kitchen&status=eq.pending&order=created_at.asc&select=*"
  );
  for (const job of jobs) {
    const label = `order #${job.payload?.order_no ?? "?"}`;
    try {
      await printToDevice(buildTicket(job));
      await rest(`print_jobs?id=eq.${job.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "printed", printed_at: new Date().toISOString() }),
      });
      console.log(`[${new Date().toLocaleTimeString()}] printed ${label}`);
    } catch (e) {
      console.error(`[${new Date().toLocaleTimeString()}] FAILED to print ${label}: ${e.message}`);
    }
  }
}

console.log(`Kitchen printer bridge running — polling every ${POLL_MS / 1000}s, printing to ${PRINTER_IP}:${PRINTER_PORT}`);
pollOnce().catch((e) => console.error("poll error:", e.message));
setInterval(() => {
  pollOnce().catch((e) => console.error("poll error:", e.message));
}, POLL_MS);
