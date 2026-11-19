# -*- coding: utf-8 -*-
"""«Өөрийгөө сорих» — JLPT N5 хэлбэрийн шалгалтын ханз ба үгсийн сангийн асуултын сан (2026-11-18).

Албан ёсны JLPT асуултыг ХУУЛАХГҮЙ (jlpt.jp/policy.html: зөвхөн хувийн сурах, ангийн хэрэгцээнд). Бүтэц нь
албан ёсных (jlpt.jp/guideline/testsections.html), асуулт нь өөрсдийн N5 үгийн жагсаалтаас (data/vocab-n5.json,
1–25-р хичээл) автоматаар:

  漢字読み (kanji)   — жишээ өгүүлбэр дэх үгийг ханзаар бичээд уншлагыг сонгуулна;
  表記     (hyouki)  — канагаар бичсэн үгийн ханз/катакана бичлэгийг сонгуулна;
  文脈規定 (bunmyaku) — үгийг хоосолж, ижил төрлийн үгсээс сонгуулна (давхар зөв байж болох тул Codex шалгана).

Буруу сонголтыг дүрмээр үүсгэж JMdict-ээр шүүнэ: тухайн бичлэгийн ЖИНХЭНЭ уншлага, тухайн уншлагын жинхэнэ
бичлэг буруу сонголт болохгүй. JMdict © EDRDG, CC BY-SA 4.0 (репод ОРОХГҮЙ, зам аргументаар).

    python -I tools/build_v2_n5test.py <jmdict-eng-*.json>
"""
import io, json, os, random, re, sys
sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CJK = re.compile(u'[一-鿿々]')
KATA = re.compile(u'^[ァ-ヺー]+$')
BAD = re.compile(u'[-/～〜（）()・…。、?？!！\\s]')
problems = []

# ── Эх өгөгдөл ──
vocab = [x for x in json.load(io.open(os.path.join(ROOT, 'data', 'vocab-n5.json'), encoding='utf-8'))['items'] if x['lesson'] <= 25]
# Нэмэлт N5 үг (11-19a): 1–25-р хичээлд ханзаар бичигдээгүй/жишээгүй N5 үгс — зөвхөн 漢字読み · 表記-д. Уншлагыг JMdict-ээр
# шалгана; буруу сонголтыг эхлээд дүрмээр, хүрэхгүй бол `d`-ээс (JMdict-ийн жинхэнэ уншлага биш бол) авна.
_xp = os.path.join(ROOT, 'data', 'n5', 'kanji_words.json')
extra = [dict(x, lesson=0) for x in json.load(io.open(_xp, encoding='utf-8'))['items']] if os.path.exists(_xp) else []
kjs = io.open(os.path.join(ROOT, 'v2', 'kanji.js'), encoding='utf-8').read()
N5K = {k['c'] for k in json.loads(re.search(r'=\s*(\[.*\])', kjs, re.S).group(1)) if k.get('n') == 5}
jm = json.load(io.open(sys.argv[1], encoding='utf-8'))['words']
READ = {}     # бичлэг → бүх уншлага
WRITE = {}    # уншлага → бүх бичлэг (ханз)
POS = {}      # (бичлэг|уншлага) → үгийн аймгийн багц
for e in jm:
    ks = [k['text'] for k in e['kanji']]
    rs = [r['text'] for r in e['kana']]
    pos = {p for s in e['sense'] for p in s['partOfSpeech']}
    for k in ks:
        READ.setdefault(k, set()).update(rs)
    for r in rs:
        WRITE.setdefault(r, set()).update(ks)
        POS.setdefault(r, set()).update(pos)
    for k in ks:
        POS.setdefault(k, set()).update(pos)

