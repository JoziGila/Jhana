# 6. Telling jhana from strong relaxation and from expectation

## 6.1 The operational definition used in this project

**First jhana (intermediate type)** = a state entered through a distinct shift, in which all five
of the following hold at once:

| Criterion | Question it answers | Maps to Sparby & Sacchet's general definition [S13] |
|---|---|---|
| **Strong pleasant feeling** in the body, or strong joy | Is the positive valence there? | "positively valenced" |
| **Self-sustaining**: it runs without being held in place | Is the loop closed? | "effortless focus" in their factor trajectories |
| **Absorbed**: thought sparse, sounds and sensations not pulling | Is attention locked? | "stable concentration, focus, and absorption"; "little or no thought" |
| **Bright**: awake and clear | Is it wakeful? | "clear awareness … as opposed to trance or sleep" |
| **Lasted** about a minute or more | Was it a state or a spike? | (this project's addition) |

Supporting evidence, not required: a noticed moment of onset; involuntary smile, tears or
energy; an afterglow; being able to find it again on later days.

The definition is a **conjunction**. Each alternative explanation predicts a specific missing
criterion, which is what makes it discriminating.

## 6.2 The alternatives and what each lacks

| Alternative | What it feels like | Which criteria fail | Other tells |
|---|---|---|---|
| **Pleasant relaxation** | Calm, heavy, comfortable | Strong pleasure; self-sustaining (nothing is running); often bright | No onset; thinking carries on; fades when you stop relaxing |
| **Pleasant dullness** | Dreamy, warm, lost time | Bright | Nodding, imagery, not sure what happened |
| **Access concentration** | Steady, quiet, mildly pleasant | Strong pleasure; self-sustaining | The right place to start from |
| **Pīti without jhana** | Tingles, waves, rushes | Self-sustaining or absorbed | Needs effort to keep; collapses with excitement; thinking about it |
| **Held-in-place pleasure** | Strong, effortful | Self-sustaining | Strain in the head and face |
| **Insight-style dissolving** | Body boundaries melting, "liquid" [FP7] | Pleasure | Arises from scanning, not from enjoying |
| **Hyperventilation effects** | Tingling, light-headed | Absorbed; lasted | Follows forceful breathing; cold hands, dizziness |
| **Expectation or wishful report** | Whatever was described | None on paper | See 6.3 |

## 6.3 Expectation

People told what jhana feels like can report it without having it. The sceptics are right that
self-report carries social reward and that instructions prime experience [FP3, FP7]. Four
defences, in rising order of strength:

1. **Free description before any checklist.** The app asks "what happened, in your own words?"
   first. A study rater reads only this.
2. **Foil items.** The checklist includes plausible-sounding phenomena that are not part of
   jhana (a taste in the mouth, sharpened hearing, cold hands and feet). Endorsing several lowers
   confidence in the whole report. The foils are this project's guess at low-base-rate items and
   have not been calibrated.
3. **Internal structure that is hard to fake without knowing the theory.** Real reports should
   show the *ordering* the loop predicts: a rise, a take-off, then less effort, then calmer
   states if it continues. Reports that have every item at maximum, including ones that
   contradict each other (held in place by effort *and* running by itself), are flagged.
4. **Things the person was not told.** In a study, do not tell participants about the afterglow,
   breathing changes, or the tendency for excitement to settle into contentment, then ask
   open questions about them.

## 6.4 Objective and semi-objective corroboration

Ranked by how practical each is today.

| Signal | Evidence | Practical? |
|---|---|---|
| **In-sit taps.** One tap when the feeling is clearly present; time of first tap; time stayed after it | None; a behavioural trace recorded before the debrief can colour memory | Yes: built into the app |
| **Breathing rate and stillness** from a phone on the belly | Slower respiration in jhana vs breath mindfulness, n=10 [S6] | Yes: built, tested on synthetic signals only |
| **Repeatability.** Enters again on later days, faster | Experts enter at will [FP3, S14] | Yes: the log |
| **Blind rating of free descriptions** by an experienced practitioner | Standard in the field for state verification | Yes, in a study |
| **Heart-rate variability** | Characteristic low-frequency patterns in advanced meditators [S15] | Needs a chest strap or watch |
| **EEG** | See below | No, for this purpose |

**Why not EEG.** This project ran the published signatures against the open dataset of 26
experts (`eeg/results/REPORT.md`). Summary of what was found:

- The signatures do appear across subjects, modestly: broadband power lower (dz −0.48), aperiodic
  slope flatter (dz 0.58), Lempel-Ziv complexity higher (dz 0.39) in jhana than in eyes-closed
  baseline tasks.
- They are strongest in first jhana and weakest in fourth, which is the reverse of "deeper is
  more", and first jhana is where people smile.
- Smile-muscle activity is higher in jhana, separates first jhana from baseline about as well as
  the EEG classifier does, and across people the size of the slope and complexity effects tracks
  the size of the smile-muscle effect (Spearman r = 0.77 and 0.63).
- A classifier trained on other people separates jhana from baseline with AUC about 0.72, barely
  better than it separates the *two baselines from each other* (0.69), and it cannot separate
  jhana from access concentration at all (0.37–0.47).

So in the best available data, on experts, a cross-person EEG readout mostly reflects facial
muscle and session drift. It cannot make the one distinction a learner needs.

## 6.5 How the app applies this

`src/jhanaScore.js` implements 6.1–6.3: the five-way conjunction, counter-evidence items
(drowsy, drifting, straining), three foils, and a response-bias flag. A sit counts as jhana only
when all five criteria are met and no bias flag is raised. Lesser outcomes get their own honest
labels: pleasant relaxation, pleasant dullness, access, pleasure without absorption, brief
take-off.

Known weaknesses: the weights are theory-derived and unvalidated; a motivated person can learn
which answers produce the label; there is no ground truth. `docs/validation.md` describes how to
measure the instrument against blind expert rating.
