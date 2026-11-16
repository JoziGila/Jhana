# Jhana: a working theory and a trainer built on it

This repository does two things:

1. **Builds a model of what jhana is and how it arises**, from teachers' instructions,
   first-person reports and the research literature (`docs/understanding/`).
2. **Uses that model to build Ember**, a phone-friendly web app that coaches a beginner toward
   first jhana by diagnosing where each sit got stuck and changing the next one (`dist/ember.html`).

**Status: nothing here has been tested on people.** The coach is a reasoned bet with tested
software behind it. What is real, what is simulated and what is unknown is spelled out below.

## The theory in brief

- **First jhana is an ignition.** Attention resting on a pleasant bodily feeling makes the
  feeling stronger; a stronger feeling holds attention, relaxes the body and quiets the mind.
  Below a threshold the feeling fades. Above it the loop feeds itself and takes off.
- **Interference is what usually stops it**: straining, grabbing at the feeling when it starts,
  checking whether it is working, bracing against it. Every fast-working lineage gives the same
  instruction at the critical moment: do nothing.
- **Six conditions**: a pleasant feeling to start from, continuous attention, bodily ease, no
  grabbing at the onset, a bright mind, and enough time.
- **People stall on different conditions, and the fixes are opposites.** A wandering mind needs
  more effort; a straining one needs less. That is why hours of prior practice barely predict
  success, and why retreats with a coach who reads your reports work.
- **Jhana is recognisable as a conjunction**: strong pleasure, running by itself, absorbed,
  bright, lasting. Relaxation, drowsiness and effortful pleasure each miss a specific one.

Full version, with sources and confidence levels: [`docs/understanding/`](docs/understanding/README.md).

## What exists

| | What | Where |
|---|---|---|
| **Theory** | Traditions map, 20 coded first-person accounts, research review, causal model, conditions, discrimination, open questions, glossary, bibliography with a verification tag on every source | `docs/understanding/` |
| **Knowledge base** | 18 diagnosable patterns with fixes and sources, 24 symptoms, 8 seeds, coded reports, 19 teacher cases | `kb/*.json` |
| **Ember app** | Guided sit that goes quiet → one-minute debrief → diagnosis → changed plan; 8-rung ladder; seed search; interactive loop model; optional breath sensing; optional Claude interview | `app/`, built to `dist/ember.html` |
| **Core logic** | Loop model, diagnosis, planner, guidance script, sit runner, jhana scoring, bandit, breath DSP | `src/` |
| **EEG analysis** | Published jhana signatures tested on the open dataset of expert meditators; cross-person decoding; smile-muscle confound | `eeg/`, report in `eeg/results/REPORT.md` |
| **Simulation** | Coaching strategies compared on simulated meditators | `sim/`, report in `sim/results/POLICIES.md` |
| **Validation plan** | Definition of success, controls for relaxation and expectation, trial design, power simulation | `docs/validation.md`, `study/` |
| **Exploration** | 20 candidate approaches scored; what was built, kept, reduced or dropped and why | `docs/exploration.md` |
| **Lab notebook** | Priors written before the research, then what each step found and changed | `docs/log.md` |

## Run it

```bash
make all        # install, test, build the app, browser test, simulation, EEG stats, power
```

Then open **`dist/ember.html`** in any browser, or send the file to your phone. It is one
self-contained file and stores data only on the device.

Individual steps: `make test`, `make build`, `make e2e`, `make sim`, `make eeg`, `make power`.
`make data` re-downloads about 5 GB of raw EEG and re-extracts features (optional; the derived
features are committed).

Requirements: Node 20+, Python 3.10+ with numpy and scipy. The browser test needs Playwright and
skips itself if it is missing.

### Using the app

1. Answer nine onboarding questions. They pick your first spark and anticipate your likely
   sticking point.
2. Sit. The voice settles you, steadies attention, helps you spark a pleasant feeling, then goes
   quiet. **Tap once** when the feeling is clearly there (the guide stops talking). **Tap twice**
   if you are stuck (one pointer).
3. Debrief: your own words first, then the furthest rung reached and what got in the way.
4. Read the diagnosis and the change for next time.

Breath sensing (phone resting on the belly) works only in the standalone file served over HTTPS
or opened locally on a phone that grants motion access. The Claude interview and Claude voice
appear only when the app is opened as a published Claude artifact.

## Real, simulated, unknown

| Claim or component | Status |
|---|---|
| Teachers' instructions, first-person accounts, paper abstracts | **Real**, read this session; each source tagged fetched / snippet / memory in the bibliography. Several lineages are described from memory and marked so |
| EEG results | **Real data**: open recordings of expert meditators (Fabus et al. 2026), one session each, 26 subjects with usable data |
| Coach logic, app behaviour | **Tested software**: 52 unit tests, 9 EEG-code tests, a headless-browser run of two full journeys |
| Diagnoses agree with source teachers | **Weak check**: 18 of 18 covered cases, coded by the same author who wrote the engine |
| Coaching strategies compared | **Simulated** people from the project's own model. Shows internal consistency only |
| Breath-rate detection | **Simulated** signals only; never run on a device |
| Power analysis | **Assumed** effect sizes |
| Voice and sound on real phones; the Claude interview | **Not checked** |
| That the app helps anyone reach jhana | **Unknown** |

Where real data replaces simulated data: see the table at the end of `docs/validation.md`.

## Main findings

- **The framing that fits the evidence is diagnosis, not guidance.** It is also what the
  fastest-teaching provider already does with human facilitators, so it is not new; this is an
  open, inspectable version with a stated theory behind each prescription.
- **EEG feedback for beginners is not supported by the best open data.** Across 25 experts the
  published signatures appear, modestly (effect sizes 0.4–0.6). But a classifier trained on other
  people cannot separate jhana from ordinary concentration (AUC 0.37–0.47), separates jhana from
  rest barely better than it separates two rest periods (0.72 vs 0.69), and the complexity and
  spectral-slope effects track smile-muscle activity across people (r = 0.63 and 0.77).
- **Dose must be controlled in any study.** In simulation, simply sitting longer was the
  strongest non-coach strategy.
- **A definitive trial is large**: about 200 per arm under plausible assumptions. A 60-person
  pilot should come first, to measure the control rate, dropout and rater agreement.

## What I would try next

1. **Put it in front of ten people for two weeks** and read every debrief. Nothing else matters
   as much.
2. **The within-person crossover** in `docs/validation.md` §3: does halving effort help strivers
   and hurt the scattered? It tests the central claim in three sits per person.
3. **A home-retreat-day mode.** Dose is the largest gap between an app and a retreat.
4. **A kindness-first track** for people the coach reads as guarded or self-critical.
5. **A blind comparison of LLM and rule-based diagnosis** against held-out teacher answers.
6. **Re-run the EEG smile-confound check** with muscle activity regressed out and with all
   sessions, and send the result to the dataset's authors.

## Safety

This practice is usually gentle. Strong states can be destabilising for some people. One
provider reports about 3% transient difficulty and one case of mania in roughly 1,200 retreat
participants. Anyone with a history of psychosis, mania or severe trauma should talk to a
clinician or an experienced teacher first. The app is not medical advice and not a substitute for
a teacher.

## Data and licence notes

EEG features in `eeg/results/features_real.csv` are derived from the CC-BY dataset of Fabus MS,
Zerfas S, Gruver A, Fini M, Gadaev T, Devaney KJ (2026), "Electroencephalogram recordings in
Jhana states: An open dataset", bioRxiv, doi:10.64898/2026.06.27.734949. Raw recordings are not
included.
