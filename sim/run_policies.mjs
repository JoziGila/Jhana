// SIMULATION: compare coaching strategies on simulated meditators.
//
//   node sim/run_policies.mjs            → sim/results/policies.json + sim/results/POLICIES.md
//
// What this can show: whether the coach's diagnoses and prescriptions do what they claim INSIDE
// the theory (src/loopModel.js). If the adaptive coach did not beat a fixed script here, the
// engine would be wrong by its own lights. What it cannot show: anything about real people.

import { writeFileSync, mkdirSync } from 'node:fs';
import { makeRng } from '../src/rng.js';
import { newState, completeSit } from '../src/coach.js';
import { firstPlan, applyPatch } from '../src/planner.js';
import { makeStudent, sit, PROFILES } from './students.mjs';

const N = Number(process.env.SIM_N ?? 600);
const SITS = 14;
const PROFILE = { warm: 1.5, chills: 1.5, imagery: 1.5, body: 1.5, breathcalm: 1.5, smile: 1.5, relaxes: 1.5 };

const ARMS = {
  'fixed script': { desc: 'The same guided sit every day (a recorded-audio control).', adapt: false },
  'sit longer': { desc: 'After a sit without take-off, add five minutes. Nothing else changes.', adapt: 'longer' },
  'push harder': { desc: 'The folk strategy: after a sit without take-off, concentrate as hard as possible. Same length.', adapt: 'harder' },
  'seed search only': { desc: 'Tries different sparks and keeps what works; never changes anything else.', adapt: 'seed' },
  'diagnosis only': { desc: 'Diagnoses the failing link and changes the plan; never changes the spark.', adapt: 'dx' },
  'full coach': { desc: 'The app: diagnosis plus seed search.', adapt: 'full' },
};

function runArm(name, arm, seed) {
  const rng = makeRng(seed);
  const people = [];
  for (let i = 0; i < N; i++) {
    const student = makeStudent(rng);
    let state = newState(PROFILE);
    state.plan = firstPlan(PROFILE, state.bandit);
    const basePlan = state.plan;
    let first = null;
    const rungs = [];
    const dx = [];
    for (let k = 1; k <= SITS; k++) {
      const out = sit(student, state.plan, rng);
      rungs.push(out.report.rung);
      if (first === null && out.truth.jhanaSeconds >= 60) first = k;
      if (arm.adapt === false) continue;
      if (arm.adapt === 'harder') {
        if (!out.truth.ignited) state = { ...state, plan: applyPatch(state.plan, { effort: 'hard', relaxCues: 0 }) };
        continue;
      }
      if (arm.adapt === 'longer') {
        if (!out.truth.ignited) state = { ...state, plan: applyPatch(state.plan, { totalMin: '+5' }) };
        continue;
      }
      const prevSeed = state.plan.seed;
      const res = completeSit(state, out.report, rng, k);
      dx.push(res.diagnosis.primary);
      state = res.state;
      if (arm.adapt === 'seed') state = { ...state, plan: { ...basePlan, seed: state.plan.seed } };
      if (arm.adapt === 'dx') state = { ...state, plan: { ...state.plan, seed: prevSeed } };
    }
    people.push({ profile: student.profile, first, best: Math.max(...rungs), dx });
  }
  const reached = people.filter((p) => p.first !== null);
  const firsts = reached.map((p) => p.first).sort((a, b) => a - b);
  const byProfile = {};
  for (const prof of Object.keys(PROFILES)) {
    const g = people.filter((p) => p.profile === prof);
    byProfile[prof] = { n: g.length, reached: g.length ? g.filter((p) => p.first !== null).length / g.length : null };
  }
  const curve = Array.from({ length: SITS }, (_, i) => people.filter((p) => p.first !== null && p.first <= i + 1).length / N);
  return { name, desc: arm.desc, n: N, reached: reached.length / N, medianSits: firsts.length ? firsts[Math.floor(firsts.length / 2)] : null, byProfile, curve };
}

// The same seed for every arm: identical simulated people, so arms differ only by strategy.
const results = Object.entries(ARMS).map(([name, arm]) => runArm(name, arm, 20261116));

// Does the diagnosis recover the planted problem? Check on pure archetypes, first sit only.
const expect = { striver: ['striving', 'breath-control'], grabber: ['grasping', 'checking'], sleepy: ['dull'], scattered: ['scattered', 'unsettled', 'dose'], guarded: ['no-seed', 'plateau', 'dose'] };
const recovery = {};
{
  const rng = makeRng(99);
  for (const [prof, ok] of Object.entries(expect)) {
    let hit = 0;
    let total = 0;
    for (let i = 0; i < 300; i++) {
      const student = makeStudent(rng, prof);
      const state = newState(PROFILE);
      const out = sit(student, state.plan, rng);
      if (out.truth.jhanaSeconds >= 60) continue; // nothing to diagnose
      const res = completeSit(state, out.report, rng, 1);
      total += 1;
      if (ok.includes(res.diagnosis.primary)) hit += 1;
    }
    recovery[prof] = { accepted: ok, rate: total ? hit / total : null, n: total };
  }
}

