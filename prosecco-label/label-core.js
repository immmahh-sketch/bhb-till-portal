/* BHBLabel: the prosecco bottle label. Shared by the Prosecco Labels tile and by "print the bottle label" in Weddings and events.
   The page is drawn here, in the browser, so what the person sees is what prints. It goes to label-api as a PNG and waits for the print agent on the office PC to send it to
   the "Office Printer". Measurements are all in millimetres on an A4 sheet; everything can be changed in the tile's Settings tab. */
(function () {
  "use strict";
  var API = "https://safcrtrfdzsnftghibot.supabase.co/functions/v1/label-api";
  var KEY = "sb_publishable_RGaIB8W145BFCWzOxamQvA_7VIkTHMU";
  var A4W = 210, A4H = 297, PT = 25.4 / 72;
  var BASE = (function () { var s = document.currentScript && document.currentScript.src; return s ? s.replace(/[^\/]*$/, "") : "/prosecco-label/"; })();

  var NAME_FONTS = ["Raleway", "Cormorant Garamond", "Georgia", "Arial"];
  var DEFAULTS = {
    sheet: { cols: 2, rows: 3, labelW: 104.25, labelH: 68.4, firstX: 0.75, firstY: 12.3, pitchX: 105, pitchY: 99 },
    adjust: { offsetX: 0, offsetY: 0, scale: 100 },
    printer: { name: "Office Printer", copies: 1 },
    design: {
      dateFormat: "long", maxTextW: 92,
      venues: ["Orchard Marquee", "George Ridley Suite"],
      lines: [
        { text: "{names}", font: "Raleway", size: 19, weight: 400, color: "#FFFFFF", y: 37.5 },
        { text: "You’ve booked your wedding!", font: "Raleway", size: 11, weight: 400, color: "#FFFFFF", y: 43.6 },
        { text: "{date}", font: "Raleway", size: 10.5, weight: 600, color: "#FFFFFF", y: 49.3 },
        { text: "{venue}", font: "Raleway", size: 10, weight: 400, color: "#C4C7AF", y: 58.4 },
        { text: "Red Row Estate, Beamish", font: "Raleway", size: 10, weight: 400, color: "#C4C7AF", y: 62.8 }
      ]
    },
    used: []
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function merge(base, over) {
    var out = clone(base); if (!over || typeof over !== "object") return out;
    ["sheet", "adjust", "printer"].forEach(function (k) { if (over[k] && typeof over[k] === "object") Object.keys(over[k]).forEach(function (f) { if (over[k][f] !== null && over[k][f] !== "" && over[k][f] !== undefined) out[k][f] = over[k][f]; }); });
    if (over.design && typeof over.design === "object") {
      if (over.design.dateFormat) out.design.dateFormat = over.design.dateFormat;
      if (over.design.maxTextW) out.design.maxTextW = Number(over.design.maxTextW);
      if (Array.isArray(over.design.lines)) out.design.lines = clone(over.design.lines);
      if (Array.isArray(over.design.venues) && over.design.venues.length) out.design.venues = over.design.venues.map(String);
    }
    if (Array.isArray(over.used)) out.used = over.used.map(Number);
    return out;
  }

  function staffEmail() { try { return sessionStorage.getItem("bhb_staff_email") || ""; } catch (e) { return ""; } }
  async function api(action, payload) {
    var r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + KEY, apikey: KEY }, body: JSON.stringify(Object.assign({ action: action, staff_email: staffEmail() }, payload || {})) });
    var d = {}; try { d = await r.json(); } catch (e) {}
    if (!r.ok || d.error) throw new Error(d.error || ("Request failed (" + r.status + ")"));
    return d;
  }

  // ------------------------------------------------------------------ dates and names
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  function ordinal(n) { var v = n % 100; if (v >= 11 && v <= 13) return n + "th"; return n + ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th"); }
  function formatDate(iso, fmt) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || "")); if (!m) return "";
    var y = +m[1], mo = +m[2] - 1, d = +m[3], dow = DAYS[new Date(Date.UTC(y, mo, d, 12)).getUTCDay()];
    if (fmt === "weekday") return dow + " " + ordinal(d) + " " + MONTHS[mo] + " " + y;
    if (fmt === "dots") return String(d).padStart(2, "0") + "." + String(mo + 1).padStart(2, "0") + "." + y;
    if (fmt === "short") return d + " " + MONTHS[mo].slice(0, 3) + " " + y;
    return ordinal(d) + " " + MONTHS[mo] + " " + y;
  }
  function joinNames(a, b) { a = String(a || "").trim(); b = String(b || "").trim(); return a && b ? a + " & " + b : (a || b); }
  function splitNames(full) {
    var s = String(full || "").trim(), m = /^(.+?)\s*(?:&|\band\b|\+)\s*(.+)$/i.exec(s);
    return m ? [m[1].trim(), m[2].trim()] : [s, ""];
  }

  // ------------------------------------------------------------------ drawing
  function cellOrigin(sh, pos) { var i = pos - 1, col = i % sh.cols, row = Math.floor(i / sh.cols); return { x: Number(sh.firstX) + col * Number(sh.pitchX), y: Number(sh.firstY) + row * Number(sh.pitchY) }; }
  function fontCss(line, pxPerMm, scale) { return (line.weight || 400) + " " + (Number(line.size) * PT * pxPerMm * (scale || 1)) + "px \"" + (line.font || "Raleway") + "\", Raleway, Arial, sans-serif"; }
  function loadFonts(settings) {
    var jobs = []; (settings.design.lines || []).forEach(function (l) { try { jobs.push(document.fonts.load((l.weight || 400) + " 20px \"" + (l.font || "Raleway") + "\"")); } catch (e) {} });
    return Promise.all(jobs).catch(function () {});
  }
  function drawLabel(ctx, settings, bg, data, x, y, pxPerMm) {
    var sh = settings.sheet, w = Number(sh.labelW) * pxPerMm, h = Number(sh.labelH) * pxPerMm;
    ctx.save(); ctx.translate(x * pxPerMm, y * pxPerMm);
    if (bg) ctx.drawImage(bg, 0, 0, w, h); else { ctx.fillStyle = "#455C4E"; ctx.fillRect(0, 0, w, h); }
    var date = formatDate(data.dateIso, settings.design.dateFormat);
    var maxW = Number(settings.design.maxTextW || 90) * pxPerMm;
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    (settings.design.lines || []).forEach(function (line) {
      var text = String(line.text || "").replace(/\{names\}/g, data.names || "").replace(/\{date\}/g, date).replace(/\{venue\}/g, data.venue || "").trim();
      if (!text) return;
      if (line.caps) text = text.toUpperCase();
      var k = 1; ctx.font = fontCss(line, pxPerMm, k);
      for (var i = 0; i < 40 && ctx.measureText(text).width > maxW && k > 0.45; i++) { k -= 0.03; ctx.font = fontCss(line, pxPerMm, k); }
      ctx.fillStyle = line.color || "#FFFFFF"; ctx.fillText(text, w / 2, Number(line.y) * pxPerMm);
    });
    ctx.restore();
  }
  function drawTest(ctx, settings, pxPerMm) {
    var sh = settings.sheet, n = sh.cols * sh.rows, f = function (v) { return v * pxPerMm; };
    ctx.save(); ctx.strokeStyle = "#000"; ctx.fillStyle = "#000"; ctx.lineWidth = Math.max(1, f(0.2));
    ctx.font = "600 " + f(3.2) + "px Arial"; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("Black Horse Beamish - label alignment test. Print on plain paper at 100% (Actual size), then hold it over a label sheet to the light.", f(6), f(3));
    for (var t = 0; t <= A4W; t += 10) { var l = t % 50 === 0 ? 5 : 2.5; ctx.beginPath(); ctx.moveTo(f(t), 0); ctx.lineTo(f(t), f(l)); ctx.stroke(); }
    for (var u = 0; u <= A4H; u += 10) { var m = u % 50 === 0 ? 5 : 2.5; ctx.beginPath(); ctx.moveTo(0, f(u)); ctx.lineTo(f(m), f(u)); ctx.stroke(); if (u % 50 === 0 && u) { ctx.font = "400 " + f(2.6) + "px Arial"; ctx.fillText(u + "mm", f(6), f(u) - f(1.2)); } }
    for (var p = 1; p <= n; p++) {
      var o = cellOrigin(sh, p), w = f(sh.labelW), h = f(sh.labelH), x = f(o.x), y = f(o.y);
      ctx.setLineDash([f(1.2), f(1)]); ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(x + w / 2 - f(6), y + h / 2); ctx.lineTo(x + w / 2 + f(6), y + h / 2); ctx.moveTo(x + w / 2, y + h / 2 - f(6)); ctx.lineTo(x + w / 2, y + h / 2 + f(6)); ctx.stroke();
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#999"; ctx.font = "700 " + f(16) + "px Arial"; ctx.fillText(String(p), x + w / 2, y + h / 2 - f(14));
      ctx.fillStyle = "#000"; ctx.font = "400 " + f(2.8) + "px Arial"; ctx.fillText(Number(o.x).toFixed(2) + " , " + Number(o.y).toFixed(2) + " mm", x + w / 2, y + h / 2 + f(11));
      ctx.textAlign = "left";
    }
    ctx.restore();
  }
  /* The whole A4 page, ready to print. `mode` is "label" (one label in `position`) or "test" (the alignment sheet). */
  function renderSheet(settings, bg, data, position, mode, dpi) {
    dpi = dpi || 300; var pxPerMm = dpi / 25.4;
    var c = document.createElement("canvas"); c.width = Math.round(A4W * pxPerMm); c.height = Math.round(A4H * pxPerMm);
    var ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    var adj = settings.adjust; ctx.save(); ctx.translate(Number(adj.offsetX || 0) * pxPerMm, Number(adj.offsetY || 0) * pxPerMm); var sc = Number(adj.scale || 100) / 100; ctx.scale(sc, sc);
    if (mode === "test") drawTest(ctx, settings, pxPerMm); else { var o = cellOrigin(settings.sheet, position); drawLabel(ctx, settings, bg, data, o.x, o.y, pxPerMm); }
    ctx.restore(); return c;
  }
  function renderLabelOnly(canvas, settings, bg, data, widthPx) {
    var pxPerMm = widthPx / Number(settings.sheet.labelW); canvas.width = Math.round(widthPx); canvas.height = Math.round(Number(settings.sheet.labelH) * pxPerMm);
    var ctx = canvas.getContext("2d"); ctx.clearRect(0, 0, canvas.width, canvas.height); drawLabel(ctx, settings, bg, data, 0, 0, pxPerMm);
  }
  function pngBase64(canvas) { return canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, ""); }
  /* A one-page A4 PDF holding the page as a JPEG, so it can be printed from a phone at 100% if the office printer is out of reach. */
  function pdfBlob(canvas) {
    var jpeg = atob(canvas.toDataURL("image/jpeg", 0.93).split(",")[1]), n = jpeg.length, i, bytes = new Uint8Array(n); for (i = 0; i < n; i++) bytes[i] = jpeg.charCodeAt(i);
    var pw = 595.28, ph = 841.89, parts = [], offs = [], len = 0;
    function add(s) { var b = typeof s === "string" ? new TextEncoder().encode(s) : s; parts.push(b); len += b.length; }
    function obj(txt) { offs.push(len); add(txt); }
    add("%PDF-1.4\n");
    obj("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
    obj("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
    obj("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + pw + " " + ph + "] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n");
    offs.push(len); add("4 0 obj\n<< /Type /XObject /Subtype /Image /Width " + canvas.width + " /Height " + canvas.height + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + n + " >>\nstream\n"); add(bytes); add("\nendstream\nendobj\n");
    var content = "q " + pw + " 0 0 " + ph + " 0 0 cm /Im0 Do Q";
    obj("5 0 obj\n<< /Length " + content.length + " >>\nstream\n" + content + "\nendstream\nendobj\n");
    var xref = len; add("xref\n0 6\n0000000000 65535 f \n"); offs.forEach(function (o) { add(String(o).padStart(10, "0") + " 00000 n \n"); });
    add("trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF");
    return new Blob(parts, { type: "application/pdf" });
  }

  // ------------------------------------------------------------------ state
  var ST = { loaded: null, settings: clone(DEFAULTS), bg: null, bgKey: "", me: null, agent: { online: false, seen_at: null } };
  function loadImage(src) { return new Promise(function (res) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { res(null); }; im.src = src; }); }
  function load(force) {
    if (ST.loaded && !force) return ST.loaded;
    ST.loaded = api("boot").then(async function (d) {
      ST.me = d.me; ST.settings = merge(DEFAULTS, d.settings); ST.agent = d.agent || ST.agent; ST.design = d.design || null;
      ST.bg = await loadImage(d.design ? "data:image/png;base64," + d.design.png : BASE + "label-bg.png?v=20261020b");
      await loadFonts(ST.settings); return ST;
    }).catch(function (e) { ST.loaded = null; throw e; });
    return ST.loaded;
  }
  function setDesignImage(dataUrl) { return loadImage(dataUrl).then(function (im) { ST.bg = im; return im; }); }

  // ------------------------------------------------------------------ the picker: the sheet, drawn to scale
  function pickerHtml(settings, used, selected) {
    var sh = settings.sheet, n = sh.cols * sh.rows, h = '<div class="lblsheet" role="group" aria-label="Label sheet, tap the position to print on">';
    for (var p = 1; p <= n; p++) {
      var o = cellOrigin(sh, p), sel = p === selected;      // every position looks the same and can be picked: nothing is greyed out
      h += '<button type="button" class="lblcell' + (sel ? " sel" : "") + '" data-pos="' + p + '" aria-pressed="' + sel + '" aria-label="Position ' + p + '" style="left:' + (o.x / A4W * 100) + '%;top:' + (o.y / A4H * 100) + '%;width:' + (sh.labelW / A4W * 100) + '%;height:' + (sh.labelH / A4H * 100) + '%"><b>' + p + '</b></button>';
    }
    return h + '</div>';
  }

  var CSS = ".lbl{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px;align-items:start}@media(max-width:760px){.lbl{grid-template-columns:1fr}}" +
    ".lbl .f{margin:0 0 12px}.lbl .f label{display:block;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#7B887C;margin:0 0 4px}.lbl .f input{width:100%;min-height:46px;font-size:17px;padding:8px 12px;border:1px solid #C1C8B4;border-radius:8px;background:#fff}.lbl .two{display:grid;grid-template-columns:1fr 1fr;gap:10px}" +
    ".lblsheet{position:relative;width:100%;max-width:300px;aspect-ratio:210/297;background:#fff;border:1px solid #C1C8B4;border-radius:4px;box-shadow:0 1px 2px rgba(38,38,38,.06),0 8px 24px rgba(38,38,38,.07);margin:0 auto}" +
    ".lblcell{position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border:2px solid #4E5F4F;background:#455C4E;color:#fff;border-radius:3px;cursor:pointer;padding:0;font-family:inherit}.lblcell b{font-size:clamp(18px,5vw,30px);line-height:1}.lblcell i{font-size:10px;font-style:normal;letter-spacing:.12em;text-transform:uppercase}" +
    ".lblcell.used{background:repeating-linear-gradient(45deg,#E7E7E7,#E7E7E7 6px,#F4F4F4 6px,#F4F4F4 12px);color:#8a8a8a;border-color:#C9C9C9}.lblcell.sel{outline:4px solid #C9A56B;outline-offset:1px;border-color:#C9A56B}" +
    ".lblseg{display:flex;gap:8px;flex-wrap:wrap}.lblvbtn{flex:1 1 140px;min-height:46px;border:2px solid #C1C8B4;background:#fff;color:#4E5F4F;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;padding:0 12px}.lblvbtn.on{background:#4E5F4F;border-color:#4E5F4F;color:#fff}" +
    ".lblprev{display:block;width:100%;max-width:520px;height:auto;border-radius:3px;box-shadow:0 1px 2px rgba(38,38,38,.1),0 6px 18px rgba(38,38,38,.12);margin:0 0 10px}" +
    ".lblbtns{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0 0}.lblbtn{border:2px solid #4E5F4F;background:#4E5F4F;color:#fff;border-radius:10px;min-height:52px;padding:0 22px;font-size:14px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}.lblbtn.ghost{background:#fff;color:#4E5F4F}.lblbtn:disabled{opacity:.55;cursor:default}" +
    ".lblmsg{margin:12px 0 0;padding:10px 12px;border-radius:8px;font-size:14px;background:#EDEFED}.lblmsg.ok{background:#EDF2ED;color:#2F5B31}.lblmsg.bad{background:#F6EAE8;color:#8C4A3F}.lblmsg.warn{background:#F7F0E4;color:#7a5f36}.lblhint{font-size:12px;color:#7B887C;margin:6px 0 0}.lbllink{background:none;border:0;padding:0;color:#4E5F4F;text-decoration:underline;cursor:pointer;font-size:13px}";
  function injectCss() { if (document.getElementById("lblcss")) return; var s = document.createElement("style"); s.id = "lblcss"; s.textContent = CSS; document.head.appendChild(s); }

  // ------------------------------------------------------------------ the printing component (used inline in the tile, and in a dialog from Weddings and events)
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  async function mount(el, opts) {
    opts = opts || {}; injectCss();
    el.innerHTML = '<p class="lblhint">Loading…</p>';
    var S;
    try { S = await load(); } catch (e) { el.innerHTML = '<div class="lblmsg bad">' + esc(e.message) + '</div>'; return null; }
    var nm = opts.names ? splitNames(opts.names) : [opts.partner1 || "", opts.partner2 || ""];
    var cfg = S.settings, n = cfg.sheet.cols * cfg.sheet.rows;
    var st = { p1: nm[0], p2: nm[1], date: opts.date || "", pos: 0, busy: false }, vs = cfg.design.venues || [];
    st.venue = vs.filter(function (v) { return opts.venue && String(opts.venue).toLowerCase().replace(/[^a-z]/g, "").indexOf(v.toLowerCase().replace(/[^a-z]/g, "").slice(0, 6)) > -1; })[0] || vs[0] || "";
    function firstFree() { for (var p = 1; p <= n; p++) if (cfg.used.indexOf(p) < 0) return p; return 1; }
    st.pos = firstFree();
    el.innerHTML = '<div class="lbl"><div>' +
      '<div class="two"><div class="f"><label for="lbl_p1">Partner 1</label><input id="lbl_p1" autocomplete="off" value="' + esc(st.p1) + '"></div><div class="f"><label for="lbl_p2">Partner 2</label><input id="lbl_p2" autocomplete="off" value="' + esc(st.p2) + '"></div></div>' +
      '<div class="f"><label for="lbl_date">Wedding date</label><input id="lbl_date" type="date" value="' + esc(st.date) + '"></div>' +
      '<div class="f"><label>Venue</label><div id="lbl_venue" class="lblseg" role="group" aria-label="Venue"></div></div>' +
      '<canvas id="lbl_prev" class="lblprev" aria-label="Preview of the label"></canvas>' +
      '<div class="lblbtns"><button type="button" class="lblbtn" id="lbl_print">Print label</button><button type="button" class="lblbtn ghost" id="lbl_pdf">Open as PDF</button>' + (opts.onCancel ? '<button type="button" class="lblbtn ghost" id="lbl_cancel">' + esc(opts.cancelText || "Close") + '</button>' : '') + '</div>' +
      '<div id="lbl_msg"></div></div>' +
      '<div><div style="font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#7B887C;margin:0 0 8px">Which label on the sheet?</div><div id="lbl_pick"></div>' +
      '<p class="lblhint" style="text-align:center">Tap the label you want to print on. After each print it moves on to the next one. <button type="button" class="lbllink" id="lbl_fresh">Start again at 1</button></p></div></div>';
    var $ = function (id) { return el.querySelector("#" + id); };
    function data() { return { names: joinNames($("lbl_p1").value, $("lbl_p2").value), dateIso: $("lbl_date").value, venue: st.venue }; }
    function venueBtns() { $("lbl_venue").innerHTML = (cfg.design.venues || []).map(function (v) { return '<button type="button" class="lblvbtn' + (v === st.venue ? " on" : "") + '" data-venue="' + esc(v) + '" aria-pressed="' + (v === st.venue) + '">' + esc(v) + '</button>'; }).join(""); }
    function paint() {
      venueBtns();
      renderLabelOnly($("lbl_prev"), cfg, S.bg, data(), 900);
      $("lbl_pick").innerHTML = pickerHtml(cfg, cfg.used, st.pos);
      var d = data(); $("lbl_print").disabled = st.busy || !d.names || !d.dateIso; $("lbl_pdf").disabled = !d.names || !d.dateIso;
    }
    function msg(kind, text) { $("lbl_msg").innerHTML = text ? '<div class="lblmsg ' + kind + '" role="status">' + text + '</div>' : ""; }
    el.addEventListener("input", paint); paint();
    el.addEventListener("click", function (e) { var c = e.target.closest(".lblcell"); if (c) { st.pos = +c.getAttribute("data-pos"); paint(); } var vb = e.target.closest(".lblvbtn"); if (vb) { st.venue = vb.getAttribute("data-venue"); paint(); } });
    $("lbl_fresh").addEventListener("click", async function () { try { await api("used.save", { used: [] }); cfg.used = []; st.pos = 1; paint(); msg("ok", "Back to position 1."); } catch (e) { msg("bad", esc(e.message)); } });
    if ($("lbl_cancel")) $("lbl_cancel").addEventListener("click", function () { opts.onCancel(); });
    $("lbl_pdf").addEventListener("click", function () {
      var d = data(); if (!d.names || !d.dateIso) return;
      var blob = pdfBlob(renderSheet(cfg, S.bg, d, st.pos, "label", 300)); var url = URL.createObjectURL(blob); var w = window.open(url, "_blank"); if (!w) location.href = url;
      msg("warn", "Opened as a PDF. Print it at 100% (Actual size) on the label sheet, with position " + st.pos + " free.");
    });
    $("lbl_print").addEventListener("click", async function () {
      var d = data(); if (!d.names || !d.dateIso || st.busy) return;
      st.busy = true; paint(); msg("", "Sending to the printer…");
      try {
        var page = renderSheet(cfg, S.bg, d, st.pos, "label", 300);
        var r = await api("job.create", { names: d.names, date: d.dateIso, position: st.pos, page_png: pngBase64(page), kind: "label", source: opts.source || "app", enquiry_id: opts.enquiryId || null, copies: cfg.printer.copies || 1 });
        if (cfg.used.indexOf(st.pos) < 0) cfg.used.push(st.pos);
        var printedPos = st.pos; st.pos = firstFree(); paint();
        if (!r.agent_online) msg("warn", "In the queue, but the office print agent has not been seen for a while, so it may not print until the office PC is on. You can also use <b>Open as PDF</b>.");
        await watch(r.id, printedPos);
      } catch (e) { msg("bad", esc(e.message)); }
      st.busy = false; paint();
    });
    async function watch(id, pos) {
      var t0 = Date.now();
      while (Date.now() - t0 < 180000) {
        var s; try { s = await api("job.status", { id: id }); } catch (e) { break; }
        var j = s.job;
        if (j.status === "printed") { msg("ok", "Printed on position " + pos + " &#10003;"); if (opts.onPrinted) opts.onPrinted(j); return; }
        if (j.status === "failed") { msg("bad", "The printer did not print it: " + esc(j.error || "unknown problem") + ". It is in Sent to print, where it can be tried again."); return; }
        msg("", j.status === "printing" ? "Printing…" : (s.agent_online ? "Waiting for the office printer…" : "In the queue. The office print agent is not running right now."));
        await new Promise(function (r) { setTimeout(r, 2000); });
      }
      msg("warn", "Still waiting. It stays in the queue and will print when the office PC picks it up (see Sent to print).");
    }
    function setVenue(name) {
      var vs2 = cfg.design.venues || [], key = String(name || "").toLowerCase().replace(/[^a-z]/g, "");
      var hit = vs2.filter(function (v) { return key && key.indexOf(v.toLowerCase().replace(/[^a-z]/g, "").slice(0, 6)) > -1; })[0];
      if (hit) { st.venue = hit; paint(); }
    }
    return { state: st, repaint: paint, setVenue: setVenue };
  }

  /* The dialog Weddings and events opens after a booking is secured: confirm the names and date, choose the position, print. */
  function openDialog(opts) {
    injectCss(); opts = opts || {};
    var bg = document.createElement("div"); bg.id = "lbldlg"; bg.style.cssText = "position:fixed;inset:0;background:rgba(38,38,38,.55);z-index:9999;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:20px 12px";
    bg.innerHTML = '<div style="background:#fff;border-radius:12px;max-width:900px;width:100%;padding:22px 22px 26px;box-shadow:0 20px 60px rgba(0,0,0,.35)"><h2 style="margin:0 0 4px;font-size:24px">Print the bottle label</h2><p style="margin:0 0 16px;color:#7B887C;font-size:14px">Check the names and the date, then choose which label on the sheet to print on.</p><div id="lbldlgbody"></div></div>';
    document.body.appendChild(bg);
    function close() { if (bg.parentNode) bg.parentNode.removeChild(bg); if (opts.onClose) opts.onClose(); }
    var ready = mount(bg.querySelector("#lbldlgbody"), { names: opts.names, partner1: opts.partner1, partner2: opts.partner2, date: opts.date, venue: opts.venue, source: "wedding-admin", enquiryId: opts.enquiryId, onCancel: close, cancelText: "Close" });
    return { close: close, ready: ready };
  }

  async function testPrint(position) {
    var S = await load(); var page = renderSheet(S.settings, S.bg, {}, 1, "test", 300);
    return api("job.create", { names: "Alignment test", position: position || 1, page_png: pngBase64(page), kind: "test", source: "app" });
  }
  window.BHBLabel = { api: api, load: load, state: ST, DEFAULTS: DEFAULTS, merge: merge, clone: clone, formatDate: formatDate, joinNames: joinNames, splitNames: splitNames, cellOrigin: cellOrigin, renderSheet: renderSheet, renderLabelOnly: renderLabelOnly, pngBase64: pngBase64, pdfBlob: pdfBlob, pickerHtml: pickerHtml, mount: mount, openDialog: openDialog, testPrint: testPrint, setDesignImage: setDesignImage, loadFonts: loadFonts, NAME_FONTS: NAME_FONTS, esc: esc, injectCss: injectCss };
})();
