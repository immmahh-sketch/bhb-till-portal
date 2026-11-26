/* Competitors - the "Competitors" tab of Marketing Actions.
 *
 *   const a = Competitors.mount(element, { call, toast }); // later: a.unmount()
 *
 * A mailbox that does not look like the Black Horse is signed up to local competitors' mailing lists. Every email that arrives is read (what it is, offers, prices, topics)
 * and reported on: how often each competitor writes, when, what they push and at what price, against our own mail shots from Brevo.
 * Sub-views: Overview, Inbox, Competitors, Offers and prices, Set-up. Backend: competitor-watch-api (access, bootstrap, overview, inbox, email.get, email.html, email.assign,
 * email.delete, email.reanalyse, competitor.save, competitor.remove, offers, prices, ourprices.save, report.get, report.generate, settings.save).
 * Uses the host page's .btn / .tag / .loading / .empty classes.
 */
(function (global) {
  'use strict';
  const CSS = `
.cw .strip{display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px; margin-bottom:14px}
.cw .strip div{background:var(--bone,#F8F8F8); border-radius:8px; padding:10px 14px}
.cw .strip b{display:block; font-family:var(--display,Georgia,serif); font-size:26px; line-height:1.05; color:var(--sage,#4D604F); font-weight:600}
.cw .strip span{font-size:10px; letter-spacing:var(--track-label,.18em); text-transform:uppercase; color:var(--sage-70,#7B887C)}
.cw .nav,.cw .ctl{display:flex; gap:8px 10px; align-items:center; flex-wrap:wrap; margin:0 0 14px}
.cw .chip{border:1px solid var(--mist,#e7e7e7); background:var(--white,#fff); border-radius:999px; padding:7px 14px; cursor:pointer; font-size:13px; min-height:38px}
.cw .chip[aria-pressed="true"]{background:var(--sage,#4D604F); border-color:var(--sage,#4D604F); color:#fff; font-weight:600}
.cw .wrap{overflow-x:auto; border:1px solid var(--mist,#e7e7e7); border-radius:8px; margin-bottom:18px}
.cw table.t{width:100%; border-collapse:separate; border-spacing:0; font-size:13px}
.cw .t th{font-size:10px; letter-spacing:var(--track-label,.18em); text-transform:uppercase; color:var(--sage-70,#7B887C); font-weight:600; text-align:left; padding:8px 10px; background:var(--bone,#F8F8F8); white-space:nowrap}
.cw .t td{padding:8px 10px; border-top:1px solid var(--mist,#e7e7e7); background:var(--white,#fff); vertical-align:top}
.cw .t tr.click{cursor:pointer} .cw .t tr.click:hover td{background:var(--bone,#F8F8F8)}
.cw .t tr.us td{background:var(--sage-10,#EDEFED); font-weight:600}
.cw .t td.num{text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums}
.cw .t td.gap{background:var(--attention-bg,#F7F0E4)}
.cw .muted{color:var(--sage-70,#7B887C)} .cw .small{font-size:12px}
.cw h3{margin:18px 0 8px; font-size:16px}
.cw .note{background:var(--attention-bg,#F7F0E4); border-radius:8px; padding:10px 14px; margin:0 0 14px; font-size:14px}
.cw .note.bad{background:var(--alert-bg,#F6EAE8); color:var(--alert,#8C4A3F)}
.cw .card{border:1px solid var(--mist,#e7e7e7); border-radius:8px; padding:12px 14px; background:var(--white,#fff); margin:0 0 12px}
.cw .card h4{margin:0 0 6px; font-size:14px}
.cw .grid2{display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:12px}
.cw .spark{display:inline-flex; align-items:flex-end; gap:2px; height:22px; vertical-align:middle}
.cw .spark i{display:block; width:5px; background:var(--sage,#4D604F); border-radius:1px; min-height:1px}
.cw .spark i.z{background:var(--mist,#e7e7e7)}
.cw .pill{display:inline-block; font-size:11px; border-radius:999px; padding:2px 9px; background:var(--bone,#F8F8F8); margin:1px 3px 1px 0; white-space:nowrap}
.cw .pill.ok{background:var(--sage-10,#EDEFED); color:var(--sage,#4D604F); font-weight:600} .cw .pill.warn{background:var(--attention-bg,#F7F0E4); color:#7a5b1f} .cw .pill.off{background:var(--bone,#F8F8F8); color:var(--sage-70,#7B887C)}
.cw input[type=text],.cw input[type=search],.cw input[type=number],.cw input[type=date],.cw select,.cw textarea{border:1px solid var(--mist,#e7e7e7); border-radius:6px; padding:8px 10px; font-size:14px; min-height:38px; max-width:100%; background:var(--white,#fff); font-family:inherit}
.cw .ctl input[type=search]{flex:1 1 240px; min-width:0}
.cw .form{display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:10px 14px; align-items:end}
.cw .form label{display:flex; flex-direction:column; gap:4px; font-size:12px; color:var(--sage-70,#7B887C)} .cw .form label.wide{grid-column:1/-1}
.cw .form input,.cw .form select,.cw .form textarea{width:100%; color:var(--ink,#222)}
.cw .detail{padding:4px 2px 10px; font-size:14px} .cw .detail p{margin:6px 0} .cw .detail ul{margin:4px 0 8px; padding-left:18px; font-size:13px}
.cw .detail .txt{white-space:pre-wrap; max-height:280px; overflow:auto; font-size:12px; background:var(--bone,#F8F8F8); border-radius:6px; padding:8px 10px}
.cw iframe.orig{width:100%; height:560px; border:1px solid var(--mist,#e7e7e7); border-radius:8px; background:#fff}
.cw .addr{font-family:ui-monospace,Consolas,monospace; font-size:15px; background:var(--bone,#F8F8F8); border-radius:6px; padding:6px 10px; word-break:break-all; display:inline-block}
.cw .rep li{margin:4px 0}
.cw .url{word-break:break-all}
`;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], DAYL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const fdate = t => { if (!t) return ''; const d = new Date(t); return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); };
  const fdt = t => { if (!t) return ''; const d = new Date(t); return isNaN(d) ? '' : fdate(t) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); };
  const ago = t => { if (!t) return 'never'; const d = (Date.now() - new Date(t).getTime()) / 864e5; return d < 1 ? 'today' : d < 2 ? 'yesterday' : Math.round(d) + ' days ago'; };
  const money = n => '£' + (Math.round(n * 100) % 100 === 0 ? Math.round(n) : Number(n).toFixed(2));
  const STATUS = { planned: ['Not signed up yet', 'off'], signed_up: ['Signed up, waiting for mail', 'warn'], confirmed: ['Receiving mail', 'ok'], paused: ['Paused', 'off'] };
  const KINDS = ['hotel', 'pub', 'restaurant', 'venue', 'other'];
  const bucket = h => h < 5 ? 'overnight' : h < 11 ? 'morning' : h < 14 ? 'lunchtime' : h < 18 ? 'afternoon' : 'evening';
  function usually(c) {
    if (!c.n || c.n < 3) return '<span class="muted">not enough yet</span>';
    const top = c.dow.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
    const days = top.filter(x => x[0] >= Math.max(2, top[0][0] * 0.6)).slice(0, 2).map(x => DAYS[x[1]]).join(' / ');
    const hb = {}; c.hour.forEach((v, h) => { hb[bucket(h)] = (hb[bucket(h)] || 0) + v; });
    const hbest = Object.entries(hb).sort((a, b) => b[1] - a[1])[0];
    return esc(days + (hbest ? ', ' + hbest[0] : ''));
  }
  const spark = weeks => { const m = Math.max(1, ...weeks); return `<span class="spark" title="Emails a week, last 12 weeks (oldest first): ${weeks.join(', ')}">${weeks.map(w => `<i class="${w ? '' : 'z'}" style="height:${Math.max(1, Math.round(w / m * 22))}px"></i>`).join('')}</span>`; };
  const copy = async (text, toast) => { try { await navigator.clipboard.writeText(text); toast('Copied'); } catch (e) { toast('Copy it by hand: ' + text); } };

  function mount(el, ctx) {
    if (!document.getElementById('cw-css')) { const s = document.createElement('style'); s.id = 'cw-css'; s.textContent = CSS; document.head.appendChild(s); }
    const st = { dead: false, view: 'overview', boot: null, ov: null, days: 60, inbox: null, ifilter: { competitor: 'all', kind: 'all', q: '', offers: false, page: 0 }, open: '', detail: {}, html: {}, showImg: {},
      offers: null, prices: null, live: true, edit: null, rep: null, busy: false, timer: null };
    const root = () => el.querySelector('.cw');
    const call = (a, p) => ctx.call(a, p);
    const toast = ctx.toast || (() => {});
    el.innerHTML = `<div class="cw"><div class="loading">Loading the competitor watch…</div></div>`;

    const nav = () => `<div class="nav">${[['overview', 'Overview'], ['inbox', 'Inbox'], ['competitors', 'Competitors'], ['offers', 'Offers and prices'], ['setup', 'Set-up']].map(([k, l]) => `<button class="chip" data-nav="${k}" aria-pressed="${st.view === k}">${l}</button>`).join('')}</div>`;
    function shell(inner) {
      const b = st.boot || {};
      const warn = [];
      if (b.confirm_waiting) warn.push('');
      root().innerHTML = nav() + inner;
      root().querySelectorAll('[data-nav]').forEach(x => x.onclick = () => go(x.dataset.nav));
    }
    async function go(v) { st.view = v; st.open = ''; await draw(); }
    const err = e => { root().innerHTML = `<div class="empty">${esc(e.message || e)}</div>`; };

    async function loadBoot() { st.boot = await call('bootstrap'); }

    // ------------------------------------------------------------------ overview
    async function overview() {
      const [ov, rep] = await Promise.all([call('overview', { days: st.days }), call('report.get')]); st.ov = ov; st.rep = rep;
      const b = st.boot, comps = ov.competitors.filter(c => c.active !== false), seen = comps.filter(c => c.n > 0);
      const watched = comps.filter(c => c.status === 'confirmed' || c.n > 0).length;
      let top = '';
      if (!b.address) top += `<div class="note">The sign-up mailbox has not been set up yet, so nothing can arrive. Open <b>Set-up</b>.</div>`;
      else if (!b.total) top += `<div class="note">Nothing has arrived yet. Sign up to competitors' mailing lists with <span class="addr">${esc(b.address)}</span> (see <b>Competitors</b> for a sign-up address for each).</div>`;
      if (b.need_confirming && b.need_confirming.length) top += `<div class="note"><b>${b.need_confirming.length} sign-up${b.need_confirming.length > 1 ? 's are' : ' is'} waiting for a confirmation click.</b> Open <button class="btn" data-nav2="competitors">Competitors</button> to confirm.</div>`;
      if (b.pending) top += `<div class="note">${b.pending} email${b.pending > 1 ? 's are' : ' is'} waiting to be read.</div>`;
      if (!ov.ours.ok) top += `<div class="note bad">${esc(ov.ours.note || 'Our own mail shots could not be read.')}</div>`;
      const gapPer = ov.average.per_week, ourPer = ov.ours.per_week;
      const strip = `<div class="strip"><div><b>${seen.reduce((t, c) => t + c.n, 0)}</b><span>competitor emails, ${st.days} days</span></div><div><b>${seen.length} of ${watched || comps.length}</b><span>competitors sending</span></div>
        <div><b>${gapPer == null ? '–' : gapPer}</b><span>average a week, each competitor</span></div><div><b>${ourPer == null ? '–' : ourPer}</b><span>our mail shots a week</span></div><div><b>${seen.reduce((t, c) => t + c.offers, 0)}</b><span>competitor emails with an offer</span></div></div>`;
      const rows = comps.filter(c => c.n > 0 || c.status === 'confirmed').map(c => `<tr><td><b>${esc(c.name)}</b><div class="small muted">${esc(c.kind)}</div></td><td class="num">${c.n}</td><td class="num">${c.n ? (c.span_days < 14 ? esc(c.per_week) + ' <span class="muted small">(early)</span>' : esc(c.per_week)) : '–'}</td>
        <td class="num">${c.median_gap_days == null ? '–' : c.median_gap_days + ' days'}</td><td>${spark(c.weeks)}</td><td>${usually(c)}</td><td class="num">${c.offers}</td><td class="num">${c.last ? ago(c.last) : '–'}</td></tr>`).join('');
      const o = ov.ours;
      const us = `<tr class="us"><td>Black Horse (Brevo)<div class="small muted">${o.open_pct != null ? 'opens ' + o.open_pct + '%' : ''}${o.click_pct != null ? ', clicks ' + o.click_pct + '%' : ''}</div></td><td class="num">${o.n}</td><td class="num">${o.per_week == null ? '–' : o.per_week}</td><td class="num">${o.median_gap_days == null ? '–' : o.median_gap_days + ' days'}</td><td>${spark(o.weeks)}</td><td>${usually(o)}</td><td class="num">${o.offers}</td><td class="num">${o.last ? ago(o.last) : '–'}</td></tr>`;
      const freq = `<h3>How often, and when</h3><div class="wrap"><table class="t"><thead><tr><th>Who</th><th>Emails</th><th>A week</th><th>Typical gap</th><th>12 weeks</th><th>Usually sent</th><th>With offers</th><th>Last</th></tr></thead><tbody>${rows || '<tr><td colspan="8" class="muted">No competitor emails yet.</td></tr>'}${us}</tbody></table></div>`;
      // topics matrix
      const topicSet = new Set([...Object.keys(ov.ours.topics)]); seen.forEach(c => Object.keys(c.topics).forEach(t => topicSet.add(t)));
      const tot = t => seen.reduce((s, c) => s + (c.topics[t] || 0), 0) + (ov.ours.topics[t] || 0);
      const tl = ov.topic_labels, trs = [...topicSet].sort((a, b) => tot(b) - tot(a)).map(t => {
        const withIt = seen.filter(c => c.topics[t]).length, gap = !(ov.ours.topics[t]) && withIt >= 2 && t !== 'other';
        return `<tr><td>${esc(tl[t] || t)}</td>${seen.map(c => `<td class="num">${c.topics[t] || ''}</td>`).join('')}<td class="num ${gap ? 'gap' : ''}"><b>${ov.ours.topics[t] || ''}</b>${gap ? ' <span class="small">gap</span>' : ''}</td></tr>`;
      }).join('');
      const topics = seen.length ? `<h3>What they talk about</h3><p class="muted small">Number of emails mentioning each subject in the last ${st.days} days. "Gap" marks a subject at least two competitors are pushing that none of our mail shots mention. Ours are sorted by subject line, theirs by reading the email.</p><div class="wrap"><table class="t"><thead><tr><th>Subject</th>${seen.map(c => `<th>${esc(c.name)}</th>`).join('')}<th>Us</th></tr></thead><tbody>${trs}</tbody></table></div>` : '';
      const r = rep && rep.report;
      const repHtml = `<h3>Written comparison</h3><div class="card"><div class="ctl"><button class="btn primary" id="cwgen" ${st.busy ? 'disabled' : ''}>${st.busy ? 'Writing…' : (r ? 'Write it again' : 'Write the comparison')}</button><span class="muted small">${r && r.generated_at ? 'Written ' + fdt(r.generated_at) + ' from ' + (r.emails_counted || 0) + ' competitor emails and ' + (r.our_mail_shots || 0) + ' of our mail shots.' : 'Uses everything above, the offers and the prices in plain words.'}</span></div>${r ? (r.too_early ? `<p>${esc(r.note)}</p>` : `<p><b>${esc(r.headline || '')}</b></p>${section('What competitors are doing', r.doing)}${section('Prices', r.pricing)}${section('Where we differ', r.gaps)}${Array.isArray(r.actions) && r.actions.length ? `<h4>Things we could do</h4><ul class="rep">${r.actions.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}${Array.isArray(r.caveats) && r.caveats.length ? `<p class="muted small">${r.caveats.map(esc).join(' ')}</p>` : ''}`) : ''}</div>`;
      const ours = `<h3>Our recent mail shots</h3><div class="wrap"><table class="t"><thead><tr><th>Sent</th><th>Subject</th><th>Subjects it covers</th><th>Opens</th></tr></thead><tbody>${o.subjects.length ? o.subjects.map(s => `<tr><td class="num">${fdate(s.sent)}</td><td>${esc(s.subject)}</td><td>${(s.topics || []).map(t => `<span class="pill">${esc(tl[t] || t)}</span>`).join('')}</td><td class="num">${s.open_pct == null ? '' : s.open_pct + '%'}</td></tr>`).join('') : '<tr><td colspan="4" class="muted">None in this period.</td></tr>'}</tbody></table></div>`;
      shell(`${top}<div class="ctl">${[30, 60, 90].map(d => `<button class="chip" data-days="${d}" aria-pressed="${st.days === d}">${d} days</button>`).join('')}</div>${strip}${freq}${topics}${repHtml}${ours}`);
      root().querySelectorAll('[data-days]').forEach(x => x.onclick = async () => { st.days = +x.dataset.days; await draw(); });
      root().querySelectorAll('[data-nav2]').forEach(x => x.onclick = () => go(x.dataset.nav2));
      const g = root().querySelector('#cwgen'); if (g) g.onclick = async () => { st.busy = true; await overview(); try { await call('report.generate'); } catch (e) { toast(e.message || 'Could not write it'); } st.busy = false; await overview(); };
    }
    const section = (title, items) => Array.isArray(items) && items.length ? `<h4>${esc(title)}</h4><ul class="rep">${items.map(x => `<li><b>${esc(x.title || '')}</b> ${esc(x.detail || '')}</li>`).join('')}</ul>` : '';

    // ------------------------------------------------------------------ inbox
    async function inbox() {
      const f = st.ifilter, b = st.boot;
      const d = await call('inbox', { competitor: f.competitor === 'all' ? '' : f.competitor, kind: f.kind === 'all' ? '' : f.kind, q: f.q, offers_only: f.offers, page: f.page });
      const comps = b.competitors;
      const rows = d.rows.map(e => `<tr class="click" data-open="${e.id}"><td class="num">${fdt(e.when)}</td><td>${e.competitor ? esc(e.competitor) : '<span class="pill warn">Not matched</span>'}</td>
        <td><b>${esc(e.subject || '(no subject)')}</b>${e.needs_confirm ? ' <span class="pill warn">needs confirming</span>' : ''}${e.kind === 'other' ? ' <span class="pill off">other</span>' : ''}${e.ai_status === 'pending' ? ' <span class="pill off">not read yet</span>' : e.ai_status === 'failed' ? ' <span class="pill warn">could not be read</span>' : ''}<div class="small muted">${esc(e.summary || '')}</div></td>
        <td>${(e.topics || []).slice(0, 3).map(t => `<span class="pill">${esc(b.topic_labels[t] || t)}</span>`).join('')}${e.has_offer ? '<span class="pill ok">offer</span>' : ''}</td></tr>${st.open == e.id ? `<tr><td colspan="4" id="cwd">${'<div class="loading">Loading…</div>'}</td></tr>` : ''}`).join('');
      shell(`<div class="ctl"><input type="search" id="cwq" placeholder="Search subject, sender or text" value="${esc(f.q)}"><select id="cwc"><option value="all">All competitors</option><option value="none" ${f.competitor === 'none' ? 'selected' : ''}>Not matched yet</option>${comps.map(c => `<option value="${c.id}" ${String(f.competitor) === String(c.id) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
        <select id="cwk"><option value="all">All kinds</option><option value="marketing" ${f.kind === 'marketing' ? 'selected' : ''}>Marketing</option><option value="confirm" ${f.kind === 'confirm' ? 'selected' : ''}>Confirmations</option><option value="other" ${f.kind === 'other' ? 'selected' : ''}>Other</option></select>
        <label class="small"><input type="checkbox" id="cwo" ${f.offers ? 'checked' : ''}> offers only</label></div>
        <div class="wrap"><table class="t"><thead><tr><th>Received</th><th>Competitor</th><th>Email</th><th>About</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="muted">Nothing here yet.</td></tr>'}</tbody></table></div>
        <div class="ctl">${f.page > 0 ? '<button class="btn" id="cwprev">Newer</button>' : ''}${d.more ? '<button class="btn" id="cwnext">Older</button>' : ''}</div>`);
      let tm; const q = root().querySelector('#cwq'); q.oninput = () => { clearTimeout(tm); tm = setTimeout(() => { f.q = q.value; f.page = 0; draw(true); }, 400); };
      root().querySelector('#cwc').onchange = e => { f.competitor = e.target.value; f.page = 0; draw(); }; root().querySelector('#cwk').onchange = e => { f.kind = e.target.value; f.page = 0; draw(); };
      root().querySelector('#cwo').onchange = e => { f.offers = e.target.checked; f.page = 0; draw(); };
      const pv = root().querySelector('#cwprev'), nx = root().querySelector('#cwnext'); if (pv) pv.onclick = () => { f.page--; draw(); }; if (nx) nx.onclick = () => { f.page++; draw(); };
      root().querySelectorAll('[data-open]').forEach(r => r.onclick = () => { st.open = st.open == r.dataset.open ? '' : r.dataset.open; draw(); });
      if (st.open) await openDetail(+st.open);
      if (document.activeElement === document.body && f.q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
    }
    async function openDetail(id) {
      const box = root().querySelector('#cwd'); if (!box) return;
      try {
        const e = st.detail[id] || (st.detail[id] = await call('email.get', { id })), b = st.boot;
        const links = (e.links || []).filter(l => !/unsubscribe|manage.?preferences|optout|opt-out/i.test(l.url + ' ' + (l.text || ''))).slice(0, 12);
        box.innerHTML = `<div class="detail"><p><b>${esc(e.subject || '')}</b><br><span class="muted small">From ${esc(e.from_name || '')} &lt;${esc(e.from_email || '')}&gt; to ${esc(e.to_addr || '')} · sent ${fdt(e.when)}</span></p>
          ${e.confirm_url ? `<div class="note">This is a sign-up confirmation. <a class="btn primary" href="${esc(e.confirm_url)}" target="_blank" rel="noopener noreferrer">Open the confirmation link</a> <span class="small muted">Nothing is clicked for you. Check the address first.</span></div>` : ''}
          <p>${esc(e.summary || 'Not read yet.')}</p>
          ${e.analysis ? `<p class="small muted">${e.analysis.audience ? 'Aimed at: ' + esc(e.analysis.audience) + '. ' : ''}${e.analysis.tone ? 'Tone: ' + esc(e.analysis.tone) + '. ' : ''}${e.analysis.cta ? 'Asks readers to: ' + esc(e.analysis.cta) + '.' : ''}</p>` : ''}
          ${e.offers.length ? `<b>Offers</b><ul>${e.offers.map(o => `<li>${esc(o.title)}${o.detail ? ' - ' + esc(o.detail) : ''}${o.code ? ' · code <b>' + esc(o.code) + '</b>' : ''}${o.valid_until ? ' · until ' + fdate(o.valid_until) : ''}</li>`).join('')}</ul>` : ''}
          ${e.prices.length ? `<b>Prices</b><ul>${e.prices.map(p => `<li>${esc(p.label || e.price_items[p.item_key] || p.item_key)}: <b>${money(+p.amount)}</b> ${esc(p.unit || '')}${p.note ? ' (' + esc(p.note) + ')' : ''}</li>`).join('')}</ul>` : ''}
          ${e.analysis && e.analysis.events && e.analysis.events.length ? `<b>Events</b><ul>${e.analysis.events.map(v => `<li>${esc(v.what)}${v.date ? ' · ' + fdate(v.date) : ''}</li>`).join('')}</ul>` : ''}
          <div class="ctl"><select id="cwas"><option value="">Not matched</option>${b.competitors.map(c => `<option value="${c.id}" ${c.id === e.competitor_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select><button class="btn" id="cwsave">Save match</button>
            ${e.has_html ? `<button class="btn" id="cworig">${st.html[id] ? 'Hide the original' : 'See the original'}</button>` : ''}<button class="btn" id="cwre">Read it again</button><button class="btn" id="cwdel">Delete</button></div>
          ${st.html[id] ? `<label class="small"><input type="checkbox" id="cwimg" ${st.showImg[id] ? 'checked' : ''}> show pictures (this tells the sender the email was opened)</label><iframe class="orig" sandbox="" id="cwif"></iframe>` : ''}
          ${links.length ? `<details><summary class="small">Links in the email (${links.length})</summary><ul>${links.map(l => `<li class="url"><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.text || l.url.slice(0, 80))}</a></li>`).join('')}</ul></details>` : ''}
          <details><summary class="small">Text of the email</summary><div class="txt">${esc(e.text || '')}</div></details></div>`;
        const sel = box.querySelector('#cwas');
        box.querySelector('#cwsave').onclick = async () => { try { const r = await call('email.assign', { id, competitor_id: sel.value || null }); delete st.detail[id]; await loadBoot(); toast('Saved' + (r.also_moved ? ' · ' + r.also_moved + ' more from the same sender moved too' : '')); draw(); } catch (x) { toast(x.message); } };
        const re = box.querySelector('#cwre'); re.onclick = async () => { re.disabled = true; re.textContent = 'Reading…'; try { const r = await call('email.reanalyse', { id }); delete st.detail[id]; toast(r.ok ? 'Read again' : 'Could not read it: ' + (r.error || '')); } catch (x) { toast(x.message); } draw(); };
        box.querySelector('#cwdel').onclick = async () => { if (!confirm('Delete this email from the watch?')) return; try { await call('email.delete', { id }); st.open = ''; delete st.detail[id]; await loadBoot(); draw(); } catch (x) { toast(x.message); } };
        const ob = box.querySelector('#cworig');
        if (ob) ob.onclick = async () => { if (st.html[id]) { delete st.html[id]; draw(); return; } try { st.html[id] = (await call('email.html', { id })).html; } catch (x) { toast(x.message); return; } draw(); };
        const fr = box.querySelector('#cwif');
        if (fr) { const paint = () => { const csp = st.showImg[id] ? '' : `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:;">`; fr.srcdoc = csp + '<base target="_blank">' + st.html[id]; }; paint(); box.querySelector('#cwimg').onchange = ev => { st.showImg[id] = ev.target.checked; paint(); }; }
      } catch (x) { box.innerHTML = `<div class="empty">${esc(x.message)}</div>`; }
    }

    // ------------------------------------------------------------------ competitors
    function compForm(c) {
      const v = c || { name: '', kind: 'venue', website: '', tag: '', status: 'planned', signed_up_on: '', notes: '', sender_domains: [], sender_names: [] };
      return `<div class="card"><h4>${c ? 'Edit ' + esc(c.name) : 'Add a competitor'}</h4><div class="form">
        <label>Name<input type="text" id="f_name" value="${esc(v.name)}"></label>
        <label>Kind<select id="f_kind">${KINDS.map(k => `<option ${v.kind === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
        <label>Website<input type="text" id="f_web" value="${esc(v.website || '')}" placeholder="https://"></label>
        <label>Tag for the sign-up address<input type="text" id="f_tag" value="${esc(v.tag || '')}" placeholder="letters and numbers only"></label>
        <label>Status<select id="f_status">${Object.entries(STATUS).map(([k, x]) => `<option value="${k}" ${v.status === k ? 'selected' : ''}>${x[0]}</option>`).join('')}</select></label>
        <label>Signed up on<input type="date" id="f_on" value="${esc(v.signed_up_on || '')}"></label>
        <label class="wide">Sender domains (their emails come from these; added by itself as mail arrives)<input type="text" id="f_dom" value="${esc((v.sender_domains || []).join(', '))}"></label>
        <label class="wide">Notes<textarea id="f_notes" rows="2">${esc(v.notes || '')}</textarea></label></div>
        <div class="ctl" style="margin-top:10px"><button class="btn primary" id="f_save">Save</button><button class="btn" id="f_cancel">Cancel</button>${c ? '<button class="btn" id="f_del">Remove from the list</button>' : ''}</div></div>`;
    }
    async function competitors() {
      const b = st.boot, addr = b.address;
      const need = (b.need_confirming || []);
      const confirmBox = need.length ? `<div class="note"><b>Waiting for your click.</b> These competitors sent a confirmation email. Nothing is clicked for you: check the address, then press the button.<ul>${need.map(n => { const c = b.competitors.find(x => x.id === n.competitor_id); return `<li>${esc(c ? c.name : 'Not matched')} - ${esc(n.subject || '')} <a class="btn" href="${esc(n.confirm_url)}" target="_blank" rel="noopener noreferrer">Open the confirmation link</a></li>`; }).join('')}</ul></div>` : '';
      const signup = c => addr && c.tag ? addr.replace('@', '+' + c.tag + '@') : addr;
      const rows = b.competitors.map(c => `<tr data-edit="${c.id}" class="click"><td><b>${esc(c.name)}</b><div class="small muted">${esc(c.kind)}${c.website ? ' · ' + esc(c.website.replace(/^https?:\/\//, '')) : ''}</div></td><td><span class="pill ${STATUS[c.status][1]}">${STATUS[c.status][0]}</span></td><td class="num">${c.emails}</td><td class="num">${c.last_email ? ago(c.last_email) : '–'}</td>
        <td>${addr ? `<span class="small url">${esc(signup(c))}</span> <button class="btn" data-copy="${esc(signup(c))}">Copy</button>` : '<span class="muted small">set the address first</span>'}</td></tr>`).join('');
      shell(`${confirmBox}<div class="ctl"><button class="btn primary" id="cwadd">Add a competitor</button></div><div id="cwform">${st.edit === 'new' ? compForm(null) : st.edit ? compForm(b.competitors.find(c => c.id === +st.edit)) : ''}</div>
        <div class="wrap"><table class="t"><thead><tr><th>Competitor</th><th>Sign-up</th><th>Emails</th><th>Last email</th><th>Address to sign up with</th></tr></thead><tbody>${rows}</tbody></table></div>
        <p class="muted small">The tag after the plus sign tells the watch which competitor an email is for, without putting a name in the form that is easy to spot. Some sign-up forms refuse a plus sign: use the plain address instead and the watch will recognise the sender after the first email, or pick the competitor in the Inbox.</p>`);
      root().querySelector('#cwadd').onclick = () => { st.edit = 'new'; draw(); };
      root().querySelectorAll('[data-edit]').forEach(r => r.onclick = ev => { if (ev.target.closest('[data-copy]')) return; st.edit = r.dataset.edit; draw(); });
      root().querySelectorAll('[data-copy]').forEach(x => x.onclick = () => copy(x.dataset.copy, toast));
      const sv = root().querySelector('#f_save');
      if (sv) {
        const cur = st.edit === 'new' ? null : b.competitors.find(c => c.id === +st.edit), g = i => root().querySelector('#' + i).value;
        sv.onclick = async () => { try { await call('competitor.save', { id: cur && cur.id, name: g('f_name'), kind: g('f_kind'), website: g('f_web'), tag: g('f_tag'), status: g('f_status'), signed_up_on: g('f_on'), notes: g('f_notes'), sender_domains: g('f_dom'), sender_names: cur ? cur.sender_names : [], active: true }); st.edit = ''; await loadBoot(); toast('Saved'); draw(); } catch (x) { toast(x.message); } };
        root().querySelector('#f_cancel').onclick = () => { st.edit = ''; draw(); };
        const dl = root().querySelector('#f_del'); if (dl) dl.onclick = async () => { if (!confirm('Remove this competitor? Its emails stay in the Inbox as not matched.')) return; try { await call('competitor.remove', { id: cur.id }); st.edit = ''; await loadBoot(); draw(); } catch (x) { toast(x.message); } };
      }
    }

    // ------------------------------------------------------------------ offers and prices
    async function offersPrices() {
      const [of, pr] = await Promise.all([call('offers', { live_only: st.live }), call('prices')]); st.offers = of.offers; st.prices = pr;
      const comps = pr.competitors.filter(c => pr.items.some(it => it.by[c.id]));
      const ours = Object.fromEntries(pr.ours.map(o => [o.item_key, o]));
      const prow = pr.items.map(it => `<tr><td><b>${esc(it.label)}</b></td>${comps.map(c => { const l = it.by[c.id]; if (!l) return '<td class="muted">–</td>'; const x = l[0], p = l[1]; const ch = p && p.amount !== x.amount ? ` <span class="small ${x.amount > p.amount ? 'muted' : 'muted'}">(was ${money(p.amount)})</span>` : ''; return `<td class="num" title="${esc((x.label || '') + ' · seen ' + x.seen_on)}">${money(x.amount)}<span class="small muted"> ${esc(x.unit && x.unit !== 'other' ? x.unit.replace('per ', '/') : '')}</span>${ch}</td>`; }).join('')}
        <td class="num"><input type="number" step="0.01" min="0" style="width:90px" data-our="${esc(it.item_key)}" value="${ours[it.item_key] && ours[it.item_key].amount != null ? ours[it.item_key].amount : ''}" placeholder="£"></td></tr>`).join('');
      const ourOnly = pr.ours.filter(o => !pr.items.some(it => it.item_key === o.item_key));
      const orow = st.offers.map(o => `<tr><td>${esc(o.competitor)}</td><td><b>${esc(o.title)}</b>${o.detail ? '<div class="small muted">' + esc(o.detail) + '</div>' : ''}</td><td>${o.code ? '<span class="pill">' + esc(o.code) + '</span>' : ''}</td><td class="num">${o.valid_until ? fdate(o.valid_until) : '<span class="muted small">no end date</span>'}</td><td class="num">${fdate(o.seen_on)}</td><td>${o.live ? '<span class="pill ok">live</span>' : '<span class="pill off">ended</span>'}</td></tr>`).join('');
      shell(`<h3>Prices they have shown</h3><p class="muted small">The latest price seen in their emails. Type our own price in the last column to compare. Hover a price for the wording and the date.</p>
        <div class="wrap"><table class="t"><thead><tr><th>Item</th>${comps.map(c => `<th>${esc(c.name)}</th>`).join('')}<th>Ours</th></tr></thead><tbody>${prow || '<tr><td colspan="9" class="muted">No prices seen yet.</td></tr>'}</tbody></table></div>
        ${ourOnly.length ? `<p class="small muted">Our prices for items no competitor has shown yet: ${ourOnly.filter(o => o.amount != null).map(o => esc(o.label) + ' ' + money(+o.amount)).join(', ') || 'none entered'}.</p>` : ''}
        <h3>Offers</h3><div class="ctl"><button class="chip" data-live="1" aria-pressed="${st.live}">Live now</button><button class="chip" data-live="0" aria-pressed="${!st.live}">Everything seen</button></div>
        <div class="wrap"><table class="t"><thead><tr><th>Competitor</th><th>Offer</th><th>Code</th><th>Ends</th><th>Seen</th><th></th></tr></thead><tbody>${orow || '<tr><td colspan="6" class="muted">No offers yet.</td></tr>'}</tbody></table></div>`);
      root().querySelectorAll('[data-live]').forEach(x => x.onclick = () => { st.live = x.dataset.live === '1'; draw(); });
      root().querySelectorAll('[data-our]').forEach(i => i.onchange = async () => { try { await call('ourprices.save', { item_key: i.dataset.our, amount: i.value, unit: (ours[i.dataset.our] || {}).unit || 'per person' }); toast('Saved'); } catch (x) { toast(x.message); } });
    }

    // ------------------------------------------------------------------ set-up
    async function setup() {
      const b = st.boot;
      shell(`<div class="card"><h4>The sign-up mailbox</h4>${b.address ? `<p><span class="addr">${esc(b.address)}</span> <button class="btn" id="cwcp">Copy</button></p><p class="muted small">Use this address to sign up to competitors' mailing lists. Anything sent to it, or to a tag version of it (for example <span class="url">${esc(b.address.replace('@', '+tag@'))}</span>), arrives here.</p>` : '<p>No address has been set up yet.</p>'}
        <div class="ctl"><label class="small"><input type="checkbox" id="cwen" ${b.enabled ? 'checked' : ''}> accept incoming mail</label></div>
        <p class="small muted">Last email received: ${b.last_received_at ? fdt(b.last_received_at) + ' (' + ago(b.last_received_at) + ')' : 'none yet'}. ${b.total} emails kept${b.unsorted ? ', ' + b.unsorted + ' not matched to a competitor' : ''}.</p></div>
        <div class="card"><h4>How it works</h4><ol class="small"><li>Sign up to a competitor with the address above (the Competitors view gives a tagged address for each one).</li><li>Many sign-ups send a confirmation email first: it shows up here with a button for you to press.</li><li>Every email is read when it arrives: the offers, prices, subjects and when it was sent.</li><li>Overview compares how often and how they write with our own mail shots from Brevo.</li></ol>
        <p class="small muted">Reading uses the venue's Anthropic account (${b.ai_ready ? 'connected' : '<b>not connected</b>'}); our mail shots come from Brevo (${b.brevo_ready ? 'connected' : '<b>not connected</b>'}). Pictures inside emails are not loaded unless you ask, so the sender is not told when you look.</p></div>`);
      const cp = root().querySelector('#cwcp'); if (cp) cp.onclick = () => copy(b.address, toast);
      root().querySelector('#cwen').onchange = async e => { try { await call('settings.save', { enabled: e.target.checked }); await loadBoot(); toast(e.target.checked ? 'Accepting mail' : 'Switched off'); } catch (x) { toast(x.message); } };
    }

    async function draw(keepFocus) {
      if (st.dead) return;
      try {
        if (!st.boot) await loadBoot();
        if (st.view === 'overview') await overview(); else if (st.view === 'inbox') await inbox(); else if (st.view === 'competitors') await competitors(); else if (st.view === 'offers') await offersPrices(); else await setup();
      } catch (e) { err(e); }
    }
    draw();
    st.timer = setInterval(async () => { if (st.dead || document.hidden || st.view !== 'inbox' || st.open) return; try { const b = await call('bootstrap'); if (b.total !== (st.boot || {}).total) { st.boot = b; draw(); } } catch (e) { /* try again next time */ } }, 60000);
    return { unmount() { st.dead = true; clearInterval(st.timer); el.innerHTML = ''; } };
  }
  global.Competitors = { mount };
})(window);
