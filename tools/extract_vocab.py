# -*- coding: utf-8 -*-
"""Irodori 入門 «Шинэ үгийн жагсаалт» PDF-ээс үгсийг задалж JSON болгоно.

Яагаад координатаар задалдаг вэ:
    Хавтгай текст дамп дээр багана холилддог (L2 дээр монгол утгууд блокийн
    төгсгөлд бөөгнөрдөг). Тиймээс span бүрийн x, y, фонтын хэмжээ, өнгийг
    ашиглан 4 баганыг сэргээнэ.

Баганын хуваарилалт:
    x < 200        ことば     (үг: фонт 12.0 · фуригана 6-8 · бүлгийн гарчиг 14-18)
    200 <= x < 300 ローマ字   (фонт 8.0)
    x >= 300       アクセント эсвэл Монгол — ЭНИЙГ БИЧГЭЭР ялгана:
                   кирилл агуулсан бол Монгол, кана/ханз бол アクセント.
                   Зөвхөн x-ээр ялгавал болохгүй: зарим монгол нүд 414-өөс
                   зүүн тийш эхэлдэг (ж: L5 «すごい！» → «хөөх! /ваав!/»).

Мөрийн зангуу:
    ことば баганын 12.0 фонттой span. Нэг нүд 2 мөр болж уншигдах нь бий
    («着替える［2］／» + «着替えます», зай ~12 pt), харин ЖИНХЭНЭ шинэ мөр
    ~26 pt зайтай. Тиймээс 18 pt-ыг хил болгов.

Гаралт:
    vocab_raw.json — бүх бичлэг
    report.txt     — зөрчилтэй/дутуу мөрүүд (гараар шалгах)
"""

import bisect
import io
import json
import os
import re
import sys

import pymupdf

PDF = r"C:\Users\super\Downloads\Суурь шат-Шинэ үгийн жагсаалтын Монгол орчуулга .pdf"

COL2, COL3, COL4 = 200.0, 300.0, 414.0
Y_TOP, Y_BOTTOM = 150.0, 786.0
WORD_SIZE = (11.0, 13.0)
HEAD_SIZE = 13.0
ROW_SPLIT = 18.0                      # үүнээс их зай = шинэ мөр
GREY = 10330018                       # #9D9FA2 — 参考語彙 (лавлах үгсийн сан)

CYR = re.compile(r"[\u0400-\u04FF]")
JP = re.compile(r"[\u3040-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF]")
# Зурвас 2-ыг ялгахад ЗӨВХӨН кана/ханз. Бүтэн өргөний блокийг бүхэлд нь
# оруулж болохгүй: «～» (U+FF5E) нь ромажи нүдэнд ч ордог («～ kara kimashita»).
JP_STRICT = re.compile(chr(91) + chr(92) + 'u3040-' + chr(92) + 'u30FF' + chr(92) + 'u4E00-' + chr(92) + 'u9FFF' + chr(93))

LESSON_RE = re.compile(r"\bL(\d+)\s*-\s*(\d+)\b")
CTRL = re.compile(r"[\x00-\x1f\x7f]")
VERB_GROUP = re.compile(r"［([123])］")


def spans_of(page):
    out = []
    for b in page.get_text("dict")["blocks"]:
        if b["type"] != 0:
            continue
        for line in b["lines"]:
            for s in line["spans"]:
                if s["text"].strip():
                    out.append({"x": s["bbox"][0], "y": s["bbox"][1],
                                "size": round(s["size"], 1), "color": s["color"],
                                "text": s["text"]})
    return out


def lesson_of(spans):
    for s in spans:
        m = LESSON_RE.search(s["text"])
        if m:
            return int(m.group(1))
    return None


def col_of(s):
    x, t = s["x"], s["text"]
    if x < COL2:
        return 1
    if x < COL3:
        # Урт үг ことば баганаас халиад энэ зурваст ордог. Ромажи нь ЛАТИН,
        # 8.0 фонттой; халисан үг 12.0, фуригана нь кана — бичгээр нь ялгана.
        if s["size"] >= WORD_SIZE[0] or JP_STRICT.search(t):
            return 1
        return 2
    if CYR.search(t):                 # кирилл = утгын багана, x хамаагүй
        return 4
    if x >= COL4:
        return 4
    return 3                          # кана/ханз/тэмдэг, 300..414 = өргөлт


