// One-off manual test: prints bar-check, staff-copy and guest-copy for a
// sample order, without touching the live
// print_jobs queue or the kitchen/bar bridges. Useful for iterating on the
// ticket layout without needing a real order through the app each time.
//
// For an actual end-to-end test (through the real ordering flow, with both
// kitchen-printer.js and bar-printer.js running), place a test order via
// the guest app's test mode instead - see printer-bridge/README.md.
//
// Run with: node print-bar-test.js

const { buildTicket, printToDevice } = require("./ticket.js");

const PRINTER_IP = "192.168.100.134";
const PRINTER_PORT = 9100;

const itemsTotal = 32 + 5 + 6.9;
const trayCharge = 5;

const sampleJob = {
  created_at: new Date().toISOString(),
  payload: {
    order_no: "TEST",
    guest_name: "Sample Guest",
    room_number: "7",
    channel: "room_service",
    notes: "Testing the bar ticket layout",
    allergy_notes: null,
    subtotal: itemsTotal + trayCharge,
    tray_charge: trayCharge,
    lines: [
      { qty: 2, name: "Peroni 0.0% (330ml)", category: "drink", unit_price: 3.45 },
      { qty: 1, name: "10oz Ribeye Steak (Medium)", category: "food", unit_price: 32 },
      { qty: 1, name: "Peppercorn Sauce", category: "food", unit_price: 5 },
    ],
  },
};

(async () => {
  for (const kind of ["bar-check", "staff-copy", "guest-copy"]) {
    const ticket = buildTicket(sampleJob, { kind });
    await printToDevice(ticket, PRINTER_IP, PRINTER_PORT);
    console.log(`Sent ${kind}.`);
  }
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
