// Builds the Excel copy of a month: the Forecast sheet laid out like the monthly workbook (same rows, same columns: days E:AI, weeks AK:AP, weekdays AR:AX, month AZ),
// Month Set up, a Summary of every month, the report data the month used (the workbook's feeder sheets), and a list of everything typed over.
// Figures are the values calculated online; formulas are not written (yet). ExcelJS is loaded by the page.
import { LINES, WD } from "./engine.js";

const FMT = { n0: "#,##0", n1: "#,##0.0", n2: "#,##0.00", gbp: "£#,##0;[Red]-£#,##0", gbp2: "£#,##0.00;[Red]-£#,##0.00", pct: "0.0%", text: "@" };
export const TWO_DP = new Set(["arr", "arr_total", "revpar", "trevpar", "bfast_spend", "lunch_spend", "dinner_spend", "bev_lunch_spend", "bev_dinner_spend", "fn_spend", "rate_bob", "rate_pickup", "adr_comb", "py_arr", "covers_per_hour", "sleeper_ratio", "sd_dinner", "bfast_ratio"]);
export const fmtOf = (l) => (l.fmt === "gbp" && TWO_DP.has(l.key) ? "gbp2" : l.fmt);
const SECTION_ROWS = { 8: "Rooms", 21: "Breakfast", 26: "Restaurant", 33: "Restaurant - Beverage", 40: "Weddings & Events", 49: "Other Revenue", 59: "Daily Summary", 68: "KPIs", 98: "Gross P&L (Revenue - Wages)", 110: "Rooms detail", 125: "Daily Summary", 138: "Locked Forecast" };
const colL = (n) => { let s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const ymdDate = (s) => new Date(s + "T00:00:00Z");
export const SETUP_NAMES = ["Sleeper Ratio", "Breakfast diner ratio", "Restaurant Lunch covers", "Restaurant Dinner covers", "Restaurant Lunch Average Spend", "Restaurant Dinner average Spend", "Restaurant Lunch Covers (beverage, not used)", "Restaurant Bev Dinner Covers (not used)", "Restaurant Bev Lunch Av Spend", "Restaurant Bev Dinner Av Spend", "Room sales forecast", "Function Bar Avg Spend", "Breakfast average spend", "Pickup ADR", "Dinner S/D", "Start off BOB rate", "Predicted rooms if a wedding that night", "Predicted rooms if a wedding the next night"];

export async function buildWorkbook(ExcelJS, ctx) {
  const { ym, res, setup, months, feed, events, overrides, title } = ctx;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Black Horse Beamish - Forecast tile"; wb.created = new Date();
  const mname = new Date(ym + "-01T00:00:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

  // ------------------------------------------------------------------ Forecast
  const ws = wb.addWorksheet("Forecast", { views: [{ state: "frozen", xSplit: 4, ySplit: 6, showGridLines: false }] });
  ws.getColumn(1).width = 2; ws.getColumn(2).width = 11; ws.getColumn(3).width = 38; ws.getColumn(4).width = 6;
  for (let c = 5; c <= 52; c++) ws.getColumn(c).width = 11;
  ws.getColumn(36).width = 3; ws.getColumn(43).width = 3; ws.getColumn(51).width = 3;
  ws.getCell("C1").value = title || `Forecast - ${mname}`; ws.getCell("C1").font = { bold: true, size: 14, color: { argb: "FF3B483C" } };
  ws.getCell("C2").value = "Calculated online. Figures typed over by hand are in blue; finished days are shaded."; ws.getCell("C2").font = { italic: true, color: { argb: "FF7B887C" } };
  const dayCols = res.days.map((_, i) => 5 + i);
  res.days.forEach((d, i) => {
    const c = 5 + i;
    ws.getCell(4, c).value = ymdDate(d.date); ws.getCell(4, c).numFmt = "dd/mm/yy";
    ws.getCell(5, c).value = d.dow; ws.getCell(6, c).value = d.week;
  });
  const weekKeys = Object.keys(res.weeks).sort(), wdKeys = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weekCol = (j) => 37 + j, wdCol = (j) => 44 + j, totCol = 52;
  weekKeys.forEach((k, j) => { ws.getCell(6, weekCol(j)).value = k; });
  wdKeys.forEach((k, j) => { ws.getCell(6, wdCol(j)).value = k; });
  ws.getCell(6, totCol).value = "Total";
  for (let c = 5; c <= totCol; c++) for (const r of [4, 5, 6]) { const cell = ws.getCell(r, c); cell.font = { bold: true, color: { argb: "FF3B483C" } }; cell.alignment = { horizontal: "center" }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEFED" } }; }

  let extra = 151; const placed = [];
  for (const l of LINES) {
    if (["date", "dow", "week"].includes(l.key)) continue;
    let r = l.row; if (!r) { r = extra++; if (!placed.length) { ws.getCell(r - 1, 3).value = "Added online (not in the old workbook)"; ws.getCell(r - 1, 3).font = { bold: true, color: { argb: "FF3B483C" } }; ws.getRow(r - 1).eachCell({ includeEmpty: true }, (c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE3D5" } }; }); } placed.push(l.key); }
    const nf = FMT[fmtOf(l)] || "General";
    ws.getCell(r, 3).value = l.label; ws.getCell(r, 3).font = { bold: !!l.bold };
    res.days.forEach((d, i) => {
      const cell = ws.getCell(r, 5 + i); let v = d[l.key]; if (v === "" || v === undefined) return;
      cell.value = v; cell.numFmt = nf;
      const src = ctx.srcOf ? ctx.srcOf(d.date, l.key) : "";
      if (src) cell.font = { color: { argb: "FF1F4E8C" }, bold: !!l.bold };
      else if (l.bold) cell.font = { bold: true };
    });
    const put = (col, a) => { if (a && a[l.key] !== undefined && l.kind !== "none" && l.kind !== "text") { const cell = ws.getCell(r, col); cell.value = a[l.key]; cell.numFmt = nf; if (l.bold) cell.font = { bold: true }; } };
    weekKeys.forEach((k, j) => put(weekCol(j), res.weeks[k]));
    wdKeys.forEach((k, j) => put(wdCol(j), res.weekdays[k]));
    put(totCol, res.total);
  }
  for (const [r, name] of Object.entries(SECTION_ROWS)) {
    const row = ws.getRow(+r); if (row.getCell(3).value) continue;
    row.getCell(3).value = name; row.eachCell({ includeEmpty: true }, (c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE3D5" } }; c.font = { bold: true, color: { argb: "FF3B483C" } }; });
    for (let c = 1; c <= totCol; c++) { const cell = ws.getCell(+r, c); cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE3D5" } }; cell.font = { bold: true, color: { argb: "FF3B483C" } }; }
  }
  res.days.forEach((d, i) => { if (ctx.actualOf && ctx.actualOf(d.date)) for (const r of [4, 5, 6]) ws.getCell(r, 5 + i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F0E4" } }; });

  // ------------------------------------------------------------------ Month Set up
  const ms = wb.addWorksheet("Month Set up", { views: [{ state: "frozen", xSplit: 1, ySplit: 2 }] });
  ms.getColumn(1).width = 16; for (let c = 2; c <= 19; c++) ms.getColumn(c).width = 17;
  for (let c = 1; c <= 19; c++) ms.getCell(1, c).value = c; ms.getCell("A2").value = "Revenue";
  SETUP_NAMES.forEach((n, i) => { ms.getCell(2, 2 + i).value = n; ms.getCell(2, 2 + i).alignment = { wrapText: true, vertical: "top" }; });
  ms.getRow(2).height = 48; ms.getRow(2).font = { bold: true }; ms.getRow(1).font = { color: { argb: "FF7B887C" } };
  WD.slice(1).concat(["Sun"]).forEach((w, i) => {
    ms.getCell(4 + i, 1).value = w;
    for (let c = 2; c <= 19; c++) { const v = setup.wd?.[w]?.[c]; if (v !== undefined) ms.getCell(4 + i, c).value = v; }
  });
  ms.getCell("A12").value = "Number of rooms"; ms.getCell("B12").value = setup.rooms;

  // ------------------------------------------------------------------ Summary (every month)
  const sm = wb.addWorksheet("Summary", { views: [{ state: "frozen", xSplit: 1, ySplit: 1 }] });
  const SUM = [["Rooms sold", "rooms_fc", "n0"], ["Occupancy", "occ", "pct"], ["ARR", "arr_total", "gbp2"], ["Rooms revenue", "rev_rooms", "gbp"], ["Food revenue", "rev_food", "gbp"], ["Beverage revenue", "rev_bev", "gbp"], ["Room hire", "rev_hire", "gbp"], ["Other revenue", "rev_other", "gbp"], ["TOTAL REVENUE", "rev_total", "gbp"], ["Total wages", "wages_total", "gbp"], ["Labour %", "labour_pct", "pct"], ["Revenue less wages", "pl_total", "gbp"]];
  sm.getColumn(1).width = 22; sm.getCell(1, 1).value = "Month"; sm.getCell(1, 1).font = { bold: true };
  SUM.forEach(([n], j) => { const c = sm.getCell(1, 2 + j); c.value = n; c.font = { bold: true }; c.alignment = { wrapText: true, horizontal: "center" }; sm.getColumn(2 + j).width = 14; });
  months.forEach((m, i) => {
    sm.getCell(2 + i, 1).value = new Date(m.ym + "-01T00:00:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
    SUM.forEach(([, k, f], j) => { const c = sm.getCell(2 + i, 2 + j); c.value = m.res.total[k]; c.numFmt = FMT[f]; });
  });

  // ------------------------------------------------------------------ the report data the month used
  const dates = res.days.map((d) => d.date);
  const sheet = (name, head, rows) => { const w = wb.addWorksheet(name); w.addRow(head).font = { bold: true }; rows.forEach((r) => w.addRow(r)); head.forEach((_, i) => { w.getColumn(i + 1).width = i === 0 ? 14 : 16; }); w.getColumn(1).numFmt = "dd/mm/yyyy"; return w; };
  sheet("Actual_forecast_1", ["Date", "DayOfWeek", "Avail", "Total", "Occ", "Total_guests", "Accomm", "ARR", "InStock", "FB", "Other", "NonRevenue", "TotalRevenue", "GrandTotal"],
    dates.filter((d) => feed.bob?.[d]).map((d) => { const x = feed.bob[d]; return [ymdDate(d), res.days[dates.indexOf(d)].dow, x.avail ?? 0, x.rooms ?? 0, x.occ ?? 0, x.guests ?? 0, x.accomm ?? 0, x.arr ?? 0, x.instock ?? 0, x.fb ?? 0, x.other ?? 0, x.nonrev ?? 0, x.total ?? 0, x.grand ?? 0]; }));
  sheet("Opentable", ["Date", "Lunch", "Dinner"], dates.filter((d) => feed.opentable?.[d]).map((d) => [ymdDate(d), feed.opentable[d].lunch, feed.opentable[d].dinner]));
  sheet("Meal Plan", ["Date", "Column17", "Column18", "Column19", "Column20", "Total"], dates.filter((d) => feed.mealplan?.[d]).map((d) => { const x = feed.mealplan[d]; return [ymdDate(d), x.b, x.ch, x.inf, x.c20, x.total]; }));
  sheet("Weddings", ["Start", "EventRef", "Event Name", "Event Type", "Status", "Del.", "Accomm", "Food", "Other", "Beverage", "Function_F&B", "Function_Hre", "Total"],
    (events || []).filter((e) => e.date.slice(0, 7) === ym).map((e) => [ymdDate(e.date), e.ref, e.name, e.type, e.status, e.guests, e.accomm, e.food, e.other, e.bev, e.ffb, e.fhire, e.total]));
  sheet("PayrollByDepartment", ["Date", "BOH", "FOH", "Housekeeping", "MAINTENANCE", "Office"], dates.filter((d) => feed.pay?.[d]).map((d) => { const x = feed.pay[d]; return [ymdDate(d), x.boh, x.foh, x.hk, x.maint, x.office]; }));
  sheet("HKCleaningTarget", ["Date", "StandardTargetMinutes", "LargeTargetMinutes", "TotalTargetMinutes", "RoomCount"], Object.keys(feed.hk || {}).filter((d) => d.slice(0, 7) === ym).sort().map((d) => { const x = feed.hk[d]; return [ymdDate(d), x.std, x.large, x.total, x.rooms]; }));
  sheet("OccByRoomType", ["Date", "CLASSIC_DBL", "DLX_DBL_FF", "DLX_DBL_GF", "DLX_HT_SUITE", "HUCKLEBERRY", "ROSEMARY", "STU_SUITE"], dates.filter((d) => feed.occ?.[d]).map((d) => [ymdDate(d), ...feed.occ[d].v]));

  // ------------------------------------------------------------------ what was typed over
  const cs = wb.addWorksheet("Typed over");
  cs.addRow(["Date", "Line", "Value", "Source"]).font = { bold: true };
  (overrides || []).forEach((o) => cs.addRow([ymdDate(o.day), o.label, o.value, o.src]));
  cs.getColumn(1).width = 14; cs.getColumn(2).width = 40; cs.getColumn(3).width = 14; cs.getColumn(4).width = 14; cs.getColumn(1).numFmt = "dd/mm/yyyy";
  return await wb.xlsx.writeBuffer();
}
