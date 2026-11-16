"""Power for the proposed two-arm study (docs/validation.md), by simulation.

    python3 study/power.py        → study/POWER.md

Primary outcome: reached first jhana within the study window (yes/no), judged by a blind rater
from the participant's free description plus the app's criteria. Analysis: intention to treat,
dropouts counted as not reached, two-sided Fisher exact test at alpha = 0.05.

ASSUMPTIONS, not data: the true rates in each arm, dropout, and rater accuracy are all guesses.
The point is to see how sample size responds to them.
"""

import os

import numpy as np
from scipy import stats

RNG = np.random.default_rng(2026)
SIMS = 3000


def one_trial(n, p_control, p_treat, dropout, sens, spec):
    """Returns the Fisher p-value for one simulated trial of n per arm."""
    out = []
    for p in (p_control, p_treat):
        true = RNG.random(n) < p
        stays = RNG.random(n) >= dropout
        # the rater sees only completers; misclassification in both directions
        rated = np.where(true, RNG.random(n) < sens, RNG.random(n) > spec)
        out.append(int((rated & stays).sum()))
    table = [[out[0], n - out[0]], [out[1], n - out[1]]]
    return stats.fisher_exact(table)[1]


def power(n, **kw):
    return float(np.mean([one_trial(n, **kw) < 0.05 for _ in range(SIMS)]))


def n_for_power(target=0.8, **kw):
    for n in (20, 30, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300, 400):
        if power(n, **kw) >= target:
            return n
    return None


def main():
    base = dict(dropout=0.25, sens=0.85, spec=0.95)
    lines = ["# Power analysis for the proposed study\n",
             "> Simulation under **assumed** effect sizes. No participant data exists yet.\n",
             "Design: two arms, equal allocation, binary primary outcome (blind-rated first jhana within 21 days), intention to treat with dropouts counted as failures, two-sided Fisher exact test, alpha 0.05. "
             f"{SIMS} simulated trials per cell. Default assumptions: 25% dropout, rater sensitivity 0.85, specificity 0.95.\n",
             "## Participants per arm needed for 80% power\n",
             "| True rate, matched control | True rate, adaptive coach | Per arm | Total |", "|---|---|---|---|"]
    scenarios = [(0.10, 0.25), (0.10, 0.30), (0.15, 0.30), (0.15, 0.35), (0.20, 0.35), (0.20, 0.40), (0.30, 0.45)]
    chosen = None
    for p0, p1 in scenarios:
        n = n_for_power(p_control=p0, p_treat=p1, **base)
        lines.append(f"| {p0:.0%} | {p1:.0%} | {n if n else '>400'} | {2 * n if n else '>800'} |")
        if (p0, p1) == (0.15, 0.35):
            chosen = n
    lines += ["", "## Power at fixed sizes for the planning scenario (15% vs 35%)\n", "| Per arm | Power |", "|---|---|"]
    for n in (30, 50, 80, 100, 120, 150):
        lines.append(f"| {n} | {power(n, p_control=0.15, p_treat=0.35, **base):.0%} |")
    lines += ["", "## Sensitivity of the planning scenario (per arm fixed at the 80% figure above)\n", "| Change | Power |", "|---|---|"]
    n = chosen or 100
    for label, kw in (("as planned", {}), ("dropout 40%", {"dropout": 0.40}), ("no dropout", {"dropout": 0.0}),
                      ("rater sensitivity 0.70", {"sens": 0.70}), ("rater specificity 0.85 (more false positives)", {"spec": 0.85}),
                      ("true effect smaller: 15% vs 30%", {"p_treat": 0.30}), ("no true effect: 15% vs 15% (false-positive rate)", {"p_treat": 0.15})):
        args = dict(p_control=0.15, p_treat=0.35, **base)
        args.update(kw)
        lines.append(f"| {label} | {power(n, **args):.0%} |")
    lines += ["", "## Reading this\n",
              f"- With 15% in the control arm and 35% with the coach, about **{chosen} per arm** gives 80% power under these assumptions.",
              "- Dropout and an unreliable rater both cost power, because every lost or missed success shrinks the observed gap. Rater false positives cost the most: they add noise to both arms.",
              "- The control rate is the biggest unknown. No published figure exists for unsupervised home practice with a fixed definition of success; the pilot's first job is to estimate it.",
              "- A pilot of 30 per arm cannot detect the planned effect reliably. It can estimate the control rate, dropout and rater agreement, which are the inputs this table needs."]
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "POWER.md"), "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote study/POWER.md (planning scenario 15% vs 35%: {chosen} per arm for 80% power; assumptions, not data)")


if __name__ == "__main__":
    main()
