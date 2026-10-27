#!/bin/bash
# Clear React Native LogBox (dev-only) from the simulator screen and prove it is gone.
# Rule: no LogBox in any still or recording (the app's own toasts are fine). Run it
# right before each still, and before and after a recording: a LogBox toast stays until
# dismissed, so clean at both ends means clean throughout.
#   scripts/logbox-clear.sh <udid>     exit 0 = no LogBox on screen, 1 = still there after 8 tries
udid=${1:?usage: scripts/logbox-clear.sh <udid>}
marker='\\"!, |Console Error|Log [0-9]+ of [0-9]+|Open debugger'
for _ in 1 2 3 4 5 6 7 8; do
  tree=$(argent run describe --udid "$udid" 2>&1)
  if ! grep -q -E "$marker" <<<"$tree"; then echo "logbox: clear"; exit 0; fi
  if grep -q -E '\\"Dismiss\\"' <<<"$tree"; then
    argent run gesture-tap --udid "$udid" --x 0.1665 --y 0.9335 >/dev/null 2>&1 # expanded sheet: Dismiss
  elif grep -q 'Open debugger' <<<"$tree"; then
    argent run gesture-tap --udid "$udid" --x 0.92 --y 0.92 >/dev/null 2>&1 # banner close
  else
    argent run gesture-tap --udid "$udid" --x 0.5 --y 0.928 >/dev/null 2>&1 # collapsed toast: open it
  fi
  sleep 1
done
echo "logbox: still on screen" >&2; exit 1
