# -*- coding: utf-8 -*-
"""Ханз ↔ эможи: `data/kanji.json` -> `data/kanji-emoji.json`.

Зорилго: «эможи харж ханзаа таах» дасгал (JLPT хэсэг).

ЗАРЧИМ
· Эможи нь утгыг ХАРУУЛАХ ёстой. Тааварласан, ойролцоо зүйл бичихгүй —
  1187 ханзын багахан хэсэг нь л зураглаж болохуйц.
· Англи утгаар (`en`) тааруулна: тэр нь стандартчилагдсан, монгол
  тайлбар нь чөлөөт бичвэр.
· ДАВХАРДАЛ ХОРИОТОЙ. Хоёр ханз ижил эможитой бол дасгал утгагүй
  болно (аль нь ч зөв мэт). Давхардвал хоёуланг нь ХАЯНА — алдаатай
  асуулт гаргахаас гаргахгүй нь дээр.
· Гараар бичсэн жагсаалт нь эхний утгатай ЯГ таарах ёстой (`en[0]`).
  Хоёр дахь утгаар тааруулах нь «one radical (no.1)» мэтийг оруулна.

Ажиллуулах:  python tools/build_emoji.py
"""
import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Англи утга -> эможи. ЗӨВХӨН зураглаж болох, ойлгомжтой утгууд.
GLOSS = {
    # Байгаль
    "sun": u"☀️", "moon": u"🌙", "star": u"⭐", "sky": u"🌌",
    "rain": u"🌧️", "snow": u"❄️", "cloud": u"☁️", "wind": u"💨",
    "thunder": u"⚡", "fire": u"🔥", "water": u"💧", "sea": u"🌊",
    "mountain": u"⛰️", "river": u"🏞️", "stone": u"🪨", "tree": u"🌳",
    "flower": u"🌸", "grass": u"🌿", "rice field": u"🌾", "soil": u"🟫",
    "island": u"🏝️", "lake": u"🏞️", "ice": u"🧊", "leaf": u"🍃",
    # Амьтан
    "dog": u"🐕", "cat": u"🐈", "horse": u"🐎", "cow": u"🐄",
    "bird": u"🐦", "fish": u"🐟", "sheep": u"🐑", "pig": u"🐖",
    "insect": u"🐛", "dragon": u"🐉", "tiger": u"🐅", "shell": u"🐚",
    "bear": u"🐻", "monkey": u"🐒", "rabbit": u"🐇", "elephant": u"🐘",
    # Хүн ба бие
    "person": u"🧑", "man": u"👨", "woman": u"👩", "child": u"🧒",
    "eye": u"👁️", "ear": u"👂", "mouth": u"👄", "hand": u"✋",
    "foot": u"🦶", "heart": u"❤️", "blood": u"🩸", "tooth": u"🦷",
    "face": u"😀", "body": u"🧍", "bone": u"🦴", "hair": u"💇",
    "father": u"👨", "mother": u"👩", "older brother": u"👦",
    "older sister": u"👧", "friend": u"🤝", "baby": u"👶",
    # Газар, барилга
    "house": u"🏠", "school": u"🏫", "shop": u"🏪", "hospital": u"🏥",
    "station": u"🚉", "bridge": u"🌉", "road": u"🛣️", "gate": u"⛩️",
    "door": u"🚪", "window": u"🪟", "room": u"🛏️", "garden": u"🌷",
    "temple": u"🏯", "castle": u"🏰", "bank": u"🏦", "park": u"🏞️",
    "office": u"🏢", "hotel": u"🏨", "factory": u"🏭", "port": u"⚓",
    # Тээвэр, зүйлс
    "car": u"🚗", "train": u"🚆", "ship": u"🚢", "bicycle": u"🚲",
    "airplane": u"✈️", "book": u"📖", "letter": u"✉️", "picture": u"🖼️",
    "clock": u"🕐", "money": u"💰", "gold": u"🥇", "knife": u"🔪",
    "umbrella": u"☂️", "clothes": u"👕", "shoes": u"👟", "hat": u"🎩",
    "bag": u"👜", "key": u"🔑", "medicine": u"💊", "camera": u"📷",
    "telephone": u"📞", "music": u"🎵", "song": u"🎤", "movie": u"🎬",
    "newspaper": u"📰", "map": u"🗺️", "mirror": u"🪞", "chair": u"🪑",
    # Хоол
    "rice": u"🍚", "meat": u"🍖", "egg": u"🥚", "milk": u"🥛",
    "tea": u"🍵", "wine": u"🍶", "salt": u"🧂", "sugar": u"🍬",
    "bread": u"🍞", "fruit": u"🍎", "vegetable": u"🥬", "soup": u"🍲",
    "noodles": u"🍜", "eat": u"🍽️", "drink": u"🥤", "cook": u"👨‍🍳",
    # Үйл ба төлөв
    "walk": u"🚶", "run": u"🏃", "swim": u"🏊", "fly": u"🕊️",
    "sing": u"🎤", "sleep": u"😴", "read": u"📚", "write": u"✍️",
    "listen": u"👂", "speak": u"🗣️", "buy": u"🛒", "sell": u"🏷️",
    "study": u"📚", "teach": u"🧑‍🏫", "work": u"💼", "rest": u"🛌",
    "cry": u"😢", "laugh": u"😄", "love": u"🥰", "hot": u"🥵",
    "cold": u"🥶", "new": u"🆕",
    "open": u"🔓", "close": u"🔒", "wait": u"⏳", "meet": u"🤝",
    # Цаг
    "year": u"📅", "month": u"🗓️", "week": u"📆", "time": u"⏰",
    "morning": u"🌅", "night": u"🌃", "noon": u"🕛", "spring": u"🌸",
    "summer": u"🏖️", "autumn": u"🍁", "winter": u"⛄",
    # Бусад
    "north": u"🧭", "east": u"🌅", "west": u"🌇", "south": u"🏝️",
    "right": u"👉", "left": u"👈", "above": u"⬆️", "below": u"⬇️",
    "middle": u"🎯", "circle": u"⭕", "square": u"⬜", "line": u"➖",
    "white": u"⚪", "black": u"⚫", "red": u"🔴", "blue": u"🔵",
    "green": u"🟢", "yellow": u"🟡", "colour": u"🎨", "light": u"💡",
    "war": u"⚔️", "peace": u"🕊️", "king": u"👑", "country": u"🌍",
    "city": u"🏙️", "village": u"🏘️", "field": u"🌾", "forest": u"🌲",
    "sport": u"⚽", "game": u"🎮", "medicine (drug)": u"💊",
}

