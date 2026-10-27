#!/usr/bin/env bash
# Steps 5-6 of a PR clip in one call, once props.json has its captions, brackets, trims and state:
#   scripts/clip.sh <KEY>        (run it in the background; it takes as long as the render)
# props.ts (measures, holds) -> npm test -> render.sh --gif -> one still per beat -> check.sh ->
# check.sh sheet. Each step logs to videos/<KEY>/clip.log, outside out/ (render.sh empties out/);
# only a failing step prints, and only its tail. Ends on check.sh's rows and the files to look at.
set -euo pipefail
cd "$(dirname "$0")/.."
key=${1:?usage: scripts/clip.sh <KEY>}
dir=videos/$key
out=$dir/out
log=$dir/clip.log
[ -f "$dir/props.json" ] || { echo "no $dir/props.json" >&2; exit 1; }
node=(node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON)
: >"$log"
step() { # step <name> <command...>
  local name=$1
  shift
  echo "== $name" >>"$log"
  "$@" >>"$log" 2>&1 || { echo "FAIL $name - its last lines in $log:" >&2; sed -n "/^== $name\$/,\$p" "$log" | tail -20 >&2; exit 1; }
}

step props "${node[@]}" scripts/props.ts "$key"
step test npm test --silent
step render scripts/render.sh "$key" --gif

# One still per beat (its settled frame; the end card's last frame), full size from the master.
beats=$("${node[@]}" scripts/frames.ts "$dir/props.json" --stills)
sel=$(awk '{ printf "%seq(n\\,%s)", (NR > 1 ? "+" : ""), $1 }' <<<"$beats")
step stills ffmpeg -v error -y -i "$out/master.mp4" -vf "select='$sel'" -fps_mode passthrough "$out/still-%02d.png"

set +e
echo "== check" >>"$log"
scripts/check.sh "$key" | tee -a "$log"
ok=$?
set -e
step sheet scripts/check.sh sheet "$key"

echo
awk -v out="$out" '{ printf "%s/still-%02d.png  %s %s  frame %s\n", out, NR, $2, $3, $1 }' <<<"$beats"
/bin/ls "$out"/sheet-*.png
exit "$ok"
