# FokusFlow - Offline Pomodoro + Tasks (WebExtension, Vanilla)

Hey there! I'm Dennis Zajonz, and FokusFlow is my personal side project. I wanted a Pomodoro timer with tasks that wasn't online or tied to my phone - being connected means emails, messages, and endless pings, and the web/mobile apps I tried didn't feel right. When I need a calm break from building StockNav (NoLimitsCoding GmbH's product), I tinker on FokusFlow: an offline-first timer that keeps every bit of your data on your own device - no servers, no cloud, no peeking platforms.

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

## How it works & settings
- Timer: Focus / Short / Long modes with start/pause, today counter, and a coffee-cup fill to show remaining time.
- Tasks: Parents + subtasks, quick rename/delete, mark done, and pick an active task to attribute Pomodoros; filter by active/done/all.
- Custom durations: Set focus, short, and long break lengths plus “long every N sessions.”
- Auto-start: Toggle auto-start for breaks and for the next focus session.
- Notifications: Toggle badge countdown (extensions) and adjust bell volume + repeat count; preview from the sliders.
- Appearance: Light/dark theme toggle stored locally.
- Backup: Export/import all data (tasks + settings) as JSON for backup or migration.

## Why multiple manifests?
- **Chrome/Edge:** Manifest V3 requires `background.service_worker`.
- **Firefox:** Manifest V3 uses `background.scripts` (event background); `service_worker` is not supported.
- **Safari:** WebExtensions via Xcode Converter; MV3 service worker is possible.

## Installation

### Standalone (no browser add-on)
**Windows**
1. Double-click `launch-standalone.bat`. The script detects your default browser (Chrome/Edge/Firefox) and opens `popup/popup.html` in a new window.
2. If the batch file cannot find a browser, open `popup/popup.html` directly in your browser as a fallback.

**Linux / macOS**
1. Make the launcher executable: `chmod +x launch-standalone.sh`.
2. Run `./launch-standalone.sh` (it tries Chrome/Chromium/Firefox or your default handler).
3. If the script cannot find a browser, open `popup/popup.html` directly in your browser as a fallback.

**Standalone notes (all platforms)**
- Data is stored in browser `localStorage`; if that is blocked, data is kept only for the current tab/session.
- Limitations: no badge icon, and the timer keeps running only while the tab/window stays open (no background service worker).

#### Create a desktop shortcut for `launch-standalone.bat` (Windows)
1. Right-click `launch-standalone.bat` -> **Send to** -> **Desktop (create shortcut)**.
2. Optional: Right-click the new shortcut -> **Properties** to rename it and pick an icon via **Change Icon...**.
3. Double-click the shortcut anytime to start FokusFlow standalone.

### Chrome / Edge (extension)
1. Copy `manifest.chromium.json` to `manifest.json` (overwrite).
2. Open `chrome://extensions` or `edge://extensions`, enable **Developer mode**, then click **Load unpacked**.
3. Select the project folder; the toolbar button appears. Click it to open the popup.
4. After code changes, hit **Reload** on the extensions page.

### Firefox (extension)
1. Copy `manifest.firefox.json` to `manifest.json` (overwrite).
2. Open `about:debugging` -> **This Firefox** -> **Load Temporary Add-on...**.
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
<b>FokusFlow</b>
Version 1.0.0<br>
Get latest updates at Github<br><br>
by Dennis Zajonz (NoLimitsCoding GmbH)<br>
www.nolimitscoding.de | www.stocknav.ai