# ── Канагийн шилжүүлэг (уншлагын буруу сонголт) ──
H = u'かきくけこさしすせそたちつてとはひふへほ'
G = u'がぎぐげござじずぜぞだぢづでどばびぶべぼ'
P = {u'は': u'ぱ', u'ひ': u'ぴ', u'ふ': u'ぷ', u'へ': u'ぺ', u'ほ': u'ぽ'}
TO_G = dict(zip(H, G)); TO_H = dict(zip(G, H))
O_ROW = set(u'おこそとのほもよろごぞどぼぽょ')
E_ROW = set(u'えけせてねへめれげぜでべぺ')
SMALL = {u'ゃ': u'や', u'ゅ': u'ゆ', u'ょ': u'よ'}
BIG = {v: k for k, v in SMALL.items()}
TSU_OK = set(u'かきくけこさしすせそたちつてとぱぴぷぺぽ')


def kana_variants(k):
    """{хувилбар: (төрөл, оноо)} — JLPT-ийн буруу сонголт шиг итгэмээр алдаа (урт эгшиг, っ, цэг) өндөр оноотой."""
    out = {}
    def add(v, kind, score):
        if v != k and v and v[0] not in u'っゃゅょんー' and u'っっ' not in v and (v not in out or out[v][1] < score):
            out[v] = (kind, score)
    last = len(k) - 1
    for i, c in enumerate(k):
        nxt = k[i + 1] if i < last else ''
        if c in TO_G and c not in u'ちつ':
            add(k[:i] + TO_G[c] + k[i + 1:], 'dk', 3 if i == 0 else 1)
        if c in TO_H and c not in u'ぢづ':
            add(k[:i] + TO_H[c] + k[i + 1:], 'dk', 3 if i == 0 else 2)
        if c in P:
            add(k[:i] + P[c] + k[i + 1:], 'dk', 1)
        if c in SMALL:
            add(k[:i] + SMALL[c] + k[i + 1:], 'yo', 2)
        if c in BIG and i > 0 and k[i - 1] in u'きしちにひみりぎじびぴ':
            add(k[:i] + BIG[c] + k[i + 1:], 'yo', 2)
        if c == u'う' and i > 0 and k[i - 1] in O_ROW:
            add(k[:i] + k[i + 1:], 'long', 3)
        if c == u'い' and i > 0 and k[i - 1] in E_ROW:
            add(k[:i] + k[i + 1:], 'long', 3)
        if c in O_ROW and nxt not in (u'う', u'ん', u'っ') and (i == last or nxt in TSU_OK or nxt in TO_H):
            add(k[:i + 1] + u'う' + k[i + 1:], 'long', 2)
        if c == u'っ':
            add(k[:i] + k[i + 1:], 'tsu', 3)
        if 0 < i < last and c in TSU_OK and k[i - 1] not in u'っんーうい' and u'っ' not in k:
            add(k[:i] + u'っ' + k[i:], 'tsu', 2)
    return out


KJ_READ = {}
for _k in json.load(io.open(os.path.join(ROOT, 'data', 'kanji.json'), encoding='utf-8'))['items']:
    rs = {''.join(chr(ord(c) - 0x60) if u'ァ' <= c <= u'ヶ' else c for c in r) for r in _k.get('on', [])}
    rs |= {r.split('.')[0].strip('-') for r in _k.get('kun', [])}
    KJ_READ[_k['c']] = {r for r in rs if r and re.fullmatch(u'[ぁ-ゖー]+', r)}


def segments(jp, kana):
    """«学生/がくせい» → [('学','がく'),('生','せい')] — ханз бүрийн уншлага kanji.json-д байх ёстой (ганцхан хуваалт)."""
    runs = re.findall(u'[\u4e00-\u9fff々]|[^\u4e00-\u9fff々]+', jp)
    found = []
    def go(i, pos, acc):
        if len(found) > 1:
            return
        if i == len(runs):
            if pos == len(kana):
                found.append(list(acc))
            return
        r = runs[i]
        if not CJK.match(r):
            if kana.startswith(r, pos):
                go(i + 1, pos + len(r), acc + [(r, r)])
            return
        for rd in sorted(KJ_READ.get(r, ()), key=len, reverse=True):
            for v in {rd, rd[:-1] + u'っ' if rd[-1] in u'つくち' else rd, (TO_G.get(rd[0], rd[0]) + rd[1:])}:
                if kana.startswith(v, pos):
                    go(i + 1, pos + len(v), acc + [(r, v)])
    go(0, 0, [])
    return found[0] if len(found) == 1 else None


