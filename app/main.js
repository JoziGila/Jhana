// Ember: entry point, app state, routing, home screen and onboarding.

import { h, add, clear, choice, scale, toast, openLayer, closeLayer } from './dom.js';
import * as platform from './platform.js';
import { newState, applyProfile, planForToday, STATE_VERSION } from '../src/coach.js';
import { planHeadline } from '../src/planner.js';
import { buildScript } from '../src/script.js';
import { SEEDS, seedById, blockerById } from '../src/kb.js';
import { makeRng } from '../src/rng.js';
import { openSit } from './sitview.js';
import { openDebrief } from './debrief.js';
import { renderProgress } from './progress.js';
import { renderLearn } from './learn.js';

const root = document.getElementById('app');
export const rng = makeRng((Date.now() ^ 0x9e3779b9) >>> 0);

export const app = {
  state: migrate(platform.loadLocal()) ?? newState(),
  preflight: { energy: 2, agitation: 0, mood: 2, minutes: null },
  route: 'home',
  set(next) {
    app.state = next;
    platform.save(next);
    render();
  },
};

function migrate(s) {
  if (!s || s.v !== STATE_VERSION || !s.plan || !s.bandit) return null;
  return s;
}

// ---- routing ----------------------------------------------------------------------------------

const ROUTES = ['home', 'progress', 'learn'];
function readRoute() {
  const name = (location.hash || '').replace('#', '');
  app.route = ROUTES.includes(name) ? name : 'home';
}
window.addEventListener('hashchange', () => {
  readRoute();
  render();
  window.scrollTo(0, 0);
});

export function render() {
  clear(root);
  if (!app.state.onboarded) {
    root.append(onboarding());
    return;
  }
  const page = h('main', { class: 'page' });
  if (app.route === 'progress') renderProgress(page, app);
  else if (app.route === 'learn') renderLearn(page, app);
  else renderHome(page);
  root.append(page, tabs());
}

function tabs() {
  const tab = (id, label) => h('a', { href: `#${id}`, 'aria-current': app.route === id ? 'page' : null }, label);
  return h('div', { class: 'tabs' }, h('nav', { 'aria-label': 'Sections' }, tab('home', 'Sit'), tab('progress', 'Progress'), tab('learn', 'Learn')));
}

function brand(sub) {
  return h('header', { class: 'brand' }, h('span', { class: 'mark', html: 'Ember<i>.</i>' }), h('span', { class: 'muted small' }, sub));
}

// ---- home -------------------------------------------------------------------------------------

