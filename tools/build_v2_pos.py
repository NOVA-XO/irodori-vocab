# -*- coding: utf-8 -*-
"""v2-ийн замын үг бүрд үгийн аймаг (6 ангилал) → tools/v2_vocab_pos.tsv (11-05).

Ангилал: noun Нэр үг · verb Үйл үг · adj Тэмдэг нэр · adv Дайвар үг · exp Хэллэг · other Бусад
Эх: (1) хэлбэрийн дүрэм (～ залгавар, тоо, …する, ～て(ください), өгүүлбэр хэлбэр); (2) JMdict (ханз+кана, ханз,
кана; нийтлэг бичлэг түрүүнд, тухайн бичлэгт хамаарах эхний утгын аймаг); (3) олдоогүйд — латин, монгол утга
өгүүлбэр, нөхцөлтэй хэллэг, нийлмэл үгийн сүүлийн хэсэг. Монгол утга өгүүлбэр бол (үйл үгээс бусад) Хэллэг.
Гар засвар: tools/v2_vocab_pos_fix.tsv (id, ангилал, шалтгаан) — автоматыг дарна (Codex-ийн тулгалт, STATE).

JMdict © EDRDG, CC BY-SA 4.0 — https://www.edrdg.org/edrdg/licence.html; JSON: scriptin/jmdict-simplified.
Репод ОРОХГҮЙ (118 МБ): татаад замыг өгнө.

    python -I tools/build_v2_pos.py <jmdict-eng-*.json>
    python -I tools/build_v2_vocab.py      # дараа нь: data.js-д `p`
"""
import io, json, os, re, sys, collections
sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JM = sys.argv[1]
DATA = os.path.join(ROOT, 'v2', 'data.js')
OUT = os.path.join(ROOT, 'tools', 'v2_vocab_pos.tsv')
FIX = os.path.join(ROOT, 'tools', 'v2_vocab_pos_fix.tsv')
POS = ('noun', 'verb', 'adj', 'adv', 'exp', 'other')

raw = io.open(DATA, encoding='utf-8').read()
data = json.loads(raw[raw.index('{'):raw.rstrip().rstrip(';').rindex('}') + 1])
words = [w for u in data['units'] for w in u['words']]
print('үг:', len(words))

jm = json.load(io.open(JM, encoding='utf-8'))
by_k, by_r = collections.defaultdict(list), collections.defaultdict(list)
for e in jm['words']:
    for k in e['kanji']:
        by_k[k['text']].append(e)
    for r in e['kana']:
        by_r[r['text']].append(e)

ADJ = {'adj-i', 'adj-ix', 'adj-na', 'adj-nari', 'adj-f', 'adj-t', 'adj-ku', 'adj-shiku'}
OTHER = {'pn', 'num', 'ctr', 'prt', 'conj', 'aux', 'aux-v', 'aux-adj', 'cop', 'pref', 'suf', 'adj-pn', 'n-suf', 'n-pref'}


def cat_of(tags):
    t = set(tags)
    if any(re.fullmatch(r'v1|v1-s|v2.*|v4.*|v5.*|vk|vn|vr|vs-i|vs-s|vz|v-unspec', x) for x in t):
        return 'verb'
    if t & ADJ:
        return 'adj'
    if t & {'exp', 'int'}:
        return 'exp'
    if t & {'adv', 'adv-to'} and not t & {'n', 'n-t', 'n-adv'}:
        return 'adv'
    # Хүчтэй «бусад» (төлөөний үг, тоо, сул үг …) → Бусад; дараа нь нэр үг; зөвхөн залгавар бол Бусад (ところ: n adv suf → Нэр үг)
    if t & (OTHER - {'pref', 'suf', 'n-suf', 'n-pref'}):
        return 'other'
    if t & {'n', 'n-adv', 'n-t', 'n-pr', 'adj-no', 'vs'}:
        return 'noun'
    if t & OTHER:
        return 'other'
    return None


def first_pos(entry, kj, jp):
    for s in entry['sense']:
        ak, ar = s.get('appliesToKanji', ['*']), s.get('appliesToKana', ['*'])
        if (not kj or '*' in ak or kj in ak) and ('*' in ar or jp in ar):
            if s['partOfSpeech']:
                return s['partOfSpeech']
    return entry['sense'][0]['partOfSpeech']


def clean(s):
    s = (s or '').split('／')[0]
    s = re.sub(r'\s*[（(][^）)]*[）)]\s*', '', s)
    return re.sub(r'[〜～ 　！!？?。]', '', s).strip()


