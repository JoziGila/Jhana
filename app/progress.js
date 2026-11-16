// Progress: the ladder over time, what sparks the feeling for this person, and the sit log.
// No streaks and no targets: pressure to achieve is one of the things that blocks jhana.

import { h, add, svg, fmtDate, toast } from './dom.js';
import * as platform from './platform.js';
import { RUNGS } from '../src/ladder.js';
import { stats, newState } from '../src/coach.js';
import { ranking } from '../src/bandit.js';
import { blockerById, seedById } from '../src/kb.js';

export function renderProgress(page, app) {
  const { state } = app;
  const sits = state.sits;
  const st = stats(state);

  add(page, h('header', { class: 'stack', style: { gap: '4px' } }, h('h1', {}, 'Progress'), h('p', { class: 'muted' }, 'Jhana sits at the top of a ladder. Most of the learning happens on the rungs below it.')));

  if (!sits.length) {
    add(page, 
      h('section', { class: 'card' },
        h('h3', {}, 'Your sits will appear here'),
        h('p', { class: 'muted' }, 'After each sit you mark the furthest rung you reached. The rung where you stall tells the coach which part of the loop to work on.'),
      ),
      ladderKey(),
    );
    return;
  }

  add(page, 
    h('div', { class: 'tiles' },
      tile(st.sits, st.sits === 1 ? 'sit' : 'sits'),
      tile(st.minutes, 'minutes'),
      tile(RUNGS[st.bestRung].name, 'furthest rung', true),
      tile(st.jhanaSits, st.jhanaSits === 1 ? 'sit read as jhana' : 'sits read as jhana'),
    ),
    h('section', { class: 'card' }, h('h3', {}, 'Furthest rung reached, sit by sit'), ladderChart(sits), ladderTable(sits)),
    seedCard(state),
    h('section', { class: 'stack' }, h('h2', {}, 'Sit log'),
      h('div', { class: 'hist' }, [...sits].reverse().slice(0, 40).map((s) => {
        const b = blockerById(s.diagnosis.primary);
        return h('div', {}, h('time', {}, fmtDate(s.at)), h('div', {},
          h('b', {}, `${RUNGS[s.rung].name} · ${s.score.labelText}`),
          h('div', { class: 'muted small' }, `${Math.round(s.minutes)} min · ${seedById(s.plan.seed)?.name ?? s.plan.seed} · ${b?.name ?? ''}`),
          s.note ? h('div', { class: 'small' }, s.note.length > 180 ? `${s.note.slice(0, 180)}…` : s.note) : null));
      })),
    ),
    ladderKey(),
    dataCard(app),
  );
}

function tile(value, label, text = false) {
  return h('div', { class: 'tile' }, h('b', { style: text ? { fontSize: '1.02rem', lineHeight: '1.3', paddingBlock: '4px' } : null }, String(value)), h('span', {}, label));
}

function ladderKey() {
  return h('section', { class: 'card' }, h('h3', {}, 'The ladder'),
    h('div', { class: 'rungs' }, [...RUNGS].reverse().map((r) => h('div', { class: 'rung' }, h('span', { class: 'n' }, String(r.rung)), h('div', {}, h('b', {}, r.name), h('span', {}, r.ask))))));
}

