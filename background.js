/* background.js */

// In Chromium MV3 SW: need importScripts. In Firefox background script: ext.js is already loaded via manifest.
try { importScripts("shared/ext.js"); } catch (_) {}

const KEY_SETTINGS = "ff_settings";
const KEY_TIMER = "ff_timer";
const KEY_TASKS = "ff_tasks";
const KEY_SESSIONS = "ff_sessions";

const ALARM_SESSION_END = "ff_session_end";
const ALARM_BADGE_TICK = "ff_badge_tick";

const DEFAULT_SETTINGS = {
  focusMin: 25,
  shortMin: 5,
  longMin: 15,
  longEvery: 4,
  autoStartBreak: true,
  autoStartFocus: false,
  badgeCountdown: true,
  bellVolume: 0.28,
  bellRepeats: 2,
  // Notifications sind absichtlich NICHT Kernfeature (Safari teils zickig).
  // Wir nutzen Badge + Popup UI zuverlässig offline.
};

const MAX_SESSIONS = 2000;

function nowMs() { return Date.now(); }
function todayISO() { return new Date().toISOString().slice(0, 10); }
function secs(min) { return Math.max(1, Math.round(Number(min) * 60)); }

function uuid() {
  try { return crypto.randomUUID(); } catch (_) {
    return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  }
}

function durationForMode(settings, mode) {
  if (mode === "focus") return secs(settings.focusMin);
  if (mode === "short") return secs(settings.shortMin);
  return secs(settings.longMin);
}

async function loadAll() {
  const data = await ext.storageGet([KEY_SETTINGS, KEY_TIMER, KEY_TASKS, KEY_SESSIONS]);
  const settings = { ...DEFAULT_SETTINGS, ...(data[KEY_SETTINGS] || {}) };
  const tasks = data[KEY_TASKS] || [];
  const sessions = data[KEY_SESSIONS] || [];

  let timer = data[KEY_TIMER];
  if (!timer) {
    const d = durationForMode(settings, "focus");
    timer = {
      mode: "focus",
      isRunning: false,
      durationSec: d,
      remainingSec: d,
      endsAt: null,
      startedAt: null,

      cycleCount: 0,
      totalPomodoros: 0,
      todayDate: todayISO(),
      todayPomodoros: 0,
      currentTaskId: null
    };
  }

  // Daily reset
  const t = todayISO();
  if (timer.todayDate !== t) {
    timer.todayDate = t;
    timer.todayPomodoros = 0;
  }

  return { settings, timer, tasks, sessions };
}

async function saveAll(state) {
  await ext.storageSet({
    [KEY_SETTINGS]: state.settings,
    [KEY_TIMER]: state.timer,
    [KEY_TASKS]: state.tasks,
    [KEY_SESSIONS]: state.sessions
  });
}

function computeRemaining(timer) {
  if (!timer.isRunning || !timer.endsAt) return Math.max(0, timer.remainingSec);
  const ms = timer.endsAt - nowMs();
  return Math.max(0, Math.ceil(ms / 1000));
}

async function clearAlarm(name) {
  try { await ext.alarmsClear(name); } catch (_) {}
}

async function scheduleSessionEnd(endsAtMs) {
  await ext.alarmsCreate(ALARM_SESSION_END, { when: endsAtMs });
}

async function scheduleBadgeTick() {
  // every minute
  await ext.alarmsCreate(ALARM_BADGE_TICK, { periodInMinutes: 1 });
}

async function updateBadge(state) {
  const { settings, timer } = state;
  if (!settings.badgeCountdown) {
    await ext.safeSetBadge("");
    return;
  }

  if (!timer.isRunning) {
    await ext.safeSetBadge("");
    return;
  }

  const remaining = computeRemaining(timer);
  const minutes = Math.ceil(remaining / 60);
  await ext.safeSetBadge(minutes > 0 ? String(minutes) : "");
}

function incrementTaskPomos(tasks, taskId) {
  if (!taskId) return;
  const idx = tasks.findIndex(t => t.id === taskId);
  if (idx >= 0) tasks[idx].pomos = (tasks[idx].pomos || 0) + 1;
}

function logSession(sessions, entry) {
  sessions.push(entry);
  if (sessions.length > MAX_SESSIONS) sessions.splice(0, sessions.length - MAX_SESSIONS);
}

