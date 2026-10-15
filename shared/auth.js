/* Staff Portal sign-in for the tiles. The portal puts the person's session into this frame (sessionStorage "bhb_staff_token"); this script adds it to
   every call a tile makes to our services that says who is asking (staff_email), so the service can check the sign-in for real instead of trusting
   an email address. Load it first in the page head:  <script src="/shared/auth.js"></script>
   Plain ES5 on purpose: some of the tablets are old. It changes nothing else about a request. */
(function () {
  if (window.__bhbAuth) return; window.__bhbAuth = 1;
  var tok = function () { try { return sessionStorage.getItem("bhb_staff_token") || ""; } catch (e) { return ""; } };
  var isFn = function (u) { return typeof u === "string" && u.indexOf("/functions/v1/") >= 0; };
  var withToken = function (body) {
    var t = tok(); if (!t || typeof body !== "string" || body.charAt(0) !== "{") return body;
    try {
      var o = JSON.parse(body);
      if (!o || typeof o !== "object" || o.staff_token) return body;
      var asks = Object.prototype.hasOwnProperty.call(o, "staff_email") || (o.payload && typeof o.payload === "object" && Object.prototype.hasOwnProperty.call(o.payload, "staff_email"));
      if (!asks) return body;
      o.staff_token = t; return JSON.stringify(o);
    } catch (e) { return body; }
  };
  if (window.fetch) {
    var F = window.fetch;
    window.fetch = function (input, init) {
      try { if (isFn(typeof input === "string" ? input : "") && init && typeof init.body === "string") { var b = withToken(init.body); if (b !== init.body) { var n = {}; for (var k in init) n[k] = init[k]; n.body = b; init = n; } } } catch (e) {}
      return F.call(this, input, init);
    };
  }
  if (window.XMLHttpRequest) {
    var P = XMLHttpRequest.prototype, open = P.open, send = P.send;
    P.open = function (m, u) { this.__bhbUrl = u; return open.apply(this, arguments); };
    P.send = function (body) { try { if (isFn(this.__bhbUrl)) body = withToken(body); } catch (e) {} return send.call(this, body); };
  }

  /* A phone still running a portal from before this change never hands the session to the tile, so the tile would sit on "Loading". Say what to do instead. */
  var warn = function () {
    try {
      var email = ""; try { email = sessionStorage.getItem("bhb_staff_email") || ""; } catch (e) {}
      if (!email || tok() || window.parent === window || document.getElementById("bhbAuthWarn")) return;
      var d = document.createElement("div"); d.id = "bhbAuthWarn";
      d.style.cssText = "position:fixed;left:12px;right:12px;top:12px;z-index:2147483647;background:#fff;border:2px solid #B08D57;border-radius:10px;padding:14px 16px;font:15px/1.4 Raleway,Arial,sans-serif;color:#262626;box-shadow:0 8px 30px rgba(0,0,0,.25);text-align:center";
      d.innerHTML = '<b>Please refresh the Staff Portal</b><div style="margin:6px 0 10px">This page needs the portal to sign you in again. Close the portal and open it again, or tap the button.</div><button style="font:inherit;font-weight:700;padding:10px 18px;border-radius:8px;border:0;background:#4E5F4F;color:#fff">Refresh now</button>';
      d.querySelector("button").onclick = function () { try { parent.location.reload(); } catch (e) { location.reload(); } };
      document.body.appendChild(d);
    } catch (e) {}
  };
  window.addEventListener("load", function () { setTimeout(warn, 2500); });
})();
