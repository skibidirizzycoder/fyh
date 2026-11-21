// loop.ts — fixed-timestep game loop.
// The simulation always advances in equal steps (e.g. 1/60 s), no matter
// how fast the screen refreshes. Drawing happens once per animation frame.

export interface StepPlan {
  steps: number; // how many fixed updates to run now
  accMs: number; // leftover time carried to the next frame
}

/** Works out how many fixed steps fit into the time that has passed. */
export function planSteps(accMs: number, elapsedMs: number, stepMs: number, maxSteps: number): StepPlan {
  const total = accMs + elapsedMs;
  const steps = Math.floor(total / stepMs);
  if (steps > maxSteps) {
    // We fell far behind (tab was hidden, debugger paused): drop the extra time.
    return { steps: maxSteps, accMs: 0 };
  }
  return { steps, accMs: total - steps * stepMs };
}

export interface LoopOptions {
  stepMs: number;
  maxSteps: number;
  update: () => void; // advance the game by exactly one step
  render: () => void; // draw the current state
}

export interface Loop {
  start(): void;
  stop(): void;
  /** While paused, time does not advance the game; only stepFrames() does. */
  pause(): void;
  resume(): void;
  isPaused(): boolean;
  /** Runs exactly n updates right now, then draws once. */
  stepFrames(n: number): void;
}

/** Creates a loop driven by requestAnimationFrame. */
export function createLoop(opts: LoopOptions): Loop {
  let accMs = 0;
  let lastMs: number | null = null;
  let rafId = 0;
  let paused = false;

  function frame(nowMs: number): void {
    const elapsed = lastMs === null ? 0 : nowMs - lastMs;
    lastMs = nowMs;
    if (!paused) {
      const plan = planSteps(accMs, elapsed, opts.stepMs, opts.maxSteps);
      accMs = plan.accMs;
      for (let i = 0; i < plan.steps; i++) opts.update();
    }
    opts.render();
    rafId = requestAnimationFrame(frame);
  }

  return {
    start: () => {
      lastMs = null;
      rafId = requestAnimationFrame(frame);
    },
    stop: () => cancelAnimationFrame(rafId),
    pause: () => {
      paused = true;
    },
    resume: () => {
      paused = false;
      accMs = 0;
    },
    isPaused: () => paused,
    stepFrames: (n: number) => {
      for (let i = 0; i < n; i++) opts.update();
      opts.render();
    },
  };
}
