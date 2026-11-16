// Prompts for the optional LLM coach. Pure string builders so they can be tested and so the same
// prompts can be evaluated offline against real teacher Q&A (see eval/).
//
// Role of the LLM (docs/exploration.md, approach A5): the post-sit interview. A rule engine can
// map ticked symptoms to a blocker; what it cannot do is ask the one follow-up question that
// separates "I tried too hard" from "I got excited when it started". That is what a human jhana
// coach spends most of an interview doing.

import { BLOCKERS, SYMPTOMS, seedById } from './kb.js';
import { RUNGS } from './ladder.js';

export const THEORY_BRIEF = `Working theory used by this app:
- First jhana is the ignition of a feedback loop: relaxed, steady attention on a pleasant bodily feeling makes the feeling grow, and the growing feeling holds attention.
- It ignites when (attention on the feeling × bodily ease × sensitivity) outweighs (natural fading + grasping).
- The usual breakers: straining, grabbing at the feeling or getting excited when it starts, checking whether it is working, drowsiness, fear at the threshold, having no pleasant feeling to start from.
- Effort should fall as the feeling grows. The single most useful instruction is to do nothing when it starts.
- Jhana is bright and awake, self-sustaining, absorbed and pleasant, and lasts. Pleasant drowsiness and pleasure held in place by effort are not jhana.`;

function blockerList() {
  return BLOCKERS.map((b) => `- ${b.id}: ${b.name}. ${b.oneLine} Fix: ${b.fix.instruction}`).join('\n');
}

function sitSummary(sit) {
  const symptoms = sit.symptoms.map((id) => SYMPTOMS.find((s) => s.id === id)?.text ?? id);
  return [
    `Length: ${sit.minutes} minutes. Spark used: ${seedById(sit.plan.seed)?.name ?? sit.plan.seed}. Effort cue: ${sit.plan.effort}.`,
    `Furthest rung: ${sit.rung} (${RUNGS[sit.rung].name}).`,
    `Ticked difficulties: ${symptoms.length ? symptoms.join('; ') : 'none'}.`,
    `App's reading: ${sit.score.labelText} (confidence ${sit.score.confidence}).`,
    `Taps during the sit: "feeling is here" ${sit.taps?.here?.length ?? 0} time(s), "stuck" ${sit.taps?.stuck?.length ?? 0} time(s).`,
    sit.note ? `Their own words: "${sit.note.slice(0, 1200)}"` : 'They wrote no free description.',
  ].join('\n');
}

/** Standing instructions for the post-sit conversation (sent as the leading user turn). */
export function coachInstructions(sit, diagnosis, history = []) {
  const past = history.slice(-5).map((s, i) => `  ${i + 1}. rung ${s.rung} (${RUNGS[s.rung].name}); coach focus: ${s.diagnosis.primary}`).join('\n');
  return `You are a meditation coach helping a beginner learn the first jhana with a gentle, pleasure-based method (in the style taught by Leigh Brasington, Rob Burbea and Jhourney). You are talking with them just after a sit.

${THEORY_BRIEF}

Patterns you can diagnose, with their fixes:
${blockerList()}

This sit:
${sitSummary(sit)}
The app's rule-based diagnosis: ${diagnosis.primary}${diagnosis.secondary ? ` (runner-up: ${diagnosis.secondary})` : ''}.
${past ? `Earlier sits, oldest first:\n${past}` : 'This was one of their first sits.'}

How to coach:
- Ask ONE short question at a time about what actually happened: what they were doing just before anything changed, what they did the moment it changed, where in the body, how much effort. Prefer concrete moments over general impressions.
- After at most three questions, give your reading: the single most likely thing to change, and exactly what to do differently next sit, in two or three sentences.
- You may disagree with the app's diagnosis if their answers point elsewhere. Say so plainly.
- Do not tell them they reached jhana unless their description clearly shows strong pleasure that ran by itself, with a quiet, bright mind, for a minute or more. If it is unclear, say it is unclear and what would settle it.
- Never raise the stakes. No talk of attainments or of falling behind. Wanting it badly is one of the things that blocks it.
- If they describe distress, panic, lasting agitation, insomnia, or destabilisation, stop coaching toward jhana, suggest they pause the practice, and suggest speaking to a clinician or an experienced teacher. You are not a therapist and do not give medical advice.
- Plain, warm, brief. Under 110 words per reply. No lists, no headings.

Begin by reflecting in one sentence what you understood, then ask your first question.`;
}

/** Ask for a structured reading of a free-text note (used to pre-fill the debrief). */
export function noteReadingPrompt(note) {
  const rungs = RUNGS.map((r) => `${r.rung}: ${r.name}. ${r.ask}`).join('\n');
  const symptoms = SYMPTOMS.map((s) => `${s.id}: ${s.text}`).join('\n');
  return `A beginner has just finished a meditation aimed at the first jhana and wrote this description:

"""${note.slice(0, 2000)}"""

Map it onto the two lists below. Be conservative: choose only what the description clearly supports, and do not credit a higher rung than the words justify.

Rungs (pick the single furthest one clearly reached):
${rungs}

Difficulties (pick any that clearly apply, possibly none):
${symptoms}

Reply with only a JSON object of the form {"rung": 3, "symptoms": ["tension", "vanish"]}.`;
}

/**
 * A blind diagnosis prompt: a student's problem in their own words, to be classified into one of
 * the app's blocker categories. Used by the offline evaluation against teacher answers.
 */
export function blindDiagnosisPrompt(problemText) {
  const cats = BLOCKERS.map((b) => `${b.id}: ${b.name}. ${b.oneLine}`).join('\n');
  return `A meditation student practising toward the first jhana describes a problem:

"""${problemText}"""

Classify the most likely underlying cause into exactly one of these categories:
${cats}

Reply with only a JSON object: {"category": "<id>", "second": "<id or null>", "why": "<one sentence>"}.`;
}
