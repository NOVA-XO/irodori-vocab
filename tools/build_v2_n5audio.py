# -*- coding: utf-8 -*-
"""«Өөрийгөө сорих» — сонсголын дууг VOICEVOX-оор үүсгэнэ: audio/n5/<id>.mp3 (2026-11-18).

Дуу: хөтлөгч (N) 春日部つむぎ · эмэгтэй (F) 四国めたん · эрэгтэй (M) 玄野武宏. Кредит: VOICEVOX:春日部つむぎ, VOICEVOX:四国めたん,
VOICEVOX:玄野武宏 (лицензийн шаардлага — README).
Бүтэц (JLPT-ийнх шиг): хөтлөгчийн танилцуулга → завсар → яриа → завсар → асуулт; 発話表現/即時応答-д сонголтыг
«いち … に … さん …» гэж уншина (хэвлэгдэхгүй).

    tools/_vv/windows-cpu/run.exe    (хөдөлгүүр http://127.0.0.1:50021)
    python -I tools/build_v2_n5audio.py [--force]
"""
import argparse, io, json, os, struct, subprocess, sys, urllib.parse, urllib.request, wave
sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'audio', 'n5')
ENGINE = 'http://127.0.0.1:50021'
VOICE = {'N': 8, 'F': 2, 'M': 11}
RATE = 24000
NUM = [u'いち', u'に', u'さん', u'よん']


def api(path, params, body=None):
    req = urllib.request.Request(ENGINE + path + '?' + urllib.parse.urlencode(params), data=body, method='POST',
                                 headers={'Content-Type': 'application/json'} if body is not None else {})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def say(text, who, speed=0.95):
    """PCM 16 бит моно, RATE Гц. Зай (分かち書き) нь хэт урт завсар үүсгэдэг тул хасна."""
    t = text.replace(' ', '').replace(u'　', '')
    q = json.loads(api('/audio_query', {'text': t, 'speaker': VOICE[who]}, b''))
    q.update(speedScale=speed, outputSamplingRate=RATE, outputStereo=False, prePhonemeLength=0.1, postPhonemeLength=0.1)
    wav = api('/synthesis', {'speaker': VOICE[who]}, json.dumps(q).encode('utf-8'))
    with wave.open(io.BytesIO(wav)) as w:
        assert w.getframerate() == RATE and w.getnchannels() == 1 and w.getsampwidth() == 2
        return w.readframes(w.getnframes())


def gap(sec):
    return b'\x00\x00' * int(RATE * sec)


def script_of(k, q):
    """[(хэн, бичвэр, дараах завсар сек)]"""
    out = []
    if k in ('task', 'point'):
        out.append(('N', q['setup'], 1.0))
        out += [(l['sp'], l['t'], 0.5) for l in q['lines']]
        out[-1] = out[-1][:2] + (1.2,)
        out.append(('N', q['q'], 0.3))
    elif k == 'speech':
        out.append(('N', q['q'], 1.0))
        out += [('F', NUM[i] + u'。' + o, 0.8) for i, o in enumerate(q['o'])]
    else:
        out.append((q['line']['sp'], q['line']['t'], 1.0))
        other = 'M' if q['line']['sp'] == 'F' else 'F'
        out += [(other, NUM[i] + u'。' + o, 0.8) for i, o in enumerate(q['o'])]
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--force', action='store_true')
    a = ap.parse_args()
    ls = json.load(io.open(os.path.join(ROOT, 'data', 'n5', 'listening.json'), encoding='utf-8'))
    os.makedirs(OUT, exist_ok=True)
    import imageio_ffmpeg
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    made = skipped = 0
    for k in ('task', 'point', 'speech', 'resp'):
        for q in ls.get(k, []):
            dst = os.path.join(OUT, q['id'] + '.mp3')
            if os.path.exists(dst) and not a.force:
                skipped += 1
                continue
            pcm = b''.join(say(t, who) + gap(g) for who, t, g in script_of(k, q))
            tmp = dst + '.wav'
            with wave.open(tmp, 'wb') as w:
                w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE); w.writeframes(pcm)
            subprocess.run([ff, '-y', '-loglevel', 'error', '-i', tmp, '-codec:a', 'libmp3lame', '-b:a', '48k', '-ac', '1', dst], check=True)
            os.remove(tmp)
            made += 1
            print('  %s %.1f сек' % (q['id'], len(pcm) / 2 / RATE))
    print('үүсгэв %d · байсан %d' % (made, skipped))


if __name__ == '__main__':
    main()
