---
name: pr-clip
description: Before/after video clips of a GitHub pull request, made in a local Remotion studio. Captures web pages over Chrome DevTools (page loads, drags, typing, keys, phone and tablet views with touch) and iOS/Android apps through argent (stills and recordings). Shows every state, scenario, interaction and transition the PR built, with variants (dark mode, second language, tablet, mobile), burned-in captions read aloud by a local voice, UI sounds and a details end card with the PR's facts; a stale check says when the PR has moved past the clip. Use when the user asks for a PR clip, a before/after video, "make a video of this PR or feature", or a video for a code review.
version: 1.0.0
---

# PR clip

The studio (`studio/` in this skill, copied once to `$PR_CLIP_STUDIO`, default `~/pr-clip-studio`) owns the code, the checks and the house rules: read its `CLAUDE.md` first. Where the two differ, the studio wins. This skill is the procedure around it: which facts to fetch, how to capture, how to review and hand over.

Read `references/*.md` only by the sections a step names: `grep -n '^## ' references/<file>.md` gives their lines, then Read with offset and limit.

## Setup (once per machine)

The skill is written for macOS (`open`, `xcrun`, Homebrew) and Claude Code (its subagents). Base tools: Node 24 or later (the studio runs `.ts` files directly), ffmpeg and ffprobe, jq, bc and the `gh` CLI (`brew install node ffmpeg jq gh`).

1. Studio: the target must not exist yet, or `cp -R` nests the folder inside it: `dest="${PR_CLIP_STUDIO:-$HOME/pr-clip-studio}"; [ ! -e "$dest" ] && cp -R <this skill>/studio "$dest" && cd "$dest" && npm ci && npm test`. Keep the copy in git if you like; `videos/*` stays out except `EXAMPLE`.
2. Voice (needed for voiced clips): `brew install python@3.13`, then `scripts/setup-tts.sh` (a venv with kokoro-onnx and about 340 MB of model files).
3. GitHub: `gh auth status` must show a login that can read the repo.
4. Web clips: a Chrome of its own on port 9333 with a scratch profile, signed in to the test environment by hand once: `open -na "Google Chrome" --args --remote-debugging-port=9333 --user-data-dir="$HOME/.cache/pr-clip-chrome"`. Never use the user's everyday browser profile.
5. App clips: Xcode with its command-line tools (`xcrun simctl`) for iOS, the Android SDK (`adb`, an emulator) for Android, and your Expo dev client built once on the device (`references/worktrees.md` § Native gate). Then argent (`npm i -g @swmansion/argent && argent init -y`, then `argent disable video-watermark` and `argent telemetry disable`) and simslim for a clean simulator per clip (`brew install mobai-app/tap/simslim`): `references/capture-app.md` § Tools.
6. Render once to prove it: `scripts/clip.sh EXAMPLE` must exit 0. The first render downloads Remotion's own headless Chrome (about 100 MB), so it needs the network.

Licences: Remotion is free for individuals and companies of up to 3 people; a bigger company needs a Remotion company licence (remotion.dev/license). argent's source is Apache-2.0, but some of its binaries are proprietary.

## Choosing a look or a motion

- Show options as rendered clips side by side and ask one question: render each option over the same moment, stack them with `ffmpeg xstack` into a labelled grid, `open` it, then ask with a recommendation. Never decide a motion from stills: a look that wins on stills can fail in motion. Sound can't be stacked: play the options in turn over the same moments.
- Each option differs in one thing. When the new candidates also fix something else (a timing, a level), add a control that has only that fix, and check every option against the house rules before showing it.
- Measure, don't eyeball: alignment and fit go into a check or a measured pixel row, not a glance at a preview. A new element shares its neighbours' edges, and each option is rendered over every layout it meets (an end card with 3 facts and one with 6).
- Long renders (`clip.sh`, `render.sh`) run in the background: wait for them to exit instead of polling.

## Making a clip

