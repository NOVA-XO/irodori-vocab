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
  const SENTENCES = [
    {mn:'Энэ юу вэ?',tokens:['これ','は','なん','です','か']},
    {mn:'Би Монголоос ирсэн.',tokens:['わたし','は','モンゴル','から','きました']},
    {mn:'Япон хэлийг бага зэрэг ойлгодог.',tokens:['にほんご','が','すこし','わかります'],alts:[['すこし','にほんご','が','わかります']]},
    {mn:'Талх, өндөг иддэг.',tokens:['パン','と','たまご','を','たべます'],alts:[['たまご','と','パン','を','たべます']]},
    {mn:'Ширээн дээр хайч байна.',tokens:['つくえ','の','うえ','に','はさみ','が','あります'],alts:[['はさみ','が','つくえ','の','うえ','に','あります']]},
    {mn:'Өрөө нам гүм.',tokens:['へや','は','しずか','です']},
    {mn:'Долоон цагт босдог.',tokens:['しちじ','に','おきます']},
    {mn:'Гэртээ цэвэрлэгээ хийдэг.',tokens:['うち','で','そうじ','を','します'],alts:[['そうじ','を','うち','で','します']]},
    {mn:'Хөл бөмбөгт дуртай.',tokens:['サッカー','が','すき','です']},
    {mn:'Автобусаар компани руу ирдэг.',tokens:['バス','で','かいしゃ','に','きます'],alts:[['かいしゃ','に','バス','で','きます']]},
    {mn:'Үүнийг өгөөч.',tokens:['これ','を','ください']},
    {mn:'Монголын өвөл хүйтэн.',tokens:['モンゴル','の','ふゆ','は','さむい','です']},
    {mn:'Ресторанд ажилладаг.',tokens:['レストラン','で','はたらきます']},
    {mn:'Танилцахдаа хэлэх эелдэг мэндчилгээг эвлүүлээрэй.',tokens:['どうぞ','よろしく','おねがいします']},
    {mn:'Япон хэл сурмаар байна.',tokens:['にほんご','を','べんきょう','したい','です']},
    {mn:'Гуч орчим минут зарцуулдаг.',tokens:['さんじゅっぷん','ぐらい','かかります']},
    {mn:'Миний төрсөн өдөр 4-р сарын 8-нд.',tokens:['わたし','の','たんじょうび','は','しがつ','ようか','です']}
  ];
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
    search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
    target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    leaf:'<path d="M20 3C7 1 1 10 7 17s15-1 13-14ZM6 20 17 7"/>',
    tiles:'<rect x="3" y="4" width="8" height="7" rx="2"/><rect x="13" y="4" width="8" height="7" rx="2"/><rect x="7" y="14" width="10" height="7" rx="2"/>',
    trophy:'<path d="M8 3h8v7a4 4 0 0 1-8 0ZM8 5H4v3c0 3 2 5 5 5m7-8h4v3c0 3-2 5-5 5m-3 1v6m-4 1h8"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
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
  function emptyState(){return {version:1,xp:0,completed:[],words:{},days:{},selectedTopic:0};}
  let storageWorks=true;
  function readState(){try{const s=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(!s||s.version!==1)return emptyState();return {version:1,xp:Math.max(0,Number(s.xp)||0),completed:Array.isArray(s.completed)?s.completed.filter(id=>lessonById[id]):[],words:s.words&&typeof s.words==='object'&&!Array.isArray(s.words)?s.words:{},days:s.days&&typeof s.days==='object'&&!Array.isArray(s.days)?s.days:{},selectedTopic:Number.isInteger(s.selectedTopic)&&DATA[s.selectedTopic]?s.selectedTopic:0};}catch{return emptyState();}}
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

    // Үгийн хуваарь: `step` ИХ нь ялна; тэнцвэл `due` ХОЛ нь. `weak` нь
    // ялсан талынхыг дагана — тусад нь OR хийвэл тогтсон үг «алдсан»
    // хэвээр үлдэж, эхнээс давтагдана.
    const words = {};
    for (const key of new Set([...Object.keys(obj(a.words)), ...Object.keys(obj(b.words))])) {
      const x = obj(obj(a.words)[key]), y = obj(obj(b.words)[key]);
      if (!Object.keys(x).length) { words[key] = y; continue; }
      if (!Object.keys(y).length) { words[key] = x; continue; }
      const sx = num(x.step), sy = num(y.step);
      words[key] = sx !== sy ? (sx > sy ? x : y)
                 : String(x.due || '') >= String(y.due || '') ? x : y;
    }
    // Өдрийн ахиц: нэг өдөр хоёр төхөөрөмж дээр ӨӨР үг давтсан байж
    // болно — нэгдэл авна.
    const days = {};
    for (const key of new Set([...Object.keys(obj(a.days)), ...Object.keys(obj(b.days))])) {
      days[key] = [...new Set([...arr(obj(a.days)[key]), ...arr(obj(b.days)[key])])];
    }
    return {
      version: 1,
      xp: Math.max(num(a.xp), num(b.xp)),
      completed: [...new Set([...arr(a.completed), ...arr(b.completed)])],
      words: words,
      days: days,
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
      if (saved) { state = readStateFrom(saved); save(); updateTop(); }
      if (!quiet) toast('Ахиц хадгалагдлаа.');
      return true;
    } catch (e) {
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
  /** Сонсох боломж бий юу — бичлэг ЭСВЭЛ хоолой. */
  const canHear=w=>!!(w&&(w.au||canSpeak));

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
  function updateAvatar(){const el=$('open-sync-top');if(!el)return;const u=syncMode()==='user'?authUser():null;const name=String((u&&(u.name||u.email))||'Хэрэглэгч');const photo=u&&typeof u.avatar==='string'&&u.avatar.indexOf('https://')===0?u.avatar:'';const key=u?name+'|'+photo:'';if(key===avatarKey)return;avatarKey=key;el.setAttribute('aria-label',u?name+' — нэвтрэлт ба ахицын синк':'Нэвтрэлт ба ахицын синк');el.innerHTML=u?`<span class="avatar-fallback" aria-hidden="true">${esc((Array.from(name.trim())[0]||'Х').toLocaleUpperCase())}</span>${photo?`<img src="${esc(photo)}" alt="" width="44" height="44" referrerpolicy="no-referrer">`:''}`:'<span class="avatar-fallback" lang="ja" aria-hidden="true">わ</span>';}
  function updateTop(){$('xp').textContent=state.xp;$('streak').textContent=streak();$('review-dot').hidden=!dueWords().length;updateAvatar();}
  function switchView(next){view=['learn','words','review'].includes(next)?next:'learn';document.querySelectorAll('.view').forEach(el=>el.hidden=el.id!==`view-${view}`);document.querySelectorAll('.nav-item').forEach(el=>{el.classList.toggle('active',el.dataset.view===view);if(el.dataset.view===view)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});$('page-name').textContent={learn:'Миний сурах зам',words:'Миний үгийн сан',review:'Давтах цаг'}[view];if(view==='learn')renderHome();if(view==='words')renderWords();if(view==='review')renderReview();location.hash=view;updateTop();}
  function weekMarkup(){const d=today();const weekday=new Date(d+'T12:00:00Z').getUTCDay();const monday=shiftDate(d,-((weekday+6)%7));return ['Да','Мя','Лх','Пү','Ба','Бя','Ня'].map((label,i)=>{const date=shiftDate(monday,i),done=Array.isArray(state.days[date])&&state.days[date].length;return `<div class="week-day ${date===d?'today':''} ${done?'done':''}" aria-label="${label}${done?' хичээллэсэн':''}"><span>${done?'✓':label.slice(0,1)}</span>${label}</div>`;}).join('');}
  function renderHome(){
    const t=state.selectedTopic,group=topicLessons(t),completed=group.filter(l=>state.completed.includes(l.id)).length,current=group.find(l=>!state.completed.includes(l.id))||group[0];
    const count=dayWords().length;
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
  function wordCard(w){const learned=state.words[w.id];return `<article class="word-card"><p class="word-topic">${esc(TOPICS[w.topic][0])}</p><div class="word-heading"><h2 class="word-kana" lang="ja">${esc(w.jp)}</h2>${audioBtn(w)}</div><p class="word-meaning">${esc(w.mn)}</p><span class="word-status ${learned?'learned':''}">${icon(learned&&learned.weak?'repeat':learned?'check':'book')}${learned?(learned.weak?'Дахин бататгана':'Үзсэн үг'):'Шинэ үг'}</span></article>`;}
  function renderWords(){
    $('view-words').innerHTML=`<div class="eyebrow">ТАНЫ ҮГИЙН САН</div><h1 class="page-title">Үг бүр нэг алхам.</h1><p class="page-subtitle">${allWords.length} үг, хэллэг · ${Object.keys(state.words).filter(id=>wordById[id]).length} үг үзсэн · Латин уншлагагүй</p><div class="word-toolbar"><label class="search-wrap"><span class="sr-only" style="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)">Япон эсвэл монгол үгээр хайх</span>${icon('search')}<input id="word-search" class="search-input" placeholder="Япон эсвэл монгол үгээр хайх…" autocomplete="off"></label><select id="word-topic" class="topic-select" aria-label="Сэдэв сонгох"><option value="all">Бүх сэдэв</option>${TOPICS.map((t,i)=>`<option value="${i}">${t[0]}</option>`).join('')}</select></div><p id="word-result-count" class="page-subtitle" role="status" style="margin:0 0 18px"></p><div id="word-results" class="word-grid"></div>`;
    filterWords();
  }
  function filterWords(){const query=$('word-search').value.trim().toLocaleLowerCase(),topic=$('word-topic').value;const words=allWords.filter(w=>(topic==='all'||w.topic===Number(topic))&&(!query||w.jp.toLowerCase().includes(query)||w.mn.toLocaleLowerCase().includes(query)));$('word-result-count').textContent=`${words.length} үг, хэллэг`;$('word-results').innerHTML=words.length?words.map(wordCard).join(''):'<p class="page-subtitle">Тохирох үг олдсонгүй. Өөр үгээр хайгаарай.</p>';}
  function renderReview(){const learned=allWords.filter(w=>state.words[w.id]),due=dueWords(),weak=weakWords();$('view-review').innerHTML=`<div class="eyebrow">ДАВТЛАГА</div><h1 class="page-title">Санаж байна уу?</h1><p class="page-subtitle">Өмнө үзсэн үгсээ монгол утга болон япон бичлэгээс нь санаж хэлээрэй.</p>${!learned.length?`<section class="empty-state"><div class="empty-icon">${icon('repeat')}</div><h2>Эхний үгсээ суръя.</h2><p>Хичээлээ дуусгасны дараа үзсэн болон алдсан үгс чинь энд гарна.</p><button class="primary-btn" data-action="start" data-lesson="${nextLesson().id}">Эхний хичээл${icon('arrow')}</button></section>`:`<section class="review-banner"><div><h2>${due.length?`${due.length} үг давтахад бэлэн`:'Өнөөдрийн давтлага бэлэн'}</h2><p>${weak.length?`${weak.length} алдсан үгээс эхэлнэ. `:''}Нэг удаад 5 хүртэл үгээ бататгана.</p></div><button class="primary-btn" data-action="review">Давтаж эхлэх${icon('repeat')}</button></section><div class="section-heading"><h2>${weak.length?'Бататгах үгс':'Үзсэн үгс'}</h2><span class="meta">${weak.length||learned.length} үг</span></div><div class="word-grid">${(weak.length?weak:learned).map(wordCard).join('')}</div>`}`;}
  function quiz(word,direction){const correct=direction==='jp-mn'?word.mn:word.jp;const pool=allWords.filter(w=>w.id!==word.id&&w.jp!==word.jp&&w.mn!==word.mn);const near=shuffle(pool.filter(w=>w.topic===word.topic)),far=shuffle(pool.filter(w=>w.topic!==word.topic));const unique=[];for(const w of near.concat(far)){const value=direction==='jp-mn'?w.mn:w.jp;if(value!==correct&&!unique.includes(value))unique.push(value);if(unique.length===3)break;}return {type:'quiz',word,direction,correct,options:shuffle([correct,...unique]),retry:false};}
  function buildQueue(words,isReview,topic){const queue=isReview?[]:words.map(word=>({type:'learn',word}));queue.push(...shuffle(words.flatMap(w=>[quiz(w,'jp-mn'),quiz(w,'mn-jp')])));if(!isReview){const sentence=SENTENCES[topic];queue.push({type:'sentence',sentence,tokens:shuffle(sentence.tokens.map((text,i)=>({text,id:i}))),retry:false});}return queue;}
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
  function startLesson(id){const lesson=lessonById[id];if(!lesson)return;session={lesson,review:false,words:lesson.words,queue:buildQueue(lesson.words,false,lesson.topic),pos:0,selected:null,selectedTokens:[],checked:false,correct:false,showHint:false,xp:0,firstAnswers:0,firstCorrect:0,results:{},started:Date.now(),completed:false};openSession();}
  function startReview(){const studied=allWords.filter(w=>state.words[w.id]);const due=dueWords();const words=shuffle(due.length?due:studied).sort((a,b)=>Number(!!state.words[b.id].weak)-Number(!!state.words[a.id].weak)).slice(0,5);if(!words.length){startLesson(nextLesson().id);return;}session={review:true,lesson:null,words,queue:buildQueue(words,true,words[0].topic),pos:0,selected:null,selectedTokens:[],checked:false,correct:false,showHint:false,xp:0,firstAnswers:0,firstCorrect:0,results:{},started:Date.now(),completed:false};openSession();}
  function openSession(){renderSession();if(!$('lesson-dialog').open)$('lesson-dialog').showModal();$('lesson-dialog').scrollTop=0;}
  function exerciseMarkup(q){
    if(q.type==='learn')return `<div class="exercise-type">${icon('leaf')}ШИНЭ ҮГ · ${session.pos+1} / ${session.words.length}</div><h1 id="exercise-title" tabindex="-1">Энэ үгтэй танилцаарай.</h1><div class="learn-card"><p class="learn-kana" lang="ja">${esc(q.word.jp)}</p><p class="learn-meaning">${esc(q.word.mn)}</p>${canHear(q.word)?`<button type="button" class="speak-button audio-button audio-button-wide" data-action="say" data-au-for="${esc(q.word.id)}" aria-label="Дуудлагыг сонсох"><svg class="icon audio-speaker" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/></svg><span class="audio-bars" aria-hidden="true"><i></i><i></i><i></i></span><span class="audio-copy" aria-hidden="true"><span class="audio-idle">Сонсох</span><span class="audio-active">Тоглож байна</span></span></button>`:''}</div><p class="learn-hint">Канагаар нь чангаар уншаад, утгатай нь холбоорой.</p>`;
    if(q.type==='quiz'){const forward=q.direction==='jp-mn';return `<div class="exercise-type">${icon(q.retry?'repeat':'target')}${q.retry?'ДАХИН БАТАТГАЯ':forward?'УТГЫГ НЬ ТАНИХ':'ЯПОНООР НЬ САНАХ'}</div><h1 id="exercise-title" tabindex="-1">${forward?'Ямар утгатай вэ?':'Японоор яаж хэлэх вэ?'}</h1><div class="quiz-prompt-card"><p class="exercise-prompt ${forward?'':'mn-prompt'}" ${forward?'lang="ja"':''}>${esc(forward?q.word.jp:q.word.mn)}</p>${forward||session.checked?audioBtn(q.word):''}</div><div class="choices" role="group" aria-label="Хариултууд">${q.options.map((option,i)=>{let cls=session.selected===i?' selected':'';if(session.checked&&option===q.correct)cls=' correct';else if(session.checked&&session.selected===i&&!session.correct)cls=' incorrect';return `<button class="choice ${forward?'':'jp-choice'}${cls}" data-action="choose" data-option="${i}" aria-pressed="${session.selected===i}" ${session.checked?'disabled':''} ${!forward?'lang="ja"':''}><span class="choice-index">${i+1}</span><span>${esc(option)}</span></button>`;}).join('')}</div>`;}
    return `<div class="exercise-type">${icon(q.retry?'repeat':'tiles')}${q.retry?'ДАХИН БАТАТГАЯ':'ҮГСЭЭ ХОЛБОЁ'}</div><h1 id="exercise-title" tabindex="-1">Өгүүлбэрийг эвлүүлээрэй.</h1><p class="exercise-prompt mn-prompt">${esc(q.sentence.mn)}</p><div class="sentence-answer" aria-label="Таны өгүүлбэр" aria-live="polite">${session.selectedTokens.length?session.selectedTokens.map(id=>{const token=q.tokens.find(t=>t.id===id);return `<button class="token" data-action="remove-token" data-token="${id}" ${session.checked?'disabled':''} lang="ja" aria-label="${esc(token.text)}, буцаах">${esc(token.text)}</button>`;}).join(''):'<span class="sentence-placeholder">Доорх үгсийг дарааллаар нь сонгоно уу.</span>'}</div><div class="token-bank" aria-label="Эвлүүлэх үгс">${q.tokens.map(token=>`<button class="token ${session.selectedTokens.includes(token.id)?'used':''}" data-action="token" data-token="${token.id}" ${session.checked||session.selectedTokens.includes(token.id)?'disabled':''} lang="ja">${esc(token.text)}</button>`).join('')}</div><button class="hint-btn" data-action="hint">${session.showHint?'Загварыг нуух':'Тусламж · өгүүлбэрийн загвар'}</button>${session.showHint?`<p class="sentence-hint" lang="ja">${q.sentence.tokens.map(esc).join('　')}</p>`:''}`;
  }
  function renderSession(){if(!session)return;if(session.completed){renderCompletion();return;}const q=session.queue[session.pos];const ready=q.type==='learn'||q.type==='quiz'&&session.selected!==null||q.type==='sentence'&&session.selectedTokens.length===q.tokens.length;const feedback=session.checked?`<div class="feedback ${session.correct?'':'incorrect'}" role="status"><span class="feedback-icon">${icon(session.correct?'check':'repeat')}</span><div><strong>${session.correct?'Зөв байна!':'Дахиад нэг тогтооё.'}</strong><small>${session.correct?(q.retry?'Сайн байна. Санаж хэллээ.':`+${q.type==='sentence'?20:10} XP`):`Зөв хариулт: <span lang="${q.type==='sentence'||q.direction==='mn-jp'?'ja':'mn'}">${esc(q.type==='sentence'?q.sentence.tokens.join(' '):q.correct)}</span>`}</small></div></div>`:`<p class="bottom-note">${q.type==='learn'?'Үгээ уншаад дараагийн алхамд ороорой.':q.type==='sentence'?'Үг дээр дарж нэмнэ. Сонгосон үг дээр дарж буцаана.':'Хариултаа сонгоод шалгаарай.'}</p>`;
    $('lesson-content').innerHTML=`<div class="lesson-frame"><div class="lesson-top"><button class="icon-button" data-action="exit" aria-label="Хичээлээс гарах">${icon('close')}</button><div class="progress-track" role="progressbar" aria-label="Хичээлийн ахиц" aria-valuenow="${session.pos}" aria-valuemin="0" aria-valuemax="${session.queue.length}"><div class="progress-fill" style="width:${session.pos/session.queue.length*100}%"></div></div><span class="session-xp">${session.xp} XP</span></div><div class="lesson-meta"><span>${session.test?'🧮 Тооны шалгалт':session.review?'Үзсэн үгсийн давтлага':TOPICS[session.lesson.topic][0]+' · '+(session.lesson.chunk+1)+'-р хичээл'}</span><span>${session.pos+1} / ${session.queue.length}</span></div><section class="exercise">${exerciseMarkup(q)}</section><div class="lesson-bottom">${feedback}<button class="primary-btn" data-action="${q.type==='learn'?'next':session.checked?'next':'check'}" ${!session.checked&&!ready?'disabled':''}>${q.type==='learn'?'Уншлаа, үргэлжлүүлье':session.checked?'Үргэлжлүүлэх':'Шалгах'}${icon('arrow')}</button></div></div>`;
  }
  function checkAnswer(){if(!session||session.checked||session.completed)return;const q=session.queue[session.pos];if(q.type==='learn')return;if(q.type==='quiz'&&session.selected===null)return;if(q.type==='sentence'&&session.selectedTokens.length!==q.tokens.length)return;
    const actual=q.type==='quiz'?q.options[session.selected]:session.selectedTokens.map(id=>q.tokens.find(t=>t.id===id).text).join('|');const correct=q.type==='quiz'?actual===q.correct:[q.sentence.tokens,...(q.sentence.alts||[])].some(tokens=>tokens.join('|')===actual);
    session.checked=true;session.correct=correct;
    if(!q.retry){session.firstAnswers++;if(correct)session.firstCorrect++;}
    if(correct)session.xp+=q.retry?4:q.type==='sentence'?20:10;
    if(q.word){const r=session.results[q.word.id]||(session.results[q.word.id]={attempts:0,misses:0,correct:0});r.attempts++;if(correct)r.correct++;else r.misses++;}
    if(!correct&&!q.retry)session.queue.push({...q,retry:true,...(q.type==='sentence'?{tokens:shuffle(q.tokens)}:{options:shuffle(q.options)})});
    renderSession();
  }
  function nextQuestion(){if(!session||session.completed)return;const q=session.queue[session.pos];if(q.type!=='learn'&&!session.checked)return;session.pos++;if(session.pos>=session.queue.length){finishLesson();return;}session.selected=null;session.selectedTokens=[];session.checked=false;session.showHint=false;renderSession();$('lesson-dialog').scrollTop=0;const h=$('exercise-title');if(h)h.focus({preventScroll:true});}
  function finishLesson(){if(session.completed)return;session.completed=true;state.xp+=session.xp;if(!session.review&&!state.completed.includes(session.lesson.id))state.completed.push(session.lesson.id);const date=today();const daySet=new Set(Array.isArray(state.days[date])?state.days[date]:[]);
    for(const word of session.words){const result=session.results[word.id]||{attempts:0,misses:0,correct:0},prior=state.words[word.id]||{},passes=result.misses?0:(Number(prior.passes)||0)+1;state.words[word.id]={passes,weak:result.misses>0,due:shiftDate(date,result.misses?1:passes>=3?7:passes===2?3:1),last:date,attempts:(Number(prior.attempts)||0)+result.attempts,misses:(Number(prior.misses)||0)+result.misses};daySet.add(word.id);}
    state.days[date]=[...daySet];save();updateTop();renderCompletion();
  }
  function renderCompletion(){const accuracy=session.firstAnswers?Math.round(session.firstCorrect/session.firstAnswers*100):100;const minutes=Math.max(1,Math.round((Date.now()-session.started)/60000));const missed=Object.values(session.results).filter(r=>r.misses).length;
    $('lesson-content').innerHTML=`<div class="lesson-frame"><div class="lesson-top"><button class="icon-button" data-action="finish" aria-label="Сурах зам руу буцах">${icon('close')}</button><div class="progress-track"><div class="progress-fill" style="width:100%"></div></div><span class="session-xp">${session.xp} XP</span></div><section class="completion"><div class="completion-mascot">${mascot()}</div><div class="eyebrow">ӨНӨӨДРИЙН НЭГ АЛХАМ</div><h1>${session.test?'Шалгалт дууслаа!':session.review?'Үгсээ бататгалаа!':'Хичээлээ дуусгалаа!'}</h1><p>${session.test?`${session.firstAnswers} асуултад хариуллаа.`:`${session.words.length} үг, хэллэг дээр ажиллалаа.`}<br>${missed?`${missed} алдсан үгээ давтлагад дахин бататгаарай.`:'Дараа нь харахгүйгээр санаж хэлж үзээрэй.'}</p><div class="result-stats"><div class="result-stat"><strong>+${session.xp}</strong><span>ХУРИМТЛУУЛСАН XP</span></div><div class="result-stat"><strong>${accuracy}%</strong><span>ЭХНИЙ ОРОЛДЛОГО</span></div><div class="result-stat"><strong>${minutes}</strong><span>МИНУТ</span></div></div><button class="primary-btn" data-action="finish">Сурах зам руу буцах${icon('arrow')}</button><p style="margin-top:14px;font-size:11px">${storageWorks?'Ахиц энэ хөтөч дээр хадгалагдлаа.':'Ахиц энэ хөтөч дээр хадгалагдсангүй.'}</p></section></div>`;
  }
  function exitSession(){if(!session||session.completed){closeSession();return;}$('lesson-content').innerHTML=`<div class="lesson-frame"><section class="exit-confirm"><div class="empty-icon">${icon('leaf')}</div><h2>Түр завсарлах уу?</h2><p>Энэ хичээлийн ахиц дуусах үед хадгалагдана. Одоо гарвал энэ хичээлийг эхнээс нь үзнэ.</p><div class="exit-actions"><button class="secondary-btn" data-action="discard">Одоо гарах</button><button class="primary-btn" data-action="resume">Хичээлээ үргэлжлүүлэх</button></div></section></div>`;}
  function closeSession(){$('lesson-dialog').close();session=null;switchView(view);}
  document.addEventListener('click',event=>{
    const button=event.target.closest('button,a');if(!button)return;
    if(button.dataset.view){switchView(button.dataset.view);return;}
    const action=button.dataset.action;if(!action)return;
    if(action==='say'){const id=button.dataset.auFor;const cur=session&&session.queue[session.pos];sayWord(wordById[id]||(cur&&cur.word&&cur.word.id===id?cur.word:null));return;}
    if(action==='sync-open'){openSync();return;}
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
  document.addEventListener('keydown',event=>{
    if(!session||session.completed||!$('lesson-dialog').open||!$('exercise-title'))return;
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
    numTest:{build:buildTest,genDate,genTime,MONTHS,DAYS,HOURS,session:()=>session}};
})();
