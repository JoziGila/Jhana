# 3. What the research shows

Source keys refer to [bibliography.md](bibliography.md). Unless marked otherwise, studies were
read at abstract level via Europe PMC. Two were read in full: the dataset paper [S14] and the
definitional review [S13]. This project's own analysis of the open dataset is in
[`eeg/results/REPORT.md`](../../eeg/results/REPORT.md) and summarised in section 3.5.

## 3.1 The shape of the evidence

Until 2025 nearly everything was **single-subject**: one adept, scanned many times.

| Study | n | Method | Main finding | Check |
|---|---|---|---|---|
| Hagerty et al. 2013 [S1] | 1 (Leigh Brasington) | fMRI + EEG | Changes in 11 regions on entering jhana, including nucleus accumbens activation; framed as self-stimulation of the reward system without external input | F |
| Dennison 2019 [S2] | case series, Samatha Trust practitioners (n not in abstract) | EEG | Spindles, very slow high-voltage waves, occasional spike-wave bursts, in meditators who report being fully alert. Deep, nimitta-based jhana. Criticised in a published commentary | F |
| Yang et al. 2024 [S3] | 1 (27 sessions) | 7T fMRI + ratings | Distinct cortical, subcortical, brainstem and cerebellar patterns per jhana, correlated with rated attention and jhana quality | F |
| Chowdhury et al. 2025 [S4] | 1 (>23,000 h) | fMRI + EEG + ratings | **Widespread decrease in broadband EEG power and increase in Lempel-Ziv complexity** versus control tasks; lower modularity and higher global connectivity in fMRI. EEG effects robust to choice of control task; some fMRI effects were not | F |
| Potash et al. 2025 [S5] | 1 (>20,000 h, 29 sessions) | EEG connectivity + ratings | **Jhanas are better separated by non-oscillatory, nonlinear connectivity (weighted symbolic mutual information) than by oscillatory synchrony (wPLI)**; adding attention ratings improves decoding; deeper jhanas show more balanced feedforward and feedback flow | F |
| Demir [S9], Treves [S10], Potash [S11] 2025 | same 1 | fMRI gradients, dynamic states, eigenmodes | Flattened cortical hierarchy; a DMN-anticorrelated state that grows with depth; a thalamocortical "hyperconnected" state that fades as body sensation fades | F |

Group-level work has started to appear:

| Study | n | Method | Main finding | Check |
|---|---|---|---|---|
| Mago et al. 2025 [S6] (preprint) | 10 experienced practitioners on a 10-day retreat | EEG + physiology; jhana vs mindfulness of breathing | Jhana: more sensory fading, **slower respiration, higher signal diversity on several measures including LZ, reduced chaoticity**, larger mismatch negativity, **flatter aperiodic 1/f slope**, reorganised long-range temporal correlations. Read as a shift toward criticality | F |
| Vohryzek et al. 2025 [S7] (preprint) | advanced practitioners (n not in abstract) | 7T fMRI + whole-brain modelling | Later jhanas move network dynamics toward near-critical working points, most strongly in the default mode network | F |
| Yang et al. 2025 [S8] (preprint) | "first group-level" (n not in abstract) | 7T fMRI + phenomenology | Reproducible trajectories across the eight states: anterior-to-posterior reorganisation, flattened hierarchy | F |
| Fabus et al. 2026 [S14] (preprint) | 26 experts, 71 sessions, 100+ h | 64-channel EEG, ECG, EOG, EMG, respiration, skin conductance; self-marked J1–J4 | **A dataset, not a result.** Only analysis: alpha topographies by stage, "not formally tested" | F (full) |

A scoping review of focused-attention meditation in general (not jhana) finds increased alpha,
beta and gamma power, higher complexity and *reduced* criticality measures [S17], which is not the
same picture. Jhana may differ from ordinary concentration in exactly the direction the theory
needs (see 3.4), or the measures may not be comparable across studies.

## 3.2 Where each claimed signature comes from

| Claimed signature (from the project brief) | Source | n | Strength | Usable for consumer feedback? |
|---|---|---|---|---|
| Lower broadband power | S4 | 1 | Weak (one adept). This project's check on 28 experts: see 3.5 | Power is easy to measure, but confounded by muscle and movement |
| Higher Lempel-Ziv complexity | S4 (n=1); S6 (n=10, vs breath mindfulness) | 11 | Moderate and converging; preprint-level | Computable on any channel. Confounded by muscle activity and by spectral slope |
| Less chaotic dynamics | S6 | 10 | One preprint | Needs clean, long, multichannel data. No |
| Nearer criticality | S6 (EEG), S7 (fMRI model) | ~10 + ? | Suggestive, preprint-level; "criticality" is inferred from several indirect measures | No |
| Nonlinear measures separate states better than oscillatory ones | S5 | 1 | Weak (one adept); within-subject decoding only | Not across people |
| Flatter 1/f slope | S6 | 10 | One preprint | Computable; same confounds as LZ |
| Reward-system activation | S1 | 1 | Anecdotal but influential | No (fMRI) |
| Slower breathing | S6; autonomic review S15 | 10 + review | Moderate. Breathing rate is the most accessible physiological correlate | **Yes**: a phone accelerometer or a chest belt |

