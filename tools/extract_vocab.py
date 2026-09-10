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

# ── Номын тохиргоо ──────────────────────────────────
# 入門 нь 4 баганатай (ことば · ローマ字 · アクセント · Монгол), харин
# 初級1/2 нь ромажигүй 3 баганатай бөгөөд фуригана нь үгийн ДЭЭР
# тусдаа 5.0 фонтоор ордог. Баганын хил, фонтын хэмжээ хоёулаа өөр.
GREY = 10330018                       # #9D9FA2 — 参考語彙 (лавлах үгсийн сан)
WHITE = 16777215                      # хүснэгтийн толгой ба бүлгийн гарчиг

BOOKS = {
    "starter": dict(
        pdf=r"C:\Users\super\Downloads\Суурь шат-Шинэ үгийн жагсаалтын Монгол орчуулга .pdf",
        cols=4, COL2=200.0, COL3=300.0, COL4=414.0,
        Y_TOP=150.0, Y_BOTTOM=786.0,
        WORD_SIZE=(11.0, 13.0), HEAD_SIZE=13.0, REF_COLORS=(GREY,),
    ),
    "el1": dict(
        pdf="tools/_src/el1.pdf",
        cols=3, COL2=None, COL3=190.0, COL4=340.0,
        Y_TOP=80.0, Y_BOTTOM=780.0,
        # 8422021 = 会話練習/уншлагын НЭМЭЛТ үг (тайлбар хуудсанд тодорхойлсон),
        # GREY = 参考語彙. Хоёулаа хичээлийн үндсэн үг БИШ тул «лавлах» гэж тэмдэглэнэ.
        WORD_SIZE=(9.5, 11.0), HEAD_SIZE=12.0, REF_COLORS=(GREY, 8422021),
    ),
    "el2": dict(
        pdf="tools/_src/el2.pdf",
        cols=3, COL2=None, COL3=190.0, COL4=340.0,
        Y_TOP=80.0, Y_BOTTOM=780.0,
        # 8422021 = 会話練習/уншлагын НЭМЭЛТ үг (тайлбар хуудсанд тодорхойлсон),
        # GREY = 参考語彙. Хоёулаа хичээлийн үндсэн үг БИШ тул «лавлах» гэж тэмдэглэнэ.
        WORD_SIZE=(9.5, 11.0), HEAD_SIZE=12.0, REF_COLORS=(GREY, 8422021),
    ),
}
CFG = {}          # main() дотор сонгосон номоор дүүрнэ

ROW_SPLIT = 18.0
# Нүд өөрийн мөрийн зангуунаас ДЭЭШ эхэлж болно: 3 мөрт монгол тайлбар мөрийн
# голд төвлөрдөг тул эхний мөр нь үгийн мөрөөс 6-7 pt дээш гардаг (L3 «はじめまして»).
# Хэт бага бол өмнөх мөрөнд унана, хэт их бол өмнөхийнхөө агуулгыг булаана.
Y_TOL = 12.0                      # үүнээс их зай = шинэ мөр

CYR = re.compile(r"[\u0400-\u04FF]")
JP = re.compile(r"[\u3040-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF]")
# Зурвас 2-ыг ялгахад ЗӨВХӨН кана/ханз. Бүтэн өргөний блокийг бүхэлд нь
# оруулж болохгүй: «～» (U+FF5E) нь ромажи нүдэнд ч ордог («～ kara kimashita»).
JP_STRICT = re.compile(chr(91) + chr(92) + 'u3040-' + chr(92) + 'u30FF' + chr(92) + 'u4E00-' + chr(92) + 'u9FFF' + chr(93))

LESSON_RE = re.compile(r"\bL(\d+)\s*-\s*(\d+)\b")
CTRL = re.compile(r"[\x00-\x1f\x7f]")
VERB_GROUP = re.compile(r"［([123])］")
# Зөвхөн тоо, цэг, зайнаас тогтсон текст — бүлгийн ДУГААРЛАЛТ.
NUM_ONLY = re.compile(r"^[0-9０-９.．\s]+$")


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
    if CFG["cols"] == 3:
        # Ромажи багана байхгүй тул зөвхөн гурав. Фуригана нь мөн 1-т унана
        # ч анги нь WORD_SIZE-ээр шүүгддэг тул зангуу болохгүй.
        if x < CFG["COL3"]:
            return 1
        if CYR.search(t):
            return 4
        return 4 if x >= CFG["COL4"] else 3
    if x < CFG["COL2"]:
        return 1
    if x < CFG["COL3"]:
        # Урт үг ことば баганаас халиад энэ зурваст ордог. Ромажи нь ЛАТИН,
        # 8.0 фонттой; халисан үг 12.0, фуригана нь кана — бичгээр нь ялгана.
        if s["size"] >= CFG["WORD_SIZE"][0] or JP_STRICT.search(t):
            return 1
        return 2
    if CYR.search(t):                 # кирилл = утгын багана, x хамаагүй
        return 4
    if x >= CFG["COL4"]:
        return 4
    return 3                          # кана/ханз/тэмдэг, 300..414 = өргөлт


