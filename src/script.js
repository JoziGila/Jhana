// The guidance script: what is said during a sit, and when.
//
// Design rules, each tied to the theory (docs/understanding/04-mechanism.md):
//  - Front-load, then go quiet. Talk settles a beginner early; later it interrupts the loop.
//  - Every line gives permission rather than a task. Demands create the tension and checking
//    that break the loop.
//  - The onset instruction ("if it grows, do nothing") is given BEFORE the onset, because once
//    the surge starts there is no time to learn it.
//  - Effort is described as falling over time: steady attention first, then less and less.
//
// buildScript() is pure: plan in, timed cue list out. The app plays it; tests check it.

import { seedById } from './kb.js';

const ANCHOR_LINES = {
  breath: [
    'Now let attention rest on the breath in your belly. No need to control it. Feel it come and go.',
    'Each breath out, let the body sink a little more.',
  ],
  hands: [
    'Now let attention rest in your hands. Feel them from the inside: warmth, weight, a soft tingling.',
    'Leave the breath alone. Just the feeling of the hands.',
  ],
  body: [
    'Now feel the whole body sitting, all at once, as one field of sensation.',
    'Let attention be wide and soft, resting in the body as a whole.',
  ],
};

const EFFORT_LINES = {
  feather: 'Use very little effort. Attention rests here like a leaf resting on water.',
  light: 'Light, steady attention. Interested, without gripping.',
  steady: 'Keep a steady, friendly attention here. When it slips, bring it back.',
};

const PREP_LINES = {
  move: 'If you have not moved yet, walk or stretch for a few minutes first, then come back and start again.',
  wake: 'Take three deep, quick breaths to wake the body up. Sit tall.',
  prime: 'If you like, first spend a minute with a piece of music or a memory that warms you.',
};

/**
 * Build the timed cue list for a plan.
 * @returns {{cues:{at:number, phase:string, text:string, optional:boolean, id:string}[],
 *            phases:{id:string, name:string, start:number, end:number}[], totalSeconds:number}}
 */
