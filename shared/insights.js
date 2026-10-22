/* Small chart helpers shared by Guest Feedback and the Team Survey results. No libraries: every chart is plain HTML or inline SVG and takes its colours
   from the page's CSS variables (--sage, --gold, --alert, --good, --mist, --ink, --sage-70), so it follows whatever look the page has.
   Each function returns an HTML string; the page decides where it goes. */
(function () {
  var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var avg = function (a) { return a.length ? a.reduce(function (t, x) { return t + x; }, 0) / a.length : null; };
  var f1 = function (n) { return n == null ? "–" : (Math.round(n * 10) / 10).toFixed(1); };
  var f2 = function (n) { return n == null ? "–" : (Math.round(n * 100) / 100).toFixed(2); };

  /* Horizontal bars. items: [{label, value, note?, tone?}], scale 0..max. tone: "good" | "warn" | "bad" | undefined (picked from value when auto). */
  function bars(items, o) {
    o = o || {}; var max = o.max || 5, lo = o.lo == null ? 3 : o.lo, hi = o.hi == null ? 4 : o.hi;
    if (!items.length) return '<div class="vz-empty">Nothing to show yet.</div>';
    return '<div class="vz-bars">' + items.map(function (it) {
      var v = it.value, w = v == null ? 0 : Math.max(0, Math.min(100, v / max * 100));
      var tone = it.tone || (v == null ? "" : v >= hi ? "good" : v >= lo ? "warn" : "bad");
      return '<div class="vz-row"><div class="vz-lab" title="' + esc(it.label) + '">' + esc(it.label) + '</div><div class="vz-track"><div class="vz-fill ' + tone + '" style="width:' + w + '%"></div></div><div class="vz-val">' + (o.fmt ? o.fmt(v) : f1(v)) + (it.note ? '<small>' + esc(it.note) + '</small>' : '') + '</div></div>';
    }).join("") + '</div>';
  }

  /* Histogram for 1..5 (or any list of counts). */
  function hist(counts, labels) {
    var m = Math.max.apply(null, counts.concat([1]));
    return '<div class="vz-hist">' + counts.map(function (c, i) {
      return '<div class="vz-hcol"><div class="vz-hbar"><span style="height:' + (c / m * 100) + '%"></span></div><div class="vz-hn">' + c + '</div><div class="vz-hl">' + esc(labels ? labels[i] : i + 1) + '</div></div>';
    }).join("") + '</div>';
  }

  /* Net Promoter Score: one stacked bar of detractors / passives / promoters. */
  function npsBar(pro, pas, det) {
    var n = pro + pas + det; if (!n) return '<div class="vz-empty">No recommend scores yet.</div>';
    var p = function (x) { return (x / n * 100).toFixed(1); };
    return '<div class="vz-nps"><span class="det" style="width:' + p(det) + '%" title="Detractors (0-6)">' + (det / n >= .08 ? Math.round(det / n * 100) + '%' : '') + '</span><span class="pas" style="width:' + p(pas) + '%" title="Passives (7-8)">' + (pas / n >= .08 ? Math.round(pas / n * 100) + '%' : '') + '</span><span class="pro" style="width:' + p(pro) + '%" title="Promoters (9-10)">' + (pro / n >= .08 ? Math.round(pro / n * 100) + '%' : '') + '</span></div>' +
      '<div class="vz-key"><span><i class="det"></i>Detractors 0-6 (' + det + ')</span><span><i class="pas"></i>Passives 7-8 (' + pas + ')</span><span><i class="pro"></i>Promoters 9-10 (' + pro + ')</span></div>';
  }

  /* Line chart. series: [{name, color, values:[number|null]}], labels: x labels. o: {min, max, ticks, fmt}. */
  function line(series, labels, o) {
    o = o || {}; var W = 640, H = 230, L = 40, R = 14, T = 12, B = 34, min = o.min == null ? 1 : o.min, max = o.max == null ? 5 : o.max, ticks = o.ticks || 4;
    if (!labels.length) return '<div class="vz-empty">Nothing to show yet.</div>';
    var x = function (i) { return labels.length === 1 ? L + (W - L - R) / 2 : L + i * (W - L - R) / (labels.length - 1); };
    var y = function (v) { return T + (max - v) / (max - min) * (H - T - B); };
    var s = '<svg class="vz-line" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.label || "Trend chart") + '">';
    for (var t = 0; t <= ticks; t++) {
      var tv = min + (max - min) * t / ticks, ty = y(tv);
      s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + ty + '" y2="' + ty + '" stroke="var(--mist)"/><text x="' + (L - 6) + '" y="' + (ty + 4) + '" text-anchor="end" font-size="11" fill="var(--sage-70)">' + (Math.round(tv * 10) / 10) + '</text>';
    }
    labels.forEach(function (lb, i) { s += '<text x="' + x(i) + '" y="' + (H - 12) + '" text-anchor="middle" font-size="11" fill="var(--sage-70)">' + esc(lb) + '</text>'; });
    series.forEach(function (se) {
      var pts = [], d = "";
      se.values.forEach(function (v, i) { if (v == null) return; pts.push([x(i), y(v), v, i]); });
      pts.forEach(function (p, k) { d += (k ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); });
      if (pts.length > 1) s += '<path d="' + d + '" fill="none" stroke="' + se.color + '" stroke-width="2.5" stroke-linejoin="round"/>';
      pts.forEach(function (p) { s += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="4" fill="' + se.color + '"><title>' + esc(se.name + ", " + labels[p[3]] + ": " + (o.fmt ? o.fmt(p[2]) : f1(p[2]))) + '</title></circle>'; });
    });
    s += '</svg>';
    if (series.length > 1) s += '<div class="vz-key">' + series.map(function (se) { return '<span><i style="background:' + se.color + '"></i>' + esc(se.name) + '</span>'; }).join("") + '</div>';
    return s;
  }

  /* ---------------------------------------------------------------- words */
  var STOP = ("a about above after again all also am an and any are as at be because been before being below between both but by can cant could did do does doing dont down during each few for from further " +
    "get got had has have having he her here hers him his how i if in into is it its just me more most my no nor not now of off on once only or other our out over own same she should so some such than that the their them then there these they this those " +
    "through to too under until up us very was we well were what when where which while who whom why will with would you your youre ive weve were thats theres really quite bit lot much many one two just also still even though thing things went came come back " +
    "us our said say like get got going go went take took make made put").split(/\s+/);
  var stopSet = {}; STOP.forEach(function (w) { stopSet[w] = 1; });
  var POS = "amazing excellent lovely friendly brilliant fantastic delicious great wonderful perfect beautiful superb helpful kind welcoming warm attentive polite clean comfortable stunning cosy tasty fresh gorgeous best love loved enjoyed enjoy happy pleasant fabulous outstanding superb professional efficient quick supported appreciated recognised respect respected fair good nice".split(" ");
  var NEG = "poor slow cold rude dirty disappointing disappointed awful terrible bad worst stressed stress stressful tired exhausted understaffed rushed late wrong problem problems broken noisy dated overpriced expensive ignored unfair lack lacking never waiting waited mistake mistakes complaint unhelpful bullying pressure overworked short shortage".split(" ");
  var posSet = {}, negSet = {}; POS.forEach(function (w) { posSet[w] = 1; }); NEG.forEach(function (w) { negSet[w] = 1; });

  function topWords(texts, n) {
    var c = {};
    texts.forEach(function (t) {
      var seen = {};
      String(t || "").toLowerCase().replace(/[’']/g, "").split(/[^a-z]+/).forEach(function (w) {
        if (w.length < 3 || stopSet[w] || seen[w]) return; seen[w] = 1; c[w] = (c[w] || 0) + 1;
      });
    });
    var arr = Object.keys(c).map(function (w) { return { w: w, n: c[w] }; });
    var min = arr.length > 40 ? 2 : 1;
    return arr.filter(function (x) { return x.n >= min; }).sort(function (a, b) { return b.n - a.n || (a.w < b.w ? -1 : 1); }).slice(0, n || 60);
  }
  var hash = function (s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  /* Word cloud from free text. Size follows how many answers use the word; green and red tints mark clearly positive and negative words. */
  function cloud(texts, o) {
    o = o || {}; var words = topWords(texts, o.max || 60);
    if (!words.length) return '<div class="vz-empty">Not enough written comments for a word cloud yet.</div>';
    var top = words[0].n, lo = words[words.length - 1].n;
    var shown = words.slice().sort(function (a, b) { return hash(a.w) - hash(b.w); });
    return '<div class="vz-cloud">' + shown.map(function (x) {
      var k = top === lo ? .5 : (x.n - lo) / (top - lo), size = Math.round(13 + k * 27), tone = posSet[x.w] ? "pos" : negSet[x.w] ? "neg" : "";
      return '<span class="vz-w ' + tone + '" style="font-size:' + size + 'px" title="' + x.n + (x.n === 1 ? ' answer' : ' answers') + '">' + esc(x.w) + '</span>';
    }).join(" ") + '</div><div class="vz-key"><span><i class="pro"></i>Positive words</span><span><i class="det"></i>Negative words</span><span>Bigger = used in more answers</span></div>';
  }
  /* Counts of clearly positive and negative words, for a quick read of the mood of the comments. */
  function mood(texts) {
    var p = 0, n = 0;
    texts.forEach(function (t) { String(t || "").toLowerCase().replace(/[’']/g, "").split(/[^a-z]+/).forEach(function (w) { if (posSet[w]) p++; else if (negSet[w]) n++; }); });
    return { pos: p, neg: n };
  }

  /* ---------------------------------------------------------------- csv */
  var cell = function (v) { v = v == null ? "" : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  function csv(rows, filename) {
    var text = "﻿" + rows.map(function (r) { return r.map(cell).join(","); }).join("\r\n");
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" })); a.download = filename;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  var css = ".vz-empty{color:var(--sage-70);font-size:14px;padding:12px 0}" +
    ".vz-bars{display:flex;flex-direction:column;gap:9px}.vz-row{display:grid;grid-template-columns:minmax(110px,38%) 1fr 64px;gap:10px;align-items:center;font-size:13.5px}" +
    ".vz-lab{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.vz-track{background:var(--mist);border-radius:99px;height:12px;overflow:hidden}.vz-fill{height:100%;border-radius:99px;background:var(--sage-70)}" +
    ".vz-fill.good{background:var(--good)}.vz-fill.warn{background:var(--olive)}.vz-fill.bad{background:var(--alert)}.vz-val{text-align:right;font-weight:600;font-variant-numeric:tabular-nums}.vz-val small{display:block;font-weight:400;color:var(--sage-70);font-size:11px}" +
    ".vz-hist{display:flex;gap:10px;align-items:flex-end}.vz-hcol{flex:1;text-align:center;font-size:12px}.vz-hbar{height:70px;display:flex;align-items:flex-end;background:var(--sage-10);border-radius:6px;overflow:hidden}.vz-hbar span{display:block;width:100%;background:var(--sage-70)}.vz-hn{font-weight:600;margin-top:3px}.vz-hl{color:var(--sage-70)}" +
    ".vz-nps{display:flex;height:30px;border-radius:8px;overflow:hidden;font-size:12px;font-weight:700;color:#fff}.vz-nps span{display:flex;align-items:center;justify-content:center;min-width:0}" +
    ".vz-nps .det,.vz-key i.det{background:var(--alert)}.vz-nps .pas,.vz-key i.pas{background:var(--olive)}.vz-nps .pro,.vz-key i.pro{background:var(--good)}" +
    ".vz-key{display:flex;gap:6px 16px;flex-wrap:wrap;margin-top:8px;font-size:12px;color:var(--sage-70)}.vz-key span{display:inline-flex;align-items:center;gap:6px}.vz-key i{width:11px;height:11px;border-radius:3px;display:inline-block}" +
    ".vz-line{width:100%;height:auto;display:block}" +
    ".vz-cloud{line-height:1.25;padding:6px 0;text-align:center}.vz-w{display:inline-block;margin:3px 7px;color:var(--sage-dark,var(--ink));font-weight:600}.vz-w.pos{color:var(--good)}.vz-w.neg{color:var(--alert)}" +
    "@media (max-width:560px){.vz-row{grid-template-columns:1fr 64px}.vz-track{grid-column:1 / -1;order:3}.vz-lab{white-space:normal}}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  window.Viz = { esc: esc, avg: avg, f1: f1, f2: f2, bars: bars, hist: hist, npsBar: npsBar, line: line, cloud: cloud, topWords: topWords, mood: mood, csv: csv };
})();
