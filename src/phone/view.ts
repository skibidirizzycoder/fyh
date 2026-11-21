// view.ts — draws the flip phone on screen: a silver 2004 clamshell. Owner: Teammate A.
// It gets a PhoneState every frame and makes the page match it, touching the DOM only
// when something changed. The logic (keys, menu, travel) lives in state.ts (Claude's).
//
//   lid   — earpiece + pale green LCD: signal, where you are, battery, the menu, soft keys
//   hinge — the barrel the lid flips around
//   base  — nav ring with call/end keys, then the 0-9 * # keypad
//
// Opening plays a flip (T.phone.flipSec). When closing, the phone stays on screen until
// the flip is over, then it is really hidden (`hidden`). Tests read `data-state`:
// "opening" | "open" | "closing" | "closed".

import './phone.css';
import { T } from '../tuning.ts';
import type { PhoneItem, PhoneState } from './state.ts';

export interface PhoneView {
  render(phone: PhoneState): void;
}

type Visual = 'opening' | 'open' | 'closing' | 'closed';

const KEYS: readonly (readonly [string, string])[] = [
  ['1', ''], ['2', 'abc'], ['3', 'def'],
  ['4', 'ghi'], ['5', 'jkl'], ['6', 'mno'],
  ['7', 'pqrs'], ['8', 'tuv'], ['9', 'wxyz'],
  ['*', ''], ['0', '+'], ['#', ''],
];

