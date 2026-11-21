// tuning.ts — the ONE place for every gameplay number, colour and timing.
// Game code reads values from here; it never hard-codes them.
// Units: metres (Three.js units), seconds, degrees. Colours are hex strings.
// (Where props stand lives in src/world/layout.ts; the story lives in src/story/content.json.)

export const T = {
  loop: {
    stepsPerSecond: 60, // fixed simulation rate
    maxStepsPerFrame: 5, // after a long pause, drop time instead of spiralling
  },

  player: {
    speed: 3, // metres per second
    turnSpeedDeg: 150, // degrees per second (A/D)
    startX: 0,
    startZ: 3,
    startYawDeg: 0, // 0 = facing -Z (towards the shop)
    radius: 0.35,
    height: 1.6,
    interactRange: 2.2, // metres from player centre to object centre
    interactConeDeg: 70, // object must be within +/- this angle of facing
    bodyColor: '#f2f2f2',
    noseColor: '#ff8a3d', // the nose shows facing
  },

  camera: {
    fovDeg: 60,
    distance: 4.5, // behind the player
    height: 2.6, // above the ground
    lookHeight: 1.2, // point on the player the camera aims at
    near: 0.1,
    far: 60,
  },

  world: {
    groundWidth: 16,
    groundDepth: 12,
    groundThickness: 0.1,
    surfaceGap: 0.02, // gap between touching surfaces: prevents z-fighting (rule: >= 0.01)
    markerHeight: 0.5, // floating marker above interactables
    markerSize: 0.15,
    markerBobHz: 1,
    markerBobAmount: 0.08,
  },

  eras: {
    '2004': {
      label: '2004',
      sky: '#d9a066',
      fogNear: 12,
      fogFar: 40,
      sunColor: '#ffd9a0',
      sunIntensity: 2.4,
      ambient: 0.9,
      tint: [1.1, 0.97, 0.8], // post filter: warm
      saturation: 0.8,
      grain: 0.09, // post filter: grainy
      vignette: 0.45,
      badgeText: '#ffcf7a',
    },
    present: {
      label: 'TODAY',
      sky: '#a9c8e8',
      fogNear: 18,
      fogFar: 50,
      sunColor: '#e8f2ff',
      sunIntensity: 2.6,
      ambient: 1.0,
      tint: [0.93, 1.0, 1.08], // post filter: cool
      saturation: 1.05,
      grain: 0, // post filter: clean
      vignette: 0.15,
      badgeText: '#bfe6ff',
    },
  },

  interact: {
    highlightColor: '#fff2a8', // emissive glow on the targeted object
    highlightIntensity: 0.9,
    markerColor: '#ffe14d', // every interactable has a bobbing marker; decoration never does
  },

  timing: {
    dialogueSec: 4, // how long a dialogue line stays up
    endingDelaySec: 5, // time on the "because you..." card before the ending
  },

  limits: {
    maxDrawCalls: 60, // smoke fails above this
  },

  ui: {
    panel: 'rgba(12, 12, 16, 0.88)',
    text: '#f4f4f6',
    textDim: '#c9c9d1',
    accent: '#ffe14d',
    fontFamily: 'system-ui, sans-serif',
    minContrast: 4.5, // smoke fails below this, measured on rendered pixels
  },
} as const;

export type Era = keyof typeof T.eras;
export const ERAS = Object.keys(T.eras) as Era[];
