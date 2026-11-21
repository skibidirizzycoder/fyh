// The flip-phone travel transition: what the outer screen shows, and that the fold fits the CD insert.
import { describe, expect, it } from 'vitest';
import { outerScreen } from '../src/fx/flip.ts';
import { content } from '../src/story/content.ts';
import { T } from '../src/tuning.ts';

describe('flip transition', () => {
  it('shows the moment\'s clock and short date for a past moment', () => {
    for (const cd of content.cds) {
      const [clock, date] = outerScreen(content, cd.moment, new Date());
      expect(clock, cd.moment).toBe(T.phone.momentTimes[cd.moment]);
      expect(date, cd.moment).toMatch(/^\d{1,2} [A-Z][a-z]{2} \d{4}$/);
    }
  });

  it('shows the real clock and date for today', () => {
    const [clock, date] = outerScreen(content, null, new Date(2026, 10, 21, 9, 5));
    expect(clock).toBe('09:05');
    expect(date).toBe('21 Nov 2026');
  });

  it('the screen is shut before the CD trip happens', () => {
    expect(T.flip.closeSec).toBeLessThan(T.cdPlayer.insertSec);
  });
});
