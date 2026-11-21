// area.ts — area titles like Messenger's: when you walk into a part of the street (or arrive somewhere),
// its name pops in letter by letter, holds, then shrinks away (timings in T.screens.areaTitle).
// It sits in the upper middle of the screen, clear of the dialogue at the bottom.

import './area.css';
import { T } from '../tuning.ts';

const A = T.screens.areaTitle;

/** Seconds after the start at which each letter pops in (spread over A.inSec). */
export function letterDelays(title: string): number[] {
  const n = title.length;
  return Array.from({ length: n }, (_, i) => (n > 1 ? (i * (A.inSec - A.popSec)) / (n - 1) : 0)); // the last one lands at inSec
}

interface AreaEvents {
  on(name: 'area', fn: (e: { id: string; title: string }) => void): unknown;
}

/** Shows each new area's title. */
export function createAreaTitle(root: HTMLElement, events: AreaEvents): void {
  const el = document.createElement('div');
  el.id = 'area-title';
  el.hidden = true;
  el.setAttribute('aria-live', 'polite');
  el.style.setProperty('--area-ink', A.ink);
  el.style.setProperty('--area-outline', A.outline);
  el.style.setProperty('--area-top', `${A.topPct}%`);
  el.style.setProperty('--area-size', `${A.sizePx}px`);
  el.style.setProperty('--area-pop', `${A.popSec}s`);
  el.style.setProperty('--area-out', `${A.outSec}s`);
  root.appendChild(el);
  const timers: ReturnType<typeof setTimeout>[] = [];

  events.on('area', ({ title }) => {
    timers.splice(0).forEach(clearTimeout);
    const delays = letterDelays(title);
    el.replaceChildren(...[...title].map((ch, i) => {
      const span = document.createElement('span');
      span.className = ch === ' ' ? 'area-letter is-space' : 'area-letter';
      span.textContent = ch;
      span.style.animationDelay = `${delays[i] ?? 0}s`;
      return span;
    }));
    el.setAttribute('aria-label', title);
    el.classList.remove('is-out');
    el.hidden = false;
    timers.push(setTimeout(() => el.classList.add('is-out'), (A.inSec + A.holdSec) * 1000));
    timers.push(setTimeout(() => { el.hidden = true; }, (A.inSec + A.holdSec + A.outSec) * 1000));
  });
}
