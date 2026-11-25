/* KOTO v2 — «Өөрийгөө сорих»: JLPT N5 хэлбэрийн шалгалт (2026-11-18).
 *
 * Бүтэц, дараалал, оноо нь албан ёсных (jlpt.jp/guideline/testsections.html, results.html); асуулт бүр өөрсдийнх
 * (v2/n5data.js — tools/build_v2_n5test.py). Албан ёсны асуултыг хуулаагүй (jlpt.jp/policy.html).
 * Асуултын тоо: албан ёсны 2018 оны жишиг шалгалтын (N5answer.pdf) тоо, тухайн үеийн цаг 25/50/30 мин — одоогийн
 * тоо нийтлэгдээгүй (2020-12-оос цаг 20/40 болсон). Оноо: албан ёсны тооцоо (тэнцүүлсэн оноо) биш, зөв хариултын
 * хувиар ОЙРОЛЦОО: «Хэлний мэдлэг · Уншлага» 0–120 (босго 38), «Сонсгол» 0–60 (19), нийт 180, тэнцэх 80.
 *
 * Хоёр горим: бүтэн шалгалт (хэсэг бүр цагтай, хариу шууд хэлэхгүй, төгсгөлд дүн ба тайлбар) ба хэсгээр дасгал
 * (10 асуулт, хариулах бүрд тайлбар). Асуулт бүр сангаас санамсаргүй, сонголтын дараалал ч санамсаргүй; саяхан
 * гарсан асуултыг хойш тавина (`koto-n5-seen`).
 * Түүх зөвхөн энэ хөтөч дээр (`koto-n5`), синк хийгдэхгүй, XP-д нөлөөлөхгүй.
 */
