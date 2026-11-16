# Coaching strategies compared in simulation

> **SIMULATED.** Every number here comes from the loop model in `src/loopModel.js` applied to made-up people (`sim/students.mjs`). It checks that the coach is consistent with the theory. It is not evidence that the coach helps real people.

600 simulated meditators, the same individuals in every arm, 14 sits each. "Reached" means at least one sit with a minute or more in the model's first-jhana state.

| Strategy | Reached within 14 sits | Median sits to first (among those who reached) | What it is |
|---|---|---|---|
| fixed script | 64% | 2 | The same guided sit every day (a recorded-audio control). |
| sit longer | 83% | 2 | After a sit without take-off, add five minutes. Nothing else changes. |
| push harder | 64% | 2 | The folk strategy: after a sit without take-off, concentrate as hard as possible. Same length. |
| seed search only | 75% | 3 | Tries different sparks and keeps what works; never changes anything else. |
| diagnosis only | 90% | 2 | Diagnoses the failing link and changes the plan; never changes the spark. |
| full coach | 96% | 2 | The app: diagnosis plus seed search. |

## By type of person

| Strategy | open | striver | grabber | guarded | sleepy | scattered | average |
|---|---|---|---|---|---|---|---|
| fixed script | 96% | 89% | 62% | 39% | 5% | 17% | 96% |
| sit longer | 100% | 97% | 96% | 74% | 47% | 47% | 94% |
| push harder | 100% | 46% | 62% | 24% | 77% | 56% | 93% |
| seed search only | 98% | 95% | 68% | 78% | 20% | 18% | 95% |
| diagnosis only | 100% | 100% | 95% | 81% | 81% | 63% | 98% |
| full coach | 100% | 100% | 98% | 99% | 82% | 76% | 100% |

Share of each type in the simulated population (assumed): open 15%, striver 20%, grabber 20%, guarded 15%, sleepy 10%, scattered 10%, average 10%.

## Cumulative share reaching, by sit

| Strategy | sit 1 | sit 2 | sit 3 | sit 5 | sit 7 | sit 10 | sit 14 |
|---|---|---|---|---|---|---|---|
| fixed script | 30% | 36% | 40% | 52% | 57% | 60% | 64% |
| sit longer | 30% | 45% | 55% | 67% | 75% | 80% | 83% |
| push harder | 29% | 40% | 45% | 55% | 60% | 63% | 64% |
| seed search only | 30% | 35% | 42% | 56% | 63% | 69% | 75% |
| diagnosis only | 23% | 51% | 62% | 75% | 81% | 87% | 90% |
| full coach | 28% | 53% | 68% | 84% | 90% | 93% | 96% |

## Does the diagnosis find the planted problem?

Pure archetypes, first sit, sits that did not reach jhana. A hit is a primary diagnosis in the accepted set.

| Planted type | Accepted diagnoses | Hit rate | n |
|---|---|---|---|
| striver | striving, breath-control | 76% | 184 |
| grabber | grasping, checking | 34% | 285 |
| sleepy | dull | 66% | 296 |
| scattered | scattered, unsettled, dose | 83% | 296 |
| guarded | no-seed, plateau, dose | 65% | 272 |

## Reading this

- The ordering of strategies is a property of the theory, and the size of the gaps depends on assumed trait distributions.
- "Push harder" does no better than changing nothing (+1 points). The theory predicts it should not help; here it also does not hurt much, because simulated people who would have succeeded do so before the instruction to push takes effect.
- **Known weakness:** the diagnosis recovers the planted problem less than half the time for: grabber. In the model, a grabber's wanting mostly shows up as a feeling that will not grow, and seldom as a visible collapse, so the coach reads it as a plateau. The plateau advice ("can I enjoy this more?") is not wrong for them, but it is not the planted cause.
- "Sit longer" is a strong baseline inside the model. Any real study must give the control arm the same sit lengths as the coached arm, or dose will be mistaken for coaching.
- The useful checks are internal: the full coach should beat each ablation, and each planted problem should be diagnosed as itself. Where that fails, the engine needs work.