export function buildScript(plan) {
  const total = plan.totalMin * 60;
  const exit = 75;
  const tSettle = 0;
  const tGather = plan.settleMin * 60;
  const tKindle = tGather + plan.gatherMin * 60;
  const tRest = tKindle + plan.kindleMin * 60;
  const tExit = total - exit;
  const seed = seedById(plan.seed) ?? seedById('smile');
  const cues = [];
  const say = (at, phase, text, { optional = false, id = '' } = {}) => {
    if (at < tExit || phase === 'exit') cues.push({ at: Math.round(at), phase, text, optional, id });
  };
  const spread = (start, end, lines, phase, opts = {}) => {
    const lead = opts.lead ?? 8;
    const usable = Math.max(20, end - start - lead - 15);
    const gap = Math.max(14, usable / lines.length);
    lines.forEach((line, i) => say(start + lead + i * gap, phase, line.text ?? line, line));
  };

  // 1. Arrive ---------------------------------------------------------------------------------
  const settle = [];
  if (plan.prep) settle.push({ text: PREP_LINES[plan.prep], id: 'prep' });
  settle.push({
    text:
      plan.posture === 'upright'
        ? 'Sit upright and at ease, the spine tall, the rest of you soft.'
        : 'Settle into a position you could happily stay in for a while. Comfort matters more than form.',
    id: 'posture',
  });
  settle.push({
    text:
      plan.eyes === 'soft-open'
        ? 'Let your eyes stay a little open, resting on the floor in front of you.'
        : 'Let your eyes close.',
    id: 'eyes',
  });
  settle.push({
    text: plan.pacer
      ? 'Breathe in as the tone rises, and out, slowly, as it falls. Let each out-breath be long.'
      : 'Take a slow breath in, and let it out longer than it came in. A few more like that, in your own time.',
    id: 'breathe',
  });
  settle.push({ text: 'Let the forehead smooth out. Let the eyes rest back. Unclench the jaw. Let the shoulders drop.', id: 'soften' });
  settle.push({
    text:
      plan.framing === 'no-goal'
        ? 'This sit has no goal. Nothing needs to happen. The whole task is to rest and enjoy resting.'
        : 'For the next while there is nothing to fix and nowhere to be. This time is for enjoying.',
    id: 'framing',
  });
  if (plan.relaxCues >= 2) settle.push({ text: 'Let the belly be soft. Let the hands be heavy.', id: 'soften2', optional: true });
  spread(tSettle, tGather, settle, 'arrive', { lead: 4 });

  // 2. Gather ---------------------------------------------------------------------------------
  const gather = [];
  const anchor = ANCHOR_LINES[plan.anchor] ?? ANCHOR_LINES.breath;
  gather.push({ text: anchor[0], id: 'anchor' });
  gather.push({ text: EFFORT_LINES[plan.effort] ?? EFFORT_LINES.light, id: 'effort' });
  if (plan.anchorHelp === 'count' && plan.anchor === 'breath') {
    gather.push({ text: 'If it helps, count each out-breath, one to ten, then begin again.', id: 'count' });
  }
  gather.push({ text: 'When you notice you have wandered, that noticing is the skill. Come back kindly.', id: 'return' });
  gather.push({ text: anchor[1], id: 'anchor2', optional: true });
  if (plan.relaxCues >= 1) gather.push({ text: 'Check the face and shoulders. Soften anything that has tightened.', id: 'soften3', optional: true });
  gather.push({ text: 'A quieter mind is the sign that this is working. No hurry.', id: 'quiet', optional: true });
  spread(tGather, tKindle, gather, 'gather');

  // 3. Kindle ---------------------------------------------------------------------------------
  const kindle = [
    { text: seed.how, id: 'seed' },
    { text: 'Find where you feel it in the body. It may be faint. Faint is fine.', id: 'locate' },
  ];
  if (plan.focus === 'no-seed') {
    kindle.push({ text: 'Anything faintly pleasant will do. Even a place that is simply comfortable.', id: 'lowbar' });
  }
  spread(tKindle, tRest, kindle, 'kindle', { lead: 5 });

  // 4. Rest -----------------------------------------------------------------------------------
  // Dense in the first two minutes, then silence with rare reminders.
  let t = tRest + 5;
  const rest = (text, gap, opts = {}) => {
    say(t, 'rest', text, opts);
    t += gap;
  };
  rest('Now let attention rest on that pleasant feeling. Just the feeling itself, in the body.', 22, { id: 'rest' });
  rest('There is nothing to do to it. Enjoy it, the way you would enjoy warm sun on your skin.', 24, { id: 'enjoy' });
  if (plan.inoculate) {
    rest('If it grows, do nothing. No need to help it or hold it. Breathe out, and let it come to you.', 24, { id: 'inoculate' });
  }
  if (plan.savor) rest('What is nice about it? Let yourself like it.', 20, { id: 'savor' });
  if (plan.attention === 'wide' || plan.soothe) {
    rest('Let it spread as wide as it wants. Rest in the whole of it.', 20, { id: 'wide' });
  }
  if (plan.soothe) {
    rest('If the energy runs strong, find the quieter happiness underneath it, and rest there.', 22, { id: 'soothe' });
  }
  if (plan.titrate) {
    rest('You can stop at any moment. Let it build only as far as feels safe.', 22, { id: 'titrate' });
  }
  if (plan.coachCue) rest(plan.coachCue, 24, { id: 'coach' });
  rest('If it fades, no problem. Spark it again, gently, and rest.', 22, { id: 'fade' });
  rest('As it gets easier to stay, do less. Let the feeling hold your attention for you.', 20, { id: 'ease' });
  rest('I will be quiet now. Stay with the enjoyment.', 0, { id: 'quiet-now' });

  const afterIntro = t;
  const reminders = [
    { dt: 240, text: 'Still nothing to do. Enjoying is the whole practice.', id: 'rem1' },
    { dt: 540, text: 'If you have drifted, spark the feeling again and rest on it.', id: 'rem2' },
    { dt: 960, text: 'Soften, enjoy, and do less.', id: 'rem3' },
    { dt: 1500, text: 'Nothing to do. Rest in whatever is pleasant.', id: 'rem4' },
  ];
  for (const r of reminders) say(afterIntro + r.dt, 'rest', r.text, { optional: true, id: r.id });

  if (plan.deepen) {
    say(afterIntro + 360, 'rest', 'If the pleasure has been steady for a while, take a long breath out and let the excitement settle into the background. Rest on the quieter happiness that remains.', { id: 'deepen1' });
    say(afterIntro + 720, 'rest', 'If that happiness feels like more than you need, let it calm into simple contentment.', { id: 'deepen2', optional: true });
    say(afterIntro + 1080, 'rest', 'And if contentment itself begins to feel coarse, let it go, into stillness.', { id: 'deepen3', optional: true });
  }

  // 5. Exit -----------------------------------------------------------------------------------
  say(tExit, 'exit', 'The sit is coming to an end. Let go of any effort. Notice how body and mind feel right now.', { id: 'exit1' });
  say(tExit + 28, 'exit', 'Take a fuller breath. Open your eyes when you are ready, and move slowly.', { id: 'exit2' });

  let list = cues.sort((x, y) => x.at - y.at);
  if (plan.guidance === 'sparse') list = list.filter((c) => !c.optional);

  const phases = [
    { id: 'arrive', name: 'Arrive', start: tSettle, end: tGather },
    { id: 'gather', name: 'Gather', start: tGather, end: tKindle },
    { id: 'kindle', name: 'Kindle', start: tKindle, end: tRest },
    { id: 'rest', name: 'Rest', start: tRest, end: tExit },
    { id: 'exit', name: 'Return', start: tExit, end: total },
  ];
  return { cues: list, phases, totalSeconds: total };
}

/** Which phase a moment falls in. */
export function phaseAt(script, seconds) {
  return script.phases.find((p) => seconds >= p.start && seconds < p.end) ?? script.phases[script.phases.length - 1];
}

/**
 * A pointer for the moment the meditator signals "I'm stuck" during the sit.
 * Rotates through lines appropriate to the phase, starting with the plan's own focus.
 */
export function rescueLine(phaseId, plan, count = 0) {
  const lines = {
    arrive: [
      'Nothing is required of you yet. One long breath out, and let the body be heavy.',
      'Restless is fine. Let the restlessness be there, and soften around it.',
    ],
    gather: [
      'Wandering is normal. Come back to the anchor, kindly, as many times as it takes.',
      'Ease off a little. Let the attention be lighter.',
      'Feel one whole breath out, all the way to its end.',
    ],
    kindle: [
      'Try a small smile, and feel what it does around the eyes.',
      'Anything faintly pleasant will do. Even a place that simply feels comfortable.',
      'Feel your hands. Warmth and tingling count.',
    ],
    rest: [
      'Breathe out, and soften the face. Then find the pleasant feeling again, however faint.',
      'Do less. Let the feeling be there without managing it.',
      'If you were checking whether it is working, smile at that, and come back to the body.',
      'Spark it again with a small smile, then rest.',
    ],
    exit: ['Let everything go. Just sit.'],
  };
  const pool = [...(lines[phaseId] ?? lines.rest)];
  if (plan?.coachCue && (phaseId === 'rest' || phaseId === 'kindle')) pool.unshift(plan.coachCue);
  return pool[count % pool.length];
}
