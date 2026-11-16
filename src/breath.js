// Breathing and stillness from a phone accelerometer (phone resting on the belly or chest, or in
// a chest pocket). Pure signal processing, no browser APIs, so it can be tested in Node.
//
// Theory link: breathing slows and becomes shallow, and the body becomes very still, as the mind
// settles (docs/understanding/03-research.md). These are objective proxies for the *precondition*
// (settling), not for jhana itself. They are used to (1) time prompts without asking the user
// anything and (2) give validation studies a non-self-report covariate.
//
// STATUS: verified on synthetic signals only (tests/breath.test.js). Not yet tested on a device.

/** Linear resample of irregular samples [{t (ms), x, y, z}] to a uniform rate (Hz). */
export function resample(samples, fs = 10) {
  if (samples.length < 2) return { fs, x: [], y: [], z: [] };
  const t0 = samples[0].t;
  const t1 = samples[samples.length - 1].t;
  const n = Math.floor(((t1 - t0) / 1000) * fs) + 1;
  const out = { fs, x: new Array(n), y: new Array(n), z: new Array(n) };
  let j = 0;
  for (let i = 0; i < n; i++) {
    const t = t0 + (i * 1000) / fs;
    while (j < samples.length - 2 && samples[j + 1].t < t) j++;
    const a = samples[j];
    const b = samples[j + 1];
    const span = b.t - a.t || 1;
    const w = Math.min(1, Math.max(0, (t - a.t) / span));
    out.x[i] = a.x + (b.x - a.x) * w;
    out.y[i] = a.y + (b.y - a.y) * w;
    out.z[i] = a.z + (b.z - a.z) * w;
  }
  return out;
}

const mean = (v) => v.reduce((s, x) => s + x, 0) / (v.length || 1);

/** Centered moving average with window w samples (edges use the available samples). */
export function movingAverage(v, w) {
  const n = v.length;
  const out = new Array(n);
  const half = Math.floor(w / 2);
  const prefix = new Array(n + 1);
  prefix[0] = 0;
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + v[i];
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - half);
    const hi = Math.min(n, i + half + 1);
    out[i] = (prefix[hi] - prefix[lo]) / (hi - lo);
  }
  return out;
}

/** Band-limit to the breathing band (~0.07–0.7 Hz) by subtracting a slow trend and smoothing. */
export function breathBand(v, fs) {
  const smooth = movingAverage(v, Math.max(1, Math.round(fs * 0.7))); // low-pass ≈ 0.7 Hz
  const trend = movingAverage(smooth, Math.round(fs * 14)); // remove drift slower than ≈ 0.07 Hz
  return smooth.map((x, i) => x - trend[i]);
}

/** First principal axis of three band-limited channels (power iteration on the 3×3 covariance). */
export function principalAxis(x, y, z) {
  const n = x.length;
  const mx = mean(x);
  const my = mean(y);
  const mz = mean(z);
  let cxx = 0, cxy = 0, cxz = 0, cyy = 0, cyz = 0, czz = 0;
  for (let i = 0; i < n; i++) {
    const a = x[i] - mx;
    const b = y[i] - my;
    const c = z[i] - mz;
    cxx += a * a; cxy += a * b; cxz += a * c; cyy += b * b; cyz += b * c; czz += c * c;
  }
  let v = [1, 1, 1];
  for (let it = 0; it < 50; it++) {
    const w = [
      cxx * v[0] + cxy * v[1] + cxz * v[2],
      cxy * v[0] + cyy * v[1] + cyz * v[2],
      cxz * v[0] + cyz * v[1] + czz * v[2],
    ];
    const norm = Math.hypot(w[0], w[1], w[2]) || 1;
    v = [w[0] / norm, w[1] / norm, w[2] / norm];
  }
  return v;
}

/** Normalised autocorrelation of v at integer lag. */
function autocorr(v, lag) {
  const n = v.length - lag;
  if (n <= 1) return 0;
  let num = 0, d0 = 0, d1 = 0;
  for (let i = 0; i < n; i++) {
    num += v[i] * v[i + lag];
    d0 += v[i] * v[i];
    d1 += v[i + lag] * v[i + lag];
  }
  const den = Math.sqrt(d0 * d1);
  return den > 0 ? num / den : 0;
}

/**
 * Analyse one window of accelerometer data.
 * @param {{t:number,x:number,y:number,z:number}[]} samples  raw samples, t in ms, units m/s² (gravity included)
 * @returns {{bpm:number|null, regularity:number, amplitude:number, stillness:number, quality:'good'|'weak'|'none', seconds:number}}
 *   bpm         breaths per minute (null when no periodicity is found)
 *   regularity  0..1 height of the autocorrelation peak at the breath period
 *   amplitude   RMS of the breath-band signal along its principal axis (m/s²)
 *   stillness   0..1, 1 = no movement faster than breathing; drops with fidgeting
 */
