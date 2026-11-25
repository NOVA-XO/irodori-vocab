# -*- coding: utf-8 -*-
"""v2-ийн үгийн сан (v2/data.js) — Irodori 3 ном, утгаар холбоотой нэгжүүдээр.

Эх сурвалж:
  tools/v2_vocab_units.tsv   — түвшин → нэгж → үг (суралцах дараалал). Эрэмбийн ЦОРЫН ГАНЦ эх.
  tools/v2_vocab_legacy.tsv  — 2026-11-05 хүртэлх v2-ийн 432 үг: хуучин байрлалын id → тогтвортой id,
                               харагдах бичвэр (сурагчид үзсэн хэвээр нь үлдээнэ).
  data/vocab.json, vocab-el1.json, vocab-el2.json — Irodori ことばリスト (монгол), The Japan Foundation.
  data/audio.json            — бичлэгтэй id-ууд.

Гаралт: v2/data.js — window.KOTO_DATA = {levels, units, extra, legacy}.
Асуудал олдвол build УНАНА (чимээгүй засахгүй).

    python -I tools/build_v2_vocab.py
"""
import collections, io, json, os, re, sys
sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

LEVELS = [('A1', u'Суурь шат', u'A1 · 入門'), ('A2a', u'Анхан шат 1', u'A2 · 初級1'), ('A2b', u'Анхан шат 2', u'A2 · 初級2')]
BOOK = {'vocab.json': 'A1', 'vocab-el1.json': 'A2a', 'vocab-el2.json': 'A2b'}
THEMES = set('greet ask self people num time daily food home town travel shop work hobby nature health event media public safety feel desc verb gram'.split())
# Үгийн аймаг (11-05): tools/v2_vocab_pos.tsv (`build_v2_pos.py` — JMdict + дүрэм + гар засвар) → үг бүрд `p`.
POS = ('noun', 'verb', 'adj', 'adv', 'exp', 'other')
# Нэгжийг 15–40 үгээр гаргасан; давхар мөрийг нэгтгэхэд (v2_vocab_merge.tsv) 4 нь 14 болсон — 12 хүртэл зөвшөөрнө.
UNIT_MIN, UNIT_MAX, TITLE_MAX = 12, 40, 28
CJK = re.compile(u'[㐀-鿿豈-﫿々〆]')

problems = []


def problem(msg):
    problems.append(msg)


def read_tsv(name):
    with io.open(os.path.join(ROOT, 'tools', name), encoding='utf-8') as fh:
        return [l.rstrip('\n') for l in fh if l.strip() and not l.startswith('# ')]


# ── Эх өгөгдөл ──
irodori = {}
for f, lv in BOOK.items():
    for x in json.load(io.open(os.path.join(ROOT, 'data', f), encoding='utf-8'))['items']:
        irodori[x['id']] = dict(x, level=lv)
audio = set(json.load(io.open(os.path.join(ROOT, 'data', 'audio.json'), encoding='utf-8'))['ids'])

# Эх жагсаалтын алдааны засвар (tools/v2_vocab_fix.tsv) — эх JSON-ийг хөндөхгүй, «хуучин» нь таарах ёстой.
n_fix = 0
for line in read_tsv('v2_vocab_fix.tsv'):
    fid, field, old, new, _why = line.split('\t')
    x = irodori.get(fid)
    if x is None or field not in ('mn', 'jp', 'kana'):
        problem('засвар: %s %s буруу' % (fid, field))
    elif x[field] != old:
        problem('засвар: %s.%s эх сурвалжтай таарахгүй (%r ≠ %r)' % (fid, field, x[field], old))
    else:
        x[field] = new
        n_fix += 1

legacy, legacy_word = {}, {}
for line in read_tsv('v2_vocab_legacy.tsv'):
    old, nid, jp, kj, mn, au, _topic = line.split('\t')
    legacy[old] = nid
    w = legacy_word.setdefault(nid, dict(jp=jp, kj=kj, mn=mn, au=au, alt=[]))
    # v2 дотор давхар байсан үгийн бусад утга (いちばん «хамгийн» + «нэгдүгээр») — тоглоомын андуурлын
    # хамгаалалт (app.js meansOf) тэднийг ч мэдэх ёстой, эс бөгөөс «нэгдүгээр» гэсэн өөр үгтэй хамт гарна.
    if mn != w['mn'] and mn not in w['alt']:
        w['alt'].append(mn)
