/* v2-ийн «Ханз» өгөгдөл (v2/kanji.js) — хөтөчгүй шалгалт:
 *     node tools/test_v2_kanji.js
 *
 *   1. jisho.org-ийн жагсаалт (tools/v2_kanji_order.txt): N5 79, N4 166,
 *      давхардалгүй, хоёр түвшин огтлолцохгүй; kanji.js нь ЯГ тэр дараалал;
 *   2. утга, түвшин нь v1-ийн data/kanji.json-оос зөрөөгүй (гараар засаагүй);
 *   3. уншлага: он — катакана, кун — хирагана (окуригана «.»), «-» үлдээгүй;
 *   4. жишээ үг (≤3): тухайн ханзтай, уншлага зөвхөн кана, бичлэг диск дээр.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'v2/kanji.js'), 'utf8'), ctx, { filename: 'v2/kanji.js' });
const K = ctx.window.KOTO_KANJI;
const V1 = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(ROOT, 'data/kanji.json'), 'utf8')).items.map(x => [x.c, x]));
const order = {};
for (const line of fs.readFileSync(path.join(ROOT, 'tools/v2_kanji_order.txt'), 'utf8').split('\n')) {
  if (!line.trim() || line.startsWith('#')) continue;
  const [lv, chars] = line.trim().split(/\s+/);
  order[lv] = [...chars];
}

let good = 0, bad = 0;
function ok(name, pass, detail) {
  if (pass) { good++; console.log('  ok   ' + name); }
  else { bad++; console.log('  FAIL ' + name + (detail ? '  ' + String(detail).slice(0, 500) : '')); }
}

console.log('\n[1] Жагсаалт ба дараалал (jisho.org)');
const n5 = order.N5 || [], n4 = order.N4 || [], n3 = order.N3 || [];
ok('N5 79, N4 166, N3 367 (11-05), давхардалгүй, огтлолцохгүй',
  n5.length === 79 && n4.length === 166 && n3.length === 367 && new Set([...n5, ...n4, ...n3]).size === 79 + 166 + 367,
  JSON.stringify({ n5: n5.length, n4: n4.length, n3: n3.length }));
/* 11-05: Irodori-гийн 3 номын үгсэд гардаг ч N5–N3-т ороогүй 397 — N2 (jisho) ба NX «Бусад» (jisho-д JLPT шошгогүй). */
const n2 = order.N2 || [], nx = order.NX || [];
ok('N2 189, Бусад 208 — давхардалгүй, N5–N3-тай огтлолцохгүй',
  n2.length === 189 && nx.length === 208 && new Set([...n5, ...n4, ...n3, ...n2, ...nx]).size === 612 + 397, JSON.stringify({ n2: n2.length, nx: nx.length }));
const seq = K.map(k => k.c).join(''), want = n5.join('') + n4.join('') + n3.join('') + n2.join('') + nx.join('');
ok('kanji.js нь дарааллаар (N5 → N4 → N3 → N2 → Бусад), түвшин зөв (n 5·4·3·2·0)',
  seq === want && K.every((k, i) => k.n === (i < 79 ? 5 : i < 245 ? 4 : i < 612 ? 3 : i < 801 ? 2 : 0)), seq === want ? '' : 'дараалал зөрсөн');
/* Irodori-гийн бүлгийн дараалал = ҮГИЙН САНГИЙН замд анх гарах (тестийн өөрийн тооцоо, §2.91): нэгжийн дарааллаар
   үгсийг гүйж, kj-д нь ханз анх гарсан байрлал; замд гараагүй бол нэмэлт (extra) үгсийн дараа. */
