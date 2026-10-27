// One sample Christmas pre-order ticket, to check the new bigger text on Kitchen Printer 1.
// Run from the printer bridge folder:   node print-xmas-test.js
// It prints ONE ticket marked "TEST TICKET - DO NOT MAKE" and does not touch the system.
const { buildPreorderTicket, printToDevice } = require("./ticket.js");
const PRINTER = "192.168.100.10", PORT = 9100;
const job = { payload: { kind: "preorder-ticket", copy: "KITCHEN", venue: "RESTAURANT", time: "13:45", name: "TEST TICKET DO NOT MAKE", ref: "TEST", table: "28", adults: 4, children: 2, infants: 0,
  courses: [
    { label: "STARTERS", lines: ["3 x Pressed Duck Terrine", "2 x Celeriac Soup", "1 x Mozzarella Sticks"] },
    { label: "MAINS", lines: ["4 x Roast Turkey", "1 x Tomato Pasta", "1 x Vegetarian Wellington"] },
    { label: "DESSERTS", lines: ["6 x Christmas Pudding"] },
  ],
  diet: "Adult 2 (Ann): gluten free; Child 5: no nuts", standard_note: "", seq: 1, total: 1 } };
printToDevice(buildPreorderTicket(job), PRINTER, PORT)
  .then(() => console.log("Sent one test ticket to " + PRINTER))
  .catch((e) => console.error("Could not print: " + e.message));