async function startOrResumeTimer() {
  const state = await loadAll();
  const { timer } = state;

  if (timer.isRunning) return state;

  const remaining = Math.max(1, timer.remainingSec);
  timer.isRunning = true;

  if (!timer.startedAt) timer.startedAt = nowMs();
  timer.endsAt = nowMs() + remaining * 1000;

  await scheduleSessionEnd(timer.endsAt);
  await scheduleBadgeTick();
  await updateBadge(state);

  await saveAll(state);
  return state;
}

async function pauseTimer() {
  const state = await loadAll();
  const { timer } = state;

  if (!timer.isRunning) return state;

  timer.remainingSec = computeRemaining(timer);
  timer.isRunning = false;
  timer.endsAt = null;

  await clearAlarm(ALARM_SESSION_END);
  await clearAlarm(ALARM_BADGE_TICK);
  await updateBadge(state);

  await saveAll(state);
  return state;
}

async function resetTimer() {
  const state = await loadAll();
  const { settings, timer } = state;

  timer.isRunning = false;
  timer.endsAt = null;
  timer.startedAt = null;
  timer.durationSec = durationForMode(settings, timer.mode);
  timer.remainingSec = timer.durationSec;

  await clearAlarm(ALARM_SESSION_END);
  await clearAlarm(ALARM_BADGE_TICK);
  await updateBadge(state);

  await saveAll(state);
  return state;
}

async function switchMode(mode) {
  const state = await loadAll();
  const { settings, timer } = state;

  timer.mode = mode;
  timer.isRunning = false;
  timer.endsAt = null;
  timer.startedAt = null;
  timer.durationSec = durationForMode(settings, mode);
  timer.remainingSec = timer.durationSec;

  await clearAlarm(ALARM_SESSION_END);
  await clearAlarm(ALARM_BADGE_TICK);
  await updateBadge(state);

  await saveAll(state);
  return state;
}

async function finishSession(wasSkipped) {
  const state = await loadAll();
  const { settings, timer, tasks, sessions } = state;

  const prevMode = timer.mode;
  const endAt = nowMs();
  const remainingBefore = computeRemaining(timer);
  const actualSpentSec = Math.max(0, timer.durationSec - remainingBefore);

  // stop
  timer.isRunning = false;
  timer.endsAt = null;
  timer.remainingSec = 0;

  // log session (this answers "werden einzelne Pomodoros gespeichert?")
  logSession(sessions, {
    id: uuid(),
    mode: prevMode,
    startedAt: timer.startedAt || (endAt - (actualSpentSec * 1000)),
    endedAt: endAt,
    plannedSec: timer.durationSec,
    actualSec: actualSpentSec,
    taskId: timer.currentTaskId || null,
    skipped: !!wasSkipped
  });

  // mode transitions
  if (prevMode === "focus") {
    if (!wasSkipped) {
      timer.totalPomodoros += 1;
      timer.cycleCount += 1;
      timer.todayPomodoros += 1;
      incrementTaskPomos(tasks, timer.currentTaskId);
    }

    const useLong = (timer.cycleCount % Math.max(1, settings.longEvery) === 0);
    timer.mode = useLong ? "long" : "short";
  } else {
    timer.mode = "focus";
  }

  // prepare next session
  timer.startedAt = null;
  timer.durationSec = durationForMode(settings, timer.mode);
  timer.remainingSec = timer.durationSec;

  await clearAlarm(ALARM_SESSION_END);
  await clearAlarm(ALARM_BADGE_TICK);
  await updateBadge(state);

  await saveAll(state);

  // auto-start logic
  const nextIsBreak = timer.mode === "short" || timer.mode === "long";
  const shouldAuto =
    (nextIsBreak && settings.autoStartBreak) ||
    (!nextIsBreak && settings.autoStartFocus);

  if (shouldAuto) return await startOrResumeTimer();
  return state;
}

async function skipSession() {
  await clearAlarm(ALARM_SESSION_END);
  return await finishSession(true);
}

function deleteTaskAndChildren(tasks, taskId) {
  const children = tasks.filter(t => t.parentId === taskId).map(t => t.id);
  let out = tasks.filter(t => t.id !== taskId);
  for (const cid of children) out = deleteTaskAndChildren(out, cid);
  return out;
}

// ---- Tasks CRUD
async function addTask(title, parentId) {
  const state = await loadAll();
  state.tasks.push({
    id: uuid(),
    title: (title || "").trim() || "Untitled",
    done: false,
    parentId: parentId || null,
    createdAt: nowMs(),
    pomos: 0
  });
  await saveAll(state);
  return state;
}

