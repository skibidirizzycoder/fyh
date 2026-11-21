// events.ts — the game announces what happens; other parts (sound, phone) listen.
// This keeps features in their own files: sound never edits game.ts, it just listens.
//
//   events.on('travel', (e) => playWhoosh(e.to));
//   events.emit('travel', { to: 'present', era: 'present', moment: null });

import type { Era } from '../tuning.ts';

/** Every event and the data it carries. */
export interface GameEvents {
  'game-start': Record<string, never>; // Enter pressed on the title (a good moment to start audio)
  travel: { to: string; era: Era; moment: string | null }; // to = a moment id or "present"
  'action-done': { actionId: string; cd: string | null };
  'action-locked': { actionId: string; missing: string[] };
  'phone-open': Record<string, never>;
  'phone-close': Record<string, never>;
  'phone-move': { index: number };
  'phone-select': { target: string };
  reputation: { level: number }; // the shop's reputation went up (number of CDs fixed)
  mute: Record<string, never>; // M pressed
  area: { id: string; title: string }; // the player walked into an area of the street, or arrived somewhere (T.areas)
}

export type EventName = keyof GameEvents;

export interface Events {
  on<K extends EventName>(name: K, listener: (payload: GameEvents[K]) => void): void;
  emit<K extends EventName>(name: K, payload: GameEvents[K]): void;
  /** Names of the last few events, newest last (for tests). */
  recent(): string[];
}

const RECENT_LIMIT = 20;

/** Creates an event hub. */
export function createEvents(): Events {
  const listeners = new Map<EventName, ((payload: never) => void)[]>();
  const recent: string[] = [];

  return {
    on(name, listener) {
      const list = listeners.get(name) ?? [];
      list.push(listener as (payload: never) => void);
      listeners.set(name, list);
    },
    emit(name, payload) {
      recent.push(name);
      if (recent.length > RECENT_LIMIT) recent.shift();
      for (const listener of listeners.get(name) ?? []) (listener as (p: typeof payload) => void)(payload);
    },
    recent: () => [...recent],
  };
}
