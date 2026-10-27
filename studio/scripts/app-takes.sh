#!/bin/bash
# Plays every take of one side of an app clip from videos/<KEY>/capture/takes.json, with no agent
# turns between takes. A re-shoot that drove 10 takes turn by turn took 93 turns and 18.5 min, of
# which 6.8 min was the device. Stops at the first failure and names the take and the phase.
#   scripts/app-takes.sh <KEY> <before|after> [take ...] [--dry-run]
#
# takes.json (paths relative to videos/<KEY>/; references/capture-app.md has the full schema):
#   { "app": { "bundleId": "com.acme.shop", "scheme": "exp+shop", "fingerprintCmd": "<cmd>", "writes": "<js>" },
#     "sides": { "after": { "device": "<serial or UDID>", "port": 8199, "worktree": "<dir>" }, "before": {...} },
#     "takes": [ { "name": "v2-search", "side": "after", "kind": "rec" | "still",
#       "preset": "<sh>", "setup": [<entry>, ...], "guard": "<sh>", "steps": "capture/v2-search.json",
#       "after": [<entry>, ...], "crop": "W:H:X:Y", "probe": [{ "label": "sheet", "crop": "W:H:X:Y" }] } ] }
#   An <entry> is an argent e2e fragment (`*.yaml`: taps by text, scroll-to, await, idle; replays on
#   either platform where the labels match), a run-sequence JSON (`*.json`: fractions of the screen),
#   or { "sh": "<command>" }. Shell runs in videos/<KEY>/ with DEVICE and PORT set.
#   `steps` is the recorded part, always a run-sequence JSON, so both sides get the same timing.
#   `crop` cuts a letterbox off a recording (wm size) or a band off a still or recording; never the
#   phone's own top or bottom, which looks squat (blur an identifier instead). The original goes to qa/, and a crop that
#   takes the status bar with it has the bar checked on that original. `probe` is for
#   scripts/capture-check.js. `seconds` (default 60) caps a recording: a state that never ends
#   records longer (75, say). `"settle": false` skips the settle after setup, for a screen that
#   never holds still: an edit mode's jiggling widgets move the describe tree on every poll.
#   `aim`: [{ "label": "<describe label>", "x": 0.891, "y": 0.4775 }] for each fraction tap in `steps`
#   whose target is on screen before the recording: the take stops unless the element holds that
#   point. A missed tap can land on a button the take must never press (a remove dialog's confirm
#   once sat right over the Save button). Setup and after taps go by label in a YAML.
#
# Per side: scripts/app-preflight.sh once. Per take: status bar, preset, setup, settle, guard, aim, LogBox clear,
# record (1 s still lead-in, the steps, stop) or still at scale 1, LogBox clear again, identifiers
# on the describe text (identifiers.json), app.writes 0 when set, crop, status bar on the file, after.
# `app.writes` is a JS expression your dev build answers with the number of real writes since start
# (a counter in your API client, say); a take that wrote to the backend fails.
# Writes capture/run-<side>.tsv (one row per take with seconds per phase: the device time to
# compare across platforms), capture/run-<side>.png (end frames) and capture/run-<side>.log.
set -uo pipefail
usage='usage: scripts/app-takes.sh <KEY> <before|after> [take ...] [--dry-run]'
key=${1:?$usage}
side=${2:?$usage}
shift 2
dry=0
only=" "
for a in "$@"; do
  if [ "$a" = --dry-run ]; then dry=1; else only="$only$a "; fi
done
V=$(cd "$(dirname "$0")/.." && pwd)
dir=$V/videos/$key
spec=$dir/capture/takes.json
[ -f "$spec" ] || { echo "no $spec" >&2; exit 2; }
dev=$(jq -r --arg s "$side" '.sides[$s].device // empty' "$spec")
port=$(jq -r --arg s "$side" '.sides[$s].port // empty' "$spec")
worktree=$(jq -r --arg s "$side" '.sides[$s].worktree // empty' "$spec")
bundle=$(jq -r '.app.bundleId // empty' "$spec")
scheme=$(jq -r '.app.scheme // empty' "$spec")
fingerprint=$(jq -r '.app.fingerprintCmd // empty' "$spec")
writesExpr=$(jq -r '.app.writes // empty' "$spec")
[ -n "$dev" ] && [ -n "$port" ] || { echo "takes.json: sides.$side needs device and port" >&2; exit 2; }
platform=android
[[ $dev =~ ^[0-9A-Fa-f]{8}- ]] && platform=ios
export DEVICE=$dev PORT=$port
cd "$dir" || exit 2
log=capture/run-$side.log
tsv=capture/run-$side.tsv

takes=$(jq -c --arg s "$side" '.takes[] | select(.side == $s)' "$spec")
[ "$only" = " " ] || takes=$(while IFS= read -r t; do [[ $only == *" $(jq -r .name <<<"$t") "* ]] && echo "$t"; done <<<"$takes")
[ -n "$takes" ] || { echo "no $side takes${only:+ named$only}" >&2; exit 2; }

now() { perl -MTime::HiRes=time -e 'printf "%.1f", time'; }
secs() { perl -e "printf '%.1f', $(now) - $1"; }

