# pr-clip

A Claude Code skill that makes before/after video clips of a pull request: the old and the new UI side by side or wiped, the change marked with corner brackets, every state the PR built, captions read aloud, and an end card with the PR's facts. It renders locally with Remotion; nothing is uploaded.

## Install

1. Clone it into your skills folder: `git clone https://github.com/jeltehomminga/pr-clip ~/.claude/skills/pr-clip`. A zip works too: unzip it so this file sits at `~/.claude/skills/pr-clip/README.md`.
2. Ask Claude Code for "a PR clip of <owner/repo>#<number>". On first use it copies `studio/` to `~/pr-clip-studio` (or `$PR_CLIP_STUDIO`) and sets it up: SKILL.md § Setup.

Written for macOS and Claude Code. Needs Node 24+, ffmpeg, jq, bc, the `gh` CLI and Homebrew; Chrome for web clips; Xcode and/or the Android SDK, a built Expo dev client, argent and simslim for app clips. SKILL.md § Setup has the commands.

## What's inside

- `SKILL.md`: the procedure, step by step.
- `references/`: inventory rules, worktrees, web capture, app capture, checks.
- `studio/`: the Remotion project. `studio/CLAUDE.md` holds the house rules and why; `studio/src/brand.ts` is the one file to swap for your brand; `studio/identifiers.json` lists what must never show in full (add your own patterns).

## Licences

- This skill and studio: MIT (`LICENSE`).
- Remotion (the renderer, an npm dependency) has its own licence: free for individuals and companies of up to 3 people; a bigger company needs a Remotion company licence. Read remotion.dev/license before you use it at work.
- Schibsted Grotesk: SIL Open Font License, © The Schibsted Grotesk Project Authors (`studio/src/assets/OFL.txt`).
- UI sounds: rendered with earshot (MIT) from CC0 recordings (`studio/src/assets/sfx/CREDITS.md`).
- Voice: Kokoro-82M and kokoro-onnx (Apache-2.0 / MIT), downloaded by `studio/scripts/setup-tts.sh`.
- argent (app capture, installed separately): Apache-2.0 source with some proprietary binaries. simslim: MIT.
