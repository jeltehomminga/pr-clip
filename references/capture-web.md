# Web captures: stills, recordings and interactions over CDP

Capture a web app's before and after sides from your own Chrome over the DevTools protocol, with identifiers blurred and both sides framed the same.

Run every command from the studio: `cd "${PR_CLIP_STUDIO:-$HOME/pr-clip-studio}"`. The scripts need no `NODE_PATH`: `ws` is a studio dependency. Files go in `videos/<KEY>/media/`.

## Your own Chrome

Start a Chrome of your own on port 9333 with a scratch profile. Never use the user's everyday browser or its debug port.

```bash
open -na "Google Chrome" --args --remote-debugging-port=9333 --user-data-dir=<scratch dir>
curl -s localhost:9333/json | jq -r '.[] | select(.type == "page") | .url'
```

- The user signs in to the test environment once, by hand, in that window. Keep the scratch dir between clips and the session stays.
- Chrome's own UI never shows in a CDP capture. What does show is in the page: the framework's dev indicator, cookie banners, chat bubbles, dev banners, toasts. `web-prep.js` hides them (§ Hide overlays).

## Dev server

- Run the dev server from the worktree (worktrees.md), one side at a time, on the same port. Auth providers usually accept one localhost callback, so both sides share it.
- Stop it and start it from the other worktree when you switch sides.
- A second language may live on another path. Find it in the app's routes or redirect config; don't guess.

## Stills

```bash
node scripts/cdp-shot.js 9333 <url-substr> videos/<KEY>/media/01-before.png \
  --viewport 1350x760@2 --settle 10000 \
  --eval "window.vsScrollY = <y>; $(cat scripts/web-prep.js)"
```

- That gives a 2700×1520 PNG of the viewport.
- Use the same viewport, scroll and settle on both sides.
- **The settle wait.** The viewport change makes the app re-render at the new breakpoint and fetch again. On one app a shot 500 ms after the change caught the page before hydration (header and greeting only); 10 s was enough there. Look at the shot before you trust it.
- `--eval` runs after the settle, right before the shot: a viewport change re-renders the page and would undo earlier DOM edits.

## Hide overlays and blur identifiers

`scripts/web-prep.js` runs in the page before a still:

- It hides the known dev overlays by name, plus every CSS selector in `window.vsHide`.
- It blurs every text that matches a pattern in `identifiers.json`, plus every selector in `window.vsBlur`.
- It scrolls to `window.vsScrollY`.
- It scans the text left on screen and prints `hidden N, other fixed N (…), blurred N, visible identifiers N`.

The output must read `visible identifiers 0`. Otherwise blur that element too, or reframe. Never ship it.

```bash
--eval "window.vsScrollY = 820; window.vsHide = ['#chat-launcher']; window.vsBlur = ['.account-switcher', '[data-testid=address]']; $(cat scripts/web-prep.js)"
```

- **"other fixed"** lists fixed elements it didn't hide. A new overlay there (a chat launcher, a cookie banner) gets its selector in `window.vsHide`.
- It never hides "everything fixed". Dialogs, drawers, menus and snackbars are fixed too, and may be what the PR changed.
- A dialog that shows an address or account number needs its own `window.vsBlur` entry in the same `--eval`.
- Add your product's own patterns to `identifiers.json`: customer numbers, IBANs, phone numbers. Write identifiers in notes and props in short form only: 4711…0042.

## Stubs

For a state the test environment can't produce, answer the request in the tab with `scripts/cdp-stub.js`. It is real UI on stubbed data: say so in `review.md` and in the state's `reach`.

```bash
node scripts/cdp-stub.js 9333 <url-substr> '*/api/subscriptions*' videos/<KEY>/stub-subscriptions.json
node scripts/cdp-stub.js 9333 <url-substr> '*/api/settings*' videos/<KEY>/stub-error.json --status 500 --method POST
node scripts/cdp-stub.js 9333 <url-substr> '*/api/profile*' videos/<KEY>/stub-flag.json --merge
```

- It answers every matching request with the body, across navigations, until you stop it (Ctrl-C or `kill`).
- **Error state:** `--status 500 --method POST` answers only the save. A GET of the same URL still reaches the server.
- **One flag on in a real answer:** `--merge` with a body like `{"canEdit": true}` merges those fields over the real JSON and keeps its status. A non-2xx or non-JSON answer passes untouched.
- **Two routes** means two `cdp-stub.js` processes on the same tab, in any order. Each start reloads the page, so start every stub before you set up page state.
- Only requests from the browser pass through it. Data the server fetches during server-side rendering never does.
- **Before any submit**, prove the request never left the browser: the page gets the stub's body back, and the dev server's log doesn't show the call.

