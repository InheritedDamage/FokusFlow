let STATE = null;
let FILTER = "active";
let uiTick = null;
const THEME_KEY = "FF_THEME";
const DEFAULT_BELL_VOLUME = 0.28;
const DEFAULT_BELL_REPEATS = 2;
const BELL_DURATION = 1.2; // seconds

const el = (id) => document.getElementById(id);
let bellCtx = null;

function fmt(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function computeRemaining(timer) {
  if (!timer.isRunning || !timer.endsAt) return Math.max(0, timer.remainingSec);
  const ms = timer.endsAt - Date.now();
  return Math.max(0, Math.ceil(ms / 1000));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

async function send(msg) {
  const res = await ext.sendMessage(msg);
  if (!res || !res.ok) throw new Error((res && res.error) || "Unknown error");
  return res.state;
}

function setActiveTab(mode) {
  document.querySelectorAll(".tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === mode);
  });
}

function updateCup(timer) {
  // coffee fill inside y:70..148 (height 78)
  const innerY = 70;
  const innerH = 78;

  const remaining = computeRemaining(timer);
  const level = timer.durationSec > 0 ? (remaining / timer.durationSec) : 0;

  const h = Math.max(0, Math.round(innerH * level));
  const y = innerY + (innerH - h);

  const rect = el("coffeeFill");
  rect.setAttribute("y", String(y));
  rect.setAttribute("height", String(h));
}

function taskVisible(task) {
  if (FILTER === "all") return true;
  if (FILTER === "active") return !task.done;
  return !!task.done;
}

function renderTaskSelect(tasks, currentTaskId) {
  const sel = el("taskSelect");
  sel.innerHTML = "";

  const optNone = document.createElement("option");
  optNone.value = "";
  optNone.textContent = "— None —";
  sel.appendChild(optNone);

  const parents = tasks.filter(t => !t.parentId).sort((a,b) => a.createdAt - b.createdAt);
  for (const p of parents) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.title;
    sel.appendChild(opt);

    const children = tasks.filter(t => t.parentId === p.id).sort((a,b)=>a.createdAt-b.createdAt);
    for (const c of children) {
      const o = document.createElement("option");
      o.value = c.id;
      o.textContent = `↳ ${c.title}`;
      sel.appendChild(o);
    }
  }

  sel.value = currentTaskId || "";
}

function renderTimer(state) {
  const { timer, settings, tasks } = state;

  const remaining = computeRemaining(timer);
  el("timeLeft").textContent = fmt(remaining);

  const modeLabel = timer.mode === "focus" ? "Focus" : (timer.mode === "short" ? "Short break" : "Long break");
  el("metaMode").textContent = modeLabel;
  el("metaCount").textContent = `${timer.todayPomodoros} today`;

  const activeTask = tasks.find(t => t.id === timer.currentTaskId);
  el("metaTask").textContent = activeTask ? `☕ ${activeTask.title}` : "";

  setActiveTab(timer.mode);
  updateCup(timer);

  el("btnStartPause").textContent = timer.isRunning ? "Pause" : "Start";
}

function renderSettings(settings) {
  el("setFocus").value = settings.focusMin;
  el("setShort").value = settings.shortMin;
  el("setLong").value = settings.longMin;
  el("setEvery").value = settings.longEvery;
  el("setAutoBreak").checked = !!settings.autoStartBreak;
  el("setAutoFocus").checked = !!settings.autoStartFocus;
  el("setBadge").checked = settings.badgeCountdown !== false;

  const volPct = Math.round(clamp((settings.bellVolume ?? DEFAULT_BELL_VOLUME) * 100, 5, 80));
  const repeats = Math.round(clamp(settings.bellRepeats ?? DEFAULT_BELL_REPEATS, 1, 4));
  updateBellSliderUI({ volumePct: volPct, repeats });
}

