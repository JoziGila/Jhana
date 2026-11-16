import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  runSit, habitPolicy, loopGain, step, initialState, classify,
  DEFAULT_TRAITS, DEFAULT_HABITS, STRIVE_HABITS, DRIFT_HABITS, K,
} from '../src/loopModel.js';
import { makeRng } from '../src/rng.js';

const sit = (traits, habits, seconds = 2400) => runSit({ ...DEFAULT_TRAITS, ...traits }, habitPolicy(habits), { seconds });

test('state stays inside [0, 1] under extreme inputs', () => {
  const rng = makeRng(1);
  let s = initialState(DEFAULT_TRAITS);
  for (let i = 0; i < 5000; i++) {
    s = step(s, { effort: rng(), target: rng() < 0.5 ? 'pleasure' : 'anchor', seed: rng(), relax: rng() },
      { ...DEFAULT_TRAITS, wanting: 1, openness: 1 }, 1, rng);
    for (const key of ['a', 'p', 't', 'g', 'h', 'e']) assert.ok(s[key] >= 0 && s[key] <= 1, `${key}=${s[key]}`);
  }
});

test('a typical person with balanced habits ignites within a 40-minute sit', () => {
  const r = sit({}, DEFAULT_HABITS);
  assert.equal(r.ignited, true);
  assert.ok(r.ignitionTime > 300 && r.ignitionTime < 2400, `ignition at ${r.ignitionTime}s`);
});

test('P4: striving blocks ignition, and so does drifting (effort is inverted-U)', () => {
  assert.equal(sit({}, STRIVE_HABITS).ignited, false, 'maximum effort should fail');
  assert.equal(sit({}, DRIFT_HABITS).ignited, false, 'no effort should fail');
  const lazy = sit({}, { effortAnchor: 0.1, effortPleasure: 0.1 });
  assert.equal(lazy.ignited, false, 'too little effort should fail');
  assert.ok(lazy.summary.minEnergy < 0.4, 'too little effort should sink toward dullness');
});

test('P4: easing off as pleasure rises ignites sooner than holding effort constant', () => {
  const constant = sit({}, { easeOff: 0 });
  const easing = sit({}, { easeOff: 0.8, relaxDrive: 0.5 });
  assert.ok(easing.ignited && constant.ignited);
  assert.ok(easing.ignitionTime < constant.ignitionTime);
});

test('P2: high wanting produces false starts and no ignition; preparation for the onset fixes it', () => {
  const grasper = sit({ wanting: 0.9 }, DEFAULT_HABITS);
  assert.equal(grasper.ignited, false);
  assert.ok(grasper.summary.onsetCollapses >= 1, 'should show at least one rise-then-collapse');
  const prepared = sit({ wanting: 0.9, inoculated: 0.8 }, { relaxDrive: 0.6, easeOff: 0.8 });
  assert.equal(prepared.ignited, true);
});

test('P5: openness and a workable seed are each necessary', () => {
  assert.equal(sit({ openness: 0.1 }, DEFAULT_HABITS).ignited, false);
  assert.equal(sit({ seedPower: 0.03 }, DEFAULT_HABITS).ignited, false);
  assert.equal(sit({ openness: 0.8 }, DEFAULT_HABITS).ignited, true);
});

test('attention skill alone is not sufficient: a skilled striver still fails', () => {
  const skilledStriver = sit({ attnSkill: 0.95, strain: 0.7 }, STRIVE_HABITS);
  assert.equal(skilledStriver.ignited, false);
  assert.ok(skilledStriver.summary.meanAttention > 0.8, 'attention is excellent');
  assert.ok(skilledStriver.summary.meanTension > 0.4, 'but tension is high');
});

