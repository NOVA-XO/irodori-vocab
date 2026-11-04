# -*- coding: utf-8 -*-
u"""v2 (KOTO)-ийн «Ханз» хуудасны өгөгдөл — `v2/kanji.js`.

Жагсаалт ба дараалал: `tools/v2_kanji_order.txt` (jisho.org-ийн #jlpt-n5,
#jlpt-n4; 79 + 166). Утга, уншлага, зурлага, анги, жишээ үг: v1-ийн
`data/kanji.json` (KANJIDIC2, CC BY-SA 4.0; монгол утгыг гараар шалгасан).
2026-11-04-нд хоёр жагсаалт ханз бүрээрээ ТААРСАН — зөрвөл ЗОГСОНО.

Жишээ үг (3 хүртэл): ЭХЛЭЭД v2-ийн үгийн сангаас (`kj` нь тухайн ханзтай —
суралцагчийн үзсэн үг; 245-аас 130-д), дараа нь v1-ийн `w`. v1-д тооны ханзын
жишээ алга эсвэл `（十二歳以上）` хэлбэртэй байв. `行く／行きます` → эхний хувилбар,
`～` хасна; уншлага нь зөвхөн кана, үг нь тухайн ханзыг агуулсан байх
ёстой. Бичлэг (`au`) — `audio/<id>.mp3` бодитоор байвал л.

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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry', action='store_true')
    args = ap.parse_args()

    order = load_order()
    v1 = {x['c']: x for x in json.load(io.open(os.path.join(ROOT, 'data', 'kanji.json'), encoding='utf-8'))['items']}
    raw = io.open(os.path.join(ROOT, 'v2', 'data.js'), encoding='utf-8').read()
    v2words = [w for t in json.loads(raw[raw.index('['):raw.rindex(']') + 1]) for w in t['words'] if w.get('kj')]
    out, problems = [], []
    for lv, n in (('N5', 5), ('N4', 4)):
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
            out.append({'id': x['id'], 'c': c, 'n': n, 'mn': x['mn'].strip(),
                        'on': [clean_reading(r) for r in x.get('on') or [] if clean_reading(r)],
                        'kun': [clean_reading(r) for r in x.get('kun') or [] if clean_reading(r)],
                        's': x.get('s'), 'g': x.get('g'), 'ex': ex})
    if problems:
        sys.exit(u'ZOGSOV:\n  ' + u'\n  '.join(problems))

    exs = [e for k in out for e in k['ex']]
    print(u'N5 %d · N4 %d · жишээ %d (бичлэгтэй %d) · жишээгүй ханз %d: %s' % (
        sum(1 for k in out if k['n'] == 5), sum(1 for k in out if k['n'] == 4), len(exs),
        sum(1 for e in exs if 'au' in e), sum(1 for k in out if not k['ex']),
        u''.join(k['c'] for k in out if not k['ex'])))
    if args.dry:
        return
    body = u',\n'.join(u' ' + json.dumps(k, ensure_ascii=False, separators=(',', ':')) for k in out)
    io.open(os.path.join(ROOT, 'v2', 'kanji.js'), 'w', encoding='utf-8', newline='\n').write(
        u'/* N5 ба N4 ханз — tools/build_v2_kanji_list.py гаргасан, ГАРААР БҮҮ ЗАС.\n'
        u'   Жагсаалт/дараалал: jisho.org (#jlpt-n5, #jlpt-n4). Утга, уншлага: KANJIDIC2\n'
        u'   (EDRDG, CC BY-SA 4.0), монгол утга v1-ийн data/kanji.json. */\n'
        u'window.KOTO_KANJI = [\n' + body + u'\n];\n')
    print(u'v2/kanji.js bichigdlee')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
