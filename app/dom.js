// Tiny DOM helpers. No framework: the app is a handful of views re-rendered on state change.

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [prop, val] of Object.entries(v)) {
        if (prop.startsWith('--')) el.style.setProperty(prop, val);
        else el.style[prop] = val;
      }
    }
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'hidden' || k === 'open') el[k] = !!v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
}

export const svg = (tag, attrs = {}, ...children) => {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, String(v));
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
};

/** Append children like h() does: arrays are flattened, null and false are skipped. */
export function add(el, ...children) {
  append(el, children);
  return el;
}

/** Show a full-screen layer (sheet or stage) in place of whatever is on screen. */
export function openLayer(el) {
  document.getElementById('app').hidden = true;
  for (const other of document.querySelectorAll('.sheet')) other.hidden = true;
  document.body.append(el);
  window.scrollTo(0, 0);
}

/** Remove a layer and reveal what was underneath it. */
export function closeLayer(el) {
  el.remove();
  const sheets = document.querySelectorAll('.sheet');
  if (sheets.length) sheets[sheets.length - 1].hidden = false;
  else if (!document.querySelector('.stage')) document.getElementById('app').hidden = false;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

/** A row of mutually exclusive chips. */
export function choice(options, value, onPick, { label } = {}) {
  return h(
    'div',
    { class: 'chips', role: 'radiogroup', 'aria-label': label },
    options.map((o) =>
      h('button', { class: 'chip', type: 'button', role: 'radio', 'aria-checked': String(o.value === value), onClick: () => onPick(o.value) }, o.label),
    ),
  );
}

/** A 0..3 agreement scale. */
export function scale(value, onPick, labels = ['Not at all', 'Slightly', 'Clearly', 'Strongly'], name = '') {
  return h(
    'div',
    { class: 'scale', role: 'radiogroup', 'aria-label': name },
    labels.map((text, i) =>
      h('button', { type: 'button', role: 'radio', 'aria-checked': String(value === i), onClick: () => onPick(i) }, text),
    ),
  );
}

export function fmtClock(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtDate(ms) {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

let toastTimer = null;
export function toast(text) {
  document.querySelector('.toast')?.remove();
  const el = h('div', { class: 'toast', role: 'status' }, text);
  document.body.append(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 2800);
}
