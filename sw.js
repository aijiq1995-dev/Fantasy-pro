/* Service Worker — إشعارات الآيفون/المتصفح (بدون كاش حتى ما تعلق نسخة قديمة) */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'فانتازي برو', body: e.data && e.data.text() }; }
  e.waitUntil((async () => {
    await self.registration.showNotification(d.title || 'فانتازي برو', { body: d.body || '', icon: '/assets/icon-192.png', badge: '/assets/icon-192.png', tag: d.tag, data: { url: d.url || '/' }, dir: 'rtl', lang: 'ar' });
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    cs.forEach((c) => c.postMessage({ type: 'push', d }));
    if (self.navigator && 'setAppBadge' in self.navigator) { try { await self.navigator.setAppBadge(); } catch {} }
  })());
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil((async () => {
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of cs) { if ('focus' in c) { await c.focus(); try { await c.navigate(url); } catch {} return; } }
    await self.clients.openWindow(url);
  })());
});