const vctx = { window: {} }; vm.createContext(vctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'v2/data.js'), 'utf8'), vctx, { filename: 'v2/data.js' });
const VW = vctx.window.KOTO_DATA.units.flatMap(u => u.words).concat(vctx.window.KOTO_DATA.extra);
const firstAt = c => { const i = VW.findIndex(w => (w.kj || '').includes(c)); return i < 0 ? Infinity : i; };
const mono = list => list.every((c, i) => !i || firstAt(list[i - 1]) <= firstAt(c));
ok('N2 ба Бусад — үгийн сангийн замд анх гарах дарааллаар; бүгд замд эсвэл нэмэлт үгэнд гардаг',
  mono(n2) && mono(nx) && [...n2, ...nx].every(c => firstAt(c) < Infinity), [...n2, ...nx].filter(c => firstAt(c) === Infinity).join(''));
/* Номын шошго b: v1-ийн хичээлийн жагсаалт (l 入門, l1 初級1, l2 初級2) — тестийн өөрийн тодорхойлолтоор. */
const BK = [['l', 'A1'], ['l1', 'A2a'], ['l2', 'A2b']];
const bbad = K.filter(k => { const x = V1[k.c] || {}; const want = BK.filter(([f]) => (x[f] || []).length).map(([, b]) => b);
  return JSON.stringify(k.b || []) !== JSON.stringify(want); }).map(k => k.c);
ok('номын шошго (b) = v1-ийн Irodori-гийн хичээлийн жагсаалт; N2 ба Бусад бүгд шошготой (' + K.filter(k => k.b).length + ' ханз)',
  !bbad.length && K.filter(k => k.n <= 2).every(k => k.b && k.b.length), bbad.slice(0, 20).join(''));

console.log('\n[2] v1-тэй тулгалт');
const drift = K.filter(k => !V1[k.c] || V1[k.c].mn.trim() !== k.mn || (V1[k.c].n || 0) !== k.n || V1[k.c].id !== k.id).map(k => k.c);
ok('утга, түвшин, id нь v1-ийн data/kanji.json-тай ижил', !drift.length, drift.join(''));
ok('бүх ханзанд монгол утга, зурлагын тоо', K.every(k => k.mn && k.s > 0), K.filter(k => !k.mn || !(k.s > 0)).map(k => k.c).join(''));

console.log('\n[3] Уншлага');
const KATA = /^[ァ-ヺー]+$/, HIRA = /^[ぁ-ゖー]+(\.[ぁ-ゖー]+)?$/;
const rbad = K.filter(k => !(k.on.length + k.kun.length) || k.on.some(r => !KATA.test(r)) || k.kun.some(r => !HIRA.test(r))).map(k => k.c + ':' + k.on.join(',') + '/' + k.kun.join(','));
ok('он — катакана, кун — хирагана (окуригана «.»), «-» үлдээгүй, ядаж нэг уншлага', !rbad.length, rbad.slice(0, 8).join(' | '));

console.log('\n[4] Жишээ үг');
const KANA = /^[ぁ-ゖァ-ヺー]+$/;
const ex = K.flatMap(k => k.ex.map(e => ({ k, e })));
const ebad = ex.filter(({ k, e }) => !e.jp.includes(k.c) || !KANA.test(e.kana) || /[／～（）()]/.test(e.jp) || !e.mn);
ok('жишээ бүр тухайн ханзтай, уншлага зөвхөн кана, хог тэмдэгтгүй, утгатай (' + ex.length + ')', !ebad.length, ebad.slice(0, 5).map(({ k, e }) => k.c + ':' + e.jp + '/' + e.kana).join(' | '));
const au = ex.filter(({ e }) => !e.au || !fs.existsSync(path.join(ROOT, 'audio', e.au + '.mp3')));
ok('жишээ бүр бичлэгтэй (audio/<au>.mp3 байна)', !au.length, au.slice(0, 5).map(({ e }) => e.jp).join(' '));
/* 11-05: жишээ үгийн сан 432 → 2994 (Irodori 3 ном) ба «簡単（な）», «～区 （南区）» хэлбэрийг задалдаг болсон —
   万 ба N3-ийн 6 ханз жишээтэй болов. Үлдсэнд эх сурвалжид жишээ алга (эзэн «жишээгүй үлдээ»). */
