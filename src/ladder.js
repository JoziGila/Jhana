// The ladder: leading indicators on the way to first jhana.
//
// Theory link (docs/understanding/04-mechanism.md): jhana is the end of a causal chain, so a
// binary "did you get it?" gives a beginner almost no learning signal and feeds the very wanting
// that blocks it. Each rung is a separately observable step in the loop, and the rung where a
// person stalls localises the failing link.

export const RUNGS = Object.freeze([
  {
    rung: 0,
    id: 'unsettled',
    name: 'Did not settle',
    ask: 'I never really settled. Restless, uncomfortable or caught up the whole time.',
    link: 'hindrances',
  },
  {
    rung: 1,
    id: 'settled',
    name: 'Settled',
    ask: 'Body relaxed and mind calmer than when I started.',
    link: 'relaxation',
  },
  {
    rung: 2,
    id: 'steady',
    name: 'Steady',
    ask: 'Attention stayed with the anchor for a minute or more without being carried off.',
    link: 'attention',
  },
  {
    rung: 3,
    id: 'found',
    name: 'Found the pleasant feeling',
    ask: 'A clear pleasant feeling was there: warmth, glow, tingling, gladness.',
    link: 'seed',
  },
  {
    rung: 4,
    id: 'grew',
    name: 'It grew',
    ask: 'The feeling got stronger or spread when I rested on it.',
    link: 'loop-gain',
  },
  {
    rung: 5,
    id: 'takeoff',
    name: 'Take-off',
    ask: 'It surged or started running by itself, at least for some seconds.',
    link: 'ignition',
  },
  {
    rung: 6,
    id: 'stayed',
    name: 'It stayed',
    ask: 'It held by itself for a minute or more while I simply enjoyed it.',
    link: 'stability',
  },
  {
    rung: 7,
    id: 'deepened',
    name: 'It deepened',
    ask: 'It changed character: quieter joy, deep contentment, or still, even peace.',
    link: 'refinement',
  },
]);

export const MAX_RUNG = RUNGS.length - 1;

export function rungInfo(rung) {
  return RUNGS[Math.max(0, Math.min(MAX_RUNG, rung | 0))];
}

/**
 * Summarise progress over a list of sits (oldest first), without streaks or pressure.
 * @param {{rung:number}[]} sits
 */
export function ladderSummary(sits) {
  if (!sits.length) return { best: null, recent: null, counts: RUNGS.map(() => 0), trend: 0 };
  const counts = RUNGS.map(() => 0);
  let best = 0;
  for (const s of sits) {
    counts[s.rung] += 1;
    best = Math.max(best, s.rung);
  }
  const last = sits.slice(-3).map((s) => s.rung);
  const prev = sits.slice(-6, -3).map((s) => s.rung);
  const avg = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
  const recent = avg(last);
  const before = avg(prev);
  return { best, recent, counts, trend: before === null ? 0 : recent - before };
}
