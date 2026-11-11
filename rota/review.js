/* Rota > Rota Review. Demand for each day (rooms sold that night and the night before, forecast rooms, rooms to clean, breakfasts, lunch and
   dinner covers, afternoon teas, events) next to the Planday rota by department, with the hours per cover / per room worked out and the days
   that look heavy or light marked. Uses the page's own S, call(), esc(), $, today(), addDays(), fmt() and toast(). */
"use strict";
const RV = { preset:"next7", dept:"all", data:null, sel:"", busy:false, err:"" };
try { const p = localStorage.getItem("rota_review_preset"); if (p) RV.preset = p; } catch(e){}
const RV_PRESETS = [["next7", "Next 7 days"], ["next14", "Next 14 days"], ["last7", "Last 7 days"], ["thisweek", "This week"], ["nextweek", "Next week"], ["lastweek", "Last week"]];
function rvRange(preset){
  const t = today(), wd = (new Date(t + "T12:00:00Z").getUTCDay() + 6) % 7, mon = addDays(t, -wd);
  switch (preset || RV.preset) {
    case "next14": return [t, addDays(t, 13)];
    case "last7": return [addDays(t, -7), addDays(t, -1)];
    case "thisweek": return [mon, addDays(mon, 6)];
    case "nextweek": return [addDays(mon, 7), addDays(mon, 13)];
    case "lastweek": return [addDays(mon, -7), addDays(mon, -1)];
    default: return [t, addDays(t, 6)];
  }
}
/* "Mon 9 – Sun 15 Nov" (or "Mon 26 Oct – Sun 1 Nov" across a month end) */
function rvSpan(a, b){
  const sameMonth = a.slice(0, 7) === b.slice(0, 7);
  return fmt(a, sameMonth ? { weekday:"short", day:"numeric" } : { weekday:"short", day:"numeric", month:"short" }) + " – " + fmt(b, { weekday:"short", day:"numeric", month:"short" });
}
const rvPresetLabel = (k, l) => { const r = rvRange(k); return l + " (" + rvSpan(r[0], r[1]) + ")"; };
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
/* ---------------------------------------------------------------- the day as a bar chart (the This Week - Managers look) */
const tmin = v => (+String(v).slice(0, 2)) * 60 + (+String(v).slice(3, 5));
const hm = m => { m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); };
const BUCKET_RX = [["boh", /boh|kitchen|back of house/i], ["foh", /foh|front of house|bar|restaurant|floor/i], ["hk", /house ?keep|hk\b|rooms?\b/i], ["maint", /maint/i], ["office", /office|admin|management|reception/i]];
const bucketOf = n => { for (const [k, rx] of BUCKET_RX) if (rx.test(n)) return k; return "other"; };
const ROLE_ORDER = {
  foh: ["F&B Manager", "F&B Assistant Manager", "F&B Supervisor", "Team Member"],
  boh: ["Head Chef", "Sous Chef", "CDP", "Trainee Chef", "Kitchen Porter"],
  hk: ["Accommodations Manager", "Housekeeper"],
  maint: ["Maintenance Manager", "Maintenance Team Member"],
  office: ["General Manager", "Office Manager", "Wedding Coordinator"],
};
const MANAGERS = new Set(["F&B Manager", "F&B Assistant Manager", "Head Chef", "Sous Chef", "Accommodations Manager", "Maintenance Manager", "General Manager"]);
function roleLabel(job, bucket){
  const j = String(job || "").trim().toLowerCase();
  if (!j) return "Other";
  if (/agency/.test(j)) return "Agency";
  if (/food\s*(&|and)\s*bev/.test(j)) return "F&B Manager";
  if (/^bar manager/.test(j)) return "F&B Assistant Manager";
  if (/^supervisor/.test(j)) return "F&B Supervisor";
  if (/head chef/.test(j)) return "Head Chef";
  if (/sous/.test(j)) return "Sous Chef";
  if (/trainee/.test(j)) return "Trainee Chef";
  if (/kitchen porter/.test(j)) return "Kitchen Porter";
  if (/^cdp|chef de partie/.test(j)) return "CDP";
  if (/head house/.test(j)) return "Accommodations Manager";
  if (/^housekeep/.test(j)) return "Housekeeper";
  if (/^maint?enance.*manager/.test(j)) return "Maintenance Manager";
  if (/^maint?enance/.test(j)) return "Maintenance Team Member";
  if (/^gm$|general manager/.test(j)) return "General Manager";
  if (/^team member/.test(j)) return bucket === "boh" ? "CDP" : "Team Member";
  return String(job).trim();
}
function roleRank(label, bucket){
  if (label === "Agency") return 98;
  const own = (ROLE_ORDER[bucket] || []).indexOf(label); if (own >= 0) return own;
  for (const k in ROLE_ORDER) { const i = ROLE_ORDER[k].indexOf(label); if (i >= 0) return 20 + i; }
  return 50;
}
const deptLabel = n => (/^[A-Z]{5,}$/.test(n) ? n.charAt(0) + n.slice(1).toLowerCase() : n);
const firstOf = n => String(n || "").trim().split(/\s+/)[0] || "";
/* Time runs across the top in 15 minute steps (07:00 to 23:00, wider if a shift needs it), how many are on shift under it, then one row per job per department;
   people whose shifts do not overlap share a line; bars carry the first name, hover or tap for the full name and times. Dashed = a draft in Planday. */
