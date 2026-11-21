// game.ts — the game's state and its three scenes: title, play, ending.
// Pure game logic: no Three.js and no DOM. main.ts draws whatever is here.
// The way into a 2004 moment is the CD player outside the shop today: put that CD in (E) and,
// T.cdPlayer.insertSec later (counted in game steps), you arrive. The flip phone (Q) takes you
// back to today, and to any moment you've already been to.
// The game announces what happens on `events`; sound and other features listen.

import { createEvents, type Events } from './core/events.ts';
import { createSceneManager, type SceneManager } from './core/scenes.ts';
import type { Input } from './core/input.ts';
import type { NewsDesk } from './news/desk.ts';
import { closedPhone, firstChoice, phoneItems, stepPhone, TODAY, type PhoneCommand, type PhoneItem, type PhoneState } from './phone/state.ts';
import { obstaclesOf, type Footprint } from './player/collide.ts';
import { pickTarget, startPlayer, stepPlayer, type PlayerState, type Target } from './player/controller.ts';
import { cdForObject, fillCdText, situationOf } from './story/cdplayer.ts';
import { actionForObject, causesOf, changeCauses, doAction, fixedCds, presentState, propOverrides, reputationLevel, type Flags } from './story/timeline.ts';
import type { LoadedCd, PastAction, PresentChange, StoryContent } from './story/types.ts';
import { T, type Era } from './tuning.ts';
import { areaAt } from './world/areas.ts';
import { visibleProps } from './world/layout.ts';

export type SceneName = 'title' | 'play' | 'ending';

/** A CD going into the player: you travel to `moment` when `framesLeft` reaches 0. */
export interface Inserting {
  cd: string;
  moment: string;
  framesLeft: number;
}

