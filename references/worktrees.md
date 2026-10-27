# Worktrees: before and after builds that never touch your checkout

Check out the PR's before and after commits in throwaway worktrees, install them, and make sure an Expo app's dev client matches them.

Run studio commands from the studio: `cd "${PR_CLIP_STUDIO:-$HOME/pr-clip-studio}"`. Git commands run in the app's repo, `<repo>`.

## Throwaway worktrees only

Never touch the user's checkout: no checkout, stash, reset or install in it. Every capture runs from a worktree you create and remove.

```bash
git -C <repo> fetch origin
git -C <repo> worktree add .claude/worktrees/clip-<KEY>-after <after>
git -C <repo> worktree add .claude/worktrees/clip-<KEY>-before <before>
```

One worktree checked out in turn is fine for a web clip, which runs one side at a time. An app clip that runs both sides at once needs both (capture-app.md § Both sides at once).

## Which commits

Read the PR with `gh pr view <n> --json state,headRefOid,baseRefName,mergeCommit,commits`.

- **Open PR** (the usual case):
  - `<after>` is the PR's head commit (`headRefOid`). Fetch it with `git fetch origin pull/<n>/head` when it lives on a fork.
  - `<before>` is `git merge-base <head> origin/<base>`, after a `git fetch`.
- **Merged PR:**
  - Merge commit: `<after>` is the merge commit, `<before>` is `<merge>^1`.
  - Squash merge: the commit has one parent, so `<merge>^1` is the commit before the PR.
  - Rebase merge: there is no merge commit of the PR's own. `mergeCommit` is the last rebased commit; count back the PR's commits: `<before>` is `<merge>~<number of commits>`.

Record both in `props.json`: `pr.commit` is `<after>`, `pr.base` is `<before>`. Add a "Captured commit" line to `review.md`. `scripts/stale.sh` compares `pr.commit` with the PR later.

## Dependency gate

1. Diff the manifests between the sides: `git -C <repo> diff --stat <before> <after> -- package.json '*lock*'`.
2. Install fresh in each worktree. The main checkout's install lags behind, so never reuse it.
   - npm: `HUSKY=0 npm ci` (about 10 s on a mid-size web app).
   - bun: `HUSKY=0 bun install --frozen-lockfile` (9–12 s on an Expo app).
   - pnpm: `HUSKY=0 pnpm install --frozen-lockfile`. Yarn: `HUSKY=0 yarn install --immutable`.
   - `HUSKY=0` skips installing git hooks into the worktree.
3. Symlink the env files in from the main checkout: `ln -s <repo>/.env .env`, and the same for `.env.local` or any other `.env*` the app reads.

Done when the install exits 0 in every worktree you will capture from.

## Native gate (Expo app)

A JS-only change runs on any dev client whose native side matches. Compare the clip device's dev client with the worktree's fingerprint. Read the device every time: a baseline you saved earlier goes stale.

**Why it fails so often.** On one app the gate failed in 6 of 7 clips over two weeks. The base branch moved a fingerprint input on half the days. Besides native code, the fingerprint hashes every `package.json` script and `eas.json`. When `runtimeVersion` uses the fingerprint policy, it is the app's runtime version, so never loosen it for a clip.

