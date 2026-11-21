# Teammate A — progress notes (phone look + The Static)

Branch: `feat/phone-static`. Waiting for the "Foundation: CD moments" commit on `main`
before writing code (it brings `PhoneState`, the CD JSON format and the stub files).

## Decisions

- **Phone shell:** silver clamshell. Brushed-silver gradient, dark hinge, grey keypad (0-9, *, #),
  bottom-right of the screen, `id="phone"`. Pale green LCD with dark pixel text, signal and
  battery icons, selected row inverted, fixed CDs marked with ★. Flip animation about 0.25 s
  (in the `phone` section of `src/tuning.ts`).

## The Static — draft text

cd:
  artist: The Static
  title: Feedback Summer
  moment: street_gig
  date: 2 July 2004
  situation: The Static are playing outside Hollow Records, but their battery amp keeps dying mid-chorus.

action 1 — static_plug_amp (objectId: static_cable_reel)
  prompt: Plug in the amp
  label: plugged The Static's amp into the shop
  line: You run the cable reel to the shop's outdoor socket. The amp hums, then ROARS. The singer gives you a thumbs up.
  lockedLine: (none — first step)

action 2 — static_give_mic (objectId: static_mic, requires static_plug_amp)
  prompt: Hand them the shop's mic
  label: handed The Static the shop's microphone
  line: Their mic was held together with tape. Yours works. The whole street turns round for the chorus.
  lockedLine: You could hand them a mic... but there's no point while their amp keeps dying.

offline newspaper:
  headline: Street Gig Outside Hollow Records Becomes Summer Legend
  article: The Static's "Feedback Summer" was recorded the week after their famous plugged-in gig outside Hollow Records. Fans still leave guitar picks on the shop's windowsill.

props (2004, moments: ['street_gig']), kept 0.02 apart:
  static_stage      low box ~3 x 0.3 x 2, in front of the right building
  static_amp        box on stage, near edge
  static_cable_reel interactable cylinder on the ground beside the stage
  static_drums      3 cylinders (kick + 2 toms) on stage
  static_mic        interactable thin cylinder stand at the front of the stage
  static_banner     thin box "THE STATIC" banner behind the stage
