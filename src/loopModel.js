// A minimal causal model of the first-jhana feedback loop.
//
// This is the executable form of docs/understanding/04-mechanism.md. It is a THEORY, not a
// measurement: constants are chosen so that time scales look like the reports (minutes to settle,
// a few minutes from "locked on" to full ignition), and every conclusion drawn from it is a
// statement about what the theory predicts, not about people.
//
// State (all in [0, 1]):
//   a  attention stability   – fraction of attention resting where it is aimed
//   p  pleasure              – intensity of the pleasant feeling (piti-sukha)
//   t  tension               – bodily / mental contraction produced by straining and grasping
//   g  grasping              – wanting-more, excitement, checking "is this it?"
//   h  hindrance load        – background restlessness, worry, irritation (settles with time)
//   e  energy                – alertness; low values mean dullness
//
// Action (what the meditator is doing this second):
//   effort  0..1   deliberate attentional effort
//   target  'anchor' | 'pleasure'   where attention is aimed
//   seed    0..1   actively evoking a pleasant feeling (smile, goodwill, memory …)
//   relax   0..1   deliberately softening / releasing
//
// Traits (stable-ish properties of the person, all 0..1):
//   attnSkill   how well effort turns into stability
//   openness    how strongly attended pleasure amplifies (sensitivity / willingness to feel good)
//   seedPower   how much feeling a seed act produces (depends on person × seed type)
//   wanting     how much rising pleasure triggers excitement and grasping
//   letGo       how quickly grasping and tension release
//   strain      how much tension a unit of effort creates
//   drowsy      tendency to sink when effort is low and nothing interesting is happening
//   hindrance0  hindrance load at the start of a sit
//   inoculated  0..1 how prepared the person is for the onset ("when it starts, do nothing")

import { clamp01 } from './rng.js';

export const K = Object.freeze({
  effortGain: 0.12, // attention gained per second per unit skilled effort
  capture: 0.15, // reward capture: pleasure holding attention by itself
  hPull: 0.05, // hindrances pulling attention away
  gPull: 0.05, // grasping / checking diverting attention to the meta level
  dullPull: 0.03, // dullness dissolving attention
  settle: 0.004, // hindrances quieten while attention stays put
  hNoise: 0.0006, // spontaneous intrusions
  strain: 0.03, // tension produced by effort (scaled by effort squared)
  gTension: 0.02, // tension produced by grasping
  relaxBase: 0.008, // tension released passively
  relaxAct: 0.04, // tension released by a deliberate relax act (scaled by letGo)
  seedGain: 0.012, // pleasure added per second of seeding
  amp: 0.055, // loop amplification of attended pleasure
  attnPower: 3, // only continuous attention amplifies: amplification ∝ (attention on pleasure)^3
  tensionPower: 2, // pleasure amplification is multiplied by (1 - t)^tensionPower
  pRelax: 0.03, // pleasure melts tension
  pSettle: 0.01, // pleasure quietens hindrances
  decay: 0.01, // pleasure fades at this rate when nothing feeds it
  gKill: 0.04, // grasping squashes pleasure
  excite: 2.0, // rising pleasure → excitement
  onsetJolt: 0.45, // one-off "it's happening!" jolt when pleasure first becomes obvious
  onsetLevel: 0.35, // pleasure level at which the onset is noticed
  frustrate: 0.0004, // slow build-up of wanting when nothing happens
  gRelease: 0.012, // grasping released per second (scaled by letGo and relax)
  eUp: 0.01, // pleasure and engagement raise energy
  eDown: 0.006, // low effort + no interest → sinking
});

export const DEFAULT_TRAITS = Object.freeze({
  attnSkill: 0.5,
  openness: 0.5,
  seedPower: 0.5,
  wanting: 0.5,
  letGo: 0.4,
  strain: 0.5,
  drowsy: 0.3,
  hindrance0: 0.5,
  inoculated: 0,
});

export function initialState(traits = DEFAULT_TRAITS) {
  return { a: 0.1, p: 0.02, t: 0.3, g: 0.1, h: traits.hindrance0, e: 0.7, onsetSeen: false };
}

/** How much of the available attention actually lands on the pleasant feeling. */
export function attentionOnPleasure(state, action) {
  return state.a * (action.target === 'pleasure' ? 1 : 0.15);
}

/**
 * Loop gain L for small p. L > 1 means attended pleasure grows by itself; L < 1 means it fades.
 * This is the central quantity of the theory (docs/understanding/04-mechanism.md).
 */
