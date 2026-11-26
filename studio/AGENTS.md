# PR clip studio

A Remotion 4.0.520 studio for before/after clips of pull requests. The `pr-clip` skill holds the procedure; this file holds the house rules the code enforces, and why. Where the two differ, this file wins.

## Setup and layout

- One folder per clip: `videos/<KEY>/props.json` (the only manifest) + `media/NN-before|after.(png|mp4)`; `out/`, `capture/` and `review.md` land there too. `videos/` stays out of git, except `videos/EXAMPLE/`.
- `npm run studio` previews EXAMPLE. `scripts/clip.sh <KEY>` (props, test, render, a still per beat, check, sheet) must exit 0, and every `check.sh` row must pass.
- Every `@remotion/*` package is pinned at 4.0.520. Read the Remotion licence before you upgrade, and before a company of more than 3 people uses this (remotion.dev/license).
- Every frame is a pure function of `useCurrentFrame()`: no CSS transitions or animations, timers, `Date` or `Math.random`; noise only with a fixed seed. `check.sh` renders one mid-motion frame twice and compares the md5.
- Colours only from `src/brand.ts`, the one file to swap for your own look. Easing and springs only from `brand.motion` / `brand.spring`. Schibsted Grotesk (OFL) is the only font.
- `identifiers.json` lists what must never leave in full (emails, long numbers; add your own). The agent context, the app identifier scan and the web prep scripts all read it. Write identifiers in notes and props in short form only: 4711…0042.

## Look

"Night studio": lively but clean, a product launch film rather than a template.

- One stage: near-black, with a teal and a blue glow and a faint amber one drifting slowly, fine grain and a soft vignette, all under the content. The grain takes a new fixed seed every 4th frame; it also dithers the glows, which band on their own.
- Frames are frosted glass: a translucent fill with a slight sheen, a 1 px light rim, a lit top edge and a deep soft shadow. A browser bar follows its capture (`dark` on it): light glass over a light page, dark over a dark one. The capture itself is shown as captured: no tint, glow, grain or vignette over it.
- Near-white text, muted and faint greys for the rest. Coral marks the problem and teal the fix, as small accents only: chip dots, brackets, the wipe's edge, the end card's dot. Of what sits over the stage, only these accents may glow, and softly.
- Motion runs on one spring (`brand.spring`: a 3.6 % overshoot, settled in about 20 frames) and the curves in `brand.motion`. One slight overshoot is the life; a bounce is not.
  - A beat's frames come in lying back 8°, a little low and small, and stand up flat. Once landed nothing is transformed, so the captures stay pixel-sharp. Going out they lift a few px as they fade, and they are gone before the next beat comes in: two windows at different angles over each other read as a double exposure.
  - Captions come in word by word, 1.5 frames apart, each sharpening from an 8 px blur as it rises, and fade over their last 6 frames. The poster and the beat stills wait until every word has landed.
  - The lean-in tilts a degree or two and softens for a few frames while it moves, both from its speed: at rest neither is there.
