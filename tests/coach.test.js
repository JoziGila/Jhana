import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diagnose } from '../src/diagnose.js';
import { BLOCKERS, SYMPTOMS, SEEDS, blockerById } from '../src/kb.js';
import { BASE_PLAN, applyPatch, firstPlan, nextPlan, newBandit, fitToMinutes, normalise, seedPriors } from '../src/planner.js';
import { buildScript, phaseAt, rescueLine } from '../src/script.js';
import { scoreReport, isJhana, ITEMS } from '../src/jhanaScore.js';
import { RUNGS, ladderSummary } from '../src/ladder.js';
import { ranking } from '../src/bandit.js';
import { makeRng } from '../src/rng.js';

// ---- knowledge base integrity ---------------------------------------------------------------

test('knowledge base is internally consistent', () => {
  const symptomIds = new Set(SYMPTOMS.map((s) => s.id));
  const seedIds = new Set(SEEDS.map((s) => s.id));
  assert.equal(new Set(BLOCKERS.map((b) => b.id)).size, BLOCKERS.length, 'duplicate blocker id');
  for (const b of BLOCKERS) {
    for (const sym of Object.keys(b.symptoms)) assert.ok(symptomIds.has(sym), `${b.id} uses unknown symptom ${sym}`);
    for (const r of Object.keys(b.rungPrior)) assert.ok(Number(r) >= 0 && Number(r) < RUNGS.length);
    assert.ok(b.fix.instruction.length > 40 && b.fix.cue.length > 10, `${b.id} needs a real fix`);
    assert.ok(b.loopTerm && b.oneLine && b.why);
    const seed = b.fix.planPatch.seed;
    if (seed && seed !== 'switch') assert.ok(seedIds.has(seed), `${b.id} prescribes unknown seed ${seed}`);
    for (const key of Object.keys(b.fix.planPatch)) {
      assert.ok(key in BASE_PLAN, `${b.id} patches unknown plan field ${key}`);
    }
  }
  // every symptom the user can tick must inform at least one diagnosis
  for (const s of SYMPTOMS) {
    assert.ok(BLOCKERS.some((b) => s.id in b.symptoms), `symptom ${s.id} is never used`);
  }
});

// ---- diagnosis ------------------------------------------------------------------------------

const dx = (rung, symptoms, extra = {}, history = []) => diagnose({ rung, symptoms, minutes: 25, ...extra }, history);

test('each blocker is recovered from its own signature symptoms', () => {
  for (const b of BLOCKERS) {
    const signature = Object.entries(b.symptoms).filter(([, w]) => w >= 3).map(([s]) => s);
    if (!signature.length) continue;
    // test at the rung where this blocker is most expected
    const rung = Number(Object.entries(b.rungPrior).sort((x, y) => y[1] - x[1])[0]?.[0] ?? 3);
    const d = dx(rung, signature);
    assert.equal(d.primary, b.id, `signature of ${b.id} was diagnosed as ${d.primary}`);
    assert.ok(d.evidence.length > 0);
  }
});

test('classic cases', () => {
  assert.equal(dx(4, ['vanish']).primary, 'grasping');
  assert.equal(dx(3, ['tension', 'forcing']).primary, 'striving');
  assert.equal(dx(2, ['noseed']).primary, 'no-seed');
  assert.equal(dx(1, ['sleepy']).primary, 'dull');
  assert.equal(dx(0, ['restless']).primary, 'unsettled');
  assert.equal(dx(1, ['wander']).primary, 'scattered');
  assert.equal(dx(3, ['plateau']).primary, 'plateau');
  assert.equal(dx(5, ['heart', 'fearlose']).primary, 'fear');
  assert.equal(dx(6, ['overwhelm']).primary, 'overwhelm');
  assert.equal(dx(2, ['sad']).primary, 'emotion');
  assert.equal(dx(2, ['checking', 'pressure']).primary, 'checking');
});

test('opposite problems get opposite prescriptions', () => {
  const striving = dx(3, ['tension', 'forcing']).blocker.fix.planPatch;
  const scattered = dx(1, ['wander']).blocker.fix.planPatch;
  assert.equal(striving.effort, 'feather');
  assert.ok(scattered.gatherMin.startsWith('+'));
  assert.notEqual(dx(1, ['sleepy']).blocker.fix.planPatch.eyes, dx(0, ['restless']).blocker.fix.planPatch.eyes);
});