function renderTasks(tasks, currentTaskId) {
  const list = el("tasksList");
  list.innerHTML = "";

  const parents = tasks.filter(t => !t.parentId).sort((a,b)=>a.createdAt-b.createdAt);

  for (const parent of parents) {
    if (!taskVisible(parent) && FILTER !== "all") {
      const anyVisibleChild = tasks.some(t => t.parentId === parent.id && taskVisible(t));
      if (!anyVisibleChild) continue;
    }

    const wrap = document.createElement("div");
    wrap.className = "taskItem";
    if (currentTaskId === parent.id) wrap.classList.add("activeHighlight");

    wrap.appendChild(renderTaskRow(parent, true));

    const children = tasks.filter(t => t.parentId === parent.id).sort((a,b)=>a.createdAt-b.createdAt);
    const visibleChildren = children.filter(taskVisible);

    if (visibleChildren.length) {
      const subWrap = document.createElement("div");
      subWrap.className = "subtasks";
      for (const c of visibleChildren) {
        const subItem = document.createElement("div");
        subItem.className = "taskItem";
        if (currentTaskId === c.id) subItem.classList.add("activeHighlight");
        subItem.appendChild(renderTaskRow(c, false));
        subWrap.appendChild(subItem);
      }
      wrap.appendChild(subWrap);
    }

    list.appendChild(wrap);
  }
}

function renderTaskRow(task, isParent) {
  const container = document.createElement("div");
  container.style.display = "grid";
  container.style.gap = "6px";

  const row = document.createElement("div");
  row.className = "taskRow";

  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = !!task.done;
  cb.addEventListener("change", async () => {
    STATE = await send({ type: "FF_TASK_TOGGLE_DONE", id: task.id, done: cb.checked });
    renderAll();
  });

  const title = document.createElement("div");
  title.className = "taskTitle" + (task.done ? " done" : "");
  title.textContent = task.title;
  title.title = "Click to set active task";
  title.addEventListener("click", async () => {
    STATE = await send({ type: "FF_SET_CURRENT_TASK", id: task.id });
    renderAll();
  });

  const actions = document.createElement("div");
  actions.className = "taskActions";

  const btnRename = document.createElement("button");
  btnRename.className = "smallBtn";
  btnRename.textContent = "✎";
  btnRename.title = "Rename";
  btnRename.addEventListener("click", async () => {
    const t = prompt("Rename task:", task.title);
    if (t === null) return;
    STATE = await send({ type: "FF_TASK_RENAME", id: task.id, title: t });
    renderAll();
  });

  actions.appendChild(btnRename);

  if (isParent) {
    const btnSub = document.createElement("button");
    btnSub.className = "smallBtn";
    btnSub.textContent = "+";
    btnSub.title = "Add subtask";
    btnSub.addEventListener("click", async () => {
      const t = prompt("Subtask title:");
      if (!t) return;
      STATE = await send({ type: "FF_TASK_ADD", title: t, parentId: task.id });
      renderAll();
    });
    actions.appendChild(btnSub);
  }

  const btnDel = document.createElement("button");
  btnDel.className = "smallBtn danger";
  btnDel.textContent = "🗑";
  btnDel.title = "Delete (also deletes subtasks)";
  btnDel.addEventListener("click", async () => {
    if (!confirm("Delete this task (and its subtasks)?")) return;
    STATE = await send({ type: "FF_TASK_DELETE", id: task.id });
    renderAll();
  });
  actions.appendChild(btnDel);

  row.appendChild(cb);
  row.appendChild(title);
  row.appendChild(actions);

  const meta = document.createElement("div");
  meta.className = "taskMeta";
  meta.innerHTML = `<span>☕ ${task.pomos || 0}</span>${task.parentId ? `<span>Subtask</span>` : ""}`;

  container.appendChild(row);
  container.appendChild(meta);

  return container;
}

function renderAll() {
  renderTimer(STATE);
  renderTaskSelect(STATE.tasks, STATE.timer.currentTaskId);
  renderTasks(STATE.tasks, STATE.timer.currentTaskId);
  renderSettings(STATE.settings);
}

function setFilter(filter) {
  FILTER = filter;
  document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c.dataset.filter === filter));
  renderTasks(STATE.tasks, STATE.timer.currentTaskId);
}

