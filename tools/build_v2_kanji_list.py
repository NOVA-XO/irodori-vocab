# -*- coding: utf-8 -*-
u"""v2 (KOTO)-ийн «Ханз» хуудасны өгөгдөл — `v2/kanji.js`.

Жагсаалт ба дараалал: `tools/v2_kanji_order.txt` (jisho.org-ийн #jlpt-n5,
#jlpt-n4, #jlpt-n3; 79 + 166 + 367). 2026-11-05: Irodori-гийн 3 номын үгсэд гардаг ч
энд ороогүй 397 — N2 (189, jisho) ба «Бусад» (208, jisho-д JLPT шошгогүй — 分 身 無
зэрэг түгээмэл ханз ч бий; `n: 0`), ҮГИЙН САНГИЙН замд анх гарах дарааллаар.
Номын шошго `b` — ханз Irodori-гийн аль номын үгэнд гардаг (v1-ийн `l`/`l1`/`l2`):
'A1' Суурь шат, 'A2a' Анхан шат 1, 'A2b' Анхан шат 2. Утга, уншлага, зурлага, анги, жишээ үг: v1-ийн
`data/kanji.json` (KANJIDIC2, CC BY-SA 4.0; монгол утгыг гараар шалгасан).
2026-11-04-нд хоёр жагсаалт ханз бүрээрээ ТААРСАН — зөрвөл ЗОГСОНО.

Жишээ үг (3 хүртэл): ЭХЛЭЭД v2-ийн үгийн сангаас (`kj` нь тухайн ханзтай —
суралцагчийн үзэх үг, замын дарааллаар; 11-05-аас Irodori 3 ном), дараа нь v1-ийн `w`. v1-д тооны ханзын
жишээ алга эсвэл `（十二歳以上）` хэлбэртэй байв. `行く／行きます` → эхний хувилбар,
`～` хасна; уншлага нь зөвхөн кана, үг нь тухайн ханзыг агуулсан байх
ёстой. Бичлэг (`au`) — `audio/<id>.mp3` бодитоор байвал л.

Үүсэл (`o`, 2026-11-04): `tools/v2_kanji_origin.tsv` (Wiktionary-гаас, гараар
орчуулсан) — төрөл, хуучин хэлбэр, бүрэлдэхүүн хэсэг, тайлбар, зургийн нэр.
Дууны хэсгийн уншлага ханзны он уншлагатай таарвал `m: 1`. Эртний бичиг
(`a`: ['oracle', 'bronze', 'seal']-ийн байгаа нь, хувьслын дарааллаар) —
`tools/v2_kanji_old.tsv` ба `v2/kanji-old/<id>-<kind>.svg` бодитоор байвал
(`tools/fetch_v2_kanji_old.py` татна). `g` — зурагтай ханзны ангилал (галерей).
`f` — хэсгийн «гэр бүл»: [[хэсэг, бусад ханз…], …] — `v2/kanji-vg/<id>.json`-ийн
харагдах бүрэлдэхүүнээр (`tools/fetch_v2_kanjivg.py`).

Ажиллуулах:
    python tools/build_v2_kanji_list.py          # -> v2/kanji.js
    python tools/build_v2_kanji_list.py --dry    # зөвхөн тайлан
"""
import argparse
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KANA = re.compile(u'^[ぁ-ゖァ-ヺー]+$')


def load_order():
    order = {}
    for line in io.open(os.path.join(ROOT, 'tools', 'v2_kanji_order.txt'), encoding='utf-8'):
        if line.startswith('#') or not line.strip():
            continue
        lv, chars = line.split()
        order[lv] = list(chars)
    return order


def first(s):
    return s.split(u'／')[0].strip().strip(u'～').strip()


PAREN = re.compile(r'\s*（([^）]*)）\s*')


def variants(kj, kn):
    """Irodori-гийн бичлэг «～区 （南区）» / «～く （みなみく）», «簡単（な）», «皮 （トマトの皮）» хэлбэртэй —
    хаалтан доторх жишээ (南区 みなみく) эхэнд, дараа нь хаалтгүй толгой үг (簡単 かんたん). 2026-11-05 хүртэл
    хаалттай кана KANA-д таардаггүй тул ийм үгийг бүхэлд нь алгасдаг байв (Irodori-гийн 19 ханз жишээгүй)."""
    # Толгой үг ЭХЭНД (吸う → дараа нь たばこを吸う): «хэрхэн уншдаг вэ» асуултад богино үг; толгой нь аль хэдийн
    # авагдсан бол (皮 ×3) хаалтан доторх жишээ (トマトの皮, 餃子の皮). Зай арилгана («約10 分» ≠ «約10分» давхардал).
    sq = lambda t: re.sub(r'\s+', u'', t)
    out = [(sq(first(PAREN.sub(u'', kj))), sq(first(PAREN.sub(u'', kn))))]
    mj, mk = PAREN.search(kj), PAREN.search(kn)
    if mj and mk:
        out.append((sq(first(mj.group(1))), sq(first(mk.group(1)))))
    return out


