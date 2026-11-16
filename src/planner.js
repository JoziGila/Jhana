// The planner: turns what the coach knows (profile, history, today's state, the last diagnosis,
// the seed bandit) into a concrete plan for the next sit.
//
// A plan is the set of "habits" the sit will encourage. The diagnosis engine changes plans by
// small bounded patches (kb/blockers.json → fix.planPatch), so the effect of each prescription is
// inspectable and reversible.

import { blockerById, SEEDS } from './kb.js';
import { createBandit, chooseArm, ranking } from './bandit.js';

export const BASE_PLAN = Object.freeze({
  totalMin: 25,
  settleMin: 4, // arrive: soften, long out-breaths
  gatherMin: 7, // steady attention on the anchor
  kindleMin: 3, // evoke the pleasant feeling
  anchor: 'breath', // 'breath' | 'hands' | 'body'
  anchorHelp: null, // 'count'
  seed: 'smile',
  effort: 'light', // 'feather' | 'light' | 'steady'
  relaxCues: 1, // 0..3 extra softening reminders
  attention: 'narrow', // 'narrow' | 'wide'
  inoculate: true, // prepare for the onset: "if it grows, do nothing"
  framing: 'enjoy', // 'enjoy' | 'no-goal'
  guidance: 'full', // 'full' | 'sparse'
  eyes: 'closed', // 'closed' | 'soft-open'
  posture: 'comfortable', // 'comfortable' | 'upright' | 'supported'
  pacer: true, // slow breathing tone during the arrive phase
  // one-shot emphases, set only by the most recent diagnosis:
  prep: null, // 'move' | 'wake' | 'prime'
  savor: false,
  soothe: false,
  titrate: false,
  deepen: false,
});

const BOUNDS = {
  totalMin: [12, 60],
  settleMin: [2, 10],
  gatherMin: [3, 20],
  kindleMin: [2, 6],
  relaxCues: [0, 3],
};
const ONE_SHOT = ['prep', 'savor', 'soothe', 'titrate', 'deepen'];
const EFFORT_LEVELS = ['feather', 'light', 'steady'];

const clampTo = (key, v) => (BOUNDS[key] ? Math.max(BOUNDS[key][0], Math.min(BOUNDS[key][1], v)) : v);

/** Apply a patch such as {settleMin: "+3", effort: "feather", seed: "switch"} to a plan. */
export function applyPatch(plan, patch = {}) {
  const out = { ...plan };
  for (const [key, val] of Object.entries(patch)) {
    if (key === 'seed' && val === 'switch') {
      out.seedSwitch = true;
    } else if (typeof val === 'string' && /^[+-]\d+$/.test(val)) {
      out[key] = clampTo(key, (Number(out[key]) || 0) + Number(val));
    } else if (typeof val === 'number') {
      out[key] = clampTo(key, val);
    } else {
      out[key] = val;
    }
  }
  return out;
}

/** Priors for the seed bandit from onboarding answers (0..3 each; see app onboarding). */
export function seedPriors(profile = {}) {
  const priors = {};
  for (const seed of SEEDS) {
    if (!seed.onboarding) continue;
    const answer = Number(profile[seed.onboarding.q] ?? 1.5); // 0..3
    // Map the answer to pseudo-observations: strong yes ≈ a couple of prior successes.
    const strength = seed.onboarding.weight;
    priors[seed.id] = {
      alpha: 1 + (strength * answer) / 3,
      beta: 1 + (strength * (3 - answer)) / 3,
    };
  }
  return priors;
}

export function newBandit(profile = {}) {
  const arms = SEEDS.filter((s) => s.onboarding).map((s) => s.id);
  return createBandit(arms, seedPriors(profile));
}

/** The plan for a first sit, shaped by the onboarding profile. */
export function firstPlan(profile = {}, bandit = newBandit(profile)) {
  let plan = { ...BASE_PLAN };
  if ((profile.striver ?? 0) >= 2) plan = applyPatch(plan, { effort: 'feather', relaxCues: '+1' });
  if ((profile.sleepy ?? 0) >= 2) plan = applyPatch(plan, { eyes: 'soft-open', posture: 'upright', pacer: false });
  if ((profile.breathctl ?? 0) >= 2) plan = applyPatch(plan, { anchor: 'hands' });
  if ((profile.experience ?? 0) === 0) plan = applyPatch(plan, { gatherMin: 6 }); // novices: a little less anchor time, same room to rest
  plan.seed = ranking(bandit)[0].id;
  return plan;
}

/**
 * The plan for the next sit.
 * @param {object} args
 *   lastPlan   the plan used last time (or null)
 *   diagnosis  output of diagnose() for the last sit (or null)
 *   profile    onboarding answers
 *   bandit     seed bandit state
 *   preflight  today's state: {energy:0..3, agitation:0..3, mood:0..3, minutes:number|null}
 *   rng        seeded RNG for the bandit draw
 * @returns {{plan:object, changes:string[]}}
 */
