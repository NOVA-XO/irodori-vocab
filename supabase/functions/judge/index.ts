/* Ярианы хариултыг үнэлэх ПРОКСИ (Supabase Edge Function, Deno).
 *
 * ЯАГААД ПРОКСИ ВЭ: репо НЭЭЛТТЭЙ тул API түлхүүрийг браузерт тавьж
 * болохгүй — тэр даруй алдагдана. Түлхүүр зөвхөн ЭНД, Supabase-ийн нууц
 * хувьсагчид (`GROQ_API_KEY`, `GEMINI_API_KEY`) байна.
 *
 * ГЭРЭЭ: LLM нь МОНГОЛООР бичихгүй. Зөвхөн жижиг JSON буцаана —
 *     { "band": "ok|near|off", "missing": ["ください"], "better": "…" }
 * Монгол өгүүлбэрийг АПП өөрөө загвараас угсарна. Ингэснээр:
 *   · сул загварын эвгүй монгол хэл хэрэглэгчид хүрэхгүй,
 *   · хоёр өөр нийлүүлэгч ИЖИЛ гэрээ хангана,
 *   · хариуг тестлэх боломжтой (JSON-ыг шалгана, чөлөөт бичвэрийг биш).
 *
 * ГИНЖ: Groq → Gemini → 503. Аль нэг нь квот дүүрсэн (429), унасан (5xx),
 * эсвэл гэрээ зөрчсөн JSON буцаавал дараагийнх руу шилжинэ. Аппын тал
 * 503-ыг хүлээж авбал ЛОКАЛ үнэлгээгээрээ үлдэнэ — хичээл зогсохгүй.
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SYS = [
  "You grade a beginner's SPOKEN Japanese answer (JLPT N5 / Irodori 入門).",
  'The text comes from speech recognition: ignore punctuation and small mis-hearings.',
  'The transcript is usually ALL KANA. Kanji vs kana spelling NEVER matters:',
  '「ペンをかしてください」 and 「ペンを貸してください」 are the SAME answer.',
  'Never ask for a kanji in "missing".',
  '',
  'Choose ONE band:',
  '  "ok"   = meaning matches the model answer AND the target structure is used.',
  '  "near" = on topic and understandable, but a required word or ending is',
  '           missing or wrong (ください, です／ます, a particle, a counter).',
  '  "off"  = a different topic or meaning.',
  'Extra polite fillers (はい、ええ、そうですね) never make it worse.',
  '',
  'PERSONAL ANSWERS. When "Personal question: yes", the model answer is only',
  'a SAMPLE of one person. The learner answers about THEIR OWN life, so any',
  'age, time, name, place, date, number, food or hobby may differ and is',
  'still fully correct. Judge ONLY the grammar and the sentence pattern.',
  'NEVER put the sample answer\'s facts into "missing" or "better".',
  'model 「25さいです。」 heard 「よんさいです」',
  '  -> {"band":"ok","missing":[],"better":""}          (NOT "say 25")',
  'model 「ろくじにおきます。」 heard 「しちじにおきます」',
  '  -> {"band":"ok","missing":[],"better":""}',
  'model 「すしがすきです。」 heard 「ぶうずがすきです」',
  '  -> {"band":"ok","missing":[],"better":""}',
  'Only a BROKEN pattern is a problem: 「よんさい」 (no です) -> near.',
  '',
  'WRITE "better" IN KANA ONLY. The learner is a beginner and cannot read',
  'kanji yet. 「ペンをかしてください。」 is right; 「ペンを貸してください。」 is not.',
  '',
  'Examples:',
  'model 「ペンを貸してください。」 heard 「ペンをかして」',
  '  -> {"band":"near","missing":["ください"],"better":"ペンをかしてください。"}',
  'model 「六時に起きます。」 heard 「はい、ろくじにおきます」',
  '  -> {"band":"ok","missing":[],"better":""}',
  'model 「六時に起きます。」 heard 「すしがすきです」',
  '  -> {"band":"off","missing":[],"better":"ろくじにおきます。"}',
  '',
  'Reply with ONLY that JSON object. No explanation, no code fence.',
].join(String.fromCharCode(10));

function userMsg(b: Record<string, string>) {
  return [
    'Question: ' + (b.q || ''),
    'Model answer: ' + (b.model || ''),
    'Model answer in kana: ' + (b.modelKana || b.model || ''),
    'Target structure: ' + (b.key || '(none)'),
    'Personal question: ' + (String(b.free) === '1' ? 'yes' : 'no'),
    'Learner said: ' + (b.heard || ''),
  ].join('\n');
}

/** Гэрээг хангасан JSON мөн эсэх. Чөлөөт бичвэрийг ХҮЛЭЭЖ АВАХГҮЙ. */
function parse(text: string) {
  const m = (text || '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  let j: Record<string, unknown>;
  try { j = JSON.parse(m[0]); } catch { return null; }
  const band = j.band;
  if (band !== 'ok' && band !== 'near' && band !== 'off') return null;
  const miss = Array.isArray(j.missing)
    ? j.missing.filter((x: unknown) => typeof x === 'string').slice(0, 2) : [];
  let better = typeof j.better === 'string' ? j.better.slice(0, 80) : '';
  /* Загвар заримдаа ХАНЗААР бичдэг. Эхлэгч сурагч ханз уншиж чадахгүй
     тул ханзтай санал болголтыг ҮЗҮҮЛЭХГҮЙ — буруу зөвлөгөө өгөхөөс
     юу ч өгөхгүй нь дээр. Мөн «дутуу үг»-д ханз орохыг ч хориглоно. */
  if (/[\u3005\u4e00-\u9fff]/.test(better)) better = '';
  const missKana = miss.filter((x: string) => !/[\u3005\u4e00-\u9fff]/.test(x));
  return { band, missing: missKana, better };
}

async function callGroq(body: Record<string, string>, key: string) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({
      model: 'openai/gpt-oss-20b',
      temperature: 0,
      max_tokens: 500,
      reasoning_effort: 'low',
      messages: [{ role: 'system', content: SYS },
                 { role: 'user', content: userMsg(body) }],
    }),
  });
  if (!r.ok) throw new Error('groq ' + r.status + ' ' + (await r.text()).slice(0, 180));
  const d = await r.json();
  // Хариу нь content-д хоосон ирж, бүхэлдээ reasoning-д үлдэх тохиолдол бий.
  const msg = d.choices?.[0]?.message || {};
  const raw = msg.content || msg.reasoning || '';
  return { out: parse(raw), raw: raw };
}

