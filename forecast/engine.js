// Forecast engine: the Forecast workbook's month sheet as plain code, so the browser (and a server, if one is ever needed) produce the same figures the workbook does.
//
// One month = one grid. Each day is a column of "lines" (the workbook's rows); every line is either
//   - typed/overridden for that day (ov[key]), or
//   - worked out from the Month Set up weekday assumptions, the feeder tables (rooms on the books, booked covers, meal plan, events,
//     payroll, housekeeping targets) and the lines above it.
// A day that has finished ("actual" day) swaps a handful of forecast formulas for the ones the workbook's End of Day macro puts in
// (covers from the booked table, ratios worked back from the actuals) - see `actual` below.
//
// Aggregates (weeks, weekdays, month) add the additive lines and re-run the derived lines on the totals, exactly like the sheet's
// AK:BA columns (ratios are sum over sum, never an average of daily percentages).
//
// Line keys are stable names; `row` is the row on the Forecast sheet (October 2026 layout) and is only used to compare against the workbook.
// Adding a line = add one entry to LINES (and, if it is worked out, one case in dayLine()). Everything else (grid, totals, export) reads LINES.

export const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const SETUP_COLS = { sleeper_ratio: 2, breakfast_ratio: 3, lunch_covers: 4, dinner_covers: 5, lunch_spend: 6, dinner_spend: 7, bev_lunch_covers: 8, bev_dinner_covers: 9, bev_lunch_spend: 10, bev_dinner_spend: 11, rooms_forecast: 12, function_spend: 13, breakfast_spend: 14, pickup_rate: 15, dinner_sd: 16, start_bob_rate: 17, rooms_if_wedding: 18, rooms_if_wedding_next: 19 };

