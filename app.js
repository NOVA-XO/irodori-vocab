/* いろどり 入門 — шинэ үг давтах апп
 *
 * ЗАРЧИМ: ромажиг ХЭЗЭЭ Ч дэлгэцэнд харуулахгүй. Үг зөвхөн кана/ханзаар гарна.
 * «Гараар бичих» дасгалд хэрэглэгч латинаар бичихэд шууд кана болж харагдана
 * (IME суулгах шаардлагагүй), тиймээс нүдэнд ромажи үлдэхгүй.
 */
'use strict';

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
  for (const part of (item.kana || '').split(/[／/]/)) add(normKana(part));
  for (const part of (item.jp || '').split(/[／/]/)) add(normKana(part));
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

let progress = load(KEY_P, {});
let settings = load(KEY_S, { lessons: [1, 2, 3], ref: false, script: 'kanji' });
if (!settings.script) settings.script = 'kanji';   // хуучин хадгалсан тохиргоог нөхнө

/* Асуултын нүүр талд юу харуулах вэ: ханзтай хэлбэр эсвэл кана уншлага.
   Нөгөө хэлбэрийг нь хариулт дээр үзүүлнэ. Ханзгүй үг (プレゼント, あめ) дээр
   хоёул ижил гарах тул хариулт дээр давхардуулж харуулахгүй. */
const faceOf = it => (settings.script === 'kana' && it.kana) ? it.kana : it.jp;
const backOf = it => (settings.script === 'kana') ? it.jp : (it.kana || '');

function grade(id, ok) {
  const p = progress[id] || { b: 0, d: 0, n: 0, c: 0, w: 0 };
  p.n++;
  if (ok) { p.c++; p.b = Math.min(p.b + 1, BOXES.length - 1); }
  else { p.w++; p.b = Math.max(p.b - 2, 0); }
  p.d = today() + BOXES[p.b];
  progress[id] = p;
  save(KEY_P, progress);
}

/* ══════════════════════ 4. Өгөгдөл ══════════════════════ */

let ALL = [];                 // бүх үг
let pool = [];                // сонгосон хичээлийн үг

const inPool = it => settings.lessons.includes(it.lesson) && (settings.ref || !it.ref);
const isDue = it => { const p = progress[it.id]; return p && p.d <= today(); };
const isNew = it => !progress[it.id];

function rebuildPool() { pool = ALL.filter(inPool); }

/* ══════════════════════ 5. Дуу (speechSynthesis) ══════════════════════ */

let jaVoice = null;
function pickVoice() {
  const vs = window.speechSynthesis ? speechSynthesis.getVoices() : [];
  jaVoice = vs.find(v => /^ja(-|_)?/i.test(v.lang)) || null;
  const warn = document.getElementById('voice-warn');
  if (!window.speechSynthesis) {
    warn.hidden = false;
    warn.textContent = 'Энэ браузер дуу уншихыг дэмжихгүй тул «Сонсох» горим ажиллахгүй.';
  } else if (!jaVoice) {
    warn.hidden = false;
    warn.innerHTML = 'Япон хоолой олдсонгүй — «Сонсох» горим чимээгүй байна. ' +
      'Windows: <b>Settings → Time &amp; language → Language &amp; region → 日本語 нэмэх → ' +
      'Language options → Speech</b> суулгаад браузераа дахин нээнэ үү.';
  } else {
    warn.hidden = true;
  }
  document.querySelector('[data-mode="listen"]').disabled = !jaVoice;
}
function speak(text) {
  if (!window.speechSynthesis || !jaVoice) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[／/].*$/, '').replace(/[（(].*?[）)]/g, ''));
  u.voice = jaVoice; u.lang = jaVoice.lang; u.rate = 0.85;
  speechSynthesis.speak(u);
}

/* ══════════════════════ 6. Дасгалын хөдөлгүүр ══════════════════════ */

const SESSION = 20;
const $ = id => document.getElementById(id);
let mode = 'flash', queue = [], cur = null, done = 0, okN = 0, ngN = 0, answered = false;

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

