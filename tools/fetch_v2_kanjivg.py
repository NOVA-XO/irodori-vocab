# -*- coding: utf-8 -*-
u"""v2 «Ханз»-ын ЗУРЛАГА ба ХЭСЭГ — KanjiVG-ээс `v2/kanji-vg/<id>.json`.

KanjiVG (© Ulrich Apel, CC BY-SA 3.0, http://kanjivg.tagaini.net) — ханз бүрийн
зурлага (дарааллаар) ба тэдгээрийн бүлэг (`kvg:element`, `kvg:original`,
`kvg:part`, `kvg:phon`). Commit-ийг ТОГТМОЛЖУУЛСАН (`COMMIT`) — дахин ажиллуулахад
үр дүн өөрчлөгдөхгүй.

Ханз бүрт:
  vb  viewBox (KanjiVG: 0 0 109 109)
  s   [[d, p], …] — зурлага дарааллаар; p = `tools/v2_kanji_origin.tsv`-ийн
      хэсгийн дугаар (o.p), -1 = аль ч хэсэгт ороогүй
  n   [[x, y], …] — зурлагын дугаарын байрлал
  ok  true = o.p-ийн БҮХ хэсэг KanjiVG-ийн бүлэгтэй таарсан (будаж болно). Нэг нь
      ч таараагүй (ж: 国-ийн хэсэг нь хуучин 國-ийнх — 或 нь 国-д алга) бол false —
      өнгө хэрэглэхгүй, зөвхөн зурлагын дараалал.
  c   ханзны ДЭЭД түвшний харагдах бүрэлдэхүүн (休 → 亻 木; 集 → 隹 木) — «нэг хэсэгтэй
      ханз» (гэр бүл)-д build ашиглана. Бүх түвшнийг авбал 彳, 隹, 化 доторх 亻-хэлбэр
      «хүн»-ий гэр бүлд орж (行 後 集 花) төөрөгдүүлж байв (11-04).

Хэсэг ↔ бүлэг: тэмдэгт ижил, эсвэл хувилбар нь ижил (亻 ↔ 人 — KanjiVG-ийн
`kvg:original`-оос). Нэг тэмдэгт хоёр удаа (品 口口口, 友 又又) бол дарааллаар нь
өөр өөр бүлэгт. `kvg:part`-аар хуваагдсан бүлгийг (國-ийн 囗) нэг хэсэг гэж үзнэ.

Ажиллуулах (сүлжээ; raw.githubusercontent.com):
    python tools/fetch_v2_kanjivg.py [--cache <хавтас>]
"""
import io
import json
import os
import re
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'v2', 'kanji-vg')
COMMIT = '70a0b7ae0c18ceb5cb358274b029cce0234a43bc'
URL = 'https://raw.githubusercontent.com/KanjiVG/kanjivg/%s/kanji/%%s.svg' % COMMIT
UA = {'User-Agent': 'KOTO-kanji-origin/0.1 (personal study app)'}
TOKEN = re.compile(r'<g\b([^>]*)>|</g>|<path\b([^>]*?)/?>|<text\b([^>]*)>([^<]*)</text>')
ATTR = re.compile(r'([\w:]+)="([^"]*)"')


def load_kanji():
    raw = io.open(os.path.join(ROOT, 'v2', 'kanji.js'), encoding='utf-8').read()
    return json.loads(raw[raw.index('['):raw.rindex(']') + 1])


def fetch(c, cache):
    name = '%05x.svg' % ord(c)
    p = os.path.join(cache, name) if cache else None
    if p and os.path.exists(p):
        return io.open(p, encoding='utf-8').read()
    data = urllib.request.urlopen(urllib.request.Request(URL % name[:-4], headers=UA), timeout=60).read().decode('utf-8')
    if p:
        io.open(p, 'w', encoding='utf-8', newline='\n').write(data)
    time.sleep(0.2)
    return data



