// game.ts — the game's state and its three scenes: title, play, ending.
// Pure game logic: no Three.js and no DOM. main.ts draws whatever is here.
// You travel with the flip phone: to one of the CDs' 2004 moments, or back to today.
// The game announces what happens on `events`; sound and other features listen.

import { createEvents, type Events } from './core/events.ts';
import { createSceneManager, type SceneManager } from './core/scenes.ts';
import type { Input } from './core/input.ts';
import type { NewsDesk } from './news/desk.ts';
import { closedPhone, phoneItems, stepPhone, TODAY, type PhoneCommand, type PhoneState } from './phone/state.ts';
import { pickTarget, startPlayer, stepPlayer, type PlayerState, type Target } from './player/controller.ts';
import { actionForObject, causesOf, changeCauses, doAction, fixedCds, presentState, propOverrides, reputationLevel, type Flags } from './story/timeline.ts';
import type { LoadedCd, PastAction, PresentChange, StoryContent } from './story/types.ts';
import { T, type Era } from './tuning.ts';
import { visibleProps } from './world/layout.ts';

export type SceneName = 'title' | 'play' | 'ending';

export interface GameState {
  era: Era;
  moment: string | null; // which 2004 moment you are in; null today
  flags: Flags; // past actions done, in order
  player: PlayerState;
  target: string | null; // interactable the player is looking at
  dialogue: string;
  dialogueLeft: number; // seconds until the dialogue line hides
  endingLeft: number | null; // seconds until the ending, once the final change is seen today
  frame: number; // fixed steps since the page loaded
  phone: PhoneState;
  reputation: number; // the reputation level last seen today (CDs fixed)
  seen: string[]; // present-day changes already shown to the player
  latest: string[]; // the changes that were new on the latest return to today
}

export type InteractResult =
  | { ok: true; actionId: string }
  | { ok: false; reason: 'not-here' | 'unknown' | 'already-done' | 'locked'; missing?: string[] };

export interface Game {
  state: GameState;
  scenes: SceneManager<SceneName>;
  events: Events;
  /** Advances one fixed step. */
  update(): void;
  /** Uses an interactable by id (the E key and the debug API both call this). */
  interact(objectId: string): InteractResult;
  /** Travels to a 2004 moment id, or to "present". The phone and the debug API both call this. */
  travel(to: string): boolean;
  /** Interactables that can be used right now. */
  targets(): Target[];
  /** The changes the "Because you..." card explains. */
  cardChanges(): PresentChange[];
  /** Past actions that caused the card's changes, earliest first. */
  causes(): PastAction[];
  present(): Record<string, boolean>;
  /** The CD whose moment you are in, if any. */
  currentCd(): LoadedCd | null;
}

const DT = 1 / T.loop.stepsPerSecond;

/** Fresh state for a new run: present day, nothing done yet. */
function freshState(content: StoryContent, frame: number): GameState {
  return {
    era: 'present', moment: null, flags: [], player: startPlayer(), target: null, dialogue: '', dialogueLeft: 0,
    endingLeft: null, frame, phone: closedPhone(phoneItems(content.cds, []), TODAY), reputation: 0, seen: [], latest: [],
  };
}

/** Fills {date} and {situation} in a travel line. */
function fillLine(line: string, cd: LoadedCd): string {
  return line.replace('{date}', cd.date).replace('{situation}', cd.situation);
}

/** What the game's helper functions share. */
interface Ctx {
  content: StoryContent;
  state: GameState;
  events: Events;
  news: NewsDesk | undefined;
}

/** Shows a line of dialogue for a while. */
function say(ctx: Ctx, line: string): void {
  ctx.state.dialogue = line;
  ctx.state.dialogueLeft = line ? T.timing.dialogueSec : 0;
}

/** Interactables that can be used right now. */
function targetsNow({ content, state }: Ctx): Target[] {
  const { shown, hidden } = propOverrides(content, state.flags);
  return visibleProps(state.era, state.moment, shown, hidden)
    .filter((p) => p.interactable)
    .map((p) => ({ id: p.id, x: p.pos[0], z: p.pos[2] }));
}

/** Ids of interactables whose action is already done (no prompt, no marker, no highlight). */
export function usedObjects(content: StoryContent, flags: Flags): Set<string> {
  return new Set(content.actions.filter((a) => flags.includes(a.id)).map((a) => a.objectId));
}

/** The changes the card explains: what was new on the latest return today, else everything active. */
function cardChangesNow({ content, state }: Ctx): PresentChange[] {
  const now = presentState(content, state.flags);
  const active = content.changes.filter((c) => now[c.id]);
  const latest = active.filter((c) => state.latest.includes(c.id));
  return latest.length > 0 ? latest : active;
}

/** Uses an interactable by id. */
function interactWith(ctx: Ctx, objectId: string): InteractResult {
  const { content, state, events } = ctx;
  if (!targetsNow(ctx).some((t) => t.id === objectId)) {
    say(ctx, content.notHereLine);
    return { ok: false, reason: 'not-here' };
  }
  const action = actionForObject(content, objectId);
  const result = doAction(content, state.flags, action?.id ?? '');
  if (result.ok) {
    state.flags = result.flags;
    say(ctx, result.action.line);
    events.emit('action-done', { actionId: result.action.id, cd: result.action.cd ?? null });
    return { ok: true, actionId: result.action.id };
  }
  if (result.reason === 'locked') {
    say(ctx, result.action.lockedLine);
    events.emit('action-locked', { actionId: result.action.id, missing: result.missing });
    return { ok: false, reason: 'locked', missing: result.missing };
  }
  say(ctx, result.reason === 'already-done' ? content.alreadyDoneLine : '');
  return { ok: false, reason: result.reason };
}