// kind: 'sum' (added across days), 'avg' (averaged), 'ratio' (re-worked from the aggregated lines), 'text', 'none' (not aggregated)
// fmt: n0 whole number, n2 two decimals, gbp money, pct percentage, text
export const LINES = [
  { key: "date", row: 4, label: "Date", kind: "none", fmt: "text", group: "Dates" },
  { key: "dow", row: 5, label: "Day", kind: "none", fmt: "text", group: "Dates" },
  { key: "week", row: 6, label: "Week", kind: "none", fmt: "text", group: "Dates" },

  { key: "rooms_avail", row: 9, label: "Rooms Available", kind: "sum", fmt: "n0", group: "Rooms" },
  { key: "rooms_bob", row: 10, label: "Rooms BOB", kind: "sum", fmt: "n0", group: "Rooms" },
  { key: "rooms_pickup", row: 11, label: "Room Pickup", kind: "sum", fmt: "n0", group: "Rooms" },
  { key: "rooms_fc", row: 12, label: "Rooms Forecast", kind: "ratio", fmt: "n0", group: "Rooms" },
  { key: "arr", row: 13, label: "Average Room Rate", kind: "ratio", fmt: "gbp", group: "Rooms" },
  { key: "rev_bob", row: 14, label: "Rooms BOB Revenue", kind: "sum", fmt: "gbp", group: "Rooms" },
  { key: "rev_pickup", row: 15, label: "Rooms Pickup Revenue", kind: "sum", fmt: "gbp", group: "Rooms" },
  { key: "rev_rooms_comb", row: 16, label: "Combined Rooms Revenue", kind: "ratio", fmt: "gbp", group: "Rooms" },
  { key: "sleeper_ratio", row: 17, label: "Sleeper Ratio", kind: "avg", fmt: "n2", group: "Rooms" },
  { key: "sleepers", row: 18, label: "Predicted Sleepers", kind: "ratio", fmt: "n1", group: "Rooms" },
  { key: "sd_dinner", row: 19, label: "S/D dinner ratio", kind: "avg", fmt: "n2", group: "Rooms" },
  { key: "diners", row: 20, label: "Diners", kind: "ratio", fmt: "n1", group: "Rooms" },

  { key: "bfast_ratio", row: 22, label: "Breakfast S/D Ratio", kind: "avg", fmt: "n2", group: "Breakfast" },
  { key: "bfast_covers", row: 23, label: "Breakfast Covers", kind: "sum", fmt: "n1", group: "Breakfast" },
  { key: "bfast_spend", row: 24, label: "Breakfast Average Spend", kind: "ratio", fmt: "gbp", group: "Breakfast" },
  { key: "bfast_rev", row: 25, label: "Breakfast REV", kind: "sum", fmt: "gbp", group: "Breakfast" },

  { key: "lunch_covers", row: 27, label: "Lunch Covers", kind: "sum", fmt: "n0", group: "Restaurant" },
  { key: "dinner_covers", row: 28, label: "Dinner Covers", kind: "sum", fmt: "n0", group: "Restaurant" },
  { key: "lunch_spend", row: 29, label: "Lunch Average Spend", kind: "ratio", fmt: "gbp", group: "Restaurant" },
  { key: "dinner_spend", row: 30, label: "Dinner Average Spend", kind: "ratio", fmt: "gbp", group: "Restaurant" },
  { key: "lunch_food", row: 31, label: "Lunch Food Revenue", kind: "sum", fmt: "gbp", group: "Restaurant" },
  { key: "dinner_food", row: 32, label: "Dinner Food Revenue", kind: "sum", fmt: "gbp", group: "Restaurant" },

  { key: "bev_lunch_covers", row: 34, label: "Bev - Lunch Covers", kind: "sum", fmt: "n0", group: "Restaurant beverage" },
  { key: "bev_dinner_covers", row: 35, label: "Bev - Dinner Covers", kind: "sum", fmt: "n0", group: "Restaurant beverage" },
  { key: "bev_lunch_spend", row: 36, label: "Bev - Lunch Average Spend", kind: "ratio", fmt: "gbp", group: "Restaurant beverage" },
  { key: "bev_dinner_spend", row: 37, label: "Bev - Dinner Average Spend", kind: "ratio", fmt: "gbp", group: "Restaurant beverage" },
  { key: "lunch_bev", row: 38, label: "Lunch Bev Revenue", kind: "sum", fmt: "gbp", group: "Restaurant beverage" },
  { key: "dinner_bev", row: 39, label: "Dinner Bev Revenue", kind: "sum", fmt: "gbp", group: "Restaurant beverage" },

  { key: "fn_name", row: 41, label: "Name of function", kind: "text", fmt: "text", group: "Weddings & Events" },
  { key: "fn_guests", row: 42, label: "Number of Guests", kind: "sum", fmt: "n0", group: "Weddings & Events" },
  { key: "fn_food", row: 43, label: "Wedding Food Revenue", kind: "sum", fmt: "gbp", group: "Weddings & Events" },
  { key: "fn_prebev", row: 44, label: "Wedding pre spend Beverage Revenue", kind: "sum", fmt: "gbp", group: "Weddings & Events" },
  { key: "fn_hire", row: 45, label: "Wedding Room Hire & other", kind: "sum", fmt: "gbp", group: "Weddings & Events" },
  { key: "fn_spend", row: 47, label: "Function Avg Spend", kind: "ratio", fmt: "gbp", group: "Weddings & Events" },
  { key: "fn_bar", row: 48, label: "Function Bar Revenue", kind: "sum", fmt: "gbp", group: "Weddings & Events" },

  { key: "oth_news", row: 50, label: "Newspapers", kind: "sum", fmt: "gbp", group: "Other revenue" },
  { key: "oth_laundry", row: 51, label: "Laundry", kind: "sum", fmt: "gbp", group: "Other revenue" },
  { key: "oth_retail", row: 52, label: "Retail", kind: "sum", fmt: "gbp", group: "Other revenue" },
  { key: "oth_bus", row: 53, label: "Business Services", kind: "sum", fmt: "gbp", group: "Other revenue" },
  { key: "service_charge", row: 54, label: "Service Charge", kind: "sum", fmt: "gbp", group: "Other revenue" },
  { key: "no_shows", row: 55, label: "No Shows", kind: "sum", fmt: "gbp", group: "Other revenue" },
  { key: "till_var", row: 56, label: "Till Variance", kind: "sum", fmt: "gbp", group: "Other revenue" },
  { key: "misc", row: 57, label: "Revenue check & Misc", kind: "sum", fmt: "gbp", group: "Other revenue" },

  { key: "rev_rooms", row: 60, label: "Rooms Revenue", kind: "sum", fmt: "gbp", group: "Daily Summary" },
  { key: "rev_food", row: 61, label: "Food revenue", kind: "ratio", fmt: "gbp", group: "Daily Summary" },
  { key: "rev_bev", row: 62, label: "Beverage revenue", kind: "ratio", fmt: "gbp", group: "Daily Summary" },
  { key: "rev_hire", row: 63, label: "Room Hire", kind: "ratio", fmt: "gbp", group: "Daily Summary" },
  { key: "rev_other", row: 64, label: "Other revenue", kind: "ratio", fmt: "gbp", group: "Daily Summary" },
  { key: "rev_total", row: 65, label: "TOTAL REVENUE", kind: "ratio", fmt: "gbp", group: "Daily Summary", bold: true },
  { key: "rev_total_sc", row: 66, label: "Revenue (inc. Service Charge)", kind: "ratio", fmt: "gbp", group: "Daily Summary" },
  { key: "err_check", row: 67, label: "Error Check", kind: "none", fmt: "gbp", group: "Daily Summary" },

  { key: "occ", row: 69, label: "Total Occupancy", kind: "ratio", fmt: "pct", group: "KPIs" },
  { key: "occ_classic", row: 70, label: "Occ % - Classic Double", kind: "none", fmt: "pct", group: "KPIs" },
  { key: "occ_dlx_ff", row: 71, label: "Occ % - Deluxe Double FF", kind: "none", fmt: "pct", group: "KPIs" },
  { key: "occ_dlx_gf", row: 72, label: "Occ % - Deluxe Double GF", kind: "none", fmt: "pct", group: "KPIs" },
  { key: "occ_ht", row: 73, label: "Occ % - HT Suite", kind: "none", fmt: "pct", group: "KPIs" },
  { key: "occ_huck", row: 74, label: "Occ % - Huckleberry", kind: "none", fmt: "pct", group: "KPIs" },
  { key: "occ_rosemary", row: 75, label: "Occ % - Rosemary", kind: "none", fmt: "pct", group: "KPIs" },
  { key: "occ_studio", row: 76, label: "Occ % - Studio Suite", kind: "none", fmt: "pct", group: "KPIs" },
  { key: "arr_total", row: 77, label: "Total ARR", kind: "ratio", fmt: "gbp", group: "KPIs" },
  { key: "revpar", row: 78, label: "RevPAR", kind: "ratio", fmt: "gbp", group: "KPIs" },
  { key: "trevpar", row: 79, label: "TRevPAR", kind: "ratio", fmt: "gbp", group: "KPIs" },
  { key: "covers_total", row: 80, label: "Total Covers", kind: "sum", fmt: "n0", group: "KPIs" },
  { key: "mealplan_covers", row: 81, label: "Meal Plan Covers", kind: "sum", fmt: "n0", group: "KPIs" },
  { key: "covers_per_hour", row: 82, label: "Covers per Labour Hour (Restaurant/FOH)", kind: "none", fmt: "n2", group: "KPIs" },
  { key: "bfast_sleeper_pct", row: 84, label: "Breakfast Sleeper %", kind: "ratio", fmt: "pct", group: "KPIs" },

  // Labour. Raw pay comes from Planday (payroll by department). One consistent cost model everywhere (settings.labour):
  //   cost = raw x holiday accrual x employer on-cost; office = raw x on-cost only (salaried, holiday already inside the salary).
  { key: "pay_boh", row: null, label: "Payroll BOH (raw)", kind: "sum", fmt: "gbp", group: "Labour" },
  { key: "pay_foh", row: null, label: "Payroll FOH (raw)", kind: "sum", fmt: "gbp", group: "Labour" },
  { key: "pay_hk", row: null, label: "Payroll Housekeeping (raw)", kind: "sum", fmt: "gbp", group: "Labour" },
  { key: "pay_maint", row: null, label: "Payroll Maintenance (raw)", kind: "sum", fmt: "gbp", group: "Labour" },
  { key: "pay_office", row: null, label: "Payroll Office (raw)", kind: "sum", fmt: "gbp", group: "Labour" },
  { key: "cost_boh", row: null, label: "BOH cost to the business", kind: "ratio", fmt: "gbp", group: "Labour" },
  { key: "cost_foh", row: null, label: "FOH cost to the business", kind: "ratio", fmt: "gbp", group: "Labour" },
  { key: "cost_hk", row: null, label: "Housekeeping cost to the business", kind: "ratio", fmt: "gbp", group: "Labour" },
  { key: "cost_maint", row: null, label: "Maintenance cost to the business", kind: "ratio", fmt: "gbp", group: "Labour" },
  { key: "cost_office", row: null, label: "Office cost to the business", kind: "ratio", fmt: "gbp", group: "Labour" },
  { key: "wage_boh_pct", row: 86, label: "BOH Wage %", kind: "ratio", fmt: "pct", group: "Labour" },
  { key: "wage_foh_pct", row: 87, label: "FOH Wage %", kind: "ratio", fmt: "pct", group: "Labour" },
  { key: "hk_mins", row: 92, label: "Total HK minutes", kind: "sum", fmt: "n0", group: "Housekeeping" },
  { key: "hk_net_mins", row: 93, label: "HK minus Reception & PA cleaning", kind: "sum", fmt: "n0", group: "Housekeeping" },
  { key: "hk_std_rooms", row: 94, label: "Standard rooms cleaned (40mins)", kind: "sum", fmt: "n0", group: "Housekeeping" },
  { key: "hk_large_rooms", row: 95, label: "Large rooms cleaned (180mins)", kind: "sum", fmt: "n0", group: "Housekeeping" },
  { key: "hk_target_mins", row: 96, label: "Total target mins", kind: "sum", fmt: "n0", group: "Housekeeping" },
  { key: "hk_room_count", row: null, label: "Rooms cleaned (yesterday's rooms)", kind: "sum", fmt: "n0", group: "Housekeeping" },
  { key: "hk_target_per_room", row: 97, label: "Target minutes per room", kind: "ratio", fmt: "n1", group: "Housekeeping" },
  { key: "hk_var_per_room", row: 88, label: "HK Minutes per room vs target", kind: "ratio", fmt: "n1", group: "Housekeeping" },

  { key: "pl_fb", row: 99, label: "F&B gross profit (after wages)", kind: "ratio", fmt: "gbp", group: "Gross P&L" },
  { key: "pl_restaurant", row: 100, label: "Restaurant gross profit (after wages)", kind: "ratio", fmt: "gbp", group: "Gross P&L" },
  { key: "wages_total", row: 101, label: "Total wages", kind: "ratio", fmt: "gbp", group: "Gross P&L" },
  { key: "labour_pct", row: 102, label: "Total Labour Cost %", kind: "ratio", fmt: "pct", group: "Gross P&L" },
  { key: "pl_total", row: 103, label: "Total (revenue less wages)", kind: "ratio", fmt: "gbp", group: "Gross P&L" },

  { key: "pastfuture", row: 110, label: "Past / Future", kind: "none", fmt: "text", group: "Rooms detail" },
  { key: "rooms_bob_in", row: 111, label: "Rooms BOB (on the books)", kind: "sum", fmt: "n0", group: "Rooms detail" },
  { key: "bob_since_save", row: 112, label: "BOB pick up since last save", kind: "none", fmt: "n0", group: "Rooms detail" },
  { key: "pickup_needed", row: 113, label: "Rooms to pick up to hit forecast", kind: "sum", fmt: "n0", group: "Rooms detail" },
  { key: "rooms_target", row: 114, label: "Total Rooms Forecast", kind: "sum", fmt: "n0", group: "Rooms detail", input: true },
  { key: "rooms_target_ai", row: 115, label: "Total Rooms Forecast - Claude", kind: "sum", fmt: "n1", group: "Rooms detail", input: true },
  { key: "rate_bob", row: 116, label: "BOB Average Rate", kind: "ratio", fmt: "gbp", group: "Rooms detail", input: true },
  { key: "rate_pickup", row: 117, label: "Pickup Average Rate", kind: "ratio", fmt: "gbp", group: "Rooms detail", input: true },
  { key: "rev_bob2", row: 119, label: "BOB Revenue", kind: "ratio", fmt: "gbp", group: "Rooms detail" },
  { key: "rev_pickup2", row: 120, label: "Pickup Revenue", kind: "ratio", fmt: "gbp", group: "Rooms detail" },
  { key: "rev_comb", row: 121, label: "Combined Revenue", kind: "ratio", fmt: "gbp", group: "Rooms detail" },
  { key: "adr_comb", row: 122, label: "Combined ADR", kind: "ratio", fmt: "gbp", group: "Rooms detail" },
  { key: "business_mix", row: 123, label: "Business Mix", kind: "ratio", fmt: "pct", group: "Rooms detail" },
  { key: "py_day", row: 126, label: "Room Sales Prior Year - Day", kind: "none", fmt: "text", group: "Prior year", input: true },
  { key: "py_rooms", row: 127, label: "Room Sales Prior Year - Rooms Sold", kind: "sum", fmt: "n0", group: "Prior year", input: true },
  { key: "py_arr", row: 128, label: "Room Sales Prior Year - ARR", kind: "avg", fmt: "gbp", group: "Prior year", input: true },
];
export const LINE = Object.fromEntries(LINES.map((l) => [l.key, l]));