(function () {
  'use strict';
  const D = window.KOTO_N5;
  const KEY = 'koto-n5';
  const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = n => (window.KOTO && window.KOTO.icon ? window.KOTO.icon(n) : '');
  /* 〔…〕 = доогуур зураас; （　） = хоосон зай. Эхлээд escape, дараа нь тэмдгийг HTML болгоно. */
  const ja = t => esc(t).replace(/〔(.*?)〕/g, '<u>$1</u>').replace(/\n/g, '<br>');

  /* Хэсэг ба асуултын төрөл — албан ёсны дарааллаар. n = бүтэн шалгалтын тоо (2018 оны жишиг). */
  const PARTS = {
    kanji:    { sec: 0, n: 12, jp: '漢字読み', mn: 'Ханзны уншлага', ask: '＿＿の ことばは ひらがなで どう かきますか。', hint: 'Доогуур зурсан үгийн уншлагыг сонгоно уу.' },
    hyouki:   { sec: 0, n: 8, jp: '表記', mn: 'Бичлэг', ask: '＿＿の ことばは どう かきますか。', hint: 'Доогуур зурсан үг ханз эсвэл катаканаар хэрхэн бичигдэх вэ?' },
    bunmyaku: { sec: 0, n: 10, jp: '文脈規定', mn: 'Тохирох үг', ask: '（　）に なにを いれますか。', hint: 'Өгүүлбэрт тохирох үгийг сонгоно уу.' },
    iikae:    { sec: 0, n: 5, jp: '言い換え類義', mn: 'Ижил утга', ask: '＿＿の ぶんと だいたい おなじ いみの ぶんが あります。', hint: 'Доогуур зурсан хэсэгтэй ойролцоо утгатай өгүүлбэрийг сонгоно уу.' },
    form:     { sec: 1, n: 16, jp: '文の文法1', mn: 'Дүрмийн хэлбэр', ask: '（　）に 何を 入れますか。', hint: 'Хаалтанд тохирох хэлбэрийг сонгоно уу.' },
    order:    { sec: 1, n: 5, jp: '文の文法2', mn: 'Үгийн дараалал', ask: '★に 入る ものは どれですか。', hint: 'Зөв дараалуулахад ★-ийн оронд аль нь орох вэ?' },
    text:     { sec: 1, n: 4, jp: '文章の文法', mn: 'Эхийн дүрэм', ask: '［　］に 何を 入れますか。ぶんしょうの いみを かんがえて えらんで ください。', hint: 'Эхийн утгыг бодож хоосон зайд тохирохыг сонгоно уу.', set: true },
    short:    { sec: 1, n: 3, jp: '内容理解（短文）', mn: 'Богино эх', ask: 'ぶんしょうを 読んで、しつもんに こたえて ください。', hint: 'Эхийг уншаад асуултад хариулна уу.', set: true },
    mid:      { sec: 1, n: 2, jp: '内容理解（中文）', mn: 'Дунд эх', ask: 'ぶんしょうを 読んで、しつもんに こたえて ください。', hint: 'Эхийг уншаад асуултад хариулна уу.', set: true },
    info:     { sec: 1, n: 1, jp: '情報検索', mn: 'Мэдээлэл хайх', ask: 'みぎの ページを 見て、しつもんに こたえて ください。', hint: 'Зар, хуваариас хэрэгтэй мэдээллийг олно уу.', set: true },
    task:     { sec: 2, n: 7, jp: '課題理解', mn: 'Даалгаврыг ойлгох', ask: '話を 聞いて、ただしい こたえを えらんで ください。', hint: 'Яриаг сонсоод хүн юу хийхийг сонгоно уу.', audio: true },
    point:    { sec: 2, n: 6, jp: 'ポイント理解', mn: 'Гол санааг сонсох', ask: '話を 聞いて、ただしい こたえを えらんで ください。', hint: 'Асуусан зүйлд анхаарч сонсоно уу.', audio: true },
    speech:   { sec: 2, n: 5, jp: '発話表現', mn: 'Юу гэж хэлэх вэ', ask: 'ばめんを 読んで、しつもんを 聞いて ください。', hint: 'Нөхцөл байдалд юу гэж хэлэхийг сонгоно уу.', audio: true, spoken: true },
    resp:     { sec: 2, n: 6, jp: '即時応答', mn: 'Шууд хариулт', ask: 'ぶんを 聞いて、ただしい へんじを えらんで ください。', hint: 'Хэлсэн үгэнд тохирох хариултыг сонгоно уу.', audio: true, spoken: true },
  };
  const SECTIONS = [
    { jp: '言語知識（文字・語彙）', mn: 'Хэлний мэдлэг · Ханз, үгсийн сан', min: 25, parts: ['kanji', 'hyouki', 'bunmyaku', 'iikae'] },
    { jp: '言語知識（文法）・読解', mn: 'Хэлний мэдлэг · Дүрэм, уншлага', min: 50, parts: ['form', 'order', 'text', 'short', 'mid', 'info'] },
    { jp: '聴解', mn: 'Сонсгол', min: 30, parts: ['task', 'point', 'speech', 'resp'] },
  ];
  const PRACTICE_N = 10;

  const pool = k => (D && D.pools && D.pools[k]) || [];
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  /* Асуултын «бичлэг»: нэг асуулт = нэг сонголт. Эх (text/short/mid/info) нь доторх асуулт бүрээрээ задарна. */
  function questionsOf(k, item) {
    const base = { part: k, src: item };
    if (k === 'text') return item.qs.map((q, i) => Object.assign({}, base, { id: item.id + '-' + (i + 1), blank: i + 1, o: q.o, mn: q.mn }));
    if (PARTS[k].set) return item.qs.map((q, i) => Object.assign({}, base, { id: item.id + '-' + (i + 1), q: q.q, o: q.o, mn: q.mn }));
    if (k === 'order') return [Object.assign({}, base, { id: item.id, o: [item.parts[item.star]].concat(item.parts.filter((_, i) => i !== item.star)), mn: item.mn })];
    return [Object.assign({}, base, { id: item.id, o: item.o, mn: item.mn })];
  }
  /* Сонголтыг холино: эх өгөгдөлд зөв хариулт үргэлж эхэнд. */
  function prepare(q) {
    const order = shuffle(q.o.map((_, i) => i));
    return Object.assign(q, { opts: order.map(i => q.o[i]), ans: order.indexOf(0), pick: null });
  }
  /* Нэг үг өөр хичээлийн өөр өгүүлбэрээр давхар орсон (出します ×3) — нэг шалгалтад нэг л удаа.
     漢字読み (w = ханз) ба 表記 (o[0] = ханз) хооронд ч. */
  function wordKey(k, it) {
    if (k === 'kanji') return 'w:' + it.w;
    if (k === 'hyouki') return 'w:' + it.o[0];
    if (k === 'bunmyaku') return 'b:' + it.o[0];
    return null;
  }
  /* Саяхан гарсныг хойш тавина (11-19a): асуулт дэлгэцэнд гарах бүрд хугацааг нь тэмдэглэж (`koto-n5-seen`, энэ хөтөч),
     сугалахдаа хамгийн удаан хараагүйгээс эхэлнэ — огт хараагүй нь түрүүнд. Ижил хугацаатай нь санамсаргүй хэвээр
     (shuffle → тогтвортой sort). Үгтэй төрөлд (漢字読み/表記/文脈規定) id биш ҮГЭЭР — өөр өгүүлбэртэй ижил үг ч хойшилно. */
  const SEEN = 'koto-n5-seen';
  const seenKey = (k, it) => wordKey(k, it) || it.id;
  function seenMap() { try { const m = JSON.parse(localStorage.getItem(SEEN) || '{}'); return m && typeof m === 'object' && !Array.isArray(m) ? m : {}; } catch (e) { return {}; } }
  function markSeen(q) {
    if (q.seenAt) return;
    q.seenAt = Math.floor(Date.now() / 1000);
    const m = seenMap();
    m[seenKey(q.part, q.src)] = q.seenAt;
    try { localStorage.setItem(SEEN, JSON.stringify(m)); } catch (e) { /* хувийн цонх — санамсаргүй хэвээр */ }
  }
  /* n асуулт. Эхтэй хэсэгт эхийг БҮТНЭЭР нь авна — n-ээс хэтрэх эхийг алгасна (эхний эх л үл хамаарна). */
  function draw(k, n, seen) {
    const out = [], when = seenMap(), at = it => when[seenKey(k, it)] || 0;
    seen = seen || new Set();
    for (const item of shuffle(pool(k)).sort((a, b) => at(a) - at(b))) {
      const wk = wordKey(k, item);
      if (wk && seen.has(wk)) continue;
      const qs = questionsOf(k, item);
      if (PARTS[k].set && out.length && out.length + qs.length > n) continue;
      if (wk) seen.add(wk);
      out.push(...qs);
      if (out.length >= n) break;
    }
    return out.map(prepare);
  }

  /* ── Түүх (энэ хөтөч дээр) ── */
  function history() { try { const h = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(h) ? h : []; } catch (e) { return []; } }
  function remember(r) { try { localStorage.setItem(KEY, JSON.stringify([r].concat(history()).slice(0, 20))); } catch (e) { /* хувийн цонх */ } }

  /* ── Оноо: албан ёсны тэнцүүлсэн оноо биш, хувиар ── */
  function score(qs) {
    const by = s => qs.filter(q => (PARTS[q.part].sec === 2) === (s === 2));
    const pct = list => (list.length ? list.filter(q => q.pick === q.ans).length / list.length : 0);
    const lang = Math.round(pct(by(0)) * 120), listen = Math.round(pct(by(2)) * 60), total = lang + listen;
    return { lang, listen, total, pass: total >= 80 && lang >= 38 && listen >= 19 };
  }

  /* ── Төлөв ── */
  let run = null, timer = null, audio = null;
  const dlg = () => document.getElementById('n5-dialog');
  const box = () => document.getElementById('n5-content');

  function render(view) {
    if (!view) return;
    if (!D || !D.pools) { view.innerHTML = '<p class="page-subtitle">Шалгалтын өгөгдөл ачаалагдсангүй.</p>'; return; }
    const last = history()[0];
    const total = SECTIONS.reduce((s, x) => s + x.parts.reduce((t, k) => t + PARTS[k].n, 0), 0), minutes = SECTIONS.reduce((s, x) => s + x.min, 0);
    view.innerHTML = `<div class="eyebrow">JLPT N5</div><h1 class="page-title">Өөрийгөө сорих</h1>
      <p class="page-subtitle">N5 хэлбэрийн дасгал ба бүтэн шалгалт.<br>Албан ёсны шалгалтын асуулт биш.</p>
      <section class="n5-mock" aria-labelledby="n5-mock-title">
        <div class="n5-mock-body"><h2 id="n5-mock-title">Бүтэн шалгалт</h2>
          <p>${SECTIONS.map(s => `<span class="n5-sec"><span lang="ja">${esc(s.jp)}</span> · ${s.min} мин</span>`).join('')}</p>
          <p class="n5-mock-meta">${total} асуулт · ${minutes} минут · 180 оноо</p>
          ${last ? `<p class="n5-last">Сүүлд: <strong>${last.total}</strong> / 180 · ${last.pass ? 'Тэнцсэн' : 'Тэнцээгүй'} · ${esc(last.date)}</p>` : ''}
        </div>
        <button type="button" class="primary-btn" data-n5="mock">Эхлэх${icon('arrow')}</button>
      </section>
      ${SECTIONS.map((s, si) => `<section class="n5-group" aria-labelledby="n5-g${si}"><div class="section-heading"><h2 id="n5-g${si}">${esc(s.mn)}</h2><span class="meta" lang="ja">${esc(s.jp)}</span></div>
        <div class="n5-parts">${s.parts.map(k => {
          const n = pool(k).reduce((t, it) => t + questionsOf(k, it).length, 0);
          return `<button type="button" class="n5-part" data-n5="practice" data-part="${k}"${n ? '' : ' disabled'} aria-label="${esc(PARTS[k].mn)}. ${n} асуулт. Дасгал эхлүүлэх.">
            <span class="n5-part-mn">${esc(PARTS[k].mn)}</span><span class="n5-part-jp" lang="ja">${esc(PARTS[k].jp)}</span><span class="n5-part-n">${n} асуулт</span></button>`;
        }).join('')}</div></section>`).join('')}
      <p class="n5-credit">Бүтэц ба оноо: <a href="https://www.jlpt.jp/guideline/testsections.html" target="_blank" rel="noopener">jlpt.jp</a>. Албан ёсны жишиг асуулт: <a href="https://www.jlpt.jp/samples/forlearners.html" target="_blank" rel="noopener">問題例</a>. Сонсголын дуу: VOICEVOX.</p>`;
  }

  /* ── Эхлүүлэх ── */
  function startMock() {
    const qs = [], seen = new Set();
    SECTIONS.forEach((s, si) => s.parts.forEach(k => draw(k, PARTS[k].n, seen).forEach(q => { q.sec = si; qs.push(q); })));
    run = { mode: 'mock', qs, i: 0, sec: 0, ends: Date.now() + SECTIONS[0].min * 60000, done: false };
    open();
  }
  function startPractice(k) {
    if (!PARTS[k]) return;
    const qs = draw(k, PRACTICE_N);
    if (!qs.length) return;
    run = { mode: 'practice', part: k, qs, i: 0, done: false, checked: false };
    open();
  }
  function open() {
    stopAudio();
    if (!dlg().open) dlg().showModal();
    tick(); clearInterval(timer);
    if (run.mode === 'mock') timer = setInterval(tick, 1000);
    paint();
  }
  function close() {
    clearInterval(timer); timer = null; stopAudio(); run = null;
    if (dlg().open) dlg().close();
    if (window.KOTO && window.KOTO.refreshTest) window.KOTO.refreshTest();
  }

  /* ── Цаг: хэсэг бүр тусдаа; дуусахад дараагийн хэсэг рүү ── */
  function left() { return run && run.mode === 'mock' ? Math.max(0, run.ends - Date.now()) : 0; }
  function tick() {
    if (!run || run.mode !== 'mock' || run.done) return;
    const el = document.getElementById('n5-clock');
    if (el) { const s = Math.ceil(left() / 1000); el.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); el.classList.toggle('is-low', s <= 60); }
    if (left() <= 0) endSection();
  }
  function endSection() {
    stopAudio();
    if (run.sec >= SECTIONS.length - 1) { finish(); return; }
    run.sec++;
    run.i = run.qs.findIndex(q => q.sec === run.sec);
    run.ends = Date.now() + SECTIONS[run.sec].min * 60000;
    paint();
  }
  function finish() {
    clearInterval(timer); timer = null; stopAudio();
    run.done = true;
    if (run.mode === 'mock') {
      const r = score(run.qs);
      run.result = r;
      remember({ date: new Date().toISOString().slice(0, 10), total: r.total, lang: r.lang, listen: r.listen, pass: r.pass });
    }
    paint();
  }

  /* ── Сонсгол: нэг удаа (бүтэн шалгалт), дасгалд дахин сонсож болно ── */
  function stopAudio() { if (audio) { try { audio.pause(); } catch (e) { /* аль хэдийн зогссон */ } audio = null; } }
  function play(q) {
    stopAudio();
    const src = q.src && q.src.audio;
    if (!src) return;
    audio = new Audio(src);
    q.played = (q.played || 0) + 1;
    const b = document.querySelector('#n5-content [data-n5="play"]');
    if (b) { b.classList.add('is-playing'); b.setAttribute('aria-pressed', 'true'); if (run && run.mode === 'mock') b.disabled = true; }
    audio.addEventListener('ended', () => { if (b) { b.classList.remove('is-playing'); b.setAttribute('aria-pressed', 'false'); } if (run && run.mode === 'mock') paint(); });
    audio.play().catch(() => { if (b) b.classList.remove('is-playing'); });
  }

  /* ── Асуултын харагдац ── */
  function stem(q) {
    const it = q.src, k = q.part;
    if (k === 'kanji' || k === 'hyouki') return `<p class="n5-sentence" lang="ja">${esc(it.pre)}<u>${esc(it.w)}</u>${esc(it.post)}</p>`;
    if (k === 'bunmyaku') return `<p class="n5-sentence" lang="ja">${esc(it.pre)}<span class="n5-blank">（　　）</span>${esc(it.post)}</p>`;
    if (k === 'iikae' || k === 'form') return `<p class="n5-sentence" lang="ja">${ja(it.s).replace(/（\s*）|（　）/g, '<span class="n5-blank">（　　）</span>')}</p>`;
    if (k === 'order') {
      const slots = it.parts.map((_, i) => `<span class="n5-slot${i === it.star ? ' is-star' : ''}">${i === it.star ? '★' : ''}</span>`).join('');
      return `<p class="n5-sentence n5-order" lang="ja">${esc(it.pre)}<span class="n5-slots">${slots}</span>${esc(it.post)}</p>`;
    }
    if (k === 'text') {
      const t = esc(it.text).replace(/［(\d)］/g, (m, n) => `<span class="n5-gap${Number(n) === q.blank ? ' is-now' : ''}">${n}</span>`).replace(/\n/g, '<br>');
      return `${it.title ? `<h3 class="n5-title" lang="ja">${esc(it.title)}</h3>` : ''}<div class="n5-passage" lang="ja">${t}</div><p class="n5-q">［${q.blank}］</p>`;
    }
    if (PARTS[k].set) return `<p class="n5-q" lang="ja">${esc(q.q)}</p><div class="n5-passage${k === 'info' ? ' is-info' : ''}" lang="ja">${ja(it.text)}</div>`;
    if (PARTS[k].audio) {
      const mock = run.mode === 'mock', used = mock && q.played >= 1;
      return `${k === 'speech' ? `<p class="n5-scene"><span lang="ja">${esc(it.scene)}</span><small>${esc(it.sceneMn || '')}</small></p>` : ''}
        <button type="button" class="secondary-btn n5-play" data-n5="play" aria-pressed="false"${used ? ' disabled' : ''}>${icon('play')}${used ? 'Сонссон' : q.played ? 'Дахин сонсох' : 'Сонсох'}</button>
        ${mock ? '<p class="n5-note">Бүтэн шалгалтад нэг л удаа сонсоно.</p>' : ''}`;
    }
    return '';
  }
  function optLabel(q, i) { return PARTS[q.part].spoken && !(run.mode === 'practice' && run.checked) ? String(i + 1) : q.opts[i]; }
  function choices(q) {
    const show = run.mode === 'practice' && run.checked;
    return `<div class="choices n5-choices" role="group" aria-label="Хариултууд">${q.opts.map((o, i) => {
      let cls = q.pick === i ? ' selected' : '';
      if (show && i === q.ans) cls = ' correct'; else if (show && q.pick === i) cls = ' incorrect';
      return `<button type="button" class="choice${cls}" data-n5="pick" data-i="${i}" aria-pressed="${q.pick === i}"${show ? ' disabled' : ''} lang="ja"><span class="choice-index">${i + 1}</span><span>${esc(optLabel(q, i))}</span></button>`;
    }).join('')}</div>`;
  }
  function review(q) {
    const it = q.src, bits = [];
    if (q.mn) bits.push(`<p>${esc(q.mn)}</p>`);
    if (it.tr) bits.push(`<details class="n5-tr"><summary>Орчуулга</summary><p>${esc(it.tr).replace(/\n/g, '<br>')}</p></details>`);
    if (it.script) bits.push(`<details class="n5-tr"><summary>Яриа</summary><p lang="ja">${esc(it.script).replace(/\n/g, '<br>')}</p></details>`);
    if (PARTS[q.part].spoken) bits.push(`<p lang="ja">${q.opts.map((o, i) => `${i + 1}. ${esc(o)}`).join('<br>')}</p>`);
    return bits.join('');
  }
  function paint() {
    if (!run) return;
    if (run.done) { box().innerHTML = run.mode === 'mock' ? resultMock() : resultPractice(); return; }
    const q = run.qs[run.i], P = PARTS[q.part], mock = run.mode === 'mock';
    markSeen(q);
    const inSec = mock ? run.qs.filter(x => x.sec === run.sec) : run.qs, pos = inSec.indexOf(q) + 1;
    const last = mock ? run.i === run.qs.length - 1 || run.qs[run.i + 1].sec !== run.sec : run.i === run.qs.length - 1;
    const head = mock ? `${esc(SECTIONS[run.sec].mn)} · ${pos} / ${inSec.length}` : `${esc(P.mn)} · ${pos} / ${inSec.length}`;
    const fb = !mock && run.checked ? `<div class="feedback ${q.pick === q.ans ? '' : 'incorrect'}" role="status"><span class="feedback-icon">${icon(q.pick === q.ans ? 'check' : 'repeat')}</span><div><strong>${q.pick === q.ans ? 'Зөв байна!' : 'Буруу байна.'}</strong><small>Зөв: <span lang="ja">${esc(q.opts[q.ans])}</span></small></div></div><div class="n5-why">${review(q)}</div>` : '';
    const next = mock
      ? `${run.i > 0 && run.qs[run.i - 1].sec === run.sec ? '<button type="button" class="secondary-btn" data-n5="prev">Өмнөх</button>' : ''}<button type="button" class="primary-btn" data-n5="${last ? 'end-sec' : 'next'}">${last ? (run.sec === SECTIONS.length - 1 ? 'Шалгалтаа дуусгах' : 'Дараагийн хэсэг') : 'Дараах'}${icon('arrow')}</button>`
      : run.checked ? `<button type="button" class="primary-btn" data-n5="${last ? 'finish' : 'next'}">${last ? 'Дүгнэх' : 'Дараах'}${icon('arrow')}</button>` : `<button type="button" class="primary-btn" data-n5="check"${q.pick === null ? ' disabled' : ''}>Шалгах${icon('arrow')}</button>`;
    box().innerHTML = `<div class="lesson-frame n5-frame n5-question-frame"><div class="lesson-top"><button type="button" class="icon-button" data-n5="exit" aria-label="Шалгалтаас гарах">${icon('close')}</button>
        <div class="progress-track" aria-hidden="true"><div class="progress-fill" style="width:${Math.round(pos / inSec.length * 100)}%"></div></div>
        ${mock ? `<span class="n5-clock" id="n5-clock" role="timer" aria-label="Хэсгийн үлдсэн хугацаа">--:--</span>` : ''}</div>
      <p class="lesson-meta">${head}</p>
      <section class="exercise n5-exercise" aria-labelledby="n5-ask" tabindex="0">
        <div class="exercise-type"><span lang="ja">もんだい ${SECTIONS[P.sec].parts.indexOf(q.part) + 1} · ${esc(P.jp)}</span></div>
        <h1 id="n5-ask" tabindex="-1"><span lang="ja">${esc(P.ask)}</span></h1>
        <p class="n5-hint">${esc(P.hint)}</p>
        ${stem(q)}${choices(q)}${fb}
      </section>
      <div class="lesson-bottom">${next}</div></div>`;
    tick();
    const h = document.getElementById('n5-ask'); if (h) h.focus({ preventScroll: true });
  }
  function resultMock() {
    const r = run.result, rows = Object.keys(PARTS).map(k => { const l = run.qs.filter(q => q.part === k); return l.length ? `<tr><td><span>${esc(PARTS[k].mn)}</span><small lang="ja">${esc(PARTS[k].jp)}</small></td><td>${l.filter(q => q.pick === q.ans).length} / ${l.length}</td></tr>` : ''; }).join('');
    const wrong = run.qs.filter(q => q.pick !== q.ans);
    return `<div class="lesson-frame n5-frame"><div class="lesson-top"><button type="button" class="icon-button" data-n5="exit" aria-label="Хаах">${icon('close')}</button></div>
      <section class="n5-result" aria-labelledby="n5-res">
        <div class="eyebrow">БҮТЭН ШАЛГАЛТ · N5</div><h1 id="n5-res" tabindex="-1">${r.pass ? 'Тэнцсэн!' : 'Тэнцээгүй'}</h1>
        <p class="n5-total"><strong>${r.total}</strong><span>/ 180</span><small>Босго 80</small></p>
        <div class="result-stats">
          <div class="result-stat">
            <span class="n5-score-label">Хэлний мэдлэг · Уншлага</span>
            <div class="n5-score-value"><strong>${r.lang}</strong><span>/ 120</span></div>
            <small>Босго 38</small>
          </div>
          <div class="result-stat">
            <span class="n5-score-label">Сонсгол</span>
            <div class="n5-score-value"><strong>${r.listen}</strong><span>/ 60</span></div>
            <small>Босго 19</small>
          </div>
        </div>
        <p class="n5-note">Зөв хариултын хувиар тооцсон ойролцоо оноо.<br>Тэнцэхэд бүх босгыг хангана.</p>
        <div class="n5-actions"><button type="button" class="primary-btn" data-n5="mock">Дахин эхлэх${icon('repeat')}</button><button type="button" class="secondary-btn" data-n5="exit">Хаах</button></div>
        <details class="n5-breakdown">
          <summary>Асуултын төрөл</summary>
          <table class="n5-table"><thead><tr><th>Асуултын төрөл</th><th>Зөв</th></tr></thead><tbody>${rows}</tbody></table>
        </details>
        ${wrong.length ? `<details class="n5-review"><summary class="n5-sub">Алдсан ${wrong.length} асуулт</summary>${wrong.slice(0, 60).map(q => `<details class="n5-miss"><summary><span lang="ja">${esc(PARTS[q.part].jp)}</span> — <span lang="ja">${esc(q.opts[q.ans])}</span></summary>${stem(Object.assign({}, q))}<p lang="ja">Таны хариулт: ${q.pick === null ? '—' : esc(q.opts[q.pick])}</p>${review(q)}</details>`).join('')}</details>` : ''}
      </section></div>`;
  }
  function resultPractice() {
    const ok = run.qs.filter(q => q.pick === q.ans).length;
    return `<div class="lesson-frame n5-frame"><div class="lesson-top"><button type="button" class="icon-button" data-n5="exit" aria-label="Хаах">${icon('close')}</button></div>
      <section class="n5-result" aria-labelledby="n5-res"><div class="eyebrow">ДАСГАЛ · <span lang="ja">${esc(PARTS[run.part].jp)}</span></div>
        <h1 id="n5-res" tabindex="-1">${ok} / ${run.qs.length} зөв</h1>
        <div class="n5-actions"><button type="button" class="primary-btn" data-n5="practice" data-part="${run.part}">Дахиад 10${icon('repeat')}</button><button type="button" class="secondary-btn" data-n5="exit">Хаах</button></div>
      </section></div>`;
  }

  /* ── Үйлдэл ── */
  function act(a, el) {
    if (a === 'mock') { startMock(); return; }
    if (a === 'practice') { startPractice(el.dataset.part); return; }
    if (!run) return;
    const q = run.qs[run.i];
    if (a === 'exit') {
      if (run.mode === 'mock' && !run.done && !confirmExit()) return;
      close(); return;
    }
    if (a === 'pick' && !(run.mode === 'practice' && run.checked)) { q.pick = Number(el.dataset.i); paint(); return; }
    if (a === 'play') { if (!(run.mode === 'mock' && q.played >= 1)) play(q); return; }
    if (a === 'check' && q.pick !== null) { run.checked = true; paint(); return; }
    if (a === 'next') { stopAudio(); run.i++; run.checked = false; paint(); return; }
    if (a === 'prev') { stopAudio(); run.i--; paint(); return; }
    if (a === 'end-sec') { endSection(); return; }
    if (a === 'finish') { finish(); }
  }
  /* Шалгалтын дундаас гарахыг баталгаажуулна (Escape ч). Хариулт хадгалагдахгүй. */
  function confirmExit() {
    if (run.askExit) return true;
    run.askExit = true;
    const b = box().querySelector('[data-n5="exit"]');
    if (b) { b.setAttribute('aria-label', 'Дахин дарвал шалгалт цуцлагдана'); b.classList.add('is-warn'); }
    window.KOTO && window.KOTO.toast && window.KOTO.toast('Дахин дарвал шалгалт цуцлагдана — хариулт хадгалагдахгүй.');
    setTimeout(() => { if (run) run.askExit = false; }, 4000);
    return false;
  }

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-n5]');
    if (!el || el.disabled) return;
    act(el.dataset.n5, el);
  });
  document.addEventListener('keydown', e => {
    if (!run || !dlg() || !dlg().open || run.done) return;
    if (/^[1-4]$/.test(e.key) && Number(e.key) <= run.qs[run.i].opts.length && !(run.mode === 'practice' && run.checked)) { run.qs[run.i].pick = Number(e.key) - 1; paint(); }
  });
  document.addEventListener('DOMContentLoaded', () => {
    const d = dlg();
    if (d) d.addEventListener('cancel', e => { e.preventDefault(); act('exit', d); });
    /* #test-ээр шууд нээгдвэл app.js энэ файлаас ӨМНӨ хуудсаа зурсан байна. */
    const v = document.getElementById('view-test');
    if (v && !v.hidden) render(v);
  });

  window.KOTO_N5UI = {
    render, startMock, startPractice, score, draw, parts: PARTS, sections: SECTIONS, state: () => run, seen: seenMap,
    /* Тестэд: цагийг урагшлуулах (хэсгийн хугацаа дуусгах). */
    expire: () => { if (run && run.mode === 'mock') { run.ends = Date.now() - 1; tick(); } },
  };
})();