def alt_readings(jp, kana):
    """Нэг ханзны уншлагыг тэр ханзны ӨӨР уншлагаар солино — JLPT-ийн буруу сонголтын гол төрөл."""
    seg = segments(jp, kana)
    out = {}
    if not seg:
        return out
    for i, (c, rd) in enumerate(seg):
        if not CJK.match(c):
            continue
        for other in KJ_READ.get(c, ()):
            if other != rd and len(other) <= len(rd) + 2 and (len(other) >= 2 or len(rd) == 1):
                v = ''.join(r for _, r in seg[:i]) + other + ''.join(r for _, r in seg[i + 1:])
                if v != kana:
                    out[v] = ('alt', 4)
    return out


def kanji_spans(jp, kana):
    """Ханзны уншлагын муж (эхлэл, төгсгөл) — кана хэсэг (お, の, ます …) хөдлөхгүй. «お母さん/おかあさん» → [(1, 3)]."""
    runs = re.findall(u'[\u4e00-\u9fff々]+|[^\u4e00-\u9fff々]+', jp)
    pat = ''.join('(.+?)' if CJK.match(r[0]) else '(' + re.escape(r) + ')' for r in runs)
    m = re.fullmatch(pat, kana)
    if not m:
        return []
    return [m.span(i + 1) for i, r in enumerate(runs) if CJK.match(r[0])]


def in_spans(k, v, spans):
    """Хувилбар зөвхөн ханзны мужид өөрчлөгдсөн эсэх: хоёр талын кана хэсэг яг хэвээр."""
    if not spans:
        return False
    head, tail = spans[0][0], len(k) - spans[-1][1]
    return v[:head] == k[:head] and (tail == 0 or v[-tail:] == k[-tail:]) and len(v) - tail > head


def pick_kana(rng, variants, real, n=3):
    """Оноогоор эрэмбэлж, нэг төрлөөс хамгийн ихдээ 2 — ижил хэв маягийн 3 сонголт гарахгүй."""
    cand = sorted((v, t, sc) for v, (t, sc) in variants.items() if v not in real)  # set-ийн эрэмбэ ажиллуулах бүрд өөр — эрэмбэлээд холино
    rng.shuffle(cand)
    cand.sort(key=lambda x: -x[2])
    out, kinds = [], {}
    for v, t, sc in cand:
        if kinds.get(t, 0) >= 2:
            continue
        out.append(v); kinds[t] = kinds.get(t, 0) + 1
        if len(out) == n:
            break
    return out


VERB_END = {u'き': u'く', u'ぎ': u'ぐ', u'し': u'す', u'ち': u'つ', u'に': u'ぬ', u'び': u'ぶ', u'み': u'む', u'り': u'る', u'い': u'う'}


IRREG = {u'来ます': [(u'来る', u'くる')]}  # дүрмийн бус: ます-ийн угаас толь бичгийн хэлбэр гарахгүй


def dict_forms(jp, kana):
    """«行きます/いきます» → JMdict-д байгаа толь бичгийн хэлбэр [(行く, いく, 'き'→'く')]. Олдохгүй бол []."""
    if jp in IRREG and kana == u'きます':
        return [(dj, dr) for dj, dr in IRREG[jp] if dr in READ.get(dj, set())]
    if not (jp.endswith(u'ます') and kana.endswith(u'ます')):
        return []
    j, r, out = jp[:-2], kana[:-2], []
    cands = [(j + u'る', r + u'る')]
    if r and r[-1] in VERB_END:
        cands.append((j[:-1] + VERB_END[r[-1]] if j and j[-1] == r[-1] else j + VERB_END[r[-1]], r[:-1] + VERB_END[r[-1]]))
    for dj, dr in cands:
        if dr in READ.get(dj, set()):
            out.append((dj, dr))
    return out


