/* The weekly front sheet: one A4 page to pin on the wall listing every wedding and event booked in for a Monday-to-Sunday week
   (room, name, day and evening numbers). Drawn here in the browser (what you see is what prints), queued through label-api as a job of kind
   "sheet" and printed by the same print agent and printer as the prosecco labels. Needs label-core.js first (BHBLabel.api).
   Used from Weddings and events > Overview: BHBFrontSheet.open(). */
(function () {
  "use strict";
  var W = 297, H = 210, PX = 300 / 25.4;   // the sheet is drawn LANDSCAPE; forPrinter() turns it onto the portrait page the print agent sends
  var INK = "#1F2A21", GREEN = "#4D604F", GREY = "#5F6A62", BAND = "#E4EAE2", TINT = "#F3F6F1", RULE = "#B9C3B7", WARN = "#A0302A";
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var FONT = "Raleway, 'Segoe UI', Arial, sans-serif";

  function parse(ymd) { var p = String(ymd).split("-"); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12)); }
  function rangeText(from, to) {
    var a = parse(from), b = parse(to), same = a.getUTCFullYear() === b.getUTCFullYear(), sameM = same && a.getUTCMonth() === b.getUTCMonth();
    return DOW[a.getUTCDay()] + " " + a.getUTCDate() + (sameM ? "" : " " + MONTHS[a.getUTCMonth()]) + (same ? "" : " " + a.getUTCFullYear()) + " \u2013 " +
      DOW[b.getUTCDay()] + " " + b.getUTCDate() + " " + MONTHS[b.getUTCMonth()] + " " + b.getUTCFullYear();
  }
  function shortRange(from, to) {
    var a = parse(from), b = parse(to);
    return a.getUTCDate() + (a.getUTCMonth() === b.getUTCMonth() ? "" : " " + MONTHS[a.getUTCMonth()].slice(0, 3)) + " \u2013 " + b.getUTCDate() + " " + MONTHS[b.getUTCMonth()].slice(0, 3) + " " + b.getUTCFullYear();
  }
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function setFont(ctx, mm, weight) { ctx.font = weight + " " + (mm * PX) + "px " + FONT; }
  function text(ctx, s, x, y, mm, weight, color, align, base) { setFont(ctx, mm, weight); ctx.fillStyle = color; ctx.textAlign = align || "left"; ctx.textBaseline = base || "middle"; ctx.fillText(s, x * PX, y * PX); }
  function spaced(ctx, s, x, y, mm, weight, color, spacingEm, align) { try { ctx.letterSpacing = (spacingEm * mm * PX) + "px"; } catch (e) {} text(ctx, s, x, y, mm, weight, color, align || "left"); try { ctx.letterSpacing = "0px"; } catch (e) {} }
  function rect(ctx, x, y, w, h, fill, stroke, lw) { if (fill) { ctx.fillStyle = fill; ctx.fillRect(x * PX, y * PX, w * PX, h * PX); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = (lw || 0.3) * PX; ctx.strokeRect(x * PX, y * PX, w * PX, h * PX); } }

  /** Words wrapped to a width (mm); a word that is too long on its own is cut. At most maxLines, the last one ending "..." if there is more. */
  function wrap(ctx, str, widthMm, mm, weight, maxLines) {
    setFont(ctx, mm, weight);
    var max = widthMm * PX, words = String(str).split(/\s+/).filter(Boolean), lines = [], cur = "";
    function push(l) { lines.push(l); }
    words.forEach(function (w) {
      while (ctx.measureText(w).width > max && w.length > 1) { var k = w.length; while (k > 1 && ctx.measureText(w.slice(0, k)).width > max) k--; if (cur) { push(cur); cur = ""; } push(w.slice(0, k)); w = w.slice(k); }
      var t = cur ? cur + " " + w : w;
      if (ctx.measureText(t).width <= max) cur = t; else { if (cur) push(cur); cur = w; }
    });
    if (cur) push(cur);
    if (lines.length > maxLines) { lines = lines.slice(0, maxLines); var l = lines[maxLines - 1]; while (l.length > 1 && ctx.measureText(l + "\u2026").width > max) l = l.slice(0, -1); lines[maxLines - 1] = l.replace(/\s+$/, "") + "\u2026"; }
    return lines;
  }

  var MARGIN = 10, VENUE_W = 31, MAINS = ["Marquee", "George Ridley"];

  /** The rooms down the side: the two big rooms always, then any other room used this week (A-Z), then events with no room. */
  function roomRows(sheet) {
    var used = {}, noRoom = false;
    sheet.days.forEach(function (d) { d.events.forEach(function (e) { if (e.room) used[e.room] = true; else noRoom = true; }); });
    var others = Object.keys(used).filter(function (r) { return MAINS.indexOf(r) < 0; }).sort();
    var rows = MAINS.concat(others).map(function (r) { return { key: r, label: r, warn: false }; });
    if (noRoom) rows.push({ key: "", label: "Room not set", warn: true });
    return rows;
  }

  /** Draws the page (landscape A4) and returns the canvas. sheet = frontsheet.data's sheet; opts.printedAt overrides "now" (tests). */
  function render(sheet, opts) {
    opts = opts || {};
    var cv = document.createElement("canvas"); cv.width = Math.round(W * PX); cv.height = Math.round(H * PX);
    var ctx = cv.getContext("2d");
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, cv.width, cv.height);

    // header
    spaced(ctx, "THE BLACK HORSE, BEAMISH", MARGIN, MARGIN + 2, 3.4, 700, GREEN, 0.18);
    text(ctx, "This week\u2019s weddings & events", MARGIN, MARGIN + 10, 9, 700, INK);
    text(ctx, rangeText(sheet.from, sheet.to), W - MARGIN, MARGIN + 9.4, 6.4, 600, GREEN, "right");

    var gx = MARGIN + VENUE_W, gw = W - MARGIN - gx, colW = gw / 7, headY = MARGIN + 17, headH = 11.5, top = headY + headH, bottom = H - MARGIN - 7, avail = bottom - top;
    var rows = roomRows(sheet);

    // box layout at a given scale: name wrapped, then the day / evening totals
    function box(e, s) {
      var pad = 1.7 * s, inner = colW - 2 * pad - 2.4 - 1.4, nameMm = 5.1 * s;
      var longest = String(e.name).split(/\s+/).reduce(function (m, w) { return w.length > m.length ? w : m; }, "");
      for (var t = 0; t < 12; t++) { setFont(ctx, nameMm, 700); if (ctx.measureText(longest).width <= inner * PX) break; nameMm *= 0.93; }   // a word is never cut in half: the name gets smaller instead
      var lh = nameMm * 1.17, lines = wrap(ctx, e.name, inner, nameMm, 700, 4), hasNum = e.guests_day != null || e.guests_evening != null;
      return { e: e, lines: lines, nameMm: nameMm, lh: lh, pad: pad, hasNum: hasNum, h: pad * 2 + lines.length * lh + (hasNum ? 1.3 * s + 8.6 * s : 0) };
    }
    function layout(s) {
      var gap = 1.4 * s, total = 0;
      var need = rows.map(function (r) {
        var cells = sheet.days.map(function (d) { var bs = d.events.filter(function (e) { return (e.room || "") === r.key; }).map(function (e) { return box(e, s); }); return bs; });
        var h = Math.max.apply(null, cells.map(function (bs) { return bs.length ? bs.reduce(function (t, b) { return t + b.h + gap; }, gap) : 0; }).concat([18 * s]));
        total += h; return { cells: cells, h: h, gap: gap };
      });
      return { need: need, total: total };
    }
    var s = 1.3, L = layout(s);
    while (L.total > avail && s > 0.4) { s = Math.round((s - 0.05) * 100) / 100; L = layout(s); }
    var extra = Math.max(0, avail - L.total) / rows.length;

    // day header
    rect(ctx, MARGIN, headY, VENUE_W, headH, GREEN);
    spaced(ctx, "ROOM", MARGIN + 2.5, headY + headH / 2, 3.2, 700, "#FFFFFF", 0.14);
    sheet.days.forEach(function (d, i) {
      var x = gx + i * colW, dt = parse(d.date);
      rect(ctx, x, headY, colW, headH, GREEN, "#FFFFFF", 0.3);
      spaced(ctx, DOW[dt.getUTCDay()].toUpperCase(), x + colW / 2, headY + 4.1, 3.7, 700, "#FFFFFF", 0.1, "center");
      text(ctx, dt.getUTCDate() + " " + MONTHS[dt.getUTCMonth()].slice(0, 3), x + colW / 2, headY + 8.5, 3.6, 500, "#FFFFFF", "center");
    });

    // rows
    var y = top;
    rows.forEach(function (r, ri) {
      var rh = L.need[ri].h + extra, gap = L.need[ri].gap;
      rect(ctx, MARGIN, y, VENUE_W, rh, BAND, RULE, 0.3);
      var vl = wrap(ctx, r.label, VENUE_W - 5, 5.2 * Math.min(1.1, Math.max(0.8, s)), 700, 3), vm = 5.2 * Math.min(1.1, Math.max(0.8, s));
      vl.forEach(function (ln, i) { text(ctx, ln, MARGIN + 2.5, y + rh / 2 + (i - (vl.length - 1) / 2) * vm * 1.2, vm, 700, r.warn ? WARN : GREEN); });
      sheet.days.forEach(function (d, i) {
        var x = gx + i * colW; rect(ctx, x, y, colW, rh, "#FFFFFF", RULE, 0.3);
        var by = y + gap, cell = L.need[ri].cells[i], bh = cell.length ? (rh - gap * (cell.length + 1)) / cell.length : 0;   // the boxes in a cell share its height
        cell.forEach(function (b) {
          var bx = x + 1.2, bw = colW - 2.4, h = Math.max(b.h, bh);
          rect(ctx, bx, by, bw, h, TINT, GREEN, 0.3); rect(ctx, bx, by, 1.4, h, r.warn ? WARN : GREEN);
          b.lines.forEach(function (ln, k) { text(ctx, ln, bx + 1.4 + b.pad, by + b.pad + b.lh * (k + 0.5), b.nameMm, 700, INK); });
          if (b.hasNum) {
            var half = (bw - 1.4 - b.pad) / 2, nx = bx + 1.4 + b.pad, ny = by + h - b.pad - 8.3 * s, lab = Math.min(3.0 * s, 2.8);
            [["DAY", b.e.guests_day], ["EVENING", b.e.guests_evening]].forEach(function (c, k) {
              if (c[1] == null) return;
              var lm = lab; setFont(ctx, lm, 700); while (lm > 1.2 && ctx.measureText(c[0]).width > (half - 0.8) * PX * 0.92) { lm *= 0.93; setFont(ctx, lm, 700); }
              spaced(ctx, c[0], nx + k * half, ny + 1.2 * s, lm, 700, GREY, 0.06);
              text(ctx, String(c[1]), nx + k * half, ny + 5.6 * s, 5.8 * s, 700, INK);
            });
          }
          by += h + gap;
        });
      });
      y += rh;
    });

    var when = opts.printedAt || new Date().toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    text(ctx, "Printed " + when + ", from the events tracker and Guestline. Day and evening are separate totals (the evening figure usually includes the day guests who stay on).", MARGIN, H - MARGIN + 1.5, 2.6, 500, GREY);
    return cv;
  }
  /** The landscape sheet turned onto the portrait A4 page the print agent sends: the top of the sheet is the left edge of the page, so the sheet reads upright when held landscape. */
  function forPrinter(land) {
    var cv = document.createElement("canvas"); cv.width = land.height; cv.height = land.width;
    var c = cv.getContext("2d"); c.fillStyle = "#FFFFFF"; c.fillRect(0, 0, cv.width, cv.height);
    c.translate(0, cv.height); c.rotate(-Math.PI / 2); c.drawImage(land, 0, 0);
    return cv;
  }
  function pngBase64(cv) { return cv.toDataURL("image/png").replace(/^data:image\/png;base64,/, ""); }

  function ready() { return Promise.all(["400", "500", "600", "700"].map(function (w) { return document.fonts && document.fonts.load ? document.fonts.load(w + " 20px Raleway").catch(function () {}) : null; })); }

  // ------------------------------------------------------------------ the dialog: draws, sends to the printer straight away, shows what happened
  function open(opts) {
    opts = opts || {};
    var L = window.BHBLabel; if (!L || !L.api) throw new Error("The printer could not be loaded just now.");
    var st = { from: opts.from || "", sheet: null, printedFrom: "", job: null, timer: null, closed: false };
    var bg = document.createElement("div");
    bg.style.cssText = "position:fixed;inset:0;background:rgba(38,38,38,.55);z-index:9998;display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto";
    bg.innerHTML = '<div role="dialog" aria-modal="true" style="background:#fff;border-radius:12px;max-width:760px;width:100%;max-height:96vh;overflow:auto;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.35)">' +
      '<h2 style="margin:0 0 4px;font-size:24px">Weekly front sheet</h2><div id="fsRange" class="muted" style="margin:0 0 10px"></div>' +
      '<div id="fsStatus" style="margin:0 0 12px;line-height:1.45;font-weight:600"></div>' +
      '<div style="text-align:center;margin-bottom:14px"><img id="fsImg" alt="Preview of the front sheet" style="max-width:100%;max-height:58vh;border:1px solid #ddd;display:none"></div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" id="fsPrev">&larr; Week before</button><button class="btn" id="fsNext">Next week &rarr;</button><button class="btn btn--primary" id="fsPrint" hidden>Print this week</button><button class="btn" id="fsClose" style="margin-left:auto">Close</button></div></div>';
    document.body.appendChild(bg);
    var $ = function (id) { return bg.querySelector("#" + id); };
    function status(msg, tone) { var e = $("fsStatus"); e.textContent = msg; e.style.color = tone === "bad" ? "#A0302A" : tone === "ok" ? "#2F6B3A" : "inherit"; }
    function close() { st.closed = true; if (st.timer) clearTimeout(st.timer); if (bg.parentNode) bg.parentNode.removeChild(bg); }
    $("fsClose").onclick = close;
    bg.addEventListener("click", function (ev) { if (ev.target === bg) close(); });

    function addDaysYmd(ymd, n) { var d = parse(ymd); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
    function setPrintButton() { var b = $("fsPrint"); b.hidden = !st.sheet; b.textContent = st.printedFrom === st.sheet.from ? "Print this one again" : "Print this week"; }

    async function draw(from) {
      status("Reading the week’s bookings…"); $("fsImg").style.display = "none";
      var d = await L.api("frontsheet.data", from ? { from: from } : {});
      if (st.closed) return null;
      st.sheet = d.sheet; st.from = d.sheet.from; st.agentOnline = d.agent_online; st.printer = d.printer;
      await ready();
      var cv = render(d.sheet); st.cv = cv;
      $("fsImg").src = cv.toDataURL("image/png"); $("fsImg").style.display = "inline-block";
      $("fsRange").textContent = rangeText(d.sheet.from, d.sheet.to) + " · " + d.sheet.total_events + " booked" + (d.sheet.no_room ? " · " + d.sheet.no_room + " with no room set (fill it in on the events tracker)" : "");
      setPrintButton();
      return d;
    }
    async function send() {
      if (!st.sheet) return;
      $("fsPrint").disabled = true;
      try {
        status("Sending to the printer…");
        var r = await L.api("job.create", { kind: "sheet", names: "Weekly front sheet " + shortRange(st.sheet.from, st.sheet.to), date: st.sheet.from, page_png: pngBase64(forPrinter(st.cv)), copies: 1, source: "wedding-admin" });
        st.printedFrom = st.sheet.from; st.job = r.id; setPrintButton();
        status(r.agent_online ? "Sent to the " + (st.printer || "Office Printer") + ". Waiting for it to print…" : "Queued, but the print PC has not checked in just now, so it will print when that PC is on and the print program is running.", r.agent_online ? "" : "bad");
        poll(0);
      } catch (e) { status(e.message || "That could not be sent.", "bad"); }
      $("fsPrint").disabled = false;
    }
    function poll(n) {
      if (st.closed || !st.job) return;
      st.timer = setTimeout(async function () {
        try {
          var j = await L.api("job.status", { id: st.job }), s = j.job && j.job.status;
          if (s === "printed") return status("Printed on the " + (st.printer || "Office Printer") + ".", "ok");
          if (s === "failed") return status("The printer reported a problem: " + ((j.job && j.job.error) || "unknown") + ". You can print it again.", "bad");
          if (s === "cancelled") return status("That print was cancelled.", "bad");
          if (n > 40) return status("Still waiting for the printer. It is queued and will print when the print PC picks it up (see Prosecco Labels > Sent to print).", "bad");
          if (s === "printing") status("Printing…");
        } catch (e) { /* keep trying */ }
        poll(n + 1);
      }, 2500);
    }
    $("fsPrint").onclick = send;
    $("fsPrev").onclick = function () { st.job = null; draw(addDaysYmd(st.from, -7)).catch(function (e) { status(e.message, "bad"); }); };
    $("fsNext").onclick = function () { st.job = null; draw(addDaysYmd(st.from, 7)).catch(function (e) { status(e.message, "bad"); }); };

    // straight away: draw this week and send it
    draw(st.from).then(function (d) { if (d && !st.closed) return send(); }).catch(function (e) { status(e.message || "The front sheet could not be made.", "bad"); });
    return { close: close };
  }

  window.BHBFrontSheet = { open: open, render: render, forPrinter: forPrinter, rangeText: rangeText };
})();
