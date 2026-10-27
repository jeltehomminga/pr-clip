#!/usr/bin/env bash
# The two stills ClipWithHolds needs, written next to the clip in videos/<KEY>/media/:
#   <base>-first.png = frame trimBefore      <base>-last.png = frame trimAfter - 1
#   scripts/extract-holds.sh <KEY> <clip> [trimBefore] [trimAfter]      (defaults: 0, the clip's frame count)
# Prints the clip's frame count first, so trimAfter is read, not guessed.
set -euo pipefail
usage="usage: scripts/extract-holds.sh <KEY> <clip> [trimBefore] [trimAfter]"
studio=$(cd "$(dirname "$0")/.." && pwd)
key=${1:?$usage}; clip=${2:?$usage}
media="$studio/videos/$key/media"; src="$media/$clip"; base="${clip%.*}"
[ -f "$src" ] || { echo "no $src" >&2; exit 1; }
frames=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$src")
before=${3:-0}; after=${4:-$frames}
# Out of range, ffmpeg selects no frame, writes nothing and leaves an older hold in place.
[ "$before" -ge 0 ] && [ "$before" -lt "$after" ] && [ "$after" -le "$frames" ] ||
  { echo "need 0 <= trimBefore < trimAfter <= $frames, got $before and $after" >&2; exit 1; }
echo "$clip: $frames frames; holds from frame $before and frame $((after - 1))"
ffmpeg -v error -y -i "$src" -vf "select=eq(n\,$before)" -fps_mode passthrough -frames:v 1 "$media/$base-first.png"
ffmpeg -v error -y -i "$src" -vf "select=eq(n\,$((after - 1)))" -fps_mode passthrough -frames:v 1 "$media/$base-last.png"
/bin/ls -l "$media/$base-first.png" "$media/$base-last.png"
