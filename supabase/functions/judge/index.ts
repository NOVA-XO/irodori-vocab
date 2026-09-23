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
  for (const k of ['q', 'model', 'modelKana', 'key', 'heard']) {
    if (typeof body[k] === 'string') body[k] = body[k].slice(0, 200);
  }

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
