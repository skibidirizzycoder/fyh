// lanes.ts — who owns which files. The single source of truth for `npm run ship`
// (and docs/LANES.md explains it). Patterns: exact paths, `dir/**`, or `*` inside a name.

export interface Lane {
  name: string;
  person: string;
  branch: string;
  owns: readonly string[];
}

/** Files every lane may edit, but only its own part (its tuning sections, its STATUS section, ...). */
export const SHARED: readonly string[] = ['src/tuning.ts', 'STATUS.md'];

export const LANES: readonly Lane[] = [
  {
    name: 'phone-static',
    person: 'Teammate A',
    branch: 'feat/phone-static',
    owns: [
      'src/phone/view.ts', 'src/phone/phone.css',
      'src/story/cds/static.json', 'src/world/props/static.ts',
      'src/story/cds/mira.json', 'src/world/props/mira.ts', // Mira's moment (handed over from Claude)
      'src/ui/**', 'index.html', // title, card, newspaper, ending (handed over from Claude)
      'scripts/checks/phone.ts', 'scripts/checks/static.ts', 'scripts/checks/mira.ts', 'scripts/checks/ui.ts',
      'tests/phone*.test.ts', 'tests/static*.test.ts', 'tests/mira*.test.ts', 'tests/ui*.test.ts',
      'docs/notes/teammate-a.md',
    ],
  },
  {
    name: 'sound-kbit',
    person: 'Teammate B',
    branch: 'feat/sound-kbit',
    owns: [
      'src/audio/**', 'public/music/**',
      'src/story/cds/kbit.json', 'src/world/props/kbit.ts',
      'src/world/props/today.ts', 'src/story/content.json', // today's shop; in content.json ONLY the "reputation" entries
      'scripts/checks/audio.ts', 'scripts/checks/kbit.ts', 'scripts/checks/music.ts', 'scripts/checks/today.ts',
      'tests/audio*.test.ts', 'tests/kbit*.test.ts', 'tests/music*.test.ts', 'tests/today*.test.ts',
      'docs/notes/teammate-b.md',
    ],
  },
];

/** True when a repo path matches an ownership pattern. */
export function matches(path: string, pattern: string): boolean {
  const re = pattern
    .split('**')
    .map((part) => part.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*'))
    .join('.*');
  return new RegExp(`^${re}$`).test(path);
}

/** The lane that works on a branch, if any. */
export function laneForBranch(branch: string): Lane | undefined {
  return LANES.find((l) => l.branch === branch);
}

/** The paths a lane is NOT allowed to change. */
export function outsideLane(lane: Lane, paths: readonly string[]): string[] {
  const allowed = [...lane.owns, ...SHARED];
  return paths.filter((p) => !allowed.some((pattern) => matches(p, pattern)));
}
