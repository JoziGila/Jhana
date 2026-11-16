import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBandit, chooseArm, updateArm, ranking, rewardFromRung } from '../src/bandit.js';
import { analyzeWindow, synthAccel, settlingIndex, resample } from '../src/breath.js';
import { makeRng } from '../src/rng.js';

test('bandit converges on the arm that works', () => {
  const rng = makeRng(42);
  const truth = { smile: 0.2, warmth: 0.75, hands: 0.4 };
  let b = createBandit(Object.keys(truth));
  const pulls = { smile: 0, warmth: 0, hands: 0 };
  for (let i = 0; i < 60; i++) {
    const arm = chooseArm(b, rng);
    pulls[arm] += 1;
    b = updateArm(b, arm, rng() < truth[arm] ? 1 : 0);
  }
  assert.equal(ranking(b)[0].id, 'warmth');
  assert.ok(pulls.warmth > pulls.smile && pulls.warmth > pulls.hands);
});

test('bandit respects exclusions and priors, and does not mutate', () => {
  const rng = makeRng(1);
  const b = createBandit(['a', 'b'], { a: { alpha: 20, beta: 1 } });
  assert.equal(ranking(b)[0].id, 'a');
  for (let i = 0; i < 20; i++) assert.equal(chooseArm(b, rng, { exclude: ['a'] }), 'b');
  const b2 = updateArm(b, 'b', 0.5);
  assert.equal(b.arms.b.pulls, 0);
  assert.equal(b2.arms.b.pulls, 1);
  assert.equal(b2.arms.b.alpha, 1.5);
  assert.throws(() => updateArm(b, 'zzz', 1));
});

test('reward mapping from ladder rung', () => {
  assert.equal(rewardFromRung(2), 0);
  assert.equal(rewardFromRung(3), 0.5);
  assert.equal(rewardFromRung(4), 1);
  assert.equal(rewardFromRung(7), 1);
});

test('breath rate is recovered from synthetic accelerometer data (SIMULATED)', () => {
  for (const bpm of [4, 6, 9, 12, 16, 22]) {
    for (const amp of [0.05, 0.01]) {
      const w = analyzeWindow(synthAccel({ seconds: 60, bpm, amp, rng: makeRng(100 + bpm) }));
      assert.ok(w.bpm !== null, `no rate found at ${bpm} bpm`);
      assert.ok(Math.abs(w.bpm - bpm) <= 0.6, `true ${bpm}, estimated ${w.bpm}`);
      assert.ok(w.stillness > 0.85);
    }
  }
});

test('fidgeting lowers stillness; no breathing gives no rate; short windows are refused', () => {
  const rng = makeRng(5);
  const fidget = analyzeWindow(synthAccel({ seconds: 60, bpm: 12, fidgetAt: [10, 30, 45], rng }));
  assert.ok(fidget.stillness < 0.3);
  const none = analyzeWindow(synthAccel({ seconds: 60, bpm: 12, amp: 0, rng }));
  assert.equal(none.bpm, null);
  assert.equal(analyzeWindow(synthAccel({ seconds: 10, rng })).quality, 'none');
});

test('settling index rises when breathing slows and the body is still', () => {
  const rng = makeRng(9);
  const base = analyzeWindow(synthAccel({ seconds: 60, bpm: 15, rng }));
  const slow = analyzeWindow(synthAccel({ seconds: 60, bpm: 8, rng }));
  const jumpy = analyzeWindow(synthAccel({ seconds: 60, bpm: 15, fidgetAt: [5, 20, 35, 50], rng }));
  assert.ok(settlingIndex(slow, base) > settlingIndex(base, base));
  assert.ok(settlingIndex(jumpy, base) < settlingIndex(base, base));
});

test('resample produces a uniform grid', () => {
  const r = resample([{ t: 0, x: 0, y: 0, z: 0 }, { t: 1000, x: 10, y: 0, z: 0 }], 10);
  assert.equal(r.x.length, 11);
  assert.ok(Math.abs(r.x[5] - 5) < 1e-9);
});
