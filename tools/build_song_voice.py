"""«Дуу»-ны үгийг VOICEVOX-оор УНШУУЛЖ, «🗣 Уншуулах» товчны бичлэг гаргана.

Апп нь энэ бичлэг байхгүй үед утасны япон хоолойгоор уншдаг (хоолой
утаснаас хамаарна, зарим утсанд огт байхгүй, үеийн тодруулгагүй). Энэ
скрипт нь бусад дуудлагын бичлэгтэй ИЖИЛ хоолойгоор (VOICEVOX:四国めたん)
мөр бүрийг уншиж, VOICEVOX-ийн моранын уртаас ҮЕ БҮРИЙН цагийг бичнэ —
караоке нь аяархтай адил үе үеэрээ тодорно.

Ажиллуулах (VOICEVOX хөдөлгүүр асаалттай байх ёстой, build_audio.py-тай адил):
    tools/_vv/run.exe            (өөр цонхонд)
    pip install imageio-ffmpeg   (эсвэл PATH-д ffmpeg)
    python tools/build_song_voice.py                # бүх дуу
    python tools/build_song_voice.py --song S01

Гаралт:
    audio/songs/<id>-read-v<N>.mp3  — нэр нь ХУВИЛБАРТАЙ: SW нь audio/*-г
                                      «кэш эхэлж» өгдөг. Дахин үүсгэхдээ
                                      --ver-ийг өсгө.
    data/songs.json                 — `read: {audio, lines: [[сек, ...], ...]}`
Дараа нь index.html-ийн ?v= ба sw.js-ийн VERSION-ийг өргөж push хийнэ.
Скриптийн гаралт латинаар (docs/STATE.md §2.1).
"""
import argparse
import io
import json
import os
import subprocess
import sys
import urllib.parse
import urllib.request
import wave

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENGINE = 'http://127.0.0.1:50021'
SPEAKER = 2          # 四国めたん — build_audio.py-тай ижил (README: --speaker 2)
SPEED = 0.8          # хүүхдэд удаан
PRE, POST = 0.15, 0.15
GAP = 0.9            # мөр хооронд (сек)
SR = 24000
SMALL = set('ゃゅょぁぃぅぇぉゎャュョァィゥェォヮ')   # өмнөх тэмдэгттэй нэг мора


def api(path, params=None, body=None):
    url = ENGINE + path + ('?' + urllib.parse.urlencode(params) if params else '')
    data = json.dumps(body).encode('utf-8') if body is not None else b''
    req = urllib.request.Request(url, data=data, method='POST',
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as r:
        raw = r.read()
    return raw if path == '/synthesis' else json.loads(raw)


def mora_starts(q):
    """audio_query-оос мора бүрийн эхлэх секунд (speedScale-ийг тооцсон)."""
    t, out = q['prePhonemeLength'], []
    for ap in q['accent_phrases']:
        for m in ap['moras']:
            out.append(t)
            t += (m.get('consonant_length') or 0) + m['vowel_length']
        if ap.get('pause_mora'):
            t += ap['pause_mora']['vowel_length']
    return [x / q['speedScale'] for x in out]


def char_times(kana, moras, dur):
    """Мөрийн хоосон биш тэмдэгт бүрийн цаг. Жижиг кана өмнөхтэйгээ ижил.
    Мора ба тэмдэгтийн тоо зөрвөл мөрийн хугацаанд жигд тарааж, анхааруулна."""
    chars = [c for c in kana if not c.isspace()]
    big = [c for c in chars if c not in SMALL]
    if len(big) != len(moras):
        print('  WARN mora mismatch (%d chars vs %d moras) -> spread evenly'
              % (len(big), len(moras)))
        start, end = (moras[0] if moras else PRE), dur - POST
        return [start + (end - start) * i / len(chars) for i in range(len(chars))]
    out, it = [], iter(moras)
    for c in chars:
        out.append(out[-1] if (c in SMALL and out) else next(it))
    return out


def ffmpeg():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return 'ffmpeg'


def build(song, ver):
    pcm, times, at = bytearray(), [], 0.0
    silence = lambda sec: b'\x00\x00' * int(SR * sec)
    pcm += silence(0.3); at += 0.3
    for i, ln in enumerate(song['lines']):
        text = ln['kana'].replace('　', ' ').strip()
        q = api('/audio_query', {'text': text, 'speaker': SPEAKER})
        q.update(speedScale=SPEED, prePhonemeLength=PRE, postPhonemeLength=POST,
                 outputSamplingRate=SR, outputStereo=False)
        wav = api('/synthesis', {'speaker': SPEAKER}, q)
        with wave.open(io.BytesIO(wav)) as w:
            frames = w.readframes(w.getnframes())
        dur = len(frames) / 2 / SR
        ts = char_times(ln['kana'], mora_starts(q), dur)
        times.append([round(at + x, 2) for x in ts])
        pcm += frames; at += dur
        if i < len(song['lines']) - 1:
            pcm += silence(GAP); at += GAP
        print('  line %d: %.2fs' % (i + 1, dur))
    pcm += silence(0.4)
    name = '%s-read-v%d' % (song['id'], ver)
    wavp = os.path.join(ROOT, 'audio', 'songs', name + '.wav')
    with wave.open(wavp, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(bytes(pcm))
    subprocess.run([ffmpeg(), '-y', '-loglevel', 'error', '-i', wavp,
                    '-codec:a', 'libmp3lame', '-b:a', '96k', wavp[:-4] + '.mp3'], check=True)
    os.remove(wavp)
    song['read'] = {'audio': 'audio/songs/' + name + '.mp3', 'lines': times}
    print('%s -> %s' % (song['id'], song['read']['audio']))


def main():
    global ENGINE
    ap = argparse.ArgumentParser()
    ap.add_argument('--song', help='зөвхөн энэ id (ж: S01)')
    ap.add_argument('--ver', type=int, default=1, help='файлын нэрийн хувилбар')
    ap.add_argument('--engine', default=ENGINE)
    a = ap.parse_args()
    ENGINE = a.engine
    path = os.path.join(ROOT, 'data', 'songs.json')
    with open(path, encoding='utf-8') as fh:
        data = json.load(fh)
    os.makedirs(os.path.join(ROOT, 'audio', 'songs'), exist_ok=True)
    todo = [s for s in data['items'] if not a.song or s['id'] == a.song]
    if not todo:
        sys.exit('no song')
    for s in todo:
        build(s, a.ver)
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')


if __name__ == '__main__':
    main()