if len(legacy) != 432:
    problem('legacy: 432 биш %d' % len(legacy))
DROP = {}
for line in read_tsv('v2_vocab_merge.tsv'):
    drop, keep, _why = line.split('\t')
    if drop in legacy_word:
        problem('нэгтгэл: %s нь хуучин 432-ын үг (ахицтай) — хасахгүй' % drop)
    if drop in DROP:
        problem('нэгтгэл: %s хоёр удаа' % drop)
    DROP[drop] = keep
for line in read_tsv('v2_vocab_fix.tsv'):
    if line.split('\t')[0] in legacy_word:
        problem('засвар: %s нь хуучин 432-ын үг — бичвэр нь v2_vocab_legacy.tsv-ээс тул засвар үйлчлэхгүй' % line.split('\t')[0])


def tidy(s):
    """PDF-ээс задлахад гарсан ерөнхий согог: өргөлтийн тэмдэг алдагдаж ижил хувилбар давтагдсан
    («サイズ／サイズ», A1-д 34 мөр) ба цифрийн ард илүү зай («10 か月»)."""
    parts = []
    for p in (q.strip() for q in s.strip().split(u'／')):
        if p and p not in parts:
            parts.append(p)
    return re.sub(u'(?<=[0-9０-９]) (?=[぀-ヿ㐀-鿿])', '', u'／'.join(parts))


def word_of(wid):
    """Харагдах бичвэр: v2-д байсан үг хэвээрээ; шинэ Irodori үг — ханзтай бол кана + kj."""
    if wid in legacy_word:
        w = dict(legacy_word[wid])
        w['kj'] = tidy(w['kj'])  # «10 時» — v1-ээс уламжилсан зай (18 үг); кана/утга хэвээр
    elif wid in irodori:
        x = irodori[wid]
        written, kana = tidy(x['jp']), tidy(x['kana'])
        if CJK.search(written):
            w = dict(jp=kana, kj=written, mn=x['mn'].strip(), au=wid)
        else:
            w = dict(jp=written, kj='', mn=x['mn'].strip(), au=wid)
    else:
        problem('үл мэдэгдэх id %s' % wid)
        return None
    if not w['mn']:
        problem('%s: монгол утга хоосон' % wid)
    if w['au'] and w['au'] not in audio:
        problem('%s: бичлэг %s алга' % (wid, w['au']))
    out = dict(id=wid, jp=w['jp'], mn=w['mn'])
    if w['kj']:
        out['kj'] = w['kj']
    if w['au']:
        out['au'] = w['au']
    if w.get('alt'):
        out['alt'] = w['alt']
    return out


POS_OF = {}
for line in read_tsv('v2_vocab_pos.tsv'):
    i, p = line.split('\t')[:2]
    if p not in POS:
        problem('%s: үгийн аймаг «%s» буруу' % (i, p))
    POS_OF[i] = p

# ── Нэгжүүд ──
units, seen, dropped = [], {}, []
level = None
for line in read_tsv('v2_vocab_units.tsv'):
    cols = line.split('\t')
    if cols[0].startswith('@'):
        level = cols[0][1:]
        if level not in dict((k, 1) for k, _, _ in LEVELS):
            problem('үл мэдэгдэх түвшин %s' % level)
        n_in_level = 0
        continue
    if cols[0] == '#unit':
        if len(cols) != 3:
            problem('нэгжийн мөр буруу: %r' % line)
            continue
        n_in_level += 1
        units.append(dict(key='%s-%02d' % (level, n_in_level), level=level, theme=cols[1], title=cols[2], words=[]))
        continue
    wid = cols[0]
    if wid in DROP:
        dropped.append(wid)
        continue
    if wid in seen:
        problem('%s хоёр удаа (%s, %s)' % (wid, seen[wid], units[-1]['key']))
        continue
    seen[wid] = units[-1]['key']
    w = word_of(wid)
    if w:
        if wid in POS_OF:
            w['p'] = POS_OF[wid]
        else:
            problem('%s: үгийн аймаг алга (python -I tools/build_v2_pos.py <jmdict.json>)' % wid)
        units[-1]['words'].append(w)

