# -*- coding: utf-8 -*-
"""tools/n5_raw.json  ->  data/vocab-n5.json  (апп-д бэлэн хэлбэр)

Гол хөрвүүлэлт:
  · `[食べます]` -> `食べます`.  Эх сурвалж нь ханзыг дөрвөлжин хаалтанд
    бичдэг: «ханз нь бий, гэхдээ энэ түвшинд ихэвчлэн канагаар бичнэ».
    Аппад харуулахад хаалт хэрэггүй тул хасна, харин тэр УТГЫГ `soft`
    талбарт хадгална — хожим «канагаар бичих нь зөв» гэж заахад хэрэгтэй.
  · id = N5-07-012 хэлбэрээр. Ном тус бүрд угтвар өөр тул явц хольцолдохгүй.
  · tools/n5_fixes.json — эх файлын дутуу/алдаатай мөрийн гараар засвар.

Ажиллуулах:  python tools/build_n5.py
"""
import io
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "n5_raw.json")
OUT = os.path.join(HERE, "..", "data", "vocab-n5.json")
REVIEW = os.path.join(HERE, "..", "data", "REVIEW-n5.md")
FIXES = os.path.join(HERE, "n5_fixes.json")

CYR = re.compile(r"[Ѐ-ӿ]")
KANA = re.compile(r"[぀-ヿ]")
BRACKET = re.compile(r"^\[(.+)\]$")
SPACE = re.compile(r"[\s　]+")


def load_fixes():
    if not os.path.exists(FIXES):
        return {}
    return json.load(io.open(FIXES, encoding="utf-8")).get("items", {})


def main():
    raw = json.load(io.open(RAW, encoding="utf-8"))
    fixes = load_fixes()
    used = set()

    out, review, per = [], [], {}
    for e in raw:
        les = e["lesson"]
        per[les] = per.get(les, 0) + 1

        kana = SPACE.sub(" ", e["kana"]).strip()
        jp_raw = SPACE.sub(" ", e["jp"]).strip()
        m = BRACKET.match(jp_raw)
        soft = bool(m)                       # ханз нь бий ч канагаар бичдэг
        jp = m.group(1) if m else jp_raw

        item = {
            "id": "N5-%02d-%03d" % (les, per[les]),
            "lesson": les,
            "section": "",
            "jp": jp,
            "kana": kana,
            "accent": "",                    # эх сурвалжид өргөлт байхгүй
            "romaji": "",                    # эх сурвалжид ромажи байхгүй
            "mn": SPACE.sub(" ", e["mn"]).strip(),
            "ref": False,
        }
        if soft:
            item["soft"] = True
        if e.get("ex"):
            item["ex"] = SPACE.sub(" ", e["ex"]).strip()

        key = "%d|%s" % (les, e["kana"].strip())
        if key in fixes:
            patch = {k: v for k, v in fixes[key].items() if not k.startswith("_")}
            item.update(patch)
            used.add(key)

        out.append(item)

        why = []
        if not item["kana"]:
            why.append("кана алга")
        elif not KANA.search(item["kana"]):
            why.append("кана нь кана биш")
        if not item["mn"]:
            why.append("утга алга")
        elif not CYR.search(item["mn"]):
            why.append("утга кирилл биш (тоо байж болно)")
        if not item.get("ex"):
            why.append("жишээ өгүүлбэр алга")
        if why:
            review.append((item, why))

    unused = sorted(set(fixes) - used)
    if unused:
        print("ANHAAR: n5_fixes.json dahi tulhuur taarsangui:", unused)

    with io.open(OUT, "w", encoding="utf-8") as f:
        json.dump({
            "source": "N5 шинэ үгийн жагсаалт (монгол орчуулга) — гараар бэлдсэн .docx",
            "book": "n5", "lessons": len(per), "count": len(out), "items": out,
        }, f, ensure_ascii=False, indent=1)

    with io.open(REVIEW, "w", encoding="utf-8") as f:
        f.write("# N5 — гараар шалгах бичлэгүүд\n\n")
        f.write("Эх .docx-оос задлахад дутуу гарсан мөрүүд. ")
        f.write("Нийт **%d / %d** (%.1f%%).\n\n" % (len(review), len(out),
                                                    100.0 * len(review) / max(len(out), 1)))
        f.write("| id | 日本語 | кана | утга | юу дутуу вэ |\n|---|---|---|---|---|\n")
        for it, why in review:
            f.write("| `%s` | %s | %s | %s | %s |\n"
                    % (it["id"], it["jp"] or "—", it["kana"] or "—",
                       it["mn"] or "—", " · ".join(why)))

    withex = sum(1 for i in out if i.get("ex"))
    soft = sum(1 for i in out if i.get("soft"))
    print("items %d  lessons %d  review %d  fixes %d" % (len(out), len(per), len(review), len(used)))
    print("with example %d (%.0f%%)   kana-preferred(soft) %d (%.0f%%)"
          % (withex, 100.0 * withex / len(out), soft, 100.0 * soft / len(out)))


main()
