# Inventory: every state the PR built

Work out what the clip must show from the PR's own sources, log it as a table, and turn it into beats before any capture.

Run every command from the studio: `cd "${PR_CLIP_STUDIO:-$HOME/pr-clip-studio}"`. `<KEY>` is the clip's folder name under `videos/`.

## Why an inventory

The clip shows all the UI the PR built, not only its happy path: every state, scenario, interaction and transition. Work the list out from the sources below; don't ask the user what to show. On one app clip the table had 15 rows and kept 9.

## Sources (all read-only)

- **The diff's render branches.** Read `git diff <before> <after>` (worktrees.md § Which commits). List:
  - every early return, ternary and `&&` in JSX;
  - every new or changed i18n key, plural forms included (`_zero`, `_one`, `_other`);
  - every skeleton, error and empty component.
- **Motion** in the diff and in the components it uses: Reanimated, `entering` / `exiting`, NativeWind `animate-*`, `Animated`, CSS transitions, touchables (pressed state) and navigation calls.
- **The PR description**: its states and its test plan. Read it with `gh pr view <n> --json title,body,headRefOid,baseRefName,state,mergeCommit`.
- **The linked issue**: its acceptance criteria.
- **The design file**: the screen's frames and their state variants (Figma or similar).
- **The PR's own screenshots**, in its body and comments.

## The table

Log one row per state in `videos/<KEY>/review.md` § vN, before any capture. Rows cover:

- data scenarios;
- loading, error and empty;
- interactions: tap, press, drag, typing, keys, navigation;
- transitions: skeleton to content, animations;
- the looks: theme, language, viewport.

Columns:

| # | Row | Render branch | Reach it | Still / rec | Previous version | This version |
|---|---|---|---|---|---|---|

"Previous version" and "This version" hold "in" or "out, because …" for the clip's last cut and this one, so a second cut shows what changed.

The table feeds the share copy's agent context (`scripts/context.ts` writes it into the mp4).

- **Kept rows.** Their pair or capture gets a `state` in `props.json`:
  - `branch`: the render branch that draws it (`amountOpen < 0`);
  - `files`: repo-relative, no line numbers (they go stale first);
  - `i18n`: the keys as the code spells them;
  - `reach`: how the capture got there, written for a tester ("stubbed: one subscription with status Pending"), with repro tips.
- **Out rows** go into `notShown` as `{ "state", "why" }`.
- **Once per clip**: `capture` (env, date, device, locale, theme, and the account as a data profile with any id in short form: "test user 3, account 4711…0042: one open invoice of € 60"), the base commit and the design node URL (`figma`).
- A clip with `pr` needs `capture` and a `state.reach` on every pair and capture. `scripts/context.ts` fails without them, and on a full identifier.
- **No acceptance-criteria numbers** on beats or in the JSON. They go wrong once the issue's criteria are edited or renumbered. The captions say what each beat shows, and the end card's QR opens the live issue.
- Findings outside the PR (a bug the clip stumbled on) go to the user in the chat, never into the JSON.

## How to reach a state

Take the cheapest way that works, in this order:

1. **Real data** on the staging or test environment.
2. **Forced data on the real request.**
   - App: `setQueryData` on the real query key, through `argent debugger-evaluate` (capture-app.md § Force a state).
   - Web: a `scripts/cdp-stub.js` fixture (capture-web.md § Stubs).
3. **A hung request** for loading, **a rejected one** for error.

A stubbed state is real UI on stubbed data. Say so in its `reach` and in `review.md`.

## Still or recording

Real recordings beat stills, on the app and the web, even when the clip gets longer. If stills were enough, plain screenshots would do the job. Record whenever something moves:

- a loading pulse, or skeleton to content (it proves nothing jumps);
- a tap, a drag, typed text or a key press, and what it opens or moves;
- an animation or transition the PR added or changed (a flash, a swap, a block loading in).

