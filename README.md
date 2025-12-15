# FokusFlow — Offline Pomodoro + Tasks (WebExtension, Vanilla)

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

## Quickstart (Chrome / Edge)
1. Copy `manifest.chromium.json` to `manifest.json` (overwrite).
2. Open `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the project folder.

## Quickstart (Firefox)
1. Copy `manifest.firefox.json` to `manifest.json` (overwrite).
2. Open `about:debugging` → **This Firefox** → **Load Temporary Add-on…** → select `manifest.json`.

## Safari (macOS / iOS)
1. Copy `manifest.safari.json` to `manifest.json`.
2. Use Xcode: **Safari Web Extension Converter** / **Safari Extension App** template and import the folder.
3. Run from Xcode and enable the extension in Safari.
Note: Safari ships WebExtensions as a container app (not as a simple ZIP like Chrome/Firefox).

## Data & Storage
- Everything is stored in `storage.local` (offline).
- Sessions history is limited (ring buffer) to avoid filling `storage.local`.

## Dev Tip
If you plan to publish: create one ZIP/package per browser with the appropriate `manifest.json`.
