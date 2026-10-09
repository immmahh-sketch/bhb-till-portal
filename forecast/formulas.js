// The Forecast sheet's formulas, as Excel formulas, for the downloaded workbook. One entry per line, written to give exactly what engine.js gives (the page checks this by
// recalculating the downloaded file in Excel and comparing). A day cell is a formula unless the figure was typed over, in which case it is the typed value.
// "c" is the column letter of the day (or of a week / weekday / month total, for the lines that are worked out from other lines of the same column).
//
// Feeder sheets the formulas read (all written into the workbook): 'Month Set up', Actual_forecast_1, Opentable, 'Meal Plan', Weddings, PayrollByDepartment, HKCleaningTarget,
// OccByRoomType. The labour model's numbers are named cells on 'Month Set up': Holiday, OnCost, HKRate, HKFixedMins, FBCostPct, FuncBOHHours, FuncBOHRate.
import { LINES } from "./engine.js";

export const FIRST_EXTRA_ROW = 151;
export function rowMap() {
  const R = {}; let extra = FIRST_EXTRA_ROW;
  for (const l of LINES) { if (["date", "dow", "week"].includes(l.key)) continue; R[l.key] = l.row || extra++; }
  return R;
}
export const LABOUR_NAMES = [["Holiday", "Holiday accrual on pay (BOH, FOH, housekeeping, maintenance)", 1.1207], ["OnCost", "Employer on-cost (NI and similar), all departments", 1.15], ["HKRate", "Housekeeping hourly rate for working minutes out", 12.71],
  ["HKFixedMins", "Housekeeping minutes a day not spent on rooms (reception, public areas)", 750], ["FBCostPct", "Cost of sales on food and beverage", 0.35], ["FuncBOHHours", "Kitchen hours charged to a function day", 16], ["FuncBOHRate", "Kitchen hourly rate charged to a function day", 14]];

const S = (c, n) => `INDEX('Month Set up'!$B$4:$S$10,MATCH(${c}$5,'Month Set up'!$A$4:$A$10,0),${n - 1})`;
const LK = (c, sheet, col, rng = "$A:$N") => `IFERROR(VLOOKUP(${c}$4,${sheet}!${rng},${col},FALSE),0)`;
const EV = (c, col) => `INDEX(Weddings!$${col}:$${col},MATCH(${c}$4,Weddings!$A:$A,0))`;

