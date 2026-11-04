'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const DATA = window.KOTO_DATA;
  const TOPICS = [
    ['Асуултын үгс','？','Асуултаа ойлгож эхэлье'],['Өөрийгөө танилцуулах','わ','Өөрийн тухай ярьж суръя'],
    ['Хэл ба суралцах','あ','Суралцах тухай ярья'],['Хоол ба уух зүйл','ご','Дуртай хоолоо хэлээрэй'],
    ['Гэр ба эд зүйлс','う','Гэртээ байгаа зүйлсээ нэрлэе'],['Байршил ба шинж','に','Хаана, ямар байгааг хэлээрэй'],
    ['Цаг ба давтамж','じ','Өдрийнхөө тухай ярья'],['Үйл хөдлөл','し','Хийдэг зүйлсээ хэлээрэй'],
    ['Хобби ба сэтгэгдэл','す','Юунд дуртайгаа ярья'],['Унаа ба аялал','い','Хаашаа, яаж явахаа хэлээрэй'],
    ['Худалдан авалт','か','Дэлгүүрт ярьж суръя'],['Улирал ба цаг агаар','ゆ','Цаг агаарын тухай ярья'],
    ['Сургууль ба ажил','が','Хичээл, ажлаа танилцуулъя'],['Мэндчилгээ','こ','Эелдэг харилцаж суръя'],
    ['Өгүүлбэрийн хэлбэр','は','Үгсээ өгүүлбэр болгоё'],['Тоо ба тоон хариулт','に','Нас, цаг, үнээ хэлээрэй'],
    ['Тоо, цаг, хуанли','ひ','Өдөр, долоо хоног, огноогоо хэлээрэй']
  ];
  // Topic symbols are decorative. All study content is written in kana.
  /* Хичээл бүрийн өгүүлбэр (v2/sentences.js) — түлхүүр нь хичээлийн id. */
  const SENTENCES = window.KOTO_SENTENCES || {};
  const ICONS={
    path:'<path d="M7 19h9a4 4 0 0 0 0-8H8a4 4 0 0 1 0-8h9"/><circle cx="6" cy="19" r="2"/><path d="m15 1 3 2-3 2"/>',
    book:'<path d="M12 5v15M3 4c4-1 6-1 9 1 3-2 5-2 9-1v15c-4-1-6-1-9 1-3-2-5-2-9-1Z"/>',
    repeat:'<path d="M20 7a8 8 0 0 0-14-2L3 8m0-5v5h5M4 17a8 8 0 0 0 14 2l3-3m0 5v-5h-5"/>',
    flame:'<path d="M13 2c2 5-3 5-1 9 2-1 3-3 3-4 6 5 6 10 2 14-2 1-8 2-11-2C1 12 8 8 8 5c1 2 2 3 2 4 3-2 1-4 3-7Z"/>',
    spark:'<path d="m12 2 2.7 6.7L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-3.3Z"/>',
    arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    play:'<path d="m9 5 10 7-10 7Z"/>',
    star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
    flag:'<path d="M5 21V3m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    sound:'<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>',
    mute:'<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 6 6m0-6-6 6"/>',
    search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
    target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    leaf:'<path d="M20 3C7 1 1 10 7 17s15-1 13-14ZM6 20 17 7"/>',
    tiles:'<rect x="3" y="4" width="8" height="7" rx="2"/><rect x="13" y="4" width="8" height="7" rx="2"/><rect x="7" y="14" width="10" height="7" rx="2"/>',
    trophy:'<path d="M8 3h8v7a4 4 0 0 1-8 0ZM8 5H4v3c0 3 2 5 5 5m7-8h4v3c0 3-2 5-5 5m-3 1v6m-4 1h8"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    game:'<rect x="2" y="7" width="20" height="11" rx="5.5"/><path d="M7 10.5v4M5 12.5h4M15.5 11.5h.01M18 13.5h.01"/>',
    heart:'<path d="M12 20s-7.5-4.6-9.3-9.2C1.6 7.6 3.7 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.3 0 5.4 3.1 4.3 6.3C19.5 15.4 12 20 12 20Z"/>',
    kanji:'<path d="M5 7h14M12 3v18M7 11h10M6 15h12M9 19h6"/>'
  };
  function icon(name){return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]||ICONS.star}</svg>`;}
  function esc(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function mascot(){return `<svg viewBox="0 0 210 205" fill="none" aria-hidden="true"><ellipse cx="110" cy="185" rx="62" ry="10" fill="#d7e5c4"/><path d="M69 87c-5-23 4-56 25-56 13-17 50-6 56 17 21 13 29 35 24 58 15 26 11 52-10 62-23 15-89 12-106-6-22-20-12-49 11-75Z" fill="#b4e962" stroke="#9dce50" stroke-width="2"/><path d="M85 29c-13-15-2-25 5-20 6 4 3 13 6 17m2-2c4-18 21-19 21-10 0 7-15 12-18 15" fill="#6e9b42"/><ellipse cx="84" cy="100" rx="8" ry="12" fill="#2e4a31"/><ellipse cx="137" cy="100" rx="8" ry="12" fill="#2e4a31"/><circle cx="87" cy="96" r="2.4" fill="white"/><circle cx="140" cy="96" r="2.4" fill="white"/><path d="M103 118q8 9 15-1" stroke="#365334" stroke-width="3" stroke-linecap="round"/><ellipse cx="72" cy="119" rx="10" ry="6" fill="#efb58a" opacity=".7"/><ellipse cx="150" cy="119" rx="10" ry="6" fill="#efb58a" opacity=".7"/><path d="m66 151 27 5 1 31-27-5Z" fill="#fffdf7" stroke="#7e9d58" stroke-width="2"/><path d="m94 156 26-7-1 31-25 7Z" fill="#eaf2d6" stroke="#7e9d58" stroke-width="2"/><path d="m73 161 13 2m-13 7 13 2m15-9 12-3m-12 11 12-4" stroke="#b4c395" stroke-width="2" stroke-linecap="round"/><path d="M62 142q-20-13-13-24m115 25q20-4 24-23" stroke="#9bc650" stroke-width="10" stroke-linecap="round"/><path d="m23 69 4-6 4 6m150-13 3-6 4 6M32 151l5 4-5 4" stroke="#a6bd7d" stroke-width="2" stroke-linecap="round"/></svg>`;}
  const allWords=DATA.flatMap((topic,t)=>topic.words.map((word,w)=>({...word,id:`${t}:${w}`,topic:t,index:w})));
  const wordById=Object.fromEntries(allWords.map(w=>[w.id,w]));
  const lessons=DATA.flatMap((topic,t)=>Array.from({length:Math.ceil(topic.words.length/5)},(_,chunk)=>({id:`${t}-${chunk}`,topic:t,chunk,words:allWords.filter(w=>w.topic===t).slice(chunk*5,chunk*5+5)})));
  const lessonById=Object.fromEntries(lessons.map(l=>[l.id,l]));
  // Үгийн тоо сэдэв нэмэгдэхэд HTML-д хатуу бичсэнээс зөрөхгүй.
  document.querySelectorAll('.nav-count').forEach(el=>{el.textContent=allWords.length;});
  const STORAGE_KEY='koto-irodori-v1';
  function emptyState(){return {version:1,xp:0,completed:[],words:{},kana:{},days:{},xpd:{},selectedTopic:0};}
  let storageWorks=true;
  function readState(){try{const s=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(!s||s.version!==1)return emptyState();return {version:1,xp:Math.max(0,Number(s.xp)||0),completed:Array.isArray(s.completed)?s.completed.filter(id=>lessonById[id]):[],words:s.words&&typeof s.words==='object'&&!Array.isArray(s.words)?s.words:{},days:s.days&&typeof s.days==='object'&&!Array.isArray(s.days)?s.days:{},kana:s.kana&&typeof s.kana==='object'&&!Array.isArray(s.kana)?s.kana:{},xpd:s.xpd&&typeof s.xpd==='object'&&!Array.isArray(s.xpd)?s.xpd:{},selectedTopic:Number.isInteger(s.selectedTopic)&&DATA[s.selectedTopic]?s.selectedTopic:0};}catch{return emptyState();}}
  let state=readState();
  let view='learn', session=null, toastTimer=null;
  function today(){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ulaanbaatar',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(t=>p.find(x=>x.type===t).value).join('-');}
  function shiftDate(day,n){const date=new Date(day+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+n);return date.toISOString().slice(0,10);}
  function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch{storageWorks=false;toast('Энэ хөтөч дээр ахиц хадгалагдсангүй.');}syncSoon();}

  /* ═══════════════ АХИЦЫН СИНК — төхөөрөмж хооронд ═══════════════
   *
   * `localStorage` нь ЗӨВХӨН тэр хөтөч дээр үлддэг: утас ↔ компьютер
   * хооронд ахиц дамжихгүй, сайтын өгөгдлийг арилгавал XP арилна.
   * Тиймээс нэг НУУЦ КОДоор Supabase-д нийлүүлнэ.
   *
   * Код нь v1-ийнхтэй ИЖИЛ байж болно — хоёр апп өөр хүснэгтэд
   * (`progress` ба `koto`) бичдэг тул хольцолдохгүй, хэрэглэгч нэг л
   * код санана.
   *
   * Уусгалт нь СЕРВЕР дээр ч хийгддэг (`koto_put`) — хоёр төхөөрөмж
   * зэрэг түлхэхэд сүүлийнх нь эхнийхийг дарж бичихгүй. Доорх
   * `kotoMerge()` нь тэр SQL-тэй ИЖИЛ дүрэмтэй: хоёр нь салж явбал
   * нэг тал нь алдагдана.
   */
  const SYNC_KEY = 'koto-sync-code';
  const SYNC = window.SYNC_CONFIG || {};
  const syncOn = () => !!(SYNC.url && SYNC.key);
  let syncCode = '';
  try { syncCode = localStorage.getItem(SYNC_KEY) || ''; } catch { syncCode = ''; }
  let pushTimer = null, syncBusy = false;

  /* ── Google-ээр нэвтрэх (Supabase Auth, PKCE) ────────────────────
   *
   * ЯАГААД PKCE, implicit БИШ ВЭ: implicit flow нь токеныг
   * `#access_token=…` гэж HASH-аар буцаана. Энэ апп нь hash-ийг
   * РОУТЕРТ хэрэглэдэг (`location.hash = view`) тул буцаж ирмэгц
   * `switchView()` түүнийг дарж бичиж, токен АЛГА болох байв. PKCE нь
   * `?code=…` гэж query-гээр ирдэг — роутер хөндөхгүй.
   *
   * ЯАГААД SDK БИШ ВЭ: supabase-js нь ~40 КБ бөгөөд CDN хамаарал
   * нэмнэ. Энэ апп bundler, npm багцгүй байх зарчимтай (v1-тэй ижил),
   * мөн офлайн ажиллах ёстой. Auth API нь REST тул хэрэгтэй 4 дуудлагыг
   * шууд бичих нь хамаарал нэмэхээс цэвэр.
   */
  const AUTH_KEY = 'koto-auth';
  const PKCE_KEY = 'koto-pkce';
  const AUTH_BASE = () => SYNC.url.replace(/\/+$/, '') + '/auth/v1';
  let auth = null;
  try { auth = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch { auth = null; }
  const signedIn = () => !!(auth && auth.refresh_token);
  const authUser = () => (auth && auth.user) || null;

  function authSave(a) {
    auth = a;
    try {
      if (a) localStorage.setItem(AUTH_KEY, JSON.stringify(a));
      else localStorage.removeItem(AUTH_KEY);
    } catch {}
  }

  const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  async function pkcePair() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    // Verifier нь [A-Za-z0-9-._~] мужид байх ёстой (RFC 7636) — base64url
    // нь тэр мужид багтана.
    const verifier = b64url(bytes);
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return { verifier: verifier, challenge: b64url(hash) };
  }

  /** Google руу үсэрнэ. Буцаж ирэхэд `authFinish()` үргэлжлүүлнэ. */
  async function googleIn() {
    if (!syncOn()) { toast('Синк тохируулагдаагүй.'); return; }
    try {
      const p = await pkcePair();
      // Verifier нь ЭНЭ хөтөч дээр үлдэнэ — сервер түүнийг хэзээ ч
      // харахгүй. Үүний ачаар хулгайлсан `?code=` нь дангаараа хүчингүй.
      localStorage.setItem(PKCE_KEY, p.verifier);
      const back = location.origin + location.pathname;
      location.href = AUTH_BASE() + '/authorize?provider=google'
        + '&redirect_to=' + encodeURIComponent(back)
        + '&code_challenge=' + encodeURIComponent(p.challenge)
        + '&code_challenge_method=s256';
    } catch (e) { toast('Нэвтрэлт эхлүүлж чадсангүй.'); }
  }

  /** Google-ээс буцаж ирэхэд `?code=`-ийг токен болгон солино. */
  async function authFinish() {
    const q = new URLSearchParams(location.search);
    const code = q.get('code');
    const err = q.get('error') || q.get('error_description');
    if (!code && !err) return false;
    // URL-ийг ШУУД цэвэрлэнэ: хэрэглэгч хуудсыг дахин ачаалбал нэг
    // удаагийн код хоёр дахь удаа илгээгдэж, алдаа гарах байв.
    const verifier = (() => { try { return localStorage.getItem(PKCE_KEY) || ''; } catch { return ''; } })();
    try { localStorage.removeItem(PKCE_KEY); } catch {}
    history.replaceState(null, '', location.origin + location.pathname + location.hash);
    if (err) { toast('Нэвтрэлт цуцлагдлаа.'); return false; }
    if (!verifier) { toast('Нэвтрэлт тасарлаа. Дахин оролдоно уу.'); return false; }
    try {
      const r = await fetch(AUTH_BASE() + '/token?grant_type=pkce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SYNC.key },
        body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      authSave(authShape(await r.json()));
      return true;
    } catch (e) { toast('Нэвтэрч чадсангүй. Дахин оролдоно уу.'); return false; }
  }

  /** Серверийн хариунаас ЗӨВХӨН хэрэгтэйг авна — бусдыг хадгалахгүй. */
  function authShape(j) {
    const u = (j && j.user) || {};
    const md = u.user_metadata || {};
    return {
      access_token: j.access_token, refresh_token: j.refresh_token,
      // `expires_at` нь секунд. Сервер буцаахгүй бол `expires_in`-ээс гаргана.
      expires_at: j.expires_at || (Math.floor(Date.now() / 1000) + (j.expires_in || 3600)),
      user: { email: u.email || md.email || '', name: md.full_name || md.name || '',
              avatar: md.avatar_url || md.picture || '' },
    };
  }

  // 400/401/403 нь «токен хүчингүй»; бусад (сүлжээ, 5xx) нь түр зуурын.
  const authInvalid = e => /HTTP 40[013]/.test(String(e && e.message));

  /** Хүчинтэй access token. Дуусах дөхвөл СЭРГЭЭНЭ. */
  async function authToken() {
    if (!signedIn()) return '';
    // 60 секундын зай: дуудалт явж байх хооронд дуусахаас сэргийлнэ.
    if (auth.access_token && (auth.expires_at || 0) - 60 > Date.now() / 1000)
      return auth.access_token;
    try {
      const r = await fetch(AUTH_BASE() + '/token?grant_type=refresh_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SYNC.key },
        body: JSON.stringify({ refresh_token: auth.refresh_token }),
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      authSave(authShape(await r.json()));
      return auth.access_token;
    } catch (e) {
      /* Сэргээлт УНАСАН. Сүлжээгүй байж ч болох тул бүртгэлийг
         ЦУЦЛАХГҮЙ — локал ахиц хэвээр үлдэж, дараа дахин оролдоно.
         Зөвхөн сервер «refresh_token хүчингүй» гэвэл цуцална. */
      if (authInvalid(e)) authSave(null);
      return '';
    }
  }

  async function signOut() {
    const t = signedIn() ? (auth.access_token || '') : '';
    authSave(null);
    try {
      if (t) await fetch(AUTH_BASE() + '/logout', {
        method: 'POST',
        headers: { apikey: SYNC.key, Authorization: 'Bearer ' + t },
      });
    } catch {}
    toast('Гарлаа. Ахиц энэ хөтөч дээр хэвээр.');
  }

  async function rpc(fn, body) {
    /* Supabase-ийн ШИНЭ `sb_publishable_…` түлхүүр нь JWT БИШ тул
       `Authorization: Bearer` толгойд явуулбал задлах алдаа өгнө.
       Зөвхөн хуучин `eyJ…` JWT-д тэр толгой хэрэгтэй. */
    const headers = { 'Content-Type': 'application/json', apikey: SYNC.key };
    /* Нэвтэрсэн бол ХЭРЭГЛЭГЧИЙН токеныг явуулна — `koto_user_*` нь
       `auth.uid()`-аар эзэмшигчийг шийддэг тул үүнгүй бол няцаана. */
    const tok = await authToken();
    if (tok) headers.Authorization = 'Bearer ' + tok;
    else if (/^eyJ/.test(SYNC.key)) headers.Authorization = 'Bearer ' + SYNC.key;
    const r = await fetch(SYNC.url.replace(/\/+$/, '') + '/rest/v1/rpc/' + fn, {
      method: 'POST', headers: headers, body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const t = await r.text();
    return t ? JSON.parse(t) : null;
  }

  /** Хоёр төлөвийг нийлүүлнэ. `koto_put` дахь SQL-тэй ИЖИЛ дүрэм. */
  function kotoMerge(a, b) {
    a = a && typeof a === 'object' ? a : {};
    b = b && typeof b === 'object' ? b : {};
    const num = v => (typeof v === 'number' && isFinite(v) ? v : 0);
    const arr = v => (Array.isArray(v) ? v : []);
    const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

    // Үгийн хуваарь. Апп `passes` бичдэг (зөв бүрд +1, алдахад 0) —
    // 2026-11-01 хүртэл энд байхгүй `step`-ийг харьцуулж, илүү ахисан
    // бичлэгийг хаядаг байв (STATE §4 №33). Хоёр шат:
    //  1) СҮҮЛД үзсэн нь (`last`, тэнцвэл `due` хожуу) `weak` бол тэр
    //     ялна: сурагч саяхан мартсан — нөгөө төхөөрөмжийн хуучин
    //     «3 удаа зөв» нь давталтыг 7 хоног хойш түлхэх ёсгүй.
    //  2) үгүй бол `passes` ИХ нь (тэнцвэл сүүлийнх); `due`, `last` нь
    //     хоёроос ХОЖУУ нь. Ахиц ухрахгүй; `due` бодит утгаасаа
    //     хожимдохгүй — зөв хариулт бүр хугацааг л уртасгадаг.
    // SQL `koto_merge_word()`-тэй ИЖИЛ: `test_sql.js` энэ функцийг
    // ачаалж санамсаргүй 300 тохиолдлоор тулгадаг.
    const str = v => (v == null ? '' : typeof v === 'string' ? v : String(v));
    const mergeWord = (x, y) => {
      if (!Object.keys(x).length) return y;
      if (!Object.keys(y).length) return x;
      const lx = str(x.last), ly = str(y.last), dx = str(x.due), dy = str(y.due);
      const recent = lx > ly || (lx === ly && dx > dy) ? x : y;
      if (recent.weak === true) return recent;
      const px = num(x.passes), py = num(y.passes);
      const out = Object.assign({}, px > py ? x : py > px ? y : recent);
      const due = dx > dy ? dx : dy, last = lx > ly ? lx : ly;
      if (due) out.due = due;
      if (last) out.last = last;
      return out;
    };
    const keysOf = (x, y) => [...new Set([...Object.keys(obj(x)), ...Object.keys(obj(y))])];
    // Үг ба катакана үсэг (`kana`) ИЖИЛ дүрмээр — SQL хоёуланд нь `koto_merge_words`.
    const mergeMap = (x, y) => {
      const out = {};
      for (const key of keysOf(x, y)) {
        const w = mergeWord(obj(obj(x)[key]), obj(obj(y)[key]));
        if (Object.keys(w).length) out[key] = w;
      }
      return out;
    };
    // Өдрийн түлхүүр зөвхөн `YYYY-MM-DD`, ХАМГИЙН СҮҮЛИЙН 800 өдөр. Өмнө SQL
    // нь ЭРЭМБЭГҮЙ `limit 400`-аар санамсаргүй өдрийг хаядаг, клиент
    // хязгааргүй байв — 400 өдөр хичээллэсэн хүний streak хоёр талд зөрнө.
    const DAY = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
    const newestDays = (x, y) => keysOf(x, y).filter(k => DAY.test(k)).sort().reverse();
    // Өдрийн ахиц: нэг өдөр хоёр төхөөрөмж дээр ӨӨР үг давтсан байж
    // болно — нэгдэл авна. Хоосон өдрийг хаяна (SQL ч мөн адил).
    const days = {};
    for (const key of newestDays(a.days, b.days)) {
      if (Object.keys(days).length >= 800) break;
      const ids = [...new Set([...arr(obj(a.days)[key]), ...arr(obj(b.days)[key])])];
      if (ids.length) days[key] = ids;
    }
    // Өдрийн XP — төхөөрөмж бүрийн тоолуур `{өдөр: {төхөөрөмж: xp}}`. Нэг өдөр
    // хоёр төхөөрөмж дээр цуглуулсан XP-ийн НИЙЛБЭР нь үнэн; төхөөрөмж бүрт
    // max авдаг тул дахин нийлүүлэхэд давхар тоологдохгүй. Өдөрт 16
    // төхөөрөмж хүртэл (түлхүүрийн эрэмбээр) — хог өгөгдлийн хамгаалалт.
    const xpd = {};
    for (const key of newestDays(a.xpd, b.xpd)) {
      if (Object.keys(xpd).length >= 800) break;
      const x = obj(obj(a.xpd)[key]), y = obj(obj(b.xpd)[key]), o = {};
      for (const dev of keysOf(x, y).sort()) {
        const v = Math.max(num(x[dev]), num(y[dev]));
        if (v > 0 && Object.keys(o).length < 16) o[dev] = v;
      }
      if (Object.keys(o).length) xpd[key] = o;
    }
    return {
      version: 1,
      xp: Math.max(num(a.xp), num(b.xp)),
      completed: [...new Set([...arr(a.completed), ...arr(b.completed)])],
      words: mergeMap(a.words, b.words),
      kana: mergeMap(a.kana, b.kana),
      days: days,
      xpd: xpd,
      // UI сонголт — ХОЙД нь (push хийж буй төхөөрөмжийнх).
      selectedTopic: Number.isInteger(b.selectedTopic) ? b.selectedTopic
                   : Number.isInteger(a.selectedTopic) ? a.selectedTopic : 0,
    };
  }

  /** Серверээс татаад ЛОКАЛТАЙ нийлүүлнэ. Дэлгэцийг шинэчилнэ. */
  /** Аль зам ажиллаж байна вэ.
   *
   *  `user` — Google-ээр нэвтэрсэн: ахиц нь бүртгэлд уягдана, код
   *           санах шаардлагагүй, ЭРХЭМ зам.
   *  `code` — нууц код: Google бүртгэлгүй эсвэл нэвтрэхийг хүсэхгүй хүн.
   *  ''     — аль нь ч үгүй: ахиц зөвхөн энэ хөтөч дээр.
   *
   *  Хоёулаа ЗЭРЭГ тохируулсан бол Google нь ялна — нэг түлхэлт хоёр
   *  газар бичвэл аль нь үнэн болох нь тодорхойгүй болно. Хэрэглэгчид
   *  аль нь ажиллаж байгааг синкийн цонх ил харуулна.
   */
  const syncMode = () => (!syncOn() ? '' : signedIn() ? 'user' : syncCode ? 'code' : '');

  async function syncPull(quiet) {
    const mode = syncMode();
    if (!mode) return false;
    try {
      const remote = mode === 'user'
        ? await rpc('koto_user_get', {})
        : await rpc('koto_get', { p_code: syncCode });
      if (!remote) { if (!quiet) toast('Серверт ахиц хараахан алга.'); return false; }
      state = readStateFrom(kotoMerge(remote, state));
      save();
      updateTop(); switchView(view);
      if (!quiet) toast('Ахиц татагдлаа.');
      return true;
    } catch (e) {
      if (!quiet) toast('Татаж чадсангүй. Холболтоо шалгана уу.');
      return false;
    }
  }

  /** Локал төлөвийг түлхээд СЕРВЕРИЙН уусгасан хариуг хүлээн авна. */
  async function syncPush(quiet) {
    const mode = syncMode();
    if (!mode || syncBusy) return false;
    syncBusy = true;
    try {
      const saved = mode === 'user'
        ? await rpc('koto_user_put', { p_data: state })
        : await rpc('koto_put', { p_code: syncCode, p_data: state });
      // Хариуг локалтай НИЙЛҮҮЛНЭ, шууд солихгүй: (1) илгээлт явж байх
      // хооронд дуусгасан хичээл устахгүй; (2) SQL хуучин бол мэдэхгүй
      // талбарыг (`xpd`, `kana`) хаяж буцаадаг — солибол локал ч устана.
      if (saved) { state = readStateFrom(kotoMerge(saved, state)); save(); updateTop(); }
      syncFailed = false; paintSave();
      if (!quiet) toast('Ахиц хадгалагдлаа.');
      return true;
    } catch (e) {
      syncFailed = true; paintSave();
      if (!quiet) toast('Хадгалж чадсангүй. Дараа дахин оролдоно.');
      return false;
    } finally { syncBusy = false; }
  }

  /* Хичээл дуусах, хариулт бүрд түлхэх нь хэрэгтэйгээс олон дуудалт
     болно — 4 секунд хүлээж нэгтгэнэ. Хуудас хаагдахад шууд түлхэнэ. */
  function syncSoon() {
    if (!syncMode()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => syncPush(true), 4000);
  }

  /** Серверээс ирсэн обьектыг `readState`-ийн шүүлтээр дамжуулна —
   *  хорлонтой эсвэл эвдэрсэн өгөгдөл төлөвт шууд оröхгүй. */
  function readStateFrom(raw) {
    const keep = localStorage.getItem(STORAGE_KEY);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
      const s = readState();
      return s;
    } catch { return state; }
    finally {
      // `save()` дараа нь зөв төлөвийг бичих тул энд сэргээхгүй —
      // гэхдээ бичиж чадаагүй бол хуучныг эргүүлж тавина.
      if (keep !== null && !storageWorks) {
        try { localStorage.setItem(STORAGE_KEY, keep); } catch {}
      }
    }
  }

  /* ── Синкийн цонх ──────────────────────────────────────────────── */
  function syncMarkup() {
    const on = syncOn();
    const mode = syncMode();
    const user = mode === 'user' ? authUser() : null;
    const name = String((user && (user.name || user.email)) || 'Хэрэглэгч');
    const email = String((user && user.email) || '');
    const initial = (Array.from(name.trim())[0] || 'Х').toLocaleUpperCase();
    const avatar = user && typeof user.avatar === 'string' && user.avatar.indexOf('https://') === 0
      ? user.avatar : '';
    const codeOff = !on || mode === 'user';
    return `<div class="lesson-frame sync-frame">
      <div class="lesson-top">
        <button type="button" class="icon-button" data-action="sync-close" aria-label="Хаах">${icon('close')}</button>
        <h1 class="sync-title">Ахицын синк</h1>
      </div>
      <section class="exercise sync-body" aria-label="Нэвтрэлт ба хадгалалт">
        <p class="page-subtitle">Утас, компьютер дээрээ сурсан үгс болон хичээлийн ахицаа нийлүүлээрэй.</p>
        ${mode === 'user' ? `
        <section class="account-card" aria-label="Нэвтэрсэн бүртгэл">
          <div class="account-avatar" aria-hidden="true">
            <span class="avatar-fallback">${esc(initial)}</span>
            ${avatar ? `<img src="${esc(avatar)}" alt="" width="52" height="52" referrerpolicy="no-referrer">` : ''}
          </div>
          <div class="account-details">
            <strong class="account-name">${esc(name)}</strong>
            ${email ? `<span class="account-email">${esc(email)}</span>` : ''}
            <span class="sync-status">${icon('check')}Google бүртгэлээр нэвтэрсэн</span>
          </div>
          <button type="button" class="secondary-btn sign-out-button" data-action="sign-out">Гарах</button>
        </section>
        <p class="sync-hint">Ахиц таны Google бүртгэлтэй холбогдоно. Нууц кодын синк одоогоор идэвхгүй.</p>
        ` : `
        <section class="google-panel" aria-label="Google бүртгэлээр нэвтрэх">
          <h2>Ахицаа хамт авч яваарай.</h2>
          <p>Төхөөрөмж бүр дээрээ ижил Google бүртгэлээр нэвтрээрэй.</p>
          <button type="button" class="google-signin" data-action="google-in" ${on ? '' : 'disabled'}>
            <svg class="google-mark" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65Z"/>
              <path fill="#FBBC05" d="M10.53 28.59A14.41 14.41 0 0 1 9.75 24c0-1.59.27-3.13.78-4.59l-7.98-6.19A23.87 23.87 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"/>
            </svg>
            <span>Google-ээр нэвтрэх</span>
          </button>
        </section>`}
        ${on ? '' : '<p class="sync-unavailable" role="status">Синк одоогоор боломжгүй (<code>sync-config.js</code> хоосон). Ахиц зөвхөн энэ хөтөч дээр хадгалагдана.</p>'}
        <details class="sync-code-section" ${mode === 'code' ? 'open' : ''}>
          <summary><span>Нууц кодоор нийлүүлэх</span>
            <span class="sync-code-state">${mode === 'user' ? 'Идэвхгүй' : mode === 'code' ? 'Ашиглаж байна' : 'Өөр сонголт'}</span></summary>
          <div class="sync-code-body">
            <p class="sync-hint" id="sync-code-help">${mode === 'user'
              ? 'Кодоор үргэлжлүүлэхийн тулд Google бүртгэлээсээ эхлээд гарна уу.'
              : 'Хоёр төхөөрөмж дээр ижил код оруулна. Кодыг мэдсэн хүн ахицыг харж, өөрчилж чадна.'}</p>
            <fieldset class="sync-code-fields" ${codeOff ? 'disabled' : ''}>
              <legend class="sr-only">Нууц кодын тохиргоо</legend>
              <label class="sync-label" for="sync-code">Нууц код (8–64 тэмдэгт)</label>
              <input id="sync-code" class="search-input sync-code-input" type="text" inputmode="latin"
                     autocomplete="off" spellcheck="false" autocapitalize="none" minlength="8" maxlength="64"
                     aria-describedby="sync-code-help sync-note" placeholder="жишээ: naran-2026-koto">
              <div class="sync-actions">
                <button type="button" class="secondary-btn" data-action="sync-save" ${codeOff ? 'disabled' : ''}>Хадгалах ба нийлүүлэх</button>
                <button type="button" class="secondary-btn" data-action="sync-pull" ${!codeOff && syncCode ? '' : 'disabled'}>Серверээс татах</button>
              </div>
            </fieldset>
          </div>
        </details>
        <p class="sync-hint sync-note" id="sync-note" role="status" aria-live="polite"></p>
        <p class="sync-summary">Энэ хөтөч дээр: <strong>${state.xp} XP</strong> ·
          ${state.completed.length} хичээл · ${Object.keys(state.words).length} үг</p>
      </section>
    </div>`;
  }

  function openSync() {
    const dlg = $('sync-dialog');
    $('sync-content').innerHTML = syncMarkup();
    initIcons();
    dlg.showModal();
    const inp = $('sync-code');
    // Кодыг HTML-д БИЧИХГҮЙ, JS-ээр тавина: `value="${...}"` нь
    // хашилт агуулсан кодыг атрибутаас гаргах байв.
    if (inp) { inp.value = syncCode; inp.focus(); }
  }

  $('sync-dialog').addEventListener('click', async event => {
    const btn = event.target.closest('[data-action]');
    if (!btn) return;
    const act = btn.dataset.action;
    if (act === 'sync-close') { $('sync-dialog').close(); return; }
    if (act === 'google-in') { btn.disabled = true; await googleIn(); return; }
    if (act === 'sign-out') {
      await signOut();
      $('sync-content').innerHTML = syncMarkup();
      initIcons();
      if ($('sync-code')) $('sync-code').value = syncCode || '';
      updateTop();
      return;
    }
    if (act === 'sync-save') {
      const v = ($('sync-code').value || '').trim();
      if (v.length < 8 || v.length > 64) {
        $('sync-note').textContent = 'Код 8–64 тэмдэгт байх ёстой.';
        return;
      }
      syncCode = v;
      try { localStorage.setItem(SYNC_KEY, syncCode); } catch {}
      $('sync-note').textContent = 'Нийлүүлж байна…';
      // Эхлээд ТАТАЖ нийлүүлнэ: нөгөө төхөөрөмжийн ахицыг алдахгүй.
      await syncPull(true);
      const okPush = await syncPush(true);
      $('sync-note').textContent = okPush ? 'Нийлүүллээ.' : 'Нийлүүлж чадсангүй.';
      $('sync-content').innerHTML = syncMarkup();
      initIcons();
      $('sync-code').value = syncCode;
      return;
    }
    if (act === 'sync-pull') {
      $('sync-note').textContent = 'Татаж байна…';
      const okPull = await syncPull(true);
      $('sync-note').textContent = okPull ? 'Татлаа.' : 'Татаж чадсангүй.';
      $('sync-content').innerHTML = syncMarkup();
      initIcons();
      $('sync-code').value = syncCode;
    }
  });

  // Хуудас хаагдах/нуугдах үед хүлээж байсан түлхэлтийг шууд хийнэ.
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && pushTimer) {
      clearTimeout(pushTimer); pushTimer = null;
      syncPush(true);
    }
  });

  /* ── Дуудлага ──────────────────────────────────────────────────────
   * Үг бүрт `au` талбар бий (`data.js`) — урьдчилан бэлдсэн VOICEVOX
   * бичлэгийн id. 312 үгийн 248 нь v1-ийн сангаас дахин ашиглагдсан
   * (тэдний 2/3 нь ГАРААР шалгасан өргөлттэй), үлдсэн 64 нь `KT-…`.
   * Файлууд v1-тэй НЭГ хавтсанд (`../audio/`) — хоёр апп ижил бичлэг
   * хуваалцана, давхардуулж татахгүй.
   *
   * `speechSynthesis` нь ЗӨВХӨН нөөц: сүлжээгүй үед (v2-д service
   * worker байхгүй — №29) эсвэл файл унавал. Утсан дээр найдваргүй,
   * япон хоолойгүй систем дээр чимээгүй, өргөлтийг буруу уншина.
   */
  const AU_DIR='../audio/';
  const canSpeak=!!window.speechSynthesis;
  const JA_FEMALE=/haruka|ayumi|nanami|sayaka|mayu|aoi|shiori|kyoko|o-?ren|mizuki|google/i;
  const JA_MALE=/ichiro|keita|otoya|hattori|daichi|naoki|takumi/i;
  let jaVoice=null,lastUtterance=null;
  function pickVoice(){
    if(!canSpeak)return;
    const ja=speechSynthesis.getVoices().filter(v=>/^ja\b|^ja[-_]/i.test(v.lang));
    const score=v=>(JA_FEMALE.test(v.name)?2:0)-(JA_MALE.test(v.name)?3:0)+(/natural|online|neural/i.test(v.name)?1:0);
    jaVoice=ja.reduce((best,v)=>(!best||score(v)>score(best)?v:best),null);
  }
  /* Ихэнх гар утас эхний дуунаас ӨМНӨ хэрэглэгчийн хүрэлт шаардана.
     Эхний хүрэлт дотор чимээгүй бичлэг тоглуулж «түгжээг» тайлна —
     үүнгүй бол iOS дээр програмаас дуудсан тоглуулалт бүр татгалзана. */
  const SILENT_WAV='data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAwF0AAIC7AAACABAAZGF0YQIAAAAAAA==';
  let player=null,speechUnlocked=false;
  function ensurePlayer(){if(!player){player=new Audio();player.preload='auto';}return player;}
  function unlockSpeech(){
    if(speechUnlocked)return;speechUnlocked=true;
    try{const p=ensurePlayer();p.src=SILENT_WAV;const r=p.play();if(r&&r.catch)r.catch(()=>{});}catch{}
    if(!canSpeak)return;
    try{const u=new SpeechSynthesisUtterance(' ');u.volume=0;speechSynthesis.speak(u);}catch{}
  }
  document.addEventListener('pointerdown',unlockSpeech,{once:true});
  document.addEventListener('keydown',unlockSpeech,{once:true});

  function speak(text){
    /* Бичлэг тоглож байхад TTS эхэлбэл хоёр дуу ДАВХЦАНА. */
    try{if(player&&!player.paused)player.pause();}catch{}
    if(!canSpeak||!text)return;
    /* `なに／なん`-ийн хоёрдугаар хэлбэрийг, `～`-ийг хасна: хөтөчийн
       хоолой тэдгээрийг үсгээр нь уншиж гажуудуулдаг. */
    const clean=text.replace(/[／/].*$/,'').replace(/[（(].*?[）)]/g,'').replace(/[～〜]/g,'').trim();
    if(!clean)return;
    if(speechSynthesis.speaking||speechSynthesis.pending)speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(clean);
    if(jaVoice)u.voice=jaVoice;
    u.lang='ja-JP';u.rate=0.85;
    lastUtterance=u;speechSynthesis.speak(u);
  }

  /* Одоо тоглож байгаа үгийн id — товчны төлөвийг зурахад хэрэглэнэ. */
  let auNow=null;
  function auPaint(){
    for(const el of document.querySelectorAll('[data-au-for]'))
      el.classList.toggle('playing',el.dataset.auFor===auNow);
  }
  function auSet(id){auNow=id;auPaint();}

  /** Бичлэгийг тоглуулна. Унавал `onFail` — офлайн, эвдэрсэн файл, 404.
   *  `play()`-ийн татгалзлыг ЗАЛГИХГҮЙ: үүнгүй бол апп чимээгүй үлдэж,
   *  нөөц TTS рүү ч шилжихгүй байв (v1-д тохиолдсон). */
  function playFile(id,onFail){
    if(!id)return false;
    try{
      const p=ensurePlayer();
      p.src=AU_DIR+id+'.mp3';
      p.onended=()=>auSet(null);
      const r=p.play();
      if(r&&r.catch)r.catch(err=>{
        // Дараагийн үг рүү шилжихэд өмнөхийг тасалдаг — тэр нь алдаа биш.
        if(err&&(err.name==='AbortError'||err.name==='NotAllowedError'))return;
        auSet(null);if(onFail)onFail();
      });
      return true;
    }catch{return false;}
  }

  /** Үгийн дуудлага: бичлэг байвал бичлэг, эс бөгөөс хөтөчийн хоолой. */
  function sayWord(w){
    if(!w)return;
    const wid=w.id||null;
    if(auNow===wid){try{ensurePlayer().pause();}catch{}auSet(null);return;}
    auSet(wid);
    if(playFile(w.au,()=>speak(w.jp)))return;
    auSet(null);speak(w.jp);
  }
  /** id-аар дуудна. Хичээлд үүсгэсэн үг `wordById`-д байхгүй тул одоогийн асуултын үгээр нөхнө. */
  function sayId(id){const cur=session&&session.queue[session.pos];sayWord(wordById[id]||(cur&&cur.word?[cur.word,...(cur.word.exw||[])].find(w=>w.id===id):null)||null);}
  /** Сонсох боломж бий юу — бичлэг ЭСВЭЛ хоолой. */
  const canHear=w=>!!(w&&!w.noAu&&(w.au||canSpeak));

  /* ── Хариултын дуу ─────────────────────────────────────────────
     Файлгүй — WebAudio-гоор ая үүсгэнэ (0 байт, офлайн). Duolingo-гийн
     «мэдрэмж»-ийн гол хэсэг: зөв/буруу нь харахаас ӨМНӨ сонсогдоно.
     Унтраах сонголт `koto-sound`-д (анхдагч асаалттай). AudioContext-ийг
     хэрэглэгчийн товшилт дотор үүсгэдэг (checkAnswer нь click-ээс) тул
     iOS-ийн autoplay хоригт өртөхгүй. Алдаа гарвал чимээгүй — дуу нь
     нэмэлт, хичээлийг хэзээ ч зогсоох ёсгүй. */
  const SOUND_KEY='koto-sound';
  let soundOn=(()=>{try{return localStorage.getItem(SOUND_KEY)!=='0';}catch{return true;}})();
  let actx=null;
  const SFX={
    ok:[[660,0,.12,'sine',.16],[880,.09,.2,'sine',.16]],
    bad:[[233,0,.2,'triangle',.13],[196,.13,.26,'triangle',.11]],
    done:[[523,0,.14,'sine',.15],[659,.12,.14,'sine',.15],[784,.24,.32,'sine',.15]]
  };
  function sfx(seq){
    if(!soundOn||!seq)return;
    try{
      const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
      actx=actx||new C();if(actx.state==='suspended')actx.resume();
      const t0=actx.currentTime+.01;
      for(const [f,at,dur,type,vol] of seq){
        const o=actx.createOscillator(),g=actx.createGain();
        o.type=type;o.frequency.setValueAtTime(f,t0+at);
        g.gain.setValueAtTime(.0001,t0+at);
        g.gain.exponentialRampToValueAtTime(vol,t0+at+.015);
        g.gain.exponentialRampToValueAtTime(.0001,t0+at+dur);
        o.connect(g);g.connect(actx.destination);o.start(t0+at);o.stop(t0+at+dur+.03);
      }
    }catch{}
  }
  function soundBtn(){return `<button type="button" class="icon-button sound-toggle" data-action="sound" aria-pressed="${soundOn}" aria-label="${soundOn?'Хариултын дууг унтраах':'Хариултын дууг асаах'}">${icon(soundOn?'sound':'mute')}</button>`;}

  /* ── Хадгалалтын төлөв ─────────────────────────────────────────
     Өмнө footer «Ахиц энэ хөтөч дээр хадгалагдана» гэж Google-ээр
     нэвтэрсэн үед ч бичдэг байв — худал. Синкийн бодит төлөвөөс гаргана.
     Үг хэллэгийг Astra сайжруулна; энд ҮНЭН байх нь гол: дуусгалтын
     мөчид түлхэлт хараахан явж амжаагүй тул «нийлүүлэгдэнэ» (ирээдүй). */
  let syncFailed=false;
  const SAVE_TEXT={
    local:['Ахиц зөвхөн энэ хөтөч дээр хадгалагдана.','Ахиц энэ хөтөч дээр хадгалагдлаа. Бусад төхөөрөмжтэй нийлүүлэх тохиргоо асаагүй байна.'],
    code:['Ахиц нууц кодоор нийлүүлэгдэнэ.','Ахиц энэ хөтөч дээр хадгалагдлаа. Нууц кодоор бусад төхөөрөмжтэй автоматаар нийлүүлнэ.'],
    user:['Ахиц Google бүртгэлтэй нийлүүлэгдэнэ.','Ахиц энэ хөтөч дээр хадгалагдлаа. Google бүртгэлтэй автоматаар нийлүүлнэ.'],
    error:['Нийлүүлэлт амжилтгүй. Дараа дахин оролдоно.','Ахиц энэ хөтөч дээр хадгалагдлаа. Сүүлийн нийлүүлэлт амжилтгүй болсон тул дараа дахин оролдоно.']
  };
  function saveKind(){const m=syncMode();return m?(syncFailed?'error':m):'local';}
  function paintSave(){const el=$('save-status');if(el)el.textContent=SAVE_TEXT[saveKind()][0];}

  /* ── Бичиг (кана/ханз), катакана, өдрийн XP, ахицын хуудас ─────────
     Логик (Claude); markup/CSS-ийг Astra өгнө.

     Бичиг нь төхөөрөмж бүрийн тохиргоо (`koto-script`, дууны тохиргоо шиг).
     Ханзын горимд `kj`-тэй үг ханзаар, уншлагатайгаа харагдана; хичээлд
     «ханзаар унших» асуулт нэмэгдэнэ. `kj`-г `tools/build_v2_kanji.py`
     гаргадаг — 432-оос 289. */
  const SCRIPT_KEY='koto-script';
  let scriptMode=(()=>{try{return localStorage.getItem(SCRIPT_KEY)==='kanji'?'kanji':'kana';}catch{return 'kana';}})();
  const kanjiOn=()=>scriptMode==='kanji';
  function setScript(m){scriptMode=m==='kanji'?'kanji':'kana';try{localStorage.setItem(SCRIPT_KEY,scriptMode);}catch{}}
  /* Сонголтын текст нь кана мөр тул ханзыг үгээр нь олно. Ижил канатай
     хоёр үг өөр ханзтай бол ханз ХАРУУЛАХГҮЙ — аль нь болохыг мэдэхгүй. */
  const kjByJp=new Map();
  for(const w of allWords){const k=w.kj||'';if(!kjByJp.has(w.jp))kjByJp.set(w.jp,k);else if(kjByJp.get(w.jp)!==k)kjByJp.set(w.jp,'');}
  /** Япон бичлэгийн HTML: ханзын горимд ханз + уншлага, эс бөгөөс кана. */
  function face(jp,kj){
    if (kj === undefined) kj = kjByJp.get(jp) || '';
    if (!kanjiOn() || !kj) return esc(jp);
    return `<span class="jp-face-line" lang="ja"><ruby class="jp-face">${esc(kj)}<rp>（</rp><rt>${esc(jp)}</rt><rp>）</rp></ruby></span>`;
  }
  /** «Ханзаар унших»: ханзыг уншлагагүй харуулж, 4 кана уншлагаас сонгоно.
   *  Хуурамч хариулт нь мөн ханзтай үгсийн уншлага, ойр сэдвээс эхэлнэ. */
  function kjQuiz(word){const pool=allWords.filter(w=>w.kj&&w.id!==word.id&&w.jp!==word.jp&&w.kj!==word.kj);const near=shuffle(pool.filter(w=>w.topic===word.topic)),far=shuffle(pool.filter(w=>w.topic!==word.topic));const opts=[];for(const w of near.concat(far)){if(!opts.includes(w.jp))opts.push(w.jp);if(opts.length===3)break;}return {type:'quiz',word,direction:'kj-jp',correct:word.jp,options:shuffle([word.jp,...opts]),retry:false};}

  /* Катакана үг: катакана ҮСЭГ агуулсан бүх үг (モンゴルご г.м. холимог ч орно). */
  const KATA_RE=/[ァ-ヺ]/;
  const isKata=w=>KATA_RE.test(w.jp);
  const kataWords=allWords.filter(isKata);
  function newSession(extra){return Object.assign({lesson:null,review:true,words:[],queue:[],pos:0,selected:null,selectedTokens:[],checked:false,correct:false,showHint:false,xp:0,firstAnswers:0,firstCorrect:0,results:{},started:Date.now(),completed:false},extra);}
  /** 5 катакана үг: алдсан/хугацаа болсон → үзээгүй → бусад. Үзээгүйд сурах карт. */
  function startKataWords(){const d=today(),r=w=>state.words[w.id];const rank=w=>!r(w)?1:r(w).weak?0:r(w).due<=d?0:2;const words=shuffle(kataWords).sort((a,b)=>rank(a)-rank(b)).slice(0,5);if(!words.length)return;session=newSession({title:'Катакана үгс',words,queue:[...words.filter(w=>!r(w)).map(word=>({type:'learn',word})),...buildQueue(words,true)]});openSession();}

  /* Катакана үсэг (`v2/kana.js`, v1-ийн kana.json-аас 107). Хариулт нь
     хирагана (латингүй зарчим); `mn` нь кирилл уншлага. Ахиц `state.kana`-д,
     үгийнхтэй ижил хуваарьтай; `days`-д id нь орж streak-д тоологдоно. */
  const KANA=(window.KOTO_KANA||[]).map(k=>({id:k.id,jp:k.kata,hira:k.hira,mn:k.hira+' · '+k.mn,au:k.id,g:k.g,kana:true}));
  const kanaById=Object.fromEntries(KANA.map(k=>[k.id,k]));
  /* Мөр мөрөөр: gojuon ア…ヤ(3)…ワヲン(3), dakuten 5×5, yoon 2 мөр (6) тутам. */
  const kanaLessons=(()=>{const rows={gojuon:[5,5,5,5,5,5,5,3,5,3],dakuten:[5,5,5,5,5],yoon:[6,6,6,6,6,6]};const out=[];for(const g of Object.keys(rows)){const list=KANA.filter(k=>k.g===g);let p=0;for(const n of rows[g].concat([Infinity])){const chars=list.slice(p,p+n);p+=chars.length;if(chars.length)out.push({group:g,chars,title:chars[0].jp+'–'+chars[chars.length-1].jp});}}return out;})();
  function kanaQuiz(k,dir){const key=dir==='kata-hira'?'hira':'jp',correct=k[key],pool=KANA.filter(x=>x.id!==k.id);const near=shuffle(pool.filter(x=>x.g===k.g)),far=shuffle(pool.filter(x=>x.g!==k.g));const opts=[];for(const x of near.concat(far)){if(x[key]!==correct&&!opts.includes(x[key]))opts.push(x[key]);if(opts.length===3)break;}return {type:'quiz',word:k,direction:dir,correct,options:shuffle([correct,...opts]),retry:false};}
  const kanaQueue=(chars,learn)=>[...(learn?chars.map(word=>({type:'learn',word})):[]),...shuffle(chars.flatMap(k=>[kanaQuiz(k,'kata-hira'),kanaQuiz(k,'hira-kata')]))];
  function startKana(i){const L=kanaLessons[i];if(!L)return;session=newSession({kana:true,title:'Катакана · '+L.title,words:L.chars,queue:kanaQueue(L.chars,true)});openSession();}
  function kanaDue(){const d=today();return KANA.filter(k=>{const r=state.kana[k.id];return r&&(r.weak||r.due<=d);});}
  /** 8 хүртэл: хугацаа болсон/алдсан, эс бөгөөс үзсэнээс санамсаргүй. */
  function startKanaReview(){const due=kanaDue(),seen=KANA.filter(k=>state.kana[k.id]);const chars=shuffle(due.length?due:seen).slice(0,8);if(!chars.length){startKana(0);return;}session=newSession({kana:true,title:'Катакана давтлага',words:chars,queue:kanaQueue(chars,false)});openSession();}

  /* ── Ханз N5 · N4 (`v2/kanji.js`, 79 + 166) ─────────────────────────
     Эзний хүсэлт (2026-11-04): jisho.org-ийн N5, N4-ийн бүх ханз, тусдаа
     «Ханз» цэс. Жагсаалт jisho-той ханз бүрээрээ таарсан; утга, уншлага нь
     v1-ийн KANJIDIC2 + гараар шалгасан монгол утга. Логик (Claude); хуудас,
     ханзны карт (markup/CSS) — Astra.
     Ахиц нь `state.kana`-д `J-xxxx` id-гаар — катаканатай ижил хуваарь, ижил
     уусгалт (`koto_merge_words`, 2000 түлхүүр), SQL өөрчлөхгүй.
     Ханз бүрт 4 асуулт: ханз → утга, утга → ханз, ханз → уншлага, жишээ үг
     → уншлага (жишээгүй 6 ханзад гурав). */
  /** Уншлагын шошго: он (2 хүртэл) ／ кун (2 хүртэл), окуриганаг хаалтад — ひと.つ → ひと(つ). */
  const kanjiRead = k => [k.on.slice(0, 2).join('・'), k.kun.slice(0, 2).map(r => r.replace(/\.(.+)$/, '($1)')).join('・')].filter(Boolean).join(' ／ ');
  const KANJI = (window.KOTO_KANJI || []).map(k => ({
    id: k.id, jp: k.c, mn: k.mn, on: k.on, kun: k.kun, s: k.s, g: k.g, n: k.n, read: kanjiRead(k), kanji: true, noAu: true,
    exw: k.ex.map((e, i) => ({ id: 'JW:' + k.id + ':' + i, jp: e.jp, kana: e.kana, mn: e.mn, au: e.au || null }))
  }));
  const kanjiById = Object.fromEntries(KANJI.map(k => [k.id, k]));
  /* Түвшин бүрийг 5 хүртэлх хичээлд ТЭНЦҮҮ хуваана: N5 79 → 15×5+4, N4 166 → 30×5+4×4
     (5-аар тасалбал N4-ийн сүүлийн хичээлд 1 ханз үлдэнэ). */
  const kanjiLessons = (() => {
    const out = [];
    for (const n of [5, 4]) {
      const list = KANJI.filter(k => k.n === n), L = Math.ceil(list.length / 5), base = Math.floor(list.length / L), extra = list.length % L;
      let p = 0;
      for (let i = 0; i < L; i++) {
        const size = base + (i < extra ? 1 : 0), chars = list.slice(p, p + size);
        p += size;
        out.push({ n, k: i, chars, title: chars[0].jp + '–' + chars[chars.length - 1].jp });
      }
    }
    return out;
  })();
  /* Утгын аль нэг хэсэг («,» эсвэл «;»-ээр) давхцвал хоёулаа зөв мэт — 思«бодох» ба 考«бодох,
     эргэцүүлэх». N4-т 22 хос (Astra-гийн хяналт 11-04; түүний санал «;»-ээр л хуваадаг байсан —
     утгын 95 нь «,»-тэй тул Claude хоёуланг нь). */
  const mnParts = k => k.mn.split(/[;；,，]/).map(s => s.trim().toLowerCase()).filter(Boolean);
  const mnOverlap = (a, b) => mnParts(a).some(m => mnParts(b).includes(m));
  /** Буруу хувилбар: ижил түвшний ханзаас (`accept`-д тэнцсэн), утга нь зөв хариулттай давхцахгүй, өөр хоорондоо ч. */
  function kanjiPick(k, val, n, accept) {
    const correct = val(k), out = [];
    for (const x of shuffle(KANJI.filter(x => x.n === k.n && x.id !== k.id && (!accept || accept(x))))) {
      const v = val(x);
      if (v && v !== correct && !out.includes(v)) out.push(v);
      if (out.length === n) break;
    }
    return out;
  }
  function kanjiQuizzes(k) {
    const q = (direction, word, correct, wrong) => ({ type: 'quiz', direction, word, rid: k.id, correct, options: shuffle([correct, ...wrong]), retry: false });
    const out = [
      q('kj-mn', k, k.mn, kanjiPick(k, x => x.mn, 3, x => !mnOverlap(x, k))),
      q('mn-kj', k, k.jp, kanjiPick(k, x => x.jp, 3, x => !mnOverlap(x, k))),
      q('kj-read', k, k.read, kanjiPick(k, x => x.read, 3))
    ];
    if (k.exw.length) {
      const ex = k.exw[rnd(k.exw.length)], wrong = [];
      for (const e of shuffle(KANJI.filter(x => x.n === k.n && x.id !== k.id).flatMap(x => x.exw)))
        if (e.kana !== ex.kana && !wrong.includes(e.kana) && wrong.push(e.kana) === 3) break;
      out.push(q('kw-read', ex, ex.kana, wrong));
    }
    return out;
  }
  const kanjiQueue = (chars, learn) => [...(learn ? chars.map(word => ({ type: 'learn', word })) : []), ...shuffle(chars.flatMap(kanjiQuizzes))];
  function startKanji(i) {
    const L = kanjiLessons[i];
    if (!L) return;
    session = newSession({ kana: true, kanji: true, title: `Ханз N${L.n} · ${L.k + 1}-р хичээл`, words: L.chars, queue: kanjiQueue(L.chars, true) });
    openSession();
  }
  function kanjiDue() { const d = today(); return KANJI.filter(k => { const r = state.kana[k.id]; return r && (r.weak || r.due <= d); }); }
  /** 5 хүртэл: алдсан/хугацаа болсон эхэнд; эс бөгөөс үзсэнээс санамсаргүй. */
  function startKanjiReview() {
    const due = kanjiDue(), seen = KANJI.filter(k => state.kana[k.id]);
    const chars = shuffle(due.length ? due : seen).sort((a, b) => Number(!!state.kana[b.id].weak) - Number(!!state.kana[a.id].weak)).slice(0, 5);
    if (!chars.length) { startKanji(0); return; }
    session = newSession({ kana: true, kanji: true, title: 'Ханзны давтлага', words: chars, queue: kanjiQueue(chars, false) });
    openSession();
  }
  /** «Ханз» хуудасны бүх тоо — markup үүнээс л уншина. */
  function kanjiData() {
    const status = k => { const r = state.kana[k.id]; return !r ? 'new' : r.weak ? 'weak' : mastered(r) ? 'strong' : 'learning'; };
    return Object.assign(wordStats(KANJI, state.kana), {
      due: kanjiDue().length,
      levels: [5, 4].map(n => Object.assign(wordStats(KANJI.filter(k => k.n === n), state.kana), {
        n, label: 'N' + n,
        lessons: kanjiLessons.map((L, i) => ({ i, n: L.n, k: L.k, title: L.title, chars: L.chars.map(c => c.jp), seen: L.chars.filter(c => state.kana[c.id]).length, total: L.chars.length })).filter(L => L.n === n),
        kanji: KANJI.filter(k => k.n === n).map(k => ({ id: k.id, c: k.jp, mn: k.mn, read: k.read, status: status(k) }))
      }))
    });
  }
  /* «Ханз» хуудас ба шинэ ханзны карт — markup: Astra (gpt-6-astra, 2026-11-04);
     тоо бүгд `kanjiData()`-аас, Claude холбож тестэлсэн. */
  const kjStatusUI = {
    new:      { label: 'Шинэ',          mark: '○' },
    learning: { label: 'Суралцаж буй',  mark: '◐' },
    strong:   { label: 'Бататгасан',    mark: '✓' },
    weak:     { label: 'Сул',           mark: '!' }
  };

  const kjEsc = value => esc(String(value ?? ''));

  function kjKunMarkup(reading) {
    const text = String(reading ?? '');
    const dot = text.indexOf('.');

    if (dot < 0) return kjEsc(text);

    return `${kjEsc(text.slice(0, dot))}<span class="kj-okurigana">${kjEsc(text.slice(dot + 1))}</span>`;
  }

  function renderKanji() {
    const p = kanjiData();

    $('view-kanji').innerHTML = `
      <header class="kj-page-head">
        <div class="eyebrow">ХАНЗ · JLPT</div>
        <h1 class="page-title">Ханзаа нэг нэгээр нь.</h1>
        <p class="page-subtitle">
          N5, N4 түвшний ${kjEsc(p.total)} ханз.
          Дүрс, утга, уншлагыг жишээ үгтэй нь сураарай.
        </p>
      </header>

      <section class="p-card kj-overview" aria-label="Ханзны ахиц">
        <dl class="kj-stats">
          <div>
            <dt>Үзсэн</dt>
            <dd>${kjEsc(p.seen)} <small>/ ${kjEsc(p.total)}</small></dd>
          </div>
          <div>
            <dt>Бататгасан</dt>
            <dd>${kjEsc(p.strong)}</dd>
          </div>
          <div>
            <dt>Сул</dt>
            <dd>${kjEsc(p.weak)}</dd>
          </div>
        </dl>

        <div class="kj-review">
          <button type="button" class="p-btn kj-review-btn"
            data-action="kanji-review"
            ${p.seen === 0 ? 'disabled' : ''}>
            ${icon('repeat')} Давтах (${kjEsc(p.due)})
          </button>
          <p class="p-small">
            ${p.seen === 0
              ? 'Эхний хичээлээ үзээд давтлагаа эхлүүлээрэй.'
              : p.due > 0
                ? 'Давтах хугацаа болсон ханзуудаа бататгаарай.'
                : 'Хугацаа болсон ханз алга. Үзсэнээсээ давтаж болно.'}
          </p>
        </div>
      </section>

      <div class="kj-levels">
        ${p.levels.map(L => `
          <section class="p-card kj-level"
            aria-labelledby="kj-level-${kjEsc(L.n)}">
            <header class="kj-level-head">
              <span class="kj-level-badge">${kjEsc(L.label)}</span>
              <div>
                <h2 id="kj-level-${kjEsc(L.n)}">
                  ${kjEsc(L.label)} түвшний ханз
                </h2>
                <p class="p-muted">
                  ${kjEsc(L.total)} ханз · ${kjEsc(L.lessons.length)} хичээл
                </p>
                <p class="p-small">
                  ${kjEsc(L.seen)} / ${kjEsc(L.total)} үзсэн ·
                  ${kjEsc(L.strong)} бататгасан · ${kjEsc(L.weak)} сул
                </p>
              </div>
            </header>

            <h3 class="kj-section-title">Хичээлүүд</h3>
            <p class="p-small kj-section-note">
              Нэг хичээлд 4–5 ханз.
              «Бүгдийг үзсэн» нь тухайн хичээлийн бүх ханзтай танилцсаныг илэрхийлнэ.
            </p>

            <div class="p-kana-grid kj-lessons">
              ${L.lessons.map(l => {
                const done = l.total > 0 && l.seen === l.total;
                const action = done
                  ? 'Дахин үзэх'
                  : l.seen > 0 ? 'Үргэлжлүүлэх' : 'Эхлэх';
                const label = `${L.label}, ${l.k + 1}-р хичээл: ${l.title}. ` +
                  `${l.seen} / ${l.total} үзсэн. ${action}.`;

                return `
                  <button type="button"
                    class="p-kana-lesson kj-lesson${done ? ' is-seen' : ''}"
                    data-action="kanji-lesson"
                    data-kanji="${kjEsc(l.i)}"
                    aria-label="${kjEsc(label)}">
                    <span class="p-kana-top">
                      <strong>${kjEsc(l.k + 1)}-р хичээл</strong>
                      <span aria-hidden="true">
                        ${icon(done ? 'check' : 'play')}
                      </span>
                    </span>
                    <span class="p-kana-chars" lang="ja">
                      ${l.chars.map(c => `<span>${kjEsc(c)}</span>`).join('')}
                    </span>
                    <span class="p-kana-bottom">
                      <span>${kjEsc(l.seen)} / ${kjEsc(l.total)} үзсэн</span>
                      <span>${done ? 'Бүгдийг үзсэн' : action}</span>
                    </span>
                  </button>`;
              }).join('')}
            </div>

            <section class="kj-inventory"
              aria-labelledby="kj-all-${kjEsc(L.n)}">
              <h3 class="kj-section-title" id="kj-all-${kjEsc(L.n)}">
                Бүх ханз <span class="kj-total">${kjEsc(L.total)}</span>
              </h3>

              <ul class="kj-legend" aria-label="Төлөвийн тайлбар">
                ${Object.entries(kjStatusUI).map(([status, ui]) => `
                  <li class="kj-state-${status}">
                    <span aria-hidden="true">${ui.mark}</span>
                    ${ui.label}
                  </li>
                `).join('')}
              </ul>

              <ul class="kj-grid" aria-label="${kjEsc(L.label)} ханзны жагсаалт">
                ${L.kanji.map(k => {
                  const status = Object.prototype.hasOwnProperty.call(kjStatusUI, k.status)
                    ? k.status : 'new';
                  const ui = kjStatusUI[status];
                  const label = `${k.c} — ${k.mn}. ${ui.label}.`;
                  const tooltip = `${k.c} — ${k.mn}\n${k.read}\n${ui.label}`;

                  return `
                    <li>
                      <span class="kj-tile kj-state-${status}" role="img"
                        aria-label="${kjEsc(label)}"
                        title="${kjEsc(tooltip)}">
                        <span class="kj-tile-char" lang="ja"
                          aria-hidden="true">${kjEsc(k.c)}</span>
                        <span class="kj-tile-mark"
                          aria-hidden="true">${ui.mark}</span>
                      </span>
                    </li>`;
                }).join('')}
              </ul>
            </section>
          </section>
        `).join('')}
      </div>`;
  }

  function kanjiLearnMarkup(q) {
    const k = q.word;
    const on = k.on || [];
    const kun = k.kun || [];
    const examples = k.exw || [];

    return `
      <div class="exercise-type">
        ${icon('leaf')}ШИНЭ ХАНЗ ·
        ${kjEsc(session.pos + 1)} / ${kjEsc(session.words.length)}
      </div>
      <h1 id="exercise-title" tabindex="-1">Энэ ханзтай танилцаарай.</h1>

      <div class="learn-card kanji-learn">
        <div class="kj-learn-hero">
          <p class="kj-glyph" lang="ja">${kjEsc(k.jp)}</p>
          <div class="kj-learn-info">
            <p class="kj-learn-meta">
              <span>JLPT N${kjEsc(k.n)}</span>
              <span>${kjEsc(k.s)} зурлага</span>
            </p>
            <p class="kj-meaning">${kjEsc(k.mn)}</p>
          </div>
        </div>

        <dl class="kj-readings">
          <div>
            <dt>ОН <span>Катакана</span></dt>
            <dd>
              ${on.length
                ? `<ul class="kj-reading-list" lang="ja">
                    ${on.map(r => `<li>${kjEsc(r)}</li>`).join('')}
                  </ul>`
                : '<span class="kj-reading-empty">Байхгүй</span>'}
            </dd>
          </div>
          <div>
            <dt>КУН <span>Хирагана</span></dt>
            <dd>
              ${kun.length
                ? `<ul class="kj-reading-list" lang="ja">
                    ${kun.map(r => `<li>${kjKunMarkup(r)}</li>`).join('')}
                  </ul>`
                : '<span class="kj-reading-empty">Байхгүй</span>'}
            </dd>
          </div>
        </dl>

        ${kun.some(r => String(r).includes('.')) ? `
          <p class="kj-reading-note">
            Доогуур зураастай хэсэг нь окуригана:
            ханзны араас канагаар бичигдэх хэсэг.
          </p>` : ''}

        ${examples.length ? `
          <section class="kj-examples" aria-labelledby="kj-example-title">
            <h2 id="kj-example-title">Жишээ үг</h2>
            <ul class="kj-example-list">
              ${examples.map(e => {
                const audio = audioBtn(e);
                return `
                  <li class="kj-example">
                    <div class="kj-example-copy">
                      <p class="kj-example-word" lang="ja">${kjEsc(e.jp)}</p>
                      <p class="kj-example-kana" lang="ja">${kjEsc(e.kana)}</p>
                      <p class="kj-example-meaning">${kjEsc(e.mn)}</p>
                    </div>
                    ${audio ? `<div class="kj-example-audio">${audio}</div>` : ''}
                  </li>`;
              }).join('')}
            </ul>
          </section>` : ''}
      </div>`;
  }

  /* Өдрийн XP: төхөөрөмж бүрийн тоолуур (`kotoMerge`-ийн тайлбар). */
  const DEV_KEY='koto-dev';
  const devId=(()=>{try{let d=localStorage.getItem(DEV_KEY);if(!/^[a-z0-9]{8}$/.test(d||'')){d=(Math.random().toString(36).slice(2)+'00000000').slice(0,8);localStorage.setItem(DEV_KEY,d);}return d;}catch{return 'local';}})();
  function addDayXp(n){n=Number(n)||0;if(n<=0)return;const d=today();const day=state.xpd[d]&&typeof state.xpd[d]==='object'&&!Array.isArray(state.xpd[d])?state.xpd[d]:(state.xpd[d]={});day[devId]=(Number(day[devId])||0)+n;}
  function dayXp(d){const o=state.xpd[d];let s=0;if(o&&typeof o==='object')for(const v of Object.values(o))if(Number(v)>0)s+=Number(v);return s;}
  const isDay=k=>/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(k);
  const activeDay=d=>Array.isArray(state.days[d])&&state.days[d].length>0;
  /* Түвшин: нэг хичээл ≈ 120 XP (5 үг × 2 асуулт × 10 + өгүүлбэр 20).
     Дээд шат 500+ (≈4 хичээл) — эзний сонголт (2026-11-02). */
  const heatLevel=xp=>xp>=500?4:xp>=250?3:xp>=120?2:xp>0?1:0;
  /** GitHub шиг: `n` долоо хоног (багана = Да…Ня), сүүлийнх нь энэ долоо хоног.
   *  XP бичигдэж эхлэхээс өмнөх идэвхтэй өдөр (`days` бий, `xpd` алга) —
   *  түвшин 1, `legacy` (XP-г зохиохгүй). */
  function heatWeeks(n){n=n||53;const t=today(),wd=new Date(t+'T12:00:00Z').getUTCDay(),start=shiftDate(t,-((wd+6)%7)-7*(n-1)),weeks=[];for(let w=0;w<n;w++){const col=[];for(let i=0;i<7;i++){const date=shiftDate(start,w*7+i),future=date>t,xp=future?0:dayXp(date),on=!future&&activeDay(date);col.push({date,xp,active:on,future,legacy:on&&!xp,level:xp?heatLevel(xp):on?1:0});}weeks.push(col);}return weeks;}
  function longestStreak(){let best=0,run=0,prev=null;for(const d of Object.keys(state.days).filter(k=>isDay(k)&&activeDay(k)).sort()){run=prev&&shiftDate(prev,1)===d?run+1:1;if(run>best)best=run;prev=d;}return best;}
  /* «Бататгасан» = алдаагүй, дараалан 3+ удаа зөв (давталт 7 хоног). */
  const mastered=r=>!!r&&!r.weak&&(Number(r.passes)||0)>=3;
  function wordStats(list,store){store=store||state.words;let seen=0,strong=0,weak=0;for(const w of list){const r=store[w.id];if(!r)continue;seen++;if(r.weak)weak++;else if(mastered(r))strong++;}return {total:list.length,seen,strong,weak,learning:seen-strong-weak};}
  /** Ахицын хуудасны бүх тоо — markup үүнээс л уншина. */
  function profileData(){
    let att=0,mis=0;for(const w of allWords){const r=state.words[w.id];if(r){att+=Number(r.attempts)||0;mis+=Number(r.misses)||0;}}
    const weeks=heatWeeks(53),past=weeks.flat().filter(c=>!c.future);
    return {
      xp:state.xp,todayXp:dayXp(today()),streak:streak(),longest:longestStreak(),
      activeDays:Object.keys(state.days).filter(k=>isDay(k)&&activeDay(k)).length,
      heat:{weeks,yearXp:past.reduce((s,c)=>s+c.xp,0),yearDays:past.filter(c=>c.level>0).length,hasLegacy:past.some(c=>c.legacy)},
      words:Object.assign(wordStats(allWords),{due:dueWords().length}),
      accuracy:att?Math.round((att-mis)/att*100):null,
      lessons:{done:state.completed.length,total:lessons.length},
      topics:TOPICS.map((t,i)=>({title:t[0],learned:topicLearned(i),total:allWords.filter(w=>w.topic===i).length})),
      kanji:wordStats(allWords.filter(w=>w.kj)),
      kataWords:wordStats(kataWords),
      kana:Object.assign(wordStats(KANA,state.kana),{due:kanaDue().length,lessons:kanaLessons.map((L,i)=>({i,title:L.title,group:L.group,chars:L.chars.map(k=>k.jp),seen:L.chars.filter(k=>state.kana[k.id]).length,total:L.chars.length}))}),
      script:scriptMode,mode:syncMode(),account:syncMode()==='user'?authUser():null
    };
  }

  function dayWords(){const words=state.days[today()];return Array.isArray(words)?words:[];}
  function streak(){let day=today(),count=0;if(!Array.isArray(state.days[day])||!state.days[day].length)day=shiftDate(day,-1);while(Array.isArray(state.days[day])&&state.days[day].length){count++;day=shiftDate(day,-1);}return count;}
  function weakWords(){return allWords.filter(w=>state.words[w.id]&&state.words[w.id].weak);}
  function dueWords(){const d=today();return allWords.filter(w=>state.words[w.id]&&(state.words[w.id].weak||state.words[w.id].due<=d));}
  function nextLesson(){return lessons.find(l=>!state.completed.includes(l.id))||lessons[0];}
  function topicLessons(t){return lessons.filter(l=>l.topic===t);}
  function topicLearned(t){return allWords.filter(w=>w.topic===t&&state.words[w.id]).length;}
  function shuffle(items){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3800);}
  function initIcons(){document.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon);});}
  /* Толгойн avatar: нэвтрээгүй бол わ; нэвтэрсэн ч зураггүй бол нэрийн эхний үсэг.
     innerHTML-ийг зөвхөн төлөв ӨӨРЧЛӨГДСӨН үед бичнэ — updateTop нь view бүрд дуудагддаг тул
     зургийг дахин дахин үүсгэвэл анивчина. */
  let avatarKey=null;
  function updateAvatar(){const el=$('open-sync-top');if(!el)return;const u=syncMode()==='user'?authUser():null;const name=String((u&&(u.name||u.email))||'Хэрэглэгч');const photo=u&&typeof u.avatar==='string'&&u.avatar.indexOf('https://')===0?u.avatar:'';const key=u?name+'|'+photo:'';if(key===avatarKey)return;avatarKey=key;el.setAttribute('aria-label',u?name+' — миний ахиц':'Миний ахиц');el.innerHTML=u?`<span class="avatar-fallback" aria-hidden="true">${esc((Array.from(name.trim())[0]||'Х').toLocaleUpperCase())}</span>${photo?`<img src="${esc(photo)}" alt="" width="44" height="44" referrerpolicy="no-referrer">`:''}`:'<span class="avatar-fallback" lang="ja" aria-hidden="true">わ</span>';}
  function updateTop(){$('xp').textContent=state.xp;$('streak').textContent=streak();$('review-dot').hidden=!dueWords().length;updateAvatar();paintSave();}
  function switchView(next){view=['learn','words','review','profile','games','kanji'].includes(next)?next:'learn';document.querySelectorAll('.view').forEach(el=>el.hidden=el.id!==`view-${view}`);document.querySelectorAll('.nav-item').forEach(el=>{el.classList.toggle('active',el.dataset.view===view);if(el.dataset.view===view)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});$('page-name').textContent={learn:'Миний сурах зам',words:'Миний үгийн сан',review:'Давтах цаг',profile:'Миний ахиц',games:'Тоглоом',kanji:'Ханз'}[view];if(view==='learn')renderHome();if(view==='profile')renderProfile();if(view==='words')renderWords();if(view==='review')renderReview();if(view==='games')renderGames();if(view==='kanji')renderKanji();location.hash=view;updateTop();}
  function weekMarkup(){const d=today();const weekday=new Date(d+'T12:00:00Z').getUTCDay();const monday=shiftDate(d,-((weekday+6)%7));return ['Да','Мя','Лх','Пү','Ба','Бя','Ня'].map((label,i)=>{const date=shiftDate(monday,i),done=Array.isArray(state.days[date])&&state.days[date].length;return `<div class="week-day ${date===d?'today':''} ${done?'done':''}" aria-label="${label}${done?' хичээллэсэн':''}"><span>${done?'✓':label.slice(0,1)}</span>${label}</div>`;}).join('');}
  function renderHome(){
    const t=state.selectedTopic,group=topicLessons(t),completed=group.filter(l=>state.completed.includes(l.id)).length,current=group.find(l=>!state.completed.includes(l.id))||group[0];
    /* Зорилго «10 үг бататгая»: өнөөдөр үзсэн бөгөөд сүүлийн удаа АЛДААГҮЙ үг.
       Өмнө 27%-тай хичээл ч зорилгыг биелүүлдэг байв. `days` (идэвх, streak) хэвээр. */
    const count=dayWords().filter(id=>state.words[id]&&!state.words[id].weak).length;
    $('view-learn').innerHTML=`<div class="eyebrow">ТАНЫ СУРАХ ЗАМ</div><h1 class="page-title">Өнөөдөр юу сурах вэ?</h1><p class="page-subtitle">Канагаа мэднэ. Одоо үгсээ утгатай нь холбож, яриандаа ашиглая.</p>
    <div class="home-layout"><div class="primary-column"><section class="hero" aria-label="Өнөөдрийн хичээл"><div><span class="tag"><span class="tag-dot"></span>IRODORI A1 · МОНГОЛ ТАЙЛБАРТАЙ</span><h2>Өдөр бүр<br>10 үгээ тогтооё.</h2><p>Богино хичээл. Жаахан дасгал.<br>Өөрийн хурдаар ахих сурах зам.</p><button class="primary-btn" data-action="start" data-lesson="${nextLesson().id}">${state.completed.length?'Үргэлжлүүлэн сурах':'Эхний хичээлээ эхэлье'}${icon('arrow')}</button><div class="hero-mini"><span><strong>${allWords.length}</strong> үг, хэллэг</span><span><strong>${DATA.length}</strong> сэдэв</span><span><strong>5 үг</strong> / хичээл</span></div></div><div class="hero-art">${mascot()}<span class="kana-sticker" lang="ja">いっしょに！</span></div></section>
    <div class="section-heading"><h2>Таны дараагийн алхам</h2><span class="meta">Жижиг хичээл, өдөр бүр</span></div><section class="unit-card" id="current-unit"><div class="unit-header"><div class="unit-number">${String(t+1).padStart(2,'0')}</div><div><h3 class="unit-title">${TOPICS[t][0]}</h3><p class="unit-subtitle">${TOPICS[t][2]} · ${DATA[t].words.length} үг, хэллэг</p></div><span class="unit-progress">${completed} / ${group.length}</span></div><div class="lesson-path">${group.map((l,i)=>{const done=state.completed.includes(l.id),isCurrent=l.id===current.id;return `<div class="lesson-node">${isCurrent&&!done?'<span class="start-label">ЭНДЭЭС ЭХЭЛ</span>':''}<button class="node-button ${done?'completed':isCurrent?'available current':'available'}" data-action="start" data-lesson="${l.id}" aria-label="${i+1}-р хичээл, ${l.words.length} үг${done?', дууссан':''}">${icon(done?'check':i===group.length-1?'flag':isCurrent?'play':'star')}</button><span class="node-label"><strong>${i+1}-р хичээл</strong>${l.words.length} үг · 3–5 мин</span></div>`;}).join('')}</div>${NUM_TOPICS.includes(t)?`<div class="test-cta"><div><strong>🧮 Тооны шалгалт</strong><span>Тоо, тоолох нэр, цаг, гараг, сар, өдөр, огноо · ${TEST_WORDS+TEST_GEN*2} асуулт</span></div><button class="primary-btn" data-action="test">Шалгалт өгөх${icon('target')}</button></div>`:''}</section>
    <div class="section-heading"><h2>Сурах сэдвүүд</h2><span class="meta">${state.completed.length} / ${lessons.length} хичээл дууссан</span></div><div class="topic-grid">${DATA.map((topic,i)=>`<button class="topic-card ${i===t?'selected':''}" data-action="topic" data-topic="${i}" aria-pressed="${i===t}"><span class="topic-icon" aria-hidden="true">${TOPICS[i][1]}</span><span class="topic-info"><span class="topic-name">${TOPICS[i][0]}</span><span class="topic-meta" style="display:block">${topicLearned(i)} / ${topic.words.length} үг · ${topicLessons(i).length} хичээл</span></span>${icon('arrow')}</button>`).join('')}</div></div>
    <aside class="right-column" aria-label="Сурах ахиц"><section class="side-card"><h2 class="side-card-title">Өнөөдрийн зорилго${icon('target')}</h2><div class="goal"><div class="goal-ring" style="--progress:${Math.min(count*10,100)}" aria-label="Өнөөдөр ${count}, зорилго 10 үг"><div>${count}<small> / 10</small></div></div><div class="goal-label"><strong>${count>=10?'Зорилгодоо хүрлээ!':'10 үг бататгая'}</strong><span>${count>=10?'Сайхан ажиллалаа.':'Хоёр богино хичээлээс<br>эхлээрэй.'}</span></div></div><div class="week-days">${weekMarkup()}</div></section>
    <section class="side-card note-card"><h2 class="side-card-title">Таны түвшинд тохируулсан${icon('leaf')}</h2><div class="note-illustration"><span class="note-kana" lang="ja">あ</span><p>Кана уншиж чадна.<br>Латин уншлага хэрэггүй.</p></div><p>Япон бичлэгээс нь шууд уншиж, монгол утгаас нь санаж хэлж хэвшээрэй.</p><button class="small-link" data-view="words">Үгийн сангаа харах${icon('arrow')}</button></section>
    <section class="side-card"><h2 class="side-card-title">Нэг хичээлд</h2><div class="method-list"><div class="method"><span>01</span><div><strong>5 шинэ үгтэй танилцана</strong><small>Кана бичлэг + монгол утга</small></div></div><div class="method"><span>02</span><div><strong>Хоёр чиглэлд шалгана</strong><small>Утга болон япон үгийг сонгоно</small></div></div><div class="method"><span>03</span><div><strong>Өгүүлбэр эвлүүлнэ</strong><small>Үгсээ яриандаа ашиглана</small></div></div></div></section></aside></div>`;
  }
  // Дуудлагын товч: бичлэггүй үгэнд (canHear=false) ОГТ гаргахгүй — зохиомж түүнгүйгээр ч бүтэн.
  function audioBtn(w,extra){return canHear(w)?`<button type="button" class="speak-button audio-button${extra||''}" data-action="say" data-au-for="${esc(w.id)}" aria-label="Дуудлагыг сонсох"><svg class="icon audio-speaker" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/></svg><span class="audio-bars" aria-hidden="true"><i></i><i></i><i></i></span></button>`:'';}
  /* Сонсох карт: карт бүхэлдээ дарахад дуудна. Булангийн товч нь гарын
     товчлуур ба дэлгэц уншигчийн зам тул ҮЛДЭНЭ. `on===false` — монгол→япон
     асуултад шалгахаас өмнө (хариултыг задруулна). */
  const cardAttrs=(cls,w,on)=>on!==false&&canHear(w)?`class="${cls} say-card" data-au-for="${esc(w.id)}"`:`class="${cls}"`;
  function wordCard(w){const learned=state.words[w.id];return `<article ${cardAttrs('word-card'+(isKata(w)?' is-kata':''),w)}><div class="word-meta"><p class="word-topic">${esc(TOPICS[w.topic][0])}</p>${isKata(w) ? '<span class="word-kata-badge">Катакана</span>' : ''}</div><div class="word-heading"><h2 class="word-kana" lang="ja">${face(w.jp,w.kj)}</h2>${audioBtn(w)}</div><p class="word-meaning">${esc(w.mn)}</p><span class="word-status ${learned?'learned':''}">${icon(learned&&learned.weak?'repeat':learned?'check':'book')}${learned?(learned.weak?'Дахин бататгана':'Үзсэн үг'):'Шинэ үг'}</span></article>`;}
  let wordQuery='',wordTopic='all';
  function renderWords(){
    $('view-words').innerHTML=`<div class="eyebrow">ТАНЫ ҮГИЙН САН</div><h1 class="page-title">Үг бүр нэг алхам.</h1><p class="page-subtitle">${allWords.length} үг, хэллэг · ${Object.keys(state.words).filter(id=>wordById[id]).length} үг үзсэн · Латин уншлагагүй</p><div class="word-toolbar"><label class="search-wrap"><span class="sr-only" style="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)">Япон эсвэл монгол үгээр хайх</span>${icon('search')}<input id="word-search" class="search-input" placeholder="Япон эсвэл монгол үгээр хайх…" autocomplete="off"></label><select id="word-topic" class="topic-select" aria-label="Сэдэв сонгох"><option value="all">Бүх сэдэв</option><option value="kata">Катакана үгс (${kataWords.length})</option>${TOPICS.map((t,i)=>`<option value="${i}">${t[0]}</option>`).join('')}</select></div><p id="word-result-count" class="page-subtitle" role="status" style="margin:0 0 18px"></p><div id="word-results" class="word-grid"></div>`;
    $('word-search').value=wordQuery;$('word-topic').value=wordTopic;
    filterWords();
  }
  function filterWords(){wordQuery=$('word-search').value;wordTopic=$('word-topic').value;const query=wordQuery.trim().toLocaleLowerCase(),topic=wordTopic;const words=allWords.filter(w=>(topic==='all'||(topic==='kata'?isKata(w):w.topic===Number(topic)))&&(!query||w.jp.toLowerCase().includes(query)||(w.kj&&w.kj.includes(query))||w.mn.toLocaleLowerCase().includes(query)));$('word-result-count').textContent=`${words.length} үг, хэллэг`;$('word-results').innerHTML=words.length?words.map(wordCard).join(''):'<p class="page-subtitle">Тохирох үг олдсонгүй. Өөр үгээр хайгаарай.</p>';markOverflowSoon($('word-results'));}
  function renderReview(){const learned=allWords.filter(w=>state.words[w.id]),due=dueWords(),weak=weakWords();$('view-review').innerHTML=`<div class="eyebrow">ДАВТЛАГА</div><h1 class="page-title">Санаж байна уу?</h1><p class="page-subtitle">Өмнө үзсэн үгсээ монгол утга болон япон бичлэгээс нь санаж хэлээрэй.</p>${!learned.length?`<section class="empty-state"><div class="empty-icon">${icon('repeat')}</div><h2>Эхний үгсээ суръя.</h2><p>Хичээлээ дуусгасны дараа үзсэн болон алдсан үгс чинь энд гарна.</p><button class="primary-btn" data-action="start" data-lesson="${nextLesson().id}">Эхний хичээл${icon('arrow')}</button></section>`:`<section class="review-banner"><div><h2>${due.length?`${due.length} үг давтахад бэлэн`:'Өнөөдрийн давтлага бэлэн'}</h2><p>${weak.length?`${weak.length} алдсан үгээс эхэлнэ. `:''}Нэг удаад 5 хүртэл үгээ бататгана.</p></div><button class="primary-btn" data-action="review">Давтаж эхлэх${icon('repeat')}</button></section><div class="section-heading"><h2>${weak.length?'Бататгах үгс':'Үзсэн үгс'}</h2><span class="meta">${weak.length||learned.length} үг</span></div><div class="word-grid">${(weak.length?weak:learned).map(wordCard).join('')}</div>`}`;}
  function quiz(word,direction){const correct=direction==='jp-mn'?word.mn:word.jp;const pool=allWords.filter(w=>w.id!==word.id&&w.jp!==word.jp&&w.mn!==word.mn);const near=shuffle(pool.filter(w=>w.topic===word.topic)),far=shuffle(pool.filter(w=>w.topic!==word.topic));const unique=[];for(const w of near.concat(far)){const value=direction==='jp-mn'?w.mn:w.jp;if(value!==correct&&!unique.includes(value))unique.push(value);if(unique.length===3)break;}return {type:'quiz',word,direction,correct,options:shuffle([correct,...unique]),retry:false};}
  function buildQueue(words,isReview,lessonId){const queue=isReview?[]:words.map(word=>({type:'learn',word}));queue.push(...shuffle(words.flatMap(w=>[quiz(w,'jp-mn'),quiz(w,'mn-jp'),...(kanjiOn()&&w.kj?[kjQuiz(w)]:[])])));const sentence=!isReview&&SENTENCES[lessonId];if(sentence){queue.push({type:'sentence',sentence,tokens:shuffle(sentence.tokens.map((text,i)=>({text,id:i}))),retry:false});}return queue;}
  /* ── Тооны шалгалт ─────────────────────────────────────────────────
     «Тоо, цаг, хуанли» (17) ба «Тоо…» (16) сэдвийн бүх үгсээс санамсаргүй
     14 асуулт + огноо 3 + цаг 3 = 20. Огноо, цагийг ҮҮСГЭДЭГ тул сурагч
     «しがつ ようか» гэх мэт хослолыг цээжээр биш бодож хэлж сурна.
     Дуудлага өөрчлөгддөг тоонуудыг (しがつ, よじ, ついたち, はつか…) хүснэгтээр. */
  const NUM_TOPICS=[15,16], TEST_WORDS=14, TEST_GEN=3;
  const MONTHS=['いちがつ','にがつ','さんがつ','しがつ','ごがつ','ろくがつ','しちがつ','はちがつ','くがつ','じゅうがつ','じゅういちがつ','じゅうにがつ'];
  const DAYS=['ついたち','ふつか','みっか','よっか','いつか','むいか','なのか','ようか','ここのか','とおか','じゅういちにち','じゅうににち','じゅうさんにち','じゅうよっか','じゅうごにち','じゅうろくにち','じゅうしちにち','じゅうはちにち','じゅうくにち','はつか','にじゅういちにち','にじゅうににち','にじゅうさんにち','にじゅうよっか','にじゅうごにち','にじゅうろくにち','にじゅうしちにち','にじゅうはちにち','にじゅうくにち','さんじゅうにち','さんじゅういちにち'];
  const MDAYS=[31,29,31,30,31,30,31,31,30,31,30,31];
  const HOURS=['いちじ','にじ','さんじ','よじ','ごじ','ろくじ','しちじ','はちじ','くじ','じゅうじ','じゅういちじ','じゅうにじ'];
  const MINS=[[0,''],[5,'ごふん'],[10,'じゅっぷん'],[15,'じゅうごふん'],[20,'にじゅっぷん'],[30,'さんじゅっぷん'],[45,'よんじゅうごふん']];
  const rnd=n=>Math.floor(Math.random()*n);
  function genDate(){const m=rnd(12),d=rnd(MDAYS[m]);return {key:m+'/'+d,jp:MONTHS[m]+' '+DAYS[d],mn:(m+1)+'-р сарын '+(d+1)};}
  function genTime(){const h=rnd(12),[mm,mj]=MINS[rnd(MINS.length)];return {key:h+':'+mm,jp:HOURS[h]+(mj?' '+mj:''),mn:(h+1)+' цаг'+(mm?' '+mm+' минут':'')};}
  /** Үүсгэсэн асуулт: зөв хариулт + ижил төрлийн 3 өөр хариулт. */
  function genQuiz(gen,i){const a=gen(),seen=new Set([a.key]),wrong=[];while(wrong.length<3){const b=gen();if(!seen.has(b.key)){seen.add(b.key);wrong.push(b);}}
    const direction=Math.random()<.5?'jp-mn':'mn-jp',val=x=>direction==='jp-mn'?x.mn:x.jp;
    const word={id:'gen-'+i+'-'+a.key,jp:a.jp,mn:a.mn,topic:16,gen:true};
    return {type:'quiz',word,direction,correct:val(a),options:shuffle([val(a),...wrong.map(val)]),retry:false};}
  function buildTest(){const pool=shuffle(allWords.filter(w=>NUM_TOPICS.includes(w.topic))).slice(0,TEST_WORDS);
    const qs=pool.map(w=>quiz(w,Math.random()<.5?'jp-mn':'mn-jp'));
    for(let i=0;i<TEST_GEN;i++){qs.push(genQuiz(genDate,'d'+i));qs.push(genQuiz(genTime,'t'+i));}
    return {words:pool,queue:shuffle(qs)};}
  function startTest(){const t=buildTest();session={review:true,test:true,lesson:null,words:t.words,queue:t.queue,pos:0,selected:null,selectedTokens:[],checked:false,correct:false,showHint:false,xp:0,firstAnswers:0,firstCorrect:0,results:{},started:Date.now(),completed:false};openSession();}
  function startLesson(id){const lesson=lessonById[id];if(!lesson)return;session={lesson,review:false,words:lesson.words,queue:buildQueue(lesson.words,false,lesson.id),pos:0,selected:null,selectedTokens:[],checked:false,correct:false,showHint:false,xp:0,firstAnswers:0,firstCorrect:0,results:{},started:Date.now(),completed:false};openSession();}
  function startReview(){const studied=allWords.filter(w=>state.words[w.id]);const due=dueWords();const words=shuffle(due.length?due:studied).sort((a,b)=>Number(!!state.words[b.id].weak)-Number(!!state.words[a.id].weak)).slice(0,5);if(!words.length){startLesson(nextLesson().id);return;}session={review:true,lesson:null,words,queue:buildQueue(words,true),pos:0,selected:null,selectedTokens:[],checked:false,correct:false,showHint:false,xp:0,firstAnswers:0,firstCorrect:0,results:{},started:Date.now(),completed:false};openSession();}
  function openSession(){renderSession();markOverflowSoon($('lesson-content'));if(!$('lesson-dialog').open)$('lesson-dialog').showModal();$('lesson-dialog').scrollTop=0;}
  /* Ахицын хуудас — markup ба CSS: Astra (gpt-6-astra, 2026-11-01); GitHub-ийн
     жилийн график, Duolingo-гийн streak, Quizlet-ийн ангиллаас санаа авсан.
     Тоо бүгд `profileData()`-аас. Холболт: data-action script/kana-lesson/
     kana-review/kata-words/sync-open/review, data-view, .heat-cell[data-level]. */
  let profileKeep = null;
  /** Урт ханз/кана мөр хайрцгаасаа халивал (товч дотор биш) Tab-аар хүрч
   *  гүйлгэх боломжтой болгоно. Хэмжээ layout-ын дараа л мэдэгдэнэ. */
  function markOverflowSoon(root) {
    if (!root) return;
    requestAnimationFrame(() => {
      for (const el of root.querySelectorAll('.jp-face-line, .kj-prompt, .kana-prompt'))
        if (!el.closest('button') && el.scrollWidth > el.clientWidth + 1) el.tabIndex = 0;
    });
  }
  function renderProfile() {
    const p = profileData();
    const n = value => value == null ? '—' : esc(value);

    const meter = (value, total, label) => `
      <progress class="p-progress"
        value="${esc(value)}" max="${esc(total)}"
        aria-label="${esc(label)}: ${esc(value)} / ${esc(total)}">
        ${esc(value)} / ${esc(total)}
      </progress>`;

    const heatTitle = c =>
      `${c.date}: ${
        c.future ? 'Ирээдүйн өдөр' :
        c.legacy ? 'Идэвхтэй · XP бүртгэгдээгүй' :
        `${c.xp} XP`
      }`;

    const heat = p.heat.weeks.map(col => `
      <div class="heat-col">
        ${col.map(c => `
          <span class="heat-cell"
            data-level="${c.level}"
            data-date="${esc(c.date)}"
            ${c.future ? 'data-future' : ''}
            ${c.legacy ? 'data-legacy' : ''}
            title="${esc(heatTitle(c))}">
          </span>
        `).join('')}
      </div>
    `).join('');

    // Зөвхөн огнооны шошго; ахицын шинэ тоо бодохгүй. Шошго (≈40px) дараагийн
    // шошго эсвэл төгсгөл хүртэл 3 багана (45px) хүрэхгүй бол харуулахгүй:
    // давхцахгүй, өмнөх сарын нүдний дээр буруу сар бичихгүй.
    const starts = p.heat.weeks
      .map((col, i) => ({ i, first: col.find(c => c.date.slice(8) === '01') }))
      .filter(x => x.first);
    const label = new Map(starts
      .filter((x, k) => (k + 1 < starts.length ? starts[k + 1].i : p.heat.weeks.length) - x.i >= 3)
      .map(x => [x.i, Number(x.first.date.slice(5, 7))]));
    const months = p.heat.weeks.map((col, i) => `
        <span class="heat-month">
          ${label.has(i) ? `<b>${label.get(i)}-р сар</b>` : ''}
        </span>`).join('');

    const groups = [
      ['gojuon', 'Үндсэн', 'Энгийн катакана үсгүүд'],
      ['dakuten', 'Дуу оруулсан', 'Дакүтэн, хандакүтэн тэмдэгтэй үсгүүд'],
      ['yoon', 'Нийлмэл', 'Жижиг үсэгтэй нийлсэн авианууд']
    ];

    const milestones = [
      {
        title: 'Эхний алхам',
        text: 'Нэг үгийн хичээл дуусгах',
        earned: p.lessons.done > 0,
        symbol: 'flag'
      },
      {
        title: 'Долоо хоногийн хэмнэл',
        text: 'Долоон өдөр дараалан сурах',
        earned: p.longest >= 7,
        symbol: 'flame'
      },
      {
        title: 'Үгийн суурь',
        text: 'Тавин үг бататгах',
        earned: p.words.strong >= 50,
        symbol: 'book'
      }
    ];

    $('view-profile').innerHTML = `
      <div class="profile-page">
        <header class="p-header">
          <div>
            <p class="eyebrow">ӨДӨР БҮР НЭГ АЛХАМ</p>
            <h1 class="page-title">Миний ахиц</h1>
            <p class="p-muted">
              ${p.account
                ? `${esc(p.account.name || p.account.email || 'Суралцагч')} · `
                : ''}
              Жижиг давталт бүр унших чадварыг нэмнэ.
            </p>
          </div>
          <button type="button" class="p-btn" data-view="learn">
            Суралцах ${icon('arrow')}
          </button>
        </header>

        <div class="p-activity">
          <section class="p-card p-streak" aria-labelledby="p-streak-title">
            <div class="p-card-head">
              <h2 id="p-streak-title">Таны хэмнэл</h2>
              ${icon('flame')}
            </div>
            <p class="p-streak-number">
              <strong>${n(p.streak)}</strong>
              <span>өдөр дараалан</span>
            </p>
            <p class="p-muted">
              ${p.streak > 0
                ? 'Өнөөдөр ч багахан давтаад үргэлжлүүлье.'
                : 'Өнөөдрийн хичээлээс шинэ хэмнэлээ эхлүүлээрэй.'}
            </p>
            <div class="p-streak-best">
              ${icon('trophy')}
              <span>Хамгийн урт <strong>${n(p.longest)} өдөр</strong></span>
            </div>
          </section>

          <section class="p-card p-heat" aria-labelledby="p-heat-title">
            <div class="p-card-head">
              <div>
                <h2 id="p-heat-title">
                  Сүүлийн жилд ${n(p.heat.yearXp)} XP
                </h2>
                <p class="p-muted">
                  ${n(p.heat.yearDays)} идэвхтэй өдөр · 53 долоо хоног
                </p>
              </div>
              ${icon('tiles')}
            </div>

            <div id="profile-heat-scroll"
              class="heat-scroll"
              tabindex="0"
              role="region"
              aria-label="Жилийн графикийн гүйлгэх хэсэг"
              aria-describedby="p-heat-help">
              <div class="heat-calendar"
                role="img"
                aria-label="Сүүлийн 53 долоо хоногт ${n(p.heat.yearXp)} XP,
                  ${n(p.heat.yearDays)} идэвхтэй өдөр.
                  Багана бүр даваагаас ням хүртэл.
                  Өнгөний түвшин өдрийн XP-г илэрхийлнэ."
                aria-describedby="p-heat-key">
                <div class="heat-days" aria-hidden="true">
                  <span>Да</span><span></span>
                  <span>Лх</span><span></span>
                  <span>Ба</span><span></span><span></span>
                </div>
                <div class="heat-timeline">
                  <div class="heat-months" aria-hidden="true">${months}</div>
                  <div class="heat-grid">${heat}</div>
                </div>
              </div>
            </div>

            <div class="p-heat-footer">
              <p id="p-heat-help" class="p-muted">
                Өмнөх өдрүүдийг хажуу тийш гүйлгэж харна.
              </p>
              <div class="p-heat-scale" aria-hidden="true">
                <span>Бага</span>
                ${[0, 1, 2, 3, 4].map(level => `
                  <span class="heat-cell" data-level="${level}"></span>
                `).join('')}
                <span>Их</span>
              </div>
            </div>

            <p id="p-heat-key" class="p-small">
              Өдрийн XP: 0 · 1–119 · 120–249 · 250–499 · 500+.
              Тасархай хүрээтэй нүд нь ирээдүйн өдөр.
              ${p.heat.hasLegacy
                ? 'Ташуу хээтэй нүд: идэвхтэй, XP бүртгэгдээгүй.'
                : ''}
            </p>
            ${p.heat.hasLegacy ? `
              <p class="p-legacy-note">
                <span class="heat-cell" data-level="1"
                  data-legacy aria-hidden="true"></span>
                XP бүртгэгдээгүй өдрүүд нийт XP-д нэмэгдэхгүй.
              </p>
            ` : ''}
          </section>
        </div>

        <dl class="p-stats" aria-label="Суралцах статистик">
          <div>
            <dt>Өнөөдрийн XP</dt>
            <dd>${n(p.todayXp)}</dd>
          </div>
          <div>
            <dt>Нийт XP</dt>
            <dd>${n(p.xp)}</dd>
          </div>
          <div>
            <dt>Нийт идэвхтэй өдөр</dt>
            <dd>${n(p.activeDays)}</dd>
          </div>
          <div>
            <dt>Үгийн зөв хариулт</dt>
            <dd>${p.accuracy == null ? '—' : `${n(p.accuracy)}%`}</dd>
            ${p.accuracy == null
              ? '<p class="p-small">Хариулсны дараа гарна.</p>'
              : ''}
          </div>
        </dl>

        <section class="p-card" aria-labelledby="p-script-title">
          <div class="p-card-head">
            <div>
              <h2 id="p-script-title">Бичиг</h2>
              <p class="p-muted">Уншиж сурах бичлэгээ сонгоорой.</p>
            </div>
            ${icon('book')}
          </div>

          <div class="p-script-layout">
            <div>
              <div class="p-segment" role="group"
                aria-labelledby="p-script-title"
                aria-describedby="p-script-help">
                <button type="button"
                  data-action="script" data-script="kana"
                  aria-pressed="${p.script === 'kana'}">
                  <span lang="ja" aria-hidden="true">かな</span>
                  <span>Кана</span>
                </button>
                <button type="button"
                  data-action="script" data-script="kanji"
                  aria-pressed="${p.script === 'kanji'}">
                  <span lang="ja" aria-hidden="true">漢字</span>
                  <span>Ханз</span>
                </button>
              </div>
              <p id="p-script-help" class="p-muted p-space">
                ${p.script === 'kanji'
                  ? 'Ханзтай үг ханз болон дээрх кана уншлагатай харагдана. Хичээлд «Ханзаар унших» асуулт нэмэгдэнэ.'
                  : 'Үгс канагаар харагдана. Ханз сонговол ханз, кана уншлага хамт гарч, «Ханзаар унших» асуулт нэмэгдэнэ.'}
              </p>
              <p class="p-small p-space">
                ${n(p.kanji.total)} / ${n(p.words.total)} үг ханзтай.
                Сонголт энэ төхөөрөмж дээр хадгалагдана.
                Катаканы дасгал хоёр горимд хоёуланд нь нээлттэй.
              </p>
            </div>

            <div class="p-inset">
              <h3>Ханзтай үгийн ахиц</h3>
              <p class="p-count">
                <strong>${n(p.kanji.seen)}</strong>
                / ${n(p.kanji.total)} үг үзсэн
              </p>
              ${meter(p.kanji.seen, p.kanji.total, 'Ханзтай үг үзсэн ахиц')}
              <p class="p-small">
                ${n(p.kanji.strong)} бататгасан ·
                ${n(p.kanji.weak)} сул
              </p>
              <p class="p-small p-space">
                Энэ нь ханзтай үгийн ахиц; тусдаа ханзын шалгалтын дүн биш.
              </p>
            </div>
          </div>
        </section>

        <section class="p-card" aria-labelledby="p-words-title">
          <div class="p-card-head">
            <div>
              <h2 id="p-words-title">Үгийн сангийн ахиц</h2>
              <p class="p-muted">
                ${n(p.words.seen)} / ${n(p.words.total)} үг үзсэн
              </p>
            </div>
            <button type="button" class="p-btn"
              data-action="review" ${p.words.seen ? '' : 'disabled'}>
              ${icon('repeat')} Давтах (${n(p.words.due)})
            </button>
          </div>

          ${meter(p.words.seen, p.words.total, 'Үг үзсэн ахиц')}

          <dl class="p-word-states">
            <div class="p-state-strong">
              <dt>${icon('check')} Бататгасан</dt>
              <dd>${n(p.words.strong)}</dd>
              <p>Алдаагүй, дараалан гурваас дээш удаа зөв.</p>
            </div>
            <div class="p-state-learning">
              <dt>${icon('book')} Сурч буй</dt>
              <dd>${n(p.words.learning)}</dd>
              <p>Үзсэн, цааш бататгаж буй үгс.</p>
            </div>
            <div class="p-state-weak">
              <dt>${icon('repeat')} Сул</dt>
              <dd>${n(p.words.weak)}</dd>
              <p>Алдсан тул дахин бататгах үгс.</p>
            </div>
          </dl>

          <div class="p-line-row">
            <span>Дуусгасан үгийн хичээл</span>
            <strong>${n(p.lessons.done)} / ${n(p.lessons.total)}</strong>
          </div>
          ${meter(p.lessons.done, p.lessons.total, 'Дуусгасан үгийн хичээл')}

          ${p.words.seen === 0 ? `
            <p class="p-muted p-space">
              Эхний хичээлээ дуусгахад үгсийн төлөв энд гарна.
            </p>
          ` : ''}

          <details class="p-details">
            <summary>Сэдэв бүрийн ахиц</summary>
            <ul class="p-topic-list">
              ${p.topics.map(t => `
                <li>
                  <div class="p-line-row">
                    <span>${esc(t.title)}</span>
                    <strong>${n(t.learned)} / ${n(t.total)}</strong>
                  </div>
                  ${meter(t.learned, t.total, `${t.title}: үзсэн үг`)}
                </li>
              `).join('')}
            </ul>
          </details>

          <button type="button" class="p-btn p-space" data-view="words">
            Үгийн сангаа нээх ${icon('arrow')}
          </button>
        </section>

        <section class="p-card" aria-labelledby="p-kana-title">
          <div class="p-card-head">
            <div>
              <h2 id="p-kana-title">Катакана үсэг</h2>
              <p class="p-muted">
                ${n(p.kana.seen)} / ${n(p.kana.total)} тэмдэгт үзсэн ·
                21 хичээл
              </p>
            </div>
            <button type="button" class="p-btn"
              data-action="kana-review" ${p.kana.seen ? '' : 'disabled'}>
              ${icon('repeat')} Давтах (${n(p.kana.due)})
            </button>
          </div>

          ${meter(p.kana.seen, p.kana.total, 'Катакана тэмдэгт үзсэн ахиц')}

          <p class="p-small">
            ${n(p.kana.strong)} бататгасан · ${n(p.kana.weak)} сул.
            Хирагана болон кирилл уншлагатай сураад, хоёр чиглэлд шалгана.
          </p>
          <p class="p-small p-space">
            «Бүгдийг үзсэн» тэмдэг нь хичээлийн бүх тэмдэгтийг үзсэнийг илэрхийлнэ.
          </p>

          <div class="p-kana-groups">
            ${groups.map(([group, title, description]) => `
              <details class="p-kana-group"
                ${group === 'gojuon' ? 'open' : ''}>
                <summary>
                  <h3>${title}</h3>
                  <span class="p-small">${description}</span>
                </summary>
                <div class="p-kana-grid">
                  ${p.kana.lessons.filter(L => L.group === group).map(L => `
                    <button type="button"
                      class="p-kana-lesson${L.seen === L.total ? ' is-seen' : ''}"
                      data-action="kana-lesson" data-kana="${L.i}"
                      aria-label="${esc(title)}: ${esc(L.title)}.
                        ${L.seen} / ${L.total} тэмдэгт үзсэн.
                        ${L.seen === L.total ? 'Бүгдийг үзсэн.' : 'Хичээл нээх.'}">
                      <span class="p-kana-top">
                        <strong lang="ja">${esc(L.title)}</strong>
                        ${L.seen === L.total ? icon('check') : icon('play')}
                      </span>
                      <span class="p-kana-chars" lang="ja">
                        ${L.chars.map(char => `<span>${esc(char)}</span>`).join('')}
                      </span>
                      <span class="p-kana-bottom">
                        <span>${n(L.seen)} / ${n(L.total)} үзсэн</span>
                        <span>${L.seen === L.total
                          ? 'Бүгдийг үзсэн'
                          : L.seen > 0 ? 'Үргэлжлүүлэх' : 'Эхлэх'}</span>
                      </span>
                    </button>
                  `).join('')}
                </div>
              </details>
            `).join('')}
          </div>
        </section>

        <section class="p-card p-kata-words" aria-labelledby="p-kata-title">
          <div class="p-kata-symbol" lang="ja" aria-hidden="true">カタカナ</div>
          <div>
            <h2 id="p-kata-title">Катакана үгс</h2>
            <p class="p-muted">
              Хаяг, цэс, барааны нэр уншихад хэрэгтэй үгсээ давтаарай.
            </p>
            <p class="p-count">
              <strong>${n(p.kataWords.seen)}</strong>
              / ${n(p.kataWords.total)} үг үзсэн
            </p>
            ${meter(p.kataWords.seen, p.kataWords.total, 'Катакана үг үзсэн ахиц')}
            <p class="p-small">
              ${n(p.kataWords.strong)} бататгасан ·
              ${n(p.kataWords.weak)} сул
            </p>
          </div>
          <button type="button" class="p-btn p-btn-primary"
            data-action="kata-words">
            ${icon('repeat')}
            ${p.kataWords.seen ? 'Үгсээ давтах' : 'Үгсээ сурах'}
          </button>
        </section>

        <section class="p-card" aria-labelledby="p-achievements-title">
          <div class="p-card-head">
            <div>
              <h2 id="p-achievements-title">Таны амжилт</h2>
              <p class="p-muted">Ахицынхаа жижиг үе шатуудыг хараарай.</p>
            </div>
            ${icon('trophy')}
          </div>
          <ul class="p-achievements">
            ${milestones.map(m => `
              <li class="${m.earned ? 'is-earned' : ''}">
                <span class="p-achievement-icon">${icon(m.symbol)}</span>
                <h3>${m.title}</h3>
                <p class="p-small">${m.text}</p>
                <span class="p-achievement-status">
                  ${m.earned ? `${icon('check')} Биелсэн` : 'Дараагийн зорилго'}
                </span>
              </li>
            `).join('')}
          </ul>
        </section>

        <section class="p-card p-sync" aria-labelledby="p-sync-title">
          <div>
            <h2 id="p-sync-title">Ахицын хадгалалт</h2>
            <p class="p-muted">
              ${p.mode === 'user'
                ? 'Бүртгэл холбогдсон. Нэвтрэлт болон синкийн тохиргоогоо нээнэ.'
                : p.mode === 'code'
                  ? 'Нууц код холбогдсон. Төхөөрөмж хоорондын синкээ тохируулна.'
                  : 'Ахиц энэ хөтөч дээр хадгалагдана. Өөр төхөөрөмжтэй холбохын тулд синк тохируулаарай.'}
            </p>
          </div>
          <button type="button" class="p-btn" data-action="sync-open">
            Нэвтрэлт ба синк ${icon('arrow')}
          </button>
        </section>
      </div>
    `;

    /* Claude: график анх нээхэд хамгийн сүүлийн долоо хоног руу; бичиг
       солиход өмнөх гүйлт ба сегментийн фокус хэвээр (Astra-гийн хүсэлт). */
    const keep = profileKeep; profileKeep = null;
    const sc = $('profile-heat-scroll');
    if (sc) {
      // Гарагийн багана sticky; түүний доор хагас орсон сарын шошгыг нууна.
      const days = sc.querySelector('.heat-days');
      const cut = () => { const edge = days.getBoundingClientRect().right; for (const b of sc.querySelectorAll('.heat-month b')) b.classList.toggle('is-cut', b.getBoundingClientRect().left < edge - 1); };
      sc.addEventListener('scroll', cut, { passive: true });
      requestAnimationFrame(() => { sc.scrollLeft = keep && keep.left != null ? keep.left : sc.scrollWidth; cut(); });
    }
    if (keep && keep.focus) { const btn = document.querySelector(`#view-profile [data-action=script][data-script="${keep.focus}"]`); if (btn) btn.focus({ preventScroll: true }); }
    markOverflowSoon($('view-profile'));
  }
  /* Асуултын төрөл бүрийн [дээд шошго, гарчиг]. */
  const QUIZ_HEAD={'jp-mn':['УТГЫГ НЬ ТАНИХ','Ямар утгатай вэ?'],'mn-jp':['ЯПОНООР НЬ САНАХ','Японоор яаж хэлэх вэ?'],'kj-jp':['ХАНЗААР УНШИХ','Хэрхэн уншдаг вэ?'],'kata-hira':['КАТАКАНА УНШИХ','Хираганаар аль нь вэ?'],'hira-kata':['КАТАКАНААР ТАНИХ','Катаканаар аль нь вэ?'],'kj-mn':['ХАНЗНЫ УТГА','Ямар утгатай вэ?'],'mn-kj':['ХАНЗААР НЬ САНАХ','Аль ханз вэ?'],'kj-read':['ХАНЗНЫ УНШЛАГА','Хэрхэн уншдаг вэ?'],'kw-read':['ХАНЗТАЙ ҮГ','Энэ үгийг хэрхэн уншдаг вэ?']};
  function exerciseMarkup(q){
    if(q.type==='learn'&&q.word.kanji)return kanjiLearnMarkup(q);
    if(q.type==='learn')return `<div class="exercise-type">${icon('leaf')}${q.word.kana?'ШИНЭ ҮСЭГ':'ШИНЭ ҮГ'} · ${session.pos+1} / ${session.words.length}</div><h1 id="exercise-title" tabindex="-1">${q.word.kana?'Энэ үсэгтэй танилцаарай.':'Энэ үгтэй танилцаарай.'}</h1><div ${cardAttrs('learn-card',q.word)}>${audioBtn(q.word,' card-audio')}<p class="learn-kana${q.word.kana ? ' is-kana-learn' : ''}" lang="ja">${q.word.kana?esc(q.word.jp):face(q.word.jp,q.word.kj)}</p><p class="learn-meaning">${esc(q.word.mn)}</p></div><p class="learn-hint">Дууны дүрстэй картын аль ч хэсэгт дарж сонсоод, чангаар давтаж уншаарай. Дахин дарвал зогсоно.</p>`;
    if(q.type==='quiz'){const d=q.direction,forward=d==='jp-mn'||d==='kj-mn',mnPrompt=d==='mn-jp'||d==='mn-kj';
      /* Япон→монголоос бусад чиглэлд дуудлага нь ХАРИУЛТ (уншлага) тул шалгасны дараа л. */
      const hear=forward||session.checked,head=QUIZ_HEAD[d]||QUIZ_HEAD['jp-mn'];
      const prompt=forward?face(q.word.jp,q.word.kj):mnPrompt?esc(q.word.mn):d==='kj-jp'?esc(q.word.kj):d==='hira-kata'?esc(q.word.hira):esc(q.word.jp);
      return `<div class="exercise-type">${icon(q.retry?'repeat':'target')}${q.retry?'ДАХИН БАТАТГАЯ':head[0]}</div><h1 id="exercise-title" tabindex="-1">${head[1]}</h1><div ${cardAttrs('quiz-prompt-card',q.word,hear)}><p class="exercise-prompt${mnPrompt?' mn-prompt':''}${d==='kj-jp'||d==='kj-mn'||d==='kj-read'?' kj-prompt':''}${d==='kw-read'?' kw-prompt':''}${q.word.kana?' kana-prompt':''}" ${mnPrompt?'':'lang="ja"'}>${prompt}</p>${hear?audioBtn(q.word):''}</div><div class="choices" role="group" aria-label="Хариултууд">${q.options.map((option,i)=>{let cls=session.selected===i?' selected':'';if(session.checked&&option===q.correct)cls=' correct';else if(session.checked&&session.selected===i&&!session.correct)cls=' incorrect';return `<button class="choice ${forward?'':'jp-choice'}${d==='mn-kj'?' kanji-choice':''}${cls}" data-action="choose" data-option="${i}" aria-pressed="${session.selected===i}" ${session.checked?'disabled':''} ${!forward?'lang="ja"':''}><span class="choice-index">${i+1}</span><span>${d==='mn-jp'?face(option):esc(option)}</span></button>`;}).join('')}</div>`;}
    return `<div class="exercise-type">${icon(q.retry?'repeat':'tiles')}${q.retry?'ДАХИН БАТАТГАЯ':'ҮГСЭЭ ХОЛБОЁ'}</div><h1 id="exercise-title" tabindex="-1">Өгүүлбэрийг эвлүүлээрэй.</h1><p class="exercise-prompt mn-prompt">${esc(q.sentence.mn)}</p><div class="sentence-answer" aria-label="Таны өгүүлбэр" aria-live="polite">${session.selectedTokens.length?session.selectedTokens.map(id=>{const token=q.tokens.find(t=>t.id===id);return `<button class="token" data-action="remove-token" data-token="${id}" ${session.checked?'disabled':''} lang="ja" aria-label="${esc(token.text)}, буцаах">${esc(token.text)}</button>`;}).join(''):'<span class="sentence-placeholder">Доорх үгсийг дарааллаар нь сонгоно уу.</span>'}</div><div class="token-bank" aria-label="Эвлүүлэх үгс">${q.tokens.map(token=>`<button class="token ${session.selectedTokens.includes(token.id)?'used':''}" data-action="token" data-token="${token.id}" ${session.checked||session.selectedTokens.includes(token.id)?'disabled':''} lang="ja">${esc(token.text)}</button>`).join('')}</div><button class="hint-btn" data-action="hint">${session.showHint?'Загварыг нуух':'Тусламж · өгүүлбэрийн загвар'}</button>${session.showHint?`<p class="sentence-hint" lang="ja">${q.sentence.tokens.map(esc).join('　')}</p>`:''}`;
  }
  function renderSession(){if(!session)return;if(session.completed){renderCompletion();return;}const q=session.queue[session.pos];const ready=q.type==='learn'||q.type==='quiz'&&session.selected!==null||q.type==='sentence'&&session.selectedTokens.length===q.tokens.length;const feedback=session.checked?`<div class="feedback ${session.correct?'':'incorrect'}" role="status"><span class="feedback-icon">${icon(session.correct?'check':'repeat')}</span><div><strong>${session.correct?'Зөв байна!':'Дахиад нэг тогтооё.'}</strong><small>${session.correct?(q.retry?'Сайн байна. Санаж хэллээ.':`+${q.type==='sentence'?20:10} XP`):`Зөв хариулт: <span lang="${q.type==='sentence'||(q.direction!=='jp-mn'&&q.direction!=='kj-mn')?'ja':'mn'}">${q.type==='sentence'?esc(q.sentence.tokens.join(' ')):q.direction==='mn-jp'?face(q.correct):esc(q.correct)}</span>`}</small></div></div>`:`<p class="bottom-note">${q.type==='learn'?'Үгээ уншаад дараагийн алхамд ороорой.':q.type==='sentence'?'Үг дээр дарж нэмнэ. Сонгосон үг дээр дарж буцаана.':'Хариултаа сонгоод шалгаарай.'}</p>`;
    /* Ахицын зурвас: давтах асуулт төгсгөлд нэмэгдэхэд УХРАХГҮЙ — суурь нь
       эхний дарааллын урт (`session.base`). Суурь дуусахад 100%, дараа нь «давталтын үе». */
    const base=session.base||(session.base=session.queue.filter(x=>!x.retry).length),extra=session.queue.length-base,inRetry=session.pos>=base,done=Math.min(session.pos,base);
    const metaRight=inRetry?`Алдсан асуултууд · ${session.pos-base+1} / ${extra}`:`${session.pos+1} / ${base}${extra?` <span class="retry-chip">${icon('repeat')}+${extra} давтах</span>`:''}`;
    $('lesson-content').innerHTML=`<div class="lesson-frame${inRetry?' is-retry-phase':''}"><div class="lesson-top"><button class="icon-button" data-action="exit" aria-label="Хичээлээс гарах">${icon('close')}</button><div class="progress-track" role="progressbar" aria-label="Хичээлийн ахиц" aria-valuenow="${done}" aria-valuemin="0" aria-valuemax="${base}"><div class="progress-fill" style="width:${inRetry?100:done/base*100}%"></div></div><span class="session-xp">${session.xp} XP</span>${soundBtn()}</div><div class="lesson-meta"><span>${session.title?esc(session.title):session.test?'🧮 Тооны шалгалт':session.review?'Үзсэн үгсийн давтлага':TOPICS[session.lesson.topic][0]+' · '+(session.lesson.chunk+1)+'-р хичээл'}</span><span>${metaRight}</span></div><section class="exercise">${exerciseMarkup(q)}</section><div class="lesson-bottom${session.checked?(session.correct?' is-correct':' is-incorrect'):''}">${feedback}<button class="primary-btn" data-action="${q.type==='learn'?'next':session.checked?'next':'check'}" ${!session.checked&&!ready?'disabled':''}>${q.type==='learn'?'Уншлаа, үргэлжлүүлье':session.checked?'Үргэлжлүүлэх':'Шалгах'}${icon('arrow')}</button></div></div>`;
  }
  function checkAnswer(){if(!session||session.checked||session.completed)return;const q=session.queue[session.pos];if(q.type==='learn')return;if(q.type==='quiz'&&session.selected===null)return;if(q.type==='sentence'&&session.selectedTokens.length!==q.tokens.length)return;
    const actual=q.type==='quiz'?q.options[session.selected]:session.selectedTokens.map(id=>q.tokens.find(t=>t.id===id).text).join('|');const correct=q.type==='quiz'?actual===q.correct:[q.sentence.tokens,...(q.sentence.alts||[])].some(tokens=>tokens.join('|')===actual);
    session.checked=true;session.correct=correct;
    if(!q.retry){session.firstAnswers++;if(correct)session.firstCorrect++;}
    if(correct)session.xp+=q.retry?4:q.type==='sentence'?20:10;
    if(q.word){const rid=q.rid||q.word.id,r=session.results[rid]||(session.results[rid]={attempts:0,misses:0,correct:0});r.attempts++;if(correct)r.correct++;else r.misses++;}
    sfx(correct?SFX.ok:SFX.bad);
    if(!correct&&!q.retry)session.queue.push({...q,retry:true,...(q.type==='sentence'?{tokens:shuffle(q.tokens)}:{options:shuffle(q.options)})});
    renderSession();
  }
  function nextQuestion(){if(!session||session.completed)return;const q=session.queue[session.pos];if(q.type!=='learn'&&!session.checked)return;session.pos++;if(session.pos>=session.queue.length){finishLesson();return;}session.selected=null;session.selectedTokens=[];session.checked=false;session.showHint=false;renderSession();$('lesson-dialog').scrollTop=0;const h=$('exercise-title');if(h)h.focus({preventScroll:true});markOverflowSoon($('lesson-content'));}
  function finishLesson(){if(session.completed)return;session.completed=true;state.xp+=session.xp;addDayXp(session.xp);if(!session.review&&!state.completed.includes(session.lesson.id))state.completed.push(session.lesson.id);const date=today();const daySet=new Set(Array.isArray(state.days[date])?state.days[date]:[]);
    const store=session.kana?state.kana:state.words;for(const word of session.words){const result=session.results[word.id]||{attempts:0,misses:0,correct:0},prior=store[word.id]||{},passes=result.misses?0:(Number(prior.passes)||0)+1;store[word.id]={passes,weak:result.misses>0,due:shiftDate(date,result.misses?1:passes>=3?7:passes===2?3:1),last:date,attempts:(Number(prior.attempts)||0)+result.attempts,misses:(Number(prior.misses)||0)+result.misses};daySet.add(word.id);}
    state.days[date]=[...daySet];save();updateTop();sfx(SFX.done);renderCompletion();
  }
  function renderCompletion(){const accuracy=session.firstAnswers?Math.round(session.firstCorrect/session.firstAnswers*100):100;const minutes=Math.max(1,Math.round((Date.now()-session.started)/60000));const missed=Object.values(session.results).filter(r=>r.misses).length;
    $('lesson-content').innerHTML=`<div class="lesson-frame"><div class="lesson-top"><button class="icon-button" data-action="finish" aria-label="Сурах зам руу буцах">${icon('close')}</button><div class="progress-track"><div class="progress-fill" style="width:100%"></div></div><span class="session-xp">${session.xp} XP</span>${soundBtn()}</div><section class="completion"><div class="completion-mascot">${mascot()}</div><div class="eyebrow">ӨНӨӨДРИЙН НЭГ АЛХАМ</div><h1>${session.test?'Шалгалт дууслаа!':session.kanji?'Ханзаа бататгалаа!':session.kana?'Катаканаа бататгалаа!':session.review?'Үгсээ бататгалаа!':'Хичээлээ дуусгалаа!'}</h1><p>${session.test?`${session.firstAnswers} асуултад хариуллаа.`:session.kanji?`${session.words.length} ханз дээр ажиллалаа.`:session.kana?`${session.words.length} катакана үсэг дээр ажиллалаа.`:`${session.words.length} үг, хэллэг дээр ажиллалаа.`}<br>${missed?`${missed} алдсан ${session.kanji?'ханзаа':session.kana?'үсгээ':'үгээ'} давтлагад дахин бататгаарай.`:'Дараа нь харахгүйгээр санаж хэлж үзээрэй.'}</p><div class="result-stats"><div class="result-stat"><strong>+${session.xp}</strong><span>ХУРИМТЛУУЛСАН XP</span></div><div class="result-stat"><strong>${accuracy}%</strong><span>ЭХНИЙ ОРОЛДЛОГО</span></div><div class="result-stat"><strong>${minutes}</strong><span>МИНУТ</span></div></div><button class="primary-btn" data-action="finish">Сурах зам руу буцах${icon('arrow')}</button><p class="save-note">${storageWorks?SAVE_TEXT[saveKind()][1]:'Ахиц энэ хөтөч дээр хадгалагдсангүй.'}</p></section></div>`;
  }
  function exitSession(){if(!session||session.completed){closeSession();return;}$('lesson-content').innerHTML=`<div class="lesson-frame"><section class="exit-confirm"><div class="empty-icon">${icon('leaf')}</div><h2>Түр завсарлах уу?</h2><p>Энэ хичээлийн ахиц дуусах үед хадгалагдана. Одоо гарвал энэ хичээлийг эхнээс нь үзнэ.</p><div class="exit-actions"><button class="secondary-btn" data-action="discard">Одоо гарах</button><button class="primary-btn" data-action="resume">Хичээлээ үргэлжлүүлэх</button></div></section></div>`;}
  function closeSession(){$('lesson-dialog').close();session=null;switchView(view);}
  /* ── Тоглоом: буудах, хослуулах, хурдан зөв/буруу ─────────────────
     Эзний хүсэлт (2026-11-02): өмнө цээжилсэн үгсээс санамсаргүйгээр,
     зөвхөн оноо ба рекорд. `state`-д юу ч БИЧИХГҮЙ — XP, streak, өдрийн
     график, давтлагын хуваарь хөндөгдөхгүй. Рекорд нь төхөөрөмж бүрийнх
     (`koto-games`), синк хийгдэхгүй.
     Markup/CSS-ийг Claude хийв (Astra-гийн квот дууссан) — Astra хянана.
     Цаг нь rAF-ийн алхам; нэг алхмыг 100ms-ээр таслана, тиймээс таб
     нуугдаад буцаж ирэхэд үгс «үсрэхгүй». Хүлээлт (`wait`) ч тоглоомын
     цагаар явдаг тул тест `advance(ms)`-ээр урагшлуулна. */
  const GAME_KEY = 'koto-games', GAME_MIN = 6, MATCH_PAIRS = 6;
  const SHOOT_START = 8000, SHOOT_MIN = 3200, SHOOT_LIVES = 3, TF_TIME = 60000;
  const GAMES = {
    shoot: { title: 'Буудах', text: 'Монгол утгыг уншаад доош унаж буй япон үгсээс зөвийг нь буудна. Гурван амьтай, хурд аажмаар нэмэгдэнэ.' },
    match: { title: 'Хослуулах', text: '6 япон үгийг монгол утгатай нь аль болох хурдан хослуулна. Алдаа бүр +1 секунд.' },
    tf: { title: 'Хурдан зөв/буруу', text: '60 секундэд үг ба утга таарч байгаа эсэхийг шийднэ. Дараалсан зөв хариулт оноог үржүүлнэ.' }
  };
  const GAME_ART = {
    shoot: '<span class="ga-bubble" lang="ja">みず</span><span class="ga-bubble is-hit" lang="ja">ねこ</span><span class="ga-bubble" lang="ja">ほん</span><span class="ga-prompt">муур</span>',
    match: '<span class="ga-tile is-on" lang="ja">いぬ</span><span class="ga-tile">уул</span><span class="ga-tile" lang="ja">やま</span><span class="ga-tile is-on">нохой</span>',
    tf: '<span class="ga-card"><b lang="ja">みず</b><i>ус</i></span><span class="ga-chip is-no">✕</span><span class="ga-chip is-yes">✓</span>'
  };
  let game = null, gameRaf = 0, gameLast = 0;

  /* Тоглоомд монгол утгын товч хэлбэр (бүтэн нь 58 тэмдэгт хүрдэг): хаалтын
     ГАДНАХ эхний `;` хүртэл, хаалтгүй. Хаалтгүй хэлбэр үсэггүй («…» — ～ひき)
     эсвэл өөр бичлэгтэй үгийнхтэй давхцвал (～まい/～さつ «… ширхэг») хаалтыг
     үлдээнэ — тоолох нэрийн ялгаа тэнд. Япон жишээг (しちじごろ) хасна —
     эс бөгөөс буудах тоглоомд хариултыг задална. */
  const JA_RUN = /[\s:：—-]*[぀-ヿ㐀-鿿～]+[\s:：—-]*/g;
  function mnCut(mn) {
    mn = String(mn);
    let d = 0, i = 0;
    for (; i < mn.length; i++) {
      const ch = mn[i];
      if (ch === '(') d++; else if (ch === ')') d = Math.max(0, d - 1); else if (ch === ';' && !d) break;
    }
    const first = mn.slice(0, i).trim() || mn;
    return { first, bare: first.replace(/\s*\([^)]*\)/g, '').trim() };
  }
  const bareJp = new Map();
  for (const w of allWords) {
    const b = mnCut(w.mn).bare;
    if (!bareJp.has(b)) bareJp.set(b, new Set());
    bareJp.get(b).add(w.jp);
  }
  function shortMn(w) {
    const c = mnCut(w.mn), keep = !/[\p{L}\p{N}]/u.test(c.bare) || (bareJp.get(c.bare) || { size: 0 }).size > 1;
    const s = (keep ? c.first : c.bare).replace(JA_RUN, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').replace(/\(\)/g, '').replace(/\s{2,}/g, ' ').trim();
    return s || c.first;
  }
  /* Ижил кана өөр утгатай үг бий (に «хоёр» ба に дагавар) — нэг тоглолтод
     хамт орвол зөв хариулт хоёр болно. */
  const meansOf = new Map();
  for (const w of allWords) {
    if (!meansOf.has(w.jp)) meansOf.set(w.jp, new Set());
    meansOf.get(w.jp).add(shortMn(w));
  }
  /** a, b хоёрыг нэг тоглолтод андуурч болох уу: ижил бичлэг, ижил утга, эсвэл ижил бичлэгтэй өөр үгийн утга. */
  function gameClash(a, b) {
    const ma = shortMn(a), mb = shortMn(b);
    const none = new Set();
    return a.jp === b.jp || ma === mb || (meansOf.get(a.jp) || none).has(mb) || (meansOf.get(b.jp) || none).has(ma);
  }
  /** Жагсаалтын дарааллаар, бие биетэйгээ (ба `withWords`-тэй) андуурагдахгүй n үг. */
  function gamePick(list, n, withWords) {
    const out = [], base = withWords || [];
    for (const w of list) {
      if (out.length >= n) break;
      if (!base.concat(out).some(x => gameClash(x, w))) out.push(w);
    }
    return out;
  }
  function gamePool() { return allWords.filter(w => state.words[w.id]); }
  function gameRecords() {
    try {
      const r = JSON.parse(localStorage.getItem(GAME_KEY) || '{}');
      return r && typeof r === 'object' && !Array.isArray(r) ? r : {};
    } catch { return {}; }
  }
  function gameRecord(kind) { const v = Number(gameRecords()[kind]); return v > 0 ? v : null; }
  /** Оноо ихсэх тусам, хослуулахад хугацаа (ms) багасах тусам сайн. */
  function saveGameRecord(kind, value) {
    const old = gameRecord(kind), better = value > 0 && (old === null || (kind === 'match' ? value < old : value > old));
    if (better) {
      const r = gameRecords(); r[kind] = value;
      try { localStorage.setItem(GAME_KEY, JSON.stringify(r)); } catch {}
    }
    return { best: better ? value : old, isNew: better };
  }
  const secs = ms => (ms / 1000).toFixed(1);
  function recordText(kind) {
    const v = gameRecord(kind);
    return v === null ? 'Рекорд алга' : kind === 'match' ? `Рекорд ${secs(v)} сек` : `Рекорд ${v} оноо`;
  }
  /** Дараагийн үг холисон багцаас — бүх үг гарсны дараа л давтагдана, дараалан хоёр удаа гарахгүй. */
  function gameNext() {
    const g = game;
    if (!g.deck.length) {
      g.deck = shuffle(g.pool);
      if (g.last && g.deck.length > 1 && g.deck[g.deck.length - 1].id === g.last.id) g.deck.unshift(g.deck.pop());
    }
    return (g.last = g.deck.pop());
  }
  function gameReady(pool) { return gamePick(shuffle(pool), GAME_MIN).length >= GAME_MIN; }

  function renderGames() {
    const pool = gamePool(), need = Math.max(1, GAME_MIN - pool.length);
    $('view-games').innerHTML = `<div class="eyebrow">ТОГЛООМ</div><h1 class="page-title">Тоглож бататгая.</h1>
      <p class="page-subtitle">Цээжилсэн ${pool.length} үгээсээ санамсаргүйгээр. Оноо, рекорд зөвхөн энэ хөтөч дээр хадгалагдана — XP, давтлагад нөлөөлөхгүй.</p>
      ${gameReady(pool) ? `<div class="game-grid">${Object.keys(GAMES).map(k => `
        <article class="game-card game-card--${k}">
          <div class="game-art" aria-hidden="true">${GAME_ART[k]}</div>
          <div class="game-card-body">
            <h2>${GAMES[k].title}</h2>
            <p>${GAMES[k].text}</p>
            <p class="game-record">${icon('trophy')}<span>${recordText(k)}</span></p>
          </div>
          <button type="button" class="primary-btn" data-action="game" data-game="${k}">Тоглох${icon('play')}</button>
        </article>`).join('')}</div>`
      : `<section class="empty-state"><div class="empty-icon">${icon('game')}</div><h2>Дахиад ${need} үг цээжилбэл нээгдэнэ.</h2>
        <p>Тоглоом таны өмнө үзсэн үгсээс бүрдэнэ — дор хаяж ${GAME_MIN} үг хэрэгтэй.</p>
        <button type="button" class="primary-btn" data-action="start" data-lesson="${nextLesson().id}">Хичээл үзэх${icon('arrow')}</button></section>`}`;
  }

  function openGame(kind) {
    if (!GAMES[kind]) return;
    const pool = gamePool();
    if (!gameReady(pool)) return;
    stopGameLoop();
    game = { kind, pool, deck: [], last: null, score: 0, combo: 0, hits: 0, total: 0, missed: new Map(),
      wait: 0, after: null, over: false, still: matchMedia('(prefers-reduced-motion: reduce)').matches };
    if (kind === 'shoot') Object.assign(game, { hearts: SHOOT_LIVES, dur: SHOOT_START, wave: null });
    if (kind === 'match') Object.assign(game, { t: 0, penalty: 0, mistakes: 0, started: false, finished: false, sel: null, wrong: null, done: new Set(), tiles: [] });
    if (kind === 'tf') Object.assign(game, { left: TF_TIME, card: null });
    if (!$('game-dialog').open) $('game-dialog').showModal();
    $('game-dialog').scrollTop = 0;
    if (kind === 'shoot') shootWave(); else if (kind === 'match') matchDeal(); else tfDeal();
    gameLoop();
  }
  function closeGame() {
    stopGameLoop(); game = null;
    if ($('game-dialog').open) $('game-dialog').close();
    switchView(view);
  }
  function gameOver() {
    const g = game;
    if (!g || g.over) return;
    g.over = true; stopGameLoop();
    const value = g.kind === 'match' ? Math.round(g.t + g.penalty) : g.score;
    g.result = Object.assign({ value }, saveGameRecord(g.kind, value));
    sfx(SFX.done); renderGameEnd();
  }

  /* Цаг: rAF → gameTick (≤100ms) → gameStep. Тест gameStep-ийг шууд дуудна. */
  function gameTick(ts) { const dt = gameLast ? Math.min(ts - gameLast, 100) : 0; gameLast = ts; gameStep(dt); }
  function gameLoop() {
    stopGameLoop();
    const f = ts => { gameTick(ts); if (game && !game.over) gameRaf = requestAnimationFrame(f); };
    gameRaf = requestAnimationFrame(f);
  }
  function stopGameLoop() { cancelAnimationFrame(gameRaf); gameRaf = 0; gameLast = 0; }
  function gameStep(dt) {
    const g = game;
    if (!g || g.over || !(dt > 0)) return;
    if (g.kind === 'match' && g.started && !g.finished) {
      g.t += dt;
      const el = $('match-time'); if (el) el.textContent = secs(g.t + g.penalty);
    }
    if (g.kind === 'tf') {
      g.left = Math.max(0, g.left - dt); paintTfClock();
      if (g.left <= 0) { gameOver(); return; }
    }
    if (g.wait > 0) {
      g.wait -= dt;
      if (g.wait > 0) return;
      g.wait = 0;
      const f = g.after; g.after = null; if (f) f();
      return;
    }
    if (g.kind === 'shoot' && g.wave && !g.wave.done) {
      const w = g.wave; w.t += dt;
      const p = Math.min(1, w.t / w.dur);
      paintShoot(p);
      if (p >= 1) shootMiss();
    }
  }

  function gameFrame(body) {
    const g = game;
    return `<div class="lesson-frame game-frame game-${g.kind}">
      <div class="lesson-top game-top"><button type="button" class="icon-button" data-action="game-exit" aria-label="Тоглоомоос гарах">${icon('close')}</button>
        <div id="game-hud" class="game-hud">${gameHud()}</div>${soundBtn()}</div>
      <div class="lesson-meta"><span>${GAMES[g.kind].title}</span><span>${recordText(g.kind)}</span></div>${body}</div>`;
  }
  function gameHud() {
    const g = game;
    if (g.kind === 'match') return `<span class="game-score"><strong id="match-time">${secs(g.t + g.penalty)}</strong> сек</span><span class="game-pairs">${g.done.size} / ${g.tiles.length / 2} хос</span>`;
    const m = g.kind === 'shoot' ? shootMult(g.combo) : tfMult(g.combo);
    const hearts = g.kind === 'shoot' ? `<span class="game-hearts" role="img" aria-label="${g.hearts} амь үлдсэн">${Array.from({ length: SHOOT_LIVES }, (_, i) => `<span class="game-heart${i < g.hearts ? ' is-on' : ''}">${icon('heart')}</span>`).join('')}</span>` : '';
    return `${hearts}<span class="game-score"><strong>${g.score}</strong> оноо</span><span class="game-combo"${m > 1 ? '' : ' hidden'}>×${m}</span>`;
  }
  function paintHud() { const el = $('game-hud'); if (el && game) el.innerHTML = gameHud(); }
  /** Дахин зурсны дараа гарын фокусыг ижил товч руу буцаана. */
  function keepFocus(attr, render) {
    const ae = document.activeElement, key = ae && ae.closest && ae.closest('#game-dialog') ? ae.getAttribute(attr) : null;
    render();
    if (key === null) return;
    const el = document.querySelector(`#game-content [${attr}="${key}"]`);
    if (el && !el.disabled) el.focus({ preventScroll: true });
  }
  function gameMiss(w) { game.missed.set(w.id, w); }

  /* ── Буудах: 3 зам, нэг нь зөв. Зөв үг газарт хүрвэл амь хасагдана. */
  const shootMult = c => Math.min(5, 1 + Math.floor(c / 3));
  function shootWave() {
    const g = game;
    if (!g || g.over) return;
    const target = gameNext();
    let others = gamePick(shuffle(g.pool), 2, [target]);
    if (others.length < 2) others = others.concat(gamePick(shuffle(allWords), 2 - others.length, [target, ...others]));
    g.wave = { target, words: shuffle([target, ...others]), offs: shuffle([0, .12, .24]), t: 0, dur: g.dur, wrong: [], done: false };
    renderShoot();
  }
  function renderShoot() {
    const g = game, w = g.wave;
    $('game-content').innerHTML = gameFrame(`<section class="shoot-arena" id="shoot-arena" aria-label="Тоглоомын талбар">
      ${w.words.map((x, i) => `<button type="button" class="shoot-target" data-action="game-shoot" data-lane="${i}" style="--lane:${i}" lang="ja"><span class="game-keys" aria-hidden="true">${i + 1}</span>${face(x.jp, x.kj)}</button>`).join('')}
      <div class="shoot-ground" id="shoot-ground"><div class="shoot-fuse" aria-hidden="true"><i id="shoot-fuse"></i></div>
        <p class="shoot-prompt" aria-live="polite"><small>Энэ утгатай үгийг буудаарай</small><strong>${esc(shortMn(w.target))}</strong></p></div></section>
      <p class="game-tip">Зөв үг газарт хүрэхээс өмнө дарна. <span class="game-keys">Гараас: 1 · 2 · 3</span></p>`);
    g.els = [...document.querySelectorAll('#shoot-arena .shoot-target')];
    g.fuse = $('shoot-fuse');
    shootGeo(); paintShoot(0);
  }
  function shootGeo() {
    const g = game, arena = $('shoot-arena'), ground = $('shoot-ground');
    if (!arena || !ground || !g.els) return;
    const H = arena.clientHeight - ground.offsetHeight;
    g.range = g.els.map(el => Math.max(0, H - el.offsetHeight - 10));
  }
  function paintShoot(p) {
    const g = game, w = g.wave;
    if (!w || !g.els || !g.range) return;
    g.els.forEach((el, i) => {
      const r = g.range[i], y = g.still ? r * .08 : r * (p * (1 + w.offs[i]) - w.offs[i]);
      el.style.transform = `translateY(${Math.round(y)}px)`;
    });
    if (g.fuse) g.fuse.style.transform = `scaleX(${1 - p})`;
  }
  function shootMark(i, cls) { const el = game.els && game.els[i]; if (el) { el.classList.add(cls); if (cls === 'is-wrong') el.disabled = true; } }
  /** Онох мөчид буудлагын шугам: утганаас бай руу (хөдөлгөөнгүй горимд үгүй). */
  function shootBeam(i) {
    const arena = $('shoot-arena'), t = game.els[i], pr = arena && arena.querySelector('.shoot-prompt');
    if (!t || !pr || game.still) return;
    const a = arena.getBoundingClientRect(), b = t.getBoundingClientRect(), c = pr.getBoundingClientRect();
    const x1 = c.left + c.width / 2 - a.left, y1 = c.top - a.top, x2 = b.left + b.width / 2 - a.left, y2 = b.top + b.height / 2 - a.top;
    const el = document.createElement('i');
    el.className = 'shoot-beam'; el.setAttribute('aria-hidden', 'true');
    el.style.cssText = `left:${x1}px;top:${y1}px;width:${Math.hypot(x2 - x1, y2 - y1)}px;transform:rotate(${Math.atan2(y2 - y1, x2 - x1)}rad)`;
    arena.appendChild(el);
  }
  function gameShoot(i) {
    const g = game;
    if (!g || g.kind !== 'shoot' || g.over || g.wait > 0) return;
    const w = g.wave, word = w && w.words[i];
    if (!word || w.done || w.wrong.includes(i)) return;
    if (word.id === w.target.id) {
      w.done = true; g.combo++; g.hits++; g.score += 10 * shootMult(g.combo);
      g.dur = Math.max(SHOOT_MIN, g.dur * .94);
      sfx(SFX.ok); shootBeam(i); shootMark(i, 'is-hit'); paintHud();
      g.wait = 380; g.after = shootWave;
      return;
    }
    w.wrong.push(i); g.hearts--; g.combo = 0; gameMiss(w.target);
    sfx(SFX.bad); shootMark(i, 'is-wrong'); paintHud();
    if (g.hearts <= 0) { w.done = true; shootMark(w.words.indexOf(w.target), 'is-reveal'); g.wait = 900; g.after = gameOver; }
  }
  function shootMiss() {
    const g = game, w = g.wave;
    w.done = true; g.hearts--; g.combo = 0; gameMiss(w.target);
    sfx(SFX.bad); shootMark(w.words.indexOf(w.target), 'is-reveal'); paintHud();
    g.wait = 900; g.after = g.hearts <= 0 ? gameOver : shootWave;
  }

  /* ── Хослуулах: 12 хавтан. Ижил талын хоёр дахь хавтас сонголтыг шилжүүлнэ. */
  function matchDeal() {
    const g = game, words = gamePick(shuffle(g.pool), MATCH_PAIRS);
    g.tiles = shuffle(words.flatMap(w => [{ w, side: 'jp' }, { w, side: 'mn' }]));
    renderMatch();
  }
  function renderMatch() {
    const g = game;
    $('game-content').innerHTML = gameFrame(`<p class="game-tip match-tip">Япон үгийг утгатай нь хослуулаарай. Эхний дарахад цаг эхэлнэ.</p>
      <section class="match-board" aria-label="Хослуулах самбар">${g.tiles.map((t, i) => {
        const done = g.done.has(t.w.id), sel = g.sel === i, wrong = !!g.wrong && g.wrong.includes(i), mn = shortMn(t.w);
        const cls = `match-tile is-${t.side}${sel ? ' is-selected' : ''}${wrong ? ' is-wrong' : ''}${done ? ' is-done' : ''}${t.side === 'mn' && mn.length > 22 ? ' is-long' : ''}`;
        return `<button type="button" class="${cls}" data-action="game-tile" data-tile="${i}" aria-pressed="${sel}"${done ? ' disabled' : ''}${t.side === 'jp' ? ' lang="ja"' : ''}>${t.side === 'jp' ? face(t.w.jp, t.w.kj) : esc(mn)}</button>`;
      }).join('')}</section>`);
  }
  function gameTile(i) {
    const g = game;
    if (!g || g.kind !== 'match' || g.over || g.wait > 0) return;
    const t = g.tiles[i];
    if (!t || g.done.has(t.w.id)) return;
    g.started = true;
    const s = g.sel === null ? null : g.tiles[g.sel];
    if (!s || g.sel === i || s.side === t.side) {
      g.sel = g.sel === i ? null : i;
      keepFocus('data-tile', renderMatch);
      return;
    }
    g.sel = null;
    if (s.w.id === t.w.id) {
      g.done.add(t.w.id); g.hits++; sfx(SFX.ok);
      if (g.done.size * 2 === g.tiles.length) { g.finished = true; renderMatch(); g.wait = 350; g.after = gameOver; return; }
      /* Олдсон хавтан идэвхгүй болно — фокус body руу унахгүйн тулд эхний үлдсэн хавтан руу. */
      const ae = document.activeElement, inside = !!(ae && ae.closest && ae.closest('#game-content'));
      renderMatch();
      const next = $('game-content').querySelector('.match-tile:not(:disabled)');
      if (inside && next) next.focus({ preventScroll: true });
      return;
    }
    g.mistakes++; g.penalty += 1000; gameMiss(s.w); gameMiss(t.w); sfx(SFX.bad);
    g.wrong = [g.tiles.indexOf(s), i];
    keepFocus('data-tile', renderMatch);
    g.wait = 450; g.after = () => { g.wrong = null; keepFocus('data-tile', renderMatch); };
  }

  /* ── Хурдан зөв/буруу: 60 сек, хагас нь таарсан хос. Буруу хос нь
     андуурагдахгүй үгийн утга (gameClash) — «に = хоёр» гэж худал гарахгүй. */
  const tfMult = c => Math.min(4, 1 + Math.floor(c / 5));
  function tfDeal() {
    const g = game;
    if (!g || g.over) return;
    const w = gameNext();
    let shown = w, truth = Math.random() < .5;
    if (!truth) { const f = gamePick(shuffle(g.pool), 1, [w])[0]; if (f) shown = f; else truth = true; }
    g.card = { w, shown, truth, state: null };
    keepFocus('data-answer', renderTf);
  }
  function renderTf() {
    const g = game, c = g.card;
    const lock = c.state ? ' aria-disabled="true"' : '';
    $('game-content').innerHTML = gameFrame(`<div class="tf-clock"><div class="progress-track" aria-hidden="true"><div class="progress-fill" id="tf-fill" style="width:${g.left / TF_TIME * 100}%"></div></div>
        <span class="tf-left" role="timer"><strong id="tf-left">${Math.ceil(g.left / 1000)}</strong> сек</span></div>
      <section class="tf-card${c.state ? ' is-' + c.state : ''}" aria-live="polite">
        <p class="tf-q">Утга нь зөв үү?</p>
        <p class="tf-jp" lang="ja">${face(c.w.jp, c.w.kj)}</p>
        <p class="tf-mn">${esc(shortMn(c.shown))}</p>
        ${c.state === 'bad' ? `<p class="tf-reveal">${c.truth ? 'Энэ нь зөв байсан.' : `Зөв утга: ${esc(shortMn(c.w))}`}</p>` : ''}
      </section>
      <div class="tf-actions"><button type="button" class="tf-btn tf-no" data-action="game-tf" data-answer="0"${lock}>${icon('close')}Буруу<span class="game-keys" aria-hidden="true">←</span></button>
        <button type="button" class="tf-btn tf-yes" data-action="game-tf" data-answer="1"${lock}>${icon('check')}Зөв<span class="game-keys" aria-hidden="true">→</span></button></div>`);
  }
  function paintTfClock() {
    const g = game, s = $('tf-left'), f = $('tf-fill');
    if (s) s.textContent = Math.ceil(g.left / 1000);
    if (f) f.style.width = g.left / TF_TIME * 100 + '%';
  }
  function gameTf(yes) {
    const g = game;
    if (!g || g.kind !== 'tf' || g.over || g.wait > 0 || !g.card || g.card.state) return;
    const c = g.card; g.total++;
    if (yes === c.truth) {
      g.hits++; g.combo++; g.score += 10 * tfMult(g.combo); c.state = 'ok'; sfx(SFX.ok);
      g.wait = 160;
    } else {
      g.combo = 0; c.state = 'bad'; gameMiss(c.w); sfx(SFX.bad);
      g.wait = 1100;
    }
    g.after = tfDeal;
    keepFocus('data-answer', renderTf);
  }

  function renderGameEnd() {
    const g = game, r = g.result, missed = [...g.missed.values()].slice(0, 12);
    const best = r.best === null ? '—' : g.kind === 'match' ? secs(r.best) : r.best;
    const stats = g.kind === 'match' ? [[secs(r.value), 'СЕКУНД'], [g.mistakes, 'АЛДАА'], [best, 'РЕКОРД, СЕК']]
      : g.kind === 'shoot' ? [[g.score, 'ОНОО'], [g.hits, 'ОНОСОН ҮГ'], [best, 'РЕКОРД']]
      : [[g.score, 'ОНОО'], [`${g.hits}/${g.total}`, 'ЗӨВ'], [best, 'РЕКОРД']];
    const said = g.kind === 'match' ? `${g.tiles.length / 2} хосыг ${secs(r.value)} секундэд оллоо${g.mistakes ? ` (${g.mistakes} алдаа, +${g.mistakes} сек)` : ''}.`
      : g.kind === 'shoot' ? `${g.hits} үг онож, ${g.score} оноо авлаа.`
      : `60 секундэд ${g.total} үгнээс ${g.hits}-д нь зөв хариуллаа.`;
    $('game-content').innerHTML = `<div class="lesson-frame game-frame">
      <div class="lesson-top game-top"><button type="button" class="icon-button" data-action="game-exit" aria-label="Тоглоом руу буцах">${icon('close')}</button>
        <div class="progress-track"><div class="progress-fill" style="width:100%"></div></div>${soundBtn()}</div>
      <section class="completion game-end"><div class="eyebrow">${esc(GAMES[g.kind].title.toUpperCase())}</div>
        <h1 id="game-end-title" tabindex="-1">${r.isNew ? 'Шинэ рекорд!' : g.kind === 'shoot' ? 'Тоглолт дууслаа' : 'Сайн тоглолоо!'}</h1>
        <p>${said}</p>
        <div class="result-stats">${stats.map(([v, l]) => `<div class="result-stat"><strong>${esc(v)}</strong><span>${l}</span></div>`).join('')}</div>
        ${missed.length ? `<div class="game-missed"><h2>Алдсан үгс</h2><ul>${missed.map(w => `<li><span class="game-missed-jp" lang="ja">${face(w.jp, w.kj)}</span><span class="game-missed-mn">${esc(w.mn)}</span>${audioBtn(w)}</li>`).join('')}</ul></div>` : ''}
        <div class="exit-actions game-actions"><button type="button" class="secondary-btn" data-action="game-exit">Тоглоом руу буцах</button>
          <button type="button" class="primary-btn" data-action="game-again">Дахин тоглох${icon('repeat')}</button></div>
      </section></div>`;
    const h = $('game-end-title'); if (h) h.focus({ preventScroll: true });
  }

  document.addEventListener('click',event=>{
    const button=event.target.closest('button,a');
    // Картын хоосон хэсэг: текст сонгож байгаа үед (давхар товшилт г.м.) дуудахгүй.
    if(!button){const card=event.target.closest('.say-card');if(card&&!String(getSelection()))sayId(card.dataset.auFor);return;}
    if(button.dataset.view){switchView(button.dataset.view);return;}
    const action=button.dataset.action;if(!action)return;
    if(action==='say'){sayId(button.dataset.auFor);return;}
    if(action==='sync-open'){openSync();return;}
    if(action==='script'){const sc=$('profile-heat-scroll');profileKeep={left:sc?sc.scrollLeft:null,focus:button.dataset.script==='kanji'?'kanji':'kana'};setScript(button.dataset.script);switchView(view);return;}
    if(action==='kana-lesson'){startKana(Number(button.dataset.kana));return;}
    if(action==='kana-review'){startKanaReview();return;}
    if(action==='kata-words'){startKataWords();return;}
    if(action==='kanji-lesson'){startKanji(Number(button.dataset.kanji));return;}
    if(action==='kanji-review'){startKanjiReview();return;}
    if(action==='game'){openGame(button.dataset.game);return;}
    if(action==='game-shoot'){gameShoot(Number(button.dataset.lane));return;}
    if(action==='game-tile'){gameTile(Number(button.dataset.tile));return;}
    if(action==='game-tf'){gameTf(button.dataset.answer==='1');return;}
    if(action==='game-again'){if(game)openGame(game.kind);return;}
    if(action==='game-exit'){closeGame();return;}
    if(action==='sound'){soundOn=!soundOn;try{localStorage.setItem(SOUND_KEY,soundOn?'1':'0');}catch{}renderSession();if(game&&button.closest('#game-dialog')){button.outerHTML=soundBtn();const nb=document.querySelector('#game-dialog [data-action=sound]');if(nb)nb.focus();}if(soundOn)sfx(SFX.ok);return;}
    if(action==='start')startLesson(button.dataset.lesson);
    else if(action==='review')startReview();
    else if(action==='test')startTest();
    else if(action==='topic'){state.selectedTopic=Number(button.dataset.topic);save();renderHome();$('current-unit').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});}
    else if(action==='choose'&&session&&!session.checked){session.selected=Number(button.dataset.option);renderSession();}
    else if(action==='check')checkAnswer();
    else if(action==='next')nextQuestion();
    else if(action==='token'&&session&&!session.checked){const id=Number(button.dataset.token);if(!session.selectedTokens.includes(id))session.selectedTokens.push(id);renderSession();}
    else if(action==='remove-token'&&session&&!session.checked){session.selectedTokens=session.selectedTokens.filter(id=>id!==Number(button.dataset.token));renderSession();}
    else if(action==='hint'&&session){session.showHint=!session.showHint;renderSession();}
    else if(action==='exit')exitSession();
    else if(action==='resume')renderSession();
    else if(action==='finish'||action==='discard')closeSession();
  });
  document.addEventListener('input',event=>{if(event.target.id==='word-search')filterWords();});
  document.addEventListener('change',event=>{if(event.target.id==='word-topic')filterWords();});
  $('lesson-dialog').addEventListener('cancel',event=>{event.preventDefault();exitSession();});
  $('game-dialog').addEventListener('cancel',event=>{event.preventDefault();closeGame();});
  /* Тоглоом: 1·2·3 — буудах зам, ←/→ — буруу/зөв. Esc нь `cancel`-аар. */
  document.addEventListener('keydown',event=>{
    if(!game||game.over||!$('game-dialog').open||event.altKey||event.ctrlKey||event.metaKey)return;
    if(game.kind==='shoot'&&['1','2','3'].includes(event.key)){event.preventDefault();gameShoot(Number(event.key)-1);}
    else if(game.kind==='tf'&&(event.key==='ArrowLeft'||event.key==='ArrowRight')){event.preventDefault();gameTf(event.key==='ArrowRight');}
  });
  window.addEventListener('resize',()=>{if(game&&game.kind==='shoot'&&!game.over)shootGeo();});
  document.addEventListener('keydown',event=>{
    if(!session||session.completed||!$('lesson-dialog').open||!$('exercise-title'))return;
    // Сонголт доторх урт ханзыг сумаар гүйлгэнэ (Tab-ийн нэмэлт цэг үүсгэхгүй).
    const ae=document.activeElement;if((event.key==='ArrowLeft'||event.key==='ArrowRight')&&ae&&ae.classList.contains('choice')){const line=ae.querySelector('.jp-face-line');if(line&&line.scrollWidth>line.clientWidth){line.scrollLeft+=event.key==='ArrowRight'?48:-48;event.preventDefault();}return;}
    const q=session.queue[session.pos];if(event.key==='Enter'){event.preventDefault();if(q.type==='learn'||session.checked)nextQuestion();else checkAnswer();}
    else if(q.type==='quiz'&&!session.checked&&['1','2','3','4'].includes(event.key)){session.selected=Number(event.key)-1;renderSession();}
  });
  window.addEventListener('hashchange',()=>{const next=location.hash.slice(1);if(next!==view)switchView(next);});
  const syncBtn=$('open-sync');if(syncBtn)syncBtn.addEventListener('click',openSync);
  initIcons();switchView(location.hash.slice(1)||'learn');
  /* Хоолойн жагсаалт хөтөч дээр ХОЖУУ дүүрдэг тул нэг удаа уншаад
     өнгөрвөл `jaVoice` үргэлж null болно. */
  pickVoice();
  if(canSpeak&&typeof speechSynthesis.addEventListener==='function')
    speechSynthesis.addEventListener('voiceschanged',pickVoice);
  /* Код хадгалагдсан бол нээгдмэгц ТАТНА: нөгөө төхөөрөмж дээр
     хийсэн ахиц шууд харагдана. Чимээгүй — холболт байхгүй байж
     болно, тэр нь алдаа биш. */
  /* Google-ээс буцаж ирсэн бол `?code=`-ийг ЭХЛЭЭД токен болгоно —
     тэгэхгүй бол `syncMode()` нь хуучин төлөвөөр шийдэж, шинэ
     нэвтрэлт анзаарагдахгүй. Локал ахиц байвал татахдаа НЭГДЭНЭ
     (`kotoMerge`), тиймээс нэвтрэхээс өмнөх хөдөлмөр үрэгдэхгүй. */
  (async () => {
    const fresh = await authFinish();
    if (syncMode()) await syncPull(true);
    if (fresh) { updateTop(); switchView(view); toast('Нэвтэрлээ. Ахиц нийлүүлэгдлээ.'); }
  })();
  /* ТЕСТИЙН гарц. `kotoMerge` нь `koto_put` дахь SQL-тэй ИЖИЛ дүрэмтэй
     байх ёстой — хоёр нь салж явбал нэг талын ахиц алдагдана.
     Апп нь IIFE тул гаднаас хандах өөр арга алга. Зөвхөн ЛОКАЛ
     өгөгдөл тул нийтэд хортой зүйл нээхгүй. */
  window.KOTO={merge:kotoMerge,state:()=>state,pull:syncPull,push:syncPush,
    code:()=>syncCode,on:syncOn,mode:syncMode,
    words:()=>allWords,say:sayWord,hear:canHear,playing:()=>auNow,
    signedIn:signedIn,user:authUser,signOut:signOut,googleIn:googleIn,
    numTest:{build:buildTest,genDate,genTime,MONTHS,DAYS,HOURS,session:()=>session},
    kanji:{list:()=>KANJI,lessons:()=>kanjiLessons,data:kanjiData,quizzes:kanjiQuizzes,pick:kanjiPick,start:startKanji,review:startKanjiReview,due:kanjiDue,read:kanjiRead},
    games:{pool:gamePool,pick:gamePick,clash:gameClash,short:shortMn,ready:gameReady,start:openGame,close:closeGame,state:()=>game,
      advance:gameStep,tick:gameTick,stop:stopGameLoop,records:gameRecords,min:GAME_MIN},
    profile:{data:profileData,heat:heatWeeks,longest:longestStreak,dev:()=>devId,script:()=>scriptMode,kana:()=>KANA,kanaLessons:()=>kanaLessons,kata:()=>kataWords}};
})();