/** Makes an element with a class and optional text (text only ever via textContent). */
function make(tag: string, className: string, text?: string): HTMLElement {
  const el = document.createElement(tag);
  el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

/** Copies the phone's colours and sizes from tuning.ts into CSS variables. */
function setCssVars(el: HTMLElement): void {
  const p = T.phone;
  const vars: Record<string, string> = {
    '--phone-flip': `${p.flipSec}s`,
    '--phone-width': `${p.widthPx}px`,
    '--phone-right': `${p.rightPx}px`,
    '--phone-bottom': `${p.bottomPx}px`,
    '--phone-compact-scale': String(p.compactScale),
    '--phone-shell-light': p.shellLight,
    '--phone-shell-dark': p.shellDark,
    '--phone-shell-edge': p.shellEdge,
    '--phone-hinge': p.hinge,
    '--phone-lcd': p.lcd,
    '--phone-ink': p.lcdInk,
    '--phone-key': p.keyFace,
    '--phone-key-ink': p.keyInk,
    '--phone-key-letters': p.keyLetters,
    '--phone-call': p.callKey,
    '--phone-end': p.endKey,
  };
  for (const [name, value] of Object.entries(vars)) el.style.setProperty(name, value);
}

/** The signal bars and battery: plain CSS shapes, no text. */
function statusBar(): { bar: HTMLElement; place: HTMLElement } {
  const bar = make('div', 'phone-status');
  const signal = make('span', 'phone-signal');
  signal.setAttribute('aria-label', 'signal');
  for (let i = 1; i <= 4; i++) signal.appendChild(make('i', `phone-bar phone-bar-${i}`));
  const place = make('span', 'phone-place');
  const battery = make('span', 'phone-battery');
  battery.setAttribute('aria-label', 'battery');
  battery.appendChild(make('i', 'phone-battery-level'));
  bar.append(signal, place, battery);
  return { bar, place };
}

/** The nav ring (with call and end keys either side) and the 12-key keypad. */
function keypad(): { base: HTMLElement; up: HTMLElement; down: HTMLElement } {
  const base = make('div', 'phone-base');
  const nav = make('div', 'phone-nav-row');
  const ring = make('div', 'phone-nav');
  const up = make('i', 'phone-nav-up');
  const down = make('i', 'phone-nav-down');
  ring.append(up, down, make('span', 'phone-nav-ok', 'OK'));
  nav.append(make('span', 'phone-key-call'), ring, make('span', 'phone-key-end'));
  const grid = make('div', 'phone-keys');
  for (const [digit, letters] of KEYS) {
    const key = make('span', 'phone-key');
    key.append(make('b', '', digit), make('small', '', letters));
    grid.appendChild(key);
  }
  base.append(nav, grid);
  return { base, up, down };
}

/** One menu row: artist (+ star when fixed) over the date. */
function menuRow(item: PhoneItem, here: boolean): HTMLElement {
  const row = make('li', 'phone-row');
  row.dataset.target = item.target;
  const top = make('span', 'phone-row-label', item.label);
  if (item.fixed) top.appendChild(make('span', 'phone-star', ' ★'));
  if (here) top.appendChild(make('span', 'phone-here', ' ◄'));
  row.append(top, make('span', 'phone-row-date', item.date));
  return row;
}

/** Creates the phone's HTML inside `root`. The root element has id="phone". */
export function createPhoneView(root: HTMLElement): PhoneView {
  const el = make('div', '');
  el.id = 'phone';
  el.hidden = true;
  el.dataset.state = 'closed';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Flip phone');
  setCssVars(el);

  const phone = make('div', 'phone-body');
  const lid = make('div', 'phone-lid');
  const lcd = make('div', 'phone-lcd');
  const status = statusBar();
  const menu = make('ol', 'phone-menu');
  const soft = make('div', 'phone-soft');
  soft.append(make('span', '', 'E: Go'), make('span', '', 'Q: Close'));
  lcd.append(status.bar, make('div', 'phone-title', 'TIME TRAVEL'), menu, soft);
  lid.append(make('div', 'phone-earpiece'), lcd);
  const keys = keypad();
  phone.append(lid, make('div', 'phone-hinge'), keys.base);
  el.appendChild(phone);
  root.appendChild(el);

  // Short windows get a smaller phone, so it never covers the middle of the screen.
  const compact = window.matchMedia(`(max-height: ${T.phone.compactBelowPx - 1}px)`);
  const fit = (): void => { el.classList.toggle('is-compact', compact.matches); };
  compact.addEventListener('change', fit);
  fit();

  let visual: Visual = 'closed';
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rowsKey = '';
  let index = -1;
  let place = '';

  /** Switches the open/close look, and really hides the phone once the closing flip is over. */
  function setVisual(next: Visual): void {
    visual = next;
    el.dataset.state = next;
    clearTimeout(timer);
    if (next === 'opening') {
      el.hidden = false;
      timer = setTimeout(() => setVisual('open'), T.phone.flipSec * 1000);
    } else if (next === 'closing') {
      timer = setTimeout(() => setVisual('closed'), T.phone.flipSec * 1000);
    } else if (next === 'closed') {
      el.hidden = true;
    }
  }

  /** Briefly presses the nav ring up or down, like a real keypad click. */
  function flashNav(down: boolean): void {
    const key = down ? keys.down : keys.up;
    key.classList.remove('is-pressed');
    void key.offsetWidth; // restart the CSS animation
    key.classList.add('is-pressed');
    setTimeout(() => key.classList.remove('is-pressed'), T.phone.keyFlashSec * 1000);
  }

  return {
    render(state) {
      const wantOpen = state.open;
      const isOpen = visual === 'opening' || visual === 'open';
      if (wantOpen && !isOpen) setVisual('opening');
      if (!wantOpen && isOpen) setVisual('closing');

      // Rows: rebuilt only when the items or where you are change.
      const key = JSON.stringify([state.items, state.here]);
      if (key !== rowsKey) {
        rowsKey = key;
        menu.replaceChildren(...state.items.map((item) => menuRow(item, item.target === state.here)));
        index = -1;
      }
      if (state.index !== index) {
        if (index >= 0 && isOpen && wantOpen) flashNav(state.index === (index + 1) % state.items.length); // down wraps to the top
        index = state.index;
        Array.from(menu.children).forEach((row, i) => {
          row.classList.toggle('is-selected', i === index);
          row.setAttribute('aria-selected', String(i === index));
        });
      }

      const here = state.items.find((i) => i.target === state.here)?.date ?? '';
      if (here !== place) {
        place = here;
        status.place.textContent = here;
      }
    },
  };
}
