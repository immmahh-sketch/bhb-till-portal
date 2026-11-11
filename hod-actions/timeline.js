/* HOD Actions > Project Timeline.
   A project has a launch date; every task is dated by counting back from it. Shown as a Gantt chart or as a countdown list,
   filterable by person. Uses the page's own S, call(), esc(), toast() and friends (index.html loads this after them). */
"use strict";
const TL = { loaded:false, projects:[], templates:[], roles:{}, people:[], today:"", person:"all", project:"all", mode:"gantt", zoom:"weeks", status:"all", finished:false, collapsed:{}, sure:null, np:null };
try { Object.assign(TL, JSON.parse(localStorage.getItem("hod_tl_prefs") || "{}")); } catch(e){}
const tlSave = () => { try { localStorage.setItem("hod_tl_prefs", JSON.stringify({ mode:TL.mode, zoom:TL.zoom, finished:TL.finished })); } catch(e){} };

/* ---------------------------------------------------------------- dates */
const dMs = d => Date.parse(d + "T12:00:00Z");
const dDiff = (a, b) => Math.round((dMs(b) - dMs(a)) / 864e5);
const dAdd = (d, n) => new Date(dMs(d) + n * 864e5).toISOString().slice(0, 10);
const dFmt = (d, o) => new Date(dMs(d)).toLocaleDateString("en-GB", Object.assign({ timeZone:"UTC" }, o));
const dShort = d => dFmt(d, { day:"numeric", month:"short" });
const dLong = d => dFmt(d, { weekday:"short", day:"numeric", month:"short", year:"numeric" });
const dMonday = d => dAdd(d, -((new Date(dMs(d)).getUTCDay() + 6) % 7));
const plural = (n, w) => n + " " + w + (n === 1 ? "" : "s");
/** "12 weeks before", "3 days after" ... from a due date and the launch date. */
function beforeLabel(due, launch){
  const n = dDiff(due, launch);
  if (n === 0) return "Launch day";
  const k = Math.abs(n), tail = n > 0 ? " before" : " after";
  if (k <= 14) return plural(k, "day") + tail;
  if (k <= 84) return plural(Math.round(k / 7), "week") + tail;
  return plural(Math.round(k / 30.4), "month") + tail;
}
function relDay(d){
  const n = dDiff(TL.today, d);
  if (n === 0) return "today"; if (n === 1) return "tomorrow"; if (n === -1) return "yesterday";
  return n > 0 ? "in " + plural(n, "day") : plural(-n, "day") + " ago";
}
const PAL = ["#3F7D58", "#2F7FB5", "#C8742B", "#8E4F9E", "#B5483E", "#2C8C8C", "#8A8A2E", "#C25B8E", "#5A6BB8", "#7A5C3E", "#4C8F2F", "#B38600"];
const NONE_COL = "#8D968E";
let tlColors = {};
function tlColorMap(){
  const emails = Array.from(new Set(TL.projects.flatMap(p => p.tasks.map(t => t.owner_email)).filter(Boolean))).sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  tlColors = {}; emails.forEach((e, i) => { tlColors[e] = PAL[i % PAL.length]; });
}
const colOf = e => tlColors[e] || NONE_COL;
const nameOf = e => { const p = TL.people.find(x => x.email === e); return p ? p.name : (e || "Nobody yet"); };
const firstName = e => String(nameOf(e)).split(" ")[0];

/* ---------------------------------------------------------------- data */
async function tlLoad(){
  const d = await call("tl.load");
  Object.assign(TL, { loaded:true, projects:d.projects || [], templates:d.templates || [], roles:d.roles || {}, people:d.people || [], today:d.today });
  if (d.me) S.me = { ...S.me, ...d.me };
  tlColorMap();
}
const pPct = p => p.tasks.length ? Math.round(p.tasks.reduce((s, t) => s + t.percent, 0) / p.tasks.length) : 0;
const tLate = t => t.percent < 100 && t.due_date < TL.today;
const pDone = p => p.tasks.length > 0 && p.tasks.every(t => t.percent >= 100);
function tMatch(t){
  const w = TL.person;
  if (w === "me") { if (t.owner_email !== S.me.email) return false; }
  else if (w === "none") { if (t.owner_email) return false; }
  else if (w !== "all" && t.owner_email !== w) return false;
  if (TL.status === "open" && t.percent >= 100) return false;
  if (TL.status === "late" && !tLate(t)) return false;
  if (TL.status === "done" && t.percent < 100) return false;
  return true;
}
/** Projects to show, each with `vis` = the tasks that pass the filters. */
function visible(){
  const out = [];
  for (const p of TL.projects) {
    if (TL.project !== "all" && p.id !== TL.project) continue;
    if (TL.project === "all" && !TL.finished && pDone(p) && p.launch_date < TL.today) continue;
    const vis = p.tasks.filter(tMatch).sort((a, b) => a.due_date.localeCompare(b.due_date) || a.sort_order - b.sort_order || a.title.localeCompare(b.title));
    const filtering = TL.person !== "all" || TL.status !== "all";
    if (filtering && !vis.length) continue;
    out.push({ ...p, vis });
  }
  return out;
}
const opt = (v, label, sel) => `<option value="${esc(v)}"${String(v) === String(sel) ? " selected" : ""}>${esc(label)}</option>`;
const peopleOpts = (sel, blank) => opt("", blank || "Nobody yet", sel) + TL.people.map(p => opt(p.email, p.name, sel)).join("");