def parse(svg):
    groups, strokes, nums, stack = [], [], [], []
    body = svg[svg.index('<g id="kvg:StrokePaths'):]
    vb = re.search(r'viewBox="([^"]+)"', svg).group(1)
    for m in TOKEN.finditer(body):
        if m.group(1) is not None:
            a = dict(ATTR.findall(m.group(1)))
            g = {'el': a.get('kvg:element', ''), 'orig': a.get('kvg:original', ''), 'part': a.get('kvg:part', ''),
                 'phon': a.get('kvg:phon', ''), 'strokes': [], 'depth': len(stack),
                 'lvl': sum(1 for x in stack if x['el'])}
            stack.append(g)
            if g['el']:
                groups.append(g)
        elif m.group(0) == '</g>':
            if stack:
                stack.pop()
        elif m.group(2) is not None:
            a = dict(ATTR.findall(m.group(2)))
            i = len(strokes)
            # ЭХЭЭР нь (2 орон). 1 орон хүртэл тоймлоход харьцангуй «c»-ийн алдаа замын дагуу хуримтлагдаж
            # пикселийн зөрүү 7% хүрч байв (11-04) — хэмнэлт нь ~20%, үнэ цэнэгүй.
            strokes.append(a['d'])
            for g in stack:
                g['strokes'].append(i)
        else:
            t = re.search(r'matrix\(1 0 0 1 ([-\d.]+) ([-\d.]+)\)', m.group(3))
            if t:
                nums.append([round(float(t.group(1)), 1), round(float(t.group(2)), 1)])
    return vb, groups, strokes, nums


def main():
    cache = sys.argv[sys.argv.index('--cache') + 1] if '--cache' in sys.argv else None
    if cache:
        os.makedirs(cache, exist_ok=True)
    kanji = load_kanji()
    parsed = {k['c']: parse(fetch(k['c'], cache)) for k in kanji}
    canon = {u'阝': u'阜'}  # tsv: 阝 (U+961D) ↔ KanjiVG: ⻖ (U+2ED6, original 阜) — 院
    for vb, groups, strokes, nums in parsed.values():
        for g in groups:
            if g['orig'] and g['orig'] != g['el']:
                canon[g['el']] = g['orig']
    cn = lambda x: canon.get(x, x)
    os.makedirs(OUT, exist_ok=True)
    keep, okn, mism, scount = set(), 0, [], []
    for k in kanji:
        c = k['c']
        vb, groups, strokes, nums = parsed[c]
        top = [g for g in groups if g['depth'] > 1 or g['el'] != c]
        parts = (k.get('o') or {}).get('p') or []
        owner = [-1] * len(strokes)
        used, ok = set(), bool(parts)
        for pi, p in enumerate(parts):
            hit = None
            for gi, g in enumerate(top):
                if gi in used or not (cn(g['el']) == cn(p['c']) or (g['orig'] and cn(g['orig']) == cn(p['c']))):
                    continue
                # 暮 = 莫 + 日: 莫 доторх 日-ийн зурлага аль хэдийн 莫-д — доод 日-г хайна (11-05)
                if g['strokes'] and all(owner[s] != -1 for s in g['strokes']):
                    continue
                hit = [gi]
                if g['part']:
                    for gj in range(gi + 1, len(top)):
                        h = top[gj]
                        if h['el'] == g['el'] and h['part'] and gj not in used:
                            hit.append(gj)
                break
            if not hit:
                ok = False
                continue
            used.update(hit)
            for gi in hit:
                for s in top[gi]['strokes']:
                    if owner[s] == -1:
                        owner[s] = pi
        if not ok:
            owner = [-1] * len(strokes)
            if parts:
                mism.append(c)
        else:
            okn += 1
        comps = []
        for g in top:
            if g['lvl'] == 1 and g['el'] != c and g['el'] not in comps:
                comps.append(g['el'])
        if len(strokes) != k['s']:
            scount.append('%s:%d/%d' % (c, len(strokes), k['s']))
        name = k['id'] + '.json'
        io.open(os.path.join(OUT, name), 'w', encoding='utf-8', newline='\n').write(
            json.dumps({'vb': vb, 'ok': ok, 's': [[d, o] for d, o in zip(strokes, owner)], 'n': nums, 'c': comps},
                       ensure_ascii=False, separators=(',', ':')) + '\n')
        keep.add(name)
    for f in os.listdir(OUT):
        if f.endswith('.json') and f not in keep:
            os.remove(os.path.join(OUT, f))
    withp = sum(1 for k in kanji if (k.get('o') or {}).get('p'))
    print(u'KanjiVG %s: %d ханз · хэсэгтэй %d-аас будаж болох %d · таараагүй %d: %s' % (
        COMMIT[:7], len(kanji), withp, okn, len(mism), ''.join(mism)))
    print(u'зурлагын тоо KANJIDIC-тай зөрсөн %d: %s' % (len(scount), ' '.join(scount)))


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
