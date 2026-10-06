'use strict';
/*
 * PLAnalysis - looks for trends and anomalies in the parsed monthly P&L (see parse.js for the data shape).
 * Browser: window.PLAnalysis.analyse(data)    Node: require('./analysis.js').analyse(data)
 * Pure function: never changes its input. Every threshold combines a ratio test with a minimum size in pounds,
 * so that small noisy admin lines do not raise alarms.
 */
(function (root) {
  var SEV_RANK = { high: 0, medium: 1, low: 2, info: 3 };

  // ---- tunable thresholds -------------------------------------------------------------------------------------------
  var T = {
    spikeMinGbp: 750,          // spike/drop needs a change of at least this ...
    spikeMinPctTurnover: 0.5,  // ... or this % of the month's turnover, whichever is bigger
    spikeRatio: 2,             // and at least double / at most half the recent average
    historyMonths: 6,          // months (with a figure) that make the baseline for a line
    continuingGap: 0.3,        // previous month within 30% of this one: the level has stuck, not a one-off
    newMinGbp: 500,
    missingWindow: 4,          // look at the previous 4 months ...
    missingPresent: 3,         // ... line present in at least 3 of them ...
    missingMinAvgGbp: 300,     // ... averaging at least this
    negativeMinGbp: 20,        // credits on cost or turnover lines
    negativeHistoryGbp: 250,   // earlier credits worth an info line
    ratioWindow: 3,            // average of the previous 3 months
    ratioPoints: 3,            // percentage points
    opPoints: 4,
    ratioHighPoints: 5,        // a ratio move this big (6 for operating margin) is high, smaller ones medium
    trendPoints: 1,            // each of 3 consecutive monthly moves
    totalsTolerance: 1,
    sevHighPct: 1,             // % of turnover
    sevMediumPct: 0.4,
    minHistoryMonths: 2,       // earlier months with data needed for any month-on-month check
    thinHistoryMonths: 4       // fewer earlier months than this: comparisons are rough, so nothing above medium
  };

  var RATIO_DEFS = [
    { key: 'wages_pct', name: 'Wages', section: 'cost_of_sales', higherIsBad: true, points: T.ratioPoints, unit: 'of turnover' },
    { key: 'food_gp_pct', name: 'Food gross profit', section: 'cost_of_sales', higherIsBad: false, points: T.ratioPoints, unit: '' },
    { key: 'bev_gp_pct', name: 'Beverage gross profit', section: 'cost_of_sales', higherIsBad: false, points: T.ratioPoints, unit: '' },
    { key: 'overheads_pct', name: 'Overheads', section: 'admin', higherIsBad: true, points: T.ratioPoints, unit: 'of turnover' },
    { key: 'op_pct', name: 'Operating margin', section: null, higherIsBad: false, points: T.opPoints, unit: '' }
  ];

  // ---- small helpers ------------------------------------------------------------------------------------------------
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function r2(n) { return Math.round(n * 100) / 100; }
  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }
  function mean(a) { return a.length ? sum(a) / a.length : null; }
  function grp(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function gbp(n) {
    var v = Math.round(Math.abs(n));
    return (n < 0 && v > 0 ? '-' : '') + '£' + grp(v);
  }
  function pct(n) { return (Math.round(n * 10) / 10).toFixed(1) + '%'; }
  function pts(n) {
    var v = (Math.round(Math.abs(n) * 10) / 10).toFixed(1);
    return v + (v === '1.0' ? ' point' : ' points');
  }
  function lcFirst(s) { return s.charAt(0).toLowerCase() + s.slice(1); }

  function analyse(data) {
    if (!data || !Array.isArray(data.sections) || !data.sections.length) {
      throw new Error('There is no P&L data to review.');
    }
    var months = Array.isArray(data.months) && data.months.length === 12 ? data.months : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    function mn(i) { return months[i]; }

    var sections = {};
    data.sections.forEach(function (s) { sections[s.key] = s; });
    var turnSec = sections.turnover || { lines: [], total: null };
    var cosSec = sections.cost_of_sales || { lines: [], total: null };
    var admSec = sections.admin || { lines: [], total: null };

    function val(arr, i) { return arr && isNum(arr[i]) ? arr[i] : null; }
    function lineVal(l, i) { return val(l.values, i); }
    function sectionSum(sec, i) {
      var any = false, s = 0;
      sec.lines.forEach(function (l) { var v = lineVal(l, i); if (v !== null) { any = true; s += v; } });
      return any ? s : null;
    }
    function secTotal(sec, i) {
      var t = sec.total ? val(sec.total.values, i) : null;
      return t !== null ? t : sectionSum(sec, i);
    }

    function hasData(i) {
      if (secTotal(turnSec, i) !== null) return true;
      var any = false;
      data.sections.forEach(function (s) { s.lines.forEach(function (l) { if (lineVal(l, i) !== null) any = true; }); });
      return any;
    }

    // ---- which month are we looking at --------------------------------------------------------------------------------
    var m = isNum(data.last_month) ? Math.max(0, Math.min(11, Math.floor(data.last_month))) : 11;
    var declaredLast = m;
    while (m > 0 && !hasData(m)) m--;
    var priorWithData = [];
    for (var pj = 0; pj < m; pj++) if (hasData(pj)) priorWithData.push(pj);
    var enoughHistory = priorWithData.length >= T.minHistoryMonths;
    var thinHistory = enoughHistory && priorWithData.length < T.thinHistoryMonths;

    // ---- monthly series ---------------------------------------------------------------------------------------------
    var turn = [], cost = [], adm = [], gp = [], op = [], i;
    for (i = 0; i < 12; i++) {
      var t = i <= declaredLast ? secTotal(turnSec, i) : null;
      var c = i <= declaredLast ? secTotal(cosSec, i) : null;
      var a = i <= declaredLast ? secTotal(admSec, i) : null;
      turn.push(t); cost.push(c); adm.push(a);
      var g = data.gross_profit ? val(data.gross_profit.values, i) : null;
      if (g === null && t !== null && c !== null) g = t - c;
      gp.push(i <= declaredLast ? g : null);
      var o = data.operating_profit ? val(data.operating_profit.values, i) : null;
      if (o === null && gp[i] !== null && a !== null) o = gp[i] - a;
      op.push(i <= declaredLast ? o : null);
    }
    var turnM = turn[m] !== null && turn[m] > 0 ? turn[m] : null;
    var tref = turnM !== null ? turnM : 200000;

    function findLines(sec, re) {
      return sec.lines.filter(function (l) { return re.test(l.key); });
    }
    function sumLines(lines, i) {
      var any = false, s = 0;
      lines.forEach(function (l) { var v = lineVal(l, i); if (v !== null) { any = true; s += v; } });
      return any ? s : null;
    }
    var wageLines = findLines(cosSec, /wage|salar|labour|payroll|agencystaff|employersni|employerspension|subcontractorchef/);
    var foodRev = findLines(turnSec, /^food/);
    var foodBuy = findLines(cosSec, /^foodpurch/);
    var bevRev = findLines(turnSec, /^(wet|beverage|drink)/);
    var bevBuy = findLines(cosSec, /^(beverage|drink|wet)purch/);

    function gpPct(rev, buy, i) {
      var r = sumLines(rev, i), b = sumLines(buy, i);
      if (r === null || b === null || r <= 0) return null;
      return (1 - b / r) * 100;
    }
    function ratiosAt(i) {
      var T_ = turn[i], out = {
        turnover: T_, gross_profit: gp[i], operating_profit: op[i],
        gp_pct: null, op_pct: null, wages_pct: null, food_gp_pct: null, bev_gp_pct: null, overheads_pct: null
      };
      if (i > declaredLast) return out;
      if (T_ !== null && T_ > 0) {
        if (gp[i] !== null) out.gp_pct = gp[i] / T_ * 100;
        if (op[i] !== null) out.op_pct = op[i] / T_ * 100;
        var w = wageLines.length ? sumLines(wageLines, i) : null;
        if (w !== null) out.wages_pct = w / T_ * 100;
        if (adm[i] !== null) out.overheads_pct = adm[i] / T_ * 100;
      }
      out.food_gp_pct = gpPct(foodRev, foodBuy, i);
      out.bev_gp_pct = gpPct(bevRev, bevBuy, i);
      return out;
    }
    var perMonth = [];
    for (i = 0; i < 12; i++) perMonth.push(ratiosAt(i));
    var ratios = {};
    ['food_gp_pct', 'bev_gp_pct', 'wages_pct', 'overheads_pct', 'op_pct', 'gp_pct'].forEach(function (k) {
      ratios[k] = perMonth.map(function (p) { return p[k] === null ? null : r2(p[k]); });
    });
    function kpiSet(i) {
      var p = perMonth[i];
      var o = {};
      ['turnover', 'gross_profit', 'operating_profit', 'gp_pct', 'op_pct', 'wages_pct', 'food_gp_pct', 'bev_gp_pct', 'overheads_pct'].forEach(function (k) {
        o[k] = p[k] === null ? null : r2(p[k]);
      });
      return o;
    }
    var kpis = kpiSet(m);
    kpis.prev = m > 0 ? kpiSet(m - 1) : kpiSet(0);
    if (m === 0) Object.keys(kpis.prev).forEach(function (k) { kpis.prev[k] = null; });

    // ---- findings ---------------------------------------------------------------------------------------------------
    var findings = [], cellFlags = {}, usedIds = {};
    function sevFor(effect, ref) {
      var p = effect / (ref > 0 ? ref : tref) * 100;
      if (p >= T.sevHighPct) return 'high';
      if (p >= T.sevMediumPct) return 'medium';
      return 'low';
    }
    function capSev(sev, cap) { return SEV_RANK[sev] < SEV_RANK[cap] ? cap : sev; }
    function add(f) {
      var id = f.id, n = 1;
      while (usedIds[id]) { n++; id = f.id + '#' + n; }
      usedIds[id] = true;
      f.id = id;
      if (thinHistory && f.severity === 'high' && /^(spike|drop|new|missing|ratio|trend)$/.test(f.type)) f.severity = 'medium';
      if (f.section === undefined) f.section = null;
      if (f.line_key === undefined) f.line_key = null;
      if (f.amount === undefined || f.amount === null) f.amount = null; else f.amount = r2(f.amount);
      findings.push(f);
      if (f.cell && f.severity !== 'info') {
        var cur = cellFlags[f.cell];
        if (!cur || SEV_RANK[f.severity] < SEV_RANK[cur]) cellFlags[f.cell] = f.severity;
      }
      delete f.cell;
    }

    function ymNames(list) {
      var contiguous = list.length > 2 && list.every(function (x, k) { return k === 0 || x === list[k - 1] + 1; });
      return contiguous ? mn(list[0]) + ' to ' + mn(list[list.length - 1]) : list.map(mn).join(', ');
    }

    // data-quality remarks about which months are being used
    if (m !== declaredLast) {
      add({
        id: 'data:nolatest', severity: 'info', type: 'data', month: m, amount: null,
        title: mn(declaredLast) + ' has no figures, so the review looks at ' + mn(m),
        detail: 'The workbook says ' + mn(declaredLast) + ' is the last month but nothing has been entered for it. Everything below compares ' + mn(m) + ' with the months before it.'
      });
    }
    if (!enoughHistory) {
      add({
        id: 'data:history', severity: 'info', type: 'data', month: m, amount: null,
        title: 'Not enough earlier months to look for trends',
        detail: priorWithData.length === 0
          ? 'There are no figures before ' + mn(m) + ', so only the totals and negative figures could be checked.'
          : 'Only ' + priorWithData.length + ' earlier month' + (priorWithData.length === 1 ? '' : 's') + ' of figures, so only the totals and negative figures were checked. Month-on-month checks need at least ' + T.minHistoryMonths + '.'
      });
    }
    if (thinHistory) {
      add({
        id: 'data:thin', severity: 'info', type: 'data', month: m, amount: null,
        title: 'Only ' + priorWithData.length + ' earlier months to compare with',
        detail: 'Averages built on so few months are rough, so month-on-month findings are shown no higher than medium until there are ' + T.thinHistoryMonths + ' months of figures.'
      });
    }
    // plan months and stray figures after the last real month
    var planMonths = [];
    for (i = 0; i < 12; i++) if (i > declaredLast && Array.isArray(data.plan_turnover) && isNum(data.plan_turnover[i])) planMonths.push(i);
    if (planMonths.length) {
      add({
        id: 'data:plan', severity: 'info', type: 'data', month: m, amount: null,
        title: ymNames(planMonths) + ' hold plan turnover, not actual figures',
        detail: 'The turnover shown after ' + mn(declaredLast) + ' (' + planMonths.map(function (j) { return gbp(data.plan_turnover[j]); }).join(', ') + ') is a plan and is left out of every check.'
      });
    }
    var stray = [];
    data.sections.forEach(function (s) {
      s.lines.forEach(function (l) {
        for (var j = declaredLast + 1; j < 12; j++) if (lineVal(l, j) !== null) { stray.push(l.name); break; }
      });
    });
    if (stray.length) {
      add({
        id: 'data:stray', severity: 'info', type: 'data', month: m, amount: null,
        title: 'Figures sit after ' + mn(declaredLast) + ' on ' + stray.length + ' line' + (stray.length === 1 ? '' : 's'),
        detail: 'These look like leftovers and were ignored: ' + stray.slice(0, 5).join(', ') + (stray.length > 5 ? ' and ' + (stray.length - 5) + ' more' : '') + '.'
      });
    }

    // ---- line checks -------------------------------------------------------------------------------------------------
    var minSize = Math.max(T.spikeMinGbp, T.spikeMinPctTurnover / 100 * tref);

    data.sections.forEach(function (sec) {
      var isTurnover = sec.key === 'turnover';
      sec.lines.forEach(function (l) {
        var v = lineVal(l, m);
        var prevV = m > 0 ? lineVal(l, m - 1) : null;
        var cellKey = l.key + '|' + m;
        // history: up to 6 earlier months that have a figure
        var hist = [];
        for (var j = m - 1; j >= 0 && hist.length < T.historyMonths; j--) {
          var hv = lineVal(l, j);
          if (hv !== null) hist.push({ m: j, v: hv });
        }
        var avg = hist.length ? mean(hist.map(function (h) { return h.v; })) : null;
        var nHist = hist.length;
        var lead = l.name;

        // negative values (credits)
        if (v !== null && v <= -T.negativeMinGbp) {
          var baseline = avg !== null && avg > 0 && nHist >= 2 ? avg : null;
          var swing = baseline !== null ? Math.abs(baseline - v) : Math.abs(v);
          var sev = sevFor(swing, tref);
          add({
            id: 'negative:' + l.key + ':' + m, severity: sev, type: 'negative', section: sec.key, line_key: l.key, month: m, amount: swing, cell: cellKey,
            title: isTurnover ? lead + ' is negative in ' + mn(m) + ': ' + gbp(v) : lead + ' is a credit of ' + gbp(Math.abs(v)) + ' in ' + mn(m),
            detail: (isTurnover ? 'Negative turnover usually means a refund or a reversal. ' : 'A credit on a cost line usually means a refund or an invoice posted the wrong way round. ') +
              (baseline !== null ? 'The line normally runs at about ' + gbp(baseline) + ' a month, so this moves ' + mn(m) + ' profit by about ' + gbp(swing) + '.' : 'It moves ' + mn(m) + ' profit by ' + gbp(swing) + '.')
          });
          return;
        }

        // credits earlier in the year (history, so information only)
        for (var hj = 0; hj < m; hj++) {
          var ov = lineVal(l, hj);
          if (ov !== null && ov <= -T.negativeHistoryGbp) {
            add({
              id: 'negative:' + l.key + ':' + hj, severity: 'info', type: 'negative', section: sec.key, line_key: l.key, month: hj, amount: Math.abs(ov),
              title: lead + ' had a credit of ' + gbp(Math.abs(ov)) + ' in ' + mn(hj),
              detail: 'That is an earlier month, not ' + mn(m) + ', but it pulls down any average of this line, so it is worth knowing it is there.'
            });
          }
        }

        if (!enoughHistory) return;

        // present and positive in the latest month: spike / drop / new
        if (v !== null && v > 0) {
          var everBefore = false;
          for (var k = 0; k < m; k++) { var kv = lineVal(l, k); if (kv !== null && kv !== 0) { everBefore = true; break; } }
          if (!everBefore) {
            if (v >= T.newMinGbp) {
              add({
                id: 'new:' + l.key + ':' + m, severity: sevFor(v, tref), type: 'new', section: sec.key, line_key: l.key, month: m, amount: v, cell: cellKey,
                title: lead + ' is a new line: ' + gbp(v) + ' in ' + mn(m),
                detail: 'There is no figure under this name in the earlier months. ' + (isTurnover ? 'It adds ' : 'It takes ') + gbp(v) + (isTurnover ? ' to ' : ' off ') + mn(m) + ' profit. Check it belongs under this heading.'
              });
            }
            return;
          }
          if (nHist >= T.minHistoryMonths && avg !== null && avg > 0) {
            var change = v - avg, ratio = v / avg;
            if ((ratio >= T.spikeRatio || ratio <= 1 / T.spikeRatio) && Math.abs(change) >= minSize) {
              var up = change > 0;
              var sev2 = sevFor(Math.abs(change), tref);
              var near = function (x) { return x !== null && x > 0 && Math.abs(v - x) / Math.max(v, x) <= T.continuingGap; };
              var held1 = near(prevV), held2 = held1 && near(m > 1 ? lineVal(l, m - 2) : null);
              // held at this level for 3 months: it was news when it first moved, not now
              if (held2) return;
              var consequence = up
                ? (isTurnover ? 'That adds ' + gbp(Math.abs(change)) + ' to ' + mn(m) + ' profit; check it sits in the right month.' : 'That takes ' + gbp(Math.abs(change)) + ' off ' + mn(m) + ' profit; check it is not a one-off or posted to the wrong line.')
                : (isTurnover ? 'That takes ' + gbp(Math.abs(change)) + ' off ' + mn(m) + ' profit; check nothing is missing.' : 'If something is still to be booked, ' + mn(m) + ' profit is overstated by up to ' + gbp(Math.abs(change)) + '.');
              if (held1) {
                sev2 = capSev(sev2, 'medium');
                add({
                  id: (up ? 'spike:' : 'drop:') + l.key + ':' + m, severity: sev2, type: up ? 'spike' : 'drop', section: sec.key, line_key: l.key, month: m, amount: Math.abs(change), cell: cellKey,
                  title: lead + ' stayed ' + (up ? 'high' : 'low') + ': ' + gbp(v) + ' in ' + mn(m) + ' and ' + gbp(prevV) + ' in ' + mn(m - 1) + ', against about ' + gbp(avg) + ' a month before',
                  detail: 'It moved ' + (up ? 'up' : 'down') + ' last month and has held there, ' + gbp(Math.abs(change)) + ' ' + (up ? 'above' : 'below') + ' its earlier average. ' + consequence
                });
              } else {
                var d = gbp(Math.abs(change)) + (up ? ' more' : ' less') + ' than the ' + nHist + '-month average of ' + gbp(avg) + '.';
                if (prevV !== null && Math.abs(prevV - avg) / Math.max(avg, 1) > 0.25) d += ' ' + mn(m - 1) + ' was ' + gbp(prevV) + '.';
                else if (prevV === null) d += ' Nothing was booked in ' + mn(m - 1) + ', so part of this may be catch-up.';
                d += ' ' + consequence;
                add({
                  id: (up ? 'spike:' : 'drop:') + l.key + ':' + m, severity: sev2, type: up ? 'spike' : 'drop', section: sec.key, line_key: l.key, month: m, amount: Math.abs(change), cell: cellKey,
                  title: lead + ' came to ' + gbp(v) + ' in ' + mn(m) + (up ? ' against about ' : ', down from about ') + gbp(avg) + ' a month before',
                  detail: d
                });
              }
            }
          }
          return;
        }

        // nothing (or zero) in the latest month: regular line that has gone quiet?
        if (v === null || v === 0) {
          var win = [];
          for (var w = 1; w <= T.missingWindow && m - w >= 0; w++) {
            var wv = lineVal(l, m - w);
            if (wv !== null && wv > 0) win.push({ m: m - w, v: wv });
          }
          if (win.length >= T.missingPresent) {
            var wavg = mean(win.map(function (x) { return x.v; }));
            if (wavg >= T.missingMinAvgGbp) {
              var sev3 = sevFor(wavg, tref);
              var alsoAbsent = prevV === null || prevV === 0;
              if (alsoAbsent) sev3 = capSev(sev3, 'low');
              var lastSeen = win[0];
              add({
                id: 'missing:' + l.key + ':' + m, severity: sev3, type: 'missing', section: sec.key, line_key: l.key, month: m, amount: wavg, cell: cellKey,
                title: lead + (isTurnover ? ' has no sales in ' : ' has nothing booked in ') + mn(m) + ', against about ' + gbp(wavg) + ' a month before',
                detail: 'It had a figure in ' + win.length + ' of the previous ' + Math.min(T.missingWindow, m) + ' months' + (alsoAbsent ? ' (last in ' + mn(lastSeen.m) + ', ' + gbp(lastSeen.v) + ')' : '') + '. ' +
                  (isTurnover ? 'If it should be there, ' + mn(m) + ' turnover is short by about ' : 'If an invoice is still to come, ' + mn(m) + ' costs are understated by about ') + gbp(wavg) + '.'
              });
            }
          }
        }
      });
    });

    // ---- ratio movement and streaks -------------------------------------------------------------------------------------
    function ratioRevenue(key) {
      if (key === 'food_gp_pct') return sumLines(foodRev, m);
      if (key === 'bev_gp_pct') return sumLines(bevRev, m);
      return turnM;
    }
    if (enoughHistory) {
      RATIO_DEFS.forEach(function (rd) {
        var series = perMonth.map(function (p) { return p[rd.key]; });
        var cur = series[m];
        if (cur === null) return;
        var prior = [];
        for (var j = m - 1; j >= 0 && prior.length < T.ratioWindow; j--) if (series[j] !== null) prior.push(series[j]);
        if (prior.length >= 2) {
          var pavg = mean(prior), diff = cur - pavg;
          if (Math.abs(diff) >= rd.points) {
            var worse = rd.higherIsBad ? diff > 0 : diff < 0;
            var rev = ratioRevenue(rd.key);
            var effGbp = rev !== null ? Math.abs(diff) / 100 * rev : null;
            var sev4 = Math.abs(diff) >= (rd.key === 'op_pct' ? T.ratioHighPoints + 1 : T.ratioHighPoints) ? 'high' : 'medium';
            if (effGbp !== null && effGbp / tref * 100 < T.sevMediumPct) sev4 = 'low';
            var title;
            if (rd.key === 'wages_pct' || rd.key === 'overheads_pct') {
              title = rd.name + ' were ' + pct(cur) + ' of turnover in ' + mn(m) + ', against about ' + pct(pavg) + ' in the previous ' + prior.length + ' months';
            } else if (rd.key === 'op_pct') {
              title = 'Operating margin was ' + pct(cur) + ' in ' + mn(m) + ', against about ' + pct(pavg) + ' in the previous ' + prior.length + ' months';
            } else {
              title = rd.name + ' was ' + pct(cur) + ' in ' + mn(m) + ', against about ' + pct(pavg) + ' in the previous ' + prior.length + ' months';
            }
            var what = rd.key === 'food_gp_pct' ? 'food sales' : rd.key === 'bev_gp_pct' ? 'beverage sales' : 'turnover';
            add({
              id: 'ratio:' + rd.key + ':' + m, severity: sev4, type: 'ratio', section: rd.section, line_key: null, month: m, amount: effGbp,
              title: title,
              detail: pts(diff) + (diff > 0 ? ' higher' : ' lower') + ', which is ' + (worse ? 'worse' : 'better') + '. On ' + mn(m) + ' ' + what + ' that is about ' + gbp(effGbp === null ? 0 : effGbp) + (worse ? ' of profit lost' : ' of profit gained') +
                (rd.key === 'food_gp_pct' || rd.key === 'bev_gp_pct' ? (worse ? '. Check the stock and purchases for the month.' : '. Check that all purchase invoices have been posted.') : '.')
            });
          }
        }
        // three consecutive monthly moves in the same direction, each at least a point
        if (m >= 3) {
          var s4 = [series[m - 3], series[m - 2], series[m - 1], series[m]];
          if (s4.every(function (x) { return x !== null; })) {
            var d1 = s4[1] - s4[0], d2 = s4[2] - s4[1], d3 = s4[3] - s4[2];
            var allUp = d1 >= T.trendPoints && d2 >= T.trendPoints && d3 >= T.trendPoints;
            var allDown = d1 <= -T.trendPoints && d2 <= -T.trendPoints && d3 <= -T.trendPoints;
            if (allUp || allDown) {
              var total = s4[3] - s4[0];
              var bad = rd.higherIsBad ? allUp : allDown;
              var sev5 = bad ? (Math.abs(total) >= 2 * rd.points ? 'medium' : 'low') : 'info';
              add({
                id: 'trend:' + rd.key + ':' + m, severity: sev5, type: 'trend', section: rd.section, line_key: null, month: m,
                amount: ratioRevenue(rd.key) !== null ? Math.abs(total) / 100 * ratioRevenue(rd.key) : null,
                title: rd.name + ' has ' + (allUp ? 'risen' : 'fallen') + ' for 3 months running, from ' + pct(s4[0]) + ' in ' + mn(m - 3) + ' to ' + pct(s4[3]) + ' in ' + mn(m),
                detail: s4.map(pct).join(', ') + ' over ' + [m - 3, m - 2, m - 1, m].map(mn).join(', ') + ': ' + pts(total) + ' ' + (allUp ? 'up' : 'down') + ' in total, which is ' + (bad ? 'the wrong way.' : 'the right way.')
              });
            }
          }
        }
      });
    }

    // ---- totals integrity ----------------------------------------------------------------------------------------------
    function mismatch(id, label, flagKey, i, expected, actual, how, section) {
      var diff = actual - expected;
      add({
        id: id, severity: i === m ? 'high' : 'medium', type: 'totals', section: section, line_key: null, month: i, amount: Math.abs(diff), cell: flagKey + '|' + i,
        title: label + ' does not add up in ' + mn(i) + ': the sheet says ' + gbp(actual) + ' but ' + how + ' comes to ' + gbp(expected),
        detail: 'The difference is ' + gbp(Math.abs(diff)) + (diff > 0 ? ' too high' : ' too low') + '. A line may have been added, removed or typed over without the total following.'
      });
    }
    for (i = 0; i <= declaredLast; i++) {
      var sheetT = {};
      data.sections.forEach(function (sec) {
        var tv = sec.total ? val(sec.total.values, i) : null;
        sheetT[sec.key] = tv;
        if (tv === null) return;
        var ls = sectionSum(sec, i);
        var expected = ls === null ? 0 : ls;
        if (Math.abs(tv - expected) > T.totalsTolerance) {
          mismatch('totals:' + sec.key + ':' + i, sec.total.name || ('Total ' + sec.label), 'total_' + sec.key, i, expected, tv, 'the sum of the lines above it', sec.key);
        }
      });
      var gpv = data.gross_profit ? val(data.gross_profit.values, i) : null;
      if (gpv !== null && sheetT.turnover !== null && sheetT.turnover !== undefined && sheetT.cost_of_sales !== null && sheetT.cost_of_sales !== undefined) {
        var egp = sheetT.turnover - sheetT.cost_of_sales;
        if (Math.abs(gpv - egp) > T.totalsTolerance) mismatch('totals:gross_profit:' + i, 'Gross profit', 'gross_profit', i, egp, gpv, 'turnover less cost of sales', null);
      }
      var opv = data.operating_profit ? val(data.operating_profit.values, i) : null;
      if (opv !== null && sheetT.admin !== null && sheetT.admin !== undefined) {
        var gbase = gpv !== null ? gpv : (sheetT.turnover !== null && sheetT.turnover !== undefined && sheetT.cost_of_sales !== null && sheetT.cost_of_sales !== undefined ? sheetT.turnover - sheetT.cost_of_sales : null);
        if (gbase !== null) {
          var eop = gbase - sheetT.admin;
          if (Math.abs(opv - eop) > T.totalsTolerance) mismatch('totals:operating_profit:' + i, 'Operating profit', 'operating_profit', i, eop, opv, 'gross profit less administrative costs', null);
        }
      }
    }

    // ---- naming -----------------------------------------------------------------------------------------------------
    function editDistance(a, b) {
      var prev = [], cur, x, y;
      for (y = 0; y <= b.length; y++) prev.push(y);
      for (x = 1; x <= a.length; x++) {
        cur = [x];
        for (y = 1; y <= b.length; y++) cur.push(Math.min(prev[y] + 1, cur[y - 1] + 1, prev[y - 1] + (a.charAt(x - 1) === b.charAt(y - 1) ? 0 : 1)));
        prev = cur;
      }
      return prev[b.length];
    }
    data.sections.forEach(function (sec) {
      sec.lines.forEach(function (l) {
        if (l.aliases && l.aliases.length) {
          var names = [l.name].concat(l.aliases);
          add({
            id: 'naming:' + l.key, severity: 'info', type: 'naming', section: sec.key, line_key: l.key, month: m, amount: null,
            title: 'The same cost is written as ' + names.map(function (n) { return '"' + n + '"'; }).join(' and '),
            detail: 'The names are never used in the same month, so their figures have been treated as one line. Using one name in the workbook keeps trends and averages clean.'
          });
        }
      });
      var ls = sec.lines;
      for (var x = 0; x < ls.length; x++) {
        for (var y = x + 1; y < ls.length; y++) {
          var ka = ls[x].key, kb = ls[y].key;
          if (ka !== kb && Math.min(ka.length, kb.length) >= 6 && editDistance(ka, kb) <= 2) {
            add({
              id: 'naming:' + ka + ':' + kb, severity: 'info', type: 'naming', section: sec.key, line_key: ls[x].key, month: m, amount: null,
              title: '"' + ls[x].name + '" and "' + ls[y].name + '" look like the same cost',
              detail: 'Both have figures in the same month, so they were kept apart. If it is one cost it may be split, or counted twice.'
            });
          }
        }
      }
    });

    // ---- order ------------------------------------------------------------------------------------------------------
    findings.forEach(function (f, idx) { f._i = idx; });
    findings.sort(function (a, b) {
      var d = SEV_RANK[a.severity] - SEV_RANK[b.severity];
      if (d) return d;
      var aa = a.amount === null ? -1 : a.amount, bb = b.amount === null ? -1 : b.amount;
      if (aa !== bb) return bb - aa;
      return a._i - b._i;
    });
    findings.forEach(function (f) { delete f._i; });

    return {
      period: { month: m, label: mn(m) },
      kpis: kpis,
      ratios: ratios,
      findings: findings,
      cell_flags: cellFlags
    };
  }

  var api = { analyse: analyse, THRESHOLDS: T };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PLAnalysis = api;
})(typeof window !== 'undefined' ? window : globalThis);
