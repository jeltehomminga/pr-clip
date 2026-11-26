#!/usr/bin/env bash
# One-time, idempotent Kokoro-82M install shared by every clip.
#   scripts/setup-tts.sh    (in the studio)
# venv + the two model files (~340 MB) land in $KOKORO_HOME (default
# ~/.local/share/kokoro-tts). Re-run any time: every step is skipped when present.
# Python 3.13 from Homebrew - the 3.14 that `python3` resolves to has no ML wheels yet.
set -euo pipefail
home=${KOKORO_HOME:-$HOME/.local/share/kokoro-tts}
mkdir -p "$home"
py="$(brew --prefix python@3.13 2>/dev/null || true)/bin/python3.13"
[ -x "$py" ] || { echo "python@3.13 missing: brew install python@3.13" >&2; exit 1; }
if [ ! -x "$home/venv/bin/python" ]; then
  echo "creating venv at $home/venv"; "$py" -m venv "$home/venv"
fi
if ! "$home/venv/bin/python" -c "import kokoro_onnx, soundfile" 2>/dev/null; then
  echo "installing kokoro-onnx + soundfile"; "$home/venv/bin/pip" install -q kokoro-onnx soundfile
fi
base=https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0
for f in kokoro-v1.0.onnx voices-v1.0.bin; do
  if [ ! -s "$home/$f" ]; then
    echo "downloading $f"; curl -fSL --retry 3 -o "$home/$f.part" "$base/$f" && mv "$home/$f.part" "$home/$f"
  fi
done
/bin/ls -l "$home"
echo "ok - Kokoro at $home. Then: scripts/render-vo.sh <KEY> (af_heart), scripts/render-vo.sh <KEY> af_bella to compare voices"
