# Exploration: approaches considered, ranked, built, kept or dropped

Theory references are to [`docs/understanding/`](understanding/README.md): conditions C1–C6 are
defined in [05-conditions.md](understanding/05-conditions.md), loop terms in
[04-mechanism.md](understanding/04-mechanism.md).

## A reframing of the problem

The brief asks for software that helps a beginner *reach jhana*. The theory says the binary
event is the end of a causal chain, that wanting it is one of the main things that stops it, and
that people stall at different links whose fixes are opposites. So the problem pursued here is:

> **Find which link in the loop is failing for this person, and change the next sit to fit.**

Three consequences: the product is a diagnostician, not a guided-audio player; progress is
measured on a ladder of leading indicators, not on jhana yes/no; and nothing in the product
should raise the stakes (no streaks, no targets, no congratulations for attainment).

A note on novelty: Jhourney, the fastest-teaching provider, already works this way with human
facilitators who read journals daily, and now also offers an "AI facilitator" [J1]. This project
is an open, inspectable version of the same idea with an explicit theory behind each
prescription. It does not claim a new method.

## 1. Candidate approaches

Eighteen candidates, each tied to the part of the theory it targets.

| # | Approach | Targets | What it would be |
|---|---|---|---|
| A1 | **Loop-diagnostic coach** | All conditions; finds the binding one | Post-sit debrief → diagnosis of the failing link → changed plan for the next sit |
| A2 | **Guided sit that goes quiet** | C3, C4 | Phase-structured voice guidance, front-loaded, silent once the feeling is present |
| A3 | **Seed finder** | C1 | Try several ways of sparking the feeling in the first sits; converge on what works (bandit) |
| A4 | **Onset inoculation** | C4 | Tell people before the sit exactly what to do when it surges: nothing |
| A5 | **LLM post-sit interview** | Diagnosis quality | A short conversation that asks the follow-up questions a human coach would |
| A6 | **Ladder of leading indicators** | Motivation without grasping | Eight observable rungs in place of yes/no; no streaks |
| A7 | **Pre-sit state check** | C5, hindrance load | Thirty seconds on energy, agitation, mood → today's adjustments |
| A8 | **Phone-sensor settling** | C6, validation | Accelerometer on the belly → breathing rate and stillness |
| A9 | **Breath pacing** | C3 (at the start only) | A slow tone with a long out-breath during settling |
| A10 | **Loop simulator to play with** | Understanding of C3/C4 | An interactive model: move effort and grabbing, watch it catch or fail |
| A11 | **EEG neurofeedback** | Ignition detection | Headband → complexity/power → sound that rewards the jhana signature |
| A12 | **Home retreat day** | C6 | A scheduled 4–6 hour day of sits and walks |
| A13 | **Micro-sits with reflection** | C1, C4 by repetition | Four 15-minute sits each followed by notes [FP7] |
| A14 | **Kindness-first track** | Permission | Self-compassion or forgiveness sits before any jhana attempt, for the guarded |
| A15 | **Peer debrief and cohort** | Doubt; belief | Pairs interview each other after sits; hearing others' entries |
| A16 | **Soundscape / masking** | Hindrance load | Generated noise bed to hide household sound |
| A17 | **Music-chills priming** | C1 | Use frisson from music as a seed, then sit with the afterglow |
| A18 | **Screen kasina / afterimage** | C2 | A glowing disc to stare at, then its afterimage as an object |
| A19 | **Camera heart-rate variability** | Validation | Fingertip on the phone camera → HRV |
| A20 | **Time-of-day learning** | C5 | Learn from the log when this person sits best |

## 2. Scoring

Each 1–5. **Impact**: expected effect on time to first jhana if it works. **Fit**: how directly it
follows from the theory. **Feasible**: buildable in software now. **Testable**: can its core claim
be checked, here or in a small study. **No hardware**: 5 = phone only.
Score = 2×Impact + 2×Fit + Feasible + Testable + No hardware (max 35).

| # | Approach | Impact | Fit | Feasible | Testable | No hardware | **Score** | Decision |
|---|---|---|---|---|---|---|---|---|
| A1 | Loop-diagnostic coach | 5 | 5 | 4 | 4 | 5 | **33** | Built; the core |
| A2 | Guided sit that goes quiet | 4 | 5 | 5 | 4 | 5 | **32** | Built |
| A4 | Onset inoculation | 4 | 5 | 5 | 5 | 5 | **33** | Built (a line in every sit) |
| A3 | Seed finder | 4 | 4 | 5 | 4 | 5 | **30** | Built |
| A6 | Ladder | 3 | 5 | 5 | 4 | 5 | **30** | Built |
| A7 | Pre-sit state check | 3 | 4 | 5 | 4 | 5 | **28** | Built |
| A5 | LLM post-sit interview | 4 | 4 | 4 | 3 | 5 | **28** | Built, untested live |
| A10 | Loop simulator | 2 | 5 | 5 | 3 | 5 | **27** | Built (Learn tab) |
| A12 | Home retreat day | 5 | 4 | 4 | 3 | 5 | **30** | Not built; top of the next list |
| A14 | Kindness-first track | 4 | 4 | 4 | 3 | 5 | **28** | Partly (one prescribed sit); not a track |
| A13 | Micro-sits with reflection | 3 | 4 | 5 | 4 | 5 | **28** | Not built |
| A8 | Phone-sensor settling | 2 | 3 | 4 | 4 | 5 | **23** | Built; kept as passive logging only |
| A9 | Breath pacing | 2 | 3 | 5 | 4 | 5 | **24** | Built; restricted to the settling phase |
| A16 | Soundscape | 1 | 2 | 5 | 3 | 5 | **19** | Built as an option; minor |
| A17 | Music-chills priming | 3 | 3 | 4 | 3 | 5 | **24** | Built as one seed |
| A15 | Peer debrief / cohort | 4 | 3 | 2 | 2 | 5 | **23** | Not built (needs people) |
| A20 | Time-of-day learning | 2 | 3 | 4 | 3 | 5 | **22** | Not built |
| A19 | Camera HRV | 2 | 2 | 2 | 3 | 5 | **18** | Not built |
| A18 | Screen kasina | 2 | 2 | 4 | 2 | 5 | **19** | Not built: targets C2, which is rarely binding, and leans toward the deep path |
| A11 | EEG neurofeedback | 3 | 2 | 2 | 4 | 1 | **17** | **Analysed on real data and dropped** |