**What the worktree wants** (after its install; use the repo's runner: `npx`, `bunx`, `pnpm exec`):

```bash
cd <worktree> && APP_VARIANT=<variant> npx expo-updates fingerprint:generate --platform ios | jq -r .hash
```

Drop `APP_VARIANT=<variant>` if the app config doesn't read it. Put the command in `takes.json`'s `app.fingerprintCmd` when it needs env vars, so `scripts/app-preflight.sh` runs the same one (its header says how it passes the platform).

**What the device has, iOS:**

```bash
cat "$(xcrun simctl get_app_container <udid> <bundleId>)/EXUpdates.bundle/fingerprint"
```

**What the device has, Android.** Read it from the device after boot, never from notes: a quickboot can roll the install back. On one emulator, a build from that day came back as one from days before.

```bash
apk=$(adb -s <serial> shell pm path <bundleId> | sed 's/^package://' | tr -d '\r' | head -1)
adb -s <serial> pull "$apk" base.apk
unzip -p base.apk assets/app.fingerprint | jq -r .hash
```

Compare it with `fingerprint:generate --platform android` in the worktree. An `android/` folder in the worktree or not gives the same hash. When the hashes differ, diff the two `sources` lists (`jq .sources`) to see what moved.

**Never read `assets/fingerprint` on Android.** expo-updates' `create<Variant>UpdatesResources` Gradle task declares no source inputs, so an incremental build skips it and the file keeps the first build's hash. expo-constants' `createExpoFingerprint` rewrites `assets/app.fingerprint` on every debug build (`upToDateWhen { false }`). On one clip `assets/fingerprint` showed an old hash, while `app.fingerprint` and the worktree agreed (same 100 sources), and the after bundle ran.

## Kept dev clients

Keep every dev client you build, under its fingerprint:

- iOS: `~/.cache/pr-clip-devclients/ios/<hash>/<App>.app`, the bundle from `xcrun simctl get_app_container <udid> <bundleId>`.
- Android: `~/.cache/pr-clip-devclients/android/<hash>/app-debug.apk`.

**Hit** (the hashes differ and that folder exists): install it.

- iOS: `xcrun simctl install <udid> ~/.cache/pr-clip-devclients/ios/<hash>/<App>.app`. It took 4 s for a 451 MB build. The app's data moves to a new container path but keeps every file, so the login survives.
- Android: `adb -s <serial> install -r ~/.cache/pr-clip-devclients/android/<hash>/app-debug.apk`. The login survives.

`scripts/app-preflight.sh` does this by itself on a mismatch, and reattaches the app to Metro.

**Miss**: rebuild from the worktree. Start it in the background as soon as the inventory is done, since it is the slow part.

```bash
# iOS: 2.8–4.2 min on a mid-size app
APP_VARIANT=<variant> npx expo prebuild --clean --platform ios &&
  APP_VARIANT=<variant> npx expo run:ios --device <udid> --no-bundler
mkdir -p ~/.cache/pr-clip-devclients/ios/<hash>
cp -R "$(xcrun simctl get_app_container <udid> <bundleId>)" ~/.cache/pr-clip-devclients/ios/<hash>/

# Android: about 10 min cold, 2 min with a warm Gradle cache
APP_VARIANT=<variant> npx expo prebuild --clean --platform android &&
  APP_VARIANT=<variant> npx expo run:android --device <serial> --no-bundler
mkdir -p ~/.cache/pr-clip-devclients/android/<hash>
cp android/app/build/outputs/apk/debug/app-debug.apk ~/.cache/pr-clip-devclients/android/<hash>/
```

**Keep the newest 5 per platform:**

```bash
cd ~/.cache/pr-clip-devclients/ios && /bin/ls -t | tail -n +6 | while IFS= read -r h; do rm -rf -- "$h"; done
```

When the base branch's fingerprint isn't kept yet, build it at the start of a session (a worktree at `origin/<base>`) and install it on your golden simulator, so its clones start current. A PR whose base is behind still needs its own build, once.

## Is today the same as at the merge?

To check whether a merged change still looks the same now: make a temporary worktree at `origin/<base>`, run the same capture recipe, then remove it.

## Cleanup

1. `git -C <repo> worktree remove --force <worktree>` for each one. `--force`, because Next and prebuild leave untracked files behind and a plain remove refuses.
2. Delete the Xcode DerivedData folder of an iOS worktree: the one whose `info.plist` `WorkspacePath` lies inside the worktree.

   ```bash
   for f in ~/Library/Developer/Xcode/DerivedData/*/info.plist; do
     case $(/usr/libexec/PlistBuddy -c 'Print :WorkspacePath' "$f" 2>/dev/null) in
       <worktree>/*) echo "${f%/info.plist}" ;;
     esac
   done
   ```

   Delete what it prints, then run the loop again and prove it prints nothing.
3. `git -C <repo> worktree prune`, then `git -C <repo> worktree list` shows only the user's checkout and their own worktrees.
