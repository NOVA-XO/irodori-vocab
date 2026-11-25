# -*- coding: utf-8 -*-
u"""v2 (KOTO)-ийн ханзны УНШЛАГА бүрийн дуудлага -> audio/kr/*.mp3 (эзэн 11-25: «уншлагуудыг сонсдог байх хэрэгтэй»).

ЯАГААД v1-ийн JO-/JK- бичлэгийг дахин ашиглаагүй вэ: тэдгээр нь ханз бүрийн ЭХНИЙ 3 уншлагыг нэг файлд
нийлүүлсэн. v2 4 хүртэл уншлага харуулдаг (150 тохиолдолд 4 дэх нь дуугүй үлдэнэ), 粉-д v2-д байхгүй
«デシメートル» уншигдана. Энд уншлага БҮР тусдаа файл — дэлгэцэнд харагдаж буйг л уншина.

Файлын нэр (апп id-г ӨГӨГДӨЛГҮЙГЭЭР өөрөө гаргана — v2/app.js `kjReadAu`):
  ОН   audio/kr/o-<код>.mp3      код = катакана үсэг бүрийн (codepoint − 0x30A0) 36-тын 2 орон. 296 файл —
                                 ОН уншлага ханзнаас хамаарахгүй тул ижил канаг хуваалцана.
  КУН  audio/kr/k-<HEX>-<i>.mp3  HEX = ханзны код (J-65E5 -> 65E5), i = `kun` доторх дугаар. Ханз бүрд тусдаа:
                                 ижил кана ӨӨР ӨРГӨЛТТЭЙ (橋 はし[2] · 箸 はし[1]).

Дуудлагын зам (хөдөлгүүрээс фонемийг уншиж шалгасан, 11-25):
  ОН   «AquesTalk風記法» (`is_kana`) — кана бүрийг үсгээр нь. Өргөлт 1-р мора (頭高) — ТОГТСОН ЗАРШИЛ, толиос биш.
       オ段+ウ -> オ (コウ = «ko o»; толь `キョウ`-г «kyo u», `コウ`-г «ko o» гэж ЗӨРҮҮТЭЙ уншдаг тул өөрсдөө).
  КУН  ① ханз + окуригана-г толиор (食べる) — өргөлт үгийнх. Фонем нь үсгээр уншсантай таарвал л авна
         (уртын зөрүүг зөвшөөрнө: もう.す = «mo o su»; окуриганы «う» нь ЗААВАЛ «u»: おも.う).
       ② хираганаар толиос (は -> «wa» мэт бөөсний уншлага ①②-т таарахгүй тул унана).
       ③ үсгээр, хавтгай өргөлт.
  Аль замаар гарсныг tools/v2_kanji_readings.json-д бичнэ — ②③-ийн ӨРГӨЛТ баталгаагүй.

Ажиллуулах (VOICEVOX асаалттай: tools/_vv/windows-cpu/run.exe):
    python -I tools/build_v2_kanji_readings.py            # дутууг үүсгэнэ, хуучирсныг дахин
    python -I tools/build_v2_kanji_readings.py --dry      # зөвхөн тайлан
    python -I tools/build_v2_kanji_readings.py --force
"""
import argparse
import collections
import io
import json
import os
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'audio', 'kr')
MANIFEST = os.path.join(HERE, 'v2_kanji_readings.json')
ENGINE = 'http://127.0.0.1:50021'
SPEAKER = 2          # үгсийн бичлэгтэй ижил хоолой (四国めたん ノーマル)
SPEED = 0.95
SMALL = u'ァィゥェォャュョヮ'
ROWS = {u'ア': u'アカサタナハマヤラワガザダバパャァヮ', u'イ': u'イキシチニヒミリギジヂビピィ', u'ウ': u'ウクスツヌフムユルグズヅブプュゥヴ',
        u'エ': u'エケセテネヘメレゲゼデベペェ', u'オ': u'オコソトノホモヨロヲゴゾドボポョォ'}
VOWEL = {c: v for v, row in ROWS.items() for c in row}


def kata(s):
    return u''.join(chr(ord(c) + 0x60) if 0x3041 <= ord(c) <= 0x3096 else c for c in s)


def moras(k):
    out = []
    for c in k:
        if out and c in SMALL:
            out[-1] += c
        else:
            out.append(c)
    return out


def natural(ms, stem):
    u"""Уртатгал: «ー» -> өмнөх эгшиг; オ段+ウ -> オ. `stem` = окуриганы өмнөх морагийн тоо: зааг ДАВСАН «う»-г хөндөхгүй."""
    out = []
    for i, m in enumerate(ms):
        prev = VOWEL.get(out[-1][-1]) if out else None
        if m == u'ー' and prev:
            m = prev
        elif m == u'ウ' and prev == u'オ' and i != stem:
            m = u'オ'
        out.append(m)
    return out


def enc(k):
    return u''.join('%s' % _b36(ord(c) - 0x30A0) for c in k)


