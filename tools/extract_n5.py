# -*- coding: utf-8 -*-
"""N5-ийн үгийн .docx файлуудаас үгсийг задална.

Эх файлын бүтэц (Word-ийн хүснэгт, хичээл бүр НЭГ хүснэгт):

    № | ひらがな | 漢字 | モンゴル | 例
    1 | わたし   | 私   | Би        | わたしは マイク・ミラーです。

Irodori-гийн PDF-ээс ялгаатай нь энэ нь аль хэдийн ЦЭВЭР хүснэгт тул
координатаар сэргээх шаардлагагүй — Word-ийн `w:tbl` бүтцийг шууд уншина.

Ажиллуулах:
    python tools/extract_n5.py "<1-25.docx>" "<26-50.docx>"

Гаралт:
    tools/n5_raw.json    — задалсан бүх мөр
    tools/report_n5.txt  — зөрчилтэй мөрүүд (гараар шалгах)
"""
import io
import json
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": W}

HERE = os.path.dirname(os.path.abspath(__file__))

CYR = re.compile(r"[Ѐ-ӿ]")
KANA = re.compile(r"[぀-ヿ]")
JP = re.compile(r"[぀-ヿ一-鿿]")
# Word нь тасрахгүй зай (U+00A0) хэрэглэдэг — энгийн зай болгоно.
NBSP = " "


def cell_text(tc):
    """Нүдний бүх текстийг цуглуулна. Нэг нүд доторх ПАРАГРАФ бүрийг
    зайгаар салгана — эс тэгвэл «...гуайхоёр» гэж наалддаг."""
    parts = []
    for p in tc.iter("{%s}p" % W):
        s = "".join(t.text or "" for t in p.iter("{%s}t" % W))
        s = s.replace(NBSP, " ").strip()
        if s:
            parts.append(s)
    return " ".join(parts)


def rows_of(tbl):
    for tr in tbl.iter("{%s}tr" % W):
        yield [cell_text(tc) for tc in tr.findall("w:tc", NS)]


def is_header(cells):
    j = "".join(cells)
    return "ひらがな" in j and ("モンゴル" in j or "漢字" in j)


def parse(path, lesson_start):
    z = zipfile.ZipFile(path)
    root = ET.fromstring(z.read("word/document.xml"))
    out, problems = [], []
    lesson = lesson_start - 1
    for tbl in root.iter("{%s}tbl" % W):
        lesson += 1
        n = 0
        for cells in rows_of(tbl):
            if len(cells) < 4 or is_header(cells):
                continue
            num, kana, kanji, mn = cells[0], cells[1], cells[2], cells[3]
            ex = cells[4] if len(cells) > 4 else ""
            # № багана хоосон эсвэл тоо биш бол мөр тасарсан гэсэн үг.
            if not kana and not kanji:
                continue
            n += 1
            out.append({
                "lesson": lesson,
                "no": num,
                "kana": kana,
                "jp": kanji or kana,        # ханзгүй үгэнд кана нь өөрөө үг
                "mn": mn,
                "ex": ex,
                "src": os.path.basename(path),
            })
        if n == 0:
            problems.append("L%d: хүснэгт хоосон" % lesson)
    return out, problems, lesson


def main():
    if len(sys.argv) < 2:
        sys.exit('Хэрэглээ: python tools/extract_n5.py "<1-25.docx>" "<26-50.docx>"')

    entries, problems = [], []
    start = 1
    for path in sys.argv[1:]:
        got, prob, last = parse(path, start)
        entries.extend(got)
        problems.extend(prob)
        start = last + 1

    for e in entries:
        tag = "L%-2d #%-3s %r" % (e["lesson"], e["no"], e["kana"][:18])
        if not e["kana"]:
            problems.append(tag + "  kana ALGA")
        elif not KANA.search(e["kana"]):
            problems.append(tag + "  kana нь кана БИШ: %r" % e["kana"][:30])
        if not e["mn"]:
            problems.append(tag + "  utga ALGA")
        elif not CYR.search(e["mn"]):
            problems.append(tag + "  utga kirill BISH: %r" % e["mn"][:30])
        if e["ex"] and not JP.search(e["ex"]):
            problems.append(tag + "  jishee yapon BISH: %r" % e["ex"][:30])

    with io.open(os.path.join(HERE, "n5_raw.json"), "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=1)
    with io.open(os.path.join(HERE, "report_n5.txt"), "w", encoding="utf-8") as f:
        f.write("entries: %d\nproblems: %d\n\n" % (len(entries), len(problems)))
        f.write("\n".join(problems))

    per = {}
    for e in entries:
        per[e["lesson"]] = per.get(e["lesson"], 0) + 1
    withex = sum(1 for e in entries if e["ex"])
    withkanji = sum(1 for e in entries if e["jp"] != e["kana"])
    print("entries %d   lessons %d   problems %d" % (len(entries), len(per), len(problems)))
    print("with example %d (%.0f%%)   with kanji %d (%.0f%%)"
          % (withex, 100.0 * withex / max(len(entries), 1),
             withkanji, 100.0 * withkanji / max(len(entries), 1)))
    print("per lesson:", " ".join("L%d=%d" % (k, per[k]) for k in sorted(per)[:12]), "...")


main()
