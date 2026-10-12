/* Stock Control: turns the shapes the venue's real reports and invoices come in into plain tables the column mapper can read.
   - foldSections: the Newbridge product sales CSV repeats its header under every department; this makes one table with a Group column.
   - invoiceRows: Matthew Clark (code + description in one cell, unit and quantity after) and Heineken (description first, quantity worked out from the line total).
   Plain functions, no page access, so they can be tested in node. */
(function (root) {
  const clean = c => String(c == null ? "" : c).trim();
  const lower = c => clean(c).toLowerCase();
  const isNum = c => /^[\s£$€]*-?[\d,]*\.?\d+%?\s*$/.test(clean(c));

  function foldSections(rows) {
    const key = r => r.map(lower).join("|");
    const seen = new Map();
    rows.forEach(r => { const words = r.filter(c => clean(c) && !isNum(c)).length; if (words >= 3) seen.set(key(r), (seen.get(key(r)) || 0) + 1); });
    let hk = null, best = 0;
    for (const [k, n] of seen) if (n >= 3 && n > best) { hk = k; best = n; }
    if (!hk) return rows;
    const header = rows.find(r => key(r) === hk), out = [header.concat(["Group"])];
    let last = "", group = "";
    for (const r of rows) {
      const filled = r.filter(c => clean(c)).length;
      if (key(r) === hk) { group = last; continue; }
      if (filled === 1) { last = clean(r.find(c => clean(c))); group = ""; continue; }
      if (!group || filled < 3) continue;
      if (/^total/i.test(clean(r[0])) || isNum(r[1])) continue;
      out.push(r.concat([group]));
    }
    return out.length > 1 ? out : rows;
  }

  const ukDate = (d, m, y) => `${y.length === 2 ? "20" + y : y}-${m}-${d}`;
  const UNITS = /^(EA|CS|BT|CA|DR|PK|BX)$/i;

  function matthewClark(rows) {
    const lines = [];
    for (const r of rows) {
      const c0 = clean(r[0]), m = c0.match(/^(\d{6,8})\s+(.+)$/);
      if (!m) continue;
      const ui = r.findIndex((c, i) => i > 0 && UNITS.test(clean(c)));
      if (ui < 0) continue;
      const free = r.some(c => /free of charge/i.test(c));
      const desc = [m[2]].concat(r.slice(1, ui).filter(c => !/free of charge/i.test(c))).map(clean).filter(Boolean).join(" ");
      const qty = clean(r[ui + 1]), price = clean(r[ui + 2]), total = clean(r[ui + 3]).split(/\s+/)[0];
      if (!isNum(qty)) continue;
      lines.push([m[1], desc, qty, UNITS.test(clean(r[ui])) ? clean(r[ui]).toUpperCase() : "EA", free ? "0.00" : price, free ? "0.00" : total]);
    }
    const text = rows.map(r => r.join(" ")).join("\n");
    let no = "", date = "";
    const ni = rows.findIndex(r => r.some(c => /^invoice number$/i.test(clean(c))));
    if (ni >= 0 && rows[ni + 1]) no = clean(rows[ni + 1][0]);
    const dm = text.match(/Invoice Date:\s*(\d\d)\/(\d\d)\/(\d\d)/);
    if (dm) date = ukDate(dm[1], dm[2], dm[3]);
    return { lines, meta: { no, date } };
  }

  const fixOcr = s => s.replace(/Waler/g, "Water").replace(/Exira/g, "Extra").replace(/\s+/g, " ").trim();
  const moneyRe = /^-?[\d,]+\.\d{2}$/;

  function heineken(rows) {
    const lines = [];
    for (const r of rows) {
      const c0 = clean(r[0]);
      if (!/[A-Za-z]{4}/.test(c0) || /^(returned|delivered|container|vat|net|please|any purchase|address|for payment|incorporated|registered|website|payment)/i.test(c0)) continue;
      const money = r.map(clean).filter(c => moneyRe.test(c));
      if (money.length < 4) continue;
      const unit = parseFloat(money[money.length - 2].replace(/,/g, "")), total = parseFloat(money[money.length - 1].replace(/,/g, ""));
      if (!(unit > 0)) continue;
      let desc = fixOcr(c0);
      while (/\s\d+(\.\d+)?%?$/.test(desc)) desc = desc.replace(/\s\d+(\.\d+)?%?$/, "");
      const pack = r.map(clean).some(c => /^\d+X\d+$|^\d+MLX$/i.test(c)) || /\b\d+x\d+ml\b/i.test(desc);
      lines.push(["", desc, String(Math.round(total / unit)), pack ? "CS" : "EA", unit.toFixed(2), total.toFixed(2)]);
    }
    let no = "", date = "";
    const hi = rows.findIndex(r => /^\d{8,}$/.test(clean(r[0])) && r.length >= 8);
    if (hi >= 0) { no = clean(rows[hi][1]); const m = clean(rows[hi][2]).match(/^(\d\d)\.(\d\d)\.(\d{4})$/); if (m) date = ukDate(m[1], m[2], m[3]); }
    return { lines, meta: { no, date } };
  }

  const HEADER = ["Code", "Description", "Qty", "Unit", "Price each", "Line total"];
  function invoiceRows(supplier, rows) {
    const parsed = supplier === "matthew_clark" ? matthewClark(rows) : supplier === "heineken" ? heineken(rows) : null;
    if (!parsed || !parsed.lines.length) return null;
    return { rows: [HEADER].concat(parsed.lines), meta: parsed.meta };
  }

  const api = { foldSections, invoiceRows, isNum };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.StockParsers = api;
})(typeof window !== "undefined" ? window : globalThis);
