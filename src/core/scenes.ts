// scenes.ts — a tiny scene manager (title -> play -> ending -> title ...).
// Each scene can enter() and update(); update() returns the name of the
// next scene, or null to stay where it is.

export interface Scene<Name extends string, Ctx> {
  enter?: (ctx: Ctx) => void;
  update: (ctx: Ctx) => Name | null;
}

export interface SceneManager<Name extends string> {
  current(): Name;
  go(name: Name): void;
  update(): void;
}

/** Creates a manager that starts in scene `first`. */
export function createSceneManager<Name extends string, Ctx>(
  scenes: Record<Name, Scene<Name, Ctx>>,
  first: Name,
  ctx: Ctx,
): SceneManager<Name> {
  let current = first;

  function go(name: Name): void {
    current = name;
    scenes[name].enter?.(ctx);
  }

  go(first);
  return {
    current: () => current,
    go,
    update: () => {
      const next = scenes[current].update(ctx);
      if (next !== null && next !== current) go(next);
    },
  };
}
