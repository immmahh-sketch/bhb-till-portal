// Supabase Edge Function: training-api
//
// Backs the Team Training tile (bhb-till-portal/team-training/): short training sessions on the phone, and the record of who
// has done what. The session content itself is static JSON in the portal repo; this function only keeps people, records and
// external certificates.
//
// Access is the Staff Portal's: the person must hold the team-training tile. Everyone with the tile can read and record their
// OWN training. Seeing everyone's record, setting departments and logging certificates needs the "Training record" tab ticked
// for that person (Settings > Users), or an admin. A person with no tab rows sees "My training" only.
//
// Deploy with "Verify JWT" OFF. Future edits: download the live copy first
//   npx supabase functions download training-api --project-ref safcrtrfdzsnftghibot

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_KEY = "team-training";
const BREVO_KEY = Deno.env.get("BREVO_API_KEY") ?? "";
const SENDER = { name: "Black Horse Beamish", email: "stay@blackhorsebeamish.co.uk" };
const SITE = "https://app.blackhorsebeamish.co.uk/team-training/";
const PORTAL_URL = "https://app.blackhorsebeamish.co.uk/portal/app.html";
// Who does which module follows the portal PROFILES (Settings > Users). A person has the one profile they were set up with, plus "admin" when they are a portal administrator.
// A module's audience is a list of profile keys ("all" = everyone). The 10-minute trainers' own "For:" departments are turned into profiles with this map (keep it in step with
// team-training/index.html); a module's saved audience, if any, replaces it.
const DEPT_PROFILES: Record<string, string[]> = {
  foh: ["foh-team", "fb-supervisor"], bar: ["foh-team", "fb-supervisor"], kitchen: ["chef", "kitchen-porter"], housekeeping: ["housekeeping-team"],
  maintenance: ["maintenance-team"], events: ["wedding-coordinator"], office: ["accounts"], management: ["head-of-department", "admin"],
};
const audienceOf = (aud: string[]) => aud.includes("all") ? ["all"] : [...new Set(aud.flatMap((d) => DEPT_PROFILES[d] || []))];
const profilesOfUser = (u: any): string[] => [u?.profile_key, u?.role === "admin" ? "admin" : null].filter(Boolean) as string[];
async function profileList(): Promise<{ key: string; label: string }[]> {
  const rows = (await rest(`portal_profiles?select=key,label,sort_order&active=is.true&order=sort_order.asc,label.asc`)) || [];
  return [...rows.map((r: any) => ({ key: r.key, label: r.label })), { key: "admin", label: "Administrator (GM)" }];
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });
async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error(`REST ${path} -> ${r.status} ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
const q = (s: unknown) => encodeURIComponent(String(s ?? ""));
const clean = (v: unknown, max: number) => String(v ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);
const day = (v: unknown) => { const s = String(v ?? "").slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null; };

// ---- who owes what, and when. The same rules are in team-training/index.html (statusOf); keep them in step.
type Sess = { key: string; title: string; audience: string[]; refreshMonths: number };
let indexCache: { at: number; sessions: Sess[] } | null = null;
async function loadIndex(): Promise<Sess[]> {
  if (indexCache && Date.now() - indexCache.at < 10 * 60e3) return indexCache.sessions;
  const r = await fetch(SITE + "sessions/index.json?t=" + Date.now());
  if (!r.ok) throw new Error("Could not read the session list.");
  const d = await r.json();
  indexCache = { at: Date.now(), sessions: d.sessions };
  return d.sessions;
}
const requiredOf = (s: Sess, profiles: string[], set?: any) => { const aud: string[] = Array.isArray(set?.roles) ? set.roles : audienceOf(s.audience); return aud.includes("all") || aud.some((a) => profiles.includes(a)); };
const addMonths = (iso: string, n: number) => { const d = new Date(iso); d.setMonth(d.getMonth() + n); return d.getTime(); };
// passes: that person's records for the session, newest first. A pass only counts if made on or after the date it was issued.
function statusFor(set: any, joined: string, passes: any[]) {
  const issued = set?.issued_at, now = Date.now();
  const lp = passes.find((r) => r.passed && !r.voided_at && (r.manual || (issued && r.completed_at >= issued)));
  if (!issued || new Date(issued).getTime() > now) return lp ? { st: now > addMonths(lp.completed_at, set?.refresh_months ?? 12) ? "overdue" : "ok", due: addMonths(lp.completed_at, set?.refresh_months ?? 12) } : { st: "notissued", due: null as number | null }; // not issued yet, or scheduled for a later date
  if (!lp) { const due = Math.max(new Date(issued).getTime(), new Date(joined).getTime()) + (set.grace_days ?? 7) * 864e5; return { st: now > due ? "overdue" : "todo", due }; }
  const renew = addMonths(lp.completed_at, set.refresh_months ?? 12);
  return { st: now > renew ? "overdue" : renew - now <= 14 * 864e5 ? "soon" : "ok", due: renew };
}
const ukDay = (t: number | null) => t ? new Date(t).toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "long", year: "numeric" }) : "";

async function overdueList() {
  const [sessions, users, people, settings, recs] = await Promise.all([
    loadIndex(),
    rest(`portal_users?select=email,display_name,created_at,role,profile_key&active=is.true`),
    profileList(),
    rest(`training_settings?select=*`),
    rest(`training_records?select=email,session_key,passed,completed_at,manual,voided_at&voided_at=is.null&order=completed_at.desc&limit=20000`),
  ]);
  const labelOf = new Map<string, string>((people || []).map((p: any) => [p.key, p.label]));
  const set = new Map<string, any>((settings || []).map((x: any) => [x.session_key, x]));
  const bySP = new Map<string, any[]>();
  for (const r of recs || []) { const k = r.email + "|" + r.session_key; const a = bySP.get(k) || []; a.push(r); bySP.set(k, a); }
  const out: { email: string; name: string; admin: boolean; departments: string[]; items: { key: string; title: string; due: number | null }[] }[] = [];
  for (const u of users || []) {
    const pk = profilesOfUser(u), d = pk.map((k) => labelOf.get(k) || k), items = [];
    for (const s of sessions) {
      if (!requiredOf(s, pk, set.get(s.key))) continue;
      const st = statusFor(set.get(s.key), u.created_at, bySP.get(u.email + "|" + s.key) || []);
      if (st.st === "overdue") items.push({ key: s.key, title: s.title, due: st.due });
    }
    if (items.length) out.push({ email: u.email, name: u.display_name, admin: u.role === "admin", departments: d, items });
  }
  return out;
}

async function brevo(to: string, subject: string, html: string, tag: string) {
  if (!BREVO_KEY) throw new Error("Email is not set up (BREVO_API_KEY).");
  const r = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", headers: { "api-key": BREVO_KEY, "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ sender: SENDER, to: [{ email: to }], subject, htmlContent: html, tags: [tag] }) });
  if (!r.ok) throw new Error(`Brevo ${r.status}: ${await r.text()}`);
}
const escH = (v: unknown) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
function reminderHtml(name: string, items: { title: string; due: number | null }[]) {
  const first = escH(String(name).split(" ")[0] || "there");
  return `<div style="font-family:Raleway,Arial,sans-serif;color:#262626;max-width:520px">
    <p>Hi ${first},</p><p>Your Black Horse Beamish team training is overdue. Each session takes 10 to 15 minutes on your phone:</p>
    <ul>${items.map((i) => `<li><b>${escH(i.title)}</b>${i.due ? ` (was due ${escH(ukDay(i.due))})` : ""}</li>`).join("")}</ul>
    <p><a href="${PORTAL_URL}" style="display:inline-block;padding:12px 20px;background:#4E5F4F;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Open the Staff Portal</a></p>
    <p style="color:#7B887C;font-size:13px">Then open Team Training. The pass mark is 8 out of 10. If you have any trouble, speak to your manager.</p></div>`;
}
/** Emails everyone overdue (once a week each) and a digest to the admins. dry = just say who would be emailed. */
async function sendReminders(dry: boolean) {
  const list = await overdueList();
  const since = new Date(Date.now() - 6 * 864e5).toISOString();
  const recent = new Set(((await rest(`training_reminders?select=email&sent_at=gte.${q(since)}`)) || []).map((r: any) => r.email));
  const todo = list.filter((p) => !recent.has(p.email));
  if (dry) return { overdue: list.length, would_email: todo.map((p) => ({ name: p.name, email: p.email, sessions: p.items.length })) };
  let sent = 0; const failed: string[] = [];
  for (const p of todo) {
    try {
      await brevo(p.email, "Your team training is overdue", reminderHtml(p.name, p.items), "training-overdue");
      await rest(`training_reminders`, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ email: p.email, session_keys: p.items.map((i) => i.key) }) });
      sent++;
    } catch (e) { failed.push(`${p.email}: ${e instanceof Error ? e.message : e}`); }
  }
  if (list.length) {
    const admins = (await rest(`portal_users?select=email&role=eq.admin&active=is.true`)) || [];
    const rows = list.map((p) => `<tr><td style="padding:4px 10px 4px 0"><b>${escH(p.name)}</b></td><td style="padding:4px 10px">${escH(p.departments.join(", ") || "no department set")}</td><td style="padding:4px 0">${p.items.map((i) => escH(i.title)).join("; ")}</td></tr>`).join("");
    for (const a of admins) { try { await brevo(a.email, `Training overdue: ${list.length} ${list.length === 1 ? "person" : "people"}`, `<div style="font-family:Arial,sans-serif"><p>${list.length} ${list.length === 1 ? "person has" : "people have"} overdue training. ${sent} reminder${sent === 1 ? "" : "s"} sent today.</p><table style="font-size:13px;border-collapse:collapse">${rows}</table><p><a href="${PORTAL_URL}">Open the Staff Portal</a> and use Training record > Overdue report for the printable list by department.</p></div>`, "training-digest"); } catch { /* the digest is a nicety */ } }
  }
  return { overdue: list.length, sent, failed };
}

type Who = { id: string; email: string; name: string; admin: boolean; manager: boolean };

async function checkAccess(email: unknown): Promise<Who | null> {
  const e = String(email ?? "").trim().toLowerCase();
  if (!e) return null;
  const user = (await rest(`portal_users?select=id,display_name,role,active&email=eq.${q(e)}`))?.[0];
  if (!user || user.active === false) return null;
  const grant = (await rest(`portal_user_access?select=can_edit&user_id=eq.${user.id}&app_key=eq.${APP_KEY}`))?.[0];
  if (!grant) return null;
  const admin = user.role === "admin";
  const tabs = await rest(`portal_user_tabs?select=tab_key&user_id=eq.${user.id}&app_key=eq.${APP_KEY}`);
  const manager = admin || (tabs || []).some((t: any) => t.tab_key === "record");
  return { id: user.id, email: e, name: user.display_name || e, admin, manager };
}

const REC_COLS = "id,email,name,session_key,session_version,score,total,passed,seconds,completed_at,manual,note,recorded_by";
const CERT_COLS = "id,email,cert_key,cert_label,obtained_on,expires_on,note,recorded_by,created_at";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let body: Record<string, any> = {};
  try { body = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  const action = String(body.action ?? "");

  try {
    // Called by pg_cron, no login: it only ever does what the schedule says, and nothing while the switch is off.
    if (action === "cron.reminders") {
      const cfg = (await rest(`training_config?select=reminders_on&id=eq.1`))?.[0];
      if (cfg && cfg.reminders_on === false) return json({ skipped: "reminders are off" });
      return json(await sendReminders(false));
    }
    const who = await checkAccess(body.staff_email);
    if (!who) return json({ error: "Not signed in to the Staff Portal, or no access to Team Training." }, 403);
    const needManager = () => { if (!who.manager) throw new Error("The training record is for managers."); };

    switch (action) {
      // Who I am, my departments, and everything I have finished (every attempt, newest first).
      case "bootstrap": {
        const [mine, person, certs, settings, joinedRow, plist] = await Promise.all([
          rest(`training_records?select=${REC_COLS}&email=eq.${q(who.email)}&voided_at=is.null&order=completed_at.desc&limit=500`),
          rest(`portal_users?select=profile_key,role&email=eq.${q(who.email)}`),
          rest(`training_certs?select=${CERT_COLS}&email=eq.${q(who.email)}&deleted_at=is.null&order=created_at.desc`),
          rest(`training_settings?select=session_key,refresh_months,grace_days,issued_at,roles`),
          rest(`portal_users?select=created_at&email=eq.${q(who.email)}`),
          profileList(),
        ]);
        const cfg = who.manager ? (await rest(`training_config?select=reminders_on&id=eq.1`))?.[0] : null;
        return json({ me: { email: who.email, name: who.name, admin: who.admin, manager: who.manager, joined: joinedRow?.[0]?.created_at || null }, profiles: plist, my_profiles: profilesOfUser(person?.[0]), records: mine || [], certs: certs || [], settings: settings || [], config: cfg || null });
      }

      // A session was finished. The pass mark comes from the page (it holds the session file); it is kept within 50% to 100%.
      case "complete": {
        const key = clean(body.session_key, 60);
        if (!/^[a-z0-9][a-z0-9-]{1,58}$/.test(key)) throw new Error("Unknown session.");
        const total = Math.max(1, Math.min(60, Math.round(+body.total || 0)));
        const score = Math.max(0, Math.min(total, Math.round(+body.score || 0)));
        const pass = Math.max(0.5, Math.min(1, +body.pass_mark || 0.8));
        const passed = score / total >= pass - 1e-9;
        const seconds = Number.isFinite(+body.seconds) ? Math.max(0, Math.min(7200, Math.round(+body.seconds))) : null;
        const row = (await rest(`training_records`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({
          email: who.email, name: who.name, session_key: key, session_version: Math.max(1, Math.round(+body.session_version || 1)), score, total, passed, seconds,
        }) }))?.[0];
        return json({ record: row });
      }

      // Everyone: departments, finished sessions (latest pass per session, and the latest attempt), certificates.
      case "team": {
        needManager();
        const [users, plist, recs, certs] = await Promise.all([
          rest(`portal_users?select=email,display_name,active,role,created_at,profile_key&active=is.true&order=display_name.asc`),
          profileList(),
          rest(`training_records?select=${REC_COLS}&voided_at=is.null&order=completed_at.desc&limit=5000`),
          rest(`training_certs?select=${CERT_COLS}&deleted_at=is.null&order=expires_on.asc.nullslast`),
        ]);
        const byPerson = new Map<string, Record<string, any>>();
        for (const r of recs || []) {
          const m = byPerson.get(r.email) || {}; byPerson.set(r.email, m);
          const cur = m[r.session_key] || (m[r.session_key] = { attempts: 0, last: null, lastPass: null });
          cur.attempts++;
          if (!cur.last) cur.last = r;                       // records come newest first
          if (r.passed && !cur.lastPass) cur.lastPass = r;
        }
        const certBy = new Map<string, any[]>();
        for (const c of certs || []) { const a = certBy.get(c.email) || []; a.push(c); certBy.set(c.email, a); }
        const out = (users || []).map((u: any) => ({ email: u.email, name: u.display_name, joined: u.created_at, profiles: profilesOfUser(u), profile_label: (plist.find((x: any) => x.key === u.profile_key) || {}).label || (u.role === 'admin' ? 'Administrator (GM)' : ''), sessions: byPerson.get(u.email) || {}, certs: certBy.get(u.email) || [] }));
        return json({ people: out });
      }

      // A manager records a completion by hand (for example done on paper), or removes one. A removed completion stays on file, marked void, but no longer counts.
      case "record_add": {
        needManager();
        const email = clean(body.email, 200).toLowerCase();
        const target = (await rest(`portal_users?select=email,display_name&email=eq.${q(email)}`))?.[0];
        if (!target) throw new Error("No such person.");
        const key = clean(body.session_key, 60);
        if (!/^[a-z0-9][a-z0-9-]{1,58}$/.test(key) || !(await loadIndex()).some((x) => x.key === key)) throw new Error("Unknown session.");
        const on = day(body.completed_on) || new Date().toISOString().slice(0, 10);
        if (on > new Date().toISOString().slice(0, 10)) throw new Error("A completion cannot be in the future.");
        const total = Math.max(1, Math.min(60, Math.round(+body.total || 10)));
        const row = (await rest(`training_records`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({
          email, name: target.display_name || email, session_key: key, session_version: 1, score: total, total, passed: true, seconds: null,
          completed_at: on + "T12:00:00Z", manual: true, recorded_by: who.email, note: clean(body.note, 300),
        }) }))?.[0];
        return json({ record: row });
      }
      case "record_void": {
        needManager();
        const email = clean(body.email, 200).toLowerCase(), key = clean(body.session_key, 60);
        if (!email || !/^[a-z0-9][a-z0-9-]{1,58}$/.test(key)) throw new Error("Unknown person or session.");
        const set = (await rest(`training_settings?select=issued_at&session_key=eq.${q(key)}`))?.[0];
        const issued = set?.issued_at || null;
        // every pass that currently counts: made by hand, or on/after the issue date
        const recs = (await rest(`training_records?select=id,passed,manual,completed_at&email=eq.${q(email)}&session_key=eq.${q(key)}&voided_at=is.null&passed=is.true`)) || [];
        const ids = recs.filter((r: any) => r.manual || (issued && r.completed_at >= issued)).map((r: any) => r.id);
        if (!ids.length) throw new Error("There is no completion to remove.");
        await rest(`training_records?id=in.(${ids.map(q).join(",")})`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ voided_at: new Date().toISOString(), voided_by: who.email }) });
        return json({ ok: true, voided: ids.length });
      }

      case "cert_save": {
        needManager();
        const email = clean(body.email, 200).toLowerCase();
        const target = (await rest(`portal_users?select=email&email=eq.${q(email)}`))?.[0];
        if (!target) throw new Error("No such person.");
        const key = clean(body.cert_key, 40) || "other", label = clean(body.cert_label, 120);
        if (!label) throw new Error("Say which certificate it is.");
        const row = { email, cert_key: key, cert_label: label, obtained_on: day(body.obtained_on), expires_on: day(body.expires_on), note: clean(body.note, 300), recorded_by: who.email };
        const id = clean(body.id, 60);
        const saved = id
          ? (await rest(`training_certs?id=eq.${q(id)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) }))?.[0]
          : (await rest(`training_certs`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) }))?.[0];
        return json({ cert: saved });
      }

      case "cert_delete": {
        needManager();
        await rest(`training_certs?id=eq.${q(clean(body.id, 60))}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ deleted_at: new Date().toISOString() }) });
        return json({ ok: true });
      }

      // One person's whole history (every attempt), for the record tab's detail view.
      case "history": {
        needManager();
        const email = clean(body.email, 200).toLowerCase();
        const rows = await rest(`training_records?select=${REC_COLS},voided_at,voided_by&email=eq.${q(email)}&order=completed_at.desc&limit=300`);
        return json({ records: rows || [] });
      }

      // Per-session settings: renewal months and the days allowed from issue to due.
      case "settings_save": {
        needManager();
        const key = clean(body.session_key, 60);
        if (!/^[a-z0-9][a-z0-9-]{1,58}$/.test(key)) throw new Error("Unknown session.");
        const refresh = Math.max(1, Math.min(60, Math.round(+body.refresh_months || 12))), grace = Math.max(1, Math.min(60, Math.round(+body.grace_days || 7)));
        const row: Record<string, unknown> = { session_key: key, refresh_months: refresh, grace_days: grace, updated_by: who.email, updated_at: new Date().toISOString() };
        // roles: the list of roles (or "all") that must do the module; null puts it back to the default in the session list
        if ("roles" in body) { const okKeys = new Set(["all", ...(await profileList()).map((p) => p.key)]); row.roles = Array.isArray(body.roles) ? [...new Set(body.roles.map((x: unknown) => String(x)).filter((x: string) => okKeys.has(x)))] : null; }
        await rest(`training_settings?on_conflict=session_key`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(row) });
        return json({ ok: true });
      }

      // Issue sessions: everyone they are required of must pass within grace_days of now. reissue = those already issued too
      // (everyone must do them again). withdraw = take a session out of use.
      case "issue": {
        needManager();
        const keys: string[] = Array.isArray(body.session_keys) ? body.session_keys.map((k: unknown) => clean(k, 60)).filter((k: string) => /^[a-z0-9][a-z0-9-]{1,58}$/.test(k)) : [];
        if (!keys.length) throw new Error("Pick at least one session.");
        const sessions = await loadIndex();
        const known = new Set(sessions.map((x) => x.key));
        const existing = new Map<string, any>(((await rest(`training_settings?select=*`)) || []).map((x: any) => [x.session_key, x]));
        const now = new Date().toISOString();
        const rows = keys.filter((k) => known.has(k)).map((k) => {
          const cur = existing.get(k);
          const issued = body.withdraw === true ? null : (cur?.issued_at && body.reissue !== true ? cur.issued_at : now);
          return { session_key: k, refresh_months: cur?.refresh_months ?? sessions.find((x) => x.key === k)?.refreshMonths ?? 12, grace_days: cur?.grace_days ?? 7, issued_at: issued, updated_by: who.email, updated_at: now };
        });
        if (rows.length) await rest(`training_settings?on_conflict=session_key`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows) });
        return json({ ok: true, count: rows.length });
      }

      // Give modules their issue dates in one go (a rollout plan): items = [{ session_key, issue_at }]; a date in the future means
      // "scheduled": nobody is chased and nothing shows on lists until that day; issue_at null withdraws the module.
      case "schedule": {
        needManager();
        const sessions = await loadIndex(), known = new Set(sessions.map((x) => x.key));
        const existing = new Map<string, any>(((await rest(`training_settings?select=*`)) || []).map((x: any) => [x.session_key, x]));
        const now = new Date().toISOString();
        const rows = (Array.isArray(body.items) ? body.items : []).filter((i: any) => known.has(String(i?.session_key))).map((i: any) => {
          const cur = existing.get(i.session_key); const d = i.issue_at ? new Date(String(i.issue_at)) : null;
          if (d && isNaN(d.getTime())) throw new Error("That is not a date.");
          return { session_key: String(i.session_key), refresh_months: cur?.refresh_months ?? sessions.find((x) => x.key === i.session_key)?.refreshMonths ?? 12, grace_days: cur?.grace_days ?? 7, issued_at: d ? d.toISOString() : null, updated_by: who.email, updated_at: now };
        });
        if (rows.length) await rest(`training_settings?on_conflict=session_key`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows) });
        return json({ ok: true, count: rows.length });
      }

      case "config_save": {
        needManager();
        await rest(`training_config?id=eq.1`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ reminders_on: body.reminders_on !== false, updated_by: who.email, updated_at: new Date().toISOString() }) });
        return json({ ok: true });
      }

      // Send the overdue emails now (dry: only say who would get one).
      case "send_reminders": {
        needManager();
        return json(await sendReminders(body.dry === true));
      }

      default:
        return json({ error: "Unknown action." }, 400);
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});
