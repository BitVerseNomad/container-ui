#!/bin/sh
# Installs the latest Container UI release into /Applications (Apple Silicon only).
# Usage: curl -fsSL https://raw.githubusercontent.com/BitVerseNomad/container-ui/main/scripts/install.sh | sh
# The app is not signed, so the quarantine flag is cleared on the copy this script installs, nothing else.
set -eu

# The GitHub repo releases come from. Set once when the repo is published.
REPO="BitVerseNomad/container-ui"

[ "$(uname -m)" = "arm64" ] || { echo "Container UI is built for Apple Silicon Macs only." >&2; exit 1; }

app="/Applications/Container UI.app"
tmp="$(mktemp -d)"
trap 'hdiutil detach "$tmp/mnt" -quiet 2>/dev/null || true; rm -rf "$tmp"' EXIT

# OPENPIER_DMG installs a .dmg you already have (a local build) instead of downloading one.
dmg="${OPENPIER_DMG:-}"
if [ -z "$dmg" ]; then
  repo="${OPENPIER_REPO:-$REPO}"
  echo "Finding the latest release of $repo…"
  url="$(curl -fsSL "https://api.github.com/repos/$repo/releases/latest" | grep -o '"browser_download_url": *"[^"]*\.dmg"' | head -1 | sed 's/.*"\(http[^"]*\)"/\1/')"
  [ -n "$url" ] || { echo "No .dmg found on the latest release of $repo." >&2; exit 1; }
  echo "Downloading $(basename "$url")…"
  dmg="$tmp/openpier.dmg"
  curl -fL --progress-bar "$url" -o "$dmg"
fi
hdiutil attach "$dmg" -nobrowse -quiet -mountpoint "$tmp/mnt"

if pgrep -f "Container UI.app/Contents/MacOS" >/dev/null 2>&1; then
  osascript -e 'tell application "Container UI" to quit' >/dev/null 2>&1 || true
  sleep 2
fi
if [ -d "$app" ]; then
  old="$HOME/.Trash/Container UI $(date +%Y%m%d-%H%M%S).app"
  mv "$app" "$old" && echo "Moved the old app to the Trash."
fi

ditto "$tmp/mnt/Container UI.app" "$app"
xattr -dr com.apple.quarantine "$app" 2>/dev/null || true
echo "Installed $app."

command -v colima >/dev/null 2>&1 || echo "Colima isn't installed yet. The app offers to install it when it opens."
open "$app"
