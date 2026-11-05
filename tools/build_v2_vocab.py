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
import io, json, os, re, sys
sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

LEVELS = [('A1', u'Суурь шат', u'A1 · 入門'), ('A2a', u'Анхан шат 1', u'A2 · 初級1'), ('A2b', u'Анхан шат 2', u'A2 · 初級2')]
BOOK = {'vocab.json': 'A1', 'vocab-el1.json': 'A2a', 'vocab-el2.json': 'A2b'}
THEMES = set('greet ask self people num time daily food home town travel shop work hobby nature health event media public safety feel desc verb gram'.split())
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
        units[-1]['words'].append(w)

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

if problems:
    print('АСУУДАЛ %d:' % len(problems))
    for p in problems[:80]:
        print('  ' + p)
    sys.exit(1)

data = dict(levels=[dict(key=k, title=t, sub=s) for k, t, s in LEVELS], units=units, extra=extra, legacy=legacy)
out = os.path.join(ROOT, 'v2', 'data.js')
with io.open(out, 'w', encoding='utf-8', newline='\n') as fh:
    fh.write(u'/* ҮҮСГЭСЭН ФАЙЛ — гараар бүү засаарай: `python -I tools/build_v2_vocab.py`.\n'
             u'   Эрэмбэ: tools/v2_vocab_units.tsv · хуучин 432 үг: tools/v2_vocab_legacy.tsv\n'
             u'   Үгийн сан: Irodori ことばリスト (монгол) © The Japan Foundation. */\n')
    fh.write('window.KOTO_DATA = ')
    fh.write(json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('{"key":"', '\n{"key":"'))
    fh.write(';\n')
n_words = sum(len(u['words']) for u in units)
print('ok: %d нэгж, %d үг, %d хичээл, нэмэлт %d, засвар %d, нэгтгэл %d, %d КБ' % (
    len(units), n_words, sum((len(u['words']) + 4) // 5 for u in units), len(extra), n_fix, len(dropped), os.path.getsize(out) // 1024))
for k, t, _ in LEVELS:
    us = [u for u in units if u['level'] == k]
    print('  %s %s: %d нэгж, %d үг' % (k, t, len(us), sum(len(u['words']) for u in us)))