# Гараар: олон эможиор УТГЫГ нь угсарсан, эсвэл дээрхээс илүү тод.
# Жишээ нь 森 нь «forest» — гурван мод нь ханзны бүтэцтэй нь ч таарна.
BY_KANJI = {
    u"森": u"🌳🌳🌳", u"林": u"🌳🌳", u"木": u"🌳",
    u"日": u"☀️", u"月": u"🌙", u"山": u"⛰️", u"川": u"🏞️",
    u"火": u"🔥", u"水": u"💧", u"金": u"🥇", u"土": u"🟫",
    u"人": u"🧑", u"子": u"🧒", u"女": u"🚺", u"男": u"🚹",
    u"父": u"👨", u"母": u"👩", u"円": u"💴", u"休": u"🛋️",
    u"雨": u"🌧️", u"雪": u"❄️", u"花": u"🌸", u"魚": u"🐟",
    u"犬": u"🐕", u"猫": u"🐈", u"鳥": u"🐦", u"馬": u"🐎",
    u"車": u"🚗", u"本": u"📖", u"手": u"✋", u"足": u"🦶",
    u"目": u"👁️", u"耳": u"👂", u"口": u"👄", u"心": u"❤️",
    u"家": u"🏠", u"学": u"🎓", u"校": u"🏫", u"駅": u"🚉",
    u"門": u"⛩️", u"時": u"⏰", u"年": u"📅", u"雲": u"☁️",
    u"星": u"⭐", u"空": u"🌌", u"海": u"🌊", u"石": u"🪨",
    u"米": u"🍚", u"肉": u"🍖", u"茶": u"🍵", u"酒": u"🍶",
    u"薬": u"💊", u"傘": u"☂️", u"鍵": u"🔑", u"卵": u"🥚",
    # Тоо — эможи цифр нь эргэлзээгүй
    u"一": u"1️⃣", u"二": u"2️⃣", u"三": u"3️⃣",
    u"四": u"4️⃣", u"五": u"5️⃣", u"六": u"6️⃣",
    u"七": u"7️⃣", u"八": u"8️⃣", u"九": u"9️⃣",
    u"十": u"🔟", u"百": u"💯",
    # Түгээмэл N5 — дээрхтэй давхцахгүй хослол
    u"見": u"👀", u"聞": u"🦻", u"話": u"🗣️", u"入": u"📥", u"出": u"📤",
    u"高": u"🗼", u"長": u"📏", u"半": u"🌗", u"名": u"📛", u"何": u"❓",
    u"語": u"💬", u"生": u"🌱", u"電": u"🔌",
    u"中": u"🎯", u"朝": u"🌅", u"島": u"🏝️",
    u"飛": u"✈️",                        # 🕊️ нь 鳥 🐦-той ойр байв
}