def clean_reading(r):
    return r.replace('-', '').strip()


KATA = re.compile(u'^[ァ-ヺー]+$')
TYPES = ('pic', 'ind', 'ic', 'psc', 'unk')
# 'NX' = «Бусад»: jisho-д JLPT шошгогүй, Irodori-д гардаг (n 0).
LEVELS = (('N5', 5), ('N4', 4), ('N3', 3), ('N2', 2), ('NX', 0))
BOOK = {'l': 'A1', 'l1': 'A2a', 'l2': 'A2b'}


def load_tsv(name, cols):
    rows = []
    for line in io.open(os.path.join(ROOT, 'tools', name), encoding='utf-8'):
        line = line.rstrip('\n')
        if line and not line.startswith('#'):
            rows.append((line.split('\t') + [''] * cols)[:cols])
    return rows


KINDS = ('oracle', 'bronze', 'seal')
CATS = ('nature', 'body', 'living', 'things')
SAME = {u'阝': u'⻖'}  # tsv-ийн 阝 = KanjiVG-ийн ⻖ (院)


def families(out):
    u"""Хэсэг бүрт (o.p) — тэр хэсгийг агуулсан бусад ханз (KanjiVG-ийн харагдах бүрэлдэхүүнээр).
    寺 → 時 持 特 待 (дуу), 氵 → 海 洋 注 漢 (утга). 12 хүртэл, jisho-гийн дарааллаар."""
    comps = {}
    for k in out:
        p = os.path.join(ROOT, 'v2', 'kanji-vg', k['id'] + '.json')
        comps[k['c']] = set(json.load(io.open(p, encoding='utf-8'))['c']) if os.path.exists(p) else set()
    for k in out:
        fam = []
        for p in (k['o'] or {}).get('p', []):
            x = p['c']
            if any(f[0] == x for f in fam):
                continue
            mem = [m['c'] for m in out if m['c'] != k['c'] and (x in comps[m['c']] or SAME.get(x) in comps[m['c']])]
            if mem:
                fam.append([x] + mem[:12])
        if fam:
            k['o']['f'] = fam