def mixed_forms(jp, kana):
    """交ぜ書き «本や/ほんや», «月よう日/げつようび» → JMdict-ийн «本屋», «月曜日»: кана хэсэг бүр ханз (+ үлдсэн кана)-аар
    солигдсон, ИЖИЛ уншлагатай бичлэг. N5-ийн 79-д ороогүй ханзыг канагаар бичсэн үгийг ингэж баталгаажуулна."""
    runs = re.findall(u'[一-鿿々]+|[^一-鿿々]+', jp)
    if len(runs) < 2 or not any(CJK.match(r[0]) for r in runs):
        return []
    pat = ''.join(re.escape(r) if CJK.match(r[0]) else u'(?:%s|[一-鿿々]+(?:%s))' % (re.escape(r), '|'.join(re.escape(r[i:]) for i in range(1, len(r) + 1)))
                  for r in runs)
    return sorted(k for k in WRITE.get(kana, ()) if k != jp and re.fullmatch(pat, k))


# ── Ханзны төстэй хэлбэр (бичлэгийн буруу сонголт) — N5-ийн 79 ханзанд ──
LOOK = {
    u'日': u'目白田', u'一': u'二七', u'人': u'入八大', u'国': u'困固図', u'年': u'午牛干', u'大': u'犬太天',
    u'十': u'千土干', u'二': u'三工七', u'本': u'木休体', u'中': u'申虫史', u'出': u'山凸由', u'三': u'二王川',
    u'見': u'貝兄目', u'月': u'用円肉', u'長': u'張帳辰', u'生': u'牛先主', u'五': u'互王丑', u'時': u'持特待',
    u'上': u'土止工', u'行': u'待往術', u'四': u'西匹回', u'後': u'役彼待', u'金': u'全会針', u'前': u'則首剪',
    u'九': u'丸力刀', u'入': u'人八込', u'学': u'字覚子', u'間': u'聞問門', u'円': u'丹内用', u'子': u'字了予',
    u'東': u'車束来', u'八': u'人入穴', u'六': u'穴文大', u'下': u'不卞丁', u'今': u'令会合', u'気': u'汽雰丸',
    u'小': u'少川水', u'七': u'匕土士', u'高': u'京亭喬', u'山': u'出岩小', u'女': u'安如好', u'外': u'夕多処',
    u'百': u'白首自', u'先': u'生洗光', u'名': u'各多石', u'川': u'州小三', u'千': u'干十午', u'来': u'米末未',
    u'水': u'氷永木', u'男': u'田町思', u'話': u'語読活', u'校': u'交枝効', u'北': u'比化此', u'土': u'士上工',
    u'午': u'牛年干', u'木': u'本未末', u'車': u'東軍申', u'書': u'昼画害', u'半': u'羊平米', u'白': u'百自日',
    u'天': u'夫大矢', u'西': u'酉四面', u'電': u'雷雲雪', u'火': u'灯人大', u'語': u'話読誤', u'右': u'石左若',
    u'左': u'右在友', u'聞': u'間問開', u'休': u'体木本', u'食': u'良飯飲', u'何': u'向可河', u'南': u'面用市',
    u'万': u'方力刀', u'毎': u'母海悔', u'雨': u'両市雪', u'母': u'毎海舟', u'読': u'話語続', u'友': u'左反右',
    u'父': u'交文爻',
}
KATA_LOOK = {u'シ': u'ツ', u'ツ': u'シ', u'ソ': u'ン', u'ン': u'ソ', u'ク': u'ケワ', u'ケ': u'ク', u'ワ': u'ウク', u'ウ': u'ワ',
             u'ヌ': u'ス', u'ス': u'ヌ', u'ロ': u'コ', u'コ': u'ロ', u'ル': u'レ', u'レ': u'ル', u'チ': u'テ', u'テ': u'チ',
             u'ナ': u'メ', u'メ': u'ナ', u'ア': u'マ', u'マ': u'ア', u'タ': u'夕ク', u'ホ': u'木', u'ハ': u'バパ', u'バ': u'パハ',
             u'パ': u'バ', u'ト': u'ド', u'ド': u'ト', u'カ': u'ガ', u'ガ': u'カ', u'サ': u'ザ', u'ザ': u'サ', u'フ': u'ブプ', u'ブ': u'プ',
             u'プ': u'ブ', u'ャ': u'ヤ', u'ュ': u'ユ', u'ョ': u'ヨ', u'ー': u'', u'ッ': u''}


