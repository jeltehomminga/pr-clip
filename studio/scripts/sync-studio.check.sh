#!/usr/bin/env bash
# npm test: sync-studio.sh on a scratch copy. An update keeps the clips and backs up what it removes;
# the user's own edit after a sync is no drift; a changed skill lists it.
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

[ -n "$($sync check)" ] || fail "an old copy shows no drift"
$sync update >/dev/null
[ -z "$($sync check)" ] || fail "drift right after an update"
[ "$(cat "$copy/videos/my-clip/props.json")" = kept ] || fail "the update touched a clip"
[ ! -e "$copy/stale.txt" ] && [ -f "$copy"/.pre-update-*/stale.txt ] || fail "a removed file is not in the backup"
cmp -s src/brand.ts "$copy/src/brand.ts" || fail "the update left brand.ts behind"
echo "// mine" >>"$copy/src/brand.ts"
[ -z "$($sync check)" ] || fail "the user's own edit counts as drift"
echo old-skill >"$copy/.skill-stamp"
$sync check | grep -q 'src/brand.ts' || fail "a changed skill does not list the edited brand.ts"
echo "sync-studio: 7 checks passed"