## Recordings

Record a page load with `scripts/web-record.js`:

```bash
node scripts/web-record.js 9333 <url-substr> videos/<KEY>/media/01-before.mp4 \
  --viewport 1350x760@2 --seconds 7 --prep scripts/web-prep-live.js --reload
```

- `--reload` reloads the page once the screencast runs. That is how you film a widget that loads with the page. Trim the white reload frames off the start.
- `--prep` injects the script on every new document, and runs it once on the page as it is.
- `scripts/web-prep-live.js` is `web-prep.js` for a recording. It hides the overlays and blurs identifiers from the first paint. It applies again every 50 ms for 20 s, because the app keeps adding nodes while it loads.
- For per-clip selectors, write a prep file for the clip and pass that:

  ```bash
  { echo "window.vsHide = ['#chat-launcher']; window.vsBlur = ['.greeting', '.address-line'];"; cat scripts/web-prep-live.js; } > videos/<KEY>/capture/prep-live.js
  ```

  A greeting with the user's first name or an address line under a card is easy to miss; a still scrolls them away, a page load shows them.
- Takes start at scroll 0.

**Drive the state with the request itself.** To show a loading state turning into content, hold the request in a CDP `Fetch.enable` interceptor for N ms, then pass it through (`Fetch.continueRequest`) or answer it (`Fetch.fulfillRequest`). Use the same N on both sides. Keep the interceptor as a script in `videos/<KEY>/capture/`.

**Trims.**

- Run `node scripts/capture-check.js <KEY>`: per recording it prints motion runs and rest frames. For a region it has no probe for, run `node scripts/frame-probe.js <mp4> --crop W:H:X:Y` on the changed component's crop and on the full page.
- Start both sides at the same load phase: the first content frame, usually the skeleton.
- End about 36 frames after the change.
- Give each bracket a `delay`: the frames until its element shows in the trimmed clip.
- Then `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/props.ts <KEY>` makes the hold stills (`scripts/extract-holds.sh`).

**Why `web-record.js` and not a plain screencast recorder.** A recorder that writes frames at a fixed rate drops frames when a capture runs slow, and the one tried first also scaled to 900 px.

**Why the screencast timestamps.** A screencast only emits a frame on a repaint. A static state is one or two frames; played at a fixed rate, it flashes by. `web-record.js` holds each frame until the next frame's timestamp, through a hard-linked 30 fps sequence, so a state stays on screen exactly as long as it did in the browser. ffmpeg's concat demuxer was tried first: it stretched durations under 40 ms, and a 7 s take came out 11.3 s.

**Timing cost.** A recorded before pushes the after past the 3 s result-first mark (4.5 s on one clip). That is accepted for a transition: the transition is the point.

## Interactions

Drive the take from a second CDP session while `web-record.js` films: start the recorder, wait 0.8 s, run the driver. Use the same driver and timings on both sides. Write it as `videos/<KEY>/capture/drive.js`, with `Input.dispatchMouseEvent`, `Input.dispatchKeyEvent`, `Input.insertText` and `Input.dispatchTouchEvent`.

- **Mouse.** Screencast frames carry no cursor. The driver injects a grey dot that follows `pointermove` and stands in for it. Click a field in its left padding, so the dot leaves the text clear.
- **Keys.** Show them the way CleanShot X does: a dark pill with white key names.
  - One burst adds up ("Tab → → → End"), and the newest key pops in.
  - The pill stays 2.5 s after the last key, so the held end frame still shows what was pressed.
  - Without it, the before side of a keyboard pair looks frozen, and the after side seems to move by itself.
  - Put the pill where the lean-in keeps it in view. CleanShot's bottom centre falls into the caption fade; the changed card's top right worked.
  - Start from a focus point a user would have: give the element before the control `tabindex=-1` and no outline, and focus it, as after a click on it. Then press Tab.
