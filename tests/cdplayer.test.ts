// cdplayer.test.ts — the CD player outside the shop is the way into 2004; plus the playtest bugs:
// revisiting a fixed moment (bug 1) and E with nothing to use (bug 3).
import { describe, expect, it } from 'vitest';
import { createInput } from '../src/core/input.ts';
import { createGame, type Game } from '../src/game.ts';
import { TODAY } from '../src/phone/state.ts';
import { cdForObject, cdObjectId, goldCdObjectId, withCdPrompts } from '../src/story/cdplayer.ts';
import { buildContent, CD_FILES, content } from '../src/story/content.ts';
import base from '../src/story/content.json';
import { propOverrides } from '../src/story/timeline.ts';
import type { StoryContent } from '../src/story/types.ts';
import { T } from '../src/tuning.ts';
import { PROPS, visibleProps } from '../src/world/layout.ts';
import { PROPS_PLAYER } from '../src/world/props/player.ts';

const INSERT_FRAMES = Math.round(T.cdPlayer.insertSec * T.loop.stepsPerSecond);

/** A started game (past the title), every event heard in order, and a way to tap keys. */
function started(story: StoryContent = content) {
  const input = createInput();
  const game = createGame(story, input);
  const heard: string[] = [];
  const names = ['title', 'game-start', 'cd-insert', 'travel', 'action-done', 'phone-open', 'reputation'] as const;
  for (const name of names) game.events.on(name, () => heard.push(name));
  const tap = (code: string): void => {
    input.press(code);
    game.update();
    input.release(code);
  };
  const steps = (n: number): void => {
    for (let i = 0; i < n; i++) game.update();
  };
  tap('Enter');
  return { game, tap, steps, heard, input };
}

/** Stands the player just in front of a prop, facing it (-Z). */
function standBefore(game: Game, id: string): void {
  const p = PROPS.find((x) => x.id === id);
  if (!p) throw new Error(`no prop ${id}`);
  game.state.player = { x: p.pos[0], z: p.pos[2] + 1, yawDeg: 0 };
}

/** Does every action of a CD in its moment (debug shortcut). */
function fix(game: Game, cdId: string): void {
  const cd = content.cds.find((c) => c.id === cdId);
  game.travel(cd?.moment ?? '');
  for (const a of content.actions.filter((x) => x.cd === cdId)) game.interact(a.objectId);
}

describe('the CD player props', () => {
  it('stand today only, with one interactable CD per CD file and a hidden gold copy of each', () => {
    expect(PROPS_PLAYER.every((p) => p.eras.length === 1 && p.eras[0] === 'present' && !p.moments)).toBe(true);
    expect(PROPS_PLAYER.filter((p) => p.interactable).map((p) => p.id)).toEqual(CD_FILES.map((f) => `today_cd_${f.cd.id}`));
    for (const f of CD_FILES) {
      const gold = PROPS_PLAYER.find((p) => p.id === goldCdObjectId(f.cd.id));
      expect(gold?.startsHidden && !gold.interactable && gold.color === T.cdPlayer.gold, f.cd.id).toBe(true);
    }
  });

  it('each CD has its own clear colour', () => {
    const colours = CD_FILES.map((f) => PROPS_PLAYER.find((p) => p.id === cdObjectId(f.cd.id))?.color);
    expect(new Set(colours).size).toBe(CD_FILES.length);
  });

  it('a fixed CD turns gold: the dusty one goes, the gold one shows', () => {
    const { shown, hidden } = propOverrides(content, content.actions.filter((a) => a.cd === 'mira').map((a) => a.id));
    const ids = visibleProps('present', null, shown, hidden).map((p) => p.id);
    expect(ids).toContain('today_cd_mira_gold');
    expect(ids).not.toContain('today_cd_mira');
    expect(ids).toContain('today_cd_static');
  });
});

