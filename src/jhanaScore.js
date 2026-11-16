// Scoring a post-sit report: was that jhana, strong relaxation, or expectation?
//
// Operational definition and its justification: docs/understanding/06-discrimination.md and
// docs/validation.md. In brief, first jhana is scored as the CONJUNCTION of
//   (1) strong pleasant feeling,  (2) self-sustaining (effort could be dropped),
//   (3) absorption (thought thin, distractions not pulling),  (4) a bright, awake mind,
//   (5) lasting at least about a minute,
// with a distinct onset and an afterglow as supporting evidence. Relaxation fails (1)/(2)/(4);
// piti-without-absorption fails (2)/(3); expectation is probed with low-base-rate foil items.
//
// This is a self-report instrument with theory-derived weights. It has NOT been validated
// against expert interview or physiology. Treat labels as hypotheses.

/** Items answered 0..3: 0 not at all, 1 slightly, 2 clearly, 3 strongly. */
export const ITEMS = Object.freeze([
  { id: 'shift', kind: 'core', text: 'There was a distinct moment when the state changed: a drop, a click, a take-off.' },
  { id: 'pleasure', kind: 'core', text: 'Strong pleasant feeling in the body (warmth, glow, tingling, waves) or strong joy.' },
  { id: 'pervade', kind: 'core', text: 'The pleasant feeling spread through most of my body or filled my awareness.' },
  { id: 'selfsustain', kind: 'core', text: 'It kept going by itself. I did not have to work to keep my attention there.' },
  { id: 'absorb', kind: 'core', text: 'Thoughts became sparse or far away, and sounds or sensations did not pull me out.' },
  { id: 'clear', kind: 'core', text: 'My mind felt bright and awake.' },
  { id: 'energy', kind: 'piti', text: 'Involuntary smile, tears, rushes of energy, shivers, or swaying.' },
  { id: 'calmer', kind: 'later', text: 'The excitement settled into a quieter, more contented happiness.' },
  { id: 'still', kind: 'later', text: 'Pleasure gave way to a deep, even stillness that was neither pleasant nor unpleasant.' },
  { id: 'afterglow', kind: 'support', text: 'Afterwards I felt notably calm, content or clear for a while.' },
  { id: 'drowsy', kind: 'counter', text: 'I felt sleepy or dreamy, or lost track of where I was.' },
  { id: 'drift', kind: 'counter', text: 'I was mostly carried along in thoughts or daydreams.' },
  { id: 'strain', kind: 'counter', text: 'I was holding the state in place with effort.' },
  // Foils: sound plausible, but are not part of the reported phenomenology of jhana. Endorsing
  // several suggests the answers are tracking expectation or agreeableness rather than experience.
  { id: 'foil_taste', kind: 'foil', text: 'A distinct sweet or metallic taste appeared in my mouth.' },
  { id: 'foil_hearing', kind: 'foil', text: 'My hearing became much sharper than normal, picking up tiny distant sounds.' },
  { id: 'foil_cold', kind: 'foil', text: 'My hands and feet turned noticeably cold.' },
]);

/** Duration options for "how long did the strongest stretch last?" */
export const DURATIONS = Object.freeze([
  { id: 'none', label: 'It did not happen', minutes: 0 },
  { id: 'seconds', label: 'A few seconds', minutes: 0.1 },
  { id: 'underMinute', label: 'Up to a minute', minutes: 0.6 },
  { id: 'minutes', label: '1 to 5 minutes', minutes: 3 },
  { id: 'long', label: 'More than 5 minutes', minutes: 8 },
]);

export const LABELS = Object.freeze({
  ordinary: 'Ordinary sit',
  relaxation: 'Pleasant relaxation',
  dull: 'Pleasant dullness',
  access: 'Settled and steady (access)',
  piti: 'Pleasure without absorption',
  glimpse: 'Brief take-off',
  j1: 'First jhana (probable)',
  j2: 'Second or third jhana (probable)',
  j4: 'Fourth jhana (probable)',
});

const get = (answers, id) => Math.max(0, Math.min(3, Number(answers?.[id] ?? 0)));

/**
 * @param {Record<string, number>} answers  item id -> 0..3
 * @param {string} durationId               one of DURATIONS ids
 * @returns {{label:string, labelText:string, score:number, confidence:'low'|'medium'|'high',
 *            criteria:Record<string,boolean>, flags:string[], reasons:string[]}}
 */
