// Report readers for the Forecast tile. Each takes the file as the report system exports it (nothing needs renaming or tidying first) and returns the days it holds in the
// shape forecast-api stores. Rules are the Archive macro's (ModArchive), line for line:
//   Actual & Forecast (csv)      -> rooms on the books / actual per night: rooms, guests (Ad+Ch+Inf), ARR, rooms in stock, revenue
//   EventRevenueForecast (csv)   -> weddings and events, one row per event (a day's function = the first event that day, as the sheet does)
//   Booking Summary (csv)        -> ResDiary covers: "Visit Time" sets the time slot, the "Visit Date" rows under it are that slot's covers; 12:00-17:59 lunch, 18:00 on dinner
//   Meal Plan (xls/xlsx)         -> adults / children / infants on meal plan per night
//   End of Day (PeriodEnd xls, or the combined xlsx) -> revenue by code for one finished day
//   Occupancy Report (csv)       -> occupancy per room type per night
// parseFile(XLSX, name, arrayBuffer) -> { kind, label, days:[...], from, to, notes:[] } or { error }

const pad = (n) => String(n).padStart(2, "0");
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const serToYmd = (s) => new Date(Math.round((s - 25569) * 86400000)).toISOString().slice(0, 10);
const num = (x) => { if (x === null || x === undefined || x === "") return 0; const v = Number(String(x).replace(/[£,\s]/g, "")); return Number.isFinite(v) ? v : 0; };

// a date from whatever the export holds: dd/mm/yyyy [hh:mm[:ss]], yyyy-mm-dd, an Excel serial, or a JS Date
export function toYmd(v) {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  if (typeof v === "number") return v > 20000 && v < 80000 ? serToYmd(v) : null;
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return ymd(+m[3], +m[2], +m[1]);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return ymd(+m[1], +m[2], +m[3]);
  if (/^\d{5}(\.\d+)?$/.test(s)) return serToYmd(+s);
  return null;
}

// a proper CSV reader (quotes, doubled quotes, line breaks inside quotes)
export function parseCsv(text) {
  text = String(text).replace(/^﻿/, "");
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); cur = ""; if (row.length > 1 || row[0] !== "") rows.push(row); row = []; }
    else cur += c;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
const idx = (hdr, name) => hdr.findIndex((h) => String(h).trim().toLowerCase() === name.toLowerCase());
const range = (days) => { const d = days.map((x) => x.day).filter(Boolean).sort(); return d.length ? { from: d[0], to: d[d.length - 1] } : { from: null, to: null }; };