stale = sorted(set(POS_OF) - set(seen))
if stale:
    problem('v2_vocab_pos.tsv-д замд байхгүй %d үг: %s — build_v2_pos.py-г дахин' % (len(stale), ' '.join(stale[:8])))

titles = set()
for u in units:
    n = len(u['words'])
    if not UNIT_MIN <= n <= UNIT_MAX:
        problem('%s «%s»: %d үг (%d–%d)' % (u['key'], u['title'], n, UNIT_MIN, UNIT_MAX))
    if u['theme'] not in THEMES:
        problem('%s: сэдэв %s буруу' % (u['key'], u['theme']))
    if len(u['title']) > TITLE_MAX or not u['title'].strip():
        problem('%s: гарчиг «%s»' % (u['key'], u['title']))
    if (u['level'], u['title']) in titles:
        problem('%s: гарчиг давхар «%s»' % (u['key'], u['title']))
    titles.add((u['level'], u['title']))

# Хуучин 432 үг бүгд замд байх ёстой (сурагчдын ахиц).
for nid in set(legacy.values()):
    if nid not in seen:
        problem('v2-ийн үг %s замаас алга' % nid)
    elif not seen[nid].startswith('A1-'):
        problem('v2-ийн үг %s A1 биш (%s)' % (nid, seen[nid]))

# Irodori-гийн үндсэн үг бүр (давхардлыг тооцож) замд нэг л удаа.
def norm(s):
    return re.sub(r'\s+', '', s or '')


groups = {}
for x in irodori.values():
    groups.setdefault((norm(x['jp']), norm(x['kana'])), []).append(x['id'])
group_of = {i: k for k, ids in groups.items() for i in ids}
# Нэгтгэл: «хасах» нь замд байсан, «үлдэх» нь (эсвэл түүний давхардлын бүлэг) замд байх ёстой.
for drop, keep in DROP.items():
    if drop not in dropped:
        problem('нэгтгэл: %s замд байгаагүй' % drop)
    kept = keep in seen or any(i in seen for i in groups.get(group_of.get(keep), []))
    if not kept:
        problem('нэгтгэл: %s-ийн үлдэх үг %s замд алга' % (drop, keep))
merged_groups = {group_of[d] for d in DROP if d in group_of}
extra = []
for key, ids in groups.items():
    on_path = [i for i in ids if i in seen]
    if key in merged_groups and not on_path:
        continue
    core = [i for i in ids if not irodori[i]['ref']]
    if len(on_path) > 1:
        problem('нэг үг замд %d удаа: %s' % (len(on_path), ' '.join(on_path)))
    if core and not on_path:
        problem('үндсэн үг замаас алга: %s' % ' '.join(core))
    if not core and not on_path:
        head = sorted(ids, key=lambda i: (LEVELS.index(next(l for l in LEVELS if l[0] == irodori[i]['level'])), i))[0]
        w = word_of(head)
        if w:
            w['level'] = irodori[head]['level']
            extra.append(w)

# ── Номын хичээлээр бүлэглэх (2026-11-25c — эзэн: «сурах замыг номын сэдвийн дагуу: хичээл 1, хичээл 2 …») ──
# Дээрх утгын нэгжүүд (v2_vocab_units.tsv) нь үгийн ЖАГСААЛТ, бичвэр, шалгалтын эх хэвээр; ГАРАЛТЫН `units` нь
# Irodori-гийн 3 ном × 18 хичээл. Үгийн хичээл:
#   1. id-ийн угтвар (L07-…, E1-12-…);
#   2. нэгтгэсэн үг (KT-… ← L02-015, v2_vocab_merge.tsv) — хасагдсан номын id-ийнхээр, түүний байранд;
#   3. номд огт байхгүй хуучин v2-ийн үг (KT-…, N5-…) — утгын нэгжийнхээ (ижил түвшний) ихэнх үгийн хичээлд, төгсгөлд;
#   4. хуучин v2-ийн 432 үг үргэлж 1-р номд (id нь 2, 3-р номынх байсан ч) — доорх тайлбар.
# Хичээл доторх дараалал = номын дараалал (id). «Хичээлээс гадуур» (L00) нь 1-р номын төгсгөлд (n = 0).
# Нэгжийн түлхүүр «A1-L07» — хуучин «A1-07»-оос ӨӨР: хичээлийн id (түлхүүр-хэсэг) давхцвал хуучин `completed` буруу тооцогдоно.
# Гарчиг: tools/v2_vocab_lessons.tsv (албан ёсны хичээлийн нэр эх өгөгдөлд алга — хэсгийн гарчгаас Claude бичсэн).
BOOK_OF = {'L': 'A1', 'E1': 'A2a', 'E2': 'A2b'}


