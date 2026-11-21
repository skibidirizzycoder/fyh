// loop.test.ts — the fixed timestep runs whole steps and keeps the remainder.
import { describe, expect, it } from 'vitest';
import { planSteps } from '../src/core/loop.ts';

describe('planSteps', () => {
  it('runs one step per step-length of time and carries the rest', () => {
    const plan = planSteps(0, 25, 10, 5);
    expect(plan.steps).toBe(2);
    expect(plan.accMs).toBeCloseTo(5);
  });

  it('adds carried time to the next frame', () => {
    expect(planSteps(5, 5, 10, 5).steps).toBe(1);
  });

  it('caps steps after a long pause and drops the extra time', () => {
    expect(planSteps(0, 10_000, 10, 5)).toEqual({ steps: 5, accMs: 0 });
  });
});