async function callGemini(body: Record<string, string>, key: string,
                          model = 'gemini-flash-latest'): Promise<{ out: unknown; raw: string }> {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/'
    + model + ':generateContent?key=' + key;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYS }] },
      contents: [{ role: 'user', parts: [{ text: userMsg(body) }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 160,
                          responseMimeType: 'application/json' },
    }),
  });
  if (!r.ok) {
    const txt = (await r.text()).slice(0, 180);
    // 503 = загвар ачаалалтай. Хөнгөн загвараар НЭГ удаа дахин оролдоно.
    if (r.status === 503 && model !== 'gemini-flash-lite-latest') {
      return await callGemini(body, key, 'gemini-flash-lite-latest');
    }
    throw new Error('gemini ' + r.status + ' ' + txt);
  }
  const d = await r.json();
  const txt = d.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text)
    .join('') || '';
  return { out: parse(txt), raw: txt };
}

/* Урвуулан ашиглалтаас хамгаалах ХЯЗГААР.
 *
 * 🐞 САНАХ ОЙН ТООЛУУР АЖИЛЛАДАГГҮЙ. Өмнө нь энд `Map` байсан бөгөөд
 * «цагт 60 хүсэлт / IP» гэж бичигдсэн байв. ХЭМЖСЭН: нэг төхөөрөмжөөс
 * 150 хүсэлт явуулахад 429 НЭГ Ч гарсангүй — Deno Deploy хүсэлтүүдийг
 * олон изолят дээр тараадаг тул тоолуур тус бүрдээ шинээр эхэлдэг.
 * Хамгаалалт бүхэлдээ хуурмаг байжээ. Тиймээс тоолуур нь БОДИТООР
 * хуваалцсан газар — өгөгдлийн санд (`public.judge_gate`).
 *
 * ЯАГААД ТӨХӨӨРӨМЖӨӨР: нэг ангийн 200 сурагч нэг Wi-Fi-гаар холбогдвол
 * Supabase-т тэд БҮГД НЭГ IP мэт харагдана. IP-ээр тоолвол эхний хэдэн
 * сурагч квотыг дуусгаад үлдсэн нь зөвлөгөө авахаа болино.
 *
 * ТООЦОО (200 хэрэглэгчтэй):
 *   · Groq үнэгүй: 1000 хүсэлт/өдөр, ~12/минут (8000 токен/мин ÷ ~650).
 *   · Нэг сурагч 20 асуултын шалгалтад ~3-4 удаа л дуудна: локал
 *     үнэлгээ «зөв» гэвэл LLM рүү ОГТ явахгүй.
 *   · Өдөрт 200-гийн ~25% идэвхтэй гэвэл ~50 хүн × 4 = 200 хүсэлт —
 *     өдрийн квотын 20%.
 *   → 40/цаг нь хэвийн хэрэглээнээс 10 дахин өндөр тул хэнд ч саад
 *     болохгүй, гэхдээ нэг хүн өдрийн квотыг шатаахыг хорино.
 *
 * IP-ийн хаалт нь дээд тал: төхөөрөмжийн дугаарыг хуурамчаар үүсгэж
 * болно. 500/цаг нь 200 сурагчийн ангид хүрэлцээтэй. */
