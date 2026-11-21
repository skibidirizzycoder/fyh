// phone-view.test.ts — what the closed phone's outer screen says.
import { describe, expect, it } from 'vitest';
import { content } from '../src/story/content.ts';
import { phoneItems, TODAY } from '../src/phone/state.ts';
import { outerScreenText, shortDate } from '../src/phone/view.ts';
import { T } from '../src/tuning.ts';

const items = phoneItems(content.cds, []);

describe('phone outer screen', () => {
  it('shortens the month so the date fits', () => {
    expect(shortDate('13 December 2002')).toBe('13 Dec 2002');
    expect(shortDate('6 August 1988')).toBe('6 Aug 1988');
    expect(shortDate('14 July 2017')).toBe('14 Jul 2017');
  });

  it('shows each 2004 moment\'s own time and date', () => {
    for (const cd of content.cds) {
      const shown = outerScreenText(cd.moment, items, new Date());
      expect(shown.time, cd.moment).toBe(T.phone.momentTimes[cd.moment]);
      expect(shown.time, cd.moment).toMatch(/^\d\d:\d\d$/);
      expect(shown.date).toBe(shortDate(cd.date));
    }
  });

  it('shows a live clock and today\'s date today', () => {
    const shown = outerScreenText(TODAY, items, new Date(2026, 10, 21, 9, 5));
    expect(shown).toEqual({ time: '09:05', date: '21 Nov 2026' });
  });
});