// --------------------------------------------------------------------------------------------- helpers
const num = (x) => (typeof x === "number" && isFinite(x) ? x : 0);
const isNum = (x) => typeof x === "number" && isFinite(x);
const div = (a, b) => (b ? a / b : 0);                          // IFERROR(a/b, 0)
const round = (x, d) => { const f = Math.pow(10, d); return Math.round((x + Number.EPSILON * Math.sign(x)) * f) / f; };   // Excel ROUND: half away from zero
const ymd = (d) => d.toISOString().slice(0, 10);
export const parseYmd = (s) => new Date(s + "T00:00:00Z");
export const addDays = (s, n) => { const d = parseYmd(s); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };
export const weekdayOf = (s) => WD[parseYmd(s).getUTCDay()];
// "Week n" as the sheet numbers it: INT((13 - WEEKDAY(d-1) + DAY(d)) / 7), WEEKDAY with Sunday = 1.
export function weekLabel(s) {
  const d = parseYmd(s), prev = new Date(d.getTime() - 86400000), wk = prev.getUTCDay() + 1;
  return "Week " + Math.floor((13 - wk + d.getUTCDate()) / 7);
}

export const DEFAULT_LABOUR = { holiday: 1.1207, oncost: 1.15, hk_rate: 12.71, hk_fixed_mins: 750, fb_cost_pct: 0.35, function_boh_hours: 16, function_boh_rate: 14 };

