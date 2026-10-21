"""«Дуу» хэсгийн аялгууг (зөвхөн хөг, дуугүй) үүсгэж, үгийн цагийг бичнэ.

Яагаад өөрсдөө үүсгэх вэ: хүүхдийн дууны бичлэгүүд (YouTube г.м.)
зохиогчийн эрхтэй, харин репо ба сайт НИЙТЭД нээлттэй. «Rain Rain Go
Away»-ийн аялгуу нь ардын (public domain) тул нотыг нь энд бичиж, дууг
нь numpy-аар (хонхон/ксилофон төстэй өнгө) синтезлэнэ. Бичлэгийг
өөрсдөө үүсгэдэг тул ҮЕ БҮРИЙН цаг яг мэдэгдэнэ — караоке тодруулга.

Ажиллуулах (numpy + mp3 кодлогчтой ffmpeg хэрэгтэй):
    pip install numpy imageio-ffmpeg
    python tools/build_song.py

Гаралт:
    audio/songs/<id>.mp3      — файлын нэр ХУВИЛБАРТАЙ (`-v1`): SW нь
                                audio/*-г «кэш эхэлж» өгдөг тул аяыг
                                өөрчилбөл нэрийг нь ч солино.
    data/songs.json           — тухайн дууны `audio`, `lines[].t`, `end`.
Скриптийн гаралт латинаар (docs/STATE.md §2.1).
"""
import json
import os
import subprocess
import sys
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 24000
BPM = 92
BEAT = 60.0 / BPM

# C дур. MIDI дугаар.
N = {'C4': 60, 'D4': 62, 'E4': 64, 'F4': 65, 'G4': 67, 'A4': 69, 'C5': 72,
     'C3': 48, 'F3': 53, 'G3': 55}

# Үе бүр = (кана, нот, урт/цохилтоор). Хоосон кана = завсарлага.
# Мөр бүр 2 такт (8 цохилт). «Rain Rain Go Away»-ийн ардын аялгуу:
# sol-mi sol-sol-mi / sol-sol-la-la-sol-sol-mi / ... -> do.
SONGS = {
    'S01': {
        'file': 'S01-v1',
        # 2 цохилт бүрд нэг баас — мөр бүр 4 (C C C G · C C F G · C C G C)
        'chords': ['C3', 'C3', 'C3', 'G3', 'C3', 'C3', 'F3', 'G3',
                   'C3', 'C3', 'G3', 'C3'],
        'lines': [
            [('あ', 'G4', 1), ('め', 'E4', 1), ('あ', 'G4', 1), ('め', 'E4', 1),
             ('ば', 'G4', .5), ('い', 'G4', .5), ('ば', 'E4', 1), ('い', 'E4', 1), ('', None, 1)],
            [('ぽ', 'G4', 1), ('つ', 'E4', 1), ('ぽ', 'G4', 1), ('つ', 'E4', 1),
             ('あ', 'A4', .5), ('り', 'A4', .5), ('が', 'G4', .5), ('と', 'G4', .5),
             ('う', 'E4', 1), ('', None, 1)],
            [('お', 'G4', .5), ('そ', 'G4', .5), ('ら', 'E4', .5), ('の', 'E4', .5),
             ('く', 'G4', .5), ('ま', 'G4', .5), ('さ', 'E4', .5), ('ん', 'E4', .5),
             ('さ', 'G4', .5), ('よ', 'E4', .5), ('う', 'D4', .5), ('な', 'D4', .5),
             ('ら', 'C4', 2)],
        ],
        'intro': 4,      # эхлэх тоолол (цохилт) — хөг ба баас л
        'repeat': 2,     # хүүхдэд давтах нь хэрэгтэй — дууг 2 удаа
    },
}


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tone(m, dur, amp):
    """Хонхон/ксилофон өнгө: хурдан дайралт, экспоненциал унтралт."""
    n = int(SR * dur)
    t = np.arange(n) / SR
    f = hz(m)
    w = (np.sin(2 * np.pi * f * t) + .35 * np.sin(2 * np.pi * 2 * f * t)
         + .12 * np.sin(2 * np.pi * 3.01 * f * t))
    env = np.exp(-t * 3.2) * np.minimum(1, t / .006)
    return amp * w * env


def build(sid, spec):
    lines = spec['lines']
    body = sum(d for ln in lines for _, _, d in ln)
    total_beats = spec['intro'] + body * spec['repeat'] + 2
    out = np.zeros(int(SR * (total_beats * BEAT + 1.5)))

    def put(sig, at):
        i = int(at * SR)
        out[i:i + len(sig)] += sig[:max(0, len(out) - i)]

    # Эхлэх тоолол: 4 зөөлөн цохилт (C5)
    for b in range(spec['intro']):
        put(tone(N['C5'], .25, .18), b * BEAT)

    times = []                     # эхний давталтын мөр бүрийн үеийн цаг
    beat = spec['intro']
    for rep in range(spec['repeat']):
        for li, ln in enumerate(lines):
            ts = []
            for kana, note, d in ln:
                at = beat * BEAT
                if note:
                    put(tone(N[note], max(d * BEAT, .45) + .6, .5), at)
                if kana and rep == 0:
                    ts.append(round(at, 2))
                beat += d
            if rep == 0:
                times.append(ts)
    # Баас: 2 цохилт тутамд, аялгуутай хамт
    ch = spec['chords']
    for i, b in enumerate(range(spec['intro'], int(beat), 2)):
        put(tone(N[ch[i % len(ch)]], 2 * BEAT + .4, .28), b * BEAT)
    end = round(beat * BEAT, 2)

    out = out[:int(SR * (end + 1.8))]
    out /= max(1e-9, np.abs(out).max()) / .8
    fade = int(SR * 1.2)
    out[-fade:] *= np.linspace(1, 0, fade)
    return out, times, end, spec['repeat']


def ffmpeg():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return 'ffmpeg'


def main():
    path = os.path.join(ROOT, 'data', 'songs.json')
    with open(path, encoding='utf-8') as fh:
        data = json.load(fh)
    os.makedirs(os.path.join(ROOT, 'audio', 'songs'), exist_ok=True)
    for sid, spec in SONGS.items():
        song = next((s for s in data['items'] if s['id'] == sid), None)
        if not song:
            sys.exit('no song ' + sid + ' in data/songs.json')
        sig, times, end, rep = build(sid, spec)
        wav = os.path.join(ROOT, 'audio', 'songs', spec['file'] + '.wav')
        mp3 = wav[:-4] + '.mp3'
        with wave.open(wav, 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
            w.writeframes((sig * 32767).astype('<i2').tobytes())
        subprocess.run([ffmpeg(), '-y', '-loglevel', 'error', '-i', wav,
                        '-codec:a', 'libmp3lame', '-b:a', '96k', mp3], check=True)
        os.remove(wav)
        # Үе бүрийн цаг нь мөрийн хоосон биш тэмдэгтүүдтэй ЯГ таарах ёстой.
        for ln, ts in zip(song['lines'], times):
            chars = [c for c in ln['kana'] if not c.isspace()]
            if len(chars) != len(ts):
                sys.exit('mismatch %s: %d chars vs %d notes' % (sid, len(chars), len(ts)))
            ln['t'] = ts
        # Давталт бүрийн урт — апп нь хоёр дахь удаад ч тодруулна.
        song['audio'] = 'audio/songs/' + spec['file'] + '.mp3'
        song['loop'] = round((end - spec['intro'] * BEAT) / rep, 2)
        song['end'] = end
        print('%s: %s  %.1fs  lines=%d' % (sid, song['audio'], end, len(times)))
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')


if __name__ == '__main__':
    main()
