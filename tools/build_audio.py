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


def moras(s):
    """Катакана мөрийг мора болгон хуваана. Жижиг кана өмнөхтэйгөө нийлнэ."""
    out = []
    for ch in s:
        if out and ch in SMALL:
            out[-1] += ch
        else:
            out.append(ch)
    return out


def is_kana_ch(ch):
    c = ord(ch)
    return 0x30A1 <= c <= 0x30FC and c != 0x30FB


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


def notation(accent_text, kana_text, speaker):
    """Номын тэмдэглэгээг VOICEVOX-ийн «AquesTalk風記法» болгоно.

    Жишээ:  ミャ↓ンマー          -> ミャ'ンマー
            ブラジル○           -> ブラジル'      (ганцаараа дуудахад ижил)
            なまえ○／おなまえ○   -> ナマエ'、オナマエ'
    """
    src = accent_text or kana_text or ''
    parts = []
    for seg, sep in split_segments(src):
        ms, drop = seg_accent(seg)
        if not ms:
            continue
        if drop is None:
            drop = vv_accent(''.join(ms), speaker)
            if not drop:
                drop = len(ms)          # мэдэгдэхгүй бол сүүлийн мора
        drop = max(1, min(drop, len(ms)))
        body = ''.join(ms[:drop]) + "'" + ''.join(ms[drop:])
        parts.append((sep if parts else '') + body)
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
    a = ap.parse_args()

    global ENGINE
    ENGINE = a.engine

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

    vocab = json.load(io.open(os.path.join(ROOT, 'data', 'vocab.json'), encoding='utf-8'))
    kana = json.load(io.open(os.path.join(ROOT, 'data', 'kana.json'), encoding='utf-8'))

    jobs = []
    for it in vocab['items']:
        say = it.get('kana') or it.get('jp') or ''
        if not say:
            continue
        jobs.append((it['id'], to_kata(re.sub('[（）()～〜]', '', say).replace('／', '、')),
                     it.get('accent', ''), say))
    for it in kana['items']:
        jobs.append((it['id'], it['kata'], '', it['hira']))

    if a.limit:
        jobs = jobs[:a.limit]

    os.makedirs(AUDIO, exist_ok=True)
    ok, skip, fail = 0, 0, []
    for i, (id_, kata, acc, raw) in enumerate(jobs, 1):
        dst = os.path.join(AUDIO, id_ + '.mp3')
        if os.path.exists(dst) and not a.force:
            skip += 1
            ok += 1
            continue
        try:
            wav = synth(kata, notation(acc, raw, a.speaker), a.speaker, a.speed)
            p = subprocess.run(
                [ff, '-hide_banner', '-loglevel', 'error', '-y', '-i', 'pipe:0',
                 '-codec:a', 'libmp3lame', '-b:a', '48k', '-ac', '1', '-ar', '24000',
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
