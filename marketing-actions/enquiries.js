/* Enquiries - the "Enquiries" tab of Marketing Actions.
 *
 *   const a = Enquiries.mount(element, { call, toast }); // later: a.unmount()
 *
 * Shows everyone in the enquiry Google Sheet (tab 1 = live form submissions, tab 2 = the historic list), read live each time the tab opens, and whether each person is already
 * in the Weddings & Events tracker (matched by email, then phone; a matching name alone is shown as "check"). People who are not there can be added to the tracker with their
 * message as the first note. Backend (enquiries-api): bootstrap, list, add. Uses the host page's .btn / .tag / .loading / .empty / .pagehead classes.
 */
(function (global) {
  'use strict';
  const CSS = `
.en .strip{display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px; margin-bottom:14px}
.en .strip div{background:var(--bone,#F8F8F8); border-radius:8px; padding:10px 14px}
.en .strip b{display:block; font-family:var(--display,Georgia,serif); font-size:28px; line-height:1.05; color:var(--sage,#4D604F); font-weight:600}
.en .strip span{font-size:10px; letter-spacing:var(--track-label,.18em); text-transform:uppercase; color:var(--sage-70,#7B887C)}
.en .ctl{display:flex; gap:8px 12px; align-items:center; flex-wrap:wrap; margin:0 0 14px}
.en .chip{border:1px solid var(--mist,#e7e7e7); background:var(--white,#fff); border-radius:999px; padding:7px 14px; cursor:pointer; font-size:13px; min-height:38px}
.en .chip[aria-pressed="true"]{background:var(--sage,#4D604F); border-color:var(--sage,#4D604F); color:#fff; font-weight:600}
.en .wrap{overflow-x:auto; border:1px solid var(--mist,#e7e7e7); border-radius:8px; margin-bottom:18px}
.en table.t{width:100%; border-collapse:separate; border-spacing:0; font-size:14px}
.en .t th{font-size:10px; letter-spacing:var(--track-label,.18em); text-transform:uppercase; color:var(--sage-70,#7B887C); font-weight:600; text-align:left; padding:8px 10px; background:var(--bone,#F8F8F8); white-space:nowrap}
.en .t td{padding:9px 10px; border-top:1px solid var(--mist,#e7e7e7); background:var(--white,#fff); vertical-align:top}
.en .t td.msg{min-width:220px; max-width:380px}
.en .t td.msg details summary{cursor:pointer; color:var(--sage,#4D604F)}
.en .muted{color:var(--sage-70,#7B887C)} .en .small{font-size:12px}
.en .note{background:var(--attention-bg,#F7F0E4); border-radius:8px; padding:10px 14px; margin:0 0 14px; font-size:14px}
.en .note.bad{background:var(--alert-bg,#F6EAE8); color:var(--alert,#8C4A3F)}
.en .t input[type=checkbox]{width:20px; height:20px}
`;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtWhen = w => { if (!w) return ''; const m = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}:\d{2}))?/.exec(w); if (!m) return w; const d = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00Z`); return d.toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }) + (m[4] && m[4] !== '00:00' ? ' ' + m[4] : ''); };

  function mount(el, ctx) {
    if (!document.getElementById('en-css')) { const s = document.createElement('style'); s.id = 'en-css'; s.textContent = CSS; document.head.appendChild(s); }
    const st = { dead: false, filter: 'missing', rows: [], sum: null, sel: new Set(), sheetUrl: '', readAt: '', busy: false };
    el.innerHTML = `<div class="en"><div class="loading">Reading the sheet…</div></div>`;

    async function load() {
      try {
        if (!st.sheetUrl) { const b = await ctx.call('bootstrap'); st.sheetUrl = b.sheet_url; }
        const r = await ctx.call('list'); if (st.dead) return;
        st.rows = r.rows; st.sum = r.summary; st.readAt = r.read_at; st.sel = new Set([...st.sel].filter(k => st.rows.some(x => x.key === k)));
      } catch (e) { if (!st.dead) el.innerHTML = `<div class="en"><div class="note bad">${esc(e.message)}</div><button class="btn" id="enRetry">Try again</button></div>`; const b = el.querySelector('#enRetry'); if (b) b.onclick = () => { el.innerHTML = `<div class="en"><div class="loading">Reading the sheet…</div></div>`; load(); }; return; }
      draw();
    }

    const shown = () => st.rows.filter(r => st.filter === 'all' ? true : st.filter === 'missing' ? r.match.state === 'missing' : st.filter === 'possible' ? r.match.state === 'possible' : st.filter === 'in' ? r.match.state === 'in' : st.filter === 'form' ? r.tab === 'form' : r.tab === 'history');
    const tag = r => {
      const m = r.match;
      if (m.state === 'in') return `<span class="tag good">In the tracker</span><div class="small muted">${esc(m.enquiry.name)}: ${esc(m.enquiry.status)}${m.via ? ` (matched on ${m.via})` : ''}</div>`;
      if (m.state === 'possible') return `<span class="tag">Check</span><div class="small muted">Same name as ${esc(m.enquiry.name)} (${esc(m.enquiry.status)}), but a different email and phone</div>`;
      if (m.state === 'dup') return `<span class="tag">Same person as another row</span>`;
      return `<span class="tag bad">Not in the tracker</span>`;
    };

    function draw() {
      const s = st.sum, list = shown(), addable = list.filter(r => r.match.state === 'missing'), missingAll = st.rows.filter(r => r.match.state === 'missing');
      el.innerHTML = `<div class="en">
        <div class="pagehead"><h2>Enquiries</h2><span class="hint">Everyone in the enquiry sheet, checked against the Weddings &amp; Events tracker. The sheet is read afresh whenever this tab opens.</span><span class="spacer"></span>
          <a class="btn ghost small" href="${esc(st.sheetUrl)}" target="_blank" rel="noopener">Open the sheet</a> <button class="btn ghost small" id="enRefresh">Refresh</button></div>
        <div class="strip"><div><b>${s.total}</b><span>In the sheet</span></div><div><b>${s.in}</b><span>Already in the tracker</span></div><div><b>${s.missing}</b><span>Not in the tracker</span></div><div><b>${s.form}</b><span>New form entries</span></div><div><b>${s.history}</b><span>Historic list</span></div></div>
        ${s.form === 0 ? `<div class="note">No one has come through the form yet. New enquiries appear here as they arrive in the first tab of the sheet.</div>` : ''}
        <div class="ctl">${[['missing', `Not in the tracker (${s.missing})`], ['possible', `Check (${s.possible})`], ['in', `In the tracker (${s.in})`], ['form', `New form (${s.form})`], ['history', `Historic (${s.history})`], ['all', `Everyone (${s.total})`]].map(([k, l]) => `<button class="chip" data-f="${k}" aria-pressed="${st.filter === k}">${l}</button>`).join('')}
          <span style="flex:1"></span>${missingAll.length ? `<button class="btn" id="enAddAll">Add all ${missingAll.length} missing to the tracker</button>` : ''}${st.sel.size ? ` <button class="btn ghost" id="enAddSel">Add the ${st.sel.size} ticked</button>` : ''}</div>
        ${list.length ? `<div class="wrap"><table class="t"><thead><tr><th></th><th>Date</th><th>Name</th><th>Contact</th><th>Venue</th><th>Message</th><th>In the tracker?</th><th></th></tr></thead><tbody>
          ${list.map(r => { const can = r.match.state === 'missing' || r.match.state === 'possible'; return `<tr><td>${can ? `<input type="checkbox" data-k="${esc(r.key)}" ${st.sel.has(r.key) ? 'checked' : ''} aria-label="Select ${esc(r.name)}">` : ''}</td>
            <td class="small" style="white-space:nowrap">${esc(fmtWhen(r.when))}<div class="muted">${esc(r.tab_label)}</div></td><td><b>${esc(r.name)}</b></td>
            <td class="small">${r.email ? esc(r.email) : ''}${r.phone ? `<br>${esc(r.phone)}` : ''}</td><td class="small">${esc(r.venue || '')}</td>
            <td class="msg small">${r.message ? (r.message.length > 140 ? `<details><summary>${esc(r.message.slice(0, 120))}…</summary>${esc(r.message).replace(/\n/g, '<br>')}</details>` : esc(r.message).replace(/\n/g, '<br>')) : `<span class="muted">${r.tab === 'history' ? 'No message recorded' : ''}</span>`}</td>
            <td>${tag(r)}</td><td>${can ? `<button class="btn small ${r.match.state === 'missing' ? '' : 'ghost'}" data-add="${esc(r.key)}">${r.match.state === 'missing' ? 'Add' : 'Add anyway'}</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div>`
          : `<div class="empty">${st.filter === 'missing' ? 'Everyone in the sheet is already in the tracker.' : 'Nothing here.'}</div>`}
        <p class="small muted">Read from the sheet ${st.readAt ? new Date(st.readAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}. A person is "in the tracker" when their email or phone number matches a tracker record. A form entry is added as a New Enquiry from the Website with a Send Brochure action due today; a historic one is added without a next action, so it does not fill the To Do list. The message goes in as the first note.</p></div>`;
      el.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { st.filter = b.dataset.f; draw(); });
      el.querySelector('#enRefresh').onclick = () => { el.innerHTML = `<div class="en"><div class="loading">Reading the sheet…</div></div>`; load(); };
      el.querySelectorAll('[data-k]').forEach(c => c.onchange = () => { c.checked ? st.sel.add(c.dataset.k) : st.sel.delete(c.dataset.k); draw(); });
      el.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { const r = st.rows.find(x => x.key === b.dataset.add); add({ keys: [r.key], force: r.match.state === 'possible' ? [r.key] : [] }, b); });
      const aa = el.querySelector('#enAddAll'), as = el.querySelector('#enAddSel');
      if (aa) aa.onclick = () => sure(aa, `Sure? Press again to add ${missingAll.length}`, () => add({ keys: missingAll.map(r => r.key) }, aa));
      if (as) as.onclick = () => sure(as, `Sure? Press again to add ${st.sel.size}`, () => add({ keys: [...st.sel], force: [...st.sel].filter(k => st.rows.find(r => r.key === k && r.match.state === 'possible')) }, as));
    }
    function sure(b, text, go) { if (b.dataset.sure === '1') return go(); const old = b.textContent; b.dataset.sure = '1'; b.textContent = text; setTimeout(() => { b.dataset.sure = ''; b.textContent = old; }, 5000); }
    async function add(payload, btn) {
      if (st.busy) return; st.busy = true; if (btn) btn.disabled = true;
      try {
        const r = await ctx.call('add', payload);
        ctx.toast(r.added ? `Added ${r.added} to the tracker${r.skipped.length ? `, ${r.skipped.length} skipped` : ''}.` : (r.skipped[0] ? r.skipped[0].name + ': ' + r.skipped[0].why : 'Nothing was added.'), !r.added);
        st.sel.clear(); st.busy = false; el.innerHTML = `<div class="en"><div class="loading">Checking the tracker…</div></div>`; await load();
      } catch (e) { st.busy = false; if (btn) btn.disabled = false; ctx.toast(e.message, true); }
    }
    load();
    return { unmount() { st.dead = true; el.innerHTML = ''; } };
  }
  global.Enquiries = { mount };
})(window);
