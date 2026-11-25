# App captures: React Native and Expo on a simulator or emulator

Capture an app's before and after sides on a clean device clone, with a clean status bar, no LogBox, no identifiers, and takes you can replay.

Run every command from the studio: `cd "${PR_CLIP_STUDIO:-$HOME/pr-clip-studio}"`. Files go in `videos/<KEY>/media/`. `<udid>` is an iOS simulator, `<serial>` an Android emulator; `<device>` is either.

## Tools

- **argent** drives the device: describe, tap, swipe, screenshot, record, e2e YAML, debugger-evaluate.
  - Install: `npm i -g @swmansion/argent && argent init -y`. By Software Mansion; the source is Apache-2.0, some binaries are proprietary. Check its terms for your use.
  - Once per machine: `argent disable video-watermark` and `argent telemetry disable`. With the watermark on, "Argent / By @swmansion" sits bottom-left in every frame of a recording; screenshots never carry it. `argent flags` shows the state.
  - Run its CLI from a cwd outside any repo (`cd /tmp && argent run …`), so recordings land in `~/.argent/recordings/`. Through its MCP server it writes them into the repo's `.argent/recordings`: move each one into `media/` right after `screen-recording-stop`.
- **simslim** makes a clean simulator clone per clip: `brew install mobai-app/tap/simslim` (MIT).

## Device: its own clone per clip

**iOS.** Keep one golden simulator: slim, dev client installed, signed in to the test environment, autocorrect off, theme following the system. Clone it per clip:

```bash
simslim clone <golden udid> clip-<KEY>
```

- About 30 s; the clone boots with its login in under 10 s.
- Never use the user's own simulator, nor a device another session has booted. Then there is nothing to ask.
- Delete it at teardown, after the user's review: `xcrun simctl delete <udid>`.
- Without clones, clips lost 3–17 min each to device questions, a shared simulator, sign-ins again and port clashes. On their own clones they lost none of that.
- **Never `xcrun simctl clone` for this.** The clone keeps the original's absolute paths in its LaunchServices and FrontBoard databases, so its app runs the original's binary and writes the original's data. `simslim clone` rebases those paths and keeps the dev client and the login. Checked: the clone's app bundle, data container, running binary and open files were all under its own UDID, and 0 files were written in the original's folder.
- Without simslim: create a fresh device, install the kept dev client (worktrees.md § Kept dev clients) and sign in once by hand. That took 5 min.
- Variant simulators (dark, second language, iPad) booted side by side: slim them too. Three simulators with the app took 7.2 GB slim, against 12.8 GB stock.
- With two simulators booted, `booted` is ambiguous: pass the udid to every argent, `simctl` and script call.

**Android.** Use one emulator as it is. A slimmed emulator saved only about 0.4 GB of its 3 GB real cost.

- A second emulator of the same AVD at once needs `-read-only` on every instance, which throws the changes away at exit. If one already runs without it, ask the user.
- Never `-no-window`.
- Animation scales can come back as 0 from the AVD snapshot (reduced motion). Set all three to 1 before the app starts, and back to what you found at teardown:

  ```bash
  for s in window_animation_scale transition_animation_scale animator_duration_scale; do adb -s <serial> shell settings put global $s 1; done
  ```

## Both sides at once

Two clones (`clip-<KEY>` for the after, `clip-<KEY>-base` for the before), two worktrees (worktrees.md) and two Metros on two ports. `sides` in `takes.json` names each device, port and worktree, so nothing restarts or moves between the sides. One clip lost about 5 min waiting on those swaps.

- Takes still record one at a time: run `app-takes.sh` for one side, then the other. Two recordings at the same moment are untested.
- Android: only when a second emulator can run `-read-only`. Otherwise one emulator, one side after the other.

## Metro and the dev client

Start Metro from the worktree on an unusual port of the clip's own (8401, 8402, …):

```bash
lsof -iTCP:<port> -sTCP:LISTEN          # must print nothing
cd <worktree> && APP_VARIANT=<variant> CI=1 npx expo start -c --port <port>
curl -s localhost:<port>/json            # once the app is up: only your device
```

