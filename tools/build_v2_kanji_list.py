# -*- coding: utf-8 -*-
u"""v2 (KOTO)-ийн «Ханз» хуудасны өгөгдөл — `v2/kanji.js`.

Жагсаалт ба дараалал: `tools/v2_kanji_order.txt` (jisho.org-ийн #jlpt-n5,
#jlpt-n4, #jlpt-n3; 79 + 166 + 367). Утга, уншлага, зурлага, анги, жишээ үг: v1-ийн
`data/kanji.json` (KANJIDIC2, CC BY-SA 4.0; монгол утгыг гараар шалгасан).
2026-11-04-нд хоёр жагсаалт ханз бүрээрээ ТААРСАН — зөрвөл ЗОГСОНО.

Жишээ үг (3 хүртэл): ЭХЛЭЭД v2-ийн үгийн сангаас (`kj` нь тухайн ханзтай —
суралцагчийн үзсэн үг; 245-аас 130-д), дараа нь v1-ийн `w`. v1-д тооны ханзын
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


def clean_reading(r):
    return r.replace('-', '').strip()


KATA = re.compile(u'^[ァ-ヺー]+$')
TYPES = ('pic', 'ind', 'ic', 'psc', 'unk')


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
    v2words = [w for t in json.loads(raw[raw.index('['):raw.rindex(']') + 1]) for w in t['words'] if w.get('kj')]
    out, problems = [], []
    origin = load_origin(problems)
    for lv, n in (('N5', 5), ('N4', 4), ('N3', 3)):
        for c in order[lv]:
            x = v1.get(c)
            if not x:
                problems.append(u'%s: v1-д алга' % c)
                continue
            if x.get('n') != n:
                problems.append(u'%s: v1-д N%s, jisho-д %s' % (c, x.get('n'), lv))
            ex, seen = [], set()
            cand = [(w['kj'], w['jp'], w['mn'], w.get('au')) for w in v2words if c in w['kj']]
            cand += [(w.get('jp', ''), w.get('kana', ''), w.get('mn', ''), w.get('id')) for w in x.get('w') or []]
            for kj, kn, mn, au in cand:
                jp, kana = first(kj), first(kn)
                if not jp or c not in jp or not KANA.match(kana) or jp in seen:
                    continue
                seen.add(jp)
                e = {'jp': jp, 'kana': kana, 'mn': mn.strip()}
                if au and os.path.exists(os.path.join(ROOT, 'audio', au + '.mp3')):
                    e['au'] = au
                ex.append(e)
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
            out.append({'id': x['id'], 'c': c, 'n': n, 'mn': x['mn'].strip(), 'on': on,
                        'kun': [clean_reading(r) for r in x.get('kun') or [] if clean_reading(r)],
                        's': x.get('s'), 'g': x.get('g'), 'ex': ex, 'o': o})
    if origin:
        problems.append(u'жагсаалтад байхгүй үүсэл: %s' % u''.join(origin))
    families(out)
    if problems:
        sys.exit(u'ZOGSOV:\n  ' + u'\n  '.join(problems))

    exs = [e for k in out for e in k['ex']]
    print(u'N5 %d · N4 %d · N3 %d · жишээ %d (бичлэгтэй %d) · жишээгүй ханз %d: %s' % (
        sum(1 for k in out if k['n'] == 5), sum(1 for k in out if k['n'] == 4), sum(1 for k in out if k['n'] == 3), len(exs),
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
        u'/* N5, N4, N3 ханз — tools/build_v2_kanji_list.py гаргасан, ГАРААР БҮҮ ЗАС.\n'
        u'   Жагсаалт/дараалал: jisho.org (#jlpt-n5, #jlpt-n4). Утга, уншлага: KANJIDIC2\n'
        u'   (EDRDG, CC BY-SA 4.0), монгол утга v1-ийн data/kanji.json. Үүсэл (o):\n'
        u'   en.wiktionary.org (CC BY-SA 4.0) — tools/v2_kanji_origin.tsv. */\n'
        u'window.KOTO_KANJI = [\n' + body + u'\n];\n')
    print(u'v2/kanji.js bichigdlee')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