// day formula (without the leading "="), or null when the line is an input with no formula
export function dayFormula(key, c, actual, R) {
  const r = (k) => `${c}${R[k]}`;
  const sum = (...ks) => ks.map(r).join("+");
  switch (key) {
    case "rooms_avail": return `'Month Set up'!$B$12`;
    case "rooms_bob_in": return LK(c, "Actual_forecast_1", 4);
    case "rooms_target": return actual ? r("rooms_bob_in") : S(c, 12);
    case "pickup_needed": return `${r("rooms_target")}-${r("rooms_bob_in")}`;
    case "rooms_bob": return r("rooms_bob_in");
    case "rooms_pickup": return r("pickup_needed");
    case "rooms_fc": return `${r("rooms_bob")}+${r("rooms_pickup")}`;
    case "rate_bob": return LK(c, "Actual_forecast_1", 8);
    case "rate_pickup": return S(c, 15);
    case "rev_bob2": return `${r("rate_bob")}*${r("rooms_bob_in")}`;
    case "rev_pickup2": return `${r("rate_pickup")}*${r("pickup_needed")}`;
    case "rev_comb": return `${r("rooms_bob_in")}*${r("rate_bob")}+${r("pickup_needed")}*${r("rate_pickup")}`;
    case "adr_comb": return `IFERROR(${r("rev_comb")}/${r("rooms_target")},0)`;
    case "rev_bob": return r("rev_bob2");
    case "rev_pickup": return r("rev_pickup2");
    case "rev_rooms_comb": return `${r("rev_bob")}+${r("rev_pickup")}`;
    case "arr": return `IFERROR(${r("rev_comb")}/(${r("rooms_bob_in")}+${r("pickup_needed")}),0)`;
    case "business_mix": return `IFERROR((${r("rooms_bob_in")}+${r("bob_since_save")}+${r("pickup_needed")})/${r("rooms_fc")},0)`;
    case "sleeper_ratio": return S(c, 2);
    case "sleepers": return `${LK(c, "Actual_forecast_1", 6)}+${r("pickup_needed")}*${r("sleeper_ratio")}`;
    case "sd_dinner": return S(c, 16);
    case "diners": return `${r("sleepers")}*${r("sd_dinner")}`;
    case "bfast_spend": return S(c, 14);
    case "bfast_ratio": return actual ? `IFERROR(ROUND(${r("bfast_covers")}/${r("sleepers")},2),0)` : S(c, 3);
    case "bfast_covers": return actual ? `IFERROR(ROUND(${r("bfast_rev")}/${r("bfast_spend")},0),0)` : `${LK(c, "'Meal Plan'", 2, "$A:$F")}+${r("bfast_ratio")}*${r("sleeper_ratio")}*${r("pickup_needed")}`;
    case "bfast_rev": return actual ? null : `${r("bfast_spend")}*${r("bfast_covers")}`;
    case "lunch_covers": case "dinner_covers": {
      const col = key === "lunch_covers" ? 2 : 3, su = S(c, key === "lunch_covers" ? 4 : 5), ot = `VLOOKUP(${c}$4,Opentable!$A:$C,${col},FALSE)`;
      return actual ? `IFERROR(${ot},0)` : `IF(ISNUMBER(MATCH(${c}$4,Opentable!$A:$A,0)),IF(${su}<${ot},${ot},${su}),${su})`;
    }
    case "lunch_spend": return S(c, 6);
    case "dinner_spend": return S(c, 7);
    case "lunch_food": return actual ? null : `${r("lunch_spend")}*${r("lunch_covers")}`;
    case "dinner_food": return actual ? null : `${r("dinner_spend")}*${r("dinner_covers")}`;
    case "bev_lunch_covers": return r("lunch_covers");
    case "bev_dinner_covers": return r("dinner_covers");
    case "bev_lunch_spend": return S(c, 10);
    case "bev_dinner_spend": return S(c, 11);
    case "lunch_bev": return actual ? null : `${r("bev_lunch_spend")}*${r("bev_lunch_covers")}`;
    case "dinner_bev": return actual ? null : `${r("bev_dinner_spend")}*${r("bev_dinner_covers")}`;
    case "fn_name": return `IFERROR(${EV(c, "C")},0)`;
    case "fn_guests": return `IFERROR(${EV(c, "F")},0)`;
    case "fn_food": return `IFERROR(${EV(c, "H")}+${EV(c, "K")},0)`;
    case "fn_prebev": return `IFERROR(${EV(c, "J")},0)`;
    case "fn_hire": return `IFERROR(${EV(c, "I")}+${EV(c, "L")},0)`;
    case "fn_spend": return actual ? `IFERROR(${r("fn_bar")}/${r("fn_guests")},0)` : S(c, 13);
    case "fn_bar": return actual ? null : `${r("fn_spend")}*${r("fn_guests")}`;
    case "rev_rooms": return actual ? null : r("rev_comb");
    case "rev_food": return sum("bfast_rev", "lunch_food", "dinner_food", "fn_food");
    case "rev_bev": return sum("lunch_bev", "dinner_bev", "fn_prebev", "fn_bar");
    case "rev_hire": return r("fn_hire");
    case "rev_other": return `SUM(${r("oth_news")}:${r("misc")})-${r("no_shows")}`;
    case "rev_total": return `${sum("rev_rooms", "rev_food", "rev_bev", "rev_hire", "rev_other")}-${r("service_charge")}`;
    case "rev_total_sc": return `${r("rev_total")}+${r("service_charge")}`;
    case "err_check": return `IF(${r("bfast_ratio")}=0,0-${r("rev_total")},0)`;
    case "occ": return `IFERROR(${r("rooms_fc")}/${r("rooms_avail")},0)`;
    case "occ_classic": case "occ_dlx_ff": case "occ_dlx_gf": case "occ_ht": case "occ_huck": case "occ_rosemary": case "occ_studio":
      return LK(c, "OccByRoomType", ["occ_classic", "occ_dlx_ff", "occ_dlx_gf", "occ_ht", "occ_huck", "occ_rosemary", "occ_studio"].indexOf(key) + 2, "$A:$H");
    case "arr_total": return `IFERROR(${r("rev_rooms")}/${r("rooms_fc")},0)`;
    case "revpar": return `IFERROR(${r("rev_rooms")}/${r("rooms_avail")},0)`;
    case "trevpar": return `IFERROR(${r("rev_total")}/${r("rooms_avail")},0)`;
    case "covers_total": return sum("lunch_covers", "dinner_covers", "fn_guests");
    case "mealplan_covers": return LK(c, "'Meal Plan'", 6, "$A:$F");
    case "covers_per_hour": return `IFERROR((${r("lunch_covers")}+${r("dinner_covers")})/(${r("pay_foh")}/HKRate),0)`;
    case "bfast_sleeper_pct": return `IFERROR(IFERROR(${r("bfast_rev")}/${r("bfast_spend")},0)/${r("sleepers")},0)`;
    case "pay_boh": return LK(c, "PayrollByDepartment", 2, "$A:$F");
    case "pay_foh": return LK(c, "PayrollByDepartment", 3, "$A:$F");
    case "pay_hk": return LK(c, "PayrollByDepartment", 4, "$A:$F");
    case "pay_maint": return LK(c, "PayrollByDepartment", 5, "$A:$F");
    case "pay_office": return LK(c, "PayrollByDepartment", 6, "$A:$F");
    case "cost_boh": return `${r("pay_boh")}*Holiday*OnCost`;
    case "cost_foh": return `${r("pay_foh")}*Holiday*OnCost`;
    case "cost_hk": return `${r("pay_hk")}*Holiday*OnCost`;
    case "cost_maint": return `${r("pay_maint")}*Holiday*OnCost`;
    case "cost_office": return `${r("pay_office")}*OnCost`;
    case "wage_boh_pct": return `IFERROR(${r("cost_boh")}/${r("rev_food")},0)`;
    case "wage_foh_pct": return `IFERROR(${r("cost_foh")}/(${r("rev_food")}+${r("rev_bev")}),0)`;
    case "wages_total": return sum("cost_boh", "cost_foh", "cost_hk", "cost_maint", "cost_office");
    case "labour_pct": return `IFERROR(${r("wages_total")}/${r("rev_total")},0)`;
    case "pl_total": return `${r("rev_total")}-${r("wages_total")}`;
    case "pl_fb": return `(${r("rev_food")}+${r("rev_bev")})*(1-FBCostPct)-(${r("cost_boh")}+${r("cost_foh")})`;
    case "pl_restaurant": return `((${r("rev_food")}-${r("fn_food")})+(${r("rev_bev")}-${r("fn_prebev")}-${r("fn_bar")}))*(1-FBCostPct)-(${r("cost_boh")}-IF(${r("fn_food")}+${r("fn_prebev")}+${r("fn_bar")}>0,FuncBOHHours*FuncBOHRate*Holiday*OnCost,0))-${r("cost_foh")}`;
    case "hk_mins": return `IFERROR(${r("pay_hk")}/HKRate,0)*60`;
    case "hk_net_mins": return `${r("hk_mins")}-HKFixedMins`;
    case "hk_std_rooms": return `IFERROR(VLOOKUP(${c}$4-1,HKCleaningTarget!$A:$E,2,FALSE),0)`;
    case "hk_large_rooms": return `IFERROR(VLOOKUP(${c}$4-1,HKCleaningTarget!$A:$E,3,FALSE),0)`;
    case "hk_target_mins": return `${r("hk_std_rooms")}+${r("hk_large_rooms")}`;
    case "hk_room_count": return `IFERROR(VLOOKUP(${c}$4-1,HKCleaningTarget!$A:$E,5,FALSE),0)`;
    case "hk_target_per_room": return `IFERROR(${r("hk_target_mins")}/${r("hk_room_count")},0)`;
    case "hk_var_per_room": return `IF(${r("hk_room_count")}=0,0,${r("hk_net_mins")}/${r("hk_room_count")}-${r("hk_target_per_room")})`;
    case "pastfuture": return null;
    default: return null;                                   // typed inputs: other revenue lines, service charge, no shows, till variance, misc, prior year, the Claude rooms forecast
  }
}

