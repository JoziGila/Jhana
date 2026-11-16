// The diagnostic engine: from a post-sit report to the single most likely failing link in the
// loop, and a concrete change for the next sit.
//
// Theory link (docs/understanding/04-mechanism.md): the loop fails at different links for
// different people, and the fixes for different links are opposites (more effort for a scattered
// mind, less for a striving one). A fixed script therefore cannot be right for everyone.
//
// The engine is deliberately simple and inspectable: additive evidence from reported symptoms
// (weights in kb/blockers.json), plus a prior from the ladder rung where the sit stalled, plus a
// little memory so that a fix that has been tried twice without progress gives way to the next
// candidate.

import { BLOCKERS, blockerById } from './kb.js';

const RUNG_WEIGHT = 1.0;
const MIN_EVIDENCE = 2.5; // below this, fall back to "dose" (nothing specific went wrong)

/**
 * @param {object} report
 *   rung      {number}   furthest ladder rung reached (src/ladder.js)
 *   symptoms  {string[]} ids from kb/symptoms.json
 *   minutes   {number}   length of the sit
 *   jhana     {boolean}  whether src/jhanaScore.js classed the sit as jhana
 * @param {object[]} history  previous sits, oldest first: {rung, diagnosis: {primary}}
 * @returns {{primary:string, secondary:string|null, scores:Record<string,number>, confidence:number,
 *            evidence:string[], blocker:object, repeated:number}}
 */
export function diagnose(report, history = []) {
  const symptoms = new Set(report.symptoms ?? []);
  const rung = report.rung ?? 0;
  const scores = {};
  const evidenceBy = {};

  for (const b of BLOCKERS) {
    let s = 0;
    const ev = [];
    for (const [sym, w] of Object.entries(b.symptoms ?? {})) {
      if (symptoms.has(sym)) {
        s += w;
        ev.push(sym);
      }
    }
    const prior = b.rungPrior?.[String(rung)] ?? 0;
    // The rung prior only counts as supporting evidence: it cannot nominate a blocker whose
    // symptoms are all absent, except for the symptom-free "stage" entries below.
    if (ev.length > 0 || Object.keys(b.symptoms ?? {}).length === 0) s += RUNG_WEIGHT * prior;
    scores[b.id] = s;
    evidenceBy[b.id] = ev;
  }

  // Stage entries: when things are going well, the "diagnosis" is the next step, not a fault.
  const noComplaints = symptoms.size === 0;
  if (rung >= 7) scores.deepen += 2;
  if (rung >= 5 && rung <= 6) scores.stabilise += noComplaints ? 3 : 1;
  if (rung < 5) {
    scores.stabilise = 0;
    scores.deepen = 0;
  }
  // Short sits: the dose explanation gets stronger the shorter the sit was.
  const minutes = report.minutes ?? 30;
  if (rung <= 3 && minutes < 20) scores.dose += 2;
  if (rung <= 3 && minutes < 12) scores.dose += 1.5;
  if (rung <= 3 && noComplaints) scores.dose += 1.5;
  // "Not enough time" is the explanation of last resort: a clearly reported difficulty outranks it.
  const specific = Math.max(0, ...BLOCKERS.filter((b) => evidenceBy[b.id].length).map((b) => scores[b.id]));
  if (specific >= 3) scores.dose = Math.min(scores.dose, specific - 0.5);

  // Memory: a blocker diagnosed in each of the last two sits with no climb on the ladder has had
  // its fix tried. Discount it so the runner-up gets a turn.
  const last2 = history.slice(-2);
  let repeated = 0;
  if (last2.length === 2 && last2[0].diagnosis?.primary === last2[1].diagnosis?.primary) {
    const stuckOn = last2[1].diagnosis.primary;
    const noProgress = rung <= Math.max(last2[0].rung ?? 0, last2[1].rung ?? 0);
    if (noProgress && scores[stuckOn] !== undefined) {
      scores[stuckOn] *= 0.55;
      repeated = 2;
    }
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  let [primary, top] = ranked[0];
  let secondary = ranked[1] && ranked[1][1] > 0 ? ranked[1][0] : null;
  if (top < MIN_EVIDENCE) {
    secondary = top > 0 ? primary : null;
    primary = rung >= 7 ? 'deepen' : rung >= 5 ? 'stabilise' : 'dose';
    top = scores[primary];
  }
  const runnerUp = ranked.find(([id]) => id !== primary)?.[1] ?? 0;
  const confidence = top <= 0 ? 0.3 : Math.max(0.2, Math.min(1, (top - runnerUp) / top + 0.25));

  // Two problems at once are common (a feeling that will not grow AND pressure to make it grow).
  // When the runner-up has real symptom evidence and scores close to the winner, its plan
  // changes are applied too; the headline instruction stays the winner's.
  const sec = secondary === primary ? null : secondary;
  const alsoApply = sec && evidenceBy[sec]?.length > 0 && scores[sec] >= 0.6 * top && !['dose', 'stabilise', 'deepen'].includes(sec) ? sec : null;

  return {
    primary,
    alsoApply,
    alsoBlocker: alsoApply ? blockerById(alsoApply) : null,
    secondary: secondary === primary ? null : secondary,
    scores,
    confidence,
    evidence: evidenceBy[primary] ?? [],
    blocker: blockerById(primary),
    repeated,
  };
}

/** Which symptom ids matter for which loop term; used by docs and the app's explainer. */
export function blockersByLoopTerm() {
  const out = {};
  for (const b of BLOCKERS) (out[b.loopTerm] ??= []).push(b.id);
  return out;
}
