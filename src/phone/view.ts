// view.ts — draws the flip phone on screen: a silver 2004 clamshell. Owner: Teammate A.
// It gets a PhoneState every frame and makes the page match it, touching the DOM only
// when something changed. The logic (keys, menu, travel) lives in state.ts (Claude's).
//
//   folded — the closed phone: a small outer screen with the time and date where you are
//   lid    — earpiece + pale green LCD: signal, where you are, battery, the menu, soft keys
//   hinge  — the barrel the lid flips around
//   base   — nav ring with call/end keys, then the 0-9 * # keypad
//
// Tests read `#phone[data-state]`:
//   closed → opening → open → closing → closed            (Q, Q)
//   open → connecting → static → closing → closed         (choosing a moment: you travel)
// "connecting" shows the destination with the signal bars filling (T.phone.connectSec), "static"
// a burst of noise (T.phone.staticSec). The game has already arrived; this is the phone catching up.

import './phone.css';
import { T } from '../tuning.ts';
import { TODAY, type PhoneItem, type PhoneState } from './state.ts';

export interface PhoneView {
  render(phone: PhoneState): void;
}

type Visual = 'closed' | 'opening' | 'open' | 'connecting' | 'static' | 'closing';

/** How long each animated look lasts before the next one, and what comes next. */
const NEXT: Partial<Record<Visual, { sec: number; to: Visual }>> = {
  opening: { sec: T.phone.flipSec, to: 'open' },
  connecting: { sec: T.phone.connectSec, to: 'static' },
  static: { sec: T.phone.staticSec, to: 'closing' },
  closing: { sec: T.phone.flipSec, to: 'closed' },
};
const CONNECT_BARS = 5;

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

/** "14 March 2004" -> "14 Mar 2004" (fits the small outer screen). */
export function shortDate(date: string): string {
  return date.replace(/\b([A-Z][a-z]{2})[a-z]+\b/, '$1');
}

/** Time and date on the outer screen: a live clock today, the moment's own time in 2004. */
export function outerScreenText(here: string, items: readonly PhoneItem[], now: Date): { time: string; date: string } {
  if (here === TODAY) {
    const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const date = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return { time, date };
  }
  return { time: T.phone.momentTimes[here] ?? '', date: shortDate(items.find((i) => i.target === here)?.date ?? '') };
}

/** Copies the phone's colours and sizes from tuning.ts into CSS variables. */
function setCssVars(el: HTMLElement): void {
  const p = T.phone;
  const vars: Record<string, string> = {
    '--phone-flip': `${p.flipSec}s`,
    '--phone-connect': `${p.connectSec}s`,
    '--phone-blink': `${p.blinkSec}s`,
    '--phone-width': `${p.widthPx}px`,
    '--phone-right': `${p.rightPx}px`,
    '--phone-bottom': `${p.bottomPx}px`,
    '--phone-folded-width': `${p.foldedWidthPx}px`,
    '--phone-folded-bottom': `${p.foldedBottomPx}px`,
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
    '--phone-outer': p.outerScreen,
    '--phone-outer-text': p.outerText,
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

/** The travel screens drawn over the LCD: "Connecting..." with filling bars, then static. */
function travelScreens(): { connect: HTMLElement; to: HTMLElement; noise: HTMLElement } {
  const connect = make('div', 'phone-connect');
  const to = make('p', 'phone-connect-to');
  const bars = make('div', 'phone-connect-bars');
  for (let i = 0; i < CONNECT_BARS; i++) {
    const bar = make('i', '');
    bar.style.height = `${(i + 1) * 6}px`;
    bar.style.animationDelay = `${(T.phone.connectSec * i) / (CONNECT_BARS + 1)}s`; // one bar after another
    bars.appendChild(bar);
  }
  connect.append(make('p', 'phone-connect-text', 'Connecting...'), to, bars);
  return { connect, to, noise: make('div', 'phone-static') };
}

/** The closed phone: camera dot, outer screen (time + date), and how to open it. */
function foldedPhone(): { folded: HTMLElement; time: HTMLElement; date: HTMLElement } {
  const folded = make('div', 'phone-folded');
  const outer = make('div', 'phone-outer');
  const time = make('span', 'phone-outer-time');
  const date = make('span', 'phone-outer-date');
  outer.append(time, date);
  folded.append(make('i', 'phone-folded-camera'), outer, make('span', 'phone-folded-hint', 'Q: open'));
  return { folded, time, date };
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
  const travel = travelScreens();
  lcd.append(status.bar, make('div', 'phone-title', 'TIME TRAVEL'), menu, soft, travel.connect, travel.noise);
  lid.append(make('div', 'phone-earpiece'), lcd);
  const keys = keypad();
  phone.append(lid, make('div', 'phone-hinge'), keys.base);
  const folded = foldedPhone();
  el.append(phone, folded.folded);
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
  let lastHere: string | null = null;
  let outerKey = '';

  /** Switches the phone's look, and schedules the next look when this one is animated. */
  function setVisual(next: Visual): void {
    visual = next;
    el.dataset.state = next;
    clearTimeout(timer);
    const after = NEXT[next];
    if (after) timer = setTimeout(() => setVisual(after.to), after.sec * 1000);
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
      const isOpen = visual === 'opening' || visual === 'open';
      const travelled = lastHere !== null && state.here !== lastHere;
      lastHere = state.here;
      if (state.open && !isOpen) setVisual('opening');
      else if (!state.open && isOpen) setVisual(travelled ? 'connecting' : 'closing');
      if (travelled) travel.to.textContent = state.items.find((i) => i.target === state.here)?.date ?? '';

      // Rows: rebuilt only when the items or where you are change.
      const key = JSON.stringify([state.items, state.here]);
      if (key !== rowsKey) {
        rowsKey = key;
        menu.replaceChildren(...state.items.map((item) => menuRow(item, item.target === state.here)));
        index = -1;
      }
      if (state.index !== index) {
        if (index >= 0 && isOpen && state.open) flashNav(state.index === (index + 1) % state.items.length); // down wraps to the top
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
      const outer = outerScreenText(state.here, state.items, new Date());
      const outerNow = `${outer.time}|${outer.date}`;
      if (outerNow !== outerKey) {
        outerKey = outerNow;
        folded.time.textContent = outer.time;
        folded.date.textContent = outer.date;
      }
    },
  };
}
