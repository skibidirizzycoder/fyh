// view.ts — draws the flip phone on screen. Owner: Teammate A.
// PLACEHOLDER: a plain box with a list. Replace it with a real 2004 flip phone
// (shell, hinge, keypad, green pixel screen, flip animation). See docs/PLAN.md.
// It gets a PhoneState every frame and must make the page match it.

import './phone.css';
import type { PhoneState } from './state.ts';

export interface PhoneView {
  render(phone: PhoneState): void;
}

/** Creates the phone's HTML inside `root`. The root element must have id="phone". */
export function createPhoneView(root: HTMLElement): PhoneView {
  const el = document.createElement('div');
  el.id = 'phone';
  el.hidden = true;
  root.appendChild(el);
  let last = '';

  return {
    render(phone) {
      el.hidden = !phone.open;
      const rows = phone.items.map((item, i) => {
        const mark = i === phone.index ? '>' : ' ';
        return `${mark} ${item.date}: ${item.label}${item.fixed ? ' *' : ''}`;
      });
      const text = ['PLACEHOLDER PHONE', ...rows].join('\n');
      if (text !== last) el.textContent = text; // only touch the page when it changed
      last = text;
    },
  };
}
