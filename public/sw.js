/**
 * SERVICE WORKER (sw.js)
 * Berfungsi untuk menangani offline mode dan notifikasi prayer time.
 */
const CACHE_NAME = "imsakiyah-cache-v2";
const ASSETS_TO_CACHE = [
  "/",
  "/manifest.json",
  "/logo-imsakiyah.png"
];

// Tahap Install: Simpan file ke Cache
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting(); // Activate immediately
});

// Tahap Fetch: Ambil dari internet, jika gagal/offline ambil dari Cache
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone response for caching
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Activate: Clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// ==================== NOTIFICATION HANDLING ====================

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow("/")
  );
});

// Handle push notifications (for future Web Push API implementation)
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Jadwal Imsakiyah";
  const options = {
    body: data.body || "Waktunya prayer time!",
    icon: "/logo-imsakiyah.png",
    badge: "/logo-imsakiyah.png",
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: data.primaryKey || "1",
    },
    actions: [
      { action: "open", title: "Buka App" },
      { action: "dismiss", title: "Tutup" },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Function to show notification from main app (for immediate notifications)
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SHOW_NOTIFICATION") {
    const { title, body, icon } = event.data;
    self.registration.showNotification(title, {
      body: body,
      icon: icon || "/logo-imsakiyah.png",
      badge: "/logo-imsakiyah.png",
      vibrate: [100, 50, 100],
      tag: "prayer-notification",
      requireInteraction: true,
    });
  }
});
