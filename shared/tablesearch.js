/* Filter box for any list of names.
 *
 * Add <script src="../shared/tablesearch.js" defer></script> to a page and every table that looks like a list of people or bookings (a name-like column heading and at least
 * MIN_ROWS rows) gets a "Filter by name, reference..." box above it. Typing hides the rows that do not contain every word typed; clearing it shows them all again.
 *
 * It works on whatever the page draws, including views the page redraws later, and remembers what was typed in each list across a redraw. A table can opt out with
 * data-nosearch, and a table that already has a search box of its own (an input of type search, or with "search" in its placeholder, anywhere in the same view) is left alone.
 * Rows are hidden with an inline display of none and restored from a mark of our own, so rows the page hides itself stay hidden.
 */
(function () {
  "use strict";
  if (window.__tableSearch) return; window.__tableSearch = true;
  var MIN_ROWS = 8;
  var NAMEISH = /\b(name|booked by|guest|customer|couple|company|organiser|organizer|contact|staff|person|people|employee|attendee|booking|reference|who)\b/i;
  var remembered = {};                       // list key -> what was typed
  var timer = null, busy = false;

  var css = document.createElement("style");
  css.textContent = ".ts-wrap{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:0 0 10px}" +
    ".ts-wrap input{flex:1 1 260px;max-width:440px;font:inherit;padding:10px 12px;border:1px solid #CCCDB4;border-radius:9px;background:#fff;color:inherit}" +
    ".ts-wrap input:focus{outline:2px solid #C9A56B;outline-offset:1px}" +
    ".ts-wrap .ts-n{font-size:13px;color:#6B746C}" +
    ".ts-none td{padding:14px 10px;color:#6B746C;text-align:center}";
  document.head.appendChild(css);

  function headText(table) {
    var th = table.querySelectorAll("thead th, thead td"); if (!th.length) th = table.querySelectorAll("tr:first-child th");
    return Array.prototype.map.call(th, function (h) { return h.textContent; }).join(" | ");
  }
  function bodyRows(table) {
    var tb = table.tBodies; var rows = [];
    for (var i = 0; i < tb.length; i++) for (var j = 0; j < tb[i].rows.length; j++) rows.push(tb[i].rows[j]);
    if (!tb.length || !rows.length) rows = Array.prototype.slice.call(table.rows).filter(function (r) { return !r.querySelector("th"); });
    return rows.filter(function (r) { return !r.classList.contains("ts-none"); });
  }
  function hasOwnSearch(table) {
    var scope = table.closest("#views, #trackerApp, main, #app, body") || document.body;
    var found = scope.querySelectorAll('input[type="search"], input.search, input[placeholder*="earch" i]');
    for (var i = 0; i < found.length; i++) { if (!found[i].closest(".ts-wrap") && !found[i].closest(".modal, dialog")) return true; }
    return false;
  }
  function keyOf(table, idx) { return idx + ":" + headText(table).slice(0, 80); }

  function apply(table, input, count) {
    var q = input.value.trim().toLowerCase(), words = q ? q.split(/\s+/) : [], rows = bodyRows(table), shown = 0;
    rows.forEach(function (r) {
      var hit = !words.length || words.every(function (w) { return r.textContent.toLowerCase().indexOf(w) !== -1; });
      var ours = r.hasAttribute("data-ts-hid"), pageHid = r.style.display === "none" && !ours;     // a row the page hid itself is left exactly as it is
      if (hit) { if (ours) { r.style.display = ""; r.removeAttribute("data-ts-hid"); } if (!pageHid) shown++; }
      else if (!ours && !pageHid) { r.setAttribute("data-ts-hid", "1"); r.style.display = "none"; }
    });
    var none = table.querySelector("tbody .ts-none");
    if (words.length && !shown) {
      if (!none) { none = document.createElement("tr"); none.className = "ts-none"; var td = document.createElement("td"); td.colSpan = 99; td.textContent = "No one matches that."; none.appendChild(td); (table.tBodies[0] || table).appendChild(none); }
    } else if (none) none.remove();
    count.textContent = words.length ? shown + " of " + rows.length : rows.length + (rows.length === 1 ? " row" : " rows");
    remembered[input.getAttribute("data-ts-key")] = input.value;
  }

  function enhance(table, idx) {
    var rows = bodyRows(table);
    if (table.hasAttribute("data-nosearch") || table.closest(".modal, dialog, .ts-wrap")) return;
    if (rows.length < MIN_ROWS || !NAMEISH.test(headText(table))) return;
    if (table.previousElementSibling && table.previousElementSibling.classList.contains("ts-wrap")) return;
    var anchor = table.closest("div[style*='overflow']") || table;
    if (anchor.previousElementSibling && anchor.previousElementSibling.classList.contains("ts-wrap")) return;
    if (hasOwnSearch(table)) return;
    var key = keyOf(table, idx);
    var wrap = document.createElement("div"); wrap.className = "ts-wrap";
    var input = document.createElement("input"); input.type = "search"; input.placeholder = "Filter this list by name, reference or anything shown"; input.setAttribute("aria-label", "Filter this list"); input.autocomplete = "off"; input.spellcheck = false; input.setAttribute("data-ts-key", key);
    var count = document.createElement("span"); count.className = "ts-n";
    wrap.appendChild(input); wrap.appendChild(count);
    anchor.parentNode.insertBefore(wrap, anchor);
    input.value = remembered[key] || "";
    input.addEventListener("input", function () { apply(table, input, count); });
    apply(table, input, count);
  }

  function scan() {
    if (busy) return; busy = true;
    try { Array.prototype.forEach.call(document.querySelectorAll("table"), function (t, i) { enhance(t, i); }); }
    finally { busy = false; }
  }
  function later() { clearTimeout(timer); timer = setTimeout(scan, 200); }

  // A list redrawn by the page loses its rows' marks: reapply what was typed
  function reapply() {
    Array.prototype.forEach.call(document.querySelectorAll(".ts-wrap"), function (w) {
      var input = w.querySelector("input"), next = w.nextElementSibling; if (!input || !next) return;
      var table = next.tagName === "TABLE" ? next : next.querySelector("table"); if (table && input.value) apply(table, input, w.querySelector(".ts-n"));
    });
  }

  new MutationObserver(function () { if (busy) return; later(); setTimeout(reapply, 250); }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", later); else later();
})();
