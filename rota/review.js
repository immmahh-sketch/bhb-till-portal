/* Rota > Rota Review. Demand for each day (rooms sold that night and the night before, forecast rooms, rooms to clean, breakfasts, lunch and
   dinner covers, afternoon teas, events) next to the Planday rota by department, with the hours per cover / per room worked out and the days
   that look heavy or light marked. Uses the page's own S, call(), esc(), $, today(), addDays(), fmt() and toast(). */
"use strict";
const RV = { preset:"next7", data:null, sel:"", busy:false, err:"" };
try { const p = localStorage.getItem("rota_review_preset"); if (p) RV.preset = p; } catch(e){}
const RV_PRESETS = [["next7", "Next 7 days"], ["next14", "Next 14 days"], ["last7", "Last 7 days"], ["thisweek", "This week (Mon to Sun)"], ["nextweek", "Next week (Mon to Sun)"], ["lastweek", "Last week (Mon to Sun)"]];
function rvRange(){
  const t = today(), wd = (new Date(t + "T12:00:00Z").getUTCDay() + 6) % 7, mon = addDays(t, -wd);
  switch (RV.preset) {
    case "next14": return [t, addDays(t, 13)];
    case "last7": return [addDays(t, -7), addDays(t, -1)];
    case "thisweek": return [mon, addDays(mon, 6)];
    case "nextweek": return [addDays(mon, 7), addDays(mon, 13)];
    case "lastweek": return [addDays(mon, -7), addDays(mon, -1)];
    default: return [t, addDays(t, 6)];
  }
}
const nz = v => v !== null && v !== undefined;
const n0 = v => nz(v) ? String(Math.round(v)) : "";
const n1 = v => nz(v) ? String(Math.round(v * 10) / 10) : "";
const hrs = v => nz(v) ? (Math.round(v * 10) / 10) + "h" : "";
const bucketHours = (day, bucket, nameRe) => {
  const ds = day.departments.filter(d => d.bucket === bucket || (!d.bucket && nameRe && nameRe.test(d.name)));
  return ds.length ? { hours: ds.reduce((t, d) => t + d.hours, 0), heads: ds.reduce((t, d) => t + d.heads, 0), open: ds.reduce((t, d) => t + d.open, 0) } : null;
};
const median = a => { const s = a.slice().sort((x, y) => x - y), m = Math.floor(s.length / 2); return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null; };
/* the three measures: hours on the rota per 10 covers (front of house, kitchen) and per room to clean (housekeeping) */
const RV_METRICS = [
  { key:"foh", label:"Front of house: hours per 10 covers", bucket:"foh", re:/front|foh/i, per: d => d.covers, scale: 10, unit: "hrs per 10 covers", short:"FOH" },
  { key:"boh", label:"Kitchen: hours per 10 covers", bucket:"boh", re:/kitchen|boh|back/i, per: d => d.covers, scale: 10, unit: "hrs per 10 covers", short:"BOH" },
  { key:"hk", label:"Housekeeping: hours per room cleaned", bucket:"hk", re:/housekeep/i, per: d => d.rooms.to_clean, scale: 1, unit: "hrs per room", short:"Housekeeping" },
];
function rvCompute(days){
  const out = {};
  for (const m of RV_METRICS) {
    const rows = days.map(d => {
      const b = bucketHours(d, m.bucket, m.re), den = m.per(d);
      if (!b) return { v:null, none:false };
      if (!(den > 0)) return { v:null, none:false, b };
      if (!(b.hours > 0)) return { v:null, none:true, b };          // demand but nobody rostered
      return { v: b.hours / den * m.scale, none:false, b };
    });
    const vals = rows.map(r => r.v).filter(nz), med = vals.length >= 3 ? median(vals) : null;
    rows.forEach(r => { r.flag = r.none ? "light" : (r.v !== null && med ? (r.v > med * 1.3 ? "heavy" : r.v < med * 0.7 ? "light" : "") : ""); });
    out[m.key] = { rows, med };
  }
  return out;
}
const rvDay = d => fmt(d, { weekday:"short", day:"numeric", month:"short" });

