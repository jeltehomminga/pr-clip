#!/bin/bash
# Gate before the first take of a side: what once made a clip re-shoot all 10 files (~33 min) or
# would have stopped a take, checked on the device in about 15 s. Exits 1 on any FAIL row.
#   scripts/app-preflight.sh <device> --port <metro port> [--app <bundle id>] [--scheme <dev-client scheme>]
#                            [--worktree <dir> --fingerprint "<cmd>"] [--guard "<cmd>"]
# Rows: device booted; with --worktree and --app, the dev client's Expo fingerprint against
# the worktree's (a kept build from ~/.cache/pr-clip-devclients/ is installed on a mismatch); Metro
# up on 127.0.0.1:<port> and serving one device only (another session's simulator re-attached to a
# clip's Metro once); argent's watermark off; the status bar set (scripts/statusbar.sh) and proven
# on a screenshot (scripts/statusbar-check.js); no LogBox; the clip's own guard (a preset's state, say).
# --fingerprint runs in the worktree and prints the JSON of `expo-updates fingerprint:generate`; the
# default is "npx expo-updates fingerprint:generate --platform $PLATFORM" ($PLATFORM is ios or
# android). Pass your own when the app config needs env vars: "APP_VARIANT=dev npx … --platform $PLATFORM".
set -uo pipefail
usage='usage: scripts/app-preflight.sh <device> --port <port> [--app <id>] [--scheme <s>] [--worktree <dir> --fingerprint "<cmd>"] [--guard "<cmd>"]'
dev=${1:?$usage}
shift
port="" worktree="" guard="" app="" scheme="" fingerprint=""
while [ $# -gt 0 ]; do
  case $1 in
    --port) port=${2:?$usage}; shift 2 ;;
    --app) app=${2:?$usage}; shift 2 ;;
    --scheme) scheme=${2:?$usage}; shift 2 ;;
    --worktree) worktree=${2:?$usage}; shift 2 ;;
    --fingerprint) fingerprint=${2:?$usage}; shift 2 ;;
    --guard) guard=${2:?$usage}; shift 2 ;;
    *) echo "$usage" >&2; exit 2 ;;
  esac
done
[ -n "$port" ] || { echo "$usage" >&2; exit 2; }
V=$(cd "$(dirname "$0")/.." && pwd)
fail=0
row() { # row <ok|warn|FAIL> <check> <detail>
  printf '%-5s %-11s %s\n' "$1" "$2" "$3"
  [ "$1" != FAIL ] || fail=1
}

platform=android
[[ $dev =~ ^[0-9A-Fa-f]{8}- ]] && platform=ios
if [ $platform = ios ]; then
  xcrun simctl list devices booted | grep -q "$dev" && row ok device "$dev booted" || row FAIL device "$dev not booted"
else
  [ "$(adb -s "$dev" get-state 2>/dev/null)" = device ] && row ok device "$dev attached" || row FAIL device "$dev not attached"
fi

# Native gate (references/worktrees.md): the dev client must match the worktree's fingerprint. An
# emulator's quickboot once rolled the install back to an older build. A kept build is installed
# (the login survives) and the app reattached to Metro; with none, this fails.
if [ -n "$worktree" ] && [ -n "$app" ]; then
  fingerprint=${fingerprint:-'npx expo-updates fingerprint:generate --platform $PLATFORM'}
  want=$(cd "$worktree" && PLATFORM=$platform bash -c "$fingerprint" 2>/dev/null | jq -r '.hash // empty')
  if [ $platform = ios ]; then
    have=$(cat "$(xcrun simctl get_app_container "$dev" $app 2>/dev/null)/EXUpdates.bundle/fingerprint" 2>/dev/null)
  else
    tmp=$(mktemp -d)
    adb -s "$dev" pull "$(adb -s "$dev" shell pm path $app | sed 's/^package://' | tr -d '\r' | head -1)" "$tmp/base.apk" >/dev/null 2>&1
    have=$(unzip -p "$tmp/base.apk" assets/app.fingerprint 2>/dev/null | jq -r '.hash // empty')
    command rm -rf "$tmp"
  fi
  kept=$HOME/.cache/pr-clip-devclients/$platform/$want
  keptApp=$(/bin/ls -d "$kept"/*.app 2>/dev/null | head -1)
  # The dev-client link that reattaches the app to this Metro; --scheme is your app's `exp+<slug>`.
  link="${scheme:-exp+app}://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A$port&disableOnboarding=1&disableAutoLaunch=1&__expo_disable_fab=1"
  if [ -z "$want" ]; then
    row FAIL native "no fingerprint from $worktree (installed?)"
  elif [ "$have" = "$want" ]; then
    row ok native "dev client ${want:0:8}"
  elif [ -e "$kept/app.apk" ] || [ -n "$keptApp" ]; then
    if [ $platform = ios ]; then
      xcrun simctl install "$dev" "$keptApp" && xcrun simctl openurl "$dev" "$link"
    else
      adb -s "$dev" install -r "$kept/app.apk" >/dev/null && adb -s "$dev" shell am start -a android.intent.action.VIEW -d "'$link'" $app >/dev/null
    fi
    for _ in $(seq 45); do [ "$(curl -s -m 2 "http://127.0.0.1:$port/json" | jq length 2>/dev/null)" -gt 0 ] 2>/dev/null && break; sleep 2; done
    row ok native "installed kept ${want:0:8} over ${have:0:8}"
  else
    row FAIL native "device ${have:0:8}, worktree ${want:0:8}, none kept: build it (references/worktrees.md)"
  fi
fi

if curl -s -m 3 "http://127.0.0.1:$port/status" | grep -q running; then
  devices=$(curl -s -m 3 "http://127.0.0.1:$port/json" | jq -r '[.[].title] | unique | .[]' 2>/dev/null)
  n=$(grep -c . <<<"$devices")
  [ "$n" = 1 ] && row ok metro ":$port serves $devices" || row FAIL metro ":$port serves $n devices: $(tr '\n' ';' <<<"$devices")"
else
  row FAIL metro "nothing on 127.0.0.1:$port"
fi

wm=$(cd /tmp && argent flags 2>/dev/null | awk '$1=="video-watermark"{print $2}')
[ "$wm" = disabled ] && row ok watermark off || row FAIL watermark "${wm:-unknown}: argent disable video-watermark"

if "$V/scripts/statusbar.sh" "$dev" >/dev/null; then
  shot=$(cd /tmp && argent run screenshot --udid "$dev" --scale 1.0 --includeImageInContext false | grep -o -E '/[^"]+\.png' | head -1)
  if [ -f "$shot" ]; then
    bar=$(node "$V/scripts/statusbar-check.js" "$shot")
    [[ $bar == *"status bar ok"* ]] && row ok "status bar" "${bar##*status bar }" || row FAIL "status bar" "${bar##*status bar }"
    command rm -f "$shot"
  else
    row FAIL "status bar" "no screenshot"
  fi
else
  row FAIL "status bar" "scripts/statusbar.sh $dev failed"
fi

"$V/scripts/logbox-clear.sh" "$dev" >/dev/null 2>&1 && row ok logbox clear || row FAIL logbox "still on screen"

if [ -n "$guard" ]; then
  out=$(bash -c "$guard" 2>&1) && row ok guard "$guard" || row FAIL guard "$guard: $(tail -1 <<<"$out")"
fi
exit $fail
