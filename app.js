/* いろどり 入門 — шинэ үг давтах апп
 *
 * ЗАРЧИМ: ромажиг ХЭЗЭЭ Ч дэлгэцэнд харуулахгүй. Үг зөвхөн кана/ханзаар гарна.
 * «Гараар бичих» дасгалд хэрэглэгч латинаар бичихэд шууд кана болж харагдана
 * (IME суулгах шаардлагагүй), тиймээс нүдэнд ромажи үлдэхгүй.
 */
'use strict';

/* Хувилбарыг өөрийнхөө <script src="app.js?v=…"> хаягаас уншина — ингэснээр
   ганц газарт (index.html) бичихэд хангалттай, хоёр тийш зөрөх аюулгүй. */
const APP_VERSION = ((document.currentScript || {}).src || '').match(/[?&]v=([\w.\-]+)/);
const VERSION = APP_VERSION ? APP_VERSION[1] : 'dev';

/* ══════════════════════ 1. Латин → кана хөрвүүлэгч ══════════════════════ */

const KANA_MAP = (() => {
  const m = {
    a:'あ',i:'い',u:'う',e:'え',o:'お',
    ka:'か',ki:'き',ku:'く',ke:'け',ko:'こ',
    ga:'が',gi:'ぎ',gu:'ぐ',ge:'げ',go:'ご',
    sa:'さ',shi:'し',si:'し',su:'す',se:'せ',so:'そ',
    za:'ざ',ji:'じ',zi:'じ',zu:'ず',ze:'ぜ',zo:'ぞ',
    ta:'た',chi:'ち',ti:'ち',tsu:'つ',tu:'つ',te:'て',to:'と',
    da:'だ',di:'ぢ',du:'づ',de:'で',do:'ど',
    na:'な',ni:'に',nu:'ぬ',ne:'ね',no:'の',
    ha:'は',hi:'ひ',fu:'ふ',hu:'ふ',he:'へ',ho:'ほ',
    ba:'ば',bi:'び',bu:'ぶ',be:'べ',bo:'ぼ',
    pa:'ぱ',pi:'ぴ',pu:'ぷ',pe:'ぺ',po:'ぽ',
    ma:'ま',mi:'み',mu:'む',me:'め',mo:'も',
    ya:'や',yu:'ゆ',yo:'よ',
    ra:'ら',ri:'り',ru:'る',re:'れ',ro:'ろ',
    wa:'わ',wo:'を',n:'ん',
    kya:'きゃ',kyu:'きゅ',kyo:'きょ', gya:'ぎゃ',gyu:'ぎゅ',gyo:'ぎょ',
    sha:'しゃ',shu:'しゅ',sho:'しょ', ja:'じゃ',ju:'じゅ',jo:'じょ',
    cha:'ちゃ',chu:'ちゅ',cho:'ちょ',
    nya:'にゃ',nyu:'にゅ',nyo:'にょ', hya:'ひゃ',hyu:'ひゅ',hyo:'ひょ',
    bya:'びゃ',byu:'びゅ',byo:'びょ', pya:'ぴゃ',pyu:'ぴゅ',pyo:'ぴょ',
    mya:'みゃ',myu:'みゅ',myo:'みょ', rya:'りゃ',ryu:'りゅ',ryo:'りょ',
    // гадаад үгэнд хэрэглэдэг хослолууд (カタカナ үгс их байдаг)
    fa:'ふぁ',fi:'ふぃ',fe:'ふぇ',fo:'ふぉ',
    ti_:'てぃ',di_:'でぃ',
    she:'しぇ',che:'ちぇ',je:'じぇ',
    va:'ゔぁ',vi:'ゔぃ',vu:'ゔ',ve:'ゔぇ',vo:'ゔぉ',
    wi:'うぃ',we:'うぇ',
    // жижиг кана — шууд бичих бол
    xa:'ぁ',xi:'ぃ',xu:'ぅ',xe:'ぇ',xo:'ぉ',
    xtsu:'っ',xya:'ゃ',xyu:'ゅ',xyo:'ょ'
  };
  m['thi'] = 'てぃ'; m['dhi'] = 'でぃ'; m['tho'] = 'てょ';
  delete m.ti_; delete m.di_;
  return m;
})();

const VOWEL_OF = {  // ー тэмдгийг задлахад: кана -> эгшиг
  'あ':'あ','か':'あ','が':'あ','さ':'あ','ざ':'あ','た':'あ','だ':'あ','な':'あ',
  'は':'あ','ば':'あ','ぱ':'あ','ま':'あ','や':'あ','ら':'あ','わ':'あ','ゃ':'あ',
  'い':'い','き':'い','ぎ':'い','し':'い','じ':'い','ち':'い','ぢ':'い','に':'い',
  'ひ':'い','び':'い','ぴ':'い','み':'い','り':'い',
  'う':'う','く':'う','ぐ':'う','す':'う','ず':'う','つ':'う','づ':'う','ぬ':'う',
  'ふ':'う','ぶ':'う','ぷ':'う','む':'う','ゆ':'う','る':'う','ゅ':'う','ゔ':'う',
  'え':'え','け':'え','げ':'え','せ':'え','ぜ':'え','て':'え','で':'え','ね':'え',
  'へ':'え','べ':'え','ぺ':'え','め':'え','れ':'え',
  'お':'お','こ':'お','ご':'お','そ':'お','ぞ':'お','と':'お','ど':'お','の':'お',
  'ほ':'お','ぼ':'お','ぽ':'お','も':'お','よ':'お','ろ':'お','を':'お','ょ':'お'
};

/** Латин үсгийг кана болгоно. Дуусаагүй үлдэгдлийг ард нь хэвээр үлдээнэ. */
function toKana(src) {
  const s = (src || '').toLowerCase().replace(/[^a-z\-']/g, '');
  let out = '', i = 0;
  while (i < s.length) {
    if (s[i] === '-') { out += 'ー'; i++; continue; }
    if (s[i] === "'") { i++; continue; }              // ん-ийг тусгаарлах: n'
    // давхар гийгүүлэгч -> っ
    if (i + 1 < s.length && s[i] === s[i + 1] && !'aiueon'.includes(s[i])) {
      out += 'っ'; i++; continue;
    }
    let hit = null;
    for (let len = 4; len >= 1; len--) {
      const p = s.substr(i, len);
      if (p.length === len && KANA_MAP[p]) { hit = [p, KANA_MAP[p]]; break; }
    }
    if (hit) { out += hit[1]; i += hit[0].length; continue; }
    // «n» + гийгүүлэгч -> ん
    if (s[i] === 'n') { out += 'ん'; i++; continue; }
    out += s[i]; i++;                                  // хараахан бүрэлдээгүй үсэг
  }
  return out;
}

const kataToHira = t => t.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));

/** Харьцуулахад бэлдэнэ: катакана->хирагана, ー задлах, тэмдэг хасах. */
function normKana(t) {
  let k = kataToHira(t || '').replace(/[\s　（）()、。！？!?・]/g, '');
  let out = '';
  for (const ch of k) {
    if (ch === 'ー' || ch === '-') out += VOWEL_OF[out.slice(-1)] || '';
    else out += ch;
  }
  return out;
}

const normRomaji = t => (t || '').toLowerCase().replace(/[^a-z]/g, '');

/* ══════════════════════ 2. Хариулт шалгах ══════════════════════ */

/** Зөвшөөрөгдөх хариултууд: ／-ээр салгасан хувилбар бүр, ромажийн хувилбар. */
function answerSet(item) {
  const set = new Set();
  const add = v => { if (v) set.add(v); };
  // Хаалтанд байгаа хэсэг нь СОНГОЛТОТ: «おはよう（ございます）» дээр
  // «おはよう» гэж бичихэд ч зөв. Тиймээс кана/ханз талд хоёулангийнх нь
  // хувилбарыг нэмнэ — эс тэгвээс зөвхөн PDF-ийн яг тэр ромажи үсгээр
  // (ohayoo) таарах ба хүн «ohayou» гэж бичихэд татгалзана.
  const dropParen = t => t.replace(/[（(][^）)]*[）)]/g, '');
  for (const part of (item.kana || '').split(/[／/]/)) {
    add(normKana(part));
    add(normKana(dropParen(part)));
  }
  for (const part of (item.jp || '').split(/[／/]/)) {
    add(normKana(part));
    add(normKana(dropParen(part)));
  }
  const rom = item.romaji || '';
  for (const part of rom.split(/[／/]/)) {
    add(normRomaji(part));
    add(normRomaji(part.replace(/\(.*?\)/g, '')));     // сонголтот хэсэггүй
    add(normRomaji(part.replace(/[()]/g, '')));        // хаалт нь заавал
  }
  set.delete('');
  return set;
}

function checkTyped(raw, item) {
  const set = answerSet(item);
  return set.has(normKana(toKana(raw))) || set.has(normRomaji(raw));
}

/* ══════════════════════ 3. Явц (localStorage) ══════════════════════ */

const KEY_P = 'irodori.progress.v1';
const KEY_S = 'irodori.settings.v1';
const BOXES = [0, 1, 3, 7, 14, 30];      // Leitner: хайрцаг бүрийн зай, хоногоор

const today = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 6e4) / 864e5);

function load(key, dflt) {
  try { return JSON.parse(localStorage.getItem(key)) || dflt; } catch (e) { return dflt; }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* private mode */ }
}

const KEY_D = 'irodori.days.v1';
let progress = load(KEY_P, {});
/* Өдөр бүрийн хариултын тоо ба дараалсан өдрийн тоо. Явц (хайрцаг) удаан
   хөдөлдөг тул ӨДӨР ТУТМЫН биелэлтийг тусад нь харуулах хэрэгтэй. */
let days = load(KEY_D, { last: -1, streak: 0, n: 0 });
const todayN = () => (days.last === today() ? days.n : 0);
const streakN = () => {
  const t = today();
  return (days.last === t || days.last === t - 1) ? (days.streak || 0) : 0;
};
function tickDay() {
  const t = today();
  if (days.last !== t) {
    // Өчигдөр давтсан бол цуврал үргэлжилнэ, тасарсан бол 1-ээс эхэлнэ.
    days.streak = (days.last === t - 1) ? (days.streak || 0) + 1 : 1;
    days.last = t; days.n = 0;
  }
  days.n++;
  save(KEY_D, days);
}
let settings = load(KEY_S, { lessons: [1, 2, 3], ref: false, script: 'kanji', kgroups: ['gojuon'] });
if (!settings.script) settings.script = 'kanji';   // хуучин хадгалсан тохиргоог нөхнө
if (!settings.kgroups) settings.kgroups = ['gojuon'];
if (!settings.goal) settings.goal = 20;
if (!settings.dir) settings.dir = 'jp2mn';
if (!settings.kjn) settings.kjn = [5];        // JLPT түвшин (JLPT дэлгэц)
if (!settings.what) settings.what = 'word';   // Irodori: шинэ үг | шинэ ханз
if (!settings.book) settings.book = 'starter';
/* Хичээлийн сонголтыг НОМ ТУС БҮРД тусад нь хадгална. N5 нь 50 хичээлтэй,
   Irodori-гийнх 18 — нэг жагсаалт хуваалцвал N5-д 25-р хичээл сонгоод
   Irodori руу шилжихэд багц ХООСОН болно. */
