#!/usr/bin/env bash
set -euo pipefail

# Resolve project path and target HTML
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_PATH="$SCRIPT_DIR/popup/popup.html"

if [[ ! -f "$APP_PATH" ]]; then
  echo "Could not find popup/popup.html next to this launcher." >&2
  exit 1
fi

URL="file://$APP_PATH"

launch_linux() {
  for browser in google-chrome google-chrome-stable chromium chromium-browser firefox; do
    if command -v "$browser" >/dev/null 2>&1; then
      case "$browser" in
        firefox) "$browser" -new-window "$URL" >/dev/null 2>&1 & ;;
        *) "$browser" --new-window "$URL" >/dev/null 2>&1 & ;;
      esac
      return 0
    fi
  done

  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" >/dev/null 2>&1 &
    return 0
  fi

  return 1
}

launch_mac() {
  if command -v open >/dev/null 2>&1; then
    if [ -d "/Applications/Google Chrome.app" ]; then
      open -n -a "Google Chrome" --args --new-window "$URL" >/dev/null 2>&1 &
      return 0
    fi
    if [ -d "/Applications/Firefox.app" ]; then
      open -n -a "Firefox" --args -new-window "$URL" >/dev/null 2>&1 &
      return 0
    fi
    open "$URL" >/dev/null 2>&1 &
    return 0
  fi

  return 1
}

case "$(uname -s)" in
  Darwin)
    launch_mac && exit 0
    ;;
  Linux)
    launch_linux && exit 0
    ;;
esac

echo "Could not launch a browser automatically. Please open $URL manually." >&2
exit 1
