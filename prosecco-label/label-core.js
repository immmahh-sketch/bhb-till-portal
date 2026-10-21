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
    sheet: { cols: 2, rows: 4, labelW: 100.6, labelH: 67.7, firstX: 3.9, firstY: 13.1, pitchX: 101.6, pitchY: 67.7 },   // 8 per A4 page, measured from a photo of the blank sheet (die-cut lines)
    adjust: { offsetX: 0, offsetY: 0, scale: 100 },
    printer: { name: "Office Printer", copies: 1 },
    design: {
      dateFormat: "long", maxTextW: 92,
      // The wedding label's heading (CONGRATULATIONS) is part of the artwork. Every other occasion uses the artwork without it and draws its own heading in this style.
      heading: { font: "Cormorant Garamond", size: 24, weight: 600, color: "#FFFFFF", y: 27.9, spacing: 0.04 },
      occasions: {
        wedding: { label: "New Wedding Bookings", message: "You’ve booked your wedding!" },
        birthday: { label: "Birthday", heading: "HAPPY BIRTHDAY", message: "Wishing you a wonderful birthday!" },
        anniversary: { label: "Anniversary", heading: "HAPPY ANNIVERSARY", message: "Wishing you a very happy anniversary!" },
        engagement: { label: "Engagement", heading: "CONGRATULATIONS", message: "On your engagement!" },
        weddingnight: { label: "Wedding night", heading: "Congratulations on your Wedding Day", caps: false, message: "We wish you a long and happy Married life together" },
        other: { label: "Other", heading: "BEST WISHES", message: "We hope you enjoy your stay" }
      },
      bottomName: "Black Horse Beamish",
      venues: ["Orchard Marquee", "George Ridley Suite"],
      lines: [
        { text: "{names}", font: "Raleway", size: 19, weight: 400, color: "#FFFFFF", y: 37.15 },
        { text: "{message}", font: "Raleway", size: 11, weight: 400, color: "#FFFFFF", y: 43.25 },
        { text: "{date}", font: "Raleway", size: 10.5, weight: 600, color: "#FFFFFF", y: 48.95 },
        { text: "{venue}", font: "Raleway", size: 10, weight: 400, color: "#C4C7AF", y: 58.05 },
        { text: "Red Row Estate, Beamish", font: "Raleway", size: 10, weight: 400, color: "#C4C7AF", y: 62.45 }
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
      if (over.design.heading && typeof over.design.heading === "object") Object.keys(over.design.heading).forEach(function (f) { var v = over.design.heading[f]; if (v !== null && v !== "" && v !== undefined) out.design.heading[f] = v; });
      if (over.design.occasions && typeof over.design.occasions === "object") Object.keys(over.design.occasions).forEach(function (k) { if (!out.design.occasions[k] || !over.design.occasions[k]) return; ["heading", "message"].forEach(function (f) { if (typeof over.design.occasions[k][f] === "string") out.design.occasions[k][f] = over.design.occasions[k][f]; }); });
      if (typeof over.design.bottomName === "string" && over.design.bottomName.trim()) out.design.bottomName = over.design.bottomName.trim();
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
    var jobs = []; (settings.design.lines || []).concat(settings.design.heading ? [settings.design.heading] : []).forEach(function (l) { try { jobs.push(document.fonts.load((l.weight || 400) + " 20px \"" + (l.font || "Raleway") + "\"")); } catch (e) {} });
    return Promise.all(jobs).catch(function () {});
  }
  function drawLabel(ctx, settings, bg, data, x, y, pxPerMm) {
    var sh = settings.sheet, w = Number(sh.labelW) * pxPerMm, h = Number(sh.labelH) * pxPerMm;
    ctx.save(); ctx.translate(x * pxPerMm, y * pxPerMm);
    var occ = data.occasion || "wedding", useAlt = occ !== "wedding" && ST.bgPlain && !ST.design;     // a custom uploaded design keeps its own heading
    var img = useAlt ? ST.bgPlain : bg;
    if (img) ctx.drawImage(img, 0, 0, w, h); else { ctx.fillStyle = "#455C4E"; ctx.fillRect(0, 0, w, h); }
    if (useAlt && data.heading) {
      var hd = settings.design.heading || {}, htext = data.caps === false ? String(data.heading) : String(data.heading).toUpperCase(), hk = 1, hmax = Number(settings.design.maxTextW || 90) * pxPerMm;
      ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = hd.color || "#FFFFFF";
      ctx.font = fontCss(hd, pxPerMm, hk); try { ctx.letterSpacing = (Number(hd.spacing || 0) * Number(hd.size || 24) * PT * pxPerMm * hk) + "px"; } catch (e) {}
      for (var hi = 0; hi < 40 && ctx.measureText(htext).width > hmax && hk > 0.4; hi++) { hk -= 0.03; ctx.font = fontCss(hd, pxPerMm, hk); try { ctx.letterSpacing = (Number(hd.spacing || 0) * Number(hd.size || 24) * PT * pxPerMm * hk) + "px"; } catch (e) {} }
      ctx.fillText(htext, w / 2 + (Number(hd.spacing || 0) * Number(hd.size || 24) * PT * pxPerMm * hk) / 2, Number(hd.y || 27.9) * pxPerMm);      // the tracking adds space after the last letter too: nudge to stay centred
      try { ctx.letterSpacing = "0px"; } catch (e) {}
    }
    var message = data.message || ((settings.design.occasions || {}).wedding || {}).message || "";
    var date = formatDate(data.dateIso, settings.design.dateFormat);
    var maxW = Number(settings.design.maxTextW || 90) * pxPerMm;
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    (settings.design.lines || []).forEach(function (line) {
      var text = String(line.text || "").replace(/\{names\}/g, data.names || "").replace(/\{date\}/g, date).replace(/\{venue\}/g, data.venue || "").replace(/\{message\}/g, message).trim();
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
    if (mode === "test") drawTest(ctx, settings, pxPerMm);
    else if (Array.isArray(data)) { data.forEach(function (e) { var oe = cellOrigin(settings.sheet, e.pos); drawLabel(ctx, settings, bg, e, oe.x, oe.y, pxPerMm); }); }   // several different labels on one sheet
    else if (position === "all") { var n = Number(settings.sheet.cols) * Number(settings.sheet.rows); for (var p = 1; p <= n; p++) { var oc = cellOrigin(settings.sheet, p); drawLabel(ctx, settings, bg, data, oc.x, oc.y, pxPerMm); } }   // a sample in every position, to see whether anything bleeds into the next label
    else { var o = cellOrigin(settings.sheet, position); drawLabel(ctx, settings, bg, data, o.x, o.y, pxPerMm); }
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
      ST.bg = await loadImage(d.design ? "data:image/png;base64," + d.design.png : BASE + "label-bg.png?v=20261021");
      ST.bgPlain = await loadImage(BASE + "label-bg-plain.png?v=20261021");
      await loadFonts(ST.settings); return ST;
    }).catch(function (e) { ST.loaded = null; throw e; });
    return ST.loaded;
  }
  function setDesignImage(dataUrl) { return loadImage(dataUrl).then(function (im) { ST.bg = im; return im; }); }

  // ------------------------------------------------------------------ the picker: the sheet, drawn to scale
  function pickerHtml(settings, used, selected, taken) {
    taken = taken || {};
    var sh = settings.sheet, n = sh.cols * sh.rows, h = '<div class="lblsheet" role="group" aria-label="Label sheet, tap the position to print on">';
    for (var p = 1; p <= n; p++) {
      var o = cellOrigin(sh, p), sel = p === selected;      // every position looks the same and can be picked: nothing is greyed out
      if (taken[p]) { h += '<button type="button" class="lblcell taken" disabled data-pos="' + p + '" aria-label="Position ' + p + ', already added: ' + esc(taken[p]) + '" style="left:' + (o.x / A4W * 100) + '%;top:' + (o.y / A4H * 100) + '%;width:' + (sh.labelW / A4W * 100) + '%;height:' + (sh.labelH / A4H * 100) + '%"><b>' + p + '</b><i>&#10003; added</i></button>'; continue; }
      h += '<button type="button" class="lblcell' + (sel ? " sel" : "") + '" data-pos="' + p + '" aria-pressed="' + sel + '" aria-label="Position ' + p + '" style="left:' + (o.x / A4W * 100) + '%;top:' + (o.y / A4H * 100) + '%;width:' + (sh.labelW / A4W * 100) + '%;height:' + (sh.labelH / A4H * 100) + '%"><b>' + p + '</b></button>';
    }
    return h + '</div>';
  }

  var CSS = ".lbl{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px;align-items:start}@media(max-width:760px){.lbl{grid-template-columns:1fr}}" +
    ".lbl .f{margin:0 0 12px}.lbl .f label{display:block;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#7B887C;margin:0 0 4px}.lbl .f input{width:100%;min-height:46px;font-size:17px;padding:8px 12px;border:1px solid #C1C8B4;border-radius:8px;background:#fff}.lbl .two{display:grid;grid-template-columns:1fr 1fr;gap:10px}" +
    ".lblsheet{position:relative;width:100%;max-width:300px;aspect-ratio:210/297;background:#fff;border:1px solid #C1C8B4;border-radius:4px;box-shadow:0 1px 2px rgba(38,38,38,.06),0 8px 24px rgba(38,38,38,.07);margin:0 auto}" +
    ".lblcell{position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border:2px solid #4E5F4F;background:#455C4E;color:#fff;border-radius:3px;cursor:pointer;padding:0;font-family:inherit}.lblcell b{font-size:clamp(18px,5vw,30px);line-height:1}.lblcell i{font-size:10px;font-style:normal;letter-spacing:.12em;text-transform:uppercase}" +
    ".lblcell.used{background:repeating-linear-gradient(45deg,#E7E7E7,#E7E7E7 6px,#F4F4F4 6px,#F4F4F4 12px);color:#8a8a8a;border-color:#C9C9C9}.lblcell.sel{outline:4px solid #C9A56B;outline-offset:1px;border-color:#C9A56B}.lbl #lbl_occ{flex-wrap:wrap}.lbl #lbl_occ .lblvbtn{flex:1 1 30%;min-width:0;padding:0 6px;font-size:14px}.lblask{font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#7B887C;margin:0 0 8px}.lbl.gate>div:last-child{display:none}.lbl.gate>div:first-child>*:not(.lblmode):not(.lblask):not(#lbl_occ){display:none}.lbl.gate .lblmbtn{min-height:76px;font-size:16px}.lbl.gate #lbl_occ .lblvbtn{min-height:62px;font-size:16px}.lblmode{display:flex;gap:0;margin:0 0 14px;border:2px solid #4E5F4F;border-radius:10px;overflow:hidden}.lblmbtn{flex:1 1 50%;min-height:50px;border:0;background:#fff;color:#4E5F4F;font-size:14px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}.lblmbtn.on{background:#4E5F4F;color:#fff}.lblmbtn+.lblmbtn{border-left:2px solid #4E5F4F}.lblcell.taken{background:#E8DDC6;color:#5c4a28;border-color:#C9A56B;cursor:not-allowed}.lblq{margin:14px 0 0;padding:0;list-style:none}.lblq li{display:flex;gap:10px;align-items:center;padding:9px 0;border-top:1px solid #E7E7E7;font-size:14px}.lblq li:first-child{border-top:0}.lblq .qn{flex:0 0 auto;min-width:64px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#7B887C}.lblq .qt{flex:1 1 auto;min-width:0;overflow-wrap:anywhere}" +
    ".lblseg{display:flex;gap:8px;flex-wrap:wrap}.lblvbtn{flex:1 1 140px;min-height:46px;border:2px solid #C1C8B4;background:#fff;color:#4E5F4F;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;padding:0 12px}.lblvbtn.on{background:#4E5F4F;border-color:#4E5F4F;color:#fff}" +
    ".lblprev{display:block;width:100%;max-width:520px;height:auto;border-radius:3px;box-shadow:0 1px 2px rgba(38,38,38,.1),0 6px 18px rgba(38,38,38,.12);margin:0 0 10px}" +
    ".lblbtns{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0 0}.lblbtn{border:2px solid #4E5F4F;background:#4E5F4F;color:#fff;border-radius:10px;min-height:52px;padding:0 22px;font-size:14px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}.lblbtn.ghost{background:#fff;color:#4E5F4F}.lblbtn:disabled{opacity:.55;cursor:default}" +
    ".lblmsg{margin:12px 0 0;padding:10px 12px;border-radius:8px;font-size:14px;background:#EDEFED}.lblmsg.ok{background:#EDF2ED;color:#2F5B31}.lblmsg.bad{background:#F6EAE8;color:#8C4A3F}.lblmsg.warn{background:#F7F0E4;color:#7a5f36}.lblhint{font-size:12px;color:#7B887C;margin:6px 0 0}.lblload{display:flex;gap:14px;align-items:center;margin-top:14px;padding:12px 14px;border-radius:10px;background:#F7F0E4;color:#5c4a28;font-size:13.5px;line-height:1.45}.lblload svg{flex:0 0 auto}.lblload ol{margin:4px 0 0;padding-left:18px}.lblload li{margin:2px 0}.lbllink{background:none;border:0;padding:0;color:#4E5F4F;text-decoration:underline;cursor:pointer;font-size:13px}";
  function injectCss() { if (document.getElementById("lblcss")) return; var s = document.createElement("style"); s.id = "lblcss"; s.textContent = CSS; document.head.appendChild(s); }

  // ------------------------------------------------------------------ the printing component (used inline in the tile, and in a dialog from Weddings and events)
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  /* How the sheet goes into the printer, shown wherever someone is about to print. */
  function loadingHelpHtml() {
    var cells = ""; for (var i = 0; i < 8; i++) { var c = i % 2, r = Math.floor(i / 2); cells += '<rect x="' + (13 + c * 24) + '" y="' + (15 + r * 17) + '" width="23" height="16" rx="2" fill="#E3E8E1" stroke="#7B887C" stroke-width=".8"/><text x="' + (24.5 + c * 24) + '" y="' + (26 + r * 17) + '" font-size="8" text-anchor="middle" fill="#3B483C" font-weight="700">' + (i + 1) + '</text>'; }
    return '<div class="lblload"><svg viewBox="0 0 64 100" width="64" height="100" role="img" aria-label="The sheet, label side up, labels 1 and 2 at the end that goes into the printer first"><rect x="9" y="11" width="50" height="86" fill="#fff" stroke="#3B483C" stroke-width="1.2"/>' + cells +
      '<path d="M34 9 L34 1 M30.5 4.5 L34 1 L37.5 4.5" stroke="#B3402F" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '<div><b>Loading the sheet</b><ol><li>Open <b>Tray 1</b>.</li><li>Labels <b>facing up</b>, the same way up as you read it on screen.</li><li><b>Labels 1 and 2</b> (the top edge) go in the printer <b>first</b>.</li></ol></div></div>';
  }

  async function mount(el, opts) {
    opts = opts || {}; injectCss();
    el.innerHTML = '<p class="lblhint">Loading…</p>';
    var S;
    try { S = await load(); } catch (e) { el.innerHTML = '<div class="lblmsg bad">' + esc(e.message) + '</div>'; return null; }
    var nm = opts.names ? splitNames(opts.names) : [opts.partner1 || "", opts.partner2 || ""];
    var cfg = S.settings, n = cfg.sheet.cols * cfg.sheet.rows;
    var st = { p1: nm[0], p2: nm[1], date: opts.date || "", pos: 0, busy: false, mode: opts.noOccasions ? "wedding" : null, occ: "", wn: "mrmrs" }, vs = cfg.design.venues || [], OC = cfg.design.occasions || {}, OCKEYS = ["birthday", "anniversary", "engagement", "weddingnight", "other"];
    st.venue = vs.filter(function (v) { return opts.venue && String(opts.venue).toLowerCase().replace(/[^a-z]/g, "").indexOf(v.toLowerCase().replace(/[^a-z]/g, "").slice(0, 6)) > -1; })[0] || vs[0] || "";
    st.pos = 1;
    el.innerHTML = '<div class="lbl" id="lbl_root"><div>' +
      (opts.noOccasions ? '' : '<div class="lblask" id="lbl_ask1">Who is this label for?</div><div class="lblmode" role="group" aria-label="Who is the label for"><button type="button" class="lblmbtn on" data-mode="wedding" aria-pressed="true">New Wedding Bookings</button><button type="button" class="lblmbtn" data-mode="other" aria-pressed="false">Other</button></div>' +
        '<div class="lblask" id="lbl_ask2" hidden>What is the occasion?</div><div id="lbl_occ" class="lblseg" role="group" aria-label="Occasion" style="margin:0 0 14px" hidden></div>') +
      '<div class="two"><div class="f"><label for="lbl_p1" id="lbl_l1">Partner 1</label><input id="lbl_p1" autocomplete="off" value="' + esc(st.p1) + '"></div><div class="f" id="lbl_f2"><label for="lbl_p2" id="lbl_l2">Partner 2</label><input id="lbl_p2" autocomplete="off" value="' + esc(st.p2) + '"></div></div>' +
      '<div class="f"><label for="lbl_date" id="lbl_ld">Wedding date</label><input id="lbl_date" type="date" value="' + esc(st.date) + '"></div>' +
      '<div class="f" id="lbl_wnf" hidden><label>Names on the label</label><div id="lbl_wn" class="lblseg" role="group" aria-label="How the names are written"></div></div>' +
      '<div class="two" id="lbl_otherf" hidden><div class="f"><label for="lbl_head">Heading</label><input id="lbl_head" autocomplete="off" maxlength="30"></div><div class="f"><label for="lbl_msg2">Message</label><input id="lbl_msg2" autocomplete="off" maxlength="60"></div></div>' +
      '<div class="f" id="lbl_venuef"><label>Venue</label><div id="lbl_venue" class="lblseg" role="group" aria-label="Venue"></div></div>' +
      '<canvas id="lbl_prev" class="lblprev" aria-label="Preview of the label"></canvas>' +
      '<div class="lblbtns"><button type="button" class="lblbtn ghost" id="lbl_add">Add to label 1</button><button type="button" class="lblbtn" id="lbl_print">Print label</button><button type="button" class="lblbtn ghost" id="lbl_pdf">Open as PDF</button>' + (opts.onCancel ? '<button type="button" class="lblbtn ghost" id="lbl_cancel">' + esc(opts.cancelText || "Close") + '</button>' : '') + '</div>' +
      '<ul class="lblq" id="lbl_queue" aria-live="polite"></ul><p class="lblhint" id="lbl_addhint"></p>' +
      '<div id="lbl_msg"></div></div>' +
      '<div><div style="font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#7B887C;margin:0 0 8px">Which label on the sheet?</div><div id="lbl_pick"></div>' +
      '<p class="lblhint" style="text-align:center">Tap the label on the sheet you want to print on.</p>' + loadingHelpHtml() + '</div></div>';
    var $ = function (id) { return el.querySelector("#" + id); };
    var other = function () { return st.mode === "other"; };
    function data() {
      var wn = other() && st.occ === "weddingnight" && st.wn !== "names", sur = $("lbl_p1").value.trim(), TITLES = { mrmrs: "Mr & Mrs ", mrmr: "Mr & Mr ", mrsmrs: "Mrs & Mrs " };
      var d = { names: wn ? (sur ? (TITLES[st.wn] || "Mr & Mrs ") + sur : "") : joinNames($("lbl_p1").value, $("lbl_p2").value), dateIso: $("lbl_date").value, occasion: other() ? st.occ : "wedding" };
      if (!other()) { d.venue = st.venue; return d; }
      var oc = OC[st.occ] || {};
      d.venue = cfg.design.bottomName || "Black Horse Beamish";             // the bottom of an occasion label names the house, not a room
      d.heading = st.occ === "other" ? $("lbl_head").value : (oc.heading || ""); d.message = st.occ === "other" ? $("lbl_msg2").value : (oc.message || ""); d.caps = oc.caps !== false;
      return d;
    }
    function copyOf(d, pos) { var o = { pos: pos }; for (var k in d) if (Object.prototype.hasOwnProperty.call(d, k)) o[k] = d[k]; return o; }
    function occLabel(k) { return (OC[k] && OC[k].label) || k; }
    /* what the form looks like for each kind of label */
    function modeUi() {
      var o = other();
      el.querySelectorAll("[data-mode]").forEach(function (b) { var on = b.getAttribute("data-mode") === st.mode; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
      /* nothing but the question is shown until it has been answered, so the wrong kind of label cannot be printed by accident */
      var gated = !opts.noOccasions && (!st.mode || (o && !st.occ)); $("lbl_root").classList.toggle("gate", gated);
      if ($("lbl_ask2")) $("lbl_ask2").hidden = !o;
      if ($("lbl_occ")) { $("lbl_occ").hidden = !o; $("lbl_occ").innerHTML = OCKEYS.map(function (k) { return '<button type="button" class="lblvbtn' + (k === st.occ ? " on" : "") + '" data-occ="' + k + '" aria-pressed="' + (k === st.occ) + '">' + esc(occLabel(k)) + '</button>'; }).join(""); }
      var wn = o && st.occ === "weddingnight", mm = wn && st.wn !== "names";
      $("lbl_wnf").hidden = !wn; $("lbl_f2").hidden = mm;
      if (wn) $("lbl_wn").innerHTML = [["mrmrs", "Mr & Mrs Smith"], ["mrmr", "Mr & Mr Smith"], ["mrsmrs", "Mrs & Mrs Smith"], ["names", "Both their names"]].map(function (x) { return '<button type="button" class="lblvbtn' + (x[0] === st.wn ? " on" : "") + '" data-wn="' + x[0] + '" aria-pressed="' + (x[0] === st.wn) + '">' + x[1] + '</button>'; }).join("");
      $("lbl_l1").textContent = mm ? "Surname (for example Smith, or J Smith)" : (o ? "Name" : "Partner 1"); $("lbl_l2").textContent = o ? (wn ? "Second name" : "Second name (optional)") : "Partner 2";
      $("lbl_ld").textContent = o ? "Date (optional)" : "Wedding date";
      $("lbl_otherf").hidden = !(o && st.occ === "other"); $("lbl_venuef").hidden = o;
    }
    function venueBtns() { $("lbl_venue").innerHTML = (cfg.design.venues || []).map(function (v) { return '<button type="button" class="lblvbtn' + (v === st.venue ? " on" : "") + '" data-venue="' + esc(v) + '" aria-pressed="' + (v === st.venue) + '">' + esc(v) + '</button>'; }).join(""); }
    st.queue = [];                                        // labels already added to this sheet: { names, dateIso, venue, pos }
    function takenMap() { var m = {}; st.queue.forEach(function (e) { m[e.pos] = e.names; }); return m; }
    function isTaken(pos) { return st.queue.some(function (e) { return e.pos === pos; }); }
    function firstFree(from) { for (var k = 0; k < n; k++) { var c = ((from - 1 + k) % n) + 1; if (!isTaken(c)) return c; } return 0; }
    function complete(d) { return !!(d.names && (d.occasion !== "wedding" || d.dateIso)); }
    /* everything that will print: the labels added so far, plus the one on the form if it is filled in and its position is free */
    function sheetEntries() {
      var out = st.queue.slice(), d = data();
      if (complete(d) && st.pos && !isTaken(st.pos)) out.push(copyOf(d, st.pos));
      return out.sort(function (a, b) { return a.pos - b.pos; });
    }
    function paint() {
      modeUi(); venueBtns();
      renderLabelOnly($("lbl_prev"), cfg, S.bg, data(), 900);
      $("lbl_pick").innerHTML = pickerHtml(cfg, cfg.used, st.pos, takenMap());
      var d = data(), es = sheetEntries(), full = !firstFree(1);
      $("lbl_add").textContent = st.pos ? "Add to label " + st.pos : "Sheet is full";
      $("lbl_add").disabled = st.busy || !complete(d) || !st.pos || isTaken(st.pos);
      $("lbl_print").textContent = es.length > 1 ? "Print sheet (" + es.length + " labels)" : "Print label";
      $("lbl_print").disabled = st.busy || !es.length; $("lbl_pdf").disabled = !es.length;
      $("lbl_queue").innerHTML = st.queue.slice().sort(function (a, b) { return a.pos - b.pos; }).map(function (e) { return '<li><span class="qn">Label ' + e.pos + '</span><span class="qt"><b>' + esc(e.names) + '</b>' + (e.occasion && e.occasion !== "wedding" ? ', ' + esc(occLabel(e.occasion)) : '') + (e.dateIso ? ', ' + esc(formatDate(e.dateIso, "long")) : '') + (e.occasion === "wedding" && e.venue ? ', ' + esc(e.venue) : '') + '</span><button type="button" class="lbllink" data-unqueue="' + e.pos + '">Remove</button></li>'; }).join("");
      $("lbl_addhint").textContent = full ? "Every label on the sheet has been used." : (st.queue.length ? "Add another label, or press Print sheet to print all of these together." : "Several labels on one sheet? Fill in a label, press Add to label, then do the next one.");
    }
    function msg(kind, text) { $("lbl_msg").innerHTML = text ? '<div class="lblmsg ' + kind + '" role="status">' + text + '</div>' : ""; }
    el.addEventListener("input", paint); paint();
    el.addEventListener("click", function (e) {
      var mb = e.target.closest("[data-mode]"); if (mb) { st.mode = mb.getAttribute("data-mode"); if (other() && !$("lbl_head").value && !$("lbl_msg2").value) { $("lbl_head").value = (OC.other || {}).heading || ""; $("lbl_msg2").value = (OC.other || {}).message || ""; } paint(); return; }
      var wb = e.target.closest("[data-wn]"); if (wb) { st.wn = wb.getAttribute("data-wn"); paint(); return; }
      var ob = e.target.closest("[data-occ]"); if (ob) { st.occ = ob.getAttribute("data-occ"); if (st.occ === "other" && !$("lbl_head").value && !$("lbl_msg2").value) { $("lbl_head").value = (OC.other || {}).heading || ""; $("lbl_msg2").value = (OC.other || {}).message || ""; } paint(); return; }
      var ua = e.target.closest("[data-unqueue]"); if (ua) { var up = +ua.getAttribute("data-unqueue"); st.queue = st.queue.filter(function (q) { return q.pos !== up; }); if (!st.pos || isTaken(st.pos)) st.pos = up; paint(); return; }
      var c = e.target.closest(".lblcell"); if (c && !c.disabled && !isTaken(+c.getAttribute("data-pos"))) { st.pos = +c.getAttribute("data-pos"); paint(); } var vb = e.target.closest(".lblvbtn"); if (vb) { st.venue = vb.getAttribute("data-venue"); paint(); } });
    if ($("lbl_cancel")) $("lbl_cancel").addEventListener("click", function () { opts.onCancel(); });
    $("lbl_add").addEventListener("click", function () {
      var d = data(); if (!complete(d) || !st.pos || isTaken(st.pos)) return;
      st.queue.push(copyOf(d, st.pos));
      var added = st.pos; st.pos = firstFree(added);       // on to the next free label
      $("lbl_p1").value = ""; $("lbl_p2").value = ""; $("lbl_date").value = "";
      msg("ok", "Added to label " + added + (st.pos ? ". Now fill in label " + st.pos + "." : ". The sheet is full: press Print sheet.")); paint(); $("lbl_p1").focus();
    });
    $("lbl_pdf").addEventListener("click", function () {
      var es = sheetEntries(); if (!es.length) return;
      var blob = pdfBlob(renderSheet(cfg, S.bg, es, 0, "label", 300)); var url = URL.createObjectURL(blob); var w = window.open(url, "_blank"); if (!w) location.href = url;
      msg("warn", "Opened as a PDF. Print it at 100% (Actual size) on the label sheet, with " + (es.length === 1 ? "position " + es[0].pos : "position" + (es.length > 1 ? "s " : " ") + es.map(function (x) { return x.pos; }).join(", ")) + " free.");
    });
    $("lbl_print").addEventListener("click", async function () {
      var es = sheetEntries(); if (!es.length || st.busy) return;
      var printer = (cfg.printer && cfg.printer.name) || "Office Printer", plines = es.length === 1
        ? (es[0].occasion === "wedding" ? [["Couple", es[0].names], ["Date", formatDate(es[0].dateIso, "long")], ["Venue", es[0].venue || ""]] : [["Occasion", occLabel(es[0].occasion)], ["Name", es[0].names], ["Wording", (es[0].heading ? es[0].heading + " / " : "") + (es[0].message || "")], ["Date", formatDate(es[0].dateIso, "long")]]).concat([["Position", "Label " + es[0].pos + " on the sheet"], ["Printer", printer]])
        : es.map(function (e) { return ["Label " + e.pos, e.names + (e.occasion !== "wedding" ? " (" + occLabel(e.occasion) + ")" : "") + (e.dateIso ? ", " + formatDate(e.dateIso, "long") : "") + (e.occasion === "wedding" && e.venue ? ", " + e.venue : "")]; }).concat([["Printer", printer]]);
      var go = await confirmPrint({ title: es.length === 1 ? "Send this label to the printer?" : "Send these " + es.length + " labels to the printer?", text: "Check these are right: it will print straight away.", lines: plines.filter(function (l) { return l[1]; }) });
      if (!go) return;
      st.busy = true; paint(); msg("", "Sending to the printer…");
      try {
        var page = renderSheet(cfg, S.bg, es, 0, "label", 300);
        var r = await api("job.create", { names: es.map(function (e) { return e.names; }).join(" / "), date: es[0].dateIso || null, position: es[0].pos, positions: es.map(function (e) { return e.pos; }), page_png: pngBase64(page), kind: "label", source: opts.source || "app", enquiry_id: es.length === 1 ? (opts.enquiryId || null) : null, copies: cfg.printer.copies || 1 });
        es.forEach(function (e) { if (cfg.used.indexOf(e.pos) < 0) cfg.used.push(e.pos); });
        var printedPos = es.map(function (e) { return e.pos; }).join(", "); st.queue = []; if (es.length > 1) { $("lbl_p1").value = ""; $("lbl_p2").value = ""; $("lbl_date").value = ""; st.pos = 1; } paint();      // one label: the selection stays where it is
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
    var ready = mount(bg.querySelector("#lbldlgbody"), { noOccasions: true, names: opts.names, partner1: opts.partner1, partner2: opts.partner2, date: opts.date, venue: opts.venue, source: "wedding-admin", enquiryId: opts.enquiryId, onCancel: close, cancelText: "Close" });
    return { close: close, ready: ready };
  }

  /* "Send to the printer?" - every route to the printer goes through this, so nothing prints by accident. Resolves true only on the Send button. */
  function confirmPrint(o) {
    injectCss(); o = o || {};
    return new Promise(function (resolve) {
      var bg = document.createElement("div"); bg.setAttribute("role", "dialog"); bg.setAttribute("aria-modal", "true");
      bg.style.cssText = "position:fixed;inset:0;background:rgba(38,38,38,.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px";
      var many = (o.lines || []).length > 4;      // eight labels on a sheet: tighter rows, and the list scrolls so the buttons always stay on screen
      var lines = (o.lines || []).map(function (l) { return '<div style="padding:' + (many ? "4px 0" : "7px 0") + ';border-top:1px solid #E7E7E7;font-size:' + (many ? "13.5px" : "15px") + ';line-height:1.35;display:flex;gap:10px"><span style="flex:0 0 ' + (many ? "62px" : "92px") + ';color:#7B887C;font-size:11px;letter-spacing:.08em;text-transform:uppercase;padding-top:2px">' + esc(l[0]) + '</span><span style="flex:1;min-width:0">' + esc(l[1]) + '</span></div>'; }).join("");
      bg.innerHTML = '<div style="background:#fff;border-radius:12px;max-width:' + (many ? "560px" : "440px") + ';width:100%;max-height:calc(100vh - 32px);display:flex;flex-direction:column;padding:18px 20px 16px;box-shadow:0 20px 60px rgba(0,0,0,.4)"><h2 style="margin:0 0 4px;font-size:22px;flex:0 0 auto">' + esc(o.title || "Send to the printer?") + '</h2><p style="margin:0 0 8px;color:#4a4a4a;font-size:13.5px;flex:0 0 auto">' + esc(o.text || "") + '</p><div style="flex:1 1 auto;min-height:0;overflow-y:auto">' + lines + '</div>' +
        '<div class="lblmsg warn" style="margin-top:10px;font-size:12.5px;padding:7px 10px;flex:0 0 auto"><b>Check the paper:</b> Tray 1, labels facing up, labels 1 and 2 (top edge) in first.</div>' +
        '<div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;flex:0 0 auto"><button type="button" id="cp_go" class="btn" style="flex:1 1 160px">' + esc(o.button || "Send to printer") + '</button><button type="button" id="cp_no" class="btn ghost" style="flex:1 1 120px">Cancel</button></div></div>';
      document.body.appendChild(bg);
      function done(v) { document.removeEventListener("keydown", onKey, true); if (bg.parentNode) bg.parentNode.removeChild(bg); resolve(v); }
      function onKey(e) { if (e.key === "Escape") { e.stopPropagation(); done(false); } }
      document.addEventListener("keydown", onKey, true);
      bg.querySelector("#cp_go").addEventListener("click", function () { done(true); });
      bg.querySelector("#cp_no").addEventListener("click", function () { done(false); });
      bg.addEventListener("mousedown", function (e) { if (e.target === bg) done(false); });
      setTimeout(function () { var n = bg.querySelector("#cp_no"); if (n) n.focus(); }, 30);      // Enter cancels by default: sending takes a deliberate press
    });
  }

  async function testPrint(position) {
    var S = await load(); var page = renderSheet(S.settings, S.bg, {}, 1, "test", 300);
    return api("job.create", { names: "Alignment test", position: position || 1, page_png: pngBase64(page), kind: "test", source: "app" });
  }
  window.BHBLabel = { api: api, load: load, state: ST, DEFAULTS: DEFAULTS, merge: merge, clone: clone, formatDate: formatDate, joinNames: joinNames, splitNames: splitNames, cellOrigin: cellOrigin, renderSheet: renderSheet, renderLabelOnly: renderLabelOnly, pngBase64: pngBase64, pdfBlob: pdfBlob, pickerHtml: pickerHtml, mount: mount, openDialog: openDialog, testPrint: testPrint, confirmPrint: confirmPrint, loadingHelpHtml: loadingHelpHtml, setDesignImage: setDesignImage, loadFonts: loadFonts, NAME_FONTS: NAME_FONTS, esc: esc, injectCss: injectCss };
})();
