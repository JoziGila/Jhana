# Power analysis for the proposed study

> Simulation under **assumed** effect sizes. No participant data exists yet.

Design: two arms, equal allocation, binary primary outcome (blind-rated first jhana within 21 days), intention to treat with dropouts counted as failures, two-sided Fisher exact test, alpha 0.05. 3000 simulated trials per cell. Default assumptions: 25% dropout, rater sensitivity 0.85, specificity 0.95.

## Participants per arm needed for 80% power

| True rate, matched control | True rate, adaptive coach | Per arm | Total |
|---|---|---|---|
| 10% | 25% | 300 | 600 |
| 10% | 30% | 200 | 400 |
| 15% | 30% | 400 | 800 |
| 15% | 35% | 200 | 400 |
| 20% | 35% | 400 | 800 |
| 20% | 40% | 200 | 400 |
| 30% | 45% | 400 | 800 |

## Power at fixed sizes for the planning scenario (15% vs 35%)

| Per arm | Power |
|---|---|
| 30 | 14% |
| 50 | 25% |
| 80 | 41% |
| 100 | 54% |
| 120 | 61% |
| 150 | 71% |

## Sensitivity of the planning scenario (per arm fixed at the 80% figure above)

| Change | Power |
|---|---|
| as planned | 83% |
| dropout 40% | 73% |
| no dropout | 95% |
| rater sensitivity 0.70 | 73% |
| rater specificity 0.85 (more false positives) | 66% |
| true effect smaller: 15% vs 30% | 62% |
| no true effect: 15% vs 15% (false-positive rate) | 3% |

## Reading this

- With 15% in the control arm and 35% with the coach, about **200 per arm** gives 80% power under these assumptions.
- Dropout and an unreliable rater both cost power, because every lost or missed success shrinks the observed gap. Rater false positives cost the most: they add noise to both arms.
- The control rate is the biggest unknown. No published figure exists for unsupervised home practice with a fixed definition of success; the pilot's first job is to estimate it.
- A pilot of 30 per arm cannot detect the planned effect reliably. It can estimate the control rate, dropout and rater agreement, which are the inputs this table needs.