def book_home(i):
    m = re.match(r'^(?:(L)(\d\d)|(E[12])-(\d\d))-', i)
    return (BOOK_OF[m.group(1) or m.group(3)], int(m.group(2) or m.group(4)), i) if m else None


KEPT = {}
for drop, keep in DROP.items():
    KEPT.setdefault(keep, []).append(drop)
home, theme_of = {}, {}
for u in units:
    for w in u['words']:
        theme_of[w['id']] = (u['title'], u['theme'])
        wid = w['id']
        if wid in legacy_word:
            # Хуучин v2-ийн үг (ахицтай): id нь 2, 3-р номын бичлэгтэй (эсвэл №52 шиг өөр үгтэй) холбогдсон байж болно —
            # id-д итгэхгүй. 1-р номд ҮЛДЭЭНЭ: өөрийн L-id → ижил бичлэг+уншлагатай 1-р номын бичлэг → нэгтгэсэн L-id;
            # аль нь ч үгүй бол доорх утгын нэгжийн дүрэм (3).
            lw = legacy_word[wid]
            same = [i for i in groups.get((norm(lw['kj'] or lw['jp']), norm(lw['jp'])), []) if i.startswith('L')]
            cands = ([wid] if wid.startswith('L') else []) or same or [d for d in KEPT.get(wid, []) if d.startswith('L')]
            hs = sorted((book_home(i) for i in cands), key=lambda x: (x[1] == 0, irodori[x[2]]['ref'], x[1], x[2]))
            h = hs[0] if hs else None
        else:
            h = book_home(wid) or (sorted(filter(None, (book_home(d) for d in KEPT.get(wid, []))))[:1] or [None])[0]
        if h:
            home[wid] = h
n_merged = sum(1 for i in home if home[i][2] != i)
n_fallback = 0
LESSON_FIX, fix_used = {}, set()
for line in read_tsv('v2_vocab_lesson_fix.tsv'):
    k, n, _why = line.split('	')
    if not 1 <= int(n) <= 18:
        problem('v2_vocab_lesson_fix.tsv: %s хичээл %s буруу' % (k, n))
    LESSON_FIX[k] = int(n)
for u in units:
    known = [home[w['id']][:2] for w in u['words'] if w['id'] in home]
    same = [k for k in known if k[0] == u['level']] or known
    for k, w in enumerate(u['words']):
        if w['id'] in home:
            continue
        if not same:
            problem('%s: номын хичээл тодорхойгүй (нэгж %s-д номын үг алга)' % (w['id'], u['key']))
            continue
        best = sorted(set(same), key=lambda x: (-same.count(x), x))[0]
        fixed = LESSON_FIX.get(w['id'], LESSON_FIX.get(u['key']))
        if fixed is not None:
            best = ('A1', fixed)
            fix_used.update(k for k in (w['id'], u['key']) if k in LESSON_FIX)
        home[w['id']] = (best[0], best[1], '~%s-%03d' % (u['key'], k))
        n_fallback += 1
for k in sorted(set(LESSON_FIX) - fix_used):
    problem('v2_vocab_lesson_fix.tsv: %s хэрэглэгдээгүй (номд байхгүй үг/нэгж биш)' % k)