// ------------------------------------------------------------------------------------------------ each report
function actualForecast(rows) {
  const h = rows[0], c = {};
  for (const k of ["Date", "DayOfWeek", "Avail", "Total", "Occ", "Ad", "Ch", "Inf", "Accomm", "FB", "Other", "NonRevenue", "TotalRevenue", "GrandTotal", "ARR", "InStock"]) c[k] = idx(h, k);
  const miss = Object.entries(c).filter(([, v]) => v < 0).map(([k]) => k);
  if (miss.length) return { error: "The Actual & Forecast report is missing: " + miss.join(", ") + "." };
  const days = [];
  for (const r of rows.slice(1)) {
    const day = toYmd(r[c.Date]); if (!day) continue;
    days.push({ day, data: { rooms: num(r[c.Total]), guests: num(r[c.Ad]) + num(r[c.Ch]) + num(r[c.Inf]), arr: num(r[c.ARR]), avail: num(r[c.Avail]), instock: num(r[c.InStock]), occ: num(r[c.Occ]), accomm: num(r[c.Accomm]), fb: num(r[c.FB]), other: num(r[c.Other]), nonrev: num(r[c.NonRevenue]), total: num(r[c.TotalRevenue]), grand: num(r[c.GrandTotal]) } });
  }
  return { kind: "bob", label: "Actual & Forecast (rooms on the books and actuals)", days, ...range(days) };
}
function events(rows) {
  const h = rows[0], g = (n) => idx(h, n);
  const c = { ref: g("EventRef"), name: g("Event Name"), start: g("Start"), type: g("Event Type"), status: g("Status"), del: g("Del."), accomm: g("Accomm"), food: g("Food"), other: g("Other"), bev: g("Beverage"), ffb: g("Function_F&B"), fhire: g("Function_Hre"), total: g("Total") };
  if (c.ref < 0 || c.start < 0) return { error: "That does not look like the Event Revenue Forecast report." };
  const days = [];
  for (const r of rows.slice(1)) {
    const day = toYmd(r[c.start]); if (!day || !String(r[c.ref] || "").trim()) continue;
    days.push({ day, ref: String(r[c.ref]).trim(), name: r[c.name] || "", type: r[c.type] || "", status: r[c.status] || "", guests: num(r[c.del]), accomm: num(r[c.accomm]), food: num(r[c.food]), other: num(r[c.other]), bev: c.bev >= 0 ? num(r[c.bev]) : 0, ffb: num(r[c.ffb]), fhire: num(r[c.fhire]), total: num(r[c.total]) });
  }
  return { kind: "events", label: "Event Revenue Forecast (weddings and events)", days, ...range(days) };
}
function covers(rows) {
  const h = rows[0], cT = idx(h, "Grouping Type"), cV = idx(h, "Grouping Value"), cC = idx(h, "Total Covers");
  if (cT < 0 || cV < 0 || cC < 0) return { error: "The booking summary has no Grouping Type / Grouping Value / Total Covers columns." };
  const lu = new Map(), di = new Map(); let slot = -1, early = 0, sawTime = false;
  const slotHour = (s) => { s = String(s).trim(); const u = s.toUpperCase(), p = s.indexOf(":"); if (p < 1 || !/^\d+$/.test(s.slice(0, p))) return -1; let hh = +s.slice(0, p); if (u.includes("PM") && hh < 12) hh += 12; if (u.includes("AM") && hh === 12) hh = 0; return hh; };
  for (const r of rows.slice(1)) {
    const t = String(r[cT] || "").trim().toLowerCase();
    if (t === "visit time") { slot = slotHour(r[cV]); sawTime = true; }
    else if (t === "visit date") {
      const day = toYmd(r[cV]); if (!day || slot < 0) continue;
      const v = num(r[cC]);
      if (slot >= 12 && slot < 18) { lu.set(day, (lu.get(day) || 0) + v); if (!di.has(day)) di.set(day, 0); }
      else if (slot >= 18) { di.set(day, (di.get(day) || 0) + v); if (!lu.has(day)) lu.set(day, 0); }
      else early++;
    }
  }
  if (!sawTime) return { error: "This booking summary has no 'Visit Time' (time slot) rows, so lunch and dinner covers cannot be told apart. Run the ResDiary Booking Summary grouped by Visit Time, then Visit Date." };
  const days = [...lu.keys()].sort().map((day) => ({ day, data: { lunch: lu.get(day) || 0, dinner: di.get(day) || 0 } }));
  return { kind: "opentable", label: "ResDiary booking summary (lunch and dinner covers booked)", days, ...range(days), notes: early ? [`${early} early-slot rows (before 12:00) were left out.`] : [] };
}
function mealPlan(aoa) {
  const days = [];
  for (const r of aoa) {
    const day = toYmd(r[0]); if (!day || typeof r[0] === "string" && !/\d/.test(r[0])) continue;
    if (r.length < 19) continue;
    const t = num(r[6]) + num(r[7]) + num(r[8]) + num(r[9]) + num(r[11]) + num(r[12]);      // the Archive's "Column6-11" total, by position
    days.push({ day, data: { b: num(r[18]), ch: num(r[19]), inf: num(r[20]), c20: num(r[21]), total: t } });
  }
  return { kind: "mealplan", label: "Meal Plan report (adults, children, infants on meal plan)", days, ...range(days) };
}
// End of Day: raw PeriodEnd (date in C4, rows from 5 with code in C, description in E, amount in I) or the combined sheet (ColA, Code, Description, RevenueRaw, ReportDate)
function endOfDay(aoa, name) {
  let day = null, codes = [];
  const h0 = (aoa[0] || []).map((x) => String(x).trim().toLowerCase());
  if (h0[0] === "cola" && h0.includes("reportdate")) {
    const per = new Map();
    for (const r of aoa.slice(1)) {
      const d = toYmd(r[4]); if (!d) continue;
      const code = String(r[1] || "").trim(); if (!code || code === "Code" || code === "Total") continue;
      if (typeof r[3] !== "number") continue;
      (per.get(d) || per.set(d, []).get(d)).push({ code, description: r[2] || "", amount: r[3] });
    }
    const days = [...per.keys()].sort().map((d) => ({ day: d, codes: per.get(d) }));
    return { kind: "eod", label: "End of Day report", days, ...range(days) };
  }
  day = toYmd(aoa[3]?.[2]);
  if (!day) return { error: "No report date in cell C4: is that the End of Day (PeriodEnd) report?" };
  for (let i = 4; i < aoa.length; i++) {
    const r = aoa[i]; const amount = r[8];
    if (amount === "" || amount === undefined || amount === null) continue;
    const code = String(r[2] || "").trim(); if (!code || code === "Code" || code === "Total") continue;
    if (typeof amount !== "number") continue;
    codes.push({ code, description: r[4] || "", amount });
  }
  return { kind: "eod", label: "End of Day report", days: [{ day, codes }], from: day, to: day };
}
function occupancy(rows) {
  const dates = rows[0], labels = rows[1];
  const per = new Map();
  const types = ["CLASSIC_DBL", "DLX_DBL_FF", "DLX_DBL_GF", "DLX_HT_SUITE", "HUCKLEBERRY", "ROSEMARY", "STU_SUITE"];
  for (let c = 1; c < dates.length; c++) {
    if (String(labels[c]).trim() !== "Occ") continue;
    const day = toYmd(dates[c]); if (!day) continue;
    per.set(day, types.map((t) => { const row = rows.slice(2).find((r) => String(r[0]).trim() === t); return row ? num(row[c]) / 100 : 0; }));
  }
  const days = [...per.keys()].sort().map((d) => ({ day: d, data: { v: per.get(d) } }));
  return { kind: "occ", label: "Occupancy Report (occupancy by room type)", days, ...range(days) };
}