def lookup(kj, jp):
    """→ (ангилал, эх, тэмдгүүд, өөр утгууд) эсвэл None."""
    cands, src = [], ''
    if kj:
        cands = [e for e in by_k.get(kj, []) if any(r['text'] == jp for r in e['kana'])]
        src = 'JM ханз+кана'
        if not cands:
            cands, src = by_k.get(kj, []), 'JM ханз'
    if not cands and jp:
        cands = by_r.get(jp, [])
        uk = [e for e in cands if not e['kanji'] or any('uk' in s['misc'] for s in e['sense'])]
        cands, src = (uk or cands), ('JM кана' if uk else 'JM кана(ханзтай)')
    if not cands:
        return None
    cands = sorted(cands, key=lambda e: not (any(k['common'] for k in e['kanji']) or any(r['common'] for r in e['kana'])))
    tags = first_pos(cands[0], kj, jp)
    cat = cat_of(tags)
    alts = {cat_of(first_pos(e, kj, jp)) for e in cands[:4]} - {cat, None}
    return cat, src, tags, alts


NUMRE = re.compile(r'^([0-9０-９][0-9０-９,，]*.+|[一二三四五六七八九十百千万]+(歳|才|時|時間|分|円|階|人|個|回|枚|本|冊|匹|杯|台|か月|ヶ月|カ月|週間|日|年|月|度))$')


def mn_verb(mn):
    m = re.sub(r'\s*[（(/][^）)/]*[）)/]', '', mn).split(',')[0].split(';')[0].strip().lower()
    return bool(re.search(r'(ах|эх|ох|өх|их|ух|үх)$', m)) and len(m) > 2


I2U = dict(zip('いきしちにひみりぎじびぴ', 'うくすつぬふむるぐずぶぷ'))
VERB_TAG = re.compile(r'v1|v1-s|v2.*|v4.*|v5.*|vk|vn|vr|vs-i|vs-s|vz|v-unspec')


def masu_verb(kj, jp):
    """«～ます/ません/ました/ましょう» → толийн хэлбэр нь JMdict-д үйл үг бол тэр хэлбэр."""
    for base in (kj, jp):
        m = re.match(r'^(.+?)(ませんでした|ません|ました|ましょう|ます)$', base or '')
        if not m:
            continue
        stem = m.group(1)
        if re.search(r'[てで]い$', stem):  # ～ています (住んでいます, 勉強しています)
            return stem + 'る'
        forms = [stem + 'る'] + ([stem[:-1] + I2U[stem[-1]]] if stem[-1] in I2U else [])
        for f in forms:
            for e in by_k.get(f, []) + by_r.get(f, []):
                if any(VERB_TAG.fullmatch(t) for sn in e['sense'] for t in sn['partOfSpeech']):
                    return f
    return None


def mn_verb_form(mn):
    """Монгол утгын эхний хэсэг үйл үгийн хэлбэртэй эсэх (явна, иднэ, явах, явлаа, явсан, явахгүй)."""
    m = re.sub(r'\s*[（(][^）)]*[）)]', '', mn).split(';')[0].split('/')[0].strip().lower()
    m = re.sub(r'[\s.!?…]+$', '', m)
    return bool(re.search(r'(на|нэ|но|нө|х|хгүй|лаа|лээ|лоо|лөө|сан|сэн|сон|сөн|даг|дэг|дог|дөг|я|ъя|ье|ё|болно)$', m)) and len(m) > 2


def mn_sentence(mn):
    m = mn.strip()
    return bool(re.match(r'^[А-ЯЁӨҮ]', m)) and bool(re.search(r'[.!?…]\s*(\(.*\))?$', m))


