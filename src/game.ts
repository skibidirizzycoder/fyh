// game.ts — the game's state and its three scenes: title, play, ending.
// Pure game logic: no Three.js and no DOM. main.ts draws whatever is here.

import { createSceneManager, type SceneManager } from './core/scenes.ts';
import type { Input } from './core/input.ts';
import type { NewsDesk } from './news/desk.ts';
import { pickTarget, startPlayer, stepPlayer, type PlayerState, type Target } from './player/controller.ts';
import { actionForObject, causesOf, doAction, presentState, propOverrides, type Flags } from './story/timeline.ts';
import type { PastAction, StoryContent } from './story/types.ts';
import { T, type Era } from './tuning.ts';
import { visibleProps } from './world/layout.ts';

export type SceneName = 'title' | 'play' | 'ending';

export interface GameState {
  era: Era;
  flags: Flags; // past actions done, in order
  player: PlayerState;
  target: string | null; // interactable the player is looking at
  dialogue: string;
  dialogueLeft: number; // seconds until the dialogue line hides
  endingLeft: number | null; // seconds until the ending, once the present has changed
  frame: number; // fixed steps since the page loaded
}

export type InteractResult =
  | { ok: true; actionId: string }
  | { ok: false; reason: 'not-here' | 'unknown' | 'already-done' | 'locked'; missing?: string[] };

export interface Game {
  state: GameState;
  scenes: SceneManager<SceneName>;
  /** Advances one fixed step. */
  update(): void;
  /** Uses an interactable by id (the E key and the debug API both call this). */
  interact(objectId: string): InteractResult;
  /** Travels to an era (the phone and the debug API both call this). */
  setEra(era: Era): void;
  /** Interactables that can be used right now. */
  targets(): Target[];
  /** Past actions that caused the present changes, earliest first. */
  causes(): PastAction[];
  present(): Record<string, boolean>;
}

const DT = 1 / T.loop.stepsPerSecond;

/** Fresh state for a new run: present day, nothing done yet. */
function freshState(frame: number): GameState {
  return { era: 'present', flags: [], player: startPlayer(), target: null, dialogue: '', dialogueLeft: 0, endingLeft: null, frame };
}

/** Creates the game. */
export function createGame(content: StoryContent, input: Input, news?: NewsDesk): Game {
  const state = freshState(0);

  function say(line: string): void {
    state.dialogue = line;
    state.dialogueLeft = line ? T.timing.dialogueSec : 0;
  }

  function targets(): Target[] {
    const { shown, hidden } = propOverrides(content, state.flags);
    return visibleProps(state.era, shown, hidden)
      .filter((p) => p.interactable)
      .map((p) => ({ id: p.id, x: p.pos[0], z: p.pos[2] }));
  }

  function present(): Record<string, boolean> {
    return presentState(content, state.flags);
  }

  function causes(): PastAction[] {
    const active = content.changes.filter((c) => present()[c.id]);
    return causesOf(content, active.flatMap((c) => c.requires));
  }

  function interact(objectId: string): InteractResult {
    if (!targets().some((t) => t.id === objectId)) {
      say(content.notHereLine);
      return { ok: false, reason: 'not-here' };
    }
    const action = actionForObject(content, objectId);
    const result = doAction(content, state.flags, action?.id ?? '');
    if (result.ok) {
      state.flags = result.flags;
      say(result.action.line);
      return { ok: true, actionId: result.action.id };
    }
    if (result.reason === 'locked') {
      say(result.action.lockedLine);
      return { ok: false, reason: 'locked', missing: result.missing };
    }
    say(result.reason === 'already-done' ? content.alreadyDoneLine : '');
    return { ok: false, reason: result.reason };
  }

  function setEra(era: Era): void {
    state.era = era;
    state.target = null;
    if (era === 'present') news?.request(state.flags); // the LLM only writes text about these flags
    const changed = content.changes.filter((c) => present()[c.id]);
    if (era === 'present' && changed.length > 0) {
      say(changed.map((c) => c.line).join(' '));
      state.endingLeft ??= T.timing.endingDelaySec;
    } else {
      say(content.travelLines[era] ?? '');
    }
  }

  /** One fixed step of the play scene. Returns 'ending' when the story is done. */
  function updatePlay(): SceneName | null {
    state.player = stepPlayer(state.player, {
      forward: input.isDown('forward'),
      back: input.isDown('back'),
      turnLeft: input.isDown('turnLeft'),
      turnRight: input.isDown('turnRight'),
    }, DT);
    state.target = pickTarget(state.player, targets());
    if (input.wasPressed('interact') && state.target) interact(state.target);
    if (input.wasPressed('phone')) setEra(state.era === '2004' ? 'present' : '2004');
    state.dialogueLeft = Math.max(0, state.dialogueLeft - DT);
    if (state.endingLeft !== null && state.era === 'present') {
      state.endingLeft = Math.max(0, state.endingLeft - DT);
      if (state.endingLeft === 0) return 'ending';
    }
    return null;
  }

  const scenes = createSceneManager<SceneName, null>({
    title: {
      enter: () => {
        Object.assign(state, freshState(state.frame));
        news?.clear();
      },
      update: () => (input.wasPressed('start') ? 'play' : null),
    },
    play: {
      enter: () => say(content.intro),
      update: updatePlay,
    },
    ending: {
      update: () => (input.wasPressed('start') ? 'title' : null),
    },
  }, 'title', null);

  return {
    state,
    scenes,
    update: () => {
      state.frame++;
      scenes.update();
      input.endStep();
    },
    interact,
    setEra,
    targets,
    causes,
    present,
  };
}
