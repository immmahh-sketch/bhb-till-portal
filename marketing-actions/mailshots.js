/* Mail shots - the "Mail shots" tab of Marketing Actions. READ ONLY.
 *
 *   const m = Mailshots.mount(element, { call, toast });   // later: m.unmount()
 *
 * Your Brevo email campaigns: what is scheduled or sending (with a preview of the email and who it goes to) and how every campaign that has gone out performed.
 * Backend (brevo-api): campaigns {} and campaign { id }. Nothing here can send, change or delete anything in Brevo.
 */
(function (global) {
  'use strict';

  const CSS = `
.ms .intro{font-size:13px; color:var(--sage-70,#7B887C); margin:-4px 0 14px}
.ms .notice{background:var(--attention-bg,#F7F0E4); border-radius:8px; padding:10px 14px; margin:0 0 14px; font-size:14px}
.ms .notice.bad{background:var(--alert-bg,#F6EAE8); color:var(--alert,#8C4A3F)}
.ms h3.sec{font-family:var(--display,Georgia,serif); font-size:24px; color:var(--sage,#4E5F4F); margin:22px 0 10px}
.ms .up{display:flex; gap:16px; align-items:flex-start; flex-wrap:wrap; border-left:4px solid var(--gold,#C9A56B)}
.ms .up.now{border-left-color:var(--blue,#34546F)}
.ms .when{flex:0 0 150px}
.ms .when b{display:block; font-family:var(--display,Georgia,serif); font-size:26px; line-height:1.05; color:var(--sage,#4E5F4F)}
.ms .when span{font-size:12px; color:var(--sage-70,#7B887C)}
.ms .mid{flex:1 1 280px; min-width:0}
.ms .mid .t{font-weight:700; font-size:16px} .ms .mid .s{font-size:14px; color:var(--ink,#262626); margin-top:2px; overflow-wrap:anywhere}
.ms .mid .m{font-size:12.5px; color:var(--sage-70,#7B887C); margin-top:6px}
.ms .chip{display:inline-block; border-radius:999px; padding:2px 10px; font-size:11px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; background:var(--attention-bg,#F7F0E4); color:#6d5320}
.ms .chip.now{background:var(--blue-bg,#E7EEF5); color:var(--blue,#34546F)}
.ms .chip.done{background:var(--good-bg,#EDF2ED); color:var(--good,#4F6B4F)}
.ms .strip{display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:10px; margin-bottom:12px}
.ms .strip div{background:var(--white,#fff); border-radius:10px; box-shadow:var(--shadow); padding:10px 14px}
.ms .strip b{display:block; font-family:var(--display,Georgia,serif); font-size:28px; line-height:1; color:var(--sage,#4E5F4F)}
.ms .strip span{font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:var(--sage-70,#7B887C)}
.ms .wrap{overflow-x:auto; background:var(--white,#fff); border-radius:10px; box-shadow:var(--shadow)}
.ms table{border-collapse:collapse; width:100%; min-width:780px; font-variant-numeric:tabular-nums; font-size:14px}
.ms th{background:var(--sage,#4E5F4F); color:#fff; font-size:10.5px; letter-spacing:.1em; text-transform:uppercase; padding:9px 10px; text-align:right; white-space:nowrap; position:sticky; top:0}
.ms th.l,.ms td.l{text-align:left}
.ms td{padding:9px 10px; border-bottom:1px solid var(--mist,#e7e7e7); text-align:right; white-space:nowrap}
.ms tr.row{cursor:pointer} .ms tr.row:hover td{background:var(--sage-10,#EDEFED)}
.ms td.nm{white-space:normal; min-width:240px; text-align:left} .ms td.nm b{display:block} .ms td.nm span{font-size:12px; color:var(--sage-70,#7B887C)}
.ms .pc{color:var(--sage-70,#7B887C); font-size:12px; margin-left:4px}
.ms .dim{color:var(--sage-70,#7B887C)} .ms .bad{color:var(--alert,#8C4A3F); font-weight:700}
.ms .fine{font-size:12.5px; color:var(--sage-70,#7B887C); margin-top:8px}
.ms details{margin-top:18px} .ms details summary{cursor:pointer; font-weight:600; color:var(--sage,#4E5F4F)}
.ms .veil{position:fixed; inset:0; z-index:700; background:rgba(38,38,38,.5); display:flex; align-items:flex-start; justify-content:center; padding:16px; overflow:auto}
.ms .box{background:#fff; border-radius:12px; max-width:880px; width:100%; margin:auto; box-shadow:0 18px 50px rgba(0,0,0,.35); overflow:hidden}
.ms .box h3{margin:0; padding:16px 20px; background:var(--sage,#4E5F4F); color:#fff; font-family:var(--display,Georgia,serif); font-size:22px; line-height:1.2}
.ms .box .bd{padding:14px 20px 8px} .ms .box .ft{padding:10px 20px 18px; text-align:right}
.ms .grid{display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:8px; margin:10px 0}
.ms .grid div{background:var(--bone,#F7F7F7); border-radius:8px; padding:8px 12px}
.ms .grid b{display:block; font-size:20px; font-family:var(--display,Georgia,serif); color:var(--sage,#4E5F4F)} .ms .grid span{font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:var(--sage-70,#7B887C)}
.ms iframe{width:100%; height:520px; border:1px solid var(--mist,#e7e7e7); border-radius:8px; background:#fff}
.ms .lk{display:flex; gap:10px; padding:5px 0; border-top:1px solid var(--mist,#e7e7e7); font-size:13px} .ms .lk span:first-child{flex:1; overflow-wrap:anywhere} .ms .lk span:last-child{font-weight:700}
`;
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n) => (n == null ? '–' : Number(n).toLocaleString('en-GB'));
  const pc = (n) => (n == null ? '–' : n.toFixed(1) + '%');
  const fmtDT = (iso) => { try { return new Date(iso).toLocaleString('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return String(iso || ''); } };
  const fmtD = (iso) => { try { return new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return String(iso || ''); } };
  const ukDay = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(d);
  function relative(iso) {
    const ms = new Date(iso).getTime() - Date.now(), mins = Math.round(ms / 60000);
    if (isNaN(mins)) return '';
    if (mins < 0) return 'due now';
    if (mins < 60) return `in ${mins} min`;
    const days = Math.round((Date.parse(ukDay(new Date(iso)) + 'T12:00:00Z') - Date.parse(ukDay(new Date()) + 'T12:00:00Z')) / 864e5);
    if (days === 0) return `today, in ${Math.round(mins / 60)} h`;
    return days === 1 ? 'tomorrow' : `in ${days} days`;
  }

  function mount(el, o) {
    let dead = false, data = null, err = '';
    if (!document.getElementById('ms-css')) { const s = document.createElement('style'); s.id = 'ms-css'; s.textContent = CSS; document.head.appendChild(s); }

    function audience(c) { return c.lists.length ? c.lists.map((l) => `${esc(l.name)}${l.subscribers != null ? ` (${num(l.subscribers)})` : ''}`).join(', ') : 'no list chosen yet'; }
    function upCard(c) {
      const now = c.status === 'inProcess';
      return `<div class="card up${now ? ' now' : ''}"><div class="when">${c.scheduled_at ? `<b>${esc(fmtDT(c.scheduled_at).replace(/^(\w+), /, '$1 '))}</b><span>${esc(relative(c.scheduled_at))}</span>` : `<b>Sending</b>`}</div>
        <div class="mid"><span class="chip${now ? ' now' : ''}">${now ? 'Sending now' : 'Scheduled'}</span><div class="t" style="margin-top:6px">${esc(c.name)}</div><div class="s">${esc(c.subject)}</div>
          <div class="m">To: ${audience(c)}${c.audience ? ` · about <b>${num(c.audience)}</b> people` : ''}${c.excluded_lists.length ? ` · not to: ${c.excluded_lists.map((l) => esc(l.name)).join(', ')}` : ''}${c.sender ? ` · from ${esc(c.sender.name)} &lt;${esc(c.sender.email)}&gt;` : ''}</div></div>
        <div><button class="btn small ghost" type="button" data-ms="open" data-id="${c.id}">Preview email</button></div></div>`;
    }
    function sentRow(c) {
      const s = c.stats || {}, bounces = (s.hard_bounces || 0) + (s.soft_bounces || 0);
      return `<tr class="row" data-ms="open" data-id="${c.id}"><td class="l">${esc(fmtD(c.sent_date))}</td><td class="nm"><b>${esc(c.name)}</b><span>${esc(c.subject)}</span></td>
        <td>${num(s.sent)}</td><td>${num(s.delivered)}<span class="pc">${pc(s.delivered_pct)}</span></td><td>${num(s.opens)}<span class="pc">${pc(s.open_pct)}</span></td>
        <td>${num(s.clickers)}<span class="pc">${pc(s.click_pct)}</span></td><td>${num(s.unsubscribes)}</td><td>${bounces ? num(bounces) : '<span class="dim">0</span>'}${s.hard_bounces ? ` <span class="pc">(${s.hard_bounces} hard)</span>` : ''}</td><td>${s.complaints ? `<span class="bad">${num(s.complaints)}</span>` : '<span class="dim">0</span>'}</td></tr>`;
    }
    function draw() {
      if (dead) return;
      if (err) { el.innerHTML = `<div class="ms"><div class="pagehead"><h2>Mail shots</h2></div><div class="notice bad">${esc(err)}</div><button class="btn" data-ms="reload">Try again</button></div>`; return; }
      if (!data) { el.innerHTML = `<div class="ms"><div class="pagehead"><h2>Mail shots</h2></div><div class="loading">Loading from Brevo…</div></div>`; return; }
      const sent = data.sent, wsent = sent.reduce((t, c) => t + (c.stats ? c.stats.delivered : 0), 0);
      const w = (k) => (wsent ? Math.round(sent.reduce((t, c) => t + (c.stats ? (c.stats[k] || 0) : 0), 0) / wsent * 1000) / 10 : null);
      el.innerHTML = `<div class="ms"><div class="pagehead"><h2>Mail shots</h2><span class="hint">Your Brevo email campaigns: what is going out, and how the ones that have gone did</span><span class="spacer"></span><button class="btn small ghost" type="button" data-ms="reload">Refresh</button></div>
        <p class="intro">Read only: this page only looks at Brevo. Nothing here can send, change or delete anything.</p>
        ${data.key_source === 'default' && !sent.length && !data.upcoming.length ? `<div class="notice">This is reading the portal's own email account, which has no mail shots in it. Once the Brevo key for the account your mail shots are sent from is added, they will appear here.</div>` : ''}
        <h3 class="sec" style="margin-top:6px">Going out</h3>
        ${data.upcoming.length ? data.upcoming.map(upCard).join('') : `<div class="card"><span class="dim">Nothing is scheduled or sending at the moment.</span></div>`}
        ${data.drafts.length ? `<details><summary>${data.drafts.length} draft${data.drafts.length === 1 ? '' : 's'} not scheduled yet</summary><div style="margin-top:8px">${data.drafts.map((c) => `<div class="card" style="padding:10px 16px;margin-bottom:8px"><b>${esc(c.name)}</b> <span class="dim">· ${esc(c.subject)} · edited ${esc(fmtD(c.modified_at))}</span> <button class="btn small ghost" type="button" data-ms="open" data-id="${c.id}" style="float:right">Preview</button></div>`).join('')}</div></details>` : ''}
        <h3 class="sec">Sent</h3>
        ${sent.length ? `<div class="strip"><div><b>${num(sent.length)}</b><span>Mail shots shown</span></div><div><b>${num(sent.reduce((t, c) => t + (c.stats ? c.stats.sent : 0), 0))}</b><span>Emails sent</span></div><div><b>${pc(w('opens'))}</b><span>Opened (average)</span></div><div><b>${pc(w('clickers'))}</b><span>Clicked (average)</span></div><div><b>${num(sent.reduce((t, c) => t + (c.stats ? c.stats.unsubscribes : 0), 0))}</b><span>Unsubscribes</span></div></div>
          <div class="wrap"><table><thead><tr><th class="l">Sent</th><th class="l">Mail shot</th><th>Sent</th><th>Delivered</th><th title="People who opened it. Apple Mail's privacy feature opens emails for its users automatically, so this is overstated; clicks are the more honest measure.">Opened</th><th title="People who clicked a link">Clicked</th><th>Unsubscribed</th><th>Bounced</th><th>Spam complaints</th></tr></thead><tbody>${sent.map(sentRow).join('')}</tbody></table></div>
          <p class="fine">Click a row for the email itself, the links people clicked and the full figures. Percentages are of emails delivered. "Opened" is overstated by Apple Mail's privacy feature, so lean on clicks.</p>` : `<div class="card"><span class="dim">No mail shots have been sent yet.</span></div>`}</div>`;
    }
    async function load(force) {
      err = ''; if (force || !data) { data = null; draw(); }
      try { data = await o.call('campaigns'); } catch (e) { err = e.message; }
      draw();
    }
    async function openCampaign(id) {
      const veil = document.createElement('div'); veil.className = 'ms'; veil.innerHTML = `<div class="veil"><div class="box" role="dialog" aria-modal="true"><h3>Loading…</h3><div class="bd"><div class="loading">Loading the email…</div></div><div class="ft"><button class="btn small ghost" type="button" data-x>Close</button></div></div></div>`;
      document.body.appendChild(veil);
      const close = () => { veil.remove(); document.removeEventListener('keydown', onKey); };
      const onKey = (e) => { if (e.key === 'Escape') close(); };
      document.addEventListener('keydown', onKey);
      veil.querySelector('.veil').addEventListener('click', (e) => { if (e.target.classList.contains('veil') || e.target.hasAttribute('data-x')) close(); });
      try {
        const d = await o.call('campaign', { id }), c = d.campaign, s = c.stats;
        const stat = (k, v) => `<div><b>${v}</b><span>${k}</span></div>`;
        veil.querySelector('.box').innerHTML = `<h3>${esc(c.name)}<div style="font-family:var(--body);font-size:13px;opacity:.85;margin-top:4px">${esc(c.subject)}</div></h3>
          <div class="bd"><p style="margin:0 0 6px;font-size:13px;color:var(--sage-70,#7B887C)">${c.status === 'sent' || c.status === 'archive' ? `Sent ${esc(fmtDT(c.sent_date))}` : c.scheduled_at ? `Scheduled for ${esc(fmtDT(c.scheduled_at))}` : 'Not scheduled yet'}${c.sender ? ` · from ${esc(c.sender.name)} &lt;${esc(c.sender.email)}&gt;` : ''}<br>To: ${audience(c)}${c.audience ? ` · about ${num(c.audience)} people` : ''}</p>
          ${s ? `<div class="grid">${stat('Sent', num(s.sent))}${stat('Delivered', num(s.delivered) + ' · ' + pc(s.delivered_pct))}${stat('Opened', num(s.opens) + ' · ' + pc(s.open_pct))}${stat('Clicked', num(s.clickers) + ' · ' + pc(s.click_pct))}${stat('Click to open', pc(s.click_to_open_pct))}${stat('Unsubscribed', num(s.unsubscribes) + ' · ' + pc(s.unsub_pct))}${stat('Bounced', num(s.hard_bounces + s.soft_bounces) + ` (${num(s.hard_bounces)} hard)`)}${stat('Spam complaints', num(s.complaints))}</div>
            <p class="fine" style="margin-top:0">${s.apple_opens ? `${num(s.apple_opens)} of the opens came from Apple Mail's privacy feature (automatic, not necessarily a person reading it). ` : ''}Total link clicks: ${num(s.clicks)}.</p>` : ''}
          ${d.links && d.links.length ? `<h4 style="margin:12px 0 4px;font-size:14px">Links clicked</h4>${d.links.map((l) => `<div class="lk"><span>${esc(l.url)}</span><span>${num(l.clicks)}</span></div>`).join('')}` : ''}
          <h4 style="margin:14px 0 6px;font-size:14px">The email</h4>${d.html ? `<iframe sandbox="" srcdoc="${esc(d.html)}" title="Preview of the email"></iframe>` : `<div class="dim">No email content to show.</div>`}</div>
          <div class="ft"><button class="btn small ghost" type="button" data-x>Close</button></div>`;
      } catch (e) { veil.querySelector('.box').innerHTML = `<h3>Could not load it</h3><div class="bd"><div class="notice bad">${esc(e.message)}</div></div><div class="ft"><button class="btn small ghost" type="button" data-x>Close</button></div>`; }
    }
    function onClick(e) {
      const b = e.target.closest('[data-ms]'); if (!b) return;
      if (b.dataset.ms === 'reload') load(true); else if (b.dataset.ms === 'open') openCampaign(Number(b.dataset.id));
    }
    el.addEventListener('click', onClick);
    load(false);
    return { unmount() { dead = true; el.removeEventListener('click', onClick); el.innerHTML = ''; } };
  }
  global.Mailshots = { mount };
})(window);
