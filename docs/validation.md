# Validation: how success would be established

Nothing in this repository has been tested on people. This document says what would count as
success, how to keep expectation and relaxation from passing as jhana, and what study to run.

## 1. What counts as "reached jhana"

**Primary definition (binary, blind-rated).** A participant has reached first jhana when a rater
who does not know the participant's study arm judges, from the participant's free-text
description of a sit written *before* any checklist, that all five criteria in
[06-discrimination.md](understanding/06-discrimination.md) were met: strong pleasant feeling,
self-sustaining, absorbed, bright, lasting about a minute or more. The type meant is
"intermediate" jhana in Sparby & Sacchet's classification [S13].

**Secondary definitions.**

| Outcome | Definition | Why include it |
|---|---|---|
| App-scored jhana | `isJhana()` in `src/jhanaScore.js`: five criteria met on the checklist, no response-bias flag | Cheap; lets the instrument be validated against the rater |
| Repeated jhana | The primary definition met on two different days | Rules out one-off flukes and wishful single reports |
| Best ladder rung | Highest of the eight rungs reached | Ordinal, far more sensitive than a rare binary event |
| Sits to first take-off | First sit at rung 5 or above | Time-to-event; uses everyone's data |
| Process traces | Time of first in-sit "here" tap; minutes stayed after it | Recorded during the sit, before memory can reshape it |

## 2. Keeping relaxation and expectation out

| Threat | Control |
|---|---|
| **Relaxation scored as jhana** | The conjunction: relaxation lacks strong pleasure, a self-running quality, and often brightness. Counter-items for drowsiness and drifting. Rater trained on contrast cases |
| **Expectation and demand** | Both arms receive the *same* description of jhana and the same checklist, so expectation is equal. Free description before the checklist. Foil items. Rater blind to arm |
| **Participants learning the "right" answers** | Primary outcome rests on the free text, not the checklist. Follow-up questions about features nobody was told about (afterglow, breathing change, what happened to the excitement over time) |
| **Dose mistaken for coaching** | Control arm matched on sit length and frequency (see 3). The simulation makes the danger concrete: "sit longer" alone was the strongest non-coach strategy (`sim/results/POLICIES.md`, simulated) |
| **Attention from the app itself** | Control arm uses the same app shell, same debrief questions, same progress screen |
| **Selective dropout** | Intention to treat; dropouts counted as not reached |
| **Rater drift** | Two raters on a 25% overlap; report Cohen's kappa; resolve by discussion |

Optional corroboration, analysed as secondary: phone breathing rate and stillness during the
rest phase. Slower breathing is expected in jhana [S6] but also in relaxation, so it can support
a claim and cannot make one.

## 3. Study design

**Question.** Does between-sit diagnosis and adaptation raise the proportion of beginners who
reach first jhana in three weeks of home practice, compared with an identical guided sit that
never adapts?

| | |
|---|---|
| Design | Two-arm, parallel, randomised, participant-masked to hypothesis, rater-blind |
| Participants | Adults; fewer than 100 lifetime hours of meditation; never knowingly experienced jhana |
| Exclusions | History of psychosis or mania; current major depressive episode; recent trauma or major loss; currently in psychiatric crisis. Self-declared, with a screening call for anyone unsure |
| Arm A: adaptive coach | Ember as built: plan changes after every debrief; seed search |
| Arm B: fixed guide | Same app, same first plan every sit, same debrief and progress screens. **Sit length yoked**: each control participant's sit lengths follow the schedule of a randomly paired Arm A participant, so dose is equal |
| Dose | One sit a day for 21 days, 20–45 minutes |
| Primary outcome | Blind-rated first jhana on at least one sit by day 21 |
| Key secondaries | Best ladder rung (ordinal); sits to first take-off; repeated jhana; agreement between app score and rater |
| Mechanism checks | Does the first diagnosis predict which prescription helps (interaction of profile × arm)? Do collapses at onset fall after the "do nothing" instruction? |
| Safety | Daily one-tap check ("anything worrying?"); stop rule and signposting on distress; adverse events recorded with the categories Jhourney reports [J3]: sleep disruption, emotional intensity, disorientation, dissociation, anything needing clinical care |
| Analysis | Fisher exact test on the primary; proportional-odds model on best rung; Cox model on sits to take-off; all intention to treat; pre-registered |

### Power

`python3 study/power.py` simulates the trial, including dropout and rater error
([`study/POWER.md`](../study/POWER.md)). Under the planning assumptions (15% reach jhana with the
fixed guide, 35% with the coach, 25% dropout, rater sensitivity 0.85 and specificity 0.95):

- about **200 per arm** for 80% power on the binary outcome;
- 100 per arm gives about 54%; 30 per arm gives about 14%;
- rater false positives are the most damaging input: specificity 0.85 cuts power from 83% to 66%.

These rest entirely on guessed rates. No one has published the rate at which unsupervised
beginners reach jhana by a fixed definition.

### So run a pilot first

A 60-person pilot (30 per arm, three weeks) cannot test the hypothesis. It can deliver what the
power calculation is missing and decide whether a trial is worth running:

1. the control-arm rate of blind-rated jhana;
2. dropout;
3. agreement between two raters, and between rater and app score;
4. whether the ladder moves at all in three weeks (if almost nobody passes rung 3 in either arm,
   the dose is too low and the design must change before anything else);
5. adverse events.

**Go / no-go after the pilot.** Go if the control rate is between 5% and 40%, dropout is under
40%, rater kappa is at least 0.6, and no serious adverse event occurred. If the control rate is
near zero, move to a higher dose (weekend intensive) before comparing arms.

### A cheaper within-person test of the central claim

The opposite-fixes claim can be tested without waiting for jhana. Recruit people the first
debrief classes as strivers or as scattered. Randomise each to "use half the effort" or "count
breaths and stay longer on the anchor" for the next three sits. Outcome: change in ladder rung.
The theory predicts a crossover interaction: less effort helps strivers and hurts the scattered,
and the reverse. About 25 per cell would detect a one-rung interaction (a rough estimate assuming
a between-person SD of one rung; not simulated).

## 4. What has been validated so far, and what has not

| Component | Evidence today | Kind |
|---|---|---|
| Coach logic does what it is specified to do | Unit tests (`make test`) | Software correctness |
| App runs end to end at phone width | Headless-browser test, two journeys | Software correctness |
| Diagnoses agree with the teachers they were derived from | 18 of 18 covered cases; 1 known gap | Consistency, same-author coding |
| Prescriptions push the right way for the failure they name | Simulation: full coach beats each ablation; opposite effects by type | Internal to the theory. **Simulated** |
| Breath-rate estimation | Synthetic signals only | **Simulated** |
| EEG signatures and feasibility of feedback | Real open data, 26 experts | Real, observational, experts only |
| Voice, sound, wake lock on real phones | Not checked | None |
| LLM interview | Prompt unit-tested for content; never run live | None |
| Any effect on any person | Nothing | None |

## 5. Where real data plugs in

| Simulated today | File | Replace with |
|---|---|---|
| Meditators and their sits | `sim/students.mjs` | Exported app logs (Progress → Export as JSON) from pilot participants; `sim/run_policies.mjs` then becomes an analysis of real trajectories |
| Accelerometer signals | `synthAccel()` in `src/breath.js` | Phone recordings with a chest-belt reference |
| Trial outcomes | `study/power.py` | Pilot rates for control arm, dropout and rater accuracy as the script's inputs |
| EEG features when the dataset is absent | `eeg/stats.py --simulated` | `python3 eeg/download.py && python3 eeg/extract.py` (already done for the committed report) |
