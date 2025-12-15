/* shared/ext.js */
(function () {
  const hasBrowser =
    typeof globalThis.browser !== "undefined" &&
    globalThis.browser &&
    globalThis.browser.runtime &&
    typeof globalThis.browser.runtime.getManifest === "function";

  const api = hasBrowser ? globalThis.browser : globalThis.chrome;

  // In Firefox/Safari: browser.* is Promise-based.
  // In Chromium: chrome.* is callback-based (mostly).
  function p(fn, ctx, args) {
    if (hasBrowser) {
      return fn.apply(ctx, args);
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
    p,

    storageGet: (keys) => p(api.storage.local.get, api.storage.local, [keys]),
    storageSet: (obj) => p(api.storage.local.set, api.storage.local, [obj]),

    alarmsCreate: (name, info) => p(api.alarms.create, api.alarms, [name, info]),
    alarmsClear: (name) => p(api.alarms.clear, api.alarms, [name]),

    sendMessage: (msg) => {
      if (hasBrowser) return api.runtime.sendMessage(msg);
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
