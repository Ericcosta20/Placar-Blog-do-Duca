/* Firebase Realtime Database + Auth SIMULADOS (só para testes automáticos).
   Compartilha dados entre as abas via localStorage + BroadcastChannel. Regras simuladas: escrita só com login (exceto presence/). */
(function () {
  const ch = new BroadcastChannel("__mockdb");
  const fix = (v) => (v && v[".sv"] === "timestamp" ? Date.now() : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fix(x)])) : v);
  const listeners = [];
  const snap = (v) => ({ val: () => (v === undefined || v === null ? null : JSON.parse(JSON.stringify(v))), exists: () => v != null, key: null });
  const offset = Number(localStorage.getItem("__mockoffset") || 0);
  const get = async (path) => (path === ".info/connected" ? true : path === ".info/serverTimeOffset" ? offset : window.__dbGet(path));
  let checking = Promise.resolve();
  function check() {                     // reavalia os ouvintes, um de cada vez e em ordem
    checking = checking.then(async () => {
      for (const l of listeners.slice()) {
        const v = await get(l.path);
        const j = JSON.stringify(v === undefined ? null : v);
        if (j !== l.last && listeners.includes(l)) { l.last = j; setTimeout(() => l.cb(snap(v)), 0); }
      }
    });
    return checking;
  }
  ch.onmessage = check;
  window.__mockWriteCount = 0; window.__mockDenied = 0;
  const authed = () => !!localStorage.getItem("__mockuser");
  const denied = (path) => { if (/(^|\/)presence\//.test(path) || authed()) return false; window.__mockDenied++; return true; };
  const deny = () => Promise.reject(Object.assign(new Error("PERMISSION_DENIED"), { code: "PERMISSION_DENIED" }));
  const apply = async (ops) => { await window.__dbApply(ops); window.__mockWriteCount++; ch.postMessage(1); await check(); };
  function ref(path) {
    path = path.replace(/^\/+|\/+$/g, "");
    return {
      set(v) { if (denied(path)) return deny(); return apply([[path, fix(v)]]); },
      update(o) { if (denied(path + "/" + Object.keys(o)[0])) return deny(); return apply(Object.entries(o).map(([k, v]) => [path + "/" + k, fix(v)])); },
      remove() { return this.set(null); },
      once(ev, cb) { const pr = get(path).then(snap); if (cb) { pr.then(cb); return; } return pr; },
      on(ev, cb) { listeners.push({ path, cb, last: null }); check(); return cb; },
      off(ev, cb) { const i = listeners.findIndex((l) => l.path === path && (!cb || l.cb === cb)); if (i >= 0) listeners.splice(i, 1); },
      onDisconnect() { return { remove() { window.addEventListener("pagehide", () => { window.__dbApply([[path, null]]); ch.postMessage(1); }); return Promise.resolve(); } }; },
    };
  }
  const authListeners = [];
  const auth = {
    get currentUser() { const u = localStorage.getItem("__mockuser"); return u ? JSON.parse(u) : null; },
    onAuthStateChanged(cb) { authListeners.push(cb); setTimeout(() => cb(auth.currentUser), 30); },
    async signInWithEmailAndPassword(email, pw) {
      if (email === "eric@teste.com" && pw === "senha123") { localStorage.setItem("__mockuser", JSON.stringify({ email, uid: "u1" })); authListeners.forEach((f) => f(auth.currentUser)); return { user: auth.currentUser }; }
      throw Object.assign(new Error("bad"), { code: "auth/invalid-credential" });
    },
    async signOut() { localStorage.removeItem("__mockuser"); authListeners.forEach((f) => f(null)); },
  };
  window.__mockAuth = auth;
  const dbObj = { ref };
  window.firebase = { initializeApp() {}, database: Object.assign(() => dbObj, { ServerValue: { TIMESTAMP: { ".sv": "timestamp" } } }) };
})();