test('P1: hysteresis — once ignited the state survives conditions that could not start it', () => {
  const traits = { ...DEFAULT_TRAITS };
  // Conditions too weak to ignite from cold: low effort, no seeding.
  const weak = () => ({ effort: 0.15, target: 'pleasure', seed: 0, relax: 0.3 });
  const cold = runSit(traits, weak, { seconds: 1200 });
  assert.equal(cold.ignited, false);
  // Same conditions, starting inside the state.
  const inside = { a: 0.92, p: 0.88, t: 0.05, g: 0.02, h: 0.05, e: 0.8, onsetSeen: true };
  const warm = runSit(traits, weak, { seconds: 1200, initial: inside });
  assert.ok(warm.jhanaSeconds > 1000, `stayed ${warm.jhanaSeconds}s of 1200s`);
});

test('loop gain crosses 1 before ignition and is far above 1 inside the state', () => {
  const r = runSit(DEFAULT_TRAITS, habitPolicy(DEFAULT_HABITS), { seconds: 2400, record: 10 });
  const before = r.trace.filter((x) => x.s < 200);
  const inside = r.trace.filter((x) => x.p > 0.8);
  assert.ok(before.every((x) => x.L < 1), 'gain below 1 while unsettled');
  assert.ok(inside.length > 0 && inside.every((x) => x.L > 1.5), 'gain well above 1 in the state');
});

test('loopGain falls with tension and with grasping, rises with attention', () => {
  const base = { a: 0.8, p: 0.2, t: 0.1, g: 0.05, h: 0.2, e: 0.7 };
  const act = { effort: 0.4, target: 'pleasure', seed: 0, relax: 0 };
  const L = (patch) => loopGain({ ...base, ...patch }, act, DEFAULT_TRAITS);
  assert.ok(L({ t: 0.5 }) < L({}));
  assert.ok(L({ g: 0.5 }) < L({}));
  assert.ok(L({ a: 0.95 }) > L({}));
  assert.ok(loopGain(base, { ...act, target: 'anchor' }, DEFAULT_TRAITS) < 0.1, 'attention elsewhere gives no amplification');
});

test('classify labels', () => {
  assert.equal(classify({ a: 0.9, p: 0.9, t: 0, g: 0, h: 0, e: 0.8 }), 'jhana1');
  assert.equal(classify({ a: 0.3, p: 0.1, t: 0, g: 0, h: 0.1, e: 0.1 }), 'dull');
  assert.equal(classify({ a: 0.7, p: 0.1, t: 0.2, g: 0, h: 0.1, e: 0.7 }), 'access');
  assert.equal(classify({ a: 0.2, p: 0.05, t: 0.5, g: 0.2, h: 0.6, e: 0.7 }), 'ordinary');
});

test('conclusions are robust to ±25% changes in each model constant', () => {
  // The constants are illustrative, so the qualitative claims must not hinge on them.
  // Robust claims: balanced habits ignite; drifting never does; striving is slower or fails.
  // (Whether striving fails outright IS parameter-dependent: it does in ~88% of perturbations.)
  let striveFails = 0;
  let total = 0;
  for (const key of Object.keys(K)) {
    for (const f of [0.75, 1.25]) {
      const k = { ...K, [key]: K[key] * f };
      const run = (habits) => runSit(DEFAULT_TRAITS, habitPolicy(habits), { seconds: 3000, k });
      const balanced = run({ easeOff: 0.8, relaxDrive: 0.5 });
      const strive = run(STRIVE_HABITS);
      const drift = run(DRIFT_HABITS);
      total += 1;
      assert.equal(balanced.ignited, true, `balanced should ignite (${key} × ${f})`);
      assert.equal(drift.ignited, false, `drifting should not ignite (${key} × ${f})`);
      if (strive.ignited) {
        assert.ok(strive.ignitionTime > balanced.ignitionTime, `striving should be slower (${key} × ${f})`);
      } else {
        striveFails += 1;
      }
    }
  }
  assert.ok(striveFails / total >= 0.8, `striving failed outright in ${striveFails}/${total} perturbations`);
});
