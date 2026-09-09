/* Офлайн ажиллагаа (Service Worker).
 *
 * Зорилго: автобус, метронд интернэтгүй давтах.
 *
 * Хоёр кэш:
 *   shell-<хувилбар>  — index.html, app.js, app.css, өгөгдөл. Хувилбар
 *                       солигдох бүрд шинэчлэгдэнэ.
 *   media-v1          — audio/*.mp3. Файлын агуулга ХЭЗЭЭ Ч өөрчлөгдөхгүй
 *                       (id тутамд нэг бичлэг) тул хувилбартай холбоогүй,
 *                       шинэчлэлт болгонд дахин татахгүй.
 *
 * Стратеги: дуунд «кэш эхэлж», бусдад «сүлжээ эхэлж». Сүлжээ эхэлж
 * ажиллуулбал шинэ хувилбар гармагц шууд ирнэ — service worker нь
 * шинэчлэлтийг гацаадаг гэсэн түгээмэл асуудал үүсэхгүй.
 */
const VERSION = '2026-09-10s';
const SHELL = 'shell-' + VERSION;
const MEDIA = 'media-v1';

const CORE = [
  './', './index.html', './app.css', './app.js', './sync-config.js',
  './data/vocab.json', './data/kana.json', './data/kanji.json',
  './icons/icon-192.png', './icons/icon-512.png',
  './icons/favicon.svg', './icons/favicon-32.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL)
      // Аль нэг файл дутуу байвал бүхэл суулгалт унахгүй байх ёстой.
      .then(c => Promise.all(CORE.map(u => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== SHELL && k !== MEDIA)
        .map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;   // Supabase синк — SW оролцохгүй

  if (url.pathname.indexOf('/audio/') >= 0) {
    e.respondWith(caches.open(MEDIA).then(c =>
      c.match(req).then(hit => hit || fetch(req).then(res => {
        if (res && res.ok) c.put(req, res.clone());
        return res;
      }))
    ));
    return;
  }

  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(SHELL).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() =>
      // `app.js?v=…` гэх мэт хайлтын мөртэй хаягийг ч олохын тулд ignoreSearch.
      caches.match(req, { ignoreSearch: true })
        .then(hit => hit || caches.match('./index.html'))
    )
  );
});
