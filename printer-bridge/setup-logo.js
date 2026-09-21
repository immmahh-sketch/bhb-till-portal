// One-time setup: stores the Black Horse Beamish logo in the printer's NV
// (flash) memory as bit image #1, using Bixolon's "FS q" command. This
// printer's command set doesn't support GS v 0 (the more common raster
// image command) — see printer-bridge/manual_extract.txt, pulled from the
// official SRP-275III command manual, for the full command reference.
//
// Run this ONCE per printer (or again if the printer is ever factory
// reset / its NV memory is cleared). After this, tickets only need to send
// "FS p 1 0" (4 bytes) to print the logo — see ticket.js.
//
// Run with: node setup-logo.js

const fs = require("fs");
const path = require("path");
const net = require("net");

const PRINTER_IP = "192.168.100.134";
const PRINTER_PORT = 9100;

function printToDevice(buffer, ip, port) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(port, ip, () => {
      socket.write(buffer, () => {
        setTimeout(() => {
          socket.end();
          resolve();
        }, 500);
      });
    });
    socket.setTimeout(8000, () => {
      socket.destroy();
      reject(new Error("printer connection timed out"));
    });
    socket.on("error", reject);
  });
}

(async () => {
  const fsq = fs.readFileSync(path.join(__dirname, "assets", "bar-logo-nv.bin"));
  console.log(`Sending FS q (define NV bit image #1) — ${fsq.length} bytes...`);
  await printToDevice(fsq, PRINTER_IP, PRINTER_PORT);
  console.log("Logo stored. The printer does a soft-reset after this command, so pausing briefly...");
  await new Promise((r) => setTimeout(r, 3000));

  // Confirm it actually printed: FS p 1 0 (print NV bit image 1, normal mode)
  const printCmd = Buffer.from([0x1c, 0x70, 0x01, 0x00, 0x0a, 0x0a]);
  console.log("Sending FS p 1 0 to print the stored logo as a check...");
  await printToDevice(printCmd, PRINTER_IP, PRINTER_PORT);
  console.log("Done — check the printer for the logo.");
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