export function loopGain(state, action, traits, k = K) {
  return amplification(state, action, traits, k) / (k.decay + k.gKill * state.g);
}

/** Per-second growth rate that attention lends to the pleasure (before saturation and losses). */
export function amplification(state, action, traits, k = K) {
  const ap = attentionOnPleasure(state, action);
  return k.amp * (0.3 + 1.4 * traits.openness) * Math.pow(ap, k.attnPower) * Math.pow(1 - state.t, k.tensionPower);
}

/** Advance the model by dt seconds. `rng` is optional; without it the model is deterministic. */
export function step(state, action, traits = DEFAULT_TRAITS, dt = 1, rng = null, k = K) {
  const { a, p, t, g, h, e } = state;
  const effort = clamp01(action.effort ?? 0);
  const seed = clamp01(action.seed ?? 0);
  const relax = clamp01(action.relax ?? 0);
  const noise = rng ? rng.normal() : 0;

  // Pleasure: seeding + the amplifying loop - decay - grasping.
  const amp = amplification(state, action, traits, k);
  const dp =
    k.seedGain * seed * traits.seedPower * (0.4 + 0.6 * a) * (1 - p) +
    amp * p * (1 - p * p) -
    (k.decay + k.gKill * g) * p;

  // Attention: skilled effort + reward capture - pulls.
  const capture = action.target === 'pleasure' ? k.capture * p : 0;
  const da =
    (k.effortGain * traits.attnSkill * effort + capture) * (1 - a) -
    (k.hPull * h + k.gPull * g + k.dullPull * (1 - e)) * a;

  // Tension: straining and grasping create it; relaxing and time release it.
  const dT =
    (k.strain * traits.strain * effort * effort + k.gTension * g) * (1 - t) -
    (k.relaxBase + k.relaxAct * relax * (0.3 + traits.letGo) + k.pRelax * p) * t;

  // Grasping: excitement at rising pleasure, slow frustration when nothing happens.
  let dg =
    k.excite * traits.wanting * (1 - 0.7 * traits.inoculated) * Math.max(0, dp) * (1 - g) +
    k.frustrate * traits.wanting * (1 - p) * (1 - g) -
    k.gRelease * (0.2 + traits.letGo) * (1 + relax) * g;

  // Hindrances settle while attention stays put; intrusions arrive at random.
  const dh = -(k.settle * a + k.pSettle * p) * h + k.hNoise * (1 + noise) * (1 - h);

  // Energy: engagement and pleasure wake the mind up; slack with nothing happening sinks it.
  const de = k.eUp * (0.5 * effort + p) * (1 - e) - k.eDown * traits.drowsy * (1 - effort) * (1 - p) * e * 2;

  const next = {
    a: clamp01(a + da * dt + (rng ? 0.004 * noise * Math.sqrt(dt) : 0)),
    p: clamp01(p + dp * dt),
    t: clamp01(t + dT * dt),
    g: clamp01(g + dg * dt),
    h: clamp01(h + dh * dt),
    e: clamp01(e + de * dt),
    onsetSeen: state.onsetSeen,
  };

  // The onset jolt: the first time the pleasure becomes unmistakable, an unprepared mind grabs.
  if (!state.onsetSeen && next.p >= k.onsetLevel) {
    next.onsetSeen = true;
    next.g = clamp01(next.g + k.onsetJolt * traits.wanting * (1 - traits.inoculated));
  }
  return next;
}

/** Coarse state label used by the simulations and the explainer. */
export function classify(state) {
  if (state.p > 0.65 && state.a > 0.8) return 'jhana1';
  if (state.e < 0.3) return 'dull';
  if (state.p > 0.3) return 'pleasure-building';
  if (state.a > 0.55 && state.h < 0.3) return 'access';
  return 'ordinary';
}

/**
 * Run one sit.
 * @param {object} traits
 * @param {(ctx: {t:number, state:object, traits:object}) => object} policy  returns an action
 * @param {object} opts { seconds, dt, rng, record }
 * @returns {{ignited:boolean, ignitionTime:number|null, jhanaSeconds:number, trace:object[], summary:object}}
 */