Start a clip in a fresh session in the PR's repo, never at the end of a long session: every turn carries the whole context. `<KEY>` is the clip's folder under `videos/`, for example `shop-42` for PR #42 of `acme/shop`. props.json calls it `issueKey`: the end card's dateline and the agent context show it, and `check.sh` matches it. All studio commands run in the studio; `node` below means `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON`.

Subagents you hand work to start fresh. Their prompts carry the clip's key and the identifier rule: identifiers in short form only (4711…0042). Capture and 1:1 check subagents can run at low effort: they run scripts and read what the scripts print.

1. **Facts, read-only.** Clips are usually made while the PR is still open, so take only what exists now.
   - Run `node scripts/props.ts <KEY> --pr <owner/repo>#<number> --checkout <your clone>`. From `gh pr view`, `gh issue view` (the issue the PR closes) and git (a `git fetch` in the clone, never a switch) it writes into props.json:
     - `pr.commit`: the after commit, the PR head (or the merge commit once merged);
     - `pr.base`: the before commit, `git merge-base <head> origin/<base>` (or `<merge>^1`; a rebase merge needs it by hand, `references/worktrees.md`);
     - `pr.checkout`: the clone, for `stale.sh`;
     - `details`: kind, title, PR title, `url` (the issue, else the PR) and the end-card facts. An open PR gets only the Developer: status and reviewers go stale once the PR moves. A merged one gets Reviewers, Merged, then Release (the first stable tag that has the merge) or else First build (the first tag that has it).
   - It fills only what is missing, so a hand edit survives the next run; delete a field to have it fetched again. Screen and Captured are yours to add at step 5.
   - Write `videos/<KEY>/review.md` yourself, the clip's log from here on (no script makes it). Done when it names the PR, its state, the before commit, the "Captured commit" and the facts.
2. **Inventory and storyboard, worked out, not asked.** Every state, scenario, interaction and transition the PR built: the rules in `references/inventory.md` decide the rows, which ones go in, still or recording, and the beats.
   - Hand the reading to one subagent: the diff, the PR description, the issue, the designs and the PR's screenshots go in; it applies `inventory.md` and returns only the table and the beat list.
   - Done when `review.md` § v1 holds the table and the beat list, and `node scripts/frames.ts videos/<KEY>/props.json` of a draft stays within 60 s. A draft has no media yet: give each capture a placeholder `file` with the size it will have (1206×2622 for an iPhone 17 Pro, 2700×1520 for a 1350×760@2 page) and, for a recording, a `trimAfter` of its expected length in frames. `props.ts` measures the real ones at step 5.
   - Ask the user only when a rule can't decide (`inventory.md` § Ask the user only when).
   - The table also feeds the agent context: each kept row's render branch, files (repo-relative, no line numbers), i18n keys and reach go into `state` on its pair or capture; each out row goes into `notShown` with its reason; the design link you compared against goes into `figma`.
3. **Worktrees and gates**: `references/worktrees.md`. Done when the dependency gate (and, for an app, the native gate) passed in a throwaway worktree. The user's checkout never moves.
4. **Captures**: `references/capture-web.md` or `references/capture-app.md`. Same viewport and data on both sides, identifier scan 0. Write each take as a script in `videos/<KEY>/capture/` the moment it works, so a re-cut replays it.
   - App: write `capture/takes.json` and its step files, run `scripts/app-takes.sh <KEY> <side> --dry-run`, then `scripts/app-takes.sh <KEY> <side>` for each side.
   - Then `node scripts/capture-check.js <KEY>`: per file the status bar, the motion runs with rest frames, and two images in `qa/check/`. Done when it exits 0 and every file's images were looked at (one low-effort subagent: per file ok or what's wrong, the exact UI labels near the change for the captions, and the settle frames of each recording).