export interface GameState {
  era: Era;
  moment: string | null; // which 2004 moment you are in; null today
  flags: Flags; // past actions done, in order
  visited: string[]; // 2004 moments you have been to (the phone can take you back to these)
  inserting: Inserting | null; // a CD on its way into the player
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
  | { ok: true; cdInserted: string } // a CD went into the player: you travel to its moment soon
  | { ok: false; reason: 'not-here' | 'unknown' | 'already-done' | 'locked'; missing?: string[] };

export interface Game {
  state: GameState;
  scenes: SceneManager<SceneName>;
  events: Events;
  /** Advances one fixed step. */
  update(): void;
  /** Uses an interactable by id (the E key and the debug API both call this). */
  interact(objectId: string): InteractResult;
  /** Travels straight to a 2004 moment id, or to "present". The phone, the CD player and the debug API call this. */
  travel(to: string): boolean;
  /** Interactables that can be used right now. */
  targets(): Target[];
  /** Footprints of the solid props the player bumps into right now. */
  obstacles(): Footprint[];
  /** The changes the "Because you..." card explains. */
  cardChanges(): PresentChange[];
  /** Past actions that caused the card's changes, earliest first. */
  causes(): PastAction[];
  present(): Record<string, boolean>;
  /** The CD whose moment you are in, if any. */
  currentCd(): LoadedCd | null;
  /** What the E prompt says for the current target ("" when nothing is targeted). */
  prompt(): string;
  /** The phone's rows right now (fresh, even while the phone is closed). */
  phoneItems(): PhoneItem[];
}

const DT = 1 / T.loop.stepsPerSecond;
const INSERT_FRAMES = Math.round(T.cdPlayer.insertSec * T.loop.stepsPerSecond);

/** Fresh state for a new run: present day, nothing done yet. */
function freshState(content: StoryContent, frame: number): GameState {
  return {
    era: 'present', moment: null, flags: [], visited: [], inserting: null, player: startPlayer(), target: null, dialogue: '', dialogueLeft: 0,
    endingLeft: null, frame, phone: closedPhone(phoneItems(content.cds, []), TODAY), reputation: 0, seen: [], latest: [],
  };
}

/** What the game's helper functions share. */
interface Ctx {
  content: StoryContent;
  state: GameState;
  events: Events;
  news: NewsDesk | undefined;
  area: string | null; // the street area announced last; null = announce the next one (a new game, a new arrival)
}

/** Announces the area of the street the player is in, when it changes (see T.areas). */
function updateArea(ctx: Ctx): void {
  const area = areaAt(ctx.state.player.x, ctx.area);
  if (area.id === ctx.area) return;
  ctx.area = area.id;
  ctx.events.emit('area', { id: area.id, title: area.title });
}

/** Shows a line of dialogue for a while. */
function say(ctx: Ctx, line: string): void {
  ctx.state.dialogue = line;
  ctx.state.dialogueLeft = line ? T.timing.dialogueSec : 0;
}

/** The phone's rows for where you are now and what you've done. */
function phoneItemsNow({ content, state }: Ctx): PhoneItem[] {
  return phoneItems(content.cds, fixedCds(content, state.flags), state.visited, state.moment ?? TODAY);
}

/** Interactables that can be used right now. */
function targetsNow({ content, state }: Ctx): Target[] {
  const { shown, hidden } = propOverrides(content, state.flags);
  return visibleProps(state.era, state.moment, shown, hidden)
    .filter((p) => p.interactable)
    .map((p) => ({ id: p.id, x: p.pos[0], z: p.pos[2] }));
}

/** Footprints of the solid props in the scene right now (same props the world draws). */
function obstaclesNow({ content, state }: Ctx): Footprint[] {
  const { shown, hidden } = propOverrides(content, state.flags);
  return obstaclesOf(visibleProps(state.era, state.moment, shown, hidden));
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

/** What the E prompt says for an interactable: its action's prompt, or the CD player's. */
function promptFor({ content }: Ctx, objectId: string | null): string {
  if (!objectId) return '';
  const cd = cdForObject(content, objectId);
  return cd ? fillCdText(content.cdPlayer.prompt, cd) : actionForObject(content, objectId)?.prompt ?? '';
}

/** Puts a CD in the player: announces it at once; stepInserting() travels once the CD is in. */
function insertCd(ctx: Ctx, cd: LoadedCd): InteractResult {
  if (ctx.state.inserting) return { ok: false, reason: 'already-done' }; // one CD at a time
  ctx.state.inserting = { cd: cd.id, moment: cd.moment, framesLeft: INSERT_FRAMES };
  ctx.state.target = null;
  say(ctx, fillCdText(ctx.content.cdPlayer.line, cd));
  ctx.events.emit('cd-insert', { cd: cd.id });
  return { ok: true, cdInserted: cd.id };
}

/** Uses an interactable by id. */
function interactWith(ctx: Ctx, objectId: string): InteractResult {
  const { content, state, events } = ctx;
  if (!targetsNow(ctx).some((t) => t.id === objectId)) {
    say(ctx, content.notHereLine);
    return { ok: false, reason: 'not-here' };
  }
  const cd = cdForObject(content, objectId);
  if (cd) return insertCd(ctx, cd);
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

/** The line on arriving in a CD's moment: its date and how things stand (before, or fixed). */
function arrivalLine({ content, state }: Ctx, cd: LoadedCd): string {
  const fixed = fixedCds(content, state.flags).includes(cd.id);
  return content.travelLines.past.replace('{date}', cd.date).replace('{situation}', situationOf(content, cd, fixed));
}

/** Travels to a 2004 moment id or "present". False if there is no such place. */
function travelTo(ctx: Ctx, to: string): boolean {
  const { content, state } = ctx;
  const cd = content.cds.find((c) => c.moment === to);
  if (to !== TODAY && !cd) return false;
  state.era = cd ? '2004' : 'present';
  state.moment = cd ? cd.moment : null;
  if (cd && !state.visited.includes(cd.moment)) state.visited = [...state.visited, cd.moment];
  state.inserting = null;
  state.player = startPlayer(); // every moment starts on the same spot, facing the shop
  ctx.area = null; // ...and announces where you are again
  state.target = null;
  state.phone = closedPhone(phoneItemsNow(ctx), to);
  ctx.events.emit('travel', { to, era: state.era, moment: state.moment });
  if (cd) say(ctx, arrivalLine(ctx, cd));
  else arriveToday(ctx);
  return true;
}

/** Acts on what the phone asked for. */
function onPhone(ctx: Ctx, command: PhoneCommand): void {
  const { content, state, events } = ctx;
  if (!command) return;
  if (command.type === 'open') {
    const items = phoneItemsNow(ctx);
    state.phone = { ...state.phone, items, index: firstChoice(items) };
    events.emit('phone-open', {});
  } else if (command.type === 'close') {
    events.emit('phone-close', {});
  } else if (command.type === 'move') {
    events.emit('phone-move', { index: command.index });
  } else if (command.type === 'locked') {
    say(ctx, content.cdPlayer.phoneLockedLine);
  } else {
    events.emit('phone-select', { target: command.target });
    events.emit('phone-close', {});
    travelTo(ctx, command.target);
  }
}

/** While a CD goes into the player nothing else happens; then you travel. True while it is going in. */
function stepInserting(ctx: Ctx): boolean {
  const going = ctx.state.inserting;
  if (!going) return false;
  going.framesLeft--;
  if (going.framesLeft <= 0) travelTo(ctx, going.moment);
  return true;
}

/** E with nothing to use in front: says why (already used, or nothing there). */
function explainNothingToUse(ctx: Ctx): void {
  const used = usedObjects(ctx.content, ctx.state.flags);
  const usedInFront = pickTarget(ctx.state.player, targetsNow(ctx).filter((t) => used.has(t.id)));
  say(ctx, usedInFront ? ctx.content.alreadyDoneLine : ctx.content.notHereLine);
}

/** Walking and using things (only while the phone is closed). */
function stepWalking(ctx: Ctx, input: Input): void {
  const { state } = ctx;
  state.player = stepPlayer(state.player, {
    forward: input.isDown('forward'),
    back: input.isDown('back'),
    turnLeft: input.isDown('turnLeft'),
    turnRight: input.isDown('turnRight'),
    run: input.isDown('run'),
  }, DT, obstaclesNow(ctx));
  const pick = (): string | null => {
    const used = usedObjects(ctx.content, state.flags);
    return pickTarget(state.player, targetsNow(ctx).filter((t) => !used.has(t.id)));
  };
  state.target = pick();
  if (!input.wasPressed('interact')) return;
  if (!state.target) return explainNothingToUse(ctx);
  interactWith(ctx, state.target);
  state.target = state.inserting ? null : pick(); // what you just used stops being a target at once
}

/** One fixed step of the play scene. Returns 'ending' when the story is done. */
function updatePlay(ctx: Ctx, input: Input): SceneName | null {
  const { state } = ctx;
  if (!stepInserting(ctx)) {
    const stepped = stepPhone(state.phone, {
      toggle: input.wasPressed('phone'),
      up: input.wasPressed('forward'),
      down: input.wasPressed('back'),
      select: input.wasPressed('interact') || input.wasPressed('start'),
    });
    const wasOpen = state.phone.open;
    state.phone = stepped.phone;
    onPhone(ctx, stepped.command);
    if (!wasOpen && !state.phone.open) stepWalking(ctx, input);
    else state.target = null;
  }
  updateArea(ctx);
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
  const ctx: Ctx = { content, state, events, news: deps.news, area: null };

  const scenes = createSceneManager<SceneName, null>({
    title: {
      enter: () => {
        Object.assign(state, freshState(content, state.frame));
        ctx.area = null;
        ctx.news?.clear();
        events.emit('title', {});
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
    obstacles: () => obstaclesNow(ctx),
    cardChanges: () => cardChangesNow(ctx),
    causes: () => causesOf(content, cardChangesNow(ctx).flatMap((c) => changeCauses(c, state.flags)))
      .sort((a, b) => state.flags.indexOf(a.id) - state.flags.indexOf(b.id)), // in the order you did them
    present: () => presentState(content, state.flags),
    currentCd: () => content.cds.find((c) => c.moment === state.moment) ?? null,
    prompt: () => promptFor(ctx, state.target),
    phoneItems: () => phoneItemsNow(ctx),
  };
}