## 3.3 Mechanistic accounts

- **Self-stimulated reward** [S1]. Attention on pleasure recruits the dopamine/opioid reward
  system directly. Fits the phenomenology of J1 and the comparisons to MDMA in first-person
  reports. Rests on one subject.
- **A spiral of attention, arousal and release** [S16]. From phenomenological interviews with
  jhana practitioners and, strikingly, people who speak in tongues: both describe "focused
  attention, aroused joy, and a sense of letting go or release" feeding one another. This is the
  closest published statement of the loop model in [04-mechanism.md](04-mechanism.md), and it
  comes from interviews, not from theory.
- **Predictive processing and active inference.** Meditation as progressive reduction of
  abstract, temporally deep predictions [S22, M]; jhana and "defabrication" as repeated release
  of mental tension, modelled as lowering precision level by level [S18]. Chowdhury et al. read
  their data as "deconstruction of the brain's cortical hierarchy" [S4]. These accounts explain
  the *later* jhanas (fading content, equanimity) better than they explain ignition.
- **Regularity is pleasant** [FP4]. An informal proposal that locking attention on one stimulus
  is itself rewarding. Untested.
- **Memory reconsolidation** as the route to lasting benefit [J6]: strong safety or compassion
  while an old emotional pattern is active. The author says he has no controlled data.

None of these is established. They are compatible with one another: reward explains the
amplification, release explains what gates it, and hierarchical deconstruction explains the
sequence after ignition.

## 3.4 Who succeeds: what data exists

Very little.

- No study relates trait absorption [S24, M], hypnotisability, interoception or personality to
  jhana attainment. Nothing was found in the Europe PMC results.
- Jhourney reports that prior experience does not predict benefit [J5] and names "mindset and
  ownership" as the best predictor of success [J2]. No numbers or definitions are given.
- In the open dataset, lifetime hours among people who *can* enter jhana range from 300 to
  67,000 [S14], so the floor for the skill is low.
- A survey of 863 meditators who use psychedelics found that most thought psychedelics helped
  their practice [S25]. This is perception, not jhana attainment.

## 3.5 This project's analysis of the open dataset

Described in full, with numbers, in [`eeg/results/REPORT.md`](../../eeg/results/REPORT.md), which
is generated by `python3 eeg/stats.py` from features extracted by `eeg/extract.py`. One session
per subject was analysed (28 sessions). The questions asked:

1. Do the published signatures (lower broadband power, higher LZ, flatter slope) replicate
   across subjects, comparing self-marked jhana with eyes-closed baseline tasks and with access
   concentration?
2. Does a four-channel, consumer-like montage carry the same information?
3. Can jhana be told from baseline **across people**, which is what a feedback product for
   beginners would need?
4. How much of any effect could be facial muscle activity, given that smiling is typical of
   first jhana?

The headline results are quoted in `docs/log.md` and `docs/exploration.md`; the report is the
source of truth.

## 3.6 Adverse effects

- Meditation-related difficulties are well documented in general [S23, M].
- Jhana-specific numbers come only from Jhourney's own safety report [J3]: about 3% transient
  difficulty; one case of acute mania in ~1,200, in someone with no psychiatric history.
  Self-reported by the provider; no independent audit.
- Sleep disruption after strong sits is reported first-hand [FP7].

## 3.7 Feedback technology

- The dataset authors say individualised physiological feedback "may aid training" and cite
  mindfulness neurofeedback as showing promise [S14]. Jhourney's founders have said publicly
  that AI plus EEG will deliver bliss on demand [FP11, S; FP6]. No evidence of a working
  jhana neurofeedback system was found.
- A critic with long teaching experience doubts headband-style neurofeedback will shorten the
  process soon [FP9].
- Jhourney's product today is curriculum, human facilitators who read journals daily, and an "AI
  facilitator" that gives interactive voice-guided meditations [J1]. That is coaching, not
  sensing.

## 3.8 What the literature does not establish

1. **Any marker of the transition into first jhana in beginners.** Every recording is of experts
   who enter at will.
2. **Any cross-subject classifier.** The decoding results are within one person [S5].
3. **That the signatures are specific to jhana** and not to deep relaxation with eyes closed,
   to smiling, or to time on task. Only S6 uses an active meditation control.
4. **Causality.** Nothing shows that pushing a brain toward the signature produces the state.
5. **Who can learn it and how fast**, beyond provider statistics with no definition of success.
6. **Whether "light" and "deep" jhana share a mechanism.** Dennison's spindles and slow waves
   [S2] and the Sacchet group's desynchronised, high-complexity picture [S4] may be different
   states under one name.
