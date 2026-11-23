/* Contracts tab of the Weddings & Events app: the DocuSign replacement, staff side.
   Upload the Rezlynx PDF, check where the standard terms start, edit the wording if needed, place the signing boxes,
   send the link, then watch it go draft > sent > opened > signed. The couple's page is /sign/ (sign/index.html).
   Uses the app's own helpers (S, $, esc, stillWanted, showErr, clearErr, staffEmail). */
(function () {
  "use strict";
  var FN = "/functions/v1/contract-admin";
  var CT = { prefill: null, rows: null, mode: "list", cur: null, urls: null, events: [], terms: null, hist: [], pending: null, dirty: false, sel: null, place: null, busy: "", note: "" };
  window.CTR = {};
  var el = function (id) { return document.getElementById(id); };
  function toast(msg) {
    var t = el("ctToast");
    if (!t) { t = document.createElement("div"); t.id = "ctToast"; t.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#4D604F;color:#fff;padding:10px 18px;z-index:9999;font-size:14px;max-width:90vw;display:none"; document.body.appendChild(t); }
    t.textContent = msg; t.style.display = "block"; clearTimeout(toast._t); toast._t = setTimeout(function () { t.style.display = "none"; }, 3200);
  }

  /* ---------------------------------------------------------------- server */
  async function ccall(action, payload) {
    var r = await fetch(CFG.SUPABASE_URL + FN, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + CFG.SUPABASE_KEY, apikey: CFG.SUPABASE_KEY },
      body: JSON.stringify({ password: S.pw, action: action, staff_email: staffEmail(), payload: payload || {} }),
    });
    var d = await r.json().catch(function () { return {}; });
    if (!r.ok) { var e = new Error(d.error || "Request failed (" + r.status + ")"); e.status = r.status; throw e; }
    return d;
  }
  var ukDate = function (iso) { return iso ? new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso)) : ""; };
  var ukDT = function (iso) { return iso ? new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso)).replace(",", "") : ""; };
  var isoOnly = function (s) { return s ? String(s).slice(0, 10) : ""; };
  function status(c) {
    var expired = (c.status === "sent" || c.status === "viewed") && c.expires_at && new Date(c.expires_at) < new Date();
    if (expired) return '<span class="pill pill--late">Expired</span>';
    return { draft: '<span class="pill pill--prov">Draft</span>', sent: '<span class="pill pill--due">Sent</span>', viewed: '<span class="pill pill--due">Opened</span>', signing: '<span class="pill pill--due">Signing</span>', signed: '<span class="pill pill--ok">Signed</span>', void: '<span class="pill pill--late">Void</span>' }[c.status] || esc(c.status);
  }
  function busy(msg) { CT.busy = msg; var b = el("ctBusy"); if (b) b.textContent = msg; }
  function fail(e) { CT.busy = ""; showErr(e.message || String(e)); }
  function view() { return S.view === "contracts" && !S.current; }
  function paint() { if (view()) $("views").innerHTML = html(); if (CT.mode === "open") afterOpenPaint(); }

  /* ---------------------------------------------------------------- pdf.js, in the browser */
  var workerReady = null;
  function pdfReady() {
    if (!window.pdfjsLib) return Promise.reject(new Error("The PDF reader did not load. Refresh the page and try again."));
    if (!workerReady) {
      var url = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      workerReady = fetch(url).then(function (r) { return r.text(); }).then(function (t) { pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([t], { type: "text/javascript" })); }).catch(function () { pdfjsLib.GlobalWorkerOptions.workerSrc = url; });
    }
    return workerReady;
  }
  async function pageTexts(buf) {
    await pdfReady();
    var pdf = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise, out = [];
    for (var n = 1; n <= pdf.numPages; n++) {
      var tc = await (await pdf.getPage(n)).getTextContent(), rows = {};
      tc.items.forEach(function (it) { if (!it.str || !it.str.trim()) return; var y = Math.round(it.transform[5] / 3); (rows[y] = rows[y] || []).push({ x: it.transform[4], s: it.str }); });
      out.push(Object.keys(rows).map(Number).sort(function (a, b) { return b - a; }).map(function (y) { return rows[y].sort(function (a, b) { return a.x - b.x; }).map(function (i) { return i.s.trim(); }).join(" "); }).join("\n"));
    }
    return { pages: pdf.numPages, texts: out };
  }
  /* Where the standard terms start. Rezlynx puts a heading on the first page of them; the wording is the same every time. */
  function findTerms(texts) {
    for (var i = 0; i < texts.length; i++) if (/terms\s+and\s+conditions\s+black\s+horse/i.test(texts[i])) return i + 1;
    for (var j = 0; j < texts.length; j++) if (/forms part of the contract along with the wedding quote/i.test(texts[j].replace(/condi\s*ons/g, "conditions"))) return j + 1;
    return null;
  }
  function guess(texts, from) {
    var book = texts.slice(0, (from || texts.length + 1) - 1).join("\n"), g = {};
    var ref = /EVNT\d{3,}/.exec(book); g.event_ref = ref ? ref[0] : "";
    var t = /^(Wedding of .+)$/m.exec(book); g.title = t ? t[1].trim() : (g.event_ref ? "Contract " + g.event_ref : "");
    var c = /Contact:\s+(.+?)\s+Booking made on/.exec(book); g.signer1_name = c ? c[1].trim() : "";
    var em = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.exec(book); g.signer1_email = em ? em[0].toLowerCase() : "";
    var d = /\d{2}:\d{2}\s*-\s*\d{2}:\d{2}[^\n]*?(\d{2})\/(\d{2})\/(\d{4})/.exec(book); g.event_date = d ? d[3] + "-" + d[2] + "-" + d[1] : "";
    return g;
  }
  function toB64(buf) { var b = new Uint8Array(buf), s = ""; for (var i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); }

  /* ---------------------------------------------------------------- loading */
  window.loadContracts = async function () {
    try {
      var d = await ccall("list");
      if (!view()) return;
      CT.rows = d.rows || []; clearErr();
      if (CT.mode === "list") paint(); else if (CT.mode === "open" && CT.cur) paint(); else if (CT.mode === "new" || CT.mode === "terms") paint(); else { CT.mode = "list"; paint(); }
    } catch (e) { if (view()) { $("views").innerHTML = ""; showErr(e.message); } }
  };
  CTR.list = function () { CT.prefill = null; CT.mode = "list"; CT.cur = null; CT.dirty = false; CT.place = null; CT.sel = null; window.loadContracts(); };
  CTR.newOne = function () { CT.prefill = null; CT.mode = "new"; CT.pending = null; paint(); };
  /* "Send contract" on a tracker enquiry: the details and the minimum spend come from the enquiry; only the Rezlynx PDF is still to upload. */
  window.contractFromEnquiry = async function (id) {
    try {
      var d = await ccall("prefill", { enquiry_id: id });
      CT.prefill = d; CT.mode = "new"; CT.pending = null; CT.busy = ""; clearErr();
      goView("contracts");
    } catch (e) { showErr(e.message || String(e)); }
  };
  CTR.open = async function (id) {
    try {
      busy("Opening…");
      var d = await ccall("get", { id: id });
      CT.cur = d.contract; CT.urls = d.urls; CT.events = d.events || []; CT.masterVersion = d.master.version;
      CT.mode = "open"; CT.dirty = false; CT.place = null; CT.sel = null; CT.busy = ""; clearErr(); paint();
    } catch (e) { fail(e); }
  };
  CTR.terms = async function () {
    try {
      var d = await ccall("terms.get"); CT.terms = d.terms; CT.hist = d.history || []; CT.mode = "terms"; clearErr(); paint();
    } catch (e) { fail(e); }
  };

  /* ---------------------------------------------------------------- views */
  function html() {
    if (CT.mode === "new") return viewNew();
    if (CT.mode === "terms") return viewTerms();
    if (CT.mode === "open" && CT.cur) return viewOpen();
    return viewList();
  }
  function viewList() {
    var rows = CT.rows || [];
    var h = '<div class="split" style="margin-bottom:6px"><h1>Contracts</h1><div><button class="btn btn--sm" onclick="CTR.terms()">Standard terms</button> <button class="btn btn--sm btn--primary" onclick="CTR.newOne()">+ New contract</button></div></div>' +
      '<p class="muted" style="margin:0 0 12px">Upload the contract from Rezlynx, check the signing boxes, and send the couple a link. When they sign, the signed copy is emailed to them and to us, and the contract date goes on the bonus tracker.</p>';
    if (!rows.length) return h + '<div class="card empty">No contracts yet. Choose <strong>New contract</strong> and upload the PDF from Rezlynx.</div>';
    h += '<div class="card card--flush"><div style="overflow-x:auto"><table><thead><tr><th>Contract</th><th>Reference</th><th>Status</th><th>Sent</th><th>Signed</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      h += '<tr style="cursor:pointer' + (r.status === "void" ? ";opacity:.6" : "") + '" onclick="CTR.open(\'' + esc(r.id) + '\')"><td>' + esc(r.title) + (r.is_test ? ' <span class="pill pill--prov">Test</span>' : "") + (r.terms_amended ? ' <span class="pill pill--prov" title="The wording was changed for this contract">Amended</span>' : "") + '</td><td>' + esc(r.event_ref || "") + '</td><td>' + status(r) + '</td><td>' + esc(ukDate(r.sent_at)) + '</td><td>' + esc(ukDate(r.signed_at)) + '</td></tr>';
    });
    return h + "</tbody></table></div></div>";
  }

  function fieldRow(id, label, val, type, ph) { return '<div class="field"><label class="label" for="' + id + '">' + esc(label) + '</label><input type="' + (type || "text") + '" id="' + id + '" value="' + esc(val || "") + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : "") + "></div>"; }
  function detailsForm(g, pre) {
    return '<div class="row">' + fieldRow(pre + "title", "Contract title", g.title) + fieldRow(pre + "ref", "Booking reference", g.event_ref, "text", "EVNT002829") + fieldRow(pre + "date", "Event date", g.event_date, "date") + "</div>" +
      '<div class="row">' + fieldRow(pre + "n1", "First person", g.signer1_name) + fieldRow(pre + "e1", "Their email", g.signer1_email, "email") + "</div>" +
      '<div class="row">' + fieldRow(pre + "n2", "Second person (if they sign too)", g.signer2_name) + fieldRow(pre + "e2", "Their email", g.signer2_email, "email") + "</div>" +
      '<div class="row">' + fieldRow(pre + "ms", "Minimum spend (\u00a3)", g.min_spend == null ? "" : g.min_spend, "text", "e.g. 12500") + "</div>" +
      '<p class="muted" style="margin:-6px 0 12px;font-size:.85rem">' + (g.min_spend_source ? "Worked out from: " + esc(g.min_spend_source) + ". Change it if it is wrong." : "Printed in the contract under the minimum spend clause. Leave it empty and that line is left out.") + "</p>";
  }
  function readForm(pre) {
    var v = function (id) { return (el(pre + id) || {}).value || ""; };
    var was = pre === "n_" ? (CT.pending && CT.pending.g) : CT.cur, ms = v("ms").trim(), changed = !was || String(was.min_spend == null ? "" : was.min_spend) !== ms.replace(/[\u00a3,\s]/g, "");
    var out = { title: v("title"), event_ref: v("ref"), event_date: v("date"), signer1_name: v("n1"), signer1_email: v("e1"), signer2_name: v("n2"), signer2_email: v("e2"), min_spend: ms };
    if (ms && changed) out.min_spend_source = "Entered by " + (staffEmail() || "staff");
    if (pre === "n_" && CT.prefill) out.enquiry_id = CT.prefill.enquiry_id;
    return out;
  }

  function viewNew() {
    var p = CT.pending, h = '<div class="split" style="margin-bottom:6px"><h1>New contract</h1><button class="btn btn--sm" onclick="CTR.list()">Back</button></div>';
    var pf = CT.prefill;
    if (pf) {
      h += '<div class="card"><h3 style="margin:0 0 6px">Contract for ' + esc(pf.title) + '</h3><p style="margin:0 0 4px">' + esc([pf.signer1_name, pf.signer2_name].filter(Boolean).join(" and ")) + (pf.signer1_email ? " &middot; " + esc(pf.signer1_email) : " &middot; <strong>no email on the enquiry</strong>") + (pf.event_date ? " &middot; " + esc(ukDate(pf.event_date)) : "") + (pf.venue ? " &middot; " + esc(pf.venue) : "") + "</p>" +
        '<p style="margin:0 0 4px">' + (pf.min_spend ? "<strong>Minimum spend \u00a3" + Number(pf.min_spend).toLocaleString("en-GB") + "</strong> <span class='muted'>(" + esc(pf.min_spend_source) + ")</span>" : "<strong>No minimum spend found.</strong> <span class='muted'>" + esc(pf.min_spend_reason || "") + " You can type it in on the next step.</span>") + "</p>" +
        (pf.existing && pf.existing.length ? '<p class="muted" style="margin:6px 0 0">This enquiry already has: ' + pf.existing.map(function (x) { return '<a href="#" onclick="CTR.open(\'' + esc(x.id) + '\');return false">' + esc(x.title) + " (" + esc(x.status) + ")</a>"; }).join(", ") + ".</p>" : "") + "</div>";
    }
    h += '<div class="card"><div class="field"><label class="label" for="nfile">The contract PDF from Rezlynx</label><input type="file" id="nfile" accept="application/pdf" onchange="CTR.picked(this)"></div>' +
      '<p class="muted" style="margin:0">We keep the pages about the booking exactly as they are and swap the standard terms for our own copy, so any wording change is made once, here. The standard terms can start on any page.</p><div id="ctBusy" class="muted" style="margin-top:8px">' + esc(CT.busy) + "</div></div>";
    if (!p) return h;
    var opts = ""; for (var i = 1; i <= p.pages + 1; i++) opts += '<option value="' + i + '"' + (i === p.from ? " selected" : "") + ">" + (i > p.pages ? "No standard terms found (keep every page)" : "Page " + i) + "</option>";
    h += '<div class="card"><h3 style="margin:0 0 4px">Check these details</h3><p class="muted" style="margin:0 0 12px">Read from the PDF (' + p.pages + ' pages). Correct anything that is wrong.</p>' +
      (p.from ? "" : '<div class="syncnote" style="margin-bottom:12px">The standard terms heading was not found. Choose the page they start on below.</div>') +
      (p.warn ? '<div class="syncnote" style="margin-bottom:12px;color:var(--alert)"><strong>' + esc(p.warn) + "</strong></div>" : "") +
      detailsForm(p.g, "n_") +
      '<div class="field"><label class="label" for="n_from">The standard terms start on</label><select id="n_from">' + opts + "</select></div>" +
      '<label style="display:flex;gap:8px;align-items:center;margin:0 0 8px"><input type="checkbox" id="n_ini" checked> Ask the couple to initial every page</label>' +
      '<label style="display:flex;gap:8px;align-items:center;margin:0 0 14px"><input type="checkbox" id="n_test"' + (/^zz test/i.test(p.g.title) ? " checked" : "") + '> This is a test (signed copies go to the administrator only)</label>' +
      '<button class="btn btn--primary" id="n_go" onclick="CTR.create()">Create the draft</button></div>';
    return h;
  }
  CTR.picked = async function (inp) {
    var f = inp.files && inp.files[0]; if (!f) return;
    try {
      busy("Reading the PDF…");
      var buf = await f.arrayBuffer(), t = await pageTexts(buf), from = findTerms(t.texts);
      var g = guess(t.texts, from), warn = "", pf = CT.prefill;
      if (pf) {
        var pdfRef = g.event_ref;
        if (pdfRef && pf.event_ref && pdfRef !== pf.event_ref) warn = "This PDF is for " + pdfRef + " but the enquiry is " + pf.event_ref + ". Check you chose the right file before going on.";
        var first = String(pf.signer1_name || "").split(/\s+/)[0].toLowerCase(), fuller = g.signer1_name && first && g.signer1_name.toLowerCase().indexOf(first) === 0;
        g = { title: pf.title || g.title, event_ref: pf.event_ref || g.event_ref, event_date: pf.event_date || g.event_date,
              signer1_name: fuller ? g.signer1_name : (pf.signer1_name || g.signer1_name), signer1_email: pf.signer1_email || g.signer1_email,
              signer2_name: pf.signer2_name || "", signer2_email: pf.signer2_email || "", min_spend: pf.min_spend, min_spend_source: pf.min_spend_source };
      }
      CT.pending = { name: f.name, buf: buf, pages: t.pages, texts: t.texts, from: from || t.pages + 1, g: g, warn: warn };
      CT.busy = ""; paint();
    } catch (e) { fail(new Error("That PDF could not be read. " + (e.message || ""))); }
  };
  CTR.create = async function () {
    var p = CT.pending; if (!p) return;
    var b = el("n_go"); b.disabled = true; b.textContent = "Building…";
    try {
      var pl = readForm("n_"); pl.terms_from_page = Number(el("n_from").value); pl.initials = el("n_ini").checked; pl.is_test = el("n_test").checked;
      pl.pdf_b64 = toB64(p.buf); pl.source_name = p.name;
      var d = await ccall("create", pl);
      CT.pending = null; clearErr(); await CTR.open(d.contract.id);
    } catch (e) { b.disabled = false; b.textContent = "Create the draft"; fail(e); }
  };

  function viewTerms() {
    var t = CT.terms;
    var h = '<div class="split" style="margin-bottom:6px"><h1>Standard terms</h1><button class="btn btn--sm" onclick="CTR.list()">Back</button></div>' +
      '<p class="muted" style="margin:0 0 12px">The one copy every new contract starts from (currently version ' + t.version + ", last saved " + esc(ukDT(t.updated_at)) + " by " + esc(t.updated_by || "") + '). Saving changes it for contracts made from now on. A draft keeps its own copy until you reset it.</p>' +
      '<div class="card"><div class="field"><label class="label" for="tt">Heading</label><input type="text" id="tt" value="' + esc(t.title) + '"></div>' +
      '<div class="field"><label class="label" for="tb">Wording</label><textarea id="tb" rows="26" style="width:100%;font-family:ui-monospace,Consolas,monospace;font-size:13px;line-height:1.45">' + esc(t.body) + '</textarea></div>' +
      '<p class="muted" style="margin:0 0 12px">A blank line starts a new paragraph. Put <code>**two stars**</code> round words to make them bold. Start a line with <code>- </code> for a bullet. Numbers are just typed ("3. DEPOSIT"). <code>{{minimum_spend}}</code> is replaced with the minimum spend of each contract.</p>' +
      '<button class="btn btn--primary" onclick="CTR.saveTerms()">Save as the new standard</button></div>';
    if (CT.hist.length) {
      h += '<div class="card"><h3 style="margin:0 0 8px">Earlier versions</h3><table><tbody>' + CT.hist.map(function (x) {
        return "<tr><td>Version " + x.version + "</td><td>" + esc(ukDT(x.saved_at)) + "</td><td>" + esc(x.saved_by || "") + '</td><td><button class="btn btn--sm" onclick="CTR.loadVersion(\'' + esc(x.id) + '\')">Load into the box</button></td></tr>';
      }).join("") + '</tbody></table><p class="muted" style="margin:8px 0 0">Loading a version only fills the box above. Nothing changes until you save.</p></div>';
    }
    return h;
  }
  CTR.saveTerms = async function () {
    try { var d = await ccall("terms.save", { title: el("tt").value, body: el("tb").value }); CT.note = "Saved as version " + d.version + "."; await CTR.terms(); toast("Saved as version " + d.version); } catch (e) { fail(e); }
  };
  CTR.loadVersion = async function (id) {
    try { var d = await ccall("terms.version", { id: id }); el("tt").value = d.version.title; el("tb").value = d.version.body; toast("Version " + d.version.version + " loaded into the box. Save to use it."); window.scrollTo({ top: 0 }); } catch (e) { fail(e); }
  };

  /* ---- one contract */
  function viewOpen() {
    var c = CT.cur, draft = c.status === "draft", out = c.status === "sent" || c.status === "viewed";
    var h = '<div class="split" style="margin-bottom:6px"><h1>' + esc(c.title) + '</h1><button class="btn btn--sm" onclick="CTR.list()">Back</button></div>' +
      '<p style="margin:0 0 12px">' + status(c) + (c.is_test ? ' <span class="pill pill--prov">Test</span>' : "") + (c.terms_amended ? ' <span class="pill pill--prov">Wording amended</span>' : "") + ' <span class="muted">' + esc(c.event_ref || "") + (c.event_date ? " &middot; event " + esc(ukDate(c.event_date)) : "") + '</span></p><div id="ctBusy" class="muted" style="margin:0 0 8px">' + esc(CT.busy) + "</div>";

    if (c.status === "signed") {
      h += '<div class="card"><h3 style="margin:0 0 6px">Signed ' + esc(ukDT(c.signed_at)) + "</h3>" +
        '<p style="margin:0 0 6px">By ' + esc(((c.sign_data && c.sign_data.names) || []).join(" and ")) + ". IP " + esc((c.sign_data && c.sign_data.ip) || "") + "</p>" +
        '<p class="muted" style="margin:0 0 12px">Bonus tracker: ' + esc(c.bonus_result || "-") + "</p>" +
        '<div class="actions"><button class="btn btn--primary" onclick="CTR.dl(\'signed\')">Download the signed PDF</button> <button class="btn" onclick="CTR.resendSigned()">Email the signed copies again</button> <button class="btn" onclick="CTR.syncBonus()">Update the bonus tracker again</button></div></div>';
    } else if (out) {
      var link = c.link;
      h += '<div class="card"><h3 style="margin:0 0 6px">' + (c.status === "viewed" ? "Opened by the couple " + esc(ukDT(c.last_viewed_at)) : "Waiting for the couple to open it") + "</h3>" +
        '<p class="muted" style="margin:0 0 10px">Sent ' + esc(ukDT(c.sent_at)) + " to " + esc([c.signer1_email, c.signer2_email].filter(Boolean).join(", ")) + ". The link works until " + esc(ukDT(c.expires_at)) + ".</p>" +
        '<div class="field"><label class="label" for="lnk">Their link (to paste into a message if you prefer)</label><input type="text" id="lnk" readonly value="' + esc(link) + '" onclick="this.select()"></div>' +
        '<div class="actions"><button class="btn" onclick="CTR.copy()">Copy the link</button> <button class="btn btn--primary" onclick="CTR.resend()">Email it again</button> <button class="btn" onclick="CTR.reopen()">Withdraw to edit</button> <button class="btn btn--danger" onclick="CTR.void_()">Void</button></div></div>';
    } else if (c.status === "void") {
      h += '<div class="card"><h3 style="margin:0 0 6px">Void</h3><p class="muted" style="margin:0">' + esc(ukDT(c.void_at)) + " by " + esc(c.void_by || "") + (c.void_reason ? ". " + esc(c.void_reason) : "") + '. Its link no longer works.</p></div>';
    }

    if (draft) {
      h += '<div class="card"><h3 style="margin:0 0 10px">Details</h3>' + detailsForm(c, "e_") +
        '<label style="display:flex;gap:8px;align-items:center;margin:0 0 12px"><input type="checkbox" id="e_ini"' + (!c.options || c.options.initials !== false ? " checked" : "") + '> Ask the couple to initial every page</label>' +
        '<button class="btn btn--primary" onclick="CTR.saveDetails()">Save details</button></div>';
      h += '<div class="card"><h3 style="margin:0 0 4px">Standard terms for this contract</h3>' +
        '<p class="muted" style="margin:0 0 10px">' + (c.terms_amended ? "Changed from the standard." : "Same as the standard terms (version " + c.terms_master_version + ").") + ' Edit here for this contract only, or use the button underneath to make your wording the standard for every future contract.</p>' +
        '<div class="field"><input type="text" id="e_tt" value="' + esc(c.terms_title || "") + '"></div>' +
        '<textarea id="e_tb" rows="18" style="width:100%;font-family:ui-monospace,Consolas,monospace;font-size:13px;line-height:1.45">' + esc(c.terms_body || "") + '</textarea>' +
        '<p class="muted" style="margin:6px 0 12px">Blank line = new paragraph. <code>**bold**</code>. Start a line with <code>- </code> for a bullet. <code>{{minimum_spend}}</code> is replaced with the minimum spend of this contract.</p>' +
        '<div class="actions"><button class="btn btn--primary" onclick="CTR.saveTermsHere()">Save the wording</button> <button class="btn" onclick="CTR.resetTerms()">Start again from the standard terms</button> <button class="btn" onclick="CTR.promote()">Make this the standard for every contract</button></div></div>';
      h += '<div class="card"><h3 style="margin:0 0 4px">Replace the booking pages</h3><p class="muted" style="margin:0 0 10px">If the booking changed in Rezlynx, upload the new PDF. The wording above stays as it is.</p>' +
        '<div class="row"><div class="field"><input type="file" id="e_file" accept="application/pdf" onchange="CTR.pickedNew(this)"></div></div><div id="e_replace"></div></div>';
    }

    h += '<div class="card"><h3 style="margin:0 0 4px">The contract' + (draft ? " and where they sign" : "") + "</h3>";
    if (draft) {
      var two = !!c.signer2_name;
      h += '<p class="muted" style="margin:0 0 10px">Green boxes are placed for you: a signature and date on the last page' + (two ? " (for both people)" : "") + ", and initials on every page. To add a box of your own, choose what it is, press <strong>Place</strong>, then click the page. Drag your own boxes to move them.</p>" +
        '<div class="row" style="align-items:end"><div class="field"><label class="label" for="f_type">New box</label><select id="f_type"><option value="signature">Signature</option><option value="initials">Initials</option><option value="date">Date</option><option value="text">Text the couple types</option><option value="check">Tick box</option></select></div>' +
        (two ? '<div class="field"><label class="label" for="f_signer">For</label><select id="f_signer"><option value="1">First person</option><option value="2">Second person</option></select></div>' : "") +
        '<div class="field"><button class="btn" id="f_place" onclick="CTR.togglePlace()">' + (CT.place ? "Click a page… (cancel)" : "Place") + '</button></div><div class="field" id="f_sel"></div><div class="field"><button class="btn btn--primary" id="f_save" onclick="CTR.saveFields()"' + (CT.dirty ? "" : " disabled") + ">Save the boxes</button></div></div>";
    } else {
      h += '<p class="muted" style="margin:0 0 10px">' + (c.status === "signed" ? "This is the contract as the couple saw it, before signing." : "This is exactly what the couple sees.") + "</p>";
    }
    h += '<div id="cpages" style="max-width:760px"><span class="spin"></span></div></div>';

    if (draft) {
      var tos = [c.signer1_email, c.signer2_email].filter(Boolean);
      h += '<div class="card"><h3 style="margin:0 0 6px">Send to the couple</h3><p class="muted" style="margin:0 0 10px">' + (tos.length ? "An email with a link goes to " + esc(tos.join(" and ")) + "." : "Add the couple's email address above first.") + (c.is_test ? " This is a test contract." : "") + "</p>" +
        '<div class="field"><label class="label" for="s_msg">A short message in the email (optional)</label><textarea id="s_msg" rows="3" style="width:100%"></textarea></div>' +
        '<div class="field" style="max-width:220px"><label class="label" for="s_days">Link stays open for (days)</label><input type="number" id="s_days" min="1" max="90" value="30"></div>' +
        '<div class="actions"><button class="btn btn--primary" onclick="CTR.send()"' + (tos.length ? "" : " disabled") + '>Send to the couple</button> <button class="btn" onclick="CTR.dl(\'base\')">Download a copy</button> <button class="btn btn--danger" onclick="CTR.del()">Delete this draft</button></div></div>';
    } else {
      h += '<div class="actions" style="margin:0 0 16px"><button class="btn" onclick="CTR.dl(\'base\')">Download the unsigned contract</button> <button class="btn" onclick="CTR.dl(\'source\')">Download the original Rezlynx PDF</button>' + (c.status === "void" || c.is_test ? ' <button class="btn btn--danger" onclick="CTR.del()">Delete</button>' : "") + "</div>";
    }

    h += '<div class="card"><h3 style="margin:0 0 8px">What has happened</h3><table><tbody>' + CT.events.map(function (e) {
      var d = e.detail && typeof e.detail === "object" ? Object.keys(e.detail).map(function (k) { var v = e.detail[k]; return k + ": " + (typeof v === "object" ? JSON.stringify(v) : v); }).join("; ") : "";
      return "<tr><td style='white-space:nowrap'>" + esc(ukDT(e.at)) + "</td><td>" + esc(e.kind) + "</td><td>" + esc(e.actor || "") + "</td><td class='muted'>" + esc((e.ip ? e.ip + " " : "") + d).slice(0, 260) + "</td></tr>";
    }).join("") + "</tbody></table></div>";
    return h;
  }

  /* ---------------------------------------------------------------- actions */
  function details(pre) { return readForm(pre); }
  async function act(msg, fn) { try { busy(msg); clearErr(); await fn(); } catch (e) { fail(e); } }
  CTR.saveDetails = function () {
    return act("Saving…", async function () {
      var pl = details("e_"); pl.id = CT.cur.id; pl.options = { initials: el("e_ini").checked };
      await ccall("update", pl); await CTR.open(CT.cur.id); toast("Saved");
    });
  };
  CTR.saveTermsHere = function () {
    return act("Saving the wording and rebuilding…", async function () {
      await ccall("update", { id: CT.cur.id, terms_title: el("e_tt").value, terms_body: el("e_tb").value }); await CTR.open(CT.cur.id); toast("Wording saved");
    });
  };
  CTR.resetTerms = function () {
    if (!confirm("Replace this contract's wording with the current standard terms? Any change you made here is lost.")) return;
    return act("Resetting…", async function () { await ccall("update", { id: CT.cur.id, reset_terms: true }); await CTR.open(CT.cur.id); toast("Reset to the standard terms"); });
  };
  CTR.promote = function () {
    if (!confirm("Make this wording the standard for every contract made from now on? Drafts already made keep their own copy.")) return;
    return act("Saving as the standard…", async function () { var d = await ccall("terms.promote", { id: CT.cur.id }); await CTR.open(CT.cur.id); toast("Now the standard (version " + d.version + ")"); });
  };
  CTR.pickedNew = async function (inp) {
    var f = inp.files && inp.files[0]; if (!f) return;
    try {
      busy("Reading the PDF…"); var buf = await f.arrayBuffer(), t = await pageTexts(buf), from = findTerms(t.texts) || t.pages + 1;
      CT.replace = { buf: buf, pages: t.pages, from: from, name: f.name }; CT.busy = "";
      var opts = ""; for (var i = 1; i <= t.pages + 1; i++) opts += '<option value="' + i + '"' + (i === from ? " selected" : "") + ">" + (i > t.pages ? "No standard terms found (keep every page)" : "Page " + i) + "</option>";
      el("e_replace").innerHTML = '<div class="field"><label class="label" for="r_from">The standard terms start on</label><select id="r_from">' + opts + '</select></div><button class="btn btn--primary" onclick="CTR.doReplace()">Replace the booking pages</button>';
    } catch (e) { fail(e); }
  };
  CTR.doReplace = function () {
    var r = CT.replace; if (!r) return;
    return act("Rebuilding…", async function () {
      await ccall("update", { id: CT.cur.id, pdf_b64: toB64(r.buf), terms_from_page: Number(el("r_from").value) }); CT.replace = null; await CTR.open(CT.cur.id); toast("Booking pages replaced");
    });
  };
  CTR.send = function () {
    var c = CT.cur;
    return act("Sending…", async function () {
      if (CT.dirty) await ccall("update", { id: c.id, fields: manual() });
      var d = await ccall("send", { id: c.id, message: el("s_msg").value, expires_days: Number(el("s_days").value) || 30 });
      await CTR.open(d.contract.id); toast("Sent");
    });
  };
  CTR.resend = function () { return act("Sending…", async function () { await ccall("resend", { id: CT.cur.id }); await CTR.open(CT.cur.id); toast("Sent again"); }); };
  CTR.reopen = function () {
    if (!confirm("Withdraw this contract so you can change it? The couple's link stops working until you send it again.")) return;
    return act("Withdrawing…", async function () { await ccall("reopen", { id: CT.cur.id }); await CTR.open(CT.cur.id); toast("Back to a draft"); });
  };
  CTR.void_ = function () {
    var why = prompt("Why is this contract being voided? (optional)"); if (why === null) return;
    return act("Voiding…", async function () { await ccall("void", { id: CT.cur.id, reason: why }); await CTR.open(CT.cur.id); toast("Voided"); });
  };
  CTR.del = function () {
    if (!confirm("Delete this contract and its files? This cannot be undone.")) return;
    return act("Deleting…", async function () { await ccall("delete", { id: CT.cur.id }); toast("Deleted"); CTR.list(); });
  };
  CTR.dl = function (which) { return act("Preparing the download…", async function () { var d = await ccall("download", { id: CT.cur.id, which: which }); busy(""); window.open(d.url, "_blank"); }); };
  CTR.copy = function () { var i = el("lnk"); i.select(); try { navigator.clipboard.writeText(i.value); toast("Link copied"); } catch (e) { document.execCommand("copy"); toast("Link copied"); } };
  CTR.syncBonus = function () { return act("Updating the bonus tracker…", async function () { var d = await ccall("syncBonus", { id: CT.cur.id }); await CTR.open(CT.cur.id); toast(d.note); }); };
  CTR.resendSigned = function () {
    if (!confirm("Email the signed copy to the couple and to the team again?")) return;
    return act("Sending…", async function () { await ccall("resendSigned", { id: CT.cur.id }); await CTR.open(CT.cur.id); toast("Sent"); });
  };

  /* ---------------------------------------------------------------- the page images and the signing boxes */
  var LABEL = { signature: "Signature", initials: "Initials", date: "Date", text: "Text", check: "Tick" };
  var SIZE = { signature: [0.26, 0.036], initials: [0.085, 0.018], date: [0.146, 0.0166], text: [0.3, 0.022], check: [0.03, 0.02] };
  var manual = function () { return CT.cur.fields.filter(function (f) { return !f.auto; }); };

  async function afterOpenPaint() {
    var host = el("cpages"); if (!host || !CT.urls || !CT.urls.base) return;
    var token = (CT.paintToken = (CT.paintToken || 0) + 1);
    try {
      await pdfReady();
      var pdf = await pdfjsLib.getDocument({ url: CT.urls.base }).promise;
      if (token !== CT.paintToken) return;
      host.innerHTML = "";
      for (var n = 1; n <= pdf.numPages; n++) {
        var wrap = document.createElement("div");
        wrap.innerHTML = '<div class="muted" style="font-size:12px;margin:8px 0 2px">Page ' + n + " of " + pdf.numPages + '</div><div class="ctpg" data-page="' + n + '" style="position:relative;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);width:100%"><canvas style="display:block;width:100%;height:auto"></canvas></div>';
        host.appendChild(wrap);
        var page = await pdf.getPage(n), vp0 = page.getViewport({ scale: 1 }), s = (Math.min(host.clientWidth || 700, 760) * 1.5) / vp0.width, vp = page.getViewport({ scale: s }), cv = wrap.querySelector("canvas");
        cv.width = vp.width; cv.height = vp.height;
        await page.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise;
        if (token !== CT.paintToken) return;
        var box = wrap.querySelector(".ctpg"); box.dataset.n = n;
        drawFields(box, n);
        if (CT.cur.status === "draft") box.addEventListener("click", placeClick);
      }
    } catch (e) { host.innerHTML = '<div class="syncnote">The pages could not be shown: ' + esc(e.message || "") + "</div>"; }
  }
  function drawFields(box, n) {
    CT.cur.fields.filter(function (f) { return f.page === n; }).forEach(function (f) {
      var d = document.createElement("div"); d.className = "ctf"; d.dataset.id = f.id;
      var mine = !f.auto, sel = CT.sel === f.id;
      d.style.cssText = "position:absolute;left:" + f.x * 100 + "%;top:" + f.y * 100 + "%;width:" + f.w * 100 + "%;height:" + f.h * 100 + "%;box-sizing:border-box;border:2px " + (mine ? "solid #3F2F28" : "dashed #4D604F") + ";background:" + (mine ? "rgba(63,47,40,.15)" : "rgba(204,205,180,.4)") + ";font-size:10px;line-height:1;display:flex;align-items:center;justify-content:center;color:#3F2F28;overflow:hidden;" + (mine ? "cursor:move;" : "pointer-events:none;") + (sel ? "outline:3px solid #4D604F;" : "");
      d.textContent = (f.signer === 2 ? "2: " : "") + (f.label || LABEL[f.type]);
      if (mine && CT.cur.status === "draft") d.addEventListener("pointerdown", function (e) { dragStart(e, f, d, box); });
      box.appendChild(d);
    });
  }
  CTR.togglePlace = function () { CT.place = CT.place ? null : { type: el("f_type").value, signer: el("f_signer") ? Number(el("f_signer").value) : 1 }; if (CT.place) CT.sel = null; paintToolbar(); document.body.style.cursor = CT.place ? "crosshair" : ""; };
  function paintToolbar() {
    var b = el("f_place"); if (b) b.textContent = CT.place ? "Click a page… (cancel)" : "Place";
    var s = el("f_save"); if (s) s.disabled = !CT.dirty;
    var f = CT.sel && CT.cur.fields.filter(function (x) { return x.id === CT.sel; })[0], box = el("f_sel");
    if (box) box.innerHTML = f ? '<label class="label">Selected box</label><input type="text" id="f_lab" value="' + esc(f.label || "") + '" placeholder="Label" style="width:140px"> <label><input type="checkbox" id="f_req"' + (f.required !== false ? " checked" : "") + "> Needed</label> " + '<button class="btn btn--sm btn--danger" onclick="CTR.delField()">Delete</button>' : "";
    var lab = el("f_lab"); if (lab) lab.oninput = function () { f.label = lab.value; CT.dirty = true; var d = document.querySelector('.ctf[data-id="' + f.id + '"]'); if (d) d.textContent = (f.signer === 2 ? "2: " : "") + (f.label || LABEL[f.type]); paintToolbar2(); };
    var rq = el("f_req"); if (rq) rq.onchange = function () { f.required = rq.checked; CT.dirty = true; paintToolbar2(); };
  }
  function paintToolbar2() { var s = el("f_save"); if (s) s.disabled = !CT.dirty; }
  function placeClick(e) {
    if (!CT.place || e.target.closest(".ctf")) return;
    var box = e.currentTarget, r = box.getBoundingClientRect(), sz = SIZE[CT.place.type];
    var f = { id: "m-" + Math.random().toString(36).slice(2, 10), type: CT.place.type, signer: CT.place.signer, page: Number(box.dataset.n), w: sz[0], h: sz[1], required: true, label: "", auto: false };
    f.x = Math.min(1 - f.w, Math.max(0, (e.clientX - r.left) / r.width - f.w / 2)); f.y = Math.min(1 - f.h, Math.max(0, (e.clientY - r.top) / r.height - f.h / 2));
    CT.cur.fields.push(f); CT.dirty = true; CT.sel = f.id; CT.place = null; document.body.style.cursor = "";
    var d = box.querySelectorAll(".ctf"); d.forEach(function (x) { x.remove(); }); drawFields(box, f.page); paintToolbar();
  }
  function dragStart(e, f, d, box) {
    if (CT.place) return;
    e.preventDefault(); CT.sel = f.id; var r = box.getBoundingClientRect(), sx = e.clientX, sy = e.clientY, ox = f.x, oy = f.y, moved = false;
    document.querySelectorAll(".ctf").forEach(function (x) { x.style.outline = x.dataset.id === f.id ? "3px solid #4D604F" : ""; });
    paintToolbar();
    function mv(ev) { moved = true; f.x = Math.min(1 - f.w, Math.max(0, ox + (ev.clientX - sx) / r.width)); f.y = Math.min(1 - f.h, Math.max(0, oy + (ev.clientY - sy) / r.height)); d.style.left = f.x * 100 + "%"; d.style.top = f.y * 100 + "%"; }
    function up() { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); if (moved) { CT.dirty = true; paintToolbar2(); } }
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  }
  CTR.delField = function () {
    CT.cur.fields = CT.cur.fields.filter(function (f) { return f.id !== CT.sel; }); CT.sel = null; CT.dirty = true;
    document.querySelectorAll(".ctpg").forEach(function (b) { b.querySelectorAll(".ctf").forEach(function (x) { x.remove(); }); drawFields(b, Number(b.dataset.n)); }); paintToolbar();
  };
  CTR.saveFields = function () {
    return act("Saving the boxes…", async function () { await ccall("update", { id: CT.cur.id, fields: manual() }); CT.dirty = false; var keep = CT.sel; await CTR.open(CT.cur.id); toast("Boxes saved"); });
  };
})();
