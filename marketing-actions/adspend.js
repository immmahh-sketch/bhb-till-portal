/* Ad spend - the "Ad spend" tab of Marketing Actions.
 *
 *   const a = AdSpend.mount(element, { call, toast, openModal, closeModal });   // later: a.unmount()
 *
 * Receipts and invoices (a Meta receipt email, a PDF, or figures typed in) are added here. Each has the dates it covers and one line per campaign; every campaign has a
 * category (suggested from its name, remembered, changeable). The report spreads each line evenly over the days its receipt covers, then totals by week, month or the
 * whole period, grouped by category, campaign or platform. Backend (adspend-api): bootstrap, file.url, doc.read, doc.save, doc.get, docs.list, doc.remove,
 * campaign.category, report. Uses the host page's .btn / .field / .card / .tag / .loading / .empty / .pagehead classes; everything else is styled here under .ad.
 */
(function (global) {
  'use strict';

  const CSS = `
.ad .ctl{display:flex; gap:10px 16px; align-items:center; flex-wrap:wrap; margin:0 0 16px}
.ad .ctl label{font-size:10px; letter-spacing:var(--track-label,.18em); text-transform:uppercase; color:var(--sage-70,#7B887C); margin-right:6px}
.ad .ctl select,.ad .ctl input[type=date]{border:1px solid var(--mist,#e7e7e7); border-radius:8px; background:var(--white,#fff); padding:8px 12px; min-height:40px; font-size:16px}
.ad .strip{display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:10px; margin-bottom:14px}
.ad .strip div{background:var(--bone,#F8F8F8); border-radius:8px; padding:10px 14px}
.ad .strip b{display:block; font-family:var(--display,Georgia,serif); font-size:28px; line-height:1.05; color:var(--sage,#4D604F); font-weight:600}
.ad .strip span{font-size:10px; letter-spacing:var(--track-label,.18em); text-transform:uppercase; color:var(--sage-70,#7B887C)}
.ad .strip small{display:block; font-size:12px; color:var(--sage-70,#7B887C); margin-top:3px}
.ad .note{background:var(--attention-bg,#F7F0E4); border-radius:8px; padding:10px 14px; margin:0 0 14px; font-size:14px}
.ad .note.bad{background:var(--alert-bg,#F6EAE8); color:var(--alert,#8C4A3F)}
.ad .share{display:flex; height:14px; border-radius:99px; overflow:hidden; margin:0 0 8px; background:var(--mist,#e7e7e7)}
.ad .share i{display:block; height:100%}
.ad .legend{display:flex; gap:6px 16px; flex-wrap:wrap; font-size:13px; margin:0 0 16px}
.ad .legend span{display:inline-flex; align-items:center; gap:6px}
.ad .legend span i{width:10px; height:10px; border-radius:50%; display:inline-block}
.ad .wrap{overflow-x:auto; border:1px solid var(--mist,#e7e7e7); border-radius:8px; margin-bottom:18px}
.ad table.t{width:100%; border-collapse:separate; border-spacing:0; font-size:14px}
.ad .t th{font-size:10px; letter-spacing:var(--track-label,.18em); text-transform:uppercase; color:var(--sage-70,#7B887C); font-weight:600; text-align:right; padding:8px 10px; background:var(--bone,#F8F8F8); white-space:nowrap}
.ad .t th.l,.ad .t td.l{text-align:left}
.ad .t td{padding:9px 10px; border-top:1px solid var(--mist,#e7e7e7); background:var(--white,#fff); vertical-align:top}
.ad .t td.n{text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums}
.ad .t tr.tot td{font-weight:700; background:var(--bone,#F8F8F8)}
.ad .t .dot{display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:8px}
.ad .t .cat{display:block; margin-top:2px; font-size:12px; color:var(--sage-70,#7B887C); background:none; border:0; padding:0; cursor:pointer; text-decoration:underline dotted}
.ad h3{font-family:var(--display,Georgia,serif); font-size:22px; color:var(--sage,#4D604F); margin:22px 0 10px; font-weight:600}
.ad .muted{color:var(--sage-70,#7B887C)}
.ad .small{font-size:12px}
.adm .drop{display:block; border:2px dashed var(--mist,#cfd4cf); border-radius:10px; padding:26px 16px; text-align:center; cursor:pointer; margin:0 0 14px}
.adm .drop.on{border-color:var(--sage,#4D604F); background:var(--sage-10,#EDEFED)}
.adm table{width:100%; border-collapse:collapse; font-size:14px}
.adm th{font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:var(--sage-70,#7B887C); text-align:left; padding:4px 6px}
.adm td{padding:3px 4px; vertical-align:middle}
.adm td input,.adm td select{width:100%; min-width:0}
.adm .grid2{display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px}
.adm .tot{font-weight:700; text-align:right; margin:10px 0}
.adm .row-actions{display:flex; gap:8px; flex-wrap:wrap; margin-top:12px}
.adm .warn{background:var(--attention-bg,#F7F0E4); border-radius:8px; padding:8px 12px; margin:0 0 10px; font-size:14px}
.adm .warn.bad{background:var(--alert-bg,#F6EAE8); color:var(--alert,#8C4A3F)}
`;

  const COLOURS = ['#4D604F', '#B5835A', '#34546F', '#8C4A3F', '#7B887C', '#9A8C3B', '#6B4E71', '#3F7F76'];
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => (n < 0 ? '-£' : '£') + Math.abs(Number(n || 0)).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const ukToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
  const shift = (iso, d) => { const t = new Date(iso + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + d); return t.toISOString().slice(0, 10); };
  const fmtD = d => { try { return new Date(String(d).slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return d; } };
  const colourOf = (name, i) => COLOURS[(i != null ? i : [...String(name)].reduce((a, c) => a + c.charCodeAt(0), 0)) % COLOURS.length];
  const num = v => { const n = Number(String(v == null ? '' : v).replace(/[£,\s]/g, '')); return Number.isFinite(n) ? n : NaN; };

  function range(kind, custom) {
    const t = ukToday(), d = new Date(t + 'T12:00:00Z'), dow = (d.getUTCDay() + 6) % 7, mon = shift(t, -dow);
    switch (kind) {
      case 'thisweek': return [mon, t];
      case 'lastweek': return [shift(mon, -7), shift(mon, -1)];
      case 'thismonth': return [t.slice(0, 7) + '-01', t];
      case 'lastmonth': { const first = t.slice(0, 7) + '-01'; const lastEnd = shift(first, -1); return [lastEnd.slice(0, 7) + '-01', lastEnd]; }
      case '30': return [shift(t, -29), t];
      case 'year': return [t.slice(0, 4) + '-01-01', t];
      case 'custom': return custom;
      default: return [shift(t, -89), t];
    }
  }

  function mount(el, ctx) {
    if (!document.getElementById('ad-css')) { const s = document.createElement('style'); s.id = 'ad-css'; s.textContent = CSS; document.head.appendChild(s); }
    const st = { dead: false, kind: '90', custom: [shift(ukToday(), -29), ukToday()], group: 'category', bucket: 'month', rep: null, docs: [], cats: [], platforms: ['Meta', 'Google', 'Other'] };
    const $ = s => el.querySelector(s);
    el.innerHTML = `<div class="ad"><div class="loading">Loading…</div></div>`;

    async function boot() {
      try { const b = await ctx.call('bootstrap'); st.cats = b.categories || []; st.platforms = b.platforms || st.platforms; }
      catch (e) { el.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
      draw(); await refresh();
    }

    function draw() {
      const [f, t] = range(st.kind, st.custom);
      el.innerHTML = `<div class="ad">
        <div class="pagehead"><h2>Ad spend</h2><span class="hint">What we spend on adverts, by category and campaign.</span><span class="spacer"></span><button class="btn" id="adAdd">Add a receipt or invoice</button></div>
        <div class="ctl">
          <span><label for="adKind">Period</label><select id="adKind">${[['thisweek', 'This week'], ['lastweek', 'Last week'], ['thismonth', 'This month'], ['lastmonth', 'Last month'], ['30', 'Last 30 days'], ['90', 'Last 90 days'], ['year', 'This year'], ['custom', 'Choose dates']].map(([k, l]) => `<option value="${k}" ${st.kind === k ? 'selected' : ''}>${l}</option>`).join('')}</select></span>
          ${st.kind === 'custom' ? `<span><input type="date" id="adFrom" value="${esc(f)}" aria-label="From"> to <input type="date" id="adTo" value="${esc(t)}" aria-label="To"></span>` : ''}
          <span><label for="adGroup">Group by</label><select id="adGroup">${[['category', 'Category'], ['campaign', 'Campaign'], ['platform', 'Platform']].map(([k, l]) => `<option value="${k}" ${st.group === k ? 'selected' : ''}>${l}</option>`).join('')}</select></span>
          <span><label for="adBucket">Split by</label><select id="adBucket">${[['total', 'Whole period'], ['week', 'Week'], ['month', 'Month']].map(([k, l]) => `<option value="${k}" ${st.bucket === k ? 'selected' : ''}>${l}</option>`).join('')}</select></span>
        </div>
        <div id="adBody"><div class="loading">Loading…</div></div>
        <h3>Receipts and invoices</h3><div id="adDocs"></div></div>`;
      $('#adAdd').onclick = () => openAdd();
      $('#adKind').onchange = e => { st.kind = e.target.value; draw(); refresh(); };
      $('#adGroup').onchange = e => { st.group = e.target.value; draw(); refresh(); };
      $('#adBucket').onchange = e => { st.bucket = e.target.value; draw(); refresh(); };
      if (st.kind === 'custom') { const go = () => { const a = $('#adFrom').value, b = $('#adTo').value; if (a && b && a <= b) { st.custom = [a, b]; refresh(); } }; $('#adFrom').onchange = go; $('#adTo').onchange = go; }
    }

    async function refresh() {
      const [from, to] = range(st.kind, st.custom), seq = st.seq = (st.seq || 0) + 1;      // a slower, older answer never overwrites a newer one
      try {
        const [rep, docs] = await Promise.all([ctx.call('report', { from, to, group: st.group, bucket: st.bucket }), ctx.call('docs.list', {})]);
        if (st.dead || seq !== st.seq) return; st.rep = rep; st.docs = docs.docs || []; paintBody(); paintDocs();
      } catch (e) { if (!st.dead && $('#adBody')) $('#adBody').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
    }

    function paintBody() {
      const r = st.rep, b = $('#adBody'); if (!r || !b) return;
      if (!r.rows.length) { b.innerHTML = `<div class="card"><div class="empty">No spend recorded for ${esc(fmtD(r.from))} to ${esc(fmtD(r.to))}. Add a receipt or invoice with the button above.</div></div>`; return; }
      const prev = r.prev || {}, diff = r.total - (prev.total || 0), cover = r.covered_days < r.period_days;
      let h = `<div class="strip">
        <div><span>Spend, ${esc(fmtD(r.from))} to ${esc(fmtD(r.to))}</span><b>${money(r.total)}</b><small>${r.docs} receipt${r.docs === 1 ? '' : 's'}</small></div>
        <div><span>Before that (${esc(r.period_days)} days)</span><b>${money(prev.total || 0)}</b><small>${prev.total ? (diff >= 0 ? 'Up ' : 'Down ') + money(Math.abs(diff)) + (prev.total ? ' (' + Math.round(Math.abs(diff) / prev.total * 100) + '%)' : '') : 'Nothing recorded'}</small></div>
        <div><span>Days covered by receipts</span><b>${r.covered_days} of ${r.period_days}</b><small>${cover ? 'The rest has no receipt yet' : 'Every day is covered'}</small></div>
      </div>`;
      if (cover) h += `<div class="note">Spend is spread evenly across the days each receipt covers. Meta bills each time spend reaches the payment threshold, so the most recent days may not be on a receipt yet, and totals for them will rise when it arrives.</div>`;
      const colours = r.rows.map((x, i) => colourOf(x.label, i));
      h += `<div class="share" role="img" aria-label="Share of spend">${r.rows.map((x, i) => `<i style="width:${Math.max(0.5, x.total / r.total * 100)}%;background:${colours[i]}" title="${esc(x.label)} ${money(x.total)}"></i>`).join('')}</div>`;
      h += `<div class="legend">${r.rows.slice(0, 10).map((x, i) => `<span><i style="background:${colours[i]}"></i>${esc(x.label)} ${Math.round(x.total / r.total * 100)}%</span>`).join('')}</div>`;
      const multi = r.buckets.length > 1;
      h += `<div class="wrap"><table class="t"><thead><tr><th class="l">${esc({ category: 'Category', campaign: 'Campaign', platform: 'Platform' }[r.group])}</th>${multi ? r.buckets.map(x => `<th>${esc(x.label)}</th>`).join('') : ''}<th>Total</th><th>Share</th></tr></thead><tbody>`;
      r.rows.forEach((x, i) => {
        h += `<tr><td class="l"><i class="dot" style="background:${colours[i]}"></i>${esc(x.label)}${r.group === 'campaign' && x.sub ? `<button class="cat" data-camp="${esc(x.label)}" data-cat="${esc(x.sub)}" title="Change this campaign's category">${esc(x.sub)}</button>` : ''}</td>${multi ? x.values.map(v => `<td class="n">${v ? money(v) : '<span class="muted">–</span>'}</td>`).join('') : ''}<td class="n"><b>${money(x.total)}</b></td><td class="n">${Math.round(x.total / r.total * 100)}%</td></tr>`;
      });
      h += `<tr class="tot"><td class="l">Total</td>${multi ? r.totals.map(v => `<td class="n">${money(v)}</td>`).join('') : ''}<td class="n">${money(r.total)}</td><td class="n">100%</td></tr></tbody></table></div>`;
      if (r.by_platform && r.by_platform.length > 1 && r.group !== 'platform') h += `<p class="muted small">By platform: ${r.by_platform.map(p => esc(p.platform) + ' ' + money(p.total)).join(' · ')}</p>`;
      b.innerHTML = h;
      b.querySelectorAll('.cat').forEach(c => c.onclick = () => changeCategory(c.dataset.camp, c.dataset.cat));
    }

    function changeCategory(camp, cur) {
      const m = ctx.openModal(`<div class="adm"><h3 style="margin-top:0">Category for “${esc(camp)}”</h3><p class="muted">This changes it on every receipt, and for this campaign's future receipts.</p>
        <div class="field"><input id="catIn" list="catList" value="${esc(cur)}" maxlength="60"><datalist id="catList">${st.cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
        <div class="row-actions"><button class="btn" id="catSave">Save</button><button class="btn ghost" id="catX">Cancel</button></div></div>`);
      m.querySelector('#catX').onclick = ctx.closeModal;
      m.querySelector('#catSave').onclick = async () => { const v = m.querySelector('#catIn').value.trim(); if (!v) return; try { const r = await ctx.call('campaign.category', { campaign: camp, category: v }); st.cats = r.categories || st.cats; ctx.closeModal(); ctx.toast('Category changed.'); refresh(); } catch (e) { ctx.toast(e.message, true); } };
    }

    function paintDocs() {
      const d = $('#adDocs'); if (!d) return;
      if (!st.docs.length) { d.innerHTML = `<div class="card"><div class="empty">Nothing added yet. Press “Add a receipt or invoice” and drop in a Meta receipt email.</div></div>`; return; }
      d.innerHTML = `<div class="wrap"><table class="t"><thead><tr><th class="l">Covers</th><th class="l">Platform</th><th class="l">Reference</th><th>Lines</th><th>Total</th><th class="l">Added by</th><th></th></tr></thead><tbody>${st.docs.map(x => `<tr><td class="l">${esc(fmtD(x.date_from))} to ${esc(fmtD(x.date_to))}</td><td class="l">${esc(x.platform)}${x.source === 'guess' ? ' <span class="muted small">(typed)</span>' : ''}</td><td class="l">${esc(x.reference || '')}${x.note ? `<div class="muted small">${esc(x.note)}</div>` : ''}</td><td class="n">${x.lines}</td><td class="n"><b>${money(x.total)}</b></td><td class="l small">${esc(x.created_by_name || '')}<br><span class="muted">${esc(fmtD(x.created_at))}</span></td><td class="n">${x.url ? `<button class="btn ghost small" data-view="${esc(x.id)}">File</button> ` : ''}<button class="btn ghost small" data-edit="${esc(x.id)}">Edit</button> <button class="btn ghost small" data-del="${esc(x.id)}">Remove</button></td></tr>`).join('')}</tbody></table></div>`;
      d.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openAdd(b.dataset.edit));
      d.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { const x = st.docs.find(z => z.id === b.dataset.view); if (x) viewFile(x.url, x.file_name || 'File'); });
      d.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (!confirm('Remove this receipt? Its spend leaves every total, and the file is deleted.')) return; try { await ctx.call('doc.remove', { id: b.dataset.del }); ctx.toast('Removed.'); refresh(); } catch (e) { ctx.toast(e.message, true); } });
    }

    /* A receipt's file in a pop-up. PDFs and pictures show in the page (a PDF is fetched and shown from a local copy, because the storage address cannot be framed directly); anything else is offered to open or download. */
    async function viewFile(url, name) {
      const isPdf = /\.pdf$/i.test(name), isImg = /\.(png|jpe?g|gif|webp)$/i.test(name);
      const m = ctx.openModal(`<div class="adm"><h3 style="margin:0 0 8px;font-size:18px;word-break:break-word">${esc(name)}</h3><div id="adView" style="min-height:120px;height:${isPdf ? '74vh' : 'auto'};border:1px solid var(--mist,#e7e7e7);border-radius:8px;overflow:auto;background:#fff;display:flex;align-items:center;justify-content:center"><span class="muted">Loading…</span></div>
        <div class="row-actions" style="margin-top:10px"><a class="btn ghost" id="adViewOpen" href="${esc(url)}" target="_blank" rel="noopener">Open in a new tab</a><button class="btn" id="adViewX">Close</button></div></div>`);
      const card = m.firstElementChild; if (card) { card.style.maxWidth = '1000px'; card.style.width = '94vw'; }
      let blobUrl = '';
      const close = () => { if (blobUrl) URL.revokeObjectURL(blobUrl); ctx.closeModal(); };
      m.querySelector('#adViewX').onclick = close;
      const box = m.querySelector('#adView');
      try {
        if (isPdf) {
          const r = await fetch(url); if (!r.ok) throw new Error('The file could not be fetched (' + r.status + ').');
          blobUrl = URL.createObjectURL(new Blob([await r.arrayBuffer()], { type: 'application/pdf' }));
          box.style.display = 'block'; box.innerHTML = `<iframe src="${blobUrl}" title="${esc(name)}" style="width:100%;height:100%;border:0"></iframe>`;
        } else if (isImg) {
          box.innerHTML = `<img src="${esc(url)}" alt="${esc(name)}" style="max-width:100%;max-height:74vh">`;
        } else {
          box.innerHTML = `<span class="muted" style="padding:20px;text-align:center">This kind of file cannot be shown here. Use Open in a new tab to download it.</span>`;
        }
      } catch (e) { box.innerHTML = `<span style="color:var(--alert,#8C4A3F);padding:20px">${esc(e.message || 'The file could not be shown.')}</span>`; }
    }

    /* ---------------------------------------------------------- add / edit */
    async function openAdd(editId) {
      let doc = null;
      if (editId) {
        try { const g = await ctx.call('doc.get', { id: editId }); doc = { id: editId, platform: g.doc.platform, account: g.doc.account || '', reference: g.doc.reference || '', txn_id: g.doc.txn_id || '', date_from: g.doc.date_from, date_to: g.doc.date_to, source: g.doc.source, note: g.doc.note || '', file: g.doc.file_name ? { name: g.doc.file_name, url: g.doc.url } : null, lines: g.lines, warnings: [], duplicate: null }; }
        catch (e) { ctx.toast(e.message, true); return; }
        return form(doc);
      }
      const m = ctx.openModal(`<div class="adm"><h3 style="margin-top:0">Add a receipt or invoice</h3>
        <p class="muted">Drop in a Meta ads receipt email (an Outlook .msg or .eml file) and it is read for you. Other files (PDF, photo, Word, Excel) are kept with the record and you type the figures in.</p>
        <label class="drop" id="adDrop"><input type="file" id="adFile" hidden accept=".msg,.eml,.pdf,.png,.jpg,.jpeg,.gif,.webp,.heic,.txt,.csv,.html,.htm,.xls,.xlsx,.doc,.docx"><b>Drop the file here</b> or <u>choose a file</u></label>
        <div class="field"><label for="adText">Or paste the email or invoice text</label><textarea id="adText" rows="4" placeholder="Paste the text of the receipt here"></textarea></div>
        <div class="row-actions"><button class="btn" id="adReadText">Read the pasted text</button><button class="btn ghost" id="adManual">Type it in by hand</button><button class="btn ghost" id="adCancel">Cancel</button></div>
        <div id="adStatus" class="small" style="margin-top:10px"></div></div>`);
      const status = t => { m.querySelector('#adStatus').innerHTML = t; };
      m.querySelector('#adCancel').onclick = ctx.closeModal;
      m.querySelector('#adManual').onclick = () => form({ id: '', platform: 'Meta', account: '', reference: '', txn_id: '', date_from: ukToday(), date_to: ukToday(), source: 'manual', note: '', file: null, lines: [{ campaign: '', category: '', results: '', amount: '', is_fee: false }], warnings: [], duplicate: null });
      const handle = async (f, text) => {
        try {
          let file = null, r;
          if (f) {
            status('Uploading ' + esc(f.name) + '…');
            const u = await ctx.call('file.url', { name: f.name, size: f.size });
            let put; try { put = await fetch(u.upload_url, { method: 'PUT', headers: { 'Content-Type': f.type || 'application/octet-stream', 'x-upsert': 'false' }, body: f }); } catch (e) { throw new Error('Could not reach the server. Check your connection.'); }
            if (!put.ok) throw new Error('The upload was refused (error ' + put.status + ').');
            file = { path: u.path, name: f.name, mime: f.type || '' };
            status('Reading it…');
            let ptext = ''; if (/\.pdf$/i.test(f.name)) { try { ptext = await pdfToText(f); } catch (e) { ptext = ''; } }   // the server cannot open a PDF, so it is read here and the text goes with it
            r = await ctx.call('doc.read', ptext.trim() ? { path: u.path, name: f.name, text: ptext } : { path: u.path, name: f.name });
          } else { status('Reading it…'); r = await ctx.call('doc.read', { text }); }
          const p = r.parsed || {};
          const warnings = [...(p.warnings || [])]; if (r.note) warnings.unshift(r.note); if (!r.readable && !r.note) warnings.unshift('I could not find any figures in that, so type them in.');
          form({ id: '', platform: p.platform || 'Other', account: p.account || '', reference: p.reference || '', txn_id: p.txn_id || '', date_from: p.date_from || ukToday(), date_to: p.date_to || ukToday(), source: p.source || 'manual', note: '', file, lines: (r.lines && r.lines.length) ? r.lines : [{ campaign: '', category: '', results: '', amount: '', is_fee: false }], warnings, duplicate: r.duplicate || null });
        } catch (e) { status(`<span style="color:var(--alert)">${esc(e.message)}</span>`); }
      };
      const fi = m.querySelector('#adFile'), dz = m.querySelector('#adDrop');
      fi.onchange = () => { if (fi.files[0]) handle(fi.files[0]); };
      ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('on'); }));
      ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('on'); }));
      dz.addEventListener('drop', e => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) handle(f); });
      m.querySelector('#adReadText').onclick = () => { const t = m.querySelector('#adText').value.trim(); if (!t) { status('Paste some text first.'); return; } handle(null, t); };
    }

    /* PDF invoices: read their text in the browser (pdf.js from cdnjs) and send it to the server along with the file. */
    let pdfLoad = null;
    function loadPdfJs() {
      if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
      if (pdfLoad) return pdfLoad;
      pdfLoad = new Promise((res, rej) => {
        const sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        sc.onload = () => { try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; res(window.pdfjsLib); } catch (e) { rej(e); } };
        sc.onerror = () => { pdfLoad = null; rej(new Error('Could not load the PDF reader.')); };
        document.head.appendChild(sc);
      });
      return pdfLoad;
    }
    async function pdfToText(file) {
      const lib = await loadPdfJs(), doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      let out = '';
      for (let n = 1; n <= doc.numPages; n++) {
        const tc = await (await doc.getPage(n)).getTextContent(); let line = '';
        for (const it of tc.items) { line += it.str; if (it.hasEOL) { out += line + '\n'; line = ''; } else if (it.str && !/\s$/.test(it.str)) line += ' '; }
        if (line.trim()) out += line + '\n';
      }
      return out;
    }

    function form(doc) {
      const lines = doc.lines.map(l => ({ ...l, amount: l.amount === '' ? '' : l.amount }));
      const m = ctx.openModal('<div class="adm" id="adForm"></div>');
      const root = m.querySelector('#adForm');
      const total = () => lines.reduce((s, l) => s + (Number.isFinite(num(l.amount)) ? num(l.amount) : 0), 0);
      const paint = () => {
        root.innerHTML = `<h3 style="margin-top:0">${doc.id ? 'Edit' : 'Check and save'}</h3>
          ${doc.duplicate ? `<div class="warn bad"><b>This receipt is already added</b> (${esc(fmtD(doc.duplicate.date_from))} to ${esc(fmtD(doc.duplicate.date_to))}, ${money(doc.duplicate.total)}). It cannot be added twice.</div>` : ''}
          ${(doc.warnings || []).map(w => `<div class="warn">${esc(w)}</div>`).join('')}
          ${doc.file ? `<p class="small muted">File: ${doc.file.url ? `<a href="${esc(doc.file.url)}" target="_blank" rel="noopener">${esc(doc.file.name)}</a>` : esc(doc.file.name)}</p>` : ''}
          <div class="grid2">
            <div class="field"><label>Platform</label><select id="fPlat">${[...new Set([...st.platforms, doc.platform])].map(p => `<option ${p === doc.platform ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></div>
            <div class="field"><label>Reference / invoice no.</label><input id="fRef" value="${esc(doc.reference)}" maxlength="80"></div>
            <div class="field"><label>Covers from</label><input type="date" id="fFrom" value="${esc(doc.date_from)}"></div>
            <div class="field"><label>to</label><input type="date" id="fTo" value="${esc(doc.date_to)}"></div>
          </div>
          <table><thead><tr><th>Campaign or item</th><th>Category</th><th>Results</th><th>Amount £</th><th></th></tr></thead><tbody>${lines.map((l, i) => `<tr>
            <td><input data-f="campaign" data-i="${i}" value="${esc(l.campaign)}" maxlength="200" placeholder="${l.is_fee ? 'Fees / VAT' : 'Campaign name'}"></td>
            <td>${l.is_fee ? '<span class="muted small">Fees &amp; VAT</span>' : `<input data-f="category" data-i="${i}" list="fCats" value="${esc(l.category)}" maxlength="60" placeholder="Suggested">`}</td>
            <td><input data-f="results" data-i="${i}" value="${esc(l.results || '')}" maxlength="60"></td>
            <td><input data-f="amount" data-i="${i}" inputmode="decimal" value="${esc(l.amount)}" style="text-align:right"></td>
            <td><button class="btn ghost small" data-rm="${i}" aria-label="Remove this line">✕</button></td></tr>`).join('')}</tbody></table>
          <datalist id="fCats">${st.cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
          <div class="row-actions"><button class="btn ghost small" id="fAdd">+ Campaign line</button><button class="btn ghost small" id="fFee">+ Fees or VAT line</button></div>
          <div class="tot">Total ${money(total())}</div>
          <div class="field"><label>Note (optional)</label><input id="fNote" value="${esc(doc.note)}" maxlength="500"></div>
          <div class="row-actions"><button class="btn" id="fSave" ${doc.duplicate ? 'disabled' : ''}>Save</button><button class="btn ghost" id="fX">Cancel</button></div>`;
        root.querySelectorAll('input[data-f]').forEach(inp => inp.oninput = () => { lines[+inp.dataset.i][inp.dataset.f] = inp.value; if (inp.dataset.f === 'amount') root.querySelector('.tot').textContent = 'Total ' + money(total()); });
        root.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { sync(); lines.splice(+b.dataset.rm, 1); if (!lines.length) lines.push({ campaign: '', category: '', results: '', amount: '', is_fee: false }); paint(); });
        root.querySelector('#fAdd').onclick = () => { sync(); lines.push({ campaign: '', category: '', results: '', amount: '', is_fee: false }); paint(); };
        root.querySelector('#fFee').onclick = () => { sync(); lines.push({ campaign: 'VAT', category: 'Fees & VAT', results: '', amount: '', is_fee: true }); paint(); };
        root.querySelector('#fX').onclick = ctx.closeModal;
        root.querySelector('#fSave').onclick = save;
      };
      const sync = () => { doc.platform = root.querySelector('#fPlat').value; doc.reference = root.querySelector('#fRef').value; doc.date_from = root.querySelector('#fFrom').value; doc.date_to = root.querySelector('#fTo').value; doc.note = root.querySelector('#fNote').value; };
      async function save() {
        sync();
        const out = lines.filter(l => String(l.campaign).trim() || String(l.amount).trim()).map(l => ({ campaign: String(l.campaign).trim(), category: String(l.category || '').trim(), results: l.results || '', amount: num(l.amount), is_fee: !!l.is_fee }));
        if (!out.length) { ctx.toast('Add at least one line.', true); return; }
        const bad = out.findIndex(l => !l.campaign || !Number.isFinite(l.amount)); if (bad >= 0) { ctx.toast(`Line ${bad + 1} needs a name and an amount.`, true); return; }
        if (!doc.date_from || !doc.date_to || doc.date_to < doc.date_from) { ctx.toast('Check the dates this receipt covers.', true); return; }
        const b = root.querySelector('#fSave'); b.disabled = true; b.textContent = 'Saving…';
        try {
          await ctx.call('doc.save', { id: doc.id || undefined, platform: doc.platform, account: doc.account, reference: doc.reference, txn_id: doc.txn_id, date_from: doc.date_from, date_to: doc.date_to, source: doc.source, note: doc.note, lines: out, ...(doc.file && doc.file.path ? { file_path: doc.file.path, file_name: doc.file.name, file_mime: doc.file.mime } : {}) });
          ctx.closeModal(); ctx.toast('Saved.'); try { const b2 = await ctx.call('bootstrap'); st.cats = b2.categories || st.cats; } catch (e) {} refresh();
        } catch (e) { ctx.toast(e.message, true); b.disabled = false; b.textContent = 'Save'; }
      }
      paint();
    }

    boot();
    return { unmount() { st.dead = true; } };
  }

  global.AdSpend = { mount };
})(window);
