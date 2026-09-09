# -*- coding: utf-8 -*-
"""vocab_raw.json  ->  ../data/vocab.json  (апп-д бэлэн хэлбэр)

Гол хөрвүүлэлт:
    accent «なまえ○／おなまえ○»  ->  kana «なまえ／おなまえ»
    Өргөлтийн ↓○△ тэмдгийг салгаж, ЦЭВЭР КАНА уншлагыг гаргана.
    Энэ кана нь «гараар бичих» дасгалын хариулт болно (ромажи биш —
    ромажиг аппад огт харуулахгүй).

Мөн:
    - id  = L03-007 хэлбэрээр
    - ref = 参考語彙 (саарал өнгөтэй) үг — давталтад анхдагчаар оруулахгүй
    - зөрчилтэй бичлэгийг data/REVIEW.md-д жагсаана (гараар шалгах)
"""

import io
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "vocab_raw.json")
OUT = os.path.join(HERE, "..", "data", "vocab.json")
REVIEW = os.path.join(HERE, "..", "data", "REVIEW.md")

ACCENT_MARKS = "↓○△"
CYR = re.compile(r"[Ѐ-ӿ]")
KANA_ONLY = re.compile(r"^[぀-ヿー～（）、。\s]+$")
BRACKET = re.compile(r"［[123]］")


def kana_of(entry):
    """Өргөлтийн баганаас цэвэр кана уншлага гаргана."""
    acc = entry["accent"]
    if acc:
        k = "".join(c for c in acc if c not in ACCENT_MARKS)
        return " ".join(k.split())
    # Өргөлт байхгүй бол үг өөрөө цэвэр кана эсэхийг шалгана
    jp = BRACKET.sub("", entry["jp"])
    return jp.strip() if KANA_ONLY.match(jp) else ""


def lesson0():
    """«Хичээлээс гадуур» — Irodori эхлэхээс өмнө үзсэн кана дасгалын үгс.
    PDF-д байхгүй тул гараар бичсэн lesson0.json-оос ирнэ, lesson = 0."""
    p = os.path.join(HERE, "lesson0.json")
    if not os.path.exists(p):
        return []
    src = json.load(io.open(p, encoding="utf-8"))
    out = []
    for i, e in enumerate(src["items"], 1):
        out.append({
            "id": "L00-%03d" % i, "lesson": 0, "section": "Хичээлээс гадуур",
            "jp": e["jp"], "kana": e["kana"], "accent": "",
            "romaji": e["romaji"], "mn": e["mn"], "ref": False,
        })
    return out


def load_fixes():
    """Гараар хийсэн засвар. Түлхүүр нь «<хичээл>|<日本語>» — id нь задлалт
    өөрчлөгдвөл шилждэг тул түүнийг ашиглахгүй."""
    p = os.path.join(HERE, "fixes.json")
    if not os.path.exists(p):
        return {}
    return json.load(io.open(p, encoding="utf-8")).get("items", {})


def main():
    fixes = load_fixes()
    used = set()
    raw = json.load(io.open(RAW, encoding="utf-8"))
    out, review = [], []
    per = {}
    out.extend(lesson0())
    for e in raw:
        les = e["lesson"]
        per[les] = per.get(les, 0) + 1
        kana = kana_of(e)
        item = {
            "id": "L%02d-%03d" % (les, per[les]),
            "lesson": les,
            "section": e["section"],
            "jp": BRACKET.sub("", e["jp"]).strip(),
            "kana": kana,
            "accent": e["accent"],
            "romaji": e["romaji"],
            "mn": e["mn"],
            "ref": e["ref"],
        }
        if e["group"]:
            item["group"] = int(e["group"])   # үйл үгийн бүлэг 1/2/3

        key = "%d|%s" % (les, item["jp"])
        if key in fixes:
            item.update(fixes[key])
            used.add(key)
            if "accent" in fixes[key]:        # засвар өргөлтийг сольсон бол
                item["kana"] = fixes[key].get("kana", kana_of(item))
            kana = item["kana"]
        out.append(item)

        why = []
        if not item["mn"]:
            why.append("утга алга")
        elif not CYR.search(item["mn"]):
            why.append("утга кирилл биш (англи тайлбар байж болно)")
        if not kana:
            why.append("кана уншлага алга")
        if not item["romaji"]:
            why.append("ромажи алга")
        if why:
            review.append((item, why, e["page"]))

    with io.open(OUT, "w", encoding="utf-8") as f:
        json.dump({"source": "Irodori 入門 ことばリスト (Mongolian) — The Japan Foundation",
                   "count": len(out), "items": out}, f, ensure_ascii=False, indent=1)

    with io.open(REVIEW, "w", encoding="utf-8") as f:
        f.write("# Гараар шалгах бичлэгүүд\n\n")
        f.write("PDF-ээс автоматаар задлахад бүрэн гараагүй мөрүүд. ")
        f.write("Нийт **%d / %d** (%.1f%%).\n\n" % (len(review), len(out),
                                                    100.0 * len(review) / len(out)))
        f.write("| id | PDF х. | 日本語 | кана | утга | юу дутуу вэ |\n")
        f.write("|---|---|---|---|---|---|\n")
        for it, why, page in review:
            f.write("| `%s` | %d | %s | %s | %s | %s |\n"
                    % (it["id"], page, it["jp"] or "—", it["kana"] or "—",
                       it["mn"] or "—", " · ".join(why)))

    unused = sorted(set(fixes) - used)
    if unused:
        print("АНХААР: fixes.json дэх дараах түлхүүр таарсангүй:", unused)
    print("items %d  review %d  fixes %d" % (len(out), len(review), len(used)))
    print("lessons:", " ".join("L%d=%d" % (k, per[k]) for k in sorted(per)))
    print("no-kana %d   ref %d" % (sum(1 for i in out if not i["kana"]),
                                   sum(1 for i in out if i["ref"])))


main()
