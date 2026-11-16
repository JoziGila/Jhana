// The debrief: a short structured report after each sit, then the coach's reading of it.
//
// Order matters for validity (docs/validation.md): the free description comes FIRST, before any
// checklist can suggest what "should" have happened.

import { h, add, clear, scale, toast, openLayer, closeLayer } from './dom.js';
import * as platform from './platform.js';
import { completeSit } from '../src/coach.js';
import { RUNGS } from '../src/ladder.js';
import { ITEMS, DURATIONS } from '../src/jhanaScore.js';
import { SYMPTOMS, seedById } from '../src/kb.js';
import { planHeadline } from '../src/planner.js';
import { rng, render as renderApp } from './main.js';
import { openChat, readNote } from './claude.js';

const GROUPS = [
  ['body', 'Body'],
  ['attention', 'Attention'],
  ['feeling', 'The pleasant feeling'],
  ['mind', 'Mind and mood'],
];

export function openDebrief(app, plan, summary) {
  const draft = { note: '', rung: null, symptoms: new Set(), answers: {}, duration: null };
  let step = 0;
  let result = null;
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-label': 'After the sit' });
  const page = h('div', { class: 'page' });
  sheet.append(page);
  openLayer(sheet);

  const needsDetail = () => (draft.rung ?? 0) >= 3;
  const totalSteps = () => (needsDetail() ? 4 : 3);

  function go(n) {
    step = n;
    draw();
    window.scrollTo(0, 0);
  }

  function draw() {
    clear(page);
    if (result) return drawResult();
    const bar = h('div', { class: 'steps', 'aria-hidden': 'true' }, Array.from({ length: totalSteps() }, (_, i) => h('i', { class: i <= step ? 'on' : '' })));
    add(page, h('span', { class: 'eyebrow' }, `After the sit · ${summary.minutes} minutes`), bar);

    if (step === 0) {
      const area = h('textarea', { id: 'note', placeholder: 'What happened, in your own words? What were you doing just before anything changed?', value: draft.note, onInput: (e) => { draft.note = e.target.value; } });
      const fill = h('button', { class: 'btn', type: 'button', hidden: true, onClick: async () => {
        if (draft.note.trim().length < 20) return toast('Write a sentence or two first.');
        fill.disabled = true;
        fill.textContent = 'Reading…';
        const read = await readNote(draft.note);
        fill.disabled = false;
        fill.textContent = 'Let Claude pre-fill the next steps from this';
        if (!read) return toast('Could not read the note. Carry on by hand.');
        if (Number.isInteger(read.rung)) draft.rung = Math.max(0, Math.min(7, read.rung));
        for (const s of read.symptoms ?? []) if (SYMPTOMS.some((x) => x.id === s)) draft.symptoms.add(s);
        toast('Pre-filled. Check each step and correct anything that is off.');
        go(1);
      } }, 'Let Claude pre-fill the next steps from this');
      platform.caps.sample.then((s) => { fill.hidden = !s; });
      add(page, 
        h('h1', {}, 'First, in your own words'),
        h('p', { class: 'muted' }, 'Before any checklists. A sentence or two is plenty; skipping is fine.'),
        h('div', { class: 'field' }, h('label', { for: 'note' }, 'What happened?'), area),
        summary.sensor ? sensorNote(summary.sensor) : null,
        h('div', { class: 'actions' }, fill, h('button', { class: 'btn primary', type: 'button', onClick: () => go(1) }, 'Continue')),
      );
    } else if (step === 1) {
      add(page, 
        h('h1', {}, 'How far did it go?'),
        h('p', { class: 'muted' }, 'Pick the furthest point you reached, even briefly.'),
        h('div', { class: 'rungs', role: 'radiogroup', 'aria-label': 'Furthest point reached' },
          RUNGS.map((r) => h('button', { class: 'rung', type: 'button', role: 'radio', 'aria-checked': String(draft.rung === r.rung), onClick: () => { draft.rung = r.rung; draw(); } },
            h('span', { class: 'n' }, String(r.rung)), h('div', {}, h('b', {}, r.name), h('span', {}, r.ask))))),
        nav(draft.rung === null),
      );
    } else if (step === 2) {
      add(page, 
        h('h1', {}, 'Did anything get in the way?'),
        h('p', { class: 'muted' }, 'Tick whatever applies. None is a fine answer.'),
        GROUPS.map(([id, name]) => h('div', { class: 'field' }, h('span', { class: 'label' }, name),
          h('div', { class: 'chips' }, SYMPTOMS.filter((s) => s.group === id).map((s) =>
            h('button', { class: 'chip', type: 'button', 'aria-pressed': String(draft.symptoms.has(s.id)), onClick: (e) => {
              if (draft.symptoms.has(s.id)) draft.symptoms.delete(s.id); else draft.symptoms.add(s.id);
              e.currentTarget.setAttribute('aria-pressed', String(draft.symptoms.has(s.id)));
            } }, s.text))))),
        nav(false, needsDetail() ? 'Continue' : 'See the reading'),
      );
    } else {
      add(page, 
        h('h1', {}, 'A closer look'),
        h('p', { class: 'muted' }, 'Answer for the strongest stretch of the sit. Go with your first impression.'),
        h('div', { class: 'field' }, h('span', { class: 'label' }, 'How long did the strongest stretch last?'),
          h('div', { class: 'chips', role: 'radiogroup' }, DURATIONS.map((d) => h('button', { class: 'chip', type: 'button', role: 'radio', 'aria-checked': String(draft.duration === d.id), onClick: () => { draft.duration = d.id; const y = window.scrollY; draw(); window.scrollTo(0, y); } }, d.label)))),
        h('div', {}, ITEMS.map((item) => h('div', { class: 'item' }, h('span', {}, item.text),
          scale(draft.answers[item.id], (v) => { draft.answers[item.id] = v; const y = window.scrollY; draw(); window.scrollTo(0, y); }, undefined, item.text)))),
        nav(draft.duration === null, 'See the reading'),
      );
    }
  }

  function nav(disabled, label = 'Continue') {
    return h('div', { class: 'actions' },
      h('button', { class: 'btn', type: 'button', onClick: () => go(step - 1) }, 'Back'),
      h('button', { class: 'btn primary', type: 'button', disabled, onClick: () => (step + 1 >= totalSteps() ? finish() : go(step + 1)) }, label),
    );
  }

  function finish() {
    const report = {
      minutes: summary.minutes,
      rung: draft.rung ?? 0,
      symptoms: [...draft.symptoms],
      answers: needsDetail() ? draft.answers : {},
      duration: needsDetail() ? draft.duration ?? 'none' : 'none',
      note: draft.note.trim(),
      taps: summary.taps,
      sensor: summary.sensor ? { ...summary.sensor, series: undefined } : null,
    };
    // use the plan that was actually sat (today's adjustments included) as the basis for learning
    const basis = { ...app.state, plan: { ...app.state.plan, seed: plan.seed } };
    result = completeSit(basis, report, rng);
    app.state = result.state;
    platform.save(app.state);
    draw();
    window.scrollTo(0, 0);
  }

  function drawResult() {
    const { score, diagnosis, sit } = result;
    const b = diagnosis.blocker;
    const nextPlan = app.state.plan;
    const crit = [['pleasure', 'Strong pleasure'], ['selfSustaining', 'Ran by itself'], ['absorbed', 'Absorbed'], ['bright', 'Bright and awake'], ['lasted', 'Lasted a minute']];
    const chatBtn = h('button', { class: 'btn', type: 'button', hidden: true, onClick: () => openChat(app, sit, diagnosis) }, 'Talk it through with Claude');
    platform.caps.sample.then((s) => { chatBtn.hidden = !s; });

    add(page, 
      h('span', { class: 'eyebrow' }, 'The reading'),
      h('div', { class: 'verdict' },
        h('span', { class: 'label' }, score.labelText),
        h('div', { class: 'row' },
          h('span', { class: `pill ${sit.jhana ? 'good' : ''}` }, `Ladder: ${RUNGS[sit.rung].name}`),
          sit.rung >= 3 ? h('span', { class: `pill ${score.confidence === 'low' ? 'warn' : ''}` }, `Confidence: ${score.confidence}`) : null,
        ),
      ),
      h('div', { class: 'stack', style: { gap: '6px' } }, score.reasons.map((r) => h('p', {}, r))),
      sit.rung >= 3 ? h('div', { class: 'crit' }, crit.map(([k, label]) => h('span', { class: score.criteria[k] ? 'met' : '' }, label))) : null,
      h('p', { class: 'note' }, 'This reading rests on your own answers. It is a hypothesis to test over several sits, not a certificate.'),
      h('hr', { class: 'divider' }),
      h('section', { class: 'stack' },
        h('span', { class: 'eyebrow' }, ['stabilise', 'deepen'].includes(b.id) ? 'Where you are' : 'What most likely held it back'),
        h('h2', {}, b.name),
        h('p', {}, b.oneLine),
        h('p', { class: 'muted' }, b.why),
      ),
      h('section', { class: 'card plan' },
        h('span', { class: 'eyebrow' }, 'Next sit'),
        h('p', { class: 'lede' }, planHeadline(nextPlan)),
        app.state.planChanges.length ? h('ul', { class: 'plain small' }, app.state.planChanges.map((c) => h('li', {}, c))) : null,
        h('p', { class: 'muted small' }, `Spark: ${seedById(nextPlan.seed).name}. Length: ${nextPlan.totalMin} minutes.`),
      ),
      h('div', { class: 'actions' }, chatBtn, h('button', { class: 'btn primary', type: 'button', onClick: () => { renderApp(); closeLayer(sheet); window.scrollTo(0, 0); } }, 'Done')),
    );
  }

  draw();
}

function sensorNote(s) {
  if (!s.bpmStart || !s.bpmEnd) return h('p', { class: 'note' }, 'Breath sensing ran, but the signal was too weak to read a breathing rate.');
  return h('p', { class: 'note' }, `Breath sensing: about ${s.bpmStart} breaths a minute at the start and ${s.bpmEnd} at the end. Stillness while resting: ${Math.round((s.stillnessRest ?? 0) * 100)}%.`);
}