/* ---------------------------------------------------------------- the page */
async function viewTimeline(){
  $("#views").innerHTML = `<div class="loading">Loading…</div>`;
  try { await tlLoad(); } catch(e){ $("#views").innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  if (S.view !== "timeline") return;
  renderTL(); tlAfter();
}
function renderTL(){
  if (S.view !== "timeline") return;
  const vs = visible();
  // numbers for the person chosen (ignoring the status filter)
  const pool = TL.projects.filter(p => TL.project === "all" || p.id === TL.project).flatMap(p => p.tasks).filter(t => {
    const w = TL.person; return w === "all" || (w === "me" ? t.owner_email === S.me.email : w === "none" ? !t.owner_email : t.owner_email === w);
  });
  const open = pool.filter(t => t.percent < 100), late = open.filter(tLate), soon = open.filter(t => t.due_date >= TL.today && t.due_date <= dAdd(TL.today, 7));
  const owners = Array.from(new Set(TL.projects.flatMap(p => p.tasks.map(t => t.owner_email)).filter(Boolean))).sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  const hasNone = TL.projects.some(p => p.tasks.some(t => !t.owner_email));
  $("#views").innerHTML = `
    <div class="pagehead"><h2>Project timeline</h2><span class="hint">Set the launch date and everything counts back from it</span>
      <span class="spacer"></span>
      ${S.me.isAdmin ? `<button class="btn ghost small" data-tl="templates">Templates</button>` : ""}
      <button class="btn small" data-tl="newproject">New project</button></div>
    <div class="sum"><div class="pill"><b>${vs.length}</b><span>Projects shown</span></div><div class="pill"><b>${open.length}</b><span>Tasks open</span></div>
      <div class="pill late"><b>${late.length}</b><span>Overdue</span></div><div class="pill"><b>${soon.length}</b><span>Due in 7 days</span></div></div>
    <div class="tl-bar">
      <div class="f"><label for="tlf_person">Person</label><select id="tlf_person" data-tlf="person">${opt("all", "Everyone", TL.person)}${opt("me", "Me (" + S.me.name + ")", TL.person)}${owners.filter(e => e !== S.me.email).map(e => opt(e, nameOf(e), TL.person)).join("")}${hasNone ? opt("none", "Not given to anyone", TL.person) : ""}</select></div>
      <div class="f"><label for="tlf_project">Project</label><select id="tlf_project" data-tlf="project">${opt("all", "All projects", TL.project)}${TL.projects.map(p => opt(p.id, p.name, TL.project)).join("")}</select></div>
      <div class="f"><label for="tlf_status">Tasks</label><select id="tlf_status" data-tlf="status">${opt("all", "All", TL.status)}${opt("open", "Not finished", TL.status)}${opt("late", "Overdue", TL.status)}${opt("done", "Finished", TL.status)}</select></div>
      <div class="f"><label>View</label><div class="tl-seg"><button data-tlmode="gantt" aria-pressed="${TL.mode === "gantt"}">Timeline</button><button data-tlmode="list" aria-pressed="${TL.mode === "list"}">List</button></div></div>
      ${TL.mode === "gantt" ? `<div class="f"><label>Zoom</label><div class="tl-seg"><button data-tlzoom="days" aria-pressed="${TL.zoom === "days"}">Days</button><button data-tlzoom="weeks" aria-pressed="${TL.zoom === "weeks"}">Weeks</button><button data-tlzoom="months" aria-pressed="${TL.zoom === "months"}">Months</button></div></div>` : ""}
      <label class="tl-tick"><input type="checkbox" data-tlf="finished"${TL.finished ? " checked" : ""}> Show finished projects</label>
    </div>
    ${!TL.projects.length ? `<div class="card tl-empty">No projects yet.<br><br><button class="btn" data-tl="newproject" style="width:auto">Start with a template</button></div>`
      : !vs.length ? `<div class="card tl-empty">Nothing matches these filters.</div>`
      : TL.mode === "gantt" ? ganttHtml(vs) : vs.map(listHtml).join("")}`;
}

/* ---------------------------------------------------------------- Gantt */
function ganttHtml(vs){
  const narrow = window.innerWidth < 640, LEFT = narrow ? 158 : 280;
  const ppd = { days:30, weeks:9, months:3 }[TL.zoom] || 9;
  let lo = TL.today, hi = TL.today;
  for (const p of vs) { hi = p.launch_date > hi ? p.launch_date : hi; for (const t of p.vis) { if (t.start_date < lo) lo = t.start_date; if (t.due_date > hi) hi = t.due_date; } }
  lo = dMonday(dAdd(lo, -3)); hi = dAdd(hi, 12);
  const days = dDiff(lo, hi) + 1, W = days * ppd, x = d => dDiff(lo, d) * ppd;
  // header: months, then day numbers (zoomed in) or week starts
  let months = "", d = lo;
  while (d <= hi) {
    const dt = new Date(dMs(d)), nextM = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 1, 12)).toISOString().slice(0, 10);
    const end = nextM > dAdd(hi, 1) ? dAdd(hi, 1) : nextM;
    months += `<div class="tlh-m" style="left:${x(d)}px;width:${dDiff(d, end) * ppd}px">${esc(dFmt(d, { month: ppd < 6 ? "short" : "long", year:"numeric" }))}</div>`;
    d = end;
  }
  let sub = "";
  if (ppd >= 18) for (let i = 0; i < days; i++) { const dd = dAdd(lo, i), wd = new Date(dMs(dd)).getUTCDay(); sub += `<div class="tlh-d${wd === 0 || wd === 6 ? " we" : ""}${dd === TL.today ? " td" : ""}" style="left:${i * ppd}px;width:${ppd}px">${new Date(dMs(dd)).getUTCDate()}</div>`; }
  else if (ppd >= 5) for (let i = 0; i < days; i += 7) sub += `<div class="tlh-d" style="left:${i * ppd}px;width:${7 * ppd}px">${esc(dShort(dAdd(lo, i)))}</div>`;
  const head = `<div class="tlr head"><div class="tlc" style="width:${LEFT}px;height:48px"><span class="muted" style="font-size:10px;letter-spacing:.16em;text-transform:uppercase">Projects and tasks</span></div>
    <div class="tlt" style="width:${W}px;height:48px">${months}${sub}</div></div>`;
  let rows = "", shownOwners = new Set(), anyMs = false;
  for (const p of vs) {
    const shut = !!TL.collapsed[p.id], pc = pPct(p);
    const starts = p.vis.map(t => t.start_date).concat([p.launch_date]).sort(), s0 = starts[0] < lo ? lo : starts[0];
    rows += `<div class="tlr proj"><div class="tlc" style="width:${LEFT}px"><span class="chev${shut ? " shut" : ""}" data-tltoggle="${esc(p.id)}" role="button" aria-label="${shut ? "Open" : "Close"} ${esc(p.name)}"></span>
        <button class="nm" data-tltoggle="${esc(p.id)}" title="${esc(p.name)}">${esc(p.name)}</button><span class="pc ${pc >= 100 ? "done" : ""}">${pc}%</span>${p.can_manage ? `<button class="gear" data-tlproj="${esc(p.id)}" aria-label="Edit ${esc(p.name)}" title="Edit project">&#9881;</button>` : ""}</div>
      <div class="tlt" style="width:${W}px"><div class="tlb sum" style="left:${x(s0)}px;width:${Math.max(24, dDiff(s0, p.launch_date) * ppd + ppd)}px" title="${esc(p.name)}: ${esc(dShort(s0))} to ${esc(dShort(p.launch_date))}"><div class="fill" style="width:${pc}%"></div><span>${esc(p.name)} · ${esc(dShort(s0))} – ${esc(dShort(p.launch_date))}</span></div></div></div>`;
    if (shut) continue;
    for (const t of p.vis) {
      const col = colOf(t.owner_email); shownOwners.add(t.owner_email || "");
      const late = tLate(t), done = t.percent >= 100, tip = `${t.title}\n${t.owner_email ? nameOf(t.owner_email) : "Not given to anyone"} · ${t.milestone ? dShort(t.due_date) : dShort(t.start_date) + " – " + dShort(t.due_date)} · ${t.percent}%`;
      let mark;
      if (t.milestone || t.title === "Launch day" && t.due_date === p.launch_date) {
        anyMs = true;
        const isL = t.title === "Launch day" && t.due_date === p.launch_date;
        mark = `<div class="tlms${isL ? " launch" : ""}${late ? " late" : ""}${done ? " done" : ""}" data-tltask="${esc(t.id)}" style="left:${x(t.due_date) + ppd / 2 - 8}px;background:${col}" title="${esc(tip)}"></div><div class="tlwho" style="left:${x(t.due_date) + ppd / 2 + 14}px">${esc(dShort(t.due_date))}${t.owner_email ? " · " + esc(firstName(t.owner_email)) : ""}</div>`;
      } else {
        const w = Math.max(10, (dDiff(t.start_date, t.due_date) + 1) * ppd);
        mark = `<div class="tlb${late ? " late" : ""}${done ? " done" : ""}" data-tltask="${esc(t.id)}" style="left:${x(t.start_date)}px;width:${w}px;background:${col}" title="${esc(tip)}"><div class="fill" style="width:${t.percent}%"></div>${w > 92 ? `<span>${esc(dShort(t.due_date))}${w > 170 && t.owner_email ? " · " + esc(firstName(t.owner_email)) : ""}</span>` : ""}</div>${w <= 92 ? `<div class="tlwho" style="left:${x(t.start_date) + w + 6}px">${esc(dShort(t.due_date))}${t.owner_email ? " · " + esc(firstName(t.owner_email)) : ""}</div>` : ""}`;
      }
      rows += `<div class="tlr"><div class="tlc" style="width:${LEFT}px"><span class="own" style="background:${col}"></span><button class="nm" data-tltask="${esc(t.id)}" title="${esc(t.title)}">${esc(t.title)}</button><span class="pc${late ? " late" : done ? " done" : ""}">${t.percent}%</span></div>
        <div class="tlt" style="width:${W}px">${mark}</div></div>`;
    }
  }
  const tx = LEFT + x(TL.today) + Math.round(ppd / 2);
  const legend = Array.from(shownOwners).sort((a, b) => nameOf(a).localeCompare(nameOf(b))).map(e => `<span><i style="background:${colOf(e)}"></i>${esc(e ? nameOf(e) : "Not given to anyone")}</span>`).join("")
    + (anyMs ? `<span><i class="ms" style="background:${NONE_COL}"></i>Milestone</span>` : "") + `<span><i style="background:var(--brown);transform:rotate(45deg);width:11px;height:11px"></i>Launch</span><span><i style="box-shadow:0 0 0 2px var(--alert)"></i>Overdue</span>`;
  return `<div class="tlg"><div class="tlg-scroll" id="tlscroll"><div class="tlg-inner" style="width:${LEFT + W}px">${head}${rows}<div class="tltoday" style="left:${tx}px"><b>TODAY</b></div></div></div><div class="tl-legend">${legend}</div></div>`;
}
/** After a render, bring "today" into view. */
function tlScrollToday(){
  const sc = document.getElementById("tlscroll"); if (!sc) return;
  const t = sc.querySelector(".tltoday"); if (!t) return;
  const c = sc.querySelector(".tlc"), L = c ? c.offsetWidth : 0;   // the task-name column stays put, so "today" is placed within the part to its right
  sc.scrollLeft = Math.max(0, parseFloat(t.style.left) - L - (sc.clientWidth - L) * 0.3);
}

/* ---------------------------------------------------------------- countdown list */
function bucketOf(due, launch){
  const n = dDiff(due, launch);
  if (n < 0) return [90, "After launch"]; if (n === 0) return [80, "Launch day"];
  if (n <= 6) return [70, "Final week"]; if (n <= 13) return [60, "1 to 2 weeks before"]; if (n <= 27) return [50, "2 to 4 weeks before"];
  if (n <= 55) return [40, "4 to 8 weeks before"]; if (n <= 83) return [30, "8 to 12 weeks before"]; return [20, "3 months or more before"];
}
function listHtml(p){
  const pc = pPct(p), open = p.tasks.filter(t => t.percent < 100).length, lateN = p.tasks.filter(tLate).length;
  const dl = dDiff(TL.today, p.launch_date);
  const sub = dl > 0 ? `Launch ${dLong(p.launch_date)} · in ${plural(dl, "day")}` : dl === 0 ? `Launches today · ${dLong(p.launch_date)}` : `Launched ${dLong(p.launch_date)}`;
  const groups = new Map();
  for (const t of p.vis) { const [k, label] = bucketOf(t.due_date, p.launch_date); (groups.get(k) || groups.set(k, { label, items:[] }).get(k)).items.push(t); }
  const body = Array.from(groups.keys()).sort((a, b) => a - b).map(k => { const g = groups.get(k); return `<div class="tlgrp">${esc(g.label)}</div>${g.items.map(t => taskRow(t, p)).join("")}`; }).join("")
    || `<div class="tl-empty" style="padding:20px">No tasks match.</div>`;
  return `<section class="card tlp"><div class="tlp-head"><div><h3>${esc(p.name)}</h3><div class="sub">${esc(sub)}${p.owner_name ? " · owner " + esc(p.owner_name) : ""}</div></div>
      <div class="tlp-prog" title="${pc}% complete"><i style="width:${pc}%"></i></div><div class="sub"><b>${pc}%</b> · ${open} to do${lateN ? ` · <span style="color:var(--alert);font-weight:700">${lateN} overdue</span>` : ""}</div>
      <div class="tlp-tools">${p.can_manage ? `<button class="btn small" data-tladd="${esc(p.id)}">Add task</button><button class="btn ghost small" data-tlproj="${esc(p.id)}">Edit project</button>` : ""}</div></div>${body}</section>`;
}
function taskRow(t, p){
  const late = tLate(t), done = t.percent >= 100;
  const dueTxt = late ? `<span class="over">Overdue · was due ${esc(dShort(t.due_date))}</span>` : `Due ${esc(dLong(t.due_date))}`;
  return `<div class="tlt-row${late ? " late" : ""}${done ? " done" : ""}">
    ${t.can_progress ? `<button class="chk tl-chk" data-tlcheck="${esc(t.id)}" aria-pressed="${done}" aria-label="${done ? "Mark as not done" : "Mark as done"}"><i><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></i></button>` : `<span class="chk tl-chk"></span>`}
    <button class="tlt-main" data-tltask="${esc(t.id)}"><div class="tt">${t.milestone ? "&#9670; " : ""}${esc(t.title)}</div>
      <div class="mm">${dueTxt} · ${esc(beforeLabel(t.due_date, p.launch_date))}${t.role ? " · " + esc(t.role) : ""}</div>
      ${t.note ? `<div class="nt">${esc(t.note)}</div>` : ""}</button>
    <div class="tlt-pill"><span class="dot" style="background:${colOf(t.owner_email)}"></span>${esc(t.owner_email ? firstName(t.owner_email) : "Nobody yet")}<span class="bar"><i style="width:${t.percent}%"></i></span>${t.percent}%</div></div>`;
}

/* ---------------------------------------------------------------- modals */
function closeModal(){ const m = document.querySelector(".tlm"); if (m) m.remove(); document.body.classList.remove("tlm-open"); }
function openModal(html, wide){
  closeModal();
  const el = document.createElement("div"); el.className = "tlm";
  el.innerHTML = `<div class="tlm-box${wide ? " wide" : ""}" role="dialog" aria-modal="true"><button class="tlm-x" data-tlclose aria-label="Close">&times;</button>${html}</div>`;
  el.addEventListener("mousedown", e => { if (e.target === el) closeModal(); });
  document.body.appendChild(el); document.body.classList.add("tlm-open");
  const f = el.querySelector("input:not([type=checkbox]):not([type=date]),textarea"); if (f && window.innerWidth > 640) f.focus();
  return el.firstChild;
}
const val = id => { const e = document.getElementById(id); return e ? e.value : ""; };
const findTask = id => { for (const p of TL.projects) { const t = p.tasks.find(x => x.id === id); if (t) return [t, p]; } return [null, null]; };
async function tlRefresh(){ try { await tlLoad(); } catch(e){ toast(e.message, true); } renderTL(); tlAfter(); }
function tlAfter(){ if (TL.mode === "gantt") tlScrollToday(); }

/* ---- a task */
function openTask(id, projectId){
  let [t, p] = id ? findTask(id) : [null, TL.projects.find(x => x.id === projectId)];
  if (!p) return;
  const isNew = !t, manage = p.can_manage, prog = !isNew && t.can_progress;
  t = t || { title:"", details:"", owner_email:"", start_date:p.launch_date, due_date:p.launch_date, milestone:false, percent:0, role:"", note:"" };
  const ro = !manage;
  const box = openModal(`<h3>${isNew ? "Add a task" : ro ? esc(t.title) : "Task"}</h3>
    <div class="note" style="margin-bottom:12px">${esc(p.name)} · launch ${esc(dLong(p.launch_date))}${isNew ? "" : " · " + esc(beforeLabel(t.due_date, p.launch_date))}</div>
    ${manage ? `<div class="field"><label for="tm_title">Task</label><input id="tm_title" maxlength="160" value="${esc(t.title)}" autocomplete="off"></div>
      <div class="field"><label for="tm_details">Details</label><textarea id="tm_details" maxlength="1000" placeholder="What done looks like, who to speak to…">${esc(t.details)}</textarea></div>
      <div class="field"><label for="tm_owner">Given to</label><select id="tm_owner">${peopleOpts(t.owner_email, "Nobody yet")}</select></div>
      <div class="row2"><div class="field"><label for="tm_start">Starts</label><input type="date" id="tm_start" value="${esc(t.start_date)}"></div>
        <div class="field"><label for="tm_due">Due</label><input type="date" id="tm_due" value="${esc(t.due_date)}"></div></div>
      <label class="tl-tick" style="margin-bottom:10px"><input type="checkbox" id="tm_ms"${t.milestone ? " checked" : ""}> A milestone (a single date, shown as a diamond)</label>`
    : `${t.details ? `<p class="desc" style="margin:0 0 12px">${esc(t.details)}</p>` : ""}
      <div class="facts" style="margin:0 0 14px"><div><div class="k">Given to</div><div class="v">${esc(t.owner_email ? nameOf(t.owner_email) : "Nobody yet")}</div></div>
        <div><div class="k">${t.milestone ? "Date" : "Due"}</div><div class="v${tLate(t) ? " late" : ""}">${esc(dLong(t.due_date))}</div></div></div>`}
    ${isNew ? "" : `<div class="field"><label>Percent complete</label><div class="pcts" id="tm_pcts">${[0, 25, 50, 75, 100].map(v => `<button type="button" data-tlpct="${v}" aria-pressed="${v === t.percent}"${manage || prog ? "" : " disabled"}>${v}%</button>`).join("")}</div></div>`}
    ${prog ? `<div class="field"><label for="tm_note">Update / note</label><textarea id="tm_note" maxlength="1000" placeholder="Progress, what is holding it up…">${esc(t.note || "")}</textarea>${t.note_at ? `<div class="note" style="margin:4px 0 0">${esc(t.note_by || "")} · ${esc(fmtDT(t.note_at))}</div>` : ""}</div>` : (!isNew && t.note ? `<div class="field"><label>Latest note</label><div class="desc" style="margin:0">${esc(t.note)}</div></div>` : "")}
    <div class="tlm-foot">${manage || prog ? `<button class="btn" data-tlsavetask="${esc(t.id || "")}" data-proj="${esc(p.id)}">${isNew ? "Add task" : "Save"}</button>` : ""}<button class="btn ghost" data-tlclose>${manage || prog ? "Cancel" : "Close"}</button>
      ${!isNew && manage ? `<span class="spacer"></span><button class="btn danger small" data-tlrmtask="${esc(t.id)}">Remove</button>` : ""}</div>`);
  box._pct = t.percent;
}
async function saveTask(btn){
  const id = btn.dataset.tlsavetask, [t, p] = id ? findTask(id) : [null, TL.projects.find(x => x.id === btn.dataset.proj)];
  const box = btn.closest(".tlm-box"), pct = box._pct;
  btn.disabled = true;
  try {
    if (p.can_manage) {
      const title = val("tm_title").trim(); if (!title) throw new Error("Give the task a name.");
      if (!val("tm_due")) throw new Error("Choose the date it is due.");
      await call("tl.task.save", { id: id || undefined, project_id: p.id, title, details: val("tm_details"), owner_email: val("tm_owner"), start_date: val("tm_start") || val("tm_due"), due_date: val("tm_due"),
        milestone: document.getElementById("tm_ms").checked, percent: id ? pct : 0, role: t ? t.role : "" });
      if (id && document.getElementById("tm_note") && val("tm_note") !== (t.note || "")) await call("tl.task.progress", { id, note: val("tm_note") });
    } else {
      await call("tl.task.progress", { id, percent: pct, note: document.getElementById("tm_note") ? val("tm_note") : undefined });
    }
    closeModal(); toast("Saved."); await tlRefresh();
  } catch(e){ toast(e.message, true); btn.disabled = false; }
}
async function setPercent(id, percent, msg){
  try { await call("tl.task.progress", { id, percent }); toast(msg || "Saved."); await tlRefresh(); } catch(e){ toast(e.message, true); }
}

/* ---- a project */
function openProject(id){
  const p = TL.projects.find(x => x.id === id); if (!p || !p.can_manage) return;
  openModal(`<h3>Edit project</h3>
    <div class="field"><label for="pm_name">Name</label><input id="pm_name" maxlength="120" value="${esc(p.name)}"></div>
    <div class="row2"><div class="field"><label for="pm_launch">Launch date</label><input type="date" id="pm_launch" value="${esc(p.launch_date)}"></div>
      <div class="field"><label for="pm_owner">Owner</label><select id="pm_owner">${peopleOpts(p.owner_email, "Nobody")}</select></div></div>
    <label class="tl-tick" style="margin-bottom:10px"><input type="checkbox" id="pm_shift" checked> If the launch date moves, move every task by the same number of days</label>
    <div class="field"><label for="pm_notes">Notes</label><textarea id="pm_notes" maxlength="2000">${esc(p.notes || "")}</textarea></div>
    <div class="tlm-foot"><button class="btn" data-tlsaveproj="${esc(p.id)}">Save</button><button class="btn ghost" data-tlclose>Cancel</button><span class="spacer"></span><button class="btn danger small" data-tlrmproj="${esc(p.id)}">Delete project</button></div>`);
}
async function saveProject(btn){
  btn.disabled = true;
  try {
    const r = await call("tl.project.update", { id: btn.dataset.tlsaveproj, name: val("pm_name"), launch_date: val("pm_launch"), owner_email: val("pm_owner"), notes: val("pm_notes"), shift: document.getElementById("pm_shift").checked });
    closeModal(); toast(r.shifted ? `Saved. ${plural(r.shifted, "task")} moved with the launch date.` : "Saved."); await tlRefresh();
  } catch(e){ toast(e.message, true); btn.disabled = false; }
}

/* ---- a new project from a template */
function npRoles(){
  const tpl = TL.templates.find(t => t.key === TL.np.tpl);
  return tpl ? Array.from(new Set((tpl.tasks || []).map(t => t.r).filter(Boolean))) : [];
}
function openNewProject(){
  TL.np = { tpl: TL.templates[0] ? TL.templates[0].key : "", name:"", touched:false, launch:"", owner:S.me.email, roles:{ ...TL.roles }, skip:new Set() };
  const box = openModal(`<h3>New project</h3><div id="np_body"></div>`, true);
  npPaint();
}
function npPaint(){
  const np = TL.np, tpl = TL.templates.find(t => t.key === np.tpl);
  if (tpl && !np.touched) np.name = tpl.name;
  const el = document.getElementById("np_body"); if (!el) return;
  el.innerHTML = `<div class="field"><label>Start from</label><div class="tpl-cards">
      ${TL.templates.map(t => `<button type="button" class="tpl-card" data-tlpick="${esc(t.key)}" aria-pressed="${t.key === np.tpl}"><b>${esc(t.name)}</b><small>${(t.tasks || []).length} tasks</small></button>`).join("")}
      <button type="button" class="tpl-card" data-tlpick="" aria-pressed="${!np.tpl}"><b>Blank project</b><small>Add your own tasks</small></button></div>
      ${tpl && tpl.description ? `<div class="note" style="margin:-6px 0 0">${esc(tpl.description)}</div>` : ""}</div>
    <div class="row2"><div class="field"><label for="np_name">Project name</label><input id="np_name" maxlength="120" value="${esc(np.name)}" placeholder="e.g. Winter menu 2027"></div>
      <div class="field"><label for="np_launch">Launch date</label><input type="date" id="np_launch" value="${esc(np.launch)}"></div></div>
    <div class="field"><label for="np_owner">Project owner</label><select id="np_owner">${peopleOpts(np.owner, "Me")}</select></div>
    ${npRoles().length ? `<div class="field"><label>Who does what</label><div class="row2" id="np_roles">${npRoles().map(r => `<div class="field" style="margin-bottom:8px"><label style="text-transform:none;letter-spacing:0;font-size:12px" for="npr_${esc(r)}">${esc(r)}</label><select id="npr_${esc(r)}" data-tlrole="${esc(r)}">${peopleOpts(np.roles[r] || "", "Choose later")}</select></div>`).join("")}</div>
      <div class="note" style="margin:0">Remembered for next time. Anything left on "Choose later" can be given to someone afterwards.</div></div>` : ""}
    <div id="np_preview"></div>
    <div class="tlm-foot"><button class="btn" data-tlcreate>Create project</button><button class="btn ghost" data-tlclose>Cancel</button></div>`;
  npPreview();
}
function npPreview(){
  const np = TL.np, el = document.getElementById("np_preview"); if (!el) return;
  const tpl = TL.templates.find(t => t.key === np.tpl);
  if (!tpl) { el.innerHTML = `<div class="note">A blank project starts with just the launch day. You add the tasks yourself.</div>`; return; }
  if (!np.launch) { el.innerHTML = `<div class="warnbox">Choose the launch date and the dates for all ${(tpl.tasks || []).length} tasks are worked out for you, counting back from it.</div>`; return; }
  const rows = (tpl.tasks || []).map((t, i) => ({ t, i, due: dAdd(np.launch, -Number(t.d || 0)) })).sort((a, b) => a.due.localeCompare(b.due) || a.i - b.i);
  const past = rows.filter(r => !np.skip.has(r.i) && r.due < TL.today).length;
  el.innerHTML = `${past ? `<div class="warnbox">${plural(past, "task")} would already be overdue with this launch date (shown in red). Untick any you do not need, or choose a later launch date.</div>` : ""}
    <div class="pv">${rows.map(({ t, i, due }) => `<label class="pv-r${np.skip.has(i) ? " off" : ""}"><input type="checkbox" data-tlskip="${i}"${np.skip.has(i) ? "" : " checked"}>
      <span>${t.m ? "&#9670; " : ""}${esc(t.t)}<small>${esc(t.r || "")}${t.r ? " · " : ""}${esc(beforeLabel(due, np.launch))}</small></span><span class="d${due < TL.today ? " past" : ""}">${esc(dShort(due))}${t.m ? "" : (t.n > 1 ? " <small>(" + t.n + " days)</small>" : "")}</span></label>`).join("")}
      <div class="pv-r"><span></span><span>&#9670; Launch day</span><span class="d">${esc(dShort(np.launch))}</span></div></div>`;
}
async function createProject(btn){
  const np = TL.np;
  if (!val("np_name").trim()) return toast("Give the project a name.", true);
  if (!np.launch) return toast("Choose the launch date.", true);
  btn.disabled = true;
  try {
    const roles = {}; for (const r of npRoles()) roles[r] = val("npr_" + r);
    const r = await call("tl.project.create", { name: val("np_name"), template_key: np.tpl || null, launch_date: np.launch, owner_email: val("np_owner"), roles, skip: Array.from(np.skip) });
    closeModal(); toast(`Project created with ${plural(r.tasks, "task")}.`);
    TL.project = r.project_id; TL.person = "all"; TL.status = "all"; tlSave();
    await tlRefresh();
  } catch(e){ toast(e.message, true); btn.disabled = false; }
}