// How a week / weekday / month column is worked out. "same" = the day formula applied to that column's own figures (the sheet's own way for ratios).
const SAME_OK = new Set(["rooms_fc", "rev_rooms_comb", "arr", "adr_comb", "rev_food", "rev_bev", "rev_hire", "rev_other", "rev_total", "rev_total_sc", "occ", "arr_total", "revpar", "trevpar", "bfast_sleeper_pct",
  "cost_boh", "cost_foh", "cost_hk", "cost_maint", "cost_office", "wage_boh_pct", "wage_foh_pct", "wages_total", "labour_pct", "pl_total", "pl_fb", "pl_restaurant", "hk_target_per_room", "hk_var_per_room"]);
export function aggKind(l) {
  if (l.kind === "none" || l.kind === "text") return null;
  if (["sleepers", "diners", "rev_comb"].includes(l.key)) return "sum";
  if (l.kind === "sum") return "sum";
  if (l.kind === "avg") return "avg";
  return SAME_OK.has(l.key) ? "same" : "custom";
}
export function aggFormula(l, c, R, grp) {          // grp = { range: "$E$6:$AI$6", crit: "AK$6" } for a week or weekday, null for the month
  const k = aggKind(l), r = (x) => `${c}${R[x]}`, row = R[l.key];
  if (!k) return null;
  const rng = `$E${row}:$AI${row}`;
  if (k === "sum") return grp ? `SUMIF(${grp.range},${grp.crit},${rng})` : `SUM(${rng})`;
  if (k === "avg") return grp ? `IFERROR(AVERAGEIF(${grp.range},${grp.crit},${rng}),0)` : `IFERROR(AVERAGE(${rng}),0)`;
  if (k === "same") return dayFormula(l.key, c, false, R);
  switch (l.key) {                                   // the ratios that are not simply the day formula re-run
    case "rev_bob2": return r("rev_bob");
    case "rev_pickup2": return r("rev_pickup");
    case "rate_bob": return `IFERROR(${r("rev_bob2")}/${r("rooms_bob_in")},0)`;
    case "rate_pickup": return `IFERROR(${r("rev_pickup2")}/${r("pickup_needed")},0)`;
    case "bfast_spend": return `IFERROR(${r("bfast_rev")}/${r("bfast_covers")},0)`;
    case "lunch_spend": return `IFERROR(${r("lunch_food")}/${r("lunch_covers")},0)`;
    case "dinner_spend": return `IFERROR(${r("dinner_food")}/${r("dinner_covers")},0)`;
    case "bev_lunch_spend": return `IFERROR(${r("lunch_bev")}/${r("bev_lunch_covers")},0)`;
    case "bev_dinner_spend": return `IFERROR(${r("dinner_bev")}/${r("bev_dinner_covers")},0)`;
    case "fn_spend": return `IFERROR(${r("fn_bar")}/${r("fn_guests")},0)`;
    case "business_mix": return `IFERROR((${r("rooms_bob_in")}+${r("pickup_needed")})/${r("rooms_fc")},0)`;
    default: return null;
  }
}