mkdirSync(new URL('./results/', import.meta.url), { recursive: true });
writeFileSync(new URL('./results/policies.json', import.meta.url), JSON.stringify({ simulated: true, n: N, sits: SITS, results, recovery }, null, 1));

const pct = (x) => (x === null ? 'n/a' : `${Math.round(x * 100)}%`);
const L = [];
L.push('# Coaching strategies compared in simulation\n');
L.push('> **SIMULATED.** Every number here comes from the loop model in `src/loopModel.js` applied to made-up people (`sim/students.mjs`). It checks that the coach is consistent with the theory. It is not evidence that the coach helps real people.\n');
L.push(`${N} simulated meditators, the same individuals in every arm, ${SITS} sits each. "Reached" means at least one sit with a minute or more in the model's first-jhana state.\n`);
L.push('| Strategy | Reached within 14 sits | Median sits to first (among those who reached) | What it is |');
L.push('|---|---|---|---|');
for (const r of results) L.push(`| ${r.name} | ${pct(r.reached)} | ${r.medianSits ?? 'n/a'} | ${r.desc} |`);
L.push('\n## By type of person\n');
L.push(`| Strategy | ${Object.keys(PROFILES).join(' | ')} |`);
L.push(`|---|${Object.keys(PROFILES).map(() => '---').join('|')}|`);
for (const r of results) L.push(`| ${r.name} | ${Object.keys(PROFILES).map((p) => pct(r.byProfile[p].reached)).join(' | ')} |`);
L.push(`\nShare of each type in the simulated population (assumed): ${Object.entries(PROFILES).map(([k, v]) => `${k} ${pct(v.share)}`).join(', ')}.\n`);
L.push('## Cumulative share reaching, by sit\n');
L.push(`| Strategy | ${[1, 2, 3, 5, 7, 10, 14].map((k) => `sit ${k}`).join(' | ')} |`);
L.push('|---|---|---|---|---|---|---|---|');
for (const r of results) L.push(`| ${r.name} | ${[1, 2, 3, 5, 7, 10, 14].map((k) => pct(r.curve[k - 1])).join(' | ')} |`);
L.push('\n## Does the diagnosis find the planted problem?\n');
L.push('Pure archetypes, first sit, sits that did not reach jhana. A hit is a primary diagnosis in the accepted set.\n');
L.push('| Planted type | Accepted diagnoses | Hit rate | n |');
L.push('|---|---|---|---|');
for (const [k, v] of Object.entries(recovery)) L.push(`| ${k} | ${v.accepted.join(', ')} | ${pct(v.rate)} | ${v.n} |`);
L.push('\n## Reading this\n');
L.push('- The ordering of strategies is a property of the theory, and the size of the gaps depends on assumed trait distributions.');
{
  const get = (n) => results.find((r) => r.name === n).reached;
  const d = Math.round((get('push harder') - get('fixed script')) * 100);
  L.push(`- "Push harder" ${d < -2 ? 'does worse than' : d > 2 ? 'does better than' : 'does no better than'} changing nothing (${d >= 0 ? '+' : ''}${d} points). The theory predicts it should not help; here it also does not hurt much, because simulated people who would have succeeded do so before the instruction to push takes effect.`);
  const rec = Object.entries(recovery).filter(([, v]) => v.rate !== null && v.rate < 0.5).map(([k]) => k);
  if (rec.length) L.push(`- **Known weakness:** the diagnosis recovers the planted problem less than half the time for: ${rec.join(', ')}. In the model, a grabber's wanting mostly shows up as a feeling that will not grow, and seldom as a visible collapse, so the coach reads it as a plateau. The plateau advice ("can I enjoy this more?") is not wrong for them, but it is not the planted cause.`);
}
L.push('- "Sit longer" is a strong baseline inside the model. Any real study must give the control arm the same sit lengths as the coached arm, or dose will be mistaken for coaching.');
L.push('- The useful checks are internal: the full coach should beat each ablation, and each planted problem should be diagnosed as itself. Where that fails, the engine needs work.');
writeFileSync(new URL('./results/POLICIES.md', import.meta.url), L.join('\n') + '\n');
console.log('SIMULATED results (not evidence about people):');
for (const r of results) console.log(`  ${r.name.padEnd(18)} reached ${pct(r.reached).padStart(4)}  median sits ${r.medianSits}`);
console.log('  diagnosis recovery:', Object.entries(recovery).map(([k, v]) => `${k} ${pct(v.rate)}`).join(', '));
