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
  'You grade a beginner (JLPT N5 / Irodori 入門) learner\'s SPOKEN answer in Japanese.',
  'The transcript comes from speech recognition, so small mis-hearings are normal.',
  'Judge MEANING and whether the target structure was used. Be generous about',
  'politeness fillers, particles dropped in speech, and word order.',
  'Return ONLY compact JSON, no prose, no code fence:',
  '{"band":"ok|near|off","missing":[],"better":""}',
  '  band: ok = says the same thing correctly; near = understandable but',
  '        a required word/structure is missing or wrong; off = different answer.',
  '  missing: up to 2 Japanese words/structures the learner should add (may be []).',
  '  better: ONE short corrected Japanese sentence (or "" if band is ok).',
].join(' ');

function userMsg(b: Record<string, string>) {
  return [
    'Question: ' + (b.q || ''),
    'Model answer: ' + (b.model || ''),
    'Target structure: ' + (b.key || '(none)'),
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
  const better = typeof j.better === 'string' ? j.better.slice(0, 80) : '';
  return { band, missing: miss, better };
}

async function callGroq(body: Record<string, string>, key: string) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({
      model: 'openai/gpt-oss-20b',
      temperature: 0,
      max_tokens: 160,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: SYS },
                 { role: 'user', content: userMsg(body) }],
    }),
  });
  if (!r.ok) throw new Error('groq ' + r.status);
  const d = await r.json();
  return parse(d.choices?.[0]?.message?.content || '');
}

async function callGemini(body: Record<string, string>, key: string) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/'
    + 'gemini-flash-lite-latest:generateContent?key=' + key;
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
  if (!r.ok) throw new Error('gemini ' + r.status);
  const d = await r.json();
  const txt = d.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text)
    .join('') || '';
  return parse(txt);
}

/* Урвуулан ашиглалтаас хамгаалах ХЯЗГААР. anon түлхүүр нь публик тул
   хэн ч энэ хаяг руу хандаж чадна — хязгааргүй бол нэг хүн ангийн
   өдрийн квотыг шатааж чадна. Санах ойд хадгалдаг тул инстанс дахин
   эхлэхэд тэглэгдэнэ (тохирсон буулт: жинхэнэ хамгаалалт биш, харин
   санамсаргүй ба энгийн урвуулалтыг зогсооно). */
const HITS = new Map<string, { n: number; t: number }>();
const CAP = 60, WIN = 3600e3;          // цагт 60 хүсэлт / IP

function overCap(ip: string) {
  const now = Date.now();
  const r = HITS.get(ip);
  if (!r || now - r.t > WIN) { HITS.set(ip, { n: 1, t: now }); return false; }
  r.n++;
  if (HITS.size > 5000) HITS.clear();   // санах ой хамгаалалт
  return r.n > CAP;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const json = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o),
      { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'x';
  if (overCap(ip)) return json({ error: 'rate limited' }, 429);

  let body: Record<string, string>;
  try { body = await req.json(); } catch { return json({ error: 'bad body' }, 400); }
  if (!body.heard || !body.model) return json({ error: 'need heard+model' }, 400);
  // Хэмжээний хязгаар: prompt injection ба квот шатаахаас хамгаална.
  for (const k of ['q', 'model', 'key', 'heard']) {
    if (typeof body[k] === 'string') body[k] = body[k].slice(0, 200);
  }

  const groq = Deno.env.get('GROQ_API_KEY');
  const gem = Deno.env.get('GEMINI_API_KEY');
  const tried: string[] = [];

  if (groq) {
    try {
      const out = await callGroq(body, groq);
      if (out) return json({ ...out, src: 'groq' });
      tried.push('groq:shape');
    } catch (e) { tried.push('groq:' + (e as Error).message); }
  }
  if (gem) {
    try {
      const out = await callGemini(body, gem);
      if (out) return json({ ...out, src: 'gemini' });
      tried.push('gemini:shape');
    } catch (e) { tried.push('gemini:' + (e as Error).message); }
  }
  // Хоёулаа бүтэлгүйтвэл апп ЛОКАЛ үнэлгээгээрээ үлдэнэ.
  return json({ error: 'no provider', tried }, 503);
});