- Under `CI=1` a taken port only logs a line, hence the `lsof` check. Another session once ran Metro on 8082, and another session's simulator re-attached to a clip's Metro on its old port.
- One Metro per device. With two devices on one Metro, argent refuses a udid and wants the logical id.
- Pass `--port` to argent's debugger calls.
- With `CI=1` Metro doesn't watch files and `/reload` does nothing. Restart Metro after the worktree moves between commits, and cold-start the app when a state needs a fresh mount.
- If the app's logger reads env vars, turn its noisy categories off in Metro's process env (no file edit) while you force states, so the forced calls raise no LogBox.

Open the dev client with its full URL. The launcher remembers the last port it used, so never rely on it.

```bash
xcrun simctl openurl <udid> '<scheme>://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A<port>&disableOnboarding=1&disableAutoLaunch=1&__expo_disable_fab=1'
adb -s <serial> shell am start -a android.intent.action.VIEW -d "'<same link>'" <bundleId>
```

- `<scheme>` is the dev client's scheme (`exp+<slug>` by default); put it in `takes.json`'s `app.scheme`.
- `disableOnboarding=1` and `disableAutoLaunch=1` keep the dev menu closed at launch, then and on later launches (saved in its prefs). An open dev menu hides the app from `describe`.
- `__expo_disable_fab=1` keeps the floating Tools gear out of the frames, for this launch only. To turn it off for good on iOS: `xcrun simctl spawn <udid> defaults write <bundleId> EXDevMenuShowFloatingActionButton -bool NO`, then restart the app. `defaults read` gives `0`.

## Status bar

`scripts/statusbar.sh <device>` sets a clean bar: 9:41, full battery, full wifi, nothing else. `scripts/statusbar.sh <device> off` puts it back at teardown.

- iOS: `xcrun simctl status_bar <udid> override --time 9:41 --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3`.
- Android: demo mode. `settings put global sysui_demo_allowed 1`, then `com.android.systemui.demo` broadcasts: `clock -e hhmm 0941`, battery 100, `network -e wifi show -e level 4 -e fully true`, `network -e mobile hide`, `notifications -e visible false`.
  - Without `fully true` the wifi icon carries a "!" (no internet).
  - Demo mode leaves the Safety Center shield up. The script snoozes it for 3 h with `cmd notification snooze --for <ms> '<key>'`, the key read from `dumpsys notification`.
  - It proves the bar on a screencap, and resets demo mode once when that fails. Two wifi icons showed once, and no second set reproduced them.
  - `argent e2e run` sets `sysui_demo_allowed` to 0 on exit, so the bar needs setting again after every YAML entry. `app-takes.sh` does that right before each recording or still.
- By hand, run it again after a reboot.

`node scripts/statusbar-check.js <file.png|file.mp4>` proves the bar on the capture itself. It compares the bar's icons with a clean reference for that capture size (`scripts/statusbar/<w>x<h>.png`); a recording is checked on its first and last frame. On 199 files from 15 app clips it passed every clean bar and failed every bad one. A new device size needs a geometry line in the script and `--save-ref` of a clean file you looked at. A new OS version on a known size draws other glyphs (iOS 27's signal and wifi icons failed the iOS 26 reference by about 450 px on a clean bar): look at a clean bar, then `--save-ref <file> <name>` adds `<w>x<h>-<name>.png`, and a bar passes on any reference of its size.

Why it matters: on one clip, all 10 files carried a Safety Center shield and a "!" on the wifi icon. Only the 1:1 check found them, and the re-shoot cost about 33 min.

No leftovers: a detour through iOS Settings leaves a "◀ Settings" back link in the status bar. Go back to the app through the home screen before the still.

## Gates before every capture

- **Pre-flight, before the first take of a side:**

  ```bash
  scripts/app-preflight.sh <device> --port <port> [--app <bundleId>] [--scheme <scheme>] [--worktree <dir> [--fingerprint "<cmd>"]] [--guard "<cmd>"]
  ```

  It must exit 0. In about 15 s it checks the device, the dev client's fingerprint (it installs a kept build on a mismatch), Metro serving this device only, the watermark, the status bar (set, then proven on a screenshot), LogBox and the clip's own guard. `app-takes.sh` runs it, then checks the bar, LogBox and identifiers on every take. The gates below are for a still taken by hand.
