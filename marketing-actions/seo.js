/* SEO audit - the "SEO audit" tab of Marketing Actions.
 *
 *   const a = SeoAudit.mount(element, { call, toast }); // later: a.unmount()
 *
 * A weekly crawl of the public website (every page, link, picture, title, description, heading and address) plus search ranking checks, written up as a ranked list of suggestions.
 * Sub-views: Report, Pages, Links, Rankings, Settings. Backend: seo-audit-api (bootstrap, status, report, issues, pages, page, links, rankings, run.start, run.cancel, keywords.save,
 * keyword.remove, settings.save, email.test). Uses the host page's .btn / .tag / .loading / .empty / .pagehead classes.
 */
(function (global) {
  'use strict';
  const CSS = `
.seo .strip{display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:10px; margin-bottom:14px}
.seo .strip div{background:var(--bone,#F8F8F8); border-radius:8px; padding:10px 14px}
.seo .strip b{display:block; font-family:var(--display,Georgia,serif); font-size:26px; line-height:1.05; color:var(--sage,#4D604F); font-weight:600}
.seo .strip span{font-size:10px; letter-spacing:var(--track-label,.18em); text-transform:uppercase; color:var(--sage-70,#7B887C)}
.seo .nav,.seo .ctl{display:flex; gap:8px 10px; align-items:center; flex-wrap:wrap; margin:0 0 14px}
.seo .chip{border:1px solid var(--mist,#e7e7e7); background:var(--white,#fff); border-radius:999px; padding:7px 14px; cursor:pointer; font-size:13px; min-height:38px}
.seo .chip[aria-pressed="true"]{background:var(--sage,#4D604F); border-color:var(--sage,#4D604F); color:#fff; font-weight:600}
.seo .wrap{overflow-x:auto; border:1px solid var(--mist,#e7e7e7); border-radius:8px; margin-bottom:18px}
.seo table.t{width:100%; border-collapse:separate; border-spacing:0; font-size:13px}
.seo .t th{font-size:10px; letter-spacing:var(--track-label,.18em); text-transform:uppercase; color:var(--sage-70,#7B887C); font-weight:600; text-align:left; padding:8px 10px; background:var(--bone,#F8F8F8); white-space:nowrap}
.seo .t td{padding:8px 10px; border-top:1px solid var(--mist,#e7e7e7); background:var(--white,#fff); vertical-align:top}
.seo .t tr.click{cursor:pointer} .seo .t tr.click:hover td{background:var(--bone,#F8F8F8)}
.seo .t td.num{text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums}
.seo .muted{color:var(--sage-70,#7B887C)} .seo .small{font-size:12px}
.seo .note{background:var(--attention-bg,#F7F0E4); border-radius:8px; padding:10px 14px; margin:0 0 14px; font-size:14px}
.seo .note.bad{background:var(--alert-bg,#F6EAE8); color:var(--alert,#8C4A3F)}
.seo .score{display:flex; gap:18px; align-items:center; flex-wrap:wrap; margin:0 0 14px}
.seo .score .big{font-family:var(--display,Georgia,serif); font-size:64px; line-height:1; color:var(--sage,#4D604F); font-weight:600}
.seo .score .big small{font-size:20px; color:var(--sage-70,#7B887C)}
.seo .act{border:1px solid var(--mist,#e7e7e7); border-radius:8px; margin:0 0 8px; background:var(--white,#fff)}
.seo .act summary{cursor:pointer; padding:10px 14px; display:flex; gap:10px; align-items:center; flex-wrap:wrap; list-style:none}
.seo .act summary::-webkit-details-marker{display:none}
.seo .act summary b{flex:1 1 280px}
.seo .act .body{padding:0 14px 12px; font-size:14px}
.seo .act .body p{margin:6px 0}
.seo .act ul{margin:6px 0 0; padding-left:18px; font-size:13px} .seo .act li{margin:3px 0; word-break:break-word}
.seo .sev{display:inline-block; font-size:10px; letter-spacing:.12em; text-transform:uppercase; border-radius:4px; padding:2px 7px; font-weight:600}
.seo .sev.high{background:var(--alert-bg,#F6EAE8); color:var(--alert,#8C4A3F)} .seo .sev.medium{background:var(--attention-bg,#F7F0E4); color:#7a5b1f} .seo .sev.low{background:var(--bone,#F8F8F8); color:var(--sage-70,#7B887C)}
.seo .bar{height:8px; background:var(--mist,#e7e7e7); border-radius:4px; overflow:hidden; margin:6px 0} .seo .bar i{display:block; height:100%; background:var(--sage,#4D604F)}
.seo .ok{color:var(--sage,#4D604F); font-weight:600} .seo .no{color:var(--alert,#8C4A3F); font-weight:600}
.seo .grid2{display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:14px; margin-bottom:14px}
.seo .card{border:1px solid var(--mist,#e7e7e7); border-radius:8px; padding:12px 14px; background:var(--white,#fff)}
.seo .card h3{margin:0 0 8px; font-size:15px}
.seo input[type=text],.seo input[type=number],.seo select{border:1px solid var(--mist,#e7e7e7); border-radius:6px; padding:8px 10px; font-size:14px; min-height:38px; max-width:100%}
.seo .url{word-break:break-all}
`;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const when = t => { if (!t) return ''; const d = new Date(t); return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); };
  const day = t => { const d = new Date(t); return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
  const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const STAGE = { discover: 'Reading the sitemap and site basics', pages: 'Reading every page', links: 'Checking every link and picture', rankings: 'Checking search rankings', analyse: 'Writing the report', done: 'Finished' };
  const link = u => `<a class="url" href="${esc(u)}" target="_blank" rel="noopener">${esc(String(u).replace(/^https?:\/\/(www\.)?blackhorsebeamish\.co\.uk/, '') || '/')}</a>`;
  const pathOnly = u => String(u).replace(/^https?:\/\/(www\.)?blackhorsebeamish\.co\.uk/, '') || '/';

  function mount(el, ctx) {
    if (!document.getElementById('seo-css')) { const s = document.createElement('style'); s.id = 'seo-css'; s.textContent = CSS; document.head.appendChild(s); }
    const st = { dead: false, view: 'report', boot: null, rep: null, runId: '', pages: null, pfilter: 'issues', pq: '', open: '', links: null, lkind: 'bad', rank: null, timer: null, cat: 'all', issuesFor: {}, busy: false };
    const root = () => el.querySelector('.seo');
    el.innerHTML = `<div class="seo"><div class="loading">Loading the audit…</div></div>`;

    async function load(keepView) {
      try {
        st.boot = await ctx.call('bootstrap'); if (st.dead) return;
        st.rep = await ctx.call('report', st.runId ? { run_id: st.runId } : {}); if (st.dead) return;
        st.pages = null; st.links = null; st.rank = null; st.issuesFor = {}; st.open = '';
        if (!keepView) st.view = 'report';
        poll(); draw();
      } catch (e) { if (!st.dead) el.innerHTML = `<div class="seo"><div class="note bad">${esc(e.message)}</div><button class="btn" id="seoRetry">Try again</button></div>`; const b = el.querySelector('#seoRetry'); if (b) b.onclick = () => load(); }
    }
    function poll() {
      clearTimeout(st.timer);
      if (st.dead || !st.boot || !st.boot.running) return;
      st.timer = setTimeout(async () => {
        try { const r = await ctx.call('status'); if (st.dead) return; const was = !!st.boot.running; st.boot.running = r.running;
          if (was && !r.running) { ctx.toast('The audit has finished.'); st.runId = ''; await load(true); return; }
          const bar = el.querySelector('#seoRun'); if (bar) bar.innerHTML = runBox(); } catch (e) { /* try again next time */ }
        poll();
      }, 5000);
    }
    function runBox() {
      const r = st.boot.running; if (!r) return '';
      const pct = r.stage === 'pages' && r.pages_total ? Math.round(100 * r.pages_done / r.pages_total) : r.stage === 'links' && r.links_total ? Math.round(100 * r.links_done / r.links_total) : null;
      const detail = r.stage === 'pages' ? `${r.pages_done} of ${r.pages_total} pages` : r.stage === 'links' ? `${r.links_done} of ${r.links_total} links and pictures` : '';
      return `<div class="note"><b>An audit is running</b> (started ${esc(when(r.started_at))}). ${esc(STAGE[r.stage] || r.stage)}${detail ? ': ' + esc(detail) : ''}.${pct !== null ? `<div class="bar"><i style="width:${pct}%"></i></div>` : ''}<span class="muted small">This takes about 5 to 15 minutes. You can leave this page: the report appears here when it is ready.</span> <button class="btn ghost small" id="seoStop">Stop it</button></div>`;
    }
    function nav() {
      return `<div class="nav">${[['report', 'Report'], ['pages', 'Pages'], ['links', 'Links and pictures'], ['rankings', 'Rankings'], ['settings', 'Settings']].map(([k, l]) => `<button class="chip" data-v="${k}" aria-pressed="${st.view === k}">${l}</button>`).join('')}</div>`;
    }
    function head() {
      const r = st.rep && st.rep.run;
      return `<div class="pagehead"><h2>SEO audit</h2><span class="hint">${r ? `Audit of ${esc(r.site.replace(/^https?:\/\//, ''))}, ${esc(when(r.finished_at || r.started_at))}.` : 'A weekly check of the whole website.'}</span><span class="sp"></span>${st.boot.running ? '' : `<button class="btn" id="seoStart">Run an audit now</button>`}</div><div id="seoRun">${runBox()}</div>${nav()}`;
    }

    // ---------------------------------------------------------------- report
    function reportView() {
      const rep = st.rep, sm = rep && rep.summary;
      if (!sm) return `<div class="empty">${st.boot.running ? 'The first audit is running. The report appears here when it is ready.' : 'No audit has been run yet. Press "Run an audit now" to read the whole website, or wait for the Monday morning one.'}</div>`;
      const c = sm.compare, hist = rep.history || [];
      const cats = ['all', ...Array.from(new Set(sm.actions.map(a => a.category)))];
      const acts = sm.actions.filter(a => st.cat === 'all' || a.category === st.cat);
      const sc = sm.site || {};
      const tick = (v, yes, no) => v === true ? `<span class="ok">${yes}</span>` : v === false ? `<span class="no">${no}</span>` : '<span class="muted">not checked</span>';
      const spark = hist.length > 1 ? (() => { const w = 260, h = 50, pts = hist.map((p, i) => [8 + i * (w - 16) / (hist.length - 1), h - 6 - (h - 12) * (p.score || 0) / 100]); return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Score by week"><polyline fill="none" stroke="#4D604F" stroke-width="2" points="${pts.map(p => p.join(',')).join(' ')}"/>${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="#4D604F"><title>${esc(day(hist[i].started_at))}: ${hist[i].score}</title></circle>`).join('')}</svg>`; })() : '';
      return `<div class="score"><div class="big">${sm.score}<small>/100</small></div><div>${c ? `<div><b>${c.score_delta > 0 ? '+' : ''}${c.score_delta}</b> since the last audit</div><div class="small muted">${c.new_issues} new problems, ${c.fixed_issues} fixed</div>` : '<div class="small muted">First audit: next week shows what changed.</div>'}<div class="small muted">An indicative health score, not a Google score.</div></div>${spark}</div>
        <div class="strip"><div><b>${sm.pages_ok}</b><span>Pages read${sm.pages_error ? ` (${sm.pages_error} failed)` : ''}</span></div><div><b>${sm.links_checked}</b><span>Links and pictures checked</span></div><div><b>${sm.severity.high}</b><span>High priority</span></div><div><b>${sm.severity.medium}</b><span>Medium</span></div><div><b>${sm.severity.low}</b><span>Low</span></div><div><b>${sm.avg_words}</b><span>Average words a page</span></div><div><b>${sm.images_no_alt}/${sm.images}</b><span>Pictures with no alt text</span></div><div><b>${(sm.avg_ms / 1000).toFixed(1)}s</b><span>Average page start</span></div></div>
        <div class="card" style="margin-bottom:14px"><h3>Site basics</h3><div class="small">robots.txt: ${tick(sc.robots_ok, 'found', 'missing')} &middot; Sitemap: ${tick(sc.sitemap_ok, 'found', 'missing')} &middot; http goes to https: ${tick(sc.https_redirect, 'yes', 'no')} &middot; One address only (www): ${tick(sc.www_consistent, 'yes', 'no')} &middot; Missing pages return 404: ${tick(sc.soft404 === null ? null : !sc.soft404, 'yes', 'no')}</div></div>
        <h3 style="margin:0 0 8px">Suggestions, most important first</h3>
        <div class="ctl">${cats.map(k => `<button class="chip" data-cat="${esc(k)}" aria-pressed="${st.cat === k}">${k === 'all' ? 'Everything' : esc(k)}</button>`).join('')} <span class="sp" style="flex:1"></span><button class="btn ghost small" id="seoMail">Email me this report</button></div>
        ${acts.map(a => `<details class="act" data-code="${esc(a.code)}"><summary><span class="sev ${a.severity}">${a.severity}</span><b>${esc(a.title)}</b><span class="small muted">${esc(a.category)} &middot; ${a.pages} page${a.pages === 1 ? '' : 's'}${a.count !== a.pages ? `, ${a.count} cases` : ''}</span></summary>
          <div class="body"><p><b>Why it matters.</b> ${esc(a.why)}</p><p><b>How to fix it.</b> ${esc(a.how)}</p>
          <ul>${a.examples.map(e => `<li>${link(e.url)}: ${esc(e.message)}</li>`).join('')}</ul>
          ${a.count > a.examples.length ? `<p><button class="btn ghost small" data-all="${esc(a.code)}">Show all ${a.count}</button></p><div data-allbox="${esc(a.code)}"></div>` : ''}</div></details>`).join('') || '<div class="empty">Nothing to suggest here.</div>'}
        ${rep.run.status === 'done' ? '' : `<div class="note bad">${esc(rep.run.error || 'This audit did not finish.')}</div>`}
        <p class="small muted">Past audits: <select id="seoRuns">${st.boot.runs.filter(r => r.status === 'done').map(r => `<option value="${esc(r.id)}" ${rep.run.id === r.id ? 'selected' : ''}>${esc(day(r.started_at))}: ${r.score}/100</option>`).join('')}</select> The full detail of the last 6 audits is kept.</p>`;
    }

    // ---------------------------------------------------------------- pages
    async function ensurePages() { if (st.pages) return; const r = await ctx.call('pages', st.runId ? { run_id: st.runId } : {}); st.pages = r.pages; }
    function pagesView() {
      if (!st.pages) return `<div class="loading">Loading the pages…</div>`;
      const f = st.pfilter, q = st.pq.trim().toLowerCase();
      const flt = { all: () => true, issues: p => p.issues.h + p.issues.m > 0 && !p.private, errors: p => !p.status || p.status >= 400, nodesc: p => p.desc_len === 0 && !p.private, thin: p => p.words !== null && p.words < 300 && !p.private, notsitemap: p => !p.in_sitemap, slow: p => (p.ms || 0) > 1500 };
      const rows = st.pages.filter(flt[f] || flt.all).filter(p => !q || (p.path + ' ' + p.title).toLowerCase().includes(q)).sort((a, b) => (b.issues.h * 100 + b.issues.m * 10 + b.issues.l) - (a.issues.h * 100 + a.issues.m * 10 + a.issues.l));
      return `<div class="ctl">${[['issues', 'With problems'], ['all', 'All'], ['errors', 'Errors'], ['nodesc', 'No description'], ['thin', 'Under 300 words'], ['slow', 'Slow'], ['notsitemap', 'Not in sitemap']].map(([k, l]) => `<button class="chip" data-pf="${k}" aria-pressed="${f === k}">${l}</button>`).join('')}<input type="text" id="seoPq" placeholder="Search page or title" value="${esc(st.pq)}"></div>
        <div class="wrap"><table class="t"><thead><tr><th>Page</th><th>Status</th><th>Title</th><th>Desc.</th><th>H1</th><th>Words</th><th>Pictures</th><th>Links</th><th>Links in</th><th>Start</th><th>Problems</th></tr></thead><tbody>
        ${rows.map(p => `<tr class="click" data-pg="${esc(p.url)}"><td class="url"><b>${esc(p.path)}</b>${p.private ? ' <span class="tag">private?</span>' : ''}<div class="small muted">${esc((p.title || '').slice(0, 70))}</div></td><td class="num ${p.status && p.status < 400 ? '' : 'no'}">${p.status || 'error'}</td><td class="num ${p.title_len > 60 || (p.title_len && p.title_len < 25) || !p.title_len ? 'no' : ''}">${p.title_len}</td><td class="num ${p.desc_len > 160 || p.desc_len < 70 ? 'no' : ''}">${p.desc_len}</td><td class="num ${p.h1 === 1 ? '' : 'no'}">${p.h1 === null ? '' : p.h1}</td><td class="num">${p.words === null ? '' : p.words}</td><td class="num">${p.images === null ? '' : p.images}${p.no_alt ? ` <span class="no">(${p.no_alt} no alt)</span>` : ''}</td><td class="num">${p.links === null ? '' : p.links}</td><td class="num">${p.inlinks}</td><td class="num">${p.ms ? (p.ms / 1000).toFixed(1) + 's' : ''}</td><td class="num">${p.issues.h ? `<span class="sev high">${p.issues.h}</span> ` : ''}${p.issues.m ? `<span class="sev medium">${p.issues.m}</span> ` : ''}${p.issues.l ? `<span class="sev low">${p.issues.l}</span>` : ''}</td></tr>
        ${st.open === p.url ? `<tr><td colspan="11" id="seoDetail"><div class="loading">Loading…</div></td></tr>` : ''}`).join('') || `<tr><td colspan="11" class="empty">Nothing matches.</td></tr>`}</tbody></table></div><p class="small muted">${rows.length} of ${st.pages.length} pages. Title should be 25 to 60 characters, description 70 to 160, one H1. Click a page for its details.</p>`;
    }
    async function openPage(url) {
      st.open = st.open === url ? '' : url; draw(); if (!st.open) return;
      try {
        const r = await ctx.call('page', { url, ...(st.runId ? { run_id: st.runId } : {}) }), d = r.page.data || {}, box = el.querySelector('#seoDetail'); if (!box) return;
        box.innerHTML = `<div class="grid2"><div><p><b>Title:</b> ${esc(d.title || '(none)')}</p><p><b>Description:</b> ${esc(d.description || '(none)')}</p><p><b>Headings:</b></p><ul class="small">${(d.h || []).slice(0, 14).map(h => `<li>H${h.l}: ${esc(h.t)}</li>`).join('') || '<li>none</li>'}</ul><p class="small"><b>Canonical:</b> ${esc(d.canonical || 'none')} &middot; <b>Schema:</b> ${esc((d.schema || []).join(', ') || 'none')} &middot; <b>Captions:</b> ${d.captions || 0} &middot; <a href="${esc(url)}" target="_blank" rel="noopener">Open the page</a></p></div>
          <div><p><b>What to fix on this page</b></p><ul class="small">${r.issues.map(i => `<li><span class="sev ${i.severity}">${i.severity}</span> ${esc(i.message)}</li>`).join('') || '<li>Nothing.</li>'}</ul><p><b>Pages linking here</b> (${r.inbound.length}${r.inbound.length >= 30 ? '+' : ''})</p><ul class="small">${r.inbound.slice(0, 8).map(i => `<li>${link(i.from_url)}${i.anchor ? ` "${esc(i.anchor)}"` : ''}</li>`).join('') || '<li>none</li>'}</ul></div></div>`;
      } catch (e) { ctx.toast(e.message, true); }
    }

    // ---------------------------------------------------------------- links
    async function ensureLinks() { if (st.links && st.links.kind === st.lkind) return; const r = await ctx.call('links', { kind: st.lkind, ...(st.runId ? { run_id: st.runId } : {}) }); st.links = { kind: st.lkind, rows: r.links, total: r.total }; }
    function linksView() {
      const k = st.lkind;
      const chips = `<div class="ctl">${[['bad', 'Broken'], ['redirect', 'Redirecting'], ['images', 'Pictures'], ['external', 'Other websites'], ['all', 'Everything']].map(([a, l]) => `<button class="chip" data-lk="${a}" aria-pressed="${k === a}">${l}</button>`).join('')}</div>`;
      if (!st.links || st.links.kind !== k) return chips + `<div class="loading">Loading…</div>`;
      let rows = st.links.rows; if (k === 'images') rows = rows.slice().sort((a, b) => (b.bytes || 0) - (a.bytes || 0));
      return chips + `<div class="wrap"><table class="t"><thead><tr><th>Address</th><th>Type</th><th>Answer</th><th>${k === 'images' ? 'Size' : 'Goes to'}</th><th>Found on</th></tr></thead><tbody>
        ${rows.slice(0, 600).map(l => `<tr><td class="url">${link(l.url)}</td><td>${esc(l.kind)}</td><td class="num ${l.status && l.status < 400 ? '' : 'no'}">${l.status || esc(l.error || 'no answer')}</td><td class="small url">${k === 'images' ? (l.bytes ? Math.round(l.bytes / 1024) + ' KB' : '') : (l.final_url ? link(l.final_url) : '')}</td><td class="small">${(l.sources || []).slice(0, 3).map(s => link(s.from) + (s.anchor ? ` "${esc(String(s.anchor).slice(0, 40))}"` : '')).join('<br>')}</td></tr>`).join('') || `<tr><td colspan="5" class="empty">${k === 'bad' ? 'No broken links found.' : 'Nothing here.'}</td></tr>`}</tbody></table></div><p class="small muted">${st.links.total} found${st.links.total > 600 ? ' (the first 600 are shown)' : ''}. Some sites refuse automatic checks (403/429): those are listed as "could not be checked" in the report, not as broken.</p>`;
    }

    // ---------------------------------------------------------------- rankings
    async function ensureRank() { if (st.rank) return; st.rank = await ctx.call('rankings', st.runId ? { run_id: st.runId } : {}); }
    function rankView() {
      const R = st.rank, src = st.boot.sources, rs = R && R.rank_state;
      if (!R) return `<div class="loading">Loading the rankings…</div>`;
      const byK = new Map(); for (const r of R.rankings) { if (!byK.has(r.keyword)) byK.set(r.keyword, []); byK.get(r.keyword).push(r); }
      const trend = (rows) => { const s = rows.filter(r => r.source === 'serpapi' || r.source === 'gsc'); const a = s[0], b = s.find((r, i) => i > 0 && r.run_id !== a.run_id); return [a, b]; };
      const rowsHtml = R.keywords.filter(k => k.active).map(k => {
        const rs2 = byK.get(k.keyword) || []; if (!rs2.length) return `<tr><td>${esc(k.keyword)}</td><td class="small url">${k.target_url ? link(k.target_url) : '<span class="muted">any page</span>'}</td><td colspan="4" class="muted small">Not checked yet</td></tr>`;
        const [a, b] = trend(rs2), p = a && a.position != null ? Number(a.position) : null, pp = b && b.position != null ? Number(b.position) : null;
        const ch = p !== null && pp !== null ? pp - p : null;
        return `<tr><td><b>${esc(k.keyword)}</b></td><td class="small url">${k.target_url ? link(k.target_url) : '<span class="muted">any page</span>'}</td><td class="num">${p !== null ? p.toFixed(a.source === 'gsc' ? 1 : 0) : '<span class="no">not on page 1</span>'}</td><td class="num ${ch > 0 ? 'ok' : ch < 0 ? 'no' : ''}">${ch === null ? '' : ch > 0 ? '▲ ' + ch.toFixed(a.source === 'gsc' ? 1 : 0) : ch < 0 ? '▼ ' + Math.abs(ch).toFixed(a.source === 'gsc' ? 1 : 0) : '–'}</td><td class="small">${a.extra && a.extra.local_pack ? 'Map pack #' + a.extra.local_pack : ''}${a.extra && a.extra.list && a.extra.list.length ? '<div class="muted">Top results: ' + esc(a.extra.list.filter((d, i, arr) => d && arr.indexOf(d) === i).slice(0, 4).join(', ')) + '</div>' : ''}${a.extra && a.extra.impressions != null ? Math.round(a.extra.impressions) + ' showings, ' + Math.round(a.extra.clicks) + ' clicks' : ''}</td><td class="small url">${a.found_url ? link(a.found_url) : ''}</td></tr>`;
      }).join('');
      const g = R.gsc;
      return `${src.gsc ? '' : `<div class="note"><b>Real search data is not connected yet.</b> ${src.serpapi ? 'Until it is, the audit checks where the site appears in Google for the phrases below (first page only, a few searches a week).' : 'No ranking source is set up.'} For clicks, showings and average position on every page and phrase, connect Google Search Console (free): in Search Console open Settings &gt; Users and permissions and add the service account email as a user (Restricted is enough), then the secrets <code>GSC_SERVICE_ACCOUNT</code> and <code>GSC_SITE</code> need to be set. Ask Claude for the step-by-step.</div>`}
        ${rs && rs.note ? `<div class="note small">${esc(rs.note)}</div>` : ''}
        <h3 style="margin:0 0 8px">Tracked phrases</h3><div class="wrap"><table class="t"><thead><tr><th>Phrase</th><th>Page we want</th><th>Position</th><th>Change</th><th>Detail</th><th>Found page</th></tr></thead><tbody>${rowsHtml || '<tr><td colspan="6" class="empty">No phrases yet. Add some in Settings.</td></tr>'}</tbody></table></div>
        ${g.queries.length ? `<h3 style="margin:0 0 8px">What people searched to find you (28 days)</h3><div class="wrap"><table class="t"><thead><tr><th>Search</th><th>Showings</th><th>Clicks</th><th>Click rate</th><th>Position</th><th>Before</th></tr></thead><tbody>${g.queries.slice(0, 60).map(r => `<tr><td>${esc(r.key)}</td><td class="num">${Math.round(r.impressions)}</td><td class="num">${Math.round(r.clicks)}</td><td class="num">${(r.ctr * 100).toFixed(1)}%</td><td class="num">${Number(r.position).toFixed(1)}</td><td class="num muted">${r.prev_position != null ? Number(r.prev_position).toFixed(1) : ''}</td></tr>`).join('')}</tbody></table></div>` : ''}
        ${g.pages.length ? `<h3 style="margin:0 0 8px">Pages in Google (28 days)</h3><div class="wrap"><table class="t"><thead><tr><th>Page</th><th>Showings</th><th>Clicks</th><th>Click rate</th><th>Position</th></tr></thead><tbody>${g.pages.slice(0, 50).map(r => `<tr><td class="url">${link(r.key)}</td><td class="num">${Math.round(r.impressions)}</td><td class="num">${Math.round(r.clicks)}</td><td class="num">${(r.ctr * 100).toFixed(1)}%</td><td class="num">${Number(r.position).toFixed(1)}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
    }

    // ---------------------------------------------------------------- settings
    function settingsView() {
      const s = st.boot.settings, src = st.boot.sources;
      return `<div class="grid2"><div class="card"><h3>Weekly audit</h3>
          <p><label><input type="checkbox" id="seoOn" ${s.enabled ? 'checked' : ''}> Run every week</label></p>
          <p>Day: <select id="seoDay">${[1, 2, 3, 4, 5, 6, 7].map(d => `<option value="${d}" ${s.run_day === d ? 'selected' : ''}>${DAYS[d]}</option>`).join('')}</select> <span class="small muted">starts from 5am</span></p>
          <p><label><input type="checkbox" id="seoEmail" ${s.email_on ? 'checked' : ''}> Email the summary to the marketing digest people</label> ${src.brevo ? '' : '<span class="no small">(email is not set up)</span>'}</p>
          <p class="small muted">Last started: ${s.last_run_on ? esc(s.last_run_on) : 'never'}.</p></div>
        <div class="card"><h3>Ranking checks</h3><p class="small">Google Search Console: <b class="${src.gsc ? 'ok' : 'no'}">${src.gsc ? 'connected' : 'not connected'}</b><br>SerpApi (first-page check): <b class="${src.serpapi ? 'ok' : 'no'}">${src.serpapi ? 'available' : 'not set up'}</b></p>
          <p>Search allowance always left alone: <input type="number" id="seoRes" min="0" max="250" value="${s.serp_reserve}" style="width:90px"> <span class="small muted">of the 250 a month shared with the rate shopper and events</span></p>
          <p>Searching from: <input type="text" id="seoLoc" value="${esc(s.serp_location)}" style="width:100%"></p><p><button class="btn" id="seoSave">Save settings</button></p></div></div>
        <div class="card"><h3>Search phrases to track</h3><p class="small muted">Each phrase uses one search a week. Give the page that should rank for it so the audit can check the page uses the words in its title, heading and opening text.</p>
          <div class="wrap"><table class="t"><thead><tr><th>Phrase</th><th>Page that should rank</th><th>On</th><th></th></tr></thead><tbody>${st.boot.keywords.map(k => `<tr><td>${esc(k.keyword)}</td><td class="small url">${k.target_url ? link(k.target_url) : '<span class="muted">any page</span>'}</td><td><input type="checkbox" data-kon="${k.id}" ${k.active ? 'checked' : ''} aria-label="Track ${esc(k.keyword)}"></td><td><button class="btn ghost small" data-kdel="${k.id}">Remove</button></td></tr>`).join('')}</tbody></table></div>
          <div class="ctl"><input type="text" id="seoKw" placeholder="New phrase, e.g. wedding venue durham" style="flex:1 1 260px"><input type="text" id="seoKu" placeholder="Page address (optional)" style="flex:1 1 260px"><button class="btn" id="seoAdd">Add</button></div></div>`;
    }

    // ---------------------------------------------------------------- draw and wire
    function draw() {
      if (st.dead) return;
      const body = st.view === 'report' ? reportView() : st.view === 'pages' ? pagesView() : st.view === 'links' ? linksView() : st.view === 'rankings' ? rankView() : settingsView();
      el.innerHTML = `<div class="seo">${head()}${body}</div>`;
      const q = s => el.querySelector(s), qa = s => el.querySelectorAll(s);
      qa('[data-v]').forEach(b => b.onclick = async () => { st.view = b.dataset.v; draw(); try { if (st.view === 'pages' && !st.pages) { await ensurePages(); draw(); } if (st.view === 'links' && (!st.links || st.links.kind !== st.lkind)) { await ensureLinks(); draw(); } if (st.view === 'rankings' && !st.rank) { await ensureRank(); draw(); } } catch (e) { ctx.toast(e.message, true); } });
      const sb = q('#seoStart'); if (sb) sb.onclick = async () => { sb.disabled = true; try { await ctx.call('run.start'); ctx.toast('The audit has started. It is picked up within a minute.'); st.boot = await ctx.call('bootstrap'); poll(); draw(); } catch (e) { sb.disabled = false; ctx.toast(e.message, true); } };
      const sp = q('#seoStop'); if (sp) sp.onclick = async () => { try { await ctx.call('run.cancel'); st.boot = await ctx.call('bootstrap'); draw(); ctx.toast('Stopped.'); } catch (e) { ctx.toast(e.message, true); } };
      qa('[data-cat]').forEach(b => b.onclick = () => { st.cat = b.dataset.cat; draw(); });
      const ru = q('#seoRuns'); if (ru) ru.onchange = () => { st.runId = ru.value; load(true); };
      const ml = q('#seoMail'); if (ml) ml.onclick = async () => { ml.disabled = true; try { const r = await ctx.call('email.test', st.runId ? { run_id: st.runId } : {}); ctx.toast('Sent to ' + r.sent_to + '.'); } catch (e) { ctx.toast(e.message, true); } ml.disabled = false; };
      qa('[data-all]').forEach(b => b.onclick = async () => { const code = b.dataset.all, box = el.querySelector(`[data-allbox="${code}"]`); b.disabled = true; try { const r = await ctx.call('issues', { code, ...(st.runId ? { run_id: st.runId } : {}) }); box.innerHTML = `<ul>${r.issues.map(i => `<li>${link(i.url)}: ${esc(i.message)}</li>`).join('')}</ul>`; b.remove(); } catch (e) { b.disabled = false; ctx.toast(e.message, true); } });
      qa('[data-pf]').forEach(b => b.onclick = () => { st.pfilter = b.dataset.pf; draw(); });
      const pq = q('#seoPq'); if (pq) { pq.oninput = () => { st.pq = pq.value; const pos = pq.selectionStart; draw(); const n = q('#seoPq'); n.focus(); n.setSelectionRange(pos, pos); }; }
      qa('[data-pg]').forEach(r => r.onclick = () => openPage(r.dataset.pg));
      qa('[data-lk]').forEach(b => b.onclick = async () => { st.lkind = b.dataset.lk; draw(); try { await ensureLinks(); draw(); } catch (e) { ctx.toast(e.message, true); } });
      const sv = q('#seoSave'); if (sv) sv.onclick = async () => { try { const r = await ctx.call('settings.save', { enabled: q('#seoOn').checked, email_on: q('#seoEmail').checked, run_day: +q('#seoDay').value, serp_reserve: +q('#seoRes').value, serp_location: q('#seoLoc').value }); st.boot.settings = r.settings; ctx.toast('Saved.'); draw(); } catch (e) { ctx.toast(e.message, true); } };
      const ad = q('#seoAdd'); if (ad) ad.onclick = async () => { try { const r = await ctx.call('keywords.save', { keywords: [{ keyword: q('#seoKw').value, target_url: q('#seoKu').value }] }); st.boot.keywords = r.keywords; st.rank = null; ctx.toast('Added.'); draw(); } catch (e) { ctx.toast(e.message, true); } };
      qa('[data-kdel]').forEach(b => b.onclick = async () => { try { await ctx.call('keyword.remove', { id: b.dataset.kdel }); st.boot.keywords = st.boot.keywords.filter(k => String(k.id) !== b.dataset.kdel); st.rank = null; draw(); } catch (e) { ctx.toast(e.message, true); } });
      qa('[data-kon]').forEach(c => c.onchange = async () => { const k = st.boot.keywords.find(x => String(x.id) === c.dataset.kon); try { const r = await ctx.call('keywords.save', { keywords: [{ keyword: k.keyword, target_url: k.target_url, active: c.checked }] }); st.boot.keywords = r.keywords; st.rank = null; } catch (e) { ctx.toast(e.message, true); c.checked = !c.checked; } });
    }
    load();
    return { unmount() { st.dead = true; clearTimeout(st.timer); el.innerHTML = ''; } };
  }
  global.SeoAudit = { mount };
})(window);
