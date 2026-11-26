#!/bin/sh
# Regenerates the PWA icons from scripts/icon.html (needs Google Chrome; macOS `sips` for resizing).
set -e
cd "$(dirname "$0")/.."
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files \
  --window-size=512,512 --virtual-time-budget=3000 --screenshot=public/icon-512.png "file://$PWD/scripts/icon.html" 2>/dev/null
sips -z 192 192 public/icon-512.png --out public/icon-192.png >/dev/null
sips -z 180 180 public/icon-512.png --out public/apple-touch-icon.png >/dev/null
echo "icons written to public/"
