# -*- coding: utf-8 -*-
"""data/kana.json үүсгэнэ — хирагана ↔ катакана ↔ авиа (кириллээр).

Катаканыг гараар бичихгүй: Юникодод хирагана (U+3041–3096) ба катакана
(U+30A1–30F6) нь яг 0x60-аар зөрдөг тул шилжүүлж гаргана. Энэ нь 拗音
(きゃ → キャ) дээр ч ажиллана.

Авиаг ЛАТИНААР биш КИРИЛЛЭЭР өгсөн — аппад ромажи харуулахгүй зарчимтай
нийцүүлэв. Ромажи нь өгөгдөлд үлдэнэ (дуу унших, шалгахад).

Ажиллуулах:  python tools/build_kana.py
"""

import io
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "data", "kana.json")

# «хирагана ромажи кирилл» — мөр бүр нэг 行
GOJUON = """
あ a а | い i и | う u у | え e э | お o о
か ka ка | き ki ки | く ku ку | け ke кэ | こ ko ко
さ sa са | し shi ши | す su су | せ se сэ | そ so со
た ta та | ち chi чи | つ tsu цу | て te тэ | と to то
な na на | に ni ни | ぬ nu ну | ね ne нэ | の no но
は ha ха | ひ hi хи | ふ fu фу | へ he хэ | ほ ho хо
ま ma ма | み mi ми | む mu му | め me мэ | も mo мо
や ya я | ゆ yu ю | よ yo ё
ら ra ра | り ri ри | る ru ру | れ re рэ | ろ ro ро
わ wa ва | を wo о | ん n н
"""

DAKUTEN = """
が ga га | ぎ gi ги | ぐ gu гу | げ ge гэ | ご go го
ざ za за | じ ji жи | ず zu зу | ぜ ze зэ | ぞ zo зо
だ da да | ぢ ji жи | づ zu зу | で de дэ | ど do до
ば ba ба | び bi би | ぶ bu бу | べ be бэ | ぼ bo бо
ぱ pa па | ぴ pi пи | ぷ pu пу | ぺ pe пэ | ぽ po по
"""

YOON = """
きゃ kya кя | きゅ kyu кю | きょ kyo кё
しゃ sha ша | しゅ shu шу | しょ sho шо
ちゃ cha ча | ちゅ chu чу | ちょ cho чо
にゃ nya ня | にゅ nyu ню | にょ nyo нё
ひゃ hya хя | ひゅ hyu хю | ひょ hyo хё
みゃ mya мя | みゅ myu мю | みょ myo мё
りゃ rya ря | りゅ ryu рю | りょ ryo рё
ぎゃ gya гя | ぎゅ gyu гю | ぎょ gyo гё
じゃ ja жа | じゅ ju жу | じょ jo жо
ぢゃ ja жа | ぢゅ ju жу | ぢょ jo жо
びゃ bya бя | びゅ byu бю | びょ byo бё
ぴゃ pya пя | ぴゅ pyu пю | ぴょ pyo пё
"""


def to_kata(h):
    """Хирагана -> катакана. U+3041–3096 ба U+30A1–30F6 нь 0x60-аар зөрнө."""
    return "".join(
        chr(ord(c) + 0x60) if "ぁ" <= c <= "ゖ" else c for c in h
    )


def parse(block, group):
    out = []
    for line in block.strip().splitlines():
        for cell in line.split("|"):
            parts = cell.split()
            if len(parts) != 3:
                raise ValueError("буруу нүд: %r" % cell)
            hira, romaji, mn = parts
            out.append({"hira": hira, "kata": to_kata(hira),
                        "romaji": romaji, "mn": mn, "group": group})
    return out


def main():
    items = (parse(GOJUON, "gojuon")
             + parse(DAKUTEN, "dakuten")
             + parse(YOON, "yoon"))
    for i, it in enumerate(items, 1):
        it["id"] = "K-%03d" % i

    # --- шалгалт
    assert len(items) == 107, len(items)
    hira = [i["hira"] for i in items]
    assert len(set(hira)) == len(hira), "хирагана давхардсан"
    for it in items:
        assert it["kata"] != it["hira"], it          # шилжилт ажилласан эсэх
        assert all("ァ" <= c <= "ヿ" for c in it["kata"]), it

    with io.open(OUT, "w", encoding="utf-8") as f:
        json.dump({"count": len(items), "items": items}, f,
                  ensure_ascii=False, indent=1)

    per = {}
    for it in items:
        per[it["group"]] = per.get(it["group"], 0) + 1
    print("kana %d  ->  %s" % (len(items), os.path.normpath(OUT)))
    print("  " + "  ".join("%s=%d" % (k, per[k]) for k in ("gojuon", "dakuten", "yoon")))


main()
