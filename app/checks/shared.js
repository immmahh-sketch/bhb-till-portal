/* Shared helpers for the Checks app + Checks admin portal.
   Plain ES5 + XMLHttpRequest (not fetch) and no IndexedDB — same
   compatibility rules as the till: some tablets run a stock Android 5.1
   WebView (~Chromium 39): no fetch(), no CSS var()/inset/gap/#rgba hex. */
"use strict";
if (typeof Object.assign !== "function") {
  Object.assign = function (target) {
    for (var i = 1; i < arguments.length; i++) {
      var s = arguments[i]; if (!s) continue;
      for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) target[k] = s[k];
    }
    return target;
  };
}

var CFG = {
  SUPABASE_URL: "https://safcrtrfdzsnftghibot.supabase.co",
  SUPABASE_KEY: "sb_publishable_RGaIB8W145BFCWzOxamQvA_7VIkTHMU",
  PASSWORD_LOG: ["01207", "BlackH0rse#"],
  PASSWORD_PORTAL: "BlackH0rse#",
  COMPANY_NAME: "Black Horse Beamish Ltd"
};

function sb(path, opts) {
  opts = opts || {};
  var url = CFG.SUPABASE_URL + "/rest/v1/" + path;
  var body = opts.body != null ? JSON.stringify(opts.body) : null;
  return new Promise(function (resolve, reject) {
    var xhr = new XMLHttpRequest();
    var done = false;
    function settle(fn, arg) { if (done) return; done = true; clearTimeout(killer); try { xhr.onreadystatechange = null; } catch (e) {} fn(arg); }
    var killer = setTimeout(function () { try { xhr.abort(); } catch (e) {} settle(reject, new Error("timed out")); }, 15000);
    try { xhr.open(opts.method || "GET", url, true); } catch (e) { settle(reject, new Error("bad request")); return; }
    try { xhr.timeout = 15000; } catch (e) {}
    xhr.setRequestHeader("apikey", CFG.SUPABASE_KEY);
    xhr.setRequestHeader("Authorization", "Bearer " + CFG.SUPABASE_KEY);
    if (opts.prefer) xhr.setRequestHeader("Prefer", opts.prefer);
    if (body != null) xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status === 0) { settle(reject, new Error("no connection")); return; }
      if (xhr.status < 200 || xhr.status >= 300) { settle(reject, new Error("HTTP " + xhr.status + " " + String(xhr.responseText || "").slice(0, 200))); return; }
      var txt = xhr.responseText || "";
      if (xhr.status === 204 || !txt) { settle(resolve, null); return; }
      try { settle(resolve, JSON.parse(txt)); } catch (e) { settle(reject, new Error("bad JSON")); }
    };
    xhr.ontimeout = function () { settle(reject, new Error("timed out")); };
    xhr.onerror = function () { settle(reject, new Error("no connection")); };
    try { xhr.send(body); } catch (e) { settle(reject, new Error("send failed")); }
  });
}

/* Upload a Blob/File to a public bucket. Returns the public URL. */
function sbUpload(bucket, path, blob, contentType) {
  return new Promise(function (resolve, reject) {
    var xhr = new XMLHttpRequest();
    var url = CFG.SUPABASE_URL + "/storage/v1/object/" + bucket + "/" + path;
    xhr.open("POST", url, true);
    xhr.timeout = 30000;
    xhr.setRequestHeader("apikey", CFG.SUPABASE_KEY);
    xhr.setRequestHeader("Authorization", "Bearer " + CFG.SUPABASE_KEY);
    xhr.setRequestHeader("Content-Type", contentType || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "true");
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(CFG.SUPABASE_URL + "/storage/v1/object/public/" + bucket + "/" + path);
      } else reject(new Error("upload failed: HTTP " + xhr.status));
    };
    xhr.ontimeout = function () { reject(new Error("upload timed out")); };
    xhr.onerror = function () { reject(new Error("upload failed")); };
    xhr.send(blob);
  });
}

/* canvas.toBlob is Chrome 50+ / Safari 11+ — fall back to toDataURL on anything older. */
function canvasToBlob(canvas, cb) {
  if (canvas.toBlob) { canvas.toBlob(cb, "image/png"); return; }
  var data = canvas.toDataURL("image/png").split(",")[1];
  var bin = atob(data), arr = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  cb(new Blob([arr], { type: "image/png" }));
}

function uid() {
  if (self.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0, v = c === "x" ? r : (r & 0x3) | 0x8; return v.toString(16);
  });
}
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function pad(n) { return (n < 10 ? "0" : "") + n; }
function fmtDT(d) { d = new Date(d); return d.toLocaleDateString("en-GB") + " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); }

/* ---- period key / due-date maths (shared by staff app + portal) ---- */
function isoWeek(d) {
  var dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  var day = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - day + 3);
  var firstThu = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
  var week = 1 + Math.round(((dt - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return dt.getUTCFullYear() + "-W" + pad(week);
}
function periodKey(freq, d) {
  d = d || new Date();
  if (freq === "daily") return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  if (freq === "weekly") return isoWeek(d);
  if (freq === "monthly") return d.getFullYear() + "-" + pad(d.getMonth() + 1);
  if (freq === "six_monthly") return d.getFullYear() + "-H" + (d.getMonth() < 6 ? 1 : 2);
  return String(d.getFullYear());
}
function periodDueAt(freq, dueTimeStr, d) {
  d = d || new Date();
  var end;
  if (freq === "daily") end = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  else if (freq === "weekly") { var day = (d.getDay() + 6) % 7; end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (6 - day)); }
  else if (freq === "monthly") end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  else if (freq === "six_monthly") end = d.getMonth() < 6 ? new Date(d.getFullYear(), 5, 30) : new Date(d.getFullYear(), 11, 31);
  else end = new Date(d.getFullYear(), 11, 31);
  var parts = (dueTimeStr || "23:59:00").split(":");
  end.setHours(+parts[0] || 23, +parts[1] || 59, 0, 0);
  return end;
}
function periodLabel(freq, key) {
  if (freq === "daily") return new Date(key).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  if (freq === "weekly") return "Week " + key.split("-W")[1] + ", " + key.split("-W")[0];
  if (freq === "monthly") { var p = key.split("-"); return new Date(p[0], p[1] - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" }); }
  if (freq === "six_monthly") { var h = key.split("-H"); return (h[1] === "1" ? "Jan–Jun " : "Jul–Dec ") + h[0]; }
  return key;
}
var FREQ_LABEL = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", six_monthly: "6-monthly", annual: "Annual" };
var CAT_LABEL = { guest_journey: "Guest Journey", shift: "Shift Checks", health_safety: "Health & Safety" };