/** Arriving today: show what is new, announce reputation, start the ending if it's done. */
function arriveToday(ctx: Ctx): void {
  const { content, state, events } = ctx;
  ctx.news?.request(state.flags); // the LLM only writes text about these flags
  const now = presentState(content, state.flags);
  const fresh = content.changes.filter((c) => now[c.id] && !state.seen.includes(c.id));
  state.seen.push(...fresh.map((c) => c.id));
  state.latest = fresh.map((c) => c.id);
  say(ctx, fresh.length > 0 ? fresh.map((c) => c.line).join(' ') : content.travelLines.present);
  const level = reputationLevel(content, state.flags);
  if (level > state.reputation) events.emit('reputation', { level });
  state.reputation = level;
  if (now[content.endingChange]) state.endingLeft ??= T.timing.endingDelaySec;
}

/** Travels to a 2004 moment id or "present". False if there is no such place. */
function travelTo(ctx: Ctx, to: string): boolean {
  const { content, state } = ctx;
  const cd = content.cds.find((c) => c.moment === to);
  if (to !== TODAY && !cd) return false;
  state.era = cd ? '2004' : 'present';
  state.moment = cd ? cd.moment : null;
  state.player = startPlayer(); // every moment starts on the same spot, facing the shop
  state.target = null;
  state.phone = closedPhone(phoneItems(content.cds, fixedCds(content, state.flags)), to);
  ctx.events.emit('travel', { to, era: state.era, moment: state.moment });
  if (cd) say(ctx, fillLine(content.travelLines.past, cd));
  else arriveToday(ctx);
  return true;
}

/** Acts on what the phone asked for. */
function onPhone(ctx: Ctx, command: PhoneCommand): void {
  const { content, state, events } = ctx;
  if (!command) return;
  if (command.type === 'open') {
    state.phone = { ...state.phone, items: phoneItems(content.cds, fixedCds(content, state.flags)) };
    events.emit('phone-open', {});
  } else if (command.type === 'close') {
    events.emit('phone-close', {});
  } else if (command.type === 'move') {
    events.emit('phone-move', { index: command.index });
  } else {
    events.emit('phone-select', { target: command.target });
    events.emit('phone-close', {});
    travelTo(ctx, command.target);
  }
}

/** One fixed step of the play scene. Returns 'ending' when the story is done. */
function updatePlay(ctx: Ctx, input: Input): SceneName | null {
  const { state } = ctx;
  const stepped = stepPhone(state.phone, {
    toggle: input.wasPressed('phone'),
    up: input.wasPressed('forward'),
    down: input.wasPressed('back'),
    select: input.wasPressed('interact') || input.wasPressed('start'),
  });
  const wasOpen = state.phone.open;
  state.phone = stepped.phone;
  onPhone(ctx, stepped.command);
  if (!wasOpen && !state.phone.open) {
    // Walking and using things only while the phone is closed.
    state.player = stepPlayer(state.player, {
      forward: input.isDown('forward'),
      back: input.isDown('back'),
      turnLeft: input.isDown('turnLeft'),
      turnRight: input.isDown('turnRight'),
    }, DT);
    const pick = (): string | null => {
      const used = usedObjects(ctx.content, state.flags);
      return pickTarget(state.player, targetsNow(ctx).filter((t) => !used.has(t.id)));
    };
    state.target = pick();
    if (input.wasPressed('interact') && state.target) {
      interactWith(ctx, state.target);
      state.target = pick(); // what you just used stops being a target at once
    }
  } else {
    state.target = null;
  }
  state.dialogueLeft = Math.max(0, state.dialogueLeft - DT);
  if (state.endingLeft !== null && state.era === 'present') {
    state.endingLeft = Math.max(0, state.endingLeft - DT);
    if (state.endingLeft === 0) return 'ending';
  }
  return null;
}

/** Creates the game. */
export function createGame(content: StoryContent, input: Input, deps: { news?: NewsDesk; events?: Events } = {}): Game {
  const state = freshState(content, 0);
  const events = deps.events ?? createEvents();
  const ctx: Ctx = { content, state, events, news: deps.news };

  const scenes = createSceneManager<SceneName, null>({
    title: {
      enter: () => {
        Object.assign(state, freshState(content, state.frame));
        ctx.news?.clear();
      },
      update: () => {
        if (!input.wasPressed('start')) return null;
        events.emit('game-start', {});
        return 'play';
      },
    },
    play: {
      enter: () => say(ctx, content.intro),
      update: () => updatePlay(ctx, input),
    },
    ending: {
      update: () => (input.wasPressed('start') ? 'title' : null),
    },
  }, 'title', null);

  return {
    state,
    scenes,
    events,
    update: () => {
      state.frame++;
      if (input.wasPressed('mute')) events.emit('mute', {});
      scenes.update();
      input.endStep();
    },
    interact: (objectId) => interactWith(ctx, objectId),
    travel: (to) => travelTo(ctx, to),
    targets: () => targetsNow(ctx),
    cardChanges: () => cardChangesNow(ctx),
    causes: () => causesOf(content, cardChangesNow(ctx).flatMap((c) => changeCauses(c, state.flags)))
      .sort((a, b) => state.flags.indexOf(a.id) - state.flags.indexOf(b.id)), // in the order you did them
    present: () => presentState(content, state.flags),
    currentCd: () => content.cds.find((c) => c.moment === state.moment) ?? null,
  };
}