const noEx = K.filter(k => k.n >= 4 && !k.ex.length).map(k => k.c).join(''), noEx3 = K.filter(k => k.n === 3 && !k.ex.length).length;
const noExI = K.filter(k => k.n <= 2 && !k.ex.length).map(k => k.c).join('');
ok('ханз бүрт ≤3 жишээ; жишээгүй нь N5/N4-т 5 (六答研究洋), N3-т 72, N2 ба Бусадт 0 (бүгд Irodori-гийн үгэнд гардаг)',
  K.every(k => k.ex.length <= 3) && noEx === '六答研究洋' && noEx3 === 72 && noExI === '', noEx + ' / N3 ' + noEx3 + ' / ' + noExI);
const short3 = K.filter(k => k.ex.length && k.ex[0].jp.length > 3 && k.ex.some(e => e.jp.length <= 3)).map(k => k.c);
ok('эхний жишээ богино үг (≤ 3 тэмдэгт байвал түрүүнд — «生年月日» биш «年»)', !short3.length, short3.join(''));

console.log('\n[5] Үүсэл (tools/v2_kanji_origin.tsv → o)');
const TYPES = ['pic', 'ind', 'ic', 'psc', 'unk'];
const URO = /^[一-鿿〇]$/;
const cntOf = f => Object.fromEntries(TYPES.map(t => [t, K.filter(k => k.o && k.o.t === t && f(k)).length]));
const cnt = cntOf(k => k.n >= 4), cnt3 = cntOf(k => k.n === 3), cntI = cntOf(k => k.n <= 2);
ok('ханз бүрт үүсэл, төрөл 5-ын нэг: N5+N4 — зургаас 56 · тэмдгээр 15 · нийлсэн 50 · утга+дуу 107 · маргаантай 17 (青 — Astra 11-04); N3 — 35 · 5 · 69 · 246 · 12 (盗 — эх сурвалжаар өөр үг)',
  K.every(k => k.o && TYPES.includes(k.o.t)) && cnt.pic === 56 && cnt.ind === 15 && cnt.ic === 50 && cnt.psc === 107 && cnt.unk === 17 &&
  cnt3.pic === 35 && cnt3.ind === 5 && cnt3.ic === 69 && cnt3.psc === 246 && cnt3.unk === 12, JSON.stringify([cnt, cnt3]));
ok('Irodori-гийн N2 ба Бусад 397: зургаас 36 · тэмдгээр 7 · нийлсэн 52 · утга+дуу 284 · маргаантай 18 (Wiktionary-гаас автомат + агентын тайлбар)',
  cntI.pic === 36 && cntI.ind === 7 && cntI.ic === 52 && cntI.psc === 284 && cntI.unk === 18, JSON.stringify(cntI));
const parts = K.flatMap(k => (k.o.p || []).map(p => ({ k, p })));
const pbad = parts.filter(({ p }) => !URO.test(p.c) || (p.r && !['s', 'p'].includes(p.r)) || (p.on && (p.r !== 'p' || !KATA.test(p.on))));
ok('хэсэг бүр нэг тэмдэгт, CJK үндсэн хүрээнд (бүх фонтод), роль s/p, уншлага зөвхөн дууны хэсэгт ба катакана (' + parts.length + ')',
  !pbad.length, pbad.slice(0, 6).map(({ k, p }) => k.c + ':' + JSON.stringify(p)).join(' | '));
const rolebad = K.filter(k => (k.o.t === 'psc' && (k.o.p || []).some(p => !p.r)) || (k.o.t === 'ic' && (k.o.p || []).some(p => p.r))).map(k => k.c);
ok('утга+дуу ханзны хэсэг бүр рольтой, нийлсэн ханзных рольгүй', !rolebad.length, rolebad.join(''));
const mbad = parts.filter(({ k, p }) => Boolean(p.m) !== Boolean(p.on && k.on.includes(p.on)));
ok('«уншлага таарсан» (m) нь дууны хэсгийн уншлага ханзны он уншлагад байгаа үед Л (' + parts.filter(({ p }) => p.m).length + ')',
  !mbad.length, mbad.slice(0, 6).map(({ k, p }) => k.c + ':' + p.c + p.on + '/' + k.on.join(',')).join(' | '));