function getBellSettings(overrides = {}) {
  const volume = clamp(
    typeof overrides.volume === "number" ? overrides.volume : (STATE?.settings?.bellVolume ?? DEFAULT_BELL_VOLUME),
    0.01,
    0.8
  );
  const repeatsRaw = typeof overrides.repeats === "number" ? overrides.repeats : (STATE?.settings?.bellRepeats ?? DEFAULT_BELL_REPEATS);
  const repeats = Math.round(clamp(repeatsRaw, 1, 4));
  return { volume, repeats };
}

function ringBell(options = {}) {
  try {
    bellCtx = bellCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (bellCtx.state === "suspended") bellCtx.resume();

    const ctx = bellCtx;
    const now = ctx.currentTime;
    const { volume, repeats } = getBellSettings(options);
    const gap = BELL_DURATION * 0.6;

    const playAt = (startTime) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(1200, startTime);
      osc.frequency.setValueAtTime(900, startTime + 0.25);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + BELL_DURATION);

      osc.connect(gain).connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + BELL_DURATION + 0.05);
    };

    for (let i = 0; i < repeats; i += 1) {
      playAt(now + (i * gap));
    }
  } catch (_) {
    // ignore audio errors (e.g. autoplay restrictions)
  }
}

function setRangeFill(input, value) {
  if (!input) return;
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const pct = clamp(((value - min) / Math.max(1, max - min)) * 100, 0, 100);
  input.style.background = `linear-gradient(90deg, var(--accent) 0%, var(--accent) ${pct}%, var(--line) ${pct}%, var(--line) 100%)`;
}

function sliderValuesFromUI() {
  const volPct = Number(el("setBellVolume")?.value ?? Math.round(DEFAULT_BELL_VOLUME * 100));
  const repeats = Number(el("setBellRepeats")?.value ?? DEFAULT_BELL_REPEATS);
  return {
    volumePct: clamp(volPct, 5, 80),
    repeats: Math.round(clamp(repeats, 1, 4))
  };
}

function updateBellSliderUI(values) {
  const { volumePct, repeats } = values;
  const volLabel = el("bellVolumeLabel");
  const repLabel = el("bellRepeatsLabel");
  const volInput = el("setBellVolume");
  const repInput = el("setBellRepeats");

  if (volLabel) volLabel.textContent = `${Math.round(volumePct)}%`;
  if (repLabel) repLabel.textContent = `${repeats}x`;
  if (volInput) {
    volInput.value = volumePct;
    setRangeFill(volInput, volumePct);
  }
  if (repInput) {
    repInput.value = repeats;
    setRangeFill(repInput, repeats);
  }
}

function previewBellFromSliders() {
  const { volumePct, repeats } = sliderValuesFromUI();
  const gain = clamp(volumePct / 100, 0.01, 0.8);
  ringBell({ volume: gain, repeats });
}

function getThemePreference() {
  return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
}

function applyTheme(theme) {
  const body = document.body;
  const normalized = theme === "light" ? "light" : "dark";

  body.classList.remove("theme-light", "theme-dark");
  body.classList.add(normalized === "light" ? "theme-light" : "theme-dark");
  localStorage.setItem(THEME_KEY, normalized);

  const btn = el("btnToggleTheme");
  const icon = el("themeIcon");
  if (btn && icon) {
    const switchingTo = normalized === "light" ? "dark" : "light";
    icon.src = switchingTo === "dark" ? "../icons/dark-mode.png" : "../icons/light-mode.png";
    icon.alt = switchingTo === "dark" ? "Switch to dark mode" : "Switch to light mode";
    btn.title = switchingTo === "dark" ? "Switch to dark mode" : "Switch to light mode";
  }
}

