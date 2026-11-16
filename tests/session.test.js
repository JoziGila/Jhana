import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession } from '../src/session.js';
import { firstPlan } from '../src/planner.js';
import { coachInstructions, noteReadingPrompt, blindDiagnosisPrompt, THEORY_BRIEF } from '../src/coachPrompt.js';
import { newState, completeSit, stats, planForToday, applyProfile } from '../src/coach.js';
import { BLOCKERS, SYMPTOMS } from '../src/kb.js';
import { makeRng } from '../src/rng.js';

function run(plan, actions = {}) {
  const spoken = [];
  const bells = [];
  let ended = null;
  const s = createSession(plan, { speak: (t, cue) => spoken.push({ t, id: cue.id, at: s.elapsed }), bell: (k) => bells.push(k), onEnd: (sum) => { ended = sum; } });
  for (let t = 0; t <= plan.totalMin * 60 + 1 && !s.ended; t += 1) {
    s.tick(t);
    if (actions[t]) actions[t](s);
  }
  return { s, spoken, bells, ended };
}

test('an uninterrupted sit speaks its cues in order and ends by itself', () => {
  const plan = firstPlan({});
  const { spoken, bells, ended } = run(plan);
  assert.equal(ended.reason, 'complete');
  assert.equal(bells[0], 'start');
  assert.equal(bells.at(-1), 'end');
  assert.ok(spoken.length >= 15);
  assert.ok(spoken.some((x) => x.id === 'inoculate'));
  assert.equal(spoken.at(-1).id, 'exit2');
});

test('one tap silences the guide for the rest phase; exit cues still play', () => {
  const plan = firstPlan({});
  const restStart = (plan.settleMin + plan.gatherMin + plan.kindleMin) * 60;
  const tapAt = restStart + 12;
  const { spoken, ended } = run(plan, { [tapAt]: (s) => s.here() });
  const afterTap = spoken.filter((x) => x.at > tapAt);
  assert.deepEqual(afterTap.map((x) => x.id), ['exit1', 'exit2'], 'only the closing cues after "here"');
  assert.deepEqual(ended.taps.here, [tapAt]);
  assert.ok(ended.secondsAfterHere > 300);
  assert.equal(ended.firstHereAfterRest, 12);
});

test('two taps give one pointer and let the script help again', () => {
  const plan = { ...firstPlan({}), totalMin: 40 };
  const restStart = (plan.settleMin + plan.gatherMin + plan.kindleMin) * 60;
  const { spoken, ended } = run(plan, { [restStart + 10]: (s) => s.here(), [restStart + 200]: (s) => s.stuck() });
  const rescue = spoken.filter((x) => x.id === 'rescue');
  assert.equal(rescue.length, 1);
  assert.ok(spoken.some((x) => x.at > restStart + 200 && x.id.startsWith('rem')), 'reminders resume after "stuck"');
  assert.deepEqual(ended.taps.stuck, [restStart + 200]);
});

test('pointers toward deeper states wait until the feeling has been steady', () => {
  const plan = { ...firstPlan({}), deepen: true, totalMin: 45 };
  const restStart = (plan.settleMin + plan.gatherMin + plan.kindleMin) * 60;
  const { spoken } = run(plan, { [restStart + 400]: (s) => s.here() });
  const deepen = spoken.filter((x) => x.id.startsWith('deepen'));
  assert.ok(deepen.length >= 1);
  assert.ok(deepen.every((x) => x.at >= restStart + 400 + 240));
});

test('ending early and late cues', () => {
  const plan = firstPlan({});
  const { ended } = run(plan, { 100: (s) => s.end('stopped') });
  assert.equal(ended.reason, 'stopped');
  assert.equal(ended.reachedRest, false);
  // a clock that jumps (suspended tab) must not replay a backlog of stale cues
  const spoken = [];
  const s = createSession(plan, { speak: (t, cue) => spoken.push(cue.id) });
  s.tick(0);
  s.tick(600);
  assert.ok(spoken.length <= 2, `spoke ${spoken.length} cues after a ten-minute jump`);
});

test('coach state: a full cycle updates plan, bandit and stats', () => {
  const rng = makeRng(4);
  let state = applyProfile(newState(), { warm: 3, striver: 3 });
  assert.equal(state.onboarded, true);
  const seed = state.plan.seed;
  const r1 = completeSit(state, { minutes: 25, rung: 4, symptoms: ['vanish', 'grabbed'], answers: { pleasure: 2, clear: 2 }, duration: 'seconds' }, rng, 1);
  assert.equal(r1.diagnosis.primary, 'grasping');
  assert.equal(r1.state.sits.length, 1);
  assert.equal(r1.state.bandit.arms[seed].pulls, 1);
  assert.equal(r1.state.plan.focus, 'grasping');
  const full = { shift: 3, pleasure: 3, pervade: 2, selfsustain: 3, absorb: 3, clear: 3, afterglow: 2 };
  const r2 = completeSit(r1.state, { minutes: 30, rung: 6, symptoms: [], answers: full, duration: 'minutes' }, rng, 2);
  assert.equal(r2.sit.jhana, true);
  const st = stats(r2.state);
  assert.deepEqual([st.sits, st.jhanaSits, st.sitsToFirstJhana, st.sitsToFirstTakeoff, st.bestRung], [2, 1, 2, 2, 6]);
  // today's adjustments do not overwrite the stored plan
  const today = planForToday(r2.state, { energy: 0, agitation: 0, mood: 2, minutes: null }, rng);
  assert.equal(today.plan.eyes, 'soft-open');
  assert.equal(today.plan.focus, r2.state.plan.focus);
  assert.notEqual(r2.state.plan.prep, 'wake');
});

test('LLM prompts carry the theory, the safety rules and the right lists', () => {
  const rng = makeRng(2);
  const r = completeSit(applyProfile(newState(), {}), { minutes: 25, rung: 3, symptoms: ['tension'], answers: {}, duration: 'none', note: 'My head felt tight.' }, rng, 1);
  const p = coachInstructions(r.sit, r.diagnosis, []);
  assert.ok(p.includes(THEORY_BRIEF));
  for (const b of BLOCKERS) assert.ok(p.includes(b.id));
  assert.match(p, /ONE short question/);
  assert.match(p, /Do not tell them they reached jhana unless/);
  assert.match(p, /clinician or an experienced teacher/);
  assert.match(p, /My head felt tight/);
  const n = noteReadingPrompt('warm glow in my chest');
  for (const s of SYMPTOMS) assert.ok(n.includes(s.id));
  assert.match(n, /Be conservative/);
  assert.match(blindDiagnosisPrompt('x'), /exactly one of these categories/);
});