- **No LogBox.** Run `scripts/logbox-clear.sh <device>` right before every still, and before and after every recording. A LogBox toast stays until it is dismissed, so clean at both ends means clean throughout. The app's own toasts are fine.
- **Identifier scan.** The screen's text must hold no identifier:

  ```bash
  argent run describe --udid <device> | jq -r .description | scripts/idscan.sh
  ```

  It reads the patterns in `identifiers.json` and must print `ids 0`. When the state itself shows one (a customer number, an email), blur its measured rect, on stills and recordings alike, then delete argent's unblurred temp copies:

  ```bash
  ffmpeg -i in.png -filter_complex "[0]crop=W:H:X:Y,boxblur=20[b];[0][b]overlay=X:Y" out.png
  ffmpeg -i in.mp4 -filter_complex "[0]crop=W:H:X:Y,boxblur=20[b];[0][b]overlay=X:Y" -r 30 -c:v libx264 -crf 10 out.mp4
  ```

  Never crop the phone's top or bottom to hide one: a cropped phone looks squat, as if its top were missing.
- **Untranslated copy.** Before the first capture, grep the translation files for your project's untranslated marker (a suffix, a `TODO`). One on a widget on the start screen was in almost every clip, and cost a full re-shoot two rounds later. Fix it in the capture branch first, or keep it out of frame.
- **Settle before you tap.** Two `describe` calls in a row must agree (or `argent run await-screen-idle`). Scroll momentum once moved a list mid-tap, and the tap opened a dev tool screen.
- **Same framing on both sides.** Swipe with `momentum: false` to the end of the screen, then one small drag back (0.045 of the screen worked). That repeats to about 8 px.
  - On Android a short momentum-free drag scrolls its length minus about 0.009 of the screen (touch slop).
  - A collapsing header slides back in whenever the page scrolls toward the top. End a nudge with a finger-up drag longer than the header.

## Stills and recordings

- **Stills:** `argent run screenshot --udid <device> --scale 1.0`, not the 0.25 default. An iPhone 17 Pro gives 1206×2622.
- **Recordings:** `argent run screen-recording-start --udid <device> --trimStatic false --showTouches true`, drive the interaction, then `screen-recording-stop`.
  - `trimStatic false` keeps real time, so frame counts are seconds × 30.
  - `showTouches true` draws the tap pulse and the swipe trail: right for an explanatory clip. Set it false for a clean one.
  - argent records at the device's native size, 30 fps, h264. There is no size or fps option; an 8 s phone clip is about 1.2 MB. Keep captures native: brackets are measured on them, and the render scales down anyway.
- **Timing.** A `run-sequence` step's `delayMs` waits *after* its step, but a `gesture-custom` event's `delayMs` waits *before* it. So a lead-in before a gesture goes on the step before it, or on the gesture's first event. One recording started with no lead-in because of this.
- **Drags** (Android): `gesture-custom` with a Down, a Move on the same point with `delayMs` 700 (the hold), then a Move to the target with `delayMs` 1100–1500 and `interpolate: 45`. The same events on both sides land the finger on the same frame.
- **A still cut from a recording with touches shown:** the touch dot lingers about 8 frames after the finger lifts. Pick a frame where it is gone.
- **Footage recorded with the watermark on:** take it again. If you can't, `cropBottom` of 138 on a 1206×2622 capture (the stamp's top edge is at y 2494). A crop beats a blur patch here.
- **A bracket on a screen that appears mid-recording** gets a `delay`: the frames until that screen shows.
- **Trims.** `node scripts/capture-check.js <KEY>` prints, per recording, the motion runs and rest frames for the whole frame and for each take's `probe` region. Read both lines: probe regions came within 1 frame of a frame-by-frame read, the whole frame within 2. A whole-screen mean luma put drag landings 20–23 frames early. For a region no probe covers, use `node scripts/frame-probe.js <mp4> --crop W:H:X:Y` (with `--from`, frames are `t × 30`). Then `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/props.ts <KEY>` makes the hold stills.
- **A small phone on Android** (`wm size 1080x1751`): the recording stays 1080×2424 with black bands above and below (y 0–336 and 2088–2424).
  - Crop it to the content: `ffmpeg -i in.mp4 -vf crop=1080:1752:0:336 -r 30 -c:v libx264 -crf 10 out.mp4`. Keep the original in `qa/`, run `props.ts` again, and measure the brackets on the new end hold. A take's `crop` does this for you.
  - Under the override, `describe` y is not tap y: tap y = (y·1751 + 336.5)/2424; x stays.
