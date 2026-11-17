// Поднимайте версию, если меняете список файлов ниже.
var CACHE = "bodr-v5";
var FILES = [
  "./", "index.html",
  "01-zaryadka-15-min.html", "02-razminka-sheya-plechi-grud.html",
  "03-dvizhenie-nogi-poyasnitsa.html", "04-razminka-zapyastya-spina-press.html",
  "05-zal-pervoe-poseshchenie.html", "06-plan-zala-grud-plechi-spina-ruki.html",
  "07-chtenie-rost-do-tech-lead.html", "speak.js", "knigi/index.html",
  "style.css", "app.js", "pwa.js", "manifest.webmanifest",
  "fonts/fonts.css", "fonts/inter-latin.woff2", "fonts/inter-cyrillic.woff2", "fonts/space-grotesk-latin.woff2",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// Сначала кеш (работает офлайн), в фоне обновляем из сети: правки появятся при следующем открытии.
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(req, { ignoreSearch: true }).then(function (hit) {
        var net = fetch(req).then(function (res) {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(function () { return hit; });
        return hit || net;
      });
    })
  );
});
