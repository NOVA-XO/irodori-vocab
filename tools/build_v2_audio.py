# -*- coding: utf-8 -*-
u"""v2 (KOTO)-ийн 312 үгэнд дуудлагын бичлэгийн id оноох.

v1-д 11626 бичлэг бий. v2-ийн үг нь IRODORI A1-ийн хураангуй тул
ТАЛ ХУВЬ НЬ v1-д аль хэдийн бичигдсэн — дахин үүсгэх нь 6 МБ хог ба
ялангуяа ЧАНАРЫН НЭРИЙН ХУВЬД дутуу: v1-ийн бичлэгийн 2/3 нь ГАРААР
шалгасан өргөлтийн тэмдэглэгээтэй (`accent`), v2-ийн өгөгдөлд өргөлт
байхгүй тул шинээр үүсгэвэл хөдөлгүүрийн толиор л уншина.

Тиймээс:
  · v1-д ЯГ таарсан үг     -> тэр бичлэгийн id-г дахин ашиглана
  · таарахгүй эсвэл дутуу  -> шинэ `KT-<hash>` id, бичлэгийг
                              `build_audio.py` үүсгэнэ

ЯАГААД hash, дугаар БИШ вэ: v2-ийн үгийн дараалал өөрчлөгдвөл
(үг нэмэх/хасах) дугаарлалт шилжиж, хуучин mp3 ӨӨР үгэнд холбогдох
байв. Hash нь текстээс гардаг тул дараалал хөдлөхөд ч тогтвортой.

ЯАГААД `KT-`, `K-` БИШ вэ: `K-001`…`K-107` нь kana.json-ийнх —
яг давхцана.

HOMOPHONE-ийн урхи: ижил кана, өөр өргөлт. `いま` нь 今 «и↓ма» (одоо)
БӨГӨӨД 居間 «има↓» (зочны өрөө); `よる` нь 夜 «ё↓ру» (орой) БӨГӨӨД
寄る «ёру○» (дайрах). id-гаар эрэмбэлж аль нэгийг авбал БУРУУ
дуудлага гарна. Тиймээс МОНГОЛ УТГЫН давхцлаар эрэмбэлнэ.

Ажиллуулах:
    python tools/build_v2_audio.py          # -> v2/data.js, tools/_v2_audio_new.json
    python tools/build_v2_audio.py --dry    # зөвхөн тайлан, файл бичихгүй

Дараа нь:
    python tools/build_audio.py --speaker 2     # KT-… бичлэгүүдийг үүсгэнэ
"""
import argparse
import hashlib
import io
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

V1_VOCAB = ('vocab.json', 'vocab-el1.json', 'vocab-el2.json', 'vocab-n5.json')
SLASH = re.compile(u'[／/]')

# Автомат цэвэрлэлт (`～` хасах, `／` → `、`) ЗӨВ БОЛГОЖ ЧАДАХГҮЙ үгс.
# Эдгээрт уншуулах катаканыг ГАРААР зааж, `build_audio.py`-д шууд өгнө.
#
#   は   БӨӨС болохдоо «wa» гэж уншигдана. v1-д `fix_particles()` нь
#        хөдөлгүүрийн толиос асууж шийддэг, гэвч тэр нь ЗӨВХӨН өргөлтийн
#        тэмдэглэгээтэй үгэнд ажиллана (`notation()` нь тэмдэглэгээгүй
#        үед '' буцаана). v2-д өргөлт байхгүй тул `ハ` = «ha» гарах байв —
#        сурагчид бөөсийг буруу зааж байна гэсэн үг. (`sw.js`-ийн
#        STALE_MEDIA-д «konbanha» гэж бичигдсэн нь яг ижил урхи.)
#   を   үргэлж «o». `ヲ` нь хөдөлгүүрээс хамаарч «wo» гарч мэднэ.
#   ～ДУНД~  `あまり～ない` нь ХОЁР хэсэг. `～`-ийг зүгээр хасвал
#        `アマリナイ` гэж нэг үг шиг нийлнэ; завсар тавьж тусгаарлана.
KANA_FIX = {
    u'～は':                     u'ワ',                      # ～は  -> ワ
    u'～を':                     u'オ',                      # ～を  -> オ
    u'あまり～ない':
        u'アマリ、ナイ',                         # あまり～ない
    u'ぜんぜん～ない':
        u'ゼンゼン、ナイ',                   # ぜんぜん～ない
}
# Монгол утгыг токен болгоход хаях тэмдэг. «хогийн сав» ба «хогын сав»
# мэт бичгийн зөрүүг ӨӨРӨӨ засахгүй — токены давхцал хүрэлцдэг.
MN_SPLIT = re.compile(u'[\\s;,/·()]+')


def v2_words():
    u"""`v2/data.js`-ээс (сэдэв, индекс, үг) гурвалыг дарааллаараа гаргана."""
    raw = io.open(os.path.join(ROOT, 'v2', 'data.js'), encoding='utf-8').read()
    if 'window.KOTO_DATA = {' in raw:
        # 2026-11-05-аас data.js-ийг build_v2_vocab.py үүсгэдэг: Irodori үг бүр v1-ийн бичлэгтэй
        # (au = id), хуучин 432 үгийн au нь tools/v2_vocab_legacy.tsv-д. Хуучин бүтцээр бичвэл эвдэнэ.
        sys.exit('ZOGSOV: v2/data.js shine butetstei (build_v2_vocab.py) - ene script khuuchin butetsend')
    data = json.loads(raw[raw.index('['):raw.rindex(']') + 1])
    out = []
    for t, topic in enumerate(data):
        for w, word in enumerate(topic['words']):
            out.append((t, w, word))
    return data, out


