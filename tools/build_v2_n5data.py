# -*- coding: utf-8 -*-
"""«Өөрийгөө сорих» — асуултын сангуудыг нэгтгэж v2/n5data.js гаргана (2026-11-18).

Эх:
  tools/v2_n5test_vocab.json — 漢字読み · 表記 · 文脈規定 (build_v2_n5test.py, автомат)
  data/n5/grammar.json       — дүрмийн жагсаалт + 文法形式 (form)
  data/n5/grammar2.json      — 文の組み立て (order) · 文章の文法 (text) · 言い換え類義 (iikae)
  data/n5/reading.json       — 読解: short · mid · info
  data/n5/listening.json     — 聴解: task · point · speech · resp (дуу: audio/n5/<id>.mp3, build_v2_n5audio.py)
  data/n5/verify.json        — бие даасан шалгалтаар ДАВХАР зөв / буруу гарсан id (хасна)

Асуудал олдвол build УНАНА (чимээгүй засахгүй).

    python -I tools/build_v2_n5data.py
"""
import io, json, os, re, sys
sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
N5 = os.path.join(ROOT, 'data', 'n5')
WHITE = set(u'日一人国年大十二本中出三見月長生五時上行四後金前九入学間円子東八六下今気小七高山女外百先名川千来水男話校北土午木車書半白天西電火語右左聞休食何南万毎雨母読友父')
CJK = re.compile(u'[一-鿿]')
problems = []


def load(name):
    p = os.path.join(N5, name)
    return json.load(io.open(p, encoding='utf-8')) if os.path.exists(p) else {}


def jp_ok(where, *texts):
    bad = sorted({c for t in texts for c in (t or '') if CJK.match(c)} - WHITE)
    if bad:
        problems.append('%s: N5-ийн жагсаалтад ороогүй ханз %s' % (where, ''.join(bad)))


def opts_ok(where, o, n=4):
    if not isinstance(o, list) or len(o) != n or len(set(o)) != n or not all(isinstance(x, str) and x.strip() for x in o):
        problems.append('%s: сонголт %d өөр байх ёстой (%r)' % (where, n, o))


vocab = json.load(io.open(os.path.join(ROOT, 'tools', 'v2_n5test_vocab.json'), encoding='utf-8'))
verify = load('verify.json')
DROP = set(verify.get('drop', []))
OK_B = set(verify.get('bunmyaku_ok', []))
g1, g2, rd, ls = load('grammar.json'), load('grammar2.json'), load('reading.json'), load('listening.json')

pools = {}
pools['kanji'] = [dict(id=q['id'], pre=q['pre'], w=q['w'], post=q['post'], o=q['o'], mn='%s — %s: %s' % (q['w'], q['r'], q['mn'])) for q in vocab['kanji']]
pools['hyouki'] = [dict(id=q['id'], pre=q['pre'], w=q['w'], post=q['post'], o=q['o'], mn='%s — %s: %s' % (q['w'], q['o'][0], q['mn'])) for q in vocab['hyouki']]
pools['bunmyaku'] = [dict(id=q['id'], pre=q['pre'], post=q['post'], o=q['o'], mn='«%s» — %s' % (q['o'][0], q['mn'])) for q in vocab['bunmyaku'] if q['id'] in OK_B]
pools['iikae'] = [dict(id=q['id'], s=q['s'], o=q['o'], mn=q['mn']) for q in g2.get('iikae', [])]
pools['form'] = [dict(id=q['id'], s=q['q'], o=q['o'], mn=q['mn'], g=q.get('g')) for q in g1.get('form', [])]
pools['order'] = [dict(id=q['id'], pre=q['pre'], parts=q['parts'], post=q['post'], star=q['star'], mn=q['mn'], full=q['full']) for q in g2.get('order', [])]
pools['text'] = g2.get('text', [])
for k in ('short', 'mid', 'info'):
    pools[k] = rd.get(k, [])