Why the top of the ranking looks the way it does: the theory says diagnosis (A1) and the onset
instruction (A4) act on the commonest binding conditions, and both cost nothing in hardware.
A12 scores high because dose is the largest gap between an app and a retreat; it was left for
next because it is a schedule, not a mechanism, and because the simulation and the literature
both warn that dose must be controlled for before anything else can be evaluated.

## 3. What was prototyped and what happened

### Kept

**A1 + A2 + A3 + A4 + A6 + A7: the Ember app** (`app/`, `dist/ember.html`).
One loop: guided sit → debrief → diagnosis → changed plan. 18 diagnosable patterns
(`kb/blockers.json`), 24 symptoms, 8 seeds, an 8-rung ladder, a five-criterion jhana reading with
foil items.

- *Tested how:* 52 unit tests on the logic (plus 9 on the EEG code); a headless-browser test of two full journeys;
  19 real problem → diagnosis pairs from teachers' Q&A and practitioners' accounts, on which the
  engine agrees with the source in all 18 that its categories cover (same-author coding, not
  blind: a consistency check, not validation); a simulation in which the full coach beats every
  ablation of itself (`sim/results/POLICIES.md`, simulated).
- *What the testing changed:* the simulation showed the coach misreading "grabbers" as a plateau
  nine times in ten, which led to applying a strong runner-up diagnosis as well as the winner
  (`docs/log.md` #10). The research added an inner-critic pattern and breath-fading reassurance
  that the first version lacked (#8).
- *Not tested:* on any person.

**A5: LLM interview** (`src/coachPrompt.js`, `app/claude.js`). Available only when the app is
opened as a published Claude artifact. The prompt carries the theory, the blocker list, the
sit's report and recent history, and rules: one question at a time, do not confirm attainment
without clear evidence, never raise the stakes, stop and signpost on distress. Kept because it
is the nearest software equivalent of what the fastest providers do with humans [J1]. A planned
comparison of LLM and rule-based diagnosis against teacher answers was not run (#6).

**A10: loop simulator.** Kept as teaching. It lets someone feel "more effort makes it worse"
before their first sit. Labelled in the app as a model, not data.

### Kept in a reduced role

**A8: phone breath sensing** (`src/breath.js`). Recovers breathing rate within 0.6 breaths a
minute on synthetic signals from 4 to 22 a minute, and flags fidgeting. Kept as passive logging
for validation studies. **Not** used to steer the sit, for three reasons: it has not been run on a
real device; slower breathing marks settling, not jhana [S6]; and it needs the phone on the body,
which is a posture constraint. It does not work inside the published artifact, only in the
standalone file.

**A9: breath pacing.** Kept for the first few minutes only. Controlling the breath is effort, and
the theory says effort must fall; a pacer that ran all sit would train the wrong thing. Switched
off automatically for people who report drowsiness.

### Dropped

**A11: EEG neurofeedback.** Dropped after analysing the real open dataset (28 sessions, 26
experts; `eeg/results/REPORT.md`). Reasons, in order of weight:

1. A classifier trained on other people cannot tell jhana from access concentration
   (cross-subject AUC 0.37–0.47). That is the distinction a learner needs.
2. It tells jhana from an eyes-closed baseline at AUC 0.72–0.74, but tells two baselines from
   each other at 0.67–0.69. Most of what it detects is "a different part of the session".
3. Smile-muscle activity alone separates first jhana from baseline as well as the EEG does
   (AUC 0.74), and across people the size of the complexity and slope effects tracks the size of
   the smile-muscle effect (Spearman r = 0.63 and 0.77). A forehead headband would largely be
   measuring the face.
4. The published signatures are real but small across people (dz 0.4–0.6) and strongest in
   first jhana, weakest in fourth.
5. No recording of a beginner's first entry exists anywhere, so there is nothing to train on.

One thing did hold up: four channels do as well as sixty-four on these features. The channel
count is not the obstacle; specificity is.

**A18: screen kasina, A19: camera HRV.** Not built. Kasina targets attention stability, which the
theory says is seldom the binding constraint, and steers toward the deep path. Camera HRV needs
a fingertip on the lens for the whole sit.

### Not built, would build next

A12 home retreat day; A14 a kindness-first track for people the coach reads as guarded; A13
micro-sits with reflection; A15 peer debrief.

## 4. Which won and why

The **loop-diagnostic coach with a guide that goes quiet** (A1 + A2 + A4, with A3 and A6).
It is the only candidate that acts on the binding constraint for each profile in
[05-conditions.md](understanding/05-conditions.md), it needs nothing but a phone, and it is the
approach the fastest real-world provider has converged on with human staff. Inside the model it
is also the only strategy that helps every type of simulated person; "push harder" rescues the
sleepy and the scattered and wrecks the strivers, which is the opposite-fixes point made
concrete.

What it has not earned yet is any claim about people. That is what `docs/validation.md` is for.
