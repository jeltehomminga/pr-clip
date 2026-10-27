#!/usr/bin/env bash
# Evaluate JS in the running React Native dev client (argent debugger-evaluate) and print the
# result as one JSON line. Use it to force a state the test data can't give (call your query
# client's setQueryData) or to read a guard (app.writes in takes.json).
#   scripts/app-eval.sh <udid> <expression | file.js> [--port N]
#   scripts/app-eval.sh "$udid" 'globalThis.__queryClient.getQueryData(["cart"])' --port 8083
# A Promise comes back unresolved: chain .then in the expression and read the outcome with a
# second call. When the runtime isn't connected, it runs debugger-connect once and retries.
set -euo pipefail
usage="usage: scripts/app-eval.sh <udid> <expression | file.js> [--port N]"
udid=${1:?$usage}
code=${2:?$usage}
port=""
if [ $# -gt 2 ]; then
  [ "$3" = --port ] || { echo "$usage" >&2; exit 2; }
  port=${4:?$usage}
fi
[ -f "$code" ] && code=$(cat "$code")
cd /tmp # argent runs from outside any repo

# argent can print a NOTE line (say, about another device's recording) before its JSON.
evaluate() { argent run debugger-evaluate --device_id "$udid" ${port:+--port "$port"} --expression "$1" | sed -n '/^[{[]/,$p'; }

# The probe can't throw, so when it fails the runtime isn't connected.
if ! evaluate 'true' >/dev/null 2>&1; then
  argent run debugger-connect --device_id "$udid" ${port:+--port "$port"} >/dev/null
fi
evaluate "$code" | jq -c .result