- **Phone.** `node scripts/web-record.js … --mobile --viewport 412x823@2 --prep scripts/web-prep-live.js`.
  - The recorder owns the phone override and touch emulation. An override set from another CDP session ends when that session closes, and flips the layout back mid-take.
  - The page re-lays out when the take starts (the recorder waits 1 s for it). So the driver preps about 2 s after the recorder starts: scroll the control to mid-screen, put up the finger mark, check the identifier count is 0. Trim the re-layout and the scroll off the start.
  - Touch with `Input.dispatchTouchEvent`. The driver shows a grey circle while a touch is down.
- **Record both sides even when you expect no difference.** On one clip the old slider also followed a finger. The phone view became an after-only Mobile beat, and the recorded before went into `notShown`.

## Takes you can replay

Write each take as a script in `videos/<KEY>/capture/` the moment it works, never as a one-off command. A re-cut then runs it on the new head instead of working it out again.

- `take.sh <before|after> …` reloads the page, starts `web-record.js` and runs the driver's phases.
- `stills.sh <side>` takes the stills with their scroll.
- The script's header names every phase and its argument. `review.md` names the script, not the commands.

## Variants

Variants are after-only, from the after build.

- **States beats** come first, in the order the inventory sets: `vN-<state>.png`, or `.mp4` for a recording.
- **Second language** in the pair's own frame: `v1-<lang>.png` with its own `url` in `props.json`.
- **Tablet and mobile**, both with `--mobile`:
  - Tablet: `--viewport 1180x820@2` → `v2-tablet.png`.
  - Mobile: `--viewport 412x823@2` → `v2-mobile.png`. Use `web-record.js --mobile` when the PR changes an interaction.
  - A narrow window gets a short `url`.
  - Check which breakpoint each width falls in. On one app, 1180 px fell in its 900–1199 px band and showed the hamburger header, not the desktop nav.
- **Dark**, only when the web app has a dark theme.

## Brackets

Brackets are `rings` in `props.json`, in the file's own pixels. Every capture and every variant gets its own, measured on itself with `scripts/measure-bounds.js`. Never read them off a preview: one placed from an eyeballed preview was 15 px off, and nobody saw it until the encoded video.

- **A bracket wraps the whole component.** `--probe X,Y` walks from the probe pixel until it meets another colour.
  - Put the probe in padding that runs the full height: beside a full-width button, not above it, or the walk ends at the button. On one clip, consent boxes were bracketed down to their button only.
  - A rounded corner bites a few px off a probe column near the edge. Take the top from a probe further in.
  - Never probe on text or an icon: a glyph ends the walk early.
  - `--bg X,Y` names a background pixel, so border and shadow count as card: the outer edge.
  - Dark mode cards differ little from the page: lower `--tolerance` (6 worked).
- **A list card with row dividers:** measure each row and join them (`202,592 2296×194` was two rows).
- **What no walk can take**: a line of text (an error message under a field), a dashed outline, a white card on a white sheet. Take the bounding box of the non-background pixels in a region, then look at the drawn rect before it goes into props:

  ```bash
  node scripts/measure-bounds.js <png> --region X,Y,W,H --tolerance 10 --rows --draw videos/<KEY>/qa/rect.png
  ```

  `--rows` shows where one card ends and the next begins, so start the region in the gap above the card. On the app, take the region from the element's `describe` frame.
- **A web page's brackets must fit its visible page.** The timeline stops the render otherwise.
- **A bracket on an element that appears mid-recording** gets a `delay`: the frames until it shows in the trimmed clip.
- Measure on a PNG when you have one. A still cut from an h264 clip bleeds a pixel at the edges.

## Re-cut a stale clip

A clip goes stale when the PR gets new commits after the capture. Start from `scripts/stale.sh <KEY>`. Its stale line names the files that may change the UI, and the beats whose `state.files` they hit.

- **Take again only the beats it names**, on the new head, with the clip's own take scripts (§ Takes you can replay, capture-app.md § Takes you can replay). Every other file in `media/` stays, with its brackets and trims.
- **Before side:** when the merge-base hasn't moved (`git merge-base <new head> origin/<base>` is `pr.base`), keep every before file. Otherwise take the named beats' before sides again too.
- **Same pixels, no re-cut:** when a re-taken file's change crop has the same md5 as the old one, the UI didn't change. Keep the old file, and ask the user for `pr.accepted` (`head`, `why`) instead.
- Measure brackets and trims again on the re-taken files only.
- Set `pr.commit` (and `pr.base` if it moved) to the new commits. Log the re-taken beats and why under `review.md` § vN "Re-cut".
