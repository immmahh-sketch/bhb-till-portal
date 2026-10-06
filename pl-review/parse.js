'use strict';
/*
 * PLParse - reads the monthly P&L workbook (SheetJS) into the plain data structure used by the P&L Review tile.
 * Browser: window.PLParse.parse(XLSX, arrayBuffer, fileName)    Node: require('./parse.js').parse(...)
 * Nothing here is specific to one year: the month columns, the section headers and the totals are all found by reading the sheet.
 */
(function (root) {
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTH_RE = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:[\s\-\/']*\d{2,4})?$/;
  var PREFERRED_SHEET = 'combined p and l';
  var NOT_PL = "This doesn't look like the monthly P&L - I couldn't find Turnover, Cost of Sales and the month columns.";

  function cleanText(v) {
    if (v === null || v === undefined) return '';
    return String(v).replace(/[   ]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function norm(s) { return String(s).toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function round2(n) { return Math.round(n * 100) / 100; }

  function monthIndex(v) {
    if (typeof v !== 'string') return -1;
    var t = cleanText(v).toLowerCase();
    var m = MONTH_RE.exec(t);
    if (!m) return -1;
    return MONTHS.map(function (x) { return x.toLowerCase(); }).indexOf(m[1]);
  }

  // blank cells and text (including formulas that return "") are null; 0 stays 0
  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? round2(v) : null;
    if (typeof v === 'string') {
      var t = cleanText(v).replace(/[£,\s]/g, '');
      if (!t) return null;
      var neg = /^\(.*\)$/.test(t);
      if (neg) t = t.slice(1, -1);
      if (/^-?\d+(\.\d+)?$/.test(t)) {
        var n = parseFloat(t);
        return round2(neg ? -n : n);
      }
    }
    return null;
  }

  function lev(a, b) {
    var prev = [], cur, i, j;
    for (j = 0; j <= b.length; j++) prev.push(j);
    for (i = 1; i <= a.length; i++) {
      cur = [i];
      for (j = 1; j <= b.length; j++) {
        cur.push(Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1)));
      }
      prev = cur;
    }
    return prev[b.length];
  }

  function sectionKind(low) {
    if (low === 'turnover') return { key: 'turnover', label: 'Turnover' };
    if (low === 'cost of sales') return { key: 'cost_of_sales', label: 'Cost of sales' };
    if (/^admin(istrat(ive|ion))?( costs?| expenses?)?$/.test(low)) return { key: 'admin', label: 'Administrative costs' };
    return null;
  }

  // The header row is the one (near the top) that holds the most month names.
  function findHeader(rows) {
    var best = null, r, c, map, count;
    for (r = 0; r < Math.min(rows.length, 20); r++) {
      var row = rows[r] || [];
      map = {}; count = 0;
      for (c = 0; c < row.length; c++) {
        var mi = monthIndex(row[c]);
        if (mi >= 0 && map[mi] === undefined) { map[mi] = c; count++; }
      }
      if (count >= 3 && (!best || count > best.count)) best = { row: r, map: map, count: count };
    }
    return best;
  }

  function readSheet(rows) {
    var head = findHeader(rows);
    if (!head) return null;
    var minCol = 99999, k;
    for (k in head.map) if (head.map[k] < minCol) minCol = head.map[k];
    if (minCol < 1) return null;
    var labelCol = 0;

    function vals(row) {
      var out = [];
      for (var i = 0; i < 12; i++) out.push(head.map[i] === undefined ? null : num(row[head.map[i]]));
      return out;
    }

    var sections = [], cur = null, gp = null, op = null, r;
    for (r = head.row + 1; r < rows.length; r++) {
      var row = rows[r] || [];
      var name = cleanText(row[labelCol]);
      if (!name) continue;
      var low = name.toLowerCase();
      var kind = sectionKind(low);
      if (kind) { cur = { key: kind.key, label: kind.label, lines: [], total: null }; sections.push(cur); continue; }
      if (low === 'gross profit') { gp = { name: name, values: vals(row) }; continue; }
      if (low === 'operating profit') { op = { name: name, values: vals(row) }; continue; }
      if (low.indexOf('total ') === 0) {
        if (cur) cur.total = { name: name, values: vals(row) };
        continue;
      }
      if (!cur) continue;
      cur.lines.push({ key: norm(name), name: name, values: vals(row) });
    }

    var hasT = sections.some(function (s) { return s.key === 'turnover'; });
    var hasC = sections.some(function (s) { return s.key === 'cost_of_sales'; });
    if (!hasT || !hasC) return null;
    return { sections: sections, gp: gp, op: op };
  }

  function lastIndexWithData(values) {
    var last = -1;
    if (!values) return last;
    for (var i = 0; i < values.length; i++) if (values[i] !== null) last = i;
    return last;
  }

  function build(sheet, sheetName, fileName) {
    var sections = sheet.sections;
    function sec(key) { for (var i = 0; i < sections.length; i++) if (sections[i].key === key) return sections[i]; return null; }
    var turn = sec('turnover'), cos = sec('cost_of_sales');

    // last month with real figures = last month on the Total Cost of Sales row
    var last = cos.total ? lastIndexWithData(cos.total.values) : -1;
    if (last < 0 && sheet.gp) last = lastIndexWithData(sheet.gp.values);
    if (last < 0 && sheet.op) last = lastIndexWithData(sheet.op.values);
    if (last < 0) {
      sections.forEach(function (s) { s.lines.forEach(function (l) { last = Math.max(last, lastIndexWithData(l.values)); }); });
    }
    if (last < 0) throw new Error('This P&L has no figures in any month yet, so there is nothing to review.');

    var plan = [];
    var i;
    for (i = 0; i < 12; i++) plan.push(null);
    if (turn.total) for (i = last + 1; i < 12; i++) plan[i] = turn.total.values[i];

    sections.forEach(function (s) {
      // figures after the last real month are stray (e.g. a scratch copy of a list pasted beside the table): ignored
      s.lines.forEach(function (l) { l.values = l.values.map(function (v, j) { return j <= last ? v : null; }); });
      if (s.total) s.total.values = s.total.values.map(function (v, j) { return j <= last ? v : null; });

      // the same cost written under slightly different names, never in the same month: one line
      var merged = [];
      s.lines.forEach(function (ln) {
        var target = null;
        for (var m = 0; m < merged.length && !target; m++) {
          var mm = merged[m];
          var close = mm.key === ln.key || (Math.min(mm.key.length, ln.key.length) >= 8 && lev(mm.key, ln.key) <= 2);
          if (close) {
            var overlap = false;
            for (var j = 0; j < 12; j++) if (mm.values[j] !== null && ln.values[j] !== null) { overlap = true; break; }
            if (!overlap) target = mm;
          }
        }
        if (target) {
          target.values = target.values.map(function (a, j) { return a !== null ? a : ln.values[j]; });
          if (ln.name !== target.name && (target.aliases || []).indexOf(ln.name) < 0) (target.aliases = target.aliases || []).push(ln.name);
        } else {
          merged.push(ln);
        }
      });
      // keys must be unique inside a section
      var seen = {};
      merged.forEach(function (l) {
        var k = l.key || 'line', n = 1;
        while (seen[k]) { n++; k = (l.key || 'line') + n; }
        seen[k] = true;
        l.key = k;
      });
      s.lines = merged;
    });

    var base = cleanText(fileName || '').replace(/^.*[\\\/]/, '').replace(/\.(xlsx|xlsm|xls)$/i, '').trim();
    var fy = null, fm = /FY\s*[-_]?\s*(\d{4}|\d{2})(?:\s*[\/-]\s*(\d{4}|\d{2}))?/i.exec(base) || /FY\s*[-_]?\s*(\d{4}|\d{2})(?:\s*[\/-]\s*(\d{4}|\d{2}))?/i.exec(sheetName || '');
    if (fm) {
      var y = parseInt(fm[2] || fm[1], 10);
      fy = y < 100 ? 2000 + y : y;
    }
    if (!fy) fy = new Date().getFullYear();

    return {
      version: 1,
      fy: fy,
      title: base || 'P&L',
      source_sheet: sheetName,
      months: MONTHS.slice(),
      last_month: last,
      plan_turnover: plan,
      sections: sections.map(function (s) {
        var o = { key: s.key, label: s.label, lines: s.lines.map(function (l) {
          var x = { key: l.key, name: l.name, values: l.values };
          if (l.aliases && l.aliases.length) x.aliases = l.aliases;
          return x;
        }), total: s.total };
        return o;
      }),
      gross_profit: sheet.gp,
      operating_profit: sheet.op
    };
  }

  function parse(XLSX, arrayBuffer, fileName) {
    if (!XLSX || typeof XLSX.read !== 'function') throw new Error('The spreadsheet reader has not loaded. Refresh the page and try again.');
    var fname = cleanText(fileName || '');
    if (fname && !/\.(xlsx|xlsm|xls)$/i.test(fname)) {
      throw new Error("That isn't an Excel workbook. Please choose the monthly P&L as an .xlsx file.");
    }
    if (!arrayBuffer || (arrayBuffer.byteLength === 0)) throw new Error('That file is empty.');
    var wb;
    try {
      wb = XLSX.read(arrayBuffer, { type: 'array' });
    } catch (e) {
      throw new Error("I couldn't open that file as an Excel workbook. Please choose the monthly P&L as an .xlsx file.");
    }
    var names = (wb && wb.SheetNames) || [];
    if (!names.length) throw new Error('That workbook is empty.');

    var ordered = names.filter(function (n) { return cleanText(n).toLowerCase() === PREFERRED_SHEET; })
      .concat(names.filter(function (n) { return cleanText(n).toLowerCase() !== PREFERRED_SHEET; }));

    var anyContent = false, i;
    for (i = 0; i < ordered.length; i++) {
      var ws = wb.Sheets[ordered[i]];
      if (!ws || !ws['!ref']) continue;
      var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true, blankrows: true });
      if (rows.length) anyContent = true;
      var sheet = readSheet(rows);
      if (sheet) return build(sheet, ordered[i], fname);
    }
    if (!anyContent) throw new Error('That workbook is empty.');
    throw new Error(NOT_PL);
  }

  var api = { parse: parse, MONTHS: MONTHS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PLParse = api;
})(typeof window !== 'undefined' ? window : globalThis);