export function nextPlan({ lastPlan = null, diagnosis = null, profile = {}, bandit = null, preflight = null, rng }) {
  const b = bandit ?? newBandit(profile);
  let plan = lastPlan ? { ...lastPlan } : firstPlan(profile, b);
  const changes = [];
  for (const key of ONE_SHOT) plan[key] = BASE_PLAN[key];
  delete plan.seedSwitch;
  delete plan.coachCue;
  delete plan.focus;

  if (diagnosis?.blocker) {
    const before = plan;
    // a strong runner-up contributes its changes first; the primary diagnosis wins any conflict
    if (diagnosis.alsoBlocker) {
      const { seed: _ignored, ...rest } = diagnosis.alsoBlocker.fix.planPatch;
      plan = applyPatch(plan, rest);
    }
    plan = applyPatch(plan, diagnosis.blocker.fix.planPatch);
    plan.coachCue = diagnosis.blocker.fix.cue;
    plan.focus = diagnosis.primary;
    const touched = new Set([...Object.keys(diagnosis.blocker.fix.planPatch), ...Object.keys(diagnosis.alsoBlocker?.fix.planPatch ?? {})]);
    for (const key of touched) {
      if (key !== 'seed' && before[key] !== plan[key]) changes.push(describeChange(key, before[key], plan[key]));
    }
  }

  // Seed: Thompson sampling keeps exploring early and settles as evidence accumulates. A
  // "switch" prescription excludes the seed that just failed. A prescribed seed (kindness-self)
  // is used once and does not touch the bandit.
  const prescribed = diagnosis?.blocker?.fix.planPatch.seed;
  if (prescribed && prescribed !== 'switch') {
    plan.seed = prescribed;
    changes.push(`Seed for this sit: ${prescribed}.`);
  } else if (rng) {
    const previous = lastPlan?.seed;
    const chosen = chooseArm(b, rng, { exclude: plan.seedSwitch && previous ? [previous] : [] });
    if (chosen && chosen !== previous) changes.push(`Trying a different spark: ${chosen}.`);
    plan.seed = chosen ?? plan.seed;
  }
  delete plan.seedSwitch;

  // Today's state overrides, applied last and not carried forward.
  if (preflight) {
    if ((preflight.energy ?? 2) <= 0) {
      plan = applyPatch(plan, { eyes: 'soft-open', posture: 'upright', pacer: false, prep: 'wake' });
      changes.push('You are tired: eyes a little open, upright posture, no slow-breathing tone.');
    }
    if ((preflight.agitation ?? 0) >= 2) {
      plan = applyPatch(plan, { settleMin: '+3', pacer: true, prep: plan.prep ?? 'move' });
      changes.push('You are keyed up: a longer settling phase with slow out-breaths.');
    }
    if ((preflight.mood ?? 2) <= 0) {
      plan = applyPatch(plan, { seed: 'comfort', framing: 'no-goal' });
      changes.push('Low mood today: a gentle no-goal sit resting in simple comfort.');
    }
    if (preflight.minutes) plan = fitToMinutes(plan, preflight.minutes);
  }
  return { plan: normalise(plan), changes };
}

/** Scale the opening phases so the plan fits the minutes available, keeping time to rest. */
export function fitToMinutes(plan, minutes) {
  const total = clampTo('totalMin', minutes);
  const opening = plan.settleMin + plan.gatherMin + plan.kindleMin;
  const maxOpening = Math.max(7, total * 0.5);
  if (opening <= maxOpening) return { ...plan, totalMin: total };
  const k = maxOpening / opening;
  return {
    ...plan,
    totalMin: total,
    settleMin: clampTo('settleMin', Math.round(plan.settleMin * k)),
    gatherMin: clampTo('gatherMin', Math.round(plan.gatherMin * k)),
    kindleMin: clampTo('kindleMin', Math.round(plan.kindleMin * k)),
  };
}

/** Make sure the phases fit inside the sit with at least five minutes left for resting. */
export function normalise(plan) {
  const p = { ...plan };
  if (!EFFORT_LEVELS.includes(p.effort)) p.effort = 'light';
  const opening = p.settleMin + p.gatherMin + p.kindleMin;
  // the resting phase is where the loop builds: never leave it less than about eight minutes
  if (p.totalMin < opening + 9) p.totalMin = clampTo('totalMin', opening + 9);
  return p;
}

function describeChange(key, from, to) {
  const names = {
    settleMin: `Settling phase: ${from} → ${to} minutes.`,
    gatherMin: `Time on the anchor: ${from} → ${to} minutes.`,
    kindleMin: `Time to find the feeling: ${from} → ${to} minutes.`,
    totalMin: `Sit length: ${from} → ${to} minutes.`,
    effort: `Effort: ${from} → ${to}.`,
    relaxCues: 'More reminders to soften.',
    attention: `Attention: ${to}.`,
    eyes: to === 'soft-open' ? 'Eyes slightly open.' : 'Eyes closed.',
    posture: `Posture: ${to}.`,
    pacer: to ? 'Slow-breathing tone on while settling.' : 'Slow-breathing tone off.',
    anchor: `Anchor: ${to}.`,
    anchorHelp: to === 'count' ? 'Counting out-breaths to steady attention.' : 'No counting.',
    framing: to === 'no-goal' ? 'No-goal sit.' : 'Enjoyment sit.',
    guidance: `Guidance: ${to}.`,
    inoculate: 'A reminder to do nothing when it starts to grow.',
    prep: to === 'move' ? 'Move for five minutes first.' : to === 'wake' ? 'Wake the body up first.' : 'Warm up the feeling before sitting.',
    savor: 'Emphasis on enjoying the feeling.',
    soothe: 'Emphasis on the calmer happiness under the energy.',
    titrate: 'Approach the edge in small steps.',
    deepen: 'Pointers toward the next jhanas.',
  };
  return names[key] ?? `${key}: ${to}`;
}

/** Explain a plan in one or two sentences for the pre-sit screen. */
export function planHeadline(plan) {
  if (plan.focus) {
    const b = blockerById(plan.focus);
    if (b) return b.fix.instruction;
  }
  return 'Settle, steady your attention, spark a pleasant feeling, then rest on it and enjoy. When it grows, do less.';
}