test('no symptoms: stage decides (dose → stabilise → deepen)', () => {
  assert.equal(dx(2, []).primary, 'dose');
  assert.equal(dx(2, [], { minutes: 10 }).primary, 'dose');
  assert.equal(dx(5, []).primary, 'stabilise');
  assert.equal(dx(6, []).primary, 'stabilise');
  assert.equal(dx(7, []).primary, 'deepen');
});

test('a reported difficulty outranks "not enough time", even for a very short sit', () => {
  const d = dx(1, ['sleepy'], { minutes: 1 });
  assert.equal(d.primary, 'dull');
  assert.equal(d.secondary, 'dose');
  assert.equal(dx(1, [], { minutes: 1 }).primary, 'dose');
});

test('a fix tried twice without progress gives way to the runner-up', () => {
  const hist = [
    { rung: 3, diagnosis: { primary: 'striving' } },
    { rung: 3, diagnosis: { primary: 'striving' } },
  ];
  const fresh = dx(3, ['tension', 'forcing', 'plateau']);
  const stuck = dx(3, ['tension', 'forcing', 'plateau'], {}, hist);
  assert.equal(fresh.primary, 'striving');
  assert.equal(stuck.primary, 'plateau');
  assert.equal(stuck.repeated, 2);
  // but progress on the ladder means the fix is working, so keep it
  const improving = dx(4, ['tension', 'forcing'], {}, hist);
  assert.equal(improving.primary, 'striving');
});

test('diagnosis is total: any combination of inputs yields a known blocker', () => {
  const rng = makeRng(11);
  for (let i = 0; i < 500; i++) {
    const symptoms = SYMPTOMS.filter(() => rng() < 0.2).map((s) => s.id);
    const d = dx(rng.int(8), symptoms, { minutes: 5 + rng.int(50) });
    assert.ok(blockerById(d.primary), `unknown blocker ${d.primary}`);
    assert.ok(d.confidence > 0 && d.confidence <= 1);
  }
});

// ---- planner --------------------------------------------------------------------------------

test('applyPatch handles relative, absolute and bounded values', () => {
  const p = applyPatch(BASE_PLAN, { settleMin: '+3', effort: 'feather', totalMin: '+100', relaxCues: '-5' });
  assert.equal(p.settleMin, BASE_PLAN.settleMin + 3);
  assert.equal(p.effort, 'feather');
  assert.equal(p.totalMin, 60);
  assert.equal(p.relaxCues, 0);
  assert.equal(BASE_PLAN.settleMin, 4, 'base plan must not be mutated');
});

test('first plan reflects the onboarding profile', () => {
  const striver = firstPlan({ striver: 3 });
  assert.equal(striver.effort, 'feather');
  const sleepy = firstPlan({ sleepy: 3 });
  assert.equal(sleepy.eyes, 'soft-open');
  const controller = firstPlan({ breathctl: 3 });
  assert.equal(controller.anchor, 'hands');
  const chills = firstPlan({ chills: 3, warm: 0, imagery: 0, body: 0, breathcalm: 0 });
  assert.equal(firstPlan({}).seed, 'warmth', 'with no information, start with the most widely taught spark');
  assert.equal(chills.seed, 'chills');
  assert.equal(ranking(newBandit({ warm: 3, chills: 0 }))[0].id, 'warmth');
  assert.ok(seedPriors({ warm: 3 }).warmth.alpha > seedPriors({ warm: 0 }).warmth.alpha);
});

test('nextPlan applies the diagnosis, keeps sticky changes and resets one-shot ones', () => {
  const rng = makeRng(3);
  const p0 = firstPlan({});
  const d1 = dx(3, ['tension', 'forcing']);
  const { plan: p1, changes } = nextPlan({ lastPlan: p0, diagnosis: d1, rng });
  assert.equal(p1.effort, 'feather');
  assert.equal(p1.focus, 'striving');
  assert.ok(p1.coachCue.length > 0);
  assert.ok(changes.length > 0);
  const d2 = dx(3, ['plateau']);
  const { plan: p2 } = nextPlan({ lastPlan: p1, diagnosis: d2, rng });
  assert.equal(p2.savor, true);
  assert.equal(p2.focus, 'plateau');
  const d3 = dx(1, ['wander']);
  const { plan: p3 } = nextPlan({ lastPlan: p2, diagnosis: d3, rng });
  assert.equal(p3.savor, false, 'one-shot emphasis should not persist');
  assert.equal(p3.relaxCues, p1.relaxCues, 'sticky change persists');
});

test('a "switch seed" prescription never returns the seed that just failed', () => {
  const d = dx(2, ['noseed']);
  for (let seed = 1; seed <= 40; seed++) {
    const rng = makeRng(seed);
    const last = { ...firstPlan({}), seed: 'smile' };
    const { plan } = nextPlan({ lastPlan: last, diagnosis: d, rng });
    assert.notEqual(plan.seed, 'smile');
  }
});

