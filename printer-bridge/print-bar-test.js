// One-off manual test: prints a sample BAR ticket (logo + guest sign-off
// section) to the printer, without touching the live print_jobs queue or the
// kitchen-printer.js bridge. Useful right now because there's only one
// physical printer to test on, even though in production the bar format
// will only ever go to a dedicated bar printer/queue.
//
// Run with: node print-bar-test.js

const { buildTicket, printToDevice } = require("./ticket.js");

const PRINTER_IP = "192.168.100.134";
const PRINTER_PORT = 9100;

const sampleJob = {
  created_at: new Date().toISOString(),
  payload: {
    order_no: "TEST",
    guest_name: "Sample Guest",
    room_number: "7",
    channel: "room_service",
    notes: "Testing the bar ticket layout",
    allergy_notes: null,
    lines: [
      { qty: 2, name: "Peroni 0.0% (330ml)", category: "drink" },
      { qty: 1, name: "10oz Ribeye Steak (Medium)", category: "food" },
      { qty: 1, name: "Peppercorn Sauce", category: "food" },
    ],
  },
};

(async () => {
  const ticket = buildTicket(sampleJob, { station: "BAR", includeLogo: true, includeSignoff: true });
  await printToDevice(ticket, PRINTER_IP, PRINTER_PORT);
  console.log("Bar test ticket sent.");
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