export function analyzeWindow(samples, { fs = 10, minBpm = 3, maxBpm = 30 } = {}) {
  const r = resample(samples, fs);
  const n = r.x.length;
  const seconds = n / fs;
  if (seconds < 20) return { bpm: null, regularity: 0, amplitude: 0, stillness: 0, quality: 'none', seconds };

  const bx = breathBand(r.x, fs);
  const by = breathBand(r.y, fs);
  const bz = breathBand(r.z, fs);
  const axis = principalAxis(bx, by, bz);
  const sig = bx.map((_, i) => bx[i] * axis[0] + by[i] * axis[1] + bz[i] * axis[2]);
  const amplitude = Math.sqrt(mean(sig.map((s) => s * s)));

  // Autocorrelation peak inside the plausible breathing range.
  const minLag = Math.round((60 / maxBpm) * fs);
  const maxLag = Math.min(Math.round((60 / minBpm) * fs), Math.floor(n / 2));
  const ac = [];
  for (let lag = minLag - 1; lag <= maxLag + 1; lag++) ac.push(autocorr(sig, lag));
  const peaks = [];
  for (let i = 1; i < ac.length - 1; i++) {
    // local maxima only, so the short-lag shoulder of the autocorrelation is not picked
    if (ac[i] >= ac[i - 1] && ac[i] >= ac[i + 1]) peaks.push({ lag: minLag - 1 + i, val: ac[i] });
  }
  // A periodic signal also peaks at 2×, 3×… its period. Take the shortest lag whose peak is
  // nearly as high as the highest one, otherwise the rate is reported an octave too low.
  const top = peaks.reduce((m, p) => Math.max(m, p.val), -1);
  const first = peaks.find((p) => p.val >= 0.9 * top);
  const bestLag = first ? first.lag : 0;
  const bestVal = first ? first.val : -1;
  const regularity = Math.max(0, bestVal);
  // Smoothed sensor noise is weakly periodic too, so demand a minimum size as well as a rhythm.
  const AMP_FLOOR = 0.003; // m/s²; belly breathing tilts a phone far more than this
  const bpm = bestLag > 0 && regularity > 0.3 && amplitude > AMP_FLOOR ? 60 / (bestLag / fs) : null;

  // Stillness: energy of movement faster than breathing, relative to a fidget-sized reference.
  const fast = (v) => {
    const slow = movingAverage(v, Math.round(fs * 1.5));
    return v.map((s, i) => s - slow[i]);
  };
  const fx = fast(r.x), fy = fast(r.y), fz = fast(r.z);
  const fastRms = Math.sqrt(mean(fx.map((_, i) => fx[i] * fx[i] + fy[i] * fy[i] + fz[i] * fz[i])));
  const stillness = 1 / (1 + Math.pow(fastRms / 0.06, 2)); // 0.06 m/s² ≈ a small shift of posture

  const quality = bpm === null ? 'none' : regularity > 0.5 && amplitude > 0.002 ? 'good' : 'weak';
  return { bpm, regularity, amplitude, stillness, quality, seconds };
}

/**
 * Settling index in [0, 1] from a window and the sit's own baseline (the first minute or two).
 * High = slower, steadier breathing and a still body compared with how this sit began.
 */
export function settlingIndex(window, baseline) {
  if (!window || window.bpm === null) return window ? 0.5 * window.stillness : 0;
  const slow = baseline?.bpm ? Math.max(0, Math.min(1, (baseline.bpm - window.bpm) / (0.4 * baseline.bpm) + 0.5)) : 0.5;
  return Math.max(0, Math.min(1, 0.4 * window.stillness + 0.3 * window.regularity + 0.3 * slow));
}

/** Synthetic accelerometer generator used by tests and by the app's demo mode. LABELLED SIMULATED. */
export function synthAccel({ seconds = 60, fs = 50, bpm = 12, amp = 0.05, noise = 0.004, fidgetAt = [], rng = Math.random } = {}) {
  const out = [];
  const n = Math.round(seconds * fs);
  const gauss = () => {
    let u = 0;
    while (u === 0) u = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
  };
  for (let i = 0; i < n; i++) {
    const t = i / fs;
    const phase = 2 * Math.PI * (bpm / 60) * t;
    // belly breathing mostly moves the phone along its z axis, with a little tilt on y
    let x = noise * gauss();
    let y = 0.3 * amp * Math.sin(phase + 0.4) + noise * gauss();
    let z = 9.81 + amp * Math.sin(phase) + noise * gauss();
    for (const f of fidgetAt) {
      if (t >= f && t < f + 1.5) {
        x += 0.6 * gauss();
        y += 0.6 * gauss();
        z += 0.6 * gauss();
      }
    }
    out.push({ t: Math.round(t * 1000 + (rng() - 0.5) * 4), x, y, z });
  }
  return out;
}
