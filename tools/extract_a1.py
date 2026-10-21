# -*- coding: utf-8 -*-
"""IRODORI A1/N5 «ярих сэдэв» .docx -> tools/a1_raw.json

Эх файл: IRODORI_A1_N5_yarih_sedev_hariulttai.docx (Downloads).
ЯАГААД задалсныг репод хадгалдаг вэ: 入門-ий «Шинэ үгийн жагсаалт» PDF
Downloads-аас устсаны дараа `extract_vocab.py` дахин ажиллуулах боломжгүй
болсон. Тиймээс эх файлаас ГАРГАСАН өгөгдлийг репод тавина — дараа нь
`build_exam.py` зөвхөн үүнээс уншина, .docx хэрэггүй.

Документын бүтэц (4 хүснэгт):
    1. Гол үгс              № | Япон(кана) | Монгол
    2. Гол өгүүлбэрүүд      № | Япон       | Монгол
    3. Гол асуултууд        № | Асуулт     | (хоосон)
    4. Жишээ хариулт        № | Асуулт     | Жишээ хариулт | Монгол
  + Ярих сэдвүүд (хүснэгт)  ба түүний жишээ (догол мөр)

Бүх япон текст КАНА — документ нь зориуд кандзигүй (N5 түвшин).

Ажиллуулах:
    python tools/extract_a1.py "<docx-ийн зам>"
"""
import io, json, os, re, sys
import zipfile
import xml.etree.ElementTree as ET

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
HERE = os.path.dirname(os.path.abspath(__file__))

# Канад л байх ёстой — ханз тааралдвал документ өөрчлөгдсөн гэсэн үг.
KANJI = re.compile(u'[㐀-鿿]')


def _txt(el):
    return ''.join(t.text or '' for t in el.iter(W + 't'))


def blocks(path):
    """(төрөл, агуулга) дараалал. Төрөл: 'h1' 'h2' 'p' 'tbl'."""
    root = ET.fromstring(zipfile.ZipFile(path).read('word/document.xml'))
    for el in root.find(W + 'body'):
        tag = el.tag.replace(W, '')
        if tag == 'p':
            sty = el.find(W + 'pPr/' + W + 'pStyle')
            s = (sty.get(W + 'val') if sty is not None else '') or ''
            t = _txt(el).strip()
            if t:
                yield ('h1' if s == 'Heading1' else
                       'h2' if s == 'Heading2' else 'p', t)
        elif tag == 'tbl':
            rows = []
            for tr in el.findall(W + 'tr'):
                rows.append([_txt(tc).strip() for tc in tr.findall(W + 'tc')])
            yield ('tbl', rows)


def numbered(rows, ncol):
    """Толгой мөрийг хасаад дугаарласан мөрүүдийг авна."""
    out = []
    for r in rows:
        if len(r) >= ncol and r[0].strip().isdigit():
            out.append([c.strip() for c in r[:ncol]])
    return out


def main(src):
    secs = {}          # h2 нэр -> хүснэгт
    topics_ex = []     # ярих сэдвийн жишээ: (сэдэв, япон, монгол)
    cur = None
    pend = []
    for kind, data in blocks(src):
        if kind in ('h1', 'h2'):
            # Өмнөх «ярих сэдвийн жишээ» догол мөрүүдийг хаана
            if cur == u'Ярих сэдвийн жишээ' and pend:
                topics_ex += _pack(pend)
                pend = []
            cur = data
        elif kind == 'tbl' and cur:
            secs.setdefault(cur, data)
        elif kind == 'p' and cur == u'Ярих сэдвийн жишээ':
            pend.append(data)
    if pend:
        topics_ex += _pack(pend)

    words = numbered(secs.get(u'Гол үгс', []), 3)
    sents = numbered(secs.get(u'Гол өгүүлбэрүүд', []), 3)
    qa = numbered(secs.get(u'Гол асуултуудын жишээ хариулт', []), 4)
    topics = [r[1].strip() for r in numbered(secs.get(u'Ярих сэдвүүд', []), 2)]

    errs = []
    if not (80 <= len(words) <= 120):
        errs.append('words=%d (80..120 хүлээсэн)' % len(words))
    if not (30 <= len(sents) <= 60):
        errs.append('sents=%d (30..60)' % len(sents))
    if not (50 <= len(qa) <= 80):
        errs.append('qa=%d (50..80)' % len(qa))
    if len(topics) != len(topics_ex):
        errs.append('сэдэв %d vs жишээ %d — таарахгүй'
                    % (len(topics), len(topics_ex)))
    # Асуулт/хариулт дотор ханз байвал документ сольсон гэсэн үг.
    for i, (_, q, a, _m) in enumerate(qa):
        if KANJI.search(q) or KANJI.search(a):
            errs.append('qa[%d]-д ХАНЗ: %s / %s' % (i, q, a))
    if errs:
        log = os.path.join(HERE, '_a1_extract_errors.txt')
        io.open(log, 'w', encoding='utf-8', newline='').write('\n'.join(errs) + '\n')
        sys.stderr.write('EXTRACT FAILED: %d errors -> %s\n' % (len(errs), log))
        raise SystemExit(1)

    doc = {
        'source': os.path.basename(src),
        'note': ('IRODORI A1 (N5) ярих сэдэв. Бүх япон текст КАНА — '
                 'документ нь зориуд кандзигүй.'),
        'words': [{'jp': w[1], 'mn': w[2]} for w in words],
        'sentences': [{'jp': s[1], 'mn': s[2]} for s in sents],
        'qa': [{'q': r[1], 'a': r[2], 'mn': r[3]} for r in qa],
        'topics': [{'topic': t, 'jp': e[1], 'mn': e[2]}
                   for t, e in zip(topics, topics_ex)],
    }
    dst = os.path.join(HERE, 'a1_raw.json')
    io.open(dst, 'w', encoding='utf-8', newline='').write(
        json.dumps(doc, ensure_ascii=False, indent=1) + '\n')
    print('OK  a1_raw.json  words=%d sentences=%d qa=%d topics=%d'
          % (len(words), len(sents), len(qa), len(doc['topics'])))


def _pack(lines):
    """«1. 食べ物 / <япон> / <монгол>» гурвалсан блокуудыг цуглуулна."""
    out = []
    i = 0
    while i < len(lines):
        m = re.match(r'^(\d+)[\.。]\s*(.+)$', lines[i])
        if m and i + 2 < len(lines):
            out.append((m.group(2).strip(), lines[i + 1].strip(), lines[i + 2].strip()))
            i += 3
        else:
            i += 1
    return out


if __name__ == '__main__':
    if len(sys.argv) < 2:
        raise SystemExit('хэрэглээ: python tools/extract_a1.py "<docx>"')
    main(sys.argv[1])