def kata_variants(w):
    out = set()
    for i, c in enumerate(w):
        for d in KATA_LOOK.get(c, ''):
            out.add(w[:i] + d + w[i + 1:])
        if c in u'ーッ':
            out.add(w[:i] + w[i + 1:])
    for i in range(1, len(w)):
        if w[i - 1] in u'ァィゥェォャュョアイウエオカキクケコサシスセソタチテトナニネノハヒホマミモヨラリルロ' and w[i] not in u'ーッ':
            out.add(w[:i] + u'ー' + w[i:])
    out.discard(w)
    return {v for v in out if v and v[0] not in u'ーッャュョ' and u'ーー' not in v}


def kanji_variants(w):
    out = set()
    for i, c in enumerate(w):
        for d in LOOK.get(c, ''):
            out.add(w[:i] + d + w[i + 1:])
    out.discard(w)
    return out


def split_at(ex, word):
    """Үгийг өгүүлбэрт бүлэг үгийн эхэнд (мөрийн эх, зай, «、«」-ийн дараа) ганцхан удаа олно."""
    hits = [m.start() for m in re.finditer(re.escape(word), ex)
            if (m.start() == 0 or ex[m.start() - 1] in u' 　、「『') and ex.count(word) == 1]
    if len(hits) != 1:
        return None
    i = hits[0]
    return ex[:i], ex[i + len(word):]


def klass(x):
    if x['kana'].endswith(u'ます'):
        return 'v'
    pos = POS.get(x['jp'], set()) | POS.get(x['kana'], set())
    if 'adj-i' in pos and x['kana'].endswith(u'い'):
        return 'ai'
    if 'adj-na' in pos:
        return 'an'
    if pos & {'adv', 'adv-to'} and not pos & {'n'}:
        return 'adv'
    if pos & {'n', 'n-adv', 'n-t'}:
        return 'n'
    return None


clean = [x for x in vocab if not BAD.search(x['jp'] + x['kana']) and x.get('ex')]
seen_jp = {}
for x in vocab + extra:
    seen_jp.setdefault(x['jp'], set()).add(x['kana'])


def pick(rng, cands, n=3):
    cands = sorted(cands)
    rng.shuffle(cands)
    return cands[:n]


