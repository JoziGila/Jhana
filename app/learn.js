// Learn: the loop made visible, the troubleshooting guide, and how the app reads a sit.

import { h, add, svg } from './dom.js';
import { runSit, habitPolicy, DEFAULT_TRAITS } from '../src/loopModel.js';
import { BLOCKERS } from '../src/kb.js';

const PRESETS = {
  balanced: { label: 'Balanced', effort: 0.55, soften: 0.5, grab: 0.4, ease: true },
  striving: { label: 'Trying hard', effort: 0.95, soften: 0, grab: 0.4, ease: false },
  drifting: { label: 'Drifting', effort: 0.1, soften: 0.8, grab: 0.4, ease: false },
  grabbing: { label: 'Grabbing at it', effort: 0.55, soften: 0.2, grab: 0.95, ease: false },
};

let sim = { ...PRESETS.balanced, preset: 'balanced' };

export function renderLearn(page) {
  add(page,
    h('header', { class: 'stack', style: { gap: '4px' } }, h('h1', {}, 'How jhana starts'), h('p', { class: 'muted' }, 'A working theory, shown as a model you can play with.')),
    h('section', { class: 'stack' },
      h('p', { class: 'lede' }, 'Jhana behaves like a fire catching. Attention resting on a pleasant feeling makes the feeling stronger; a stronger feeling holds attention more easily. Below a threshold it fades. Above it, it feeds itself.'),
      h('p', {}, 'Three things decide which side of the threshold you are on: how steadily attention rests on the feeling, how relaxed the body is, and whether you grab at the feeling when it starts to grow.'),
    ),
    simulator(),
    h('section', { class: 'card' },
      h('h3', {}, 'How the app reads a sit'),
      h('p', {}, 'A sit is read as first jhana only when five things were all present at once:'),
      h('ul', { class: 'plain' },
        h('li', {}, 'strong pleasant feeling in the body, or strong joy'),
        h('li', {}, 'it ran by itself, without being held in place'),
        h('li', {}, 'absorption: thought sparse, sounds not pulling'),
        h('li', {}, 'a bright, awake mind (sleepy and pleasant is something else)'),
        h('li', {}, 'it lasted at least about a minute'),
      ),
      h('p', { class: 'muted small' }, 'Strong relaxation misses the second and fourth. Pleasure you have to hold in place misses the second. A few check questions that have nothing to do with jhana catch answers driven by expectation. All of this rests on self-report and has not been validated against expert interview.'),
    ),
    h('section', { class: 'stack' }, h('h2', {}, 'When it goes wrong'),
      h('p', { class: 'muted' }, 'The patterns the coach looks for, and what it changes.'),
      h('div', {}, BLOCKERS.filter((b) => !['stabilise', 'deepen', 'dose'].includes(b.id)).map((b) =>
        h('details', {}, h('summary', {}, b.name), h('div', { class: 'stack' }, h('p', {}, b.oneLine), h('p', { class: 'muted' }, b.why), h('p', {}, b.fix.instruction))))),
    ),
    h('section', { class: 'card' },
      h('h3', {}, 'Safety'),
      h('p', {}, 'Most people find this practice gentle. Intense energy, strong emotion or a sense of losing control can occur. If a sit feels like too much, open your eyes, move, and stop for the day.'),
      h('p', {}, 'One retreat provider reports that about 3 in 100 participants had passing difficulty such as disturbed sleep, strong emotion or disorientation, and that one person in about 1,200 developed mania needing psychiatric care, with no prior history. Those figures come from week-long intensive retreats and from the provider itself.'),
      h('p', {}, 'If you have a history of psychosis, mania or severe trauma, get advice from a clinician or an experienced teacher before practising toward strong states. Strong sits late in the evening can disturb sleep. Stop and seek support if you notice lasting agitation, insomnia or low mood.'),
    ),
    h('section', { class: 'card' },
      h('h3', {}, 'What this is'),
      h('p', {}, 'Ember is a research prototype. Its theory, sources and study design are in the project repository. It has not yet been tested on people, and it is no substitute for a teacher.'),
    ),
  );
}

function simulator() {
  const card = h('section', { class: 'card' });
  const draw = () => {
    const habits = {
      effortAnchor: Math.max(sim.effort, 0.05),
      effortPleasure: sim.effort,
      relaxDrive: sim.soften,
      easeOff: sim.ease ? 0.8 : 0,
      settleSeconds: 180,
    };
    const traits = { ...DEFAULT_TRAITS, wanting: sim.grab, inoculated: 0 };
    const run = runSit(traits, habitPolicy(habits), { seconds: 1800, record: 15 });
    const slider = (key, label, lo, hi) => h('label', {},
      h('span', {}, label, ' ', h('output', {}, lo && hi ? (sim[key] < 0.34 ? lo : sim[key] > 0.66 ? hi : 'medium') : '')),
      h('input', { id: `sim-${key}`, type: 'range', min: '0', max: '1', step: '0.05', value: String(sim[key]), onChange: (e) => { sim = { ...sim, [key]: Number(e.target.value), preset: null }; draw(); } }));

    card.replaceChildren(
      h('h3', {}, 'Try it: thirty minutes in a simulated mind'),
      h('div', { class: 'chips', role: 'radiogroup', 'aria-label': 'Preset' }, Object.entries(PRESETS).map(([id, p]) =>
        h('button', { class: 'chip', type: 'button', role: 'radio', 'aria-checked': String(sim.preset === id), onClick: () => { sim = { ...p, preset: id }; draw(); } }, p.label))),
      simChart(run),
      h('div', { class: 'legend' },
        h('span', {}, h('i', { style: { background: 'var(--s-pleasure)' } }), 'Pleasant feeling'),
        h('span', {}, h('i', { style: { background: 'var(--s-attn)' } }), 'Steadiness of attention'),
        h('span', {}, h('i', { style: { background: 'var(--s-tension)' } }), 'Tension')),
      h('p', { class: 'simverdict' }, verdict(run)),
      h('div', { class: 'sim-controls' },
        slider('effort', 'Effort:', 'light', 'hard'),
        slider('soften', 'Softening:', 'little', 'a lot'),
        slider('grab', 'Urge to grab:', 'low', 'high'),
        h('label', {}, h('span', {}, 'Ease off as it grows'),
          h('button', { class: 'chip', type: 'button', 'aria-pressed': String(sim.ease), onClick: () => { sim = { ...sim, ease: !sim.ease, preset: null }; draw(); } }, sim.ease ? 'Yes' : 'No'))),
      h('p', { class: 'muted small' }, 'This is a model of the theory, with made-up constants chosen to resemble reports. It shows what the theory predicts. It is not data from people.'),
    );
  };
  draw();
  return card;
}

