"""VOICEVOX-оор үг бүрийн дуудлагыг үүсгэнэ.

Яагаад VOICEVOX вэ:
  · Irodori-гийн албан ёсны бичлэгийг НЭЭЛТТЭЙ репод байршуулах эрхгүй
    (Japan Foundation: "may not be reproduced ... other than for private use").
  · VOICEVOX-оор үүсгэсэн дууг кредит бичсэн тохиолдолд тараахыг зөвшөөрдөг.
  · Хамгийн чухал нь: VOICEVOX нь ӨРГӨЛТИЙН БАЙРЛАЛЫГ гаднаас авдаг тул
    номноос задалсан ↓ ○ тэмдэглэгээг шууд өгч, өргөлтийг номтой яг
    таарсан болгож чадна. Ердийн TTS үүнийг хийж чадахгүй.

Урьдчилсан бэлтгэл:
    tools/_vv/windows-cpu/run.exe     (эсвэл өөр газар суулгасан бол --engine)
  Хөдөлгүүр ажиллаж эхэлмэгц http://127.0.0.1:50021 дээр хариулна.

Ажиллуулах:
    python tools/build_audio.py --list-speakers
    python tools/build_audio.py --speaker 13 --limit 20      # туршилт
    python tools/build_audio.py --speaker 13                 # бүгд

Гаралт:
    audio/<id>.mp3        — үг тус бүрийн дуудлага
    data/audio.json       — ямар id-д дуу байгаа тухай жагсаалт (апп үүнийг уншина)
"""
import argparse
import io
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO = os.path.join(ROOT, 'audio')
ENGINE = 'http://127.0.0.1:50021'

# Хирагана→катакана: Unicode дээр яг 0x60 зөрүүтэй (拗音 дээр ч ажиллана).
KATA_SHIFT = 0x60
SMALL = 'ァィゥェォャュョヮ'
# Мора БИШ, зөвхөн бичлэгийн тэмдэг
DROP_CHARS = '～〜'


def to_kata(s):
    out = []
    for ch in s:
        c = ord(ch)
        out.append(chr(c + KATA_SHIFT) if 0x3041 <= c <= 0x3096 else ch)
    return ''.join(out)


def is_kana_ch(ch):
    c = ord(ch)
    return 0x30A1 <= c <= 0x30FC and c != 0x30FB


# «AquesTalk風記法» нь 長音符 «ー»-г хүлээж авдаггүй (UNKNOWN_TEXT алдаа),
# уртатгалыг ЭГШГЭЭР нь бичих ёстой: ミャンマー -> ミャンマア.
VOWEL_ROWS = {
    'ア': 'アカサタナハマヤラワガザダバパャァヮヷ',
    'イ': 'イキシチニヒミリヰギジヂビピィヸ',
    'ウ': 'ウクスツヌフムユルグズヅブプュゥヴ',
    'エ': 'エケセテネヘメレヱゲゼデベペェヹ',
    'オ': 'オコソトノホモヨロヲゴゾドボポョォヺ',
}
VOWEL_OF = {c: v for v, row in VOWEL_ROWS.items() for c in row}


def expand_choon(ms):
    """«ー» мора бүрийг өмнөх морагийн эгшгээр солино."""
    out = []
    for m in ms:
        if m == 'ー' or m == '〜':
            v = VOWEL_OF.get(out[-1][-1]) if out else None
            out.append(v if v else m)   # тодорхойгүй бол хэвээр (API няцаана)
            continue
        out.append(m)
    return out


# ── Номын өргөлтийн тэмдэглэгээг задлах ────────────────────────────────
# ↓ — тэмдгийн өмнөх мора хүртэл өндөр, дараа нь унана
# ○ — 平板型 (унахгүй)
# △ — нийлмэл үгийн заагийг заана
SEP_PAUSE = '／/'          # хоёр өөр хэлбэр — хооронд нь ЗАВСАР тавина
SEP_BREAK = '△（）() 　'   # зөвхөн өргөлтийн хэсгийн зааг


def split_segments(acc):
    """[(текст, тусгаарлагч)] — тусгаарлагч нь ДАРААХ хэсгээс өмнөх тэмдэг."""
    segs, buf, sep = [], '', ''
    for ch in acc:
        if ch in SEP_PAUSE or ch in SEP_BREAK:
            if buf.strip():
                segs.append((buf, sep))
            buf = ''
            sep = '、' if ch in SEP_PAUSE else '/'
        else:
            buf += ch
    if buf.strip():
        segs.append((buf, sep))
    return segs