export function runSit(traits, policy, opts = {}) {
  const seconds = opts.seconds ?? 1800;
  const dt = opts.dt ?? 1;
  const rng = opts.rng ?? null;
  const k = opts.k ?? K;
  const record = opts.record ?? 0; // record every N seconds (0 = no trace)
  let state = opts.initial ?? initialState(traits);
  const trace = [];
  let jhanaRun = 0;
  let jhanaSeconds = 0;
  let ignitionTime = null;
  let maxP = 0;
  let onsetCollapses = 0;
  let wasBuilding = false;
  let sumT = 0;
  let sumG = 0;
  let sumA = 0;
  let minE = 1;
  let accessTime = null;
  let pAtEnd = 0;
  let memory = {};

  for (let s = 0; s < seconds; s += dt) {
    const ctx = { t: s, state, traits, memory, seconds };
    const action = policy(ctx);
    state = step(state, action, traits, dt, rng, k);
    maxP = Math.max(maxP, state.p);
    sumT += state.t;
    sumG += state.g;
    sumA += state.a;
    minE = Math.min(minE, state.e);
    if (accessTime === null && state.a > 0.55 && state.h < 0.3) accessTime = s;

    // Count "false starts": pleasure climbed past the onset level and then fell back.
    if (state.p > k.onsetLevel) wasBuilding = true;
    if (wasBuilding && state.p < k.onsetLevel * 0.5) {
      onsetCollapses += 1;
      wasBuilding = false;
      state.onsetSeen = false; // the next rise will be noticed afresh
    }

    if (classify(state) === 'jhana1') {
      jhanaRun += dt;
      jhanaSeconds += dt;
      if (jhanaRun >= 30 && ignitionTime === null) ignitionTime = s - 30;
    } else {
      jhanaRun = 0;
    }
    if (record && s % record === 0) trace.push({ s, ...state, L: loopGain(state, action, traits, k), ...action });
    pAtEnd = state.p;
  }
  const n = seconds / dt;
  return {
    ignited: ignitionTime !== null,
    ignitionTime,
    jhanaSeconds,
    trace,
    summary: {
      maxP,
      pAtEnd,
      meanTension: sumT / n,
      meanGrasp: sumG / n,
      meanAttention: sumA / n,
      minEnergy: minE,
      accessTime,
      onsetCollapses,
      finalState: state,
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Policies: stylised ways a meditator might run a sit. Parameters are the "habits" a coach can
// change between sits. See sim/ for how they are compared.
// ---------------------------------------------------------------------------------------------

export const DEFAULT_HABITS = Object.freeze({
  settleSeconds: 240, // time spent relaxing and gathering before looking for pleasure
  gatherSeconds: 0, // further time kept on the anchor whatever happens
  effortAnchor: 0.6, // effort while on the anchor
  effortPleasure: 0.5, // effort while resting on pleasure, before it grows
  easeOff: 0, // 0..1 how much effort is dropped as pleasure rises ("do less as it grows")
  relaxDrive: 0.2, // how much deliberate softening is mixed in
  reseedBelow: 0.08, // re-evoke the feeling when it falls below this
  switchAt: 0.5, // attention stability required before turning to the pleasure
  wakeUp: 0, // 0..1 counter-dullness measures (eyes open, posture, brighter interest)
});

/** Build a policy from habit parameters. */
export function habitPolicy(habits = DEFAULT_HABITS) {
  const hb = { ...DEFAULT_HABITS, ...habits };
  return ({ t, state }) => {
    if (t < hb.settleSeconds) {
      // Arrive: soften and gather on the anchor.
      return { effort: hb.effortAnchor, target: 'anchor', seed: 0, relax: Math.max(hb.relaxDrive, 0.3) };
    }
    if (t < hb.settleSeconds + hb.gatherSeconds || (state.a < hb.switchAt && state.p < 0.2)) {
      // Not steady enough yet: stay with the anchor.
      return { effort: hb.effortAnchor, target: 'anchor', seed: 0.2, relax: hb.relaxDrive };
    }
    const ease = 1 - hb.easeOff * Math.min(1, state.p / 0.6);
    const effort = Math.max(hb.wakeUp * 0.25, hb.effortPleasure * ease);
    return {
      effort,
      target: 'pleasure',
      seed: state.p < hb.reseedBelow ? 1 : state.p < 0.25 ? 0.4 : 0,
      relax: hb.relaxDrive,
    };
  };
}

/** The intuitive beginner strategy: concentrate as hard as possible the whole time. */
export const STRIVE_HABITS = Object.freeze({
  ...DEFAULT_HABITS,
  settleSeconds: 60,
  effortAnchor: 0.95,
  effortPleasure: 0.95,
  easeOff: 0,
  relaxDrive: 0,
  switchAt: 0.6,
});

/** Passive relaxation with no object and no seed: the "pleasant nap" control. */
export const DRIFT_HABITS = Object.freeze({
  ...DEFAULT_HABITS,
  settleSeconds: 1e9,
  effortAnchor: 0.1,
  relaxDrive: 0.8,
});
