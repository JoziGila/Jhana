// SIMULATED meditators for testing the coach in silico. Nothing here is data about people.
//
// A simulated student has hidden traits (src/loopModel.js) plus a few habits. Each sit they
// follow the plan they are given, imperfectly; the loop model plays out; and they file a noisy
// debrief of the kind the app collects. The coach never sees the hidden traits.

import { runSit, habitPolicy, DEFAULT_TRAITS } from '../src/loopModel.js';
import { SEEDS } from '../src/kb.js';

const SEED_IDS = SEEDS.map((s) => s.id);
const EFFORT = { feather: 0.3, light: 0.45, steady: 0.62, hard: 0.92 }; // 'hard' exists only for the simulated push-harder arm

/** Archetypes from docs/understanding/05-conditions.md §5.3, with population shares (assumed). */
export const PROFILES = {
  open: { share: 0.15, traits: { openness: 0.75, wanting: 0.3, letGo: 0.6 } },
  striver: { share: 0.2, traits: { attnSkill: 0.75, strain: 0.8, letGo: 0.25 }, effortHabit: 0.95, compliance: 0.55 },
  grabber: { share: 0.2, traits: { wanting: 0.9, letGo: 0.3 } },
  guarded: { share: 0.15, traits: { openness: 0.3 }, seedScale: 0.35 },
  sleepy: { share: 0.1, traits: { drowsy: 0.9 }, effortHabit: 0.2 },
  scattered: { share: 0.1, traits: { attnSkill: 0.25, hindrance0: 0.75 } },
  average: { share: 0.1, traits: {} },
};

export function makeStudent(rng, forceProfile = null) {
  let profile = forceProfile;
  if (!profile) {
    let u = rng();
    for (const [name, p] of Object.entries(PROFILES)) {
      u -= p.share;
      if (u <= 0) {
        profile = name;
        break;
      }
    }
    profile ??= 'average';
  }
  const P = PROFILES[profile];
  const jitter = (v) => Math.max(0.03, Math.min(0.97, v + 0.1 * rng.normal()));
  const traits = { ...DEFAULT_TRAITS };
  for (const k of Object.keys(traits)) traits[k] = jitter(P.traits?.[k] ?? traits[k]);
  traits.inoculated = 0;
  // which seeds work is idiosyncratic: one or two strong ones, the rest weak
  const seedPowers = {};
  const strong = rng.pick(SEED_IDS.filter((s) => s !== 'kindness-self'));
  for (const id of SEED_IDS) {
    const base = id === strong ? 0.75 : 0.08 + 0.3 * rng();
    seedPowers[id] = Math.max(0.02, Math.min(0.95, base * (P.seedScale && id !== strong ? P.seedScale : 1)));
  }
  return {
    profile,
    traits,
    seedPowers,
    effortHabit: Math.max(0.1, Math.min(1, (P.effortHabit ?? 0.55) + 0.08 * rng.normal())),
    compliance: Math.max(0.3, Math.min(0.95, (P.compliance ?? 0.75) + 0.08 * rng.normal())),
    breathCtl: rng() < 0.2 ? 0.8 : 0.1,
    painProne: rng() < 0.15,
    onsetsSeen: 0,
  };
}

