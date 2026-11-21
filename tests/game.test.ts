// game.test.ts — the phone, travelling between moments, and the events the game announces.
import { describe, expect, it } from 'vitest';
import { createInput } from '../src/core/input.ts';
import { createGame } from '../src/game.ts';
import { closedPhone, phoneItems, stepPhone, TODAY } from '../src/phone/state.ts';
import { content } from '../src/story/content.ts';
import { PROPS } from '../src/world/layout.ts';

const NO_KEYS = { toggle: false, up: false, down: false, select: false };

/** A started game (past the title) with a way to tap keys. */
function started() {
  const input = createInput();
  const game = createGame(content, input);
  const heard: string[] = [];
  for (const name of ['travel', 'action-done', 'action-locked', 'phone-open', 'phone-select', 'reputation', 'game-start'] as const) {
    game.events.on(name, () => heard.push(name));
  }
  const tap = (code: string): void => {
    input.press(code);
    game.update();
    input.release(code);
  };
  tap('Enter');
  return { game, tap, heard };
}

describe('phone state', () => {
  const items = phoneItems(content.cds, ['mira']);

  it('lists every CD moment, then "back to today", marking fixed CDs', () => {
    expect(items.map((i) => i.target)).toEqual([...content.cds.map((c) => c.moment), TODAY]);
    expect(items.filter((i) => i.fixed).map((i) => i.label)).toEqual(['Mira']);
  });

  it('opens, wraps around the menu both ways, and selects', () => {
    let phone = stepPhone(closedPhone(items, TODAY), { ...NO_KEYS, toggle: true }).phone;
    expect(phone.open).toBe(true);
    phone = stepPhone(phone, { ...NO_KEYS, up: true }).phone;
    expect(phone.index).toBe(items.length - 1);
    phone = stepPhone(phone, { ...NO_KEYS, down: true }).phone;
    expect(phone.index).toBe(0);
    const chosen = stepPhone(phone, { ...NO_KEYS, select: true });
    expect(chosen.command).toEqual({ type: 'select', target: items[0]?.target });
    expect(chosen.phone.open).toBe(false);
  });

  it('ignores menu keys while closed', () => {
    expect(stepPhone(closedPhone(items, TODAY), { ...NO_KEYS, down: true, select: true }).command).toBeNull();
  });
});

describe('the game', () => {
  it('Q, Down, E travels to the second CD\'s moment', () => {
    const { game, tap, heard } = started();
    tap('KeyQ');
    expect(game.state.phone.open).toBe(true);
    tap('ArrowDown');
    tap('KeyE');
    expect(game.state.phone.open).toBe(false);
    expect(game.state.era).toBe('2004');
    expect(game.state.moment).toBe(content.cds[1]?.moment);
    expect(heard).toEqual(['game-start', 'phone-open', 'phone-select', 'travel']);
  });

  it('does not walk while the phone is open', () => {
    const { game, tap } = started();
    tap('KeyQ');
    const before = { ...game.state.player };
    tap('KeyW');
    expect(game.state.player).toEqual(before);
  });

  it('only shows a moment\'s interactables in that moment', () => {
    const { game } = started();
    game.travel('open_mic');
    expect(game.targets().map((t) => t.id)).toEqual(expect.arrayContaining(['mira_cd', 'listening_post']));
    expect(game.targets().some((t) => t.id.startsWith('static_') || t.id.startsWith('kbit_'))).toBe(false);
    expect(game.interact('static_mic')).toEqual({ ok: false, reason: 'not-here' });
  });

  it('fixing a CD and going back today: gold disc, reputation event, a card for what is new', () => {
    const { game, heard } = started();
    game.travel('open_mic');
    expect(game.interact('listening_post')).toMatchObject({ ok: false, reason: 'locked' });
    game.interact('mira_cd');
    game.interact('listening_post');
    expect(game.travel(TODAY)).toBe(true);
    expect(game.present()).toMatchObject({ gold_mira: true, rep_open: true, rep_busy: false });
    expect(game.state.reputation).toBe(1);
    expect(game.cardChanges().map((c) => c.id)).toEqual(['gold_mira', 'rep_open']);
    expect(game.causes().map((a) => a.id)).toEqual(['mira_take_cd', 'mira_play_cd']);
    expect(heard).toEqual(['game-start', 'travel', 'action-locked', 'action-done', 'action-done', 'travel', 'reputation']);
  });

  it('the card lists causes in the order you did them, across CDs', () => {
    const { game } = started();
    const [first, second] = [content.cds[1], content.cds[0]]; // deliberately not in file order
    for (const cd of [first, second]) {
      if (!cd) throw new Error('need 2 CDs');
      game.travel(cd.moment);
      for (const a of content.actions.filter((x) => x.cd === cd.id)) game.interact(a.objectId);
      game.travel(TODAY);
    }
    expect(game.causes().map((a) => a.id)).toEqual(game.state.flags);
  });

  it('a used object is no longer targeted, so its prompt and highlight go away', () => {
    const { game, tap } = started();
    game.travel('open_mic');
    const cd = PROPS.find((p) => p.id === 'mira_cd');
    if (!cd) throw new Error('mira_cd missing');
    game.state.player = { x: cd.pos[0], z: cd.pos[2] + 1.5, yawDeg: 0 }; // just in front of Mira's CD, facing it
    tap('KeyF'); // any key: one step
    expect(game.state.target).toBe('mira_cd');
    tap('KeyE');
    expect(game.state.flags).toContain('mira_take_cd');
    expect(game.state.target).not.toBe('mira_cd');
  });

  it('travelling somewhere unknown does nothing', () => {
    const { game } = started();
    expect(game.travel('1999')).toBe(false);
    expect(game.state.era).toBe('present');
  });

  it('reaches the ending only after the last reputation level is seen today', () => {
    const { game } = started();
    for (const cd of content.cds) {
      game.travel(cd.moment);
      for (const a of content.actions.filter((x) => x.cd === cd.id)) game.interact(a.objectId);
    }
    expect(game.state.endingLeft).toBeNull();
    game.travel(TODAY);
    expect(game.state.endingLeft).not.toBeNull();
  });
});