rows, stat = [], collections.Counter()
for w in words:
    jp0, kj0, mn = w['jp'], w.get('kj', ''), w['mn']
    jp, kj = clean(jp0), clean(kj0)
    both = jp0 + ' ' + kj0
    note, tags, cat, src = [], [], None, ''
    # 1) хэлбэрийн дүрэм
    if re.search(r'[〜～]', both):
        cat, src = 'other', 'залгавар(～)'
    elif re.fullmatch(r'[0-9０-９][0-9０-９,，]*', jp):
        cat, src = 'other', 'тоо'
    elif kj and NUMRE.match(kj.split('／')[0]):
        cat, src = 'other', 'тоо + тоолох нөхцөл'
    elif 'おねがい' in jp or 'お願い' in kj:
        cat, src = 'exp', 'お願い…'
    elif re.search(r'[（(](する|します)[）)]', both) or re.search(r'(します|する|しません|しました)$', jp):
        cat, src = ('exp', '…します хэллэг (монгол утга өгүүлбэр)') if mn_sentence(mn) else ('verb', '…する')
    elif re.search(r'[てで][（(]?ください[）)]?$', jp0.split('／')[0]) or re.search(r'[てで][（(]ください[）)]', both):
        cat, src = 'verb', '～て(ください)'
    elif re.search(r'[！!？?、]', both):
        cat, src = 'exp', 'анхаарлын/асуух тэмдэг'
    elif re.search(r'(ます|ません|ました|ましょう)$', jp) and not mn_sentence(mn) and mn_verb_form(mn) and masu_verb(kj, jp):
        cat, src = 'verb', '～ます → ' + masu_verb(kj, jp)
    elif re.search(r'(ます|ません|ました|ましょう|です|でした|ください|ですか|ますか|ませんか|ですね|ですよ|ますよ|ましたよ|ませんね)$', jp):
        cat, src = 'exp', 'өгүүлбэр хэлбэр'
    # 2) JMdict
    if cat is None:
        r = lookup(kj, jp)
        if r:
            cat, src, tags, alts = r
            if alts:
                note.append('өөр утга: ' + ','.join(sorted(alts)))
            if cat is None:
                note.append('тэмдэг танигдсангүй: ' + ' '.join(tags))
    # 3) олдоогүйд — хэлбэр, монгол утга, сүүлийн хэсэг
    if cat is None:
        if re.fullmatch(r'[A-Za-z][A-Za-z0-9\-. ]*', jp):
            cat, src = 'noun', 'латин'
        elif re.search(r'(ね|ねえ|よ|か|な)$', jp) and mn_sentence(mn):
            cat, src = 'exp', 'төгсгөлийн сул үг'
        elif mn_sentence(mn):
            cat, src = 'exp', 'монгол утга өгүүлбэр'
        elif re.search(r'(で|に|の|と|から|まで|へ)$', jp) and (lookup(kj[:-1], jp[:-1]) if kj else lookup('', jp[:-1])):
            cat, src = 'exp', 'нөхцөлтэй хэллэг'
        else:
            base = kj or jp
            for i in range(1, len(base)):
                tail = base[i:]
                r = lookup(tail, '') if re.search(r'[一-鿿]', tail) else lookup('', tail)
                if r and r[0]:
                    cat, src, tags = ('noun' if r[0] == 'other' else r[0]), 'сүүлийн хэсэг «%s»' % tail, r[2]
                    break
            if cat is None and re.fullmatch(r'[゠-ヿー・]+', jp):
                cat, src = 'noun', 'катакана нэр (толинд алга)'
            if cat is None:
                src = 'олдсонгүй'
    if cat in ('adj', 'adv', 'noun', 'other') and mn_sentence(mn) and src not in ('залгавар(～)',):
        note.append('%s → exp (монгол утга өгүүлбэр)' % cat)
        cat = 'exp'
    # 4) монгол утгын тулгалт
    mv = mn_verb(mn)
    if cat == 'verb' and not mv and src not in ('～て(ください)',):
        note.append('монгол утга «-х»-гүй')
    if cat not in (None, 'verb', 'exp') and mv:
        note.append('монгол утга «-х»')
    rows.append((w['id'], jp0, kj0, mn, cat or '?', src, ' '.join(tags), '; '.join(note)))

fix = {}
if os.path.exists(FIX):
    for l in io.open(FIX, encoding='utf-8'):
        if not l.strip() or l.startswith('#'):
            continue
        i, p, why = (l.rstrip('\n').split('\t') + ['', ''])[:3]
        if p not in POS or not why.strip():
            sys.exit('засвар буруу: %r' % l)
        fix[i] = (p, why.strip())
ids = {r[0] for r in rows}
bad = [i for i in fix if i not in ids]
if bad:
    sys.exit('засварт замд байхгүй id: %s' % ' '.join(bad))
out, changed = [], 0
for r in rows:
    p, srcs = r[4], r[5]
    if r[0] in fix:
        changed += p != fix[r[0]][0]
        p, srcs = fix[r[0]][0], 'гараар: ' + fix[r[0]][1]
    if p not in POS:
        sys.exit('%s: ангилал алга' % r[0])
    out.append('\t'.join((r[0], p, r[1], r[2], r[3], srcs)))
with io.open(OUT, 'w', encoding='utf-8', newline='\n') as fh:
    fh.write('# ҮҮСГЭСЭН ФАЙЛ — `python -I tools/build_v2_pos.py <jmdict.json>`; засварыг v2_vocab_pos_fix.tsv-д.\n')
    fh.write('# id\tангилал\tjp\tkj\tmn\tэх\n')
    fh.write('\n'.join(out) + '\n')
print('ok: %d үг · %s · гар засвар %d (өөрчилсөн %d)' % (len(out), dict(collections.Counter(o.split('\t')[1] for o in out)), len(fix), changed))