function renderHome(page) {
  const { state } = app;
  const today = planForToday(state, app.preflight, rng);
  const plan = today.plan;
  const script = buildScript(plan);
  const seed = seedById(plan.seed);
  const focus = plan.focus ? blockerById(plan.focus) : null;
  const n = state.sits.length;

  const phaseBar = h(
    'div',
    { class: 'stack', style: { gap: '8px' } },
    h(
      'div',
      { class: 'phasebar', role: 'img', 'aria-label': script.phases.map((p) => `${p.name} ${Math.round((p.end - p.start) / 60)} min`).join(', ') },
      script.phases.map((p, i) => h('i', { style: { flex: String(p.end - p.start), '--k': String(28 + i * 18) } })),
    ),
    h('div', { class: 'phasekey' }, script.phases.map((p) => h('span', {}, `${p.name} ${fmtMin((p.end - p.start) / 60)}`))),
  );

  const changes = [...new Set([...(state.planChanges ?? []), ...today.changes])];

  add(page,
    brand(n === 0 ? 'A trainer for first jhana' : `Sit ${n + 1}`),
    h(
      'section',
      { class: 'card plan' },
      h('div', { class: 'stack', style: { gap: '6px' } },
        h('span', { class: 'eyebrow' }, focus ? `This sit: ${focus.name.toLowerCase()}` : 'This sit'),
        h('p', { class: 'lede' }, planHeadline(plan)),
      ),
      phaseBar,
      h('dl', { class: 'kv' },
        h('dt', {}, 'Length'), h('dd', {}, `${plan.totalMin} minutes`),
        h('dt', {}, 'Spark'), h('dd', {}, seed.name, ' ', h('button', { class: 'btn link', type: 'button', onClick: pickSeed }, 'change')),
        h('dt', {}, 'Effort'), h('dd', {}, { feather: 'Very light', light: 'Light', steady: 'Steady' }[plan.effort]),
        h('dt', {}, 'Anchor'), h('dd', {}, { breath: 'Breath in the belly', hands: 'Feeling in the hands', body: 'Whole body' }[plan.anchor]),
      ),
      seed.pre ? h('p', { class: 'note' }, seed.pre) : null,
      changes.length ? h('div', { class: 'stack', style: { gap: '6px' } }, h('span', { class: 'eyebrow' }, 'Changed since last time'), h('ul', { class: 'plain small' }, changes.map((c) => h('li', {}, c)))) : null,
      h('button', { class: 'btn primary big', type: 'button', onClick: () => start(plan) }, `Begin ${plan.totalMin}-minute sit`),
      h('p', { class: 'muted small' }, 'During the sit: tap once when the pleasant feeling is clearly there, and the guide goes quiet. Tap twice if you are stuck.'),
    ),
    h(
      'section',
      { class: 'stack' },
      h('h2', {}, 'How are you right now?'),
      h('p', { class: 'muted small' }, 'Today’s state changes today’s sit.'),
      pre('Energy', 'energy', [['Tired', 0], ['Fine', 2], ['Bright', 3]]),
      pre('Body', 'agitation', [['Calm', 0], ['A bit keyed up', 2], ['Agitated', 3]]),
      pre('Mood', 'mood', [['Low', 0], ['Fine', 2], ['Good', 3]]),
      pre('Time', 'minutes', [['As planned', null], ['15 min', 15], ['25 min', 25], ['40 min', 40]]),
    ),
    soundSettings(),
  );
}

const fmtMin = (m) => (m < 1 ? `${Math.round(m * 60)} s` : `${Math.round(m)} min`);

function pre(label, key, options) {
  return h('div', { class: 'field' },
    h('span', { class: 'label' }, label),
    choice(options.map(([l, v]) => ({ label: l, value: v })), app.preflight[key], (v) => {
      app.preflight[key] = v;
      render();
    }, { label }),
  );
}

function pickSeed() {
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-label': 'Choose a spark' });
  const close = () => closeLayer(sheet);
  const page = h('div', { class: 'page' },
    h('h2', {}, 'Choose a spark'),
    h('p', { class: 'muted' }, 'The spark is how you bring up a pleasant feeling to rest on. People differ a lot in which one works. The app tries a few and keeps what works for you; you can also choose.'),
    SEEDS.map((s) =>
      h('button', { class: 'rung', type: 'button', role: 'radio', 'aria-checked': String(s.id === app.state.plan.seed), onClick: () => {
        app.set({ ...app.state, plan: { ...app.state.plan, seed: s.id } });
        close();
      } }, h('span', { class: 'n' }, ''), h('div', {}, h('b', {}, s.name), h('span', {}, `${s.short} ${s.goodFor}`))),
    ),
    h('button', { class: 'btn', type: 'button', onClick: close }, 'Cancel'),
  );
  sheet.append(page);
  openLayer(sheet);
}

