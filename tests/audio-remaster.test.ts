// audio-remaster.test.ts — B8: back today after a fix, the tape rewinds, the play key clunks, the remix comes in crisp.
import { describe, expect, it } from 'vitest';
import { createAudio } from '../src/audio/audio.ts';
import { buildCue, cueLength } from '../src/audio/cues.ts';
import { createEvents } from '../src/core/events.ts';
import { T } from '../src/tuning.ts';

const R = T.audio.remaster;

describe('the remaster sting', () => {
  const cue = buildCue('remaster');
  const squeal = cue.tones.filter((t) => t.wave === 'sawtooth');

  it('the rewind squeal climbs from low to high in wobbling steps', () => {
    expect(squeal).toHaveLength(R.steps);
    expect(squeal[0]?.note).toBe(R.fromNote);
    const lastStep = squeal.at(-1);
    expect((lastStep?.toNote ?? 0) - R.toNote).toBeLessThanOrEqual(R.warble);
    for (let i = 1; i < squeal.length; i++) expect(squeal[i]?.note ?? 0).toBeGreaterThan(squeal[i - 1]?.note ?? 0);
    const wobbles = squeal.map((t) => Math.sign((t.toNote ?? t.note) - t.note - (R.toNote - R.fromNote) / R.steps));
    expect(new Set(wobbles).size).toBe(2); // it wobbles both ways (wow and flutter), not a clean sweep
  });

  it('tape hiss rises with it, and the play key clunks right at the end of the rewind', () => {
    const hiss = cue.noises[0];
    expect((hiss?.toHz ?? 0) > (hiss?.fromHz ?? 0)).toBe(true);
    const clunk = cue.tones.find((t) => t.note === R.clunk.note);
    expect(clunk?.at).toBeCloseTo(R.rewindSec);
  });

  it('the whole arrival stays snappy: the remix is in under 1.5 s after the whoosh starts', () => {
    expect(R.delaySec + cueLength(cue)).toBeLessThan(1.5);
    expect(T.audio.music.crispSec).toBeLessThanOrEqual(0.05); // "crisp": no fade-in
  });

  it('plays on the reputation event (arriving today after a fix), never the old fanfare', () => {
    const events = createEvents();
    const audio = createAudio(events, { makeContext: () => null });
    events.emit('travel', { to: 'present', era: 'present', moment: null });
    events.emit('reputation', { level: 1 });
    expect(audio.history().slice(-2)).toEqual(['whoosh', 'remaster']);
  });
});
