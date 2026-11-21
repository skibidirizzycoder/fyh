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

  news: {
    endpoint: 'api/headline', // relative, so it works under any base path
    timeoutMs: 3000, // browser gives up and prints the offline edition after this
    serverTimeoutMs: 2800, // server gives up on Snowflake a little earlier
    pingTimeoutMs: 20000, // the manual `npm run snowflake:ping` waits longer
    model: 'mistral-large2', // default Cortex model; override with SNOWFLAKE_MODEL
    maxTokens: 300,
    temperature: 0.7,
    headlineMaxChars: 100,
    articleMaxChars: 700,
    paper: '#f3ecd9', // newspaper panel: light paper, dark ink
    ink: '#1d1a14',
    offlineInk: '#8a1c1c', // "offline edition" label
  },

  pitch: {
    maxAutopilotSec: 45, // smoke: playing the demo route (2 CDs) must take at most this much game time
    readSec: 2.5, // smoke: pause after each line of dialogue, as if the presenter reads it
    route: ['ringtone', 'open_mic'], // the moments the pitch demo fixes, in order (see docs/PLAN.md)
  },

  // ---- Teammate A's sections ----
  phone: {
    flipSec: 0.25, // open/close animation time
    keyFlashSec: 0.15, // how long a keypad key stays pressed down after a move
    widthPx: 220, // whole phone; stays under 300 px
    rightPx: 16, // gap to the window's right edge
    bottomPx: 104, // sits above #dialogue (bottom centre), so they never overlap
    compactBelowPx: 680, // windows shorter than this get a smaller phone...
    compactScale: 0.8, // ...scaled by this much
    shellLight: '#e9ecef', // brushed-silver shell: gradient from light...
    shellDark: '#9aa1a9', // ...to dark
    shellEdge: '#6b7178',
    hinge: '#2b2f35',
    lcd: '#c7e0a3', // pale green LCD (background of all LCD text)
    lcdInk: '#1f2a14', // dark pixel text; the selected row swaps the two
    keyFace: '#d5d9de',
    keyInk: '#1d2024',
    keyLetters: '#4a5058',
    callKey: '#2f9e44',
    endKey: '#c92a2a',
  },
  static: {
    // The Static's street gig, 2 July 2004 (props in src/world/props/static.ts).
    stage: '#3b3f47', // low wooden-pallet stage, painted black-ish
    amp: '#1c1c1f',
    ampDead: '#e03131', // the amp's light while it keeps cutting out...
    ampLive: '#51cf66', // ...and once it's plugged into the shop
    cableReel: '#f08c00', // bright orange site reel, easy to spot
    cable: '#f08c00',
    socket: '#dee2e6',
    drum: '#c92a2a',
    cymbal: '#fcc419',
    stand: '#868e96', // cymbal and mic stands
    band: ['#364fc7', '#5f3dc4'], // singer, guitarist
    skin: '#e9b48a',
    guitar: '#e8590c',
    banner: '#ff6b6b', // hand-painted banner behind the stage
    crowd: ['#2b8a3e', '#d6336c', '#1971c2'], // people who stop to watch once the mic works
  },
  mira: {
    // Mira's open mic, 14 March 2004 (props in src/world/props/mira.ts).
    cd: '#d0d8e0', // her dropped demo CD on the bench
    listeningPost: '#8a3fb0',
    sign: '#ffd166', // "OPEN MIC" board on the listening post
    flyer: '#ff5fa2',
    micStand: '#868e96',
    amp: '#2b2b30', // small practice amp by the window
    wire: '#2a2a2a', // string lights' wire
    bulbs: ['#ffe066', '#ffa94d', '#fff3bf'], // warm bulbs, repeated along the wire
    mira: '#c2255c', // Mira's coat
    skin: '#d9a07b',
    guitar: '#a0522d', // acoustic guitar body
    neck: '#5c3a1e',
    listeners: ['#495057', '#1864ab', '#5f3dc4'], // the bored crowd
    phoneGlow: '#a5f3fc', // their phone screens: everyone's looking down
  },
  screens: {
    // Title, "Because you..." card, newspaper and ending (src/ui/). Owner: Teammate A.
    titleVariant: 'lcd' as 'lcd' | 'colour', // the team picks: artifacts/title-variants.png shows both
    bootSec: 1.2, // the boot progress bar fills in this long (then "Press Enter" blinks)
    blinkSec: 1.1, // one on/off cycle of "Press Enter"
    backdrop: '#0b0b0f', // behind the title and the ending
    // 'lcd' title: the phone's own green LCD (T.phone.lcd / lcdInk), with a dark bezel
    bezel: '#2b2f35',
    // 'colour' title: a 2004 colour screen
    colourTop: '#1c4fd8',
    colourBottom: '#0a1f5c',
    colourText: '#ffffff',
    colourAccent: '#ffd43b',
    // dusty CDs on the title
    cdDusty: '#9aa0a6',
    cdHub: '#4b5057',
    // tabloid: card + newspaper
    tabloidPaper: '#ffffff',
    tabloidInk: '#111111',
    tabloidRed: '#c8102e', // red-top masthead (white text on it: 5.8:1)
    tabloidRedText: '#ffffff',
    sticker: '#ffe14d', // "EXCLUSIVE" sticker (dark text on it)
    // ending: the wall of gold discs
    wall: '#2a1218',
    gold: '#ffcc33',
    goldDeep: '#b8860b',
    frame: '#111111',
    mat: '#f1ece1',
    caption: '#fff3bf',
  },

  limits: {
    maxDrawCalls: 60, // smoke fails above this
  },

  // --- Teammate B: all sound, generated in code (no sound files) ---
  // Notes are MIDI numbers (60 = middle C, 69 = A 440 Hz). Times in seconds, gains 0..1.
  // Song parts are lists of [step, note, lengthInSteps]; a step is one 16th note.
  audio: {
    master: 0.5, // overall volume
    muteKey: 'KeyM',
    ringtoneActions: ['kbit_ring_bus_stop'], // finishing these actions plays the ringtone instead of the chime
    attackSec: 0.005, // every note fades in this fast (no clicks)
    releaseSec: 0.05, // ...and fades out this fast
    beep: { note: 88, sec: 0.06, gain: 0.18, wave: 'square' }, // keypad (phone-move)
    blip: { note: 81, toNote: 93, sec: 0.08, gain: 0.2, wave: 'square' }, // select (phone-select)
    flipOpen: { note: 52, toNote: 64, sec: 0.05, gain: 0.3, noiseSec: 0.04, noiseGain: 0.35, noiseHz: 3200 },
    flipClose: { note: 64, toNote: 45, sec: 0.06, gain: 0.35, noiseSec: 0.05, noiseGain: 0.4, noiseHz: 1800 },
    ringtone: {
      // An ORIGINAL 2-bar polyphonic ringtone (A minor: Am - F - C - G). Up to 4 notes at once.
      bpm: 140,
      melody: { wave: 'square', gain: 0.16, notes: [
        [0, 76, 2], [2, 79, 1], [3, 81, 1], [4, 76, 2], [6, 74, 2], [8, 72, 2], [10, 74, 1], [11, 76, 3],
        [16, 81, 2], [18, 79, 1], [19, 76, 1], [20, 79, 2], [22, 81, 1], [23, 84, 3], [26, 83, 2], [28, 81, 4],
      ] },
      bass: { wave: 'triangle', gain: 0.3, notes: [
        [0, 45, 3], [4, 45, 3], [8, 41, 3], [12, 41, 3], [16, 48, 3], [20, 48, 3], [24, 43, 3], [28, 43, 3],
      ] },
      chords: { wave: 'square', gain: 0.07, notes: [
        [2, 60, 1], [2, 64, 1], [6, 60, 1], [6, 64, 1], [10, 57, 1], [10, 60, 1], [14, 57, 1], [14, 60, 1],
        [18, 64, 1], [18, 67, 1], [22, 64, 1], [22, 67, 1], [26, 62, 1], [26, 67, 1], [30, 62, 1], [30, 67, 1],
      ] },
    },
    whoosh: { sec: 0.9, gain: 0.8, fromHz: 250, toHz: 5000, q: 4 }, // travel: filtered noise sweep
    chime: { notes: [76, 81, 88], gapSec: 0.08, sec: 0.5, gain: 0.2, wave: 'sine' }, // action-done
    nope: { notes: [50, 46], gapSec: 0.12, sec: 0.14, gain: 0.2, wave: 'square' }, // action-locked
    fanfare: { notes: [67, 72, 76, 79, 84], gapSec: 0.1, sec: 0.35, gain: 0.18, wave: 'square', delaySec: 0.7 }, // reputation; waits for the travel whoosh
    ambience: {
      fadeSec: 1.2, // crossfade when you travel
      loopSec: 2, // length of the looping noise buffers
      seed: 2004, // crackle is random but the same every run
      '2004': { humHz: 55, humGain: 0.035, noiseGain: 0.03, noiseLowpassHz: 1200, cracklePerSec: 9, crackleGain: 0.12 },
      present: { humHz: 0, humGain: 0, noiseGain: 0.012, noiseLowpassHz: 6000, cracklePerSec: 0, crackleGain: 0 },
    },
  },

  // --- Teammate B: DJ K-Bit's moment, "5 December 2004" (where props stand: src/world/props/kbit.ts) ---
  kbit: {
    shelterGlass: '#7f9fb0',
    shelterFrame: '#3b4048',
    shelterRoof: '#2f343b',
    signPole: '#2a2a2a',
    sign: '#e23b3b', // the bus stop sign: interactable
    people: ['#5a6fa8', '#a8605a', '#6a9a62', '#9a7ab8'], // the queue, one coat colour each
    flipPhone: '#c0c6cc', // everyone in the queue has one
    kbitBody: '#1e1e28',
    headphones: '#39ff88', // neon, very 2004
    kbitPhone: '#ffd23f', // K-Bit's phone: interactable
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
