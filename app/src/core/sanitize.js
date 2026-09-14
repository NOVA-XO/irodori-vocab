/* Итгэлгүй өгөгдлийг ариутгах — импорт файл, localStorage, синк серверээс
   ирсэн бүхэн. 2026-09-11-ний довтолгооны шалгалтаар нэмэгдсэн (app.js).
   Төрөл таарахгүй бол анхдагчаар солино; аппыг унагах боломжийг хаана. */

import { BOXES } from './srs.js';

export const BOOKS = ['starter', 'el1', 'el2', 'n5'];
export const KGROUPS = ['gojuon', 'dakuten', 'yoon'];

const num = x => typeof x === 'number' && isFinite(x);
const arrOf = (v, ok) => (Array.isArray(v) ? v.filter(ok) : null);

export function defaultSettings() {
  return {
    lessons: [1, 2, 3], ref: false, script: 'kanji', kgroups: ['gojuon'],
    goal: 20, dir: 'jp2mn', kjn: [5], fx: 1, what: 'word',
    book: 'starter', les: {}, n5les: [1, 2, 3],
  };
}

export function cleanSettings(v) {
  const d = defaultSettings();
  if (!v || typeof v !== 'object' || Array.isArray(v)) return d;
  const out = { ...d };
  if (BOOKS.includes(v.book)) out.book = v.book;
  out.ref = !!v.ref;
  out.fx = v.fx ? 1 : 0;
  if (v.script === 'kana' || v.script === 'kanji') out.script = v.script;
  if (v.dir === 'mn2jp' || v.dir === 'jp2mn') out.dir = v.dir;
  if (v.what === 'word' || v.what === 'kanji') out.what = v.what;
  if (num(v.goal)) out.goal = Math.max(1, Math.min(500, Math.round(v.goal)));
  out.kgroups = arrOf(v.kgroups, x => KGROUPS.includes(x)) || d.kgroups;
  if (!out.kgroups.length) out.kgroups = d.kgroups;
  out.kjn = arrOf(v.kjn, num) || d.kjn;
  out.n5les = arrOf(v.n5les, num) || d.n5les;
  out.les = {};
  if (v.les && typeof v.les === 'object' && !Array.isArray(v.les)) {
    for (const b of BOOKS) {
      const ls = arrOf(v.les[b], num);
      if (ls) out.les[b] = ls;
    }
  }
  if (v.last && typeof v.last === 'object' && !Array.isArray(v.last)) out.last = v.last;
  return out;
}

export function cleanProgress(v) {
  const out = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  const n = x => (typeof x === 'number' && isFinite(x)) ? x : 0;
  for (const id of Object.keys(v)) {
    if (id === '__proto__' || id === 'constructor' || id === 'prototype') continue;
    const p = v[id];
    if (!p || typeof p !== 'object' || Array.isArray(p)) continue;
    out[id] = {
      b: Math.max(0, Math.min(BOXES.length - 1, Math.round(n(p.b)))),
      d: Math.round(n(p.d)), n: Math.max(0, Math.round(n(p.n))),
      c: Math.max(0, Math.round(n(p.c))), w: Math.max(0, Math.round(n(p.w))),
    };
  }
  return out;
}
