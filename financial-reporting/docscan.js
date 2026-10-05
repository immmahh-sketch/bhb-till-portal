/* DocScan - turns a photo of a receipt or invoice into a flat, black-and-white document.
 * Finds the page corners, lets the user nudge them, straightens the page and cleans it up.
 * No dependencies. Usage:
 *   <input type="file" accept="image/*" data-scan>   (auto-attached), or
 *   DocScan.scan(file).then(fileOrNull => ...)
 */
(function (global) {
  'use strict';

  const MAX_SRC = 2600;
  const MAX_OUT = 2200;
  const PAD = 26;

  // ---- image loading -------------------------------------------------------------

  async function loadCanvas(file) {
    let src = null, url = null;
    if (global.createImageBitmap) {
      try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { src = null; }
    }
    if (!src) {
      url = URL.createObjectURL(file);
      src = await new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = () => rej(new Error('Could not read that image'));
        im.src = url;
      });
    }
    const w = src.width || src.naturalWidth, h = src.height || src.naturalHeight;
    if (!w || !h) throw new Error('Could not read that image');
    const k = Math.min(1, MAX_SRC / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * k));
    c.height = Math.max(1, Math.round(h * k));
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    if (src.close) src.close();
    if (url) URL.revokeObjectURL(url);
    return c;
  }

  function rotateCanvas(c) {
    const r = document.createElement('canvas');
    r.width = c.height; r.height = c.width;
    const x = r.getContext('2d');
    x.translate(r.width, 0);
    x.rotate(Math.PI / 2);
    x.drawImage(c, 0, 0);
    return r;
  }

  // ---- corner detection ------------------------------------------------------------

  function defaultCorners(w, h) {
    const mx = w * 0.06, my = h * 0.06;
    return [[mx, my], [w - mx, my], [w - mx, h - my], [mx, h - my]];
  }

  function polyArea(p) {
    let a = 0;
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; a += p[i][0] * p[j][1] - p[j][0] * p[i][1]; }
    return Math.abs(a) / 2;
  }

  function detectCorners(c) {
    const W = c.width, H = c.height;
    const s = 320 / Math.max(W, H);
    const w = Math.max(16, Math.round(W * s)), h = Math.max(16, Math.round(H * s));
    const t = document.createElement('canvas');
    t.width = w; t.height = h;
    const tx = t.getContext('2d', { willReadFrequently: true });
    tx.drawImage(c, 0, 0, w, h);
    const d = tx.getImageData(0, 0, w, h).data;
    const n = w * h;
    let g = new Uint8Array(n);
    for (let i = 0; i < n; i++) g[i] = (d[i * 4] * 77 + d[i * 4 + 1] * 150 + d[i * 4 + 2] * 29) >> 8;

    // 3x3 box blur to calm paper texture and print
    const b = new Uint8Array(n);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let sum = 0, cnt = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < w && yy < h) { sum += g[yy * w + xx]; cnt++; }
      }
      b[y * w + x] = sum / cnt;
    }
    g = b;

    // Otsu threshold: paper is brighter than whatever it is lying on
    const hist = new Array(256).fill(0);
    for (let i = 0; i < n; i++) hist[g[i]]++;
    let sumAll = 0;
    for (let i = 0; i < 256; i++) sumAll += i * hist[i];
    let wB = 0, sumB = 0, best = -1, thr = 128;
    for (let i = 0; i < 256; i++) {
      wB += hist[i]; if (!wB) continue;
      const wF = n - wB; if (!wF) break;
      sumB += i * hist[i];
      const mB = sumB / wB, mF = (sumAll - sumB) / wF;
      const v = wB * wF * (mB - mF) * (mB - mF);
      if (v > best) { best = v; thr = i; }
    }

    // largest bright blob
    const label = new Int32Array(n);
    const stack = new Int32Array(n);
    let bestLabel = 0, bestSize = 0, next = 0;
    for (let i = 0; i < n; i++) {
      if (g[i] <= thr || label[i]) continue;
      next++;
      let sp = 0, size = 0;
      stack[sp++] = i; label[i] = next;
      while (sp) {
        const p = stack[--sp]; size++;
        const x = p % w, y = (p - x) / w;
        if (x > 0 && g[p - 1] > thr && !label[p - 1]) { label[p - 1] = next; stack[sp++] = p - 1; }
        if (x < w - 1 && g[p + 1] > thr && !label[p + 1]) { label[p + 1] = next; stack[sp++] = p + 1; }
        if (y > 0 && g[p - w] > thr && !label[p - w]) { label[p - w] = next; stack[sp++] = p - w; }
        if (y < h - 1 && g[p + w] > thr && !label[p + w]) { label[p + w] = next; stack[sp++] = p + w; }
      }
      if (size > bestSize) { bestSize = size; bestLabel = next; }
    }
    if (!bestLabel || bestSize < n * 0.12 || bestSize > n * 0.96) return defaultCorners(W, H);

    // extreme points along the four diagonals, averaged over the last couple of pixels to ignore specks
    const score = [(x, y) => -(x + y), (x, y) => x - y, (x, y) => x + y, (x, y) => y - x];
    const max = [-1e9, -1e9, -1e9, -1e9];
    for (let i = 0; i < n; i++) {
      if (label[i] !== bestLabel) continue;
      const x = i % w, y = (i - x) / w;
      for (let k = 0; k < 4; k++) { const v = score[k](x, y); if (v > max[k]) max[k] = v; }
    }
    const acc = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < n; i++) {
      if (label[i] !== bestLabel) continue;
      const x = i % w, y = (i - x) / w;
      for (let k = 0; k < 4; k++) if (score[k](x, y) >= max[k] - 2) { acc[k][0] += x; acc[k][1] += y; acc[k][2]++; }
    }
    const inv = 1 / s;
    const pts = acc.map(a => [(a[0] / a[2] + 0.5) * inv, (a[1] / a[2] + 0.5) * inv]);
    if (polyArea(pts) < W * H * 0.1) return defaultCorners(W, H);
    return pts.map(p => [Math.min(W, Math.max(0, p[0])), Math.min(H, Math.max(0, p[1]))]);
  }

  // ---- perspective correction ----------------------------------------------------------

  function solve(A, bvec) {
    const n = bvec.length;
    for (let i = 0; i < n; i++) {
      let piv = i;
      for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[piv][i])) piv = r;
      [A[i], A[piv]] = [A[piv], A[i]]; [bvec[i], bvec[piv]] = [bvec[piv], bvec[i]];
      if (Math.abs(A[i][i]) < 1e-12) return null;
      for (let r = i + 1; r < n; r++) {
        const f = A[r][i] / A[i][i];
        for (let k = i; k < n; k++) A[r][k] -= f * A[i][k];
        bvec[r] -= f * bvec[i];
      }
    }
    const x = new Array(n);
    for (let i = n - 1; i >= 0; i--) {
      let sum = bvec[i];
      for (let k = i + 1; k < n; k++) sum -= A[i][k] * x[k];
      x[i] = sum / A[i][i];
    }
    return x;
  }

  function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }

  function warp(srcCanvas, q) {
    let W = Math.round(Math.max(dist(q[0], q[1]), dist(q[3], q[2])));
    let H = Math.round(Math.max(dist(q[0], q[3]), dist(q[1], q[2])));
    if (W < 20 || H < 20) return null;
    const k = Math.min(1, MAX_OUT / Math.max(W, H));
    W = Math.max(20, Math.round(W * k)); H = Math.max(20, Math.round(H * k));
    const dst = [[0, 0], [W, 0], [W, H], [0, H]];
    const A = [], bv = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = dst[i], [u, v] = q[i];
      A.push([x, y, 1, 0, 0, 0, -x * u, -y * u]); bv.push(u);
      A.push([0, 0, 0, x, y, 1, -x * v, -y * v]); bv.push(v);
    }
    const h = solve(A, bv);
    if (!h) return null;

    const sw = srcCanvas.width, sh = srcCanvas.height;
    const sd = srcCanvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, sw, sh).data;
    const out = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const px = x + 0.5, py = y + 0.5;
        const den = h[6] * px + h[7] * py + 1;
        let u = (h[0] * px + h[1] * py + h[2]) / den - 0.5;
        let v = (h[3] * px + h[4] * py + h[5]) / den - 0.5;
        u = u < 0 ? 0 : u > sw - 1.001 ? sw - 1.001 : u;
        v = v < 0 ? 0 : v > sh - 1.001 ? sh - 1.001 : v;
        const x0 = u | 0, y0 = v | 0, fx = u - x0, fy = v - y0;
        const i00 = (y0 * sw + x0) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4;
        const o = (y * W + x) * 4;
        for (let ch = 0; ch < 3; ch++) {
          out[o + ch] = sd[i00 + ch] * (1 - fx) * (1 - fy) + sd[i10 + ch] * fx * (1 - fy) + sd[i01 + ch] * (1 - fx) * fy + sd[i11 + ch] * fx * fy;
        }
        out[o + 3] = 255;
      }
    }
    return { w: W, h: H, data: out };
  }

  // ---- black and white ---------------------------------------------------------------------

  function blackAndWhite(img) {
    const { w, h, data } = img;
    const gray = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) gray[i] = (data[i * 4] * 77 + data[i * 4 + 1] * 150 + data[i * 4 + 2] * 29) >> 8;
    const iw = w + 1;
    const integ = new Uint32Array(iw * (h + 1));
    for (let y = 0; y < h; y++) {
      let row = 0;
      for (let x = 0; x < w; x++) {
        row += gray[y * w + x];
        integ[(y + 1) * iw + x + 1] = integ[y * iw + x + 1] + row;
      }
    }
    const r = Math.max(10, Math.round(Math.max(w, h) / 38));
    const out = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
        const area = (x1 - x0) * (y1 - y0);
        const mean = (integ[y1 * iw + x1] - integ[y0 * iw + x1] - integ[y1 * iw + x0] + integ[y0 * iw + x0]) / area;
        const ink = gray[y * w + x] < mean * 0.9 - 4;
        const o = (y * w + x) * 4, v = ink ? 0 : 255;
        out[o] = out[o + 1] = out[o + 2] = v; out[o + 3] = 255;
      }
    }
    return { w, h, data: out };
  }

  function toCanvas(img) {
    const c = document.createElement('canvas');
    c.width = img.w; c.height = img.h;
    c.getContext('2d').putImageData(new ImageData(img.data, img.w, img.h), 0, 0);
    return c;
  }

  // ---- interface -------------------------------------------------------------------------------

  const CSS = `
.ds-ov{position:fixed;inset:0;z-index:2147483000;background:#15110d;color:#fff;display:flex;flex-direction:column;font:15px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.ds-top{padding:12px 16px 4px;flex:none}
.ds-top b{display:block;font-size:17px}
.ds-top span{color:#cfc7bd;font-size:13px}
.ds-stage{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:4px}
.ds-stage canvas{touch-action:none;display:block;max-width:100%;max-height:100%}
.ds-stage .ds-prev{background:#fff;box-shadow:0 2px 18px rgba(0,0,0,.6);max-width:100%;max-height:100%;object-fit:contain}
.ds-bar{flex:none;display:flex;flex-wrap:wrap;gap:8px;justify-content:center;align-items:center;padding:10px 12px calc(12px + env(safe-area-inset-bottom));background:#0e0b08}
.ds-bar button{font:inherit;font-weight:600;border:1px solid #5a5148;background:#2b241d;color:#fff;border-radius:10px;padding:12px 16px;min-height:46px;cursor:pointer}
.ds-bar button.ds-go{background:#c8963e;border-color:#c8963e;color:#1a1208}
.ds-bar label{display:flex;align-items:center;gap:8px;padding:0 8px;color:#e8e1d8}
.ds-bar label input{width:20px;height:20px}
.ds-msg{padding:24px;text-align:center}
`;

  function injectCss() {
    if (document.getElementById('ds-css')) return;
    const s = document.createElement('style');
    s.id = 'ds-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  function stamp() {
    const d = new Date(), p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  }

  // Resolves to a File (the scan, or the original if "Use original photo" is chosen), or null if cancelled.
  async function scan(file, opts) {
    opts = opts || {};
    injectCss();
    let src;
    try { src = await loadCanvas(file); } catch (e) { return file; }

    return new Promise(resolve => {
      const ov = el('div', 'ds-ov');
      ov.setAttribute('role', 'dialog');
      ov.setAttribute('aria-label', 'Scan document');
      const top = el('div', 'ds-top');
      const title = el('b', '', 'Line up the corners');
      const hint = el('span', '', 'Drag the four dots onto the corners of the page.');
      top.append(title, hint);
      const stage = el('div', 'ds-stage');
      const bar = el('div', 'ds-bar');
      ov.append(top, stage, bar);
      document.body.appendChild(ov);
      const prevOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = 'hidden';

      let pts = detectCorners(src);
      let scale = 1, mode = 'adjust', result = null, bw = true, dragging = -1;
      const cv = el('canvas');
      const ctx = cv.getContext('2d');

      function done(v) {
        document.removeEventListener('keydown', onKey, true);
        window.removeEventListener('resize', layout);
        document.documentElement.style.overflow = prevOverflow;
        ov.remove();
        resolve(v);
      }
      function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); done(null); } }
      document.addEventListener('keydown', onKey, true);

      function btn(label, fn, cls) {
        const b = el('button', cls || '', label);
        b.type = 'button';
        b.addEventListener('click', fn);
        return b;
      }

      function layout() {
        if (mode !== 'adjust') return;
        const aw = stage.clientWidth - 8 - PAD * 2, ah = stage.clientHeight - 8 - PAD * 2;
        scale = Math.min(aw / src.width, ah / src.height);
        const dpr = window.devicePixelRatio || 1;
        const cw = Math.round(src.width * scale) + PAD * 2, ch = Math.round(src.height * scale) + PAD * 2;
        cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
        cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        draw();
      }

      const toView = p => [PAD + p[0] * scale, PAD + p[1] * scale];

      function draw() {
        const cw = parseFloat(cv.style.width), ch = parseFloat(cv.style.height);
        ctx.clearRect(0, 0, cw, ch);
        ctx.drawImage(src, PAD, PAD, src.width * scale, src.height * scale);
        const v = pts.map(toView);
        // dim everything outside the page
        ctx.save();
        ctx.beginPath();
        ctx.rect(PAD, PAD, src.width * scale, src.height * scale);
        ctx.moveTo(v[0][0], v[0][1]);
        for (let i = 3; i >= 0; i--) ctx.lineTo(v[i][0], v[i][1]);
        ctx.closePath();
        ctx.fillStyle = 'rgba(0,0,0,.45)';
        ctx.fill('evenodd');
        ctx.restore();
        ctx.beginPath();
        v.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        ctx.closePath();
        ctx.lineWidth = 2.5; ctx.strokeStyle = '#ffd37a'; ctx.stroke();
        v.forEach(p => {
          ctx.beginPath(); ctx.arc(p[0], p[1], 15, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,211,122,.35)'; ctx.fill();
          ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
          ctx.beginPath(); ctx.arc(p[0], p[1], 3.5, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
        });
      }

      function pointer(e) {
        const r = cv.getBoundingClientRect();
        return [e.clientX - r.left, e.clientY - r.top];
      }
      cv.addEventListener('pointerdown', e => {
        const [x, y] = pointer(e);
        let bi = -1, bd = 44;
        pts.forEach((p, i) => { const v = toView(p), d = Math.hypot(v[0] - x, v[1] - y); if (d < bd) { bd = d; bi = i; } });
        if (bi < 0) return;
        dragging = bi;
        cv.setPointerCapture(e.pointerId);
        e.preventDefault();
      });
      cv.addEventListener('pointermove', e => {
        if (dragging < 0) return;
        const [x, y] = pointer(e);
        pts[dragging] = [Math.min(src.width, Math.max(0, (x - PAD) / scale)), Math.min(src.height, Math.max(0, (y - PAD) / scale))];
        draw();
      });
      const endDrag = () => { dragging = -1; };
      cv.addEventListener('pointerup', endDrag);
      cv.addEventListener('pointercancel', endDrag);

      function showAdjust() {
        mode = 'adjust';
        title.textContent = 'Line up the corners';
        hint.textContent = 'Drag the four dots onto the corners of the page.';
        stage.replaceChildren(cv);
        bar.replaceChildren(
          btn('Cancel', () => done(null)),
          btn('Turn 90°', () => {
            const h = src.height;
            pts = pts.map(p => [h - p[1], p[0]]);
            src = rotateCanvas(src);
            layout();
          }),
          btn('Use original photo', () => done(file)),
          btn('Scan', showPreview, 'ds-go')
        );
        layout();
      }

      function showPreview() {
        const img = warp(src, pts);
        if (!img) { hint.textContent = 'Those corners are too close together - move them apart.'; return; }
        mode = 'preview';
        const colour = toCanvas(img);
        const mono = toCanvas(blackAndWhite(img));
        title.textContent = 'Check the scan';
        hint.textContent = 'If it looks wrong, go back and move the corners.';
        const view = el('img', 'ds-prev');
        const chk = document.createElement('input');
        chk.type = 'checkbox'; chk.checked = bw;
        const lab = el('label'); lab.append(chk, document.createTextNode('Black & white'));
        const show = () => { bw = chk.checked; result = bw ? mono : colour; view.src = result.toDataURL(bw ? 'image/png' : 'image/jpeg', 0.85); };
        chk.addEventListener('change', show);
        show();
        stage.replaceChildren(view);
        bar.replaceChildren(
          btn('Back', showAdjust),
          lab,
          btn('Use this scan', () => {
            const type = bw ? 'image/png' : 'image/jpeg';
            result.toBlob(b => {
              if (!b) { done(file); return; }
              done(new File([b], (opts.name || 'scan') + '-' + stamp() + (bw ? '.png' : '.jpg'), { type }));
            }, type, 0.85);
          }, 'ds-go')
        );
      }

      window.addEventListener('resize', layout);
      showAdjust();
    });
  }

  // Auto-attach: <input type="file" data-scan> offers the scanner for any photo chosen.
  function isImage(f) { return f && (/^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name)); }

  document.addEventListener('change', async e => {
    const input = e.target;
    if (!input || input.type !== 'file' || !input.hasAttribute('data-scan')) return;
    if (input._dsPass) { input._dsPass = false; return; }
    const f = input.files && input.files[0];
    if (!isImage(f)) return;
    e.stopImmediatePropagation();
    const out = await scan(f, { name: input.getAttribute('data-scan') || 'scan' });
    if (!out) { input.value = ''; input.dispatchEvent(new Event('ds-cancel', { bubbles: true })); return; }
    if (out !== f) {
      const dt = new DataTransfer();
      dt.items.add(out);
      input.files = dt.files;
    }
    input._dsPass = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, true);

  global.DocScan = { scan, detectCorners, warp, blackAndWhite };
})(window);