test('preflight state adjusts today\'s plan', () => {
  const rng = makeRng(2);
  const base = firstPlan({});
  const tired = nextPlan({ lastPlan: base, preflight: { energy: 0 }, rng }).plan;
  assert.equal(tired.eyes, 'soft-open');
  assert.equal(tired.pacer, false);
  const keyed = nextPlan({ lastPlan: base, preflight: { agitation: 3 }, rng }).plan;
  assert.ok(keyed.settleMin > base.settleMin);
  const low = nextPlan({ lastPlan: base, preflight: { mood: 0 }, rng }).plan;
  assert.equal(low.framing, 'no-goal');
  assert.equal(low.seed, 'comfort');
  const short = nextPlan({ lastPlan: base, preflight: { minutes: 15 }, rng }).plan;
  assert.ok(short.totalMin <= 15 + 9);
  assert.ok(short.totalMin - (short.settleMin + short.gatherMin + short.kindleMin) >= 5, 'still leaves time to rest');
});

test('plans are always feasible', () => {
  const rng = makeRng(8);
  let plan = firstPlan({});
  const history = [];
  for (let i = 0; i < 200; i++) {
    const symptoms = SYMPTOMS.filter(() => rng() < 0.15).map((s) => s.id);
    const report = { rung: rng.int(8), symptoms, minutes: plan.totalMin };
    const d = diagnose(report, history);
    history.push({ rung: report.rung, diagnosis: d });
    plan = nextPlan({ lastPlan: plan, diagnosis: d, rng, preflight: rng() < 0.3 ? { minutes: 10 + rng.int(40) } : null }).plan;
    assert.ok(plan.totalMin >= 12 && plan.totalMin <= 60);
    assert.ok(plan.totalMin - (plan.settleMin + plan.gatherMin + plan.kindleMin) >= 5, JSON.stringify(plan));
    assert.ok(SEEDS.some((s) => s.id === plan.seed));
    const script = buildScript(plan);
    assert.ok(script.cues.length >= 8);
  }
  assert.deepEqual(normalise(fitToMinutes(BASE_PLAN, 12)).totalMin >= 12, true);
});

// ---- script ---------------------------------------------------------------------------------

test('script is ordered, inside the sit, and front-loaded', () => {
  const plan = firstPlan({});
  const s = buildScript(plan);
  assert.equal(s.totalSeconds, plan.totalMin * 60);
  for (let i = 1; i < s.cues.length; i++) assert.ok(s.cues[i].at >= s.cues[i - 1].at);
  assert.ok(s.cues.every((c) => c.at >= 0 && c.at < s.totalSeconds));
  // cues never overlap: at ~2.5 words/second a line must finish before the next starts
  for (let i = 1; i < s.cues.length; i++) {
    const words = s.cues[i - 1].text.split(/\s+/).length;
    assert.ok(s.cues[i].at - s.cues[i - 1].at >= words / 2.6, `cue ${s.cues[i - 1].id} overlaps the next`);
  }
  const rest = s.phases.find((p) => p.id === 'rest');
  const restCues = s.cues.filter((c) => c.phase === 'rest');
  const early = restCues.filter((c) => c.at < rest.start + 240).length;
  assert.ok(early >= restCues.length * 0.6, 'most rest-phase talk happens in its first four minutes');
  assert.equal(phaseAt(s, 0).id, 'arrive');
  assert.equal(phaseAt(s, s.totalSeconds - 1).id, 'exit');
});

test('the onset instruction is spoken before the rest phase goes quiet', () => {
  const s = buildScript({ ...firstPlan({}), inoculate: true });
  const cue = s.cues.find((c) => c.id === 'inoculate');
  const quiet = s.cues.find((c) => c.id === 'quiet-now');
  assert.ok(cue && quiet && cue.at < quiet.at);
  assert.match(cue.text, /do nothing/i);
});