by_lesson = {}
for u in units:
    for w in u['words']:
        if w['id'] in home:
            lv, n, key = home[w['id']]
            by_lesson.setdefault((lv, n), []).append((key, w))
LESSON_TITLE = {}
for line in read_tsv('v2_vocab_lessons.tsv'):
    lv, n, title = line.split('	')
    LESSON_TITLE[(lv, int(n))] = title
book_units = []
for lv, _t, _s in LEVELS:
    used = set()
    for n in sorted((n for (l, n) in by_lesson if l == lv), key=lambda n: (n == 0, n)):
        ws = [w for _k, w in sorted(by_lesson[(lv, n)], key=lambda x: x[0])]
        title = LESSON_TITLE.get((lv, n), '')
        if not title.strip() or len(title) > TITLE_MAX or title in used:
            problem('%s-L%02d: гарчиг «%s» (v2_vocab_lessons.tsv — хоосон, > %d эсвэл давхар)' % (lv, n, title, TITLE_MAX))
        used.add(title)
        theme = collections.Counter(theme_of[w['id']][1] for w in ws).most_common(1)[0][0]
        book_units.append(dict(key='%s-L%02d' % (lv, n), level=lv, n=n, theme=theme, title=title, words=ws))
for nid in set(legacy.values()):
    if home.get(nid, ('?',))[0] != 'A1':
        problem('v2-ийн үг %s 1-р номд биш (%s)' % (nid, home.get(nid)))
for lv, _t, _s in LEVELS:
    got = [u['n'] for u in book_units if u['level'] == lv and u['n']]
    if got != list(range(1, 19)):
        problem('%s: 1–18-р хичээл бүрэн биш: %s' % (lv, got))
if sum(len(u['words']) for u in book_units) != sum(len(u['words']) for u in units):
    problem('номын хичээлээр бүлэглэхэд үг алдагдсан')

if problems:
    print('АСУУДАЛ %d:' % len(problems))
    for p in problems[:80]:
        print('  ' + p)
    sys.exit(1)

# Тооны шалгалтын сан: утгын нэгжийн A1-ийн «тоо»/«цаг» сэдвийн үгс (номын хичээлд тоо бусад үгтэй холилдсон тул id-аар).
num = [w['id'] for u in units if u['level'] == 'A1' and u['theme'] in ('num', 'time') for w in u['words']]
data = dict(levels=[dict(key=k, title=t, sub=s) for k, t, s in LEVELS], units=book_units, extra=extra, legacy=legacy, num=num)
out = os.path.join(ROOT, 'v2', 'data.js')
with io.open(out, 'w', encoding='utf-8', newline='\n') as fh:
    fh.write(u'/* ҮҮСГЭСЭН ФАЙЛ — гараар бүү засаарай: `python -I tools/build_v2_vocab.py`.\n'
             u'   Нэгж = Irodori-гийн номын хичээл (3 ном × 18 + «хичээлээс гадуур»); үгийн жагсаалт: tools/v2_vocab_units.tsv · хуучин 432 үг: tools/v2_vocab_legacy.tsv\n'
             u'   Үгийн сан: Irodori ことばリスト (монгол) © The Japan Foundation. */\n')
    fh.write('window.KOTO_DATA = ')
    fh.write(json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('{"key":"', '\n{"key":"'))
    fh.write(';\n')
n_words = sum(len(u['words']) for u in book_units)
print('ok: %d номын хичээл (утгын нэгж %d), %d үг, %d алхам, нэмэлт %d, засвар %d, нэгтгэл %d, %d КБ' % (
    len(book_units), len(units), n_words, sum((len(u['words']) + 4) // 5 for u in book_units), len(extra), n_fix, len(dropped), os.path.getsize(out) // 1024))
print('  хичээлийг: id-аар %d · нэгтгэлээр %d · утгын нэгжээр (номд байхгүй) %d' % (n_words - n_merged - n_fallback, n_merged, n_fallback))
for k, t, _ in LEVELS:
    us = [u for u in book_units if u['level'] == k]
    print('  %s %s: %d хичээл, %d үг (%s)' % (k, t, len(us), sum(len(u['words']) for u in us), ' '.join(str(len(u['words'])) for u in us)))
