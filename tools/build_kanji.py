"""KANJIDIC2 + JLPT жагсаалт + манай үгийн сан  ->  data/kanji.json

Хамрах хүрээ:
    · Irodori 入門-ийн үгсэд ГАРСАН бүх ханз (хичээл тус бүрээр)
    · JLPT N5 · N4 · N3 · N2-ын ханз

Эх сурвалж ба эрх:
    KANJIDIC2 — Electronic Dictionary Research and Development Group (EDRDG),
    CC BY-SA 4.0. Уншлага, зурлагын тоо, сургуулийн анги (文部科学省-ийн
    学年別漢字配当表), утга нь эндээс.
    JLPT түвшний жагсаалт — kanjiapi.dev.

    АНХААР: 2010 оноос хойш JLPT нь ханзны АЛБАН ЁСНЫ жагсаалт нийтлэхээ
    больсон. N5–N2 гэсэн хуваарь нь өргөн хэрэглэгддэг албан бус жагсаалт.
    Харин `grade` талбар нь Японы Боловсролын яамны АЛБАН ЁСНЫ анги юм.

Урьдчилсан бэлтгэл (tools/_kd/, репод ордоггүй):
    kanjidic2.xml.gz     http://www.edrdg.org/kanjidic/kanjidic2.xml.gz
    jlpt-5.json … jlpt-2.json   https://kanjiapi.dev/v1/kanji/jlpt-N

Ажиллуулах:  python tools/build_kanji.py
"""
import collections
import gzip
import io
import json
import os
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
KD = os.path.join(HERE, "_kd")
OUT = os.path.join(HERE, "..", "data", "kanji.json")
# Монгол утга. Түвшин тус бүрээр тусдаа файлд — нэгийг засахад бусдыг дахин
# бичих шаардлагагүй. kanji_mn*.json бүгдийг нь нийлүүлж уншина.
import glob
MN_GLOB = os.path.join(HERE, "kanji_mn*.json")


def is_kanji(ch):
    c = ord(ch)
    return 0x4E00 <= c <= 0x9FFF or 0x3400 <= c <= 0x4DBF


# Ном тус бүрийн хичээлийн тэмдэглэгээ ТУСДАА талбарт орно: аппад аль ном
# сонгосноос хамаарч шүүнэ.  l = 入門 · l1 = 初級1 · l2 = 初級2
VOCAB_FILES = [("l", "vocab.json"), ("l1", "vocab-el1.json"), ("l2", "vocab-el2.json")]


def from_vocab(fname):
    """Ханз бүр АЛЬ хичээлүүдэд гарсан, ямар үгэнд орсныг цуглуулна."""
    p = os.path.join(HERE, "..", "data", fname)
    if not os.path.exists(p):
        return {}
    d = json.load(io.open(p, encoding="utf-8"))
    got = collections.OrderedDict()
    for it in d["items"]:
        if it.get("ref"):
            continue                      # 参考語彙 — давталтад анхдагчаар ордоггүй
        for ch in it["jp"]:
            if not is_kanji(ch):
                continue
            e = got.setdefault(ch, {"lessons": set(), "words": []})
            e["lessons"].add(it["lesson"])
            if len(e["words"]) < 3 and it.get("kana"):
                e["words"].append({"jp": it["jp"], "kana": it["kana"],
                                   "mn": it.get("mn", ""), "id": it["id"]})
    return got


def jlpt_levels():
    lv = {}
    for n in (2, 3, 4, 5):               # N5 хамгийн сүүлд бичигдэж давуулна
        p = os.path.join(KD, "jlpt-%d.json" % n)
        if not os.path.exists(p):
            continue
        for ch in json.load(io.open(p, encoding="utf-8")):
            lv[ch] = n
    return lv


