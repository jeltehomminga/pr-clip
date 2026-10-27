#!/usr/bin/env bash
# Is a clip still showing the PR's code? fresh, same-ui, accepted or stale: scripts/stale.ts.
#   scripts/stale.sh            every clip with a `pr`
#   scripts/stale.sh <KEY>...   just these
exec node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON "$(dirname "$0")/stale.ts" "$@"
