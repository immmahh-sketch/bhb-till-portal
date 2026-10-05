/* FileShare - the "send a file to people in the portal" screen, shared by the File Transfer tile and
 * the File share tab in Marketing Actions. The page supplies how to reach file-share-api:
 *
 *   const fs = FileShare.mount(element, { call: (action, payload) => Promise, onUnread: n => {} });
 *   fs.unmount();   // stop refreshing when the tab is left
 *
 * Big files go straight from the browser to Cloudflare R2 in parts (links signed by file-share-api),
 * four parts at a time, each retried a few times. Uses the host page's colour variables and the
 * .btn / .card / .field classes; everything else is styled here under .fs.
 */
(function (global) {
  'use strict';

  const CSS = `
.fs .drop{border:2px dashed var(--celadon,#C1C8B4); border-radius:12px; padding:26px 16px; text-align:center; cursor:pointer; background:var(--bone,#f7f7f7); color:var(--sage-70,#7B887C)}
.fs .drop:hover,.fs .drop.over{background:var(--sage-10,#EDEFED); border-color:var(--sage,#4E5F4F)}
.fs .drop b{color:var(--sage,#4E5F4F); font-size:16px; display:block; margin-bottom:2px}
.fs .picked{margin:12px 0 0}
.fs .picked div{display:flex; gap:10px; align-items:center; padding:7px 0; border-bottom:1px solid var(--mist,#e7e7e7); font-size:14px}
.fs .picked div:last-child{border-bottom:0}
.fs .picked .nm{flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap}
.fs .picked button{background:none; border:0; color:var(--alert,#8C4A3F); cursor:pointer; font-size:13px}
.fs .who{display:flex; gap:6px; flex-wrap:wrap; margin-top:2px}
.fs .who label{display:inline-flex; align-items:center; gap:6px; border:1px solid var(--mist,#e7e7e7); background:var(--bone,#f7f7f7); border-radius:999px; padding:7px 12px; cursor:pointer; font-size:14px; letter-spacing:0; text-transform:none; color:var(--ink,#262626); margin:0}
.fs .who label:has(input:checked){background:var(--sage,#4E5F4F); color:#fff; border-color:var(--sage,#4E5F4F)}
.fs .who input{width:auto; margin:0}
.fs .quick{font-size:12px; margin-top:8px; color:var(--sage-70,#7B887C)}
.fs .quick a{color:var(--sage,#4E5F4F); cursor:pointer; text-decoration:underline; margin-right:12px}
.fs .prog{height:8px; background:var(--mist,#e7e7e7); border-radius:99px; overflow:hidden; margin:10px 0 4px}
.fs .prog i{display:block; height:100%; width:0; background:var(--gold,#C9A56B); transition:width .2s}
.fs .file{display:flex; gap:14px; align-items:center; padding:14px 0; border-top:1px solid var(--mist,#e7e7e7); flex-wrap:wrap}
.fs .file:first-child{border-top:0}
.fs .file .info{flex:1; min-width:200px}
.fs .file .fn{font-weight:600; word-break:break-word}
.fs .file .meta{font-size:12px; color:var(--sage-70,#7B887C); margin-top:2px}
.fs .file .note{font-size:13px; margin-top:4px; white-space:pre-wrap}
.fs .file .acts{display:flex; gap:8px; align-items:center}
.fs a.btn{text-decoration:none; display:inline-flex; align-items:center; justify-content:center}
.fs .chips{display:flex; gap:5px; flex-wrap:wrap; margin-top:5px}
.fs .chip{display:inline-block; background:var(--sage-10,#EDEFED); color:var(--sage,#4E5F4F); border-radius:999px; padding:2px 10px; font-size:12px; font-weight:600}
.fs .chip.got{background:var(--good-bg,#EDF2ED); color:var(--good,#4F6B4F)}
.fs .new{background:var(--gold,#C9A56B); color:var(--ink,#262626); border-radius:999px; padding:2px 8px; font-size:10px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; margin-left:8px; vertical-align:middle}
.fs h3{margin-bottom:10px}
@media (max-width:760px){ .fs .file .acts{width:100%} .fs .file .acts .btn{flex:1} }
`;

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sizeLabel = n => n >= 1073741824 ? (n / 1073741824).toFixed(n >= 10737418240 ? 0 : 1) + ' GB' : n >= 1048576 ? (n / 1048576).toFixed(n >= 10485760 ? 0 : 1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  const when = iso => { try { return new Date(iso).toLocaleString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace(',', ''); } catch (e) { return ''; } };
  const expiry = iso => {
    const ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return 'Expired';
    const d = Math.floor(ms / 86400000), h = Math.floor(ms / 3600000);
    return d >= 1 ? 'Expires in ' + d + ' day' + (d === 1 ? '' : 's') : 'Expires in ' + Math.max(1, h) + ' hour' + (h <= 1 ? '' : 's');
  };
  const wait = ms => new Promise(r => setTimeout(r, ms));

  let uploading = 0;
  window.addEventListener('beforeunload', e => { if (uploading) { e.preventDefault(); e.returnValue = ''; } });

  function put(url, body, onProgress) {
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open('PUT', url);
      x.upload.onprogress = e => { if (e.lengthComputable) onProgress(e.loaded); };
      x.onload = () => x.status < 300 ? resolve(x) : reject(new Error('upload failed (' + x.status + ')'));
      x.onerror = () => reject(new Error('connection lost'));
      x.ontimeout = () => reject(new Error('timed out'));
      x.send(body);
    });
  }

  // Cut the file into the planned parts and send four at a time, retrying each part.
  async function sendParts(plan, file, onProgress) {
    const size = file.size, count = plan.urls.length;
    const sent = new Array(count).fill(0), parts = [];
    const report = () => onProgress(Math.min(1, sent.reduce((a, b) => a + b, 0) / size));
    let next = 0, failed = null;
    async function sendPart(i) {
      const start = i * plan.partSize, blob = file.slice(start, Math.min(size, start + plan.partSize));
      for (let attempt = 1; ; attempt++) {
        try {
          const x = await put(plan.urls[i], blob, loaded => { sent[i] = loaded; report(); });
          const etag = x.getResponseHeader('ETag');
          if (!etag) throw new Error('the file store did not confirm a part (its CORS settings may not allow this site)');
          sent[i] = blob.size; report(); parts.push({ n: i + 1, etag }); return;
        } catch (e) {
          sent[i] = 0; report();
          if (attempt >= 5) throw e;
          await wait(1000 * attempt * attempt);
        }
      }
    }
    async function worker() { while (!failed && next < count) { const i = next++; try { await sendPart(i); } catch (e) { failed = e; } } }
    await Promise.all([worker(), worker(), worker(), worker()]);
    if (failed) throw failed;
    return parts;
  }

  function mount(el, opts) {
    if (!document.getElementById('fs-css')) { const s = document.createElement('style'); s.id = 'fs-css'; s.textContent = CSS; document.head.appendChild(s); }
    const call = opts.call;
    const st = { me: null, people: [], files: [], chosen: new Set(), note: '', inbox: [], sent: [], ready: true, keepDays: 7, maxBytes: 0, busy: false, progress: null, msg: '' };
    let timer = null, dead = false;

    const toast = (m, bad) => { if (opts.toast) opts.toast(m, bad); };

    el.classList.add('fs');
    el.innerHTML = `<div class="loading" style="padding:40px;text-align:center;color:var(--sage-70,#7B887C)">Loading…</div>`;

    async function boot() {
      try {
        const d = await call('bootstrap');
        st.me = d.me; st.people = d.people || []; st.ready = d.ready !== false; st.keepDays = d.keepDays || 7; st.maxBytes = d.maxBytes || 0;
        if (opts.onUnread) opts.onUnread(d.unread || 0);
        await refresh(true);
        timer = setInterval(() => { if (!st.busy && !dead && !document.hidden) refresh(false); }, 20000);
      } catch (e) { el.innerHTML = `<div class="empty" style="padding:40px;text-align:center;color:var(--sage-70,#7B887C)">${esc(e.message)}</div>`; }
    }

    async function refresh(first) {
      try {
        const d = await call('list');
        st.inbox = d.inbox || []; st.sent = d.sent || [];
        if (opts.onUnread) opts.onUnread(d.unread || 0);
        if (!dead) render(first);
      } catch (e) { if (first) el.innerHTML = `<div class="empty" style="padding:40px;text-align:center">${esc(e.message)}</div>`; }
    }

    function render() {
      if (dead) return;
      const names = new Map(st.people.map(p => [p.email, p.name]));
      el.innerHTML = `
        <div class="card"><h3>Send a file</h3>
          ${st.ready ? '' : `<p class="muted" style="margin:0 0 10px">File storage is not connected yet, so uploads will not work until it is.</p>`}
          <div class="drop" id="fs_drop"><b>Drop files here or tap to choose</b><span>Up to ${esc(sizeLabel(st.maxBytes || 21474836480))} each. Files are kept for ${st.keepDays} days.</span>
            <input type="file" id="fs_file" multiple hidden></div>
          ${st.files.length ? `<div class="picked">${st.files.map((f, i) => `<div><span class="nm">${esc(f.name)}</span><span class="muted">${esc(sizeLabel(f.size))}</span>${st.busy ? '' : `<button data-rm="${i}" type="button">Remove</button>`}</div>`).join('')}</div>` : ''}
          <div class="field" style="margin-top:16px"><label>Send to</label>
            ${st.people.length ? `<div class="who">${st.people.map(p => `<label><input type="checkbox" data-to="${esc(p.email)}"${st.chosen.has(p.email) ? ' checked' : ''}${st.busy ? ' disabled' : ''}>${esc(p.name)}</label>`).join('')}</div>
            <div class="quick"><a data-all="1">Everyone</a><a data-all="0">No one</a></div>` : `<div class="muted">No one else has this tile yet.</div>`}</div>
          <div class="field"><label>Message (optional)</label><input id="fs_note" maxlength="500" placeholder="e.g. Latest menu, please check the prices"${st.busy ? ' disabled' : ''}></div>
          ${st.progress ? `<div class="muted" style="font-size:13px">${esc(st.progress.label)}</div><div class="prog"><i style="width:${Math.round(st.progress.pct * 100)}%"></i></div>` : ''}
          <button class="btn" id="fs_send"${st.busy || !st.files.length ? ' disabled' : ''}>${st.busy ? 'Sending…' : 'Send'}</button>
        </div>
        <div class="card"><h3>Files for you${st.inbox.some(f => !f.downloaded_at) ? `<span class="new">${st.inbox.filter(f => !f.downloaded_at).length} new</span>` : ''}</h3>
          ${st.inbox.length ? st.inbox.map(f => `<div class="file"><div class="info"><div class="fn">${esc(f.name)}${f.downloaded_at ? '' : '<span class="new">New</span>'}</div>
              <div class="meta">From ${esc(f.from_name)} · ${esc(when(f.created_at))} · ${esc(sizeLabel(f.size))} · ${esc(expiry(f.expires_at))}</div>${f.note ? `<div class="note">${esc(f.note)}</div>` : ''}</div>
              <div class="acts">${f.url ? `<a class="btn" href="${esc(f.url)}" target="_blank" rel="noopener" data-dl="${esc(f.id)}">Download</a>` : ''}<button class="btn ghost small" data-hide="${esc(f.id)}">Clear</button></div></div>`).join('')
            : `<div class="muted" style="padding:6px 0">Nothing has been sent to you.</div>`}
        </div>
        <div class="card"><h3>Sent by you</h3>
          ${st.sent.length ? st.sent.map(f => `<div class="file"><div class="info"><div class="fn">${esc(f.name)}</div>
              <div class="meta">${esc(when(f.created_at))} · ${esc(sizeLabel(f.size))} · ${esc(expiry(f.expires_at))}</div>
              <div class="chips">${(f.to || []).map(r => `<span class="chip${r.downloaded_at ? ' got' : ''}" title="${r.downloaded_at ? 'Downloaded ' + esc(when(r.downloaded_at)) : 'Not downloaded yet'}">${esc(r.name || names.get(r.email) || r.email)}${r.downloaded_at ? ' &#10003;' : ''}</span>`).join('')}</div>
              ${f.note ? `<div class="note">${esc(f.note)}</div>` : ''}</div>
              <div class="acts"><button class="btn ghost small" data-del="${esc(f.id)}">Delete</button></div></div>`).join('')
            : `<div class="muted" style="padding:6px 0">You have not sent anything that is still available.</div>`}
        </div>`;
      const note = el.querySelector('#fs_note'); if (note) note.value = st.note;
      wire();
    }

    function addFiles(list) {
      for (const f of list) {
        if (!f.size) { toast(f.name + ' is empty.', true); continue; }
        if (st.maxBytes && f.size > st.maxBytes) { toast(f.name + ' is too big.', true); continue; }
        st.files.push(f);
      }
      render();
    }

    function wire() {
      const drop = el.querySelector('#fs_drop'), inp = el.querySelector('#fs_file');
      drop.onclick = () => { if (!st.busy) inp.click(); };
      inp.onchange = () => { addFiles(Array.from(inp.files)); inp.value = ''; };
      ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
      ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
      drop.addEventListener('drop', e => { if (!st.busy && e.dataTransfer && e.dataTransfer.files.length) addFiles(Array.from(e.dataTransfer.files)); });
      el.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { st.files.splice(Number(b.dataset.rm), 1); render(); });
      el.querySelectorAll('[data-to]').forEach(c => c.onchange = () => { c.checked ? st.chosen.add(c.dataset.to) : st.chosen.delete(c.dataset.to); });
      el.querySelectorAll('[data-all]').forEach(a => a.onclick = () => { st.chosen = a.dataset.all === '1' ? new Set(st.people.map(p => p.email)) : new Set(); render(); });
      el.querySelector('#fs_note').oninput = e => { st.note = e.target.value; };
      el.querySelector('#fs_send').onclick = send;
      el.querySelectorAll('[data-dl]').forEach(a => a.addEventListener('click', () => {
        call('file.downloaded', { id: a.dataset.dl }).then(d => { if (opts.onUnread && d && d.unread !== undefined) opts.onUnread(d.unread); setTimeout(() => refresh(false), 1500); }).catch(() => {});
      }));
      el.querySelectorAll('[data-hide]').forEach(b => b.onclick = async () => { try { await call('file.hide', { id: b.dataset.hide }); await refresh(false); } catch (e) { toast(e.message, true); } });
      el.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
        if (!confirm('Delete this file for everyone you sent it to?')) return;
        try { await call('file.delete', { id: b.dataset.del }); toast('Deleted.'); await refresh(false); } catch (e) { toast(e.message, true); }
      });
    }

    async function send() {
      if (!st.files.length) return;
      if (!st.chosen.size) return toast('Choose who to send it to.', true);
      const to = Array.from(st.chosen), files = st.files.slice(), total = files.length;
      st.busy = true; uploading++; render();
      let done = 0;
      try {
        for (const file of files) {
          const label = (total > 1 ? 'File ' + (done + 1) + ' of ' + total + ': ' : '') + file.name;
          st.progress = { label: 'Starting ' + label, pct: 0 }; render();
          const plan = await call('upload.start', { name: file.name, size: file.size, type: file.type || '', to, note: st.note });
          try {
            const parts = await sendParts(plan, file, pct => {
              st.progress = { label: 'Uploading ' + label + ' (' + Math.round(pct * 100) + '%)', pct };
              const bar = el.querySelector('.prog i'); if (bar) bar.style.width = Math.round(pct * 100) + '%';
              const lab = bar && bar.parentElement.previousElementSibling; if (lab) lab.textContent = st.progress.label;
            });
            st.progress = { label: 'Finishing ' + file.name, pct: 1 };
            await call('upload.complete', { id: plan.id, uploadId: plan.uploadId, ticket: plan.ticket, parts });
          } catch (e) {
            call('upload.abort', { id: plan.id, uploadId: plan.uploadId, ticket: plan.ticket }).catch(() => {});
            throw e;
          }
          done++; st.files.shift();
        }
        toast(total === 1 ? 'Sent.' : total + ' files sent.');
        st.chosen = new Set(); st.note = '';
      } catch (e) { toast(e.message || 'The upload failed.', true); }
      st.busy = false; uploading--; st.progress = null;
      await refresh(false); render();
    }

    boot();
    return { unmount() { dead = true; if (timer) clearInterval(timer); }, refresh: () => refresh(false) };
  }

  global.FileShare = { mount };
})(window);