- **Stutter.** argent writes a steady 30 fps even on a still screen, so a stalled app gives repeated frames, not gaps in frame times. Exact frame hashes (`framemd5`) find none, because h264 noise makes every frame differ. Take the per-frame luma difference (`tblend=all_mode=difference,signalstats`, YAVG) and count near-zero frames inside a motion.

Brackets are measured the same way on both platforms: capture-web.md § Brackets.

## Force a state

When the test environment can't produce a state, force it in the running dev client with `argent run debugger-evaluate --device_id <device> --port <port> --expression '<js>'`. This is a technique, not a helper the studio ships.

**Find the query client.** Walk Metro's module registry and read only the named export you want, through its getter:

```js
(() => {
  const qa = (globalThis.__qa ??= {})
  for (const [, m] of globalThis.__r.getModules()) {
    const e = m?.publicModule?.exports
    if (!e || typeof e !== "object") continue
    try {
      const d = Object.getOwnPropertyDescriptor(e, "queryClient") // the export's name in your app
      const v = d && ("value" in d ? d.value : d.get?.())
      if (!qa.qc && typeof v?.getQueryCache === "function") qa.qc = v
    } catch {}
  }
  return !!qa.qc
})()
```

- Never iterate every export of every module: touching them all redboxes the app.
- Every app reload drops `globalThis.__qa`. Check for it and inject again.

**The recipes**, for query key `k` and filter `f = { queryKey: [...] }`:

