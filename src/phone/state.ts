// state.ts — the flip phone's logic: open/close, moving through the menu, choosing.
// Pure functions, no DOM. Owner: Claude. The look is in view.ts (Teammate A).
// Keys while open: Up/Down (W/S or arrows) move, E/Enter choose, Q closes.
//
// The phone is your progress list and your way home. The way IN to a 2004 moment is the
// CD player outside the shop (game.ts): a moment you haven't been to yet is `locked` on the
// phone (still listed, so you see what's left), and Up/Down skip locked rows.
// Row order: in 2004, "Back to today" first; then the moments you can go to; then the locked ones.
// Today, "Back to today" comes last and is locked (you're already here).

import type { LoadedCd } from '../story/types.ts';

export const TODAY = 'present'; // the menu target that travels back to today

export interface PhoneItem {
  target: string; // a moment id, or TODAY
  date: string; // e.g. "2 July 2004", or "Today"
  label: string; // e.g. "The Static", or "Back to today"
  fixed: boolean; // this CD is already fixed (show a star)
  locked: boolean; // can't be chosen: a moment not visited yet (it needs the CD player), or today when you're today
}

export interface PhoneState {
  open: boolean;
  index: number; // selected row
  items: PhoneItem[];
  here: string; // where you are now: a moment id or TODAY
}

export interface PhoneKeys {
  toggle: boolean; // Q
  up: boolean;
  down: boolean;
  select: boolean;
}

export type PhoneCommand =
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'move'; index: number }
  | { type: 'select'; target: string }
  | { type: 'locked'; target: string } // chose a locked row (only happens when no row can be chosen)
  | null;

/**
 * The menu rows: one per CD moment, plus "Back to today" (order: see the top of this file).
 * `visited` = moments you have been to; `here` = where you are now (TODAY or a moment id).
 */
export function phoneItems(cds: readonly LoadedCd[], fixed: readonly string[], visited: readonly string[] = [], here: string = TODAY): PhoneItem[] {
  const moments = cds.map((c) => {
    const isFixed = fixed.includes(c.id);
    return { target: c.moment, date: c.date, label: c.artist, fixed: isFixed, locked: !isFixed && !visited.includes(c.moment) };
  });
  const canGo = moments.filter((m) => !m.locked);
  const locked = moments.filter((m) => m.locked);
  const today: PhoneItem = { target: TODAY, date: 'Today', label: 'Back to today', fixed: false, locked: here === TODAY };
  return here === TODAY ? [...canGo, ...locked, today] : [today, ...canGo, ...locked];
}

/** A closed phone. */
export function closedPhone(items: PhoneItem[], here: string): PhoneState {
  return { open: false, index: firstChoice(items), items, here };
}

/** The first row that can be chosen (0 if none can). */
export function firstChoice(items: readonly PhoneItem[]): number {
  return Math.max(0, items.findIndex((i) => !i.locked));
}

/** The next row that can be chosen going down (step 1) or up (step -1), wrapping round; `from` if there is none. */
export function nextChoice(items: readonly PhoneItem[], from: number, step: 1 | -1): number {
  const n = items.length;
  for (let k = 1; k < n; k++) {
    const i = (((from + step * k) % n) + n) % n;
    if (!items[i]?.locked) return i;
  }
  return from;
}

/** Advances the phone by one fixed step. Returns the new state and what happened. */
export function stepPhone(phone: PhoneState, keys: PhoneKeys): { phone: PhoneState; command: PhoneCommand } {
  if (keys.toggle) {
    return phone.open
      ? { phone: { ...phone, open: false }, command: { type: 'close' } }
      : { phone: { ...phone, open: true, index: firstChoice(phone.items) }, command: { type: 'open' } };
  }
  if (!phone.open) return { phone, command: null };
  if (keys.up || keys.down) {
    const index = nextChoice(phone.items, phone.index, keys.up ? -1 : 1);
    return { phone: { ...phone, index }, command: { type: 'move', index } };
  }
  const item = phone.items[phone.index];
  if (keys.select && item?.locked) return { phone, command: { type: 'locked', target: item.target } };
  if (keys.select && item) return { phone: { ...phone, open: false }, command: { type: 'select', target: item.target } };
  return { phone, command: null };
}