/** One sit under a plan. Returns the model outcome and the student's noisy report. */
export function sit(student, plan, rng) {
  const c = student.compliance;
  const cue = EFFORT[plan.effort] ?? 0.45;
  const effort = c * cue + (1 - c) * student.effortHabit;
  const traits = { ...student.traits };
  traits.seedPower = student.seedPowers[plan.seed] ?? 0.2;
  if (plan.eyes === 'soft-open' || plan.posture === 'upright') traits.drowsy *= 0.4;
  if (plan.framing === 'no-goal') traits.wanting *= 0.75;
  if (plan.anchor === 'breath') traits.strain = Math.min(1, traits.strain + 0.35 * student.breathCtl);
  if (plan.anchorHelp === 'count') traits.attnSkill = Math.min(1, traits.attnSkill * 1.25);
  if (plan.savor) traits.openness = Math.min(1, traits.openness + 0.12);
  if (plan.prep === 'move') traits.hindrance0 = Math.max(0.05, traits.hindrance0 - 0.15);
  if (student.painProne && plan.posture !== 'supported') traits.hindrance0 = Math.min(1, traits.hindrance0 + 0.3);
  // being told in advance what to do at the onset, plus familiarity from earlier onsets
  traits.inoculated = Math.min(0.9, (plan.inoculate ? 0.45 * c : 0) + 0.12 * student.onsetsSeen);

  const habits = {
    settleSeconds: plan.settleMin * 60,
    gatherSeconds: plan.gatherMin * 60 * 0.5,
    effortAnchor: Math.max(effort, 0.25),
    effortPleasure: effort,
    easeOff: 0.7 * c * (plan.effort === 'steady' ? 0.5 : 1),
    relaxDrive: Math.min(0.9, 0.12 + 0.16 * (plan.relaxCues ?? 1) + (plan.pacer ? 0.05 : 0)),
    switchAt: 0.5,
  };
  const seconds = Math.max(300, plan.totalMin * 60 - 75);
  const run = runSit(traits, habitPolicy(habits), { seconds, rng });
  const s = run.summary;
  if (s.maxP > 0.35) student.onsetsSeen += 1;
  student.traits.attnSkill = Math.min(0.95, student.traits.attnSkill + 0.008); // ordinary practice effect

  // ---- the debrief the student would file ----
  let rung = 0;
  if (s.finalState.h < 0.4 || s.accessTime !== null) rung = 1;
  if (s.accessTime !== null) rung = 2;
  if (s.maxP >= 0.12) rung = 3;
  if (s.maxP >= 0.35) rung = 4;
  if (s.maxP >= 0.65 || run.jhanaSeconds > 0) rung = 5;
  if (run.jhanaSeconds >= 60) rung = 6;
  if (run.jhanaSeconds >= 600) rung = 7;

  const truth = new Set();
  if (s.accessTime === null && s.finalState.h > 0.4) truth.add('restless');
  if (s.meanAttention < 0.4 && s.minEnergy >= 0.35) truth.add('wander');
  if (s.minEnergy < 0.35) truth.add('sleepy');
  if (s.meanTension > 0.33) ['tension', 'forcing'].forEach((x) => truth.add(x));
  if (s.accessTime !== null && s.maxP < 0.1) truth.add('noseed');
  if (s.maxP >= 0.1 && s.maxP < 0.3) truth.add('faint');
  if (s.maxP >= 0.3 && s.maxP < 0.62 && s.onsetCollapses === 0 && !run.ignited) truth.add('plateau');
  if (s.onsetCollapses >= 1 && !run.ignited) {
    truth.add('vanish');
    if (rng() < 0.6) truth.add('grabbed');
  }
  if (student.painProne && plan.posture !== 'supported') truth.add('pain');
  if (student.breathCtl > 0.6 && plan.anchor === 'breath') truth.add('breathctl');
  if (student.traits.wanting > 0.7 && s.maxP < 0.3) truth.add('pressure');
  const ALL = ['restless', 'wander', 'sleepy', 'tension', 'forcing', 'noseed', 'faint', 'plateau', 'vanish', 'grabbed', 'pain', 'breathctl', 'pressure', 'checking', 'doubt', 'bored'];
  const symptoms = ALL.filter((x) => (truth.has(x) ? rng() < 0.8 : rng() < 0.03));

  const lvl = (v, cuts) => cuts.filter((x) => v >= x).length;
  const answers = {
    shift: run.ignited ? 3 : s.onsetCollapses ? 1 : 0,
    pleasure: lvl(s.maxP, [0.2, 0.5, 0.75]),
    pervade: lvl(s.maxP, [0.4, 0.65, 0.85]),
    selfsustain: run.jhanaSeconds >= 60 ? 3 : run.jhanaSeconds > 0 ? 2 : 0,
    absorb: run.jhanaSeconds >= 60 ? 3 : lvl(s.meanAttention, [0.5, 0.7, 0.9]),
    clear: lvl(s.minEnergy, [0.3, 0.45, 0.6]),
    energy: lvl(s.maxP, [0.5, 0.7, 0.9]),
    afterglow: run.ignited ? 2 : 0,
    drowsy: s.minEnergy < 0.3 ? 3 : s.minEnergy < 0.4 ? 1 : 0,
    drift: s.meanAttention < 0.35 ? 2 : 0,
    strain: s.meanTension > 0.4 ? 2 : 0,
  };
  const duration = run.jhanaSeconds >= 300 ? 'long' : run.jhanaSeconds >= 60 ? 'minutes' : run.jhanaSeconds >= 30 ? 'underMinute' : run.jhanaSeconds > 0 || s.maxP > 0.6 ? 'seconds' : 'none';
  return {
    truth: { ignited: run.ignited, jhanaSeconds: run.jhanaSeconds, maxP: s.maxP },
    report: { minutes: plan.totalMin, rung, symptoms, answers, duration },
  };
}
