/* The weekly front sheet: one A4 page to pin on the wall listing every wedding and event booked in for a Monday-to-Sunday week
   (room, name, day and evening numbers). Drawn here in the browser (what you see is what prints), queued through label-api as a job of kind
   "sheet" and printed by the same print agent and printer as the prosecco labels. Needs label-core.js first (BHBLabel.api).
   Used from Weddings and events > Overview: BHBFrontSheet.open(). */
(function () {
  "use strict";
  var W = 210, H = 297, PX = 300 / 25.4;
  var INK = "#1F2A21", GREEN = "#4D604F", GREY = "#5F6A62", BAND = "#EAEEE8", RULE = "#C5CDC4", WARN = "#A0302A";
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var FONT = "Raleway, 'Segoe UI', Arial, sans-serif";

  function parse(ymd) { var p = String(ymd).split("-"); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12)); }
  function longDay(ymd) { var d = parse(ymd); return DOW[d.getUTCDay()] + " " + d.getUTCDate() + " " + MONTHS[d.getUTCMonth()]; }
  function rangeText(from, to) {
    var a = parse(from), b = parse(to), same = a.getUTCFullYear() === b.getUTCFullYear(), sameM = same && a.getUTCMonth() === b.getUTCMonth();
    return DOW[a.getUTCDay()] + " " + a.getUTCDate() + (sameM ? "" : " " + MONTHS[a.getUTCMonth()]) + (same ? "" : " " + a.getUTCFullYear()) + " – " +
      DOW[b.getUTCDay()] + " " + b.getUTCDate() + " " + MONTHS[b.getUTCMonth()] + " " + b.getUTCFullYear();
  }
  function shortRange(from, to) {
    var a = parse(from), b = parse(to);
    return a.getUTCDate() + (a.getUTCMonth() === b.getUTCMonth() ? "" : " " + MONTHS[a.getUTCMonth()].slice(0, 3)) + " – " + b.getUTCDate() + " " + MONTHS[b.getUTCMonth()].slice(0, 3) + " " + b.getUTCFullYear();
  }
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  /** Font that shrinks (down to 60%) and then trims with an ellipsis until the text fits the width (all sizes in mm). */
  function fitText(ctx, text, maxW, mm, weight) {
    var size = mm;
    for (var i = 0; i < 12; i++) { ctx.font = weight + " " + (size * PX) + "px " + FONT; if (ctx.measureText(text).width <= maxW * PX || size <= mm * 0.6) break; size *= 0.92; }
    var t = String(text);
    while (t.length > 1 && ctx.measureText(t).width > maxW * PX) t = t.slice(0, -1);
    return t === String(text) ? t : t.replace(/\s+$/, "") + "…";
  }
  function text(ctx, s, x, y, mm, weight, color, align) { ctx.font = weight + " " + (mm * PX) + "px " + FONT; ctx.fillStyle = color; ctx.textAlign = align || "left"; ctx.textBaseline = "middle"; ctx.fillText(s, x * PX, y * PX); }
  function spaced(ctx, s, x, y, mm, weight, color, spacingEm) { try { ctx.letterSpacing = (spacingEm * mm * PX) + "px"; } catch (e) {} text(ctx, s, x, y, mm, weight, color, "left"); try { ctx.letterSpacing = "0px"; } catch (e) {} }

  var COL = { left: 14, room: 17, name: 62, dayR: 164, eveR: 195, right: 196 };

  /** Draws the page and returns the canvas. sheet = the frontsheet.data result's sheet; opts.printedAt overrides "now" (tests). */
  function render(sheet, opts) {
    opts = opts || {};
    var cv = document.createElement("canvas"); cv.width = Math.round(W * PX); cv.height = Math.round(H * PX);
    var ctx = cv.getContext("2d");
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, cv.width, cv.height);

    // header
    var y = 15;
    spaced(ctx, "THE BLACK HORSE, BEAMISH", COL.left, y + 2, 3.6, 700, GREEN, 0.18);
    text(ctx, "This week’s weddings & events", COL.left, y + 11.5, 9.5, 700, INK);
    text(ctx, rangeText(sheet.from, sheet.to), COL.left, y + 21, 6.2, 600, GREEN);
    ctx.fillStyle = GREEN; ctx.fillRect(COL.left * PX, (y + 27) * PX, (COL.right - COL.left) * PX, 0.8 * PX);

    // column heads
    var headY = y + 32.5;
    spaced(ctx, "ROOM", COL.room, headY, 3.2, 700, GREY, 0.14); spaced(ctx, "EVENT", COL.name, headY, 3.2, 700, GREY, 0.14);
    text(ctx, "DAY", COL.dayR, headY, 3.2, 700, GREY, "right"); text(ctx, "EVENING", COL.eveR, headY, 3.2, 700, GREY, "right");

    // size everything to fit one page
    var top = headY + 5, bottom = H - 14 - 10, avail = bottom - top;
    var DH = 8.4, RH = 12.6, GAP = 2.2;
    var need = sheet.days.reduce(function (s, d) { return s + DH + d.events.length * RH + GAP; }, 0);
    var k = Math.max(0.42, Math.min(1.8, avail / Math.max(1, need)));   // row height scale
    var fk = Math.min(k, 1.35);                                          // type scale: bigger than this and the columns collide, so a quiet week gets taller rows, not wider type
    y = top;
    sheet.days.forEach(function (d) {
      var dh = DH * k;
      ctx.fillStyle = BAND; ctx.fillRect(COL.left * PX, y * PX, (COL.right - COL.left) * PX, dh * PX);
      text(ctx, longDay(d.date).toUpperCase(), COL.room, y + dh / 2, 4.6 * fk, 700, GREEN);
      if (!d.events.length) text(ctx, "Nothing booked", COL.eveR - 1, y + dh / 2, 3.9 * fk, 500, GREY, "right");
      y += dh;
      d.events.forEach(function (e, i) {
        var rh = RH * k, cy = y + rh / 2;
        var room = e.room || "Room not set";
        ctx.fillStyle = e.room ? GREEN : WARN; ctx.textAlign = "left"; ctx.textBaseline = "middle";
        var rt = fitText(ctx, room, COL.name - COL.room - 3, 4.9 * fk, 700); ctx.fillText(rt, COL.room * PX, cy * PX);
        var nt = fitText(ctx, e.name, COL.dayR - 22 - COL.name, 6.9 * fk, 700); ctx.fillStyle = INK; ctx.textAlign = "left"; ctx.fillText(nt, COL.name * PX, cy * PX);
        text(ctx, e.guests_day == null ? "–" : String(e.guests_day), COL.dayR, cy, 7.4 * fk, 700, e.guests_day == null ? RULE : INK, "right");
        text(ctx, e.guests_evening == null ? "–" : String(e.guests_evening), COL.eveR, cy, 7.4 * fk, 700, e.guests_evening == null ? RULE : INK, "right");
        ctx.fillStyle = RULE; ctx.fillRect(COL.left * PX, (y + rh) * PX - 1, (COL.right - COL.left) * PX, 2);
        y += rh;
      });
      y += GAP * k;
    });

    // footer
    var when = opts.printedAt || new Date().toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    text(ctx, "Printed " + when + ", from the events tracker and Guestline.", COL.left, H - 17.5, 2.8, 500, GREY);
    text(ctx, "Day and evening are separate totals: the evening figure usually includes the day guests who stay on.", COL.left, H - 14, 2.8, 500, GREY);
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
        var r = await L.api("job.create", { kind: "sheet", names: "Weekly front sheet " + shortRange(st.sheet.from, st.sheet.to), date: st.sheet.from, page_png: pngBase64(st.cv), copies: 1, source: "wedding-admin" });
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

  window.BHBFrontSheet = { open: open, render: render, rangeText: rangeText };
})();