# entry <json entry> : run one setup or after entry
entry() {
  local e=$1 f
  if [ "$(jq -r type <<<"$e")" = object ]; then bash -c "$(jq -r .sh <<<"$e")"; return; fi
  f=$dir/$(jq -r . <<<"$e")
  case $f in
    *.yaml) (cd /tmp && argent e2e run "$f" --device "$dev" --platform "$platform") ;;
    *.json) (cd /tmp && argent run run-sequence --udid "$dev" --steps-json "$(cat "$f")") | jq -e '.completed == .total' ;;
  esac
}
entries() { # entries <take json> <setup|after>
  local e
  # fd 4, not stdin: argent and adb read stdin and would eat the next entries
  while IFS= read -r e <&4; do [ -z "$e" ] || entry "$e" || return 1; done 4< <(jq -c --arg k "$2" '.[$k] // [] | .[]' <<<"$1")
}
aim() { # aim <take json> : every `aim` point lies inside its labelled element right now
  local a label frame text
  text=$(cd /tmp && argent run describe --udid "$dev" | jq -r .description)
  while IFS= read -r a; do
    [ -n "$a" ] || continue
    label=$(jq -r .label <<<"$a")
    frame=$(grep -F "\"$label\"" <<<"$text" | head -1 | sed -E 's/.*\(([0-9.]+), ([0-9.]+), ([0-9.]+), ([0-9.]+)\) *$/\1 \2 \3 \4/')
    awk -v x="$(jq -r .x <<<"$a")" -v y="$(jq -r .y <<<"$a")" -v f="$frame" -v l="$label" 'BEGIN {
      n = split(f, b, " "); ok = n == 4 && x >= b[1] && x <= b[1] + b[3] && y >= b[2] && y <= b[2] + b[4]
      print "aim " (ok ? "ok" : "FAIL") ": \"" l "\" at " x "," y ", element " (n == 4 ? f : "not on screen"); exit !ok }' || return 1
  done < <(jq -c '.aim // [] | .[]' <<<"$1")
}

if [ $dry = 1 ]; then
  bad=0
  while IFS= read -r t; do
    echo "$(jq -r '"\(.name) (\(.kind))"' <<<"$t")"
    for k in preset setup guard steps after crop; do
      v=$(jq -c --arg k "$k" '.[$k] // empty' <<<"$t")
      [ -z "$v" ] || echo "  $k: $v"
    done
    while IFS= read -r f; do
      [ -f "$f" ] || { echo "  MISSING $f"; bad=1; continue; }
      [[ $f != *.json ]] || jq -e 'type == "array"' "$f" >/dev/null || { echo "  NOT a step array: $f"; bad=1; }
    done < <(jq -r '[.steps // empty, (.setup // [], .after // [] | .[] | strings)] | .[]' <<<"$t")
    [ "$(jq -r .kind <<<"$t")" != rec ] || jq -e .steps <<<"$t" >/dev/null || { echo "  MISSING steps"; bad=1; }
  done <<<"$takes"
  exit $bad
fi

mkdir -p media
[ -f "$tsv" ] || printf 'take\tkind\tbar_s\tpreset_s\tsetup_s\tguard_s\ttake_s\tcheck_s\tafter_s\tids\twrites\tstatus\n' >"$tsv"
echo "== $key $side on $dev, Metro :$port ($(date '+%H:%M:%S'))" >>"$log"
"$V/scripts/app-preflight.sh" "$dev" --port "$port" ${bundle:+--app "$bundle"} ${scheme:+--scheme "$scheme"} \
  ${worktree:+--worktree "$worktree"} ${fingerprint:+--fingerprint "$fingerprint"} | tee -a "$log" || { echo "preflight failed: no take ran" >&2; exit 1; }

