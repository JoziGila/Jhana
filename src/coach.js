// The coach: the one place where a finished sit turns into the next plan.
// Pure functions over a serialisable state, shared by the app and by the simulations.

import { scoreReport, isJhana } from './jhanaScore.js';
import { diagnose } from './diagnose.js';
import { firstPlan, nextPlan, newBandit } from './planner.js';
import { updateArm, rewardFromRung } from './bandit.js';

export const STATE_VERSION = 1;

export function newState(profile = {}) {
  const bandit = newBandit(profile);
  return {
    v: STATE_VERSION,
    onboarded: false,
    profile,
    settings: { voice: 'auto', voiceRate: 0.9, soundscape: false, taps: true, sensor: false },
    bandit,
    plan: firstPlan(profile, bandit),
    planChanges: [],
    sits: [],
  };
}

/** Rebuild plan and bandit after the onboarding profile changes. */
export function applyProfile(state, profile) {
  const bandit = newBandit(profile);
  return { ...state, profile, bandit, plan: firstPlan(profile, bandit), planChanges: [], onboarded: true };
}

/**
 * Record a finished sit and work out the next plan.
 * @param {object} state
 * @param {object} report  { minutes, rung, symptoms[], answers{}, duration, note, taps, sensor }
 * @param {Function} rng   seeded RNG (for the seed bandit)
 * @returns {{state:object, sit:object}}
 */
export function completeSit(state, report, rng, now = Date.now()) {
  const score = scoreReport(report.answers ?? {}, report.duration ?? 'none');
  const jhana = isJhana(score);
  const history = state.sits.map((s) => ({ rung: s.rung, diagnosis: s.diagnosis }));
  const diagnosis = diagnose({ rung: report.rung, symptoms: report.symptoms ?? [], minutes: report.minutes, jhana }, history);

  // Learn about the seed that was used (only seeds the bandit tracks).
  let bandit = state.bandit;
  const usedSeed = state.plan.seed;
  if (bandit.arms[usedSeed] && report.rung >= 2) {
    // Sits that never got as far as looking for the feeling say nothing about the seed.
    bandit = updateArm(bandit, usedSeed, rewardFromRung(report.rung));
  }

  const sit = {
    id: `sit-${now}`,
    at: now,
    minutes: report.minutes,
    plan: state.plan,
    rung: report.rung,
    symptoms: report.symptoms ?? [],
    answers: report.answers ?? {},
    duration: report.duration ?? 'none',
    note: report.note ?? '',
    taps: report.taps ?? { here: [], stuck: [] },
    sensor: report.sensor ?? null,
    score: { label: score.label, labelText: score.labelText, score: score.score, confidence: score.confidence, flags: score.flags, reasons: score.reasons, criteria: score.criteria },
    jhana,
    diagnosis: { primary: diagnosis.primary, secondary: diagnosis.secondary, confidence: diagnosis.confidence, evidence: diagnosis.evidence },
  };

  const { plan, changes } = nextPlan({ lastPlan: state.plan, diagnosis, profile: state.profile, bandit, rng });
  return {
    state: { ...state, bandit, plan, planChanges: changes, sits: [...state.sits, sit].slice(-300) },
    sit,
    diagnosis,
    score,
  };
}

/** Today's adjustments from the pre-sit check, without changing the stored plan. */
export function planForToday(state, preflight, rng) {
  if (!preflight) return { plan: state.plan, changes: [] };
  const pf = nextPlan({ lastPlan: state.plan, diagnosis: null, profile: state.profile, bandit: state.bandit, preflight, rng: null });
  // keep the stored plan's focus, seed and one-shot emphases; nextPlan() without a diagnosis resets them
  const keep = ['focus', 'coachCue', 'prep', 'savor', 'soothe', 'titrate', 'deepen'];
  const plan = { ...pf.plan };
  for (const key of keep) if (state.plan[key] !== undefined && plan[key] === undefined) plan[key] = state.plan[key];
  for (const key of ['savor', 'soothe', 'titrate', 'deepen']) plan[key] = state.plan[key] || plan[key];
  plan.prep = pf.plan.prep ?? state.plan.prep ?? null;
  if ((preflight.mood ?? 2) > 0) plan.seed = state.plan.seed;
  return { plan, changes: pf.changes };
}

/** Counts used by the progress view and by study exports. */
export function stats(state) {
  const sits = state.sits;
  const first = (pred) => {
    const i = sits.findIndex(pred);
    return i < 0 ? null : i + 1;
  };
  return {
    sits: sits.length,
    minutes: Math.round(sits.reduce((s, x) => s + (x.minutes || 0), 0)),
    bestRung: sits.reduce((m, x) => Math.max(m, x.rung), -1),
    jhanaSits: sits.filter((x) => x.jhana).length,
    sitsToFirstTakeoff: first((x) => x.rung >= 5),
    sitsToFirstJhana: first((x) => x.jhana),
  };
}
