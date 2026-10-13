/* Staff Portal service worker: receives push notifications, shows them, and puts the number on the app icon.
   It does no caching, so the portal itself is always the live page. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : "" }; }
  const total = Number(d.total || 0);
  e.waitUntil((async () => {
    try { if (self.navigator && navigator.setAppBadge) { if (total > 0) await navigator.setAppBadge(total); else await navigator.clearAppBadge(); } } catch (_) { /* not every device can badge an icon */ }
    await self.registration.showNotification(d.title || "Staff Portal", {
      body: d.body || "", icon: "icons/icon-192.png", badge: "icons/icon-192.png",
      tag: "bhb-portal", renotify: true, data: { url: d.url || "/portal/app.html" },
    });
  })());
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/portal/app.html", self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) if (c.url.indexOf("/portal/") >= 0 && "focus" in c) return c.focus();
    return self.clients.openWindow(url);
  }));
});