test('plan options change what is said', () => {
  const base = firstPlan({});
  const text = (plan) => buildScript(plan).cues.map((c) => c.text).join(' ');
  assert.match(text({ ...base, anchor: 'hands' }), /hands/);
  assert.match(text({ ...base, framing: 'no-goal' }), /no goal/i);
  assert.match(text({ ...base, effort: 'feather' }), /very little effort/i);
  assert.match(text({ ...base, anchorHelp: 'count', anchor: 'breath' }), /count/i);
  assert.match(text({ ...base, deepen: true, totalMin: 45 }), /quieter happiness/i);
  assert.ok(buildScript({ ...base, guidance: 'sparse' }).cues.length < buildScript(base).cues.length);
  for (const seed of SEEDS) assert.ok(text({ ...base, seed: seed.id }).includes(seed.how.slice(0, 30)));
  assert.equal(rescueLine('rest', { coachCue: 'CUE' }, 0), 'CUE');
  assert.notEqual(rescueLine('rest', {}, 0), rescueLine('rest', {}, 1));
});

// ---- jhana score ----------------------------------------------------------------------------

const answers = (o) => Object.fromEntries(ITEMS.map((i) => [i.id, o[i.id] ?? 0]));

test('a full first-jhana report is classed as jhana', () => {
  const r = scoreReport(answers({ shift: 3, pleasure: 3, pervade: 2, selfsustain: 3, absorb: 2, clear: 3, energy: 2, afterglow: 2 }), 'minutes');
  assert.equal(r.label, 'j1');
  assert.equal(isJhana(r), true);
  assert.ok(r.score >= 70);
  assert.equal(r.confidence, 'high');
});

test('relaxation, dullness and held-in-place pleasure are NOT classed as jhana', () => {
  const relax = scoreReport(answers({ pleasure: 1, clear: 1, afterglow: 2 }), 'long');
  assert.equal(relax.label, 'relaxation');
  const dull = scoreReport(answers({ pleasure: 2, drowsy: 3, clear: 0, absorb: 2, selfsustain: 2 }), 'long');
  assert.equal(dull.label, 'dull');
  const held = scoreReport(answers({ pleasure: 3, selfsustain: 1, strain: 3, absorb: 2, clear: 3 }), 'minutes');
  assert.equal(held.label, 'piti');
  const thinking = scoreReport(answers({ pleasure: 3, selfsustain: 2, absorb: 0, drift: 3, clear: 2 }), 'minutes');
  assert.equal(thinking.label, 'piti');
  for (const r of [relax, dull, held, thinking]) assert.equal(isJhana(r), false);
  assert.ok(relax.score < 40 && dull.score < 40);
});

test('a brief take-off is a glimpse, not jhana', () => {
  const r = scoreReport(answers({ shift: 3, pleasure: 3, selfsustain: 2, absorb: 2, clear: 2 }), 'seconds');
  assert.equal(r.label, 'glimpse');
  assert.equal(isJhana(r), false);
});

test('later jhanas are distinguished by what has settled', () => {
  const j2 = scoreReport(answers({ shift: 2, pleasure: 2, selfsustain: 3, absorb: 3, clear: 3, calmer: 3 }), 'long');
  assert.equal(j2.label, 'j2');
  const j4 = scoreReport(answers({ pleasure: 0, selfsustain: 3, absorb: 3, clear: 3, still: 3 }), 'long');
  assert.equal(j4.label, 'j4');
});

test('endorsing foils or everything lowers confidence so it does not count', () => {
  const full = { shift: 3, pleasure: 3, pervade: 3, selfsustain: 3, absorb: 3, clear: 3, afterglow: 3 };
  const biased = scoreReport(answers({ ...full, foil_taste: 2, foil_hearing: 2 }), 'minutes');
  assert.ok(biased.flags.includes('response-bias'));
  assert.equal(biased.confidence, 'low');
  assert.equal(isJhana(biased), false);
  const everything = scoreReport(Object.fromEntries(ITEMS.map((i) => [i.id, 3])), 'long');
  assert.ok(everything.flags.includes('uniform-answers'));
  assert.equal(isJhana(everything), false);
});

test('score is monotone in the core items', () => {
  const base = { shift: 1, pleasure: 1, selfsustain: 1, absorb: 1, clear: 1 };
  let prev = scoreReport(answers(base), 'minutes').score;
  for (const id of ['pleasure', 'selfsustain', 'absorb', 'clear']) {
    base[id] = 3;
    const s = scoreReport(answers(base), 'minutes').score;
    assert.ok(s >= prev, `${id} raised should not lower the score`);
    prev = s;
  }
  assert.ok(scoreReport(answers(base), 'long').score >= scoreReport(answers(base), 'seconds').score);
});

test('ladder summary', () => {
  const s = ladderSummary([{ rung: 1 }, { rung: 2 }, { rung: 2 }, { rung: 3 }, { rung: 4 }, { rung: 5 }]);
  assert.equal(s.best, 5);
  assert.ok(s.trend > 0);
  assert.equal(ladderSummary([]).best, null);
});
