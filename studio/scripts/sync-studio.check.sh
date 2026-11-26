#!/usr/bin/env bash
# npm test: sync-studio.sh on a scratch copy. An update keeps the clips and backs up what it removes;
# the user's own edit after a sync is no drift; a changed skill lists it; a tool's own dot-folder stays.
set -euo pipefail
cd "$(dirname "$0")/.."
tmp=$(mktemp -d)
trap '/bin/rm -rf "$tmp"' EXIT
export PR_CLIP_STUDIO=$tmp/copy
copy=$PR_CLIP_STUDIO
sync=scripts/sync-studio.sh
fail() { echo "sync-studio: $1" >&2; exit 1; }

mkdir -p "$copy/videos/my-clip"
echo '{}' >"$copy/package.json"
echo kept >"$copy/videos/my-clip/props.json"
echo old >"$copy/stale.txt"
mkdir "$copy/.cursor" && echo mine >"$copy/.cursor/rules.md"

[ -n "$($sync check)" ] || fail "an old copy shows no drift"
case $($sync check) in *.cursor*) fail "another tool's folder counts as drift" ;; esac
$sync update >/dev/null
[ -z "$($sync check)" ] || fail "drift right after an update"
[ "$(cat "$copy/videos/my-clip/props.json")" = kept ] || fail "the update touched a clip"
[ "$(cat "$copy/.cursor/rules.md" 2>/dev/null)" = mine ] || fail "the update removed another tool's folder"
[ ! -e "$copy/stale.txt" ] && [ -f "$copy"/.pre-update-*/stale.txt ] || fail "a removed file is not in the backup"
cmp -s src/brand.ts "$copy/src/brand.ts" || fail "the update left brand.ts behind"
echo "// mine" >>"$copy/src/brand.ts"
[ -z "$($sync check)" ] || fail "the user's own edit counts as drift"
echo old-skill >"$copy/.skill-stamp"
$sync check | grep -q 'src/brand.ts' || fail "a changed skill does not list the edited brand.ts"
# Same size and mtime as the skill's file, other content: the update must still copy it.
printf '%s' "$(head -c "$(wc -c <src/brand.ts)" /dev/zero | tr '\0' x)" >"$copy/src/brand.ts"
touch -r src/brand.ts "$copy/src/brand.ts"
$sync update >/dev/null
cmp -s src/brand.ts "$copy/src/brand.ts" || fail "the update missed a change of the same size and mtime"
[ "$(ls -d "$copy"/.pre-update-* | wc -l | tr -d ' ')" = 2 ] || fail "two updates in one second share a backup"
echo "sync-studio: 11 checks passed"
