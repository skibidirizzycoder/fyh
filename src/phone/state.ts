// state.ts — the flip phone's logic: open/close, moving through the menu, choosing.
// Pure functions, no DOM. Owner: Claude. The look is in view.ts (Teammate A).
// Keys while open: Up/Down (W/S or arrows) move, E/Enter choose, Q closes.

import type { LoadedCd } from '../story/types.ts';

export const TODAY = 'present'; // the menu target that travels back to today

export interface PhoneItem {
  target: string; // a moment id, or TODAY
  date: string; // e.g. "2 July 2004", or "Today"
  label: string; // e.g. "The Static", or "Back to today"
  fixed: boolean; // this CD is already fixed (show a star)
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
  | null;

/** The menu rows: one per CD moment, then "Back to today". */
export function phoneItems(cds: readonly LoadedCd[], fixed: readonly string[]): PhoneItem[] {
  return [
    ...cds.map((c) => ({ target: c.moment, date: c.date, label: c.artist, fixed: fixed.includes(c.id) })),
    { target: TODAY, date: 'Today', label: 'Back to today', fixed: false },
  ];
}

/** A closed phone. */
export function closedPhone(items: PhoneItem[], here: string): PhoneState {
  return { open: false, index: 0, items, here };
}

/** Advances the phone by one fixed step. Returns the new state and what happened. */
export function stepPhone(phone: PhoneState, keys: PhoneKeys): { phone: PhoneState; command: PhoneCommand } {
  if (keys.toggle) {
    return phone.open
      ? { phone: { ...phone, open: false }, command: { type: 'close' } }
      : { phone: { ...phone, open: true, index: 0 }, command: { type: 'open' } };
  }
  if (!phone.open) return { phone, command: null };
  const last = phone.items.length - 1;
  if (keys.up || keys.down) {
    const index = keys.up ? (phone.index + last) % (last + 1) : (phone.index + 1) % (last + 1);
    return { phone: { ...phone, index }, command: { type: 'move', index } };
  }
  const item = phone.items[phone.index];
  if (keys.select && item) return { phone: { ...phone, open: false }, command: { type: 'select', target: item.target } };
  return { phone, command: null };
}
