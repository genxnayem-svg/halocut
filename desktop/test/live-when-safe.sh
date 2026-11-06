#!/bin/sh
# Re-runs the Premiere edit suite every 10 s until the active sequence is not the protected one.
cd "$(dirname "$0")/.."
# The sequence never to edit: HALOCUT_AVOID, else test/.avoid (kept on this Mac only, never in git)
AVOID="${HALOCUT_AVOID:-$(cat test/.avoid 2>/dev/null)}"
[ -n "$AVOID" ] || { echo "Set the sequence to protect: HALOCUT_AVOID=<name> or put its name in desktop/test/.avoid" >&2; exit 1; }
while true; do
  node test/live.js PPRO --edit --avoid "$AVOID"
  code=$?
  [ $code -ne 2 ] && exit $code
  sleep 10
done
