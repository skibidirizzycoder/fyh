// kbit-spread.test.ts — the demo's payoff: the infrared beam takes beamSec, then your ringtone spreads
// through the bus queue, one phone per beat, each its own little 4-voice phone.
import { describe, expect, it } from 'vitest';
import { buildCue, cueLength, maxPolyphony, queueRingtones } from '../src/audio/cues.ts';
import { content } from '../src/story/content.ts';
import { T } from '../src/tuning.ts';
import { KBIT_PROPS } from '../src/world/props/kbit.ts';

const Q = T.kbit.spread;

describe('the AirDrop', () => {
  const airdrop = buildCue('beam');

  it('lasts T.kbit.beamSec, so an AirDrop sheet on the phone can end with it', () => {
    expect(cueLength(airdrop)).toBeCloseTo(T.kbit.beamSec, 1);
  });

  it('swooshes upward, then pings "received" after the swoosh, rising', () => {
    const swoosh = airdrop.noises[0];
    expect((swoosh?.toHz ?? 0) > (swoosh?.fromHz ?? 0)).toBe(true);
    const pings = airdrop.tones;
    expect(pings.length).toBeGreaterThanOrEqual(2);
    expect(pings[0]?.at ?? 0).toBeGreaterThanOrEqual(swoosh?.sec ?? Infinity);
    expect((pings[1]?.note ?? 0) > (pings[0]?.note ?? 0)).toBe(true);
  });
});

describe('the scene: heads down, then phones UP', () => {
  const ring = content.actions.find((a) => a.id === 'kbit_ring_bus_stop');
  const props = new Map(KBIT_PROPS.map((p) => [p.id, p]));

  it('on arrival the queue is looking down at dark phones; the ring swaps each for a raised blue one', () => {
    for (let i = 1; i <= 4; i++) {
      const down = props.get(`kbit_queue_phone_${i}`);
      const up = props.get(`kbit_shazam_${i}`);
      expect(down?.startsHidden ?? false).toBe(false);
      expect(up?.startsHidden).toBe(true);
      expect(ring?.effects.hide).toContain(down?.id);
      expect(ring?.effects.show).toContain(up?.id);
      expect((up?.pos[1] ?? 0) > (down?.pos[1] ?? 0) + 0.3).toBe(true); // held up, over their heads
      expect(up?.pos[2]).toBe(down?.pos[2]); // same person
    }
  });

  it('the bus pulls in as the ringtones of the queue end (the punchline: nobody gets on)', () => {
    const spreadEnd = Math.max(...queueRingtones().map((p) => p.delaySec + cueLength(p.cue)));
    const busEnd = T.kbit.busAtSec + T.audio.soundscape.ringtone.bus.sec;
    expect(Math.abs(busEnd - spreadEnd)).toBeLessThan(1.5);
  });
});

describe('the ringtone spreads through the queue', () => {
  const phones = queueRingtones();

  it('one queue phone per beat, in the order of T.kbit.spread.phones', () => {
    expect(phones.map((p) => p.id)).toEqual(Q.phones);
    phones.forEach((p, i) => expect(p.delaySec).toBeCloseTo((i + 1) * Q.gapSec));
    expect(Q.gapSec).toBeCloseTo(60 / T.audio.ringtone.bpm, 2); // on the ringtone's beat, so it sounds like a round
  });

  it('every phone in the list is a real queue phone that the bus stop action shows', () => {
    const ids = new Set(KBIT_PROPS.map((p) => p.id));
    const ring = content.actions.find((a) => a.id === 'kbit_ring_bus_stop');
    for (const id of Q.phones) {
      expect(ids.has(id), id).toBe(true);
      expect(ring?.effects.show ?? [], id).toContain(id);
    }
  });

  it('each queue phone is its own 4-voice phone, quieter than yours, with its own octave, sound and place', () => {
    const yours = buildCue('ringtone');
    for (const p of phones) {
      expect(maxPolyphony(p.cue)).toBeLessThanOrEqual(4);
      expect(Math.max(...p.cue.tones.map((t) => t.gain))).toBeLessThan(Math.max(...yours.tones.map((t) => t.gain)));
      expect(Math.abs(p.pan)).toBeLessThanOrEqual(1);
    }
    const voices = phones.map((p) => `${p.cue.tones[0]?.note}/${p.cue.tones[0]?.wave}/${p.pan}`);
    expect(new Set(voices).size).toBe(phones.length);
  });

  it('the whole spread is over within about 5 s (it is the payoff, not a song)', () => {
    const end = Math.max(...phones.map((p) => p.delaySec + cueLength(p.cue)));
    expect(end).toBeLessThan(5.5);
  });
});