def load_origin(problems):
    old = {}
    for r in load_tsv('v2_kanji_old.tsv', 5):
        old.setdefault(r[0], []).append(r[2])
    out = {}
    for c, t, trad, src, parts, pc, tx, g in load_tsv('v2_kanji_origin.tsv', 8):
        if c in out:
            problems.append(u'%s: үүсэл давхардсан' % c)
        if t not in TYPES:
            problems.append(u'%s: үүслийн төрөл «%s»' % (c, t))
        o = {'t': t}
        if trad:
            o['old'] = trad
        ps = []
        for part in [x.strip() for x in parts.split(';') if x.strip()]:
            head, _, gl = part.partition(':')
            pc_, _, role = head.partition('=')
            if len(pc_) != 1 or role not in ('', 's', 'p'):
                problems.append(u'%s: хэсэг «%s»' % (c, part))
                continue
            p = {'c': pc_}
            if role:
                p['r'] = role
            if role == 'p' and KATA.match(gl):
                p['on'] = gl
            elif gl:
                p['mn'] = gl
            ps.append(p)
        if ps:
            o['p'] = ps
        if tx:
            o['tx'] = tx
        if pc:
            o['pc'] = pc
        if g:
            if g not in CATS or not pc:
                problems.append(u'%s: ангилал «%s» (зурагтай ханзад л)' % (c, g))
            o['g'] = g
        elif pc:
            problems.append(u'%s: зурагтай боловч ангилалгүй' % c)
        a = [kd for kd in KINDS if kd in old.get(c, []) and
             os.path.exists(os.path.join(ROOT, 'v2', 'kanji-old', 'J-%04X-%s.svg' % (ord(c), kd)))]
        if a:
            o['a'] = a
        out[c] = o
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry', action='store_true')
    args = ap.parse_args()

    order = load_order()
    v1 = {x['c']: x for x in json.load(io.open(os.path.join(ROOT, 'data', 'kanji.json'), encoding='utf-8'))['items']}
    raw = io.open(os.path.join(ROOT, 'v2', 'data.js'), encoding='utf-8').read()
    # 2026-11-05-аас data.js = {levels, units, extra, legacy} (build_v2_vocab.py); өмнө нь сэдвийн массив байв.
    vocab = json.loads(raw[raw.index('{'):raw.rindex('}') + 1])
    v2words = [w for u in vocab['units'] for w in u['words'] if w.get('kj')]
    out, problems = [], []
    origin = load_origin(problems)
    for lv, n in LEVELS:
        for c in order[lv]:
            x = v1.get(c)
            if not x:
                problems.append(u'%s: v1-д алга' % c)
                continue
            if x.get('n') != (n or None):
                problems.append(u'%s: v1-д N%s, jisho-д %s' % (c, x.get('n'), lv))
            if n in (2, 0) and not any(x.get(k) for k in BOOK):
                problems.append(u'%s: %s боловч Irodori-д гардаггүй' % (c, lv))
            ex, seen = [], set()
            cand = [(w['kj'], w['jp'], w['mn'], w.get('au')) for w in v2words if c in w['kj']]
            cand += [(w.get('jp', ''), w.get('kana', ''), w.get('mn', ''), w.get('id')) for w in x.get('w') or []]
            # 11-05: замд анкетын «生年月日», хэллэг «日本語で» эрт гардаг — 3 хүртэл тэмдэгттэй үгийг түрүүнд (дотроо
            # v2-ийн зам → v1-ийн дарааллаар); урт нь дараа. Эс бөгөөс 年/月/生-ийн эхний жишээ «生年月日» болж байв.
            # Урт = бодитоор сонгогдох хувилбарынх («なる （職人になる）» → 職人になる, толгой «なる» биш).
            def long(t):
                ok = [jp for jp, kana in variants(t[0], t[1]) if jp and c in jp and KANA.match(kana)]
                return not ok or len(ok[0]) > 3
            cand.sort(key=long)
            for kj, kn, mn, au in cand:
                for jp, kana in variants(kj, kn):
                    if not jp or c not in jp or not KANA.match(kana) or jp in seen:
                        continue
                    seen.add(jp)
                    e = {'jp': jp, 'kana': kana, 'mn': mn.strip()}
                    if au and os.path.exists(os.path.join(ROOT, 'audio', au + '.mp3')):
                        e['au'] = au
                    ex.append(e)
                    break
                if len(ex) == 3:
                    break
            on = [clean_reading(r) for r in x.get('on') or [] if clean_reading(r)]
            o = origin.pop(c, None)
            if not o:
                problems.append(u'%s: үүсэлгүй (v2_kanji_origin.tsv)' % c)
            if x['id'] != 'J-%04X' % ord(c):
                problems.append(u'%s: id %s' % (c, x['id']))
            for p in (o or {}).get('p', []):
                if p.get('on') in on:
                    p['m'] = 1
            k = {'id': x['id'], 'c': c, 'n': n, 'mn': x['mn'].strip(), 'on': on,
                 # KANJIDIC-ийн катакана «кун» (粉 デシメートル — гадаад үгийн ханзан бичлэг) уншлага биш.
                 'kun': [clean_reading(r) for r in x.get('kun') or [] if clean_reading(r) and not KATA.match(clean_reading(r))],
                 's': x.get('s'), 'g': x.get('g'), 'ex': ex, 'o': o}
            b = [bk for f, bk in BOOK.items() if x.get(f)]
            if b:
                k['b'] = b
            out.append(k)
    if origin:
        problems.append(u'жагсаалтад байхгүй үүсэл: %s' % u''.join(origin))
    families(out)
    if problems:
        sys.exit(u'ZOGSOV:\n  ' + u'\n  '.join(problems))

    exs = [e for k in out for e in k['ex']]
    print(u'%s · номын шошготой %d · жишээ %d (бичлэгтэй %d) · жишээгүй ханз %d: %s' % (
        u' · '.join('%s %d' % (lv, sum(1 for k in out if k['n'] == n)) for lv, n in LEVELS), sum(1 for k in out if 'b' in k), len(exs),
        sum(1 for e in exs if 'au' in e), sum(1 for k in out if not k['ex']),
        u''.join(k['c'] for k in out if not k['ex'])))
    types = {}
    for k in out:
        types[k['o']['t']] = types.get(k['o']['t'], 0) + 1
    print(u'үүсэл: %s · эртний бичигтэй %d (файл %d) · зурагтай %d · дууны хэсэг таарсан %d · гэр бүлтэй %d' % (
        ' '.join('%s %d' % (t, types.get(t, 0)) for t in TYPES), sum(1 for k in out if 'a' in k['o']),
        sum(len(k['o'].get('a', [])) for k in out),
        sum(1 for k in out if 'pc' in k['o']), sum(1 for k in out for p in k['o'].get('p', []) if p.get('m')),
        sum(1 for k in out if 'f' in k['o'])))
    if args.dry:
        return
    body = u',\n'.join(u' ' + json.dumps(k, ensure_ascii=False, separators=(',', ':')) for k in out)
    io.open(os.path.join(ROOT, 'v2', 'kanji.js'), 'w', encoding='utf-8', newline='\n').write(
        u'/* N5, N4, N3, N2 ба бусад (Irodori) ханз — tools/build_v2_kanji_list.py гаргасан, ГАРААР БҮҮ ЗАС.\n'
        u'   Жагсаалт/дараалал: jisho.org (#jlpt-n5, #jlpt-n4). Утга, уншлага: KANJIDIC2\n'
        u'   (EDRDG, CC BY-SA 4.0), монгол утга v1-ийн data/kanji.json. Үүсэл (o):\n'
        u'   en.wiktionary.org (CC BY-SA 4.0) — tools/v2_kanji_origin.tsv. */\n'
        u'window.KOTO_KANJI = [\n' + body + u'\n];\n')
    print(u'v2/kanji.js bichigdlee')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
