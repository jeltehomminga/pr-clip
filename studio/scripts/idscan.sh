#!/bin/bash
# Identifier scan of describe text on stdin, against the patterns in identifiers.json. Prints
# "ids 0" and exits 0 when clean, else the count per kind (never the values) and exits 1.
#   argent run describe --udid <device> | jq -r .description | scripts/idscan.sh
exec node -e '
const { patterns } = require(process.argv[1])
const text = require("fs").readFileSync(0, "utf8")
const counts = patterns.map((p) => [p.kind, (text.match(new RegExp(p.regex, "gi")) ?? []).length])
const n = counts.reduce((sum, [, c]) => sum + c, 0)
console.log(`ids ${n} (${counts.map(([k, c]) => `${k} ${c}`).join(", ")})`)
process.exit(n === 0 ? 0 : 1)
' "$(cd "$(dirname "$0")/.." && pwd)/identifiers.json"