const CAP_DEV = 40;                    // төхөөрөмж тутамд цагт
const CAP_IP = 500;                    // IP тутамд цагт (нэг анги)

/** Буцаах: '' = чөлөөтэй · 'device' · 'ip'. Алдаа гарвал ЧӨЛӨӨТ
 *  (хичээл зогсохоос квот хэтрэх нь дээр). */
async function gate(dev: string, ip: string): Promise<string> {
  const url = Deno.env.get('SUPABASE_URL');
  const srv = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !srv) return '';
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 2500);
  try {
    const r = await fetch(url + '/rest/v1/rpc/judge_gate', {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json',
                 apikey: srv, Authorization: 'Bearer ' + srv },
      body: JSON.stringify({ p_dev: dev, p_ip: ip,
                             p_cap_dev: CAP_DEV, p_cap_ip: CAP_IP }),
    });
    if (!r.ok) return '';
    const v = await r.json();
    return typeof v === 'string' ? v : '';
  } catch { return ''; } finally { clearTimeout(t); }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const json = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o),
      { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'x';

  let body: Record<string, string>;
  try { body = await req.json(); } catch { return json({ error: 'bad body' }, 400); }
  /* Төхөөрөмжийн дугаар нь хэрэглэгчийн өгөгдөл тул ХЭМЖЭЭГ нь барина;
     байхгүй бол IP-д унана (хуучин хувилбарын апп ингэж ажиллана). */
  const dev = (typeof body.dev === 'string' ? body.dev : '')
    .replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
  const over = await gate(dev, ip);
  if (over) return json({ error: 'rate limited', scope: over }, 429);
  if (!body.heard || !body.model) return json({ error: 'need heard+model' }, 400);
  // Хэмжээний хязгаар: prompt injection ба квот шатаахаас хамгаална.
  delete body.dev;                     // LLM рүү ХЭЗЭЭ Ч явуулахгүй
  for (const k of ['q', 'model', 'modelKana', 'key', 'heard']) {
    if (typeof body[k] === 'string') body[k] = body[k].slice(0, 200);
  }
  // `free` нь зөвхөн 0/1 — өөр юу ч ирвэл 0 гэж үзнэ.
  body.free = String(body.free) === '1' ? '1' : '0';

  const dbg = new URL(req.url).searchParams.get('debug') === '1';
  const groq = Deno.env.get('GROQ_API_KEY');
  const gem = Deno.env.get('GEMINI_API_KEY');
  const tried: string[] = [];

  if (groq) {
    try {
      const g = await callGroq(body, groq);
      if (g.out) return json({ ...g.out, src: 'groq', raw: dbg ? g.raw : undefined, tried: dbg ? tried : undefined });
      tried.push('groq:shape ' + g.raw.slice(0, 120));
    } catch (e) { tried.push('groq:' + (e as Error).message); }
  }
  if (gem) {
    try {
      const g = await callGemini(body, gem);
      if (g.out) return json({ ...g.out, src: 'gemini', raw: dbg ? g.raw : undefined, tried: dbg ? tried : undefined });
      tried.push('gemini:shape ' + g.raw.slice(0, 120));
    } catch (e) { tried.push('gemini:' + (e as Error).message); }
  }
  // Хоёулаа бүтэлгүйтвэл апп ЛОКАЛ үнэлгээгээрээ үлдэнэ.
  return json({ error: 'no provider', tried }, 503);
});