const txt = K.flatMap(k => [k.o.tx || '', k.o.pc || '', ...(k.o.p || []).map(p => p.mn || '')].map(s => ({ k, s })));
const tbad = txt.filter(({ s }) => /[A-Za-z{}\[\]|<>]/.test(s) || [...s].some(ch => /\p{Script=Han}/u.test(ch) && !URO.test(ch)));
ok('тайлбарт латин/вики хог алга, ханз бүр CJK үндсэн хүрээнд', !tbad.length, tbad.slice(0, 6).map(({ k, s }) => k.c + ':' + s.slice(0, 40)).join(' | '));
const oldbad = K.filter(k => k.o.old && (!URO.test(k.o.old) || k.o.old === k.c)).map(k => k.c);
ok('хуучин хэлбэр (old) нь нэг өөр тэмдэгт (' + K.filter(k => k.o.old).length + ')', !oldbad.length, oldbad.join(''));
const noTx = K.filter(k => k.o.t !== 'psc' && !k.o.tx).map(k => k.c);
ok('утга+дуугаас бусад бүх ханз тайлбартай', !noTx.length, noTx.join(''));

console.log('\n[6] Эртний бичиг (v2/kanji-old, tools/v2_kanji_old.tsv)');
const OLD = path.join(ROOT, 'v2/kanji-old');
const files = fs.existsSync(OLD) ? fs.readdirSync(OLD).filter(f => f.endsWith('.svg')) : [];
const withA = K.filter(k => k.o.a);
const ERAS = ['oracle', 'bronze', 'seal'];
const wantFiles = withA.flatMap(k => k.o.a.map(e => k.id + '-' + e + '.svg')).sort();
ok('a ↔ файл: үе бүрт kanji-old/<id>-<үе>.svg, илүү файл алга, үе нь хувьслын дарааллаар (' + withA.length + ' ханз, ' + wantFiles.length + ' файл)',
  withA.length > 0 && JSON.stringify(wantFiles) === JSON.stringify(files.slice().sort()) &&
  withA.every(k => Array.isArray(k.o.a) && k.o.a.length && k.o.a.every((e, i) => ERAS.includes(e) && (!i || ERAS.indexOf(k.o.a[i - 1]) < ERAS.indexOf(e)))),
  JSON.stringify({ a: withA.length, want: wantFiles.length, files: files.length, extra: files.filter(f => !wantFiles.includes(f)).slice(0, 3) }));
ok('эртний бичиг нь утга+дуу биш ханзад л', withA.every(k => k.o.t !== 'psc'), withA.filter(k => k.o.t === 'psc').map(k => k.c).join(''));
const tsv = fs.readFileSync(path.join(ROOT, 'tools/v2_kanji_old.tsv'), 'utf8').split('\n').filter(l => l && !l.startsWith('#')).map(l => l.split('\t'));
const tsvKey = Object.fromEntries(tsv.map(r => [r[0] + '|' + r[2], r]));
const libad = withA.flatMap(k => k.o.a.map(e => [k, e, tsvKey[k.c + '|' + e]])).filter(([k, e, r]) => !r || !['Public domain', 'CC0'].includes(r[4]) || r[3] !== r[1] + '-' + e + '.svg');
ok('файл бүрийн эх (Commons), лиценз (Public domain / CC0) бүртгэлтэй', !libad.length, libad.slice(0, 6).map(([k, e]) => k.c + e).join(' '));
/* SVG-ийн тушаал бүр тодорхой тооны тоо авна (c → 6-аар). «1.54-0.04»-ийг тоймлоход хасах тусгаарлагч
   алга болж «1.50» болж нийлж байв (11-04) — тоо дутвал энэ барина. */