5. **props.json.** Run `node scripts/props.ts <KEY>` again. It measures every capture, sets `platform`, makes the hold stills of every trimmed recording, fails on a missing file or a recording that isn't 30 fps, and lists media nothing uses. The rest needs judgement, so you write it:
   - The why and one caption per pair (at most 84 characters, plain words, exact UI labels).
   - The voice: `node scripts/vo-captions.ts <KEY>`, then `KOKORO_SPEED=0.9 scripts/render-vo.sh <KEY>`. Where Kokoro can't read a symbol or label, add a swap to `say` and log it in `review.md`. After any caption edit, run both again.
   - Brackets measured with `node scripts/measure-bounds.js`, never read off a preview (`references/capture-web.md` § Brackets).
   - Trims of each recording, from the settle frames of step 4, then `props.ts` once more for the holds.
   - States and variants beats from step 2, with their `state` fields.
   - `capture`: env, date, device, locale, theme, and the account as a data profile, never a real identifier ("test user 3: one open invoice").
   - The Screen and Captured facts on the `details` card.
   - Done when `npm test` passes, `node scripts/frames.ts videos/<KEY>/props.json` prints the length you expect, and `node scripts/context.ts videos/<KEY>/props.json` passes (it fails on a missing `capture` or `reach`, and on a full identifier).
6. **Render and check.** Run `scripts/clip.sh <KEY>` in the background: `props.ts`, `npm test`, `render.sh --gif`, one full-size still per beat, `check.sh` and `check.sh sheet`, in one call. Only a failing step prints, with its tail; the full log is `videos/<KEY>/clip.log`. Every check row must pass (`references/checks.md`).
   - Look at the sheets first, then the stills. Open another frame at full size only where those show a problem, or for a mid-move check. `scripts/check.sh phone <KEY>` for readability.
   - At most 3 self-review rounds, logged in `review.md`.
7. **The user reviews** the share copy (`open videos/<KEY>/out/<KEY>-before-after.mp4`). Ask one question: approve, or what to change. The question names every oddity you saw in a capture and kept (a placeholder icon that reads as a meaning, a cut-off edge, mixed languages), or says there is none.
8. **Hand it over after their yes.** Nothing is posted by the agent. `open -R` the share copy and print a comment to paste, for the user to drop into the PR with the mp4 (GitHub takes a video dragged into a comment):
   ```
   Before/after clip, captured at <pr.commit>.
   <sub>For agents: the mp4's comment tag holds the clip's context as JSON: ffprobe -v error -show_entries format_tags=comment -of default=nw=1:nk=1 <file></sub>
   ```
   No mentions or tags in it.
9. **Keep posted clips current.** Run `scripts/stale.sh` (every clip) at the start of each clip session. Each clip gets one verdict:
   - `fresh`, `same-ui` or `accepted`: nothing to do. `same-ui` means the PR moved, but only by files that never render, or by a base-branch merge outside the clip's screens.
   - `stale`: the line lists the files that may change the UI and the beats whose `state.files` they hit. Look at those files' diff. If the UI can't have changed (a dependency bump, a version string), ask the user once; on a yes, write `pr.accepted: {head, why}` into props.json and log it in `review.md`. Otherwise re-cut only the beats it names (`references/capture-web.md` § Re-cut a stale clip), or take the posted clip down after the user's yes.
   - A new look or motion is for new clips only: posted clips are not re-cut for it.

## Do not retry

- `playbackRate` to stretch a recording across its beat. `ClipWithHolds` holds the first and last frames instead.
- A fixed-rate screencast recorder for the web: it drops frames when a capture runs slow. Use `scripts/web-record.js`, which keeps the screencast's timestamps.
- A symlinked `node_modules` in a worktree, or the main checkout's install: both lag behind the lockfile. Install fresh.
- Hiding every `position: fixed` element in a web prep: that also hides dialogs a PR may change. Name the overlays (`window.vsHide`).
- Web viewport 1350×940: the frame came out too narrow. Use 1350×760 (16:9).
- A zoom that magnifies the screen inside a fixed bezel: it looks like a pinch-zoom the app doesn't have. The whole device leans in instead.
- Cutting phones' bottoms off (`cropBottom`) to make them bigger: squat, round-bottomed phones look unnatural.
- Narration with macOS `say` (robotic), XTTS v2 (non-commercial licence) or Chatterbox (voice cloning, 6 GB).
- `xcrun simctl clone` for a clean simulator: the clone runs the original's binary and writes its data. Use `simslim clone`.
