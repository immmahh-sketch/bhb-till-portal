/* Marquee table plan: the layout engine and the drawing. Pure functions (no page, no network), so it can be tested on its own.
   Units are metres. The room is 34.4 m wide and 14.75 m deep, in three equal sections divided by curtains (tables may run across a curtain).
   A booking is { key, name, size, start, end } with start/end in minutes since midnight. A plan is { v, inventory, tables:[{ id, type, n, x, y, rot, items:[bookingKey] }], nextId, built }.
   Furniture: round10 = 6 ft round (10), round8 = 5 ft round (8), small4 = small table (4), trestle = 6 ft trestle, n joined end to end (seats 6n + 2: 8, 14, 20, 26). */
(function (root) {
  "use strict";
  const ROOM = { w: 34.4, h: 14.75 };
  const SEC_W = ROOM.w / 3;      // the curtains
  const TEAMS = 2, TEAM_X = ROOM.w / 2;      // two teams look after the room: the left half and the right half (the middle section is split down the middle)
  const T0 = 12 * 60, T1 = 20 * 60, STEP = 15, NSLOT = (T1 - T0) / STEP;       // 12:00 to 20:00 in quarter hours
  const TURN = 15;            // minutes to reset a table between two sittings
  const AISLE = 1.0;          // clear walkway between two tables' chairs, metres (the layout aims for this; under 0.8 is flagged)
  const AISLE_MIN = 0.8;
  const USABLE = { y0: 1.3, y1: 12.2 };      // keeps the top doors, and the bar, kitchen, toilets and main entrance along the bottom, clear
  const SECTION_REGION = [{ x0: 1.3, x1: 16.7 }, { x0: 17.7, x1: 33.9 }];      // the floor each team looks after, with an aisle where the two meet
  const TYPES = {
    round10: { label: "6ft round", seats: 10, shape: "round", d: 2.95, table: 1.83, fill: "#E75AA8", ink: "#fff" },
    round8: { label: "5ft round", seats: 8, shape: "round", d: 2.65, table: 1.52, fill: "#6B1067", ink: "#fff" },
    small4: { label: "Small table", seats: 4, shape: "round", d: 2.0, table: 0.9, fill: "#A9D0DB", ink: "#223" },
    trestle: { label: "6ft trestle", shape: "rect", fill: "#D3B26B", ink: "#2b2418" },
  };
  const DEFAULT_INVENTORY = { round10: 20, round8: 5, small4: null, trestle: 50 };      // what we own (a trestle counts as 1 however many are joined); null = as many as we need, hired in above what we have
  // fixed features, read from the sketch (metres from the top-left corner of the room)
  const FEATURES = {
    doorsTop: [{ x0: 0, x1: 12.9 }, { x0: 21.4, x1: 34.4 }],
    doorLeft: { y0: 7.8, y1: 11.5 },
    bottom: [{ label: "Access to toilets", x0: 5.0, x1: 6.5 }, { label: "Access to kitchen", x0: 11.1, x1: 14.1 }, { label: "Bar", x0: 16.4, x1: 20.8 }, { label: "Main entrance", x0: 29.4, x1: 34.3 }],
    sockets: [{ x: 12.7, y: -0.1 }, { x: -0.1, y: 3.1 }, { x: -0.1, y: 14.4 }],
  };

  const hm = (n) => String(Math.floor(n / 60)).padStart(2, "0") + ":" + String(n % 60).padStart(2, "0");
  const seatsOf = (t) => (t.type === "trestle" ? 6 * (t.n || 1) + 2 : TYPES[t.type].seats);
  /** The space a table takes up with its chairs, as it stands (rotation swaps width and depth). */
  function foot(t) {
    if (t.type !== "trestle") { const d = TYPES[t.type].d; return { w: d, h: d }; }
    const n = t.n || 1, w = n * 1.83 + 1.15, h = 1.85;
    return (t.rot || 0) % 180 ? { w: h, h: w } : { w, h };
  }
  const sectionOf = (x) => (x < TEAM_X ? 0 : 1);      // which team a table belongs to, by where its centre stands

  // ---------------------------------------------------------------- which table each booking needs
  /** The tables a party can sit at, best first. Trestles take the least floor space, so they come first from 5 guests up (joined end to end, seats 6n + 2); small tables for up to 4; a 6 ft round for 9 to 10, where it is no bigger than two trestles; rounds are the fall-back if the trestles run out. */
  function neededTypes(size) {
    if (size <= 4) return [{ type: "small4", n: 1 }];
    if (size <= 8) return [{ type: "trestle", n: 1 }, { type: "round8", n: 1 }, { type: "round10", n: 1 }];
    if (size <= 10) return [{ type: "round10", n: 1 }, { type: "trestle", n: 2 }];
    return [{ type: "trestle", n: Math.max(2, Math.ceil((size - 2) / 6)) }];
  }
  const neededType = (size) => neededTypes(size)[0];
  const capOf = (inv, type) => (inv && inv[type] != null ? inv[type] : Infinity);
  const endOf = (t, byKey) => t.items.reduce((m, k) => Math.max(m, byKey[k] ? byKey[k].end : 0), 0);
  /** Which table a booking goes on: one already in the room that is free at that time (the first kind in the party's order of preference), else a new table of the best kind we still have. */
  function pick(b, tables, byKey, inv) {
    const prefs = neededTypes(b.size);
    for (const pr of prefs) {
      let best = null;
      for (const t of tables) {
        if (t.type !== pr.type || (t.n || 1) !== pr.n) continue;
        if (t.items.some((k) => byKey[k] && b.start < byKey[k].end + TURN && byKey[k].start < b.end + TURN)) continue;
        const gap = t.items.length ? b.start - endOf(t, byKey) : 1e9;
        if (best === null || (gap >= 0 && gap < best.gap)) best = { t, gap };
      }
      if (best) return { table: best.t };
    }
    for (const pr of prefs) {
      const have = tables.filter((t) => t.type === pr.type).reduce((s, t) => s + (pr.type === "trestle" ? (t.n || 1) : 1), 0);
      if (have + (pr.type === "trestle" ? pr.n : 1) <= capOf(inv, pr.type)) return { make: pr };
    }
    return { make: prefs[prefs.length - 1] };
  }
  const slotRange = (b) => [Math.max(0, Math.floor((b.start - T0) / STEP)), Math.min(NSLOT, Math.ceil((b.end - T0) / STEP))];
  function occupancy(items, byKey) {
    const v = new Array(NSLOT).fill(0);
    for (const k of items) { const b = byKey[k]; if (!b) continue; const [a, z] = slotRange(b); for (let i = a; i < z; i++) v[i] = 1; }
    return v;
  }

  // ---------------------------------------------------------------- packing a section
  /** Rows of tables, biggest first, spread evenly so the aisles are as wide as the room allows. Returns the positions and any table that did not fit. */
  function packRows(tables, region, gap) {
    const W = region.x1 - region.x0, H = USABLE.y1 - USABLE.y0;
    const items = tables.map((t) => ({ t, f: foot(t) })).sort((a, b) => b.f.h - a.f.h || b.f.w - a.f.w);
    const rows = [];
    for (const it of items) {
      let row = rows.find((r) => it.f.h <= r.h + 1e-9 && r.w + (r.items.length ? gap : 0) + it.f.w <= W + 1e-9);
      if (!row) { row = { items: [], w: 0, h: it.f.h }; rows.push(row); }
      row.w += (row.items.length ? gap : 0) + it.f.w; row.items.push(it);
    }
    const over = [];
    const total = () => rows.reduce((s, r) => s + r.h, 0) + gap * Math.max(0, rows.length - 1);
    while (rows.length && total() > H + 1e-9) { const r = rows.pop(); r.items.forEach((i) => over.push(i.t)); }
    // spread the leftover room evenly, but never closer together than the aisle
    const placed = [], used = rows.reduce((s, r) => s + r.h, 0), nr = rows.length;
    const sy = nr ? Math.max(gap, (H - used) / (nr + 1)) : 0, topY = nr ? (H - used - sy * (nr - 1)) / 2 : 0;
    let y = USABLE.y0 + topY;
    for (const r of rows) {
      const sw = r.items.reduce((s, i) => s + i.f.w, 0), n = r.items.length;
      const sx = n > 1 ? Math.max(gap, (W - sw) / (n + 1)) : 0, left = (W - sw - sx * (n - 1)) / 2;
      let x = region.x0 + left;
      for (const it of r.items) { placed.push({ id: it.t.id, x: round1(x + it.f.w / 2), y: round1(y + r.h / 2) }); x += it.f.w + sx; }
      y += r.h + sy;
    }
    return { placed, over };
  }
  const round1 = (v) => Math.round(v * 10) / 10;
  /** Denser fallback: each table, biggest first, goes at the first spot (top-left first) that still leaves the aisle to every table already placed.
   *  Candidate spots are the corners just clear of the tables already down, which is quick; a fine scan is the last resort. */
  function packScan(tables, region, gap, stopOnFail) {
    const items = tables.slice().sort((a, b) => foot(b).w * foot(b).h - foot(a).w * foot(a).h);
    const placed = [], over = [];
    const clear = (c, x, y) => {
      for (const p of placed) {
        const g = c.round && p.round ? Math.hypot(x - p.x, y - p.y) - (c.w + p.w) / 2 : Math.max(Math.abs(x - p.x) - (c.w + p.w) / 2, Math.abs(y - p.y) - (c.h + p.h) / 2);
        if (g < gap - 1e-9) return false;
      }
      return true;
    };
    for (const t of items) {
      const f = foot(t), c = { w: f.w, h: f.h, round: TYPES[t.type].shape === "round" };
      const xmin = region.x0 + f.w / 2, xmax = region.x1 - f.w / 2, ymin = USABLE.y0 + f.h / 2, ymax = USABLE.y1 - f.h / 2;
      const xs = new Set([xmin]), ys = new Set([ymin]);
      for (const p of placed) { xs.add(p.x + (p.w + f.w) / 2 + gap); xs.add(p.x - (p.w + f.w) / 2 - gap); xs.add(p.x); ys.add(p.y + (p.h + f.h) / 2 + gap); ys.add(p.y - (p.h + f.h) / 2 - gap); ys.add(p.y); }
      const X = [...xs].map(round1c).filter((v) => v >= xmin - 1e-9 && v <= xmax + 1e-9).sort((a, b) => a - b), Y = [...ys].map(round1c).filter((v) => v >= ymin - 1e-9 && v <= ymax + 1e-9).sort((a, b) => a - b);
      let spot = null;
      for (const y of Y) { for (const x of X) if (clear(c, x, y)) { spot = { x, y }; break; } if (spot) break; }
      for (let y = ymin; !spot && y <= ymax + 1e-9; y += 0.1) for (let x = xmin; x <= xmax + 1e-9; x += 0.1) if (clear(c, x, y)) { spot = { x, y }; break; }
      if (spot) placed.push({ id: t.id, x: round1(spot.x), y: round1(spot.y), w: c.w, h: c.h, round: c.round }); else { over.push(t); if (stopOnFail) break; }
    }
    return { placed: placed.map((p) => ({ id: p.id, x: p.x, y: p.y })), over };
  }
  const round1c = (v) => Math.ceil(v * 10 - 1e-9) / 10;      // round up to 0.1 m so a corner spot never ends up a hair too close
  /** Neat rows when they fit; the denser scan when they do not. */
  function pack(tables, region, gap, quick) {
    const area = tables.reduce((s, t) => { const f = foot(t); return s + (f.w + gap) * (f.h + gap); }, 0);
    if (area > (region.x1 - region.x0 + gap) * (USABLE.y1 - USABLE.y0 + gap) * 1.02) return { placed: [], over: tables.slice(0, 1) };      // cannot possibly fit
    const a = packRows(tables, region, gap);
    if (!a.over.length) return a;
    const b = packScan(tables, region, gap, quick);
    return b.over.length < a.over.length ? b : a;
  }

  // ---------------------------------------------------------------- balance
  function sectionCounts(tables, occ) {
    const c = Array.from({ length: TEAMS }, () => new Array(NSLOT).fill(0));
    for (const t of tables) { const s = sectionOf(t.x), o = occ[t.id]; for (let i = 0; i < NSLOT; i++) c[s][i] += o[i]; }
    return c;
  }
  function imbalance(c) {
    let cost = 0;
    for (let i = 0; i < NSLOT; i++) { let m = 0; for (let s = 0; s < TEAMS; s++) m += c[s][i]; m /= TEAMS; for (let s = 0; s < TEAMS; s++) cost += (c[s][i] - m) * (c[s][i] - m); }
    return cost;
  }

  // ---------------------------------------------------------------- the automatic plan
  /** Puts every booking on a table (sharing a table between sittings that do not overlap), then spreads the tables over the three sections so each has a similar number in use at every moment. */
  function autoLayout(bookings, inventory) {
    const inv = Object.assign({}, DEFAULT_INVENTORY, inventory || {});
    const byKey = {}; bookings.forEach((b) => { byKey[b.key] = b; });
    const tables = [];
    const sorted = bookings.slice().sort((a, b) => b.size - a.size || a.start - b.start);      // the biggest parties choose first, so the tables we own go where they are needed most
    let nextId = 1;
    for (const b of sorted.slice().sort((x, y) => x.start - y.start)) {
      const r = pick(b, tables, byKey, inv);
      let t = r.table;
      if (!t) { t = { id: "T" + nextId++, type: r.make.type, n: r.make.n, rot: 0, x: 0, y: 0, items: [] }; tables.push(t); }
      t.items.push(b.key);
    }
    const occ = {}; tables.forEach((t) => { occ[t.id] = occupancy(t.items, byKey); });
    // sections: biggest users of the room first, each to the section that keeps the room most even, while the tables still fit
    const secOf = {}, members = Array.from({ length: TEAMS }, () => []);
    const order = tables.slice().sort((a, b) => occ[b.id].reduce((s, v) => s + v, 0) * foot(b).w * foot(b).h - occ[a.id].reduce((s, v) => s + v, 0) * foot(a).w * foot(a).h);
    const fitMemo = {};
    const tryFit = (s, list) => { const k = s + ":" + list.map((t) => t.id).sort().join(","); if (!(k in fitMemo)) fitMemo[k] = pack(list, SECTION_REGION[s], AISLE, true).over.length === 0; return fitMemo[k]; };
    const cost = () => { const c = Array.from({ length: TEAMS }, (_, s) => { const v = new Array(NSLOT).fill(0); members[s].forEach((t) => { for (let i = 0; i < NSLOT; i++) v[i] += occ[t.id][i]; }); return v; }); return imbalance(c); };
    for (const t of order) {
      let bestS = -1, bestC = Infinity;
      for (let s = 0; s < TEAMS; s++) {
        if (!tryFit(s, members[s].concat([t]))) continue;
        members[s].push(t); const c = cost(); members[s].pop();
        if (c < bestC) { bestC = c; bestS = s; }
      }
      if (bestS < 0) bestS = Array.from({ length: TEAMS }, (_, i) => i).sort((a, b) => members[a].length - members[b].length)[0];      // nothing fits: the fullest-room warning will say so
      members[bestS].push(t); secOf[t.id] = bestS;
    }
    // improve: move or swap tables between sections while that makes the room more even and everything still fits
    let improved = true, guard = 0;
    while (improved && guard++ < 60) {
      improved = false;
      const base = cost();
      outer: for (let s = 0; s < TEAMS; s++) for (const t of members[s].slice()) for (let d = 0; d < TEAMS; d++) {
        if (d === s) continue;
        members[s].splice(members[s].indexOf(t), 1); members[d].push(t);
        if (tryFit(d, members[d]) && cost() < base - 1e-9) { improved = true; break outer; }
        members[d].pop(); members[s].push(t);
        for (const u of members[d].slice()) {
          members[s].splice(members[s].indexOf(t), 1); members[d].splice(members[d].indexOf(u), 1); members[d].push(t); members[s].push(u);
          if (tryFit(s, members[s]) && tryFit(d, members[d]) && cost() < base - 1e-9) { improved = true; break outer; }
          members[d].splice(members[d].indexOf(t), 1); members[s].splice(members[s].indexOf(u), 1); members[s].push(t); members[d].push(u);
        }
      }
    }
    const leftovers = [];
    for (let s = 0; s < TEAMS; s++) {
      let r = pack(members[s], SECTION_REGION[s], AISLE);
      if (r.over.length) { const r2 = pack(members[s], SECTION_REGION[s], AISLE_MIN); if (r2.over.length < r.over.length) r = r2; }
      const pos = {}; r.placed.forEach((p) => { pos[p.id] = p; });
      members[s].forEach((t) => { if (pos[t.id]) { t.x = pos[t.id].x; t.y = pos[t.id].y; } });
      r.over.forEach((t) => leftovers.push(t));
    }
    const plan = { v: 1, teams: TEAMS, inventory: inv, tables, nextId, built: new Date().toISOString() };
    for (const t of leftovers) { const p = freeSpot(plan, t, sectionOfLeast(plan, byKey)); if (p) { t.x = p.x; t.y = p.y; } else { t.x = ROOM.w / 2; t.y = USABLE.y1 - 0.5; t.unplaced = true; } }
    return plan;
  }
  function sectionOfLeast(plan, byKey) {
    const occ = {}; plan.tables.forEach((t) => { occ[t.id] = occupancy(t.items, byKey); });
    const c = sectionCounts(plan.tables.filter((t) => t.x || t.y), occ), tot = c.map((v) => v.reduce((s, x) => s + x, 0));
    return tot.indexOf(Math.min.apply(null, tot));
  }

  // ---------------------------------------------------------------- spacing checks
  function gapBetween(a, b) {
    const fa = foot(a), fb = foot(b);
    if (TYPES[a.type].shape === "round" && TYPES[b.type].shape === "round") return Math.hypot(a.x - b.x, a.y - b.y) - (fa.w + fb.w) / 2;
    const gx = Math.abs(a.x - b.x) - (fa.w + fb.w) / 2, gy = Math.abs(a.y - b.y) - (fa.h + fb.h) / 2;
    return Math.max(gx, gy);
  }
  /** Every pair of tables that are too close to walk between, and any table outside the room. */
  function problems(plan) {
    const out = [], ts = plan.tables;
    for (let i = 0; i < ts.length; i++) {
      const a = ts[i], f = foot(a);
      if (a.x - f.w / 2 < 0.3 || a.x + f.w / 2 > ROOM.w - 0.3 || a.y - f.h / 2 < 0.3 || a.y + f.h / 2 > ROOM.h - 0.3) out.push({ kind: "wall", a: a.id, text: `${a.id} is against the edge of the room` });
      else if (a.y + f.h / 2 > USABLE.y1 + 0.6) out.push({ kind: "wall", a: a.id, text: `${a.id} is in the way of the bar, kitchen or entrance` });
      for (let j = i + 1; j < ts.length; j++) {
        const b = ts[j], g = gapBetween(a, b);
        if (g < 0) out.push({ kind: "overlap", a: a.id, b: b.id, text: `${a.id} and ${b.id} overlap` });
        else if (g < AISLE_MIN) out.push({ kind: "tight", a: a.id, b: b.id, text: `${a.id} and ${b.id} are only ${g.toFixed(1)} m apart` });
      }
    }
    return out;
  }
  /** A free position for a table near the middle of a section (or anywhere), keeping the aisles. */
  function freeSpot(plan, table, section) {
    const others = plan.tables.filter((t) => t !== table && (t.x || t.y)), f = foot(table);
    const order = section == null ? [0, 1] : [section, (section + 1) % TEAMS];
    for (const gap of [AISLE, AISLE_MIN]) for (const s of order) {
      const r = SECTION_REGION[s];
      for (let y = USABLE.y0 + f.h / 2; y <= USABLE.y1 - f.h / 2 + 1e-9; y += 0.25) for (let x = r.x0 + f.w / 2; x <= r.x1 - f.w / 2 + 1e-9; x += 0.25) {
        const probe = Object.assign({}, table, { x, y });
        if (others.every((o) => gapBetween(probe, o) >= gap)) return { x: round1(x), y: round1(y) };
      }
    }
    return null;
  }

  // ---------------------------------------------------------------- reading the plan against the bookings
  function reconcile(plan, bookings) {
    const byKey = {}; bookings.forEach((b) => { byKey[b.key] = b; });
    const assigned = {};
    plan.tables.forEach((t) => { t.items = (t.items || []).filter((k) => byKey[k]); t.items.forEach((k) => { assigned[k] = t.id; }); });
    return { byKey, unassigned: bookings.filter((b) => !assigned[b.key]), assigned };
  }
  /** What is wrong with a table's sittings: two at once, or a party bigger than the table. */
  function tableIssues(t, byKey) {
    const out = [], its = t.items.map((k) => byKey[k]).filter(Boolean).sort((a, b) => a.start - b.start);
    for (let i = 0; i < its.length; i++) {
      if (its[i].size > seatsOf(t)) out.push(`${its[i].name} (${its[i].size}) is more than the ${seatsOf(t)} seats`);
      if (i && its[i].start < its[i - 1].end + TURN) out.push(`${its[i - 1].name} and ${its[i].name} are too close in time on ${t.id}`);
    }
    return out;
  }
  /** Fit bookings that are not on a table yet: onto an existing table of the right size that is free, else a new table in the quietest section. */
  function placeNew(plan, bookings) {
    const { byKey, unassigned } = reconcile(plan, bookings), made = [];
    for (const b of unassigned.sort((x, y) => x.start - y.start)) {
      const r = pick(b, plan.tables, byKey, plan.inventory);
      let t = r.table;
      if (!t) {
        t = { id: "T" + plan.nextId++, type: r.make.type, n: r.make.n, rot: 0, x: 0, y: 0, items: [] };
        const p = freeSpot(plan, t, sectionOfLeast(plan, byKey)); if (p) { t.x = p.x; t.y = p.y; } else { t.x = ROOM.w / 2; t.y = USABLE.y1 - 0.5; t.unplaced = true; }
        plan.tables.push(t); made.push(t.id);
      }
      t.items.push(b.key);
    }
    return made;
  }
  function stats(plan, bookings) {
    const { byKey } = reconcile(plan, bookings);
    const occ = {}; plan.tables.forEach((t) => { occ[t.id] = occupancy(t.items, byKey); });
    const c = sectionCounts(plan.tables, occ);
    const peak = c.map((v) => Math.max.apply(null, v));
    const worst = Math.max.apply(null, c[0].map((_, i) => Math.max.apply(null, c.map((v) => v[i])) - Math.min.apply(null, c.map((v) => v[i]))));
    const used = {}; plan.tables.forEach((t) => { used[t.type] = (used[t.type] || 0) + (t.type === "trestle" ? (t.n || 1) : 1); });
    const inv = plan.inventory || DEFAULT_INVENTORY, short = [], hire = {};
    Object.keys(used).forEach((k) => { if (inv[k] == null) hire[k] = used[k]; else if (used[k] > inv[k]) short.push(`${used[k] - inv[k]} more ${TYPES[k].label.toLowerCase()}${used[k] - inv[k] === 1 ? "" : "s"} than you have`); });
    return { counts: c, peak, worstGap: worst, used, short, hire, tables: plan.tables.length };
  }
  /** Who is at a table at a given minute of the day (null for none). */
  function sittingAt(t, byKey, at) { return t.items.map((k) => byKey[k]).filter(Boolean).find((b) => at >= b.start && at < b.end) || null; }

  // ---------------------------------------------------------------- drawing
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const short = (s, n) => { s = String(s || ""); return s.length > n ? s.slice(0, n - 1).trim() + "…" : s; };
  function chairs(t) {
    const out = [], r = 0.17;
    if (t.type !== "trestle") {
      const T = TYPES[t.type], R = T.table / 2 + 0.38;
      for (let i = 0; i < T.seats; i++) { const a = (i / T.seats) * Math.PI * 2 - Math.PI / 2; out.push([Math.cos(a) * R, Math.sin(a) * R, r]); }
    } else {
      const n = t.n || 1, L = n * 1.83;
      for (let k = 0; k < n; k++) for (let j = 0; j < 3; j++) { const x = -L / 2 + 1.83 * k + 1.83 * (j + 0.5) / 3; out.push([x, -0.38 - 0.36, r], [x, 0.38 + 0.36, r]); }
      out.push([-L / 2 - 0.4, 0, r], [L / 2 + 0.4, 0, r]);
    }
    return out;
  }
  function tableSvg(t, byKey, o) {
    const T = TYPES[t.type], f = foot(t), sit = o.at == null ? null : sittingAt(t, byKey, o.at);
    const its = t.items.map((k) => byKey[k]).filter(Boolean).sort((a, b) => a.start - b.start);
    const dim = o.at != null && !sit;
    const bad = o.bad && o.bad.has(t.id);
    let shape;
    if (T.shape === "round") shape = `<circle r="${T.table / 2}" fill="${T.fill}" stroke="#3F2F28" stroke-width="0.05"/>`;
    else shape = `<rect x="${-(t.n || 1) * 1.83 / 2}" y="-0.38" width="${(t.n || 1) * 1.83}" height="0.76" rx="0.05" fill="${T.fill}" stroke="#3F2F28" stroke-width="0.05"/>` + ((t.n || 1) > 1 ? Array.from({ length: (t.n || 1) - 1 }, (_, i) => `<line x1="${-(t.n) * 1.83 / 2 + 1.83 * (i + 1)}" y1="-0.38" x2="${-(t.n) * 1.83 / 2 + 1.83 * (i + 1)}" y2="0.38" stroke="#3F2F28" stroke-width="0.04"/>`).join("") : "");
    const dots = chairs(t).map(([x, y, r]) => `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${r}" fill="#fff" stroke="#8a7f78" stroke-width="0.03"/>`).join("");
    const footprint = o.edit ? (T.shape === "round" ? `<circle r="${f.w / 2}" fill="none" stroke="${bad ? "#C0392B" : "#b9b3a6"}" stroke-width="0.04" stroke-dasharray="0.2 0.15"/>` : "") : "";
    // the label stays upright whatever the rotation. The table number goes on the table; the name goes underneath, cut to what fits the width of the table (a long name never runs into the next table)
    const first = o.at == null ? its[0] : sit, n = first ? first.size : 0, more = o.at == null && its.length > 1 ? its.length - 1 : 0;
    const small = (T.shape === "round" && T.table < 1.2) || (T.shape === "rect" && (t.n || 1) < 2);
    const round = T.shape === "round", sizeInside = round && !small;
    let under;
    if (o.at != null && !sit) { const nx = its.find((b) => b.start > o.at); under = "free" + (nx ? ` from ${hm(nx.start)}` : ""); }
    else if (!first) under = "no booking";
    else {
      const budget = Math.max(15, Math.min(34, Math.floor((f.w + 0.5) / 0.165))), head = sizeInside ? "" : " " + n;
      let suffix = head + (more ? " +" + more + " more" : "");
      if (budget - suffix.length < 10) suffix = head + (more ? " +" + more : "");      // not much room: "+1" instead of "+1 more"
      under = short(first.name, Math.max(8, budget - suffix.length)) + suffix;
    }
    const ink = T.ink, dimOp = dim ? ' opacity="0.6"' : "";
    const idY = sizeInside ? -0.06 : 0.13, idFs = round && !small ? 0.4 : (small ? 0.3 : 0.36);
    const txt = `<g transform="rotate(${-(t.rot || 0) % 360})"><text text-anchor="middle" y="${idY}" font-size="${idFs}" font-weight="700" fill="${ink}">${esc(t.id)}</text>` +
      (sizeInside ? `<text text-anchor="middle" y="0.36" font-size="0.3" fill="${ink}">${first ? n : ""}</text>` : "") + `</g>`;
    const out = `<g class="tbl${dim ? " dim" : ""}${bad ? " bad" : ""}" data-t="${esc(t.id)}" transform="translate(${t.x} ${t.y})" ${dim ? 'opacity="0.38"' : ""} style="cursor:${o.edit ? "grab" : "pointer"}">
      ${footprint}<g transform="rotate(${t.rot || 0})">${dots}${shape}</g>${txt}
      <text text-anchor="middle" y="${f.h / 2 + 0.38}" font-size="0.3" fill="#3F2F28"${dimOp}>${esc(under)}</text>
      <circle r="${Math.max(f.w, f.h) / 2}" fill="transparent"/></g>`;
    return out;
  }
  /** The whole room as SVG. opts: { at: minutes or null for the whole day, edit: true to show the aisle outlines, bad: Set of table ids to outline in red, sections: counts to print above each section } */
  function svg(plan, bookings, opts) {
    const o = opts || {}, { byKey } = reconcile(plan, bookings);
    const W = ROOM.w, H = ROOM.h;
    const tint = ["#FBF9F3", "#F3F1E8"];
    const secs = [0, 1].map((s) => `<rect x="${s * TEAM_X}" y="0" width="${TEAM_X}" height="${H}" fill="${tint[s]}"/>`).join("");
    const curtains = [1, 2].map((s) => `<line x1="${s * SEC_W}" y1="0" x2="${s * SEC_W}" y2="${H}" stroke="#777" stroke-width="0.05" stroke-dasharray="0.4 0.3"/>`).join("") + `<line x1="${TEAM_X}" y1="0" x2="${TEAM_X}" y2="${H}" stroke="#8A1C2B" stroke-width="0.11"/><text transform="translate(${TEAM_X + 0.45} ${H - 0.5}) rotate(-90)" font-size="0.34" fill="#8A1C2B">team divide</text>`;
    const heads = [0, 1].map((s) => `<text x="${s * TEAM_X + TEAM_X / 2}" y="-0.95" text-anchor="middle" font-size="0.62" font-weight="700" fill="#3F2F28">TEAM ${s + 1}</text>` + (o.sections ? `<text x="${s * TEAM_X + TEAM_X / 2}" y="-0.4" text-anchor="middle" font-size="0.42" fill="#6b6f66">${esc(o.sections[s])}</text>` : "")).join("");
    const doors = FEATURES.doorsTop.map((d) => `<rect x="${d.x0 + 0.3}" y="-0.12" width="${d.x1 - d.x0 - 0.6}" height="0.24" fill="#9aa3a8"/><text x="${(d.x0 + d.x1) / 2}" y="0.9" text-anchor="middle" font-size="0.36" fill="#667">DOOR</text>`).join("") +
      `<rect x="-0.12" y="${FEATURES.doorLeft.y0}" width="0.24" height="${FEATURES.doorLeft.y1 - FEATURES.doorLeft.y0}" fill="#9aa3a8"/><text transform="translate(0.7 ${(FEATURES.doorLeft.y0 + FEATURES.doorLeft.y1) / 2}) rotate(-90)" text-anchor="middle" font-size="0.36" fill="#667">DOOR</text>`;
    const bottom = FEATURES.bottom.map((b) => `<rect x="${b.x0}" y="${H - 0.05}" width="${b.x1 - b.x0}" height="0.9" fill="#777"/><text x="${(b.x0 + b.x1) / 2}" y="${H + 1.45}" text-anchor="middle" font-size="0.4" fill="#3F2F28">${esc(b.label)}</text>`).join("");
    const socks = FEATURES.sockets.map((s) => `<rect x="${s.x - 0.18}" y="${s.y - 0.18}" width="0.36" height="0.36" rx="0.05" fill="#fff" stroke="#333" stroke-width="0.04"/>`).join("");
    const tbl = plan.tables.map((t) => tableSvg(t, byKey, o)).join("");
    const dims = `<line x1="0" y1="${H + 2.1}" x2="${W}" y2="${H + 2.1}" stroke="#0b4fa8" stroke-width="0.05" marker-start="url(#mqa)" marker-end="url(#mqa)"/><text x="${W / 2}" y="${H + 2.7}" text-anchor="middle" font-size="0.46" fill="#0b4fa8">${W} m</text>` +
      `<line x1="${W + 0.9}" y1="0" x2="${W + 0.9}" y2="${H}" stroke="#0b4fa8" stroke-width="0.05" marker-start="url(#mqa)" marker-end="url(#mqa)"/><text transform="translate(${W + 1.55} ${H / 2}) rotate(90)" text-anchor="middle" font-size="0.46" fill="#0b4fa8">${H} m</text>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" id="mqsvg" viewBox="-1.4 -1.7 ${W + 3.4} ${H + 4.7}" font-family="Raleway,Helvetica,Arial,sans-serif" style="width:100%;height:auto;display:block;touch-action:none">
      <defs><marker id="mqa" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto-start-reverse"><path d="M0 0 L4 2 L0 4 z" fill="#0b4fa8"/></marker></defs>
      <rect x="-1.4" y="-1.7" width="${W + 3.4}" height="${H + 4.7}" fill="#fff"/>
      ${secs}<rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="#3F2F28" stroke-width="0.09"/>${curtains}${heads}${doors}${bottom}${socks}${dims}${tbl}</svg>`;
  }

  const API = { ROOM, SEC_W, TEAMS, TEAM_X, TYPES, DEFAULT_INVENTORY, FEATURES, USABLE, SECTION_REGION, T0, T1, STEP, NSLOT, TURN, AISLE, AISLE_MIN, hm, seatsOf, foot, sectionOf, neededType, autoLayout, problems, freeSpot, reconcile, tableIssues, placeNew, stats, sittingAt, svg, pack, occupancy };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.MQ = API;
})(typeof window !== "undefined" ? window : globalThis);
