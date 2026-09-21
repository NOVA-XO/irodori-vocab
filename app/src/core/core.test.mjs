/* Порт хийсэн логикийн аюулгүй байдлын баталгаа (node --test).
   2026-09-11-ний довтолгооны шалгалтын гол батламжуудыг шинэ кодод давтав. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanProgress, cleanSettings } from './sanitize.js';
import { gradeCard, mergeProgress, BOXES } from './srs.js';

test('cleanProgress: __proto__ бохирдуулахгүй', () => {
  const evil = JSON.parse('{"__proto__":{"HACKED":1},"L01":{"n":1,"b":1}}');
  const out = cleanProgress(evil);
  assert.equal(({}).HACKED, undefined);
  assert.ok(out.L01 && out.L01.n === 1);
});

test('cleanProgress: null/тоо/мөр бичлэгийг хаяна', () => {
  const out = cleanProgress({ a: null, b: 5, c: 'x', d: [1], e: { n: 2, b: 1 } });
  assert.deepEqual(Object.keys(out), ['e']);
});

test('cleanProgress: NaN/Infinity-г 0 болгоно, хайрцгийг хязгаарлана', () => {
  const out = cleanProgress({ x: { n: 'abc', b: 1e400, d: -1e9, c: null, w: {} } });
  assert.equal(out.x.n, 0);
  assert.equal(out.x.b, 0);                 // Infinity -> АЮУЛГҮЙ 0 (max биш)
  const big = cleanProgress({ y: { b: 999, n: 1 } });
  assert.equal(big.y.b, BOXES.length - 1);  // том ФИНИТ утга -> дээд хайрцагт хумигдана
});

test('cleanSettings: буруу төрлийг анхдагчаар солино', () => {
  assert.equal(cleanSettings({ les: 'STRING' }).les.constructor, Object);
  assert.deepEqual(cleanSettings({ kgroups: 42 }).kgroups, ['gojuon']);
  assert.equal(cleanSettings([1, 2, 3]).book, 'starter');   // массив -> анхдагч
  assert.equal(cleanSettings({ goal: 0 }).goal, 1);          // тэгд хуваахаас
  assert.equal(cleanSettings('str').goal, 20);
});

test('gradeCard: цэвэр, зөв хариулт хайрцгийг ахиулна', () => {
  const p0 = {};
  const p1 = gradeCard(p0, 'L01', true, 100);
  assert.equal(p0.L01, undefined);           // мутаци хийхгүй
  assert.equal(p1.L01.b, 1);
  assert.equal(p1.L01.d, 100 + BOXES[1]);
  const p2 = gradeCard(p1, 'L01', false, 100);
  assert.equal(p2.L01.b, 0);                 // буруу -> 2 хайрцаг буурна
});

test('mergeProgress: их n ялна, __proto__ алгасна', () => {
  const a = { X: { n: 5, b: 2 } };
  const b = JSON.parse('{"__proto__":{"Z":1},"X":{"n":9,"b":4},"Y":{"n":1,"b":1}}');
  const out = mergeProgress(a, b);
  assert.equal(out.X.n, 9);
  assert.ok(out.Y);
  assert.equal(({}).Z, undefined);
});

import { checkTyped, readingVariants } from './romaji.js';

test('checkTyped: топик бөөс は/へ/を дуудлагаар хүлээнэ (ромажигүй сан)', () => {
  const c = (kana, typed) => checkTyped(typed, { kana, jp: kana, romaji: '' });
  assert.ok(c('こんにちは', 'konnichiwa'));   // は = wa
  assert.ok(c('こちらは', 'kochirawa'));       // топик は = wa
  assert.ok(c('ピアスをする', 'piasuosuru'));   // を = o
  assert.ok(c('がっこうへいく', 'gakkoueiku')); // へ = e
  assert.ok(c('こんにちは', 'konnichiha'));     // бичлэгээр ч зөв
});

test('checkTyped: は=ha үгс хэвээр зөв, буруу нь татгалзана', () => {
  assert.ok(checkTyped('hai', { kana: 'はい', jp: 'はい', romaji: '' }));
  assert.ok(checkTyped('hatake', { kana: 'はたけ', jp: 'はたけ', romaji: '' }));
  assert.equal(checkTyped('xyz', { kana: 'はい', jp: 'はい', romaji: '' }), false);
});

test('readingVariants: は/へ/を-г хоёр янзаар, бусдыг хэвээр', () => {
  const v = readingVariants('こんにちは');
  assert.ok(v.includes('こんにちは') && v.includes('こんにちわ'));
  assert.deepEqual(readingVariants('たべる'), ['たべる']);   // бөөсгүй үг өөрчлөгдөхгүй
});