def mn_tokens(s):
    return set(x for x in MN_SPLIT.split((s or u'').lower()) if len(x) > 1)


def candidates():
    u"""v1-ийн бичлэгтэй үгсийг кана/бичгийн хэлбэрээр индекслэнэ."""
    have = set(json.load(io.open(os.path.join(ROOT, 'data', 'audio.json'),
                                 encoding='utf-8'))['ids'])
    idx = {}
    for f in V1_VOCAB:
        p = os.path.join(ROOT, 'data', f)
        if not os.path.exists(p):
            continue
        for it in json.load(io.open(p, encoding='utf-8'))['items']:
            if it['id'] not in have:
                continue
            for key in set([it.get('kana') or u'', it.get('jp') or u'']):
                if key:
                    idx.setdefault(key, []).append(it)
    return idx


def pick(cands, v2_mn):
    u"""Хамгийн тохирох v1-ийн бичлэгийг сонгоно.

    Эрэмбэ: монгол утгын давхцал ИХ нь → өргөлтийн тэмдэглэгээ БАЙГАА
    нь → id-гийн үсгийн дараалал (дахин ажиллуулахад ижил гарахын тулд).
    """
    want = mn_tokens(v2_mn)
    def key(it):
        overlap = len(want & mn_tokens(it.get('mn')))
        return (-overlap, 0 if (it.get('accent') or '').strip() else 1, it['id'])
    return sorted(cands, key=key)[0]


def au_id(jp):
    h = hashlib.sha1(jp.encode('utf-8')).hexdigest()[:8]
    return 'KT-' + h


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry', action='store_true')
    a = ap.parse_args()

    data, words = v2_words()
    idx = candidates()

    reuse, fresh, ambiguous = 0, [], []
    seen_au = {}
    for t, w, word in words:
        jp = word['jp'].strip()
        cands = idx.get(jp)
        if cands:
            it = pick(cands, word.get('mn'))
            word['au'] = it['id']
            reuse += 1
            if len(cands) > 1:
                accs = set((x.get('accent') or '').strip() for x in cands)
                accs.discard('')
                if len(accs) > 1:
                    ambiguous.append((jp, it['id'], (it.get('accent') or ''),
                                      word.get('mn'), (it.get('mn') or '')))
        else:
            word['au'] = au_id(jp)
            # Slash-тай бичлэг (`なに／なん`) нь ХОЁР хэлбэр: v1-д нэг нь
            # байсан ч түүнийг авбал хэрэглэгч харж байгаа хоёр хэлбэрийн
            # зөвхөн нэгийг сонсоно. Тиймээс шинээр, хоёуланг уншуулна.
            job = {'id': word['au'], 'say': word['jp'],
                   'slash': bool(SLASH.search(jp))}
            if jp in KANA_FIX:
                job['kana'] = KANA_FIX[jp]
            fresh.append(job)
        prev = seen_au.get(word['au'])
        if prev and prev != jp:
            sys.exit('ID DAVHTSAL: %s  <-  %r ba %r' % (word['au'], prev, jp))
        seen_au[word['au']] = jp

    # Шинэ ажлуудыг id-гаар жигдрүүлнэ (дахин ажиллуулахад ижил файл гарна).
    fresh.sort(key=lambda x: x['id'])

    # `KANA_FIX`-ийн түлхүүр v2-д байхгүй бол толь ХУУЧИРСАН — тэр үг
    # нэрээ сольсон эсвэл хасагдсан, засвар нь чимээгүй үл ашиглагдана.
    used = set(x['say'].strip() for x in fresh if 'kana' in x)
    stale = sorted(set(KANA_FIX) - used)
    if stale:
        sys.exit('KANA_FIX huuchirsan (v2-d ii ugs alga): %s'
                 % ', '.join(repr(x) for x in stale))

    rep = ['v2 words      = %d' % len(words),
           'reused from v1= %d' % reuse,
           'new (KT-)     = %d' % len(fresh),
           'kana override = %d' % len(used),
           'homophone pick= %d' % len(ambiguous)]
    print('\n'.join(rep))
    if ambiguous:
        p = os.path.join(HERE, '_v2_audio_homophone.txt')
        io.open(p, 'w', encoding='utf-8', newline='').write(u'\n'.join(
            u'%s\t%s\tacc=%s\tv2mn=%s\tv1mn=%s' % x for x in ambiguous) + u'\n')
        print('homophone picks -> tools/_v2_audio_homophone.txt (NUDEER SHALGA)')

    if a.dry:
        print('dry: fail bichsengui')
        return

    # ЗӨВХӨН хүний харах тайлан. `build_audio.py` нь үүнийг УНШИХГҮЙ —
    # тэр `v2/data.js`-ээс `KT-`-ээр эхэлсэн id-г өөрөө олж, `KANA_FIX`-ийг
    # энэ модулиас импортолдог. Түр файл дамжуулбал тэр файл байхгүй үед
    # v2-ийн бичлэг чимээгүй үүсэхгүй байв.
    out = os.path.join(HERE, '_v2_audio_new.json')
    json.dump(fresh, io.open(out, 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    print('new jobs (report only) -> tools/_v2_audio_new.json')

    # `data.js`-ийн ДАРААЛЛЫГ хөндөхгүй: v2-ийн үгийн id нь `<сэдэв>:<индекс>`
    # тул дараалал хөдлөхөд хэрэглэгчийн ахиц ӨӨР үгэнд холбогдоно.
    body = json.dumps(data, ensure_ascii=False, indent=2)
    io.open(os.path.join(ROOT, 'v2', 'data.js'), 'w',
            encoding='utf-8', newline='\n').write(
        u'window.KOTO_DATA = %s;\n' % body)
    print('v2/data.js bichigdlee')


if __name__ == '__main__':
    main()