/* ---- templates (GM) */
function openTemplates(){
  openModal(`<h3>Templates</h3><p class="note">The usual list of tasks for each kind of project. Everything is counted back from the launch date. Changing a template never changes projects already made.</p>
    ${TL.templates.map(t => `<div class="trow"><div class="tn"><b>${esc(t.name)}</b><div>${(t.tasks || []).length} tasks${t.description ? " · " + esc(t.description) : ""}</div></div>
      <button class="btn ghost small" data-tltedit="${esc(t.key)}">Edit</button><button class="btn ghost small" data-tltdup="${esc(t.key)}">Copy</button></div>`).join("") || `<div class="muted">No templates yet.</div>`}
    <div class="tlm-foot"><button class="btn" data-tltedit="">New template</button><button class="btn ghost" data-tlclose>Close</button></div>`, true);
}
function unitOf(d){ const k = Math.abs(d); if (k && k % 7 === 0) return ["weeks", k / 7]; if (k >= 30 && k % 30 === 0) return ["months", k / 30]; return ["days", k]; }
function tplRow(t){
  const [u, n] = unitOf(Number(t.d || 0)), after = Number(t.d || 0) < 0;
  return `<div class="tpr"><input type="text" class="x_t" maxlength="160" value="${esc(t.t)}" placeholder="Task" aria-label="Task">
    <input type="text" class="x_r" maxlength="40" list="tpl_roles" value="${esc(t.r || "")}" placeholder="Who (role)" aria-label="Who">
    <div class="when"><input type="number" class="x_n" min="0" max="3650" value="${n}" aria-label="How long before launch"><select class="x_u" aria-label="Unit">${opt("days", "days", u)}${opt("weeks", "weeks", u)}${opt("months", "months", u)}</select><select class="x_a" aria-label="Before or after">${opt("before", "before", after ? "after" : "before")}${opt("after", "after", after ? "after" : "before")}</select></div>
    <input type="number" class="x_len" min="1" max="365" value="${Number(t.n || 1)}" aria-label="Days it takes" title="Days it takes">
    <input type="checkbox" class="x_m" ${t.m ? "checked" : ""} aria-label="Milestone" title="Milestone">
    <div class="mini"><button type="button" data-tlrowup title="Move up">&uarr;</button><button type="button" data-tlrowdn title="Move down">&darr;</button><button type="button" data-tlrowrm title="Remove">&times;</button></div></div>`;
}
function openTemplateEdit(key, copy){
  const src = TL.templates.find(t => t.key === key) || { name:"", description:"", tasks:[] };
  const roles = Array.from(new Set(TL.templates.flatMap(t => (t.tasks || []).map(x => x.r)).filter(Boolean))).sort();
  const box = openModal(`<h3>${key && !copy ? "Edit template" : "New template"}</h3>
    <div class="field"><label for="te_name">Name</label><input id="te_name" maxlength="100" value="${esc(copy ? src.name + " (copy)" : src.name)}"></div>
    <div class="field"><label for="te_desc">What it is for</label><input id="te_desc" maxlength="400" value="${esc(src.description)}"></div>
    <div class="note">Each task: who usually does it, how long before the launch it is due (or after, for reviews), how many days it takes, and whether it is a milestone. The launch day is added automatically.</div>
    <datalist id="tpl_roles">${roles.map(r => `<option value="${esc(r)}">`).join("")}</datalist>
    <div class="tpr-scroll"><div class="tpr-wrap"><div class="tpr hd"><span>Task</span><span>Who</span><span>Due</span><span>Days</span><span>&#9670;</span><span></span></div><div id="te_rows">${(src.tasks || []).map(tplRow).join("")}</div></div></div>
    <div class="tlm-foot"><button class="btn ghost small" data-tladdrow>Add a task</button></div>
    <div class="tlm-foot"><button class="btn" data-tlsavetpl="${copy ? "" : esc(key || "")}">Save template</button><button class="btn ghost" data-tlclose>Cancel</button>
      ${key && !copy ? `<span class="spacer"></span><button class="btn danger small" data-tlrmtpl="${esc(key)}">Delete template</button>` : ""}</div>`, true);
}
function readTplRows(){
  return Array.from(document.querySelectorAll("#te_rows .tpr")).map(r => {
    const n = Number(r.querySelector(".x_n").value || 0), mult = { days:1, weeks:7, months:30 }[r.querySelector(".x_u").value] || 1, sign = r.querySelector(".x_a").value === "after" ? -1 : 1;
    return { t: r.querySelector(".x_t").value.trim(), r: r.querySelector(".x_r").value.trim(), d: sign * n * mult, n: Math.max(1, Number(r.querySelector(".x_len").value || 1)), m: r.querySelector(".x_m").checked, x: "" };
  }).filter(t => t.t);
}
async function saveTemplate(btn){
  const key = btn.dataset.tlsavetpl, old = TL.templates.find(t => t.key === key), rows = readTplRows();
  // keep the details text of tasks that were already there (matched by title)
  if (old) for (const r of rows) { const o = (old.tasks || []).find(x => x.t === r.t); if (o) r.x = o.x || ""; }
  if (!val("te_name").trim()) return toast("Give the template a name.", true);
  btn.disabled = true;
  try { await call("tl.template.save", { key: key || undefined, name: val("te_name"), description: val("te_desc"), tasks: rows }); toast("Template saved."); await tlRefresh(); openTemplates(); }
  catch(e){ toast(e.message, true); btn.disabled = false; }
}

