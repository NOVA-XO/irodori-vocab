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
const VERSION = '2026-09-24e';
const SHELL = 'shell-' + VERSION;
const MEDIA = 'media-v1';

/* «Бичлэгийн агуулга хэзээ ч өөрчлөгдөхгүй» гэсэн таамаг НЭГ УДАА
   зөрчигдсөн: бөөсний は/へ-г үсгээр нь уншиж байсныг («konbanha»)
   заслаа. `media` кэшийг бүхэлд нь хаявал хэрэглэгч 149 МБ-ыг дахин
   татна — тиймээс ЗАСАГДСАН бичлэгүүдийг ЗӨВХӨН НЭР ЗААЖ хасна.
   Дахин зассан тохиолдолд энэ жагсаалтыг СОЛИНО (нэмэхгүй): хуучин
   бичлэгүүд аль хэдийн шинэчлэгдсэн байна. */
const STALE_MEDIA = [
  'L01-002', 'L01-003', 'L05-019', 'L12-084', 'L18-033', 'L18-046',
  'E1-07-007', 'E1-10-043', 'E1-16-038', 'E1-18-041',
  'E2-09-105', 'E2-14-107'
];

/* ЗААВАЛ байх ёстой: эдгээрийн аль нэг нь кэшлэгдэхгүй бол суулгалт
   УНАХ ёстой. Урьд нь алдааг залгиад идэвхжиж, ажиллаж байсан хуучин
   кэшийг устгадаг байв — офлайн үед `app.js` алга болно. */
const CORE = [
  './', './index.html', './app.css', './app.js',
  './sync-config.js',
  './data/vocab.json', './data/kana.json', './data/kanji.json',
  './data/kanji-emoji.json',
  './data/vocab-n5.json',
  './data/vocab-el1.json', './data/vocab-el2.json',
  // Бичлэгийн ЖАГСААЛТ. Үүнгүй бол офлайн үед `AUDIO_IDS` нь null болж,
  // кэшэлсэн mp3 бүгд үл ашиглагдана.
  './data/audio.json',
  // Шалгалтын асуултын сан — офлайн ч шалгалт өгөх боломжтой байх ёстой.
  './data/exam-starter.json',
  './data/grammar-starter.json',
];

/* Байвал сайн, байхгүй ч апп ажиллана. */
const EXTRA = [
  './icons/icon-192.png', './icons/icon-512.png',
  './icons/favicon.svg', './icons/favicon-32.png',
  // Фонт — офлайн үед ч ижил харагдах ёстой. Windows-ийн serif-үүдэд
  // монгол Ү/Ө байхгүй тул эдгээр нь гоо сайхны биш, ЗӨВ БИЧИХ асуудал.
  './fonts/fonts.css',
  './fonts/nsm-00.woff2',
  './fonts/nsjps-00.woff2',
  './fonts/nsjps-01.woff2',
  './fonts/nsjps-02.woff2',
  './fonts/nsjps-03.woff2',
  './fonts/nsjps-04.woff2',
  './fonts/nsjps-05.woff2',
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
      // Дуудлага нь засагдсан бичлэгүүдийг хасна — дараагийн тоглуулалт
      // сүлжээнээс шинийг татна. Кэш байхгүй бол `delete` нь чимээгүй
      // `false` буцаана тул шалгах шаардлагагүй.
      .then(() => caches.open(MEDIA).then(c => Promise.all(
        STALE_MEDIA.map(id => c.delete('audio/' + id + '.mp3',
                                       { ignoreSearch: true })))))
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