def seg_accent(seg):
    """(катакана мора жагсаалт, унах байрлал 1-ээс эхэлсэн | None)."""
    ms, drop, flat = [], None, False
    for ch in to_kata(seg):
        if ch == '↓':
            if drop is None:
                drop = len(ms)
            continue
        if ch == '○':
            flat = True
            continue
        if ch in DROP_CHARS or not is_kana_ch(ch):
            continue        # ～ ？ болон бусад тэмдгийг дуудлагад оруулахгүй
        if ms and ch in SMALL:
            ms[-1] += ch
        else:
            ms.append(ch)
    if drop == 0:
        drop = None
    if drop is None and flat:
        # 平板型. Ганцаараа дуудахад сүүлийн мора дээр унахтай АВИА ЗҮЙН
        # ХУВЬД ижил (ялгаа нь зөвхөн дараах нөхцөл дээр гардаг), тиймээс
        # VOICEVOX-ийн бичлэгт сүүлийн морагаар тэмдэглэнэ.
        drop = len(ms)
    return ms, drop


def api(path, params=None, body=None):
    url = ENGINE + path
    if params:
        url += '?' + urllib.parse.urlencode(params)
    data = json.dumps(body).encode('utf-8') if body is not None else b''
    req = urllib.request.Request(url, data=data, method='POST',
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as r:
        raw = r.read()
    return raw if path == '/synthesis' else json.loads(raw)


_vv_cache = {}


def vv_accent(kata, speaker):
    """Ном өргөлт заагаагүй хэсэгт VOICEVOX-ийн өөрийн толийг ашиглана."""
    if kata in _vv_cache:
        return _vv_cache[kata]
    try:
        ph = api('/accent_phrases', {'text': kata, 'speaker': speaker})
        a = ph[0]['accent'] if ph else None
    except Exception:
        a = None
    _vv_cache[kata] = a
    return a


# ── Бөөсний は / へ ────────────────────────────────────────────────────
# «AquesTalk風記法» (`is_kana=true`) нь ТОЛЬ БИЧИГ ХЭРЭГЛЭХГҮЙ, кана бүрийг
# ҮСГЭЭР нь уншина. Тиймээс бөөсний は нь «ha» болж дуудагдана:
#     こんばんは○ -> コンバンハ' -> ko N ba N HA   буруу
#     зөв нь                        ko N ba N WA
# Хөдөлгүүрээс фонемийг шууд уншиж баталсан.
#
# Засвар: тэмдэглэгээ үүсгэхийн ӨМНӨ эх ХИРАГАНА-г хөдөлгүүрийн ТОЛИОР
# уншуулж, は/へ нь бөөс болж уншигдсан эсэхийг ТҮҮНЭЭС асууна.
#
# ЯАГААД ХАНЗААР асуудаг вэ: толиос ГАНЦ КАНА мөр асуувал хөдөлгүүр
# эхний は-г бөөс гэж андуурна. Ханз нь утгыг тодруулдаг (шалгав):
#     母  -> ha ha      харин  はは -> wa wa   буруу
#     歯  -> ha         харин  は   -> wa      буруу
#     18  -> ju u ha chi  харин じゅうはち -> ju u wa chi  буруу
# 19 жишээн дээр: ханзаар 19/19 зөв, канагаар 8/19. Тиймээс шийдвэрийг
# ЗӨВХӨН үгийн бичигдэх хэлбэрээс (`jp`) асууна.
#
# を нь `is_kana` горимд ч «o» болдог тул засах шаардлагагүй (шалгав).
PARTICLE_KANA = {'ハ': 'ワ', 'ヘ': 'エ'}
PARTICLE_PHON = {'ハ': 'wa', 'ヘ': 'e'}
# Олон хэлбэр/тайлбар агуулсан бичлэгийг тольд өгөхгүй — задлалт тэнцэхгүй
JP_UNSAFE = '／/（）()〜～ 　'
JP_STRIP = '。、…「」『』？?！!'


def jp_clean(jp):
    """Тольд өгөх бэлтгэл. Аюултай бол '' буцаана.

    Захын «～» нь орхигдсон хэсгийг заадаг (`～はちょっと…`) тул хасаж
    болно. ДУНДАХ «～» (`～度～分`) нь үгийн бүтцийг эвддэг тул няцаана.
    """
    s = ''.join(c for c in (jp or '') if c not in JP_STRIP).strip('～〜')
    return '' if not s or any(c in s for c in JP_UNSAFE) else s

_dict_cache = {}


def dict_moras(text, speaker):
    """Хөдөлгүүрийн ТОЛЬ БИЧГЭЭР уншсан фонемийн жагсаалт."""
    key = (text, speaker)
    if key not in _dict_cache:
        try:
            ph = api('/accent_phrases', {'text': text, 'speaker': speaker})
            ms = [((m.get('consonant') or '') + m['vowel'])
                  for p in ph for m in p['moras']]
        except Exception:
            ms = None
        _dict_cache[key] = ms
    return _dict_cache[key]


def fix_particles(ms, jp, speaker):
    """`ms` доторх ハ/ヘ нь БӨӨС бол ワ/エ болгоно.

    `jp` нь үгийн БИЧИГДЭХ хэлбэр (ханзтай). Шийдвэрийг хөдөлгүүрийн
    толь бичиг гаргана. Мора тоо зөрвөл байрлалаар тулгах найдваргүй
    тул огт хөндөхгүй — алдаа гаргахаас алгассан нь дээр.
    """
    if not any(m in PARTICLE_KANA for m in ms):
        return ms
    jp = jp_clean(jp)
    if not jp:
        return ms
    # Бөөс нь БИЧИГДСЭН байж л уншигдана: бичигдэх хэлбэрт нь «は» алга
    # бол ямар ч тольны хариу түүнийг «wa» болгож чадахгүй. Энэ нь
    # `～ha` (гектар, латин) мэтийг няцаана — толь түүнийг ヘ гэж уншаад
    # エ болгох гэж оролддог.
    allow = {k for k, ch in (('ハ', 'は'), ('ヘ', 'へ')) if ch in jp}
    if not allow:
        return ms
    dm = dict_moras(jp, speaker)
    if not dm or len(dm) != len(ms):
        return ms
    return [PARTICLE_KANA[m]
            if m in allow and phon == PARTICLE_PHON[m] else m
            for m, phon in zip(ms, dm)]


def notation(accent_text, speaker, jp=''):
    """Номын тэмдэглэгээг VOICEVOX-ийн «AquesTalk風記法» болгоно.

    Жишээ:  ミャ↓ンマー          -> ミャ'ンマア
            ブラジル○           -> ブラジル'      (ганцаараа дуудахад ижил)
            なまえ○／おなまえ○   -> ナマエ'、オナマエ'

    `jp` нь үгийн бичигдэх хэлбэр — зөвхөн бөөсний は/へ-г ялгахад
    хэрэглэнэ (`fix_particles`).

    Ном ӨРГӨЛТ ЗААГААГҮЙ бол '' буцаана — тэр үед хөдөлгүүрийн өөрийн
    тольд даалгах нь таамаглахаас дээр.
    """
    raw = split_segments(accent_text or '')
    parts_ms = [seg_accent(seg) for seg, _ in raw]
    seps = [sep for _, sep in raw]

    # ── Бөөсний は/へ — `expand_choon`-оос ӨМНӨ ────────────────────
    # «、» тусгаарлагч нь ӨӨР ХЭЛБЭР гэсэн үг (`はし／おはし`); тэдгээрийг
    # нийлүүлбэл `jp`-тэй тэнцэхгүй. Бусад тохиолдолд хэсгүүд нь НЭГ
    # хэллэгийн үргэлжлэл (`さくねん○は いろいろ○…`) тул нийлүүлж
    # бүтнээр нь тольтой тулгана.
    if '、' not in seps:
        flat = [m for ms, _ in parts_ms for m in ms]
        fixed = fix_particles(flat, jp, speaker)
        if fixed is not flat:
            i = 0
            for k, (ms, drop) in enumerate(parts_ms):
                parts_ms[k] = (fixed[i:i + len(ms)], drop)
                i += len(ms)

    segs, marked = [], False
    for (ms, drop), sep in zip(parts_ms, seps):
        ms = expand_choon(ms)
        if not ms:
            continue
        if drop is not None:
            marked = True
        segs.append((sep, ms, drop))
    if not marked:
        return ''            # ном огт заагаагүй — бүхэлд нь хөдөлгүүрт даалгана
    parts = []
    for sep, ms, drop in segs:
        # Нэг хэсэг нь тэмдэглэгээгүй (ж: «おはよう（ございま↓す）» дэх «おはよう»)
        # бол ЗӨВХӨН тэр хэсгийг хөдөлгүүрийн толиор нөхнө.
        if drop is None:
            drop = vv_accent(''.join(ms), speaker) or len(ms)
        drop = max(1, min(drop, len(ms)))
        parts.append((sep if parts else '') + ''.join(ms[:drop]) + "'" + ''.join(ms[drop:]))
    return ''.join(parts)


def synth(text_kana, notation_str, speaker, speed):
    q = api('/audio_query', {'text': text_kana, 'speaker': speaker})
    if notation_str:
        try:
            q['accent_phrases'] = api('/accent_phrases',
                                      {'text': notation_str, 'is_kana': 'true',
                                       'speaker': speaker})
        except urllib.error.HTTPError:
            pass                        # тэмдэглэгээ буруу бол хөдөлгүүрийнхээр
    q['speedScale'] = speed
    q['prePhonemeLength'] = 0.03
    q['postPhonemeLength'] = 0.08
    q['outputSamplingRate'] = 24000
    q['outputStereo'] = False
    return api('/synthesis', {'speaker': speaker}, q)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--speaker', type=int, default=None)
    ap.add_argument('--speed', type=float, default=0.95)
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--engine', default=ENGINE)
    ap.add_argument('--list-speakers', action='store_true')
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--bitrate', default='96k')
    a = ap.parse_args()

    globals()['ENGINE'] = a.engine

    if a.list_speakers:
        with urllib.request.urlopen(ENGINE + '/speakers', timeout=30) as r:
            sp = json.loads(r.read())
        out = []
        for s in sp:
            for st in s['styles']:
                out.append('%4d  %s (%s)' % (st['id'], s['name'], st['name']))
        io.open(os.path.join(ROOT, 'tools', 'speakers.txt'), 'w',
                encoding='utf-8').write('\n'.join(out))
        print('speakers ->', len(out), '-> tools/speakers.txt')
        return

    if a.speaker is None:
        sys.exit('--speaker хэрэгтэй. Эхлээд --list-speakers ажиллуулна уу.')

    import imageio_ffmpeg
    ff = imageio_ffmpeg.get_ffmpeg_exe()

    # Дөрвөн сангийн үг бүгд — id нь угтвараараа ялгагдана (L / E1 / E2 / N5).
    vocab = {'items': []}
    for f in ('vocab.json', 'vocab-el1.json', 'vocab-el2.json', 'vocab-n5.json'):
        p = os.path.join(ROOT, 'data', f)
        if os.path.exists(p):
            vocab['items'].extend(json.load(io.open(p, encoding='utf-8'))['items'])
    kana = json.load(io.open(os.path.join(ROOT, 'data', 'kana.json'), encoding='utf-8'))

    # ── Ханзны уншлага ────────────────────────────────────────────────
    # Ганц ханзны дуудлага олон янз тул 音読み ба 訓読み-г ТУСДАА бичлэг
    # болгоно: карт дээр мөр тус бүрийн хажууд 🔊 гарна.
    #   JO-<юникод>  音読み  «ニチ、ジツ»
    #   JK-<юникод>  訓読み  «ひ»        (цэгийг арилгаж бүтэн үг болгоно)
    kanji_p = os.path.join(ROOT, 'data', 'kanji.json')
    kanji = json.load(io.open(kanji_p, encoding='utf-8')) if os.path.exists(kanji_p) else {'items': []}

    jobs = []
    for it in vocab['items']:
        say = it.get('kana') or it.get('jp') or ''
        if not say:
            continue
        # 4 дэх талбар нь БИЧИГДЭХ хэлбэр — `notation` бөөсний は/へ-г
        # ялгахад толиос асуухдаа хэрэглэнэ.
        jobs.append((it['id'], to_kata(re.sub('[（）()～〜]', '', say).replace('／', '、')),
                     it.get('accent', ''), it.get('jp') or ''))
    for it in kana['items']:
        jobs.append((it['id'], it['kata'], '', it['hira']))
    # Жишээ өгүүлбэр — EX-<үгийн id>. N5-ийн 97%-д нь бий. Өргөлтийн
    # тэмдэглэгээ байхгүй тул хөдөлгүүрийн өөрийн толиор уншина.
    for it in vocab['items']:
        ex = (it.get('ex') or '').strip()
        if ex:
            jobs.append(('EX-' + it['id'], ex, '', ex))
    # Шалгалтын асуулт ба загвар хариулт — EXQ-/EXA-<асуултын id>.
    # Эдгээр нь БҮТЭН ӨГҮҮЛБЭР тул өргөлтийн тэмдэглэгээгүй: хөдөлгүүрийн
    # өөрийн морфологийн задлалаар уншина (жишээ өгүүлбэртэй ижил зарчим).
    # Браузерын TTS нь хоолой, өргөлт нь төхөөрөмж бүрд өөр байдаг тул
    # урьдчилан бэлдсэн бичлэг хавьгүй жигд.
    exam_p = os.path.join(ROOT, 'data', 'exam-starter.json')
    if os.path.exists(exam_p):
        exam = json.load(io.open(exam_p, encoding='utf-8'))
        for it in exam.get('items', []):
            # 「」 хашилтыг хасна — хөдөлгүүр заримдаа гажуутай уншдаг.
            q = re.sub('[「」『』]', '', (it.get('q') or '')).strip()
            m = re.sub('[「」『』]', '', (it.get('model') or '')).strip()
            if q:
                jobs.append(('EXQ-' + it['id'], q, '', q))
            if m:
                jobs.append(('EXA-' + it['id'], m, '', m))

    for it in kanji['items']:
        code = it['id'].split('-')[1]
        on = [r for r in it['on'][:3] if r]
        kun = [r.replace('.', '') for r in it['kun'][:3] if r]
        if on:
            jobs.append(('JO-' + code, to_kata('、'.join(on)), '', ''))
        if kun:
            jobs.append(('JK-' + code, to_kata('、'.join(kun)), '', ''))

    if a.limit:
        jobs = jobs[:a.limit]

    os.makedirs(AUDIO, exist_ok=True)
    ok, skip, fail = 0, 0, []
    for i, (id_, kata, acc, jp) in enumerate(jobs, 1):
        dst = os.path.join(AUDIO, id_ + '.mp3')
        if os.path.exists(dst) and not a.force:
            skip += 1
            ok += 1
            continue
        try:
            wav = synth(kata, notation(acc, a.speaker, jp), a.speaker, a.speed)
            p = subprocess.run(
                [ff, '-hide_banner', '-loglevel', 'error', '-y', '-i', 'pipe:0',
                 '-codec:a', 'libmp3lame', '-b:a', a.bitrate, '-ac', '1', '-ar', '24000',
                 '-f', 'mp3', dst],
                input=wav, capture_output=True)
            if p.returncode != 0 or not os.path.exists(dst):
                raise RuntimeError(p.stderr.decode('utf-8', 'replace')[:200])
            ok += 1
        except Exception as e:
            fail.append((id_, str(e)[:120]))
        if i % 50 == 0:
            print('%d/%d  ok=%d fail=%d' % (i, len(jobs), ok, len(fail)), flush=True)

    ids = sorted(f[:-4] for f in os.listdir(AUDIO) if f.endswith('.mp3'))
    total = sum(os.path.getsize(os.path.join(AUDIO, i + '.mp3')) for i in ids)
    json.dump({'engine': 'VOICEVOX', 'speaker': a.speaker, 'count': len(ids), 'ids': ids},
              io.open(os.path.join(ROOT, 'data', 'audio.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, separators=(',', ':'))
    print('done  files=%d  skipped=%d  failed=%d  size=%.1f MB'
          % (len(ids), skip, len(fail), total / 1048576))
    if fail:
        io.open(os.path.join(ROOT, 'tools', 'audio_failed.txt'), 'w',
                encoding='utf-8').write('\n'.join('%s\t%s' % f for f in fail))
        print('failures -> tools/audio_failed.txt')


if __name__ == '__main__':
    main()
