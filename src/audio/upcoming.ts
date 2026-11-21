// upcoming.ts — game events announced in docs/BACKLOG.md (round 3) that the game doesn't send yet.
// Audio listens for them already, with the announced names and shapes; once Claude adds them to
// GameEvents (src/core/events.ts) they just start working. Until then nothing happens.

export interface UpcomingEvents {
  'cd-insert': { cd: string }; // a CD went into the CD player (the way into 2004); sent BEFORE its travel
  title: Record<string, never>; // back on the title screen (e.g. "play again" after the ending)
  area: { id: string; title: string }; // walked into another area of the map
}

export interface UpcomingSource {
  on<K extends keyof UpcomingEvents>(name: K, listener: (payload: UpcomingEvents[K]) => void): unknown;
}
