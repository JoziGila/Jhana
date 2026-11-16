// The sit screen: a dark room, one ember, a voice that goes quiet.

import { h, fmtClock, openLayer, closeLayer } from './dom.js';
import * as platform from './platform.js';
import { createSession } from '../src/session.js';
import { analyzeWindow, settlingIndex } from '../src/breath.js';

const GLOW = { arrive: 0.16, gather: 0.3, kindle: 0.48, rest: 0.66, exit: 0.4 };

export function openSit(app, plan, onDone) {
  const settings = app.state.settings;
  const voices = platform.voiceOptions();
  const voice = settings.voice === 'auto' ? voices[0].id : settings.voice;
  const speed = Number(window.__emberSpeed) || 1; // test hook: run the clock faster

  const cueEl = h('p', { class: 'cue', 'aria-live': 'polite' });
  const phaseEl = h('span', { class: 'phase' }, 'Arrive');
  const clockEl = h('span', { class: 'clock' }, fmtClock(plan.totalMin * 60));
  const canvas = h('canvas', { width: '480', height: '480', 'aria-hidden': 'true' });
  const pauseBtn = h('button', { type: 'button' }, 'Pause');
  const endBtn = h('button', { type: 'button' }, 'End');
  const pad = h('button', { class: 'pad', type: 'button', 'aria-label': 'Tap once when the pleasant feeling is clearly here. Tap twice if you are stuck.' }, canvas, cueEl);
  const stage = h('div', { class: 'stage', role: 'dialog', 'aria-label': 'Sit in progress' },
    h('div', { class: 'top' }, phaseEl, clockEl),
    pad,
    h('div', { class: 'bottom' },
      h('p', { class: 'hint' }, 'Tap once when the pleasant feeling is clearly here. Tap twice if you are stuck.'),
      h('div', { class: 'ctrl' }, pauseBtn, endBtn),
    ),
  );
  openLayer(stage);

  let glowTarget = GLOW.arrive;
  let cueTimer = null;
  let finished = false;

  const session = createSession(plan, {
    speak: (text) => {
      platform.speak(text, voice, settings.voiceRate);
    },
    onCue: (cue) => {
      cueEl.textContent = cue.text;
      cueEl.classList.add('on');
      clearTimeout(cueTimer);
      const hold = Math.max(9000, cue.text.split(/\s+/).length * 600);
      cueTimer = setTimeout(() => cueEl.classList.remove('on'), hold);
    },
    onPhase: (phase) => {
      phaseEl.textContent = phase.name;
      glowTarget = GLOW[phase.id] ?? 0.4;
      platform.setPacer(phase.id === 'arrive' && !!plan.pacer);
      if (phase.id === 'rest') stage.classList.add('dim');
      if (phase.id === 'exit') stage.classList.remove('dim');
    },
    bell: (kind) => {
      if (kind === 'start' || kind === 'end') platform.bell();
      else if (kind === 'tick') platform.chime(660, 0.16, 0.05);
      else if (kind === 'tick2') {
        platform.chime(520, 0.14, 0.05);
        setTimeout(() => platform.chime(520, 0.14, 0.05), 170);
      }
    },
    onEnd: (summary) => finish(summary),
  });

  // ---- clock: wall-clock based so a throttled tab stays correct --------------------------------
  let base = 0; // seconds accumulated before the current run
  let runStart = performance.now();
  let paused = false;
  const elapsed = () => base + (paused ? 0 : ((performance.now() - runStart) / 1000) * speed);
  const timer = setInterval(() => {
    if (paused || finished) return;
    const t = elapsed();
    session.tick(t);
    clockEl.textContent = fmtClock(session.script.totalSeconds - t);
  }, 250);

  pauseBtn.addEventListener('click', () => {
    if (paused) {
      runStart = performance.now();
      paused = false;
      pauseBtn.textContent = 'Pause';
      platform.setPacer(session.phase === 'arrive' && !!plan.pacer);
    } else {
      base = elapsed();
      paused = true;
      pauseBtn.textContent = 'Resume';
      platform.stopSpeaking();
      platform.setPacer(false);
    }
  });
  endBtn.addEventListener('click', () => session.end('stopped'));

  // ---- taps: one = "here", two = "stuck" -------------------------------------------------------
  let tapTimer = null;
  pad.addEventListener('click', () => {
    if (paused || finished) return;
    if (tapTimer) {
      clearTimeout(tapTimer);
      tapTimer = null;
      session.stuck();
    } else {
      tapTimer = setTimeout(() => {
        tapTimer = null;
        session.here();
        glowTarget = Math.min(1, glowTarget + 0.22);
      }, 330);
    }
  });

  // ---- optional breath sensing -----------------------------------------------------------------
  const samples = [];
  const sensorLog = [];
  let baseline = null;
  let sensorTimer = null;
  if (settings.sensor) {
    platform.startMotion((s) => {
      samples.push(s);
      if (samples.length > 20 * 75) samples.splice(0, samples.length - 20 * 60);
    });
    sensorTimer = setInterval(() => {
      if (paused || samples.length < 20 * 30) return;
      const w = analyzeWindow(samples);
      if (!baseline && w.bpm) baseline = w;
      sensorLog.push({ t: Math.round(elapsed()), bpm: w.bpm ? Math.round(w.bpm * 10) / 10 : null, stillness: Math.round(w.stillness * 100) / 100, settle: Math.round(settlingIndex(w, baseline) * 100) / 100, phase: session.phase });
    }, 15000 / speed);
  }

  // ---- ember ----------------------------------------------------------------------------------
  const g = canvas.getContext('2d');
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let glow = glowTarget;
  let raf = 0;
  const draw = (now) => {
    glow += (glowTarget - glow) * 0.02;
    const W = canvas.width;
    const c = W / 2;
    // breathe with the pacer when it is on, otherwise slowly by itself
    let breath;
    const pp = platform.pacerPhase();
    if (pp !== null) {
      const inFrac = platform.PACER.inSec / (platform.PACER.inSec + platform.PACER.outSec);
      breath = pp < inFrac ? pp / inFrac : 1 - (pp - inFrac) / (1 - inFrac);
    } else {
      breath = reduce ? 0.5 : 0.5 + 0.5 * Math.sin(now / 2600);
    }
    const r = W * (0.13 + 0.05 * breath + 0.1 * glow);
    g.clearRect(0, 0, W, W);
    const halo = g.createRadialGradient(c, c, r * 0.2, c, c, Math.min(r * 2.9, c * 0.98)); // fade out inside the canvas
    halo.addColorStop(0, `rgba(255, 150, 80, ${0.16 + 0.3 * glow})`);
    halo.addColorStop(0.5, `rgba(226, 85, 61, ${0.05 + 0.12 * glow})`);
    halo.addColorStop(1, 'rgba(226, 85, 61, 0)');
    g.fillStyle = halo;
    g.fillRect(0, 0, W, W);
    const core = g.createRadialGradient(c - r * 0.2, c - r * 0.25, r * 0.05, c, c, r);
    core.addColorStop(0, `rgba(255, 226, 170, ${0.55 + 0.4 * glow})`);
    core.addColorStop(0.45, `rgba(255, 143, 82, ${0.5 + 0.4 * glow})`);
    core.addColorStop(1, 'rgba(160, 52, 30, 0.05)');
    g.fillStyle = core;
    g.beginPath();
    g.arc(c, c, r, 0, Math.PI * 2);
    g.fill();
    if (!finished) raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);

  platform.keepAwake(true);
  if (settings.soundscape) platform.setSoundscape(true);
  const onVisible = () => {
    if (document.visibilityState === 'visible' && !finished) platform.keepAwake(true);
  };
  document.addEventListener('visibilitychange', onVisible);

  function finish(summary) {
    if (finished) return;
    finished = true;
    clearInterval(timer);
    clearInterval(sensorTimer);
    clearTimeout(tapTimer);
    cancelAnimationFrame(raf);
    document.removeEventListener('visibilitychange', onVisible);
    platform.setPacer(false);
    platform.setSoundscape(false);
    platform.stopMotion();
    platform.keepAwake(false);
    const sensor = sensorLog.length ? summariseSensor(sensorLog) : null;
    setTimeout(() => {
      platform.stopSpeaking();
      closeLayer(stage);
      onDone({ ...summary, sensor });
    }, summary.reason === 'complete' ? 2500 : 300);
  }
}

/** Compress the sensor log to what the debrief and a study export need. */
export function summariseSensor(log) {
  const withRate = log.filter((x) => x.bpm);
  const avg = (v) => (v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null);
  const first = withRate.slice(0, 4).map((x) => x.bpm);
  const last = withRate.slice(-4).map((x) => x.bpm);
  const rest = log.filter((x) => x.phase === 'rest');
  return {
    windows: log.length,
    bpmStart: avg(first),
    bpmEnd: avg(last),
    stillnessRest: avg(rest.map((x) => x.stillness)),
    settleRest: avg(rest.map((x) => x.settle)),
    series: log.filter((_, i) => i % 2 === 0).slice(0, 120),
  };
}
