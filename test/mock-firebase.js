/* Firebase Realtime Database SIMULADO (só para testes automáticos) — compartilha dados entre as abas via localStorage + BroadcastChannel. */
(function () {
  const KEY = "__mockdb", ch = new BroadcastChannel("__mockdb");
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (_) { return {}; } };
  const save = (o) => localStorage.setItem(KEY, JSON.stringify(o));
  const getAt = (root, path) => path.split("/").filter(Boolean).reduce((a, k) => (a == null ? undefined : a[k]), root);
  function setAt(root, path, v) {
    const keys = path.split("/").filter(Boolean); let t = root;
    for (let i = 0; i < keys.length - 1; i++) { if (typeof t[keys[i]] !== "object" || t[keys[i]] === null) t[keys[i]] = {}; t = t[keys[i]]; }
    if (v === null || v === undefined) delete t[keys[keys.length - 1]]; else t[keys[keys.length - 1]] = v;
  }
  const fix = (v) => (v && v[".sv"] === "timestamp" ? Date.now() : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fix(x)])) : v);
  const listeners = [];
  const snap = (v) => ({ val: () => (v === undefined ? null : JSON.parse(JSON.stringify(v))), exists: () => v != null });
  const offset = Number(localStorage.getItem("__mockoffset") || 0);
  function check() {
    const db = load();
    listeners.forEach((l) => {
      let v;
      if (l.path === ".info/connected") v = true; else if (l.path === ".info/serverTimeOffset") v = offset; else v = getAt(db, l.path);
      const j = JSON.stringify(v === undefined ? null : v);
      if (j !== l.last) { l.last = j; setTimeout(() => l.cb(snap(v)), 0); }
    });
  }
  ch.onmessage = check;
  window.__mockWriteCount = 0;
  function ref(path) {
    path = path.replace(/^\/+|\/+$/g, "");
    return {
      set(v) { const db = load(); setAt(db, path, fix(v)); save(db); window.__mockWriteCount++; ch.postMessage(1); check(); return Promise.resolve(); },
      update(o) { const db = load(); Object.entries(o).forEach(([k, v]) => setAt(db, path + "/" + k, fix(v))); save(db); window.__mockWriteCount++; ch.postMessage(1); check(); return Promise.resolve(); },
      remove() { return this.set(null); },
      once(ev, cb) { const db = load(); const v = path === ".info/serverTimeOffset" ? offset : path === ".info/connected" ? true : getAt(db, path); const s = snap(v); if (cb) { setTimeout(() => cb(s), 0); return; } return Promise.resolve(s); },
      on(ev, cb) { const l = { path, cb, last: null }; listeners.push(l); check(); return cb; },
      off(ev, cb) { const i = listeners.findIndex((l) => l.path === path && (!cb || l.cb === cb)); if (i >= 0) listeners.splice(i, 1); },
      onDisconnect() { return { remove() { window.addEventListener("pagehide", () => { const db = load(); setAt(db, path, null); save(db); ch.postMessage(1); }); return Promise.resolve(); } }; },
    };
  }
  window.firebase = { initializeApp() {}, database: Object.assign(() => ({ ref }), { ServerValue: { TIMESTAMP: { ".sv": "timestamp" } } }) };
})();