// --------------------------------------------------------------------------------------------- one day
// input.day = { date, ov: {key: value}, actual: boolean }
// input.setup = { rooms: 18, wd: { Mon: { 2: 1.9, 3: 0.8, ... } } }          (Month Set up, keyed by weekday then by column number)
// input.feed = { bob:{date:{rooms,guests,arr}}, opentable:{date:{lunch,dinner}}, mealplan:{date:{b,total}}, events:[{date,name,guests,food,other,bev,ffb,fhire}],
//                occ:{date:[7 values]}, pay:{date:{boh,foh,hk,maint,office}}, hk:{date:{std,large,total,rooms}} }
export function computeDay(input, day) {
  const { setup, feed, labour = DEFAULT_LABOUR } = input;
  const date = day.date, ov = day.ov || {}, actual = !!day.actual;
  const wd = weekdayOf(date), S = (col) => num(setup.wd?.[wd]?.[col]);
  const c = {};
  const P = (k, v) => { const o = ov[k]; c[k] = o !== undefined && o !== null && o !== "" ? o : v; return c[k]; };

  c.date = date; c.dow = wd; c.week = weekLabel(date);
  const bobRow = feed.bob?.[date];
  const ot = feed.opentable?.[date];
  const mp = feed.mealplan?.[date];
  const ev = (feed.events || []).filter((e) => e.date === date);
  const e0 = ev[0];                                              // the sheet's VLOOKUP takes the first event of the day
  const pay = feed.pay?.[date];
  const hk = feed.hk?.[addDays(date, -1)];                       // housekeeping targets are read at date-1 (today's cleaning is yesterday's rooms)

  // rooms
  P("rooms_avail", num(setup.rooms));
  P("rooms_bob_in", bobRow ? num(bobRow.rooms) : 0);
  P("rooms_target", actual ? c.rooms_bob_in : S(SETUP_COLS.rooms_forecast));
  P("rooms_target_ai", 0);
  P("pickup_needed", c.rooms_target - c.rooms_bob_in);
  P("rooms_bob", c.rooms_bob_in);
  P("rooms_pickup", c.pickup_needed);
  P("rooms_fc", c.rooms_bob + c.rooms_pickup);
  P("rate_bob", bobRow ? num(bobRow.arr) : 0);
  P("rate_pickup", S(SETUP_COLS.pickup_rate));
  P("rev_bob2", c.rate_bob * c.rooms_bob_in);
  P("rev_pickup2", c.rate_pickup * c.pickup_needed);
  P("rev_comb", c.rooms_bob_in * c.rate_bob + c.pickup_needed * c.rate_pickup);
  P("adr_comb", div(c.rev_comb, c.rooms_target));
  P("rev_bob", c.rev_bob2);
  P("rev_pickup", c.rev_pickup2);
  P("rev_rooms_comb", c.rev_bob + c.rev_pickup);
  P("arr", div(c.rev_comb, c.rooms_bob_in + c.pickup_needed));
  P("bob_since_save", 0);
  P("business_mix", div(c.rooms_bob_in + c.bob_since_save + c.pickup_needed, c.rooms_fc));

  // sleepers and diners
  P("sleeper_ratio", S(SETUP_COLS.sleeper_ratio));
  P("sleepers", num(bobRow?.guests) + c.pickup_needed * c.sleeper_ratio);
  P("sd_dinner", S(SETUP_COLS.dinner_sd));
  P("diners", c.sleepers * c.sd_dinner);

  // breakfast
  P("bfast_spend", S(SETUP_COLS.breakfast_spend));
  if (actual) {
    P("bfast_rev", 0);
    P("bfast_covers", round(div(c.bfast_rev, c.bfast_spend), 0));
    P("bfast_ratio", round(div(c.bfast_covers, c.sleepers), 2));
  } else {
    P("bfast_ratio", S(SETUP_COLS.breakfast_ratio));
    P("bfast_covers", num(mp?.b) + c.bfast_ratio * c.sleeper_ratio * c.pickup_needed);
    P("bfast_rev", c.bfast_spend * c.bfast_covers);
  }

  // restaurant (food)
  const booked = (k) => num(ot?.[k]);
  if (actual) {
    P("lunch_covers", booked("lunch")); P("dinner_covers", booked("dinner"));
  } else {
    const f = (k, col) => (ot && isNum(ot[k]) ? (S(col) < ot[k] ? ot[k] : S(col)) : S(col));          // the greater of the set-up figure and what is booked
    P("lunch_covers", f("lunch", SETUP_COLS.lunch_covers)); P("dinner_covers", f("dinner", SETUP_COLS.dinner_covers));
  }
  P("lunch_spend", S(SETUP_COLS.lunch_spend)); P("dinner_spend", S(SETUP_COLS.dinner_spend));
  P("lunch_food", actual ? 0 : c.lunch_spend * c.lunch_covers);
  P("dinner_food", actual ? 0 : c.dinner_spend * c.dinner_covers);

  // restaurant (beverage): the sheet prices beverage on the same covers as food
  P("bev_lunch_covers", c.lunch_covers); P("bev_dinner_covers", c.dinner_covers);
  P("bev_lunch_spend", S(SETUP_COLS.bev_lunch_spend)); P("bev_dinner_spend", S(SETUP_COLS.bev_dinner_spend));
  P("lunch_bev", actual ? 0 : c.bev_lunch_spend * c.bev_lunch_covers);
  P("dinner_bev", actual ? 0 : c.bev_dinner_spend * c.bev_dinner_covers);

  // weddings & events
  P("fn_name", e0 ? e0.name : 0);
  P("fn_guests", e0 ? num(e0.guests) : 0);
  P("fn_food", e0 ? num(e0.food) + num(e0.ffb) : 0);
  P("fn_prebev", e0 ? num(e0.bev) : 0);
  P("fn_hire", e0 ? num(e0.other) + num(e0.fhire) : 0);
  if (actual) { P("fn_bar", 0); P("fn_spend", div(c.fn_bar, c.fn_guests)); }
  else { P("fn_spend", S(SETUP_COLS.function_spend)); P("fn_bar", c.fn_spend * c.fn_guests); }

  // other revenue
  for (const k of ["oth_news", "oth_laundry", "oth_retail", "oth_bus", "service_charge", "no_shows", "till_var", "misc"]) P(k, 0);

  // daily summary
  P("rev_rooms", actual ? 0 : c.rev_comb);
  P("rev_food", c.bfast_rev + c.lunch_food + c.dinner_food + c.fn_food);
  P("rev_bev", c.lunch_bev + c.dinner_bev + c.fn_prebev + c.fn_bar);
  P("rev_hire", c.fn_hire);
  P("rev_other", c.oth_news + c.oth_laundry + c.oth_retail + c.oth_bus + c.service_charge + c.no_shows + c.till_var + c.misc - c.no_shows);
  P("rev_total", c.rev_rooms + c.rev_food + c.rev_bev + c.rev_hire + c.rev_other - c.service_charge);
  P("rev_total_sc", c.rev_total + c.service_charge);
  P("err_check", c.bfast_ratio === 0 ? 0 - c.rev_total : 0);

  // KPIs
  P("occ", div(c.rooms_fc, c.rooms_avail));
  const oc = feed.occ?.[date];
  ["occ_classic", "occ_dlx_ff", "occ_dlx_gf", "occ_ht", "occ_huck", "occ_rosemary", "occ_studio"].forEach((k, i) => P(k, oc ? num(oc[i]) : 0));
  P("arr_total", div(c.rev_rooms, c.rooms_fc));
  P("revpar", div(c.rev_rooms, c.rooms_avail));
  P("trevpar", div(c.rev_total, c.rooms_avail));
  P("covers_total", c.lunch_covers + c.dinner_covers + c.fn_guests);
  P("mealplan_covers", num(mp?.total));
  P("bfast_sleeper_pct", div(div(c.bfast_rev, c.bfast_spend), c.sleepers));

  // labour (one cost model for every department)
  P("pay_boh", num(pay?.boh)); P("pay_foh", num(pay?.foh)); P("pay_hk", num(pay?.hk)); P("pay_maint", num(pay?.maint)); P("pay_office", num(pay?.office));
  derivedLabour(c, labour);
  P("covers_per_hour", div(c.lunch_covers + c.dinner_covers, c.pay_foh / labour.hk_rate));
  P("hk_mins", div(c.pay_hk, labour.hk_rate) * 60);
  P("hk_net_mins", c.hk_mins - labour.hk_fixed_mins);
  P("hk_std_rooms", hk ? num(hk.std) : 0);
  P("hk_large_rooms", hk ? num(hk.large) : 0);
  P("hk_target_mins", c.hk_std_rooms + c.hk_large_rooms);
  P("hk_room_count", hk ? num(hk.rooms) : 0);
  derivedHk(c);

  P("pastfuture", actual ? "PAST" : "FUTURE");
  const py = feed.py?.[date];
  P("py_day", weekdayOf(addDays(date, -364))); P("py_rooms", py ? num(py.rooms) : 0); P("py_arr", py ? num(py.arr) : 0);
  return c;
}

