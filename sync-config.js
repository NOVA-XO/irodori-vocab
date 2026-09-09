/* Синкийн тохиргоо.
 *
 * Supabase → Project Settings → Data API хэсгээс хоёр утгыг хуулж тавина:
 *   url  — Project URL          (ж: https://abcdefgh.supabase.co)
 *   key  — anon / public key    ("service_role"-ыг ХЭЗЭЭ Ч БИШ)
 *
 * anon түлхүүр нь public репод харагдах нь ХЭВИЙН — тэр нь зориулалтаараа
 * браузерт очдог. Хамгаалалт нь SUPABASE.sql дахь RLS + функцээр хийгддэг:
 * хүснэгт рүү шууд хандах хаалттай, зөвхөн кодоо мэдэж байж хандана.
 *
 * Хоосон үлдээвэл апп синкгүйгээр хэвийн ажиллана (явц зөвхөн энэ
 * төхөөрөмж дээр үлдэнэ), синкийн хэсэг нүүрэндээ гарахгүй.
 */
window.SYNC_CONFIG = {
  url: 'https://feyhowascekpdzjluqkr.supabase.co',
  key: 'sb_publishable_iySsGVNtlMbikfW_BydZYQ_na6gwTTS'
};