- **Data:** list the real keys (`__qa.qc.getQueryCache().getAll().map((q) => q.queryKey)`), save the original (`__qa.saved = __qa.qc.getQueryData(k)`), then `__qa.qc.setQueryData(k, data)` with only the fields the state needs.
- **Loading:** make the request hang (wrap your API client's method so that path returns a promise that never settles), then `qc.resetQueries(f)`.
  - Use `resetQueries`, not `removeQueries`: a removed query leaves a mounted widget on its old data.
  - To land the content: unwrap, then `qc.cancelQueries(f).then(() => qc.setQueryData(k, __qa.saved))`.
- **Error:** make the request reject the way the app's own client does (with `response.status`), then `qc.resetQueries(f)`. Check the client's `retry`: with retries off the error card showed in 1–2 s; with React Query's default 3 retries it takes about 7 s.
- **A placeholder behind `keepPreviousData`** only shows on a widget that never had data. Cold-start the app first; one clip lost 6 min finding this.
- **Restore after every state:** put the API methods back, then `qc.resetQueries(f)` or `setQueryData(k, __qa.saved)`. Never `invalidateQueries` after a hold: with no data, TanStack joins the held request again, and it hung for 40 s.
- **Block writes while you force.** Wrap post, put, patch and delete to resolve `{}` and log the call, and check that log is empty after each capture. A forced take must never write to the test environment.

**Traps:**

- argent hands back a Promise unresolved. Chain `.then` that stores the outcome on `globalThis`, and read it with a second call.
- Your evals run on Hermes without Babel. In a `for (const x of …)` loop every closure sees the last value: use `forEach`. A first draft of a wrapper wrapped every GET as DELETE this way and cached `{}` over four queries.
- MSW in the dev runtime didn't work: response bodies arrived empty.
- **A forced answer is per language.** A stub that replays one language's response shows that language in the other language's take. Let unforced calls go to the server, or force each language separately. One clip re-shot its second-language look for this.
- Plan what the test environment lacks into the inventory: a contract type no test account has, or a permission the simulator denies (allow notifications in iOS Settings for the capture, deny them again at teardown).

## Theme and language

- **Dark on iOS:** the app's theme on Automatic (follow system), then `xcrun simctl ui <udid> appearance dark`. Set it back to light for the next capture.
- **Dark on Android:** `adb -s <serial> shell cmd uimode night yes` (`no` to undo), with the app on Automatic. The switch swallows the next tap: tap again.
- **Second language:** switch it in the app's own settings when it has one. Wait for the data, and for any confirmation toast to go. Switch back straight after.

## Variants

Variants are after-only, from the after build.

- **States beats** come first, in the order the inventory sets: `vN-<state>.png`, or `.mp4` for a recording. A recording plays from the brackets, and its beat lasts at least the clip plus a 1 s hold. Measure brackets per file: an error card is not the size of the loaded block.
- **Looks:** one beat of three phones with the same data as pair 1: Light (`01-after.png`) · Dark (`vN-dark.png`) · second language (`vN-<lang>.png`).

## Takes you can replay

Write every take into `videos/<KEY>/capture/takes.json` the moment it works, and play a whole side with:

```bash
scripts/app-takes.sh <KEY> <before|after> --dry-run      # lists every take, fails on a missing or malformed step file
scripts/app-takes.sh <KEY> <before|after> [take …]
```

Why: driving 10 known takes turn by turn took 93 agent turns and 18.5 min, of which 6.8 min was device time. Most turns were navigation around a 13 s recording: open the menu, describe, enter edit mode, frame, dry-run the tap, close, record, check, cancel. The runner played the same 10 takes with no turns between them, in 431 s of device time.

**Schema:**

```json
{
  "app": { "bundleId": "<bundleId>", "scheme": "exp+<slug>", "fingerprintCmd": "APP_VARIANT=<variant> npx expo-updates fingerprint:generate --platform $PLATFORM", "writes": "<js expression>" },
  "sides": {
    "before": { "device": "<udid or serial>", "port": 8402, "worktree": "<repo>/.claude/worktrees/clip-<KEY>-before" },
    "after": { "device": "<udid or serial>", "port": 8401, "worktree": "<repo>/.claude/worktrees/clip-<KEY>-after" }
  },
  "takes": [
    {
      "name": "01-after", "side": "after", "kind": "rec",
      "preset": "capture/preset.sh start", "guard": "capture/guard.sh",
      "setup": ["capture/open-settings.yaml", "capture/frame-end.json"],
      "steps": "capture/01-save.json",
      "aim": [{ "label": "Save", "x": 0.5, "y": 0.852 }],
      "after": ["capture/cancel.yaml"],
      "probe": [{ "label": "sheet", "crop": "996:168:42:1735" }]
    }
  ]
}
```

- `app`: `bundleId` for the native gate and kept builds; `scheme` for the dev-client link; `fingerprintCmd` (optional) when the fingerprint needs env vars; `writes` (optional) a JS expression your dev build answers with the number of real writes since start, which must be 0 after every take (a counter in your API client).
- `sides.<side>`: `device`, `port` and `worktree`.
- Per take:
  - `name` (the file name in `media/`), `side`, `kind` (`rec` or `still`);
  - `preset`: shell that brings the app to a known start (below);
  - `setup` and `after`: lists of entries;
  - `guard`: shell that must exit 0 before the take;
  - `steps`: the recorded part;
  - `aim`, `crop` (`W:H:X:Y`, a letterbox or band off the file; the original goes to `qa/`), `probe` (regions for `capture-check.js`, in the file's own pixels: the changed element's frame from `describe`);
  - `seconds` (default 60) caps a recording; a state that never ends records longer;
  - `"settle": false` skips the settle after setup, for a screen that never holds still (jiggling widgets in an edit mode move the describe tree on every poll).

**Entries:**

- **An argent e2e YAML** (`*.yaml`) taps by text, and can `scroll-to`, `await` a toast `hidden`, and `await: { idle: true }`. Use it for menus, language and anything with a label: it replays on the other platform where the labels match. Syntax: argent's e2e YAML reference, `"$(npm root -g)/@swmansion/argent/skills/argent-create-e2e/references/e2e-yaml.md"`. Take the labels from the app's translation files, not from memory.

  ```yaml
  executionPrerequisite: start screen, default language
  steps:
    - scroll-to: { target: { text: "Settings" } }
    - tap: { text: "Settings" }
    - await: { visible: { text: "Save" } }
    - await: { idle: true, timeout: 9000 }
  ```

- **A `run-sequence` JSON** (`*.json`) takes fractions of the screen. Use it only for framing swipes and `wm size` mapped taps. A fraction tap that misses lands on whatever is there: on a start screen left scrolled, one take's tap opened an onboarding screen instead of the menu. On another, a dialog's destructive confirm sat right where the take's Save tap would land.

  ```json
  [
    {"tool": "gesture-swipe", "args": {"fromX": 0.5, "fromY": 0.75, "toX": 0.5, "toY": 0.25, "durationMs": 400, "momentum": false}, "delayMs": 400},
    {"tool": "gesture-swipe", "args": {"fromX": 0.5, "fromY": 0.5, "toX": 0.5, "toY": 0.43, "durationMs": 400, "momentum": false}, "delayMs": 800}
  ]
  ```

- **`{ "sh": "…" }`** runs in `videos/<KEY>/` with `DEVICE` and `PORT` set: a theme switch, `wm size`.
- **`steps`** is always a `run-sequence` JSON, so both sides get the same timing.
  - Give it an `aim` (`[{ "label", "x", "y" }]`) for each tap whose target is on screen before the recording. The runner stops the take unless that element holds the point.
  - In an after-only take, put an `await-ui-element` step before each tap that needs something new on screen: `{"tool": "await-ui-element", "args": {"condition": "visible", "selector": {"text": "Settings"}, "timeoutMs": 8000}}`. It works under `wm size` too. A sheet once took 50 frames to open instead of 6; the fixed delay tapped the backdrop, closed the sheet, and the take still passed.
  - A pair (`01-before`, `01-after`) keeps fixed delays, so its sides match.

**YAML traps on Android:**

- `scroll-to` stops as soon as a row peeks out, even under the tab bar, and the tap then hits a tab. Scroll to a row two below it.
- Scrolling up to the top of a page with pull-to-refresh can set it off, and the page moves under the next tap. Reach the control from below when there is a way.
- A save's toast covered the top of the screen for about 20 s. `await` it `visible`, `swipe` it `up` (react-native-toast-message), then `await` it `hidden`.
- On the first typed key event (argent's `keyboard`, or `adb shell input text`), Gboard swaps its keyboard for a small floating toolbar and keeps it until Gboard restarts. Neither `hw.keyboard=no` on the AVD nor `show_ime_with_hard_keyboard 1` changed that. Accept the toolbar in typing takes.

**The run.** `app-takes.sh` runs `app-preflight.sh` once per side. Then, per take: status bar, preset, setup, settle (`await-screen-idle`), guard, aim, LogBox, the recording (1 s still lead-in, the steps, stop) or still, LogBox again, identifiers, crop, the file's status bar, and `after`.

- It stops at the first failure and names the take and the phase. Fix that, then run that take alone: `scripts/app-takes.sh <KEY> after v2-search`.
- After a Metro restart (a worktree move), reattach with the dev-client link and wait for the start screen before the runner, or pre-flight fails its `metro` row.

**Output:**

- `capture/run-<side>.tsv`: a row per take, with seconds per phase (the device time) and its checks.
- `capture/run-<side>.png`: the end frames, in take order. Look at it once.
- `capture/run-<side>.log`: everything else.

**Presets.** Give each take a `preset` that brings the app to a known start: a storage layout plus a cold restart (10–23 s). Then a take never depends on where the one before it ended.

- The preset may skip the restart when the app already holds that state and shows the start screen. That skipped 5 of 10 takes, in under 0.5 s each.
- A restart also empties the query cache. A take that records a loading state always restarts (a `--fresh` argument, say). Otherwise an earlier take's cache shows the data at once.
- A device whose quickboot rolled back may show the app's first-run tour again. "Skip" there only sets a local flag. Storage may also lack keys a preset expects: build them from live data (the user id from a query), not from a constant.

## Without argent (untested)

This path was not tried. Without argent there is no `describe`, so no identifier scan, no `aim`, no LogBox clearing and no `app-takes.sh`: check those by eye on every file.

```bash
xcrun simctl io <udid> screenshot out.png
xcrun simctl io <udid> recordVideo --codec=h264 out.mov      # Ctrl-C to stop
adb -s <serial> exec-out screencap -p > out.png
adb -s <serial> shell screenrecord /sdcard/out.mp4 && adb -s <serial> pull /sdcard/out.mp4
ffmpeg -i out.mov -vf fps=30 -c:v libx264 -crf 10 videos/<KEY>/media/01-after.mp4
```

The last line is not optional: the studio needs constant 30 fps (`props.ts` fails a recording that isn't), and both recorders can write a variable frame rate.