// Lines that are worked out from other lines of the same column. They are re-run on every aggregate column, so they must not look at the feeders.
function derivedLabour(c, L) {
  if (L.legacy) {                                                 // the workbook's old per-department allowances: only for checking this engine against old workbooks
    c.cost_boh = (c.pay_boh * L.holiday - (40 * 16 + 40 * 15) * 0.1207 / 7) * L.oncost;
    c.cost_foh = (c.pay_foh * L.holiday - 45 * 15 * 0.1207 / 7) * L.oncost;
    c.cost_hk = (c.pay_hk * L.holiday - 40 * 13.5 * 0.1207 / 7) * L.oncost;
  } else {
    c.cost_boh = c.pay_boh * L.holiday * L.oncost;
    c.cost_foh = c.pay_foh * L.holiday * L.oncost;
    c.cost_hk = c.pay_hk * L.holiday * L.oncost;
  }
  c.cost_maint = c.pay_maint * L.holiday * L.oncost;
  c.cost_office = c.pay_office * L.oncost;
  c.wage_boh_pct = div(c.cost_boh, c.rev_food);
  c.wage_foh_pct = div(c.cost_foh, c.rev_food + c.rev_bev);
  c.wages_total = c.cost_boh + c.cost_foh + c.cost_hk + c.cost_maint + c.cost_office;
  c.labour_pct = div(c.wages_total, c.rev_total);
  c.pl_total = c.rev_total - c.wages_total;
  const gm = 1 - L.fb_cost_pct;
  c.pl_fb = (c.rev_food + c.rev_bev) * gm - (c.cost_boh + c.cost_foh);
  const fnAny = c.fn_food + c.fn_prebev + c.fn_bar > 0;
  c.pl_restaurant = ((c.rev_food - c.fn_food) + (c.rev_bev - c.fn_prebev - c.fn_bar)) * gm - (c.cost_boh - (fnAny ? L.function_boh_hours * L.function_boh_rate * L.holiday * L.oncost : 0)) - c.cost_foh;
}
function derivedHk(c) {
  c.hk_target_per_room = div(c.hk_target_mins, c.hk_room_count);
  c.hk_var_per_room = c.hk_room_count ? c.hk_net_mins / c.hk_room_count - c.hk_target_per_room : 0;
}

