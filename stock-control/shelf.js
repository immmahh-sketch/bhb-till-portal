/* Count from photos (Stocktake).
   Photos or a short sweep video of a shelf -> sharp frames -> joined into one long picture of the shelf front (OpenCV.js, in the browser)
   -> the venue's Anthropic key reads it against the area's product list (stock-api vision.read) -> the PERSON ticks each line and says how many
   rows deep it goes -> each ticked line is added through count.add ("+"), with "(photo)" in the trail. The model proposes, nothing saves unticked.
   Uses globals from index.html: S, call, esc, fnum, toast, openModal, closeModal, productById, renderCount, $. */
const Shelf = (() => {
  const OPENCV = "vendor/opencv.js?v=4.9.0";
  const DETECT_W = 1000, FRAME_W = 1800, PANO_MAX = 3600, TILE_ASPECT = 1.7, MIN_INLIERS = 14;
  let cvP = null;

  /* ---------- OpenCV, loaded only when a sweep needs it (10 MB, cached after the first time) ---------- */
  function loadCv() {
    if (cvP) return cvP;
    cvP = new Promise((res, rej) => {
      const s = document.createElement("script"); s.src = OPENCV;
      s.onerror = () => { cvP = null; rej(new Error("The joining tool did not load. Check the connection and try again.")); };
      s.onload = () => {
        const ready = () => { if (window.cv && window.cv.Mat) res(window.cv); else setTimeout(ready, 50); };
        if (window.cv && typeof window.cv.then === "function") { const c = window.cv; c.then(m => { window.cv = m; delete window.cv.then; ready(); }); } else if (window.cv) { window.cv.onRuntimeInitialized = ready; ready(); } else ready();
      };
      document.head.appendChild(s);
    });
    return cvP;
  }

  /* ---------- getting frames ---------- */
  const mkCanvas = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  function fitCanvas(src, sw, sh, maxW) {
    const k = Math.min(1, maxW / Math.max(sw, sh)), c = mkCanvas(sw * k, sh * k);
    c.getContext("2d").drawImage(src, 0, 0, c.width, c.height); return c;
  }
  async function fromImage(file) {
    let bmp; try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); } catch (_) { bmp = await createImageBitmap(file); }
    const c = fitCanvas(bmp, bmp.width, bmp.height, FRAME_W); if (bmp.close) bmp.close(); return c;
  }
  /* Variance of a Laplacian on a small grey copy: bigger = sharper. Used to pick the least blurred frame in each stretch of a sweep. */
  function sharpness(canvas) {
    const c = fitCanvas(canvas, canvas.width, canvas.height, 320), w = c.width, h = c.height, d = c.getContext("2d").getImageData(0, 0, w, h).data, g = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) g[i] = d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11;
    let n = 0, sum = 0, sq = 0;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x, l = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - w] - g[i + w]; sum += l; sq += l * l; n++; }
    return n ? sq / n - (sum / n) * (sum / n) : 0;
  }
  async function fromVideo(file, want, progress) {
    const url = URL.createObjectURL(file), v = document.createElement("video");
    v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
    const once = (ev) => new Promise((res, rej) => { v.addEventListener(ev, res, { once: true }); v.addEventListener("error", () => rej(new Error("That video could not be opened.")), { once: true }); });
    try {
      if (v.readyState < 2) await once("loadeddata");
      const dur = v.duration; if (!isFinite(dur) || dur < 0.5) throw new Error("That video is too short.");
      const per = 3, total = want * per, cands = [];
      for (let k = 0; k < total; k++) {
        progress(`Looking through the video (${k + 1} of ${total})…`);
        v.currentTime = Math.min(dur - 0.05, (k + 0.5) / total * dur); await once("seeked");
        const c = fitCanvas(v, v.videoWidth, v.videoHeight, FRAME_W); cands.push({ c, s: sharpness(c) });
      }
      const out = [];
      for (let i = 0; i < want; i++) { const grp = cands.slice(i * per, i * per + per); out.push(grp.sort((a, b) => b.s - a.s)[0].c); }
      return out;
    } finally { URL.revokeObjectURL(url); }
  }

  /* ---------- joining frames ---------- */
  function features(cv, canvas) {
    const small = fitCanvas(canvas, canvas.width, canvas.height, DETECT_W), k = canvas.width / small.width;
    const src = cv.imread(small), gray = new cv.Mat(); cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY); src.delete();
    const orb = new cv.ORB(2500), kp = new cv.KeyPointVector(), desc = new cv.Mat(); orb.detectAndCompute(gray, new cv.Mat(), kp, desc);
    const pts = []; for (let i = 0; i < kp.size(); i++) { const p = kp.get(i).pt; pts.push([p.x, p.y]); }
    gray.delete(); kp.delete(); orb.delete(); return { desc, pts, k };
  }
  /* Homography taking points of frame b (in its own large-frame pixels) onto frame a, or null if they do not join. */
  function joinPair(cv, A, B) {
    if (!A.desc.rows || !B.desc.rows || A.desc.rows < 20 || B.desc.rows < 20) return null;
    const bf = new cv.BFMatcher(cv.NORM_HAMMING, false), mm = new cv.DMatchVectorVector(); bf.knnMatch(B.desc, A.desc, mm, 2);
    const src = [], dst = [];
    for (let i = 0; i < mm.size(); i++) { const m = mm.get(i); if (m.size() < 2) continue; const m0 = m.get(0), m1 = m.get(1); if (m0.distance < 0.75 * m1.distance) { src.push(B.pts[m0.queryIdx][0], B.pts[m0.queryIdx][1]); dst.push(A.pts[m0.trainIdx][0], A.pts[m0.trainIdx][1]); } }
    bf.delete(); mm.delete();
    if (src.length / 2 < MIN_INLIERS) return null;
    const s = cv.matFromArray(src.length / 2, 1, cv.CV_32FC2, src), d = cv.matFromArray(dst.length / 2, 1, cv.CV_32FC2, dst), mask = new cv.Mat();
    const H = cv.findHomography(s, d, cv.RANSAC, 4.0, mask); s.delete(); d.delete();
    let inl = 0; for (let i = 0; i < mask.rows; i++) if (mask.data[i]) inl++; mask.delete();
    if (!H || H.empty() || inl < MIN_INLIERS || inl < 0.3 * (src.length / 2)) { if (H) H.delete(); return null; }
    const h = Array.from(H.data64F); H.delete();
    // a shelf front is a flat wall: a sane join barely scales or skews, so a wild one is a false match
    const sc = Math.sqrt(Math.abs(h[0] * h[4] - h[1] * h[3]));
    if (!(sc > 0.6 && sc < 1.6) || Math.abs(h[6]) > 0.002 || Math.abs(h[7]) > 0.002) return null;
    // back from detection pixels to large-frame pixels: H_L = KA * H_S * KB^-1 (each frame was shrunk by its own factor)
    const KA = [[A.k, 0, 0], [0, A.k, 0], [0, 0, 1]], KBi = [[1 / B.k, 0, 0], [0, 1 / B.k, 0], [0, 0, 1]];
    return { H: mul(KA, mul(rows3(h), KBi)), inliers: inl };
  }
  const rows3 = (h) => [[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], h[8]]];
  const mul = (a, b) => a.map((_, i) => [0, 1, 2].map(j => a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j]));
  const apply = (M, x, y) => { const w = M[2][0] * x + M[2][1] * y + M[2][2]; return [(M[0][0] * x + M[0][1] * y + M[0][2]) / w, (M[1][0] * x + M[1][1] * y + M[1][2]) / w]; };

  async function stitch(frames, progress) {
    if (frames.length === 1) return { canvas: frames[0], used: 1, of: 1, skipped: [] };
    const cv = await loadCv(); progress("Joining the pictures together…");
    const feats = [], skipped = [], keep = [{ i: 0, M: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] }];
    try {
      feats[0] = features(cv, frames[0]);
      for (let i = 1; i < frames.length; i++) {
        progress(`Joining picture ${i + 1} of ${frames.length}…`); await new Promise(r => setTimeout(r, 0));
        feats[i] = features(cv, frames[i]);
        const last = keep[keep.length - 1], j = joinPair(cv, feats[last.i], feats[i]);
        if (!j) { skipped.push(i + 1); feats[i].desc.delete(); feats[i] = null; continue; }
        keep.push({ i, M: mul(last.M, j.H) });
      }
      if (keep.length < 2) throw new Error("The pictures would not join. Take them again with about half of each overlapping the one before, moving slowly and keeping the same distance from the shelf.");
      // bounds of everything in the first frame's coordinates
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const f of keep) { const W = frames[f.i].width, H = frames[f.i].height; for (const [x, y] of [[0, 0], [W, 0], [W, H], [0, H]]) { const [px, py] = apply(f.M, x, y); x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py); } }
      const sc = Math.min(1, PANO_MAX / Math.max(x1 - x0, y1 - y0)), PW = Math.round((x1 - x0) * sc), PH = Math.round((y1 - y0) * sc);
      if (PW < 10 || PH < 10 || PW * PH > 40e6) throw new Error("The pictures joined into something the wrong shape. Take them again, keeping the camera level.");
      const T = [[sc, 0, -x0 * sc], [0, sc, -y0 * sc], [0, 0, 1]], out = new Uint8ClampedArray(PW * PH * 4), best = new Float32Array(PW * PH);
      for (const f of keep) {
        progress(`Building the picture (${keep.indexOf(f) + 1} of ${keep.length})…`); await new Promise(r => setTimeout(r, 0));
        const fc = frames[f.i], Wf = fc.width, Hf = fc.height, M = mul(T, f.M), src = cv.imread(fc);
        const wt = new cv.Mat(Hf, Wf, cv.CV_32F); const wd = wt.data32F; for (let y = 0; y < Hf; y++) for (let x = 0; x < Wf; x++) wd[y * Wf + x] = Math.min(x + 1, Wf - x, y + 1, Hf - y);   // nearer the middle of its own frame wins
        const Mm = cv.matFromArray(3, 3, cv.CV_64F, [M[0][0], M[0][1], M[0][2], M[1][0], M[1][1], M[1][2], M[2][0], M[2][1], M[2][2]]);
        const dc = new cv.Mat(), dw = new cv.Mat(), size = new cv.Size(PW, PH);
        cv.warpPerspective(src, dc, Mm, size, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(0, 0, 0, 0));
        cv.warpPerspective(wt, dw, Mm, size, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(0));
        const cd = dc.data, ww = dw.data32F;
        for (let p = 0; p < PW * PH; p++) if (ww[p] > best[p]) { best[p] = ww[p]; out[p * 4] = cd[p * 4]; out[p * 4 + 1] = cd[p * 4 + 1]; out[p * 4 + 2] = cd[p * 4 + 2]; out[p * 4 + 3] = 255; }
        src.delete(); wt.delete(); Mm.delete(); dc.delete(); dw.delete();
      }
      const canvas = mkCanvas(PW, PH), ctx = canvas.getContext("2d"); ctx.fillStyle = "#222"; ctx.fillRect(0, 0, PW, PH); ctx.putImageData(new ImageData(out, PW, PH), 0, 0);
      return { canvas, used: keep.length, of: frames.length, skipped };
    } finally { for (const f of feats) if (f && f.desc) f.desc.delete(); }
  }

  /* One long picture is cut into overlapping pieces so the model sees each can at a readable size. */
  function tiles(canvas) {
    const a = canvas.width / canvas.height, n = a <= 2.4 ? 1 : Math.min(4, Math.ceil(a / TILE_ASPECT)), out = [];
    if (n === 1) { out.push(canvas); return out; }
    const tw = canvas.width / (n - (n - 1) * 0.25), step = tw * 0.75;
    for (let i = 0; i < n; i++) { const x = Math.min(canvas.width - tw, i * step), c = mkCanvas(tw, canvas.height); c.getContext("2d").drawImage(canvas, x, 0, tw, canvas.height, 0, 0, c.width, c.height); out.push(c); }
    return out;
  }
  const jpeg = (c) => c.toDataURL("image/jpeg", 0.86);

  /* ---------- the screens ---------- */
  const st = { area: null, frames: [], pano: null, result: null, busy: false };
  const msg = (t) => { const el = document.getElementById("shelf_msg"); if (el) el.textContent = t; };

  function open() {
    st.area = S.area; st.frames = []; st.pano = null; st.result = null;
    const a = S.areas.find(x => x.id === st.area);
    openModal(`<h2>Count from photos</h2>
      <p class="small">Area: <b>${esc(a ? a.name : "")}</b>. Take photos along the shelf, left to right, with about half of each photo overlapping the one before, or film a slow sweep. Stand at the same distance, keep the camera level, and open the fridge light.</p>
      <p class="tiny muted">The app only suggests counts. You check every line before anything is added, and nothing is saved until you press Add. Each reading costs about 1p. It counts what it can see on the front row of each shelf; you say how many rows deep.</p>
      <div class="row-actions">
        <label class="btn" style="cursor:pointer">Take or choose photos<input type="file" id="shelf_photos" accept="image/*" multiple style="display:none"></label>
        <label class="btn" style="cursor:pointer">Film or choose a video<input type="file" id="shelf_video" accept="video/*" style="display:none"></label>
        <button class="btn ghost" data-act="close">Cancel</button></div>
      <p class="small muted" id="shelf_msg" aria-live="polite" style="margin-top:12px"></p><div id="shelf_body"></div>`);
    const body = $("#modalbg");
    body.querySelector("#shelf_photos").addEventListener("change", e => run(Array.from(e.target.files || []), "photos"));
    body.querySelector("#shelf_video").addEventListener("change", e => run(Array.from(e.target.files || []), "video"));
  }

  async function run(files, kind) {
    if (!files.length || st.busy) return; st.busy = true;
    try {
      let frames = [];
      if (kind === "video") frames = await fromVideo(files[0], 8, msg);
      else { if (files.length > 12) throw new Error("Twelve photos at most. Use a video for a long run."); for (let i = 0; i < files.length; i++) { msg(`Opening photo ${i + 1} of ${files.length}…`); frames.push(await fromImage(files[i])); } }
      const r = await stitch(frames, msg); st.pano = r.canvas;
      const note = r.of > 1 ? `Joined ${r.used} of ${r.of} pictures${r.skipped.length ? ` (picture${r.skipped.length > 1 ? "s" : ""} ${r.skipped.join(", ")} would not join and ${r.skipped.length > 1 ? "were" : "was"} left out, so check the left and right ends are all there)` : ""}.` : "One photo.";
      msg(""); const thumb = fitCanvas(r.canvas, r.canvas.width, r.canvas.height, 1100).toDataURL("image/jpeg", 0.8);
      $("#shelf_body").innerHTML = `<p class="small"><b>${esc(note)}</b> This is what will be read. Look for gaps, doubled cans or a bent shelf before you go on.</p><div style="overflow-x:auto;border:1px solid var(--border,#ccc);border-radius:8px"><img src="${thumb}" alt="The shelf picture that will be read" style="display:block;max-width:none;height:200px"></div>
        <div class="row-actions" style="margin-top:12px"><button class="btn" id="shelf_read">Read this</button><button class="btn ghost" id="shelf_again">Start again</button></div>`;
      $("#shelf_read").onclick = read; $("#shelf_again").onclick = open;
    } catch (e) { msg(e.message || "That did not work."); }
    st.busy = false;
  }

  async function read() {
    const btn = $("#shelf_read"); btn.disabled = true; msg("Reading the shelf. This takes about 20 seconds…");
    try {
      const imgs = tiles(st.pano).map(jpeg);
      st.result = await call("vision.read", { area_id: st.area, images: imgs });
      msg(""); review();
    } catch (e) { msg(e.message); btn.disabled = false; }
  }

  function review() {
    const r = st.result, lines = r.lines.map(l => ({ ...l, depth: 1, on: l.confidence !== "low" }));
    st.lines = lines;
    const row = (l, i) => { const key = st.area + "|" + l.product_id, c = S.counts.get(key);
      return `<tr data-i="${i}"><td><input type="checkbox" data-t="on" ${l.on ? "checked" : ""} aria-label="Add ${esc(l.name)}"></td>
        <td>${esc(l.name)}<div class="tiny muted">${l.confidence} confidence${l.hidden_behind ? " · rows may be hidden behind" : ""}${l.note ? " · " + esc(l.note) : ""}${c ? ` · already counted ${fnum(c.units)}` : ""}</div></td>
        <td style="text-align:center">${l.visible}</td>
        <td style="white-space:nowrap"><button class="chip" data-t="dn" aria-label="One row fewer" style="min-height:34px">−</button> <b data-t="d">${l.depth}</b> <button class="chip" data-t="up" aria-label="One row more" style="min-height:34px">+</button></td>
        <td style="text-align:center"><b data-t="tot">${l.visible * l.depth}</b></td></tr>`; };
    $("#shelf_body").innerHTML = `<h3 style="margin:16px 0 6px">What it found</h3>
      <p class="tiny muted">Tick the lines that are right. <b>Seen</b> is the front row it could count. If the shelf is two or three rows deep, press + to say so. The total is added to what is already counted for this area.${r.photo_note ? `<br>Note on the photo: ${esc(r.photo_note)}` : ""}</p>
      ${lines.length ? `<div style="overflow-x:auto"><table class="tbl" style="width:100%"><thead><tr><th></th><th>Product</th><th>Seen</th><th>Rows deep</th><th>Add</th></tr></thead><tbody>${lines.map(row).join("")}</tbody></table></div>` : `<p>Nothing on the product list could be matched. Try again closer, or count by hand.</p>`}
      ${r.unlisted.length ? `<p class="tiny muted" style="margin-top:10px">Seen but not matched to your list (not added): ${r.unlisted.map(u => `${esc(u.what)} × ${u.visible}`).join("; ")}.</p>` : ""}
      <div class="row-actions" style="margin-top:12px">${lines.length ? `<button class="btn" id="shelf_add">Add ticked lines to the count</button>` : ""}<button class="btn ghost" data-act="close">Close without adding</button></div>
      <p class="tiny muted" style="margin-top:8px">${r.usage ? `Read with ${esc(r.usage.model)}.` : ""}</p>`;
    const tb = document.querySelector("#shelf_body tbody");
    if (tb) tb.addEventListener("click", e => { const b = e.target.closest("[data-t]"); if (!b) return; const tr = b.closest("tr"), l = lines[+tr.dataset.i];
      if (b.dataset.t === "up") l.depth = Math.min(10, l.depth + 1); else if (b.dataset.t === "dn") l.depth = Math.max(1, l.depth - 1); else if (b.dataset.t === "on") { l.on = b.checked; return; } else return;
      tr.querySelector('[data-t="d"]').textContent = l.depth; tr.querySelector('[data-t="tot"]').textContent = l.visible * l.depth; });
    const add = $("#shelf_add"); if (add) add.onclick = commit;
  }

  async function commit() {
    const add = $("#shelf_add"), todo = st.lines.filter(l => l.on); if (!todo.length) return toast("Tick at least one line.", true);
    add.disabled = true; let n = 0;
    try {
      for (const l of todo) {
        const r = await call("count.add", { area_id: st.area, product_id: l.product_id, loose: l.visible * l.depth, via: "photo" });
        S.counts.set(st.area + "|" + l.product_id, { area_id: st.area, product_id: l.product_id, cases: r.cases, loose: r.loose, units: r.units, trail: r.trail, counted_by: S.me.name }); n++;
      }
      closeModal(); toast(`Added ${n} product${n === 1 ? "" : "s"} to the count.`); renderCount();
    } catch (e) { toast(`${n} added, then it stopped: ${e.message}`, true); if (n) renderCount(); add.disabled = false; }
  }

  return { open, _test: { stitch, tiles, fromImage, loadCv, sharpness } };
})();
