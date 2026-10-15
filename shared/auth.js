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
})();
