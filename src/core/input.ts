// input.ts — keyboard and mouse input map.
// Game code asks about *actions* ("interact"), never raw keys ("KeyE"),
// so controls can be remapped in one place. Mouse buttons are named
// "Mouse0" (left), "Mouse1" (middle), "Mouse2" (right).

export const KEY_MAP = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  turnLeft: ['KeyA', 'ArrowLeft'],
  turnRight: ['KeyD', 'ArrowRight'],
  interact: ['KeyE', 'Mouse0'],
  phone: ['KeyQ'], // flip the phone open: travel between eras
  start: ['Enter', 'Space'],
} as const;

export type Action = keyof typeof KEY_MAP;

const ACTIONS = Object.keys(KEY_MAP) as Action[];

/** Lists the actions a key or mouse code triggers (usually zero or one). */
export function actionsForCode(code: string): Action[] {
  return ACTIONS.filter((a) => (KEY_MAP[a] as readonly string[]).includes(code));
}

export interface Input {
  /** True while any key for this action is held. */
  isDown(action: Action): boolean;
  /** True if the action was pressed since the last endStep(). */
  wasPressed(action: Action): boolean;
  /** Presses a code; the real keyboard/mouse and the debug API both use this. */
  press(code: string): void;
  release(code: string): void;
  releaseAll(): void;
  /** Clears one-shot presses; call once after each fixed update. */
  endStep(): void;
}

/** Creates input state and, if given a window, listens to its keyboard and mouse. */
export function createInput(target?: Window): Input {
  const held = new Set<string>();
  const pressed = new Set<Action>();

  function press(code: string): void {
    if (!held.has(code)) actionsForCode(code).forEach((a) => pressed.add(a));
    held.add(code);
  }

  function release(code: string): void {
    held.delete(code);
  }

  const input: Input = {
    isDown: (action) => KEY_MAP[action].some((code) => held.has(code)),
    wasPressed: (action) => pressed.has(action),
    press,
    release,
    releaseAll: () => held.clear(),
    endStep: () => pressed.clear(),
  };

  if (target) listen(target, input);
  return input;
}

/** Wires browser events to an Input. */
function listen(target: Window, input: Input): void {
  target.addEventListener('keydown', (e) => {
    if (actionsForCode(e.code).length > 0) e.preventDefault(); // stop arrows scrolling the page
    input.press(e.code);
  });
  target.addEventListener('keyup', (e) => input.release(e.code));
  target.addEventListener('mousedown', (e) => input.press(`Mouse${e.button}`));
  target.addEventListener('mouseup', (e) => input.release(`Mouse${e.button}`));
  target.addEventListener('blur', () => input.releaseAll()); // no stuck keys after alt-tab
}
