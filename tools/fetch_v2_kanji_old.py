# -*- coding: utf-8 -*-
u"""v2 «Ханз»-ын ЭРТНИЙ БИЧИГ — Wikimedia Commons-оос `v2/kanji-old/<id>-<kind>.svg`.

«Ancient Chinese characters project»-ийн `<ханз>-oracle.svg` (мэргийн ясны бичиг),
`-bronze.svg` (хүрэл), `-seal.svg` (тамга) — БАЙГАА БҮГДИЙГ (хувьслын шугам, 11-04;
өмнө нь эхнийхийг л).
Зөвхөн Public domain / CC0 файл (2026-11-04-нд 509-өөс 508 PD, 1 CC0).

Аль ханзад: `tools/v2_kanji_origin.tsv`-ийн `t` нь psc (утга + дуу)-аас бусад —
тэдгээрийн эртний дүрс нь үүслийг нь харуулдаг. Ямар ханзнаас: `src`, эсвэл
`old` (国 → 國), эсвэл ханз өөрөө.

SVG-г цэвэрлэнэ: metadata/inkscape хог, script, гадаад холбоос хасаж, зөвхөн
дүрсний элемент (path, polygon …) ба viewBox үлдээнэ; замын тоог 2 орон хүртэл тоймлоно (transform, viewBox-ийг хөндөхгүй).
Үр дүн, эх файлын нэр, лиценз: `tools/v2_kanji_old.tsv`.

Ажиллуулах (сүлжээ хэрэгтэй; upload.wikimedia.org 429 өгвөл хүлээгээд дахин оролдоно):
    python tools/fetch_v2_kanji_old.py [--cache <хавтас>]   # кэш: татсан эх SVG-г хадгална
"""
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'v2', 'kanji-old')
# Wikimedia-гийн UA дүрэм: холбоо барих хаяг (нийтийн репо) — үгүй бол хязгаар чанга (11-04).
UA = {'User-Agent': 'KOTO-kanji-origin/0.2 (https://github.com/NOVA-XO/irodori-vocab; study app) python-urllib'}
PAUSE = 2.0
API = 'https://commons.wikimedia.org/w/api.php'
KINDS = ('oracle', 'bronze', 'seal')
OK_LIC = ('Public domain', 'CC0')
SVG = 'http://www.w3.org/2000/svg'
SHAPES = ('path', 'polygon', 'polyline', 'rect', 'circle', 'ellipse', 'line')
GEOM = {'d', 'points', 'x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'rx', 'ry',
        'x1', 'y1', 'x2', 'y2', 'transform', 'fill-rule', 'clip-rule', 'fill', 'stroke',
        'stroke-width', 'stroke-linecap', 'stroke-linejoin'}
