// Sends a sample carvery order (marked TEST, so nobody makes it) straight to the carvery printers, without touching the live print_jobs queue.
// Prints the bar check (drinks), then the kitchen check and the pass check (food), to the addresses in carvery-printers.txt.
//   node print-carvery-test.js          prints the three checks
//   node print-carvery-test.js --text   only shows on screen what each check would say, prints nothing

const { buildTicket, printToDevice } = require("./ticket.js");
const fs = require("fs"), path = require("path");

function where() {
  const out = {}; let all = null;
  for (const raw of fs.readFileSync(path.join(__dirname, "carvery-printers.txt"), "utf8").split(/\r?\n/)) {
    const t = raw.replace(/#.*/, "").trim(); if (!t) continue;
    const m = t.match(/^(bar|kitchen|pass)\s*[=:]\s*(\d{1,3}(?:\.\d{1,3}){3})$/i);
    if (m) out[m[1].toLowerCase()] = m[2]; else if (/^\d{1,3}(\.\d{1,3}){3}$/.test(t)) all = t;
  }
  return { bar: out.bar || all, kitchen: out.kitchen || all, pass: out.pass || all };
}

const job = {
  created_at: new Date().toISOString(),
  payload: {
    order_no: 999, guest_name: "Test Guest", room_number: "12", channel: "carvery", is_test: true, notes: "Test order", allergy_notes: "",
    lines: [
      { qty: 2, name: "Soup of the Day", category: "food", station: "starters" },
      { qty: 1, name: "Sticky Toffee Pudding", category: "food", station: "desserts" },
      { qty: 2, name: "Pint of Lager", category: "drink" },
      { qty: 1, name: "Large Glass of Merlot", category: "drink" },
    ],
  },
};

const copies = [["bar", "carvery-bar"], ["kitchen", "carvery-kitchen"], ["pass", "carvery-pass"]];
(async () => {
  if (process.argv.includes("--text")) {
    for (const [copy, kind] of copies) {
      console.log(`----- ${copy} -----`);
      console.log(buildTicket(job, { kind }).toString("latin1").replace(/[\x00-\x08\x0b-\x1f]|\x1b[@RaE].?|\x1d[!VB].{0,2}/g, "").replace(/\x1b./g, ""));
    }
    return;
  }
  const w = where();
  for (const [copy, kind] of copies) {
    if (!w[copy]) { console.log(`no printer set for ${copy}, skipped`); continue; }
    await printToDevice(buildTicket(job, { kind }), w[copy], 9100);
    console.log(`${copy} check sent to ${w[copy]}`);
  }
})().catch((e) => { console.error("failed:", e.message); process.exit(1); });
