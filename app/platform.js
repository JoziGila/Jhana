// Everything that touches the browser or the hosting page: storage, voice, sound, wake lock,
// motion sensing, and the optional Claude capabilities available when the app is opened as a
// published artifact. Every feature degrades to "absent" without breaking the app.

const KEY = 'ember.v1';

// ---- Claude artifact capabilities (all optional) ----------------------------------------------

const cap = (name) => {
  try {
    return window.claude?.use ? window.claude.use(name).catch(() => null) : Promise.resolve(null);
  } catch {
    return Promise.resolve(null);
  }
};
export const caps = {
  tts: cap('tts'),
  sample: cap('sample'),
  db: cap('db'),
  user: cap('user'),
  downloads: cap('downloads'),
};

// ---- storage ----------------------------------------------------------------------------------

export function loadLocal() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

let remoteDoc = null;
let remoteBusy = false;
let remotePending = null;

/** Save locally at once; mirror to the viewer's private cloud document when one is available. */
export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private window or blocked storage: the session still works in memory */
  }
  if (remoteDoc) pushRemote(state);
}

async function pushRemote(state) {
  remotePending = state;
  if (remoteBusy) return; // one write at a time per document
  remoteBusy = true;
  while (remotePending) {
    const next = remotePending;
    remotePending = null;
    try {
      await remoteDoc.set({ json: JSON.stringify(next), savedAt: Date.now() });
    } catch {
      break;
    }
  }
  remoteBusy = false;
}

/** Connect cloud storage if present. Resolves with a newer remote state, or null. */
export async function connectRemote(localState) {
  try {
    const [db, user] = await Promise.all([caps.db, caps.user]);
    if (!db || !user) return null;
    const id = await user.id();
    if (!id) return null;
    remoteDoc = db.collection(`data/users/${id}`).doc('ember'); // private to this viewer
    const snap = await remoteDoc.get();
    if (!snap.exists) return null;
    const remote = JSON.parse(snap.data().json);
    const localSits = localState?.sits?.length ?? 0;
    return (remote.sits?.length ?? 0) > localSits || !localState?.onboarded ? remote : null;
  } catch {
    return null;
  }
}

/** Offer the user's data as a file. Returns true when a save was started. */
export async function exportData(filename, text) {
  const downloads = await caps.downloads;
  if (downloads) {
    try {
      await downloads.save({ filename, data: text });
      return true;
    } catch {
      return false;
    }
  }
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch {
    return false;
  }
}

// ---- voice ------------------------------------------------------------------------------------

let claudeTts = null;
caps.tts.then((t) => {
  claudeTts = t;
});

export function voiceOptions() {
  const out = [];
  if (claudeTts) out.push({ id: 'claude', label: 'Claude voice' });
  if ('speechSynthesis' in window) out.push({ id: 'device', label: 'Device voice' });
  out.push({ id: 'text', label: 'Text and chime only' });
  return out;
}

function pickDeviceVoice() {
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  const en = voices.filter((v) => /^en/i.test(v.lang));
  const prefer = ['Samantha', 'Serena', 'Karen', 'Moira', 'Google UK English Female', 'Google US English', 'Microsoft Aria', 'Microsoft Jenny'];
  for (const name of prefer) {
    const v = en.find((x) => x.name.includes(name));
    if (v) return v;
  }
  return en.find((v) => v.localService) ?? en[0] ?? null;
}

/** Must be called from a tap: unlocks speech and audio on phones. */
export function unlockVoice() {
  try {
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      window.speechSynthesis.speak(u);
    }
  } catch {
    /* ignore */
  }
}

function speakDevice(text, rate) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return false;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickDeviceVoice();
    if (v) u.voice = v;
    u.rate = rate;
    u.pitch = 0.95;
    u.volume = 0.9;
    synth.speak(u);
    return true;
  } catch {
    return false;
  }
}

/**
 * Speak one line. mode: 'auto' | 'claude' | 'device' | 'text'. Returns the channel used.
 * Falls back claude → device → chime so a sit is never left without a signal.
 */
export async function speak(text, mode = 'auto', rate = 0.9) {
  if (mode === 'text') {
    chime(528, 0.5, 0.05);
    return 'text';
  }
  const wantClaude = (mode === 'claude' || mode === 'auto') && claudeTts;
  if (wantClaude) {
    try {
      claudeTts.speak(text, { voice: 'rounded', rate: Math.max(0.7, Math.min(1.5, rate)) }).catch(() => {});
      return 'claude';
    } catch {
      /* fall through */
    }
  }
  if (speakDevice(text, rate)) return 'device';
  chime(528, 0.5, 0.05);
  return 'text';
}

export function stopSpeaking() {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
  try {
    claudeTts?.stop().catch(() => {});
  } catch {
    /* ignore */
  }
}

// ---- sound ------------------------------------------------------------------------------------

let ctx = null;
let noiseNode = null;
let noiseGain = null;
let pacer = null;

export function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/** A soft bell: a few decaying partials. */
export function bell(volume = 0.18) {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  [[392, 1], [784, 0.5], [1176, 0.25], [1568, 0.12]].forEach(([f, g]) => {
    const o = ac.createOscillator();
    const gain = ac.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume * g, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 5);
    o.connect(gain).connect(ac.destination);
    o.start(now);
    o.stop(now + 5.2);
  });
}

