self.addEventListener("push", (event) => {
  let message = {};
  try { message = event.data ? event.data.json() : {}; } catch { message = { body: event.data?.text() }; }
  const root = self.registration.scope;
  event.waitUntil(self.registration.showNotification(message.title || "MemoryDock reminder", {
    body: message.body || "You asked MemoryDock to remind you.",
    icon: message.icon || `${root}favicon.svg`,
    badge: message.badge || `${root}favicon.svg`,
    tag: message.tag || "memorydock-reminder",
    data: { url: message.url || root },
    renotify: true,
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || self.registration.scope;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const matching = windows.find((client) => client.url.startsWith(self.registration.scope));
    if (matching) return matching.focus();
    return self.clients.openWindow(target);
  }));
});