// ------------------------------------------------------------------------------------------------ the front door
export async function parseFile(XLSX, name, buf) {
  const lower = name.toLowerCase();
  try {
    if (lower.endsWith(".csv")) {
      const rows = parseCsv(new TextDecoder("utf-8").decode(new Uint8Array(buf)));
      if (!rows.length) return { error: "The file is empty." };
      const h = rows[0].map((x) => String(x).trim());
      if (h.includes("Date") && h.includes("Accomm") && h.includes("InStock")) return actualForecast(rows);
      if (h.includes("EventRef") && h.includes("Start")) return events(rows);
      if (h.includes("Grouping Type")) return covers(rows);
      if (h[0] === "RoomType") return occupancy(rows);
      return { error: "I do not recognise that report. It should be Actual & Forecast, Event Revenue Forecast, the ResDiary Booking Summary or the Occupancy Report." };
    }
    if (!XLSX) throw new Error("The spreadsheet reader has not loaded.");
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
    const a0 = String(aoa[0]?.[0] ?? "").trim(), a1 = String(aoa[1]?.[0] ?? "").trim();
    const isEod = a0.toLowerCase() === "cola" || /periodend/i.test(name) || /^\d{8}\.xlsx?$/i.test(name) || String(aoa[1]?.[0]).trim() === "Period Status" || String(aoa[6]?.[0]).trim() === "" && String(aoa[7]?.[0]).trim() === "Analysis Codes Revenue";
    if (isEod) return endOfDay(aoa, name);
    if (/mealplan|meal_plan|meal plan/i.test(name) || String(aoa[0]?.[10] ?? "") === "Meal Plan Report" || (a1 === "Date" && String(aoa[1]?.[1]).trim() === "RO")) return mealPlan(aoa);
    if (a0 === "Date" && String(aoa[0]?.[3]) === "Total") return actualForecast(aoa.map((r, i) => (i === 0 ? r : r.map((v, j) => (j === 0 && typeof v === "number" ? serToYmd(v) : v)))));
    if (a0 === "EventRef") return events(aoa.map((r, i) => (i === 0 ? r : r.map((v) => (typeof v === "number" && v > 20000 && v < 80000 ? serToYmd(v) : v)))));
    return { error: "I do not recognise that spreadsheet. It should be the Meal Plan report or the End of Day (PeriodEnd) report." };
  } catch (e) {
    return { error: "Could not read that file: " + (e && e.message ? e.message : e) };
  }
}