# ХАСНА. Эможи нь өөр ханзны утгыг ч илэрхийлж мэдэх бол тэр ханзыг огт
# оруулахгүй: 4 сонголтын хоёр нь ч зөв мэт харагдвал асуулт хариултгүй.
# Хэрэглэгч хэдэн ч түвшин зэрэг сонгодог тул ТҮВШИН ХООРОНД ч мөргөлдөнө.
# (Энэ нь BY_KANJI-аас ТУСДАА: dict-д ижил түлхүүр давхар бичвэл сүүлийнх
#  нь чимээгүй хожиж, `None` маань үйлчлэхгүй байв.)
DROP = {
    u"先生",                        # үг — ханз биш
    u"大", u"小",                   # 🐘/🐜 нь заан, шоргоолж — «том/жижиг» биш
    u"今",                              # ⏱️ ба 時 ⏰
    u"天",                              # 🌤️ ба 空 🌌, 日 ☀️
    u"行",                              # ➡️🚶 ба 歩 🚶
    u"読",                              # 👀📖 ба 本 📖
    u"顔",                              # 😀 ба 笑 😄
    u"体",                              # 🧍 ба 人 🧑
    u"見",                              # 👀 ба 目 👁️ (N4)
    u"聞",                              # 🦻 ба 耳 👂 (N3)
    u"語",                              # 💬 ба 話 🗣️
    u"生",                              # 🌱 ба 草 🌿 (N3)
    u"午",                              # 🕛 ба 時 ⏰
    u"週",                              # 📆 ба 年 📅
    u"土",                              # 🟫 нь өнгөний эгнээнд орно (茶, 黄, 緑)
    u"西",                              # 🌇 ба 朝 🌅 (N4)
    u"北",                              # 🧭 ба 図 🗺️ (N4)
    u"川",                              # 🏞️ дээр уулс байна — 山 ⛰️-тай холилдоно
}


def main():
    src = json.load(io.open(os.path.join(ROOT, "data", "kanji.json"), encoding="utf-8"))
    items = src["items"]

    pick = {}                      # ханз -> эможи
    why = {}                       # ханз -> яагаад (тайлагналд)
    for it in items:
        c, en = it["c"], [g.strip().lower() for g in (it.get("en") or [])]
        if c in DROP:
            continue
        if c in BY_KANJI:
            if BY_KANJI[c]:
                pick[c] = BY_KANJI[c]
                why[c] = "гараар"
            continue
        # ЗӨВХӨН эхний утгаар — хоёр дахь нь ихэвчлэн «… radical (no.1)»
        if en and en[0] in GLOSS:
            pick[c] = GLOSS[en[0]]
            why[c] = en[0]

    # ДАВХАРДЛЫГ ХАЯНА: ижил эможитой хоёр ханз бол аль нь ч зөв мэт.
    seen = {}
    for c, e in pick.items():
        seen.setdefault(e, []).append(c)
    dropped = []
    for e, cs in seen.items():
        if len(cs) > 1:
            # Гараар бичсэн нь давуу эрхтэй — тэр нь зориуд сонгогдсон.
            hand = [c for c in cs if why[c] == "гараар"]
            keep = hand[0] if len(hand) == 1 else None
            for c in cs:
                if c != keep:
                    dropped.append((c, e, why[c]))
                    del pick[c]

    out = {"note": "Эможи харж ханзыг таах дасгал. tools/build_emoji.py үүсгэнэ.",
           "count": len(pick), "map": pick}
    io.open(os.path.join(ROOT, "data", "kanji-emoji.json"), "w", encoding="utf-8").write(
        json.dumps(out, ensure_ascii=False, separators=(",", ":")))

    by_n = {}
    for it in items:
        if it["c"] in pick:
            by_n[it.get("n") or 0] = by_n.get(it.get("n") or 0, 0) + 1
    print("эможитой ханз: %d / %d" % (len(pick), len(items)))
    print("JLPT-ээр: " + " · ".join("N%s=%d" % (k or "?", v) for k, v in sorted(by_n.items(), reverse=True)))
    print("давхардлаас хаясан: %d" % len(dropped))
    for c, e, w in dropped[:12]:
        print("   %s %s (%s)" % (c, e, w))
    if min([v for k, v in by_n.items() if k], default=0) < 4:
        print("АНХААР: зарим түвшинд 4-өөс цөөн — тэр түвшинд дасгал гарахгүй.")


if __name__ == "__main__":
    main()
