/* Leitner SRS — цэвэр функцууд. React-д `progress` нь global биш state тул
   `gradeCard` нь мутаци хийхгүй, ШИНЭ map буцаана. Логик нь vanilla аппын
   `grade()`-тэй ИЖИЛ (app.js), зөвхөн цэвэр хэлбэртэй. */

export const BOXES = [0, 1, 3, 7, 14, 30];   // хайрцаг бүрийн зай, хоногоор

// Орон нутгийн өдрийг бүхэл тоогоор (цагийн бүсийг тооцсон).
export const today = () =>
  Math.floor((Date.now() - new Date().getTimezoneOffset() * 6e4) / 864e5);

/** Нэг картыг үнэлээд ШИНЭ progress map буцаана. */
export function gradeCard(progress, id, ok, day = today()) {
  const prev = progress[id] || { b: 0, d: 0, n: 0, c: 0, w: 0 };
  const p = { ...prev };
  p.n++;
  if (ok) { p.c++; p.b = Math.min(p.b + 1, BOXES.length - 1); }
  else { p.w++; p.b = Math.max(p.b - 2, 0); }
  p.d = day + BOXES[p.b];
  return { ...progress, [id]: p };
}

export const isDue = (progress, id, day = today()) => {
  const p = progress[id];
  return !!p && p.d <= day;
};
export const isNew = (progress, id) => !progress[id];
export const isLearned = (progress, id) => ((progress[id] || {}).b || 0) >= 3;

/** Хоёр явцыг УУСГАНА: илүү олон удаа давтсан (`n`) нь ялна; тэнцвэл
 *  илүү өндөр хайрцаг (`b`). Дарж бичихгүй. app.js-ийн `mergeProgress`. */
export function mergeProgress(a, b) {
  const out = { ...a };
  for (const id in b) {
    if (id === '__proto__' || id === 'constructor' || id === 'prototype') continue;
    const x = out[id], y = b[id];
    if (!x) { out[id] = y; continue; }
    if ((y.n || 0) > (x.n || 0) || ((y.n || 0) === (x.n || 0) && (y.b || 0) > (x.b || 0))) {
      out[id] = y;
    }
  }
  return out;
}
