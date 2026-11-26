#!/usr/bin/env bash
# Narration for one film. Kokoro reads videos/<KEY>/vo-src/NN-beat.txt (one sentence per line,
# one caption cue each) into videos/<KEY>/media/vo/<beat>.wav, levelled to -16 LUFS, 48 kHz mono,
# and sets .voice = { "<beat>": { file, frames, cues } } in videos/<KEY>/props.json.
#   scripts/render-vo.sh <KEY> [voice]            af_heart (default); to compare: af_bella, af_sarah, af_nicole, bf_emma
#   KOKORO_SPEED=0.85 scripts/render-vo.sh <KEY>  slower (default 0.9); try another voice before another speed
# Prints per beat: seconds, frames at 30 fps, words, wpm and the measured loudness.
# media/vo/ is emptied first and .voice is replaced whole, so a removed beat leaves nothing behind.
set -euo pipefail
cd "$(dirname "$0")/.."
key=${1:?usage: scripts/render-vo.sh <KEY> [voice]}
voice=${2:-af_heart}
dir=videos/$key
src=$dir/vo-src
props=$dir/props.json
kokoro=${KOKORO_HOME:-$HOME/.local/share/kokoro-tts}
python=$kokoro/venv/bin/python
if [ ! -x "$python" ] || [ ! -s "$kokoro/kokoro-v1.0.onnx" ]; then
  echo "Kokoro is not installed at $kokoro - run: scripts/setup-tts.sh" >&2; exit 1
fi

raw=$(mktemp -d)
trap '/bin/rm -rf "$raw"' EXIT
KOKORO_HOME="$kokoro" "$python" scripts/tts.py "$src" "$raw" "$voice"

mkdir -p "$dir/media/vo"
/bin/rm -f "$dir/media/vo/"*.wav
echo '{}' >"$raw/voice.json"
echo
printf '%-16s %7s %6s %5s %4s %6s\n' beat seconds frames words wpm LUFS
for wav in "$raw"/*.wav; do
  beat=$(basename "$wav" .wav)
  file=$dir/media/vo/$beat.wav
  # Gain to -16 LUFS, then a 4x-oversampled limiter at -2 dBFS (as render-film.sh). loudnorm alone
  # runs linear on a line under 3 s and stops at its true-peak ceiling: a 3 s line came out at -21.5.
  rawI=$(ffmpeg -nostats -i "$wav" -af "highpass=f=70,ebur128" -f null - 2>&1 | awk '$1 == "I:" { v = $2 } END { print v }')
  gain=$(awk -v i="$rawI" 'BEGIN { printf "%.2f", -16 - i }')
  ffmpeg -v error -y -i "$wav" -af "highpass=f=70,volume=${gain}dB,aresample=192000,alimiter=limit=0.7943:level=false,aresample=48000" \
    -ac 1 -c:a pcm_s16le "$file"
  secs=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$file")
  frames=$(awk -v s="$secs" 'BEGIN { n = s * 30; printf "%d", (n == int(n)) ? n : int(n) + 1 }')
  words=$(wc -w <"$src/$beat.txt" | tr -d ' ')
  wpm=$(awk -v w="$words" -v s="$secs" 'BEGIN { printf "%d", w * 60 / s + 0.5 }')
  lufs=$(ffmpeg -nostats -i "$file" -af ebur128 -f null - 2>&1 | awk '$1 == "I:" { v = $2 } END { print v }')
  jq --arg b "$beat" --arg f "vo/$beat.wav" --argjson n "$frames" --slurpfile c "$raw/$beat.cues.json" \
    '.[$b] = { file: $f, frames: $n, cues: $c[0] }' "$raw/voice.json" >"$raw/next.json"
  mv "$raw/next.json" "$raw/voice.json"
  printf '%-16s %6.2fs %6d %5d %4d %6s\n' "$beat" "$secs" "$frames" "$words" "$wpm" "$lufs"
done

[ -f "$props" ] || echo '{}' >"$props"
jq --slurpfile v "$raw/voice.json" '.voice = $v[0]' "$props" >"$props.next"
mv "$props.next" "$props"
echo
echo "voice: $voice; .voice written to $props (internal pace 150-170 wpm, -16 LUFS +-1)"
