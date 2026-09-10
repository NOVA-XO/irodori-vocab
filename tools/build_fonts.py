# -*- coding: utf-8 -*-
"""Аппад ХЭРЭГТЭЙ тэмдэгтээр нь огтолсон фонт татаж `fonts/`-д хадгална.

Яагаад хэрэгтэй вэ:
  · Windows-ийн serif фонтуудад (Georgia, Times, Cambria …) монгол
    кирилл дэх **Ү (U+04AE) ба Ө (U+04E8)** БАЙХГҮЙ. Тэдгээр үсэг өөр
    фонтоос орлогддог тул нэг үгийн дунд хоёр өөр загварын үсэг
    холилдож харагддаг. Шалгасан: Georgia · Times · Palatino ·
    Cambria · Constantia — бүгд дутуу.
  · 明朝 (Yu Mincho) нь зөвхөн Windows/Mac дээр бий. Android дээр
    байхгүй тул япон бичиг гоцхон өөр харагдана.

Шийдэл: Noto Serif (латин+кирилл) ба Noto Serif JP (япон) хоёрыг
Google Fonts-оос ЗӨВХӨН бидний хэрэглэдэг тэмдэгтээр огтолж татна.

Google-ийн `text=` параметр URL хэт урт болвол ЧИМЭЭГҮЙ үл тоогддог —
1568 тэмдэгт өгөхөд огтолсон нэг файлын оронд бүтэн фонтыг 124 хэсгээр
буцаасан. Тиймээс тэмдэгтээ жижиг багцаар хуваан хүсэлт тавина.

Ажиллуулах:  python tools/build_fonts.py
Гаралт:      fonts/*.woff2 · fonts/fonts.css
"""
import io
import json
import glob
import os
import re
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
OUT = os.path.join(ROOT, "fonts")

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
CHUNK = 300            # нэг хүсэлтэд өгөх тэмдэгтийн тоо (URL ~2.7 КБ)


def get(url, binary=False):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    data = urllib.request.urlopen(req, timeout=90).read()
    return data if binary else data.decode("utf-8")


def app_chars():
    """Аппын БҮХ өгөгдөл ба марк-апад орсон тэмдэгтүүд."""
    chars = set()

    def walk(o):
        if isinstance(o, str):
            chars.update(o)
        elif isinstance(o, dict):
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)

    for f in glob.glob(os.path.join(ROOT, "data", "*.json")):
        if os.path.basename(f) == "audio.json":
            continue            # зөвхөн id-ийн жагсаалт, үсэг агуулахгүй
        walk(json.load(io.open(f, encoding="utf-8")))
    for f in ("index.html", "app.js"):
        chars.update(io.open(os.path.join(ROOT, f), encoding="utf-8").read())
    return chars


def is_jp(c):
    o = ord(c)
    return (0x3000 <= o <= 0x30FF or 0x3400 <= o <= 0x9FFF
            or 0xFF00 <= o <= 0xFFEF)


def is_lat_cyr(c):
    o = ord(c)
    return o < 0x0250 or 0x0400 <= o <= 0x052F or 0x2000 <= o <= 0x206F \
        or o in (0x2116, 0x20AC, 0x2192, 0x2193, 0x2191, 0x25CB, 0x25B3)


def fetch_subsets(family, chars, tag):
    """Тэмдэгтүүдийг багцлан татаж, (файлын нэр, unicode-range) жагсаалт буцаана."""
    chars = sorted(chars)
    faces = []
    for i in range(0, len(chars), CHUNK):
        part = "".join(chars[i:i + CHUNK])
        url = ("https://fonts.googleapis.com/css2?family="
               + urllib.parse.quote(family) + ":wght@400"
               + "&text=" + urllib.parse.quote(part))
        css = get(url)
        urls = re.findall(r"url\((https://[^)]+)\)", css)
        rng = re.findall(r"unicode-range:\s*([^;]+);", css)
        if len(urls) != 1:
            raise SystemExit("ANHAAR: %s bagts %d -> %d file (text= ul toogdson)"
                             % (tag, i // CHUNK, len(urls)))
        name = "%s-%02d.woff2" % (tag, i // CHUNK)
        with open(os.path.join(OUT, name), "wb") as f:
            f.write(get(urls[0], binary=True))
        faces.append((name, rng[0].strip() if rng else None))
        print("  %s  %6d bytes" % (name, os.path.getsize(os.path.join(OUT, name))))
    return faces


def main():
    if not os.path.isdir(OUT):
        os.makedirs(OUT)
    chars = app_chars()
    jp = [c for c in chars if is_jp(c)]
    lc = [c for c in chars if is_lat_cyr(c)]
    print("japanese %d   latin+cyrillic %d" % (len(jp), len(lc)))

    css = ["/* Автоматаар үүсгэсэн — tools/build_fonts.py. ГАРААР ЗАСАХГҮЙ.",
           " * Noto Serif · Noto Serif JP — SIL Open Font License 1.1 (fonts/OFL.txt).",
           " * Зөвхөн энэ аппад хэрэглэгддэг тэмдэгтээр огтолсон. */"]

    for family, tag, cs in (("Noto Serif", "ns", lc),
                            ("Noto Serif JP", "nsjp", jp)):
        print(family)
        for name, rng in fetch_subsets(family, cs, tag):
            css.append("@font-face{font-family:'%s';font-style:normal;"
                       "font-weight:400;font-display:swap;"
                       "src:url(%s) format('woff2');%s}"
                       % (family, name,
                          ("unicode-range:%s;" % rng) if rng else ""))

    io.open(os.path.join(OUT, "fonts.css"), "w", encoding="utf-8").write(
        "\n".join(css) + "\n")

    total = sum(os.path.getsize(os.path.join(OUT, f))
                for f in os.listdir(OUT) if f.endswith(".woff2"))
    print("niit: %.1f KB" % (total / 1024.0))


main()