if (!settings.les) {
  settings.les = {};
  if (settings.lessons) settings.les[settings.book] = settings.lessons;
}

/* Асуултын нүүр талд юу харуулах вэ: ханзтай хэлбэр эсвэл кана уншлага.
   Нөгөө хэлбэрийг нь хариулт дээр үзүүлнэ. Ханзгүй үг (プレゼント, あめ) дээр
   хоёул ижил гарах тул хариулт дээр давхардуулж харуулахгүй. */
const faceOf = it => (settings.script === 'kana' && it.kana) ? it.kana : it.jp;
const backOf = it => (settings.script === 'kana') ? it.jp : (it.kana || '');
/* Урвуу чиглэл: монгол утгыг асууж, япон үгийг нь таалгана. Идэвхтэй санах
   ойг илүү шалгадаг. Зөвхөн «флашкарт» ба «олон сонголт»-д үйлчилнэ —
   «бичих» нь аль хэдийн урвуу, «сонсох» нь дуунаас эхэлдэг. */
const isRev = () => deck === 'vocab' && settings.dir === 'mn2jp'
  && (mode === 'flash' || mode === 'choice');

function grade(id, ok) {
  const p = progress[id] || { b: 0, d: 0, n: 0, c: 0, w: 0 };
  p.n++;
  if (ok) { p.c++; p.b = Math.min(p.b + 1, BOXES.length - 1); }
  else { p.w++; p.b = Math.max(p.b - 2, 0); }
  p.d = today() + BOXES[p.b];
  progress[id] = p;
  save(KEY_P, progress);
  tickDay();
}

/* ══════════════════════ 3b. Төхөөрөмж хооронд нийлүүлэх ══════════════════════
 *
 * Хувийн мэдээлэл ХАДГАЛАХГҮЙ: зөвхөн санамсаргүй код ба «аль үгийг хэдэн
 * удаа давтсан» гэсэн тоо. Код бол түлхүүр — апп өөрөө үүсгэнэ (хүн сонговол
 * таамаглахад амархан болно).
 *
 * Дарж бичихгүй, УУСГАНА: id тус бүрээр илүү олон удаа давтсан бичлэгийг авна.
 * Ингэснээр утас компьютерийнхээ явцыг (эсвэл эсрэгээр) устгахгүй.
 */
const SYNC = window.SYNC_CONFIG || {};
const syncOn = !!(SYNC.url && SYNC.key);
const KEY_C = 'irodori.synccode.v1';
let syncCode = load(KEY_C, null);

function newCode() {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';   // 0/o/1/l/i хассан
  const a = new Uint8Array(12);
  (crypto || window.crypto).getRandomValues(a);
  const s = [...a].map(b => abc[b % abc.length]).join('');
  return s.slice(0, 4) + '-' + s.slice(4, 8) + '-' + s.slice(8, 12);
}

async function rpc(fn, body) {
  // Supabase-д хоёр төрлийн түлхүүр бий:
  //   хуучин `anon`  — JWT, «eyJ…» гэж эхэлнэ
  //   шинэ `publishable` — «sb_publishable_…», JWT БИШ
  // Authorization: Bearer толгойд JWT л хүлээж авдаг тул шинэ түлхүүрийг
  // тэнд явуулбал задлах алдаа өгнө. Тиймээс зөвхөн JWT үед л нэмнэ.
  const headers = { 'Content-Type': 'application/json', apikey: SYNC.key };
  if (/^eyJ/.test(SYNC.key)) headers.Authorization = 'Bearer ' + SYNC.key;

  const r = await fetch(SYNC.url.replace(/\/+$/, '') + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 120));
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

/** id тус бүрээр илүү давтсаныг нь авна; тэнцвэл илүү өндөр хайрцгийг. */
function mergeProgress(a, b) {
  const out = Object.assign({}, a);
  for (const id in b) {
    const x = out[id], y = b[id];
    if (!x) { out[id] = y; continue; }
    if ((y.n || 0) > (x.n || 0) || ((y.n || 0) === (x.n || 0) && (y.b || 0) > (x.b || 0))) {
      out[id] = y;
    }
  }
  return out;
}

function syncSay(msg) {
  const el = document.getElementById('sync-state');
  if (el) el.textContent = msg;
}

async function syncNow(quiet) {
  if (!syncOn || !syncCode) return;
  try {
    if (!quiet) syncSay('нийлүүлж байна…');
    const remote = await rpc('get_progress', { p_code: syncCode });
    const merged = mergeProgress(progress, remote || {});
    progress = merged;
    save(KEY_P, progress);
    await rpc('put_progress', { p_code: syncCode, p_data: merged });
    syncSay('нийлүүлсэн: ' + new Date().toLocaleTimeString() +
            ' · ' + Object.keys(merged).length + ' карт');
  } catch (e) {
    syncSay('алдаа: ' + e.message);
  }
}

function refreshSync() {
  const box = document.getElementById('sync-box');
  if (!box) return;
  box.hidden = !syncOn;
  const none = document.getElementById('sync-none');
  if (none) none.hidden = syncOn;
  const el = document.getElementById('sync-code');
  if (el) el.textContent = syncCode || '— холбогдоогүй —';
}

/* ══════════════════════ 4. Өгөгдөл ══════════════════════ */

/* Ном тус бүр ТУСДАА файлтай — сонгосон номоо л татна (эхний ачаалал хөнгөн).
   id-ийн угтвар ном бүрд өөр (L / E1 / E2) тул явц хольцолдохгүй. */
const BOOK_FILE = { starter: 'data/vocab.json', el1: 'data/vocab-el1.json',
                    el2: 'data/vocab-el2.json', n5: 'data/vocab-n5.json' };
const BOOK_NAME = { starter: '入門', el1: '初級1', el2: '初級2', n5: 'N5' };
const bookCache = {};

function loadBook(b) {
  if (bookCache[b]) { ALL = bookCache[b]; return Promise.resolve(true); }
  return fetch(BOOK_FILE[b]).then(r => r.json()).then(d => {
    bookCache[b] = d.items; ALL = d.items; return true;
  }).catch(() => false);
}

let ALL = [];                 // ИДЭВХТЭЙ Irodori номын үгс
let N5 = [];                  // N5-ийн 2077 үг (50 хичээл) — тусдаа сан

/* Үгийн эх сурвалж: Irodori-гийн ном уу, N5 юу. Хоёр дэлгэц ӨӨР ӨӨР
   санг үзүүлдэг тул нэг `ALL`-д шахахгүй — эс тэгвэл нэг дэлгэц дээр
   ном сольход нөгөө нь эвдэрнэ. */
let wordSrc = 'book';         // 'book' | 'n5'
const activeWords = () => (wordSrc === 'n5' ? N5 : ALL);
function activeLessons() {
  if (wordSrc === 'n5') {
    if (!settings.n5les) settings.n5les = [1, 2, 3];
    return settings.n5les;
  }
  return curLessons();
}
function setActiveLessons(v) {
  if (wordSrc === 'n5') settings.n5les = v; else settings.les[settings.book] = v;
  save(KEY_S, settings);
}

function loadN5() {
  if (N5.length) return Promise.resolve(true);
  return fetch('data/vocab-n5.json').then(r => r.json())
    .then(d => { N5 = d.items; return true; }).catch(() => false);
}
let missed = [];              // энэ дасгалд алдсан үгс — төгсгөлд жагсаана
let KANA = [];                // 107 кана (хирагана · катакана · авиа)
let KANJI = [];               // 1027 ханз (хичээлийнх + JLPT N5–N2)
let pool = [];                // идэвхтэй багц (үг эсвэл кана)

/** Идэвхтэй номын сонгосон хичээлүүд. Анхдагчаар эхний гурав. */
function curLessons() {
  const b = settings.book;
  if (!settings.les[b]) settings.les[b] = [1, 2, 3];
  return settings.les[b];
}
function setLessons(v) { settings.les[settings.book] = v; save(KEY_S, settings); }

const inPool = it => activeLessons().includes(it.lesson) && (settings.ref || !it.ref);
const isDue = it => { const p = progress[it.id]; return p && p.d <= today(); };
const isNew = it => !progress[it.id];

function rebuildPool() { pool = activeWords().filter(inPool); }

/* ══════════════════════ 5. Дуу (speechSynthesis) ══════════════════════ */

const canSpeak = !!window.speechSynthesis;
let jaVoice = null;

/* Гар утсан дээр getVoices() ХОЙШЛОН дүүрдэг тул хоолой олдох хүртэл хүлээж
   товчийг нуувал хэзээ ч гарч ирэхгүй. Мөн яг таарсан «ja» хоолой олдоогүй ч
   lang="ja-JP" гэж өгвөл систем өөрөө япон хоолой сонгодог. Тиймээс товчийг
   speechSynthesis байгаа бүх үед харуулна. */
function pickVoice() {
  const vs = canSpeak ? speechSynthesis.getVoices() : [];
  jaVoice = vs.find(v => /^ja\b|^ja[-_]/i.test(v.lang)) || null;

  const warn = document.getElementById('voice-warn');
  if (AUDIO_IDS && AUDIO_IDS.size) { warn.hidden = true; }  // бичлэг бий — TTS хэрэггүй
  else if (!canSpeak) {
    warn.hidden = false;
    warn.textContent = 'Энэ браузер дуу уншихыг дэмжихгүй тул «Сонсох» горим ажиллахгүй.';
  } else if (!jaVoice && vs.length) {
    // Хоолой жагсаалт дүүрсэн ч япон нь алга — жинхэнэ дутагдал.
    warn.hidden = false;
    warn.innerHTML = 'Япон хоолой олдсонгүй — дуу чимээгүй байж магадгүй. ' +
      'Windows: <b>Settings → Time &amp; language → Language &amp; region → 日本語 нэмэх → ' +
      'Language options → Speech</b> суулгаад браузераа дахин нээнэ үү.';
  } else {
    warn.hidden = true;                       // жагсаалт хараахан дүүрээгүй ч байж болно
  }
  document.querySelector('[data-mode="listen"]').disabled =
    !canSpeak && !(AUDIO_IDS && AUDIO_IDS.size);

  // Хоолой хожуу ирвэл ОДООГИЙН картын товчийг сэргээнэ.
  const b = document.getElementById('btn-speak');
  if (b) b.hidden = !canSpeak || mode === 'type' && !answered;
}