- Chips are small glass labels with a coloured dot, in sentence case.
- Banned looks: gradient or outlined text, a bounce, spins or flips, glitch or whip transitions, emoji, stock-music clichés, redrawn or fake UI, decoration over the captured UI that reads as part of the UI, text over moving footage, a decorative push-in (the pair lean-in below is the one camera move).
- Result first: the after state and the why within 3 s; no logo or intro card at the start. Before and after share viewport, data and zoom, carry a label, and swap with a hard cut or a wipe, never a fade.
- Changes are marked with corner brackets, never a closed ring or a halo: a ring reads as a UI border. Coral marks the problem and teal the fix; over a light page they take the deeper `ring.onLight` shades, since bright teal on white is 1.5:1. They sit 10 px clear of the element: thin strokes with a soft glow, each corner's arms drawing on while the box locks on with the brand spring.
  - A web page's brackets must fit its visible page; the timeline stops the render otherwise.
  - On a pair that leans in, the brackets on both sides blink twice and go as the lean-in lands (`focus.mark: "blink"`), so nothing stays over the UI. Where no lean-in follows (variants, the end card, a pair that can't lean in) they stay.
  - No spotlight that fades the rest of the page: viewers take the faded page for the real UI.
- One lean-in per pair, onto its first after-bracket, only once the after state has landed (never during the swap), in 1 s moves.
  - A web pair zooms to fit: the change fills about 70 % of the window (1.25–1.8×), and the camera pans it to the middle of the footage band without uncovering stage it could fill.
  - An app pair zooms to fit with one camera on the whole pair: both phones scale around the midpoint of their fixes, so they move apart as they grow and never overlap.
  - The chips fade, and the footage fades out above the caption band, which stays still.
  - No lean-in when it would push any bracket of the pair out of the footage band (into the caption fade, or past the frame's edge). `timeline()` decides. `focus: {}` in props.json keeps a clip on a plain 1.25× lean with steady brackets.
- A before that stays stuck for good (a skeleton that never resolves) shows the time passing: both recordings cut out the same stretch (`jump: {at, to}` on each capture), and each chip carries a clock from the tap (`clockAt`). The lean-in waits `jumpRead` frames past the cut.
- A thin segmented line at the top right marks the beats: one segment per pair, states or looks beat, past ones full, the current one filling as it plays. It fades out while a pair leans in and as the end card comes in. No acceptance-criteria numbers on a beat: they go wrong once the issue is edited.

## What a clip shows

- Every state, scenario, interaction and transition the PR built. The inventory is worked out from the diff's render branches, the PR description, the issue, the designs and the PR's screenshots (the skill's `references/inventory.md`). It is logged in `review.md` § vN before any capture: one row each, how to reach it, still or recording, and in or out with a reason. Ask the user only when the rules can't decide, for example a clip over 60 s.
- States and variants are after-only beats before the end card, from the after build, in files `media/vN-<label>.(png|mp4)`. Each beat is a labelled group of at most 3 frames under one caption. First the states the inventory keeps (data scenarios, then loading, error and empty), then the looks with the same data as pair 1. App: Light · Dark · second language. Web: second language, then tablet 1180×820 and mobile 412×823. A web PR shows the phone view too.
- Real recordings beat stills: whatever moves (a drag, typing, keys, a transition) is recorded, even when the clip gets longer. `scripts/web-record.js` films the page from timestamped screencast frames at 30 fps; the before plays out and holds its end state, then the after wipes in on its first frame and plays.
- App phones in states and looks beats stand taller than in a pair (820 px screens), and their tab bars fade out above the caption band. When any bracket in a beat would reach the fade, that beat keeps the pair's 740 px phones with no fade (`timeline()` decides).
- No React Native LogBox in any still or recording; the app's own toasts are fine. `scripts/logbox-clear.sh <udid>` must exit 0 right before each still, and before and after each recording.
- Captures from test accounts and test environments only. Hide an identifier in an app capture by blurring its measured rect, on stills and recordings alike. Never crop the phone's top or bottom for it: a cropped phone looks squat.

## Captions, voice, sound

- Captions are burned in: at most 2 lines of 42 characters, at most 17 characters per second. Text that overflows logs `FIT:` and fails the check.
- The voice reads every caption, with no music: music that isn't cut to the beat and has to duck under the voice for most of the clip sounds worse than none. Kokoro `af_heart` at `KOKORO_SPEED=0.9`.
  - `scripts/vo-captions.ts <KEY>` writes one line per caption, word for word (`vo-src/why.txt`, `pair-N.txt`, `variants-N.txt`), then `scripts/render-vo.sh <KEY>` reads them. Where Kokoro can't read a symbol or a label, props.json's `say` swaps it (`{ "≡": "handle" }`); log the swap in `review.md`.
  - `timeline()` fails a voice line that no longer says its caption, so after any caption edit both scripts run again.
  - A line starts 6 frames into its caption, and the caption holds until the line has ended. `render.sh` levels a voiced clip to −16 LUFS; `check.sh`'s `loudness` row checks it.
- Sounds come from the kit in `src/assets/sfx/` (`src/pr-clip/sounds.ts`): a tick on the first fix bracket and each states or looks beat, a swish on each web wipe, a snap as the end card's title lands. Three takes rotate per sound. A whoosh peaks on the wipe's fastest frame; no sound is heard more than one frame before its picture moves (`sounds.ts` stops the render).

## Format

- 15–60 s, 1920×1080, 30 fps, H.264 bt709; share copy ≤ 5 MB, GIF ≤ 2.5 MB, true peak ≤ −1.5 dBTP. Longer is fine when it shows real recordings, but over 60 s only on the user's say: `maxSeconds` in props.json lifts the cap, and the share copy may then take 5 MB per 60 s.

## End card

- A clip with `details` in props.json ends on the details card, set on type: a column at the left, centred top to bottom. A teal dot and the dateline (kind · key · milestone · capture day), the title rising word by word out of a mask, then the parent issue, the why, the PR, and the facts as glass tiles opened by a QR of `details.url` on a light panel, each coming in after the one before. Right: the first pair's after state again, with its brackets, floating in from the right at a slight angle and then drifting a few px a second. Nothing shows on the card until the dissolve is over, and nothing slides in from the left as a band. `qr: false` leaves the QR off.
- The facts come from GitHub and git, read-only (`scripts/props.ts`), and only from what exists when the clip is made, usually before review and merge. Nothing that can go stale once the clip is posted: no review status and no reviewers while the PR is open. Before the merge: Developer · Screen · Captured. After: Developer · Reviewers · Merged · Release or First build · Screen · Captured.

## Staying true

- Every clip records the commit it was captured from: `pr.commit` in props.json and a "Captured commit" line in `review.md`. `scripts/stale.sh` compares it with the PR.
  - A PR that moved stays `same-ui` when its new commits touch only files that never render (tests, stories, docs, CI), or a base-branch merge touches none of the clip's screens (the first three folders of each `state.files` entry), no file the PR changed, no shared components, theme, hooks or utils, no translations and no dependencies. Anything else is stale until the user says keep it: `pr.accepted` (`head`, `why`) in props.json.
  - When a posted clip goes stale, re-cut the beats `stale.sh` names, or take the posted clip down after the user's yes.
- The share copy carries the agent context for other people's agents inside the mp4, never as a separate file. `render.sh` writes the JSON from `scripts/context.ts` into its `comment` tag: per state the render branch, the files, the i18n keys and how the capture reached it (`state.reach`); once per clip the capture setup (`capture`), what the clip leaves out (`notShown`), the base commit and the design link. A clip with `pr` needs `capture` and a `reach` on every pair and capture.
- Nothing is posted anywhere (PR, issue, chat) before the user says yes, and never with a mention or tag.