/** A very short, quiet tick used to confirm a tap without opening the eyes. */
export function chime(freq = 660, dur = 0.18, volume = 0.06) {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(volume, now + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  o.connect(g).connect(ac.destination);
  o.start(now);
  o.stop(now + dur + 0.05);
}

/** Brown-noise bed that masks household sound. */
export function setSoundscape(on, volume = 0.05) {
  const ac = audio();
  if (!ac) return;
  if (on && !noiseNode) {
    const len = ac.sampleRate * 4;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      d[i] = last * 3.5;
    }
    noiseNode = ac.createBufferSource();
    noiseNode.buffer = buf;
    noiseNode.loop = true;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    noiseGain = ac.createGain();
    noiseGain.gain.setValueAtTime(0, ac.currentTime);
    noiseGain.gain.linearRampToValueAtTime(volume, ac.currentTime + 4);
    noiseNode.connect(lp).connect(noiseGain).connect(ac.destination);
    noiseNode.start();
  } else if (!on && noiseNode) {
    const n = noiseNode;
    noiseGain.gain.linearRampToValueAtTime(0, ac.currentTime + 1.5);
    setTimeout(() => {
      try {
        n.stop();
      } catch {
        /* ignore */
      }
    }, 1700);
    noiseNode = null;
  }
}

export const PACER = { inSec: 4, outSec: 7 }; // ≈ 5.5 breaths a minute, long out-breath

/** Slow breathing tone: pitch rises on the in-breath and falls on the longer out-breath. */
export function setPacer(on, volume = 0.035) {
  const ac = audio();
  if (!ac) return;
  if (on && !pacer) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sine';
    o.frequency.value = 174;
    g.gain.value = 0;
    o.connect(g).connect(ac.destination);
    o.start();
    const cycle = PACER.inSec + PACER.outSec;
    const schedule = () => {
      const t0 = ac.currentTime + 0.05;
      for (let i = 0; i < 6; i++) {
        const t = t0 + i * cycle;
        o.frequency.setValueAtTime(174, t);
        o.frequency.linearRampToValueAtTime(232, t + PACER.inSec);
        o.frequency.linearRampToValueAtTime(174, t + cycle);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(volume, t + PACER.inSec * 0.8);
        g.gain.linearRampToValueAtTime(0.0001, t + cycle - 0.3);
      }
    };
    schedule();
    pacer = { o, g, timer: setInterval(schedule, 6 * cycle * 1000), started: performance.now() };
  } else if (!on && pacer) {
    const p = pacer;
    pacer = null;
    clearInterval(p.timer);
    try {
      p.g.gain.cancelScheduledValues(ac.currentTime);
      p.g.gain.linearRampToValueAtTime(0.0001, ac.currentTime + 1);
      p.o.stop(ac.currentTime + 1.2);
    } catch {
      /* ignore */
    }
  }
}

/** 0..1 phase of the pacer's breath (0→in, peak at inSec/cycle), or null when off. */
export function pacerPhase() {
  if (!pacer) return null;
  const cycle = (PACER.inSec + PACER.outSec) * 1000;
  return ((performance.now() - pacer.started) % cycle) / cycle;
}

// ---- wake lock --------------------------------------------------------------------------------

let wake = null;
export async function keepAwake(on) {
  try {
    if (on && navigator.wakeLock && !wake) {
      wake = await navigator.wakeLock.request('screen');
      wake.addEventListener?.('release', () => {
        wake = null;
      });
    } else if (!on && wake) {
      await wake.release();
      wake = null;
    }
  } catch {
    wake = null;
  }
}

// ---- motion (breathing and stillness) -------------------------------------------------------

let motionHandler = null;

/** Ask for motion access (needs a tap on iOS). Resolves true when samples can be expected. */
export async function requestMotion() {
  try {
    if (typeof DeviceMotionEvent === 'undefined') return false;
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      const res = await DeviceMotionEvent.requestPermission();
      if (res !== 'granted') return false;
    }
    return await new Promise((resolve) => {
      let got = false;
      const probe = (e) => {
        if (e.accelerationIncludingGravity && e.accelerationIncludingGravity.z !== null) got = true;
      };
      window.addEventListener('devicemotion', probe);
      setTimeout(() => {
        window.removeEventListener('devicemotion', probe);
        resolve(got);
      }, 900);
    });
  } catch {
    return false;
  }
}

/** Start streaming accelerometer samples {t, x, y, z} to `onSample`. */
export function startMotion(onSample) {
  stopMotion();
  let last = 0;
  motionHandler = (e) => {
    const a = e.accelerationIncludingGravity;
    if (!a || a.z === null) return;
    const t = performance.now();
    if (t - last < 45) return; // ≈ 20 Hz is plenty for breathing
    last = t;
    onSample({ t, x: a.x || 0, y: a.y || 0, z: a.z || 0 });
  };
  window.addEventListener('devicemotion', motionHandler);
}

export function stopMotion() {
  if (motionHandler) window.removeEventListener('devicemotion', motionHandler);
  motionHandler = null;
}
