# Lab notebook

Chronological. Each entry: what I believed, what I did, what I found, what changed.
Entries are numbered so other docs can cite them (`log #7`).

---

## #1 — Priors, written before any research came back (2026-11-16)

Recorded first so that later entries can show what the evidence actually changed.

**P1. Jhana is an ignition event in a positive-feedback loop, not a quantity of concentration.**
Attention resting on a pleasant feeling amplifies the feeling; the feeling makes attention
stickier; fewer distractions means more attention on the feeling. Below a threshold the feeling
fades; above it the loop runs away and saturates. This predicts a sudden onset ("it clicked"),
a self-sustaining quality, and hysteresis (easier to stay in than to get in).

**P2. The binding constraint for most people is the breaker terms, not attention.**
Grasping, checking and bodily tension act as negative feedback that scales with the pleasure
itself (pleasure rises → excitement → loop collapses). If true, this explains why prior
meditation hours barely predict success: years of effortful concentration train the wrong term.

**P3. There is a loop-gain inequality.** Roughly
`gain = (attention on pleasure × relaxed openness × sensitivity) / (decay + grasping)`;
jhana needs gain > 1 held long enough for the feeling to grow. Near gain ≈ 1 growth is very slow
(a "pleasant plateau that neither grows nor fades"), which should show up in reports.

**P4. Effort is inverted-U and its optimum falls as pleasure rises.** Early on some effort is
needed to stay with the object; once pleasure holds attention by itself, continued effort is pure
cost. The key instruction should therefore be time-varying: "do less as it grows".

**P5. Individual differences are mostly about the seed and the breakers.** Fast responders: easy
access to warm feeling, music chills / ASMR, high trait absorption, low self-monitoring. Slow
responders: strivers, high self-monitoring, emotional numbness, hypervigilance, sleepiness.

**P6. The best software framing is diagnosis, not guidance.** A guided-audio player gives everyone
the same script; the loop fails at different links for different people. The product should find
the failing link (no seed / unstable attention / tension / grasping / dullness / fear / doubt)
and change the next sit accordingly.

**P7. Goal pressure is itself a breaker.** Streaks and "did you reach jhana?" framing could make
the product self-defeating. Progress should be measured on leading indicators of loop gain.

**P8. EEG feedback is probably not worth it for beginners yet.** Evidence is mostly single-subject
case studies of adepts; consumer hardware is noisy. Phone sensors (stillness, breathing) are a
cheaper objective proxy. I expect to demote EEG after the literature review.

What would change my mind: reports where forceful concentration reliably produced first jhana in
beginners (against P2/P4); evidence that onset is gradual rather than discontinuous (against P1);
group-level EEG markers that work cross-subject on few channels (against P8).

---
## #2 — Made the theory executable (`src/loopModel.js`)

**Hypothesis.** P1–P4 can be written as a small dynamical system that shows a threshold, a
take-off, hysteresis and an inverted-U in effort.

**What happened.** The first version had a plain logistic pleasure term and did *not* ignite: with
gain above 1 it settled at a middling level and stayed there. A logistic term has one stable
level, so it gives a continuum, not a click. Getting a real threshold needed the pleasure to
improve its own conditions: capture attention, melt tension, quiet hindrances, plus attention
counting more than proportionally (only continuous attention amplifies).

**Changed my mind about.** "Attention on pleasure amplifies it" is not enough to explain a sudden
onset. The take-off needs the second-order effects. That moved "pleasure relaxes the body" from a
side note to a load-bearing part of the theory.

**Check.** Varying each of 26 constants by ±25%: balanced habits always ignite, drifting never
does, striving is always slower. Whether striving fails *outright* depends on constants (46 of
52 perturbations). I had claimed striving simply fails; the honest claim is "slower, and often
fatal".

## #3 — Breath sensing from an accelerometer (`src/breath.js`)

Autocorrelation picked half the true rate for faster breathing (16/min read as 8). A periodic
signal peaks at every multiple of its period. Fixed by taking the shortest lag whose peak is
within 10% of the highest. Smoothed sensor noise also looked weakly periodic, so a minimum
amplitude was added. Verified on synthetic signals only.

## #4 — Built the coach and the app before the research finished

Deliberate: the user asked whether this would be useful, and the answer depended on having
something to open. Wrote the blocker knowledge base from background knowledge, to be corrected
by the reading. First end-to-end browser run found two real bugs (arrays passed to the DOM as
text; a short sit with a ticked symptom diagnosed as "not enough time"). The second was a logic
error: "not enough time" is the explanation of last resort and must not outrank a reported
difficulty.

## #5 — First published prototype

`dist/ember.html` works in a headless browser at 390 px, both themes, two full journeys.
Published as a private artifact. Not checked on a physical phone.

