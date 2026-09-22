# -*- coding: utf-8 -*-
"""Дуудлагын дүрмийн регресс тест — VOICEVOX хөдөлгүүр асаалттай байх ёстой.

Ажиллуулах:
    python tools/test_audio.py [--speaker 2] [--engine http://127.0.0.1:50021]

Юуг шалгадаг вэ: `build_audio.py`-гийн `notation()`-оор тэмдэглэгээ
үүсгээд, ЯГ тэр замаар (`is_kana=true`) хөдөлгүүрт өгч ФОНЕМийг уншина.
Хүлээж буй фонемтэй тулгана — дууг чихээр сонсох шаардлагагүй.

Гол шалгалт нь БӨӨСНИЙ は/へ: «AquesTalk風記法» нь толь бичиг
хэрэглэхгүй, кана бүрийг үсгээр нь уншдаг тул засваргүй бол
`こんばんは` нь «konbanHA» болно. Мөн үгийн дотоод は/へ ХЭВЭЭР үлдэх
ёстой (`はな`, `母`) — энэ нь эсрэг чиглэлийн хамгаалалт.
"""
import argparse
import io
import json
import os
import re
import sys
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# `build_audio.py`-г МОДУЛЬ болгон ачаална (main() ажиллуулахгүй)
_src = io.open(os.path.join(ROOT, 'tools', 'build_audio.py'),
               encoding='utf-8').read().split('def main()')[0]
BA = {'__file__': os.path.join(ROOT, 'tools', 'build_audio.py'), '__name__': 'ba'}
exec(compile(_src, 'build_audio', 'exec'), BA)

# (өргөлтийн тэмдэглэгээ, бичигдэх хэлбэр, тайлбар, хүлээж буй фонем)
CASES = [
    # ── Бөөсний は -> wa ───────────────────────────────────────────
    ('こんにちは○', 'こんにちは', 'боос は -> wa',
     ['ko', 'N', 'ni', 'chi', 'wa']),
    ('こんばんは○', 'こんばんは', 'боос は -> wa',
     ['ko', 'N', 'ba', 'N', 'wa']),
    ('で↓は', 'では', 'боос は -> wa', ['de', 'wa']),
    ('おとこ↓はつら↓いよ', '男はつらいよ', 'дунд боос は -> wa',
     ['o', 'to', 'ko', 'wa', 'tsu', 'ra', 'i', 'yo']),
    ('さくねん○は いろいろ○おせ↓わに なりま↓した',
     '昨年はいろいろお世話になりました', 'ОЛОН хэсэгтэй хэллэг дэх боос',
     ['sa', 'ku', 'ne', 'N', 'wa', 'i', 'ro', 'i', 'ro', 'o', 'se', 'wa',
      'ni', 'na', 'ri', 'ma', 'shi', 'ta']),
    # ── ҮГИЙН ДОТООД は — ХЭВЭЭР үлдэнэ ───────────────────────────
    ('はな○', '花', 'үгийн は — ha хэвээр', ['ha', 'na']),
    ('は↓は', '母', 'はは — wa wa БОЛОХГҮЙ', ['ha', 'ha']),
    ('は↓', '歯', 'ганц は — ha хэвээр', ['ha']),
    ('じゅうはち↓', '18', 'じゅうはち — ha хэвээр',
     ['ju', 'u', 'ha', 'chi']),
    ('はつばいちゅう○', '発売中', 'はつ… — ha хэвээр',
     ['ha', 'tsu', 'ba', 'i', 'chu', 'u']),
    ('ささのは○', '笹の葉', 'ノな…は төгсгөл — ha хэвээр',
     ['sa', 'sa', 'no', 'ha']),
    # ── へ ────────────────────────────────────────────────────────
    ('へ↓や', '部屋', 'үгийн へ — he хэвээр', ['he', 'ya']),
    ('たいへん○', '大変', 'үгийн へ — he хэвээр',
     ['ta', 'i', 'he', 'N']),
    ('～ヘクタ↓ール', '～ha', 'ЛАТИН jp — хөндөхгүй',
     ['he', 'ku', 'ta', 'a', 'ru']),
    # ── を нь `is_kana` горимд аль хэдийн зөв ──────────────────────
    ('しごとをする○', '仕事をする', 'を -> o',
     ['shi', 'go', 'to', 'o', 'su', 'ru']),
    # ── Жижиг っ = дуугүй завсар ──────────────────────────────────
    ('きって○', '切手', 'っ -> cl', ['ki', 'cl', 'te']),
    ('がっこう○', '学校', 'っ -> cl', ['ga', 'cl', 'ko', 'u']),
    # ── ゃゅょ = НЭГ мора ─────────────────────────────────────────
    ('しゅくだい○', '宿題', 'しゅ нэг мора', ['shu', 'ku', 'da', 'i']),
    ('きょう○', '今日', 'きょ нэг мора', ['kyo', 'u']),
    # ── ん ба урт эгшиг ───────────────────────────────────────────
    ('さんぽ○', '散歩', 'ん -> N', ['sa', 'N', 'po']),
    ('ありがとう○', 'ありがとう', 'おう', ['a', 'ri', 'ga', 'to', 'u']),
    ('せんせい○', '先生', 'えい', ['se', 'N', 'se', 'i']),
    # ── 長音符 ー -> эгшгээр задрана ──────────────────────────────
    ('ミャ↓ンマー', 'ミャンマー', 'ー задрана', ['mya', 'N', 'ma', 'a']),
]


def phonemes(text, speaker, engine):
    url = (engine + '/accent_phrases?text=' + urllib.parse.quote(text)
           + '&speaker=%d&is_kana=true' % speaker)
    req = urllib.request.Request(url, method='POST')
    d = json.loads(urllib.request.urlopen(req, timeout=60).read().decode('utf-8'))
    return [((m.get('consonant') or '') + m['vowel']) for p in d for m in p['moras']]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--speaker', type=int, default=2)
    ap.add_argument('--engine', default='http://127.0.0.1:50021')
    a = ap.parse_args()
    BA['ENGINE'] = a.engine

    bad = 0
    for acc, jp, label, want in CASES:
        note = BA['notation'](acc, a.speaker, jp)
        try:
            got = phonemes(note, a.speaker, a.engine) if note else ['<no-notation>']
        except Exception as e:
            got = ['ERR', str(e)[:60]]
        good = got == want
        bad += not good
        print(('  ok   ' if good else '  FAIL ') + label.ljust(34)
              + ' | ' + (note or '-').ljust(16) + ' | ' + ' '.join(got)
              + ('' if good else '   ХҮЛЭЭСЭН: ' + ' '.join(want)))
    print('\n%d/%d passed' % (len(CASES) - bad, len(CASES)))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
