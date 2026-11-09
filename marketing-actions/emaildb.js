/* Email database - the "Email database" tab of Marketing Actions.
 *
 *   const a = Emaildb.mount(element, { call, toast }); // later: a.unmount()
 *
 * Every email address the business holds, from every source, in one table (one row per address, with the sources it came from). Live sources are read by the backend
 * (ticket buyers, hotel guests, ordering apps, weddings, Christmas ...); other lists can be uploaded (CSV, TSV, Excel, or pasted) and the Brevo contacts and the enquiry
 * sheet can be pulled in. The table can be downloaded as a CSV: one row per person, or every record from every source, with a date range and the other filters applied.
 *
 * UNSUBSCRIBES: marketing uploads an unsubscribed list; those addresses are taken out of the database (and stay out, whichever app still holds them) and everyone else is then
 * treated as subscribed until a newer list says otherwise. A row can be edited (name, phone, address, even the email) or deleted by hand; deleted rows can be restored.
 *
 * Backend (email-db-api): summary, people, export, upload.start / upload.rows / upload.finish, source.update, source.delete, sync.brevo, sync.sheet, unsub.start / unsub.rows /
 * unsub.finish / unsub.undo, row.edit, row.delete, excluded.list, excluded.restore. Uses the host page's .btn / .tag / .loading / .empty / .pagehead / .field classes.
 */