const ARITY = { m: 2, l: 2, t: 2, h: 1, v: 1, c: 6, s: 4, q: 4, a: 7, z: 0 };
function pathOk(d) {
  let cmd = null, n = 0;
  const flush = () => cmd === null || (ARITY[cmd] === 0 ? n === 0 : n > 0 && n % ARITY[cmd] === 0);
  for (const t of String(d).match(/[a-zA-Z]|-?(?:\d*\.\d+|\d+)(?:e-?\d+)?/g) || []) {
    if (/[a-zA-Z]/.test(t)) { if (!flush() || !(t.toLowerCase() in ARITY)) return false; cmd = t.toLowerCase(); n = 0; } else n++;
  }
  return flush();
}
const svgbad = files.filter(f => {
  const s = fs.readFileSync(path.join(OLD, f), 'utf8');
  return s.length > 20000 || !/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="[-0-9. ]+">/.test(s) || /<script|<foreignObject|<image|<use|\son[a-z]+=|href|url\(|javascript:/i.test(s) || !/<(path|polygon|polyline|rect|circle|ellipse|line)\b/.test(s) ||
    [...s.matchAll(/\sd="([^"]*)"/g)].some(m => !pathOk(m[1]));
});
ok('SVG цэвэр: viewBox-той, дүрстэй, script/холбоос/url алга, ≤20 КБ, зам бүрийн тоо зөв', !svgbad.length, svgbad.slice(0, 6).join(' '));

console.log('\n[7] KanjiVG — зурлага ба хэсэг (v2/kanji-vg)');
const VG = Object.fromEntries(K.map(k => { const p = path.join(ROOT, 'v2/kanji-vg', k.id + '.json'); return [k.c, fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null]; }));
const vgFiles = fs.existsSync(path.join(ROOT, 'v2/kanji-vg')) ? fs.readdirSync(path.join(ROOT, 'v2/kanji-vg')).filter(f => f.endsWith('.json')) : [];
ok('1009 ханз бүрт kanji-vg/<id>.json, илүү файл алга', K.every(k => VG[k.c]) && vgFiles.length === 1009, vgFiles.length);
/* 餅: 2010 оны жоёо-д 食-хэсэгтэй 15 зурлага (KanjiVG), KANJIDIC2 хуучин 飠-хэлбэрийн 14 — хоёр эх өөр хэлбэр. */
const sbad = K.filter(k => VG[k.c] && VG[k.c].s.length !== k.s && !(k.c === '餅' && VG[k.c].s.length === 15 && k.s === 14)).map(k => k.c + VG[k.c].s.length + '/' + k.s);
ok('зурлагын тоо KANJIDIC-ийн тоотой ИЖИЛ (бие даасан хоёр эх; 餅 — жоёо 2010-ын хэлбэр)', !sbad.length, sbad.join(' '));
const pbad2 = K.filter(k => { const v = VG[k.c]; if (!v) return true; const np = (k.o.p || []).length;
  return !/^0 0 109 109$/.test(v.vb) || v.s.some(([d, p]) => !pathOk(d) || !Number.isInteger(p) || p < -1 || p >= np) || (v.ok && (!np || [...Array(np).keys()].some(i => !v.s.some(s => s[1] === i)))) || (!v.ok && v.s.some(s => s[1] !== -1)) || v.n.length !== v.s.length; }).map(k => k.c);
ok('зам бүрийн тоо зөв, хэсгийн дугаар o.p-д, будах (ok) үед хэсэг бүр зурлагатай, бусад үед будалтгүй, дугаарын байрлал зурлага бүрт', !pbad2.length, pbad2.join(''));
ok('будаж болох ' + K.filter(k => VG[k.c] && VG[k.c].ok).length + ' ханз (хэсэгтэй ' + K.filter(k => (k.o.p || []).length).length + '-аас); 語-ийн 言 утга, 吾 дуу', VG['語'] && VG['語'].ok && VG['語'].s.slice(0, 7).every(s => s[1] === 0) && VG['語'].s.slice(7).every(s => s[1] === 1));
const fbad = K.filter(k => (k.o.f || []).some(([x, ...m]) => !(k.o.p || []).some(p => p.c === x) || !m.length || m.length > 12 || m.includes(k.c) || m.some(c => !K.some(y => y.c === c)) || new Set(m).size !== m.length)).map(k => k.c);
ok('гэр бүл (o.f): хэсэг нь o.p-д, гишүүд жагсаалтад, өөрөө ороогүй, ≤12; 寺 → 時 持 特 待 等 (N3-ийн 等 = 竹 + 寺) (' + K.filter(k => k.o.f).length + ' ханз)',
  !fbad.length && JSON.stringify((K.find(k => k.c === '時').o.f || []).find(f => f[0] === '寺')) === JSON.stringify(['寺', '持', '特', '待', '等']), fbad.join(''));
/* Гэр бүл ДЭЭД түвшний бүрэлдэхүүнээр — 彳 (行 後), 隹 (集), 化 (花) доторх 亻-хэлбэр «хүн»-ий гэр бүлд орохгүй (11-04). */
const hito = ((K.find(k => k.c === '休').o.f || []).find(f => f[0] === '亻') || []).slice(1);
ok('休-ийн 亻 (хүн) гэр бүл: 何 作 住 … орсон, 行 後 集 花 (дотроо 亻-хэлбэртэй ч өөр хэсэг) ороогүй',
  ['何', '作', '住'].every(c => hito.includes(c)) && !['行', '後', '集', '花'].some(c => hito.includes(c)), hito.join(''));

console.log('\n[8] KOTO-ийн тайлбар зураг (v2/kanji-pics.js)');
vm.runInContext(fs.readFileSync(path.join(ROOT, 'v2/kanji-pics.js'), 'utf8'), ctx, { filename: 'v2/kanji-pics.js' });
const PICS = ctx.window.KOTO_KANJI_PICS || {};
const wantPc = K.filter(k => k.o.pc).map(k => k.c).sort().join(''), havePc = Object.keys(PICS).sort().join('');
ok('зураг ↔ pc: зургийн нэртэй ханз бүрт зураг, илүү зураг алга (' + K.filter(k => k.o.pc).length + ')', wantPc === havePc,
  'дутуу: ' + [...wantPc].filter(c => !PICS[c]).join('') + ' · илүү: ' + Object.keys(PICS).filter(c => !wantPc.includes(c)).join(''));
const picbad = Object.entries(PICS).filter(([, s]) => {
  const tags = [...String(s).matchAll(/<\s*\/?\s*([a-zA-Z]+)/g)].map(m => m[1]);
  return !tags.length || tags.some(t => !['path', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'rect', 'g'].includes(t)) ||
    /\son[a-z]+\s*=|href|url\(|javascript:|<script|style\s*=/i.test(s);
});
const CATN = { nature: 11, body: 20, living: 9, things: 12 }, cats = {};
for (const k of K) if (k.o.g) cats[k.o.g] = (cats[k.o.g] || 0) + 1;
ok('галерейн ангилал (o.g): зурагтай ханз бүрт, зураггүйд алга — байгаль 11 · хүн, бие 20 · амьтан, ургамал 9 · эд зүйл 12',
  K.every(k => !!k.o.g === !!k.o.pc) && Object.keys(CATN).every(g => cats[g] === CATN[g]) && Object.keys(cats).length === 4, JSON.stringify(cats));
ok('зураг бүр зөвхөн дүрсний элементтэй (path, circle …), script/холбоос/url/style алга', !picbad.length, picbad.map(([c]) => c).join(''));

console.log('\n──────────────');
console.log('цэвэр: ' + good + '   унасан: ' + bad);
process.exit(bad ? 1 : 0);
