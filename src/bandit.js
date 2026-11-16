// Seed finder: a Thompson-sampling bandit over ways of evoking the pleasant feeling.
//
// Theory link (docs/understanding/05-conditions.md, condition C1): a person needs *some* reliable
// way to produce a pleasant feeling to attend to, and which way works differs a lot between
// people. Rather than prescribing one seed, try several early and converge on what works.
//
// Each arm keeps a Beta(alpha, beta) belief about "this seed produced a feeling that grew when I
// rested on it". Rewards may be fractional (0..1) so partial progress still teaches something.

/** Create bandit state. `priors` maps armId -> {alpha, beta}; unspecified arms get Beta(1, 1). */
export function createBandit(armIds, priors = {}) {
  const arms = {};
  for (const id of armIds) {
    const p = priors[id] ?? {};
    arms[id] = { alpha: p.alpha ?? 1, beta: p.beta ?? 1, pulls: 0 };
  }
  return { arms };
}

/** Thompson sampling: draw from each arm's belief, pick the best draw. */
export function chooseArm(bandit, rng, { exclude = [] } = {}) {
  let best = null;
  let bestDraw = -1;
  for (const [id, arm] of Object.entries(bandit.arms)) {
    if (exclude.includes(id)) continue;
    const draw = rng.beta(arm.alpha, arm.beta);
    if (draw > bestDraw) {
      bestDraw = draw;
      best = id;
    }
  }
  return best;
}

/** Record an outcome in [0, 1] for an arm. Returns a new bandit (does not mutate). */
export function updateArm(bandit, armId, reward) {
  const r = Math.max(0, Math.min(1, reward));
  const arm = bandit.arms[armId];
  if (!arm) throw new Error(`unknown arm: ${armId}`);
  return {
    arms: {
      ...bandit.arms,
      [armId]: { alpha: arm.alpha + r, beta: arm.beta + (1 - r), pulls: arm.pulls + 1 },
    },
  };
}

/** Posterior mean of each arm, sorted best first. */
export function ranking(bandit) {
  return Object.entries(bandit.arms)
    .map(([id, a]) => ({ id, mean: a.alpha / (a.alpha + a.beta), pulls: a.pulls }))
    .sort((x, y) => y.mean - x.mean);
}

/**
 * Reward from a sit's ladder rung (see src/ladder.js): finding a clear pleasant feeling is partial
 * credit; the feeling growing under attention is what the seed is for.
 */
export function rewardFromRung(rung) {
  if (rung >= 4) return 1;
  if (rung === 3) return 0.5;
  return 0;
}
