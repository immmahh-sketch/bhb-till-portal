/* Social Posts - the "Social Posts" tab of Marketing Actions.
 *
 *   const s = Social.mount(element, { call, me, people, toast, openModal, closeModal });
 *
 * Two sub-tabs, Posts and Reels. Each item has a date to post, text, pictures or a reel, an ad spend budget,
 * who will post it, and notes from the team for the poster to read first. Once posted it stays as history,
 * with results (reach, likes, clicks...) typed in by hand for now. Uses the host page's colours and the
 * .btn / .card / .field / .opts / .opt / .tag / .pick classes; everything else is styled here under .sp.
 * Pictures and reels are uploaded straight to Cloudflare R2 with FileShare.sendParts (shared/fileshare.js).
 */
(function (global) {
  'use strict';

  const CSS = `
.sp .scope{display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin:0 0 14px}
.sp .scope label.mine{display:inline-flex; gap:6px; align-items:center; font-size:14px; margin-left:6px; cursor:pointer}
.sp .item{display:flex; gap:16px; cursor:pointer; align-items:flex-start}
.sp .item:hover{box-shadow:0 2px 6px rgba(38,38,38,.1), 0 10px 28px rgba(38,38,38,.1)}
.sp .when{flex:none; width:62px; text-align:center; border-radius:10px; background:var(--sage-10,#EDEFED); padding:8px 4px; color:var(--sage,#4E5F4F)}
.sp .when b{display:block; font-family:var(--display,Georgia,serif); font-size:28px; line-height:1}
.sp .when span{font-size:11px; letter-spacing:.14em; text-transform:uppercase}
.sp .when small{display:block; font-size:10px; opacity:.75; margin-top:2px}
.sp .when.late{background:var(--alert-bg,#F6EAE8); color:var(--alert,#8C4A3F)}
.sp .main{flex:1; min-width:0}
.sp .txt{white-space:pre-wrap; overflow:hidden; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; word-break:break-word}
.sp .thumbs{display:flex; gap:6px; flex-wrap:wrap; margin-top:10px}
.sp .thumbs .th{width:64px; height:64px; border-radius:8px; object-fit:cover; background:var(--mist,#e7e7e7); display:block}
.sp .thumbs .more{width:64px; height:64px; border-radius:8px; background:var(--sage-10,#EDEFED); color:var(--sage,#4E5F4F); display:flex; align-items:center; justify-content:center; font-weight:700}
.sp .meta{display:flex; gap:6px; flex-wrap:wrap; align-items:center; margin-top:10px; font-size:12px; color:var(--sage-70,#7B887C)}
.sp .chip{display:inline-block; background:var(--sage-10,#EDEFED); color:var(--sage,#4E5F4F); border-radius:999px; padding:2px 10px; font-size:12px; font-weight:600}
.sp .chip.note{background:var(--attention-bg,#F7F0E4); color:#6d5320}
.sp .res{margin-top:8px; font-size:13px; color:var(--ink,#262626)}
.sp .res b{font-weight:700}
.spm .mediabox{display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px}
.spm .mediabox .m{position:relative; width:112px}
.spm .mediabox .m img,.spm .mediabox .m video{width:112px; height:112px; object-fit:cover; border-radius:8px; background:var(--mist,#e7e7e7); display:block}
.spm .mediabox .m button{position:absolute; top:4px; right:4px; border:0; border-radius:50%; width:24px; height:24px; background:rgba(38,38,38,.75); color:#fff; cursor:pointer; line-height:1}
.spm .mediabox .m .nm{font-size:11px; color:var(--sage-70,#7B887C); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:3px}
.spm .mediabox .m.pending img,.spm .mediabox .m.pending video{opacity:.55}
.spm .drop{border:2px dashed var(--celadon,#C1C8B4); border-radius:10px; padding:16px; text-align:center; cursor:pointer; background:var(--bone,#f7f7f7); color:var(--sage-70,#7B887C); font-size:14px}
.spm .drop:hover,.spm .drop.over{background:var(--sage-10,#EDEFED); border-color:var(--sage,#4E5F4F)}
.spm .prog{height:8px; background:var(--mist,#e7e7e7); border-radius:99px; overflow:hidden; margin:8px 0 4px}
.spm .prog i{display:block; height:100%; width:0; background:var(--gold,#C9A56B); transition:width .2s}
.spm .row2{display:grid; grid-template-columns:1fr 1fr; gap:12px}
.spm .notes{border-top:1px solid var(--mist,#e7e7e7); margin-top:6px}
.spm .note{padding:10px 0; border-bottom:1px solid var(--mist,#e7e7e7)}
.spm .note:last-child{border-bottom:0}
.spm .note .h{font-size:12px; color:var(--sage-70,#7B887C)} .spm .note .h b{color:var(--ink,#262626)}
.spm .note .b{white-space:pre-wrap; margin-top:2px}
.spm .resgrid{display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:10px}
.spm .resgrid .field{margin:0}
.spm .err{background:var(--alert-bg,#F6EAE8); color:var(--alert,#8C4A3F); border-radius:8px; padding:10px 12px; margin-bottom:12px; font-size:14px}
.spm h4{font-family:var(--display,Georgia,serif); font-size:20px; color:var(--sage,#4E5F4F); margin:20px 0 8px; font-weight:600}
@media (max-width:760px){ .sp .item{gap:12px} .sp .when{width:52px} .spm .row2{grid-template-columns:1fr} }
`;

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num = n => Number(n || 0).toLocaleString('en-GB');
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const fmtDT = iso => { try { return new Date(iso).toLocaleString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace(',', ''); } catch (e) { return ''; } };
  const day = d => { try { return new Date(d + 'T12:00:00Z'); } catch (e) { return new Date(); } };
  const KIND = { post: { one: 'post', many: 'Posts', label: 'Post' }, reel: { one: 'reel', many: 'Reels', label: 'Reel' } };
  const PLAT = { facebook: 'Facebook', instagram: 'Instagram' };
  const RESULTS = [['reach', 'Reach'], ['views', 'Views'], ['likes', 'Likes'], ['comments', 'Comments'], ['shares', 'Shares'], ['saves', 'Saves'], ['clicks', 'Clicks'], ['impressions', 'Impressions'], ['spend_actual', 'Ad spend actually spent (£)']];
  const sizeLabel = n => n >= 1073741824 ? (n / 1073741824).toFixed(1) + ' GB' : n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';

  function mount(el, ctx) {
    if (!document.getElementById('sp-css')) { const s = document.createElement('style'); s.id = 'sp-css'; s.textContent = CSS; document.head.appendChild(s); }
    const call = ctx.call, toast = ctx.toast;
    const st = { kind: 'post', scope: 'upcoming', mine: false, posts: [], info: { ready: true }, loaded: false, dead: false };
    el.classList.add('sp');

    async function boot() {
      el.innerHTML = `<div class="loading">Loading…</div>`;
      try { st.info = await call('bootstrap'); } catch (e) { el.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
      await load();
    }
    async function load() {
      try { st.posts = (await call('posts.list', { kind: st.kind, scope: st.scope })).posts || []; st.loaded = true; }
      catch (e) { el.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
      if (!st.dead) render();
    }

    function mediaThumbs(p) {
      const m = p.media || [];
      if (!m.length) return '';
      const shown = m.slice(0, 4);
      return `<div class="thumbs">${shown.map(x => x.kind === 'image' ? `<img class="th" src="${esc(x.url)}" alt="" loading="lazy">` : `<video class="th" src="${esc(x.url)}#t=0.5" preload="metadata" muted></video>`).join('')}${m.length > 4 ? `<div class="more">+${m.length - 4}</div>` : ''}</div>`;
    }
    function resultsLine(p) {
      const r = p.results || {};
      const bits = RESULTS.filter(([k]) => r[k] !== undefined && r[k] !== null).map(([k, l]) => k === 'spend_actual' ? `${l.split(' ')[0] === 'Ad' ? 'Spent' : l} <b>${money(r[k])}</b>` : `${l} <b>${num(r[k])}</b>`);
      return bits.length ? `<div class="res">${bits.join(' · ')}</div>` : '';
    }
    function card(p) {
      const d = day(p.post_date), late = p.status === 'scheduled' && p.post_date < today();
      const statusTag = p.status === 'posted' ? `<span class="tag completed">Posted</span>` : p.status === 'cancelled' ? `<span class="tag parked">Cancelled</span>` : (late ? `<span class="tag late">Overdue</span>` : `<span class="tag outstanding">Scheduled</span>`);
      return `<div class="card item" data-id="${esc(p.id)}">
        <div class="when${late ? ' late' : ''}"><small>${esc(d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }))}</small><b>${d.getUTCDate()}</b><span>${esc(d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }))}</span></div>
        <div class="main">
          <div class="txt">${p.body ? esc(p.body) : '<span class="muted">No text yet</span>'}</div>
          ${mediaThumbs(p)}
          <div class="meta">${statusTag}${p.post_time ? `<span>${esc(String(p.post_time).slice(0, 5))}</span>` : ''}
            ${(p.platforms || []).map(x => `<span class="chip">${esc(PLAT[x] || x)}</span>`).join('')}
            ${p.ad_spend != null ? `<span class="chip">${money(p.ad_spend)} ad budget</span>` : ''}
            ${p.poster_name ? `<span>To post: <b style="color:var(--ink,#262626)">${esc(p.poster_name)}</b></span>` : '<span>No one assigned</span>'}
            ${p.comment_count ? `<span class="chip note">${p.comment_count} note${p.comment_count === 1 ? '' : 's'}</span>` : ''}
            ${p.posted_url ? `<a href="${esc(p.posted_url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">View live post</a>` : ''}</div>
          ${p.status === 'posted' ? resultsLine(p) : ''}
        </div></div>`;
    }

    function render() {
      const k = KIND[st.kind];
      let list = st.posts;
      if (st.mine) list = list.filter(p => p.poster_email === ctx.me.email);
      const scopes = [['upcoming', 'Upcoming'], ['history', 'Posted history'], ['cancelled', 'Cancelled'], ['all', 'All']];
      el.innerHTML = `
        <div class="pagehead"><h2>Social Posts</h2><span class="hint">Plan posts and reels, leave notes for whoever posts them, and keep a history to review</span><span class="spacer"></span><button class="btn" id="sp_new">New ${k.one}</button></div>
        ${st.info.ready ? '' : `<div class="notice" style="background:var(--attention-bg);border-radius:8px;padding:10px 14px;margin-bottom:12px">Picture and video storage isn't connected yet, so uploads won't work until it is.</div>`}
        <div class="opts" style="margin-bottom:12px"><button class="opt" data-kind="post" aria-pressed="${st.kind === 'post'}">Posts</button><button class="opt" data-kind="reel" aria-pressed="${st.kind === 'reel'}">Reels</button></div>
        <div class="scope">${scopes.map(([v, l]) => `<button class="opt" data-scope="${v}" aria-pressed="${st.scope === v}">${l}</button>`).join('')}
          <label class="mine"><input type="checkbox" id="sp_mine" ${st.mine ? 'checked' : ''}> Mine to post</label>
          <span class="spacer"></span>${list.some(p => p.status === 'posted') ? `<button class="btn ghost small" id="sp_csv">Export CSV</button>` : ''}</div>
        ${list.length ? list.map(card).join('') : `<div class="card empty">${st.scope === 'upcoming' ? `Nothing scheduled. Press New ${k.one} to plan one.` : st.scope === 'history' ? `No ${k.many.toLowerCase()} have been marked as posted yet.` : `Nothing here.`}</div>`}`;
      el.querySelectorAll('[data-kind]').forEach(b => b.onclick = () => { st.kind = b.dataset.kind; st.loaded = false; load(); });
      el.querySelectorAll('[data-scope]').forEach(b => b.onclick = () => { st.scope = b.dataset.scope; load(); });
      el.querySelector('#sp_mine').onchange = e => { st.mine = e.target.checked; render(); };
      el.querySelector('#sp_new').onclick = () => editor(null);
      el.querySelectorAll('.item').forEach(c => c.onclick = e => { if (e.target.closest('a')) return; editor(st.posts.find(p => p.id === c.dataset.id)); });
      const csv = el.querySelector('#sp_csv'); if (csv) csv.onclick = () => exportCsv(list.filter(p => p.status === 'posted'));
    }

    function exportCsv(rows) {
      const cell = v => { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
      const head = ['Date posted', 'Planned date', 'Type', 'Text', 'Platforms', 'Posted by', 'Ad budget', 'Ad spend actual', 'Reach', 'Impressions', 'Views', 'Likes', 'Comments', 'Shares', 'Saves', 'Clicks', 'Link'];
      const out = [head].concat(rows.map(p => { const r = p.results || {};
        return [p.posted_at ? String(p.posted_at).slice(0, 10) : '', p.post_date, KIND[p.kind].label, p.body, (p.platforms || []).map(x => PLAT[x] || x).join(' + '), p.posted_by_name || p.poster_name || '',
          p.ad_spend ?? '', r.spend_actual ?? '', r.reach ?? '', r.impressions ?? '', r.views ?? '', r.likes ?? '', r.comments ?? '', r.shares ?? '', r.saves ?? '', r.clicks ?? '', p.posted_url || '']; }));
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['﻿' + out.map(r => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv' }));
      a.download = 'social-' + st.kind + 's-history-' + today() + '.csv'; document.body.appendChild(a); a.click(); a.remove();
    }

    // ---------------------------------------------------------------- the editor
    async function editor(post) {
      const isNew = !post;
      const k = KIND[post ? post.kind : st.kind];
      const d = { id: post ? post.id : null, kind: post ? post.kind : st.kind, media: post ? (post.media || []).slice() : [], pending: [], comments: [], status: post ? post.status : 'scheduled', busy: false, post: post || null };
      const peopleOpts = ctx.people.map(p => `<option value="${esc(p.email)}">${esc(p.name)}</option>`).join('');
      ctx.openModal(`<div class="spm"><h3>${isNew ? 'New ' + k.one : k.label + ' for ' + esc(day(post.post_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }))}</h3>
        <div id="spm_err"></div>
        <div class="row2"><div class="field"><label>Date to post</label><input id="spm_date" type="date"></div><div class="field"><label>Time (optional)</label><input id="spm_time" type="time"></div></div>
        <div class="field"><label>Who will post it</label><select id="spm_poster"><option value="">No one yet</option>${peopleOpts}</select></div>
        <div class="field"><label>Where</label><div class="pick" id="spm_plat">${Object.keys(PLAT).map(x => `<label><input type="checkbox" value="${x}">${PLAT[x]}</label>`).join('')}</div></div>
        <div class="field"><label>Text <span id="spm_count" style="float:right;letter-spacing:0;text-transform:none"></span></label><textarea id="spm_body" maxlength="5000" style="min-height:130px" placeholder="What the ${k.one} should say, with any hashtags"></textarea></div>
        <div class="field"><label>Images / ${d.kind === 'reel' ? 'reel' : 'video'}</label><div class="mediabox" id="spm_media"></div>
          <div class="drop" id="spm_drop">Upload image/reel<br><span style="font-size:12px">Tap to choose, or drop files here</span><input type="file" id="spm_file" multiple hidden accept="image/*,video/*"></div>
          <div id="spm_prog"></div></div>
        <div class="field"><label>Ad spend budget (£, optional)</label><input id="spm_spend" type="number" min="0" step="0.01" inputmode="decimal" placeholder="e.g. 50" style="max-width:220px"></div>
        ${isNew ? `<div class="field"><label>Note for whoever posts it (optional)</label><textarea id="spm_note0" maxlength="3000" placeholder="Anything they should read before posting"></textarea></div>` : ''}
        <div class="opts"><button class="btn" id="spm_save">${isNew ? 'Save ' + k.one : 'Save changes'}</button><button class="btn ghost" id="spm_cancel">Close</button></div>
        ${isNew ? '' : `<div id="spm_more"></div>`}</div>`);
      const $ = s => document.querySelector('#modalroot ' + s);
      $('#spm_date').value = post ? post.post_date : today();
      $('#spm_time').value = post && post.post_time ? String(post.post_time).slice(0, 5) : '';
      $('#spm_poster').value = post && post.poster_email ? post.poster_email : '';
      $('#spm_body').value = post ? post.body : '';
      $('#spm_spend').value = post && post.ad_spend != null ? post.ad_spend : '';
      const plats = post ? (post.platforms || []) : Object.keys(PLAT);
      document.querySelectorAll('#modalroot #spm_plat input').forEach(i => { i.checked = plats.includes(i.value); });
      const count = () => { $('#spm_count').textContent = $('#spm_body').value.length + ' characters'; };
      $('#spm_body').addEventListener('input', count); count();
      const showErr = m => { $('#spm_err').innerHTML = m ? `<div class="err">${esc(m)}</div>` : ''; if (m) $('#spm_err').scrollIntoView({ block: 'nearest' }); };

      function drawMedia() {
        const box = $('#spm_media');
        box.innerHTML = d.media.map(m => `<div class="m">${m.kind === 'image' ? `<a href="${esc(m.url)}" target="_blank" rel="noopener"><img src="${esc(m.url)}" alt=""></a>` : `<video src="${esc(m.url)}#t=0.5" controls preload="metadata"></video>`}
            <button type="button" data-rmm="${esc(m.id)}" title="Remove">&times;</button><div class="nm">${esc(m.name)}</div></div>`).join('') +
          d.pending.map((f, i) => `<div class="m pending">${f.type.startsWith('image/') ? `<img src="${esc(f._url || (f._url = URL.createObjectURL(f)))}" alt="">` : `<video src="${esc(f._url || (f._url = URL.createObjectURL(f)))}#t=0.5" preload="metadata"></video>`}
            <button type="button" data-rmp="${i}" title="Remove">&times;</button><div class="nm">${esc(f.name)} (${esc(sizeLabel(f.size))}) - not uploaded yet</div></div>`).join('');
        box.querySelectorAll('[data-rmp]').forEach(b => b.onclick = () => { d.pending.splice(Number(b.dataset.rmp), 1); drawMedia(); });
        box.querySelectorAll('[data-rmm]').forEach(b => b.onclick = async () => {
          if (!confirm('Remove this file from the post?')) return;
          try { await call('media.remove', { id: b.dataset.rmm }); d.media = d.media.filter(x => x.id !== b.dataset.rmm); drawMedia(); } catch (e) { showErr(e.message); }
        });
      }
      drawMedia();
      const drop = $('#spm_drop'), inp = $('#spm_file');
      const addFiles = list => { for (const f of list) { if (!/^(image|video)\//.test(f.type)) { showErr(f.name + ' is not a picture or a video.'); continue; } d.pending.push(f); } drawMedia(); };
      drop.onclick = () => { if (!d.busy) inp.click(); };
      inp.onchange = () => { addFiles(Array.from(inp.files)); inp.value = ''; };
      ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
      ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
      drop.addEventListener('drop', e => { if (!d.busy && e.dataTransfer) addFiles(Array.from(e.dataTransfer.files)); });
      $('#spm_cancel').onclick = () => { if (d.busy && !confirm('An upload is still running. Close anyway?')) return; ctx.closeModal(); load(); };

      const fields = () => ({
        post_date: $('#spm_date').value, post_time: $('#spm_time').value || null, poster_email: $('#spm_poster').value,
        body: $('#spm_body').value, ad_spend: $('#spm_spend').value === '' ? null : $('#spm_spend').value,
        platforms: Array.from(document.querySelectorAll('#modalroot #spm_plat input:checked')).map(i => i.value),
      });

      async function uploadPending() {
        const files = d.pending.slice();
        let n = 0;
        for (const f of files) {
          const label = (files.length > 1 ? 'File ' + (n + 1) + ' of ' + files.length + ': ' : '') + f.name;
          const show = (t, pct) => { const p = $('#spm_prog'); if (p) p.innerHTML = `<div class="muted" style="font-size:13px">${esc(t)}</div><div class="prog"><i style="width:${Math.round(pct * 100)}%"></i></div>`; };
          show('Starting ' + label, 0);
          const plan = await call('media.start', { post_id: d.id, name: f.name, size: f.size, type: f.type });
          try {
            const parts = await global.FileShare.sendParts(plan, f, pct => show('Uploading ' + label + ' (' + Math.round(pct * 100) + '%)', pct), a => show('Connection problem, trying again (' + a + ' of 4)...', 0));
            show('Finishing ' + f.name, 1);
            await call('media.complete', { id: plan.id, uploadId: plan.uploadId, ticket: plan.ticket, parts });
          } catch (e) { call('media.abort', { id: plan.id, uploadId: plan.uploadId, ticket: plan.ticket }).catch(() => {}); throw e; }
          n++; d.pending.shift();
        }
        const p = $('#spm_prog'); if (p) p.innerHTML = '';
      }

      $('#spm_save').onclick = async () => {
        const btn = $('#spm_save');
        showErr('');
        d.busy = true; btn.disabled = true; btn.textContent = 'Saving…';
        try {
          const saved = await call('post.save', { id: d.id || undefined, kind: d.kind, ...fields() });
          d.id = saved.post.id;
          const note0 = $('#spm_note0'); if (note0 && note0.value.trim()) { await call('comment.add', { post_id: d.id, body: note0.value }); note0.value = ''; }
          if (d.pending.length) { btn.textContent = 'Uploading…'; await uploadPending(); }
          const full = await call('post.get', { id: d.id });
          toast('Saved.');
          if (isNew) { ctx.closeModal(); load(); return; }
          d.post = full.post; d.media = full.post.media; d.comments = full.comments; drawMedia(); drawMore(); await load();
          btn.disabled = false; btn.textContent = 'Save changes'; d.busy = false;
        } catch (e) {
          d.busy = false; btn.disabled = false; btn.textContent = d.id ? 'Save changes' : 'Save ' + k.one;
          showErr((d.id ? 'The ' + k.one + ' was saved, but: ' : '') + e.message);
        }
      };

      // ---- everything below the form (edit only): notes, posting, results
      function drawMore() {
        const box = $('#spm_more'); if (!box) return;
        const p = d.post, posted = p.status === 'posted', cancelled = p.status === 'cancelled';
        const r = p.results || {};
        box.innerHTML = `
          <h4>Notes for whoever posts it</h4>
          <div class="notes">${d.comments.length ? d.comments.map(c => `<div class="note"><div class="h"><b>${esc(c.by_name)}</b> · ${esc(fmtDT(c.at))}</div><div class="b">${esc(c.body)}</div></div>`).join('') : `<div class="muted" style="padding:8px 0">No notes yet.</div>`}</div>
          <div class="field" style="margin-top:10px"><textarea id="spm_note" maxlength="3000" style="min-height:70px" placeholder="Add a note about this ${k.one}, for the person posting it to read first"></textarea></div>
          <button class="btn ghost small" id="spm_addnote">Add note</button>
          <h4>${posted ? 'Posted' : cancelled ? 'Cancelled' : 'Ready to go?'}</h4>
          ${posted ? `<p class="muted" style="margin:0 0 10px">Posted ${esc(fmtDT(p.posted_at))}${p.posted_by_name ? ' by ' + esc(p.posted_by_name) : ''}.${p.posted_url ? ` <a href="${esc(p.posted_url)}" target="_blank" rel="noopener">View live post</a>` : ''}</p>
            <div class="opts"><button class="btn ghost small" id="spm_unpost">Put back on the schedule</button></div>
            <h4>Results</h4><p class="muted" style="margin:0 0 10px;font-size:13px">Typed in by hand for now. When the Meta (Facebook and Instagram) connection is set up, these fill in by themselves.${p.results_at ? ` Last updated ${esc(fmtDT(p.results_at))}${p.results_source === 'meta' ? ' from Meta' : ''}.` : ''}</p>
            <div class="resgrid">${RESULTS.map(([key, label]) => `<div class="field"><label>${esc(label)}</label><input data-res="${key}" type="number" min="0" ${key === 'spend_actual' ? 'step="0.01"' : 'step="1"'} inputmode="decimal" value="${r[key] ?? ''}"></div>`).join('')}</div>
            <button class="btn small" id="spm_saveres" style="margin-top:10px">Save results</button>`
          : cancelled ? `<div class="opts"><button class="btn ghost small" id="spm_resched">Put back on the schedule</button></div>`
          : `<div id="spm_postform" hidden></div>
            <div class="opts" id="spm_actions"><button class="btn small" id="spm_posted">Mark as posted</button><button class="btn danger small" id="spm_cancelpost" style="background:var(--white);color:var(--alert);border-color:var(--alert)">Cancel this ${k.one}</button></div>`}`;
        const add = $('#spm_addnote');
        if (add) add.onclick = async () => {
          const t = $('#spm_note'); if (!t.value.trim()) return;
          add.disabled = true;
          try { await call('comment.add', { post_id: d.id, body: t.value }); d.comments = (await call('post.get', { id: d.id })).comments; drawMore(); load(); } catch (e) { showErr(e.message); add.disabled = false; }
        };
        const act = (id, fn) => { const b = $(id); if (b) b.onclick = fn; };
        const status = async s => { try { await call('post.status', { id: d.id, status: s }); toast('Done.'); ctx.closeModal(); load(); } catch (e) { showErr(e.message); } };
        act('#spm_cancelpost', () => { if (confirm('Cancel this ' + k.one + '? It stays in the history as cancelled.')) status('cancelled'); });
        act('#spm_resched', () => status('scheduled'));
        act('#spm_unpost', () => status('scheduled'));
        act('#spm_posted', () => {
          const f = $('#spm_postform'); $('#spm_actions').hidden = true; f.hidden = false;
          f.innerHTML = `<div class="field"><label>Link to the live post (optional)</label><input id="spm_url" type="url" placeholder="https://www.facebook.com/..."></div>
            <div class="field"><label>Date it went out</label><input id="spm_pdate" type="date" style="max-width:220px"></div>
            <div class="opts"><button class="btn small" id="spm_postok">Confirm posted</button><button class="btn ghost small" id="spm_postno">Not yet</button></div>`;
          $('#spm_pdate').value = today();
          $('#spm_postno').onclick = () => { f.hidden = true; $('#spm_actions').hidden = false; };
          $('#spm_postok').onclick = async () => {
            try { await call('post.mark_posted', { id: d.id, posted_url: $('#spm_url').value, posted_date: $('#spm_pdate').value }); toast('Marked as posted.'); ctx.closeModal(); load(); } catch (e) { showErr(e.message); }
          };
        });
        act('#spm_saveres', async () => {
          const results = {}; document.querySelectorAll('#modalroot [data-res]').forEach(i => { if (i.value !== '') results[i.dataset.res] = i.value; });
          try { const saved = await call('post.results', { id: d.id, results }); d.post = Object.assign(d.post, saved.post); toast('Results saved.'); await load(); drawMore(); } catch (e) { showErr(e.message); }
        });
      }
      if (!isNew) {
        try { const full = await call('post.get', { id: d.id }); d.post = full.post; d.media = full.post.media; d.comments = full.comments; drawMedia(); }
        catch (e) { showErr(e.message); }
        drawMore();
      }
    }

    boot();
    return { unmount() { st.dead = true; } };
  }

  global.Social = { mount };
})(window);