/** Single-series dot-and-line chart: x = sit number, y = rung. */
function ladderChart(sits) {
  const W = 520, H = 230, L = 96, R = 14, T = 12, B = 26;
  const n = sits.length;
  const x = (i) => (n === 1 ? (L + W - R) / 2 : L + ((W - L - R) * i) / (n - 1));
  const y = (rung) => T + ((H - T - B) * (7 - rung)) / 7;
  const wrap = h('div', { class: 'chart' });
  const tip = h('div', { class: 'tip', hidden: true });
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Furthest rung reached in each of ${n} sits. Latest: ${RUNGS[sits[n - 1].rung].name}.` });
  for (const r of RUNGS) {
    root.append(
      svg('line', { class: 'grid', x1: L, x2: W - R, y1: y(r.rung), y2: y(r.rung) }),
      svg('text', { x: L - 8, y: y(r.rung) + 4, 'text-anchor': 'end' }, r.name.replace('Found the pleasant feeling', 'Found it')),
    );
  }
  const ticks = n <= 8 ? sits.map((_, i) => i) : [0, Math.floor((n - 1) / 2), n - 1];
  for (const i of ticks) root.append(svg('text', { x: x(i), y: H - 6, 'text-anchor': 'middle' }, String(i + 1)));
  if (n > 1) root.append(svg('polyline', { fill: 'none', stroke: 'var(--s-pleasure)', 'stroke-width': 2, 'stroke-linejoin': 'round', points: sits.map((s, i) => `${x(i)},${y(s.rung)}`).join(' ') }));
  sits.forEach((s, i) => {
    const show = () => {
      tip.hidden = false;
      tip.replaceChildren(h('b', {}, `Sit ${i + 1} · ${fmtDate(s.at)}`), `${RUNGS[s.rung].name}. ${s.score.labelText}. ${blockerById(s.diagnosis.primary)?.name ?? ''}`);
      const px = (x(i) / W) * wrap.clientWidth;
      tip.style.left = `${Math.min(Math.max(0, px - 90), Math.max(0, wrap.clientWidth - 200))}px`;
      tip.style.top = `${(y(s.rung) / H) * wrap.clientHeight + 14}px`;
    };
    const hide = () => { tip.hidden = true; };
    if (s.jhana) root.append(svg('circle', { cx: x(i), cy: y(s.rung), r: 9, fill: 'none', stroke: 'var(--good)', 'stroke-width': 2 }));
    root.append(
      svg('circle', { cx: x(i), cy: y(s.rung), r: 5, fill: 'var(--s-pleasure)', stroke: 'var(--surface)', 'stroke-width': 2 }),
      svg('circle', { cx: x(i), cy: y(s.rung), r: 16, fill: 'transparent', tabindex: 0, onMouseenter: show, onMouseleave: hide, onFocus: show, onBlur: hide, onClick: show }),
    );
  });
  add(wrap, root, tip);
  if (sits.some((s) => s.jhana)) wrap.append(h('p', { class: 'muted small' }, 'A green ring marks a sit read as jhana.'));
  return wrap;
}

function ladderTable(sits) {
  return h('details', {}, h('summary', {}, 'Show as a table'),
    h('div', { class: 'tablewrap' }, h('table', {},
      h('thead', {}, h('tr', {}, ['Sit', 'Date', 'Rung', 'Reading', 'Coach focus'].map((t) => h('th', {}, t)))),
      h('tbody', {}, sits.map((s, i) => h('tr', {}, h('td', {}, String(i + 1)), h('td', {}, fmtDate(s.at)), h('td', {}, RUNGS[s.rung].name), h('td', {}, s.score.labelText), h('td', {}, blockerById(s.diagnosis.primary)?.name ?? '')))))));
}

function seedCard(state) {
  const rows = ranking(state.bandit).filter((r) => r.pulls > 0);
  if (!rows.length) return null;
  return h('section', { class: 'card' }, h('h3', {}, 'What sparks it for you'),
    h('p', { class: 'muted small' }, 'Estimated chance that each spark gives you a feeling that grows when you rest on it, from your own sits so far.'),
    h('div', { class: 'bars' }, rows.map((r) => h('div', { class: 'bar' },
      h('span', {}, seedById(r.id)?.name ?? r.id),
      h('div', { class: 'track', title: `${Math.round(r.mean * 100)}% after ${r.pulls} sits` }, h('div', { class: 'fill', style: { width: `${Math.round(r.mean * 100)}%` } })),
      h('span', { class: 'val' }, `${Math.round(r.mean * 100)}%`)))),
    h('p', { class: 'muted small' }, rows.map((r) => `${seedById(r.id)?.name ?? r.id}: ${r.pulls} ${r.pulls === 1 ? 'sit' : 'sits'}`).join(' · ')));
}

function dataCard(app) {
  let confirming = false;
  const card = h('section', { class: 'card' });
  const draw = () => {
    card.replaceChildren(
      h('h3', {}, 'Your data'),
      h('p', { class: 'muted small' }, 'Everything is stored on this device. Nothing is sent anywhere unless you use the optional Claude features.'),
      confirming
        ? h('div', { class: 'stack' }, h('p', {}, 'Erase all sits and start over? This cannot be undone.'),
            h('div', { class: 'actions' },
              h('button', { class: 'btn', type: 'button', onClick: () => { confirming = false; draw(); } }, 'Keep my data'),
              h('button', { class: 'btn primary', type: 'button', onClick: () => { app.set(newState()); location.hash = '#home'; } }, 'Erase everything')))
        : h('div', { class: 'actions' },
            h('button', { class: 'btn', type: 'button', onClick: async () => {
              const ok = await platform.exportData('ember-sits.json', JSON.stringify(app.state, null, 2));
              toast(ok ? 'Export started.' : 'Export is not available in this view.');
            } }, 'Export as JSON'),
            h('button', { class: 'btn ghost', type: 'button', onClick: () => { confirming = true; draw(); } }, 'Erase and start over')),
    );
  };
  draw();
  return card;
}