function soundSettings() {
  const s = app.state.settings;
  const setS = (patch) => app.set({ ...app.state, settings: { ...s, ...patch } });
  const voices = platform.voiceOptions();
  const current = s.voice === 'auto' ? voices[0].id : s.voice;
  return h('section', { class: 'card' },
    h('h3', {}, 'Sound and voice'),
    h('div', { class: 'field' }, h('span', { class: 'label' }, 'Guide'), choice(voices.map((v) => ({ label: v.label, value: v.id })), current, (v) => setS({ voice: v }), { label: 'Guide voice' })),
    h('div', { class: 'field' },
      h('label', { for: 'rate' }, `Speaking pace: ${s.voiceRate < 0.85 ? 'slow' : s.voiceRate > 1 ? 'brisk' : 'calm'}`),
      h('input', { id: 'rate', type: 'range', min: '0.7', max: '1.15', step: '0.05', value: String(s.voiceRate), onChange: (e) => setS({ voiceRate: Number(e.target.value) }) }),
    ),
    h('div', { class: 'row' },
      h('button', { class: 'chip', type: 'button', 'aria-pressed': String(!!s.soundscape), onClick: () => setS({ soundscape: !s.soundscape }) }, 'Soft noise bed'),
      h('button', { class: 'chip', type: 'button', 'aria-pressed': String(!!s.sensor), onClick: toggleSensor }, 'Breath sensing (phone on belly)'),
      h('button', { class: 'btn link', type: 'button', onClick: () => {
        platform.unlockVoice();
        platform.audio();
        platform.speak('This is how the guide will sound. Let the out-breath be long.', current, s.voiceRate);
      } }, 'Test the voice'),
    ),
  );
}

async function toggleSensor() {
  const s = app.state.settings;
  if (s.sensor) {
    app.set({ ...app.state, settings: { ...s, sensor: false } });
    return;
  }
  const ok = await platform.requestMotion();
  if (!ok) {
    toast('Motion sensing is not available in this view. Open the standalone file on your phone to use it.');
    return;
  }
  app.set({ ...app.state, settings: { ...s, sensor: true } });
  toast('On. Lie back and rest the phone on your belly during the sit.');
}

function start(plan) {
  platform.unlockVoice();
  platform.audio();
  openSit(app, plan, (summary) => {
    openDebrief(app, plan, summary);
  });
}

// ---- onboarding -------------------------------------------------------------------------------

const QUESTIONS = [
  { id: 'experience', text: 'How much have you meditated?', labels: ['Never', 'A little', 'Regularly', 'For years'] },
  { id: 'warm', text: 'When I think of someone I love, I quickly feel warmth in my body.' },
  { id: 'chills', text: 'Music gives me chills or goosebumps.' },
  { id: 'imagery', text: 'I can vividly re-live a good memory.' },
  { id: 'body', text: 'If I pay attention to my hands, I can feel them tingle or pulse.' },
  { id: 'breathcalm', text: 'Watching my breath calms me.' },
  { id: 'breathctl', text: 'When I watch my breath, I end up controlling it.' },
  { id: 'striver', text: 'When something matters to me, I try harder rather than ease off.' },
  { id: 'sleepy', text: 'I get drowsy when I close my eyes and relax.' },
];

let obStep = 0;
const obProfile = { smile: 2, relaxes: 2 };