/* ---------------------------------------------------------------- events */
document.addEventListener("keydown", e => { if (e.key === "Escape" && document.querySelector(".tlm")) closeModal(); });
document.addEventListener("change", e => {
  const t = e.target, d = t.dataset || {};
  if (d.tlf) {
    if (d.tlf === "finished") TL.finished = t.checked; else TL[d.tlf] = t.value;
    tlSave(); return renderTL(), tlAfter();
  }
  if (d.tlrole !== undefined && TL.np) { TL.np.roles[d.tlrole] = t.value; return; }
  if (d.tlskip !== undefined && TL.np) { const i = Number(d.tlskip); if (t.checked) TL.np.skip.delete(i); else TL.np.skip.add(i); return npPreview(); }
  if (t.id === "np_launch" && TL.np) { TL.np.launch = t.value; return npPreview(); }
  if (t.id === "np_owner" && TL.np) { TL.np.owner = t.value; }
});
document.addEventListener("input", e => {
  if (e.target.id === "np_name" && TL.np) { TL.np.name = e.target.value; TL.np.touched = true; }
});
document.addEventListener("click", async e => {
  const t = e.target.closest("[data-tl],[data-tlmode],[data-tlzoom],[data-tltoggle],[data-tltask],[data-tlproj],[data-tladd],[data-tlcheck],[data-tlclose],[data-tlpct],[data-tlsavetask],[data-tlrmtask],[data-tlsaveproj],[data-tlrmproj],[data-tlpick],[data-tlcreate],[data-tltedit],[data-tltdup],[data-tladdrow],[data-tlrowup],[data-tlrowdn],[data-tlrowrm],[data-tlsavetpl],[data-tlrmtpl]");
  if (!t) return;
  const d = t.dataset;
  if (d.tlclose !== undefined) return closeModal();
  if (d.tlmode) { TL.mode = d.tlmode; tlSave(); return renderTL(), tlAfter(); }
  if (d.tlzoom) { TL.zoom = d.tlzoom; tlSave(); return renderTL(), tlAfter(); }
  if (d.tl === "newproject") return openNewProject();
  if (d.tl === "templates") return openTemplates();
  if (d.tltoggle) { TL.collapsed[d.tltoggle] = !TL.collapsed[d.tltoggle]; const sc = document.getElementById("tlscroll"), x = sc ? sc.scrollLeft : 0; renderTL(); const s2 = document.getElementById("tlscroll"); if (s2) s2.scrollLeft = x; return; }
  if (d.tltask) return openTask(d.tltask);
  if (d.tlproj) return openProject(d.tlproj);
  if (d.tladd) return openTask(null, d.tladd);
  if (d.tlcheck) { const [tk] = findTask(d.tlcheck); if (!tk) return; return setPercent(tk.id, tk.percent >= 100 ? 0 : 100, tk.percent >= 100 ? "Back on the list." : "Done."); }
  if (d.tlpct !== undefined) { const box = t.closest(".tlm-box"); box._pct = Number(d.tlpct); box.querySelectorAll("[data-tlpct]").forEach(b => b.setAttribute("aria-pressed", String(b === t))); return; }
  if (d.tlsavetask !== undefined) return saveTask(t);
  if (d.tlrmtask) {
    if (TL.sure !== d.tlrmtask) { TL.sure = d.tlrmtask; t.textContent = "Tap again to remove"; t.classList.add("sure"); clearTimeout(TL._st); TL._st = setTimeout(() => { TL.sure = null; if (t.isConnected) { t.textContent = "Remove"; t.classList.remove("sure"); } }, 4000); return; }
    TL.sure = null;
    try { await call("tl.task.remove", { id: d.tlrmtask }); closeModal(); toast("Task removed."); await tlRefresh(); } catch(err){ toast(err.message, true); }
    return;
  }
  if (d.tlsaveproj) return saveProject(t);
  if (d.tlrmproj) {
    if (TL.sure !== d.tlrmproj) { TL.sure = d.tlrmproj; t.textContent = "Tap again to delete the project and its tasks"; t.classList.add("sure"); clearTimeout(TL._st); TL._st = setTimeout(() => { TL.sure = null; if (t.isConnected) { t.textContent = "Delete project"; t.classList.remove("sure"); } }, 5000); return; }
    TL.sure = null;
    try { await call("tl.project.remove", { id: d.tlrmproj }); closeModal(); if (TL.project === d.tlrmproj) TL.project = "all"; toast("Project deleted."); await tlRefresh(); } catch(err){ toast(err.message, true); }
    return;
  }
  if (d.tlpick !== undefined) { TL.np.tpl = d.tlpick; TL.np.skip = new Set(); if (!TL.np.touched) TL.np.name = ""; TL.np.launch = val("np_launch") || TL.np.launch; return npPaint(); }
  if (d.tlcreate !== undefined) return createProject(t);
  if (d.tltedit !== undefined) return openTemplateEdit(d.tltedit);
  if (d.tltdup) return openTemplateEdit(d.tltdup, true);
  if (d.tladdrow !== undefined) { document.getElementById("te_rows").insertAdjacentHTML("beforeend", tplRow({ t:"", r:"", d:7, n:1, m:false })); const rows = document.querySelectorAll("#te_rows .x_t"); rows[rows.length - 1].focus(); return; }
  if (d.tlrowrm !== undefined) return t.closest(".tpr").remove();
  if (d.tlrowup !== undefined) { const r = t.closest(".tpr"), p = r.previousElementSibling; if (p) r.parentNode.insertBefore(r, p); return; }
  if (d.tlrowdn !== undefined) { const r = t.closest(".tpr"), n = r.nextElementSibling; if (n) r.parentNode.insertBefore(n, r); return; }
  if (d.tlsavetpl !== undefined) return saveTemplate(t);
  if (d.tlrmtpl) {
    if (TL.sure !== d.tlrmtpl) { TL.sure = d.tlrmtpl; t.textContent = "Tap again to delete"; t.classList.add("sure"); clearTimeout(TL._st); TL._st = setTimeout(() => { TL.sure = null; if (t.isConnected) { t.textContent = "Delete template"; t.classList.remove("sure"); } }, 4000); return; }
    TL.sure = null;
    try { await call("tl.template.remove", { key: d.tlrmtpl }); toast("Template deleted."); await tlRefresh(); openTemplates(); } catch(err){ toast(err.message, true); }
  }
});
