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
    /* Энд «n» -> ん гэсэн нөөц зам байсан. ХҮРЭХГҮЙ: `KANA_MAP.n` нь
       `ん` тул дээрх нэг үсгийн хайлт үргэлж түрүүлж олно. Браузерт
       баталсан — nka->んか · shinbun->しんぶん · n->ん. */
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

/** ДУУДЛАГЫН хувилбарууд: топик бөөс は/へ/を нь бичлэгээрээ は/へ/を боловч
 *  дуудлагаараа wa/e/o (こんにちは→konnichiwa, 〜を→o, 〜へ→e). Ромажи талбар
 *  байхгүй сангуудад (el1/el2/n5) хэрэглэгч байгалийн дуудлагаар бичихэд
 *  ТАТГАЛЗДАГ байсныг засна. Бичлэг ба дуудлага ХОЁУЛЫГ хүлээж авна тул
 *  は=ha үг (はい, はたけ) хэвээр зөв. を нь бараг үргэлж бөөс тул аюулгүй;
 *  は/へ нь үгэн дотор ч гарах тул хоёуланг зөвшөөрөх нь зөв хариултыг
 *  татгалзахаас дээр (сурагч бичих дасгал). */
function readingVariants(s) {
  let out = [''];
  for (const ch of s) {
    const alts = ch === 'は' ? ['は', 'わ']
      : ch === 'へ' ? ['へ', 'え']
      : ch === 'を' ? ['を', 'お'] : [ch];
    if (alts.length === 1) { out = out.map(p => p + ch); continue; }
    const next = [];
    for (const pre of out) for (const a of alts) next.push(pre + a);
    out = next;
    if (out.length > 64) return [s];
  }
  return out;
}

/** Зөвшөөрөгдөх хариултууд: ／-ээр салгасан хувилбар бүр, ромажийн хувилбар. */
function answerSet(item) {
  const set = new Set();
  const add = v => { if (v) set.add(v); };
  const addKana = v => { for (const x of readingVariants(v)) add(x); };  // は→わ, へ→え, を→お
  // Хаалтанд байгаа хэсэг нь СОНГОЛТОТ: «おはよう（ございます）» дээр
  // «おはよう» гэж бичихэд ч зөв. Тиймээс кана/ханз талд хоёулангийнх нь
  // хувилбарыг нэмнэ — эс тэгвээс зөвхөн PDF-ийн яг тэр ромажи үсгээр
  // (ohayoo) таарах ба хүн «ohayou» гэж бичихэд татгалзана.
  const dropParen = t => t.replace(/[（(][^）)]*[）)]/g, '');
  for (const part of (item.kana || '').split(/[／/]/)) {
    addKana(normKana(part));
    addKana(normKana(dropParen(part)));
  }
  for (const part of (item.jp || '').split(/[／/]/)) {
    addKana(normKana(part));
    addKana(normKana(dropParen(part)));
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
  /* ЯПОН гараар шууд бичсэнийг ЗААВАЛ хүлээж авна.
     `toKana()` нь латинд зориулагдсан: `[^a-z\-']` бүхнийг хаядаг тул
     `ねこ` → `''` болж, ЗӨВ хариултыг «буруу» гэж тэмдэглэдэг байв
     (браузерт баталсан). Япон IME, катакана, ханз — гурвуулан унадаг.
     `answerSet` нь `normKana`-гаар хэвийн болгож хадгалдаг тул оролтыг
     ч мөн тэгж хэвийн болгоод тулгахад хангалттай: катакана→хирагана
     хөрвөж, ханз хэвээр дамжина. */
  return set.has(normKana(raw))
      || set.has(normKana(toKana(raw)))
      || set.has(normRomaji(raw));
}

/* ── ОМОНИМЫН зураглал: ханз → уншлага ─────────────────────────────
 * Япон хэл омоним ихтэй (かみ = 紙/髪/神). Хэрэглэгч ЗӨВ дуудсан ч таниулт
 * өөр ханз сонгож бичвэл (髪 гэхийн оронд 紙) шууд харьцуулалт унана.
 * Манай өгөгдөлд `jp ↔ kana` харгалзаа бүрэн байгаа тул таньсан ханзны
 * УНШЛАГЫГ гаргаж, зорилтот үгийн уншлагатай тулгана. Дуудлага зөв бол
 * ханз нь зөрсөн ч хүлээнэ — энэ дасгал нь БИЧИХ биш ХЭЛЭХ чадварыг
 * шалгадаг. */
let READ_MAP = null;
function buildReadMap() {
  READ_MAP = new Map();
  for (const arr of [ALL, N5]) {
    for (const it of arr || []) {
      const jp = normKana(it.jp || ''), ka = normKana(it.kana || '');
      if (jp && ka && jp !== ka && !READ_MAP.has(jp)) READ_MAP.set(jp, ka);
    }
  }
  return READ_MAP;
}
function readingOf(norm) {
  if (!READ_MAP) buildReadMap();
  return READ_MAP.get(norm) || '';
}

/** ЯРИХ горим: микрофоны таньсан япон текстийг УНШЛАГААР шалгана.
 *  Таних нь ханз (私) эсвэл кана (わたし) буцааж болно — `answerSet` нь
 *  ханз (jp) ба кана хоёуланг агуулдаг тул аль нь ч таарна. Топик бөөс
 *  は/へ/を-ийн дуудлагын хувилбарыг ч (readingVariants) хамруулна.
 *  Эцэст нь ОМОНИМ ханзыг уншлагаар нь шалгана. */
function checkSpoken(transcript, item) {
  const set = answerSet(item);
  const n = normKana(transcript || '');
  if (!n) return false;
  if (set.has(n)) return true;
  if (readingVariants(n).some(v => set.has(v))) return true;
  const r = readingOf(n);                       // омоним: 紙 -> かみ
  if (r && (set.has(r) || readingVariants(r).some(v => set.has(v)))) return true;
  return false;
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
  try { localStorage.setItem(key, JSON.stringify(val)); return true; }
  catch (e) { storeFailed(); return false; }
}

/* Хадгалалт унавал (хувийн горим, диск дүүрсэн) ЧИМЭЭГҮЙ өнгөрөх нь
   хамгийн муу төгсгөл: хэрэглэгч 40 карт давтаад, дахин ачаалахад бүгд
   алга болно. Нэг удаа хэлнэ — дараа нь дахин сануулахгүй. */
let storeWarned = false;
function storeFailed() {
  if (storeWarned) return;
  storeWarned = true;
  const el = document.getElementById('save-warn');
  if (el) {
    el.hidden = false;
    el.textContent = 'Энэ браузер явцыг хадгалж чадахгүй байна '
      + '(хувийн горим эсвэл сангийн хязгаар). Хуудсыг хаавал энэ дасгалын '
      + 'үр дүн алга болно.';
  }
}

/** Явцыг ДИСКЭН ДЭЭРХИЙТЭЙ НИЙЛҮҮЛЖ бичнэ.
 *
 *  Шууд дарж бичвэл хоёр таб бие биенээ устгана: тус бүр өөрийн эхний
 *  хуулбараа барьж байгаад бүхлээр нь бичдэг тул сүүлд бичсэн нь
 *  нөгөөгийн хариултыг арилгана. Үүлэн синктэй ИЖИЛ дүрмээр уусгана:
 *  илүү олон удаа давтсан нь ялна. */
function saveProgress() {
  try {
    progress = mergeProgress(load(KEY_P, {}), progress);
  } catch (e) { /* эвдэрсэн бичлэг — өөрийнхөө хуулбарыг л бичнэ */ }
  return save(KEY_P, progress);
}

const KEY_D = 'irodori.days.v1';
let progress = load(KEY_P, {});          // доор `cleanProgress`-оор шүүнэ
/* Өдөр тутмын биелэлт. Явц (хайрцаг) удаан хөдөлдөг тул үүнийг тусад
   нь харуулах хэрэгтэй.

   `ids` — ӨНӨӨДӨР судалсан үгийн id-ууд. Тоог ЭНДЭЭС гаргана: нэг үг
   өдөрт НЭГ л удаа тоологдоно. Зөвхөн тоологч байсан үед ижил үгийг
   дахин судлахад дахин нэмэгддэг байв («40/20»). */
let days = load(KEY_D, { last: -1, streak: 0, n: 0, ids: [] });
const todayN = () => (days.last === today() ? days.n : 0);
const streakN = () => {
  const t = today();
  return (days.last === t || days.last === t - 1) ? (days.streak || 0) : 0;
};

/** Өдрийн бүртгэл. `id` нь судалсан үг, `counts` нь тоололд орох эсэх.
 *
 *  ХОЁР ӨӨР зүйлийг тусад нь бүртгэнэ:
 *
 *    · ЦУВРАЛ (streak) — «өнөөдөр давтсан уу». Хариулт бүрд шалгана:
 *      бүгдийг буруу хариулсан ч тухайн өдөр давтсанд тооцогдоно.
 *    · ЗОРИЛТ (`n`) — өнөөдөр судалсан ӨӨР ӨӨР ҮГИЙН тоо.
 *
 *  Хоёр удаа хэт тоолж байсан. Эхлээд `n` нь ХАРИУЛТ бүрд өсдөг байв
 *  (алдсан карт мөчлөгт эргэж ирдэг тул «109/20»). Дараа нь ДУУССАН
 *  КАРТ-аар тоолсон ч ижил үгийг дахин судлахад дахин нэмэгдсэн
 *  («40/20»). Одоо id-г цуглуулж ДАВХАРДАЛГҮЙ тоолно. */
function tickDay(id, counts) {
  const t = today();
  if (days.last !== t) {
    // Өчигдөр давтсан бол цуврал үргэлжилнэ, тасарсан бол 1-ээс эхэлнэ.
    days.streak = (days.last === t - 1) ? (days.streak || 0) + 1 : 1;
    days.last = t; days.ids = [];
  }
  if (!Array.isArray(days.ids)) days.ids = [];
  if (counts && id && days.ids.indexOf(id) < 0) days.ids.push(id);
  days.n = days.ids.length;
  save(KEY_D, days);
}

/** Хуучин хэлбэрээс шилжих: `ids` байхгүй бол ӨНӨӨДӨР судалсан үгсийг
 *  `progress`-оос сэргээнэ.
 *
 *  `grade()` нь `p.d = today() + BOXES[p.b]` гэж бичдэг тул
 *  `p.d - BOXES[p.b] === today()` нь тухайн үгийг ӨНӨӨДӨР судалсныг
 *  ЯГ заана — `d` ба `b` хоёр ҮРГЭЛЖ хамт бичигддэг тул хуурамч
 *  тохироо гарахгүй. Ингэснээр шилжилт нь өнөөдрийн бодит ажлыг
 *  хаялгүй, зөвхөн ДАВХАРДЛЫГ л арилгана. */
function recoverDayIds() {
  if (Array.isArray(days.ids)) return;
  const t = today();
  days.ids = days.last !== t ? [] : Object.keys(progress).filter(id => {
    const p = progress[id];
    return p && (p.d - BOXES[p.b]) === t;
  });
  days.n = days.ids.length;
  save(KEY_D, days);
}
const SCRIPTS = ['kana', 'ruby', 'kanji'];
let settings = load(KEY_S, { lessons: [1, 2, 3], ref: false, script: 'kana', kgroups: ['gojuon'] });
/* Бичгийн хэлбэр — НЭГ тохиргоо, апп даяар. Профайл дэлгэцээс нэг удаа
   сонгоно; өмнө нь үгийн сан ба шалгалт тус тусдаа тохиргоотой байв.
     kana  — зөвхөн кана (ӨГӨГДМӨЛ: шинэ сурагч ханз уншиж чадахгүй)
     ruby  — ханз, дээр нь жижиг канаар уншлага (ふりがな)
     kanji — цэвэр ханз, туслалцаагүй */
if (!SCRIPTS.includes(settings.script)) settings.script = 'kana';
if (!('sfx' in settings)) settings.sfx = 1;   // хариултын дуу ба чичиргээ
if (!settings.kgroups) settings.kgroups = ['gojuon'];
if (!settings.goal) settings.goal = 20;
if (!settings.dir) settings.dir = 'jp2mn';
if (!settings.kjn) settings.kjn = [5];
        // JLPT түвшин (JLPT дэлгэц)
if (!settings.what) settings.what = 'word';   // Irodori: шинэ үг | шинэ ханз
if (!settings.book) settings.book = 'starter';
/* Хичээлийн сонголтыг НОМ ТУС БҮРД тусад нь хадгална. N5 нь 50 хичээлтэй,
   Irodori-гийнх 18 — нэг жагсаалт хуваалцвал N5-д 25-р хичээл сонгоод
   Irodori руу шилжихэд багц ХООСОН болно. */
if (!settings.les) {
  settings.les = {};
  if (settings.lessons) settings.les[settings.book] = settings.lessons;
}

/* ══ ふりがな — ханз ба кана хоёрыг зэрэгцүүлэх ═══════════════════════
   Аль кана аль ханзанд харьяалагдахыг олно. Ханзгүй хэсгүүд нь ЗАНГУУ:
   тэдгээр нь канан хэлбэрт ЯГ давтагдана. Хоёр зангууны хооронд үлдсэн
   кана нь дундах ханзны уншлага болно. Дэлгэрэнгүй ба барьсан урхинууд:
   docs/STATE.md §2.38. Энэ нь `tools/build_exam.py`-гийн алгоритмын
   ХУУЛБАР — шалгалт нь бэлдсэн хосоо хэрэглэдэг, үгийн сан нь энэ
   функцээр яг тэр цагт тооцуулна (6287 үгийг урьдчилж хадгалах нь
   өгөгдлийг дэмий тарга авахуулна). */
const RB_KANJI = /[々㐀-鿿]/;
// Араб тоо нь ханзтай ижил — уншлагатай. Дараах ханзнаасаа САЛГАХГҮЙ:
// тоолуурын дуудлага өмнөх тооноос хамаарна (3階 さんがい · 5階 ごかい).
const RB_DIGIT = /[0-9０-９,，]/;
const RB_LATIN = /[A-Za-zＡ-Ｚａ-ｚ]/;
const RB_WS = /[\s　]+/g;

function cbits(n) { let c = 0; while (n) { c += n & 1; n >>= 1; } return c; }

function rbKind(c) {
  if (RB_KANJI.test(c) || RB_DIGIT.test(c)) return 'b';
  if (RB_LATIN.test(c)) return 'l';       // ХОЁРДМОЛ — доор хоёуланг нь турших
  return 'a';
}

/** Латины хоёрдмол байдлыг задалж боломжит хуваалтуудыг гаргана.
 *  Зангуу гэж үзсэн хувилбар ЭХЭЛНЭ — латин нь канан хэлбэрт хэвээрээ
 *  байвал уншигдахгүй (ABC会社 → ABCがいしゃ, гэхдээ M → エム). */
function rbLayouts(s) {
  const parts = [];
  for (const ch of s) {
    const k = rbKind(ch);
    if (parts.length && parts[parts.length - 1][0] === k) parts[parts.length - 1][1] += ch;
    else parts.push([k, ch]);
  }
  const idx = [];
  parts.forEach((p, i) => { if (p[0] === 'l') idx.push(i); });
  const masks = [];
  for (let m = 0; m < (1 << idx.length); m++) masks.push(m);
  masks.sort((a, b) => cbits(a) - cbits(b));
  return masks.map(mask => {
    const kinds = parts.map(p => p[0]);
    idx.forEach((i, bit) => { kinds[i] = ((mask >> bit) & 1) ? 'b' : 'a'; });
    const out = [];
    kinds.forEach((k, i) => {
      const isB = k === 'b';
      if (out.length && out[out.length - 1][0] === isB) out[out.length - 1][1] += parts[i][1];
      else out.push([isB, parts[i][1]]);
    });
    return out;
  });
}

/** [[текст, уншлага], …] буцаана. Чадаагүй ЭСВЭЛ эргэлзээтэй бол null —
 *  буруу ふりがな харуулахаас огт харуулахгүй нь дээр. */
function rubyPairs(surface, reading) {
  surface = (surface || '').replace(RB_WS, '');
  reading = (reading || '').replace(RB_WS, '');
  // Латиныг ч оруулна: `Mにします。` → `エムにします。` гэж уншигддаг тул
  // ханз/тоогүй ч ふりがな хэрэгтэй байж болно. Хэрэв латин нь канан
  // хэлбэрт хэвээрээ байвал доорх шийдэгч уншлагагүй хос буцаана.
  if (!surface || !reading
      || !/[々㐀-鿿0-9０-９A-Za-zＡ-Ｚａ-ｚ]/.test(surface)) return null;
  const found = [];
  const solve = (parts, pi, ri, acc) => {
    if (found.length > 1) return;                 // эргэлзээ — цаашид хэрэггүй
    if (pi === parts.length) {
      if (ri === reading.length) found.push(acc.slice());
      return;
    }
    const isB = parts[pi][0], text = parts[pi][1];
    if (!isB) {                                   // зангуу — яг таарна
      if (reading.substr(ri, text.length) === text) {
        acc.push([text, '']);
        solve(parts, pi + 1, ri + text.length, acc);
        acc.pop();
      }
      return;
    }
    // Доод хязгаарыг ЗӨВХӨН ханзаар тоолно: `1,000円` нь 7 тэмдэгт
    // боловч уншлага нь ердөө 4 кана.
    let need = 0;
    for (const c of text) if (RB_KANJI.test(c)) need++;
    need = Math.max(1, need);
    if (pi + 1 === parts.length) {
      if (reading.length - ri >= need) {
        acc.push([text, reading.slice(ri)]);
        found.push(acc.slice());
        acc.pop();
      }
      return;
    }
    const nxt = parts[pi + 1][1];
    let start = ri + need;
    for (;;) {
      const j = reading.indexOf(nxt, start);
      if (j < 0) return;
      acc.push([text, reading.slice(ri, j)]);
      solve(parts, pi + 1, j, acc);
      acc.pop();
      start = j + 1;
    }
  };
  for (const parts of rbLayouts(surface)) {
    solve(parts, 0, 0, []);
    if (found.length) break;      // эхний үр дүнтэй хувилбараар зогсоно
  }
  return found.length === 1 ? found[0] : null;
}

/** Хосуудыг элемент рүү <ruby><rt> болгож барина.
 *
 *  DOM зангаар — `innerHTML` ХЭРЭГЛЭХГҮЙ. Ингэснээр эдгээр цэгүүд нь
 *  `textContent`-ийн адил тарилтаас бүрэн хамгаалагдсан хэвээр үлдэнэ
 *  (docs/STATE.md §2.29). */