def kanjidic(want):
    """want доторх ханзны уншлага, утга, зурлага, ангийг гаргана."""
    out = {}
    with gzip.open(os.path.join(KD, "kanjidic2.xml.gz"), "rb") as f:
        for _, el in ET.iterparse(f, events=("end",)):
            if el.tag != "character":
                continue
            ch = el.findtext("literal")
            if ch in want:
                on, kun, mean = [], [], []
                for rm in el.iter("rmgroup"):
                    for r in rm.findall("reading"):
                        t = r.get("r_type")
                        if t == "ja_on":
                            on.append(r.text)
                        elif t == "ja_kun":
                            kun.append(r.text)
                    for m in rm.findall("meaning"):
                        if m.get("m_lang") is None:      # хэлгүй = англи
                            mean.append(m.text)
                misc = el.find("misc")
                out[ch] = {
                    "on": on, "kun": kun, "en": mean,
                    "strokes": int(misc.findtext("stroke_count") or 0),
                    "grade": int(misc.findtext("grade") or 0) or None,
                }
            el.clear()
    return out


def main():
    vocs = {key: from_vocab(f) for key, f in VOCAB_FILES}
    lv = jlpt_levels()
    want = set(lv)
    for v in vocs.values():
        want |= set(v)
    kd = kanjidic(want)
    mn = {}
    for f in sorted(glob.glob(MN_GLOB)):
        mn.update(json.load(io.open(f, encoding="utf-8")).get("items", {}))

    items, missing = [], []
    # Эрэмбэ: эхлээд JLPT түвшнээр (N5→N2), дараа нь зурлагын тоогоор.
    for ch in sorted(want, key=lambda c: (-(lv.get(c) or 0),
                                          kd.get(c, {}).get("strokes", 99), c)):
        k = kd.get(ch)
        if not k:
            continue                      # KANJIDIC2-д байхгүй ховор тэмдэгт
        pass
        it = {
            # Явцын id. Юникод кодоор хийвэл жагсаалт өөрчлөгдөхөд ч
            # ХЭЗЭЭ Ч шилжихгүй — хэрэглэгчийн явц алдагдахгүй.
            "id": "J-%04X" % ord(ch),
            "c": ch,
            "on": k["on"][:4],
            "kun": [r for r in k["kun"] if "-" not in r][:4] or k["kun"][:4],
            "mn": mn.get(ch, ""),
            "en": k["en"][:4],
            "s": k["strokes"],
        }
        if lv.get(ch):
            it["n"] = lv[ch]              # JLPT N-түвшин
        if k["grade"]:
            it["g"] = k["grade"]          # 文科省-ийн анги
        # Жишээ үг: 入門-ийг эхэнд нь тавина (хамгийн энгийн нь), дараа нь бусад.
        words = []
        for key, _ in VOCAB_FILES:
            v = vocs[key].get(ch)
            if not v:
                continue
            it[key] = sorted(v["lessons"])
            words.extend(v["words"])
        if words:
            it["w"] = words[:3]
        items.append(it)
        if not it["mn"]:
            missing.append(ch)

    with io.open(OUT, "w", encoding="utf-8") as f:
        json.dump({
            "source": "KANJIDIC2 (EDRDG, CC BY-SA 4.0) · JLPT түвшин: kanjiapi.dev",
            "note": "JLPT нь 2010 оноос хойш ханзны албан ёсны жагсаалт нийтлээгүй "
                    "— N5–N2 нь өргөн хэрэглэгддэг албан бус жагсаалт. `g` талбар "
                    "нь Японы Боловсролын яамны албан ёсны анги.",
            "count": len(items), "items": items,
        }, f, ensure_ascii=False, separators=(",", ":"))

    per = collections.Counter(i.get("n", 0) for i in items)
    per_book = {k: sum(1 for i in items if k in i) for k, _ in VOCAB_FILES}
    print("kanji %d  (starter %d, el1 %d, el2 %d)"
          % (len(items), per_book["l"], per_book["l1"], per_book["l2"]))
    print("JLPT:", " ".join("N%d=%d" % (n, per[n]) for n in (5, 4, 3, 2) if per[n]),
          " no-level=%d" % per[0])
    print("missing mn: %d" % len(missing))
    if missing:
        io.open(os.path.join(HERE, "kanji_missing.txt"), "w",
                encoding="utf-8").write("".join(missing))


main()