def parse_page(spans, state, problems, page_no):
    body = [s for s in spans if Y_TOP <= s["y"] <= Y_BOTTOM]
    body.sort(key=lambda s: (s["y"], s["x"]))

    anchors = []
    for s in body:
        if col_of(s) != 1 or not (WORD_SIZE[0] <= s["size"] <= WORD_SIZE[1]):
            continue
        if anchors and (s["y"] - anchors[-1]["last_y"]) < ROW_SPLIT:
            anchors[-1]["w"].append(s)
            anchors[-1]["last_y"] = max(anchors[-1]["last_y"], s["y"])
        else:
            anchors.append({"y": s["y"], "last_y": s["y"], "w": [s]})

    heads = [(s["y"], s["text"]) for s in body
             if col_of(s) == 1 and s["size"] >= HEAD_SIZE]

    ys = [a["y"] for a in anchors]
    _ = ys
    for a in anchors:
        a["c2"], a["c3"], a["c4"] = [], [], []

    for s in body:
        c = col_of(s)
        if c == 1:
            continue
        i = bisect.bisect_right(ys, s["y"] + 5.0) - 1
        if i < 0:
            problems.append("p%d col%d: span before first row: %r" % (page_no, c, s["text"]))
            continue
        if s["y"] - ys[i] > 45.0:
            problems.append("p%d col%d: span %.0fpt below its row %r: %r"
                            % (page_no, c, s["y"] - ys[i],
                               anchors[i]["w"][0]["text"], s["text"]))
        anchors[i]["c%d" % c].append(s)

    # Нүд 2 мөр болж уншигдвал үргэлжлэл нь ромажи·өргөлт·утга ГУРАВГҮЙ гарна.
    # Ийм зангууг өмнөхтэй нь нийлүүлнэ — энэ бол өөрийгөө шалгасан дүрэм.
    # Нүд 2 мөр болж уншигдвал үргэлжлэлд нь РОМАЖИ ч, УТГА ч байхгүй гарна
    # (өргөлт нь харин 2 дахь мөртөө буусан байж болно, тиймээс c3-ыг тооцохгүй).
    merged = []
    for a in anchors:
        if merged and not a["c2"] and not a["c4"]:
            merged[-1]["w"].extend(a["w"])
            merged[-1]["c3"].extend(a["c3"])
        else:
            merged.append(a)
    anchors = merged

    out = []
    for a in anchors:
        for hy, ht in heads:
            if hy < a["y"] + 3:
                state["section"] = ht if state.get("_hy") != hy else state["section"]
                state["_hy"] = hy
        by_pos = lambda k: sorted(a[k], key=lambda s: (round(s["y"]), s["x"]))
        jp = "".join(s["text"] for s in sorted(a["w"], key=lambda s: (round(s["y"]), s["x"])))
        out.append({
            "jp": clean(jp),
            "romaji": " ".join(" ".join(s["text"] for s in by_pos("c2")).split()),
            "accent": clean("".join(s["text"] for s in by_pos("c3"))),
            "mn": " ".join(" ".join(s["text"] for s in by_pos("c4")).split()),
            "ref": bool(a["w"]) and a["w"][0]["color"] == GREY,
            "group": (VERB_GROUP.search(jp).group(1) if VERB_GROUP.search(jp) else None),
            "section": state.get("section", ""),
            "page": page_no,
        })
    return out


def clean(t):
    return CTRL.sub("", t).replace("\u3000", " ").strip()


def main():
    doc = pymupdf.open(PDF)
    problems, entries, state = [], [], {}
    for i, page in enumerate(doc):
        # 0 = хавтас; 1 = «記号の説明» — дотроо L11-ийн хүснэгтийн ЖИШЭЭ агуулдаг
        # тул хуурамч бичлэг үүсгэдэг. Сүүлийн 4 нь アクセント-ийн тайлбар (L тэмдэггүй).
        if i < 2:
            continue
        sp = spans_of(page)
        lesson = lesson_of(sp)
        if not lesson:
            continue
        if state.get("lesson") != lesson:
            state["lesson"], state["section"], state["_hy"] = lesson, "", None
        for e in parse_page(sp, state, problems, i):
            e["lesson"] = lesson
            entries.append(e)

    for e in entries:
        tag = "L%-2d p%-2d %r" % (e["lesson"], e["page"], e["jp"][:24])
        if not e["jp"]:
            problems.append(tag + "  EMPTY word")
        if CYR.search(e["accent"]):
            problems.append(tag + "  cyrillic in ACCENT: %r" % e["accent"])
        if not e["mn"]:
            problems.append(tag + "  MISSING mn")
        if not e["romaji"]:
            problems.append(tag + "  MISSING romaji")
        if not e["accent"]:
            problems.append(tag + "  MISSING accent")

    here = os.path.dirname(os.path.abspath(sys.argv[0]))
    with io.open(os.path.join(here, "vocab_raw.json"), "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=1)
    with io.open(os.path.join(here, "report.txt"), "w", encoding="utf-8") as f:
        f.write("entries: %d\nproblems: %d\n\n" % (len(entries), len(problems)))
        f.write("\n".join(problems))

    per = {}
    for e in entries:
        per[e["lesson"]] = per.get(e["lesson"], 0) + 1
    print("entries %d   problems %d   ref(grey) %d"
          % (len(entries), len(problems), sum(1 for e in entries if e["ref"])))
    print(" ".join("L%d=%d" % (k, per[k]) for k in sorted(per)))


main()