def parse_page(spans, state, problems, page_no):
    body = [s for s in spans if CFG["Y_TOP"] <= s["y"] <= CFG["Y_BOTTOM"]]
    body.sort(key=lambda s: (s["y"], s["x"]))

    anchors = []
    for s in body:
        if col_of(s) != 1 or not (CFG["WORD_SIZE"][0] <= s["size"] <= CFG["WORD_SIZE"][1]):
            continue
        # «ことば | アクセント | Монгол» гэсэн ХҮСНЭГТИЙН ТОЛГОЙ мөр нь үгтэй
        # ижил хэмжээтэй боловч ЦАГААН өнгөтэй — бичлэг болгож авахгүй.
        if s["color"] == WHITE:
            continue
        if anchors and (s["y"] - anchors[-1]["last_y"]) < ROW_SPLIT:
            anchors[-1]["w"].append(s)
            anchors[-1]["last_y"] = max(anchors[-1]["last_y"], s["y"])
        else:
            anchors.append({"y": s["y"], "last_y": s["y"], "w": [s]})

    # Бүлгийн гарчиг нь PDF-д хэд хэдэн span болж хуваагддаг
    # («日» + «本に来» + «てどのぐらいですか？») тул y-ээр нэгтгэж, x-ээр
    # эрэмбэлж БҮТНЭЭР нь холбоно. Эс тэгвэл section нь зөвхөн эхний
    # хэсэг («日») болж хоцордог.
    # Хажууд нь «1.» «2.» гэсэн ДУГААР мөн гарчгийн хэмжээтэй байдаг —
    # түүнийг өнгөөр биш ТЕКСТЭЭР нь хасна: өнгө нь ном тус бүрд өөр
    # (16775331 / 16776405) боловч зөвхөн тоо байх нь хаана ч адил.
    head_spans = [s for s in body
                  if col_of(s) == 1 and s["size"] >= CFG["HEAD_SIZE"]
                  and not NUM_ONLY.match(s["text"].strip())]
    hgroups = {}
    for s in head_spans:
        hgroups.setdefault(round(s["y"] / 4.0), []).append(s)
    heads = []
    for k in sorted(hgroups):
        g = sorted(hgroups[k], key=lambda s: s["x"])
        heads.append((min(s["y"] for s in g),
                      clean("".join(s["text"] for s in g))))

    ys = [a["y"] for a in anchors]
    _ = ys
    for a in anchors:
        a["c2"], a["c3"], a["c4"] = [], [], []

    for s in body:
        c = col_of(s)
        if c == 1:
            continue
        # «アクセント», «Монгол» гэсэн толгойн нүд мөн ЦАГААН — эдгээр нь
        # ямар ч мөрөнд харьяалагдахгүй тул хуурамч анхааруулга үүсгэдэг.
        if s["color"] == WHITE:
            continue
        i = bisect.bisect_right(ys, s["y"] + Y_TOL) - 1
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
        prev = "".join(x["text"] for x in sorted(merged[-1]["w"], key=lambda x: (round(x["y"]), x["x"]))).rstrip() if merged else ""
        # PDF-д хоёр хэлбэртэй үгийг «着替える［2］／» гэж ／-ээр ТӨГСГӨЖ
        # дараагийн мөрөнд үргэлжлүүлдэг — энэ бол тодорхой үргэлжлэлийн шинж.
        cont = prev.endswith("／") or prev.endswith("/")
        # Эсвэл үргэлжлэл мөр нь ромажи ч, утга ч ГҮЙ гарна.
        empty = not a["c2"] and not a["c4"]
        if merged and (cont or empty):
            for k in ("w", "c2", "c3", "c4"):
                merged[-1][k].extend(a[k])
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
            "ref": bool(a["w"]) and a["w"][0]["color"] in CFG["REF_COLORS"],
            "group": (VERB_GROUP.search(jp).group(1) if VERB_GROUP.search(jp) else None),
            "section": state.get("section", ""),
            "page": page_no,
        })
    return out


def clean(t):
    return CTRL.sub("", t).replace("\u3000", " ").strip()


def main():
    book = sys.argv[1] if len(sys.argv) > 1 else "starter"
    if book not in BOOKS:
        sys.exit("Ном: " + " | ".join(BOOKS))
    CFG.update(BOOKS[book])
    doc = pymupdf.open(CFG["pdf"])
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
        if CFG["cols"] == 4 and not e["romaji"]:
            problems.append(tag + "  MISSING romaji")
        if not e["accent"]:
            problems.append(tag + "  MISSING accent")

    here = os.path.dirname(os.path.abspath(sys.argv[0]))
    suffix = "" if book == "starter" else "_" + book
    with io.open(os.path.join(here, "vocab_raw%s.json" % suffix), "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=1)
    with io.open(os.path.join(here, "report%s.txt" % suffix), "w", encoding="utf-8") as f:
        f.write("entries: %d\nproblems: %d\n\n" % (len(entries), len(problems)))
        f.write("\n".join(problems))

    per = {}
    for e in entries:
        per[e["lesson"]] = per.get(e["lesson"], 0) + 1
    print("%s: entries %d   problems %d   ref(grey) %d"
          % (book, len(entries), len(problems), sum(1 for e in entries if e["ref"])))
    print(" ".join("L%d=%d" % (k, per[k]) for k in sorted(per)))


main()