function buildQueue(onlyDue) {
  const due = shuffle(pool.filter(isDue));
  const fresh = onlyDue ? [] : shuffle(pool.filter(isNew));
  const rest = onlyDue ? [] : shuffle(pool.filter(it => !isDue(it) && !isNew(it)));
  return due.concat(fresh, rest).slice(0, SESSION);
}

function startSession(m, onlyDue) {
  if (!pool.length) { alert('Эхлээд хичээл сонгоно уу.'); return; }
  mode = m;
  queue = buildQueue(!!onlyDue);
  if (!queue.length) { alert('Давтах үг алга. Шинэ хичээл сонгох эсвэл маргааш дахин үзнэ үү.'); return; }
  done = okN = ngN = 0;
  show('study');
  $('c-total').textContent = queue.length;
  nextCard();
}

function nextCard() {
  if (!queue.length) { finish(); return; }
  cur = queue.shift();
  answered = false;
  for (const p of ['pane-flash', 'pane-choice', 'pane-type', 'pane-next']) $(p).hidden = true;
  $('answer').hidden = true;
  $('f-judge').hidden = true; $('f-show').hidden = false;
  $('p-sub').textContent = 'L' + cur.lesson + (cur.ref ? ' · 参考' : '');

  if (mode === 'flash') {
    $('p-main').textContent = faceOf(cur); $('p-main').className = 'prompt jp';
    $('pane-flash').hidden = false;
  } else if (mode === 'choice') {
    $('p-main').textContent = faceOf(cur); $('p-main').className = 'prompt jp';
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
    setTimeout(() => speak(cur.kana || cur.jp), 250);
  }
  $('btn-speak').hidden = !jaVoice;
  updateBar();
}

function buildChoices() {
  const box = $('choices');
  box.innerHTML = '';
  const others = shuffle(ALL.filter(x => x.id !== cur.id && x.mn && x.mn !== cur.mn)).slice(0, 3);
  shuffle([cur].concat(others)).forEach(opt => {
    const b = document.createElement('button');
    b.textContent = opt.mn || opt.jp;
    b.onclick = () => {
      if (answered) return;
      answered = true;
      const good = opt.id === cur.id;
      b.classList.add(good ? 'correct' : 'wrong');
      if (!good) [...box.children].forEach(c => { if (c.textContent === (cur.mn || cur.jp)) c.classList.add('correct'); });
      [...box.children].forEach(c => c.disabled = true);
      resolve(good);
    };
    box.appendChild(b);
  });
}

function reveal() {
  // «Бичих» ба «Сонсох» горимд асуулт нь үг БАЙГААГҮЙ (монгол утга / дуу) тул
  // хариулт дээр үгийг бүтнээр нь — ханз ба кана хоёуланг нь — үзүүлнэ.
  // Флашкарт, олон сонголтод асуулт нь үг байсан тул нөгөө хэлбэрийг л нэмнэ.
  const lines = [];
  if (mode === 'type' || mode === 'listen') {
    lines.push(cur.jp);
    if (cur.kana && cur.kana !== cur.jp) lines.push(cur.kana);
  } else {
    const back = backOf(cur);
    if (back && back !== faceOf(cur)) lines.push(back);
  }
  $('a-kana').textContent = lines.join('   ');
  $('a-mn').textContent = cur.mn || '';
  $('a-acc').textContent = cur.accent ? 'өргөлт: ' + cur.accent : '';
  $('answer').hidden = false;
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
  if (!ok) queue.push(cur);                 // алдсан үгийг мөчлөгийн төгсгөлд эргүүлж тавина
  if (jaVoice && mode !== 'listen') speak(cur.kana || cur.jp);
  updateBar();
}

function updateBar() {
  const total = done + queue.length + 1;
  $('pbar').style.width = (100 * done / Math.max(total, 1)) + '%';
}

function finish() {
  show('home'); refreshHome();
  alert('Дууслаа!  ✓ ' + okN + '   ✗ ' + ngN);
}

/* ══════════════════════ 7. Дэлгэц солих ба нүүр ══════════════════════ */

