/**
 * SERVICE WORKER (sw.js)
 * Berfungsi untuk menangani offline mode dan notifikasi.
 */
const CACHE_NAME = "imsakiyah-cache-v1";
const ASSETS_TO_CACHE = ["/", "/manifest.json"];

// Tahap Install: Simpan file ke Cache
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }),
  );
});

// Tahap Fetch: Ambil dari internet, jika gagal/offline ambil dari Cache
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

// Menangani klik pada notifikasi
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow("/"), // Buka aplikasi saat notifikasi diklik
  );
});