function onboarding() {
  const page = h('main', { class: 'page' });
  const steps = h('div', { class: 'steps', 'aria-hidden': 'true' }, [0, 1, 2, 3].map((i) => h('i', { class: i <= obStep ? 'on' : '' })));
  const next = (label = 'Continue', disabled = false) =>
    h('div', { class: 'actions' },
      obStep > 0 ? h('button', { class: 'btn', type: 'button', onClick: () => { obStep -= 1; render(); window.scrollTo(0, 0); } }, 'Back') : null,
      h('button', { class: 'btn primary', type: 'button', disabled, onClick: () => { obStep += 1; render(); window.scrollTo(0, 0); } }, label),
    );

  if (obStep === 0) {
    add(page, brand('A trainer for first jhana'), steps,
      h('h1', {}, 'Learn to light the first jhana.'),
      h('p', { class: 'lede' }, 'Jhana is a state of deep, wakeful absorption in a pleasant feeling. It is a learnable skill, and for most people it starts by accident the first time.'),
      h('p', {}, 'Ember guides a sit, asks afterwards where you got stuck, and changes the next sit to fit. Different people stall at different steps, and the fixes are often opposites, so one script cannot suit everyone.'),
      h('p', { class: 'note' }, 'This is an experimental prototype. The coaching logic comes from a synthesis of teachers’ instructions and first-person reports. It has not yet been tested on people.'),
      next('How it works'));
  } else if (obStep === 1) {
    add(page, brand('How it works'), steps,
      h('h1', {}, 'It is a loop, and you only tend it.'),
      h('div', { class: 'stack-lg' },
        point('Spark', 'You bring up a small pleasant feeling: a smile, warmth for someone, tingling in the hands.'),
        point('Rest', 'You rest attention on that feeling, lightly, and enjoy it. Attention makes it a little stronger. Stronger, it holds attention more easily.'),
        point('Do less', 'When it starts to grow by itself, you stop helping. Grabbing at it, or checking whether it is working, puts it out. This is the whole difficulty.'),
      ),
      h('p', { class: 'muted' }, 'Think of tending a small fire: tinder, a little air, and the patience not to smother it.'),
      next());
  } else if (obStep === 2) {
    const answered = QUESTIONS.every((q) => obProfile[q.id] !== undefined);
    add(page, brand('About you'), steps,
      h('h1', {}, 'Nine quick questions'),
      h('p', { class: 'muted' }, 'These choose your first spark and anticipate where you are likely to get stuck.'),
      h('div', {}, QUESTIONS.map((q) =>
        h('div', { class: 'item' }, h('span', {}, q.text),
          scale(obProfile[q.id], (v) => { obProfile[q.id] = v; const y = window.scrollY; render(); window.scrollTo(0, y); }, q.labels ?? ['No', 'A little', 'Yes', 'Very much'], q.text)),
      )),
      next('Continue', !answered));
  } else {
    add(page, brand('Before you start'), steps,
      h('h1', {}, 'Two things to know'),
      h('div', { class: 'stack-lg' },
        point('Go gently', 'This practice is usually mild and pleasant. Strong states can be unsettling for some people. If you have a history of psychosis, mania or severe trauma, talk to a clinician or an experienced teacher first. Stop any sit that feels like too much. This app is not medical advice.'),
        point('It usually takes a while', 'On retreats with hours of practice a day and personal coaching, many people get there within a week. At home with one sit a day, expect weeks. The ladder on the Progress tab shows the steps before jhana, so you can see movement long before the big moment.'),
      ),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', type: 'button', onClick: () => { obStep -= 1; render(); } }, 'Back'),
        h('button', { class: 'btn primary', type: 'button', onClick: () => { app.set(applyProfile(app.state, { ...obProfile })); window.scrollTo(0, 0); } }, 'Set up my first sit'),
      ));
  }
  return page;
}

function point(title, text) {
  return h('div', { class: 'stack', style: { gap: '4px' } }, h('h3', {}, title), h('p', {}, text));
}

// ---- boot -------------------------------------------------------------------------------------

function boot() {
  readRoute();
  render();
  // voices load late in some browsers; refresh the settings card once they do
  try {
    window.speechSynthesis?.addEventListener?.('voiceschanged', () => {
      if (app.route === 'home' && !document.querySelector('.stage, .sheet')) render();
    });
  } catch {
    /* ignore */
  }
  platform.caps.tts.then((t) => {
    if (t && app.route === 'home' && !document.querySelector('.stage, .sheet')) render();
  });
  platform.connectRemote(app.state).then((remote) => {
    const newer = migrate(remote);
    if (newer) {
      app.state = newer;
      platform.save(newer);
      if (!document.querySelector('.stage, .sheet')) render();
    }
  });
}

if (window.claude?.hot?.ready) window.claude.hot.ready(boot);
else boot();