// --------------------------------------------------------------------------------------------- the month
export function monthDates(year, month) {                       // month 1-12
  const out = []; let d = new Date(Date.UTC(year, month - 1, 1));
  while (d.getUTCMonth() === month - 1) { out.push(ymd(d)); d.setUTCDate(d.getUTCDate() + 1); }
  return out;
}

// Re-runs every 'ratio' line on a column that holds only summed/averaged base lines. Only lines that are pure functions of other lines.
function reDerive(a, labour) {
  a.rooms_fc = a.rooms_bob + a.rooms_pickup;
  a.rev_rooms_comb = a.rev_bob + a.rev_pickup;
  a.arr = div(a.rev_comb, a.rooms_bob_in + a.pickup_needed);
  a.sleepers = a.sleepers_sum;
  a.diners = a.diners_sum;
  a.rev_food = a.bfast_rev + a.lunch_food + a.dinner_food + a.fn_food;
  a.rev_bev = a.lunch_bev + a.dinner_bev + a.fn_prebev + a.fn_bar;
  a.rev_hire = a.fn_hire;
  a.rev_other = a.oth_news + a.oth_laundry + a.oth_retail + a.oth_bus + a.service_charge + a.no_shows + a.till_var + a.misc - a.no_shows;
  a.rev_total = a.rev_rooms + a.rev_food + a.rev_bev + a.rev_hire + a.rev_other - a.service_charge;
  a.rev_total_sc = a.rev_total + a.service_charge;
  a.occ = div(a.rooms_fc, a.rooms_avail);
  a.arr_total = div(a.rev_rooms, a.rooms_fc);
  a.revpar = div(a.rev_rooms, a.rooms_avail);
  a.trevpar = div(a.rev_total, a.rooms_avail);
  a.fn_spend = div(a.fn_bar, a.fn_guests);
  // spend per head over a period is revenue over covers (the sheet's weekly columns add the daily spends together, which means nothing)
  a.bfast_spend = div(a.bfast_rev, a.bfast_covers);
  a.lunch_spend = div(a.lunch_food, a.lunch_covers); a.dinner_spend = div(a.dinner_food, a.dinner_covers);
  a.bev_lunch_spend = div(a.lunch_bev, a.bev_lunch_covers); a.bev_dinner_spend = div(a.dinner_bev, a.bev_dinner_covers);
  a.rate_bob = div(a.rev_bob2, a.rooms_bob_in);
  a.rate_pickup = div(a.rev_pickup2, a.pickup_needed);
  a.rev_bob2 = a.rev_bob; a.rev_pickup2 = a.rev_pickup;
  a.adr_comb = div(a.rev_comb, a.rooms_target);
  a.business_mix = div(a.rooms_bob_in + a.pickup_needed, a.rooms_fc);
  a.bfast_sleeper_pct = div(div(a.bfast_rev, a.bfast_spend), a.sleepers);
  derivedLabour(a, labour);
  derivedHk(a);
}

