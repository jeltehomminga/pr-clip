#!/usr/bin/env bash
# Zero-counter checks on a rendered clip. Exit 0, and out/check.ok, only when every line passes.
#   scripts/check.sh <KEY>          all checks; renders one mid-motion frame twice for the md5 check
#   scripts/check.sh sheet <KEY>    contact sheets, 2 fps, 270 px tiles -> out/sheet-NN.png
#   scripts/check.sh phone <KEY>    phone sheets, 1 fps, 360 px tiles (readability) -> out/phone-NN.png
set -euo pipefail
cd "$(dirname "$0")/.."
mode=all
case ${1:-} in sheet | phone) mode=$1; shift ;; esac
key=${1:?usage: scripts/check.sh [sheet|phone] <KEY>}
dir=videos/$key
out=$dir/out
master=$out/master.mp4
share=$out/$key-before-after.mp4
for f in "$master" "$share"; do [ -f "$f" ] || { echo "no $f - run scripts/render.sh $key first" >&2; exit 1; }; done

case $mode in
  sheet) ffmpeg -v error -y -i "$master" -vf "fps=2,scale=270:-1,tile=6x5" "$out/sheet-%02d.png"; /bin/ls "$out"/sheet-*.png; exit 0 ;;
  phone) ffmpeg -v error -y -i "$share" -vf "fps=1,scale=360:-1,tile=5x3" "$out/phone-%02d.png"; /bin/ls "$out"/phone-*.png; exit 0 ;;
esac

/bin/rm -f "$out/check.ok"
fail=0
row() { # row <ok|warn|FAIL> <check> <detail>
  printf '%-5s %-14s %s\n' "$1" "$2" "$3"
  [ "$1" != FAIL ] || fail=1
}
judge() { if [ "$1" = 1 ]; then echo ok; else echo FAIL; fi; }

nums=$(node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/frames.ts "$dir/props.json")
read -r total _ motion <<<"$nums"

frames=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of default=nw=1:nk=1 "$master")
row "$(judge $(( frames >= total - 1 && frames <= total + 1 )))" duration "$frames frames, timeline $total"

for f in "$master" "$share"; do
  got=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,color_space,color_primaries,color_transfer -of json "$f" |
    jq -r '.streams[0] | "\(.width)x\(.height) \(.r_frame_rate) \(.color_space)/\(.color_primaries)/\(.color_transfer)"')
  row "$(judge $([ "$got" = "1920x1080 30/1 bt709/bt709/bt709" ] && echo 1 || echo 0))" format "$(basename "$f"): $got"
done

len() { ffprobe -v error -select_streams "$1:0" -show_entries stream=duration -of default=nw=1:nk=1 "$share"; }
vlen=$(len v) alen=$(len a)
row "$(judge $(echo "$alen <= $vlen" | bc))" tail "share audio $alen s, video $vlen s (audio past the video plays over black)"

# The agent context (render.sh): parses, names this clip, and is ASCII, so `strings` returns it whole.
ctx=$(ffprobe -v error -show_entries format_tags=comment -of default=nw=1:nk=1 "$share")
want=$(jq -r .issueKey "$dir/props.json")
got=$(jq -r .issueKey <<<"$ctx" 2>/dev/null || echo none)
nonascii=$(printf %s "$ctx" | LC_ALL=C grep -c '[^ -~]' || true)
row "$(judge $([ "$got" = "$want" ] && [ "$nonascii" = 0 ] && echo 1 || echo 0))" context \
  "comment tag ${#ctx} bytes, issueKey ${got:-none}, $nonascii non-ASCII lines"

# wc -c and md5sum-or-md5: the same on macOS and Linux.
bytes() { wc -c <"$1" | tr -d " "; }
hash() { if command -v md5sum >/dev/null; then md5sum "$1" | cut -d" " -f1; else md5 -q "$1"; fi; }
size=$(bytes "$share")
mb=$(echo "scale=2; $size / 1048576" | bc)
per30=$(echo "scale=2; $size * 900 / $total / 1048576" | bc)
# 5 MB per 60 s; a clip whose maxSeconds lifts the 60 s cap gets the same share.
capmb=$(jq -r '[5, (.maxSeconds // 60) / 12] | max' "$dir/props.json")
if [ "$(echo "$size > $capmb * 1048576" | bc)" = 1 ]; then row FAIL size "$mb MB share copy, over $capmb MB"
elif [ "$(echo "$per30 > 2.5" | bc)" = 1 ]; then row warn size "$mb MB, $per30 MB per 30 s (budget 2.5)"
else row ok size "$mb MB, $per30 MB per 30 s"; fi

gif=$out/$key-before-after.gif
if [ -f "$gif" ]; then
  gsize=$(bytes "$gif")
  row "$(judge $(( gsize <= 2621440 )))" gif "$(echo "scale=2; $gsize / 1048576" | bc) MB (max 2.5)"
fi

fits=$(grep -c 'FIT:' "$out/render.log" || true)
row "$(judge $(( fits == 0 )))" fit "$fits FIT: lines in render.log"
# Remotion prints browser console.warn/error (not console.log) as "[Tab N, file:line] message".
browser=$(grep -c '^\[Tab [0-9]' "$out/render.log" || true)
row "$(judge $(( browser == 0 )))" console "$browser browser warnings or errors in render.log"

tmp=$(mktemp -d)
for run in a b; do
  npx remotion still PrClip "$tmp/$run.png" --props="$dir/props.json" --public-dir="$dir/media" --frame="$motion" >"$tmp/$run.log" 2>&1 || { cat "$tmp/$run.log" >&2; exit 1; }
done
same=$([ "$(hash "$tmp/a.png")" = "$(hash "$tmp/b.png")" ] && echo 1 || echo 0)
row "$(judge "$same")" determinism "frame $motion rendered twice, md5 $([ "$same" = 1 ] && echo equal || echo differs)"
/bin/rm -rf "$tmp"

peak=$(ffmpeg -nostats -i "$share" -filter_complex ebur128=peak=true -f null - 2>&1 | awk '/True peak:/ { f = 1 } f && /Peak:/ { print $2; exit }')
row "$(judge $([ -n "$peak" ] && [ "$(echo "$peak <= -1.5" | bc)" = 1 ] && echo 1 || echo 0))" peak "true peak ${peak:-none} dBTP (max -1.5)"

# With a voice, render.sh levels the mix to -16 LUFS.
if jq -e .voice "$dir/props.json" >/dev/null; then
  i=$(ffmpeg -nostats -i "$share" -vn -af ebur128 -f null - 2>&1 | awk '$1 == "I:" { v = $2 } END { print v }')
  row "$(judge "$(awk "BEGIN { print (($i >= -17 && $i <= -15) ? 1 : 0) }" 2>/dev/null || echo 0)")" loudness "integrated ${i:-none} LUFS (-16 ±1)"
fi

# The end card's QR must still scan in the crf-26 share copy.
if jq -e '.details.url and .qr != false' "$dir/props.json" >/dev/null; then
  url=$(jq -r .details.url "$dir/props.json")
  if qr=$(node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/qr-check.ts "$share" "$url" | paste -sd ';' -); then row ok qr "$qr"
  else row FAIL qr "$qr (want $url)"; fi
fi

if [ "$fail" = 0 ]; then
  touch "$out/check.ok"
  echo "all checks passed -> $out/check.ok"
else
  echo "check failed" >&2
  exit 1
fi