def _b36(n):
    d = '0123456789abcdefghijklmnopqrstuvwxyz'
    assert 0 < n < 36 * 36, n
    return d[n // 36] + d[n % 36]


def api(path, params, body=None):
    req = urllib.request.Request(ENGINE + path + '?' + urllib.parse.urlencode(params),
                                 data=json.dumps(body).encode('utf-8') if body is not None else b'', method='POST',
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as r:
        raw = r.read()
    return raw if path == '/synthesis' else json.loads(raw)


def phrases(text, is_kana=False):
    p = {'text': text, 'speaker': SPEAKER}
    if is_kana:
        p['is_kana'] = 'true'
    try:
        return api('/accent_phrases', p)
    except urllib.error.HTTPError:
        return None


def phon(ph):
    return [((m.get('consonant') or '') + m['vowel']).lower() for p in ph for m in p['moras']]


def literal(ms, accent):
    return phrases(u''.join(ms[:accent]) + u"'" + u''.join(ms[accent:]), True)


def same(dict_ph, lit_ph, stem):
    u"""Толийн уншлага үсгээр уншсантай таарах уу. Зөвшөөрөх зөрүү: オ段+«u» -> «o», エ段+«i» -> «e» (уртатгал) — заагаас бусад газар."""
    if len(dict_ph) != len(lit_ph):
        return False
    for i, (d, l) in enumerate(zip(dict_ph, lit_ph)):
        if d == l:
            continue
        long_ok = i > 0 and i != stem and ((l == 'u' and d == 'o' and lit_ph[i - 1].endswith('o')) or (l == 'i' and d == 'e' and lit_ph[i - 1].endswith('e')))
        if not long_ok:
            return False
    return True


def plan_on(r):
    ms = natural(moras(r), -1)
    ph = literal(ms, 1)
    return ph, 'on'


def plan_kun(c, r):
    stem_txt, _, oku = r.partition('.')
    ms_raw = moras(kata(stem_txt + oku))
    stem = len(moras(kata(stem_txt))) if oku else -1
    lit = literal(ms_raw, len(ms_raw))
    if not lit:
        return None, 'fail'
    lp = phon(lit)
    for route, text in (('kanji', c + oku), ('hira', stem_txt + oku)):
        ph = phrases(text)
        if ph and len(ph) == 1 and same(phon(ph), lp, stem):
            return ph, route
    ms = natural(ms_raw, stem)
    return literal(ms, len(ms)), 'literal'


def synth(text, ph):
    q = api('/audio_query', {'text': text, 'speaker': SPEAKER})
    q['accent_phrases'] = ph
    q.update(speedScale=SPEED, prePhonemeLength=0.03, postPhonemeLength=0.08, outputSamplingRate=24000, outputStereo=False)
    return api('/synthesis', {'speaker': SPEAKER}, q)


def jobs():
    raw = io.open(os.path.join(ROOT, 'v2', 'kanji.js'), encoding='utf-8').read()
    out = collections.OrderedDict()
    for k in json.loads(raw[raw.index('['):raw.rindex(']') + 1]):
        code = k['id'].split('-')[1]
        for r in k['on']:
            out.setdefault('o-' + enc(r), ('on', k['c'], r))
        for i, r in enumerate(k['kun']):
            out['k-%s-%d' % (code, i)] = ('kun', k['c'], r)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry', action='store_true')
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--limit', type=int, default=0)
    a = ap.parse_args()
    todo = jobs()
    old = json.load(io.open(MANIFEST, encoding='utf-8')) if os.path.exists(MANIFEST) else {}
    print(u'уншлага: ОН %d · КУН %d · нийт файл %d' % (sum(1 for v in todo.values() if v[0] == 'on'), sum(1 for v in todo.values() if v[0] == 'kun'), len(todo)))
    if a.dry:
        miss = [n for n, v in todo.items() if not os.path.exists(os.path.join(OUT, n + '.mp3')) or (old.get(n) or {}).get('r') != v[2]]
        print(u'дутуу эсвэл хуучирсан: %d' % len(miss))
        return
    import imageio_ffmpeg
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    os.makedirs(OUT, exist_ok=True)
    man, made, fail = collections.OrderedDict(), 0, []
    for n, (kind, c, r) in todo.items():
        dst = os.path.join(OUT, n + '.mp3')
        if not a.force and os.path.exists(dst) and (old.get(n) or {}).get('r') == r:
            man[n] = old[n]
            continue
        if a.limit and made >= a.limit:
            continue
        try:
            ph, route = plan_on(r) if kind == 'on' else plan_kun(c, r)
            if not ph:
                raise RuntimeError('notation rejected')
            wav = synth(kata(r.replace('.', '')), ph)
            p = subprocess.run([ff, '-hide_banner', '-loglevel', 'error', '-y', '-i', 'pipe:0', '-codec:a', 'libmp3lame', '-b:a', '48k',
                                '-ac', '1', '-ar', '24000', '-f', 'mp3', dst], input=wav, capture_output=True)
            if p.returncode != 0 or not os.path.exists(dst) or os.path.getsize(dst) < 600:
                raise RuntimeError(p.stderr.decode('utf-8', 'replace')[:160] or 'empty file')
            man[n] = dict(c=c, r=r, via=route, ph=' '.join(phon(ph)), a=ph[0]['accent'])
            made += 1
            if made % 100 == 0:
                print('%d ...' % made, flush=True)
        except Exception as e:
            fail.append((n, c, r, str(e)[:120]))
    gone = [f for f in os.listdir(OUT) if f.endswith('.mp3') and f[:-4] not in todo]
    for f in gone:
        os.remove(os.path.join(OUT, f))
    io.open(MANIFEST, 'w', encoding='utf-8', newline='\n').write(
        u'{\n' + u',\n'.join(u' %s: %s' % (json.dumps(n), json.dumps(v, ensure_ascii=False, sort_keys=True)) for n, v in man.items()) + u'\n}\n')
    size = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT) if f.endswith('.mp3'))
    via = collections.Counter(v['via'] for v in man.values())
    print(u'шинээр %d · нийт %d / %d · устгасан %d · %.1f МБ · зам: %s' % (made, len(man), len(todo), len(gone), size / 1048576.0, dict(via)))
    for f in fail:
        print(u'  АЛДАА %s %s %s — %s' % f)
    if fail or len(man) != len(todo):
        sys.exit(1 if not a.limit else 0)


if __name__ == '__main__':
    main()