function rubyDom(el, pairs) {
  el.textContent = '';
  el.classList.add('ruby');
  for (const pair of pairs) {
    const base = pair[0], read = pair[1];
    if (!read) { el.appendChild(document.createTextNode(base)); continue; }
    const r = document.createElement('ruby');
    r.appendChild(document.createTextNode(base));
    const rt = document.createElement('rt');
    rt.textContent = read;
    r.appendChild(rt);
    el.appendChild(r);
  }
}

/** Ханз+кана хосыг ふりがな-гаар бичнэ. Зэрэгцүүлж чадаагүй бол `plain`
 *  текстийг тавиад `false` буцаана — дуудагч нь хуучин зан төлөвөө
 *  хадгална. */
function rubyInto(el, surface, reading, plain) {
  const pairs = rubyPairs(surface, reading);
  if (!pairs) { el.classList.remove('ruby'); el.textContent = plain; return false; }
  rubyDom(el, pairs);
  return true;
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

/* ── Импортын АРИУТГАЛ ────────────────────────────────────────────
 *
 * Нөөц файл нь `settings` ба `progress`-ыг БҮХЭЛД нь солино. Файл нь
 * хэрэглэгчийн гараас ирдэг тул төрөл нь ямар ч байж болно. Довтолгооны
 * шалгалтад дараах нь аппыг унагав (браузерт баталсан):
 *   settings.les     = "мөр"   → Cannot create property 'starter' on string
 *   settings.kgroups = 42      → kgroups.includes is not a function
 *   progress['x']    = null    → Cannot read properties of null
 *
 * Тиймээс ирсэн утгыг ИТГЭЛГҮЙГЭЭР дахин байгуулна: төрөл нь таарахгүй
 * бол анхдагчаар солино. */
/* Номын түлхүүр. `BOOK_FILE` нь хамаагүй доор тодорхойлогддог тул
   `cleanSettings` түүнийг ашиглаж БОЛОХГҮЙ — модуль ачаалагдах үед
   TDZ алдаа өгнө. */
const BOOKS = ['starter', 'el1', 'el2', 'n5'];
const KGROUPS = ['gojuon', 'dakuten', 'yoon'];
const arrOf = (v, ok) => Array.isArray(v) ? v.filter(ok) : null;

function cleanSettings(v) {
  const d = {
    lessons: [1, 2, 3], ref: false, script: 'kana', kgroups: ['gojuon'],
    goal: 20, dir: 'jp2mn', kjn: [5], what: 'word', sfx: 1,
    book: 'starter', les: {}, n5les: [1, 2, 3],
  };
  if (!v || typeof v !== 'object' || Array.isArray(v)) return d;
  const num = x => typeof x === 'number' && isFinite(x);
  const out = Object.assign({}, d);
  if (BOOKS.includes(v.book)) out.book = v.book;
  out.ref = !!v.ref;
  if (SCRIPTS.includes(v.script)) out.script = v.script;
  out.sfx = v.sfx === 0 ? 0 : 1;          // анхдагчаар асаалттай
  if (v.dir === 'mn2jp' || v.dir === 'jp2mn') out.dir = v.dir;
  if (v.what === 'word' || v.what === 'kanji') out.what = v.what;
  // Зорилт 0 бол хуваалт Infinity болно — доод хязгаар 1.
  if (num(v.goal)) out.goal = Math.max(1, Math.min(500, Math.round(v.goal)));
  out.kgroups = arrOf(v.kgroups, x => KGROUPS.includes(x)) || d.kgroups;
  if (!out.kgroups.length) out.kgroups = d.kgroups;
  out.kjn = arrOf(v.kjn, num) || d.kjn;
  out.n5les = arrOf(v.n5les, num) || d.n5les;
  out.les = {};
  if (v.les && typeof v.les === 'object' && !Array.isArray(v.les)) {
    for (const b of BOOKS) {
      const ls = arrOf(v.les[b], num);
      if (ls) out.les[b] = ls;
    }
  }
  if (v.last && typeof v.last === 'object' && !Array.isArray(v.last)) out.last = v.last;
  return out;
}

function cleanProgress(v) {
  const out = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  const n = x => (typeof x === 'number' && isFinite(x)) ? x : 0;
  for (const id of Object.keys(v)) {
    if (id === '__proto__' || id === 'constructor' || id === 'prototype') continue;
    const p = v[id];
    if (!p || typeof p !== 'object' || Array.isArray(p)) continue;
    out[id] = {
      b: Math.max(0, Math.min(BOXES.length - 1, Math.round(n(p.b)))),
      d: Math.round(n(p.d)), n: Math.max(0, Math.round(n(p.n))),
      c: Math.max(0, Math.round(n(p.c))), w: Math.max(0, Math.round(n(p.w))),
    };
  }
  return out;
}

/* Гараар засагдсан, хуучин хэлбэртэй, эсвэл өөр хувилбараас үлдсэн
   localStorage-аас хамгаална. Энэ нь `cleanSettings` / `cleanProgress`
   хоёрын ДАРАА байх ёстой — тэдгээр нь `const` (TDZ). */
progress = cleanProgress(progress);
settings = cleanSettings(settings);
recoverDayIds();          // `progress` цэвэрлэгдсэний ДАРАА — түүнээс уншина

function grade(id, ok) {
  const p = progress[id] || { b: 0, d: 0, n: 0, c: 0, w: 0 };
  p.n++;
  if (ok) { p.c++; p.b = Math.min(p.b + 1, BOXES.length - 1); }
  else { p.w++; p.b = Math.max(p.b - 2, 0); }
  p.d = today() + BOXES[p.b];
  progress[id] = p;
  saveProgress();
  // Зөв хариулсан үед л карт мөчлөгөөс ГАРНА — `resolve()` дэх `done`-той
  // ЯГ ижил дүрэм. `id` нь давхардлыг таслана: ижил үгийг өдөрт хоёр
  // удаа судалсан ч зорилт НЭГ л удаа нэмэгдэнэ.
  tickDay(id, ok);
}

/* Өөр ТАБ бичсэн бол санах ойгоо шинэчилнэ. `storage` нь ЗӨВХӨН бусад
   таб дээр ажилладаг (өөрийн бичилтэд гардаггүй) тул давталт үүсэхгүй. */
window.addEventListener('storage', e => {
  if (!e.key) return;
  if (e.key === KEY_P) {
    progress = mergeProgress(load(KEY_P, {}), progress);
    if (screen !== 'study') { refreshHome(); refreshStats(); }
  } else if (e.key === KEY_D) {
    // Нэгтгэхдээ НЭГДЭЛ (union) авна: хоёр таб өөр өөр үг судалсан бол
    // хоёулаа тоологдох ёстой. Зөвхөн «том тоог нь ав» гэвэл нөгөө
    // табын үгс алга болно.
    const d = load(KEY_D, days);
    if (d && d.last === days.last) {
      const mine = Array.isArray(days.ids) ? days.ids : [];
      const his = Array.isArray(d.ids) ? d.ids : [];
      days.ids = mine.concat(his.filter(x => mine.indexOf(x) < 0));
      days.n = days.ids.length;
      days.streak = Math.max(days.streak || 0, d.streak || 0);
    }
  }
});

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

/* Явцын ҮЙЛДЛИЙН тоолуур. Синк нь сүлжээнд нислэгт байхад хэрэглэгч
   явцаа УСТГАвал, буцаж ирсэн үүлний өгөгдөл устгасныг эргүүлж тавьдаг
   байв (`syncCode` нь өөрчлөгддөггүй тул одоо байгаа хамгаалалт үүнийг
   барихгүй). Тиймээс §2.36-ийн ГҮЙЛТИЙН ТЭМДГИЙГ өгөгдөлд ч хэрэглэв:
   устгал бүрд ахиулж, синк буцахдаа шалгана. */
let progGen = 0;

async function syncNow(quiet) {
  // Кодыг ЭХЭНД нь барьж авна. `syncCode` нь дэлхийн хувьсагч тул
  // GET явж байхад хэрэглэгч өөр код холбовол PUT нь ШИНЭ код руу
  // ХУУЧИН кодын явцыг бичих байсан — хоёр хүний явц холилдоно.
  const code = syncCode;
  const gen = progGen;                       // §2.36 — гүйлтийн тэмдэг
  if (!syncOn || !code) return;
  try {
    if (!quiet) syncSay('нийлүүлж байна…');
    const remote = await rpc('get_progress', { p_code: code });
    if (syncCode !== code) return;             // энэ хооронд код солигдов
    if (gen !== progGen) return;               // энэ хооронд ЯВЦ УСТСАН
    // Үүлнээс ирсэн өгөгдлийг ч ИТГЭЛГҮЙГЭЭР шүүнэ: кодоо мэддэг хэн ч
    // ямар ч хэлбэрийн jsonb бичиж чадна.
    const merged = mergeProgress(progress, cleanProgress(remote || {}));
    progress = merged;
    saveProgress();
    // `put_progress` нь СЕРВЕР дээр уусгаж, эцсийн үр дүнг буцаана.
    // Дарж бичдэг байсан тул хоёр төхөөрөмж зэрэг нийлүүлэхэд сүүлийнх
    // нь эхнийхийг устгадаг байв.
    const saved = await rpc('put_progress', { p_code: code, p_data: merged });
    if (syncCode !== code) return;
    if (gen !== progGen) return;               // устгал PUT-ийн дараа ирэв
    if (saved && typeof saved === 'object') {
      progress = mergeProgress(progress, saved);
      saveProgress();
    }
    syncSay('нийлүүлсэн: ' + new Date().toLocaleTimeString() +
            ' · ' + Object.keys(progress).length + ' карт');
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
  /* Кодгүй үед КОДЫН хайрцгийг нуух. Урьд нь «— холбогдоогүй —» гэсэн
     ӨГҮҮЛБЭРИЙГ тэр хайрцагт бичдэг байсан — тэр нь 20px монспэйс,
     өргөн зайтай, код харуулахаар зохиосон тул сонин харагддаг байв. */
  const el = document.getElementById('sync-code');
  if (el) { el.hidden = !syncCode; el.textContent = syncCode || ''; }
  /* Холбогдоогүй үед «Нийлүүлэх», «Салгах» хоёр нь утгагүй. */
  for (const id of ['btn-sync-now', 'btn-sync-off']) {
    const b = document.getElementById(id);
    if (b) b.hidden = !syncCode;
  }
}

/* ══════════════════════ 4. Өгөгдөл ══════════════════════ */

/* Ном тус бүр ТУСДАА файлтай — сонгосон номоо л татна (эхний ачаалал хөнгөн).
   id-ийн угтвар ном бүрд өөр (L / E1 / E2) тул явц хольцолдохгүй. */
const BOOK_FILE = { starter: 'data/vocab.json', el1: 'data/vocab-el1.json',
                    el2: 'data/vocab-el2.json', n5: 'data/vocab-n5.json' };
// Хоёр газар жагсаалт барихгүй: дээрх `BOOKS`-той таарч байх ёстой.
BOOKS.forEach(b => { if (!BOOK_FILE[b]) throw new Error('ном дутуу: ' + b); });
const bookCache = {};

/* Ном сонгох дараалал: дарлага бүрд дугаар өгнө. Хоёр номыг хурдан
   дараалан дарвал эхнийх нь СҮҮЛД хариулж, сонголтыг эргүүлж татдаг
   байв — зөвхөн ХАМГИЙН СҮҮЛИЙН хүсэлтийг хүлээн авна. */
let bookReq = 0;

/** Номын үгсийг татаж кэшлэнэ. `ALL`-ыг ХӨДӨЛГӨХГҮЙ — дуудагч нь
 *  өөрийн хүсэлт хамгийн сүүлийнх эсэхийг шалгаад өөрөө тавина. */
function fetchBook(b) {
  if (bookCache[b]) return Promise.resolve(bookCache[b]);
  return fetch(BOOK_FILE[b]).then(r => {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(d => {
    bookCache[b] = d.items;                   // амжилттай үед Л кэшлэнэ
    return d.items;
  }).catch(() => null);                       // бүтэлгүйтлийг КЭШЛЭХГҮЙ
}

function loadBook(b) {
  return fetchBook(b).then(items => {
    if (!items) return false;
    ALL = items; READ_MAP = null; return true;
  });
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
  return fetch('data/vocab-n5.json').then(r => {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(d => { N5 = d.items; READ_MAP = null; return true; }).catch(() => false);
}

/** Дасгал эхлүүлэхийн ӨМНӨ тухайн сангийн үг ачаалагдсан эсэхийг батална.
 *  N5-ийг апп эхлэхэд татдаггүй (эхний ачаалал хөнгөн байх ёстой) тул
 *  дахин ачаалсны дараа «Үргэлжлүүлэх» дарвал хоосон багц гардаг байв. */
function ensureWords(src) {
  return (src === 'n5') ? loadN5() : Promise.resolve(true);
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

/* ── Микрофоноор таних (Web Speech API) ─────────────────────────────
 * «Ярих» горим: хэрэглэгч япон үгээ ХЭЛЭХ, браузер таниад уншлагаар нь
 * шалгана. Chrome/Edge дэмждэг; Firefox үгүй. HTTPS шаардана (github.io
 * зүгээр). Chrome нь дууг Google сервер рүү илгээж таниулдаг — товчийг
 * дарж зөвшөөрсний дараа л ажиллана. */
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
const canListen = !!SpeechRec;
let recog = null, recognizing = false;

/* ГҮЙЛТИЙН ТЭМДЭГ. Таниулт нь ASYNC: `stop()` дуудсаны дараа ч эцсийн
   үр дүнгээ хүргэдэг. Тэмдэггүй бол дараах хоёр алдаа гарна:
     · хуучин таниулт ДАРААГИЙН картыг хариулчихна,
     · хуучин объектын `onend` нь `recognizing`-ийг тэглээд, шинэ таниулт
       зогсоох боломжгүй болно.
   Тиймээс дуудлага бүр өөрийн `run`-ыг шалгана; `stopRecog()` нь тэмдгийг
   ахиулж хуучин бүх дуудлагыг ХҮЧИНГҮЙ болгоно. */
let recogRun = 0;

function startRecog(onInterim, onFinal, onError, onEnd) {
  if (!canListen) { if (onError) onError('unsupported'); return; }
  stopRecog();                         // өмнөхийг таслаж, дуудлагыг хүчингүй болгоно
  const run = ++recogRun;
  const live = () => run === recogRun;
  try {
    const r = new SpeechRec();
    recog = r;
    r.lang = 'ja-JP';
    r.interimResults = true;
    r.maxAlternatives = 4;     // таних нь ойролцоо хувилбар өгдөг — бүгдийг шалгана
    r.continuous = false;
    recognizing = true;
    r.onresult = e => {
      if (!live()) return;
      let interim = '', finalRes = null;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const x = e.results[i];
        if (x.isFinal) finalRes = x; else interim += x[0].transcript;
      }
      if (finalRes) {
        const alts = [];
        for (let k = 0; k < finalRes.length; k++) alts.push(finalRes[k].transcript);
        if (onFinal) onFinal(alts);
      } else if (interim && onInterim) onInterim(interim);
    };
    r.onerror = e => {
      if (!live()) return;
      recognizing = false;
      if (onError) onError((e && e.error) || 'error');
    };
    r.onend = () => {
      if (!live()) return;
      recognizing = false;
      if (onEnd) onEnd();              // үр дүнгүй дуусвал товчийг сэргээнэ
    };
    r.start();
  } catch (e) { recognizing = false; if (onError) onError(String((e && e.message) || e)); }
}

/** Таниулт зогсоож, хуучин бүх дуудлагыг хүчингүй болгоно. `abort()` нь
 *  `stop()`-оос ялгаатай нь үр дүнг ХАЯДАГ — цуцлахад яг тэр хэрэгтэй. */
function stopRecog() {
  recogRun++;
  recognizing = false;
  if (recog) { try { recog.abort(); } catch (e) { /* байхгүй */ } recog = null; }
}

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

  // Хоолой хожуу ирвэл ОДООГИЙН картын товчийг сэргээнэ — ижил дүрмээр.
  const b = document.getElementById('btn-speak');
  if (b) b.hidden = soundBtnHidden();
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

function speak(text) {
  /* Бэлэн mp3 тоглож байхад TTS эхэлбэл хоёр дуу ДАВХЦАНА (өмнөх
     картын бичлэг + шинэ картын TTS). Эхлээд бичлэгийг зогсооно. */
  try { if (player && !player.paused) player.pause(); } catch (e) {}
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

/** @param onFail  тоглуулалт УНАВАЛ дуудагдана (офлайн, эвдэрсэн файл).
 *
 *  Урьд нь `play()`-ийн татгалзлыг залгидаг байсан тул жагсаалтад байгаа
 *  ч бодитоор дуугардаггүй бичлэг дээр апп ЧИМЭЭГҮЙ үлдэж, TTS рүү ч
 *  шилжихгүй байв. */
function playFile(id, onFail) {
  if (!hasAudio(id)) return false;
  try {
    const p = ensurePlayer();
    p.src = 'audio/' + id + '.mp3';
    const r = p.play();
    if (r && r.catch) r.catch(err => {
      // Дараагийн карт руу шилжихэд өмнөхийг тасалдаг — тэр нь алдаа биш.
      if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError')) return;
      if (onFail) onFail();
    });
    return true;
  } catch (e) { return false; }
}

/** Картын дуудлага: бичлэг байвал бичлэг, эс бөгөөс TTS. */
function say(it) {
  if (!it) return;
  if (deck === 'kanji') {
    // Ганц ханзны дуудлага олон янз байдаг тул ЖИШЭЭ ҮГЭЭР нь сонсгоно.
    const w = kjWord(it);
    if (w && playFile(w.id, () => speak(w.kana))) return;
    if (w) speak(w.kana);
    return;
  }
  const fallback = deck === 'kana' ? it.hira : (it.kana || it.jp);
  if (playFile(it.id, () => speak(fallback))) return;
  speak(fallback);
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
  enterStudy();
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
  enterStudy();
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
  enterStudy();
}

/** Дуу товчийг харуулах уу — ГАНЦ дүрэм.
 *
 *  Урьд нь `nextCard()`, `resolve()`, `pickVoice()` гурав ӨӨР ӨӨР
 *  дүрмээр шийддэг байв. Хоолой хожуу ирэхэд `pickVoice()` дуудагдаж,
 *  «бичих» горимд хариулахаас өмнө товчийг ил гаргаж ХАРИУЛТЫГ
 *  ЗАДАЛДАГ байсан. */
function soundBtnHidden() {
  if (!cur || !canHear(cur)) return true;
  // «Бичих», «Ярих» ба урвуу чиглэлд асуулт нь монгол утга — дуу нь хариулт.
  if ((mode === 'type' || mode === 'speak' || isRev()) && !shown) return true;
  return false;
}

function nextCard() {
  if (!queue.length) { finish(); return; }
  // Шинэ карт гармагц хуучин таниулт ХҮЧИНГҮЙ. Эс тэгвэл өмнөх картын
  // хожуу ирсэн үр дүн энэ асуултыг хариулчихаж магадгүй.
  stopRecog();
  cur = queue.shift();
  answered = false;
  shown = false;
  const card = $('card');
  if (card) card.classList.remove('flip');
  replay(card, 'in');
  for (const p of ['pane-flash', 'pane-choice', 'pane-type', 'pane-speak', 'pane-next']) $(p).hidden = true;
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
  } else if (mode === 'speak') {
    // Утга харуулж → хэрэглэгч япон үгээ ХЭЛНЭ (бичих горимтой ижил чиглэл).
    $('p-main').textContent = cur.mn || cur.jp; $('p-main').className = 'prompt mn';
    $('mic-text').textContent = '';
    micIdle('Товчийг дараад япон үгээ хэлээрэй.');
    $('pane-speak').hidden = false;
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
  $('btn-speak').hidden = soundBtnHidden();
  if (!soundBtnHidden()) say(cur);
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
  /* «Сонсоод таах» горимд сандруулагч нь ЯГ ИЖИЛ дуутай байж болохгүй.
     Япон хэлэнд дараах хосууд ИЖИЛ дуудагдана — дууны файл нь ч байт
     хүртэл ижил байдаг (шалгав):
         お / を · じ / ぢ · ず / づ · じゃ/ぢゃ · じゅ/ぢゅ · じょ/ぢょ
     Тэдгээрийг сонголтод зэрэг гаргавал сурагч чихээрээ ЯЛГАЖ ЧАДАХГҮЙ:
     «о» гэж сонсоод お дарахад апп «буруу» гэж хэлнэ. Бусад горимд
     (h2k · k2h · sound) харьцуулалт нь БИЧГЭЭР явдаг тул асуудалгүй. */
  const sameSound = x => deck === 'kana' && kmode === 'klisten'
    && (x.mn === cur.mn || x.romaji === cur.romaji);
  const usable = x => x.id !== cur.id && optText(x) && optText(x) !== want
    && !sameSound(x)
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

/** АТРИБУТЫН дотор тавих текст. `esc()` нь хашилтыг орлуулдаггүй тул
 *  `id="A" onmouseover="…"` гэсэн утга атрибутаас ГАРЧ шинэ атрибут
 *  үүсгэдэг (2026-09-11-ний довтолгооны шалгалтад браузер дотор
 *  баталсан). Атрибутад ҮРГЭЛЖ үүнийг хэрэглэнэ, `esc()`-ийг БИШ. */
function escA(t) {
  return esc(t).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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

let shown = false;          // хариулт харагдсан уу (дуу товчийн дүрэмд)

function reveal() {
  shown = true;
  if (deck === 'kanji') {
    $('a-kana').textContent = kmode === 'm2k' ? cur.c : '';
    $('a-mn').textContent = cur.mn;
    $('a-acc').innerHTML = '';
    // Уншлагын мөр бүрд өөрийн 🔊 — 音 ба 訓 нь тусдаа бичлэгтэй
    // (JO-/JK-<юникод>). Ханзны нүүрэн дэх 🔊 нь жишээ ҮГИЙГ сонсгоно.
    const code = cur.id.split('-')[1];
    const play = id => hasAudio(id)
      ? '<button class="rsp" data-a="' + escA(id) + '" title="Сонсох">🔊</button>' : '';
    const on = cur.on.length ? '<div><b>音</b> <span class="jp">' +
      esc(cur.on.join('・')) + '</span>' + play('JO-' + code) + '</div>' : '';
    const kun = cur.kun.length ? '<div><b>訓</b> <span class="jp">' +
      esc(cur.kun.map(fmtKun).join('・')) + '</span>' + play('JK-' + code) + '</div>' : '';
    let words = '';
    // Нэг үг хоёр номд орсон бол `w` дотор ДАВХАРДАНА («出身／ご出身» хоёр
    // удаа гарч байв). Эхний тохиолдлыг нь л үлдээнэ.
    const seenW = new Set();
    const uniq = (cur.w || []).filter(x => !seenW.has(x.jp) && seenW.add(x.jp));
    for (const w of uniq.slice(0, 3)) {
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
  /* ふりがな нь ЗӨВХӨН ар талд. Урд талд тавьбал таах ёстой уншлагыг нь
     задлаад өгнө — дасгал утгагүй болно. Ар талд `にほん` гэж тусад нь
     бичихээс `日本` дээр нь бичих нь илүү: аль дуудлага аль ханзных
     болохыг харуулна. Зэрэгцүүлж чадаагүй ~2.6% үг дээр хуучин мөр
     хэвээрээ үлдэнэ (rubyInto нь false буцаана). */
  const ak = $('a-kana');
  if (settings.script === 'ruby' && lines.length === 1
      && cur.jp && cur.kana && cur.jp !== cur.kana
      && rubyInto(ak, cur.jp, cur.kana, lines[0])) {
    /* ふりがな тавигдлаа */
  } else {
    ak.classList.remove('ruby');
    ak.textContent = lines.join('   ');
  }
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
      + (hasAudio(exId) ? '<button class="rsp" data-a="' + escA(exId) + '" title="Сонсох">🔊</button>' : '')
      + '</div>';
    $('a-kj').hidden = false;
  }
  $('answer').hidden = false;
  replay($('card'), 'flip');           // хариу нээгдэхэд карт эргэх хөдөлгөөн
}

/* ── Хариултын дуу ба чичиргээ ─────────────────────────────────────
 *
 * Дууг ФАЙЛААР биш, Web Audio-гоор ГАЗАР ДЭЭР НЬ үүсгэнэ. Шалтгаан:
 *   · хэмжээ 0 — репо аль хэдийн 160 МБ дуутай;
 *   · саатал 0 — файл татах, буферлэх хүлээлтгүй тул хариулт өгмөгц
 *     дуугарна. Хариултын дуу 200мс хожимдвол огт хэрэггүй;
 *   · офлайн үед ч ажиллана.
 *
 * `AudioContext`-ыг УРЬДЧИЛАН үүсгэхгүй: гар утсан дээр хэрэглэгчийн
 * үйлдлээс өмнө үүсгэвэл `suspended` төлөвт гацдаг. Эхний хариулт
 * өөрөө үйлдэл тул тэнд үүсгэнэ.
 */
let actx = null;

function audioCtx() {
  if (actx) return actx;
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return null;
  try { actx = new C(); } catch (e) { return null; }
  return actx;
}

/** Нэг богино дуу. `f0`→`f1` давтамж, `ms` үргэлжлэх хугацаа. */
function blip(ctx, at, f0, f1, ms, type, vol) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, at);
  o.frequency.exponentialRampToValueAtTime(f1, at + ms / 1000);
  /* Дуу эхлэх/дуусахад ТОМ тас гарахаас сэргийлж дугтуй тавина —
     огцом тасалбал чанга «клик» сонсогдоно. */
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + ms / 1000);
  o.connect(g); g.connect(ctx.destination);
  o.start(at); o.stop(at + ms / 1000 + 0.02);
}

/** Зөв/буруугийн дуу ба чичиргээ. Тохиргоогоор унтраана. */
function sfx(ok) {
  if (!settings.sfx) return;
  const ctx = audioCtx();
  if (ctx) {
    /* Хөтөч контекстыг унтрааж мэднэ (таб далд болох г.м.). */
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
    const t = ctx.currentTime;
    if (ok) {
      // Дээшлэх хоёр нот — богино, зөөлөн.
      blip(ctx, t, 660, 680, 80, 'sine', 0.10);
      blip(ctx, t + 0.075, 990, 1010, 130, 'sine', 0.10);
    } else {
      // Доошлох бүдүүн дуу. Чанга биш — шийтгэл биш, тэмдэг.
      blip(ctx, t, 250, 150, 190, 'triangle', 0.09);
    }
  }
  /* Чичиргээ ЗӨВХӨН буруу дээр. Зөв бүрд чичирвэл мэдрэмж элэгдэнэ.
     iOS Safari `vibrate`-ийг дэмждэггүй — тэнд чимээгүй алгасна. */
  if (!ok && navigator.vibrate) {
    try { navigator.vibrate(60); } catch (e) {}
  }
}

function resolve(ok) {
  sfx(ok);
  reveal();
  grade(cur.id, ok);
  /* `done` нь ДУУССАН КАРТЫГ тоолно, хариултыг БИШ. Алдсан карт
     мөчлөгийн төгсгөлд эргэж ирдэг тул хариултын тоо картын тооноос
     давдаг: 20 картын нэгийг алдвал толгойд «21/20» гэж гардаг байв
     (браузерт давтав: 5 картад 6/5). Зөв хариулсан үед л карт
     мөчлөгөөс гардаг тул түүнийг тоолно — тэгвэл хамгийн ихдээ
     20/20 болно. `okN`/`ngN` нь ХАРИУЛТЫН тоо хэвээр: дүгнэлтийн
     хувь (`fin-pct`) тэднээс бодогддог. */
  if (ok) done++;
  ok ? okN++ : ngN++;
  renderCounters();
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
  $('btn-speak').hidden = soundBtnHidden();
  if (canHear(cur) && (mode === 'type' || isRev())) say(cur);
  updateBar();
}

const RING_C = 2 * Math.PI * 19;          // r=19, index.html дэх дугуйтай таарна

/** Дасгалын дөрвөн тоолуурыг ЗЭРЭГ бичнэ. Шинэ дасгал эхлэхэд ч
 *  дуудна — эс тэгвэл өмнөх дасгалын тоо эхний хариулт хүртэл үлдэнэ. */
function renderCounters(total) {
  if (total != null) $('c-total').textContent = total;
  $('c-done').textContent = done;
  $('c-ok').textContent = okN;
  $('c-ng').textContent = ngN;
}

function updateBar() {
  // Хариулсны дараа тухайн карт `done`-д АЛЬ ХЭДИЙН орсон тул дахин
  // нэмбэл хуваарь нэгээр өснө: 20 картыг бүгдийг зөв хариулахад
  // 20/21 (95.2%) харагддаг байв.
  const total = done + queue.length + (answered ? 0 : 1);
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
    ? 'Өнөөдрийн зорилт хүртэл ' + left + ' үг үлдлээ (' + todayN() + '/' + settings.goal + ').'
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

  /* Гол товчны утга нь ҮЛДСЭН ШИНЭ үгээс хамаарна.
   *
   *   шинэ үг үлдсэн  → «Дараагийн хэсэг»   (үргэлжлүүлнэ)
   *   бүгд үзэгдсэн   → «Дахин эхлүүлэх»    (эхнээс нь давтана)
   *
   * Зан төлөв өөрчлөгдөхгүй — `buildQueue` нь `due → fresh → rest`
   * дарааллаар сонгодог тул шинэ үг үлдсэн байхад дараагийн багц нь
   * ҮРГЭЛЖ шинэ үгээр дүүрдэг. Зөвхөн ШОШГО нь худал байсан: «Дахин
   * үзэх» гэхэд хэрэглэгч ижил 20 үг дахин гарна гэж ойлгодог.
   *
   * `pool` нь дасгалын туршид хөдөлдөггүй (§2.27) ба `progress` нь
   * шинэчлэгдсэн байгаа тул `isNew` нь ЭНД зөв хариу өгнө. */
  const moreNew = pool.some(isNew);
  $('fin-again').textContent = moreNew ? 'Дараагийн хэсэг' : 'Дахин эхлүүлэх';

  refreshHome();
  show('done');
}

/* ══════════════════════ 7. Дэлгэц солих ба нүүр ══════════════════════ */

const SCREENS = ['home', 'irodori', 'jlpt', 'kana', 'study', 'done', 'exam',
                 'feedback', 'stats', 'profile', 'setup', 'klass'];
let screen = 'home';

/* JLPT хэсгийг ТҮР унтраасан. Буцаахдаа зөвхөн энэ тугийг `true` болгоно —
   өөр юу ч өөрчлөх шаардлагагүй (дэлгэц, өгөгдөл, логик бүгд байрандаа). */
const JLPT_ON = true;
if (!JLPT_ON) {
  document.querySelectorAll('[data-go="jlpt"]').forEach(el => { el.hidden = true; });
}

const ICON_MENU = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>';
const ICON_BACK = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';

function show(name) {
  // Дасгалаас ГАРАХ мөчид хэрэглээний тоог илгээнэ. `finish()` нь
  // `show('done')` дуудаж дуусдаг тул дуусгасан ч, дундуур гарсан ч
  // хоёулаа энд таарна.
  if (screen === 'study' && name !== 'study') { statsPing(); memberSync(); stopRecog(); }
  // Шалгалтаас гарвал хойшлуулсан таймер ШИНЭ гүйлтэд нөлөөлөхгүй байх ёстой.
  if (screen === 'exam' && name !== 'exam') exAbort();
  const wasScreen = screen;          // `navTo`-д хэрэгтэй — доор `screen` дарагдана
  screen = name;
  // Энэ нь `show()` дотор байх ЁСТОЙ — дасгал `go()`-гүйгээр шууд
  // `show('study')` дуудаж эхэлдэг.
  for (const s of SCREENS) $(s).hidden = (s !== name);
  /* `go()` биш ЭНД бичнэ: дасгал нь `show('study')`-ээр шууд эхэлдэг
     тул түүнээс ч буцах боломжтой байх ёстой. ӨМНӨХ дэлгэцтэй
     харьцуулна — `screen` нь дээр аль хэдийн дарагдсан. */
  if (name !== wasScreen) navTo(name);
  shutDrawer();
  // Дасгал дунд байхад ☰ биш ‹ — нэг дарлагаар гарах боломж хэрэгтэй.
  $('btn-menu').innerHTML = (name === 'study') ? ICON_BACK : ICON_MENU;
  document.querySelectorAll('#menu button[data-go]').forEach(b =>
    b.setAttribute('aria-current', b.dataset.go === name));
  window.scrollTo(0, 0);
}

/* ── Утасны «буцах» товч ───────────────────────────────────────────
 *
 * Дэлгэц солигдох бүрд түүхэнд бичлэг үлдээнэ. `popstate` ирэхэд тэр
 * бичлэгийн дэлгэц рүү буцна — ГЭХДЭЭ дахин бичлэг үүсгэхгүй, эс
 * тэгвэл буцах товч хэзээ ч дуусахгүй давталтад орно (`navBack` туг).
 *
 * Шургуулга нээхэд ч бичлэг үүсгэнэ. Ингэснээр нээлттэй байхад буцвал
 * эхлээд шургуулга хаагдаж, дэлгэц хэвээр үлдэнэ.
 */
let navBack = false;

/** Одоогийн түүхийн бичлэг нь шургуулгынх мөн үү. */
const navIsDrawer = () => !!(history.state && history.state.drawer);

function navTo(name) {
  if (navBack) return;                       // `popstate`-аас ирсэн — дахин бичихгүй
  try {
    /* Шургуулгаас шилжиж байвал түүний бичлэгийг СОЛИНО, шинийг
       нэмэхгүй — эс тэгвэл буцахад шургуулгын хий бичлэг дээр
       тулж, хоёр удаа дарах шаардлагатай болно. */
    const st = { scr: name };
    if (navIsDrawer()) history.replaceState(st, '');
    else history.pushState(st, '');
  } catch (e) { /* түүх ажиллахгүй орчин — апп хэвийн үлдэнэ */ }
}

addEventListener('popstate', e => {
  const st = e.state || { scr: 'home' };
  /* Шургуулга нээлттэй бол эхлээд түүнийг хаана. */
  if (!st.drawer && drawerOpen()) closeDrawer();
  const want = st.scr || 'home';
  if (want === screen) return;
  navBack = true;
  try { go(want); } finally { navBack = false; }
});

function go(name) {
  // JLPT түр унтраалттай үед тэр дэлгэц рүү орохыг хаана (гүн холбоос,
  // хуучин кэштэй хуудаснаас ирсэн дарлага ч байж болно).
  if (name === 'jlpt' && !JLPT_ON) name = 'home';
  // Явц нь БҮХ санг харуулдаг тул нээхэд бусад номыг татна. Эхлээд
  // байгаагаараа зурж, ирсэн хойно нь дахин зурна — хоосон дэлгэц харагдахгүй.
  if (name === 'stats') { refreshStats(); loadAllBooks().then(refreshStats); }
  if (name === 'profile') { refreshSync(); refreshUsage(); refreshMe(); }
  if (name === 'klass') refreshKlass();
  if (name === 'feedback') refreshFb();
  if (name === 'exam') examSetup();
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
  // `pool`-ыг ЭНД ХӨДӨЛГӨХГҮЙ (docs/STATE.md §2.27). `finish()` нь
  // `refreshHome()` дуудаж дуусдаг тул урьд нь ханзны дасгал дууссаны
  // дараа `pool` нь ҮГ болчихдог байв — «Алдаагаа давтах» дарахад
  // `simKey()` нь үг дээр `it.on[0]` уншиж УНАДАГ байсан.
  //
  // Нүүрэн дэх тоо нь ЗӨВХӨН харуулах зориулалттай тул тусад нь
  // тооцно. Мөн `wordSrc`-оос ХАМААРАХГҮЙ: N5 ороод гарсны дараа
  // Irodori-гийн тоо N5-ийнхыг (эсвэл 0-ыг) харуулдаг байв.
  const bookPool = ALL.filter(
    it => curLessons().includes(it.lesson) && (settings.ref || !it.ref));
  $('due-n').textContent = bookPool.filter(isDue).length;
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
  if (vh) vh.textContent = bookPool.length
    ? 'Сонгосон ' + bookPool.length + ' үгээс асууна.'
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

/* `j` = шошго нь япон бичиг үү. Өмнө нь сериф фонт ашигладаг байсан тул
   энэ ялгаа чухал байв (кирилл тэр фонтод сунжирдаг). Одоо бүх бичиг
   Noto Sans JP; тугийг үлдээсэн нь хэмжээ/зайг тааруулахад хэрэгтэй. */
const STAT_TABS = [
  { k: 'starter', n: '入門', j: 1 }, { k: 'el1', n: '初級1', j: 1 },
  { k: 'el2', n: '初級2', j: 1 }, { k: 'n5', n: 'N5 үг' },
  { k: 'kanji', n: 'Ханз' }, { k: 'kana', n: 'Кана' },
];
const statName = t => '<span class="' + (t.j ? 'jpd' : '') + '">' + esc(t.n) + '</span>';
/* `statTab` хэрэггүй болов: таб байхгүй, ном бүр нэг дор гарна. */               // анх нээхэд идэвхтэй номоор эхлэнэ

/** Явцын дэлгэцэд БҮХ сан хэрэгтэй — апп эхлэхэд зөвхөн идэвхтэй
 *  номоо татдаг (эхний ачаалал хөнгөн байх ёстой). Ганц удаа татаад
 *  кэшлэнэ. Алдвал тухайн ном хоосон байна — дэлгэц эвдэрч болохгүй. */
function loadAllBooks() {
  // Амжилтгүй бол кэшлэхгүй: `[]` нь truthy тул дараа нь «татсан» мэт
  // харагдаад ДАХИН ОРОЛДОХГҮЙ болдог байв (сүлжээ сэргэсэн ч хоосон).
  const jobs = ['starter', 'el1', 'el2']
    .filter(b => !bookCache[b])
    .map(b => fetchBook(b));
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
/** Явцын нэг мөр.
 *
 *  `ofSeen` = үнэлэх суурь нь ҮЗСЭН зүйл мөн үү. ХЭСГИЙН түвшинд тийм:
 *  «1036-аас 9» гэсэн тоо нь эхлэгчид айдас төрүүлнэ, харин «үзсэн
 *  24-өөс 9 нь тогтсон» нь өөрийнх нь хийсэн ажлыг хэмжинэ.
 *  ХИЧЭЭЛИЙН түвшинд нийт тоо нь жижиг бөгөөд хүрэх боломжтой зорилт
 *  тул тэндээ үлдэнэ (9/50). */
function statBar(label, items, html, ofSeen) {
  const seen = items.filter(pSeen).length, done = items.filter(pDone).length;
  const base = ofSeen ? seen : items.length;
  const w = x => (100 * x / Math.max(base, 1)) + '%';
  return '<div class="l"><span>' + (html || esc(label)) + '</span><span class="track">'
    + '<span class="seen" style="width:' + w(seen) + '"></span>'
    + '<span class="fill" style="width:' + w(done) + '"></span></span>'
    + '<span class="num">' + done + '/' + base + '</span></div>';
}

/** Сонгосон хэсгийн дотоод задаргаа: үг нь хичээлээр,
 *  ханз нь JLPT түвшнээр, кана нь бүлгээр. */
function statDetail(k) {
  const items = statSet(k);
  if (!items.length) return '<p class="hint">Ачаалж байна…</p>';
  if (k === 'kana') {
    const G = [['gojuon', '五十音'], ['dakuten', '濁·半濁'], ['yoon', '拗音']];
    const rows = G.map(g => items.filter(i => i.group === g[0]))
      .map((set, i) => [set, G[i][1]])
      .filter(([set]) => set.some(pSeen))
      .map(([set, nm]) => statBar(nm, set, '<span class="jpd">' + nm + '</span>'));
    return rows.length ? rows.join('')
      : '<p class="hint">Энэ хэсгээс хараахан эхлээгүй байна.</p>';
  }
  if (k === 'kanji') {
    const rows = [5, 4, 3, 2].map(n => [items.filter(i => i.n === n), 'N' + n])
      .filter(([set]) => set.some(pSeen))
      .map(([set, nm]) => statBar(nm, set));
    const rest = items.filter(i => !i.n);
    // JLPT жагсаалтад үгүй харин хичээлд гардаг ханз — түүнийг бас харуулна.
    if (rest.some(pSeen)) rows.push(statBar('бусад', rest));
    return rows.length ? rows.join('')
      : '<p class="hint">Энэ хэсгээс хараахан эхлээгүй байна.</p>';
  }
  /* ЗӨВХӨН орж үзсэн хичээл. 18 хичээлийн 17 нь «0/86» гэж
     жагсаагдвал явцын дэлгэц нь ажлын жагсаалт болно, явцын биш. */
  const rows = [...new Set(items.map(i => i.lesson))].sort((a, b) => a - b)
    .map(l => items.filter(i => i.lesson === l))
    .filter(g => g.some(pSeen))
    .map(g => statBar('L' + g[0].lesson, g));
  return rows.length ? rows.join('')
    : '<p class="hint">Энэ хэсгээс хараахан хичээл эхлээгүй байна.</p>';
}

/* Хэрэглэгч ЭХЭЛСЭН хэсэг мөн үү (дор хаяж нэг зүйл үзсэн). */
const statStarted = k => statSet(k).some(pSeen);

function refreshStats() {
  const seen = Object.keys(progress).length;
  const learned = Object.values(progress).filter(p => p.b >= 3).length;
  const tot = Object.values(progress).reduce((a, p) => a + p.n, 0);
  const cor = Object.values(progress).reduce((a, p) => a + p.c, 0);
  /* «НИЙТ 6756 зүйл» гэсэн тоог ЗОРИУД харуулахгүй — эхлэгчид тэр нь
     айдас төрүүлнэ. Хүн өөрийнхөө хийсэн ажлыг хармаар байдаг,
     хийгээгүйгийнхээ уулыг биш. */
  $('stat-sum').innerHTML =
    '<div><b>' + seen + '</b><span>үзсэн</span></div>' +
    '<div><b>' + learned + '</b><span>тогтсон</span></div>' +
    '<div><b>' + (tot ? Math.round(100 * cor / tot) : 0) + '%</b><span>зөв хариулт</span></div>';

  /* НОМ тус бүрийг гарчиг болгож, доор нь ТҮҮНИЙ хичээлүүдийг
     эгнүүлнэ. Өмнө нь ном ба хичээл хоёр тусдаа хэсэгт байсан тул
     «аль хичээлийн үгийг сурч байна» гэдгээ харахын тулд таб дарж
     хайх шаардлагатай байв.

     ЗӨВХӨН эхэлсэн ном, эхэлсэн хичээл гарна — хөндөөгүйг жагсаах нь
     урам хугалахаас өөр ажил хийхгүй. */
  const live = STAT_TABS.filter(t => statStarted(t.k));
  const box = $('stat-tree');
  if (!live.length) {
    box.className = '';
    box.innerHTML = '<p class="hint">Эхний дасгалаа хийхэд энд явц чинь гарч ирнэ.</p>';
  } else {
    box.className = 'sttree';
    box.innerHTML = live.map(t => {
      const set = statSet(t.k);
      const done = set.filter(pDone).length;
      /* Номын ТҮВШНИЙ зураас хасагдсан: гарчиг дээр «N тогтсон» аль
         хэдийн байгаа тул тэр нь давхардал, мөн хичээлийн зураасаас
         өөр суурьтай (үзсэн vs бүтэн) учир гурван тоо будлиан
         төрүүлж байв. Одоо гарчиг + хичээлүүд л үлдэнэ. */
      const seenN = set.filter(pSeen).length;
      return '<section>'
        + '<h3>' + statName(t)
        + '<small>' + done + ' тогтсон · ' + seenN + ' үзсэн</small></h3>'
        + '<div class="statles les">' + statDetail(t.k) + '</div>'
        + '</section>';
    }).join('');
  }

  /* Юу ч эхлээгүй бол тайлбарыг нуух — хоосон дэлгэц дээр дэмий. */
  for (const id of ['st-h-sec', 'st-help1']) {
    const el = $(id);
    if (el) el.hidden = !live.length;
  }
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
    // Хоёр номыг хурдан дараалан дарвал эхнийх нь СҮҮЛД хариулж,
    // сонголтыг эргүүлж татдаг байв. Зөвхөн сүүлийн хүсэлт хүчинтэй.
    const req = ++bookReq;
    fetchBook(nb).then(items => {
      if (req !== bookReq) return;                // хуучирсан хариу
      if (!items) { alert('Энэ номын үгсийг ачаалж чадсангүй.'); return; }
      ALL = items; READ_MAP = null; settings.book = nb; wordSrc = 'book';
      save(KEY_S, settings); refreshHome();
    });
  });
document.querySelectorAll('#kana-groups button').forEach(b =>
  b.onclick = () => {
    const g = b.dataset.g, i = settings.kgroups.indexOf(g);
    i < 0 ? settings.kgroups.push(g) : settings.kgroups.splice(i, 1);
    save(KEY_S, settings); refreshHome();
  });
$('btn-review').onclick = () => startSession('choice', true);
/* ── Хажуугийн шургуулга ───────────────────────────────────────────
 *
 * ХОЁР алхамтай нээлт/хаалт. `hidden` нь `display:none` тул түүнийг
 * авмагц шилжилт ажиллахгүй — элемент шууд эцсийн байрлалдаа гарч
 * ирнэ. Тиймээс: `hidden`-ийг авч, ДАРААГИЙН КАДРТ `open` анги нэмнэ.
 * Хаахдаа эсрэгээр: `open`-ыг авч, шилжилт дуусмагц `hidden`.
 */
let drawerT = null;

function openDrawer() {
  clearTimeout(drawerT);
  /* Түүхэнд бичлэг үлдээнэ — буцах товч эхлээд шургуулгыг хаана. */
  try { history.pushState({ scr: screen, drawer: 1 }, ''); } catch (e) {}
  $('scrim').hidden = false;
  $('menu').hidden = false;
  requestAnimationFrame(() => {
    $('scrim').classList.add('open');
    $('menu').classList.add('open');
  });
}

/** Шургуулгыг ШУУД хаана (шилжилтгүй). `show()` нь ачаалалтын үед ч
 *  дуудагддаг тул тэнд таймер ажиллуулах шаардлагагүй. */
function shutDrawer() {
  clearTimeout(drawerT);
  for (const id of ['scrim', 'menu']) {
    $(id).hidden = true;
    $(id).classList.remove('open');
  }
}

function closeDrawer() {
  clearTimeout(drawerT);
  $('scrim').classList.remove('open');
  $('menu').classList.remove('open');
  /* Шилжилт дуусахыг хүлээнэ. `transitionend` дээр найдвал хөдөлгөөн
     унтраалттай үед хэзээ ч ирэхгүй тул таймер найдвартай. */
  drawerT = setTimeout(shutDrawer, 240);
}

const drawerOpen = () => !$('menu').hidden;

$('btn-menu').onclick = () => {
  if (screen === 'study') { go('home'); return; }     // дасгал дундаас гарах
  drawerOpen() ? closeDrawer() : openDrawer();
};
/** Гараар хаах: шургуулгын түүхийн бичлэг дээр байвал ТҮҮХЭЭР буцна
 *  (`popstate` нь хаалтыг хийнэ), эс тэгвэл шууд хаана. Ингэснээр
 *  хий бичлэг үлдэхгүй. */
function dismissDrawer() {
  if (navIsDrawer()) { try { history.back(); return; } catch (e) {} }
  closeDrawer();
}
$('menu-close').onclick = dismissDrawer;

/** Тохиргооны товчны бичиг. */
function refreshSfx() {
  const b = $('btn-sfx');
  /* Товч нь одоо УНТРААЛГА: төлөвийг `aria-checked` хэлнэ. CSS нь
     түүнээс л гүйлгэдэг тул JS-д өөр ажил байхгүй. */
  if (b) b.setAttribute('aria-checked', settings.sfx ? 'true' : 'false');
}
if ($('btn-sfx')) {
  $('btn-sfx').onclick = () => {
    settings.sfx = settings.sfx ? 0 : 1;
    save(KEY_S, settings);
    refreshSfx();
    if (settings.sfx) sfx(true);           // асаахад нэг удаа сонсгоно
  };
  refreshSfx();
}
$('scrim').onclick = dismissDrawer;
addEventListener('keydown',
  e => { if (e.key === 'Escape' && drawerOpen()) dismissDrawer(); });
/* Толгойн мөрөнд профайлын товч БАЙХГҮЙ — «Тохиргоо» нь хажуугийн
   шургуулгад байдаг тул давхардал байв. */
/* Гарчиг дархад нүүр рүү. Толгойн мөр бүх дэлгэц дээр байдаг тул энэ нь
   хамгийн богино зам — цэс нээх шаардлагагүй. */
$('btn-home').onclick = () => go('home');

/* ── Цайвар / бараан ───────────────────────────────────────────────
 *
 * ГУРВАН төлөв: систем → цайвар → бараан → систем. Хоёр төлөвтэй
 * болговол «системээ дага» гэдэг нь алдагдана — утас орой автоматаар
 * бараан болдог хүнд тэр нь чухал.
 *
 * Хадгалсан утгыг `index.html`-ийн ЭРТ скрипт тавьдаг (анивчихаас
 * сэргийлнэ); энд зөвхөн СОЛИХ ба дүрс зурах ажил үлдэнэ.
 */
const KEY_SC = 'irodori.scheme.v1';
const SCHEMES = ['', 'light', 'dark'];          // '' = систем
const SCHEME_LABEL = { '': 'Өнгө: системийн', light: 'Өнгө: цайвар', dark: 'Өнгө: бараан' };
/* Дүрс: хагас дүүргэсэн дугуй (систем) · нар (цайвар) · сар (бараан). */
const SCHEME_ICON = {
  '': '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"'
    + ' stroke-width="2"><circle cx="12" cy="12" r="8"/>'
    + '<path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor" stroke="none"/></svg>',
  light: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"'
    + ' stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/>'
    + '<path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2'
    + 'M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"/></svg>',
  dark: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"'
    + ' stroke-width="2" stroke-linejoin="round">'
    + '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7.5 7.5 0 1 0 10.5 10.5z"/></svg>',
};

function curScheme() {
  const v = load(KEY_SC, '');
  return SCHEMES.includes(v) ? v : '';
}

/** Хөтчийн хаягийн мөрний өнгө. `index.html`-д хоёр мөр (цайвар/бараан)
 *  байгаа — систем горимд тэдгээр нь өөрсдөө таарна. Гараар дарсан үед
 *  ХОЁУЛАНГ нь бодит өнгөөр дүүргэнэ, эс тэгвэл хөтөч системийнхийг
 *  сонгож авна. */
function paintThemeColor(v) {
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  if (metas.length < 2) return;
  const dark = v === 'dark' || (!v && matchesDark());
  metas.forEach(m => {
    const own = m.media && m.media.indexOf('dark') >= 0 ? '#0b1540' : '#a9d0fb';
    m.content = v ? (dark ? '#0b1540' : '#a9d0fb') : own;
  });
}

function matchesDark() {
  try { return matchMedia('(prefers-color-scheme: dark)').matches; }
  catch (e) { return false; }
}

function applyScheme(v) {
  const r = document.documentElement;
  if (v) r.setAttribute('data-theme', v); else r.removeAttribute('data-theme');
  save(KEY_SC, v);
  const b = $('btn-scheme');
  if (b) { b.innerHTML = SCHEME_ICON[v]; b.title = SCHEME_LABEL[v]; }
  paintThemeColor(v);
}

if ($('btn-scheme')) {
  $('btn-scheme').onclick = () => {
    const i = SCHEMES.indexOf(curScheme());
    applyScheme(SCHEMES[(i + 1) % SCHEMES.length]);
  };
}
applyScheme(curScheme());
/* Систем горимд байхад хэрэглэгч утсаа бараан болговол хаягийн мөрний
   өнгө ч дагах ёстой — CSS нь өөрөө дагадаг, мета нь дагадаггүй. */
try {
  matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => { if (!curScheme()) paintThemeColor(''); });
} catch (e) { /* хуучин хөтөч — мета нь системийн мөрөөрөө ажиллана */ }

$('app-ver').textContent = VERSION;
/* Кэшийг тойрч ачаалах: hash биш ХАЙЛТЫН мөрийг өөрчилнө — hash солиход
   браузер шинээр татдаггүй. reload(true) нь аль эрт хүчингүй болсон. */
$('btn-reload').onclick = () => {
  location.replace(location.pathname + '?r=' + Date.now());
};
/* Шургуулгад шилжихгүй товч ч бий (хаах) — `[data-go]`-оор шүүнэ. */
document.querySelectorAll('#menu button[data-go], .bigcard').forEach(b =>
  b.onclick = () => go(b.dataset.go));
/* «Гадуур дарвал хаагдана» ажлыг одоо `#scrim` хариуцна — бүтэн
   дэлгэцийг бүрхдэг тул баримт дээрх нэмэлт сонсогч хэрэггүй. */
$('sel-all').onclick = () => { setLessons([...new Set(ALL.map(i => i.lesson))]); refreshHome(); };
$('sel-none').onclick = () => { setLessons([]); refreshHome(); };
$('inc-ref').onchange = e => { settings.ref = e.target.checked; save(KEY_S, settings); refreshHome(); };
document.querySelectorAll('#seg-script button').forEach(b =>
  b.onclick = () => {
    settings.script = b.dataset.s;
    save(KEY_S, settings);
    refreshHome();
    /* Шалгалт нь мөн үүнийг дагадаг тул түүний дэлгэцийг ч шинэчилнэ.
       Дундуур нь сольсон бол одоогийн асуултыг тэр дор нь дахин зурна. */
    refreshExamSeg();
    if (screen === 'exam' && exQs.length) renderExam();
  });
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

/* «Ярих» горим — микрофоны товч. Дарахад таниж эхэлнэ; таньсан текстийг
   ЯГ ХАРУУЛаад уншлагаар нь шалгана. Таних олон хувилбар өгдөг тул алийг
   нь ч зөв бол хүлээнэ. */
/** Микрофоны товчийг хүлээлтийн байдалд буцаана. Таниулт үр дүнгүй
 *  дуусахад ч (чимээгүй, хэрэглэгч зогсоосон) товч «сонсож байна» гэж
 *  гацахгүй байх ёстой. */
function micIdle(hint) {
  const b = $('mic-btn');
  if (!b) return;
  b.classList.remove('rec');
  b.textContent = '🎤 Хэлэх';
  if (hint != null) $('mic-hint').textContent = hint;
}

$('mic-btn').onclick = () => {
  // Сонсож байхад дарвал ЦУЦАЛНА (товч гацахгүй).
  if (recognizing) { stopRecog(); micIdle('Цуцаллаа. Дахин оролдож болно.'); return; }
  if (answered) return;
  // Таниулт үүлэн дээр хийгддэг тул офлайн үед ажиллахгүй — шууд хэлнэ.
  if (!navigator.onLine) {
    $('mic-hint').textContent = 'Ярих горим интернэт холболт шаардана '
      + '(таниулт браузерын үүлэн үйлчилгээгээр хийгддэг). Офлайн үед '
      + '«Гараар бичих» горимыг ашиглана уу.';
    return;
  }
  const btn = $('mic-btn');
  btn.classList.add('rec'); btn.textContent = '● Сонсож байна…';
  $('mic-hint').textContent = 'Одоо хэлээрэй…';
  $('mic-text').textContent = '';
  // Эхлэх агшны КАРТЫГ барьж авна. Таниулт async тул үр дүн хожуу ирэхэд
  // хэрэглэгч аль хэдийн дараагийн карт дээр очсон байж болно — тэр үед
  // хуучин хариулт ШИНЭ асуултыг хариулчихаж болзошгүй.
  const askedFor = cur;
  startRecog(
    interim => { $('mic-text').textContent = interim; },
    alts => {
      micIdle();
      if (answered || cur !== askedFor) return;   // карт солигдсон бол үл тоох
      const heard = alts[0] || '';
      $('mic-text').textContent = heard || '(таниагүй)';
      const ok = alts.some(a => checkSpoken(a, askedFor));
      answered = true;
      resolve(ok);
    },
    err => {
      micIdle(err === 'not-allowed' || err === 'service-not-allowed'
        ? 'Микрофон зөвшөөрөл өгөгдсөнгүй. Хаягийн зүүн талын 🔒-оос зөвшөөрнө үү.'
        : err === 'no-speech' ? 'Дуу сонсогдсонгүй — дахин оролдоно уу.'
        : err === 'unsupported' ? 'Энэ браузер микрофоны таниулт дэмжихгүй (Chrome/Edge ашиглана уу).'
        : 'Таних боломжгүй байна — дахин оролдоно уу.');
    },
    () => { micIdle(); }        // үр дүнгүй дууссан ч товч гацахгүй
  );
};
$('mic-skip').onclick = () => {
  if (answered) return;
  stopRecog(); answered = true; resolve(false);
};
/* «Ярих» горим хэзээ боломжтой вэ:
 *   1. браузер таниулт дэмжих (Chrome/Edge; Firefox үгүй),
 *   2. ИНТЕРНЭТ байх — таниулт нь браузерын үүлэн үйлчилгээгээр хийгддэг.
 * Апп өөрөө офлайн ажилладаг (метронд давтах) тул офлайн үед энэ горимыг
 * ЧИМЭЭГҮЙ бүтэлгүйтүүлэхгүй, шууд идэвхгүй болгож шалтгааныг хэлнэ. */
function refreshSpeakAvail() {
  const sb = document.querySelector('[data-mode="speak"]');
  if (!sb) return;
  const off = !navigator.onLine;
  sb.disabled = !canListen || off;
  sb.title = !canListen ? 'Микрофоны таниулт зөвхөн Chrome/Edge дээр'
    : off ? 'Ярих горим интернэт холболт шаардана' : '';
}
refreshSpeakAvail();
addEventListener('online', refreshSpeakAvail);
addEventListener('offline', refreshSpeakAvail);
$('btn-next').onclick = nextCard;

$('btn-continue').onclick = () => {
  const L = settings.last; if (!L) return;
  if (L.deck === 'kana') { startKana(L.k); return; }
  if (L.deck === 'kanji') { startKanji(L.k, L.src); return; }
  // N5-ийг апп эхлэхэд татдаггүй тул дахин ачаалсны дараа энэ товч
  // «хичээл сонгоно уу» гэж буруу хэлдэг байв.
  ensureWords(L.src).then(() => startSession(L.m, false, L.src || 'book'));
};
$('fin-retry').onclick = () => {
  if (!missed.length) return;
  queue = shuffle(missed.slice());
  missed = []; done = okN = ngN = 0;
  // `pool`-ыг ДАХИН тогтооно: `finish()` → `refreshHome()` нь урьд нь
  // түүнийг үг болгодог байсан (одоо болихгүй ч, багц нь дасгалынхаа
  // сангаас гарах ёстой — сандруулагч эндээс сонгогдоно).
  if (deck === 'kana') pool = KANA.filter(i => settings.kgroups.includes(i.group));
  else if (deck === 'kanji') pool = kanjiPool((settings.last || {}).src || 'les');
  else rebuildPool();
  show('study'); renderCounters(queue.length); nextCard();
};
$('fin-again').onclick = () => {
  const L = settings.last || {};
  if (L.deck === 'kana') { startKana(L.k); return; }
  if (L.deck === 'kanji') { startKanji(L.k, L.src); return; }
  ensureWords(L.src).then(() => startSession(L.m || 'choice', false, L.src || 'book'));
};
$('fin-home').onclick = () => go('home');

/* ══════════════════════ 7b. Шалгалт ══════════════════════
 *
 * ХАРИЛЦААНЫ шалгалт: япон асуулт гарч, сурагч ХАРИУЛНА. Дараа нь
 * загвар хариултыг хараад ӨӨРӨӨ «чадсан/чадаагүй» гэж дүгнэнэ —
 * чөлөөт хариултыг автоматаар үнэлэх боломжгүй, багшийн аман шалгалт
 * ч яг ингэж явдаг.
 *
 * Хоёр төрөл:
 *   think — хариултаа бодоод (эсвэл дуугаар хэлээд) загвартай тулгана,
 *   speak — микрофоноор хариулж, таньсан текст ба ТҮЛХҮҮР БҮТЭЦ олдсон
 *           эсэхийг зөвлөмж болгон харуулна. Дүгнэлт нь хэвээр ӨӨРӨӨ —
 *           чөлөөт яриаг таних нь найдваргүй тул оноог түүнд даатгахгүй.
 *
 * Явцад (SRS) НӨЛӨӨЛӨХГҮЙ: шалгалт хэмжинэ, сургахгүй. `grade()` дуудахгүй.
 */
const KEY_EXN = 'irodori.examn.v1';
const KEY_EXM = 'irodori.exammode.v1';
let EXAM = null;                       // татсан сан (нэг удаа)
let exQs = [], exIdx = 0, exLog = [];
let exN = load(KEY_EXN, 15);
if (![10, 15, 20].includes(exN)) exN = 15;
/* Сонгосон ХИЧЭЭЛҮҮД. `null` = бүгд (анхдагч) — ингэснээр сан шинэ
   хичээлээр нэмэгдвэл тэр нь автоматаар орно. Хоосон массив = юу ч
   сонгоогүй (эхлүүлэх товч идэвхгүй). */
const KEY_EXL = 'irodori.examles.v1';

/* Шалгалтын ТҮҮХ — асуулт тутамд СҮҮЛИЙН хариулт:
     { "S01-01": [өдөр, чадсан 0/1, хичээл], … }
   Ангийн ДААЛГАВАР үүнээс тоологдоно (давхардалгүй асуулт — нэг асуултыг
   хоёр удаа хариулсан ч нэг). Урьд нь шалгалтын үр дүн хаана ч
   хадгалагддаггүй байв. Сервер ТООГ л буцаадаг — түүхий хариулт
   ангийнханд харагдахгүй (SUPABASE.sql «ДААЛГАВАР»). */
const KEY_EXH = 'irodori.examhist.v1';
function cleanExHist(v) {
  const out = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const k of Object.keys(v).slice(0, 200)) {
    const x = v[k];
    if (/^[A-Za-z0-9_-]{1,16}$/.test(k) && Array.isArray(x) && x.length === 3
        && x.every(Number.isInteger)) out[k] = [x[0], x[1] ? 1 : 0, x[2]];
  }
  return out;
}
let exHist = cleanExHist(load(KEY_EXH, {}));
let exLes = load(KEY_EXL, null);
if (exLes !== null && !(Array.isArray(exLes) && exLes.every(Number.isInteger))) exLes = null;
let exMode = load(KEY_EXM, 'think');
if (!['think', 'speak'].includes(exMode)) exMode = 'think';
/* Шалгалт нь өөрийн гэсэн бичгийн тохиргоогүй — апп даяарх
   `settings.script`-ийг дагана (профайл дэлгэцээс сонгоно). */
const exQ = q => (settings.script === 'kana' ? q.qKana : q.q) || q.q;
const exA = q => (settings.script === 'kana' ? q.modelKana : q.model) || q.model;

/** Асуулт/хариултыг элемент рүү бичнэ. `ruby` горимд <ruby><rt> босгоно.
 *
 *  DOM зангаар барина — `innerHTML` ХЭРЭГЛЭХГҮЙ. Ингэснээр эдгээр дөрвөн
 *  цэг нь `textContent`-ийн адил тарилтаас бүрэн хамгаалагдсан хэвээр
 *  үлдэнэ (docs/STATE.md §2.29). Уншлагын хос нь `build_exam.py`-д
 *  үүсч, тэндээ шалгагдсан. */
function exInto(el, q, which) {
  const pairs = q && (which === 'a' ? q.modelRuby : q.qRuby);
  const plain = which === 'a' ? exA(q) : exQ(q);
  if (settings.script !== 'ruby' || !pairs) {
    el.classList.remove('ruby');
    el.textContent = plain;
    return;
  }
  rubyDom(el, pairs);
}

/* ГҮЙЛТИЙН ТЭМДЭГ — docs/STATE.md §2.36. */
let exRun = 0, exTimer = null;

/** Шалгалтын дэлгэц рүү орвол ЭХЛЭЭД тохиргоо гарна (шууд эхлэхгүй). */
function examSetup() {
  exAbort();
  $('ex-setup').hidden = false;
  $('ex-run').hidden = true;
  $('ex-done').hidden = true;
  refreshExamSeg();
  renderExamTasks();
  // Кэш хуучирсан байж магадгүй (даалгавар шинээр өгөгдсөн) — шинэчилнэ.
  if (myClasses().length) loadClassList().then(renderExamTasks);
  // Чипэнд хичээл бүрийн асуултын тоо хэрэгтэй тул санг ЭНД татна.
  loadExam().then(renderExamLessons).catch(() => {
    const n = $('ex-les-note');
    if (n) n.textContent = 'Асуултыг ачаалж чадсангүй. Холболтоо шалгана уу.';
  });
}

const examLessonsAll = () => EXAM
  ? [...new Set((EXAM.items || []).map(q => q.lesson))].sort((a, b) => a - b) : [];
/** Сонгосон хичээлүүд — `null` бол бүгд. Санд байхгүй дугаарыг хасна. */
const examLessonsSel = () => {
  const all = examLessonsAll();
  return exLes === null ? all : exLes.filter(l => all.includes(l));
};
const examPool = () => {
  const sel = examLessonsSel();
  return ((EXAM && EXAM.items) || []).filter(q => sel.includes(q.lesson));
};

/** Миний ангиудын даалгавар — шалгалтын дэлгэцийн дээд талд. */
function renderExamTasks() {
  const box = $('ex-tasks');
  if (!box) return;
  const items = myClasses().map(id => ({ id: id, t: taskOf(id) })).filter(x => x.t);
  box.innerHTML = items.map(x => {
    const need = taskN(x.t), n = taskDoneLocal(x.t);
    return '<li class="ex-task"><div class="ex-task-body">' +
      '<p class="ex-task-label"><b>' + esc(className(x.id)) + '</b> · ' + esc(taskLabel(x.t)) + '</p>' +
      TASK_STATE(Math.min(n, need), need).replace('Хийгээгүй · ', '') + DUE_HTML(x.t) +
      '</div><button class="ghost sm ex-task-pick" type="button" data-class-id="' + escA(x.id) + '"' +
      ' aria-label="' + escA(className(x.id)) + ': Сонгох">Сонгох</button></li>';
  }).join('');
  box.hidden = !items.length;
  box.querySelectorAll('.ex-task-pick').forEach(b => b.onclick = () => {
    const t = taskOf(b.dataset.classId);
    if (!t) return;
    // Даалгаврын хичээлүүд ба асуултын тоо. 10/15/20-оос өөр бол 20.
    exN = [10, 15, 20].includes(taskN(t)) ? taskN(t) : 20;
    save(KEY_EXN, exN);
    refreshExamSeg();
    setExamLessons(t.lessons.map(x => x | 0));
  });
}

function setExamLessons(v) {
  // Бүгдийг сонгосон бол `null` болгож хадгална — шинэ хичээл нэмэгдэхэд
  // автоматаар орно.
  const all = examLessonsAll();
  exLes = (all.length && v.length === all.length) ? null : v.slice().sort((a, b) => a - b);
  save(KEY_EXL, exLes);
  renderExamLessons();
}

function renderExamLessons() {
  const box = $('ex-lessons');
  if (!box || !EXAM) return;
  const sel = examLessonsSel();
  box.innerHTML = '';
  for (const l of examLessonsAll()) {
    const n = EXAM.items.filter(q => q.lesson === l).length;
    const b = document.createElement('button');
    b.innerHTML = 'L' + l + '<small>' + n + '</small>';
    b.setAttribute('aria-pressed', sel.includes(l));
    b.onclick = () => {
      const cur = examLessonsSel(), i = cur.indexOf(l);
      i < 0 ? cur.push(l) : cur.splice(i, 1);
      setExamLessons(cur);
    };
    box.appendChild(b);
  }
  /* Сонгосон хичээлд асуулт цөөн бол (ж: L1 = 6) сонгосон тоогоор биш,
     БАЙГАА бүгдийг асууна — үүнийг ил хэлнэ. */
  const pool = examPool().length;
  const note = $('ex-les-note');
  if (note) note.textContent = !sel.length ? 'Хичээл сонгоно уу.'
    : sel.length + ' хичээл · ' + pool + ' асуулт'
      + (pool < exN ? ' — бүгдийг нь асууна' : '');
  $('btn-exam').disabled = !pool;
}

/** Шалгалтын гүйлтийг хүчингүй болгоно (гарах, дахин эхлэх). */
function exAbort() {
  exRun++;
  if (exTimer) { clearTimeout(exTimer); exTimer = null; }
  stopRecog();
}

/** Өлгөөтэй fetch товчийг мөнхөд идэвхгүй орхихоос сэргийлнэ. */
function withTimeout(p, ms) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('timeout')), ms);
    p.then(v => { clearTimeout(t); res(v); }, e => { clearTimeout(t); rej(e); });
  });
}

function loadExam() {
  if (EXAM) return Promise.resolve(EXAM);
  return fetch('data/exam-starter.json').then(r => {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(d => { EXAM = d; return d; });
}

/** «Амаар» төрөл боломжтой юу: браузер дэмжих БА интернэт байх. */
function examSpeakOK() { return canListen && navigator.onLine; }

function refreshExamSeg() {
  document.querySelectorAll('#seg-exam-n button').forEach(b =>
    b.setAttribute('aria-pressed', +b.dataset.n === exN));
  const sp = document.querySelector('#seg-exam-mode button[data-m="speak"]');
  if (sp) sp.disabled = !examSpeakOK();
  if (exMode === 'speak' && !examSpeakOK()) exMode = 'think';
  document.querySelectorAll('#seg-exam-mode button').forEach(b =>
    b.setAttribute('aria-pressed', b.dataset.m === exMode));
  const note = $('ex-mode-note');
  if (note) {
    note.textContent = !canListen
      ? 'Амаар хариулах нь зөвхөн Chrome/Edge дээр ажиллана.'
      : !navigator.onLine
      ? 'Амаар хариулахад интернэт шаардана (таниулт үүлэн дээр).'
      : exMode === 'speak'
      ? 'Асуулт бүрд микрофоноор хариулна. Дүгнэлтийг өөрөө өгнө.'
      : 'Хариултаа бодоод (эсвэл дуугаар хэлээд) загвартай тулгана.';
  }
}

function startExam() {
  const btn = $('btn-exam');
  exAbort();
  const run = exRun;
  btn.disabled = true;
  withTimeout(loadExam(), 15000).then(d => {
    btn.disabled = false;
    if (run !== exRun) return;
    const pool = examPool();
    if (!(d.items || []).length) { alert('Шалгалтын асуулт ачаалагдсангүй.'); return; }
    if (!pool.length) { renderExamLessons(); return; }   // хичээл сонгоогүй
    exQs = shuffle(pool).slice(0, Math.min(exN, pool.length));
    exIdx = 0; exLog = [];
    $('ex-setup').hidden = true;
    $('ex-run').hidden = false; $('ex-done').hidden = true;
    show('exam');
    renderExam();
  }).catch(() => {
    btn.disabled = false;
    if (run !== exRun) return;
    alert('Шалгалтын асуултыг ачаалж чадсангүй. Холболтоо шалгана уу.');
  });
}

function renderExam() {
  const q = exQs[exIdx];
  $('ex-pos').textContent = (exIdx + 1) + ' / ' + exQs.length;
  $('ex-bar').style.width = Math.round(100 * exIdx / exQs.length) + '%';
  $('ex-topic').textContent = 'L' + q.lesson + ' · ' + q.topic;
  exInto($('ex-q'), q, 'q');              // DOM зангаар — тарилтаас хамгаална
  $('ex-qmn').textContent = q.qMn;
  // Дуудлагыг ҮРГЭЛЖ ханзтай хэлбэрээс уншуулна — кана горимд байсан ч.
  // TTS нь ханзтай өгүүлбэрийг илүү зөв уншдаг: кана дан бол үгийн зааг
  // алдагдаж «なんといいますか» гэхийг буруу өргөлтөөр уншиж магадгүй.
  $('ex-say-q').hidden = !(canSpeak || hasAudio('EXQ-' + q.id));
  // ЯРИХ горимд асуултыг автоматаар уншина — багш асууж байгаа мэт.
  // «Бодож» горимд уншихгүй: тэнд хэрэглэгч нүдээрээ уншиж байгаа.
  // renderExam нь дарлагын гинжнээс дуудагддаг тул iOS ч зөвшөөрнө.
  if (exMode === 'speak') examSay(q, 'q');
  $('ex-model').hidden = true;
  $('ex-reveal').hidden = false;
  // Амаар төрөл
  const sp = exMode === 'speak';
  $('ex-speak').hidden = !sp;
  if (sp) {
    stopRecog();
    $('ex-mic').classList.remove('rec');
    $('ex-mic').textContent = '🎤 Хариулах';
    $('ex-mic-text').textContent = '';
    $('ex-mic-hint').textContent = 'Товчийг дараад япон хэлээр хариулаарай.';
  }
  window.scrollTo(0, 0);
}

/** Загвар хариултыг харуулна. Амаар төрөлд таниулт зогсоно. */
function examReveal() {
  const q = exQs[exIdx];
  stopRecog();
  $('ex-mic') && $('ex-mic').classList.remove('rec');
  exInto($('ex-model-jp'), q, 'a');
  $('ex-say-a').hidden = !(canSpeak || hasAudio('EXA-' + q.id));
  $('ex-model-mn').textContent = q.modelMn;
  $('ex-key').textContent = q.key ? 'Түлхүүр бүтэц: ' + q.key : '';
  $('ex-reveal').hidden = true;
  $('ex-model').hidden = false;
}

/** Сурагчийн өөрийн дүгнэлт. */
function examMark(ok) {
  /* Хойшлуулсан таймер ГҮЙЖ байвал энэ даралтыг ҮЛ ТООНО. 160мс дотор
     хоёр удаа дарвал нэг асуулт хоёр удаа бүртгэгдэж, индекс хоёр
     ахиад ДАРААГИЙН асуулт хариулагдалгүй алгасагддаг байв (браузерт
     баталсан: exIdx 0 → 2, exLog 0 → 2). */
  if (exTimer) return;
  sfx(ok);
  const q = exQs[exIdx];
  exLog.push({ q: q, ok: ok });
  exHist[q.id] = [today(), ok ? 1 : 0, q.lesson | 0];
  save(KEY_EXH, exHist);
  const run = exRun;
  exTimer = setTimeout(() => {
    exTimer = null;
    if (run !== exRun) return;
    exIdx++;
    if (exIdx >= exQs.length) finishExam(); else renderExam();
  }, 160);
}

function finishExam() {
  // Даалгавар хийсэн бол анги шууд харах ёстой — 2 минутын хязгааргүй.
  memberSync(true);
  const good = exLog.filter(x => x.ok).length;
  const pct = exLog.length ? Math.round(100 * good / exLog.length) : 0;
  $('ex-pct').textContent = pct + '%';
  $('ex-sum').textContent = 'Чадсан ' + good + '   ·   Чадаагүй '
    + (exLog.length - good) + '   (' + exLog.length + ' асуулт)';
  $('ex-verdict').textContent = pct >= 90 ? 'Маш сайн — асуултад чөлөөтэй хариулж байна.'
    : pct >= 70 ? 'Сайн. Чадаагүй хэдийгээ давтвал бүрэн болно.'
    : pct >= 50 ? 'Дунд. Тэдгээр хичээлийн яриаг дахин үзэх хэрэгтэй.'
    : 'Дахин давтах шаардлагатай.';

  const wrong = exLog.filter(x => !x.ok);
  $('ex-wrong-h').hidden = !wrong.length;
  const box = $('ex-wrong');
  box.innerHTML = '';
  for (const w of wrong) {
    // DOM-оор угсарна (innerHTML биш).
    const d = document.createElement('div');
    d.className = 'ex-w';
    const t = document.createElement('div');
    t.className = 'ex-wq';
    t.textContent = 'L' + w.q.lesson + ' · ' + w.q.topic;
    const qq = document.createElement('div');
    qq.className = 'ex-bad jp';
    exInto(qq, w.q, 'q');
    const qm = document.createElement('div');
    qm.className = 'ex-wq';
    qm.textContent = w.q.qMn;
    const a = document.createElement('div');
    a.className = 'ex-good jp';
    exInto(a, w.q, 'a');
    const am = document.createElement('div');
    am.className = 'ex-wq';
    am.textContent = w.q.modelMn + (w.q.key ? '  ·  ' + w.q.key : '');
    d.appendChild(t); d.appendChild(qq); d.appendChild(qm);
    d.appendChild(a); d.appendChild(am);
    box.appendChild(d);
  }
  $('ex-run').hidden = true;
  $('ex-done').hidden = false;
  window.scrollTo(0, 0);
}

/* ── Амаар хариулах: микрофон ── */
$('ex-mic').onclick = () => {
  const b = $('ex-mic');
  if (recognizing) { stopRecog(); b.classList.remove('rec'); b.textContent = '🎤 Хариулах'; return; }
  if (!examSpeakOK()) {
    $('ex-mic-hint').textContent = canListen
      ? 'Интернэт холболт шаардана.'
      : 'Энэ браузер микрофоны таниулт дэмжихгүй (Chrome/Edge).';
    return;
  }
  const q = exQs[exIdx];
  // TTS ярьж байвал ТАСАЛНА — эс тэгвэл микрофон өөрийн уншсан асуултыг
  // сонсож, хэрэглэгчийн хариулт мэт таних вий.
  if (canSpeak && (speechSynthesis.speaking || speechSynthesis.pending)) {
    speechSynthesis.cancel();
  }
  if (player && !player.paused) { try { player.pause(); } catch (e) { /* байхгүй */ } }
  b.classList.add('rec'); b.textContent = '● Сонсож байна…';
  $('ex-mic-hint').textContent = 'Одоо хариулаарай…';
  $('ex-mic-text').textContent = '';
  startRecog(
    interim => { $('ex-mic-text').textContent = interim; },
    alts => {
      b.classList.remove('rec'); b.textContent = '🎤 Хариулах';
      if (exQs[exIdx] !== q) return;          // асуулт солигдсон бол үл тоох
      const heard = alts[0] || '';
      $('ex-mic-text').textContent = heard || '(таниагүй)';
      // ЗӨВЛӨМЖ: түлхүүр бүтэц сонсогдов уу. Оноо энэнд даатгахгүй —
      // чөлөөт яриаг таних нь найдваргүй.
      const core = (q.key || '').replace(/[〜～]/g, '');
      const hit = core && alts.some(a => normKana(a).includes(normKana(core)));
      $('ex-mic-hint').textContent = !heard
        ? 'Сонсогдсонгүй — дахин оролдоно уу.'
        : hit ? '✓ «' + q.key + '» бүтэц сонсогдлоо.'
        : 'Загвар хариултыг харж өөрөө дүгнээрэй.';
    },
    err => {
      b.classList.remove('rec'); b.textContent = '🎤 Хариулах';
      $('ex-mic-hint').textContent = err === 'not-allowed' || err === 'service-not-allowed'
        ? 'Микрофон зөвшөөрөл өгөгдсөнгүй.'
        : err === 'no-speech' ? 'Дуу сонсогдсонгүй — дахин оролдоно уу.'
        : 'Таних боломжгүй байна — дахин оролдоно уу.';
    },
    () => { b.classList.remove('rec'); b.textContent = '🎤 Хариулах'; }
  );
};

document.querySelectorAll('#seg-exam-n button').forEach(b =>
  b.onclick = () => { exN = +b.dataset.n; save(KEY_EXN, exN); refreshExamSeg(); renderExamLessons(); });
$('ex-all').onclick = () => setExamLessons(examLessonsAll());
$('ex-none').onclick = () => setExamLessons([]);
document.querySelectorAll('#seg-exam-mode button').forEach(b =>
  b.onclick = () => { exMode = b.dataset.m; save(KEY_EXM, exMode); refreshExamSeg(); });
$('btn-exam').onclick = startExam;
/** Шалгалтын дуу: VOICEVOX-ийн УРЬДЧИЛАН бэлдсэн бичлэгийг тоглуулна.
 *  Браузерын TTS нь төхөөрөмж бүрд өөр хоолой, өөр өргөлттэй тул жигд
 *  бус сонсогддог. Бичлэг олдохгүй бол л TTS рүү ухарна. */
function examSay(q, which) {
  if (!q) return;
  const id = (which === 'a' ? 'EXA-' : 'EXQ-') + q.id;
  const text = which === 'a' ? q.model : q.q;
  if (playFile(id, () => speak(text))) return;
  speak(text);
}
$('ex-say-q').onclick = () => examSay(exQs[exIdx], 'q');
$('ex-say-a').onclick = () => examSay(exQs[exIdx], 'a');
$('ex-reveal').onclick = examReveal;
$('ex-yes').onclick = () => examMark(true);
$('ex-no').onclick = () => examMark(false);
$('ex-again').onclick = () => examSetup();
$('ex-home').onclick = () => go('home');
$('ex-quit').onclick = () => { if (confirm('Шалгалтыг зогсоох уу?')) examSetup(); };
addEventListener('online', refreshExamSeg);
addEventListener('offline', refreshExamSeg);
refreshExamSeg();
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

$('btn-reset').onclick = async () => {
  const st = $('reset-state');
  const say = t => { if (st) st.textContent = t; };
  if (!confirm('Бүх явцыг устгах уу? Буцаах боломжгүй.')) return;

  /* Явц нь ГУРВАН хадгалалтад тархсан — гурвуулангийг цэвэрлэнэ.
     Урьд нь зөвхөн `progress` цэвэрлэгддэг байсан тул нүүрэн дээрх
     «Өнөөдрийн зорилт 21/20» ба «дараалсан өдөр» хэвээр үлдэж,
     хэрэглэгч устгаагүй гэж ойлгодог байв. */
  progress = {};
  progGen++;                            // нислэгт байгаа синкийг хүчингүй болгоно
  save(KEY_P, progress);
  days = { last: -1, streak: 0, n: 0, ids: [] };
  save(KEY_D, days);
  exHist = {};                          // шалгалтын түүх (даалгавар) ч
  save(KEY_EXH, exHist);
  delete settings.last;                 // «Үргэлжлүүлэх» товч алга болно
  save(KEY_S, settings);
  refreshStats();
  refreshHome();
  // Анги ч ТЭГ тоог харах ёстой — эс тэгвэл жагсаалтад хуучин тоо үлдэнэ.
  memberSync(true);

  /* СИНК нь устгасныг БУЦААЖ ТАТНА: `syncNow()` нь локал ба үүлний
     өгөгдлийг уусгадаг тул хоосон локал + бүтэн үүл = бүгд буцна.
     `put_progress` нь сервер дээр ч уусгадаг тул хоосон түлхэх нь
     цэвэрлэхгүй. Тиймээс үүлний хуулбарыг ТУСАД НЬ устгана. */
  const WHAT = 'Явц, өнөөдрийн тоо, дараалсан өдөр — бүгд устлаа.';
  if (!syncOn || !syncCode) { say(WHAT); return; }
  say('Үүлний хуулбарыг устгаж байна…');
  try {
    await rpc('wipe_progress', { p_code: syncCode });
    say(WHAT + ' Үүлний хуулбар ч устлаа.');
  } catch (e) {
    /* Сервер дээр `wipe_progress` хараахан байхгүй (хуучин SUPABASE.sql).
       Синкийг салгаснаар үүлний хуулбар буцаж ирэхгүй болно. */
    syncCode = null;
    save(KEY_C, syncCode);
    refreshSync();
    say(WHAT + ' Үүлний хуулбарыг устгаж чадсангүй тул синкийг '
      + 'САЛГАЛАА — эс тэгвэл явц буцаж ирэх байсан. Дахин холбохын '
      + 'өмнө SUPABASE.sql-ийн шинэ хэсгийг ажиллуулна уу.');
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
  syncIdentityChanged();
};
$('btn-sync-link').onclick = () => {
  const c = (prompt('Нөгөө төхөөрөмж дээрх кодоо оруулна уу:') || '').trim().toLowerCase();
  if (!c) return;
  syncCode = c; save(KEY_C, syncCode); refreshSync();
  syncNow().then(() => { refreshStats(); refreshHome(); });
  syncIdentityChanged();
};
$('btn-sync-now').onclick = () => syncNow().then(() => { refreshStats(); refreshHome(); });
$('btn-sync-off').onclick = () => {
  if (!confirm('Энэ төхөөрөмжийг салгах уу? Явц энд үлдэнэ, зөвхөн нийлүүлэлт зогсоно.')) return;
  syncCode = null; save(KEY_C, null); refreshSync(); syncSay('салгалаа');
  syncIdentityChanged();
};

$('btn-import').onclick = () => $('file-import').click();
$('file-import').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  f.text().then(t => {
    const d = JSON.parse(t);
    // Файл нь хэрэглэгчийн гараас ирдэг — төрөл нь ямар ч байж болно.
    if (d.progress) { progress = cleanProgress(d.progress); saveProgress(); }
    if (d.settings) { settings = cleanSettings(d.settings); save(KEY_S, settings); }
    // Тохиргоо нь 初級1 гэж хэлж байхад `ALL` нь 入門 хэвээр үлдэж,
    // харуулж буй ном ба асуудаг үг ЗӨРДӨГ байв. Номыг нь ачаалсны
    // ДАРАА л дэлгэцийг шинэчилнэ.
    return loadBook(settings.book).then(ok => {
      if (!ok) { settings.book = 'starter'; save(KEY_S, settings); return loadBook('starter'); }
      return true;
    }).then(() => {
      wordSrc = 'book';
      refreshStats(); refreshHome(); alert('Сэргээлээ.');
    });
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
/* 2026-09-21: ЗАГВАР СОНГОГЧ, 3D ЦАГИРАГ, НИСДЭГ КАРТ, ХӨДӨЛГӨӨНИЙ
 * ТОХИРГОО бүгд ХАСАГДСАН (~150 мөр).
 *
 * Шалтгаан: апп нэг намуухан загвартай болов — цайвар, бараан нь
 * СИСТЕМЭЭ дагана (`app.css` дахь `prefers-color-scheme`). Сонгох зүйл
 * үлдээгүй тул сонгогч ч хэрэггүй; хөдөлгөөнт чимэглэл байхгүй тул
 * түүнийг унтраах товч ч хэрэггүй.
 *
 * Хөтчийн хаягийн мөрний өнгө (`meta[name=theme-color]`) нь одоо
 * `index.html`-д СТАТИК. Хоёр өнгө хэрэгтэй тул `media` атрибуттай
 * хоёр мөр байна.
 */

/** Гурван эхлүүлэгчийн НИЙТЛЭГ төгсгөл. */
function enterStudy() {
  // `queue[0]` нь `nextCard()`-д гарах үг. Сугалагдах картыг ЯГ түүгээр
  // бичнэ — эс тэгвэл нисэж ирсэн карт өөр үг харуулаад, буусны дараа
  // огт өөр үг гарч ирнэ.
  show('study');
  renderCounters(queue.length);
  nextCard();
}

const KEY_DEV = 'irodori.dev.v1';
let devId = load(KEY_DEV, null);
if (!devId) {
  const a = new Uint8Array(16);
  (crypto || window.crypto).getRandomValues(a);
  devId = [...a].map(b => b.toString(36)).join('').slice(0, 22);
  save(KEY_DEV, devId);
}

/* ══════════════════════ 10b. Нэр ба анги ══════════════════════
 *
 * Багш даалгавар өгөөд сурагчид хийж байгаа эсэхийг харах зорилготой.
 * Хүн НЭРээ бичиж, анги(уд)-аа сонгоно — эсвэл «Бусад». Ангийн гишүүд
 * бие биеийнхээ явцыг харна; «Бусад» зөвхөн өөрийнхийгөө (Явц).
 *
 * НЭР ХААШАА ОЧДОГ ВЭ:
 *   · Үргэлж энэ төхөөрөмж дээр (`KEY_ME`).
 *   · Серверт ЗӨВХӨН ангид элссэн үед. «Бусад» бол нэр огт илгээгдэхгүй —
 *     өмнө нь ангид байсан бол серверийн мөрийг устгах хүсэлт нь ч ХООСОН
 *     нэртэй явна.
 *
 * Хамгаалалт серверт (SUPABASE.sql «АНГИ»): анги бүр 4 оронтой кодтой,
 * буруу оролдлогыг цагт 50-аар хязгаарладаг. Клиент зөвхөн СЕРВЕР ЗӨВ
 * гэж баталсан кодыг хадгална.
 */
const KEY_ME = 'irodori.me.v1';
const KEY_CLS = 'irodori.classes.v1';      // ангийн нэрсийн кэш — офлайн үед

/* Гишүүний id нь `devId`-ээс ТУСДАА: хэрэглээний нэргүй тоог (ping)
   нэртэй холбох боломж үлдээхгүйн тулд. */
function newMemberId() {
  const a = new Uint8Array(16);
  (crypto || window.crypto).getRandomValues(a);
  return 'm' + [...a].map(b => b.toString(36)).join('').slice(0, 23);
}

/** Хадгалсан бичлэгийг шалгаж цэвэрлэнэ — гараар засагдсан ч апп унахгүй. */
function cleanMe(v) {
  const o = (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
  const codes = {};
  if (o.codes && typeof o.codes === 'object' && !Array.isArray(o.codes)) {
    for (const k in o.codes) {
      if (/^[a-z0-9_-]{1,20}$/.test(k) && /^\d{4}$/.test(String(o.codes[k]))) {
        codes[k] = String(o.codes[k]);
      }
    }
  }
  return {
    id: (typeof o.id === 'string' && /^[a-z0-9]{8,64}$/.test(o.id)) ? o.id : newMemberId(),
    name: typeof o.name === 'string' ? o.name.trim().slice(0, 40) : '',
    codes: codes,
    other: !!o.other && !Object.keys(codes).length,
    done: !!o.done,
    // Сервер СҮҮЛД баталсан ангиуд. «Бусад» руу шилжсэн хүний мөрийг
    // устгах хэрэгтэй эсэхийг үүгээр мэднэ — хоосон бол сүлжээ огт дуудахгүй.
    srv: Array.isArray(o.srv) ? o.srv.filter(x => typeof x === 'string') : [],
    // Код нь СОЛИГДСОН тул хаягдсан ангиуд. Дахин элсэх эсвэл «Бусад»
    // сонгох хүртэл мэдэгдэнэ — эс тэгвэл анги ЧИМЭЭГҮЙ алга болно.
    lost: Array.isArray(o.lost) ? o.lost.filter(x => typeof x === 'string').slice(0, 10) : [],
    /* СИНКЭЭС гаргасан гишүүний id ба ямар кодоос гаргасан — утас,
       компьютер хоёр ижил кодтой бол ангид НЭГ мөр болно. */
    syncId: (typeof o.syncId === 'string' && /^[a-z0-9]{8,64}$/.test(o.syncId)) ? o.syncId : '',
    syncFor: typeof o.syncFor === 'string' ? o.syncFor : '',
    // Серверт СҮҮЛД бичсэн id — солигдвол хуучин мөрийг устгана.
    /* Серверт СҮҮЛД бичсэн id. `2026-09-23c`-ээс ӨМНӨ энэ талбар
       БАЙГААГҮЙ — тэр үед мөр нь `me.id`-гаар бичигдсэн. Хоосон орхивол
       синк холбоход id солигдож, ХУУЧИН мөр нь ангид үүрд үлдэнэ
       (хоёр нэр: «Өлзийбаяр» ба «Admin»). Тиймээс ангид элссэн хүнд
       `me.id`-гаар нөхнө — тэр мөр серверт БАЙХ нь баталгаатай. */
    sent: (typeof o.sent === 'string' && /^[a-z0-9]{8,64}$/.test(o.sent)) ? o.sent
      : (Object.keys(codes).length ? (typeof o.id === 'string' ? o.id : '') : ''),
    // БАГШИЙН код (ангийн id -> код). Багш жагсаалтыг харах ба даалгавар
    // тавих эрхтэй; гишүүн БОЛОХГҮЙ — нэр нь серверт очихгүй.
    teach: teachClean(o.teach),
  };
}

function teachClean(v) {
  const out = {};
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const k in v) {
      if (/^[a-z0-9_-]{1,20}$/.test(k) && /^\d{4,8}$/.test(String(v[k]))) out[k] = String(v[k]);
    }
  }
  return out;
}

let me = cleanMe(load(KEY_ME, null));
save(KEY_ME, me);                          // шинэ id-г нэг удаа бэхэлнэ
let classList = load(KEY_CLS, []);
if (!Array.isArray(classList)) classList = [];

/* ── Гишүүний id: утас + компьютер = НЭГ хүн ──────────────────────
   Синкийн код нь хоёр төхөөрөмжид ИЖИЛ байдаг тул түүнээс гаргавал
   ангид нэг мөр болно. Урьд нь төхөөрөмж тутамд санамсаргүй id
   байсан тул нэг хүн хоёр удаа жагсаалтад гардаг байв.

   Кодыг ХЭШЛЭНЭ — түүхийгээр нь илгээхгүй: код бол явцын ТҮЛХҮҮР.
   Хэшийг сервер бусад хүнд буцаадаггүй ч, урвуулан тооцох боломжийг
   нь ч үлдээхгүй. */
let memberKey = me.syncId || me.id;

function fnvHex(str) {
  let out = '';
  for (let seed = 0; seed < 4; seed++) {
    let h = (0x811c9dc5 ^ (seed * 0x9e3779b1)) >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    out += ('00000000' + h.toString(16)).slice(-8);
  }
  return out;
}

/** Идэвхтэй гишүүний id. Синктэй бол кодоос, үгүй бол төхөөрөмжийнх. */
function deriveMember() {
  if (!(syncOn && syncCode)) { memberKey = me.id; return Promise.resolve(memberKey); }
  if (me.syncFor === syncCode && me.syncId) { memberKey = me.syncId; return Promise.resolve(memberKey); }
  const fin = hex => {
    me.syncId = 'm' + hex.slice(0, 22);
    me.syncFor = syncCode;
    save(KEY_ME, me);
    memberKey = me.syncId;
    return memberKey;
  };
  // `crypto.subtle` нь ЗӨВХӨН аюулгүй контекстэд байдаг (https, localhost).
  // Байхгүй бол энгийн тархаах хэшээр — зорилго нь нууцлал биш, ТОГТМОЛ
  // ижил id гаргах явдал.
  try {
    const sub = (crypto || window.crypto).subtle;
    if (!sub) return Promise.resolve(fin(fnvHex(syncCode)));
    return sub.digest('SHA-256', new TextEncoder().encode('irodori:' + syncCode))
      .then(b => fin([...new Uint8Array(b)].map(x => ('0' + x.toString(16)).slice(-2)).join('')))
      .catch(() => fin(fnvHex(syncCode)));
  } catch (e) {
    return Promise.resolve(fin(fnvHex(syncCode)));
  }
}

/** Синкийн код солигдоход id ч солигдоно — шууд шинэчилнэ. */
function syncIdentityChanged() {
  deriveMember().then(() => { lastMemberSync = 0; memberSync(true); });
}

const myClasses = () => Object.keys(me.codes);

/* ── Даалгавар ─────────────────────────────────────────────────────
   Анги бүр НЭГ даалгавартай байж болно (серверт, `classes.task`):
     { lessons: [1..8], n: 20, since: '2026-09-22' }
   = L1–L8-ын шалгалтын асуултаас 20 ӨӨР асуулт хариулах. */
const taskOf = id => {
  const t = (classList.find(c => c.id === id) || {}).task;
  return (t && Array.isArray(t.lessons) && t.lessons.length) ? t : null;
};
const taskN = t => Math.max(1, t.n | 0);
/** 'YYYY-MM-DD' -> `today()`-тай ижил өдрийн дугаар. */
function dayOf(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5) : 0;
}
/** «L1–L8» (дараалсан) эсвэл «L1, L3, L5». */
function lessonRange(ls) {
  const a = [...new Set(ls.map(x => x | 0))].sort((x, y) => x - y);
  if (!a.length) return '';
  const run = a.every((x, i) => i === 0 || x === a[i - 1] + 1);
  return run && a.length > 1 ? 'L' + a[0] + '–L' + a[a.length - 1] : a.map(x => 'L' + x).join(', ');
}
const taskLabel = t => lessonRange(t.lessons) + ' · ' + taskN(t) + ' асуулт';
const teachClasses = () => Object.keys(me.teach);
const isTeacher = id => !!me.teach[id];
/** Аль ч ангид харьяалалтай юу (сурагч эсвэл багш). */
const anyClasses = () => [...new Set(myClasses().concat(teachClasses()))];
/** Тухайн ангид өгөх код — багш бол багшийнх. */
const codeFor = id => me.teach[id] || me.codes[id];

/** Орон нутгийн огноо 'YYYY-MM-DD' (сервер UTC тул клиент өөрөө бодно). */
function isoToday() {
  const d = new Date();
  const p = n => (n < 10 ? '0' : '') + n;
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
const isoOf = day => new Date(day * 864e5).toISOString().slice(0, 10);

/** Хугацааны төлөв: нээлттэй · өнөөдөр дуусна · дууссан. */
function taskDue(t) {
  if (!t || !t.until) return null;
  const left = dayOf(t.until) - today();
  return {
    iso: t.until,
    left: left,
    state: left < 0 ? 'is-expired' : left === 0 ? 'is-today' : '',
    text: left < 0 ? 'Хугацаа дууссан' : left === 0 ? 'Өнөөдөр дуусна' : left + ' хоног үлдлээ',
  };
}
const DUE_HTML = t => {
  const d = taskDue(t);
  return d ? '<small class="task-deadline ' + d.state + '">' + esc(d.text) +
    ' · <time datetime="' + escA(d.iso) + '">' + esc(d.iso) + '</time></small>' : '';
};
/** Энэ төхөөрөмж дээрх явц — СЕРВЕРТЭЙ ИЖИЛ дүрэм (SUPABASE.sql). */
function taskDoneLocal(t) {
  const since = dayOf(t.since), les = t.lessons.map(x => x | 0);
  // Хугацаа дуусахад тоолол ЗОГСОНО — сервертэй ижил дүрэм.
  const upto = t.until ? dayOf(t.until) : Infinity;
  return Object.values(exHist)
    .filter(h => les.includes(h[2]) && h[0] >= since && h[0] <= upto).length;
}
const className = id => (classList.find(c => c.id === id) || {}).name || id;

/** Серверээс ангийн жагсаалт. Бүтэлгүйтвэл кэш хэвээр. */
function loadClassList() {
  if (!syncOn) return Promise.resolve(classList);
  return rpc('class_list', {}).then(l => {
    if (Array.isArray(l)) {
      classList = l.filter(c => c && typeof c.id === 'string' && typeof c.name === 'string');
      save(KEY_CLS, classList);
    }
    return classList;
  }).catch(() => classList);
}

/** Ангийн НЭРИЙГ серверээс шинэчилнэ.
 *
 *  Нэр серверт солигдоход (ж: «2-р анги» -> «Наран») Тохиргооны карт
 *  КЭШЭЭС уншдаг. Урьд нь кэш зөвхөн тохируулах дэлгэц нээхэд
 *  шинэчлэгддэг байсан тул аль хэдийн элссэн сурагч хуучин нэрийг
 *  ҮҮРД харах байв. Тиймээс апп нээгдэх бүрд нэг удаа. */
function refreshClassNames() {
  return loadClassList().then(() => refreshMe());
}

/** Тохиргоо дэлгэцийн карт ба цэсний «Анги» мөр. */
function refreshMe() {
  const n = $('me-name'), c = $('me-classes');
  if (n) n.textContent = me.name || 'Нэр оруулаагүй';
  if (c) {
    const txt = myClasses().length
      ? myClasses().map(className).join(' · ')
      : (me.other ? 'Бусад' : 'Анги сонгоогүй');
    /* ЭНД `return` бичиж БОЛОХГҮЙ — доорх цэсний мөр шинэчлэгдэхгүй
       үлдэнэ (тест барив: багш орсон ч «Анги» цэсэнд гарахгүй байв). */
    c.textContent = teachClasses().length
      ? (myClasses().length ? txt + ' · ' : '')
        + teachClasses().map(className).join(', ') + ' (багш)'
      : me.lost.length
        ? txt + ' · ' + me.lost.map(className).join(', ') + ': код солигдсон'
        : txt;
  }
  const nav = $('nav-klass');
  if (nav) nav.hidden = !anyClasses().length;
}

/* ── Серверт тоо илгээх ──────────────────────────────────────────── */
let lastMemberSync = 0;

/** Нэр, анги, тоог серверт илгээнэ.
 *
 *  Хариу нь анги тус бүрийн төлөв ({"mica":"ok","c2":"bad"}):
 *    bad / none — код солигдсон эсвэл анги устсан. Кодыг ХАЯНА: эс
 *                 тэгвэл дасгал бүрд хуучин кодоор оролдож, ангийн
 *                 таах хязгаарыг (цагт 50) бүх сурагч хамтдаа дуусгана.
 *    locked     — түр. Кодыг ҮЛДЭЭНЭ.
 *  2 минутад нэгээс олонгүй (`force`-оос бусад үед). */
function memberSync(force) {
  if (!syncOn || isDevHost()) return Promise.resolve(null);
  const ids = myClasses();
  // «Бусад» бөгөөд серверт юу ч үлдээгүй — дуудах шалтгаан алга.
  if (!ids.length && !me.srv.length) return Promise.resolve(null);
  const now = Date.now();
  if (!force && now - lastMemberSync < 120000) return Promise.resolve(null);
  lastMemberSync = now;

  return deriveMember().then(key => memberPut(key, ids));
}

/** Нэг мөр бичих. `me.sent` нь СҮҮЛД бичсэн id — солигдсон бол (синк
 *  холбогдсон/салсан) хуучин мөрийг ЭХЛЭЭД устгана, эс тэгвэл нэг хүн
 *  жагсаалтад хоёр удаа үлдэнэ. */
function memberPut(key, ids) {
  const old = me.sent;
  const stale = old && old !== key
    ? rpc('member_put', { p_member: old, p_name: '', p_classes: {} }).catch(() => null)
    : Promise.resolve(null);
  return stale.then(() => memberWrite(key, ids));
}

function memberWrite(key, ids) {
  const v = Object.values(progress);
  const body = {
    p_member: key,
    // Ангигүй бол НЭР ИЛГЭЭХГҮЙ — сервер мөрийг устгана.
    p_name: ids.length ? me.name : '',
    p_classes: ids.length ? me.codes : {},
    p_seen: v.length,
    p_learned: v.filter(p => (p.b || 0) >= 3).length,
    p_today: todayN(),
    p_streak: streakN(),
    p_day: today(),
    // Ангигүй бол илгээхгүй — сервер мөрийг устгана.
    p_exam: ids.length ? exHist : null,
  };
  return rpc('member_put', body).then(res => {
    if (!res || typeof res !== 'object' || res.error) return res;
    if (me.sent !== key) { me.sent = key; save(KEY_ME, me); }
    let dropped = false;
    for (const k of ids) {
      if (res[k] === 'bad' || res[k] === 'none') {
        delete me.codes[k]; dropped = true;
        if (!me.lost.includes(k)) me.lost.push(k);
      }
    }
    me.srv = Object.keys(res).filter(k => res[k] === 'ok');
    save(KEY_ME, me);
    if (dropped) refreshMe();
    return res;
  }).catch(() => null);
}

/* ── Тохируулах дэлгэц ───────────────────────────────────────────── */
let setupFirst = false;

const SU_ITEM = c =>
  '<div class="su-item">' +
    '<button class="su-toggle" type="button" data-c="' + escA(c.id) + '" aria-pressed="false"' +
    ' aria-controls="su-codebox-' + escA(c.id) + '">' +
      '<span class="su-mark" aria-hidden="true"></span>' +
      '<span class="su-choice-name">' + esc(c.name) + '</span>' +
    '</button>' +
    '<div class="su-codebox" id="su-codebox-' + escA(c.id) + '">' +
      '<label class="su-label" for="su-code-' + escA(c.id) + '">Код</label>' +
      '<input class="su-code" id="su-code-' + escA(c.id) + '" data-c="' + escA(c.id) + '"' +
      ' type="text" inputmode="numeric" minlength="4" maxlength="8" pattern="[0-9]{4,8}"' +
      ' autocomplete="off" spellcheck="false" aria-describedby="su-err-' + escA(c.id) + '">' +
      '<p class="su-err" id="su-err-' + escA(c.id) + '" data-c="' + escA(c.id) + '" role="alert" hidden></p>' +
    '</div>' +
  '</div>';

function suNote(msg, isErr) {
  const n = $('su-note');
  n.textContent = msg || '';
  n.classList.toggle('is-error', !!isErr);
}

function suErr(id, msg) {
  const e = document.querySelector('.su-err[data-c="' + id + '"]');
  const i = document.querySelector('.su-code[data-c="' + id + '"]');
  if (e) { e.textContent = msg || ''; e.hidden = !msg; }
  if (i) i.setAttribute('aria-invalid', msg ? 'true' : 'false');
}

function renderSetupClasses() {
  const box = $('su-classes');
  box.innerHTML = classList.map(SU_ITEM).join('');
  for (const c of classList) {
    const on = (c.id in me.codes) || (c.id in me.teach);
    const b = box.querySelector('.su-toggle[data-c="' + c.id + '"]');
    const i = box.querySelector('.su-code[data-c="' + c.id + '"]');
    b.setAttribute('aria-pressed', on);
    i.value = me.codes[c.id] || me.teach[c.id] || '';
    b.onclick = () => {
      const now = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', now);
      if (now) { $('su-other').setAttribute('aria-pressed', 'false'); i.focus(); }
      suErr(c.id, ''); suNote('');
    };
    i.oninput = () => { i.value = i.value.replace(/\D/g, '').slice(0, 8); suErr(c.id, ''); };
  }
}

/** first = анх удаа (буцах товчгүй). */
function openSetup(first) {
  setupFirst = !!first;
  $('su-title').textContent = first ? 'Танилцъя' : 'Профайл засах';
  $('su-cancel').hidden = !!first;
  $('su-name').value = me.name;
  $('su-name').removeAttribute('aria-invalid');
  $('su-other').setAttribute('aria-pressed', me.other && !myClasses().length);
  renderSetupClasses();
  suNote(syncOn ? '' : 'Анги холбогдох боломжгүй — зөвхөн «Бусад».');
  show('setup');
  // Жагсаалтыг шинэчилнэ. Хэрэглэгч аль хэдийн дарж эхэлсэн бол
  // зурсан сонголтыг нь устгахгүйн тулд зөвхөн ӨӨРЧЛӨГДСӨН үед дахин зурна.
  const before = JSON.stringify(classList);
  loadClassList().then(() => {
    if (screen !== 'setup') return;
    if (JSON.stringify(classList) !== before) {
      const keep = {};
      document.querySelectorAll('#su-classes .su-toggle').forEach(b => {
        const i = document.querySelector('.su-code[data-c="' + b.dataset.c + '"]');
        keep[b.dataset.c] = { on: b.getAttribute('aria-pressed') === 'true', code: i ? i.value : '' };
      });
      renderSetupClasses();
      for (const id in keep) {
        const b = document.querySelector('#su-classes .su-toggle[data-c="' + id + '"]');
        const i = document.querySelector('.su-code[data-c="' + id + '"]');
        if (b) b.setAttribute('aria-pressed', keep[id].on);
        if (i) i.value = keep[id].code;
      }
    }
    if (syncOn && !classList.length) suNote('Анги ачаалж чадсангүй. Дараа Тохиргооноос нэмж болно.');
  });
}

$('su-other').onclick = () => {
  $('su-other').setAttribute('aria-pressed', 'true');
  document.querySelectorAll('#su-classes .su-toggle').forEach(b => {
    b.setAttribute('aria-pressed', 'false');
    suErr(b.dataset.c, '');
  });
  suNote('');
};

$('su-name').oninput = () => $('su-name').removeAttribute('aria-invalid');

let setupRun = 0;                          // гүйлтийн тэмдэг (§2.36): давхар дарлага

async function saveSetup() {
  const run = ++setupRun;
  const name = $('su-name').value.trim().slice(0, 40);
  if (!name) {
    $('su-name').setAttribute('aria-invalid', 'true');
    $('su-name').focus();
    suNote('Нэрээ бичнэ үү.', true);
    return;
  }
  const picked = [...document.querySelectorAll('#su-classes .su-toggle')]
    .filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.c);
  const other = $('su-other').getAttribute('aria-pressed') === 'true';
  if (!picked.length && !other) {
    suNote('Анги эсвэл «Бусад»-ыг сонгоно уу.', true);
    return;
  }

  // Код бүрийг СЕРВЕРЭЭР батална. Өмнө нь баталсан, өөрчлөгдөөгүй кодыг
  // дахин илгээхгүй — таах хязгаараас дэмий зарцуулахгүй.
  const codes = {};
  let bad = false;
  for (const id of picked) {
    const code = (document.querySelector('.su-code[data-c="' + id + '"]').value || '').trim();
    if (!/^\d{4,8}$/.test(code)) { suErr(id, 'Кодоо оруулна уу.'); bad = true; continue; }
    codes[id] = code;
  }
  if (bad) { suNote('Кодоо шалгана уу.', true); return; }

  const btn = $('su-save');
  btn.disabled = true;
  suNote(picked.length ? 'Шалгаж байна…' : '');
  try {
    // Багшийн код нь 'teacher' буцаана — тэр ангид ГИШҮҮН болохгүй,
    // зөвхөн харах ба даалгавар тавих эрхтэй.
    const teach = {};
    for (const id of picked) {
      if (me.codes[id] === codes[id] || me.teach[id] === codes[id]) {
        if (me.teach[id] === codes[id]) teach[id] = codes[id];
        continue;
      }
      let st;
      try { st = await rpc('class_join', { p_class: id, p_code: codes[id] }); }
      catch (e) { suNote('Сүлжээ алга — дахин оролдоно уу.', true); return; }
      if (run !== setupRun) return;
      if (st === 'teacher') { teach[id] = codes[id]; continue; }
      if (st === 'ok') continue;
      suErr(id, st === 'locked' ? 'Түр түгжигдсэн — 1 цагийн дараа оролдоно уу.'
              : st === 'none' ? 'Анги олдсонгүй.' : 'Код буруу.');
      bad = true;
    }
    if (bad) { suNote('Кодоо шалгана уу.', true); return; }

    me.name = name;
    // Багшийн кодтой ангиуд нь `codes`-д ОРОХГҮЙ (гишүүн биш).
    me.teach = teach;
    for (const id in teach) delete codes[id];
    me.codes = codes;
    me.other = !picked.length;
    // Дахин элссэн анги, эсвэл «Бусад» — мэдэгдэх шаардлага дууслаа.
    me.lost = me.other ? [] : me.lost.filter(k => !(k in codes));
    me.done = true;
    save(KEY_ME, me);
    refreshMe();
    suNote('');
    memberSync(true);
    go(setupFirst ? 'home' : 'profile');
  } finally {
    if (run === setupRun) btn.disabled = false;
  }
}

$('su-save').onclick = () => { saveSetup(); };
$('su-cancel').onclick = () => go('profile');
$('me-edit').onclick = () => openSetup(false);

/* ── Ангийн дэлгэц ───────────────────────────────────────────────── */
let klassRun = 0;

/** Даалгаврын төлөв — хийсэн эсэхийг нэг харцаар. */
const TASK_STATE = (n, need) => n >= need
  ? '<span class="task-state is-done">✓ Хийсэн</span>'
  : '<span class="task-state">Хийгээгүй · ' + n + '/' + need + '</span>';

/* Даалгавартай ангид мөр бүр ДААЛГАВРЫН ГҮЙЦЭТГЭЛ-ийг харуулна — цээжилсэн
   үгийн тоог БИШ (хэрэглэгчийн шаардлага: «хэн даалгаврыг хэдэн %
   гүйцэтгэсэн»). Даалгаваргүй ангид хуучин 4 тоо хэвээр. */
const KL_TASK_ROW = (r, need) => {
  const n = Math.min(r.taskN, need), pct = Math.round(100 * n / need), done = n >= need;
  return '<li class="kl-member' + (r.me ? ' me' : '') + '">' +
    '<div class="kl-member-head"><div class="kl-name"><b>' + esc(r.name) + '</b>' +
    '<span class="kl-self">Би</span></div>' +
    '<span class="task-state' + (done ? ' is-done' : '') + '">' + (done ? '✓ ' : '') + pct + '%</span></div>' +
    '<div class="kl-prog' + (done ? ' is-done' : '') + '"><span class="track">' +
    '<span class="fill" style="width:' + pct + '%"></span></span>' +
    '<small>' + n + '/' + need + ' асуулт</small></div></li>';
};

const KL_ROW = (r, need) => need ? KL_TASK_ROW(r, need) :
  '<li class="kl-member' + (r.me ? ' me' : '') + '">' +
    '<div class="kl-name"><b>' + esc(r.name) + '</b><span class="kl-self">Би</span></div>' +
    '<dl class="kl-metrics">' +
      '<div class="kl-learned"><dt>тогтсон</dt><dd>' + r.learned + '</dd></div>' +
      '<div><dt>үзсэн</dt><dd>' + r.seen + '</dd></div>' +
      '<div><dt>өнөөдөр</dt><dd>' + r.todayN + '</dd></div>' +
      '<div><dt>дараалан</dt><dd>' + r.streakN + '<small>өд.</small></dd></div>' +
    '</dl>' +
  '</li>';

/** Серверийн мөрийг ЭНЭ төхөөрөмжийн өдрөөр тайлбарлана.
 *
 *  `today`/`streak` нь `day` өдрийнх. Өчигдөр 20 үг хийгээд өнөөдөр
 *  ороогүй хүн «өнөөдөр 20» гэж харагдах ёсгүй. Сервер UTC-ээр
 *  тоолдог тул шийдвэрийг энд — хэрэглэгчийн өдрөөр гаргана. */
function klassRow(r) {
  const t = today();
  const d = Number.isFinite(r.day) ? r.day : -1;
  return {
    name: String(r.name || ''),
    me: !!r.me,
    seen: Math.max(0, r.seen | 0),
    learned: Math.max(0, r.learned | 0),
    todayN: d === t ? Math.max(0, r.today | 0) : 0,
    streakN: (d === t || d === t - 1) ? Math.max(0, r.streak | 0) : 0,
    taskN: Math.max(0, r.task_n | 0),
  };
}

function klassNote(msg, isErr) {
  const n = $('kl-note');
  n.textContent = msg || '';
  n.classList.toggle('is-error', !!isErr);
}

/* Багшийн маягтын ТҮР төлөв (хадгалах хүртэл). */
const teachDraft = {};

function draftOf(id) {
  if (!teachDraft[id]) {
    const t = taskOf(id);
    teachDraft[id] = t
      ? { lessons: t.lessons.map(x => x | 0), n: taskN(t), days: Math.max(1, t.days | 0) || 7 }
      : { lessons: [], n: 20, days: 7 };
  }
  return teachDraft[id];
}

const SEG_BTN = (attr, val, cur) => '<button type="button" data-' + attr + '="' + val +
  '" aria-pressed="' + (val === cur) + '"><b>' + val + '</b></button>';

/** Багшийн самбар — даалгавар харах ба тавих. */
function teachPanel(id, name, task) {
  const d = draftOf(id);
  const has = !!task;
  return '<div class="kl-teach su-field">' +
    '<div class="kl-teach-head"><span class="kl-badge">Багш</span>' +
    '<button class="ghost sm kl-task-edit" type="button" data-c="' + escA(id) + '"' +
    ' aria-expanded="false" aria-controls="kl-form-' + escA(id) + '">' +
    (has ? 'Засах' : 'Даалгавар өгөх') + '</button></div>' +
    '<p class="kl-task"><span>' + (has ? esc(taskLabel(task)) : 'Даалгавар алга') + '</span>' +
    (has ? DUE_HTML(task) : '') + '</p>' +
    '<form class="kl-form" id="kl-form-' + escA(id) + '" data-c="' + escA(id) + '"' +
    ' aria-label="' + escA(name) + ' · Даалгавар" hidden>' +
      '<fieldset><legend class="su-label">Хичээл</legend>' +
      '<div class="lessons kl-les" data-c="' + escA(id) + '"></div></fieldset>' +
      '<fieldset><legend class="su-label">Асуулт</legend>' +
      '<div class="seg kl-n" data-c="' + escA(id) + '">' +
      [10, 15, 20].map(v => SEG_BTN('n', v, d.n)).join('') + '</div></fieldset>' +
      '<fieldset><legend class="su-label">Хоног</legend>' +
      '<div class="seg kl-days" data-c="' + escA(id) + '">' +
      [1, 3, 7, 14].map(v => SEG_BTN('d', v, d.days)).join('') + '</div></fieldset>' +
      '<p class="kl-due" data-c="' + escA(id) + '" role="status" aria-atomic="true"></p>' +
      '<div class="su-actions">' +
      '<button class="primary kl-save" type="button" data-c="' + escA(id) + '">Хадгалах</button>' +
      '<button class="ghost sm kl-del" type="button" data-c="' + escA(id) + '"' +
      (has ? '' : ' hidden') + '>Даалгавар устгах</button></div>' +
      '<p class="su-status kl-msg" data-c="' + escA(id) + '" role="status" aria-atomic="true"></p>' +
    '</form></div>';
}

const $c = (sel, id) => document.querySelector(sel + '[data-c="' + id + '"]');

/** Маягтын хичээлийн чип ба товчнуудыг амилуулна. */
function bindTeach(id) {
  const d = draftOf(id);
  const due = () => {
    const el = $c('.kl-due', id);
    if (el) {
      const iso = isoOf(dayOf(isoToday()) + d.days);
      el.innerHTML = 'Дуусах: <time datetime="' + escA(iso) + '">' + esc(iso) + '</time>';
    }
  };
  const chips = () => {
    const box = $c('.kl-les', id);
    if (!box || !EXAM) return;
    box.innerHTML = '';
    for (const l of examLessonsAll()) {
      const n = EXAM.items.filter(q => q.lesson === l).length;
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = 'L' + l + '<small>' + n + '</small>';
      b.setAttribute('aria-pressed', d.lessons.includes(l));
      b.onclick = () => {
        const i = d.lessons.indexOf(l);
        i < 0 ? d.lessons.push(l) : d.lessons.splice(i, 1);
        b.setAttribute('aria-pressed', i < 0);
      };
      box.appendChild(b);
    }
  };
  const seg = (sel, attr, key) => {
    const box = $c(sel, id);
    if (!box) return;
    box.querySelectorAll('button').forEach(b => b.onclick = () => {
      d[key] = +b.dataset[attr];
      box.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
      due();
    });
  };
  seg('.kl-n', 'n', 'n');
  seg('.kl-days', 'd', 'days');
  due();
  if (EXAM) chips(); else loadExam().then(chips).catch(() => {});

  const form = $c('.kl-form', id), edit = $c('.kl-task-edit', id);
  if (edit) edit.onclick = () => {
    const open = form.hidden;
    form.hidden = !open;
    edit.setAttribute('aria-expanded', open);
  };
  const msg = (t, err) => {
    const m = $c('.kl-msg', id);
    if (m) { m.textContent = t || ''; m.classList.toggle('is-error', !!err); }
  };
  const send = (lessons, saving) => {
    msg(saving ? 'Хадгалж байна…' : 'Устгаж байна…');
    return rpc('task_set', {
      p_class: id, p_tcode: me.teach[id], p_lessons: lessons,
      p_n: d.n, p_days: d.days, p_since: isoToday(),
    }).then(r => {
      if (!r || r.status !== 'ok') {
        msg(r && r.status === 'locked' ? 'Түр түгжигдсэн — 1 цагийн дараа.'
          : 'Багшийн эрх баталгаажсангүй.', true);
        return;
      }
      const c = classList.find(x => x.id === id);
      if (c) { c.task = r.task || null; save(KEY_CLS, classList); }
      teachDraft[id] = null;
      msg('');
      refreshKlass();
    }).catch(() => msg('Сүлжээ алга — дахин оролдоно уу.', true));
  };
  const sv = $c('.kl-save', id);
  if (sv) sv.onclick = () => {
    if (!d.lessons.length) { msg('Хичээл сонгоно уу.', true); return; }
    send(d.lessons.slice().sort((a, b) => a - b), true);
  };
  const dl = $c('.kl-del', id);
  if (dl) dl.onclick = () => { if (confirm('Даалгаврыг устгах уу?')) send([], false); };
}

async function refreshKlass() {
  const run = ++klassRun;
  const ids = anyClasses();
  const box = $('kl-list');
  if (!ids.length) {
    box.innerHTML = '';
    klassNote(me.lost.length ? lostMsg()
      : 'Та ангид элсээгүй байна. Тохиргооноос нэмж болно.', me.lost.length > 0);
    return;
  }
  if (!syncOn) { klassNote('Анги холбогдох боломжгүй.', true); return; }
  klassNote('Ачаалж байна…');
  // Өөрийн сүүлийн тоог ЭХЛЭЭД илгээнэ — эс тэгвэл жагсаалтад өөрийгөө
  // хуучин тоотой харна.
  await memberSync(true);
  if (run !== klassRun) return;
  const out = [], msgs = [], teach = [];
  for (const id of anyClasses()) {
    let r;
    try {
      r = await rpc('class_roster', { p_class: id, p_code: codeFor(id), p_member: memberKey });
    } catch (e) { msgs.push('Сүлжээ алга.'); continue; }
    if (run !== klassRun) return;
    if (!r || r.status === 'bad' || r.status === 'none') {
      delete me.codes[id]; delete me.teach[id];
      if (!me.lost.includes(id)) me.lost.push(id);
      save(KEY_ME, me); refreshMe();
      continue;
    }
    if (r.status === 'locked') { msgs.push('«' + className(id) + '» түр түгжигдсэн.'); continue; }
    if (typeof r.name === 'string' && r.name && r.name !== className(id)) {
      const c = classList.find(x => x.id === id);
      if (c) { c.name = r.name; save(KEY_CLS, classList); refreshMe(); }
    }
    const rows = (Array.isArray(r.rows) ? r.rows : []).map(klassRow);
    // Серверийн даалгаврыг кэшэнд — шалгалтын дэлгэц ч харна.
    const c = classList.find(x => x.id === id);
    if (c && JSON.stringify(c.task || null) !== JSON.stringify(r.task || null)) {
      c.task = r.task || null; save(KEY_CLS, classList);
    }
    const task = (r.task && Array.isArray(r.task.lessons) && r.task.lessons.length) ? r.task : null;
    const need = task ? taskN(task) : 0;
    const doneN = task ? rows.filter(x => x.taskN >= need).length : 0;
    // Даалгавартай бол ГҮЙЦЭТГЭЛЭЭР эрэмбэлнэ — хэн хийгээгүй нь доороо.
    if (task) rows.sort((a, b) => b.taskN - a.taskN || a.name.localeCompare(b.name));
    const asTeacher = r.role === 'teacher';
    if (asTeacher) teach.push(id);
    out.push('<section class="kl-class" aria-labelledby="kl-class-' + escA(id) + '">' +
      '<h3 id="kl-class-' + escA(id) + '"><span>' + esc(r.name || className(id)) + '</span>' +
      '<small>' + rows.length + ' хүн</small></h3>' +
      (asTeacher ? teachPanel(id, r.name || className(id), task) : '') +
      (task && !asTeacher
        ? '<p class="kl-task"><span>Даалгавар · ' + esc(taskLabel(task)) + '</span>' +
          '<strong>' + doneN + '/' + rows.length + ' хийсэн</strong>' + DUE_HTML(task) + '</p>'
        : (task ? '<p class="kl-task"><span>Гүйцэтгэл</span><strong>' + doneN + '/' +
            rows.length + ' хийсэн</strong></p>' : '')) +
      '<ol class="kl-members">' + rows.map(x => KL_ROW(x, need)).join('') + '</ol></section>');
  }
  box.innerHTML = out.join('');
  teach.forEach(bindTeach);
  /* `memberSync` дээр ч, roster дээр ч хаягдаж болно — аль алинд нь
     `me.lost`-д бичигддэг тул мэдэгдлийг ЭНДЭЭС нэг удаа гаргана. */
  if (me.lost.length) msgs.unshift(lostMsg());
  klassNote(msgs.join(' '), msgs.length > 0);
}

const lostMsg = () => me.lost.map(k => '«' + className(k) + '»').join(', ')
  + ' ангийн код солигдсон — Тохиргооноос дахин оруулна уу.';

$('kl-refresh').onclick = () => { refreshKlass(); };

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

/** Хэрэглээний ГҮНийг хэмжих гурван тоо.
 *
 * АЛЬ үг гэдгийг илгээхгүй — зөвхөн хэдийг. `n` нь тухайн карт дээр
 * хэдэн удаа хариулсан тоо (`grade()`), тиймээс `answers` нь бодит
 * хөдөлмөрийн хэмжүүр; `cards` нь зөвхөн хүрсэн үгийн тоо. */
function usageTotals() {
  const v = Object.values(progress);
  return {
    cards: v.length,
    answers: v.reduce((a, p) => a + (p.n || 0), 0),
    learned: v.filter(p => (p.b || 0) >= 3).length,
  };
}

/** Апп нээгдэхэд ӨДӨРТ НЭГ УДАА — хэрэглээний тоо. Алдааг чимээгүй өнгөрөөнө. */
function pingUsage() {
  if (!syncOn || isDevHost()) return;
  const k = 'irodori.pinged.v1', t = String(today());
  try {
    if (localStorage.getItem(k) === t) return;
    localStorage.setItem(k, t);
  } catch (e) { /* хувийн горим */ }
  const u = usageTotals();
  rpc('ping', { p_dev: devId, p_cards: u.cards, p_answers: u.answers,
                p_learned: u.learned }).catch(() => {});
}

/** Дасгалаас гармагц тоог л шинэчилнэ — НЭЭЛТ нэмэгдэхгүй (`p_bump:false`).
 *
 * Үүнгүй бол өдрийн цорын ганц ping нь дасгалын ӨМНӨ явдаг тул тухайн
 * өдрийн бүх давталт бүртгэлгүй үлдэнэ — анх орсон өдрөө л суугаад
 * дахин ирээгүй хүн «0 карт хийсэн» мэт харагдана.
 *
 * 2 минутад нэгээс олонгүй: богино дасгал дараалан хийхэд сүлжээ
 * дэмий ачаалахгүй. */
let lastStatsPing = 0;
function statsPing() {
  if (!syncOn || isDevHost()) return;
  const now = Date.now();
  if (now - lastStatsPing < 120000) return;
  lastStatsPing = now;
  const u = usageTotals();
  rpc('ping', { p_dev: devId, p_cards: u.cards, p_answers: u.answers,
                p_learned: u.learned, p_bump: false }).catch(() => {});
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
    note.textContent = 'Өнөөдөр ' + (d.today_opens || 0) + ' удаа нээгдсэн'
      + ' · ' + (d.studied || 0) + ' төхөөрөмж дасгал хийсэн'
      + ' · нийт ' + (d.answers || 0) + ' хариулт'
      + ' · ' + (d.learned || 0) + ' үг тогтсон. '
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
} else {
  /* `file://` эсвэл service worker-гүй хөтөч. Өмнө нь `swState()`-ыг
     ЗӨВХӨН дээрх салаанаас дууддаг байсан тул доторх «энэ орчинд
     ажиллахгүй» гэсэн мессеж хэзээ ч гардаггүй, мөр нь ХООСОН
     үлддэг байв. */
  addEventListener('load', swState);
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
  if (m) {
    const src = /n5/.test(location.hash) ? 'n5' : 'book';
    ensureWords(src).then(() => startSession(m, false, src));
  }
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
    ALL = v.items; KANA = k.items; KANJI = kj.items; READ_MAP = null;
    bookCache[v.book || 'starter'] = v.items;
    // Сонгосон ном татагдаагүй бөгөөд 入門 руу ухарсан бол ТОХИРГООГ
    // нь ч засна — эс тэгвэл дэлгэц «初級1» гэж хэлээд 入門-ий үг асууна.
    if ((v.book || 'starter') !== settings.book) {
      settings.book = v.book || 'starter'; save(KEY_S, settings);
    }
    if (au && au.ids) { AUDIO_IDS = new Set(au.ids); pickVoice(); }
    refreshSync();
    // Ачаалахад нэг удаа татаж уусгана — өөр төхөөрөмж дээр давтсан нь орж ирнэ.
    if (syncOn && syncCode) syncNow(true).then(refreshHome);
    /* Түүхийн ЁЗООР. Үүнгүй бол эхний `popstate`-д `state` нь `null`
       ирж, нүүр рүү буцах эсэхийг таамаглах шаардлагатай болно. */
    try { history.replaceState({ scr: 'home' }, ''); } catch (e) {}
    show('home'); refreshHome(); refreshMe(); pingUsage();
    /* Нэр, анги тохируулаагүй бол ЭХЛЭЭД асууна — одоо байгаа
       хэрэглэгчид ч (хэрэглэгчийн шаардлага). Тохируулсан бол ангийн
       тоог шинэчилж, холбоосоор ирсэн дасгалыг эхлүүлнэ. */
    if (!me.done) openSetup(true);
    else { autoStart(); memberSync(true); refreshClassNames(); }
  })
  .catch(() => {
    document.getElementById('home').innerHTML =
      '<p class="warn">Үгийн сан ачаалагдсангүй. <code>data/vocab.json</code> байгаа эсэхийг шалгана уу. ' +
      'Файлыг шууд нээвэл (file://) браузер хориглодог — жижиг сервер ажиллуулна уу: ' +
      '<code>python -m http.server</code></p>';
  });