(function (global) {
  'use strict';
  const CSS = `
.ed .strip{display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px; margin-bottom:14px}
.ed .strip div{background:var(--bone,#F8F8F8); border-radius:8px; padding:10px 14px}
.ed .strip b{display:block; font-family:var(--display,Georgia,serif); font-size:28px; line-height:1.05; color:var(--sage,#4D604F); font-weight:600}
.ed .strip span{font-size:10px; letter-spacing:var(--track-label,.18em); text-transform:uppercase; color:var(--sage-70,#7B887C)}
.ed .note{background:var(--attention-bg,#F7F0E4); border-radius:8px; padding:10px 14px; margin:0 0 14px; font-size:14px}
.ed .note.bad{background:var(--alert-bg,#F6EAE8); color:var(--alert,#8C4A3F)}
.ed .box{border:1px solid var(--mist,#e7e7e7); border-radius:8px; background:var(--white,#fff); margin-bottom:16px}
.ed .box>summary{cursor:pointer; padding:12px 14px; font-weight:600; color:var(--sage,#4D604F); list-style:none; display:flex; gap:10px; align-items:center; flex-wrap:wrap}
.ed .box>summary::-webkit-details-marker{display:none}
.ed .box>summary:before{content:'\\25B8'; font-size:12px} .ed .box[open]>summary:before{content:'\\25BE'}
.ed .box .in{padding:0 14px 14px}
.ed .wrap{overflow-x:auto; border:1px solid var(--mist,#e7e7e7); border-radius:8px; margin-bottom:12px}
.ed table.t{width:100%; border-collapse:separate; border-spacing:0; font-size:14px}
.ed .t th{font-size:10px; letter-spacing:var(--track-label,.18em); text-transform:uppercase; color:var(--sage-70,#7B887C); font-weight:600; text-align:left; padding:8px 10px; background:var(--bone,#F8F8F8); white-space:nowrap}
.ed .t th[title]{cursor:help; text-decoration:underline dotted}
.ed .t td{padding:8px 10px; border-top:1px solid var(--mist,#e7e7e7); background:var(--white,#fff); vertical-align:top}
.ed .t td.n{text-align:right; font-variant-numeric:tabular-nums}
.ed .t tr.grp td{background:var(--sage-10,#EDEFED); font-size:10px; letter-spacing:var(--track-label,.18em); text-transform:uppercase; color:var(--sage,#4D604F); font-weight:700}
.ed .t tr.editing td{background:var(--bone,#F8F8F8)}
.ed .t td input{width:100%; min-width:120px; padding:7px 8px; border:1px solid var(--mist,#e7e7e7); border-radius:6px; font-size:14px; margin-bottom:4px}
.ed .t a.src{color:var(--sage,#4D604F); cursor:pointer; text-decoration:underline}
.ed .muted{color:var(--sage-70,#7B887C)} .ed .small{font-size:12px}
.ed .filters{display:flex; gap:10px 14px; align-items:flex-end; flex-wrap:wrap; margin:0 0 12px}
.ed .filters .field{margin:0} .ed .filters .field input,.ed .filters .field select{min-width:150px; font-size:14px; padding:9px 10px}
.ed .filters .field input[type=date]{min-width:0; max-width:170px}
.ed .filters label.chk{display:flex; gap:6px; align-items:center; font-size:14px; min-height:44px}
.ed .filters label.chk input{width:18px; height:18px}
.ed .pager{display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:16px}
.ed .consent-opted_in{background:var(--good-bg,#E7EFE5); color:var(--good,#3C6B3F)}
.ed .consent-assumed{background:var(--sage-10,#EDEFED); color:var(--sage,#4D604F)}
.ed .consent-unsubscribed{background:var(--alert-bg,#F6EAE8); color:var(--alert,#8C4A3F)}
.ed .consent-not_opted_in{background:var(--mist,#e7e7e7); color:var(--sage-70,#7B887C)}
.ed .consent-unknown{background:var(--bone,#F8F8F8); color:var(--sage-70,#7B887C)}
.ed .map{display:grid; grid-template-columns:repeat(auto-fill,minmax(210px,1fr)); gap:10px; margin:10px 0}
.ed .map .field{margin:0} .ed .map select{font-size:14px; padding:8px}
.ed textarea.paste{width:100%; min-height:90px; font-size:13px; font-family:monospace; padding:8px; border:1px solid var(--mist,#e7e7e7); border-radius:8px}
.ed .row{display:flex; gap:10px; flex-wrap:wrap; align-items:center}
.ed .bar{height:8px; background:var(--mist,#e7e7e7); border-radius:99px; overflow:hidden; max-width:420px} .ed .bar i{display:block; height:100%; background:var(--sage,#4D604F)}
.ed .acts{white-space:nowrap}
.ed .acts .btn{margin-right:4px}
`;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = n => (n == null ? '' : Number(n).toLocaleString('en-GB'));
  const fmtDay = t => { if (!t) return ''; const d = new Date(t); return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' }); };
  const CONSENT = { opted_in: 'Opted in', assumed: 'Subscribed (assumed)', unsubscribed: 'Unsubscribed', not_opted_in: 'Not opted in', unknown: 'Not recorded' };
  const SORTS = [['recent', 'Latest activity first'], ['oldest', 'Earliest first added'], ['name', 'Name A-Z'], ['email', 'Email A-Z'], ['sources', 'Most sources first']];
  const BASIS = [['last', 'Latest activity'], ['first', 'First added']];
  const TIP_FIRST = 'The earliest date on any record we hold for this address: the nearest we have to when they first gave us their email.';
  const TIP_LAST = 'The newest date on any record for this address (latest booking, enquiry, order, sign-up or upload). It is not the date they gave us their email.';

  /* ---------------------------------------------------------- reading a file in the browser */
  function parseDelimited(text, delim) {
    const rows = []; let row = [], cell = '', inq = false; const t = text.replace(/^﻿/, '');
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (inq) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else inq = false; } else cell += c; }
      else if (c === '"' && !cell) inq = true;
      else if (c === delim) { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (c !== '\r') cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(x => String(x).trim()));
  }
  function parseText(text) {
    const first = text.split(/\r?\n/, 1)[0] || '';
    const delim = (first.match(/\t/g) || []).length > (first.match(/,/g) || []).length ? '\t' : (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
    return parseDelimited(text, delim);
  }
  let xlsxLoading = null;
  function loadXlsx() {
    if (global.XLSX) return Promise.resolve();
    if (!xlsxLoading) xlsxLoading = new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = ok; s.onerror = () => no(new Error('Could not load the Excel reader. Save the file as CSV and try again.')); document.head.appendChild(s); });
    return xlsxLoading;
  }
  async function readFile(file) {
    if (/\.(xlsx|xls|xlsm)$/i.test(file.name)) {
      await loadXlsx();
      const wb = global.XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      return global.XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }).map(r => r.map(x => String(x == null ? '' : x))).filter(r => r.some(x => x.trim()));
    }
    return parseText(await file.text());
  }

  /* which column is which, from the header words */
  const FIELDS = [
    ['email', 'Email address', /e-?mail/i],
    ['name', 'Full name', /^(full |customer |contact |guest )?name$/i],
    ['first', 'First name', /first/i],
    ['last', 'Surname', /^(last|sur)/i],
    ['phone', 'Mobile', /mobile|cell|^sms/i],
    ['phone2', 'Other phone', /phone|tel/i],
    ['address', 'Address', /^address/i],
    ['address2', 'Town / postcode', /post ?code|town|city/i],
    ['birthday', 'Birthday', /birth/i],
    ['anniversary', 'Anniversary', /anniv/i],
    ['spend', 'Total spend', /total spend|^spend|total$/i],
    ['date', 'Date added', /registration|created|joined|date added|signed|date/i],
  ];
  function autoMap(head) {
    const map = {}, used = new Set();
    for (const [k, , re] of FIELDS) { const i = head.findIndex((h, j) => !used.has(j) && re.test(String(h).trim())); if (i >= 0) { map[k] = i; used.add(i); } }
    if (map.email == null) { const i = head.findIndex(h => /mail/i.test(h)); if (i >= 0) map.email = i; }
    if (map.name != null) { delete map.first; delete map.last; }                       // a full-name column wins over first + last
    return map;
  }
  const isoDate = s => {                                                                      // day first, as UK files are
    const t = String(s || '').trim(); let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,T]+(\d{1,2}):(\d{2}))?/.exec(t);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}T${(m[4] || '12').padStart(2, '0')}:${m[5] || '00'}:00Z`;
    m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t); return m ? `${m[1]}-${m[2]}-${m[3]}T12:00:00Z` : null;
  };
  const EMAIL_RE = /^[^@\s,;<>()\[\]]+@[^@\s,;<>()\[\]]+\.[^@\s,;<>()\[\]]{2,}$/;
  function toRows(table, map) {
    const body = table.slice(1), g = (r, k) => (map[k] == null ? '' : String(r[map[k]] == null ? '' : r[map[k]]).trim());
    const withEmail = [];
    for (const r of body) {
      const email = g(r, 'email').toLowerCase(); if (!EMAIL_RE.test(email)) continue;
      const digits = s => s.replace(/\D/g, '').length;
      withEmail.push({
        email, name: map.name != null ? g(r, 'name') : [g(r, 'first'), g(r, 'last')].filter(Boolean).join(' '),
        phone: digits(g(r, 'phone')) >= 9 ? g(r, 'phone') : g(r, 'phone2'),
        address: [g(r, 'address'), g(r, 'address2')].filter(x => x && !/^[.,\s]*$/.test(x)).join(', '),
        birthday: g(r, 'birthday'), anniversary: g(r, 'anniversary'), spend: g(r, 'spend'), seen_at: isoDate(g(r, 'date')),
      });
    }
    return { total: body.length, withEmail };
  }
  /** An unsubscribed list: one column of addresses (or a table: the column that looks like email), or just addresses pasted one per line. */
  function listAddresses(table, col) {
    const out = new Set();
    for (const r of table.slice(1)) { const v = String(r[col] == null ? '' : r[col]).trim().toLowerCase(); if (EMAIL_RE.test(v)) out.add(v); }
    return [...out];
  }

  function mount(el, ctx) {
    if (!document.getElementById('ed-css')) { const s = document.createElement('style'); s.id = 'ed-css'; s.textContent = CSS; document.head.appendChild(s); }
    const st = { dead: false, sum: null, filters: { q: '', source: '', group: '', consent: '', multi: false, from: '', to: '', basis: 'last' }, sort: 'recent', page: 1, size: 50, people: null, busy: false, up: null, un: null, editing: null, deleted: null, timer: null };
    el.innerHTML = `<div class="ed"><div class="loading">Gathering every email address…</div></div>`;

    async function loadSummary() {
      try { st.sum = await ctx.call('summary'); }
      catch (e) { if (!st.dead) el.innerHTML = `<div class="ed"><div class="note bad">${esc(e.message)}</div><button class="btn" id="edRetry">Try again</button></div>`; const b = el.querySelector('#edRetry'); if (b) b.onclick = () => { el.innerHTML = `<div class="ed"><div class="loading">Gathering every email address…</div></div>`; start(); }; return false; }
      return true;
    }
    async function start() {
      st.pre = ctx.call('people', { filters: st.filters, sort: st.sort, page: st.page, size: st.size }).catch(() => null);        // the first page is fetched while the totals are
      if (await loadSummary() && !st.dead) { drawShell(); await loadPeople(); }
    }

    /* ------------------------------------------------------ shell: header, sources, uploads, unsubscribes, then the table */
    function stripHtml() {
      const t = st.sum.totals, r = st.sum.removed || {}, out = (r.unsubscribed_uploads || 0) + (r.unsubscribed_brevo || 0) + (r.deleted || 0);
      return `<div><b>${num(t.unique_emails)}</b><span>Different addresses</span></div><div><b>${num(t.multi_source)}</b><span>In 2 or more sources</span></div><div><b>${num(t.opted_in)}</b><span>Opted in (confirmed)</span></div>`
        + (st.sum.assume_subscribed ? `<div><b>${num(t.assumed)}</b><span>Subscribed (assumed)</span></div>` : `<div><b>${num((t.unknown || 0) + (t.not_opted_in || 0))}</b><span>No consent on record</span></div>`)
        + `<div><b>${num(out)}</b><span>Taken out (unsubscribed or deleted)</span></div>`;
    }
    function drawShell() {
      const groups = [...new Set(st.sum.sources.map(s => s.group))];
      el.innerHTML = `<div class="ed">
        <div class="pagehead"><h2>Email database</h2><span class="hint">Every address from every source in one table. Live sources are read fresh each time this tab opens.</span><span class="spacer"></span>
          <button class="btn ghost small" id="edRefresh">Refresh</button></div>
        <div class="strip" id="edStrip">${stripHtml()}</div>
        <div class="note small" id="edNote"></div>
        <details class="box" id="edSources"><summary>Where the addresses come from <span class="tag">${st.sum.sources.length} sources</span></summary><div class="in">${sourcesTable(groups)}</div></details>
        <details class="box" id="edUploads"${st.openUp ? ' open' : ''}><summary>Add a list, or pull one in <span class="tag">${st.sum.uploads.length} added</span></summary><div class="in" id="edUpBody">${uploadsHtml()}</div></details>
        <details class="box" id="edUnsub"${st.openUn ? ' open' : ''}><summary>Unsubscribed lists, and addresses taken out <span class="tag" id="edUnTag"></span></summary><div class="in" id="edUnBody"></div></details>
        <div class="filters">
          <div class="field"><label for="edQ">Search</label><input id="edQ" type="search" placeholder="Name, email, phone or source" value="${esc(st.filters.q)}"></div>
          <div class="field"><label for="edSrc">Source</label><select id="edSrc"><option value="">All sources</option>${st.sum.sources.map(s => `<option value="${esc(s.label)}"${st.filters.source === s.label ? ' selected' : ''}>${esc(s.label)}</option>`).join('')}</select></div>
          <div class="field"><label for="edGrp">Kind of source</label><select id="edGrp"><option value="">All</option>${groups.map(g => `<option${st.filters.group === g ? ' selected' : ''}>${esc(g)}</option>`).join('')}</select></div>
          <div class="field"><label for="edCon">Marketing consent</label><select id="edCon"><option value="">Any</option>${Object.entries(CONSENT).filter(([k]) => k !== 'unsubscribed').map(([k, l]) => `<option value="${k}"${st.filters.consent === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
          <div class="field"><label for="edBasis">Dates are</label><select id="edBasis">${BASIS.map(([k, l]) => `<option value="${k}"${st.filters.basis === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
          <div class="field"><label for="edFrom">From</label><input id="edFrom" type="date" value="${esc(st.filters.from)}"></div>
          <div class="field"><label for="edTo">To</label><input id="edTo" type="date" value="${esc(st.filters.to)}"></div>
          <label class="chk"><input type="checkbox" id="edMulti"${st.filters.multi ? ' checked' : ''}> In 2 or more sources</label>
          <div class="field"><label for="edSort">Order</label><select id="edSort">${SORTS.map(([k, l]) => `<option value="${k}"${st.sort === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
          <button class="btn ghost small" id="edClear">Clear filters</button>
        </div>
        <div class="row" style="margin-bottom:12px"><span id="edCount" class="muted"></span><span style="flex:1"></span>
          <button class="btn" id="edDlPeople">Download CSV: one row per person</button> <button class="btn ghost" id="edDlRecords">Download CSV: every record, every source</button></div>
        <div id="edTable"></div>
        <p class="small muted">The downloads follow the search, dates and filters above (clear them to get everything). "One row per person" merges an address that appears in several sources into one line and lists the sources; "every record" keeps one line per address per source, with the detail and date from that source.</p></div>`;
      noteHtml(); unsubBody();
      wire();
    }
    function noteHtml() {
      const n = el.querySelector('#edNote'); if (!n) return;
      n.innerHTML = (st.sum.assume_subscribed
        ? `<b>Everyone here is treated as subscribed</b> unless they were on an unsubscribed list${st.sum.assumed_since ? ` (the last one was uploaded ${esc(fmtDay(st.sum.assumed_since))})` : ''}. "Opted in" marks people who confirmed it themselves. `
        : `"Opted in" is only where a customer ticked a marketing box or is on a Brevo list; everyone else has no consent on record. Upload an unsubscribed list below and everyone not on it is then treated as subscribed. `)
        + `Staff addresses and test orders are left out, and so is anyone unsubscribed in Brevo.`;
    }
    const groupRows = groups => groups.map(g => `<tr class="grp"><td colspan="5">${esc(g)}</td></tr>` + st.sum.sources.filter(s => s.group === g).map(s => `<tr><td><a class="src" data-src="${esc(s.label)}">${esc(s.label)}</a></td><td class="n">${num(s.records)}</td><td class="n">${num(s.unique_emails)}</td><td class="n">${num(s.only_here)}</td><td class="small muted">${esc(fmtDay(s.latest))}</td></tr>`).join('')).join('');
    const sourcesTable = groups => `<div class="wrap"><table class="t"><thead><tr><th>Source</th><th>Records</th><th>Addresses</th><th>Only in this source</th><th>Latest</th></tr></thead><tbody>${groupRows(groups)}</tbody></table></div>
      <p class="small muted">Click a source to filter the table to it. Addresses can be in more than one source, so the addresses here add up to more than the total above. Also checked and left out on purpose: staff and starters, suppliers, file-transfer recipients, accident reports, and review-site notification emails.</p>`;

    function uploadsHtml() {
      const u = st.up;
      const list = st.sum.uploads.length ? `<div class="wrap"><table class="t"><thead><tr><th>List</th><th>From</th><th>Rows</th><th>Addresses kept</th><th>Added</th><th>Consent</th><th></th></tr></thead><tbody>${st.sum.uploads.map(s => `<tr><td><b>${esc(s.label)}</b></td><td class="small">${s.kind === 'upload' ? esc(s.filename || 'Upload') : s.kind === 'brevo' ? 'Brevo (pulled in)' : 'Enquiry sheet (pulled in)'}</td><td class="n">${num(s.rows_total)}</td><td class="n">${num(s.rows_kept)}</td><td class="small">${esc(fmtDay(s.synced_at || s.created_at))}</td>
        <td>${s.kind === 'upload' ? `<select data-cons="${esc(s.id)}" aria-label="Marketing consent for ${esc(s.label)}">${Object.entries(CONSENT).filter(([k]) => k !== 'assumed').map(([k, l]) => `<option value="${k}"${s.consent === k ? ' selected' : ''}>${l}</option>`).join('')}</select>` : `<span class="small muted">Per address</span>`}</td>
        <td style="white-space:nowrap">${s.kind === 'upload' ? `<button class="btn ghost small" data-ren="${esc(s.id)}">Rename</button> ` : ''}<button class="btn danger small" data-del="${esc(s.id)}">Delete</button></td></tr>`).join('')}</tbody></table></div>` : `<p class="muted small">Nothing has been added yet.</p>`;
      const pull = `<div class="row" style="margin:6px 0 14px"><button class="btn ghost small" id="edBrevo"${st.sum.brevo_ready ? '' : ' disabled'}>${st.sum.uploads.some(s => s.kind === 'brevo') ? 'Refresh' : 'Pull in'} the Brevo contacts</button> <button class="btn ghost small" id="edSheet">${st.sum.uploads.some(s => s.kind === 'sheet') ? 'Refresh' : 'Pull in'} the enquiry sheet</button> <span class="small muted">Brevo marks who has unsubscribed, and those people are taken out.</span></div>`;
      let form;
      if (!u) form = `<h4 style="margin:14px 0 6px">Upload a list</h4><div class="row"><input type="file" id="edFile" accept=".csv,.tsv,.txt,.xlsx,.xls,.xlsm" aria-label="Choose a file"> <span class="small muted">CSV, Excel or tab-separated, with a header row. (A list of people who have unsubscribed goes in the next section, not here.)</span></div>
        <details style="margin-top:8px"><summary class="small muted" style="cursor:pointer">Or paste addresses</summary><textarea class="paste" id="edPaste" placeholder="One address per line, or paste a table with a header row"></textarea><button class="btn ghost small" id="edPasteGo" style="margin-top:6px">Read it</button></details>`;
      else {
        const head = u.table[0], r = toRows(u.table, u.map);
        form = `<h4 style="margin:14px 0 6px">${esc(u.filename)}</h4>
          <div class="note small">${num(u.table.length - 1)} rows. <b>${num(r.withEmail.length)}</b> have a valid email address (${num(new Set(r.withEmail.map(x => x.email)).size)} different); the rest have none and are skipped. Check each column below is matched to the right thing.</div>
          <div class="map">${FIELDS.map(([k, l]) => `<div class="field"><label for="edm_${k}">${l}</label><select id="edm_${k}" data-map="${k}"><option value="">(none)</option>${head.map((h, i) => `<option value="${i}"${u.map[k] === i ? ' selected' : ''}>${esc(String(h).trim() || 'Column ' + (i + 1))}</option>`).join('')}</select></div>`).join('')}</div>
          <div class="row"><div class="field" style="margin:0;flex:1;min-width:220px"><label for="edLabel">Name of this list</label><input id="edLabel" value="${esc(u.label)}" maxlength="120"></div>
            <div class="field" style="margin:0"><label for="edUCon">Marketing consent for everyone in it</label><select id="edUCon">${Object.entries(CONSENT).filter(([k]) => k !== 'assumed').map(([k, l]) => `<option value="${k}"${u.consent === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div></div>
          ${r.withEmail.length ? `<div class="wrap" style="margin-top:10px"><table class="t"><thead><tr><th>Email</th><th>Name</th><th>Phone</th><th>Address</th><th>Date</th></tr></thead><tbody>${r.withEmail.slice(0, 4).map(x => `<tr><td>${esc(x.email)}</td><td>${esc(x.name)}</td><td>${esc(x.phone)}</td><td class="small">${esc(x.address)}</td><td class="small">${esc((x.seen_at || '').slice(0, 10))}</td></tr>`).join('')}</tbody></table></div><p class="small muted" style="margin:0 0 8px">First four rows as they will be saved.</p>` : `<div class="note bad">No valid email addresses found with these columns. Pick the email column above.</div>`}
          ${u.busy ? `<div class="bar"><i style="width:${Math.round(100 * u.done / Math.max(1, r.withEmail.length))}%"></i></div><p class="small muted">Saving ${num(u.done)} of ${num(r.withEmail.length)}…</p>`
            : `<div class="row"><button class="btn" id="edSave"${r.withEmail.length ? '' : ' disabled'}>Add ${num(r.withEmail.length)} addresses</button> <button class="btn ghost" id="edCancel">Cancel</button></div>`}`;
      }
      return list + pull + form;
    }
    const redrawUploads = () => { const b = el.querySelector('#edUpBody'); if (b) { b.innerHTML = uploadsHtml(); wireUploads(); } };

    /* ------------------------------------------------------ unsubscribed lists */
    function unsubBody() {
      const body = el.querySelector('#edUnBody'); if (!body) return;
      const r = st.sum.removed || {}, u = st.un, batches = st.sum.batches || [];
      const tag = el.querySelector('#edUnTag'); if (tag) tag.textContent = num((r.unsubscribed_uploads || 0) + (r.unsubscribed_brevo || 0) + (r.deleted || 0)) + ' out';
      let form;
      if (!u) form = `<h4 style="margin:6px 0">Upload an unsubscribed list</h4>
        <p class="small muted" style="margin:0 0 8px">Everyone on the list is taken out of the database, and stays out even if one of the apps still holds them. <b>Everyone left is then treated as subscribed</b> until you upload a newer list. Use a CSV or Excel file with an email column, or paste the addresses.</p>
        <div class="row"><input type="file" id="edUnFile" accept=".csv,.tsv,.txt,.xlsx,.xls,.xlsm" aria-label="Choose the unsubscribed list"></div>
        <details style="margin-top:8px"><summary class="small muted" style="cursor:pointer">Or paste addresses</summary><textarea class="paste" id="edUnPaste" placeholder="One address per line"></textarea><button class="btn ghost small" id="edUnPasteGo" style="margin-top:6px">Read it</button></details>`;
      else {
        const head = u.table[0], list = listAddresses(u.table, u.col);
        form = `<h4 style="margin:6px 0">${esc(u.filename)}</h4>
          <div class="row" style="margin-bottom:8px"><div class="field" style="margin:0"><label for="edUnCol">Column with the email addresses</label><select id="edUnCol">${head.map((h, i) => `<option value="${i}"${u.col === i ? ' selected' : ''}>${esc(String(h).trim() || 'Column ' + (i + 1))}</option>`).join('')}</select></div>
            <div class="field" style="margin:0;flex:1;min-width:220px"><label for="edUnLabel">Name of this list</label><input id="edUnLabel" value="${esc(u.label)}" maxlength="120"></div></div>
          ${list.length ? `<div class="note small"><b>${num(list.length)}</b> different addresses (of ${num(u.table.length - 1)} rows). They will be taken out of the database, and everyone else treated as subscribed. Example: ${esc(list.slice(0, 3).join(', '))}.</div>` : `<div class="note bad">No valid email addresses in that column.</div>`}
          ${u.busy ? `<div class="bar"><i style="width:${Math.round(100 * u.done / Math.max(1, list.length))}%"></i></div><p class="small muted">Taking out ${num(u.done)} of ${num(list.length)}…</p>`
            : `<div class="row"><button class="btn" id="edUnGo"${list.length ? '' : ' disabled'}>Take out ${num(list.length)} addresses</button> <button class="btn ghost" id="edUnCancel">Cancel</button></div>`}`;
      }
      const bt = batches.length ? `<div class="wrap" style="margin-top:12px"><table class="t"><thead><tr><th>Unsubscribed list</th><th>Addresses taken out</th><th>Uploaded</th><th>By</th><th></th></tr></thead><tbody>${batches.map(b => `<tr><td><b>${esc(b.label)}</b>${b.filename && b.filename !== b.label ? `<div class="small muted">${esc(b.filename)}</div>` : ''}</td><td class="n">${num(b.rows_added)}</td><td class="small">${esc(fmtDay(b.created_at))}</td><td class="small">${esc(b.created_by || '')}</td><td><button class="btn danger small" data-unundo="${esc(b.id)}">Undo</button></td></tr>`).join('')}</tbody></table></div>` : '';
      const dl = st.deleted;
      const dtab = dl ? (dl.length ? `<div class="wrap"><table class="t"><thead><tr><th>Deleted by hand</th><th>When</th><th>By</th><th></th></tr></thead><tbody>${dl.map(d => `<tr><td>${esc(d.email)}</td><td class="small">${esc(fmtDay(d.added_at))}</td><td class="small">${esc(d.added_by || '')}</td><td><button class="btn ghost small" data-restore="${esc(d.email)}">Put back</button></td></tr>`).join('')}</tbody></table></div>` : `<p class="small muted">Nothing has been deleted by hand.</p>`) : '';
      body.innerHTML = form + bt + `<div class="row" style="margin-top:10px"><span class="small muted">Also out: ${num(r.unsubscribed_brevo)} unsubscribed in Brevo, ${num(r.deleted)} deleted by hand.</span><span style="flex:1"></span>
        <button class="btn ghost small" id="edShowDel">${dl ? 'Hide' : 'Show'} the ones deleted by hand</button> <button class="btn ghost small" id="edDlOut">Download everyone taken out (CSV)</button></div>` + dtab;
      wireUnsub();
    }
    function wireUnsub() {
      const $ = s => el.querySelector('#edUnBody ' + s);
      const file = $('#edUnFile'); if (file) file.onchange = async () => {
        const f = file.files[0]; if (!f) return;
        try { let table = await readFile(f); if (table.length && table.every(r => r.length === 1) && !/e-?mail/i.test(table[0][0])) table = [['Email'], ...table]; beginUn(table, f.name); }
        catch (e) { ctx.toast(e.message || 'Could not read that file.', true); }
      };
      const pg = $('#edUnPasteGo'); if (pg) pg.onclick = () => {
        const text = ($('#edUnPaste').value || '').trim(); if (!text) return;
        let table = parseText(text); if (table.length && table.every(r => r.length === 1) && !/e-?mail/i.test(table[0][0])) table = [['Email'], ...table];
        if (!table.length) return ctx.toast('Nothing to read there.', true); beginUn(table, 'Pasted list');
      };
      const col = $('#edUnCol'); if (col) col.onchange = () => { st.un.col = Number(col.value); st.un.label = ($('#edUnLabel') || {}).value || st.un.label; unsubBody(); };
      const lb = $('#edUnLabel'); if (lb) lb.oninput = () => { st.un.label = lb.value; };
      const go = $('#edUnGo'); if (go) go.onclick = () => sure(go, 'Sure? Press again to take them out', takeOut);
      const ca = $('#edUnCancel'); if (ca) ca.onclick = () => { st.un = null; unsubBody(); };
      el.querySelectorAll('#edUnBody [data-unundo]').forEach(b => b.onclick = () => sure(b, 'Sure? They come back', async () => {
        try { await ctx.call('unsub.undo', { batch_id: b.dataset.unundo }); ctx.toast('Upload undone: those addresses are back in the database.'); await refreshAll(true); } catch (e) { ctx.toast(e.message, true); }
      }));
      const sd = $('#edShowDel'); if (sd) sd.onclick = async () => {
        if (st.deleted) { st.deleted = null; return unsubBody(); }
        try { st.deleted = (await ctx.call('excluded.list')).rows; unsubBody(); } catch (e) { ctx.toast(e.message, true); }
      };
      el.querySelectorAll('#edUnBody [data-restore]').forEach(b => b.onclick = async () => {
        try { await ctx.call('excluded.restore', { email: b.dataset.restore }); ctx.toast('Put back.'); st.deleted = (await ctx.call('excluded.list')).rows; await refreshTop(); loadPeople(); } catch (e) { ctx.toast(e.message, true); }
      });
      const dl = $('#edDlOut'); if (dl) dl.onclick = () => download('unsubscribed', dl);
    }
    function beginUn(table, filename) {
      const head = table[0]; let col = head.findIndex(h => /e-?mail/i.test(String(h))); if (col < 0) col = 0;
      st.un = { table, filename, col, label: filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Unsubscribed list', busy: false, done: 0 };
      st.openUn = true; const d = el.querySelector('#edUnsub'); if (d) d.open = true; unsubBody();
    }
    async function takeOut() {
      const u = st.un; if (!u || u.busy || st.busy) return;
      u.label = (el.querySelector('#edUnLabel') || {}).value || u.label;
      const list = listAddresses(u.table, u.col); if (!list.length) return;
      const before = st.sum.totals.unique_emails;
      u.busy = true; u.done = 0; st.busy = true; unsubBody();
      try {
        const s = await ctx.call('unsub.start', { label: u.label, filename: u.filename, rows_total: u.table.length - 1, rows_valid: list.length });
        for (let i = 0; i < list.length; i += 1000) { await ctx.call('unsub.rows', { batch_id: s.id, emails: list.slice(i, i + 1000) }); u.done = Math.min(list.length, i + 1000); if (st.dead) return; unsubBody(); }
        await ctx.call('unsub.finish', { batch_id: s.id });
        st.un = null; st.busy = false; st.openUn = true; await refreshAll(true);
        const gone = Math.max(0, before - st.sum.totals.unique_emails);
        ctx.toast(`Done: ${num(gone)} of the ${num(list.length)} addresses were in the database and are now out. Everyone else is treated as subscribed.`);
      } catch (e) { u.busy = false; st.busy = false; ctx.toast(e.message, true); unsubBody(); }
    }

    /* ------------------------------------------------------ the people table */
    function rowHtml(r) {
      if (st.editing === r.email) return `<tr class="editing" data-row="${esc(r.email)}"><td><input id="edeEmail" value="${esc(r.email)}" aria-label="Email address"></td><td><input id="edeName" value="${esc(r.name || '')}" placeholder="Name" aria-label="Name"><input id="edeAddr" value="${esc(r.address || '')}" placeholder="Address" aria-label="Address"></td><td><input id="edePhone" value="${esc(r.phone || '')}" placeholder="Phone" aria-label="Phone"></td>
          <td colspan="3" class="small muted">Corrections are kept here; the apps the address came from are not changed.</td><td class="acts"><button class="btn small" data-save="${esc(r.email)}">Save</button><button class="btn ghost small" data-editcancel="1">Cancel</button></td></tr>`;
      return `<tr><td>${esc(r.email)}</td><td>${esc(r.name || '')}${r.edited ? ' <span class="tag">edited</span>' : ''}${r.address ? `<div class="small muted">${esc(r.address)}</div>` : ''}</td><td class="small" style="white-space:nowrap">${esc(r.phone || '')}</td>
          <td><span class="tag consent-${esc(r.consent)}">${esc(CONSENT[r.consent] || r.consent)}</span></td><td class="small">${esc(r.sources || '')}${r.source_count > 1 ? ` <span class="muted">(${r.source_count})</span>` : ''}</td><td class="small" style="white-space:nowrap">${esc(fmtDay(r.first_seen))}</td><td class="small" style="white-space:nowrap">${esc(fmtDay(r.last_seen))}</td>
          <td class="acts"><button class="btn ghost small" data-edit="${esc(r.email)}">Edit</button><button class="btn danger small" data-rowdel="${esc(r.email)}">Delete</button></td></tr>`;
    }
    function draw() {
      const box = el.querySelector('#edTable'), cnt = el.querySelector('#edCount'); if (!box) return;
      const p = st.people;
      if (!p) { box.innerHTML = `<div class="loading">Loading…</div>`; return; }
      const pages = Math.max(1, Math.ceil((p.total || 0) / st.size)), f = st.filters;
      cnt.textContent = `${num(p.total)} ${p.total === 1 ? 'address' : 'addresses'}${(f.q || f.source || f.group || f.consent || f.multi || f.from || f.to) ? ' match' : ''}`;
      box.innerHTML = p.rows.length ? `<div class="wrap"><table class="t"><thead><tr><th>Email</th><th>Name</th><th>Phone</th><th>Consent</th><th>Sources</th><th title="${esc(TIP_FIRST)}">First added</th><th title="${esc(TIP_LAST)}">Latest activity</th><th></th></tr></thead><tbody>${p.rows.map(rowHtml).join('')}</tbody></table></div>
        <div class="pager"><button class="btn ghost small" id="edPrev"${st.page <= 1 ? ' disabled' : ''}>Previous</button><span class="small muted">Page ${st.page} of ${pages}</span><button class="btn ghost small" id="edNext"${st.page >= pages ? ' disabled' : ''}>Next</button></div>`
        : `<div class="empty">No addresses match.</div>`;
      const pv = box.querySelector('#edPrev'), nx = box.querySelector('#edNext');
      if (pv) pv.onclick = () => { st.page--; loadPeople(); window.scrollTo({ top: el.offsetTop, behavior: 'smooth' }); };
      if (nx) nx.onclick = () => { st.page++; loadPeople(); window.scrollTo({ top: el.offsetTop, behavior: 'smooth' }); };
      box.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => { st.editing = b.dataset.edit; draw(); const i = box.querySelector('#edeName'); if (i) i.focus(); });
      const ec = box.querySelector('[data-editcancel]'); if (ec) ec.onclick = () => { st.editing = null; draw(); };
      const sv = box.querySelector('[data-save]'); if (sv) sv.onclick = async () => {
        const g = id => (box.querySelector(id) || {}).value || ''; sv.disabled = true;
        try { await ctx.call('row.edit', { email: sv.dataset.save, new_email: g('#edeEmail').trim().toLowerCase() === sv.dataset.save ? '' : g('#edeEmail'), name: g('#edeName'), phone: g('#edePhone'), address: g('#edeAddr') }); st.editing = null; ctx.toast('Saved.'); loadPeople(); }
        catch (e) { sv.disabled = false; ctx.toast(e.message, true); }
      };
      box.querySelectorAll('[data-rowdel]').forEach(b => b.onclick = () => sure(b, 'Sure? Press again to delete', async () => {
        try { await ctx.call('row.delete', { email: b.dataset.rowdel }); ctx.toast('Deleted. They are out of the database (the apps they came from are not changed). You can put them back under "taken out".'); await refreshTop(); loadPeople(); } catch (e) { ctx.toast(e.message, true); }
      }));
    }
    let seq = 0;
    async function loadPeople() {
      const mine = ++seq;
      try { const pre = st.pre; st.pre = null; const early = pre ? await pre : null; if (early) { if (st.dead || mine !== seq) return; st.people = early; return draw(); }
        const r = await ctx.call('people', { filters: st.filters, sort: st.sort, page: st.page, size: st.size }); if (st.dead || mine !== seq) return; st.people = r; draw(); }
      catch (e) { if (!st.dead && mine === seq) { const box = el.querySelector('#edTable'); if (box) box.innerHTML = `<div class="note bad">${esc(e.message)}</div>`; } }
    }
    /** New totals, strip and unsubscribe panel, without redrawing the whole tab. */
    async function refreshTop() {
      if (!(await loadSummary()) || st.dead) return;
      const strip = el.querySelector('#edStrip'); if (strip) strip.innerHTML = stripHtml();
      noteHtml(); unsubBody();
    }

    function wire() {
      const $ = s => el.querySelector(s);
      const again = () => { st.page = 1; loadPeople(); };
      $('#edRefresh').onclick = async () => { st.people = null; draw(); if (await loadSummary()) { drawShell(); loadPeople(); } };
      $('#edQ').oninput = e => { st.filters.q = e.target.value; clearTimeout(st.timer); st.timer = setTimeout(again, 350); };
      $('#edSrc').onchange = e => { st.filters.source = e.target.value; again(); };
      $('#edGrp').onchange = e => { st.filters.group = e.target.value; again(); };
      $('#edCon').onchange = e => { st.filters.consent = e.target.value; again(); };
      $('#edBasis').onchange = e => { st.filters.basis = e.target.value; if (st.filters.from || st.filters.to) again(); };
      $('#edFrom').onchange = e => { st.filters.from = e.target.value; again(); };
      $('#edTo').onchange = e => { st.filters.to = e.target.value; again(); };
      $('#edMulti').onchange = e => { st.filters.multi = e.target.checked; again(); };
      $('#edSort').onchange = e => { st.sort = e.target.value; again(); };
      $('#edClear').onclick = () => { st.filters = { q: '', source: '', group: '', consent: '', multi: false, from: '', to: '', basis: 'last' }; st.sort = 'recent'; st.page = 1; drawShell(); loadPeople(); };
      $('#edDlPeople').onclick = e => download('people', e.target);
      $('#edDlRecords').onclick = e => download('records', e.target);
      el.querySelectorAll('[data-src]').forEach(a => a.onclick = () => { st.filters.source = a.dataset.src; st.page = 1; const s = $('#edSrc'); if (s) s.value = a.dataset.src; loadPeople(); $('#edQ').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
      el.querySelector('#edUploads').addEventListener('toggle', e => { st.openUp = e.target.open; });
      el.querySelector('#edUnsub').addEventListener('toggle', e => { st.openUn = e.target.open; });
      wireUploads();
      draw();
    }

    async function download(mode, btn) {
      if (st.busy) return; st.busy = true; const old = btn.textContent; btn.disabled = true; btn.textContent = 'Preparing…';
      try {
        const r = await ctx.call('export', { mode, filters: st.filters });
        const blob = new Blob([r.csv], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = r.filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        ctx.toast(`Downloaded ${num(r.rows)} rows.`);
      } catch (e) { ctx.toast(e.message, true); }
      st.busy = false; btn.disabled = false; btn.textContent = old;
    }

    /* ------------------------------------------------------ uploads, renames, deletes, pulls */
    function wireUploads() {
      const $ = s => el.querySelector('#edUpBody ' + s);
      const file = $('#edFile'); if (file) file.onchange = async () => {
        const f = file.files[0]; if (!f) return;
        try { const table = await readFile(f); if (table.length < 2) return ctx.toast('That file has no rows under the header.', true); begin(table, f.name); }
        catch (e) { ctx.toast(e.message || 'Could not read that file.', true); }
      };
      const pg = $('#edPasteGo'); if (pg) pg.onclick = () => {
        const text = ($('#edPaste').value || '').trim(); if (!text) return;
        let table = parseText(text);
        if (table.length && table.every(r => r.length === 1) && !/e-?mail/i.test(table[0][0])) table = [['Email'], ...table];     // a plain list of addresses
        if (table.length < 2) return ctx.toast('Nothing to read there.', true); begin(table, 'Pasted list');
      };
      el.querySelectorAll('#edUpBody [data-map]').forEach(s => s.onchange = () => { st.up.map[s.dataset.map] = s.value === '' ? undefined : Number(s.value); if (s.dataset.map === 'name' && s.value !== '') { delete st.up.map.first; delete st.up.map.last; } st.up.label = ($('#edLabel') || {}).value || st.up.label; st.up.consent = ($('#edUCon') || {}).value || st.up.consent; redrawUploads(); });
      const lb = $('#edLabel'); if (lb) lb.oninput = () => { st.up.label = lb.value; };
      const uc = $('#edUCon'); if (uc) uc.onchange = () => { st.up.consent = uc.value; };
      const sv = $('#edSave'); if (sv) sv.onclick = save;
      const ca = $('#edCancel'); if (ca) ca.onclick = () => { st.up = null; redrawUploads(); };
      el.querySelectorAll('#edUpBody [data-cons]').forEach(s => s.onchange = async () => { try { await ctx.call('source.update', { id: s.dataset.cons, consent: s.value }); ctx.toast('Consent updated.'); await refreshAll(); } catch (e) { ctx.toast(e.message, true); } });
      el.querySelectorAll('#edUpBody [data-ren]').forEach(b => b.onclick = async () => {
        const s = st.sum.uploads.find(x => x.id === b.dataset.ren); const n = prompt('New name for this list', s.label);          // plain browser prompt: the host page has no text-box dialog
        if (n && n.trim() && n.trim() !== s.label) { try { await ctx.call('source.update', { id: s.id, label: n.trim() }); ctx.toast('Renamed.'); await refreshAll(); } catch (e) { ctx.toast(e.message, true); } }
      });
      el.querySelectorAll('#edUpBody [data-del]').forEach(b => b.onclick = () => sure(b, 'Sure? Press again to delete', async () => {
        try { await ctx.call('source.delete', { id: b.dataset.del }); ctx.toast('Deleted. Those addresses are gone from this table.'); await refreshAll(); } catch (e) { ctx.toast(e.message, true); }
      }));
      const bv = $('#edBrevo'); if (bv) bv.onclick = () => pull('sync.brevo', bv, r => `Brevo: ${num(r.contacts)} contacts read, ${num(r.unsubscribed)} unsubscribed (taken out).`);
      const sh = $('#edSheet'); if (sh) sh.onclick = () => pull('sync.sheet', sh, r => `Enquiry sheet: ${num(r.rows)} rows read, ${num(r.kept)} addresses kept.`);
    }
    function sure(b, text, go) { if (b.dataset.sure === '1') return go(); const old = b.textContent; b.dataset.sure = '1'; b.textContent = text; setTimeout(() => { b.dataset.sure = ''; b.textContent = old; }, 5000); }
    async function pull(action, btn, say) {
      if (st.busy) return; st.busy = true; const old = btn.textContent; btn.disabled = true; btn.textContent = 'Reading…';
      try { const r = await ctx.call(action); ctx.toast(say(r)); await refreshAll(); }
      catch (e) { ctx.toast(e.message, true); btn.disabled = false; btn.textContent = old; }
      st.busy = false;
    }
    async function refreshAll(unsub) { if (unsub) st.openUn = true; else st.openUp = true; if (await loadSummary()) { drawShell(); loadPeople(); } }
    function begin(table, filename) {
      const stem = filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Uploaded list';
      st.up = { table, filename, map: autoMap(table[0]), label: stem, consent: 'unknown', busy: false, done: 0 };
      st.openUp = true; const d = el.querySelector('#edUploads'); if (d) d.open = true; redrawUploads();
    }
    async function save() {
      const u = st.up; if (!u || u.busy || st.busy) return;
      const label = (el.querySelector('#edLabel') || {}).value || u.label; if (!label.trim()) return ctx.toast('Give the list a name.', true);
      u.label = label.trim(); u.consent = (el.querySelector('#edUCon') || {}).value || u.consent;
      const r = toRows(u.table, u.map); if (!r.withEmail.length) return;
      const clash = st.sum.uploads.find(s => s.kind === 'upload' && (s.filename === u.filename || s.label === u.label));
      let replace = null; if (clash) { if (!confirm(`"${clash.label}" is already here (${num(clash.rows_kept)} addresses). Replace it with this file?`)) return; replace = clash.id; }
      u.busy = true; u.done = 0; st.busy = true; redrawUploads();
      try {
        const s = await ctx.call('upload.start', { label: u.label, filename: u.filename, consent: u.consent, rows_total: r.total, rows_with_email: r.withEmail.length, replace_id: replace });
        for (let i = 0; i < r.withEmail.length; i += 500) { await ctx.call('upload.rows', { source_id: s.id, rows: r.withEmail.slice(i, i + 500) }); u.done = Math.min(r.withEmail.length, i + 500); if (st.dead) return; redrawUploads(); }
        const f = await ctx.call('upload.finish', { source_id: s.id });
        ctx.toast(`Added ${num(f.kept)} addresses from ${u.label}.` + (f.kept < r.withEmail.length ? ` ${num(r.withEmail.length - f.kept)} repeated an address already in the list.` : ''));
        st.up = null; st.busy = false; await refreshAll();
      } catch (e) { u.busy = false; st.busy = false; ctx.toast(e.message, true); redrawUploads(); }
    }

    start();
    return { unmount() { st.dead = true; clearTimeout(st.timer); el.innerHTML = ''; } };
  }
  global.Emaildb = { mount };
})(window);
