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
const VERSION = '2026-09-11b';
const SHELL = 'shell-' + VERSION;
const MEDIA = 'media-v1';

/* ЗААВАЛ байх ёстой: эдгээрийн аль нэг нь кэшлэгдэхгүй бол суулгалт
   УНАХ ёстой. Урьд нь алдааг залгиад идэвхжиж, ажиллаж байсан хуучин
   кэшийг устгадаг байв — офлайн үед `app.js` алга болно. */
const CORE = [
  './', './index.html', './app.css', './themes.css', './app.js',
  './sync-config.js',
  './data/vocab.json', './data/kana.json', './data/kanji.json',
  './data/vocab-n5.json',
  './data/vocab-el1.json', './data/vocab-el2.json',
  // Бичлэгийн ЖАГСААЛТ. Үүнгүй бол офлайн үед `AUDIO_IDS` нь null болж,
  // кэшэлсэн mp3 бүгд үл ашиглагдана.
  './data/audio.json',
];

/* Байвал сайн, байхгүй ч апп ажиллана. */
const EXTRA = [
  './icons/icon-192.png', './icons/icon-512.png',
  './icons/favicon.svg', './icons/favicon-32.png',
  // Фонт — офлайн үед ч ижил харагдах ёстой. Windows-ийн serif-үүдэд
  // монгол Ү/Ө байхгүй тул эдгээр нь гоо сайхны биш, ЗӨВ БИЧИХ асуудал.
  './fonts/fonts.css',
  './fonts/nsm-00.woff2',
  './fonts/nsjp-00.woff2',
  './fonts/nsjp-01.woff2',
  './fonts/nsjp-02.woff2',
  './fonts/nsjp-03.woff2',
  './fonts/nsjp-04.woff2',
  './fonts/nsjp-05.woff2',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL).then(c =>
      // ЗААВАЛ шаардлагатай файлууд — аль нэг унавал суулгалт бүхэлдээ
      // унаж, ХУУЧИН ажиллаж байгаа worker үлдэнэ. Энэ нь зөв: дутуу
      // шинэчлэлт нь шинэчлэлт огт хийхээс дор.
      c.addAll(CORE)
        .then(() => Promise.all(EXTRA.map(u => c.add(u).catch(() => null))))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      // ЗӨВХӨН өөрсдийн хуучин shell-ийг устгана. Cache Storage нь
      // origin даяар нийтлэг — `nova-xo.github.io` дээрх БУСАД төслийн
      // кэшийг ч устгаж байсан.
      .then(ks => Promise.all(
        ks.filter(k => k.indexOf('shell-') === 0 && k !== SHELL)
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

  // Кэшээс хайх дараалал: ЯГ тэр хаяг → дараа нь хайлтын мөрийг үл
  // тоох. Эсрэгээр хийвэл `app.js?v=шинэ` кэшэлсэн байхад `ignoreSearch`
  // нь урьдчилан кэшэлсэн ХУУЧИН `app.js`-ийг буцааж болно.
  const fromCache = () => caches.match(req)
    .then(hit => hit || caches.match(req, { ignoreSearch: true }))
    .then(hit => hit || caches.match('./index.html'));

  e.respondWith(
    fetch(req).then(res => {
      // `fetch` нь 404/503 дээр ч ШИЙДЭГДДЭГ. Тэр хариуг шууд буцаавал
      // кэшэнд байгаа ажиллагаатай хуулбар руу хүрэхгүй өнгөрнө.
      if (!res || !res.ok) return fromCache().then(hit => hit || res);
      const copy = res.clone();
      caches.open(SHELL).then(c => c.put(req, copy));
      return res;
    }).catch(fromCache)
  );
});