function rvTimeline(shown){
  const all = [];
  shown.forEach(dep => dep.people.forEach(p => {
    const s0 = tmin(p.start); let e0 = tmin(p.end); if (e0 <= s0) e0 += 1440;
    all.push({ dep: dep.name, bucket: dep.bucket || bucketOf(dep.name), p, s: s0, e: e0 });
  }));
  if (!all.length) return "";
  const start = Math.min(7 * 60, Math.floor(Math.min(...all.map(x => x.s)) / 60) * 60);
  const end = Math.max(23 * 60, Math.ceil(Math.max(...all.map(x => x.e)) / 60) * 60);
  const total = end - start, n = total / 15, hrsN = total / 60;
  const pc = m => ((m - start) / total * 100).toFixed(3);
  const cuts = [...new Set(all.flatMap(x => [x.s, x.e]))].sort((a, b) => a - b);
  const segs = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i], b = cuts[i + 1], c = all.filter(x => x.s <= a && x.e >= b).length;
    if (segs.length && segs[segs.length - 1].c === c && segs[segs.length - 1].b === a) segs[segs.length - 1].b = b; else segs.push({ a, b, c });
  }
  const max = Math.max(1, ...segs.map(x => x.c));
  let h = `<div class="rtwrap"><div class="rt" style="--n:${n};--h:${hrsN}">`;
  h += `<div class="rtr rthead"><div class="rtlab"></div><div class="rtt">${Array.from({ length: hrsN }, (_, i) => `<span class="rthr" style="left:${pc(start + i * 60)}%">${hm(start + i * 60)}</span>`).join("")}</div></div>`;
  h += `<div class="rtr rtcount"><div class="rtlab">On shift</div><div class="rtt">${segs.filter(x => x.c > 0).map(x => `<div class="rtseg" style="left:${pc(x.a)}%;width:${((x.b - x.a) / total * 100).toFixed(3)}%;background:rgba(77,96,79,${(0.1 + 0.4 * x.c / max).toFixed(2)})" title="${x.c} on shift, ${hm(x.a)} to ${hm(x.b)}">${x.c}</div>`).join("")}</div></div>`;
  shown.forEach(dep => {
    const mine = all.filter(x => x.dep === dep.name); if (!mine.length) return;
    const bucket = dep.bucket || bucketOf(dep.name), groups = new Map();
    mine.forEach(x => { const l = roleLabel(x.p.job, bucket); if (!groups.has(l)) groups.set(l, []); groups.get(l).push(x); });
    if (shown.length > 1) h += `<div class="rtdh">${esc(deptLabel(dep.name))} · ${new Set(mine.map(x => x.p.name)).size}</div>`;
    [...groups.keys()].sort((a, b) => roleRank(a, bucket) - roleRank(b, bucket) || a.localeCompare(b)).forEach(label => {
      const lanes = [];
      groups.get(label).sort((a, b) => a.s - b.s || a.p.name.localeCompare(b.p.name)).forEach(x => {
        const lane = lanes.find(l => l.end <= x.s);
        if (lane) { lane.items.push(x); lane.end = x.e; } else lanes.push({ end: x.e, items: [x] });
      });
      lanes.forEach((l, i) => {
        h += `<div class="rtr"><div class="rtlab${i ? " sub" : ""}">${esc(label)}</div><div class="rtt">${l.items.map(x => {
          const tip = `${x.p.name} · ${label} · ${hm(x.s)}–${hm(x.e)}${x.p.draft ? " · not published yet" : ""}`;
          return `<button type="button" class="rtbar${x.p.draft ? " draft" : MANAGERS.has(label) ? " mgr" : ""}" style="left:${pc(x.s)}%;width:${((x.e - x.s) / total * 100).toFixed(3)}%" data-tip="${esc(tip)}" aria-label="${esc(tip)}">${esc(firstOf(x.p.name))}</button>`;
        }).join("")}</div></div>`;
      });
    });
  });
  return h + `</div></div>`;
}
function rvTip(el){
  let t = document.getElementById("rvtip"); if (!t) { t = document.createElement("div"); t.id = "rvtip"; t.setAttribute("role", "tooltip"); document.body.appendChild(t); }
  if (!el) { t.style.display = "none"; return; }
  t.textContent = el.dataset.tip; t.style.display = "block";
  const r = el.getBoundingClientRect(), w = t.offsetWidth, hh = t.offsetHeight;
  t.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + "px";
  t.style.top = (r.top - hh - 6 < 8 ? r.bottom + 6 : r.top - hh - 6) + "px";
}
document.addEventListener("mouseover", e => { const b = e.target.closest && e.target.closest(".rtbar"); if (b) rvTip(b); });
document.addEventListener("mouseout", e => { if (e.target.closest && e.target.closest(".rtbar")) rvTip(null); });
document.addEventListener("focusin", e => { const b = e.target.closest && e.target.closest(".rtbar"); if (b) rvTip(b); });
document.addEventListener("focusout", () => rvTip(null));
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest(".rtbar"); rvTip(b || null); });
document.addEventListener("scroll", () => rvTip(null), true);