Use a still only for a state that just sits there: an error card, an empty list, or a look (second language, tablet) whose interaction a recording already shows. On one clip, keyboard support shown as one still with a focus ring was unclear to reviewers. Record keys with the key pill instead (capture-web.md § Interactions).

## Out by default

Leave these out, and log each with its reason:

- It renders the same as a row that is already in: same branch, only a number or a plural changes.
- Nothing changes on screen, for example a failed refresh that keeps the old data.
- It needs another login, account or platform than the clip uses. The exception: the PR is about that case.
- It is only heard, not seen (a screen-reader label).
- It can't render, because a parent's gate shows something else first. On one clip, a screen replaced its whole body with its own "unavailable" card whenever one request failed, so a child card's error branch never showed. Read the parent screen's early returns before you keep a row.

## Beats

1. **Pairs**: before and after of the change, same viewport, data and zoom.
2. **States beats**: after-only, labelled groups of at most 3 frames under one caption. Data scenarios first, then loading, error and empty. Chip labels are plain state names. Files: `media/vN-<label>.(png|mp4)`.
3. **The looks beat**:
   - App: Light · Dark · second language.
   - Web: second language · Tablet · Mobile. A web PR always shows the phone view. When the PR changes an interaction, record it there (`web-record.js --mobile`).
4. **The details card**, when `props.json` has `details`.

Draft the props, then check the length:

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/frames.ts videos/<KEY>/props.json
```

It prints `total posterFrame motionFrame`. `total` / 30 is the length in seconds: 15–60 s. Only the user lifts the 60 s cap, per clip, with `maxSeconds` in `props.json`.

## How the studio plays the beats

The studio enforces these rules. Plan the inventory with them in mind.

- **Result first.** The after state and the why are on screen within 3 s. A recorded before pushes that later; that is accepted for a transition, because the transition is the point.
- **Corner brackets**, never a closed ring: a ring reads as a UI border. One colour marks the problem, another the fix. They sit 10 px clear of the element.
- **One lean-in per pair**, onto its first after bracket, only once the after state has landed (never during the swap), in 1 s moves.
  - Web: zoom to fit, so the change fills about 70 % of the window (1.25–1.8×), with a camera pan.
  - App: one camera on the whole pair. Both phones scale around the midpoint of their fixes, so they move apart and never overlap. Full-width cards stay near 1.25×; a small target (a tab-bar icon) reaches 1.8×.
  - The brackets on both sides blink twice and go as the lean-in lands, so nothing stays over the UI.
  - A pair whose lean-in would push any bracket out of the footage band (a sticky button flush with the bottom, a second change far from the first) gets no lean-in. The studio decides from the brackets.
  - `focus: {}` in `props.json` keeps a clip on the plain 1.25× lean with steady brackets.
- **States and looks beats** stand taller phones, with the tab bar fading out above the caption band. A beat with a bracket near the bottom (tab bar, sticky button, bottom sheet, toast) keeps the pair size and no fade. So a change down there needs a bracket, or it can fade out of view.
- **The details card** closes every clip that has `details`.
  - Right side: the first pair's after state again, so anyone who jumps to the end still sees the change.
  - Facts come only from what exists when the clip is made, and nothing that goes stale once posted: no review status and no reviewers while the PR is open.
  - Before the merge: Developer · Screen · Captured. After it: Developer · Reviewers · Merged · First build · Screen · Captured.

## Ask the user only when

- **Pair 1 renders the same on both sides** on the clip's platform. Before any inventory work, take one still per side and compare the md5 of the change's crop. On one clip, the fix was two Android-only `TextInput` props: the iOS crops were byte-identical. The iPhone bug in the issue had been fixed by an earlier commit (`git log` the touched file since the issue's screenshots). The clip was stopped.
- **The kept rows don't fit in 60 s**: two clips, or which rows to cut.
- **A state can only be reached by a real write** on the test environment.
- **Whether a row goes in depends on product meaning** that the sources leave open.