/* Ихэнх гар утас эхний дуу гаргахын өмнө хэрэглэгчийн хүрэлт шаарддаг.
   Эхний хүрэлт дээр чимээгүй utterance явуулж «түгжээг» тайлна. */
let speechUnlocked = false;
function unlockSpeech() {
  if (speechUnlocked) return;
  speechUnlocked = true;
  // <audio>-г эхний ХҮРЭЛТИЙН дотор нэг удаа тоглуулбал iOS түүнийг «нээж»,
  // цаашид программаас дуудахад зөвшөөрдөг болно.
  try {
    const p = ensurePlayer();
    p.src = SILENT_WAV;
    const r = p.play();
    if (r && r.catch) r.catch(() => {});
  } catch (e) { /* үл тоомсорлоно */ }
  if (!canSpeak) return;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
  } catch (e) { /* үл тоомсорлоно */ }
}
document.addEventListener('pointerdown', unlockSpeech, { once: true });
document.addEventListener('keydown', unlockSpeech, { once: true });

/* Зарим браузер utterance-ыг хогийн цэвэрлэгчид өгөөд дуугаа тасалдаг тул
   сүүлийн объектыг барьж үлдэнэ. */
let lastUtterance = null;
let lastSpeechError = '';

function speak(text) {
  if (!canSpeak || !text) return;
  const clean = text.replace(/[／/].*$/, '').replace(/[（(].*?[）)]/g, '').trim();
  if (!clean) return;
  // cancel()-ыг ЗӨВХӨН яг ярьж байхад дуудна: чөлөөтэй үед дуудвал зарим
  // утсан дээр араас нь ирэх speak() нь залгиж алддаг.
  if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(clean);
  if (jaVoice) u.voice = jaVoice;
  u.lang = 'ja-JP';                            // хоолой олдоогүй ч систем сонгоно
  u.rate = 0.85;
  u.onerror = e => { lastSpeechError = (e && e.error) || 'үл мэдэгдэх алдаа'; };
  lastUtterance = u;
  speechSynthesis.speak(u);
}

/* ── Урьдчилан бэлдсэн бичлэг (VOICEVOX) ─────────────────────────────
 * speechSynthesis нь (1) утсан дээр найдваргүй, (2) хэрэглэгчид япон хоолой
 * байхгүй бол чимээгүй, (3) өргөлтийг буруу уншдаг. Тиймээс үг бүрийн
 * дуудлагыг урьдчилан үүсгэж `audio/<id>.mp3` болгосон — өргөлтийг нь
 * номын ↓○ тэмдэглэгээгээр удирдсан. Файл байвал ҮРГЭЛЖ түүнийг тоглуулж,
 * зөвхөн байхгүй үед л TTS рүү шилжинэ. */
let AUDIO_IDS = null;
let player = null;
const SILENT_WAV = 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAwF0AAIC7AAACABAAZGF0YQIAAAAAAA==';

function ensurePlayer() {
  if (!player) { player = new Audio(); player.preload = 'auto'; }
  return player;
}
const hasAudio = id => !!(AUDIO_IDS && id && AUDIO_IDS.has(id));

function playFile(id) {
  if (!hasAudio(id)) return false;
  try {
    const p = ensurePlayer();
    p.src = 'audio/' + id + '.mp3';
    const r = p.play();
    if (r && r.catch) r.catch(() => {});
    return true;
  } catch (e) { return false; }
}

/** Картын дуудлага: бичлэг байвал бичлэг, эс бөгөөс TTS. */
function say(it) {
  if (!it) return;
  if (deck === 'kanji') {
    // Ганц ханзны дуудлага олон янз байдаг тул ЖИШЭЭ ҮГЭЭР нь сонсгоно.
    const w = kjWord(it);
    if (w && playFile(w.id)) return;
    if (w) speak(w.kana);
    return;
  }
  if (playFile(it.id)) return;
  speak(deck === 'kana' ? it.hira : (it.kana || it.jp));
}
/** Энэ картыг сонсох боломж бий юу (бичлэг эсвэл TTS). */
const canHear = it => (deck === 'kanji')
  ? !!kjWord(it)
  : (hasAudio(it && it.id) || canSpeak);

/* ── Ханз ───────────────────────────────────────────────────────────
 * KANJIDIC2-ийн 訓読み нь «ひと.つ» хэлбэртэй: цэг нь ханзаар бичигдэх
 * хэсэг ба okurigana-г тусгаарлана. Хэрэглэгчид «ひと(つ)» гэж үзүүлнэ. */
const fmtKun = r => r.indexOf('.') < 0 ? r
  : r.slice(0, r.indexOf('.')) + '(' + r.slice(r.indexOf('.') + 1) + ')';

/** Ханзны багц. src: 'les' = сонгосон хичээлүүдийнх · 'jlpt' = сонгосон түвшин. */
const BOOK_LKEY = { starter: 'l', el1: 'l1', el2: 'l2' };

function kanjiPool(src) {
  if (src === 'jlpt') return KANJI.filter(k => k.n && settings.kjn.includes(k.n));
  const les = curLessons();
  const key = BOOK_LKEY[settings.book] || 'l';
  return KANJI.filter(k => k[key] && k[key].some(x => les.includes(x)));
}

/** Ханзны дуудлага: жишээ үгийнх нь бичлэгийг ашиглана (шинэ файл хэрэггүй). */
const kjWord = k => (k.w || []).find(w => hasAudio(w.id)) || (k.w || [])[0] || null;

/* ══════════════════════ 6. Дасгалын хөдөлгүүр ══════════════════════ */

const SESSION = 20;
const $ = id => document.getElementById(id);
let mode = 'flash', queue = [], cur = null, done = 0, okN = 0, ngN = 0, answered = false;
let deck = 'vocab';           // 'vocab' | 'kana'
let kmode = 'h2k';            // канагийн дасгал: h2k | k2h | sound | klisten

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

function buildQueue(onlyDue) {
  const due = shuffle(pool.filter(isDue));
  const fresh = onlyDue ? [] : shuffle(pool.filter(isNew));
  const rest = onlyDue ? [] : shuffle(pool.filter(it => !isDue(it) && !isNew(it)));
  return due.concat(fresh, rest).slice(0, SESSION);
}

/** Кана дасгал. Бүх хувилбар 4 сонголттой тул mode = 'choice'. */
function startKana(km) {
  kmode = km;
  deck = 'kana';
  mode = 'choice';
  pool = KANA.filter(i => settings.kgroups.includes(i.group));
  if (pool.length < 4) { alert('Дор хаяж нэг бүлэг сонгоно уу.'); deck = 'vocab'; return; }
  queue = buildQueue(false);
  done = okN = ngN = 0; missed = [];
  settings.last = { deck: 'kana', k: km }; save(KEY_S, settings);
  show('study');
  $('c-total').textContent = queue.length;
  nextCard();
}

/** Ханзны дасгал. km: flash | k2m | m2k | read */
function startKanji(km, src) {
  kmode = km;
  deck = 'kanji';
  mode = (km === 'flash') ? 'flash' : 'choice';
  pool = kanjiPool(src);
  if (pool.length < 4) {
    alert(src === 'jlpt' ? 'Дор хаяж нэг түвшин сонгоно уу.'
                         : 'Сонгосон хичээлүүдэд ханз хангалтгүй байна.');
    deck = 'vocab'; return;
  }
  queue = buildQueue(false);
  done = okN = ngN = 0; missed = [];
  settings.last = { deck: 'kanji', k: km, src: src }; save(KEY_S, settings);
  show('study');
  $('c-total').textContent = queue.length;
  nextCard();
}

function startSession(m, onlyDue, src) {
  deck = 'vocab';
  if (src) wordSrc = src;
  rebuildPool();
  if (!pool.length) { alert('Эхлээд хичээл сонгоно уу.'); return; }
  mode = m;
  queue = buildQueue(!!onlyDue);
  if (!queue.length) { alert('Давтах үг алга. Шинэ хичээл сонгох эсвэл маргааш дахин үзнэ үү.'); return; }
  done = okN = ngN = 0; missed = [];
  settings.last = { deck: 'vocab', m: m, src: wordSrc }; save(KEY_S, settings);
  show('study');
  $('c-total').textContent = queue.length;
  nextCard();
}

function nextCard() {
  if (!queue.length) { finish(); return; }
  cur = queue.shift();
  answered = false;
  const card = $('card');
  if (card) card.classList.remove('flip');
  replay(card, 'in');
  for (const p of ['pane-flash', 'pane-choice', 'pane-type', 'pane-next']) $(p).hidden = true;
  $('answer').hidden = true;
  $('f-judge').hidden = true; $('f-show').hidden = false;
  $('p-sub').textContent = deck === 'kana'
    ? ({ gojuon: '五十音', dakuten: '濁音・半濁音', yoon: '拗音' })[cur.group]
    : 'L' + cur.lesson + (cur.ref ? ' · 参考' : '');

  if (deck === 'kanji') {
    $('p-sub').textContent = (cur.n ? 'N' + cur.n : '') +
      (cur.g ? (cur.n ? ' · ' : '') + cur.g + '-р анги' : '') +
      ' · ' + cur.s + ' зурлага';
    if (kmode === 'm2k') {
      $('p-main').textContent = cur.mn; $('p-main').className = 'prompt mn';
    } else {
      $('p-main').textContent = cur.c; $('p-main').className = 'prompt jp kj';
    }
    if (kmode === 'flash') { $('pane-flash').hidden = false; }
    else { buildChoices(); $('pane-choice').hidden = false; }
    // Утга→ханз горимд дуу нь хариултыг задална.
    const hide = kmode === 'm2k';
    $('btn-speak').hidden = !canHear(cur) || hide;
    if (canHear(cur) && !hide) say(cur);
    updateBar();
    return;
  }

  if (deck === 'kana') {
    // Бүх кана дасгал 4 сонголттой. «Сонсоод таах»-д асуултын нүүр нь дуу.
    $('p-main').textContent = kmode === 'klisten' ? '🔊'
      : (kmode === 'k2h' ? cur.kata : cur.hira);
    $('p-main').className = 'prompt' + (kmode === 'klisten' ? '' : ' jp');
    buildChoices();
    $('pane-choice').hidden = false;
    $('btn-speak').hidden = !canHear(cur);
    if (canHear(cur)) say(cur);
    updateBar();
    return;
  }

  if (mode === 'flash') {
    $('p-main').textContent = isRev() ? (cur.mn || cur.jp) : faceOf(cur);
    $('p-main').className = 'prompt' + (isRev() ? ' mn' : ' jp');
    $('pane-flash').hidden = false;
  } else if (mode === 'choice') {
    $('p-main').textContent = isRev() ? (cur.mn || cur.jp) : faceOf(cur);
    $('p-main').className = 'prompt' + (isRev() ? ' mn' : ' jp');
    buildChoices();
    $('pane-choice').hidden = false;
  } else if (mode === 'type') {
    $('p-main').textContent = cur.mn || cur.jp; $('p-main').className = 'prompt mn';
    $('t-input').value = ''; $('t-kana').textContent = '';
    $('pane-type').hidden = false;
    setTimeout(() => $('t-input').focus(), 30);
  } else if (mode === 'listen') {
    $('p-main').textContent = '🔊'; $('p-main').className = 'prompt';
    buildChoices();
    $('pane-choice').hidden = false;
  }
  // Дуудлагыг АВТОМАТААР сонсгоно — «бичих»-ээс бусад бүх горимд.
  // «Бичих»-д асуулт нь монгол утга, хариулт нь япон үг учраас урьдчилж
  // сонсговол хариултыг задалж өгнө: тэнд 🔊 товчийг ч нуух ба зөвхөн
  // хариулсны дараа сонсгоно.
  //
  // ЧУХАЛ: speak()-ыг setTimeout дотор биш, ЭНД шууд дуудна. nextCard нь
  // үргэлж дарлагаас (mode товч эсвэл «Дараах») эхэлдэг тул ингэж дуудвал
  // хэрэглэгчийн хүрэлтийн гинж тасрахгүй — iOS Safari зөвхөн тийм үед
  // дуу гаргахыг зөвшөөрдөг.
  const hideSound = mode === 'type' || isRev();   // хариултыг задлахгүйн тулд
  $('btn-speak').hidden = !canHear(cur) || hideSound;
  if (canHear(cur) && !hideSound) say(cur);
  updateBar();
}