STYLE = ('fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'fill-rule')
NUM = re.compile(r'-?\d*\.\d+(?:e-?\d+)?|-?\d+(?:e-?\d+)?')


def load_origin():
    rows = []
    for line in io.open(os.path.join(ROOT, 'tools', 'v2_kanji_origin.tsv'), encoding='utf-8'):
        line = line.rstrip('\n')
        if not line or line.startswith('#'):
            continue
        rows.append((line.split('\t') + [''] * 7)[:7])
    return rows


def kanji_ids():
    raw = io.open(os.path.join(ROOT, 'v2', 'kanji.js'), encoding='utf-8').read()
    return {k['c']: k['id'] for k in json.loads(raw[raw.index('['):raw.rindex(']') + 1])}


def get(url, tries=6):
    for i in range(tries):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()
        except urllib.error.HTTPError as e:
            if e.code != 429 or i == tries - 1:
                raise
            wait = int(e.headers.get('Retry-After') or 0) or 10 * (i + 1)
            sys.stderr.write('429 — %d сек хүлээнэ (%d/%d)\n' % (wait, i + 1, tries))
            sys.stderr.flush()
            time.sleep(wait)


def get_cached(url, cache):
    if not cache:
        data = get(url)
        time.sleep(PAUSE)
        return data
    p = os.path.join(cache, '%s' % '_'.join('%04X' % ord(ch) for ch in urllib.parse.unquote(url.rsplit('/', 1)[-1])))
    if not os.path.exists(p) or not os.path.getsize(p):
        data = get(url)  # эхлээд татаж, ДАРАА нь бичнэ — 429-ийн хүлээлтэд хоосон кэш үлдэж байв (11-04)
        io.open(p, 'wb').write(data)
        time.sleep(PAUSE)
    return io.open(p, 'rb').read()


def query(titles):
    info = {}
    for i in range(0, len(titles), 50):
        q = urllib.parse.urlencode({'action': 'query', 'format': 'json', 'prop': 'imageinfo',
                                    'iiprop': 'url|extmetadata', 'iiextmetadatafilter': 'LicenseShortName',
                                    'titles': '|'.join(titles[i:i + 50])})
        r = json.loads(get(API + '?' + q))
        norm = {n['to']: n['from'] for n in r['query'].get('normalized', [])}
        for p in r['query']['pages'].values():
            ii = p.get('imageinfo')
            if ii:
                info[norm.get(p['title'], p['title'])] = {
                    'url': ii[0]['url'].split('?')[0],
                    'lic': ii[0]['extmetadata'].get('LicenseShortName', {}).get('value', '')}
        time.sleep(0.5)
    return info


def short(v):
    def f(m):
        x = round(float(m.group(0)), 3)
        s = ('%.3f' % x).rstrip('0').rstrip('.')
        if s in ('-0', ''):  # «1.54-0.04» — хасах нь тусгаарлагч; '0' болговол «1.50» болж нийлнэ (11-04)
            s = '-0' if m.group(0).startswith('-') else '0'
        # «22.99.04» — хоёр дахь тоог зөвхөн цэг тусгаарладаг; «23»+«0» нь «230» болж нийлнэ (11-04)
        if m.start() and m.string[m.start() - 1] in '0123456789.' and not s.startswith('-'):
            s = ' ' + s
        return s
    return NUM.sub(f, v)


def clean(data):
    root = ET.fromstring(data)
    if root.tag != '{%s}svg' % SVG:
        raise ValueError('svg биш')
    vb = root.get('viewBox') or '0 0 %s %s' % (root.get('width', '300').rstrip('px'), root.get('height', '300').rstrip('px'))
    out = []

    def walk(el, depth):
        tag = el.tag.split('}')[-1]
        if el.tag.startswith('{') and not el.tag.startswith('{%s}' % SVG):
            return
        if tag in ('metadata', 'defs', 'title', 'desc', 'script', 'style', 'foreignObject', 'image', 'use', 'a', 'text'):
            return
        attrs = {}
        for k, v in el.attrib.items():
            if k in GEOM:
                attrs[k] = v
        st = el.get('style') or ''
        for decl in st.split(';'):
            k, _, v = decl.partition(':')
            k = k.strip()
            if k in STYLE and v.strip():
                attrs[k] = v.strip()
        for k in list(attrs):
            if re.search(r'url\(|javascript:|expression', attrs[k], re.I):
                del attrs[k]
            elif k in ('d', 'points'):
                # Зөвхөн замын тоо (3 орон — 2 оронд жижиг viewBox-той 望 2.13% зөрж байв, 11-05). transform/viewBox-ийг ТОЙМЛОХГҮЙ: 0.06506 → 0.1 болж
                # дүрс 1.5 дахин томорч байв (半-хүрэл, 11-04; пикселийн харьцуулалт барив).
                attrs[k] = short(attrs[k])
        a = ''.join(' %s="%s"' % (k, attrs[k].replace('"', '')) for k in sorted(attrs))
        if tag == 'g':
            out.append('<g%s>' % a)
            for ch in el:
                walk(ch, depth + 1)
            out.append('</g>')
        elif tag in SHAPES:
            out.append('<%s%s/>' % (tag, a))
        elif tag == 'svg' and depth == 0:
            for ch in el:
                walk(ch, depth + 1)

    walk(root, 0)
    body = ''.join(out)
    while re.search(r'<g>(</g>)', body) or '<g></g>' in body:
        body = body.replace('<g></g>', '')
    if not re.search(r'<(%s)\b' % '|'.join(SHAPES), body):
        raise ValueError('дүрсгүй')
    return '<svg xmlns="%s" viewBox="%s">%s</svg>\n' % (SVG, ' '.join(vb.replace(',', ' ').split()), body)


def main():
    cache = sys.argv[sys.argv.index('--cache') + 1] if '--cache' in sys.argv else None
    if cache:
        os.makedirs(cache, exist_ok=True)
    rows = load_origin()
    ids = kanji_ids()
    want = [(r[0], r[3] or r[2] or r[0]) for r in rows if r[1] != 'psc']
    titles = ['File:%s-%s.svg' % (s, k) for _, s in want for k in KINDS]
    info = query(titles)
    os.makedirs(OUT, exist_ok=True)
    keep = set()
    lines, miss, badlic = [], [], []
    for c, s in want:
        kinds = [k for k in KINDS if 'File:%s-%s.svg' % (s, k) in info]
        if not kinds:
            miss.append(c)
            continue
        for pick in kinds:
            t = 'File:%s-%s.svg' % (s, pick)
            lic = info[t]['lic']
            if lic not in OK_LIC:
                badlic.append((c, t, lic))
                continue
            svg = clean(get_cached(info[t]['url'], cache))
            name = '%s-%s.svg' % (ids[c], pick)
            io.open(os.path.join(OUT, name), 'w', encoding='utf-8', newline='\n').write(svg)
            keep.add(name)
            lines.append('\t'.join((c, s, pick, t[5:], lic)))
    for f in os.listdir(OUT):
        if f.endswith('.svg') and f not in keep:
            os.remove(os.path.join(OUT, f))
    io.open(os.path.join(ROOT, 'tools', 'v2_kanji_old.tsv'), 'w', encoding='utf-8', newline='\n').write(
        u'# v2 «Ханз»-ын эртний бичиг — tools/fetch_v2_kanji_old.py гаргасан, ГАРААР БҮҮ ЗАС.\n'
        u'# Эх: Wikimedia Commons «Ancient Chinese characters project». Багана: c  src  kind  file  license\n'
        + '\n'.join(lines) + '\n')
    kinds = {}
    for l in lines:
        k = l.split('\t')[2]
        kinds[k] = kinds.get(k, 0) + 1
    print(u'эртний бичиг: %d ханз / %d, %d файл · %s · олдоогүй %d: %s · лиценз таараагүй %d' % (
        len(set(l.split('\t')[0] for l in lines)), len(want), len(lines), ' '.join('%s %d' % (k, kinds.get(k, 0)) for k in KINDS),
        len(miss), ''.join(miss), len(badlic)))
    for b in badlic:
        print('  LIC', b)


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
