/* Photo library - the "Photo library" tab of Marketing Actions.
 *
 *   const a = Photos.mount(element, { call, toast }); // later: a.unmount()
 *
 * Every marketing picture, searchable. The grid loads small thumbnails only; a picture opened full screen loads its screen-size copy; the original
 * downloads only when someone presses Download. Each picture has a description and search terms (written by Claude when it is added, editable by anyone).
 * Adding pictures: choose files or drop them on the page. The browser makes the thumbnail and screen-size copies and sends all three straight to the
 * picture store with links from marketing-photos-api (bootstrap, facets, list, photo.get, photo.original, tags.save, photo.retag, photo.delete,
 * upload.start, upload.complete, upload.abort). Uses the host page's .btn / .loading / .empty / .pagehead classes.
 */
(function (global) {
  'use strict';
  const CSS = `
.pl .plbar{display:flex; gap:8px 10px; align-items:center; flex-wrap:wrap; margin:0 0 12px}
.pl .plbar input[type=search],.pl .plbar select{border:1px solid var(--mist,#e7e7e7); border-radius:8px; padding:9px 12px; font-size:15px; min-height:44px; background:var(--white,#fff); max-width:100%}
.pl .plbar input[type=search]{flex:1 1 260px; min-width:0}
.pl .plbar select{flex:0 1 220px}
.pl .plchips{display:flex; gap:6px; flex-wrap:wrap; margin:0 0 12px}
.pl .plchip{border:1px solid var(--mist,#e7e7e7); background:var(--white,#fff); border-radius:999px; padding:4px 12px; cursor:pointer; font-size:13px; min-height:32px}
.pl .plchip:hover{background:var(--sage-10,#EDEFED)}
.pl .count{font-size:13px; color:var(--sage-70,#7B887C); margin:0 0 10px}
.pl .grid{display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:8px}
.pl .tile{position:relative; padding:0; border:0; background:var(--mist,#e7e7e7); border-radius:8px; overflow:hidden; cursor:pointer; aspect-ratio:1; display:block; width:100%}
.pl .tile img{width:100%; height:100%; object-fit:cover; display:block; transition:transform .2s}
.pl .tile:hover img,.pl .tile:focus-visible img{transform:scale(1.04)}
.pl .tile .cap{position:absolute; left:0; right:0; bottom:0; padding:18px 8px 6px; font-size:11px; line-height:1.25; color:#fff; text-align:left; background:linear-gradient(transparent,rgba(0,0,0,.65)); opacity:0; transition:opacity .15s}
.pl .tile:hover .cap,.pl .tile:focus-visible .cap{opacity:1}
.pl .note{background:var(--attention-bg,#F7F0E4); border-radius:8px; padding:10px 14px; margin:0 0 12px; font-size:14px}
.pl .plprog{height:8px; background:var(--mist,#e7e7e7); border-radius:4px; overflow:hidden; margin:8px 0 10px} .pl .plprog i{display:block; height:100%; background:var(--sage,#4D604F); transition:width .3s}
.pl .tile .plchk{position:absolute; top:6px; left:6px; width:24px; height:24px; border-radius:6px; border:2px solid #fff; background:rgba(0,0,0,.35); z-index:2; opacity:0; transition:opacity .12s; display:flex; align-items:center; justify-content:center}
.pl .tile:hover .plchk,.pl .tile:focus-visible .plchk,.pl .selecting .tile .plchk{opacity:1}
@media (hover:none){ .pl .tile .plchk{opacity:1} }
.pl .tile.on .plchk{background:var(--sage,#4D604F); opacity:1} .pl .tile.on .plchk::after{content:'✓'; color:#fff; font-size:15px; line-height:1}
.pl .tile.on img{outline:3px solid var(--sage,#4D604F); outline-offset:-3px; opacity:.85}
.pl .plsel{position:sticky; top:0; z-index:5; display:flex; gap:8px; align-items:center; flex-wrap:wrap; background:var(--white,#fff); border:1px solid var(--sage,#4D604F); border-radius:10px; padding:8px 12px; margin:0 0 10px; box-shadow:var(--shadow)}
.pl .plsel b{margin-right:6px}
.pl .more{text-align:center; margin:18px 0}
.pl .drop{border:2px dashed var(--sage-70,#7B887C); border-radius:10px; padding:26px 16px; text-align:center; color:var(--sage-70,#7B887C); margin:0 0 14px; background:var(--white,#fff)}
.pl .drop.over{background:var(--sage-10,#EDEFED); border-color:var(--sage,#4D604F); color:var(--sage,#4D604F)}
.pl .up{background:var(--white,#fff); border-radius:10px; box-shadow:var(--shadow); padding:14px 16px; margin:0 0 14px}
.pl .up h3{margin:0 0 8px; font-size:20px; color:var(--sage,#4D604F)}
.pl .up .row{display:flex; gap:8px 12px; align-items:center; flex-wrap:wrap; margin:0 0 10px}
.pl .up input[type=text]{border:1px solid var(--mist,#e7e7e7); border-radius:8px; padding:9px 12px; font-size:15px; min-height:40px; flex:1 1 220px; min-width:0}
.pl .up ul{list-style:none; margin:0; padding:0; max-height:260px; overflow-y:auto; font-size:13px}
.pl .up li{display:flex; gap:10px; padding:4px 0; border-top:1px solid var(--mist,#e7e7e7)}
.pl .up li span:first-child{flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap}
.pl .up li .ok{color:var(--sage,#4D604F)} .pl .up li .bad{color:var(--alert,#8C4A3F)} .pl .up li .dup{color:var(--attention,#B08D57)}
.pl-lb{position:fixed; inset:0; z-index:400; background:rgba(20,20,20,.92); display:flex; flex-direction:column}
.pl-lb .top{display:flex; align-items:center; gap:10px; padding:10px 14px; color:#fff; flex:none}
.pl-lb .top .nm{flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:14px}
.pl-lb .top button{background:rgba(255,255,255,.12); color:#fff; border:0; border-radius:8px; padding:8px 14px; cursor:pointer; font-size:13px; min-height:40px}
.pl-lb .top button:hover{background:rgba(255,255,255,.22)}
.pl-lb .main{flex:1 1 auto; min-height:0; display:flex; gap:0}
.pl-lb .stage{flex:1 1 auto; min-width:0; display:flex; align-items:center; justify-content:center; position:relative; padding:0 10px}
.pl-lb .stage img{max-width:100%; max-height:100%; object-fit:contain; display:block}
.pl-lb .stage .spin{position:absolute; color:#fff; font-size:13px}
.pl-lb .nav{position:absolute; top:50%; transform:translateY(-50%); background:rgba(255,255,255,.14); color:#fff; border:0; border-radius:50%; width:44px; height:44px; font-size:22px; cursor:pointer}
.pl-lb .nav.l{left:8px} .pl-lb .nav.r{right:8px} .pl-lb .nav:hover{background:rgba(255,255,255,.28)}
.pl-lb .side{flex:none; width:340px; max-width:42vw; background:var(--white,#fff); overflow-y:auto; padding:16px; font-size:14px}
.pl-lb .side h4{margin:0 0 4px; font-size:10px; letter-spacing:var(--track-label,.18em); text-transform:uppercase; color:var(--sage-70,#7B887C); font-weight:600}
.pl-lb .side .blk{margin:0 0 14px}
.pl-lb .side .meta{font-size:12px; color:var(--sage-70,#7B887C)}
.pl-lb .tags{display:flex; gap:5px; flex-wrap:wrap; margin:0 0 6px}
.pl-lb .tg{display:inline-flex; align-items:center; gap:4px; background:var(--sage-10,#EDEFED); border-radius:999px; padding:3px 6px 3px 10px; font-size:13px}
.pl-lb .tg button{border:0; background:none; cursor:pointer; color:var(--sage-70,#7B887C); font-size:15px; line-height:1; padding:0 4px}
.pl-lb .side input[type=text],.pl-lb .side textarea{width:100%; border:1px solid var(--mist,#e7e7e7); border-radius:8px; padding:8px 10px; font-size:14px; background:var(--white,#fff)}
.pl-lb .side textarea{min-height:58px; resize:vertical}
.pl-lb .side .btns{display:flex; gap:8px; flex-wrap:wrap}
@media (max-width:760px){
  .pl .grid{grid-template-columns:repeat(auto-fill,minmax(110px,1fr)); gap:6px}
  .pl-lb .main{flex-direction:column}
  .pl-lb .side{width:auto; max-width:none; max-height:44vh}
  .pl-lb .nav{width:38px; height:38px}
}
`;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const when = t => { const d = new Date(t); return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };
  const mb = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  const hex = buf => [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('');
  const IMG = /^image\/(jpeg|png|webp|gif|avif|bmp)$/i;

  function mount(el, ctx) {
    if (!document.getElementById('pl-css')) { const s = document.createElement('style'); s.id = 'pl-css'; s.textContent = CSS; document.head.appendChild(s); }
    const st = { dead: false, boot: null, photos: [], total: 0, q: '', folder: '', sort: 'new', shelf: false, scan: null, sel: new Set(), selAll: false, lastSel: -1, bulkBusy: false, untagged: false, loading: false, seq: 0, lb: null, uploads: [], showUp: false, upFolder: 'Uploads' };
    el.innerHTML = `<div class="pl"><div class="loading">Loading the library…</div></div>`;
    let lbEl = null, keyFn = null, searchTimer = null;

    const post = (action, extra) => ctx.call(action, extra);

    // ------------------------------------------------------------ loading
    async function boot() {
      try { st.boot = await post('bootstrap'); } catch (e) { if (!st.dead) el.innerHTML = `<div class="pl"><div class="empty">${esc(e.message)}</div></div>`; return; }
      if (st.dead) return;
      draw(); await load(true);
    }
    async function load(reset) {
      const seq = ++st.seq; st.loading = true;
      if (reset) { st.photos = []; st.sel.clear(); st.selAll = false; st.lastSel = -1; }
      try {
        const r = await post('list', { q: st.q, folder: st.folder, sort: st.sort, shelf: st.shelf ? 'only' : 'main', untagged: st.untagged, offset: reset ? 0 : st.photos.length });
        if (st.dead || seq !== st.seq) return;
        st.photos = reset ? r.photos : st.photos.concat(r.photos); st.total = r.total;
      } catch (e) { if (!st.dead && seq === st.seq) ctx.toast(e.message, true); }
      st.loading = false; if (!st.dead && seq === st.seq) drawGrid();
    }
    async function refreshFacets() { try { const f = await post('facets'); st.boot.folders = f.folders; st.boot.tags = f.tags; st.boot.shelved = f.shelved; st.boot.total = f.folders.reduce((n, x) => n + x.n, 0); } catch (e) { /* the chips just stay as they were */ } }

    // ------------------------------------------------------------ page
    const folderOptions = () => {
      // every folder and parent folder, with a count that includes its sub-folders
      const all = st.boot.folders;
      const names = [...new Set(all.flatMap(f => { const ps = f.folder ? f.folder.split('/') : []; return ps.map((_, i) => ps.slice(0, i + 1).join('/')); }))].sort((a, b) => a.localeCompare(b));
      return names.map(n => ({ folder: n, n: all.filter(f => f.folder === n || f.folder.startsWith(n + '/')).reduce((s, f) => s + f.n, 0) }));
    };
    const folderLabel = f => '   '.repeat(f.folder.split('/').length - 1) + f.folder.split('/').pop() + ' (' + f.n + ')';
    function draw() {
      if (st.dead || !st.boot) return;
      const fo = folderOptions();
      el.innerHTML = `<div class="pl">
        <div class="pagehead"><h2>Photo library</h2></div>
        <div class="plbar">
          <input type="search" id="plQ" placeholder="Search pictures: e.g. marquee wedding night, afternoon tea, christmas tree" value="${esc(st.q)}" aria-label="Search pictures">
          <select id="plF" aria-label="Folder"><option value="">All folders (${st.boot.total})</option>${fo.map(f => `<option value="${esc(f.folder)}" ${st.folder === f.folder ? 'selected' : ''}>${esc(folderLabel(f))}</option>`).join('')}</select>
          <select id="plS" aria-label="Order"><option value="new" ${st.sort === 'new' ? 'selected' : ''}>Newest first</option><option value="name" ${st.sort === 'name' ? 'selected' : ''}>Name A to Z</option></select>
          <button class="btn ghost" id="plShelf" aria-pressed="${st.shelf}">${st.shelf ? 'Back to the library' : 'Unlikely to be used again (' + (st.boot.shelved || 0) + ')'}</button>
          ${st.boot.ai ? `<button class="btn ghost" id="plScan" ${st.scan && st.scan.running ? 'disabled' : ''}>Re-scan for unlikely pictures</button>` : ''}
          <button class="btn" id="plAdd">Add pictures</button>
        </div>
        <div id="plScanBox">${scanPanel()}</div>
        ${st.shelf ? `<div class="note">These pictures are hidden from the main library because they are unlikely to be used again (old event posters, past offers, scans and so on). Open one to bring it back, or to delete it for good. Nothing here shows in searches of the main library.</div>` : ''}
        ${st.boot.tags.length ? `<div class="plchips" id="plChips">${st.boot.tags.slice(0, 24).map(t => `<button class="plchip" data-tag="${esc(t.tag)}">${esc(t.tag)}</button>`).join('')}</div>` : ''}
        ${st.showUp ? uploadPanel() : ''}
        <div id="plGrid"></div></div>`;
      const q = s => el.querySelector(s);
      const qi = q('#plQ');
      qi.oninput = () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { st.q = qi.value.trim(); load(true); }, 280); };
      q('#plF').onchange = e => { st.folder = e.target.value; load(true); };
      q('#plS').onchange = e => { st.sort = e.target.value; load(true); };
      q('#plAdd').onclick = () => { st.showUp = !st.showUp; draw(); };
      const sc = q('#plScan'); if (sc) sc.onclick = startScan;
      wireScan();
      q('#plShelf').onclick = () => { st.shelf = !st.shelf; st.showUp = false; draw(); load(true); };
      el.querySelectorAll('[data-tag]').forEach(b => b.onclick = () => { st.q = b.dataset.tag; qi.value = st.q; load(true); });
      wireUpload();
      drawGrid();
    }
    function drawGrid() {
      if (st.dead) return;
      const g = el.querySelector('#plGrid'); if (!g) return;
      if (!st.photos.length && st.loading) { g.innerHTML = `<div class="loading">Searching…</div>`; return; }
      if (!st.photos.length) { g.innerHTML = `<div class="empty">${st.shelf ? 'Nothing here. Pictures put in "Unlikely to be used again" show up in this list.' : st.boot.total ? 'No pictures match that. Try fewer or simpler words.' : 'No pictures yet. Press Add pictures to put the first ones in.'}</div>`; return; }
      g.innerHTML = `<div class="count">${st.total.toLocaleString('en-GB')} ${st.total === 1 ? 'picture' : 'pictures'}${st.q || st.folder ? ' found' : ''}</div>
        <div id="plSelBar">${selBar()}</div>
        <div class="grid">${st.photos.map((p, i) => `<button class="tile${st.sel.has(p.id) ? ' on' : ''}" data-i="${i}" title="${esc(p.name)}"><span class="plchk" data-chk="${i}" role="checkbox" aria-checked="${st.sel.has(p.id)}" aria-label="Select ${esc(p.name)}"></span><img loading="lazy" decoding="async" src="${esc(p.thumb || '')}" alt="${esc(p.caption || p.name)}"><span class="cap">${esc(p.caption || p.name)}</span></button>`).join('')}</div>
        ${st.photos.length < st.total ? `<div class="more"><button class="btn ghost" id="plMore">${st.loading ? 'Loading…' : 'Show more'}</button></div>` : ''}`;
      g.querySelectorAll('.tile').forEach(b => b.onclick = e => {
        const i = +b.dataset.i;
        if (e.target.closest('[data-chk]') || st.sel.size) { e.preventDefault(); toggleSel(i, e.shiftKey); } else openLb(i);
      });
      const m = g.querySelector('#plMore'); if (m) m.onclick = () => { if (!st.loading) { m.textContent = 'Loading…'; load(false); } };
      g.querySelectorAll('img').forEach(im => im.onerror = () => { im.onerror = null; im.style.opacity = '.25'; });
    }

    // ------------------------------------------------------------ selecting several pictures and acting on them together
    function selBar() {
      const n = st.selAll ? st.total : st.sel.size; if (!n) return '';
      const loaded = st.photos.length, canAll = !st.selAll && st.total > loaded;
      return `<div class="plsel"><b>${n.toLocaleString('en-GB')} selected</b>
        <button class="btn ghost small" id="plSelLoaded">Select all ${loaded.toLocaleString('en-GB')} shown</button>
        ${canAll ? `<button class="btn ghost small" id="plSelAll">Select all ${st.total.toLocaleString('en-GB')} matching</button>` : ''}
        <button class="btn ghost small" id="plSelShelve" ${st.bulkBusy ? 'disabled' : ''}>${st.shelf ? 'Bring back to the library' : 'Unlikely to be used again'}</button>
        <button class="btn danger small" id="plSelDel" ${st.bulkBusy ? 'disabled' : ''}>Delete</button>
        <button class="btn ghost small" id="plSelClear">Clear</button></div>`;
    }
    function paintSel() {
      const b = el.querySelector('#plSelBar'); if (!b) return; b.innerHTML = selBar();
      el.querySelectorAll('.tile').forEach((t, i) => { const p = st.photos[i]; const on = st.selAll || (p && st.sel.has(p.id)); t.classList.toggle('on', !!on); const c = t.querySelector('[data-chk]'); if (c) c.setAttribute('aria-checked', String(!!on)); });
      el.querySelector('#plGrid').classList.toggle('selecting', !!(st.selAll || st.sel.size));
      const q = s => b.querySelector(s);
      const a = q('#plSelLoaded'); if (a) a.onclick = () => { st.selAll = false; st.photos.forEach(p => st.sel.add(p.id)); paintSel(); };
      const m = q('#plSelAll'); if (m) m.onclick = () => { st.selAll = true; st.photos.forEach(p => st.sel.add(p.id)); paintSel(); };
      const c = q('#plSelClear'); if (c) c.onclick = () => { st.sel.clear(); st.selAll = false; paintSel(); };
      const sh = q('#plSelShelve'); if (sh) sh.onclick = () => bulk(st.shelf ? 'unshelve' : 'shelve');
      const d = q('#plSelDel'); if (d) d.onclick = () => {
        const n = st.selAll ? st.total : st.sel.size;
        if (!d.dataset.sure) { d.dataset.sure = '1'; d.textContent = 'Delete ' + n.toLocaleString('en-GB') + ' pictures? Tap again'; setTimeout(() => { if (d.isConnected) { delete d.dataset.sure; d.textContent = 'Delete'; } }, 5000); return; }
        bulk('delete');
      };
    }
    function toggleSel(i, range) {
      const p = st.photos[i]; if (!p) return;
      if (st.selAll) { st.selAll = false; st.sel.clear(); }                     // changing the pick after "select all matching" starts a normal pick again
      if (range && st.lastSel >= 0) { const a = Math.min(st.lastSel, i), b = Math.max(st.lastSel, i); for (let k = a; k <= b; k++) st.sel.add(st.photos[k].id); }
      else if (st.sel.has(p.id)) st.sel.delete(p.id); else st.sel.add(p.id);
      st.lastSel = i; paintSel();
    }
    async function bulk(op) {
      if (st.bulkBusy) return; st.bulkBusy = true; paintSel();
      const all = st.selAll, n = all ? st.total : st.sel.size;
      try {
        const body = all ? { op, all_matching: true, q: st.q, folder: st.folder, shelf: st.shelf ? 'only' : 'main', untagged: st.untagged } : { op, ids: [...st.sel] };
        let done = 0, skipped = 0;
        if (all || st.sel.size <= 500) { const r = await post('photos.bulk', body); done = r.done; skipped = r.skipped; }
        else { const ids = [...st.sel]; for (let i = 0; i < ids.length; i += 500) { const r = await post('photos.bulk', { op, ids: ids.slice(i, i + 500) }); done += r.done; skipped += r.skipped; } }
        ctx.toast(op === 'delete' ? done + (done === 1 ? ' picture deleted.' : ' pictures deleted.') + (skipped ? ' ' + skipped + ' not yours to delete were left.' : '')
          : op === 'shelve' ? done + ' moved to Unlikely to be used again.' : done + ' brought back to the library.');
      } catch (e) { ctx.toast(e.message, true); }
      st.bulkBusy = false; st.sel.clear(); st.selAll = false; st.lastSel = -1;
      await refreshFacets(); if (st.dead) return; draw(); await load(true);
    }

    // ------------------------------------------------------------ re-scan: Claude looks again at the main library and shelves what is unlikely to be used again
    function scanPanel() {
      const c = st.scan; if (!c) return '';
      const pct = c.total ? Math.min(100, Math.round(c.checked / c.total * 100)) : 100;
      return `<div class="up"><h3>${c.running ? 'Re-scanning the library…' : c.stopped ? 'Re-scan stopped' : 'Re-scan finished'}</h3>
        <div class="meta">${c.checked.toLocaleString('en-GB')} of ${c.total.toLocaleString('en-GB')} pictures checked · ${c.moved.length} moved to Unlikely to be used again${c.failed ? ' · ' + c.failed + ' could not be read' : ''}</div>
        ${c.running ? `<div class="plprog"><i style="width:${pct}%"></i></div><button class="btn ghost small" id="plScanStop">Stop</button>` : `<button class="btn ghost small" id="plScanClose">Close</button>`}
        ${c.moved.length ? `<ul>${c.moved.slice(-40).reverse().map(m => `<li><span>${esc(m.name)}</span><span class="dup">${esc(m.reason || '')}</span></li>`).join('')}</ul>` : ''}</div>`;
    }
    function wireScan() {
      const b = el.querySelector('#plScanBox'); if (!b) return;
      const x = b.querySelector('#plScanStop'); if (x) x.onclick = () => { if (st.scan) st.scan.cancel = true; };
      const c = b.querySelector('#plScanClose'); if (c) c.onclick = () => { st.scan = null; const bx = el.querySelector('#plScanBox'); if (bx) bx.innerHTML = ''; };
    }
    function paintScan() { const b = el.querySelector('#plScanBox'); if (b) { b.innerHTML = scanPanel(); wireScan(); } const sb = el.querySelector('#plScan'); if (sb) sb.disabled = !!(st.scan && st.scan.running); }
    async function startScan() {
      if (st.scan && st.scan.running) return;
      st.scan = { running: true, cancel: false, stopped: false, checked: 0, total: 0, failed: 0, moved: [], after: '' };
      paintScan();
      const sc = st.scan;
      try {
        for (;;) {
          if (st.dead) return;
          if (sc.cancel) { sc.stopped = true; break; }
          const r = await post('rescan.batch', { after: sc.after, limit: 8 });
          if (st.dead) return;
          if (r.total != null) sc.total = r.total;
          sc.checked += r.checked; sc.failed += r.failed; sc.moved = sc.moved.concat(r.moved); sc.after = r.next;
          if (sc.total < sc.checked) sc.total = sc.checked;
          paintScan();
          if (r.done) break;
        }
      } catch (e) { ctx.toast(e.message, true); sc.stopped = true; }
      sc.running = false; paintScan();
      ctx.toast(sc.moved.length ? sc.moved.length + ' ' + (sc.moved.length === 1 ? 'picture' : 'pictures') + ' moved to Unlikely to be used again.' : 'Nothing new to move.');
      await refreshFacets(); if (!st.dead && !st.scan.running) { const keep = st.scan; draw(); st.scan = keep; paintScan(); await load(true); }
    }

    // ------------------------------------------------------------ one picture, full screen
    function openLb(i) {
      closeLb();
      st.lb = { i, web: {}, edit: null };
      lbEl = document.createElement('div'); lbEl.className = 'pl-lb'; lbEl.setAttribute('role', 'dialog'); lbEl.setAttribute('aria-modal', 'true');
      document.body.appendChild(lbEl);
      keyFn = e => { if (e.key === 'Escape') closeLb(); else if (e.key === 'ArrowLeft') step(-1); else if (e.key === 'ArrowRight') step(1); };
      document.addEventListener('keydown', keyFn);
      drawLb(); ensureWeb();
    }
    function closeLb() { if (keyFn) document.removeEventListener('keydown', keyFn); keyFn = null; if (lbEl) lbEl.remove(); lbEl = null; st.lb = null; }
    function step(d) {
      if (!st.lb) return; const n = st.lb.i + d; if (n < 0 || n >= st.photos.length) return;
      st.lb.i = n; drawLb(); ensureWeb();
      if (n >= st.photos.length - 6 && st.photos.length < st.total && !st.loading) load(false);
    }
    async function ensureWeb() {
      const lb = st.lb; if (!lb) return; const p = st.photos[lb.i]; if (!p || lb.web[p.id]) return;
      try { const r = await post('photo.get', { id: p.id }); if (st.dead || !st.lb) return; lb.web[p.id] = r.photo.web || p.thumb; Object.assign(p, r.photo, { thumb: p.thumb }); }
      catch (e) { lb.web[p.id] = p.thumb; ctx.toast(e.message, true); }
      if (st.lb === lb && st.photos[lb.i] && st.photos[lb.i].id === p.id) drawLb();
    }
    function drawLb() {
      const lb = st.lb; if (!lb || !lbEl) return; const p = st.photos[lb.i]; if (!p) { closeLb(); return; }
      const web = lb.web[p.id];
      const keepNote = lbEl.querySelector('#plCap') ? lbEl.querySelector('#plCap').value : null;
      lbEl.innerHTML = `<div class="top"><span class="nm">${esc(p.name)}</span><span class="meta" style="color:#bbb;font-size:12px">${lb.i + 1} of ${st.photos.length}${st.total > st.photos.length ? ' loaded' : ''}</span><button id="plDl">Download original</button><button id="plX" aria-label="Close">Close</button></div>
        <div class="main"><div class="stage">${web ? `<img src="${esc(web)}" alt="${esc(p.caption || p.name)}">` : `<span class="spin">Opening…</span>`}
          ${lb.i > 0 ? `<button class="nav l" id="plPrev" aria-label="Previous">&#8249;</button>` : ''}${lb.i < st.photos.length - 1 ? `<button class="nav r" id="plNext" aria-label="Next">&#8250;</button>` : ''}</div>
        <div class="side">
          <div class="blk"><h4>Description</h4><textarea id="plCap" maxlength="200">${esc(keepNote != null ? keepNote : p.caption || '')}</textarea></div>
          <div class="blk"><h4>Search terms</h4><div class="tags">${(p.tags || []).map((t, k) => `<span class="tg">${esc(t)}<button data-rm="${k}" aria-label="Remove ${esc(t)}">&times;</button></span>`).join('') || '<span class="meta">None yet</span>'}</div>
            <input type="text" id="plTag" placeholder="Add a term and press Enter" maxlength="40"></div>
          <div class="blk"><h4>Folder</h4><input type="text" id="plFold" value="${esc(p.folder || '')}" maxlength="200" placeholder="e.g. Weddings/2025"></div>
          ${p.shelved ? `<div class="blk"><h4>Unlikely to be used again</h4><div class="meta">${p.shelved_auto ? 'Moved here automatically: ' : 'Put here: '}${esc(p.shelved_reason || '')}</div></div>` : ''}
          <div class="blk btns"><button class="btn small" id="plSave">Save changes</button><button class="btn ghost small" id="plShelve">${p.shelved ? 'Bring back to the library' : 'Unlikely to be used again'}</button>${st.boot.ai ? `<button class="btn ghost small" id="plAi">Suggest terms again</button>` : ''}${p.can_delete ? `<button class="btn danger small" id="plDel">Delete</button>` : ''}</div>
          <div class="meta">${p.width && p.height ? p.width + ' x ' + p.height + ' px · ' : ''}${p.bytes ? mb(p.bytes) + ' · ' : ''}added ${when(p.added_at)}${p.added_by && p.added_by.indexOf('@') > 0 ? ' by ' + esc(p.added_by.split('@')[0]) : ''}</div>
        </div></div>`;
      const q = s => lbEl.querySelector(s);
      q('#plX').onclick = closeLb;
      const pv = q('#plPrev'); if (pv) pv.onclick = () => step(-1); const nx = q('#plNext'); if (nx) nx.onclick = () => step(1);
      q('#plDl').onclick = async e => {
        const b = e.currentTarget; b.disabled = true; b.textContent = 'Preparing…';
        try { const r = await post('photo.original', { id: p.id }); const a = document.createElement('a'); a.href = r.url; a.download = r.name || p.name; document.body.appendChild(a); a.click(); a.remove(); }
        catch (err) { ctx.toast(err.message, true); }
        b.disabled = false; b.textContent = 'Download original';
      };
      lbEl.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { p.tags = p.tags.filter((_, k) => k !== +b.dataset.rm); drawLb(); });
      const ti = q('#plTag');
      ti.onkeydown = e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); e.stopPropagation(); const v = ti.value.trim().toLowerCase(); if (v && !p.tags.includes(v)) { p.tags = p.tags.concat(v); const cap = q('#plCap').value; drawLb(); q('#plCap').value = cap; lbEl.querySelector('#plTag').focus(); } else ti.value = ''; } };
      ti.onfocus = () => { }; q('#plCap').onkeydown = e => e.stopPropagation(); q('#plFold').onkeydown = e => e.stopPropagation(); ti.addEventListener('keydown', e => e.stopPropagation());
      q('#plSave').onclick = async e => {
        const b = e.currentTarget; b.disabled = true;
        const typed = ti.value.trim().toLowerCase(); const tags = typed && !p.tags.includes(typed) ? p.tags.concat(typed) : p.tags;
        try { const r = await post('tags.save', { id: p.id, caption: q('#plCap').value, tags, folder: q('#plFold').value }); Object.assign(p, r.photo, { thumb: p.thumb, web: undefined }); ctx.toast('Saved.'); drawLb(); refreshFacets(); }
        catch (err) { b.disabled = false; ctx.toast(err.message, true); }
      };
      q('#plShelve').onclick = async e => {
        const b = e.currentTarget; b.disabled = true;
        try {
          await post('photo.shelve', { id: p.id, shelve: !p.shelved });
          const was = p.shelved; st.photos.splice(lb.i, 1); st.total--; st.boot.shelved = (st.boot.shelved || 0) + (was ? -1 : 1);
          ctx.toast(was ? 'Back in the library.' : 'Moved to Unlikely to be used again.');
          if (!st.photos.length) closeLb(); else { lb.i = Math.min(lb.i, st.photos.length - 1); drawLb(); ensureWeb(); }
          drawGrid(); const sb = el.querySelector('#plShelf'); if (sb && !st.shelf) sb.textContent = 'Unlikely to be used again (' + st.boot.shelved + ')'; refreshFacets();
        } catch (err) { b.disabled = false; ctx.toast(err.message, true); }
      };
      const ai = q('#plAi'); if (ai) ai.onclick = async () => { ai.disabled = true; ai.textContent = 'Looking…'; try { const r = await post('photo.retag', { id: p.id }); Object.assign(p, r.photo, { thumb: p.thumb, web: undefined }); ctx.toast('Terms updated.'); drawLb(); refreshFacets(); } catch (err) { ai.disabled = false; ai.textContent = 'Suggest terms again'; ctx.toast(err.message, true); } };
      const dl = q('#plDel'); if (dl) dl.onclick = async () => {
        if (!dl.dataset.sure) { dl.dataset.sure = '1'; dl.textContent = 'Tap again to delete'; setTimeout(() => { if (dl.isConnected) { delete dl.dataset.sure; dl.textContent = 'Delete'; } }, 4000); return; }
        try { await post('photo.delete', { id: p.id }); st.photos.splice(lb.i, 1); st.total--; if (st.shelf) st.boot.shelved = Math.max(0, (st.boot.shelved || 0) - 1); else st.boot.total--; ctx.toast('Deleted.'); if (!st.photos.length) { closeLb(); } else { lb.i = Math.min(lb.i, st.photos.length - 1); drawLb(); ensureWeb(); } drawGrid(); refreshFacets(); }
        catch (err) { ctx.toast(err.message, true); }
      };
    }

    // ------------------------------------------------------------ adding pictures
    function uploadPanel() {
      const names = st.boot.folders.map(f => f.folder).filter(Boolean);
      const busy = st.uploads.some(u => u.state === 'wait' || u.state === 'work');
      return `<div class="up"><h3>Add pictures</h3>
        <div class="row"><input type="text" id="plUpF" list="plFolders" value="${esc(st.upFolder)}" maxlength="200" placeholder="Folder, e.g. Weddings/2025" aria-label="Folder for these pictures"><datalist id="plFolders">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
          <button class="btn" id="plPick" ${busy ? 'disabled' : ''}>Choose pictures</button><input type="file" id="plFiles" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple hidden>
          <button class="btn" id="plPickDir" ${busy ? 'disabled' : ''}>Choose a folder</button><input type="file" id="plDir" webkitdirectory multiple hidden></div>
        <div class="drop" id="plDrop">Or drop pictures or whole folders here. They are filed in the folder above and given search terms automatically. A folder keeps its own name and sub-folders inside it (clear the box above to file it at the top level); anything that is not a picture is skipped. Photos from a phone or camera as JPEG are best (iPhone photos set to "Most Compatible").</div>
        ${st.uploads.length ? `<ul>${st.uploads.map(u => `<li><span>${esc(u.name)}</span><span class="${u.state === 'done' ? 'ok' : u.state === 'dup' ? 'dup' : u.state === 'err' ? 'bad' : ''}">${esc(u.msg)}</span></li>`).join('')}</ul>` : ''}</div>`;
    }
    function wireUpload() {
      const q = s => el.querySelector(s); if (!q('#plPick')) return;
      q('#plUpF').oninput = e => { st.upFolder = e.target.value; };
      q('#plPick').onclick = () => q('#plFiles').click();
      q('#plFiles').onchange = e => { addFiles([...e.target.files]); e.target.value = ''; };
      q('#plPickDir').onclick = () => q('#plDir').click();
      q('#plDir').onchange = e => { addFiles([...e.target.files].map(f => ({ file: f, rel: f.webkitRelativePath || '' })), true); e.target.value = ''; };
      const d = q('#plDrop');
      ['dragenter', 'dragover'].forEach(n => d.addEventListener(n, e => { e.preventDefault(); d.classList.add('over'); }));
      ['dragleave', 'drop'].forEach(n => d.addEventListener(n, e => { e.preventDefault(); d.classList.remove('over'); }));
      d.addEventListener('drop', async e => {
        const items = [...(e.dataTransfer.items || [])].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
        if (items.some(x => x.isDirectory)) { const found = []; for (const en of items) await walk(en, '', found); addFiles(found, true); }
        else addFiles([...(e.dataTransfer.files || [])]);
      });
    }
    function redrawUploads() { if (st.dead) return; const box = el.querySelector('.up'); if (!box) return; const y = box.scrollTop; const fresh = document.createElement('div'); fresh.innerHTML = uploadPanel(); box.replaceWith(fresh.firstElementChild); wireUpload(); }
    let running = 0;
    // a dropped folder: read every file in it and its sub-folders (readEntries hands back at most ~100 at a time)
    async function walk(en, path, out) {
      if (en.isFile) { const f = await new Promise(res => en.file(res, () => res(null))); if (f) out.push({ file: f, rel: path + en.name }); return; }
      const rd = en.createReader(); let batch;
      do { batch = await new Promise(res => rd.readEntries(res, () => res([]))); for (const c of batch) await walk(c, path + en.name + '/', out); } while (batch.length);
    }
    function addFiles(files, fromFolder) {
      let skipped = 0;
      for (const it of files) {
        const f = fromFolder ? it.file : it;
        // folder name = the box above + the picture's own folders; the picture's file name is dropped from the path
        const rel = fromFolder ? it.rel.split('/').slice(0, -1).join('/') : '';
        if (fromFolder && !IMG.test(f.type || '')) { skipped++; continue; }          // videos, Thumbs.db, documents... in a folder are simply left out
        const base = (st.upFolder || '').trim().replace(/^\/+|\/+$/g, '');
        const u = { name: f.name, file: f, state: 'wait', msg: 'Waiting…', folder: [base, rel].filter(Boolean).join('/') };
        if (!IMG.test(f.type || '')) { u.state = 'err'; u.msg = 'Not a picture this page can read. Save it as JPEG first.'; }
        st.uploads.push(u);
      }
      if (skipped) ctx.toast(skipped + ' file' + (skipped === 1 ? '' : 's') + ' in the folder ' + (skipped === 1 ? 'was' : 'were') + ' not pictures and skipped.');
      redrawUploads(); pump();
    }
    function pump() {
      while (running < 2) {
        const u = st.uploads.find(x => x.state === 'wait'); if (!u) break;
        u.state = 'work'; running++;
        sendOne(u).catch(e => { u.state = 'err'; u.msg = e.message || 'Failed'; }).finally(() => { running--; u.file = null; redrawUploads(); pump(); if (!st.uploads.some(x => x.state === 'wait' || x.state === 'work')) finishBatch(); });
      }
    }
    async function finishBatch() { await refreshFacets(); if (!st.dead) { draw(); await load(true); } }
    const put = async (url, buf) => { const r = await fetch(url, { method: 'PUT', body: buf }); if (!r.ok) throw new Error('The picture store refused the upload (' + r.status + ').'); };
    async function resized(bmp, longest, quality) {
      const k = Math.min(1, longest / Math.max(bmp.width, bmp.height)), w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
      const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(bmp, 0, 0, w, h);
      const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', quality)); if (!blob) throw new Error('Could not make a smaller copy of this picture.');
      return blob.arrayBuffer();
    }
    async function sendOne(u) {
      const f = u.file; u.msg = 'Reading…'; redrawUploads();
      const orig = await f.arrayBuffer();
      const sha = hex(await crypto.subtle.digest('SHA-256', orig));
      let bmp; try { bmp = await createImageBitmap(new Blob([orig], { type: f.type }), { imageOrientation: 'from-image' }); } catch (e) { throw new Error('This browser cannot open that picture. Save it as JPEG and try again.'); }
      u.msg = 'Checking…'; redrawUploads();
      const s = await post('upload.start', { name: f.name, size: f.size, type: f.type, folder: u.folder, sha256: sha });
      if (s.duplicate) { u.state = 'dup'; u.msg = 'Already in the library' + (s.folder ? ' (' + s.folder + ')' : ''); bmp.close && bmp.close(); return; }
      try {
        u.msg = 'Uploading…'; redrawUploads();
        const [thumb, web] = await Promise.all([resized(bmp, 480, 0.8), resized(bmp, 1600, 0.82)]);
        await Promise.all([put(s.put.thumb, thumb), put(s.put.web, web), put(s.put.orig, orig)]);
        u.msg = 'Adding search terms…'; redrawUploads();
        const r = await post('upload.complete', { id: s.id, sha256: sha, width: bmp.width, height: bmp.height });
        if (r.duplicate) { u.state = 'dup'; u.msg = 'Already in the library'; } else { u.state = 'done'; u.msg = 'Added'; }
      } catch (e) { post('upload.abort', { id: s.id }).catch(() => { }); throw e; }
      finally { bmp.close && bmp.close(); }
    }

    boot();
    return { unmount() { st.dead = true; clearTimeout(searchTimer); closeLb(); el.innerHTML = ''; } };
  }
  global.Photos = { mount };
})(window);