describe('putting a CD in the player', () => {
  it('announces cd-insert at once, then travels to its moment after insertSec of game steps, not before', () => {
    const { game, tap, steps, heard } = started();
    standBefore(game, 'today_cd_static');
    tap('KeyF'); // one step: the CD is now the target
    expect(game.state.target).toBe('today_cd_static');
    expect(game.prompt()).toBe("Put The Static's CD in the player");
    heard.length = 0;
    tap('KeyE');
    expect(heard).toEqual(['cd-insert']);
    expect(game.state.inserting).toMatchObject({ cd: 'static', moment: 'street_gig' });
    expect(game.state.era).toBe('present');
    steps(INSERT_FRAMES - 1);
    expect(game.state.era).toBe('present');
    steps(1);
    expect(game.state.moment).toBe('street_gig');
    expect(game.state.inserting).toBeNull();
    expect(heard).toEqual(['cd-insert', 'travel']);
  });

  it('the cd-insert event carries the CD id', () => {
    const { game } = started();
    const got: unknown[] = [];
    game.events.on('cd-insert', (e) => got.push(e));
    expect(game.interact('today_cd_kbit')).toEqual({ ok: true, cdInserted: 'kbit' });
    expect(got).toEqual([{ cd: 'kbit' }]);
  });

  it('sets no story flags: no card, no paper change, no reputation', () => {
    const { game, steps } = started();
    game.interact('today_cd_mira');
    steps(INSERT_FRAMES);
    expect(game.state.moment).toBe('open_mic');
    expect(game.state.flags).toEqual([]);
    game.travel(TODAY);
    expect(game.state.reputation).toBe(0);
    expect(game.cardChanges()).toEqual([]);
  });

  it('while the CD goes in you cannot walk or open the phone', () => {
    const { game, tap, input } = started();
    game.interact('today_cd_mira');
    const at = { ...game.state.player };
    input.press('KeyW');
    for (let i = 0; i < INSERT_FRAMES - 2; i++) game.update();
    input.release('KeyW');
    expect(game.state.player).toEqual(at);
    tap('KeyQ');
    expect(game.state.phone.open).toBe(false);
  });

  it('afterwards, the phone can take you back to that moment', () => {
    const { game, steps } = started();
    expect(game.phoneItems().find((i) => i.target === 'open_mic')?.locked).toBe(true);
    game.interact('today_cd_mira');
    steps(INSERT_FRAMES);
    game.travel(TODAY);
    expect(game.phoneItems().find((i) => i.target === 'open_mic')?.locked).toBe(false);
    expect(game.state.visited).toEqual(['open_mic']);
  });

  it('a direct travel (debug) cancels a CD that is going in', () => {
    const { game, steps } = started();
    game.interact('today_cd_mira');
    game.travel('ringtone');
    steps(INSERT_FRAMES + 1);
    expect(game.state.moment).toBe('ringtone');
  });

  it('the CDs are only by the player today, not in 2004', () => {
    const { game } = started();
    expect(game.targets().map((t) => t.id)).toEqual(expect.arrayContaining(['today_cd_mira', 'today_cd_static', 'today_cd_kbit']));
    game.travel('open_mic');
    expect(game.targets().some((t) => cdForObject(content, t.id))).toBe(false);
    expect(game.interact('today_cd_mira')).toEqual({ ok: false, reason: 'not-here' });
  });

  it('the HUD gets a prompt for each CD (it reads prompts from actions); the game rules do not', () => {
    const hud = withCdPrompts(content);
    expect(hud.actions.find((a) => a.objectId === 'today_cd_mira')?.prompt).toBe("Put Mira's CD in the player");
    expect(hud.actions).toHaveLength(content.actions.length + content.cds.length);
    expect(content.actions.some((a) => a.objectId.startsWith('today_cd_'))).toBe(false);
  });
});

describe('bug 1: coming back to a fixed moment', () => {
  it('shows how it is now, not the "before" situation', () => {
    const { game } = started();
    const cd = content.cds.find((c) => c.id === 'static');
    if (!cd) throw new Error('no static CD');
    game.travel(cd.moment);
    expect(game.state.dialogue).toContain(cd.situation);
    fix(game, 'static');
    game.travel(TODAY);
    game.travel(cd.moment);
    expect(game.state.dialogue).not.toContain(cd.situation);
    expect(game.state.dialogue).toBe(`${cd.date}. ${content.fixedSituation.replace('{artist}', cd.artist)}`);
  });

  it('a CD file can say it in its own words with "fixedSituation"', () => {
    const files = structuredClone(CD_FILES);
    const mira = files.find((f) => f.cd.id === 'mira');
    if (!mira) throw new Error('no Mira');
    mira.cd.fixedSituation = 'Mira is on stage and nobody is looking at their phone.';
    const { game } = started(buildContent(base, files));
    fix(game, 'mira');
    game.travel(TODAY);
    game.travel('open_mic');
    expect(game.state.dialogue).toBe(`${mira.cd.date}. Mira is on stage and nobody is looking at their phone.`);
  });
});

describe('bug 3: E with nothing to use', () => {
  it('in front of nothing says notHereLine', () => {
    const { game, tap } = started();
    game.state.player = { x: 0, z: 3, yawDeg: 180 }; // facing the road: nothing there
    tap('KeyE');
    expect(game.state.dialogue).toBe(content.notHereLine);
  });

  it('in front of something already used says alreadyDoneLine', () => {
    const hidden = new Set(content.actions.flatMap((a) => a.effects.hide));
    const action = content.actions.find((a) => !hidden.has(a.objectId) && a.requires.length === 0);
    if (!action?.moment) throw new Error('need an action whose object stays after use');
    const { game, tap } = started();
    game.travel(action.moment);
    expect(game.interact(action.objectId).ok).toBe(true);
    standBefore(game, action.objectId);
    tap('KeyF');
    expect(game.state.target).not.toBe(action.objectId);
    tap('KeyE');
    expect(game.state.dialogue).toBe(content.alreadyDoneLine);
  });
});

describe('the title event', () => {
  it('fires when "play again" goes back to the title', () => {
    const { game, tap, heard } = started();
    for (const cd of content.cds) fix(game, cd.id);
    game.travel(TODAY);
    for (let i = 0; i < Math.ceil(T.timing.endingDelaySec * T.loop.stepsPerSecond) + 1; i++) game.update();
    expect(game.scenes.current()).toBe('ending');
    heard.length = 0;
    tap('Enter');
    expect(game.scenes.current()).toBe('title');
    expect(heard).toEqual(['title']);
  });
});