async function init() {
  applyTheme(getThemePreference());
  STATE = await send({ type: "FF_GET_STATE" });

  document.querySelectorAll(".tab").forEach((b) => {
    b.addEventListener("click", async () => {
      STATE = await send({ type: "FF_TIMER_SWITCH_MODE", mode: b.dataset.mode });
      renderAll();
    });
  });

  el("btnStartPause").addEventListener("click", async () => {
    STATE = await send({ type: STATE.timer.isRunning ? "FF_TIMER_PAUSE" : "FF_TIMER_START" });
    renderAll();
  });

  el("btnReset").addEventListener("click", async () => {
    STATE = await send({ type: "FF_TIMER_RESET" });
    renderAll();
  });

  el("btnSkip").addEventListener("click", async () => {
    STATE = await send({ type: "FF_TIMER_SKIP" });
    renderAll();
  });

  el("btnAddTask").addEventListener("click", async () => {
    const input = el("taskInput");
    const title = input.value.trim();
    if (!title) return;
    input.value = "";
    STATE = await send({ type: "FF_TASK_ADD", title });
    renderAll();
  });

  el("taskInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") el("btnAddTask").click();
  });

  el("taskSelect").addEventListener("change", async () => {
    STATE = await send({ type: "FF_SET_CURRENT_TASK", id: el("taskSelect").value || null });
    renderAll();
  });

  document.querySelectorAll(".chip").forEach((c) => {
    c.addEventListener("click", () => setFilter(c.dataset.filter));
  });

  el("btnToggleSettings").addEventListener("click", () => {
    el("settingsPanel").classList.toggle("hidden");
  });

  const syncBellToState = (vals) => {
    if (STATE && STATE.settings) {
      STATE.settings.bellVolume = clamp(vals.volumePct / 100, 0.01, 0.8);
      STATE.settings.bellRepeats = vals.repeats;
    }
  };
  const onBellInput = () => {
    const vals = sliderValuesFromUI();
    updateBellSliderUI(vals);
    syncBellToState(vals);
  };
  const onBellChange = () => {
    const vals = sliderValuesFromUI();
    updateBellSliderUI(vals);
    syncBellToState(vals);
    previewBellFromSliders();
  };
  const volInput = el("setBellVolume");
  const repInput = el("setBellRepeats");
  if (volInput) {
    volInput.addEventListener("input", onBellInput);
    volInput.addEventListener("change", onBellChange);
  }
  if (repInput) {
    repInput.addEventListener("input", onBellInput);
    repInput.addEventListener("change", onBellChange);
  }

  const btnTheme = el("btnToggleTheme");
  if (btnTheme) {
    btnTheme.addEventListener("click", () => {
      const next = document.body.classList.contains("theme-light") ? "dark" : "light";
      applyTheme(next);
    });
  }

  el("btnSaveSettings").addEventListener("click", async () => {
    const bellVals = sliderValuesFromUI();
    const patch = {
      focusMin: Number(el("setFocus").value),
      shortMin: Number(el("setShort").value),
      longMin: Number(el("setLong").value),
      longEvery: Number(el("setEvery").value),
      autoStartBreak: !!el("setAutoBreak").checked,
      autoStartFocus: !!el("setAutoFocus").checked,
      badgeCountdown: !!el("setBadge").checked,
      bellVolume: clamp(bellVals.volumePct / 100, 0.01, 0.8),
      bellRepeats: bellVals.repeats
    };
    STATE = await send({ type: "FF_SETTINGS_UPDATE", patch });
    renderAll();
  });

  el("btnExport").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(STATE, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fokusflow_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  el("fileImport").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const txt = await file.text();
    const data = JSON.parse(txt);

    // Minimal safe import:
    if (data && data.settings) {
      STATE = await send({ type: "FF_SETTINGS_UPDATE", patch: data.settings });
    }

    // Re-add tasks (keeps existing)
    if (data && Array.isArray(data.tasks)) {
      for (const t of data.tasks) {
        await send({ type: "FF_TASK_ADD", title: t.title, parentId: t.parentId || null });
      }
      STATE = await send({ type: "FF_GET_STATE" });
    }

    renderAll();
    e.target.value = "";
  });

  // state updates from background (session end)
  ext.api.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "FF_STATE_UPDATED") {
      STATE = msg.payload;
      ringBell();
      renderAll();
    }
  });

  uiTick = setInterval(() => {
    if (!STATE) return;
    renderTimer(STATE);
  }, 250);

  setFilter("active");
  renderAll();
}

init();