/* ---------------------------------------------------------------- load and draw */
async function viewReview(force){
  const [from, to] = rvRange();
  const sh = document.querySelector(".shell"); if (sh) sh.classList.add("wide");
  if (!RV.data) $("#views").innerHTML = `<div class="loading">Loading…</div>`; else rvPaint(true);
  RV.busy = true;
  try { RV.data = await call("review.week", { from, to, ...(force ? { force:true } : {}) }); RV.err = ""; }
  catch(e){ RV.err = e.message; RV.data = null; }
  RV.busy = false;
  if (S.view !== "review") return;
  const days = RV.data ? RV.data.days.map(d => d.date) : [];
  if (!days.includes(RV.sel)) RV.sel = days.includes(today()) ? today() : (days[0] || "");
  rvPaint();
}
function rvPaint(loadingNow){
  if (S.view !== "review") return;
  const v = $("#views");
  const bar = `<div class="pagehead"><h2>Rota review</h2><span class="hint">The rota from Planday next to what the house needs each day</span></div>
    <div class="rv-bar"><div class="f"><label for="rv_preset">Show</label><select id="rv_preset">${RV_PRESETS.map(([k, l]) => `<option value="${k}"${k === RV.preset ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></div>
      <div class="f"><label>&nbsp;</label><button class="btn small" id="rv_refresh"${RV.busy ? " disabled" : ""}>${RV.busy ? "Loading…" : "Refresh from Planday"}</button></div></div>`;
  if (RV.err) { v.innerHTML = bar + `<div class="card empty">${esc(RV.err)}</div>`; return wire(); }
  if (!RV.data) { v.innerHTML = bar + `<div class="loading">Loading…</div>`; return wire(); }
  const D = RV.data, days = D.days, M = rvCompute(days), t = today();
  const head = days.map(d => `<th data-rvday="${esc(d.date)}" class="${d.date === t ? "today" : ""}${d.date === RV.sel ? " sel" : ""}${d.finished ? " past" : ""}" title="Show the detail for this day">${esc(fmt(d.date, { weekday:"short" }))}<small>${esc(fmt(d.date, { day:"numeric", month:"short" }))}</small></th>`).join("");
  const row = (label, f, cls) => `<tr><td>${label}</td>${days.map((d, i) => { const c = f(d, i) || {}; return `<td class="${c.cls || ""}${d.finished ? " past" : ""}${c.v === undefined || c.v === "" ? " rve" : ""}${cls ? " " + cls : ""}">${c.v === undefined || c.v === "" ? "–" : c.v}${c.sub ? `<small>${c.sub}</small>` : ""}</td>`; }).join("")}</tr>`;
  const sec = t => `<tr class="sec"><td colspan="${days.length + 1}">${esc(t)}</td></tr>`;
  const covCell = (o, d) => ({ v: n0(o.plan), cls:"rvb", sub: d.finished || d.reported ? (nz(o.actual) ? "served" : "") : (nz(o.booked) ? o.booked + " booked" : "") + (nz(o.forecast) ? (nz(o.booked) ? " · " : "") + "fc " + Math.round(o.forecast) : "") });
  let h = `<div class="rv-wrap"><table class="rv" style="min-width:${(window.innerWidth < 640 ? 118 : 170) + days.length * 92}px"><thead><tr><th></th>${head}</tr></thead><tbody>`;
  h += sec("What the house needs");
  h += row("Rooms sold that night", d => ({ v: n0(d.rooms.sold), cls:"rvb", sub: nz(d.rooms.sold) && d.rooms.capacity ? Math.round(d.rooms.sold / d.rooms.capacity * 100) + "% full" : "" }));
  h += row("Rooms sold the night before", d => ({ v: n0(d.rooms.prev) }));
  h += row("Rooms forecast", d => ({ v: n0(d.rooms.forecast) }));
  h += row("Rooms to clean", d => ({ v: n0(d.rooms.to_clean) }));
  h += row("Breakfasts", d => ({ v: n0(d.breakfast.value) }));
  h += row("Lunch covers", d => covCell(d.lunch, d));
  h += row("Dinner covers", d => covCell(d.dinner, d));
  h += row("Afternoon teas", d => ({ v: nz(d.afternoon_tea) ? n0(d.afternoon_tea) : "" }));
  h += `<tr><td>Events</td>${days.map(d => `<td class="ev${d.finished ? " past" : ""}">${d.events.length ? d.events.map(e => `${esc(e.name.length > 24 ? e.name.slice(0, 23) + "…" : e.name)}${nz(e.guests) ? ` <small style="display:inline">(${e.guests}${nz(e.evening_guests) && e.evening_guests !== e.guests ? "/" + e.evening_guests : ""})</small>` : ""}`).join("<br>") : `<span class="muted">–</span>`}</td>`).join("")}</tr>`;
  h += row("Total covers the rota serves", d => ({ v: n0(d.covers), cls:"rvb" }));
  h += sec("The rota (hours rostered, or worked for days already finished)");
  D.departments.forEach(name => {
    h += row(esc(name), d => { const p = d.departments.find(x => x.name === name); return p ? { v: p.hours > 0 ? hrs(p.hours) : "", sub: p.heads ? (p.heads === 1 ? "1 person" : p.heads + " people") + (p.open ? `</small><span class="open">${p.open} open</span><small>` : "") : (p.open ? `</small><span class="open">${p.open} open</span><small>` : "") } : { v:"" }; });
  });
  h += row("All departments", d => ({ v: hrs(d.hours_total), cls:"rvb", sub: d.heads_total ? d.heads_total + " people" : "" }));
  h += sec("Is the rota about right? Compared with the usual for the days shown");
  RV_METRICS.forEach(m => {
    h += row(esc(m.label), (d, i) => { const r = M[m.key].rows[i]; if (r.none) return { v:"No rota", cls:"light" }; return r.v === null ? { v:"" } : { v: n1(r.v), cls: r.flag }; });
  });
  h += `</tbody></table><div class="rv-legend"><span><i style="background:var(--attention-bg);border:1px solid var(--attention)"></i>Heavy: more than 30% above the usual hours for the demand</span><span><i style="background:var(--alert-bg);border:1px solid var(--alert)"></i>Light: more than 30% below, or covers with nobody rostered</span><span>fc = forecast. Covers served = breakfasts + lunches + dinners (booked or forecast, whichever is larger; what was served once the day is done).</span></div></div>`;

  // the days that stand out, in plain words
  const flags = [];
  RV_METRICS.forEach(m => M[m.key].rows.forEach((r, i) => {
    if (!r.flag) return; const d = days[i];
    if (r.none) { flags.push({ tg:"light", d, text: `${m.short}: ${n0(m.per(d))} ${m.key === "hk" ? "rooms to clean" : "covers"} and nobody rostered.` }); return; }
    flags.push({ tg:r.flag, d, text: `${m.short}: ${n1(r.v)} ${m.unit}, against ${n1(M[m.key].med)} usual (${n1(r.b.hours)} hours for ${n0(m.per(d))} ${m.key === "hk" ? "rooms" : "covers"}). ${r.flag === "heavy" ? "Check the rota is not too heavy." : "Check the rota is not too thin."}` });
  }));
  flags.sort((a, b) => a.d.date.localeCompare(b.d.date));
  const fl = flags.length ? `<div class="rv-flags"><h3>Worth a look</h3><ul>${flags.map(f => `<li><span class="tg ${f.tg}">${f.tg === "heavy" ? "Heavy" : "Light"}</span><span><b>${esc(rvDay(f.d.date))}.</b> ${esc(f.text)}</span></li>`).join("")}</ul></div>`
    : `<div class="rv-flags"><h3>Worth a look</h3><p class="muted" style="margin:0">Nothing stands out: every day is within 30% of the usual hours for its demand.</p></div>`;
  const drafts = D.drafts ? `<p class="rv-note">${D.drafts} ${D.drafts === 1 ? "shift is" : "shifts are"} still a draft in Planday; ${D.drafts === 1 ? "it is" : "they are"} counted here as part of the rota.</p>` : "";
  v.innerHTML = bar + drafts + fl + h + rvDetail(D.days.find(d => d.date === RV.sel)) + `<p class="rv-note">Figures: rooms and covers from the forecast and booking reports${D.forecast_updated ? " (updated " + esc(new Date(D.forecast_updated).toLocaleString("en-GB", { timeZone:"Europe/London", day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" })) + ")" : ""}, rooms on the books from the booking engine, rota and hours from Planday.</p>`;
  wire();
}
function rvDetail(d){
  if (!d) return "";
  const chips = [
    ["Rooms tonight", d.rooms.sold, nz(d.rooms.sold) && d.rooms.capacity ? " (" + Math.round(d.rooms.sold / d.rooms.capacity * 100) + "%)" : ""], ["Night before", d.rooms.prev, ""], ["Forecast rooms", d.rooms.forecast, ""], ["Rooms to clean", d.rooms.to_clean, ""],
    ["Breakfasts", d.breakfast.value, ""], ["Lunches", d.lunch.plan, nz(d.lunch.booked) ? " (" + d.lunch.booked + " booked)" : ""], ["Dinners", d.dinner.plan, nz(d.dinner.booked) ? " (" + d.dinner.booked + " booked)" : ""], ["Afternoon teas", d.afternoon_tea, ""],
  ].filter(c => nz(c[1])).map(c => `<span>${esc(c[0])} <b>${Math.round(c[1])}</b>${esc(c[2])}</span>`).join("");
  const ev = d.events.map(e => `<span>${esc(e.name)}${e.venue && e.venue !== "Other" ? " · " + esc(e.venue) : ""}${nz(e.guests) ? " · " + e.guests + (nz(e.evening_guests) && e.evening_guests !== e.guests ? " day / " + e.evening_guests + " evening" : " guests") : ""}</span>`).join("");
  const depts = d.departments.filter(p => p.people.length || p.open).map(p => `<div class="rv-dept"><h4>${esc(p.name)}<small>${p.heads} ${p.heads === 1 ? "person" : "people"} · ${hrs(p.hours) || "0h"}${p.open ? " · " + p.open + " open" : ""}</small></h4>
    ${p.people.map(x => `<div class="p"><span>${esc(x.name)}${x.job ? ` <span class="muted">${esc(x.job)}</span>` : ""}${x.draft ? `<span class="dr">draft</span>` : ""}</span><span>${esc(x.start)}–${esc(x.end)}</span></div>`).join("") || `<div class="p muted">Nobody rostered</div>`}</div>`).join("");
  return `<section class="rv-day"><h3>${esc(fmt(d.date, { weekday:"long", day:"numeric", month:"long" }))}${d.finished ? ` <small class="muted" style="font-size:13px">finished: hours are what was worked</small>` : ""}</h3>
    <div class="rv-chips">${chips}${ev}</div>${depts ? `<div class="rv-depts">${depts}</div>` : `<p class="muted">Nobody is rostered this day.</p>`}</section>`;
}
function wire(){
  const p = $("#rv_preset"); if (p) p.onchange = () => { RV.preset = p.value; try { localStorage.setItem("rota_review_preset", RV.preset); } catch(e){} RV.data = null; RV.sel = ""; viewReview(); };
  const r = $("#rv_refresh"); if (r) r.onclick = () => viewReview(true);
  $$("[data-rvday]").forEach(th => th.onclick = () => { RV.sel = th.dataset.rvday; rvPaint(); const dd = document.querySelector(".rv-day"); if (dd) dd.scrollIntoView({ behavior:"smooth", block:"nearest" }); });
}