## #6 — Research plan changed: agents lost, did it directly

Four parallel research agents (traditions, blog reports, forum reports, neuroscience) were
cancelled by a session interruption about eleven minutes in, before writing anything, and could
not be resumed. I redid the research myself with a narrower scope.

**Cost.** The first-person evidence base is 20 coded accounts, not the 50–70 planned. The forum
sweep (Dharma Overground, more of LessWrong, reddit) did not happen; reddit is unreachable from
this environment in any case. A planned head-to-head of LLM versus rule-based diagnosis against
held-out teacher answers was dropped because it needed a second, blind labeller.

**Benefit.** Reading the sources directly, I found the Europe PMC API returns abstracts and, for
the dataset preprint, full text, which located the data in one step.

## #7 — What the reading confirmed and what it changed

| Prior | Verdict | Evidence |
|---|---|---|
| P1 ignition, sudden onset | **Supported** | "Takes off"; "explodes"; Sparby & Sacchet define intermediate jhana by "a phenomenological shift where attention locks onto the object" |
| P2 breakers bind, not attention | **Supported, modestly** | Grasping is the most frequent blocker in the sample (5 of 20) and the one teachers name. A year-long practitioner failed where novices succeeded. Small n |
| P3 loop gain, plateau near threshold | **Weak support** | "Grows a little, pauses, grows more" |
| P4 effort inverted-U, falling | **Supported in part** | Burbea: effort as a dimmer; undershoot → sleep, overshoot → headache. The "falling optimum" is still my inference |
| P5 differences are seed and breakers | **Partly** | No data at all on traits. One new factor I had missed (below) |
| P6 diagnosis over guidance | **Supported, and not new** | Jhourney's facilitators read journals daily and personalise; they also now run an AI facilitator. The framing is right; it is not original |
| P7 goal pressure is a breaker | **Supported** | Expectations "the absolute worst" (Brasington); craving and comparison (HN) |
| P8 EEG not worth it yet | **Confirmed with real data** | #9 |

**New, not in my priors.**
1. **Self-criticism is its own blocker.** Chapin: access "came from getting over my
   self-hatred", not from concentration. Guilt about joy in Burbea's Q&A. I had folded this into
   "doubt". Added an inner-critic pattern, and "permission" as a candidate seventh condition.
2. **The breath going faint frightens people**, and the instinct to take a deep breath undoes
   the settling (Brasington; Wystan). Added as a symptom and as a line in the guidance.
3. **A published interview study already describes the loop**: attention, arousal and release
   feeding one another (Brahinsky et al. 2024). My model is a formalisation of something
   practitioners say, not a novel mechanism.
