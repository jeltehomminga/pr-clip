#!/usr/bin/env bash
# Render one clip into videos/<KEY>/out/: crf-18 master, share copy (agent context in its comment
# tag), poster, optional GIF.
#   scripts/render.sh <KEY> [--gif]          then: scripts/check.sh <KEY>
# out/ is emptied first, so every file listed at the end is fresh (a stale mp4 once passed
# for a new one). Remotion's output, browser console.error and FIT: lines included, goes to
# out/render.log, which check.sh reads.
set -euo pipefail
cd "$(dirname "$0")/.."
key=${1:?usage: scripts/render.sh <KEY> [--gif]}
gif=${2:-}
dir=videos/$key
out=$dir/out
props=$dir/props.json
[ -f "$props" ] || { echo "no $props" >&2; exit 1; }

# timeline() validates the props before anything renders (Remotion would quietly fill a
# missing required field from EXAMPLE's defaultProps).
nums=$(node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/frames.ts "$props")
read -r total poster _ <<<"$nums"
# The agent context for the share copy's comment tag (src/pr-clip/context.ts). Taken here so a
# guard failure stops the run before Remotion: a failing $(...) inside ffmpeg's arguments would
# not trip set -e.
context=$(node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/context.ts "$props")

mkdir -p "$out"
/bin/rm -f "$out"/*
clip=(--props="$props" --public-dir="$dir/media")

npx remotion render PrClip "$out/master.mp4" "${clip[@]}" --codec=h264 --crf=18 2>&1 | tee "$out/render.log"
# Remotion tags only the bt709 matrix; primaries and transfer stay "unknown", and ffmpeg 9 ignores
# -color_primaries/-color_trc on encode. Retag the stream without re-encoding; the share copy
# below inherits the tags from it.
ffmpeg -v error -y -i "$out/master.mp4" -c copy \
  -bsf:v h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1 \
  "$out/master-tagged.mp4"
mv "$out/master-tagged.mp4" "$out/master.mp4"
# With a voice, level the whole mix to -16 LUFS with a gain and a 4x-oversampled limiter at -2 dBFS.
# A clip with only its sounds stays as rendered: levelling would boost the ticks.
if jq -e .voice "$props" >/dev/null; then
  rawI=$(ffmpeg -nostats -i "$out/master.mp4" -vn -af ebur128 -f null - 2>&1 | awk '$1 == "I:" { v = $2 } END { print v }')
  [ -n "$rawI" ] || { echo "no loudness reading from $out/master.mp4" >&2; exit 1; }
  rate=$(ffprobe -v error -select_streams a:0 -show_entries stream=sample_rate -of default=nw=1:nk=1 "$out/master.mp4")
  ffmpeg -v error -y -i "$out/master.mp4" -c:v copy \
    -af "volume=$(awk "BEGIN { printf \"%.2f\", -16 - ($rawI) }")dB,aresample=$((rate * 4)),alimiter=limit=0.7943:level=false:latency=true,aresample=$rate" \
    -c:a aac -b:a 192k "$out/master-level.mp4"
  mv "$out/master-level.mp4" "$out/master.mp4"
fi
# Remotion's AAC runs ~60 ms past the last frame; QuickTime shows black for that tail, so the
# share copy's audio is cut to the video's length.
vlen=$(ffprobe -v error -select_streams v:0 -show_entries stream=duration -of default=nw=1:nk=1 "$out/master.mp4")
ffmpeg -v error -y -i "$out/master.mp4" \
  -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 96k -af "atrim=end=$vlen" \
  -metadata comment="$context" "$out/$key-before-after.mp4"
npx remotion still PrClip "$out/$key-clip-poster.png" "${clip[@]}" --frame="$poster" >>"$out/render.log" 2>&1
if [ "$gif" = "--gif" ]; then
  ffmpeg -v error -y -t 6 -i "$out/master.mp4" \
    -vf "fps=12,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" \
    -loop 0 "$out/$key-before-after.gif"
fi

echo
echo "timeline: $total frames ($(echo "scale=1; $total / 30" | bc) s), poster frame $poster"
/bin/ls -l "$out"
