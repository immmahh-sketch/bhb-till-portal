/* Insights - the Trends / Best times / Content / Results views inside the Analytics tab of Marketing Actions.
 *
 *   const v = Insights.mount(element, { call, kind });   // kind: 'trends' | 'timing' | 'content' | 'impact'; later: v.unmount()
 *
 * Backend (social-insights): analytics.trends | analytics.timing | analytics.content | analytics.impact, each { days }.
 * "Typical post" is the median, so one runaway post cannot flatter a weekday or a topic. Where there is too little data the
 * page says so instead of drawing a conclusion. Uses the host page's colours and .btn / .card / .tag / .pagehead / .spacer classes.
 */
(function (global) {
  'use strict';

  const CSS = `
.ins .ctl{display:flex; align-items:center; gap:10px; flex-wrap:wrap}
.ins .ctl label{font-size:10px; letter-spacing:var(--track-label,.18em); text-transform:uppercase; color:var(--sage-70,#7B887C)}
.ins .ctl select{border:1px solid var(--mist,#e7e7e7); border-radius:8px; background:var(--white,#fff); padding:8px 12px; min-height:40px; font-size:16px; cursor:pointer}
.ins .ctl .when{font-size:12px; color:var(--sage-70,#7B887C); white-space:nowrap}
.ins .ctl .btn{width:auto}
.ins .cw:focus-visible,.ins select:focus-visible,.ins .btn:focus-visible,.ins .pick:focus-visible,.ins a:focus-visible,.ins .scroll:focus-visible{outline:2px solid var(--blue,#34546F); outline-offset:2px}
.ins .body{transition:opacity .15s} .ins .body.busy{opacity:.45; pointer-events:none}
.ins .plat{border-top:4px solid var(--pc); padding-top:16px}
.ins .plat.fb{--pc:#3B5998; --pc-bg:#E9EDF5; --pc-ink:#2F4778}
.ins .plat.ig{--pc:#B03A6B; --pc-bg:#F7E8EF; --pc-ink:#8F2D56}
.ins .phead{display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:12px}
.ins .phead h3{margin:0; display:inline-block; border-radius:999px; padding:2px 16px 3px; background:var(--pc-bg); color:var(--pc-ink)}
.ins .phead .sub{font-size:12px; color:var(--sage-70,#7B887C)}
.ins .strip{display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:10px; margin-bottom:16px}
.ins .strip div{background:var(--bone,#f7f7f7); border-radius:8px; padding:10px 14px; min-width:0}
.ins .strip b{display:block; font-family:var(--display,Georgia,serif); font-size:28px; line-height:1.05; color:var(--sage,#4E5F4F); font-weight:600; font-variant-numeric:tabular-nums}
.ins .strip span{font-size:10px; letter-spacing:var(--track-label,.18em); text-transform:uppercase; color:var(--sage-70,#7B887C)}
.ins .strip small{display:block; font-size:11px; color:var(--sage-70,#7B887C); margin-top:2px}
.ins .up{color:var(--good,#3F7A4F)} .ins .down{color:var(--alert,#8C4A3F)}
.ins h4{font-family:var(--display,Georgia,serif); font-size:20px; color:var(--sage,#4E5F4F); margin:18px 0 8px; font-weight:600}
.ins h4 small{font-family:var(--body,Raleway,sans-serif); font-size:12px; color:var(--sage-70,#7B887C); font-weight:400; margin-left:6px}
.ins .notice{background:var(--attention-bg,#F7F0E4); border-radius:8px; padding:10px 14px; margin:0 0 12px; font-size:14px}
.ins .notice.bad{background:var(--alert-bg,#F6EAE8); color:var(--alert,#8C4A3F)}
.ins .reco{background:var(--pc-bg); color:var(--pc-ink); border-radius:10px; padding:12px 16px; margin:0 0 14px}
.ins .reco ul{margin:0; padding-left:18px} .ins .reco li{margin:2px 0; line-height:1.4}
.ins .reco .tag{margin-left:6px; background:rgba(255,255,255,.7); color:inherit; vertical-align:middle}
.ins .none{padding:14px 4px; color:var(--sage-70,#7B887C); font-size:14px}
.ins .na{color:var(--sage-70,#7B887C)}
.ins .foot{font-size:12px; color:var(--sage-70,#7B887C); margin:4px 2px 0; max-width:760px; line-height:1.45}
.ins .picks{display:flex; gap:8px; flex-wrap:wrap; margin:0 0 10px}
.ins .pick{border:1px solid var(--mist,#e7e7e7); background:var(--white,#fff); color:var(--sage,#4E5F4F); border-radius:999px; padding:6px 14px; min-height:36px; font-size:13px; cursor:pointer}
.ins .pick[aria-pressed="true"]{background:var(--pc,var(--sage,#4E5F4F)); border-color:var(--pc,var(--sage,#4E5F4F)); color:#fff}
.ins .pick[disabled]{opacity:.5; cursor:default}
.ins .cw{overflow-x:auto}
.ins svg.chart{display:block; width:100%; min-width:560px; height:auto; overflow:visible}
.ins svg.chart text{font-size:11px; fill:var(--sage-70,#7B887C); font-family:inherit}
.ins .scroll{overflow-x:auto; border:1px solid var(--mist,#e7e7e7); border-radius:8px}
.ins table.t{width:100%; border-collapse:separate; border-spacing:0; font-size:14px; min-width:520px}
.ins .t th,.ins .t td{padding:9px 10px; border-top:1px solid var(--mist,#e7e7e7); text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; background:var(--white,#fff)}
.ins .t thead th{font-size:10px; letter-spacing:var(--track-label,.18em); text-transform:uppercase; color:var(--sage-70,#7B887C); font-weight:600; background:var(--bone,#f7f7f7); border-top:0}
.ins .t th:first-child,.ins .t td:first-child{text-align:left}
.ins .t tbody th{font-weight:600; color:var(--sage,#4E5F4F)}
.ins .t tbody tr:first-child th,.ins .t tbody tr:first-child td{border-top:0}
.ins .bars{display:grid; gap:6px; margin:0 0 4px}
.ins .brow{display:grid; grid-template-columns:minmax(110px,190px) 1fr; gap:6px 12px; align-items:center}
.ins .brow .nm{font-size:14px; min-width:0; overflow-wrap:anywhere}
.ins .brow .nm small{display:block; font-size:11px; color:var(--sage-70,#7B887C)}
.ins .brow .tr{display:flex; align-items:center; gap:10px; min-width:0}
.ins .brow .tr .bw{flex:1; min-width:0; height:14px}
.ins .brow .tr i{display:block; height:100%; border-radius:99px; background:var(--pc); min-width:3px}
.ins .brow.few .tr i{background:var(--mist,#e7e7e7)}
.ins .brow .tr b{flex:none; min-width:3.2em; text-align:right; font-size:14px; font-variant-numeric:tabular-nums; white-space:nowrap}
.ins .brow.best .nm{font-weight:700} .ins .brow.best .nm small{font-weight:400}
.ins .brow .bt{flex:none; font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--pc-ink); font-weight:700; min-width:3em}
.ins .two{display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:0 28px}
.ins .two>div{min-width:0}
.ins .lift{border:1px solid var(--mist,#e7e7e7); border-radius:10px; padding:12px 16px; margin:0 0 10px; background:var(--white,#fff)}
.ins .lift b{display:block; font-size:15px; margin-bottom:2px}
.ins .lift p{margin:0; font-size:14px; line-height:1.4}
.ins .lift.muted{background:var(--bone,#f7f7f7)} .ins .lift.muted p{color:var(--sage-70,#7B887C)}
.ins .day{border-top:1px solid var(--mist,#e7e7e7); padding:10px 0}
.ins .day:first-of-type{border-top:0}
.ins .day .dh{display:flex; gap:8px 14px; align-items:baseline; flex-wrap:wrap}
.ins .day .dh b{font-variant-numeric:tabular-nums}
.ins .day ul{margin:4px 0 0; padding-left:18px; font-size:13px; color:var(--sage-70,#7B887C)}
.ins .day li{margin:2px 0; overflow-wrap:anywhere}
.ins .day a{color:var(--blue,#34546F); font-weight:600}
.ins .sk{border-radius:8px; background:linear-gradient(90deg,var(--mist,#e7e7e7) 0,#f2f2f2 50%,var(--mist,#e7e7e7) 100%); background-size:200% 100%; animation:ins-shine 1.4s linear infinite}
@keyframes ins-shine{from{background-position:200% 0}to{background-position:-200% 0}}
.ins .sr{position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap}
@media (prefers-reduced-motion:reduce){ .ins .sk{animation:none} }
@media (max-width:760px){
  .ins .ctl{width:100%} .ins .ctl .spacer{display:none}
  .ins .strip b{font-size:24px}
  .ins .brow{grid-template-columns:1fr}
}
`;

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isNum = v => typeof v === 'number' && isFinite(v);
  const num = v => isNum(v) ? v.toLocaleString('en-GB', { maximumFractionDigits: 0 }) : null;
  const dec = v => isNum(v) ? v.toLocaleString('en-GB', { maximumFractionDigits: 1 }) : null;
  const money = v => isNum(v) ? '£' + v.toLocaleString('en-GB', { maximumFractionDigits: 0 }) : null;
  const pct1 = v => isNum(v) ? (v * 100).toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%' : null;
  const signed = v => isNum(v) ? (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toLocaleString('en-GB', { maximumFractionDigits: 1 }) : null;
  const clock = d => { try { return d.toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
  const dShort = d => { try { return new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' }); } catch (e) { return String(d || ''); } };
  const dLong = d => { try { return new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return String(d || ''); } };
  const dash = `<span class="na">&ndash;</span>`;
  const show = (v, f) => { const s = (f || num)(v); return s === null ? dash : esc(s); };
  const plural = (n, one, many) => `${num(n)} ${n === 1 ? one : many || one + 's'}`;

  const PLATS = [['facebook', 'Facebook', 'fb'], ['instagram', 'Instagram', 'ig']];
  const TITLES = {
    trends: ['Trends', 'Followers, reach, views, profile visits and website clicks, week by week'],
    timing: ['Best times to post', 'Which days and times get the most interactions'],
    content: ['Post types and topics', 'What sort of post does best'],
    impact: ['Posts and results', 'Posts set against ticket sales, enquiries, show-rounds and sign-ups']
  };
  const ACTION = { trends: 'analytics.trends', timing: 'analytics.timing', content: 'analytics.content', impact: 'analytics.impact' };

  // ---------------------------------------------------------------- charts (drawn to one scale, text from theme colours)
  /** Top of the scale so that four equal steps land on round numbers. */
  function niceMax(v) {
    if (!(v > 4)) return 4;
    const raw = v / 4, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p * 4;
  }
  const W = 700, H = 210, PL = 54, PR = 12, PT = 12, PB = 30;

  /** items: [{label, value|null, tip}]; kind 'bar' | 'line'. Gaps (null) are left empty, never drawn as zero. */
  function chart(items, o) {
    const vals = items.map(i => i.value).filter(isNum);
    if (!vals.length) return '';
    let lo = 0, hi = Math.max(...vals);
    if (o.kind === 'line') { lo = Math.min(...vals); const pad = Math.max((hi - lo) * 0.15, hi * 0.002, 1); lo = Math.floor(lo - pad); hi = Math.ceil(hi + pad); hi = lo + Math.ceil((hi - lo) / 4) * 4; }
    else hi = niceMax(hi);
    const iw = W - PL - PR, ih = H - PT - PB, n = items.length;
    const y = v => PT + ih - (hi === lo ? 0 : (v - lo) / (hi - lo) * ih);
    const x = i => PL + (n === 1 ? iw / 2 : i * iw / (n - 1));
    const slot = iw / n, bw = Math.max(2, Math.min(34, slot * 0.7));
    const bx = i => PL + slot * (i + 0.5);
    let g = '';
    for (let k = 0; k <= 4; k++) {
      const v = lo + (hi - lo) * k / 4, yy = y(v);
      g += `<line x1="${PL}" x2="${W - PR}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}" stroke="var(--mist,#e7e7e7)" stroke-width="1"/><text x="${PL - 8}" y="${(yy + 4).toFixed(1)}" text-anchor="end">${esc(o.fmt ? o.fmt(v) : num(v))}</text>`;
    }
    const color = o.color || 'var(--pc,#4E5F4F)';
    let marks = '';
    if (o.kind === 'line') {
      let d = '', pen = false;
      items.forEach((it, i) => { if (!isNum(it.value)) { pen = false; return; } d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(it.value).toFixed(1); pen = true; });
      marks = `<path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
      if (n <= 40) marks += items.map((it, i) => isNum(it.value) ? `<circle cx="${x(i).toFixed(1)}" cy="${y(it.value).toFixed(1)}" r="3" fill="${color}"><title>${esc(it.tip || it.label)}</title></circle>` : '').join('');
    } else {
      marks = items.map((it, i) => {
        if (!isNum(it.value)) return '';
        const yy = y(it.value), hh = Math.max(it.value > 0 ? 1.5 : 0, PT + ih - yy);
        return `<rect x="${(bx(i) - bw / 2).toFixed(1)}" y="${(PT + ih - hh).toFixed(1)}" width="${bw.toFixed(1)}" height="${hh.toFixed(1)}" rx="2" fill="${color}"><title>${esc(it.tip || it.label)}</title></rect>`;
      }).join('');
    }
    // x labels: first, middle, last (or every item when few)
    const pos = i => o.kind === 'line' ? x(i) : bx(i);
    const idx = n <= 8 ? items.map((_, i) => i) : [0, Math.floor((n - 1) / 2), n - 1];
    const labels = idx.map((i, k) => `<text x="${pos(i).toFixed(1)}" y="${H - 8}" text-anchor="${n > 8 ? (k === 0 ? 'start' : k === idx.length - 1 ? 'end' : 'middle') : 'middle'}">${esc(items[i].label)}</text>`).join('');
    const extra = o.extra ? o.extra({ x: pos, y, PT, ih, H, n }) : '';
    return `<div class="cw" tabindex="0" role="region" aria-label="${esc((o.aria || 'Chart') + ', scrolls sideways on a small screen')}"><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || '')}" preserveAspectRatio="xMidYMid meet">${g}${marks}${extra}${labels}</svg></div>`;
  }

  function stripItem(value, label, small) { return `<div><b>${value}</b><span>${esc(label)}</span>${small ? `<small>${small}</small>` : ''}</div>`; }

  // ---------------------------------------------------------------- mount
  function mount(el, ctx) {
    if (!document.getElementById('ins-css')) { const s = document.createElement('style'); s.id = 'ins-css'; s.textContent = CSS; document.head.appendChild(s); }
    const kind = TITLES[ctx.kind] ? ctx.kind : 'trends';
    const call = ctx.call;
    const st = { days: 90, data: null, err: '', loaded: false, dead: false, gen: 0, when: '', stale: false, metric: { facebook: 'followers', instagram: 'followers' }, outcome: 'tickets', timer: null, lastAt: 0 };
    el.classList.add('ins');
    el.innerHTML = `
      <div class="pagehead"><h2>${esc(TITLES[kind][0])}</h2><span class="hint">${esc(TITLES[kind][1])}</span><span class="spacer"></span>
        <div class="ctl"><label for="in_days">Period</label>
          <select id="in_days"><option value="30">Last 30 days</option><option value="60">Last 60 days</option><option value="90" selected>Last 90 days</option></select>
          <span class="when" id="in_when"></span>
          <button class="btn ghost small" id="in_ref" type="button">Refresh</button></div></div>
      <div class="body" id="in_body"></div>`;
    const $ = s => el.querySelector(s);
    $('#in_days').onchange = e => { st.days = Number(e.target.value) || 90; load({ busy: true }); };
    $('#in_ref').onclick = () => load({ busy: true });
    // Click handlers for the picks (metric / outcome), set once on the container.
    el.addEventListener('click', e => {
      const c = e.target.closest && e.target.closest('.pick');
      if (!c || c.disabled) return;
      if (c.dataset.plat) { st.metric[c.dataset.plat] = c.dataset.metric; draw(); }
      else if (c.dataset.outcome) { st.outcome = c.dataset.outcome; draw(); }
    });
    st.timer = setInterval(() => { if (!st.dead && !document.hidden && st.loaded && Date.now() - st.lastAt > 10 * 60 * 1000) load({ quiet: true }); }, 60 * 1000);

    async function load(o) {
      o = o || {};
      const gen = ++st.gen;
      if (!st.loaded) skeleton(); else if (o.busy) $('#in_body').classList.add('busy');
      let d;
      try { d = await call(ACTION[kind], { days: st.days }); }
      catch (e) {
        if (st.dead || gen !== st.gen) return;
        $('#in_body').classList.remove('busy');
        if (!st.data) { st.err = e.message || 'Could not load the figures.'; draw(); } else { st.stale = true; head(); }
        return;
      }
      if (st.dead || gen !== st.gen) return;
      st.data = d || {}; st.err = ''; st.loaded = true; st.stale = false; st.lastAt = Date.now();
      const asOf = st.data.as_of ? new Date(st.data.as_of) : null;
      st.when = clock(asOf && !isNaN(asOf) ? asOf : new Date());
      $('#in_body').classList.remove('busy');
      head(); draw();
    }
    function head() { $('#in_days').value = String(st.days); $('#in_when').textContent = st.when ? 'Updated ' + st.when + (st.stale ? ' (could not refresh just now)' : '') : ''; }
    function skeleton() {
      $('#in_body').innerHTML = [0, 1].map(() => `<div class="card plat" aria-hidden="true"><div class="sk" style="height:26px;width:160px;margin-bottom:16px"></div><div class="sk" style="height:64px;margin-bottom:16px"></div><div class="sk" style="height:200px"></div></div>`).join('') + `<div class="sr" role="status">Loading the figures…</div>`;
    }

    // ---------------------------------------------------------------- views
    function platCard([key, name, cls], inner, sub) { return `<div class="card plat ${cls}"><div class="phead"><h3>${name}</h3>${sub ? `<span class="sub">${esc(sub)}</span>` : ''}</div>${inner}</div>`; }
    const nothing = (name, msg) => `<div class="none">${esc(msg || 'Nothing to show for ' + name + ' yet.')}</div>`;

    // ---- Trends
    const METRICS = [['followers', 'Followers'], ['reach', 'Reach'], ['views', 'Views'], ['profile_views', 'Profile visits'], ['website_clicks', 'Website clicks'], ['interactions', 'Interactions']];
    function mondayOf(date) { const d = new Date(date + 'T12:00:00Z'), w = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - w); return d.toISOString().slice(0, 10); }
    // Weekly totals worked out here from the daily rows, counting only days Meta gave a figure, so a missing figure is never a zero.
    function weekly(series) {
      const m = new Map();
      for (const r of series) {
        const k = mondayOf(r.date); let w = m.get(k);
        if (!w) { w = { week_start: k, followers_end: null }; for (const [key] of METRICS) if (key !== 'followers') { w[key] = null; w['d_' + key] = 0; } w.net = null; m.set(k, w); }
        for (const [key] of METRICS) if (key !== 'followers' && isNum(r[key])) { w[key] = (w[key] || 0) + r[key]; w['d_' + key]++; }
        if (isNum(r.followers)) w.followers_end = r.followers;
        if (isNum(r.net_followers)) w.net = (w.net || 0) + r.net_followers;
      }
      return [...m.values()].sort((a, b) => a.week_start.localeCompare(b.week_start));
    }
    function trendsCard(p, d) {
      const [key, name] = p;
      const pd = d.platforms && d.platforms[key];
      if (!pd || !(pd.series || []).length) return platCard(p, nothing(name, `No account figures held for ${name} yet. They are collected every morning, so this fills in over the coming days.`));
      const s = pd.summary || {}, av = pd.available || {};
      const series = pd.series.filter(r => r.date);
      const weeks = weekly(series);
      const ch = isNum(s.followers_change) ? s.followers_change : null;
      const strip = '<div class="strip">'
        + stripItem(show(s.followers_now), 'Followers', ch !== null ? `<span class="${ch > 0 ? 'up' : ch < 0 ? 'down' : ''}">${esc(signed(ch))}${isNum(s.followers_change_pct) ? ` (${esc(signed(s.followers_change_pct))}%)` : ''}</span> since ${esc(dShort(series[0].date))}` : '')
        + stripItem(show(s.reach_total), 'Reach', av.reach ? 'people reached, added up' : 'not available')
        + stripItem(show(s.views_total), 'Views', av.views ? '' : 'not available')
        + stripItem(show(s.profile_views_total), 'Profile visits', av.profile_views ? '' : 'not available')
        + stripItem(av.website_clicks ? show(s.website_clicks_total) : dash, 'Website clicks', av.website_clicks ? '' : 'Meta does not give this for Facebook')
        + stripItem(show(s.interactions_total), 'Interactions', av.interactions ? '' : 'not available')
        + '</div>';
      const metric = st.metric[key] && (st.metric[key] === 'followers' || av[st.metric[key]]) ? st.metric[key] : 'followers';
      const picks = `<div class="picks" role="group" aria-label="${esc(name)} measure to draw">` + METRICS.map(([k, l]) => {
        const ok = k === 'followers' || av[k];
        return `<button type="button" class="pick" data-plat="${key}" data-metric="${k}" aria-pressed="${k === metric}"${ok ? '' : ' disabled title="Meta does not give this figure"'}>${esc(l)}</button>`;
      }).join('') + '</div>';
      let cht, cap;
      if (metric === 'followers') {
        cht = chart(series.map(r => ({ label: dShort(r.date), value: isNum(r.followers) ? r.followers : null, tip: `${dLong(r.date)}: ${num(r.followers) ?? 'no figure'} followers` })), { kind: 'line', aria: `${name} followers by day` });
        cap = 'Followers each day.';
      } else {
        const ws = weeks.filter(w => w['d_' + metric] > 0);
        cht = chart(ws.map(w => ({ label: dShort(w.week_start), value: w[metric], tip: `Week from ${dShort(w.week_start)}: ${num(w[metric])}${w['d_' + metric] < 7 ? ` (${w['d_' + metric]} days of figures)` : ''}` })), { kind: 'bar', aria: `${name} ${metric.replace('_', ' ')} by week` });
        cap = `${METRICS.find(m => m[0] === metric)[1]}, added up for each week (weeks start on Monday).`;
      }
      const days = Number(s.days_with_data) || series.length;
      const rowsH = weeks.slice().reverse().map(w => {
        const part = (w.d_reach || 0) < 7 && (w.d_reach || 0) > 0 ? ` <span class="na">(${w.d_reach} days)</span>` : '';
        const cell = k => w['d_' + k] > 0 ? esc(num(w[k])) : dash;
        return `<tr><th scope="row">${esc(dShort(w.week_start))}${part}</th><td>${show(w.followers_end)}</td><td>${w.net === null ? dash : esc(signed(w.net))}</td><td>${cell('reach')}</td><td>${cell('views')}</td><td>${cell('profile_views')}</td><td>${av.website_clicks ? cell('website_clicks') : dash}</td><td>${cell('interactions')}</td></tr>`;
      }).join('');
      const tbl = `<h4>Week by week <small>newest first</small></h4><div class="scroll" tabindex="0" role="region" aria-label="${esc(name)} weekly figures, scrolls sideways on a small screen"><table class="t"><caption class="sr">${esc(name)} week by week</caption><thead><tr><th scope="col">Week from</th><th scope="col">Followers</th><th scope="col">Net gain</th><th scope="col">Reach</th><th scope="col">Views</th><th scope="col">Profile visits</th><th scope="col">Web clicks</th><th scope="col">Interactions</th></tr></thead><tbody>${rowsH}</tbody></table></div>`;
      const thin = days < Math.min(st.days, 28) ? `<div class="notice">We hold ${plural(days, 'day')} of figures for ${esc(name)}. Meta only gives a few weeks back, so the history is built up from here, one more day every morning.</div>` : '';
      return platCard(p, thin + strip + picks + cht + `<p class="foot">${esc(cap)}</p>` + tbl, `${plural(days, 'day')} of figures`);
    }
    function trendsView(d) {
      return PLATS.map(p => trendsCard(p, d)).join('')
        + `<p class="foot">Reach is the number of different people who saw anything from the page; adding up days counts the same person more than once. Interactions here are everything people did on the page, not only on posts.</p>`;
    }

    // ---- Best times
    const WEEK = [0, 1, 2, 3, 4, 5, 6];
    function barRows(list, best, worst, o) {
      o = o || {};
      const max = Math.max(0, ...list.map(r => isNum(r.typical_interactions) ? r.typical_interactions : 0));
      return `<div class="bars">` + list.map(r => {
        const v = isNum(r.typical_interactions) ? r.typical_interactions : null, few = r.posts < (o.min || 3);
        const w = v !== null && max > 0 ? Math.max(v > 0 ? 1 : 0, Math.round(v / max * 100)) : 0;
        const isBest = !few && best && r.label === best.label;
        return `<div class="brow${few ? ' few' : ''}${isBest ? ' best' : ''}"><div class="nm">${esc(r.label)}<small>${plural(r.posts, 'post')}${few ? ' · too few to judge' : ''}${!few && isNum(r.avg_reach) && r.posts ? ' · reach ' + esc(num(r.avg_reach)) : ''}</small></div>
          <div class="tr"><span class="bw"><i style="width:${w}%"></i></span><b>${v === null ? dash : esc(dec(v))}</b><span class="bt">${isBest ? 'best' : ''}</span></div></div>`;
      }).join('') + `</div>`;
    }
    function timingCard(p, d) {
      const [key, name] = p;
      const pd = d.platforms && d.platforms[key];
      if (!pd || !pd.posts) return platCard(p, nothing(name, `No ${name} posts in the last ${st.days} days.`));
      const conf = { good: 'Good amount of data', fair: 'Fair amount of data', low: 'Not much data yet' }[pd.confidence] || '';
      const reco = (pd.summary || []).length ? `<div class="reco"><ul>${pd.summary.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>` : '';
      const lowMsg = pd.confidence === 'low' ? `<div class="notice">There are only ${plural(pd.posts, 'post')} to go on, so treat this as a hint rather than a rule.</div>` : '';
      const days = (pd.by_weekday || []).slice().sort((a, b) => a.weekday - b.weekday);
      const bands = pd.by_band || [];
      const inner = lowMsg + reco
        + `<div class="two"><div><h4>By day of the week <small>typical post · interactions</small></h4>${barRows(days, pd.best_weekday)}</div>
           <div><h4>By time of day <small>typical post · interactions</small></h4>${barRows(bands, pd.best_band)}</div></div>`
        + `<p class="foot">“Typical” is the middle post, so one runaway post cannot flatter a day. Days and times with fewer than three posts are greyed out and never picked as best.</p>`;
      return platCard(p, inner, [plural(pd.posts, 'post'), conf].filter(Boolean).join(' · '));
    }
    function onlineChart(hours) {
      if (!Array.isArray(hours) || hours.length < 24 || !hours.some(v => isNum(v) && v > 0)) return '';
      const items = hours.slice(0, 24).map((v, h) => ({ label: String(h).padStart(2, '0') + ':00', value: isNum(v) ? v : null, tip: `${String(h).padStart(2, '0')}:00 – ${num(v)} followers online on average` }));
      return `<div class="card plat ig"><div class="phead"><h3>Instagram</h3><span class="sub">When your followers are online</span></div>${chart(items, { kind: 'bar', aria: 'Instagram followers online by hour of the day' })}<p class="foot">Average number of followers online in each hour of the day, UK time.</p></div>`;
    }
    function timingView(d) {
      return PLATS.map(p => timingCard(p, d)).join('') + onlineChart(d.instagram_followers_online_by_hour);
    }

    // ---- Content
    function contentCard(p, d) {
      const [key, name] = p;
      const pd = d.platforms && d.platforms[key];
      if (!pd || !pd.posts) return platCard(p, nothing(name, `No ${name} posts in the last ${st.days} days.`));
      const reco = (pd.summary || []).length ? `<div class="reco"><ul>${pd.summary.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>` : '';
      const topics = (pd.topics || []).slice().sort((a, b) => (b.typical_interactions || 0) - (a.typical_interactions || 0));
      const eligible = topics.filter(t => t.posts >= 3 && t.key !== 'other');
      const bestKey = eligible.length ? eligible[0].key : null;
      const topicRows = barRows(topics.map(t => Object.assign({}, t, { label: t.label })), bestKey ? topics.find(t => t.key === bestKey) : null);
      const bestPosts = topics.filter(t => t.best && t.best.text).slice(0, 5).map(t => {
        const first = String(t.best.text).split(/\r?\n/).map(s => s.trim()).find(Boolean) || '';
        return `<tr><th scope="row">${esc(t.label)}</th><td style="text-align:left;white-space:normal;min-width:220px">${esc(first.slice(0, 110))}${first.length > 110 ? '…' : ''}</td><td>${esc(dShort(t.best.date))}</td><td>${show(t.best.interactions)}</td><td>${t.best.url ? `<a href="${esc(t.best.url)}" target="_blank" rel="noopener">Open<span class="sr"> this post on ${esc(name)}</span></a>` : dash}</td></tr>`;
      }).join('');
      const bestTbl = bestPosts ? `<h4>Best post in each topic</h4><div class="scroll" tabindex="0" role="region" aria-label="Best post per topic, scrolls sideways on a small screen"><table class="t" style="min-width:560px"><thead><tr><th scope="col">Topic</th><th scope="col" style="text-align:left">Post</th><th scope="col">Date</th><th scope="col">Interactions</th><th scope="col">Link</th></tr></thead><tbody>${bestPosts}</tbody></table></div>` : '';
      const inner = reco
        + `<h4>Topics <small>typical post · interactions. A post can count under more than one topic.</small></h4>${topicRows}`
        + `<div class="two"><div><h4>Post type</h4>${barRows(pd.types || [], (pd.types || []).filter(t => t.posts >= 3).sort((a, b) => (b.typical_interactions || 0) - (a.typical_interactions || 0))[0])}</div>
           <div><h4>Length of text</h4>${barRows(pd.lengths || [], (pd.lengths || []).filter(t => t.posts >= 3).sort((a, b) => (b.typical_interactions || 0) - (a.typical_interactions || 0))[0])}</div></div>`
        + bestTbl;
      return platCard(p, inner, plural(pd.posts, 'post'));
    }
    function contentView(d) {
      return PLATS.map(p => contentCard(p, d)).join('')
        + `<p class="foot">Topics are worked out from the words in each post, so “Everything else” is posts that did not match a topic. Typical means the middle post, and a group needs at least three posts before it can be called best.</p>`;
    }

    // ---- Results (posts against ticket sales, enquiries, show-rounds, sign-ups)
    const OUTCOMES = [['tickets', 'Tickets sold'], ['enquiries', 'Wedding enquiries'], ['showrounds', 'Show-round bookings'], ['signups', 'Mailing-list sign-ups']];
    function impactView(d) {
      const t = d.totals || {};
      const series = d.series || [];
      if (!t.posts && !series.length) return `<div class="card empty">Nothing to show for the last ${st.days} days.</div>`;
      const strip = '<div class="strip">'
        + stripItem(show(t.posts), 'Posts', 'Facebook and Instagram')
        + stripItem(show(t.tickets), 'Tickets sold', isNum(t.ticket_revenue) ? esc(money(t.ticket_revenue)) + ' of sales' : '')
        + stripItem(show(t.enquiries), 'Wedding enquiries', isNum(t.enquiries_all) ? `from marketing sources, ${esc(num(t.enquiries_all))} in all` : '')
        + stripItem(show(t.showrounds), 'Show-rounds booked', '')
        + stripItem(show(t.signups), 'Mailing-list sign-ups', '')
        + '</div>';
      const picks = `<div class="picks" role="group" aria-label="Result to draw">` + OUTCOMES.map(([k, l]) => `<button type="button" class="pick" data-outcome="${k}" aria-pressed="${k === st.outcome}">${esc(l)}</button>`).join('') + '</div>';
      const label = OUTCOMES.find(o => o[0] === st.outcome)[1];
      const items = series.map(r => ({ label: dShort(r.date), value: isNum(r[st.outcome]) ? r[st.outcome] : 0, tip: `${dLong(r.date)}: ${num(r[st.outcome]) ?? 0} ${label.toLowerCase()}${r.posts ? `, ${plural(r.posts, 'post')} that day` : ''}` }));
      const cht = chart(items, {
        kind: 'bar', color: 'var(--sage,#4E5F4F)', aria: `${label} each day, with the days posts went out marked underneath`,
        extra: g => series.map((r, i) => r.posts > 0 ? `<circle cx="${g.x(i).toFixed(1)}" cy="${g.PT + g.ih + 8}" r="3.2" fill="#B03A6B"><title>${esc(dLong(r.date) + ': ' + plural(r.posts, 'post'))}</title></circle>` : '').join('')
      });
      const chartBox = `<div class="card"><h3>${esc(label)}, day by day</h3>${picks}${cht}<p class="foot"><span style="color:#B03A6B">●</span> marks a day a post went out.</p></div>`;

      const lifts = (d.lifts || []).map(l => {
        if (l.enough) {
          const dir = !isNum(l.lift_pct) ? '' : l.lift_pct > 0 ? 'up' : l.lift_pct < 0 ? 'down' : '';
          return `<div class="lift"><b>${esc(l.label)}</b><p>On ${plural(l.after_post_days, 'day')} after a relevant post there were <strong>${esc(dec(l.avg_after_post))}</strong> a day, against <strong>${esc(dec(l.avg_other))}</strong> on the other ${num(l.other_days)} days${isNum(l.lift_pct) ? ` (<span class="${dir}">${esc(signed(l.lift_pct))}%</span>)` : ''}.</p></div>`;
        }
        return `<div class="lift muted"><b>${esc(l.label)}</b><p>${esc(l.note || 'Too little data to say.')}</p></div>`;
      }).join('');
      const liftBox = lifts ? `<div class="card"><h3>Do results follow posts?</h3>${lifts}</div>` : '';

      const groups = (d.top_days || []).filter(g => (g.days || []).length).map(g => {
        const fmtV = v => g.outcome === 'tickets' ? plural(v, 'ticket') : g.outcome === 'enquiries' ? plural(v, 'enquiry', 'enquiries') : g.outcome === 'showrounds' ? plural(v, 'show-round') : plural(v, 'sign-up');
        return `<h4>${esc(g.label)}</h4>` + g.days.map(day => {
          const pb = day.posts_before || [];
          const li = pb.map(p => {
            const first = String(p.text || '').split(/\r?\n/).map(s => s.trim()).find(Boolean) || '';
            return `<li>${esc(dShort(p.date))} · ${p.kind === 'reel' ? 'Reel' : 'Post'} · ${esc((p.platforms || []).map(x => x === 'facebook' ? 'Facebook' : 'Instagram').join(' + '))}: ${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(first.slice(0, 80))}${first.length > 80 ? '…' : ''}</a>` : esc(first.slice(0, 80))}</li>`;
          }).join('');
          return `<div class="day"><div class="dh"><b>${esc(dLong(day.date))}</b><span>${esc(fmtV(day.value))}</span></div>${pb.length ? `<ul aria-label="Posts in the three days before">${li}</ul>` : `<ul><li>No post in the three days before.</li></ul>`}</div>`;
        }).join('');
      }).join('');
      const daysBox = groups ? `<div class="card"><h3>Best days, and what was posted before</h3>${groups}</div>` : '';

      const src = d.enquiry_sources || [];
      const srcBox = src.length ? `<div class="card"><h3>Where wedding enquiries came from</h3><div class="scroll" tabindex="0" role="region" aria-label="Enquiry sources"><table class="t" style="min-width:320px"><thead><tr><th scope="col">Source</th><th scope="col">Enquiries</th></tr></thead><tbody>${src.map(s => `<tr><th scope="row">${esc(s.source)}</th><td>${show(s.count)}</td></tr>`).join('')}</tbody></table></div></div>` : '';

      const notes = (d.notes || []).concat(d.caveat ? [d.caveat] : []);
      return strip + chartBox + liftBox + daysBox + srcBox + (notes.length ? `<p class="foot">${notes.map(esc).join(' ')}</p>` : '');
    }

    // ---------------------------------------------------------------- draw
    function draw() {
      const body = $('#in_body');
      if (st.err) {
        body.innerHTML = `<div class="card"><h3>Figures not available</h3><p style="margin:0 0 14px">${esc(st.err)}</p><button class="btn ghost small" id="in_retry" type="button">Try again</button></div>`;
        $('#in_retry').onclick = () => { st.err = ''; st.loaded = false; st.data = null; load(); };
        return;
      }
      if (!st.data) return;
      const fn = { trends: trendsView, timing: timingView, content: contentView, impact: impactView }[kind];
      body.innerHTML = fn(st.data);
    }

    head(); load();
    return {
      unmount() {
        st.dead = true; st.gen++;
        if (st.timer) { clearInterval(st.timer); st.timer = null; }
        el.classList.remove('ins'); el.innerHTML = '';
      }
    };
  }

  global.Insights = { mount };
})(window);