/** Сонголтын товчин дээр бичигдэх текст = зөв хариулт. */
function optText(it) {
  if (deck === 'kanji') {
    if (kmode === 'm2k') return it.c;
    if (kmode === 'read') return it.on[0] || fmtKun(it.kun[0] || '');
    return it.mn;                                   // k2m
  }
  if (deck !== 'kana') return isRev() ? faceOf(it) : (it.mn || it.jp);
  if (kmode === 'h2k') return it.kata;
  if (kmode === 'k2h') return it.hira;
  if (kmode === 'sound') return it.mn;
  return it.hira;                                   // klisten
}

/** Зөрүүг хэмжих Левенштейн зай — ойролцоо дуудлагатайг олоход. */
function editDist(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let cur2 = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    cur2[0] = i;
    for (let j = 1; j <= n; j++) {
      cur2[j] = Math.min(prev[j] + 1, cur2[j - 1] + 1,
                         prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    const t = prev; prev = cur2; cur2 = t;
  }
  return prev[n];
}

/** Ижил төстэй эсэхийг ЮУГААР харьцуулах вэ — уншлагаар. */
const simKey = it => (deck === 'kana') ? (it.hira || '')
  // Ханзанд БҮХ горимд УНШЛАГААР нь ойролцоолно (校/交 хоёулаа コウ).
  // «Ханз → утга»-д ч тэгэх нь зөв: сандруулагч утгууд нь ойролцоо
  // уншлагатай ханзных болж, жинхэнэ будлиан дээр шалгана. Монгол утгын
  // үсгийн зайгаар сонговол зөвхөн ижил урттай утга гарч ирдэг.
  : (deck === 'kanji') ? (it.on[0] || it.kun[0] || '')
    : (it.kana || it.jp || '');

function buildChoices() {
  const box = $('choices');
  box.innerHTML = '';
  const want = optText(cur);

  // 1) Сонголтууд СОНГОСОН хичээлээс л гарна — бүх 1215 үгээс биш.
  //    Багц хэт жижиг бол л бүхэлдээ өргөтгөнө.
  // Урагш чиглэлд сонголтууд нь МОНГОЛ утга байх ёстой. `optText` нь утга
  // дутуу үед япон үг рүү ухардаг тул тэр бичлэгүүдийг сандруулагчид
  // оруулбал жагсаалтад япон үг холилдож, хариултыг задалж өгнө.
  const usable = x => x.id !== cur.id && optText(x) && optText(x) !== want
    && (deck !== 'vocab' || isRev() || !!(x.mn || '').trim());
  let cand = pool.filter(usable);
  if (cand.length < 3) {
    const all = deck === 'kana' ? KANA : (deck === 'kanji' ? KANJI : ALL);
    cand = all.filter(usable);
  }

  // 2) ОЙРОЛЦОО дуудлагатайг нь сонгоно — эс тэгвээс таахад хэтэрхий амархан.
  //    Хамгийн ойрын 10-аас 3-ыг санамсаргүй авч, давтагдахаас сэргийлнэ.
  const key = simKey(cur);
  const scored = cand.map(x => ({ x: x, d: editDist(simKey(x), key) }));
  scored.sort((a, b) => a.d - b.d);
  const others = shuffle(scored.slice(0, 10).map(s => s.x)).slice(0, 3);

  const jpFace = (deck === 'kana' && kmode !== 'sound') || isRev()
    || (deck === 'kanji' && kmode !== 'k2m');
  // ↓ давхардсангүй эсэхийг buildChoices-ийн төгсгөлд дугаарлана
  shuffle([cur].concat(others)).forEach(opt => {
    const b = document.createElement('button');
    b.textContent = optText(opt);
    if (jpFace) b.className = 'jpface';
    b.onclick = () => {
      if (answered) return;
      answered = true;
      const good = opt.id === cur.id;
      b.classList.add(good ? 'correct' : 'wrong');
      if (!good) {
        [...box.children].forEach(c => { if (c.textContent === want) c.classList.add('correct'); });
        // Доод талд наалдсан «Дараах» самбар зөв хариултыг халхалж мэднэ —
        // намхан дэлгэц дээр харагдах болтол нь гүйлгэнэ.
        const c = box.querySelector('.correct');
        if (c) c.scrollIntoView({ block: 'center' });
      }
      [...box.children].forEach(c => c.disabled = true);
      resolve(good);
    };
    box.appendChild(b);
  });
  [...box.children].forEach((b, i) => b.dataset.k = i + 1);
}

/* ── Өргөлтийн зураглал (高低アクセント) ────────────────────────────
 * Irodori-гийн ことばリスト-д хэрэглэсэн тэмдэглэгээ:
 *   ↓ — энэ тэмдгийн ӨМНӨХ мора хүртэл өндөр, дараа нь НАМ болж унана
 *   ○ — 平板型: эхний мора нам, 2-роос эцэс хүртэл өндөр, унахгүй
 *   △ — нийлмэл үгийн өргөлтийн хоёр хэсгийн ЗААГ
 * Түүхий тэмдэгт харуулахын оронд мора бүрийн өндөр/намыг шугамаар зурна.
 * Тэмдэглэгээгүй хэсгийг (ж: おはよう（ございま↓す） дэх «おはよう») ЗУРАХГҮЙ —
 * ном тэнд өргөлт заагаагүй тул таамаглахгүй.
 */
var SMALL_KANA = 'ぁぃぅぇぉゃゅょゎァィゥェォャュョヮ';

function esc(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function pitchHTML(acc) {
  if (!acc) return '';
  var out = '', buf = '', i, ch;
  for (i = 0; i < acc.length; i++) {
    ch = acc[i];
    // ／ △ （ ） зай — эдгээрийн хооронд өргөлт ДАХИН эхэлдэг тул тасална.
    if ('／/△（）() 　'.indexOf(ch) >= 0) {
      out += pitchSeg(buf); buf = '';
      out += '<span class="pgap">' + (ch === '△' ? '・' : esc(ch)) + '</span>';
    } else buf += ch;
  }
  out += pitchSeg(buf);
  return '<span class="pitch">' + out + '</span>';
}

function pitchSeg(seg) {
  var mora = [], drop = -1, flat = false, i, ch, c, isKana;
  for (i = 0; i < seg.length; i++) {
    ch = seg[i];
    if (ch === '↓') { if (drop < 0) drop = countKana(mora); continue; }
    if (ch === '○') { flat = true; continue; }
    c = ch.charCodeAt(0);
    isKana = c >= 0x3041 && c <= 0x30FC && c !== 0x30FB;
    if (isKana && SMALL_KANA.indexOf(ch) >= 0 && mora.length)
      mora[mora.length - 1].t += ch;                   // жижиг кана нь өмнөхтэйгөө НЭГ мора
    else mora.push({ t: ch, kana: isKana });
  }
  var n = countKana(mora);
  var plain = !n || (drop <= 0 && !flat);              // тэмдэглэгээгүй бол зурахгүй
  var hiAt = function (k) {
    return drop === 1 ? k === 1 : k > 1 && (drop < 0 || k <= drop);
  };
  var html = '', k = 0, cls;
  for (i = 0; i < mora.length; i++) {
    if (!mora[i].kana || plain) { html += '<span class="pn">' + esc(mora[i].t) + '</span>'; continue; }
    k++;
    cls = 'pm ' + (hiAt(k) ? 'hi' : 'lo');
    if (k < n && hiAt(k) !== hiAt(k + 1)) cls += hiAt(k) ? ' dn' : ' up';
    html += '<span class="' + cls + '">' + esc(mora[i].t) + '</span>';
  }
  return html;
}

function countKana(a) { var n = 0, i; for (i = 0; i < a.length; i++) if (a[i].kana) n++; return n; }

function reveal() {
  if (deck === 'kanji') {
    $('a-kana').textContent = kmode === 'm2k' ? cur.c : '';
    $('a-mn').textContent = cur.mn;
    $('a-acc').innerHTML = '';
    // Уншлагын мөр бүрд өөрийн 🔊 — 音 ба 訓 нь тусдаа бичлэгтэй
    // (JO-/JK-<юникод>). Ханзны нүүрэн дэх 🔊 нь жишээ ҮГИЙГ сонсгоно.
    const code = cur.id.split('-')[1];
    const play = id => hasAudio(id)
      ? '<button class="rsp" data-a="' + id + '" title="Сонсох">🔊</button>' : '';
    const on = cur.on.length ? '<div><b>音</b> <span class="jp">' +
      esc(cur.on.join('・')) + '</span>' + play('JO-' + code) + '</div>' : '';
    const kun = cur.kun.length ? '<div><b>訓</b> <span class="jp">' +
      esc(cur.kun.map(fmtKun).join('・')) + '</span>' + play('JK-' + code) + '</div>' : '';
    let words = '';
    for (const w of (cur.w || []).slice(0, 3)) {
      words += '<div class="kw"><b class="jp">' + esc(w.jp) + '</b>' +
        '<span class="jp">' + esc(w.kana) + '</span>' +
        '<span>' + esc(w.mn) + '</span>' + play(w.id) + '</div>';
    }
    const box = $('a-kj');
    box.innerHTML = on + kun + (words ? '<div class="kws">' + words + '</div>' : '');
    box.hidden = false;
    $('answer').hidden = false;
    replay($('card'), 'flip');
    return;
  }
  $('a-kj').hidden = true;
  // «Бичих» ба «Сонсох» горимд асуулт нь үг БАЙГААГҮЙ (монгол утга / дуу) тул
  // хариулт дээр үгийг бүтнээр нь — ханз ба кана хоёуланг нь — үзүүлнэ.
  // Флашкарт, олон сонголтод асуулт нь үг байсан тул нөгөө хэлбэрийг л нэмнэ.
  const lines = [];
  if (deck === 'kana') {
    $('a-kana').textContent = cur.hira + ' ／ ' + cur.kata;
    $('a-mn').textContent = cur.mn;
    $('a-acc').textContent = '';
    $('answer').hidden = false;
    replay($('card'), 'flip');
    return;
  }
  if (mode === 'type' || mode === 'listen' || isRev()) {
    lines.push(cur.jp);
    if (cur.kana && cur.kana !== cur.jp) lines.push(cur.kana);
  } else {
    const back = backOf(cur);
    if (back && back !== faceOf(cur)) lines.push(back);
  }
  $('a-kana').textContent = lines.join('   ');
  $('a-mn').textContent = isRev() ? '' : (cur.mn || '');
  $('a-acc').innerHTML = cur.accent
    ? '<span class="acclab">өргөлт</span>' + pitchHTML(cur.accent) : '';
  // Жишээ өгүүлбэр (N5-ийн санд 97%-д нь бий). Үгийг өгүүлбэр дотор нь
  // харах нь ганцаар цээжлэхээс хамаагүй сайн тогтоодог.
  if (cur.ex) {
    // Өгүүлбэрийн бичлэг нь EX-<үгийн id>. Байхгүй бол товчгүйгээр
    // зөвхөн текстээр харуулна.
    const exId = 'EX-' + cur.id;
    $('a-kj').innerHTML = '<div class="exs"><span class="acclab">жишээ</span>'
      + '<b class="jp">' + esc(cur.ex) + '</b>'
      + (hasAudio(exId) ? '<button class="rsp" data-a="' + exId + '" title="Сонсох">🔊</button>' : '')
      + '</div>';
    $('a-kj').hidden = false;
  }
  $('answer').hidden = false;
  replay($('card'), 'flip');           // хариу нээгдэхэд карт эргэх хөдөлгөөн
}

function resolve(ok) {
  reveal();
  grade(cur.id, ok);
  done++; ok ? okN++ : ngN++;
  $('c-done').textContent = done; $('c-ok').textContent = okN; $('c-ng').textContent = ngN;
  const v = $('verdict');
  v.textContent = ok ? '✓ Зөв' : '✗ Буруу';
  v.className = 'verdict ' + (ok ? 'ok' : 'ng');
  $('pane-next').hidden = false;
  if (!ok) {
    queue.push(cur);                          // алдсан үгийг мөчлөгийн төгсгөлд эргүүлж тавина
    if (!missed.some(x => x.id === cur.id)) missed.push(cur);
  }
  // Бусад горимд карт гармагц аль хэдийн сонсгосон тул дахин давтахгүй.
  // «Бичих»-д зөвхөн ЭНД сонсгоно — урьд нь сонсгосон бол хариулт задарна.
  if (canHear(cur) && (mode === 'type' || isRev())) { $('btn-speak').hidden = false; say(cur); }
  updateBar();
}

const RING_C = 2 * Math.PI * 19;          // r=19, index.html дэх дугуйтай таарна

function updateBar() {
  const total = done + queue.length + 1;
  const r = $('pring');
  if (!r) return;
  const p = Math.max(0, Math.min(1, done / Math.max(total, 1)));
  r.style.strokeDasharray = RING_C;
  r.style.strokeDashoffset = RING_C * (1 - p);
}

/* CSS хөдөлгөөнийг ДАХИН тоглуулах: класс хасаад reflow хийж буцааж нэмнэ.
   Reflow-гүйгээр браузер өөрчлөлтийг «хэзээ ч болоогүй» гэж үзээд алгасдаг. */
function replay(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

const MODE_NAME = { flash: 'Флашкарт', choice: 'Олон сонголт',
                    type: 'Гараар бичих', listen: 'Сонсох' };
const KMODE_NAME = { h2k: 'ひらがな → カタカナ', k2h: 'カタカナ → ひらがな',
                     sound: 'Кана → авиа', klisten: 'Сонсоод таах' };
const JMODE_NAME = { flash: 'Ханз · флашкарт', k2m: '漢字 → утга',
                     m2k: 'Утга → 漢字', read: 'Ханзны уншлага' };
const labelOf = L => (L.deck === 'kana' ? KMODE_NAME[L.k]
  : L.deck === 'kanji' ? JMODE_NAME[L.k] : MODE_NAME[L.m]) || '';

function finish() {
  if (syncOn && syncCode) syncNow(true);      // дасгал дуусмагц чимээгүй нийлүүлнэ
  const tot = okN + ngN;
  $('fin-pct').textContent = tot ? Math.round(100 * okN / tot) + '%' : '—';
  $('fin-sum').textContent = '✓ ' + okN + '   ✗ ' + ngN;
  const left = settings.goal - todayN();
  $('fin-goal').textContent = left > 0
    ? 'Өнөөдрийн зорилт хүртэл ' + left + ' хариулт үлдлээ (' + todayN() + '/' + settings.goal + ').'
    : 'Өнөөдрийн зорилт биеллээ 🎉 (' + todayN() + '/' + settings.goal + ')';

  const box = $('fin-missed'); box.innerHTML = '';
  $('fin-h').hidden = !missed.length;
  for (const it of missed) {
    const face = deck === 'kana' ? (it.hira + ' ／ ' + it.kata)
      : deck === 'kanji' ? it.c : it.jp;
    const sub = deck === 'kana' ? (it.mn || '')
      : deck === 'kanji'
        ? ((it.on[0] ? it.on[0] + ' · ' : '') + it.mn)
        : ((it.kana && it.kana !== it.jp ? it.kana + ' · ' : '') + (it.mn || ''));
    const d = document.createElement('div');
    d.className = 'ms';
    d.innerHTML = '<b class="jp">' + esc(face) + '</b><span>' + esc(sub) + '</span>';
    box.appendChild(d);
  }
  $('fin-retry').hidden = !missed.length;
  refreshHome();
  show('done');
}

/* ══════════════════════ 7. Дэлгэц солих ба нүүр ══════════════════════ */

const SCREENS = ['home', 'irodori', 'jlpt', 'kana', 'study', 'done', 'feedback', 'stats', 'profile'];
let screen = 'home';

const ICON_MENU = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>';
const ICON_BACK = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';

function show(name) {
  screen = name;
  for (const s of SCREENS) $(s).hidden = (s !== name);
  $('menu').hidden = true;
  // Дасгал дунд байхад ☰ биш ‹ — нэг дарлагаар гарах боломж хэрэгтэй.
  $('btn-menu').innerHTML = (name === 'study') ? ICON_BACK : ICON_MENU;
  document.querySelectorAll('#menu button').forEach(b =>
    b.setAttribute('aria-current', b.dataset.go === name));
  window.scrollTo(0, 0);
}

function go(name) {
  // Явц нь БҮХ санг харуулдаг тул нээхэд бусад номыг татна. Эхлээд
  // байгаагаараа зурж, ирсэн хойно нь дахин зурна — хоосон дэлгэц харагдахгүй.
  if (name === 'stats') { refreshStats(); loadAllBooks().then(refreshStats); }
  if (name === 'profile') { refreshSync(); refreshUsage(); }
  if (name === 'feedback') refreshFb();
  if (['home', 'irodori', 'jlpt', 'kana'].includes(name)) refreshHome();
  show(name);
}

/** N5-ийн 50 хичээлийн чип. Irodori-гийнхтэй ижил зарчим боловч
    ӨӨР сан, ӨӨР сонголт дээр ажиллана. */
function renderN5Lessons() {
  const box = $('n5-lessons');
  if (!box || !N5.length) return;
  const sel = settings.n5les || (settings.n5les = [1, 2, 3]);
  box.innerHTML = '';
  for (const l of [...new Set(N5.map(i => i.lesson))].sort((a, b) => a - b)) {
    const n = N5.filter(i => i.lesson === l).length;
    const b = document.createElement('button');
    b.innerHTML = 'L' + l + '<small>' + n + '</small>';
    b.setAttribute('aria-pressed', sel.includes(l));
    b.onclick = () => {
      const i = sel.indexOf(l);
      i < 0 ? sel.push(l) : sel.splice(i, 1);
      settings.n5les = sel; save(KEY_S, settings); refreshHome();
    };
    box.appendChild(b);
  }
  const h = $('n5-hint');
  if (h) {
    const n = N5.filter(i => sel.includes(i.lesson)).length;
    h.textContent = n ? 'Доорх дасгал сонгосон ' + n + ' үгээс асууна.'
                      : 'Дор хаяж нэг хичээл сонгоно уу.';
  }
}

function refreshHome() {
  rebuildPool();
  $('due-n').textContent = pool.filter(isDue).length;
  const box = $('lessons');
  box.innerHTML = '';
  const lessons = [...new Set(ALL.map(i => i.lesson))].sort((a, b) => a - b);
  for (const l of lessons) {
    const b = document.createElement('button');
    const n = ALL.filter(i => i.lesson === l && (settings.ref || !i.ref)).length;
    b.innerHTML = 'L' + l + '<small>' + n + '</small>';
    b.setAttribute('aria-pressed', curLessons().includes(l));
    b.onclick = () => {
      const cur2 = curLessons(), i = cur2.indexOf(l);
      i < 0 ? cur2.push(l) : cur2.splice(i, 1);
      setLessons(cur2);
      save(KEY_S, settings); refreshHome();
    };
    box.appendChild(b);
  }
  $('inc-ref').checked = settings.ref;
  const st = $('streak-n'); if (st) st.textContent = streakN();
  const gd = $('goal-done'); if (gd) gd.textContent = todayN();
  const gn = $('goal-n'); if (gn) gn.textContent = settings.goal;
  const gb = $('goal-bar');
  if (gb) gb.style.width = Math.min(100, 100 * todayN() / settings.goal) + '%';
  const bc = $('btn-continue');
  if (bc) {
    // Өдөр бүр ижил 3 алхмыг давтуулахгүйн тулд сүүлийн дасгалыг санана.
    const L = settings.last;
    bc.hidden = !L || !labelOf(L);
    if (L && labelOf(L)) bc.textContent = 'Үргэлжлүүлэх · ' + labelOf(L);
  }
  document.querySelectorAll('#goal-pick button').forEach(b =>
    b.setAttribute('aria-pressed', +b.dataset.goal === settings.goal));
  const nv = $('n-vocab'); if (nv) nv.textContent = ALL.length + ' үг';
  const nk = $('n-kana'); if (nk) nk.textContent = KANA.length + ' кана';
  const nj = $('n-kanji');
  if (nj) nj.textContent = KANJI.filter(k => k.n).length + ' ханз';
  const nkl = $('n-kles');
  if (nkl) nkl.textContent = kanjiPool('les').length + ' ханз';
  document.querySelectorAll('#jlpt-levels button').forEach(b =>
    b.setAttribute('aria-pressed', settings.kjn.includes(+b.dataset.j)));
  const jh = $('jlpt-hint');
  if (jh) {
    const n = kanjiPool('jlpt').length;
    jh.textContent = n
      ? 'Доорх дасгал сонгосон ' + n + ' ханзаас асууна.'
      : 'Дор хаяж нэг түвшин сонгоно уу — эс тэгвээс дасгал эхлэхгүй.';
  }
  // Irodori: «шинэ үг» / «шинэ ханз» сонголтоор доорх алхмууд солигдоно.
  document.querySelectorAll('#seg-what button').forEach(b =>
    b.setAttribute('aria-pressed', b.dataset.w === settings.what));
  document.querySelectorAll('#seg-book button').forEach(b =>
    b.setAttribute('aria-pressed', b.dataset.b === settings.book));
  document.querySelectorAll('#seg-jwhat button').forEach(b =>
    b.setAttribute('aria-pressed', b.dataset.w === jWhat));
  const wjk = $('wrap-jkanji'), wjw = $('wrap-jword');
  if (wjk && wjw) { wjk.hidden = jWhat !== 'kanji'; wjw.hidden = jWhat !== 'word'; }
  const nn5 = $('n-n5'); if (nn5) nn5.textContent = (N5.length || 2077) + ' үг';
  renderN5Lessons();
  const ww = $('wrap-word'), wk = $('wrap-kanji');
  if (ww && wk) { ww.hidden = settings.what !== 'word'; wk.hidden = settings.what !== 'kanji'; }
  const ai = $('audio-info');
  if (ai) ai.textContent = (AUDIO_IDS && AUDIO_IDS.size)
    ? 'Дуудлага нь урьдчилан бэлдсэн ' + AUDIO_IDS.size + ' бичлэгээс гарна '
      + '(VOICEVOX, өргөлтийг нь номоор тохируулсан).'
    : 'Бэлдсэн бичлэг алга — браузерын өөрийн дуу уншигчийг ашиглана.';
  const vh = $('vocab-hint');
  if (vh) vh.textContent = pool.length
    ? 'Сонгосон ' + pool.length + ' үгээс асууна.'
    : 'Дор хаяж нэг хичээл сонгоно уу.';
  document.querySelectorAll('#seg-script button').forEach(b =>
    b.setAttribute('aria-pressed', b.dataset.s === settings.script));
  document.querySelectorAll('#seg-dir button').forEach(b =>
    b.setAttribute('aria-pressed', b.dataset.d === settings.dir));
  document.querySelectorAll('#kana-groups button').forEach(b =>
    b.setAttribute('aria-pressed', settings.kgroups.includes(b.dataset.g)));
  // Сонголт нь доорх дасгалуудад ЯМАР нөлөө үзүүлэхийг тоогоор нь хэлнэ.
  const kn = KANA.filter(i => settings.kgroups.includes(i.group)).length;
  const kh = $('kana-hint');
  if (kh) kh.textContent = kn
    ? 'Доорх 4 дасгал сонгосон ' + kn + ' канагаас л асууна.'
    : 'Дор хаяж нэг бүлэг сонгоно уу — эс тэгвээс дасгал эхлэхгүй.';
}

/* Явц — БҮХ хэсэгээр.
 *
 * Үүний өмнө доорх зураас зөвхөн ИДЭВХТЭЙ Irodori номын хичээлүүдийг
 * харуулдаг байв — N5-ийн 2077 үг, 1187 ханз, кана дээр хийсэн ажил
 * хаана ч тусдагүй. Дээд мөрийн «үзсэн» тоо нь харин БҮХ хэсгийг
 * нийлүүлж тоолдог тул дээд, доод хоёр нь зөрж, «яагаад явц хөдөлсөнгүй
 * вэ?» гэсэн ойлгомжгүй байдал үүсгэдэг байв. */

const STAT_TABS = [
  { k: 'starter', n: '入門' }, { k: 'el1', n: '初級1' }, { k: 'el2', n: '初級2' },
  { k: 'n5', n: 'N5 үг' }, { k: 'kanji', n: 'Ханз' }, { k: 'kana', n: 'Кана' },
];
let statTab = null;               // анх нээхэд идэвхтэй номоор эхлэнэ

/** Явцын дэлгэцэд БҮХ сан хэрэгтэй — апп эхлэхэд зөвхөн идэвхтэй
 *  номоо татдаг (эхний ачаалал хөнгөн байх ёстой). Ганц удаа татаад
 *  кэшлэнэ. Алдвал тухайн ном хоосон байна — дэлгэц эвдэрч болохгүй. */
function loadAllBooks() {
  const jobs = ['starter', 'el1', 'el2']
    .filter(b => !bookCache[b])
    .map(b => fetch(BOOK_FILE[b]).then(r => r.json())
      .then(d => { bookCache[b] = d.items; })
      .catch(() => { bookCache[b] = []; }));
  if (!N5.length) jobs.push(loadN5());
  return Promise.all(jobs);
}

function statSet(k) {
  if (k === 'kana') return KANA;
  if (k === 'kanji') return KANJI;
  if (k === 'n5') return N5;
  // Ашиглалтын үг (参考語彙) нь дасгалд анхдагчаар ордоггүй тул явцад бас тоолохгүй.
  return (bookCache[k] || []).filter(i => !i.ref);
}

const pSeen = i => ((progress[i.id] || {}).n || 0) > 0;
const pDone = i => ((progress[i.id] || {}).b || 0) >= 3;

/** Нэг мөр: шошго · хоёр давхаргатай зураас · тоо. */
function statBar(label, items) {
  const seen = items.filter(pSeen).length, done = items.filter(pDone).length;
  const w = x => (100 * x / Math.max(items.length, 1)) + '%';
  return '<div class="l"><span>' + esc(label) + '</span><span class="track">'
    + '<span class="seen" style="width:' + w(seen) + '"></span>'
    + '<span class="fill" style="width:' + w(done) + '"></span></span>'
    + '<span class="num">' + done + '/' + items.length + '</span></div>';
}

/** Сонгосон хэсгийн дотоод задаргаа: үг нь хичээлээр,
 *  ханз нь JLPT түвшнээр, кана нь бүлгээр. */
function statDetail(k) {
  const items = statSet(k);
  if (!items.length) return '<p class="hint">Ачаалж байна…</p>';
  if (k === 'kana') {
    const G = [['gojuon', '五十音'], ['dakuten', '濁·半濁'], ['yoon', '拗音']];
    return G.map(g => statBar(g[1], items.filter(i => i.group === g[0]))).join('');
  }
  if (k === 'kanji') {
    const rows = [5, 4, 3, 2].map(n => statBar('N' + n, items.filter(i => i.n === n)));
    const rest = items.filter(i => !i.n);
    // JLPT жагсаалтад үгүй харин хичээлд гардаг ханз — түүнийг бас харуулна.
    if (rest.length) rows.push(statBar('бусад', rest));
    return rows.join('');
  }
  return [...new Set(items.map(i => i.lesson))].sort((a, b) => a - b)
    .map(l => statBar('L' + l, items.filter(i => i.lesson === l))).join('');
}

function refreshStats() {
  const seen = Object.keys(progress).length;
  const learned = Object.values(progress).filter(p => p.b >= 3).length;
  const tot = Object.values(progress).reduce((a, p) => a + p.n, 0);
  const cor = Object.values(progress).reduce((a, p) => a + p.c, 0);
  const all = STAT_TABS.reduce((a, t) => a + statSet(t.k).length, 0);
  $('stat-sum').innerHTML =
    '<div><b>' + seen + '</b><span>үзсэн</span></div>' +
    '<div><b>' + learned + '</b><span>тогтсон</span></div>' +
    '<div><b>' + all + '</b><span>нийт зүйл</span></div>' +
    '<div><b>' + (tot ? Math.round(100 * cor / tot) : 0) + '%</b><span>зөв хариулт</span></div>';

  $('stat-sections').innerHTML =
    STAT_TABS.map(t => statBar(t.n, statSet(t.k))).join('');

  if (!statTab) statTab = STAT_TABS.some(t => t.k === settings.book) ? settings.book : 'starter';
  const tabs = $('seg-stat');
  tabs.innerHTML = STAT_TABS.map(t =>
    '<button data-s="' + t.k + '" aria-pressed="' + (t.k === statTab) + '">'
    + esc(t.n) + '<small>' + statSet(t.k).length + '</small></button>').join('');
  tabs.querySelectorAll('button').forEach(b =>
    b.onclick = () => { statTab = b.dataset.s; refreshStats(); });

  $('stat-lessons').innerHTML = statDetail(statTab);
}

/* ══════════════════════ 8. Холбоос ══════════════════════ */

document.querySelectorAll('.mode[data-mode]').forEach(b =>
  b.onclick = () => startSession(b.dataset.mode, false, 'book'));
document.querySelectorAll('.mode[data-k]').forEach(b =>
  b.onclick = () => startKana(b.dataset.k));
document.querySelectorAll('.mode[data-kj]').forEach(b =>
  b.onclick = () => startKanji(b.dataset.kj, 'les'));
document.querySelectorAll('.mode[data-kj2]').forEach(b =>
  b.onclick = () => startKanji(b.dataset.kj2, 'jlpt'));
document.querySelectorAll('.mode[data-n5]').forEach(b =>
  b.onclick = () => startSession(b.dataset.n5, false, 'n5'));

/* JLPT: «Ханз» эсвэл «Үг». Үг сонговол N5-ийн санг ачаална. */
let jWhat = 'kanji';
document.querySelectorAll('#seg-jwhat button').forEach(b =>
  b.onclick = () => {
    jWhat = b.dataset.w;
    if (jWhat === 'word') loadN5().then(refreshHome);
    else refreshHome();
  });
$('n5-all').onclick = () => {
  wordSrc = 'n5';
  setActiveLessons([...new Set(N5.map(i => i.lesson))]);
  refreshHome();
};
$('n5-none').onclick = () => { wordSrc = 'n5'; setActiveLessons([]); refreshHome(); };
document.querySelectorAll('#jlpt-levels button').forEach(b =>
  b.onclick = () => {
    const n = +b.dataset.j, i = settings.kjn.indexOf(n);
    i < 0 ? settings.kjn.push(n) : settings.kjn.splice(i, 1);
    save(KEY_S, settings); refreshHome();
  });
/* Irodori: «шинэ үг» эсвэл «шинэ ханз» — доорх алхмуудыг сольж харуулна. */
document.querySelectorAll('#seg-what button').forEach(b =>
  b.onclick = () => { settings.what = b.dataset.w; save(KEY_S, settings); refreshHome(); });
document.querySelectorAll('#seg-book button').forEach(b =>
  b.onclick = () => {
    const nb = b.dataset.b;
    if (nb === settings.book) return;
    loadBook(nb).then(ok => {
      if (!ok) { alert('Энэ номын үгсийг ачаалж чадсангүй.'); return; }
      settings.book = nb; save(KEY_S, settings); refreshHome();
    });
  });
document.querySelectorAll('#kana-groups button').forEach(b =>
  b.onclick = () => {
    const g = b.dataset.g, i = settings.kgroups.indexOf(g);
    i < 0 ? settings.kgroups.push(g) : settings.kgroups.splice(i, 1);
    save(KEY_S, settings); refreshHome();
  });
$('btn-review').onclick = () => startSession('choice', true);
$('btn-menu').onclick = () => {
  if (screen === 'study') { go('home'); return; }     // дасгал дундаас гарах
  $('menu').hidden = !$('menu').hidden;
};
$('btn-profile').onclick = () => go('profile');

$('app-ver').textContent = VERSION;
/* Кэшийг тойрч ачаалах: hash биш ХАЙЛТЫН мөрийг өөрчилнө — hash солиход
   браузер шинээр татдаггүй. reload(true) нь аль эрт хүчингүй болсон. */
$('btn-reload').onclick = () => {
  location.replace(location.pathname + '?r=' + Date.now());
};
document.querySelectorAll('#menu button, .bigcard').forEach(b =>
  b.onclick = () => go(b.dataset.go));
document.addEventListener('click', e => {                // гадуур дарвал цэс хаагдана
  if (!$('menu').hidden && !e.target.closest('#menu, #btn-menu')) $('menu').hidden = true;
});
$('sel-all').onclick = () => { setLessons([...new Set(ALL.map(i => i.lesson))]); refreshHome(); };
$('sel-none').onclick = () => { setLessons([]); refreshHome(); };
$('inc-ref').onchange = e => { settings.ref = e.target.checked; save(KEY_S, settings); refreshHome(); };
document.querySelectorAll('#seg-script button').forEach(b =>
  b.onclick = () => { settings.script = b.dataset.s; save(KEY_S, settings); refreshHome(); });
document.querySelectorAll('#seg-dir button').forEach(b =>
  b.onclick = () => { settings.dir = b.dataset.d; save(KEY_S, settings); refreshHome(); });

$('f-show').onclick = () => { reveal(); $('f-show').hidden = true; $('f-judge').hidden = false; };
document.querySelectorAll('#f-judge button').forEach(b =>
  b.onclick = () => { if (!answered) { answered = true; $('f-judge').hidden = true; resolve(b.dataset.ok === '1'); } });

$('t-input').addEventListener('input', e => { $('t-kana').textContent = toKana(e.target.value); });
$('t-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('t-check').click(); });
$('t-check').onclick = () => {
  if (answered) return;
  answered = true;
  resolve(checkTyped($('t-input').value, cur));
};
$('btn-next').onclick = nextCard;

$('btn-continue').onclick = () => {
  const L = settings.last; if (!L) return;
  if (L.deck === 'kana') startKana(L.k);
  else if (L.deck === 'kanji') startKanji(L.k, L.src);
  else startSession(L.m, false, L.src || 'book');
};
$('fin-retry').onclick = () => {
  if (!missed.length) return;
  queue = shuffle(missed.slice());
  missed = []; done = okN = ngN = 0;
  show('study'); $('c-total').textContent = queue.length; nextCard();
};
$('fin-again').onclick = () => {
  const L = settings.last || {};
  if (L.deck === 'kana') startKana(L.k);
  else if (L.deck === 'kanji') startKanji(L.k, L.src);
  else startSession(L.m || 'choice', false, L.src || 'book');
};
$('fin-home').onclick = () => go('home');
document.querySelectorAll('#goal-pick button').forEach(b =>
  b.onclick = () => { settings.goal = +b.dataset.goal; save(KEY_S, settings); refreshHome(); });

/* Компьютер дээр гараас хариулах: 1–4 сонголт, Space хариу харах, Enter дараах.
   Бичих горимд оролт идэвхтэй тул тэнд оролцохгүй. */
document.addEventListener('keydown', e => {
  if (screen !== 'study' || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  const k = e.key;
  if (!$('pane-next').hidden) {
    if (k === 'Enter' || k === ' ') { e.preventDefault(); $('btn-next').click(); }
    return;
  }
  if (!$('pane-choice').hidden && k >= '1' && k <= '4') {
    const b = $('choices').children[+k - 1];
    if (b) { e.preventDefault(); b.click(); }
    return;
  }
  if (!$('pane-flash').hidden) {
    if (!$('f-show').hidden && (k === ' ' || k === 'Enter')) { e.preventDefault(); $('f-show').click(); }
    else if (!$('f-judge').hidden && (k === '1' || k === 'ArrowLeft')) $('f-judge').children[0].click();
    else if (!$('f-judge').hidden && (k === '2' || k === 'ArrowRight')) $('f-judge').children[1].click();
  }
});
$('btn-speak').onclick = () => say(cur);

/* Ханзны хариулт доторх жижиг 🔊 товчнууд. Агуулга нь динамик тул
   нэг удаагийн делегацлагдсан сонсогчоор барина. */
$('a-kj').addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('.rsp');
  if (b) { e.stopPropagation(); playFile(b.dataset.a); }
});

/* Дуу гарахгүй байвал ЯАГААДЫГ нь харуулна — таамаглахын оронд утас өөрөө
   хариулна. Товчийг дарах нь өөрөө хүрэлт тул speak() энд хууль ёсны. */
$('btn-diag').onclick = () => {
  const box = $('diag');
  box.hidden = false;
  const L = [];
  const put = t => { L.push(t); box.textContent = L.join('\n'); };

  put('speechSynthesis: ' + (canSpeak ? 'дэмжинэ' : 'ДЭМЖИХГҮЙ'));
  if (!canSpeak) { put('→ Энэ браузер дуу уншиж чадахгүй.'); return; }

  const vs = speechSynthesis.getVoices();
  put('нийт хоолой: ' + vs.length);
  const ja = vs.filter(v => /^ja\b|^ja[-_]/i.test(v.lang));
  put('япон хоолой: ' + (ja.length ? ja.map(v => v.name + ' [' + v.lang + ']').join(', ') : 'АЛГА'));
  if (!ja.length && vs.length) {
    put('→ Утсандаа япон хэлний дуу уншигч суулгах хэрэгтэй.');
    put('   Android: Settings → Хэл ба оруулга → Text-to-speech → хэл нэмэх → 日本語');
    put('   iPhone: Settings → Accessibility → Spoken Content → Voices → Japanese');
  }
  put('түгжээ тайлагдсан: ' + (speechUnlocked ? 'тийм' : 'үгүй'));
  put('speaking=' + speechSynthesis.speaking + '  pending=' + speechSynthesis.pending);
  put('— こんにちは хэлж үзэж байна…');

  const u = new SpeechSynthesisUtterance('こんにちは');
  if (ja.length) u.voice = ja[0];
  u.lang = 'ja-JP';
  const t0 = Date.now();
  u.onstart = () => put('  ✓ эхэллээ (' + (Date.now() - t0) + ' ms)');
  u.onend = () => put('  ✓ дууслаа — дуу СОНСОГДСОН байх ёстой');
  u.onerror = e => put('  ✗ АЛДАА: ' + ((e && e.error) || '?'));
  lastUtterance = u;
  speechSynthesis.speak(u);
  setTimeout(() => {
    if (!L.some(x => x.indexOf('эхэллээ') >= 0 || x.indexOf('АЛДАА') >= 0)) {
      put('  ✗ 3 секундэд юу ч болсонгүй — систем дуудлагыг хааж байна.');
      put('    Утасны дууны түвшин ба чимээгүй горимыг шалгана уу.');
    }
  }, 3000);
};

$('btn-reset').onclick = () => {
  if (confirm('Бүх явцыг устгах уу? Буцаах боломжгүй.')) {
    progress = {}; save(KEY_P, progress); refreshStats(); refreshHome();
  }
};
$('btn-export').onclick = () => {
  const blob = new Blob([JSON.stringify({ progress, settings }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'irodori-progress-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
};
$('btn-sync-new').onclick = () => {
  if (syncCode && !confirm('Шинэ код үүсгэвэл хуучин кодтой холбоо тасарна. Үргэлжлүүлэх үү?')) return;
  syncCode = newCode(); save(KEY_C, syncCode); refreshSync();
  syncSay('код үүслээ — нөгөө төхөөрөмж дээрээ энэ кодыг оруулна уу');
  syncNow(true);
};
$('btn-sync-link').onclick = () => {
  const c = (prompt('Нөгөө төхөөрөмж дээрх кодоо оруулна уу:') || '').trim().toLowerCase();
  if (!c) return;
  syncCode = c; save(KEY_C, syncCode); refreshSync();
  syncNow().then(() => { refreshStats(); refreshHome(); });
};
$('btn-sync-now').onclick = () => syncNow().then(() => { refreshStats(); refreshHome(); });
$('btn-sync-off').onclick = () => {
  if (!confirm('Энэ төхөөрөмжийг салгах уу? Явц энд үлдэнэ, зөвхөн нийлүүлэлт зогсоно.')) return;
  syncCode = null; save(KEY_C, null); refreshSync(); syncSay('салгалаа');
};

$('btn-import').onclick = () => $('file-import').click();
$('file-import').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  f.text().then(t => {
    const d = JSON.parse(t);
    if (d.progress) { progress = d.progress; save(KEY_P, progress); }
    if (d.settings) { settings = d.settings; save(KEY_S, settings); }
    refreshStats(); refreshHome(); alert('Сэргээлээ.');
  }).catch(() => alert('Файлыг уншиж чадсангүй.'));
};

if (window.speechSynthesis) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

/* ══════════════════════ 8b. Санал хүсэлт ба хэрэглээний тоо ══════════════
 *
 * Санал хүсэлт нь Supabase-ийн `feedback` хүснэгтэд орж, GitHub Action
 * түүнийг 30 минут тутам уншиж Issue болгоно. Аппаас ШУУД GitHub API руу
 * залгадаггүй: тэр нь токен шаардах ба статик сайтад тавьсан токеныг хэн ч
 * хулгайлж репод дураараа бичих болно.
 *
 * Төхөөрөмжийн id нь ЗӨВХӨН давхардлыг арилгах ба спамаас сэргийлэхэд.
 * Хувийн мэдээлэл биш — санамсаргүй тэмдэгтүүд, зөвхөн энэ браузерт.
 */
const NL = String.fromCharCode(10);
const KEY_DEV = 'irodori.dev.v1';
let devId = load(KEY_DEV, null);
if (!devId) {
  const a = new Uint8Array(16);
  (crypto || window.crypto).getRandomValues(a);
  devId = [...a].map(b => b.toString(36)).join('').slice(0, 22);
  save(KEY_DEV, devId);
}

let fbKind = 'bug';

function refreshFb() {
  document.querySelectorAll('#seg-fb button').forEach(b =>
    b.setAttribute('aria-pressed', b.dataset.k === fbKind));
  const n = $('fb-n');
  if (n) n.textContent = ($('fb-body').value || '').length;
  const st = $('fb-state');
  if (st && !syncOn) st.textContent =
    'Шууд илгээх боломж тохируулаагүй байна — доорх GitHub холбоосыг ашиглана уу.';
}

/** GitHub дээр шууд нээх холбоосыг бичсэн зүйлээр урьдчилан дүүргэнэ. */
function fbGhLink() {
  const body = ($('fb-body').value || '').trim();
  const title = body.split(NL)[0].slice(0, 70);
  const q = 'title=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(body);
  $('fb-gh').href = 'https://github.com/NOVA-XO/irodori-vocab/issues/new?' + q;
}

async function sendFeedback() {
  const st = $('fb-state');
  const body = ($('fb-body').value || '').trim();
  if (body.length < 3) { st.textContent = 'Тайлбараа бичнэ үү.'; return; }
  if (!syncOn) { st.textContent = 'Шууд илгээх боломжгүй — GitHub холбоосыг ашиглана уу.'; return; }
  const btn = $('fb-send');
  btn.disabled = true; st.textContent = 'Илгээж байна…';
  try {
    // Орчны мэдээлэл — алдаа хайхад хэрэгтэй хамгийн бага хэмжээ.
    const meta = { v: VERSION, ua: navigator.userAgent.slice(0, 160),
                   w: innerWidth + 'x' + innerHeight, lang: navigator.language };
    await rpc('add_feedback', {
      p_kind: fbKind, p_body: body,
      p_contact: ($('fb-contact').value || '').trim() || null,
      p_meta: meta, p_dev: devId,
    });
    $('fb-body').value = ''; $('fb-contact').value = '';
    refreshFb();
    st.textContent = 'Баярлалаа — илгээгдлээ. Удахгүй GitHub дээр асуудал болж нэмэгдэнэ.';
  } catch (e) {
    st.textContent = 'Илгээж чадсангүй (' + e + '). Доорх GitHub холбоосоор бичиж болно.';
  }
  btn.disabled = false;
}

/** Хөгжүүлэлтийн орчин уу? Тийм бол хэрэглээний тоонд БҮРТГЭХГҮЙ.
 *
 * Шалтгаан: headless Chrome-оор шалгах бүрд шинэ профайл үүсдэг тул шинэ
 * `devId` бичигдээд «шинэ хэрэглэгч» мэт харагдаж, тоог гажуудуулж байсан.
 * Зөвхөн жинхэнэ хост (github.io) дээрх нээлт тоологдоно. */
function isDevHost() {
  const h = location.hostname;
  return !h || h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
    || h.endsWith('.local') || location.protocol === 'file:';
}

/** Апп нээгдэхэд ӨДӨРТ НЭГ УДАА — хэрэглээний тоо. Алдааг чимээгүй өнгөрөөнө. */
function pingUsage() {
  if (!syncOn || isDevHost()) return;
  const k = 'irodori.pinged.v1', t = String(today());
  try {
    if (localStorage.getItem(k) === t) return;
    localStorage.setItem(k, t);
  } catch (e) { /* хувийн горим */ }
  rpc('ping', { p_dev: devId }).catch(() => {});
}

function refreshUsage() {
  const box = $('use-stat'), note = $('use-note');
  if (!box) return;
  if (!syncOn) {
    box.innerHTML = '';
    note.textContent = 'Синк тохируулаагүй тул тоо цуглуулахгүй.';
    return;
  }
  note.textContent = 'Ачаалж байна…';
  rpc('usage_stats', {}).then(d => {
    if (!d) throw new Error('хоосон');
    box.innerHTML =
      '<div><b>' + (d.devices || 0) + '</b><span>төхөөрөмж</span></div>' +
      '<div><b>' + (d.active_7d || 0) + '</b><span>7 хоногт идэвхтэй</span></div>' +
      '<div><b>' + (d.opens || 0) + '</b><span>нийт нээлт</span></div>' +
      '<div><b>' + (d.feedback || 0) + '</b><span>санал хүсэлт</span></div>';
    note.textContent = 'Өнөөдөр ' + (d.today_opens || 0) + ' удаа нээгдсэн. '
      + 'Зөвхөн тоо — хувийн мэдээлэл, IP хадгалдаггүй.';
  }).catch(() => { box.innerHTML = ''; note.textContent = 'Тоог авч чадсангүй.'; });
}

$('fb-send').onclick = sendFeedback;
$('fb-body').addEventListener('input', () => { refreshFb(); fbGhLink(); });
document.querySelectorAll('#seg-fb button').forEach(b =>
  b.onclick = () => { fbKind = b.dataset.k; refreshFb(); });

/* ── Офлайн (service worker) ─────────────────────────────────────────
 * file:// дээр ажиллахгүй тул протоколыг шалгана. Бүртгэл амжилтгүй бол
 * апп хэвийн (зөвхөн онлайн) ажиллана — алдааг чимээгүй өнгөрөөнө. */
const OFFLINE_OK = 'serviceWorker' in navigator && location.protocol.indexOf('http') === 0;
if (OFFLINE_OK) {
  window.addEventListener('load', () =>
    navigator.serviceWorker.register('sw.js').then(swState).catch(swState));
}
function swState() {
  const el = $('sw-state');
  if (!el) return;
  if (!OFFLINE_OK) { el.textContent = 'Энэ орчинд офлайн горим ажиллахгүй.'; return; }
  navigator.serviceWorker.getRegistration().then(r => {
    el.textContent = r && r.active
      ? 'Офлайн горим идэвхтэй — интернэтгүй ч давтаж болно. Утсандаа суулгахын '
        + 'тулд браузерын цэснээс «Нүүр дэлгэцэд нэмэх» гэж сонгоно уу.'
      : 'Офлайн горим бэлтгэгдэж байна — хуудсыг нэг удаа дахин ачаална уу.';
  }).catch(() => { el.textContent = 'Офлайн горимын төлөвийг тогтоож чадсангүй.'; });
}

/* Дууг БҮГДИЙГ нь урьдчилж татаж кэшлэнэ. Ингэснээр сүлжээгүй газар ч
   дуудлага сонсогдоно. sw.js-ийн media кэштэй ижил нэрийг ашиглана. */
$('btn-offline').onclick = async () => {
  const el = $('dl-state');
  if (!AUDIO_IDS || !AUDIO_IDS.size) { el.textContent = 'Бичлэг байхгүй байна.'; return; }
  if (!window.caches) { el.textContent = 'Энэ браузер офлайн хадгалалтыг дэмжихгүй.'; return; }
  const ids = [...AUDIO_IDS];
  let n = 0, bad = 0;
  el.textContent = 'Татаж байна… 0/' + ids.length;
  try {
    const c = await caches.open('media-v1');
    for (let i = 0; i < ids.length; i += 12) {
      await Promise.all(ids.slice(i, i + 12).map(id =>
        c.add('audio/' + id + '.mp3').then(() => n++).catch(() => bad++)));
      el.textContent = 'Татаж байна… ' + (n + bad) + '/' + ids.length;
    }
    el.textContent = 'Дууслаа: ' + n + ' бичлэг хадгалагдлаа'
      + (bad ? ' · ' + bad + ' файл татагдсангүй' : '') + '.';
  } catch (e) {
    el.textContent = 'Татахад алдаа гарлаа: ' + e;
  }
};

/* Гүн холбоос: index.html#m=type гэвэл шууд тэр горимоор эхэлнэ.
   Хавчуургаас шууд дасгал руу орох, мөн дэлгэцийг шалгахад хэрэгтэй. */
function autoStart() {
  const s = (location.hash.match(/s=(kanji|kana)/) || [])[1];
  if (s) { settings.script = s; save(KEY_S, settings); refreshHome(); }
  const dr = (location.hash.match(/d=(jp2mn|mn2jp)/) || [])[1];
  if (dr) { settings.dir = dr; save(KEY_S, settings); refreshHome(); }
  // Дэлгэцийн нэрийг ЯГ тэнцүүгээр шалгана: «#m=flash&s=kana» дотор «kana»
  // гэсэн үг байгаа тул хэсэгчилж хайвал горим эхлэхийн оронд үсэрнэ.
  const scr = location.hash.replace(/^#/, '');
  if (['home', 'irodori', 'jlpt', 'kana', 'feedback', 'stats', 'profile'].includes(scr)) { go(scr); return; }
  const k = (location.hash.match(/k=(h2k|k2h|sound|klisten)/) || [])[1];
  if (k) { startKana(k); return; }
  const j = (location.hash.match(/j=(flash|k2m|m2k|read)/) || [])[1];
  if (j) { startKanji(j, /jlpt/.test(location.hash) ? 'jlpt' : 'les'); return; }
  const m = (location.hash.match(/m=(flash|choice|type|listen)/) || [])[1];
  if (m) startSession(m, false);
}

Promise.all([
  fetch(BOOK_FILE[settings.book] || BOOK_FILE.starter)
    .then(r => r.json())
    .catch(() => fetch(BOOK_FILE.starter).then(r => r.json())),
  fetch('data/kana.json').then(r => r.json()),
  fetch('data/kanji.json').then(r => r.json()),
  // Бичлэгийн жагсаалт. Байхгүй бол апп TTS-ээр хэвийн ажиллана.
  fetch('data/audio.json').then(r => r.ok ? r.json() : null).catch(() => null),
])
  .then(([v, k, kj, au]) => {
    ALL = v.items; KANA = k.items; KANJI = kj.items;
    bookCache[v.book || 'starter'] = v.items;
    if (au && au.ids) { AUDIO_IDS = new Set(au.ids); pickVoice(); }
    refreshSync();
    // Ачаалахад нэг удаа татаж уусгана — өөр төхөөрөмж дээр давтсан нь орж ирнэ.
    if (syncOn && syncCode) syncNow(true).then(refreshHome);
    show('home'); refreshHome(); autoStart(); pingUsage();
  })
  .catch(() => {
    document.getElementById('home').innerHTML =
      '<p class="warn">Үгийн сан ачаалагдсангүй. <code>data/vocab.json</code> байгаа эсэхийг шалгана уу. ' +
      'Файлыг шууд нээвэл (file://) браузер хориглодог — жижиг сервер ажиллуулна уу: ' +
      '<code>python -m http.server</code></p>';
  });
