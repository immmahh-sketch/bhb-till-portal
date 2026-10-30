/* Guest Feedback and Upsells: the three upsell tabs (Upsell sales, Arrivals, Offers and email). Uses the page's helpers ($, $$, esc, fmtD, fmtDT, toast, S, loadScript, parseCsv, parseEmails, isoDay)
   and the upsell-api edge function. */
async function ucall(action, payload){
  const r = await fetch(CFG.SUPABASE_URL + "/functions/v1/upsell-api", { method:"POST", headers:{ "Content-Type":"application/json", Authorization:"Bearer "+CFG.SUPABASE_KEY, apikey:CFG.SUPABASE_KEY }, body: JSON.stringify({ action, staff_email: staffEmail(), ...(payload||{}) }) });
  let d = {}; try { d = await r.json(); } catch(e){}
  if (!r.ok || d.error) throw new Error(d.error || `Request failed (${r.status})`);
  return d;
}
const gbp = n => "£" + (Math.round(Number(n) * 100) / 100 % 1 === 0 ? String(Math.round(Number(n))) : (Math.round(Number(n) * 100) / 100).toFixed(2));
const ukDay = iso => new Date(iso).toLocaleDateString("en-CA", { timeZone:"Europe/London" });
const dayName = d => { try { return new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { timeZone:"UTC", weekday:"short", day:"numeric", month:"short" }); } catch(e){ return d; } };
const ROOMS = [["DLX_DBL_FF","Deluxe Double (first floor)"],["DLX_DBL_GF","Deluxe Double (ground floor)"],["STU_SUITE","Studio Suite"],["ROSEMARY","Rosemary Suite"],["HUCKLEBERRY","Huckleberry Cottage"],["DLX_HT_SUITE","Deluxe Hot Tub Suite"]];
function csvCell(v){ v = String(v == null ? "" : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
function downloadCsv(name, rows){ const blob = new Blob(["﻿" + rows.map(r => r.map(csvCell).join(",")).join("\r\n")], { type:"text/csv" }), a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }

/* =========================================================== Upsell sales */
async function viewUpsells(){
  const v = $("#views"); v.innerHTML = `<div class="loading">Loading…</div>`;
  const days = S.upDays || 30, to = ukDay(new Date().toISOString()), from = ukDay(new Date(Date.now() - (days - 1) * 864e5).toISOString());
  let d; try { d = await ucall("sales.list", { from, to }); } catch(e){ v.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  S.sales = d; paintUpsells();
}
function paintUpsells(){
  const d = S.sales, real = d.orders.filter(o => !o.test), rev = real.reduce((t, o) => t + o.total, 0), nUp = real.filter(o => o.lines.some(l => l.kind === "upgrade")).length;
  const byDay = {}; d.orders.forEach(o => { const k = ukDay(o.paid_at); (byDay[k] = byDay[k] || []).push(o); });
  const keys = Object.keys(byDay).sort().reverse();
  const open = S.upOpen || {};
  let h = `<div class="pagehead"><h2>Upsell sales</h2><span class="hint">What has been sold, day by day, to add to the booking in Rezlynx.</span><span class="spacer"></span>
    <button class="btn ghost small" id="u_csv">Download CSV</button></div>
  <div class="chips">${[[7,"Last 7 days"],[30,"Last 30 days"],[90,"Last 90 days"],[365,"Last year"]].map(([n, l]) => `<button class="chip" data-days="${n}" aria-pressed="${(S.upDays || 30) === n}">${l}</button>`).join("")}</div>
  <div class="kpis">
    <div class="kpi"><div class="l">Sales</div><div class="v">${real.length}</div><div class="s">${nUp} with a room upgrade</div></div>
    <div class="kpi"><div class="l">Revenue</div><div class="v">${gbp(rev)}</div><div class="s">${real.length ? "average " + gbp(rev / real.length) : "nothing yet"}</div></div>
    <div class="kpi"><div class="l">Offer emails sent</div><div class="v">${d.emails_sent}</div><div class="s">${d.emails_sent ? (real.length / d.emails_sent * 100).toFixed(1) + "% bought" : ""}</div></div>
    <div class="kpi ${d.open_total ? "click" : ""}"><div class="l">Still to add to Rezlynx</div><div class="v">${d.open_total}</div><div class="s">${d.open_total ? "tick each one when done" : "all done"}</div></div>
  </div>`;
  if (!keys.length) h += `<div class="card"><div class="empty">No upsells sold in this period yet.${d.emails_sent ? "" : " Offers are emailed from the Arrivals tab once the automatic email is switched on in Offers and email."}</div></div>`;
  else h += `<div class="card"><div class="tw"><table class="t"><thead><tr><th>Day</th><th>Sales</th><th>Revenue</th><th>Sold</th><th>To add</th><th></th></tr></thead><tbody>${keys.map(k => {
      const list = byDay[k], r = list.filter(o => !o.test), what = {}; r.forEach(o => o.lines.forEach(l => { const n = l.kind === "upgrade" ? l.text.replace(/^Upgrade from .* to /, "Upgrade to ").replace(/ \(\d+ nights?\)$/, "") : l.text.replace(/ x \d+.*$/, "").replace(/ \(.*\)$/, ""); what[n] = (what[n] || 0) + 1; }));
      const todo = list.filter(o => !o.test && !o.done_at).length;
      return `<tr class="rr" data-day="${k}" style="cursor:pointer"><td><b>${dayName(k)}</b></td><td>${r.length}${list.length > r.length ? ` <span class="tag gold">test</span>` : ""}</td><td>${gbp(r.reduce((t, o) => t + o.total, 0))}</td><td class="muted">${Object.entries(what).map(([n, c]) => esc(n) + (c > 1 ? " x " + c : "")).join(", ")}</td><td>${todo ? `<span class="tag gold">${todo} to add</span>` : `<span class="tag good">All added</span>`}</td><td class="muted">${open[k] ? "Hide" : "Show"}</td></tr>
      ${open[k] ? `<tr><td colspan="6" style="background:var(--bone)">${list.map(o => `<div class="quote"><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><b>${esc(o.guest || "")}</b> <span class="muted">${esc(o.ref)} · arrives ${dayName(o.arrival)} to ${dayName(o.departure)} · booked ${esc(o.room)} · paid ${fmtDT(o.paid_at)}</span>${o.test ? ` <span class="tag gold">test</span>` : ""}<span class="spacer"></span><b>${gbp(o.total)}</b></div>
        <div>${o.lines.map(l => esc(l.text) + " · " + gbp(l.amount)).join("<br>")}</div>${o.note ? `<div class="muted">Guest note: ${esc(o.note)}</div>` : ""}<small>${esc(o.email || "")}${o.sumup ? " · SumUp " + esc(o.sumup) : ""}</small>
        <label class="sw" style="margin:8px 0 0"><input type="checkbox" data-done="${o.id}" ${o.done_at ? "checked" : ""}><span>Added to Rezlynx${o.done_at ? ` <span class="muted" style="font-weight:400">(${esc(o.done_by || "")}, ${fmtDT(o.done_at)})</span>` : ""}</span></label></div>`).join("")}</td></tr>` : ""}`; }).join("")}</tbody></table></div></div>`;
  $("#views").innerHTML = h;
  $$("[data-days]").forEach(b => b.onclick = () => { S.upDays = +b.dataset.days; viewUpsells(); });
  $$("tr[data-day]").forEach(r => r.onclick = () => { S.upOpen = S.upOpen || {}; S.upOpen[r.dataset.day] = !S.upOpen[r.dataset.day]; paintUpsells(); });
  $$("[data-done]").forEach(c => c.onchange = async () => { try { await ucall("order.done", { id:c.dataset.done, done:c.checked }); const o = S.sales.orders.find(x => x.id === c.dataset.done); if (o) { o.done_at = c.checked ? new Date().toISOString() : null; o.done_by = S.me.name; } S.sales.open_total += c.checked ? -1 : 1; paintUpsells(); toast(c.checked ? "Marked as added to Rezlynx." : "Marked as still to add."); } catch(e){ toast(e.message, true); c.checked = !c.checked; } });
  $("#u_csv").onclick = () => downloadCsv(`upsell-sales-${d.from}-to-${d.to}.csv`, [["Paid","Guest","Email","Booking","Arrives","Departs","Room booked","What was sold","Total","Added to Rezlynx","SumUp reference","Test"]].concat(d.orders.map(o => [o.paid_at, o.guest, o.email, o.ref, o.arrival, o.departure, o.room, o.lines.map(l => l.text + " " + l.amount).join("; "), o.total, o.done_at ? "Yes" : "No", o.sumup || "", o.test ? "Yes" : ""])));
}

/* =========================================================== Arrivals */
function parseArrivals(rows){
  const out = []; let cur = null; const keys = { "Guest:":"guest", "Room Type:":"room_type", "Arrival:":"arrival", "Departure:":"departure", "Package:":"package", "Status:":"status", "Adults:":"adults", "Children:":"children", "Total Cost:":"total" };
  rows.forEach(r => {
    const f = r.map(c => c == null ? "" : String(c).trim()).filter(Boolean); if (!f.length) return;
    if (f[0] === "BookRef:") { cur = { ref: f[1] || "" }; out.push(cur); return; }
    if (!cur) return;
    f.forEach((x, i) => { const k = keys[x]; if (k && !(k in cur) && f[i+1] != null && !/:$/.test(f[i+1])) cur[k] = f[i+1]; });
  });
  return out.map(b => ({ ref:b.ref, guest:b.guest || "", room_type:b.room_type || "", package:b.package || "", arrival:isoDay(b.arrival), departure:isoDay(b.departure), status:b.status || "", adults:b.adults || "", children:b.children || "", total:b.total || "" })).filter(b => b.ref);
}
async function viewArrivals(){
  const v = $("#views"); v.innerHTML = `<div class="loading">Loading…</div>`;
  let d; try { d = await ucall("arrivals.list"); } catch(e){ v.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  S.arr = d; paintArrivals();
}
const STAGES_NAME = { 30:"1 month", 14:"2 weeks", 7:"1 week", 3:"3 days" };
function paintArrivals(msg){
  const d = S.arr, s = d.settings || {}, today = ukDay(new Date().toISOString()), limit = S.arrAll ? 120 : 45, lim = new Date(Date.now() + limit * 864e5).toISOString().slice(0, 10);
  const rows = d.bookings.filter(b => b.arrival <= lim), stages = (s.stages || [30,14,7,3]).slice().sort((a, c) => c - a);
  const eligible = rows.filter(b => !b.skip), waiting = eligible.filter(b => b.next_stage && !b.sent.some(x => x.stage === b.next_stage) && !b.paid);
  const stale = d.last_import ? Math.round((Date.now() - new Date(d.last_import).getTime()) / 864e5) : null;
  let h = `<div class="pagehead"><h2>Arrivals</h2><span class="hint">Who is coming, and which guests are emailed an upgrade offer.</span></div>
  <div class="note">${s.auto ? "The automatic email is <b>ON</b>. Each guest marked below is emailed at " + (s.send_hour || 10) + "am, once for each stage (" + stages.map(x => STAGES_NAME[x] || x + " days").join(", ") + " before arrival)." : "The automatic email is <b>OFF</b>, so nothing below is sent. Preview the email and switch it on in <b>Offers and email</b>."}${stale != null && stale >= (s.stale_days || 3) ? ` <b>The arrivals list is ${stale} days old, so guests are not emailed until you add today's reports.</b>` : ""}</div>
  <div class="card"><h3>Add today's reports</h3>
    <p class="muted" style="font-size:13.5px;margin-top:0">From Rezlynx, once a day: the <b>Reservations report</b> (.xls, with the arrivals still to come) and the <b>Sales and Marketing query</b> (.csv with BookRef, Forename, Surname, Email). They are matched on the booking reference. Guests who have dropped off the report (cancelled or changed) are no longer emailed.</p>
    <div class="row2"><div class="field"><label>Reservations report (.xls)</label><input type="file" id="ar_xls" accept=".xls,.xlsx"></div><div class="field"><label>Sales and Marketing query (.csv)</label><input type="file" id="ar_csv" accept=".csv,text/csv"></div></div>
    <button class="btn" id="ar_go">Add to the list</button>${msg ? `<div class="note" style="margin-top:12px">${msg}</div>` : ""}</div>
  <div class="card"><h3>Coming in the next ${limit} days</h3>
    <p class="muted" style="margin-top:0">${rows.length} bookings · ${eligible.length} can be emailed · ${waiting.length} waiting for their next email · ${rows.filter(b => b.paid).length} bought something${d.offers_active ? "" : " · <b>no offers are switched on</b>"}</p>
    <div class="chips"><button class="chip" id="ar_more" aria-pressed="${!!S.arrAll}">Show the next 120 days</button></div>
    ${rows.length ? `<div class="tw"><table class="t"><thead><tr><th>Arrives</th><th>Guest</th><th>Room booked</th><th>Rate</th><th>Email</th><th>Offers sent</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(b => {
      const chips = stages.map(st => { const x = b.sent.find(y => y.stage === st); return `<span class="tag ${x ? (x.status === "sent" ? "good" : "") : (b.next_stage === st ? "gold" : "")}" title="${esc(x ? (x.status === "sent" ? "Emailed " + fmtDT(x.at) + (x.detail ? ": " + x.detail : "") : "Nothing free to offer") : b.next_stage === st ? "Next to be sent" : "")}">${STAGES_NAME[st] || st + "d"}${x ? (x.status === "sent" ? " ✓" : " –") : ""}</span>`; }).join(" ");
      const status = b.paid ? `<span class="tag good">Bought ${gbp(b.paid)}</span>` : b.no_offers ? `<span class="tag">Taken off</span>` : b.skip ? `<span class="tag">Not emailed</span> <span class="muted">${esc(b.skip)}</span>` : b.viewed ? `<span class="tag gold">Opened the offer</span>` : b.next_stage ? `<span class="tag gold">Next: ${STAGES_NAME[b.next_stage] || b.next_stage + " days"}</span>` : `<span class="muted">Too far off</span>`;
      return `<tr><td class="nowrap">${dayName(b.arrival)}<br><span class="muted">${b.nights} night${b.nights === 1 ? "" : "s"}</span></td><td>${esc(b.guest || "")}<br><span class="muted">${esc(b.ref)}</span></td><td>${esc(b.room)}</td><td>${esc(b.package || "")}</td><td>${esc(b.email || "")}</td><td>${chips}</td><td>${status}</td>
      <td class="nowrap"><button class="btn ghost small" data-prev="${esc(b.book_ref)}">Preview</button> ${b.paid ? "" : b.no_offers ? `<button class="btn ghost small" data-off="${esc(b.book_ref)}" data-skip="0">Include</button>` : `<button class="btn ghost small" data-off="${esc(b.book_ref)}" data-skip="1">Do not send</button>`}</td></tr>`; }).join("")}</tbody></table></div>` : `<div class="empty">No arrivals yet. Add the two reports above.</div>`}</div>`;
  $("#views").innerHTML = h;
  $("#ar_more").onclick = () => { S.arrAll = !S.arrAll; paintArrivals(); };
  $$("[data-off]").forEach(b => b.onclick = async () => { b.disabled = true; try { await ucall("arrivals.skip", { book_ref:b.dataset.off, skip:b.dataset.skip === "1" }); toast(b.dataset.skip === "1" ? "Taken off the list." : "Back on the list."); viewArrivals(); } catch(e){ toast(e.message, true); b.disabled = false; } });
  $$("[data-prev]").forEach(b => b.onclick = () => showPreview(b.dataset.prev, (s.stages || [14])[0]));
  $("#ar_go").onclick = async () => {
    const x = $("#ar_xls").files[0], c = $("#ar_csv").files[0]; if (!x || !c) { toast("Choose both files first.", true); return; }
    const b = $("#ar_go"); b.disabled = true; b.textContent = "Reading…";
    try {
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
      const wb = XLSX.read(await x.arrayBuffer(), { type:"array" }), sheet = wb.Sheets[wb.SheetNames[0]];
      const bookings = parseArrivals(XLSX.utils.sheet_to_json(sheet, { header:1, raw:false, defval:"" }));
      if (!bookings.length) throw new Error("No bookings were found in the reservations report. Is it the right file?");
      const emails = parseEmails(await c.text());
      const r = await ucall("arrivals.import", { bookings, emails });
      const m = `Read ${r.read} bookings: <b>${r.kept}</b> confirmed room stays still to come (${r.added} new, ${r.updated} already known)${r.gone ? `; <b>${r.gone}</b> no longer on the report and taken off` : ""}. ${r.no_email} have no email address and ${r.relay} use a booking-site address.`;
      S.arr = await ucall("arrivals.list"); paintArrivals(m);
    } catch(e){ toast(e.message, true); b.disabled = false; b.textContent = "Add to the list"; }
  };
}

/* =========================================================== email preview (used by Arrivals and Offers) */
function showPreview(bookRef, stage){
  const bg = document.createElement("div"); bg.className = "rbg";
  bg.innerHTML = `<div class="rbox" style="max-width:720px"><h3>Email preview</h3><div class="sum"><span class="muted" id="pv_info">Building the preview…</span></div>
    <div class="field" style="max-width:260px"><label>Stage</label><select id="pv_stage">${[30,14,7,3].map(n => `<option value="${n}" ${n === stage ? "selected" : ""}>${STAGES_NAME[n]} before arrival</option>`).join("")}</select></div>
    <div id="pv_subj" style="font-weight:700;margin:6px 0"></div><iframe id="pv_frame" style="width:100%;height:560px;border:1px solid var(--mist);border-radius:8px;background:#fff" sandbox></iframe>
    <div class="acts"><button class="btn ghost" id="pv_test">Email me this as a test</button><button class="btn" id="pv_close">Close</button></div></div>`;
  document.body.appendChild(bg);
  const load = async () => {
    $("#pv_info").textContent = "Building the preview…";
    try { const d = await ucall("preview", { book_ref:bookRef || undefined, stage:+$("#pv_stage").value }); $("#pv_subj").textContent = "Subject: " + d.subject; $("#pv_frame").srcdoc = d.html; $("#pv_info").textContent = d.live ? `Live prices for ${d.guest} (${d.ref}).` : "Sample guest and prices (no upcoming booking has a higher room free)."; }
    catch(e){ $("#pv_info").textContent = e.message; }
  };
  $("#pv_stage").onchange = load; $("#pv_close").onclick = () => bg.remove(); bg.addEventListener("click", e => { if (e.target === bg) bg.remove(); });
  $("#pv_test").onclick = async () => { const b = $("#pv_test"); b.disabled = true; try { const r = await ucall("test.send", { book_ref:bookRef || undefined, stage:+$("#pv_stage").value }); toast("Sent to " + r.sent_to + "."); } catch(e){ toast(e.message, true); } b.disabled = false; };
  load();
}

/* =========================================================== Offers and email */
async function viewOffers(){
  const v = $("#views"); v.innerHTML = `<div class="loading">Loading…</div>`;
  let d; try { d = await ucall("settings.get"); } catch(e){ v.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  S.uo = d; S.uoEdit = S.uoEdit || null; try { S.arrCount = can("arrivals") ? (await ucall("arrivals.list")) : null; } catch(e){ S.arrCount = null; }
  paintOffers();
}
function offerForm(o){
  const up = o.kind === "upgrade";
  return `<div class="qe" data-form="${o.id || "new"}"><div class="field"><label>Name guests see</label><input class="of_title" value="${esc(o.title || "")}" maxlength="80"></div>
    <div class="field"><label>Wording (a sentence or two that makes it sound tempting)</label><textarea class="of_blurb" maxlength="600">${esc(o.blurb || "")}</textarea></div>
    ${up ? `<div class="field"><label>Which room is this</label><div>${ROOMS.map(([k, n]) => `<label style="display:inline-flex;gap:6px;align-items:center;margin:0 14px 6px 0;font-size:14px;text-transform:none;letter-spacing:0;color:var(--ink)"><input type="checkbox" class="of_room" value="${k}" ${(o.room_types || []).includes(k) ? "checked" : ""}>${n}</label>`).join("")}</div></div>
      <div class="field"><label>Discount on the price difference (%)</label><input type="number" class="of_disc" min="0" max="90" step="1" value="${o.discount_pct == null ? 50 : o.discount_pct}"><div class="muted" style="font-size:12.5px;margin-top:4px">The price is worked out live for each guest: the difference between their room and this one for every night of the stay, less this discount.</div></div>`
    : `<div class="row2"><div class="field"><label>Price (£)</label><input type="number" class="of_price" min="0" step="0.01" value="${o.price == null ? "" : o.price}"></div><div class="field"><label>Charged</label><select class="of_per">${[["stay","Once per stay"],["night","Per night"],["each","Each (guest picks how many)"]].map(([k, n]) => `<option value="${k}" ${o.per === k ? "selected" : ""}>${n}</option>`).join("")}</select></div></div>
      <div class="field"><label>The most a guest can choose</label><input type="number" class="of_max" min="1" max="20" value="${o.max_qty || 1}"></div>`}
    <div class="sw"><input type="checkbox" class="of_active" ${o.active !== false ? "checked" : ""} id="oa_${o.id || "new"}"><label for="oa_${o.id || "new"}">On offer</label></div>
    ${up ? "" : `<div class="sw"><input type="checkbox" class="of_mail" ${o.in_email !== false ? "checked" : ""} id="om_${o.id || "new"}"><label for="om_${o.id || "new"}">Show in the emails (otherwise only on the offer page)</label></div>`}
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn small of_save">Save</button><button class="btn ghost small of_cancel">Cancel</button>${o.id ? `<button class="btn danger small of_del">Delete</button>` : ""}</div></div>`;
}
function paintOffers(){
  const d = S.uo, s = d.settings, offers = d.offers, ups = offers.filter(o => o.kind === "upgrade"), ex = offers.filter(o => o.kind === "extra");
  const waiting = S.arrCount ? S.arrCount.bookings.filter(b => !b.skip && b.next_stage && !b.sent.some(x => x.stage === b.next_stage) && !b.paid).length : null;
  const line = o => { const ed = S.uoEdit === o.id; return `<div class="card" style="padding:14px 18px"><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:baseline"><b style="font-size:16px">${esc(o.title)}</b> ${o.kind === "upgrade" ? `<span class="tag">${o.discount_pct}% off</span>` : `<span class="tag">${gbp(o.price)} ${o.per === "night" ? "a night" : o.per === "each" ? "each" : "once"}</span>`} <span class="tag ${o.active ? "good" : ""}">${o.active ? "On offer" : "Off"}</span>${o.kind === "extra" && o.active ? `<span class="tag ${o.in_email ? "good" : ""}">${o.in_email ? "In the email" : "Page only"}</span>` : ""}<span class="spacer"></span><button class="btn ghost small" data-edit="${o.id}">${ed ? "Close" : "Edit"}</button></div>
    <div class="muted" style="font-size:13.5px">${esc(o.blurb || "")}</div>${ed ? offerForm(o) : ""}</div>`; };
  let h = `<div class="pagehead"><h2>Offers and email</h2><span class="hint">What guests are offered, what it costs, and exactly what the email says.</span></div>
  <div class="card"><h3>Automatic upgrade emails</h3>
    <div class="sw"><input type="checkbox" id="u_auto" ${s.auto ? "checked" : ""}><label for="u_auto">Email guests automatically</label></div>
    <p class="muted" style="margin:0 0 6px">${s.auto ? "ON: every day at " + s.send_hour + "am each guest is emailed once at each of these stages." : "OFF: nothing is sent until you switch this on."} ${waiting != null ? `<b>${waiting}</b> guest${waiting === 1 ? " is" : "s are"} waiting for an email now${s.auto ? "" : ", and would be emailed at " + s.send_hour + "am the next morning if you switch on"}.` : ""}</p>
    <p class="muted" style="margin:0">Only guests with a higher room free for the whole stay are emailed. A sale is emailed to ${esc(s.notify_emails)} straight away, and a daily report of sales goes at ${s.report_hour}am.</p></div>
  <div class="sechead">Room upgrades <small>priced live for each guest</small></div>${ups.map(line).join("")}
  <button class="btn ghost small" id="o_addup" style="margin-bottom:10px">Add an upgrade</button>
  <div class="sechead">Extras <small>fixed prices, from the team's list</small></div>${ex.map(line).join("")}
  <button class="btn ghost small" id="o_addex">Add an extra</button>
  ${S.uoEdit === "new-upgrade" ? `<div class="card">${offerForm({ kind:"upgrade" })}</div>` : ""}${S.uoEdit === "new-extra" ? `<div class="card">${offerForm({ kind:"extra", per:"stay", max_qty:1 })}</div>` : ""}
  <div class="sechead">The email guests receive</div>
  <div class="card"><div class="field"><label>Subject</label><input id="e_subject" value="${esc(s.subject)}"></div>
    <div class="field"><label>Heading</label><input id="e_heading" value="${esc(s.heading)}"></div>
    <div class="field"><label>Message (a blank line starts a new paragraph; the last two paragraphs sit below the offers)</label><textarea id="e_body" style="min-height:300px">${esc(s.body)}</textarea>
      <div class="muted" style="font-size:12.5px;margin-top:4px">You can use <code>{first_name}</code> <code>{when}</code> (in about a month / in just a couple of weeks / next week / in just three days) <code>{arrival_day}</code> <code>{departure_day}</code> <code>{nights}</code>.</div></div>
    <h4>An extra line for each stage (optional)</h4><div class="row2">${[30,14,7,3].map(n => `<div class="field"><label>${STAGES_NAME[n]} before arrival</label><textarea class="e_note" data-n="${n}" style="min-height:70px">${esc((s.stage_notes || {})[n] || "")}</textarea></div>`).join("")}</div>
    <div class="row2"><div class="field"><label>Heading above the upgrades</label><input id="e_uh" value="${esc(s.upgrades_heading)}"></div><div class="field"><label>Line under it</label><input id="e_ui" value="${esc(s.upgrades_intro)}"></div></div>
    <div class="row2"><div class="field"><label>Heading above the extras</label><input id="e_xh" value="${esc(s.extras_heading)}"></div><div class="field"><label>Line under it</label><input id="e_xi" value="${esc(s.extras_intro)}"></div></div>
    <div class="field"><label>Small print (bottom of the email and the offer page)</label><textarea id="e_sp">${esc(s.small_print)}</textarea></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="e_save">Save the wording</button><button class="btn ghost" id="e_prev">Preview the email</button></div></div>
  <div class="sechead">The thank-you after they pay</div>
  <div class="card"><div class="field"><label>Subject</label><input id="r_subject" value="${esc(s.receipt_subject)}"></div><div class="field"><label>Message</label><textarea id="r_body" style="min-height:220px">${esc(s.receipt_body)}</textarea></div><button class="btn" id="r_save">Save the thank-you</button></div>
  <div class="sechead">Who and when</div>
  <div class="card"><div class="field"><label>Email every sale and the daily report to (commas between)</label><input id="s_notify" value="${esc(s.notify_emails)}"></div>
    <div class="row2"><div class="field"><label>Days before arrival (largest first)</label><input id="s_stages" value="${esc((s.stages || []).join(", "))}"></div><div class="field"><label>Send at (hour, UK)</label><input type="number" id="s_hour" min="6" max="20" value="${s.send_hour}"></div></div>
    <div class="sw"><input type="checkbox" id="s_relay" ${s.skip_relay ? "checked" : ""}><label for="s_relay">Do not email booking-site addresses (Booking.com, Expedia)</label></div>
    <div class="sw"><input type="checkbox" id="s_house" ${s.skip_house ? "checked" : ""}><label for="s_house">Do not email house-use bookings</label></div>
    <div class="sw"><input type="checkbox" id="s_wed" ${s.skip_wedding ? "checked" : ""}><label for="s_wed">Do not email wedding-rate bookings</label></div>
    <button class="btn" id="s_save">Save</button></div>`;
  $("#views").innerHTML = h;
  const save = async (payload, ok) => { try { const r = await ucall("settings.save", payload); S.uo.settings = r.settings; toast(ok || "Saved."); paintOffers(); } catch(e){ toast(e.message, true); } };
  $("#u_auto").onchange = async e => { const on = e.target.checked; if (on && !confirm("Switch on automatic emails?" + (waiting != null ? `\n\n${waiting} guest${waiting === 1 ? "" : "s"} would be emailed at ${s.send_hour}am tomorrow, and every day after that as guests reach each stage.` : "") + "\n\nHave you looked at the preview?")) { e.target.checked = false; return; } await save({ auto:on }, on ? "Automatic emails are ON." : "Automatic emails are OFF."); };
  $$("[data-edit]").forEach(b => b.onclick = () => { S.uoEdit = S.uoEdit === b.dataset.edit ? null : b.dataset.edit; paintOffers(); });
  $("#o_addup").onclick = () => { S.uoEdit = "new-upgrade"; paintOffers(); $("[data-form=new]").scrollIntoView({ behavior:"smooth", block:"center" }); };
  $("#o_addex").onclick = () => { S.uoEdit = "new-extra"; paintOffers(); $("[data-form=new]").scrollIntoView({ behavior:"smooth", block:"center" }); };
  $$(".qe").forEach(f => {
    const id = f.dataset.form === "new" ? null : f.dataset.form, kind = id ? offers.find(o => o.id === id).kind : (S.uoEdit === "new-upgrade" ? "upgrade" : "extra"), cur = id ? offers.find(o => o.id === id) : {};
    f.querySelector(".of_cancel").onclick = () => { S.uoEdit = null; paintOffers(); };
    const del = f.querySelector(".of_del"); if (del) del.onclick = async () => { if (!confirm("Delete this offer? Past sales are kept.")) return; try { const r = await ucall("offers.delete", { id }); S.uo.offers = r.offers; S.uoEdit = null; toast("Deleted."); paintOffers(); } catch(e){ toast(e.message, true); } };
    f.querySelector(".of_save").onclick = async () => {
      const q = c => f.querySelector(c), p = { id, kind, title:q(".of_title").value, blurb:q(".of_blurb").value, active:q(".of_active").checked, sort_order:cur.sort_order || (kind === "upgrade" ? 60 : 190) };
      if (kind === "upgrade") { p.room_types = [...f.querySelectorAll(".of_room:checked")].map(x => x.value); p.discount_pct = q(".of_disc").value; } else { p.price = q(".of_price").value; p.per = q(".of_per").value; p.max_qty = q(".of_max").value; p.in_email = q(".of_mail").checked; }
      try { const r = await ucall("offers.save", p); S.uo.offers = r.offers; S.uoEdit = null; toast("Saved."); paintOffers(); } catch(e){ toast(e.message, true); }
    };
  });
  const wording = () => ({ subject:$("#e_subject").value, heading:$("#e_heading").value, body:$("#e_body").value, stage_notes:Object.fromEntries($$(".e_note").map(t => [t.dataset.n, t.value])), upgrades_heading:$("#e_uh").value, upgrades_intro:$("#e_ui").value, extras_heading:$("#e_xh").value, extras_intro:$("#e_xi").value, small_print:$("#e_sp").value });
  $("#e_save").onclick = () => save(wording(), "Wording saved.");
  $("#e_prev").onclick = async () => { try { const r = await ucall("settings.save", wording()); S.uo.settings = r.settings; } catch(e){ toast(e.message, true); return; } showPreview("", (S.uo.settings.stages || [14])[0]); };
  $("#r_save").onclick = () => save({ receipt_subject:$("#r_subject").value, receipt_body:$("#r_body").value }, "Thank-you saved.");
  $("#s_save").onclick = () => save({ notify_emails:$("#s_notify").value, stages:$("#s_stages").value, send_hour:$("#s_hour").value, skip_relay:$("#s_relay").checked, skip_house:$("#s_house").checked, skip_wedding:$("#s_wed").checked }, "Saved.");
}
