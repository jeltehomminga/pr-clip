#!/usr/bin/env bash
# Clean status bar on the clip's device: 9:41, full battery, full wifi, nothing else.
#   scripts/statusbar.sh <device>        set it (run before every take; app-takes.sh does); on
#                                        Android exits 1 when a screencap still fails the check
#   scripts/statusbar.sh <device> off    back to normal at teardown
# iOS (a simulator UDID): `simctl status_bar override`. Android (a serial): demo mode, wifi
# `fully true` (without it the icon carries a "!", no internet), mobile and notification icons
# hidden, and the Safety Center shield, which demo mode leaves up, snoozed for 3 h.
# scripts/statusbar-check.js then proves the bar on the capture itself.
set -euo pipefail
s=${1:?usage: scripts/statusbar.sh <device> [off]}
if [[ $s =~ ^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}- ]]; then
  if [ "${2:-}" = off ]; then xcrun simctl status_bar "$s" clear; exit 0; fi
  xcrun simctl status_bar "$s" override --time 9:41 --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3
  echo "status bar set on $s"
  exit 0
fi
d() { adb -s "$s" shell am broadcast -a com.android.systemui.demo -e command "$@" >/dev/null; }
if [ "${2:-}" = off ]; then
  d exit
  adb -s "$s" shell settings put global sysui_demo_allowed 0
  exit 0
fi
demo() {
  adb -s "$s" shell settings put global sysui_demo_allowed 1
  d enter
  d clock -e hhmm 0941
  d battery -e level 100 -e plugged false
  d network -e wifi show -e level 4 -e fully true
  d network -e mobile hide
  d notifications -e visible false
  adb -s "$s" shell dumpsys notification --noredact 2>/dev/null |
    sed -n -E '/channel=safety_center/s/.*key=([^ ]+): Notification\(.*/\1/p' | sort -u |
    while IFS= read -r key; do adb -s "$s" shell cmd notification snooze --for 10800000 "'$key'"; done
}
# Proven on a screencap, and once more after a demo reset when it fails: one full run recorded
# two wifi icons once, which no second set reproduced.
check() {
  local t out rc=0
  sleep 0.5 # the bar redraws after the broadcasts
  t=$(mktemp -d)
  adb -s "$s" exec-out screencap -p >"$t/bar.png"
  out=$(node "$(dirname "$0")/statusbar-check.js" "$t/bar.png") || rc=1
  command rm -rf "$t"
  echo "${out##*status bar }"
  return $rc
}
demo
if ! verdict=$(check); then
  echo "status bar on $s: $verdict, resetting demo mode" >&2
  d exit
  adb -s "$s" shell settings put global sysui_demo_allowed 0
  demo
  verdict=$(check) || { echo "status bar on $s: $verdict" >&2; exit 1; }
fi
echo "status bar set on $s ($verdict)"
