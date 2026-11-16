// Sanity check of the diagnostic engine against real problem → diagnosis pairs taken from teachers'
// Q&A and practitioners' accounts (kb/teacher-cases.json; sources in docs/understanding/bibliography.md).
//
// How much this shows: little. There are 19 cases, the symptom coding was done by the same author
// who wrote the engine, and it was not blind. It guards against the engine contradicting the
// sources it was built from; it is not a validation.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { diagnose } from '../src/diagnose.js';
import { SYMPTOMS, blockerById } from '../src/kb.js';

const cases = JSON.parse(readFileSync(new URL('../kb/teacher-cases.json', import.meta.url), 'utf8'));

test('teacher cases are well formed', () => {
  const ids = new Set(SYMPTOMS.map((s) => s.id));
  for (const c of cases) {
    for (const s of c.symptoms) assert.ok(ids.has(s), `${c.id}: unknown symptom ${s}`);
    for (const b of c.accept) assert.ok(blockerById(b), `${c.id}: unknown blocker ${b}`);
    assert.ok(c.source && c.problem && c.teacher);
  }
});

test('the engine agrees with the source diagnosis on covered cases', () => {
  const covered = cases.filter((c) => !c.uncovered);
  const misses = [];
  for (const c of covered) {
    const d = diagnose({ rung: c.rung, symptoms: c.symptoms, minutes: 30 });
    if (!c.accept.includes(d.primary)) misses.push(`${c.id}: expected ${c.accept.join('/')} got ${d.primary}`);
  }
  assert.deepEqual(misses, [], misses.join('\n'));
  assert.equal(cases.length - covered.length, 1, 'one known gap is documented: aversion to a specific distraction');
});