ends=$(mktemp -d)
n=0
# fd 3, not stdin: argent, adb and ffmpeg read stdin and ate every take after the first
while IFS= read -r t <&3; do
  name=$(jq -r .name <<<"$t")
  kind=$(jq -r .kind <<<"$t")
  ids="-" writes="-" status=ok
  bar_s="" preset_s="" setup_s="" guard_s="" take_s="" check_s="" after_s=""
  fail() { status="FAIL $1"; }
  {
    echo "-- $name"
    t0=$(now); "$V/scripts/statusbar.sh" "$dev" || fail bar; bar_s=$(secs "$t0")
    if [ "$status" = ok ]; then
      t0=$(now); p=$(jq -r '.preset // empty' <<<"$t"); [ -z "$p" ] || bash -c "$p" || fail preset; preset_s=$(secs "$t0")
    fi
    if [ "$status" = ok ]; then
      t0=$(now)
      entries "$t" setup || fail setup
      # settle before the first tap: the describe tree holds still (scroll momentum once moved a list mid-tap)
      # `"settle": false` skips it for a screen that never holds still (an edit mode's jiggle)
      [ "$status" != ok ] || [ "$(jq -r '.settle' <<<"$t")" = false ] || (cd /tmp && argent run await-screen-idle --udid "$dev" --timeoutMs 8000 --minStableMs 500) | jq -e .settled || fail settle
      setup_s=$(secs "$t0")
    fi
    if [ "$status" = ok ]; then
      t0=$(now); g=$(jq -r '.guard // empty' <<<"$t"); [ -z "$g" ] || bash -c "$g" || fail guard
      [ "$status" != ok ] || aim "$t" || fail aim
      guard_s=$(secs "$t0")
    fi
    if [ "$status" = ok ]; then
      t0=$(now)
      # again: `argent e2e run` pins its own bar and sets sysui_demo_allowed 0 on exit
      "$V/scripts/statusbar.sh" "$dev" >/dev/null || fail bar
      "$V/scripts/logbox-clear.sh" "$dev" || fail "logbox before"
      if [ "$status" = ok ] && [ "$kind" = rec ]; then
        (cd /tmp && argent run screen-recording-start --udid "$dev" --trimStatic false --showTouches true --timeLimitSeconds "$(jq -r '.seconds // 60' <<<"$t")" >/dev/null)
        sleep 1 # still lead-in before the first touch
        (cd /tmp && argent run run-sequence --udid "$dev" --steps-json "$(cat "$dir/$(jq -r .steps <<<"$t")")") | jq -e '.completed == .total' || fail steps
        stop=$(cd /tmp && argent run screen-recording-stop --udid "$dev")
        video=$(grep -o -E '/[^"]+\.mp4' <<<"$stop" | head -1)
        [ -f "$video" ] && mv "$video" "media/$name.mp4" || fail "no recording"
      elif [ "$status" = ok ]; then
        shot=$(cd /tmp && argent run screenshot --udid "$dev" --scale 1.0 --includeImageInContext false | grep -o -E '/[^"]+\.png' | head -1)
        [ -f "$shot" ] && mv "$shot" "media/$name.png" || fail "no screenshot"
      fi
      take_s=$(secs "$t0")
    fi
    if [ "$status" = ok ]; then
      t0=$(now)
      "$V/scripts/logbox-clear.sh" "$dev" || fail "logbox after"
      text=$(cd /tmp && argent run describe --udid "$dev" | jq -r .description)
      ids=$("$V/scripts/idscan.sh" <<<"$text" | cut -d' ' -f2) || fail identifiers
      if [ -n "$writesExpr" ]; then
        writes=$("$V/scripts/app-eval.sh" "$dev" "$writesExpr" --port "$port")
        [ "$writes" = 0 ] || fail "writes $writes"
      fi
      file=media/$name.$([ "$kind" = rec ] && echo mp4 || echo png)
      crop=$(jq -r '.crop // empty' <<<"$t")
      orig=
      if [ -n "$crop" ] && [ -f "$file" ]; then
        orig=qa/$name-uncropped.${file##*.}
        mkdir -p qa && mv "$file" "$orig"
        if [ "$kind" = rec ]; then
          ffmpeg -v error -y -i "$orig" -vf "crop=$crop" -r 30 -c:v libx264 -crf 10 "$file" || fail crop
        else
          ffmpeg -v error -y -i "$orig" -vf "crop=$crop" "$file" || fail crop
        fi
      fi
      if [ -f "$file" ]; then
        bar=$(node "$V/scripts/statusbar-check.js" "$file")
        [[ $bar != *"no geometry"* || -z $orig ]] || bar=$(node "$V/scripts/statusbar-check.js" "$orig")
        echo "$bar"
        [[ $bar == *"status bar ok"* ]] || fail "status bar"
      fi
      check_s=$(secs "$t0")
    fi
    t0=$(now); entries "$t" after || [ "$status" != ok ] || fail after; after_s=$(secs "$t0")
  } >>"$log" 2>&1
  { grep -v "^$name	" "$tsv"; printf '%s\t' "$name" "$kind" "$bar_s" "$preset_s" "$setup_s" "$guard_s" "$take_s" "$check_s" "$after_s" "$ids" "$writes"; echo "$status"; } >"$tsv.new" && mv "$tsv.new" "$tsv"
  printf '%-14s %-5s %s  (preset %ss, setup %ss, take %ss, checks %ss)\n' "$name" "$kind" "$status" "$preset_s" "$setup_s" "$take_s" "$check_s"
  if [ "$status" != ok ]; then
    echo "stopped at $name: $status. Last lines of $log:" >&2
    tail -8 "$log" >&2
    exit 1
  fi
  n=$((n + 1))
  f=media/$name.png
  [ "$kind" = rec ] && { f=$ends/$name.png; ffmpeg -v error -y -sseof -0.2 -i "media/$name.mp4" -frames:v 1 "$f"; }
  cp "$f" "$ends/$(printf %02d $n).png"
done 3<<<"$takes"

ffmpeg -v error -y -i "$ends/%02d.png" -vf "scale=270:606:force_original_aspect_ratio=decrease,pad=270:606:(ow-iw)/2:(oh-ih)/2,tile=6x$(((n + 5) / 6))" -frames:v 1 "capture/run-$side.png"
command rm -rf "$ends"
echo "$n takes ok: capture/run-$side.tsv, capture/run-$side.png (end frames, in take order)"
