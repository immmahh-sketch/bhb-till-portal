/* Analytics - the "Analytics" tab of Marketing Actions.
 *
 *   const a = Analytics.mount(element, { call, me, toast });   // later: a.unmount()
 *
 * How the last 30 / 60 / 90 days of Facebook and Instagram posts performed: for each platform a summary strip, then the
 * five best and five weakest posts side by side in the same columns, so they can be scanned down and across.
 * Backend (social-api): analytics.summary { days } and results.sync { days } (asks Meta for fresh figures, a batch at a time).
 * The page never waits on Meta: it draws what is stored, then fetches fresh figures in the background and redraws.
 * Uses the host page's colours and the .btn / .card / .tag / .loading / .empty / .spacer / .pagehead classes; everything
 * else is styled here under .an.
 */
(function (global) {
  'use strict';

  const CSS = `
.an .ctl{display:flex; align-items:center; gap:10px; flex-wrap:wrap}
.an .ctl label{font-size:10px; letter-spacing:var(--track-label,.18em); text-transform:uppercase; color:var(--sage-70,#7B887C)}
.an .ctl select{border:1px solid var(--mist,#e7e7e7); border-radius:8px; background:var(--white,#fff); padding:8px 12px; min-height:40px; font-size:16px; cursor:pointer}
.an .ctl .when{font-size:12px; color:var(--sage-70,#7B887C); white-space:nowrap}
.an .ctl .btn{width:auto}
.an a:focus-visible,.an select:focus-visible,.an .btn:focus-visible,.an .wrap:focus-visible{outline:2px solid var(--blue,#34546F); outline-offset:2px}
.an .sync{background:var(--blue-bg,#E7EEF5); color:var(--blue,#34546F); border-radius:10px; padding:12px 16px; margin-bottom:14px; font-size:14px}
.an .sync .prog{height:6px; background:rgba(52,84,111,.15); border-radius:99px; overflow:hidden; margin-top:8px}
.an .sync .prog i{display:block; height:100%; min-width:6%; background:var(--blue,#34546F); border-radius:99px; transition:width .4s; background-image:linear-gradient(90deg,rgba(255,255,255,0) 0,rgba(255,255,255,.35) 50%,rgba(255,255,255,0) 100%); background-size:200% 100%; animation:an-shine 1.6s linear infinite}
@keyframes an-shine{from{background-position:200% 0}to{background-position:-200% 0}}
.an .notice{background:var(--attention-bg,#F7F0E4); border-radius:8px; padding:10px 14px; margin:0 0 12px; font-size:14px}
.an .notice.bad{background:var(--alert-bg,#F6EAE8); color:var(--alert,#8C4A3F)}
.an .body{transition:opacity .15s} .an .body.busy{opacity:.45; pointer-events:none}
.an .plat{border-top:4px solid var(--pc); padding-top:16px}
.an .plat.fb{--pc:#3B5998; --pc-bg:#E9EDF5; --pc-ink:#2F4778}
.an .plat.ig{--pc:#B03A6B; --pc-bg:#F7E8EF; --pc-ink:#8F2D56}
.an .phead{display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:12px}
.an .phead h3{margin:0; display:inline-block; border-radius:999px; padding:2px 16px 3px; background:var(--pc-bg); color:var(--pc-ink)}
.an .strip{display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:10px; margin-bottom:16px}
.an .strip div{background:var(--bone,#f7f7f7); border-radius:8px; padding:10px 14px}
.an .strip b{display:block; font-family:var(--display,Georgia,serif); font-size:28px; line-height:1.05; color:var(--sage,#4E5F4F); font-weight:600}
.an .strip span{font-size:10px; letter-spacing:var(--track-label,.18em); text-transform:uppercase; color:var(--sage-70,#7B887C)}
.an .strip small{display:block; font-size:11px; color:var(--sage-70,#7B887C); margin-top:2px}
.an h4{font-family:var(--display,Georgia,serif); font-size:20px; color:var(--sage,#4E5F4F); margin:18px 0 8px; font-weight:600}
.an h4 small{font-family:var(--body,Raleway,sans-serif); font-size:12px; color:var(--sage-70,#7B887C); font-weight:400; margin-left:6px}
.an .wrap{overflow-x:auto; border:1px solid var(--mist,#e7e7e7); border-radius:8px}
.an table.t{width:100%; min-width:880px; border-collapse:separate; border-spacing:0; font-size:14px}
.an .t thead th{font-size:10px; letter-spacing:var(--track-label,.18em); text-transform:uppercase; color:var(--sage-70,#7B887C); font-weight:600; text-align:right; padding:8px 10px; background:var(--bone,#f7f7f7); white-space:nowrap; border-bottom:1px solid var(--mist,#e7e7e7)}
.an .t thead th.l{text-align:left}
.an .t td,.an .t tbody th{padding:10px; border-top:1px solid var(--mist,#e7e7e7); vertical-align:top; background:var(--white,#fff)}
.an .t tbody tr:first-child td,.an .t tbody tr:first-child th{border-top:0}
.an .t .rk{position:sticky; left:0; z-index:2; width:40px; min-width:40px; text-align:center; color:var(--sage-70,#7B887C); font-weight:600; padding-left:8px; padding-right:4px}
.an .t thead .rk{z-index:3}
.an .t .pst{position:sticky; left:40px; z-index:2; width:300px; min-width:300px; max-width:300px; text-align:left; font-weight:400; text-transform:none; letter-spacing:0; box-shadow:1px 0 0 var(--mist,#e7e7e7)}
.an .t thead .pst{z-index:3; box-shadow:1px 0 0 var(--mist,#e7e7e7)}
.an .t .num{text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums}
.an .t .ints{min-width:140px}
.an .t .ints b{font-weight:700; font-size:15px}
.an .px{display:flex; gap:10px; align-items:flex-start}
.an .px .th{flex:none; width:48px; height:48px; border-radius:8px; object-fit:cover; background:var(--mist,#e7e7e7); display:block}
.an .px .th.ph{background:var(--sage-10,#EDEFED); color:var(--sage-70,#7B887C); font-size:10px; display:flex; align-items:center; justify-content:center; text-align:center; line-height:1.1; letter-spacing:.04em; text-transform:uppercase}
.an .px .th.bad{visibility:hidden}
.an .px .tx{min-width:0; flex:1}
.an .px .dl{display:flex; gap:6px 8px; align-items:center; flex-wrap:wrap; font-size:12px; color:var(--sage-70,#7B887C)}
.an .px .ln{margin-top:2px; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; word-break:break-word; line-height:1.35}
.an .px a{font-size:12px; font-weight:600; color:var(--blue,#34546F)}
.an .barx{display:block; height:6px; border-radius:99px; background:var(--mist,#e7e7e7); margin-top:6px; overflow:hidden; min-width:90px}
.an .barx i{display:block; height:100%; background:var(--pc); border-radius:99px}
.an .na{color:var(--sage-70,#7B887C)}
.an .none{padding:14px 4px; color:var(--sage-70,#7B887C); font-size:14px}
.an .sk{border-radius:8px; background:linear-gradient(90deg,var(--mist,#e7e7e7) 0,#f2f2f2 50%,var(--mist,#e7e7e7) 100%); background-size:200% 100%; animation:an-shine 1.4s linear infinite}
.an .foot{font-size:12px; color:var(--sage-70,#7B887C); margin:4px 2px 0; max-width:760px}
.an .sr{position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap}
@media (prefers-reduced-motion:reduce){ .an .sync .prog i,.an .sk{animation:none} }
@media (max-width:760px){
  .an .ctl{width:100%} .an .ctl .spacer{display:none}
  .an .strip b{font-size:24px}
  .an .wrap{overflow:visible; border:0; border-radius:0}
  .an table.t,.an .t tbody,.an .t tr,.an .t td,.an .t tbody th{display:block; min-width:0}
  .an table.t{width:100%; font-size:14px}
  .an .t thead{position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0)}
  .an .t tr{position:relative; display:grid; grid-template-columns:repeat(3,1fr); gap:8px; padding:12px 4px 12px 0; border-top:1px solid var(--mist,#e7e7e7)}
  .an .t tbody tr:first-child{border-top:0}
  .an .t td,.an .t tbody th{border:0; padding:0; background:transparent}
  .an .t .rk{position:absolute; top:12px; left:0; width:28px; min-width:0; text-align:left; padding:0}
  .an .t .pst{position:static; width:auto; min-width:0; max-width:none; grid-column:1/-1; padding-left:30px; box-shadow:none}
  .an .t .ints{grid-column:1/-1; min-width:0; display:flex; align-items:center; gap:10px}
  .an .t .ints::before{margin:0!important; display:block!important; flex:none}
  .an .t .ints .barx{flex:1; margin-top:0}
  .an .t .num{text-align:left}
  .an .t td[data-label]::before{content:attr(data-label); display:block; font-size:10px; letter-spacing:var(--track-label,.18em); text-transform:uppercase; color:var(--sage-70,#7B887C); margin-bottom:1px}
  .an .t .ints b{font-size:18px}
  .an .barx{min-width:0}
}
`;

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isNum = v => typeof v === 'number' && isFinite(v);
  const num = v => isNum(v) ? v.toLocaleString('en-GB', { maximumFractionDigits: 0 }) : null;
  const avg = v => isNum(v) ? v.toLocaleString('en-GB', { maximumFractionDigits: v < 10 ? 1 : 0 }) : null;
  const pct = v => isNum(v) ? (v * 100).toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%' : null;
  const clock = d => { try { return d.toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
  const dayLabel = d => { try { return new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return String(d || ''); } };
  const stamp = iso => { try { return new Date(iso).toLocaleString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace(',', ''); } catch (e) { return ''; } };
  const na = () => `<span class="na" title="Meta does not give this figure">&ndash;</span>`;
  const show = (v, f) => { const s = (f || num)(v); return s === null ? na() : esc(s); };

  const PLATS = [
    ['facebook', 'Facebook', 'fb', [['likes', 'Likes'], ['comments', 'Comments'], ['shares', 'Shares'], ['reach', 'Reach'], ['views', 'Views'], ['clicks', 'Clicks']]],
    ['instagram', 'Instagram', 'ig', [['likes', 'Likes'], ['comments', 'Comments'], ['shares', 'Shares'], ['saves', 'Saves'], ['reach', 'Reach'], ['views', 'Views']]]
  ];
  const MAX_ROUNDS = 30, REFRESH_MS = 5 * 60 * 1000;

  function mount(el, ctx) {
    if (!document.getElementById('an-css')) { const s = document.createElement('style'); s.id = 'an-css'; s.textContent = CSS; document.head.appendChild(s); }
    const call = ctx.call, toast = ctx.toast || (() => {});
    const st = { days: 90, data: null, loaded: false, dead: false, loadGen: 0, syncGen: 0, syncing: false, sync: null, gaveUp: false, syncErr: '', notes: [], err: '', when: '', stale: false, timer: null };
    el.classList.add('an');

    el.innerHTML = `
      <div class="pagehead"><h2>Analytics</h2><span class="hint" id="an_hint"></span><span class="spacer"></span>
        <div class="ctl"><label for="an_days">Period</label>
          <select id="an_days"><option value="30">Last 30 days</option><option value="60">Last 60 days</option><option value="90" selected>Last 90 days</option></select>
          <span class="when" id="an_when" aria-live="off"></span>
          <button class="btn ghost small" id="an_ref" type="button">Refresh now</button></div></div>
      <div id="an_sync" role="status" aria-live="polite"></div>
      <div class="body" id="an_body"></div>`;
    const $ = s => el.querySelector(s);
    const onError = e => { if (e.target && e.target.tagName === 'IMG') e.target.classList.add('bad'); };
    el.addEventListener('error', onError, true);
    const onVis = () => { if (!document.hidden && st.loaded && !st.syncing && Date.now() - st.lastAt > REFRESH_MS) tick(); };
    document.addEventListener('visibilitychange', onVis);

    $('#an_days').onchange = e => {
      st.days = Number(e.target.value) || 90;
      st.syncGen++; st.syncing = false; st.sync = null; st.gaveUp = false; st.syncErr = ''; st.notes = [];
      drawSync(); drawHead();
      loadSummary({ busy: true });
    };
    $('#an_ref').onclick = () => { if (!st.syncing) runSync(true); };
    st.timer = setInterval(tick, REFRESH_MS);

    // ---------------------------------------------------------------- data
    function tick() {
      if (st.dead || document.hidden || st.syncing || !st.loaded) return;
      st.gaveUp = false;
      loadSummary({ quiet: true });
    }

    async function loadSummary(o) {
      o = o || {};
      const gen = ++st.loadGen, days = st.days;
      if (!st.loaded) drawSkeleton(); else if (o.busy) $('#an_body').classList.add('busy');
      let d;
      try { d = await call('analytics.summary', { days }); }
      catch (e) {
        if (st.dead || gen !== st.loadGen) return;
        $('#an_body').classList.remove('busy');
        if (!st.loaded || !st.data) { st.err = e.message || 'Could not load the figures.'; drawBody(); }
        else { st.stale = true; drawHead(); }
        return;
      }
      if (st.dead || gen !== st.loadGen) return;
      st.data = d || {}; st.err = ''; st.loaded = true; st.stale = false; st.lastAt = Date.now();
      const asOf = st.data.as_of ? new Date(st.data.as_of) : null;
      st.when = clock(asOf && !isNaN(asOf) ? asOf : new Date());
      $('#an_body').classList.remove('busy');
      drawHead(); drawBody(); drawSync();
      if (!o.noSync && !st.syncing && !st.gaveUp && Number(st.data.pending_sync) > 0) runSync(false);
    }

    // Fetch fresh figures from Meta a batch at a time. Never blocks the page; redraws every second round and at the end.
    async function runSync(manual) {
      const run = ++st.syncGen;
      const pending = Number(st.data && st.data.pending_sync) || 0;
      st.syncing = true; st.syncErr = ''; st.gaveUp = false; st.notes = [];
      st.sync = { total: pending, left: pending, manual: !!manual };
      drawSync(); drawHead();
      let ok = true;
      try {
        for (let round = 1; round <= MAX_ROUNDS; round++) {
          const r = await call('results.sync', { days: st.days });
          if (st.dead || run !== st.syncGen) return;
          const left = Number(r && r.remaining) || 0;
          (r && r.notes || []).forEach(n => { if (n && !st.notes.includes(n)) st.notes.push(n); });
          st.sync.left = left; if (left > st.sync.total) st.sync.total = left;
          drawSync();
          if (left <= 0) break;
          if (!Number(r && r.processed)) break;
          if (round % 2 === 0) await loadSummary({ quiet: true, noSync: true });
          if (st.dead || run !== st.syncGen) return;
        }
      } catch (e) {
        if (st.dead || run !== st.syncGen) return;
        ok = false; st.syncErr = e.message || 'Facebook and Instagram did not answer.';
        if (manual) toast(st.syncErr, true);
      } finally {
        if (run === st.syncGen) { st.syncing = false; st.sync = null; st.gaveUp = true; drawSync(); drawHead(); }
      }
      if (st.dead || run !== st.syncGen) return;
      await loadSummary({ quiet: true, noSync: true });
      if (manual && ok && !st.dead) toast('Figures updated.');
    }

    // ---------------------------------------------------------------- drawing
    function drawHead() {
      $('#an_hint').textContent = `How the last ${st.days} days of Facebook and Instagram posts performed`;
      $('#an_days').value = String(st.days);
      $('#an_when').textContent = st.when ? 'Updated ' + st.when + (st.stale ? ' (could not refresh just now)' : '') : '';
      const b = $('#an_ref'); b.disabled = st.syncing; b.textContent = st.syncing ? 'Fetching…' : 'Refresh now';
    }

    function drawSync() {
      const box = $('#an_sync'), s = st.sync;
      let h = '';
      if (s) {
        const known = s.total > 0, done = known ? Math.max(0, Math.min(100, Math.round((s.total - s.left) / s.total * 100))) : 0;
        const text = s.manual && !known ? 'Asking Facebook and Instagram for fresh figures…'
          : `Fetching the latest figures from Facebook and Instagram${s.left > 0 ? ` (${num(s.left)} left)` : ''}…`;
        h += `<div class="sync">${esc(text)}<div class="prog" role="progressbar" aria-label="Fetching figures" aria-valuemin="0" aria-valuemax="100"${known ? ` aria-valuenow="${done}"` : ''}><i style="width:${known ? Math.max(6, done) : 100}%"></i></div></div>`;
      } else if (st.syncErr) {
        h += `<div class="notice">Fresh figures could not be fetched just now (${esc(String(st.syncErr).replace(/[.\s]+$/, ''))}). The figures below are the latest we hold.</div>`;
      } else if (st.notes.length) {
        h += `<div class="notice">${st.notes.map(esc).join(' ')}</div>`;
      }
      box.innerHTML = h;
    }

    function drawSkeleton() {
      $('#an_body').innerHTML = [0, 1].map(() => `<div class="card plat" aria-hidden="true"><div class="sk" style="height:26px;width:160px;margin-bottom:16px"></div>
        <div class="sk" style="height:64px;margin-bottom:16px"></div><div class="sk" style="height:200px"></div></div>`).join('')
        + `<div class="sr" role="status">Loading the figures…</div>`;
    }

    const bySize = (a, b) => (b.interactions - a.interactions) || String(b.date).localeCompare(String(a.date));

    function postCell(it, plat) {
      const first = String(it.text || '').split(/\r?\n/).map(s => s.trim()).find(Boolean) || '';
      const kind = it.kind === 'reel' ? 'Reel' : 'Post';
      const thumb = it.thumb ? `<img class="th" src="${esc(it.thumb)}" alt="" loading="lazy">` : `<span class="th ph" aria-hidden="true">${kind}</span>`;
      return `<div class="px">${thumb}<div class="tx">
        <div class="dl"><span>${esc(dayLabel(it.date))}${it.time ? ' · ' + esc(String(it.time).slice(0, 5)) : ''}</span><span class="tag${it.kind === 'reel' ? ' in_progress' : ''}">${kind}</span>
          ${it.url ? `<a href="${esc(it.url)}" target="_blank" rel="noopener">Open<span class="sr"> this ${kind.toLowerCase()} on ${esc(plat)}</span></a>` : ''}</div>
        <div class="ln">${first ? esc(first) : '<span class="na">No text</span>'}</div></div></div>`;
    }

    function rows(list, cols, max, plat) {
      return list.map((it, i) => {
        const m = it.metrics || {}, v = isNum(it.interactions) ? it.interactions : 0;
        const w = max > 0 ? Math.max(v > 0 ? 2 : 0, Math.round(v / max * 100)) : 0;
        return `<tr><td class="rk">${i + 1}</td><th scope="row" class="pst">${postCell(it, plat)}</th>
          <td class="num ints" data-label="Interactions"${it.synced_at ? ` title="Figures fetched ${esc(stamp(it.synced_at))}"` : ''}><b>${esc(num(v))}</b><span class="barx" aria-hidden="true"><i style="width:${w}%"></i></span></td>
          ${cols.map(([k, l]) => `<td class="num" data-label="${esc(l)}">${show(m[k])}</td>`).join('')}
          <td class="num" data-label="Eng. rate">${show(it.rate, pct)}</td></tr>`;
      }).join('');
    }

    function table(title, list, cols, max, plat, note) {
      const n = list.length;
      if (!n) return `<h4>${esc(title)} <small>${esc(note)}</small></h4><div class="none">No posts to list here.</div>`;
      const heads = cols.map(([, l]) => `<th scope="col">${esc(l)}</th>`).join('');
      return `<h4>${esc(title + ' ' + (n < 5 ? n : 5))}<small>${esc(note)}</small></h4>
        <div class="wrap" tabindex="0" role="region" aria-label="${esc(plat + ' ' + title.toLowerCase() + ' posts, scrolls sideways on a small screen')}">
        <table class="t"><caption class="sr">${esc(plat + ': ' + title.toLowerCase() + ' posts by interactions')}</caption>
          <thead><tr><th scope="col" class="rk"><span class="sr">Rank</span><span aria-hidden="true">#</span></th><th scope="col" class="pst l">Post</th><th scope="col">Interactions</th>${heads}<th scope="col">Eng. rate</th></tr></thead>
          <tbody>${rows(list, cols, max, plat)}</tbody></table></div>`;
    }

    function platHtml([key, name, cls, cols], p) {
      const head = `<div class="phead"><h3>${name}</h3></div>`;
      if (!p) return `<div class="card plat ${cls}">${head}<div class="none">Nothing to show for ${name} yet.</div></div>`;
      const posts = Number(p.posts) || 0, withF = Number(p.with_figures) || 0, t = p.totals || {};
      if (!posts) return `<div class="card plat ${cls}">${head}<div class="none">No posts in the last ${st.days} days.</div></div>`;
      const top = (p.top || []).slice().sort(bySize);
      const bottom = (p.bottom || []).slice().sort((a, b) => (a.interactions - b.interactions) || String(b.date).localeCompare(String(a.date)));
      const max = Math.max(0, ...top.concat(bottom).map(i => isNum(i.interactions) ? i.interactions : 0));
      const strip = `<div class="strip">
        <div><b>${esc(num(posts))}</b><span>Posts</span>${withF < posts ? `<small>${esc(num(withF))} with figures</small>` : ''}</div>
        <div><b>${withF ? show(t.interactions) : na()}</b><span>Interactions</span></div>
        <div><b>${withF ? show(t.avg_interactions, avg) : na()}</b><span>Average per post</span></div>
        ${withF && isNum(t.reach) ? `<div><b>${esc(num(t.reach))}</b><span>Total reach</span></div>` : ''}</div>`;
      let inner;
      if (!withF || (!top.length && !bottom.length)) inner = `<div class="none">Figures are still being fetched.</div>`;
      else inner = table('Top', top, cols, max, name, 'Most interactions first') + table('Bottom', bottom, cols, max, name, 'Fewest interactions first');
      return `<div class="card plat ${cls}">${head}${strip}${p.notice ? `<div class="notice">${esc(p.notice)}</div>` : ''}${inner}</div>`;
    }

    function drawBody() {
      const body = $('#an_body');
      if (st.err) {
        body.innerHTML = `<div class="card"><h3>Figures not available</h3><p style="margin:0 0 14px">${esc(st.err)}</p><button class="btn ghost small" id="an_retry" type="button">Try again</button></div>`;
        $('#an_retry').onclick = () => { st.loaded = false; st.data = null; st.err = ''; loadSummary(); };
        return;
      }
      const pl = (st.data && st.data.platforms) || {};
      const any = PLATS.some(([k]) => pl[k] && Number(pl[k].posts) > 0);
      if (!any) { body.innerHTML = `<div class="card empty">No posts in the last ${st.days} days.</div>`; return; }
      body.innerHTML = PLATS.map(p => platHtml(p, pl[p[0]])).join('')
        + `<p class="foot">Interactions are likes + comments + shares + saves. Engagement rate is interactions divided by reach. Facebook and Instagram report figures differently, so compare posts within a platform rather than across.</p>`;
    }

    drawHead(); drawSync();
    loadSummary();

    return {
      unmount() {
        st.dead = true; st.syncGen++; st.loadGen++;
        if (st.timer) { clearInterval(st.timer); st.timer = null; }
        document.removeEventListener('visibilitychange', onVis);
        el.removeEventListener('error', onError, true);
        el.classList.remove('an'); el.innerHTML = '';
      }
    };
  }

  global.Analytics = { mount };
})(window);