for k in ('task', 'point', 'speech', 'resp'):
    out = []
    for q in ls.get(k, []):
        q = dict(q)
        q['audio'] = '../audio/n5/%s.mp3' % q['id']
        if k in ('task', 'point'):
            q['script'] = '\n'.join(['%s: %s' % ({'M': 'おとこ', 'F': 'おんな'}.get(l['sp'], ''), l['t']) for l in q['lines']])
        elif k == 'resp':
            q['script'] = q['line']['t']
        if not os.path.exists(os.path.join(ROOT, 'audio', 'n5', q['id'] + '.mp3')):
            problems.append('%s: дуу алга (audio/n5/%s.mp3)' % (q['id'], q['id']))
        out.append(q)
    pools[k] = out

# ── Хасах (бие даасан шалгалт) ба шалгалт ──
for k in pools:
    pools[k] = [q for q in pools[k] if q['id'] not in DROP]
seen = set()
for k, items in pools.items():
    for q in items:
        if q['id'] in seen:
            problems.append('давхар id %s' % q['id'])
        seen.add(q['id'])
        where = '%s %s' % (k, q['id'])
        if k in ('kanji', 'hyouki', 'bunmyaku', 'iikae', 'form'):
            opts_ok(where, q['o'])
            jp_ok(where, q.get('pre'), q.get('post'), q.get('s'), *([] if k == 'hyouki' else q['o']))
            if k == 'form' and q['s'].count(u'（') != 1:
                problems.append('%s: хоосон зай （　） ганц байх ёстой' % where)
            if k == 'iikae' and not re.search(u'〔.+?〕', q['s']):
                problems.append('%s: 〔 〕 тэмдэглээ алга' % where)
        elif k == 'order':
            opts_ok(where, q['parts'])
            if not (0 <= q['star'] < 4):
                problems.append('%s: star буруу' % where)
            if re.sub(r'\s', '', q['pre'] + ''.join(q['parts']) + q['post']) != re.sub(r'\s', '', q['full']):
                problems.append('%s: pre+parts+post ≠ full' % where)
            jp_ok(where, q['full'])
        elif k == 'text':
            n = len(re.findall(u'［\\d］', q['text']))
            if n != len(q['qs']) or n == 0:
                problems.append('%s: хоосон зай %d, асуулт %d' % (where, n, len(q['qs'])))
            for i, s in enumerate(q['qs']):
                opts_ok('%s-%d' % (where, i + 1), s['o'])
                jp_ok(where, *s['o'])
            jp_ok(where, q['text'], q.get('title'))
        elif k in ('short', 'mid', 'info'):
            for i, s in enumerate(q['qs']):
                opts_ok('%s-%d' % (where, i + 1), s['o'])
                jp_ok(where, s['q'], *s['o'])
            jp_ok(where, q['text'])
            need = {'short': 1, 'mid': 2, 'info': 1}[k]
            if len(q['qs']) != need:
                problems.append('%s: асуулт %d биш %d' % (where, need, len(q['qs'])))
        else:
            opts_ok(where, q['o'], 3 if k in ('speech', 'resp') else 4)
        if not (q.get('mn') or all(s.get('mn') for s in q.get('qs', [{}]))):
            problems.append('%s: монгол тайлбар алга' % where)

grammar = [dict(id=p['id'], jp=p['jp'], mn=p['mn'], ex=p.get('ex', ''), exMn=p.get('exMn', '')) for p in g1.get('points', [])]
counts = {k: len(v) for k, v in pools.items()}
print('сан:', counts, '· дүрэм', len(grammar), '· хасагдсан', len(DROP))
if problems:
    for p in problems[:40]:
        print('  !', p)
    sys.exit('асуудал %d — build зогсов' % len(problems))
js = ('/* Автоматаар үүсгэв: tools/build_v2_n5data.py — гараар бүү засаарай. «Өөрийгөө сорих» (JLPT N5 хэлбэр).\n'
      '   Асуулт бүр өөрсдийнх; бүтэц ба оноо jlpt.jp. JMdict © EDRDG CC BY-SA 4.0; VOICEVOX:四国めたん, 玄野武宏, 春日部つむぎ. */\n'
      'window.KOTO_N5 = ' + json.dumps(dict(pools=pools, grammar=grammar), ensure_ascii=False, separators=(',', ':')) + ';\n')
io.open(os.path.join(ROOT, 'v2', 'n5data.js'), 'w', encoding='utf-8', newline='\n').write(js)
print('v2/n5data.js %d КБ' % (len(js.encode('utf-8')) // 1024))
