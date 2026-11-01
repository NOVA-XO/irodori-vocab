# -*- coding: utf-8 -*-
u"""v2 (KOTO)-ийн үгэнд ханзан бичлэг (`kj`) оноож, катакана үсгийн
хүснэгтийг (`v2/kana.js`) гаргана.

Ханзын эх сурвалж хоёр:
  · v1-тэй холбоотой үг (`au` нь v1-ийн id) -> v1-ийн `jp` (Irodori эх).
    Зөвхөн v1-ийн `kana` нь v2-ийн `jp`-тэй ЯГ таарсан үед — таарахгүй
    бол өөр үгийн ханз наалдах эрсдэлтэй (2026-11-01: 222/222 таарав).
  · KT- үг (v1-д байхгүй) -> `tools/v2_kanji_manual.tsv`. Claude ба Astra
    бие даан гаргаж тулгасан; кана багана нь шалгалт — дараалал хөдөлсөн
    бол ЗОГСОНО.

`v2/kana.js` нь `data.js`-ээс ТУСДАА: `build_v2_audio.py` нь `data.js`-ийг
`window.KOTO_DATA`-аар л дахин бичдэг тул нэг файлд байвал устна.

Ажиллуулах:
    python tools/build_v2_kanji.py          # -> v2/data.js, v2/kana.js
    python tools/build_v2_kanji.py --dry    # зөвхөн тайлан
"""
import argparse
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KANJI = re.compile(u'[一-鿿々]')
NONE = u'—'


def load_data():
    raw = io.open(os.path.join(ROOT, 'v2', 'data.js'), encoding='utf-8').read()
    body = raw[raw.index('['):raw.rindex(']') + 1]
    return json.loads(body)


def load_v1():
    v1 = {}
    for name in ('vocab', 'vocab-el1', 'vocab-el2', 'vocab-n5'):
        p = os.path.join(ROOT, 'data', name + '.json')
        for it in json.load(io.open(p, encoding='utf-8'))['items']:
            v1[it['id']] = it
    return v1


def load_manual():
    out = {}
    p = os.path.join(ROOT, 'tools', 'v2_kanji_manual.tsv')
    for line in io.open(p, encoding='utf-8'):
        if line.startswith('#') or not line.strip():
            continue
        cols = line.rstrip('\n').split('\t')
        out[cols[0]] = (cols[1], cols[2])
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry', action='store_true')
    args = ap.parse_args()
    data, v1, manual = load_data(), load_v1(), load_manual()
    n_v1 = n_manual = 0
    errors = []
    for t, topic in enumerate(data):
        for i, w in enumerate(topic['words']):
            wid = '%d:%d' % (t, i)
            w.pop('kj', None)
            src = v1.get(w.get('au', ''))
            if src:
                if KANJI.search(src['jp']) and src['jp'] != w['jp']:
                    if src.get('kana') != w['jp']:
                        errors.append(u'%s v1 kana %s != %s' % (wid, src.get('kana'), w['jp']))
                        continue
                    w['kj'] = src['jp']
                    n_v1 += 1
            elif wid in manual:
                kana, kj = manual[wid]
                if kana != w['jp']:
                    errors.append(u'%s manual kana %s != %s' % (wid, kana, w['jp']))
                    continue
                if kj != NONE:
                    w['kj'] = kj
                    n_manual += 1
            else:
                errors.append(u'%s KT үг гар хүснэгтэд алга: %s' % (wid, w['jp']))
    if errors:
        for e in errors:
            print(e.encode('ascii', 'backslashreplace').decode('ascii'))
        sys.exit('ZOGSOV: %d aldaa' % len(errors))
    total = sum(len(t['words']) for t in data)
    print('kj: v1 %d + gar %d = %d / %d' % (n_v1, n_manual, n_v1 + n_manual, total))

    kana = json.load(io.open(os.path.join(ROOT, 'data', 'kana.json'), encoding='utf-8'))['items']
    table = [{'id': k['id'], 'kata': k['kata'], 'hira': k['hira'], 'mn': k['mn'], 'g': k['group']} for k in kana]
    print('kana: %d' % len(table))
    if args.dry:
        return
    body = json.dumps(data, ensure_ascii=False, indent=2)
    io.open(os.path.join(ROOT, 'v2', 'data.js'), 'w', encoding='utf-8', newline='\n').write(
        u'window.KOTO_DATA = %s;\n' % body)
    io.open(os.path.join(ROOT, 'v2', 'kana.js'), 'w', encoding='utf-8', newline='\n').write(
        u'window.KOTO_KANA = %s;\n' % json.dumps(table, ensure_ascii=False, indent=1))
    print('v2/data.js, v2/kana.js bichigdlee')


if __name__ == '__main__':
    main()