kanji, hyouki, bunmyaku = [], [], []
extra_clean = [x for x in extra if not BAD.search(x['jp'] + x['kana']) and x.get('ex')]
for x in clean + extra_clean:
    rng = random.Random(x['id'])
    sp = split_at(x['ex'], x['kana'])
    is_k = CJK.search(x['jp']) and all((not CJK.match(c)) or c in N5K for c in x['jp'])
    if 'd' in x and x['jp'] in {q['w'] for q in kanji}:
        problems.append('нэмэлт үг хичээлийнхтэй давхардсан: %s %s' % (x['id'], x['jp']))
        continue
    if sp and is_k and len(seen_jp.get(x['jp'], ())) == 1:
        df = dict_forms(x['jp'], x['kana'])
        mf = mixed_forms(x['jp'], x['kana']) if 'd' in x and x['kana'] not in READ.get(x['jp'], set()) and not df else []
        real = READ.get(x['jp'], set()) | seen_jp[x['jp']] | {r for f in mf for r in READ.get(f, ())}
        for dj, dr in df:  # «いきます»-ийн хувилбар нь «行く»-ийн өөр уншлагын ます-хэлбэр байж болохгүй
            stem_j = x['jp'][:-2]
            real |= {rr[:-1] + x['kana'][len(dr) - 1:] for rr in READ.get(dj, set()) if len(rr) >= 1}
        if x['kana'] not in READ.get(x['jp'], set()) and not df and not mf:
            problems.append('JMdict-д алга: %s %s %s' % (x['id'], x['jp'], x['kana']))
        else:
            sp_k = kanji_spans(x['jp'], x['kana'])
            vv = {v: t for v, t in kana_variants(x['kana']).items() if in_spans(x['kana'], v, sp_k)}
            vv.update({v: t for v, t in alt_readings(x['jp'], x['kana']).items() if in_spans(x['kana'], v, sp_k)})
            ds = pick_kana(rng, vv, real)
            for v in x.get('d', []):  # нэмэлт үгийн бичсэн буруу сонголт — жинхэнэ уншлага биш, кана хэсэг хэвээр бол
                if len(ds) < 3 and v not in ds and v not in real and v != x['kana'] and in_spans(x['kana'], v, sp_k):
                    ds.append(v)
            if len(ds) == 3:
                kanji.append(dict(id='K-' + x['id'], pre=sp[0], w=x['jp'], post=sp[1], o=[x['kana']] + ds, mn=x['mn'], r=x['kana']))
            vs = {v for v in kanji_variants(x['jp']) if x['kana'] not in READ.get(v, set())} - WRITE.get(x['kana'], set())
            # «書きます → 画きます»: 画く нь かく гэж уншигдана — ます-хэлбэрийг толь бичгийн хэлбэрээр нь шалгана.
            vs = {v for v in vs if not any(dr in READ.get(''.join(v[i] if i < len(v) and v[i] != x['jp'][i] else c for i, c in enumerate(dj)), set()) for dj, dr in df)}
            ds = pick(rng, vs)
            if len(ds) == 3:
                hyouki.append(dict(id='H-' + x['id'], pre=sp[0], w=x['kana'], post=sp[1], o=[x['jp']] + ds, mn=x['mn'], r=x['kana']))
    spk = split_at(x['ex'], x['jp']) if KATA.match(x['jp']) else None
    if spk and len(x['jp']) >= 3:
        vs = {v for v in kata_variants(x['jp']) if v not in POS}
        ds = pick(rng, vs)
        if len(ds) == 3:
            from_kata = ''.join(chr(ord(c) - 0x60) if u'ァ' <= c <= u'ヶ' else c for c in x['jp'])
            hyouki.append(dict(id='H-' + x['id'], pre=spk[0], w=from_kata, post=spk[1], o=[x['jp']] + ds, mn=x['mn'], r=x['jp']))

# 文脈規定: ижил аймгийн, ижил хичээлийн хүрээний үгс
by_class = {}
for x in clean:
    c = klass(x)
    if c and len(seen_jp.get(x['jp'], ())) == 1:
        by_class.setdefault(c, []).append(x)
for c, xs in by_class.items():
    for x in xs:
        target = x['jp'] if KATA.match(x['jp']) else x['kana']
        sp = split_at(x['ex'], target)
        if not sp:
            continue
        rng = random.Random('b' + x['id'])
        pool = [y for y in xs if y is not x and y['mn'] != x['mn'] and abs(y['lesson'] - x['lesson']) <= 8
                and (y['jp'] if KATA.match(y['jp']) else y['kana']) not in x['ex']]
        ds = [y for y in pick(rng, [(y['id'], y) for y in pool])]
        show = lambda y: y['jp'] if KATA.match(y['jp']) else y['kana']
        # Ижил уншлагатай өөр үг (撮ります/取ります → とります) давхар сонголт болно — тийм асуултыг алгасна.
        if len(ds) == 3 and len({show(x)} | {show(y) for _, y in ds}) == 4:
            bunmyaku.append(dict(id='B-' + x['id'], pre=sp[0], post=sp[1], o=[show(x)] + [show(y) for _, y in ds],
                                 mn=x['mn'], c=c, ok=False))

out = dict(note=__doc__.split('\n')[0], kanji=kanji, hyouki=hyouki, bunmyaku=bunmyaku)
io.open(os.path.join(ROOT, 'tools', 'v2_n5test_vocab.json'), 'w', encoding='utf-8', newline='\n').write(json.dumps(out, ensure_ascii=False, indent=0))
print('漢字読み %d · 表記 %d · 文脈規定 %d (Codex шалгаагүй)' % (len(kanji), len(hyouki), len(bunmyaku)))
print('文脈規定 аймгаар:', {c: sum(1 for b in bunmyaku if b['c'] == c) for c in by_class})
for p in problems[:20]:
    print('  !', p)
print('асуудал', len(problems))
