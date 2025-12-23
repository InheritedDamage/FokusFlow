# FokusFlow - Offline Pomodoro + Tasks (WebExtension, Vanilla)

Hey there! I’m Dennis Zajonz, and FokusFlow is my personal side project. I went looking for a Pomodoro timer with tasks that wasn’t online or tied to my phone—being connected means emails, messages, and endless pings, and the mobile apps I tried just didn’t feel right. So when I want a calm break from building StockNav (NoLimitsCoding GmbH’s product), I tinker on FokusFlow: an offline-first timer that keeps every bit of your data on your own device—no servers, no cloud, no peeking platforms.

## Features
- Offline Pomodoro (Focus / Short Break / Long Break)
- Tasks + Subtasks
- A task can be marked as **Done** or **deleted** (deleting a parent also deletes its subtasks)
- Select an **active task** to attribute Pomodoros to it
- Coffee-cup visualization: the cup fills/empties proportionally to the remaining time
- Offline persistence via `storage.local`:
  - Tasks/Subtasks including `done` state and `pomos` per task
  - TimerState (mode, running, `endsAt`, etc.)
  - Sessions history (each session completion is logged)

## Why multiple manifests?
- **Chrome/Edge:** Manifest V3 requires `background.service_worker`.
- **Firefox:** Manifest V3 uses `background.scripts` (event background); `service_worker` is not supported.
- **Safari:** WebExtensions via Xcode Converter; MV3 service worker is possible.

## Installation

### Standalone (no browser add-on)
1. Double-click `launch-standalone.bat`. The script detects your default browser (Chrome/Edge/Firefox) and opens `popup/popup.html` in a new window.
2. If the batch file cannot find a browser, open `popup/popup.html` directly in your browser as a fallback.
3. Data is stored in browser `localStorage`; if that is blocked, data is kept only for the current tab/session.
4. Limitations: no badge icon, and the timer keeps running only while the tab/window stays open (no background service worker).

#### Create a desktop shortcut for `launch-standalone.bat` (Windows)
1. Right-click `launch-standalone.bat` → **Send to** → **Desktop (create shortcut)**.
2. Optional: Right-click the new shortcut → **Properties** to rename it and pick an icon via **Change Icon...**.
3. Double-click the shortcut anytime to start FokusFlow standalone.

### Chrome / Edge (extension)
1. Copy `manifest.chromium.json` to `manifest.json` (overwrite).
2. Open `chrome://extensions` or `edge://extensions`, enable **Developer mode**, then click **Load unpacked**.
3. Select the project folder; the toolbar button appears. Click it to open the popup.
4. After code changes, hit **Reload** on the extensions page.

### Firefox (extension)
1. Copy `manifest.firefox.json` to `manifest.json` (overwrite).
2. Open `about:debugging` → **This Firefox** → **Load Temporary Add-on...**.
3. Select `manifest.json`; the extension loads for the current session (repeat after restarting Firefox).

### Safari (extension, macOS / iOS)
1. Copy `manifest.safari.json` to `manifest.json`.
2. In Xcode, use **Safari Web Extension Converter** or the **Safari Extension App** template and import this folder.
3. Build/run from Xcode, then enable the extension in Safari Preferences.
4. Note: Safari packages WebExtensions as a container app rather than a simple ZIP.

## Data & Storage
- Everything is stored in `storage.local` (offline).
- Sessions history is limited (ring buffer) to avoid filling `storage.local`.
<br><br>
---
<br><br>
<b>FokusFlow</b><br>
Version 1.0.0<br>
Get latest updates at Github<br> 

by Dennis Zajonz (NoLimitsCoding GmbH)<br>
www.nolimitscoding.de | www.stocknav.ai
