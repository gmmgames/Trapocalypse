#!/usr/bin/env bash
# Renders logo-source.html to a transparent PNG using the Chrome already on this PC.
# Usage (from any folder):
#   bash assets/logo/render-logo.sh "Font Name" weight caps out.png
#   e.g. bash assets/logo/render-logo.sh "Fredoka" 700 0 logo.png
FONT="${1:-Fredoka}"; WEIGHT="${2:-700}"; CAPS="${3:-0}"; OUT="${4:-logo.png}"
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
HERE="$(cd "$(dirname "$0")" && pwd -W)"                  # Windows-style path of this folder
OUTABS="$(cd "$(dirname "$OUT")" && pwd -W)/$(basename "$OUT")"
Q="$(printf '%s' "$FONT" | sed 's/ /+/g')"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --no-first-run \
  --user-data-dir="$TEMP/trapocalypse-chrome-profile" \
  --window-size=1600,420 --default-background-color=00000000 \
  --virtual-time-budget=8000 \
  --screenshot="$OUTABS" \
  "file:///$HERE/logo-source.html?font=$Q&weight=$WEIGHT&caps=$CAPS" 2>&1 | grep -i "bytes written" || echo "render failed"
