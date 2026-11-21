// areas.test.ts — the high street's areas: each moment's props are drawn in its area, the raw
// data stays where teammates put it, and walking into an area announces it.
import { describe, expect, it } from 'vitest';
import { createEvents } from '../src/core/events.ts';
import { createGame } from '../src/game.ts';
import { createInput } from '../src/core/input.ts';
import { startPlayer } from '../src/player/controller.ts';
import { content } from '../src/story/content.ts';
import { T } from '../src/tuning.ts';
import { areaAt, areaOfMoment, placed, placedPos } from '../src/world/areas.ts';
import { PROPS, visibleProps } from '../src/world/layout.ts';

const half = T.world.groundWidth / 2;
const groundX = [T.world.groundCenterX - half, T.world.groundCenterX + half] as const;

describe('areas', () => {
  it('every CD moment happens in a listed area, and the areas follow each other along +X without overlapping', () => {
    for (const cd of content.cds) expect(T.areas.list.map((a) => a.id), cd.moment).toContain(areaOfMoment(cd.moment).id);
    T.areas.list.slice(1).forEach((a, i) => expect(a.x[0], a.id).toBeGreaterThan(T.areas.list[i]?.x[1] ?? Infinity));
  });

  it('the player starts at the start of the street, in the shop\'s area, facing along the street towards it', () => {
    const start = startPlayer();
    expect(areaAt(start.x, null).id).toBe(T.areas.home);
    expect(start.x).toBeLessThan(-4); // left of the shop front (x -4..4)
    expect(start.x).toBeGreaterThan(groundX[0]);
  });

  it('a moment\'s props are drawn in its area, on the ground; street and today props do not move', () => {
    for (const p of PROPS) {
      const [x] = placedPos(p);
      if (!p.moments) {
        expect(placed(p), p.id).toBe(p);
        continue;
      }
      const area = areaOfMoment(p.moments[0] ?? '');
      expect(p.moments.every((m) => areaOfMoment(m).id === area.id), `${p.id}: all its moments in one area`).toBe(true);
      expect(x - p.size[0] / 2, p.id).toBeGreaterThanOrEqual(Math.max(area.x[0], groundX[0]));
      expect(x + p.size[0] / 2, p.id).toBeLessThanOrEqual(Math.min(area.x[1], groundX[1]));
    }
  });

  it('visibleProps gives world positions and leaves the raw props alone', () => {
    const stage = PROPS.find((p) => p.id === 'static_stage');
    const shown = visibleProps('2004', 'street_gig', new Set(), new Set()).find((p) => p.id === 'static_stage');
    expect(stage && shown).toBeTruthy();
    expect(shown?.pos[0]).toBeCloseTo((stage?.pos[0] ?? 0) + areaOfMoment('street_gig').shiftX, 9);
    expect(stage?.pos[0]).toBeLessThan(T.areas.list[0]?.x[1] ?? 0); // still laid out around the shop
  });

  it('areaAt keeps the current area between two spans, and picks the nearest with none', () => {
    const [a, b] = T.areas.list;
    if (!a || !b) throw new Error('need two areas');
    const between = (a.x[1] + b.x[0]) / 2;
    expect(areaAt(between, a.id).id).toBe(a.id);
    expect(areaAt(between, b.id).id).toBe(b.id);
    expect(areaAt(a.x[1] - 0.1, null).id).toBe(a.id);
  });

  it('the game announces the area when play starts, when you walk into another, and on every arrival', () => {
    const events = createEvents();
    const seen: string[] = [];
    events.on('area', (e) => seen.push(`${e.id}:${e.title}`));
    const input = createInput();
    const game = createGame(content, input, { events });
    input.press('Enter');
    game.update();
    input.release('Enter');
    game.update();
    const home = T.areas.list.find((x) => x.id === T.areas.home);
    expect(seen).toEqual([`${home?.id}:${home?.title}`]);
    const square = T.areas.list.at(-1);
    game.state.player = { ...game.state.player, x: ((square?.x[0] ?? 0) + groundX[1]) / 2 };
    game.update();
    expect(seen.at(-1)).toBe(`${square?.id}:${square?.title}`);
    game.update();
    expect(seen.length).toBe(2); // standing still: nothing new
    game.travel('present');
    game.update();
    expect(seen.at(-1)).toBe(`${home?.id}:${home?.title}`);
  });
});