export function scoreReport(answers, durationId = 'none') {
  const a = (id) => get(answers, id);
  const minutes = DURATIONS.find((d) => d.id === durationId)?.minutes ?? 0;

  const criteria = {
    pleasure: a('pleasure') >= 2,
    selfSustaining: a('selfsustain') >= 2 && a('strain') <= 1,
    absorbed: a('absorb') >= 2 && a('drift') <= 1,
    bright: a('clear') >= 2 && a('drowsy') <= 1,
    lasted: minutes >= 1,
  };
  const met = Object.values(criteria).filter(Boolean).length;

  // Continuous score, 0..100: core conjunction is what matters, support items add a little.
  const core =
    (a('pleasure') + a('selfsustain') + a('absorb') + a('clear')) / 12; // 0..1
  const support = (a('shift') + a('pervade') + a('afterglow')) / 9; // 0..1
  const counter = (a('drowsy') + a('drift') + a('strain')) / 9; // 0..1
  const durFactor = minutes >= 3 ? 1 : minutes >= 1 ? 0.9 : minutes >= 0.5 ? 0.6 : minutes > 0 ? 0.4 : 0.15;
  const weakest = Math.min(a('pleasure'), a('selfsustain'), a('absorb'), a('clear')) / 3;
  let score = 100 * (0.45 * core + 0.3 * weakest + 0.25 * support) * durFactor * (1 - 0.5 * counter);
  score = Math.round(Math.max(0, Math.min(100, score)));

  const flags = [];
  const reasons = [];
  const foilSum = a('foil_taste') + a('foil_hearing') + a('foil_cold');
  if (foilSum >= 3) flags.push('response-bias');
  const allHigh = ITEMS.filter((i) => i.kind !== 'foil').every((i) => a(i.id) >= 2);
  if (allHigh) flags.push('uniform-answers');

  let label;
  const equanimous = a('still') >= 2 && a('pleasure') <= 1;
  if (equanimous && criteria.selfSustaining && criteria.absorbed && criteria.bright && criteria.lasted) {
    label = 'j4';
    reasons.push('Still, even, self-sustaining and bright, with pleasure faded.');
  } else if (met === 5) {
    if (a('calmer') >= 2 || a('still') >= 2) {
      label = 'j2';
      reasons.push('All five markers present, and the excitement settled into quieter contentment.');
    } else {
      label = 'j1';
      reasons.push('All five markers present: strong pleasure, self-sustaining, absorbed, bright, and it lasted.');
    }
  } else if (criteria.pleasure && criteria.selfSustaining && criteria.bright && !criteria.lasted && minutes > 0) {
    label = 'glimpse';
    reasons.push('It took off by itself but did not last a minute.');
  } else if (criteria.pleasure && (!criteria.selfSustaining || !criteria.absorbed) && a('drowsy') <= 1) {
    label = 'piti';
    if (!criteria.selfSustaining) reasons.push('Pleasure was strong, but it needed holding in place.');
    if (!criteria.absorbed) reasons.push('Pleasure was strong, but thinking or distraction carried on alongside it.');
  } else if (a('drowsy') >= 2 && a('clear') <= 1) {
    label = 'dull';
    reasons.push('Pleasant, but sleepy rather than bright. Jhana is wakeful.');
  } else if (a('pleasure') >= 1 && a('drift') <= 1 && a('drowsy') <= 1 && a('absorb') >= 1) {
    label = a('pleasure') >= 2 ? 'piti' : 'access';
    reasons.push('Calm and steady, with the pleasant feeling present but not yet running by itself.');
  } else if (a('pleasure') >= 1 || a('afterglow') >= 2) {
    label = 'relaxation';
    reasons.push('Pleasant and calming, without the take-off, absorption or brightness that mark jhana.');
  } else {
    label = 'ordinary';
    reasons.push('No sustained pleasant feeling this time.');
  }

  // Confidence: how far the report is from the decision boundary, cut by bias flags.
  let confidence = 'medium';
  if (['j1', 'j2', 'j4'].includes(label)) {
    const strong = a('pleasure') === 3 || a('selfsustain') === 3;
    confidence = strong && a('shift') >= 2 && a('afterglow') >= 1 && minutes >= 3 ? 'high' : 'medium';
  } else if (label === 'ordinary' || label === 'relaxation' || label === 'dull') {
    confidence = met <= 1 ? 'high' : 'medium';
  }
  if (flags.length) {
    confidence = 'low';
    if (flags.includes('response-bias')) {
      reasons.push('Several unrelated check items were also endorsed, so expectation may be colouring the answers.');
    }
    if (flags.includes('uniform-answers')) {
      reasons.push('Every item was rated high, including ones that contradict each other.');
    }
  }

  return { label, labelText: LABELS[label], score, confidence, criteria, flags, reasons };
}

/** True when a report counts as "reached jhana" under the app's operational definition. */
export function isJhana(result) {
  return ['j1', 'j2', 'j4'].includes(result.label) && result.confidence !== 'low';
}