/* ---------------------------------------------------------------- the page */
function rvPaint(){
  if (S.view !== "review") return;
  const v = $("#views"), D = RV.data;
  const depts = D ? D.departments : [];
  if (D && RV.dept !== "all" && !depts.includes(RV.dept)) RV.dept = "all";
  const bar = `<div class="pagehead"><h2>Rota review</h2><span class="hint">The rota from Planday next to what the house needs each day</span></div>
    <div class="rv-bar"><div class="f"><label for="rv_preset">Show</label><select id="rv_preset">${RV_PRESETS.map(([k, l]) => `<option value="${k}"${k === RV.preset ? " selected" : ""}>${esc(rvPresetLabel(k, l))}</option>`).join("")}</select></div>
      ${D ? `<div class="f"><label for="rv_dept">Department</label><select id="rv_dept"><option value="all"${RV.dept === "all" ? " selected" : ""}>All departments</option>${depts.map(n => `<option value="${esc(n)}"${RV.dept === n ? " selected" : ""}>${esc(deptLabel(n))}</option>`).join("")}</select></div>` : ""}
      <div class="f"><label>&nbsp;</label><button class="btn small" id="rv_refresh"${RV.busy ? " disabled" : ""}>${RV.busy ? "Loading…" : "Refresh from Planday"}</button></div></div>`;
  if (RV.err) { v.innerHTML = bar + `<div class="card empty">${esc(RV.err)}</div>`; return wire(); }
  if (!D) { v.innerHTML = bar + `<div class="loading">Loading…</div>`; return wire(); }
  const days = D.days, M = rvCompute(days), t = today();
  const one = RV.dept !== "all" ? RV.dept : null;
  const oneBucket = one ? ((days.map(d => d.departments.find(x => x.name === one)).find(Boolean) || {}).bucket || bucketOf(one)) : null;
  const head = days.map(d => `<th data-rvday="${esc(d.date)}" class="${d.date === t ? "today" : ""}${d.date === RV.sel ? " sel" : ""}${d.finished ? " past" : ""}" title="Show the full rota for this day">${esc(fmt(d.date, { weekday:"short" }))}<small>${esc(fmt(d.date, { day:"numeric", month:"short" }))}</small></th>`).join("");
  const row = (label, f, cls) => `<tr><td>${label}</td>${days.map((d, i) => { const c = f(d, i) || {}; return `<td class="${c.cls || ""}${d.finished ? " past" : ""}${c.v === undefined || c.v === "" ? " rve" : ""}${cls ? " " + cls : ""}">${c.v === undefined || c.v === "" ? "–" : c.v}${c.sub ? `<small>${c.sub}</small>` : ""}</td>`; }).join("")}</tr>`;
  const sec = x => `<tr class="sec"><td colspan="${days.length + 1}">${esc(x)}</td></tr>`;
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
  h += sec(one ? "The rota: " + deptLabel(one) + " (hours rostered, or worked for days already finished)" : "The rota (hours rostered, or worked for days already finished)");
  (one ? [one] : D.departments).forEach(name => {
    h += row(esc(deptLabel(name)), d => { const p = d.departments.find(x => x.name === name); const open = p && p.open ? `</small><span class="open">${p.open} open</span><small>` : ""; return p ? { v: p.hours > 0 ? hrs(p.hours) : "", sub: p.heads ? (p.heads === 1 ? "1 person" : p.heads + " people") + open : open } : { v:"" }; });
  });
  if (!one) h += row("All departments", d => ({ v: hrs(d.hours_total), cls:"rvb", sub: d.heads_total ? d.heads_total + " people" : "" }));
  const metrics = RV_METRICS.filter(m => !one || m.bucket === oneBucket);
  if (metrics.length) {
    h += sec("Is the rota about right? Compared with the usual for the days shown");
    metrics.forEach(m => { h += row(esc(m.label), (d, i) => { const r = M[m.key].rows[i]; if (r.none) return { v:"No rota", cls:"light" }; return r.v === null ? { v:"" } : { v: n1(r.v), cls: r.flag }; }); });
  }
  h += `</tbody></table><div class="rv-legend"><span><i style="background:var(--attention-bg);border:1px solid var(--attention)"></i>Heavy: more than 30% above the usual hours for the demand</span><span><i style="background:var(--alert-bg);border:1px solid var(--alert)"></i>Light: more than 30% below, or covers with nobody rostered</span><span>fc = forecast. Covers served = breakfasts + lunches + dinners (booked or forecast, whichever is larger; what was served once the day is done). Click a day to see its full rota.</span></div></div>`;

  // the days that stand out, in plain words
  const flags = [];
  metrics.forEach(m => M[m.key].rows.forEach((r, i) => {
    if (!r.flag) return; const d = days[i];
    if (r.none) { flags.push({ tg:"light", d, text: `${m.short}: ${n0(m.per(d))} ${m.key === "hk" ? "rooms to clean" : "covers"} and nobody rostered.` }); return; }
    flags.push({ tg:r.flag, d, text: `${m.short}: ${n1(r.v)} ${m.unit}, against ${n1(M[m.key].med)} usual (${n1(r.b.hours)} hours for ${n0(m.per(d))} ${m.key === "hk" ? "rooms" : "covers"}). ${r.flag === "heavy" ? "Check the rota is not too heavy." : "Check the rota is not too thin."}` });
  }));
  flags.sort((a, b) => a.d.date.localeCompare(b.d.date));
  const fl = flags.length ? `<div class="rv-flags"><h3>Worth a look</h3><ul>${flags.map(f => `<li><span class="tg ${f.tg}">${f.tg === "heavy" ? "Heavy" : "Light"}</span><span><b>${esc(rvDay(f.d.date))}.</b> ${esc(f.text)}</span></li>`).join("")}</ul></div>`
    : `<div class="rv-flags"><h3>Worth a look</h3><p class="muted" style="margin:0">Nothing stands out: every day is within 30% of the usual hours for its demand.</p></div>`;
  const drafts = D.drafts ? `<p class="rv-note">${D.drafts} ${D.drafts === 1 ? "shift is" : "shifts are"} still a draft in Planday; ${D.drafts === 1 ? "it is" : "they are"} counted here as part of the rota (dashed on the day charts).</p>` : "";
  v.innerHTML = bar + drafts + fl + h + rvDetail(D.days.find(d => d.date === RV.sel)) + `<p class="rv-note">Figures: rooms and covers from the forecast and booking reports${D.forecast_updated ? " (updated " + esc(new Date(D.forecast_updated).toLocaleString("en-GB", { timeZone:"Europe/London", day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" })) + ")" : ""}, rooms on the books from the booking engine, rota and hours from Planday.</p>`;
  wire();
}
/* one day in full: the demand, then the rota as a bar chart (all departments, or the one chosen) */
function rvDetail(d){
  if (!d) return "";
  const chips = [
    ["Rooms tonight", d.rooms.sold, nz(d.rooms.sold) && d.rooms.capacity ? " (" + Math.round(d.rooms.sold / d.rooms.capacity * 100) + "%)" : ""], ["Night before", d.rooms.prev, ""], ["Forecast rooms", d.rooms.forecast, ""], ["Rooms to clean", d.rooms.to_clean, ""],
    ["Breakfasts", d.breakfast.value, ""], ["Lunches", d.lunch.plan, nz(d.lunch.booked) ? " (" + d.lunch.booked + " booked)" : ""], ["Dinners", d.dinner.plan, nz(d.dinner.booked) ? " (" + d.dinner.booked + " booked)" : ""], ["Afternoon teas", d.afternoon_tea, ""],
  ].filter(c => nz(c[1])).map(c => `<span>${esc(c[0])} <b>${Math.round(c[1])}</b>${esc(c[2])}</span>`).join("");
  const ev = d.events.map(e => `<span>${esc(e.name)}${e.venue && e.venue !== "Other" ? " · " + esc(e.venue) : ""}${nz(e.guests) ? " · " + e.guests + (nz(e.evening_guests) && e.evening_guests !== e.guests ? " day / " + e.evening_guests + " evening" : " guests") : ""}</span>`).join("");
  const on = d.departments.filter(p => p.people.length);
  const shown = RV.dept === "all" ? on : on.filter(p => p.name === RV.dept);
  const none = d.departments.filter(p => !p.people.length).map(p => deptLabel(p.name));
  const open = d.departments.reduce((t, p) => t + p.open, 0);
  const hasDraft = shown.some(p => p.people.some(x => x.draft));
  const off = (d.off || []).map(o => esc(o.name) + (o.job ? ` (${esc(o.job)})` : "")).join(", ");
  return `<section class="rv-day" id="rv_day"><h3>${esc(fmt(d.date, { weekday:"long", day:"numeric", month:"long" }))}${d.finished ? ` <small class="muted" style="font-size:13px">finished: hours are what was worked</small>` : ""}</h3>
    <div class="rv-chips">${chips}${ev}</div>
    ${shown.length ? rvTimeline(shown) : `<p class="muted">${RV.dept === "all" ? "Nobody is rostered this day." : "Nobody from " + esc(deptLabel(RV.dept)) + " is rostered this day."}</p>`}
    ${hasDraft ? `<p class="rv-note" style="margin:8px 0 0"><b>Dashed</b> shifts are not published in Planday yet.</p>` : ""}
    ${RV.dept === "all" && none.length && on.length ? `<p class="rv-note" style="margin:8px 0 0">Nobody on: ${none.map(esc).join(", ")}.</p>` : ""}
    ${open ? `<p class="rv-note" style="margin:8px 0 0">${open} open ${open === 1 ? "shift has" : "shifts have"} nobody assigned.</p>` : ""}
    ${Array.isArray(d.off) ? `<div class="rv-off"><b>Off</b>${off || '<span class="muted">nobody booked off</span>'}</div>` : ""}</section>`;
}
function wire(){
  const p = $("#rv_preset"); if (p) p.onchange = () => { RV.preset = p.value; try { localStorage.setItem("rota_review_preset", RV.preset); } catch(e){} RV.data = null; RV.sel = ""; viewReview(); };
  const dp = $("#rv_dept"); if (dp) dp.onchange = () => { RV.dept = dp.value; rvPaint(); const x = $("#rv_dept"); if (x) x.focus(); };
  const r = $("#rv_refresh"); if (r) r.onclick = () => viewReview(true);
  $$("[data-rvday]").forEach(th => th.onclick = () => { RV.sel = th.dataset.rvday; rvPaint(); const dd = document.getElementById("rv_day"); if (dd) dd.scrollIntoView({ behavior:"smooth", block:"nearest" }); });
}
