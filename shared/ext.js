/* shared/ext.js */
(function () {
  const hasBrowser =
    typeof globalThis.browser !== "undefined" &&
    globalThis.browser &&
    globalThis.browser.runtime &&
    typeof globalThis.browser.runtime.getManifest === "function";

  const hasChrome =
    !hasBrowser &&
    typeof globalThis.chrome !== "undefined" &&
    globalThis.chrome &&
    globalThis.chrome.runtime &&
    typeof globalThis.chrome.runtime.getManifest === "function";

  const isStandalone = !(hasBrowser || hasChrome);

  function createStandaloneApi() {
    const messageListeners = [];
    const alarmListeners = [];
    const installedListeners = [];
    const startupListeners = [];
    const alarmTimers = new Map();

    function fireAlarm(name) {
      const alarm = { name };
      for (const fn of alarmListeners) {
        try { fn(alarm); } catch (_) {}
      }
    }

    function clearNamed(name) {
      const t = alarmTimers.get(name);
      if (!t) return;
      if (t.timeout) clearTimeout(t.timeout);
      if (t.interval) clearInterval(t.interval);
      alarmTimers.delete(name);
    }

    const runtime = {
      onMessage: {
        addListener: (fn) => {
          if (typeof fn === "function") messageListeners.push(fn);
        }
      },
      onInstalled: {
        addListener: (fn) => {
          if (typeof fn === "function") installedListeners.push(fn);
        }
      },
      onStartup: {
        addListener: (fn) => {
          if (typeof fn === "function") startupListeners.push(fn);
        }
      },
      sendMessage: (msg) => new Promise((resolve) => {
        let settled = false;
        const sendResponse = (res) => {
          if (settled) return;
          settled = true;
          resolve(res);
        };
        for (const fn of messageListeners) {
          try { fn(msg, { id: "standalone" }, sendResponse); } catch (e) { console.error(e); }
        }
        setTimeout(() => {
          if (!settled) resolve(undefined);
        }, 0);
      })
    };

    const storage = {
      local: {
        get: (keys) => {
          const out = {};
          const arr = Array.isArray(keys) ? keys : [keys];
          for (const k of arr) {
            try {
              const raw = localStorage.getItem(k);
              out[k] = raw != null ? JSON.parse(raw) : undefined;
            } catch (_) {
              out[k] = undefined;
            }
          }
          return Promise.resolve(out);
        },
        set: (obj) => {
          if (!obj || typeof obj !== "object") return Promise.resolve();
          for (const [k, v] of Object.entries(obj)) {
            try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.error(e); }
          }
          return Promise.resolve();
        }
      }
    };

    const alarms = {
      create: (name, info) => {
        clearNamed(name);
        const opts = info || {};
        const periodMs = opts.periodInMinutes ? opts.periodInMinutes * 60 * 1000 : null;

        if (opts.when) {
          const delay = Math.max(0, opts.when - Date.now());
          const timeout = setTimeout(() => {
            fireAlarm(name);
            if (periodMs) {
              const interval = setInterval(() => fireAlarm(name), periodMs);
              alarmTimers.set(name, { interval });
            }
          }, delay);
          alarmTimers.set(name, { timeout });
          return Promise.resolve();
        }

        if (periodMs) {
          const interval = setInterval(() => fireAlarm(name), periodMs);
          alarmTimers.set(name, { interval });
        }
        return Promise.resolve();
      },
      clear: (name) => {
        clearNamed(name);
        return Promise.resolve(true);
      },
      onAlarm: {
        addListener: (fn) => {
          if (typeof fn === "function") alarmListeners.push(fn);
        }
      }
    };

    // Fire synthetic install/startup events once listeners had a chance to attach.
    setTimeout(() => {
      for (const fn of installedListeners) { try { fn(); } catch (_) {} }
      for (const fn of startupListeners) { try { fn(); } catch (_) {} }
    }, 0);

    return {
      runtime,
      alarms,
      storage,
      action: null
    };
  }

  const api = isStandalone
    ? createStandaloneApi()
    : (hasBrowser ? globalThis.browser : globalThis.chrome);

  // In Firefox/Safari (browser.*): Promise-based.
  // In Chromium (chrome.*): callback-based (mostly).
  // In standalone: Promise-based polyfill.
  function p(fn, ctx, args) {
    if (hasBrowser || isStandalone) {
      return Promise.resolve(fn.apply(ctx, args));
    }
    return new Promise((resolve, reject) => {
      try {
        fn.apply(ctx, [
          ...args,
          (result) => {
            const err = api.runtime && api.runtime.lastError;
            if (err) reject(err);
            else resolve(result);
          }
        ]);
      } catch (e) {
        reject(e);
      }
    });
  }

  function getActionApi() {
    return api.action || api.browserAction || null;
  }

  async function safeSetBadge(text) {
    const a = getActionApi();
    if (!a || !a.setBadgeText) return;
    try {
      await p(a.setBadgeText, a, [{ text: String(text || "") }]);
    } catch (_) {}
  }

  globalThis.ext = {
    api,
    hasBrowser,
    hasChrome,
    isStandalone,
    p,

    storageGet: (keys) => p(api.storage.local.get, api.storage.local, [keys]),
    storageSet: (obj) => p(api.storage.local.set, api.storage.local, [obj]),

    alarmsCreate: (name, info) => p(api.alarms.create, api.alarms, [name, info]),
    alarmsClear: (name) => p(api.alarms.clear, api.alarms, [name]),

    sendMessage: (msg) => {
      if (hasBrowser || isStandalone) return api.runtime.sendMessage(msg);
      return new Promise((resolve, reject) => {
        api.runtime.sendMessage(msg, (res) => {
          const err = api.runtime.lastError;
          if (err) reject(err);
          else resolve(res);
        });
      });
    },

    safeSetBadge
  };
})();