function verdict(run) {
  const s = run.summary;
  if (run.ignited) return `Catches at about minute ${Math.round(run.ignitionTime / 60)} and then sustains itself.`;
  if (s.onsetCollapses > 0) return `Starts ${s.onsetCollapses === 1 ? 'once' : `${s.onsetCollapses} times`}, then collapses: excitement and grabbing cut the loop.`;
  if (s.minEnergy < 0.35) return 'Never catches: attention is too slack and the mind sinks toward drowsiness.';
  if (s.meanTension > 0.35) return 'Never catches: attention is steady, but tension keeps the feeling from growing.';
  if (s.meanAttention < 0.4) return 'Never catches: attention does not stay long enough for the feeling to build.';
  return 'Hovers just under the threshold: pleasant, but it does not take off in thirty minutes.';
}

/** Three lines on one 0–1 axis over 30 minutes, with a crosshair tooltip. */
function simChart(run) {
  const W = 520, H = 210, L = 30, R = 86, T = 10, B = 26;
  const pts = run.trace;
  const x = (s) => L + ((W - L - R) * s) / 1800;
  const y = (v) => T + (H - T - B) * (1 - v);
  const series = [
    { key: 'p', name: 'Pleasant feeling', color: 'var(--s-pleasure)' },
    { key: 'a', name: 'Attention', color: 'var(--s-attn)' },
    { key: 't', name: 'Tension', color: 'var(--s-tension)' },
  ];
  const wrap = h('div', { class: 'chart' });
  const tip = h('div', { class: 'tip', hidden: true });
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Simulated thirty-minute sit. ${verdict(run)}` });
  for (const v of [0, 0.5, 1]) {
    root.append(svg('line', { class: 'grid', x1: L, x2: W - R, y1: y(v), y2: y(v) }), svg('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end' }, v === 0 ? '0' : v === 1 ? 'max' : ''));
  }
  for (const m of [0, 10, 20, 30]) root.append(svg('text', { x: x(m * 60), y: H - 6, 'text-anchor': 'middle' }, `${m} min`));
  if (run.ignited) {
    root.append(
      svg('line', { x1: x(run.ignitionTime), x2: x(run.ignitionTime), y1: T, y2: H - B, stroke: 'var(--muted)', 'stroke-width': 1, 'stroke-dasharray': '3 4' }),
      svg('text', { x: x(run.ignitionTime) + 5, y: T + 10 }, 'catches'),
    );
  }
  // direct labels at the line ends, nudged apart so they never overlap
  const ends = series.map((s) => ({ ...s, v: pts[pts.length - 1][s.key] })).sort((a, b) => b.v - a.v);
  let lastY = -99;
  for (const e of ends) {
    e.ly = Math.max(y(e.v) + 4, lastY + 13);
    lastY = e.ly;
  }
  for (const s of series) {
    root.append(svg('polyline', { fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', points: pts.map((p) => `${x(p.s).toFixed(1)},${y(p[s.key]).toFixed(1)}`).join(' ') }));
  }
  for (const e of ends) root.append(svg('text', { x: W - R + 6, y: e.ly }, e.name));
  const cross = svg('line', { y1: T, y2: H - B, stroke: 'var(--muted)', 'stroke-width': 1, visibility: 'hidden' });
  root.append(cross);
  const hit = svg('rect', { x: L, y: T, width: W - L - R, height: H - T - B, fill: 'transparent' });
  const move = (ev) => {
    const box = root.getBoundingClientRect();
    const px = ((ev.touches?.[0]?.clientX ?? ev.clientX) - box.left) * (W / box.width);
    const sec = Math.max(0, Math.min(1800, ((px - L) / (W - L - R)) * 1800));
    const p = pts.reduce((best, q) => (Math.abs(q.s - sec) < Math.abs(best.s - sec) ? q : best), pts[0]);
    cross.setAttribute('x1', x(p.s));
    cross.setAttribute('x2', x(p.s));
    cross.setAttribute('visibility', 'visible');
    tip.hidden = false;
    tip.replaceChildren(h('b', {}, `Minute ${Math.round(p.s / 60)}`), ...series.map((s) => h('div', {}, `${s.name}: ${Math.round(p[s.key] * 100)}%`)));
    const left = (x(p.s) / W) * wrap.clientWidth;
    tip.style.left = `${Math.min(Math.max(0, left + 10), Math.max(0, wrap.clientWidth - 170))}px`;
    tip.style.top = '8px';
  };
  const leave = () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); };
  hit.addEventListener('mousemove', move);
  hit.addEventListener('touchstart', move, { passive: true });
  hit.addEventListener('touchmove', move, { passive: true });
  hit.addEventListener('mouseleave', leave);
  root.append(hit);
  wrap.append(root, tip);
  return wrap;
}
