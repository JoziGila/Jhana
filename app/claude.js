// Optional Claude features, available only when the app is opened as a published artifact by a
// viewer who has the `sample` capability. Everything here is hidden when it is not.

import { h, toast, openLayer, closeLayer } from './dom.js';
import * as platform from './platform.js';
import { coachInstructions, noteReadingPrompt } from '../src/coachPrompt.js';

/** Ask Claude to map a free-text note to a ladder rung and difficulties. Null on any failure. */
export async function readNote(note) {
  const sample = await platform.caps.sample;
  if (!sample) return null;
  try {
    const out = await sample.json(noteReadingPrompt(note), { modelTier: 'quick' });
    if (!out || typeof out !== 'object') return null;
    return { rung: Number.isInteger(out.rung) ? out.rung : null, symptoms: Array.isArray(out.symptoms) ? out.symptoms.map(String) : [] };
  } catch {
    return null;
  }
}

/** Post-sit conversation with an LLM coach. */
export async function openChat(app, sit, diagnosis) {
  const sample = await platform.caps.sample;
  if (!sample) return toast('The Claude coach is not available in this view.');

  const rules = coachInstructions(sit, diagnosis, app.state.sits.slice(0, -1));
  const turns = [];
  let busy = false;
  let ctl = null;

  const log = h('div', { class: 'chat', 'aria-live': 'polite' });
  const box = h('textarea', { id: 'chat-input', placeholder: 'Your answer…', 'aria-label': 'Your answer' });
  const send = h('button', { class: 'btn primary', type: 'button' }, 'Send');
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-label': 'Coach conversation' });
  const close = () => {
    ctl?.abort();
    closeLayer(sheet);
  };
  sheet.append(h('div', { class: 'page' },
    h('div', { class: 'row between' }, h('h2', {}, 'Talk it through'), h('button', { class: 'btn', type: 'button', onClick: close }, 'Close')),
    h('p', { class: 'muted small' }, 'Claude sees this sit’s report and your last few sits. It asks a few questions, then suggests one change. It is not a teacher or a clinician.'),
    log,
    h('div', { class: 'chatbox' }, box, send),
  ));
  openLayer(sheet);

  const bubble = (who, text) => {
    const el = h('div', { class: `bubble ${who}` }, text);
    log.append(el);
    el.scrollIntoView({ block: 'end' });
    return el;
  };

  async function ask() {
    if (busy) return;
    busy = true;
    send.disabled = true;
    const out = bubble('coach', 'Thinking…');
    ctl = new AbortController();
    try {
      const input = [{ role: 'user', content: rules }, ...turns];
      const { text } = await sample(input, { cache: false, signal: ctl.signal, onText: ({ text: t }) => { out.textContent = t; } });
      out.textContent = text;
      turns.push({ role: 'assistant', content: text });
    } catch (e) {
      out.textContent = e?.text || '';
      if (e?.code === 'not_granted') {
        out.textContent = 'The coach is switched off for this page.';
      } else if (e?.code !== 'cancelled') {
        out.textContent = (e?.text ? `${e.text}\n\n` : '') + (e?.code === 'rate_limited' ? 'Too many requests just now. Wait a moment and send again.' : 'The reply was interrupted. Send again to retry.');
      }
    }
    busy = false;
    send.disabled = false;
    box.focus();
  }

  send.addEventListener('click', () => {
    const text = box.value.trim();
    if (!text || busy) return;
    box.value = '';
    bubble('me', text);
    turns.push({ role: 'user', content: text });
    ask();
  });

  // The first turn: instructions end on a user turn, so the coach opens the conversation.
  turns.push({ role: 'user', content: 'I have just finished the sit described above.' });
  ask();
}