4. **"Flow, not relaxation"** (Asparouhova). Sharpens the brightness condition.
5. **Real harm numbers exist**: about 3% transient difficulty, one mania case in ~1,200
   (Jhourney's own report). Put into the app's safety text.
6. **Smiling works for about a quarter of Brasington's students.** My default seed was the smile;
   changed to warmth for someone, and the bandit now starts from onboarding answers.

**Weakened.** The claim that jhana is extraordinarily pleasurable. In the same comment thread as
"10–100× better than sex" are "kinda nice", "flat and artificial" after two months, and "no
change in other desires". The app now describes early jhana as often gentle.

## #8 — Coach updated from the reading

Added: inner-critic blocker; `breathfaint` and `critic` symptoms; Burbea's "can I enjoy it more?"
and two modes of attending in the plateau fix; the dimmer exercise in the striving fix; "comfortable
but upright" in the pain fix; safety numbers. Built `kb/teacher-cases.json`: 19 real problem →
diagnosis pairs. The engine agrees on all 18 it has categories for. One gap found: no category
for aversion to a specific distraction (ringing in the ears, in Burbea's Q&A). Left open.

Caveat recorded in the test file: I coded the symptoms for those cases myself, knowing the
engine. It is a guard against contradicting sources, not a validation.

## #9 — EEG: real data, and it changed the story

Got the open dataset (Fabus et al. 2026): 28 sessions, one per subject, 5.3 GB. Two sessions
yielded no usable epochs, leaving 26 subjects and 4,279 clean 8-second epochs. Full numbers in `eeg/results/REPORT.md`.

**Expected.** The published signatures would replicate in experts but be too subtle for a
headband.

**Found.**
- They replicate across subjects, modestly: broadband power lower (dz −0.48, p 0.025), slope
  flatter (dz 0.58, p 0.008), LZ higher (dz 0.39, p 0.06 by t-test, 0.04 by Wilcoxon), n = 25.
- LZ in jhana versus access concentration: dz 0.84, 10 of 11 subjects. This is the cleanest
  replication of Mago et al.'s contrast.
- Strongest in J1, weak in J4. The reverse of "deeper is more".
- **Negative control:** post-sit versus pre-sit baseline shows a slope change of the same size
  (dz 0.54). Slope flattening is not specific to jhana. Broadband and alpha power move the
  *opposite* way in the control, so those two are not explained by drift.
- **Smile muscle:** zygomaticus EMG is higher in jhana (p 0.02), separates J1 from baseline as
  well as EEG does (AUC 0.74), and across people the EMG effect predicts the size of the slope
  effect (r 0.77) and the LZ effect (r 0.63), not the alpha effect (r 0.03).
- **Decoding across people:** jhana vs baseline 0.72–0.74; two baselines vs each other
  0.67–0.69; jhana vs access concentration 0.37–0.47.
- Four channels do as well as sixty-four.

**Changed my mind about.** I expected "real but too weak". What I found is "real, weak, and
entangled with the face". The complexity and slope signatures, which are the ones most often
quoted, are the ones that track smiling. The plainer ones (less alpha, less broadband power)
look more neural. I cannot tell from this whether smiling contaminates the signal or simply
accompanies deeper states; either way a forehead sensor cannot separate them.

**Decision.** EEG feedback dropped. Recorded in `docs/exploration.md`.

**Limits.** One session per subject; experts only; self-marked states in a fixed order; two
traditions pooled; no multiple-comparison correction beyond planning three tests.

## #10 — Simulation: the coach against its own theory

600 simulated meditators, 14 sits, same people in every arm. **Simulated; not evidence.**

**First run surprised me twice.**
1. "Try harder" reached 81%, far above the fixed script's 45%. My arm had bundled "more effort"
   with "five more minutes each time". Split in two: **sit longer 80%, push harder 45%.** Inside
   the model, dose is a very strong lever, and pushing harder is merely useless overall (it
   wrecks strivers, 74% → 21%, and rescues the sleepy, 1% → 41%).
   *Consequence for real studies:* a control arm must be matched on sit length or dose will be
   credited to coaching. Written into `docs/validation.md`.
2. The diagnosis recovered a planted "grabber" 11% of the time. In the model a grabber's wanting
   mostly keeps the feeling from growing at all, and seldom produces a visible rise-and-collapse,
   so the coach saw a plateau. I had assumed grasping always announces itself as collapse.

**Changes made.** "Pressure to make something happen" now counts as a signature of wanting
results. When the runner-up diagnosis has real evidence and scores within 60% of the winner, its
plan changes are applied too. Grabber recovery rose to 27%. I stopped there: tuning the engine
until it recovers every planted type would be fitting the coach to my own simulator.

**Final (simulated):** fixed script 45%, sit longer 80%, push harder 45%, seed search only 57%,
diagnosis only 89%, full coach 95%. The full coach beats each ablation and is the only strategy
that helps every type.

**Not calibrated.** The absolute rates are far higher than any real-world figure for an hour a
day. Only the ordering and the by-type pattern mean anything, and only as statements about the
theory.

## #11 — Power

Simulated the proposed trial with dropout and rater error. 15% vs 35% needs about 200 per arm,
not the ~75 a textbook two-proportion formula gives, because dropouts counted as failures and an
imperfect rater shrink the observed gap. Rater false positives hurt most. The pilot's job is to
measure the control rate, dropout and rater agreement.

## Theory status at the end

- **Stands:** ignition of a loop; interference as the usual binding constraint; "do nothing" at
  the onset; jhana as a conjunction that relaxation and dullness each fail differently.
- **Revised:** take-off needs pleasure to improve its own conditions (#2); striving is slower,
  not always fatal (#2); self-criticism and permission added (#7); grasping can look like a
  plateau (#10); the pleasure is less extreme and more variable than the loudest accounts (#7).
- **Unknown:** everything about real beginners using this app.

## #12 — A test caught a design flaw: the resting phase was too short

Writing tests for the sit runner showed that a novice's first plan was 20 minutes with 13 of them
spent on settling, anchoring and sparking, leaving under six minutes to rest on the feeling. The
theory says the loop needs minutes above threshold (condition C6), so the plan contradicted the
theory it was built from. Novices now get 25 minutes with about eleven to rest, and the planner
never leaves the resting phase under roughly eight minutes.

Re-running the simulation with this one change (**simulated**): fixed script 45% → 64%, sit
longer 83%, push harder 64%, seed search only 75%, diagnosis only 90%, full coach 96%. Diagnosis
recovery: striver 76%, grabber 34%, sleepy 66%, scattered 83%, guarded 65%. The ordering is
unchanged. The size of the jump from one small scheduling change is another sign of how much the
model, at least, cares about dose.