const SUMMED = LINES.filter((l) => l.kind === "sum").map((l) => l.key);
const AVERAGED = LINES.filter((l) => l.kind === "avg").map((l) => l.key);

function aggregate(cols, labour) {
  const a = {};
  for (const k of SUMMED) a[k] = cols.reduce((t, c) => t + num(c[k]), 0);
  for (const k of AVERAGED) { const v = cols.map((c) => c[k]).filter(isNum); a[k] = v.length ? v.reduce((t, x) => t + x, 0) / v.length : 0; }
  // sums of lines that are not 'sum' in the grid but are needed to rebuild a ratio
  for (const k of ["rev_comb", "rev_pickup2", "rev_bob2", "sleepers", "diners"]) a[k + (k === "sleepers" || k === "diners" ? "_sum" : "")] = cols.reduce((t, c) => t + num(c[k]), 0);
  a.rev_comb = a.rev_comb ?? 0;
  reDerive(a, labour);
  return a;
}

// Computes the whole month. Returns { days: [col...], weeks: {"Week 1": col}, weekdays: {Mon: col}, total: col }.
export function computeMonth(input) {
  const labour = { ...DEFAULT_LABOUR, ...(input.labour || {}) };
  const inp = { ...input, labour };
  const dates = input.dates || monthDates(input.year, input.month);
  const days = dates.map((date) => computeDay(inp, { date, ov: input.ov?.[date], actual: !!input.actual?.[date] }));
  const weeks = {}, weekdays = {};
  for (const c of days) { (weeks[c.week] ||= []).push(c); (weekdays[c.dow] ||= []).push(c); }
  const agg = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, aggregate(v, labour)]));
  return { days, weeks: agg(weeks), weekdays: agg(weekdays), total: aggregate(days, labour) };
}
