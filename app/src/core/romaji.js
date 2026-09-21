/* Латин -> кана хөрвүүлэлт ба хариулт шалгалт. app.js-ээс ҮНЭНЧ порт:
   логик ижил, зөвхөн ES export. tools/test_answers.js энэ логикийг шалгадаг. */

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

/** ДУУДЛАГЫН хувилбарууд: топик бөөс は/へ/を нь бичлэгээрээ は/へ/を боловч
 *  дуудлагаараа wa/e/o (こんにちは→konnichiwa, 〜を→o, 〜へ→e). Ромажи талбар
 *  байхгүй сангуудад (el1/el2/n5) хэрэглэгч байгалийн дуудлагаар бичихэд
 *  татгалздаг байсныг засна. Бичлэг ба дуудлага ХОЁУЛЫГ хүлээж авна тул
 *  は=ha үг (はい, はたけ) хэвээр зөв.
 *
 *  を нь бараг үргэлж бөөс тул аюулгүй; は/へ нь үгэн дотор ч гарах тул
 *  хоёуланг зөвшөөрснөөр буруу дуудлагыг ч хүлээх эрсдэлтэй — гэхдээ зөв
 *  хариултыг ТАТГАЛЗАХААС хамаагүй дээр (сурагч бичих дасгал). */
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
    if (out.length > 64) return [s];   // хэт олон бөөстэй үгэнд тэсрэхээс сэргийлнэ
  }
  return out;
}

/** Зөвшөөрөгдөх хариултууд: ／-ээр салгасан хувилбар бүр, ромажийн хувилбар. */
function answerSet(item) {
  const set = new Set();
  const add = v => { if (v) set.add(v); };
  // Кана хэлбэрт дуудлагын хувилбаруудыг нэмнэ (は→わ, へ→え, を→お).
  const addKana = v => { for (const x of readingVariants(v)) add(x); };
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
  return set.has(normKana(toKana(raw))) || set.has(normRomaji(raw));
}

/* ══════════════════════ 3. Явц (localStorage) ══════════════════════ */

export { toKana, checkTyped, normKana, normRomaji, answerSet, readingVariants, KANA_MAP };