function show(name) {
  for (const s of ['home', 'study', 'stats']) $(s).hidden = (s !== name);
  $('btn-home').style.visibility = name === 'home' ? 'hidden' : 'visible';
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
    b.setAttribute('aria-pressed', settings.lessons.includes(l));
    b.onclick = () => {
      const i = settings.lessons.indexOf(l);
      i < 0 ? settings.lessons.push(l) : settings.lessons.splice(i, 1);
      save(KEY_S, settings); refreshHome();
    };
    box.appendChild(b);
  }
  $('inc-ref').checked = settings.ref;
  document.querySelectorAll('#seg-script button').forEach(b =>
    b.setAttribute('aria-pressed', b.dataset.s === settings.script));
}

function refreshStats() {
  const seen = Object.keys(progress).length;
  const learned = Object.values(progress).filter(p => p.b >= 3).length;
  const tot = Object.values(progress).reduce((a, p) => a + p.n, 0);
  const cor = Object.values(progress).reduce((a, p) => a + p.c, 0);
  $('stat-sum').innerHTML =
    '<div><b>' + seen + '</b><span>үзсэн</span></div>' +
    '<div><b>' + learned + '</b><span>тогтсон</span></div>' +
    '<div><b>' + ALL.length + '</b><span>нийт үг</span></div>' +
    '<div><b>' + (tot ? Math.round(100 * cor / tot) : 0) + '%</b><span>зөв хариулт</span></div>';

  const box = $('stat-lessons'); box.innerHTML = '';
  for (const l of [...new Set(ALL.map(i => i.lesson))].sort((a, b) => a - b)) {
    const items = ALL.filter(i => i.lesson === l && !i.ref);
    const k = items.filter(i => (progress[i.id] || {}).b >= 3).length;
    const d = document.createElement('div');
    d.className = 'l';
    d.innerHTML = '<span>L' + l + '</span><span class="track"><span class="fill" style="width:' +
      (100 * k / Math.max(items.length, 1)) + '%"></span></span>' +
      '<span class="num">' + k + '/' + items.length + '</span>';
    box.appendChild(d);
  }
}

/* ══════════════════════ 8. Холбоос ══════════════════════ */

document.querySelectorAll('.mode').forEach(b =>
  b.onclick = () => startSession(b.dataset.mode, false));
$('btn-review').onclick = () => startSession('choice', true);
$('btn-home').onclick = () => { show('home'); refreshHome(); };
$('btn-stats').onclick = () => { refreshStats(); show('stats'); };
$('sel-all').onclick = () => { settings.lessons = [...new Set(ALL.map(i => i.lesson))]; save(KEY_S, settings); refreshHome(); };
$('sel-none').onclick = () => { settings.lessons = []; save(KEY_S, settings); refreshHome(); };
$('inc-ref').onchange = e => { settings.ref = e.target.checked; save(KEY_S, settings); refreshHome(); };
document.querySelectorAll('#seg-script button').forEach(b =>
  b.onclick = () => { settings.script = b.dataset.s; save(KEY_S, settings); refreshHome(); });

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
$('btn-speak').onclick = () => speak(cur.kana || cur.jp);

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

/* Гүн холбоос: index.html#m=type гэвэл шууд тэр горимоор эхэлнэ.
   Хавчуургаас шууд дасгал руу орох, мөн дэлгэцийг шалгахад хэрэгтэй. */
function autoStart() {
  const s = (location.hash.match(/s=(kanji|kana)/) || [])[1];
  if (s) { settings.script = s; save(KEY_S, settings); refreshHome(); }
  const m = (location.hash.match(/m=(flash|choice|type|listen)/) || [])[1];
  if (m) startSession(m, false);
}

fetch('data/vocab.json')
  .then(r => r.json())
  .then(d => { ALL = d.items; show('home'); refreshHome(); autoStart(); })
  .catch(() => {
    document.getElementById('home').innerHTML =
      '<p class="warn">Үгийн сан ачаалагдсангүй. <code>data/vocab.json</code> байгаа эсэхийг шалгана уу. ' +
      'Файлыг шууд нээвэл (file://) браузер хориглодог — жижиг сервер ажиллуулна уу: ' +
      '<code>python -m http.server</code></p>';
  });
