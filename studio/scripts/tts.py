"""Narration with Kokoro-82M (Apache-2.0, CPU via onnxruntime): one wav plus caption cues per beat.

Usage: <venv>/bin/python scripts/tts.py <vo-src dir> <out dir> [voice]
Normally run through scripts/render-vo.sh <KEY>, which also levels the voice and fills props.json.

Each NN-beat.txt in <vo-src dir> holds one sentence per non-empty line, and each line is one
caption cue. kokoro-onnx gives no word timings, so every sentence is read on its own and the
next one starts max(0.4, chars / 17 - spoken seconds) later: a caption held until the next
cue then stays up long enough to read (17 characters per second).
Writes <out dir>/<beat>.wav and <out dir>/<beat>.cues.json, [{text, start, end}] in seconds,
end being the end of speech.
KOKORO_SPEED sets the pace (default 0.95); KOKORO_HOME the install (default ~/.local/share/kokoro-tts,
made by scripts/setup-tts.sh).
"""

import json
import os
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

if len(sys.argv) < 3:
    sys.exit(__doc__)
src, out = Path(sys.argv[1]), Path(sys.argv[2])
voice = sys.argv[3] if len(sys.argv) > 3 else "af_heart"
speed = float(os.environ.get("KOKORO_SPEED", "0.95"))
models = Path(os.environ.get("KOKORO_HOME", Path.home() / ".local/share/kokoro-tts"))
beats = sorted(src.glob("*.txt"))
if not beats:
    sys.exit(f"no *.txt in {src}")
out.mkdir(parents=True, exist_ok=True)

kokoro = Kokoro(str(models / "kokoro-v1.0.onnx"), str(models / "voices-v1.0.bin"))

for txt in beats:
    lines = [line.strip() for line in txt.read_text().splitlines() if line.strip()]
    if not lines:
        sys.exit(f"{txt} has no lines")
    parts, cues, n = [], [], 0  # n counts samples, so cue times don't drift
    for i, line in enumerate(lines):
        samples, rate = kokoro.create(line, voice=voice, speed=speed, lang="en-us")
        cues.append({"text": line, "start": round(n / rate, 3), "end": round((n + len(samples)) / rate, 3)})
        parts.append(samples)
        n += len(samples)
        if i < len(lines) - 1:
            pause = max(0.4, len(line) / 17 - len(samples) / rate)
            parts.append(np.zeros(round(pause * rate), dtype=samples.dtype))
            n += len(parts[-1])
    sf.write(out / f"{txt.stem}.wav", np.concatenate(parts), rate)
    (out / f"{txt.stem}.cues.json").write_text(json.dumps(cues, indent=2) + "\n")
    print(f"{txt.stem}: {len(lines)} cues, {n / rate:.2f}s")