async function toggleDone(taskId, done) {
  const state = await loadAll();
  const t = state.tasks.find(x => x.id === taskId);
  if (t) t.done = !!done;
  await saveAll(state);
  return state;
}

async function deleteTask(taskId) {
  const state = await loadAll();
  state.tasks = deleteTaskAndChildren(state.tasks, taskId);
  if (state.timer.currentTaskId === taskId) state.timer.currentTaskId = null;
  await saveAll(state);
  return state;
}

async function renameTask(taskId, title) {
  const state = await loadAll();
  const t = state.tasks.find(x => x.id === taskId);
  if (t) t.title = (title || "").trim() || t.title;
  await saveAll(state);
  return state;
}

async function setCurrentTask(taskId) {
  const state = await loadAll();
  state.timer.currentTaskId = taskId || null;
  await saveAll(state);
  return state;
}

async function updateSettings(patch) {
  const state = await loadAll();
  state.settings = { ...state.settings, ...(patch || {}) };

  state.settings.bellVolume = Math.min(0.8, Math.max(0.01, Number(state.settings.bellVolume ?? DEFAULT_SETTINGS.bellVolume)));
  state.settings.bellRepeats = Math.max(1, Math.min(4, Math.round(Number(state.settings.bellRepeats ?? DEFAULT_SETTINGS.bellRepeats))));

  // If timer not running, recalc current mode duration
  if (!state.timer.isRunning) {
    state.timer.durationSec = durationForMode(state.settings, state.timer.mode);
    state.timer.remainingSec = state.timer.durationSec;
  }

  await saveAll(state);
  await updateBadge(state);
  return state;
}

// Reschedule alarms if SW/event background restarts
async function ensureAlarms() {
  const state = await loadAll();
  const { timer } = state;

  if (timer.isRunning && timer.endsAt) {
    // If already overdue, finish immediately
    if (timer.endsAt <= nowMs()) {
      await finishSession(false);
      return;
    }
    await scheduleSessionEnd(timer.endsAt);
    await scheduleBadgeTick();
    await updateBadge(state);
  } else {
    await clearAlarm(ALARM_SESSION_END);
    await clearAlarm(ALARM_BADGE_TICK);
    await updateBadge(state);
  }
}

ext.api.runtime.onInstalled.addListener(() => { ensureAlarms(); });
if (ext.api.runtime.onStartup) ext.api.runtime.onStartup.addListener(() => { ensureAlarms(); });

ext.api.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm || !alarm.name) return;

  if (alarm.name === ALARM_BADGE_TICK) {
    const state = await loadAll();
    await updateBadge(state);
    return;
  }

  if (alarm.name === ALARM_SESSION_END) {
    const state = await finishSession(false);
    try { ext.api.runtime.sendMessage({ type: "FF_STATE_UPDATED", payload: state }); } catch (_) {}
  }
});

// Messages from popup
ext.api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      let state;
      switch (msg && msg.type) {
        case "FF_GET_STATE":
          state = await loadAll();
          break;

        case "FF_TIMER_START":
          state = await startOrResumeTimer();
          break;

        case "FF_TIMER_PAUSE":
          state = await pauseTimer();
          break;

        case "FF_TIMER_RESET":
          state = await resetTimer();
          break;

        case "FF_TIMER_SWITCH_MODE":
          state = await switchMode(msg.mode);
          break;

        case "FF_TIMER_SKIP":
          state = await skipSession();
          break;

        case "FF_TASK_ADD":
          state = await addTask(msg.title, msg.parentId);
          break;

        case "FF_TASK_TOGGLE_DONE":
          state = await toggleDone(msg.id, msg.done);
          break;

        case "FF_TASK_DELETE":
          state = await deleteTask(msg.id);
          break;

        case "FF_TASK_RENAME":
          state = await renameTask(msg.id, msg.title);
          break;

        case "FF_SET_CURRENT_TASK":
          state = await setCurrentTask(msg.id);
          break;

        case "FF_SETTINGS_UPDATE":
          state = await updateSettings(msg.patch);
          break;

        default:
          state = await loadAll();
      }

      sendResponse({ ok: true, state });
    } catch (e) {
      sendResponse({ ok: false, error: String(e && e.message ? e.message : e) });
    }
  })();

  return true;
});

// Run once (important for SW cold start)
ensureAlarms();
