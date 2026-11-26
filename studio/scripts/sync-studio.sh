#!/usr/bin/env bash
# Keeps the user's copy of the studio ($PR_CLIP_STUDIO, default ~/pr-clip-studio) in step with the
# skill's own studio/, and never touches their clips. Run it from the skill: an old copy may not have it.
#   <skill>/studio/scripts/sync-studio.sh check    what an update would change (">f" changed or new,
#                                                  "*deleting" gone). Prints nothing when the skill's studio
#                                                  hasn't changed since the copy's last sync, so the user's
#                                                  own edits (brand.ts, identifiers.json) don't count.
#   <skill>/studio/scripts/sync-studio.sh update   backs the copy up to .pre-update-<time>/, makes it match,
#                                                  and prints the npm command to run next.
# Two rsyncs, not one with --backup: macOS's rsync (openrsync) skips every deletion when --backup is set.
set -euo pipefail
src=$(cd "$(dirname "$0")/.." && pwd)
dest=${PR_CLIP_STUDIO:-$HOME/pr-clip-studio}
mode=${1:-}
[ -f "$dest/package.json" ] || { echo "no studio copy at $dest: SKILL.md § Setup makes one" >&2; exit 1; }
# One list for the check, the backup and the update. The clips stay; EXAMPLE follows the skill.
f=(--exclude node_modules/ --exclude .remotion/ --exclude out/ --exclude .git/ --exclude .claude/ --exclude .DS_Store
  --exclude clip.log --exclude '.pre-update-*/' --exclude .skill-stamp --include /videos/EXAMPLE/ --exclude '/videos/*')

# The skill's studio as one hash, by path and content, through the same list.
stamp() {
  local tmp
  tmp=$(mktemp -d)
  rsync -a "${f[@]}" "$src/" "$tmp/"
  (cd "$tmp" && find . -type f -print0 | LC_ALL=C sort -z | xargs -0 shasum) | shasum | cut -d' ' -f1
  /bin/rm -rf "$tmp"
}

case $mode in
  check)
    [ "$(cat "$dest/.skill-stamp" 2>/dev/null)" = "$(stamp)" ] && exit 0
    # -c compares content: a copy made with cp -R has new mtimes. Lines starting "." differ only in time.
    out=$(rsync -rcni --delete "${f[@]}" "$src/" "$dest/")
    changes=$(printf '%s\n' "$out" | grep -v '^\.' | grep . || true)
    # Already the same (a fresh copy): stamp it, so edits the user makes from now on stay theirs.
    if [ -z "$changes" ]; then stamp >"$dest/.skill-stamp"; else echo "$changes"; fi
    ;;
  update)
    if cmp -s "$src/package.json" "$dest/package.json" && cmp -s "$src/package-lock.json" "$dest/package-lock.json" && [ -d "$dest/node_modules" ]; then
      npm="npm test" # npm ci would also drop the headless Chrome Remotion keeps in node_modules
    else
      npm="npm ci && npm test"
    fi
    backup="$dest/.pre-update-$(date +%Y%m%d-%H%M%S)"
    rsync -a "${f[@]}" "$dest/" "$backup/"
    rsync -a --delete "${f[@]}" "$src/" "$dest/"
    stamp >"$dest/.skill-stamp"
    echo "old files in $backup"
    echo "then: cd \"$dest\" && $npm"
    ;;
  *) echo "usage: sync-studio.sh check|update" >&2; exit 1 ;;
esac
