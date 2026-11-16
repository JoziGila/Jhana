// The sit runner: plays a script against a clock and reacts to the meditator's two signals.
//
// It is deliberately free of browser APIs (the clock and the outputs are injected) so the timing
// and adaptation rules can be tested in Node.
//
// Signals during a sit (both optional, both possible with eyes closed):
//   here()   one tap:   "the pleasant feeling is clearly here"  → the guide goes quiet
//   stuck()  two taps:  "I'm lost"                              → one short pointer, then quiet
//
// Theory link: once the loop is running, more instruction is an interruption. So the single most
// important adaptive behaviour is to stop talking at the right moment.

import { buildScript, phaseAt, rescueLine } from './script.js';

const LATE_LIMIT = 25; // a cue more than this many seconds late is dropped (tab was asleep)
const KEEP_AFTER_HERE = new Set(['deepen1', 'deepen2', 'deepen3', 'exit1', 'exit2']);

/**
 * @param {object} plan
 * @param {object} io  { speak(text, cue), bell(kind), onPhase(phase), onCue(cue), onEnd(summary) }
 */
export function createSession(plan, io = {}) {
  const script = buildScript(plan);
  const fired = new Set();
  const log = { here: [], stuck: [], cues: [], phases: [] };
  let elapsed = 0;
  let phaseId = null;
  let quiet = false; // set by here(): suppress further prompts
  let hereAt = null;
  let stuckCount = 0;
  let ended = false;
  let started = false;
  let lastSpokenAt = -999;

  const say = (text, cue) => {
    lastSpokenAt = elapsed;
    io.speak?.(text, cue);
    io.onCue?.({ ...cue, text });
  };

  function tick(seconds) {
    if (ended) return;
    elapsed = seconds;
    if (!started) {
      started = true;
      io.bell?.('start');
    }
    const phase = phaseAt(script, elapsed);
    if (phase.id !== phaseId) {
      phaseId = phase.id;
      log.phases.push({ id: phaseId, at: Math.round(elapsed) });
      io.onPhase?.(phase);
    }
    script.cues.forEach((cue, i) => {
      if (fired.has(i) || elapsed < cue.at) return;
      fired.add(i);
      if (elapsed - cue.at > LATE_LIMIT && cue.phase !== 'exit') return;
      if (quiet && cue.phase === 'rest') {
        if (!KEEP_AFTER_HERE.has(cue.id)) return;
        // pointers toward deeper states only once the feeling has been steady for a while
        if (cue.id.startsWith('deepen') && elapsed - hereAt < 240) return;
      }
      if (elapsed - lastSpokenAt < 6) return; // never talk over a pointer just given
      log.cues.push({ id: cue.id, at: Math.round(elapsed) });
      say(cue.text, cue);
    });
    if (elapsed >= script.totalSeconds) end('complete');
  }

  /** One tap: the pleasant feeling is clearly here. */
  function here() {
    if (ended) return;
    log.here.push(Math.round(elapsed));
    if (!quiet) {
      quiet = true;
      hereAt = elapsed;
    }
    io.bell?.('tick');
  }

  /** Two taps: lost or stuck. Gives one pointer; lifts the silence so the script can help again. */
  function stuck() {
    if (ended) return;
    log.stuck.push(Math.round(elapsed));
    quiet = false;
    hereAt = null;
    io.bell?.('tick2');
    const text = rescueLine(phaseId ?? 'arrive', plan, stuckCount++);
    say(text, { id: 'rescue', phase: phaseId, at: Math.round(elapsed) });
  }

  function end(reason = 'stopped') {
    if (ended) return;
    ended = true;
    io.bell?.('end');
    io.onEnd?.(summary(reason));
  }

  function summary(reason = 'running') {
    const rest = script.phases.find((p) => p.id === 'rest');
    return {
      reason,
      seconds: Math.round(elapsed),
      minutes: Math.round((elapsed / 60) * 10) / 10,
      planned: plan.totalMin,
      taps: { here: [...log.here], stuck: [...log.stuck] },
      cuesSpoken: log.cues.length,
      // objective-ish process measures for the record
      firstHereAfterRest: log.here.length && rest ? Math.max(0, log.here[0] - rest.start) : null,
      secondsAfterHere: log.here.length ? Math.round(elapsed - log.here[0]) : 0,
      reachedRest: elapsed >= (rest?.start ?? Infinity),
    };
  }

  return {
    script,
    tick,
    here,
    stuck,
    end,
    summary,
    get elapsed() {
      return elapsed;
    },
    get phase() {
      return phaseId;
    },
    get quiet() {
      return quiet;
    },
    get ended() {
      return ended;
    },
  };
}
