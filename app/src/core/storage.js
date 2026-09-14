/* localStorage-ийн уншилт/бичилт — хувийн горим, дүүрсэн санд ч унахгүй.
   app.js-ийн load/save-тэй ижил зарчим. */

export const KEY_P = 'irodori.progress.v1';
export const KEY_S = 'irodori.settings.v1';
export const KEY_D = 'irodori.days.v1';
export const KEY_TH = 'irodori.theme.v1';
export const KEY_C = 'irodori.synccode.v1';
export const KEY_DEV = 'irodori.dev.v1';

export function load(key, dflt) {
  try { return JSON.parse(localStorage.getItem(key)) ?? dflt; }
  catch { return dflt; }
}
export function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); return true; }
  catch { return false; }
}
