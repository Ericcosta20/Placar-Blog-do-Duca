/**
 * MOTOR NO NAVEGADOR (Placar App 1.0)
 * ---------------------------------------------------------------------------------------------
 * Na versão de computador existia um servidor (Node + Socket.IO). Aqui a MESMA lógica (pasta server/)
 * roda dentro da página do painel:
 *   painel  <--(Socket.IO de mentirinha, dentro da página)-->  motor  --(Firebase)-->  artes (overlays)
 * O painel continua "emitindo" os mesmos eventos de sempre; o motor aplica a regra, e o resultado
 * (estado + times) é gravado no Firebase. As artes só escutam o Firebase.
 *
 * Firebase (path "placar", ou "placar_<sala>"):
 *   stateJson  — o estado inteiro como texto JSON (evita problemas de arrays/chaves do Realtime Database)
 *   stateBy    — id da aba do painel que gravou por último (para uma 2ª aba do painel acompanhar)
 *   teamsJson  — cadastro de times (com escudos)
 *   fx         — efeitos de um disparo só (repetir animação, testar gol…): { id, ev, args, ts }
 *   presence/  — quem está conectado (artes abertas)
 */
// peças do Node que o código do servidor usa
if (!window.setImmediate) window.setImmediate = (fn, ...a) => setTimeout(fn, 0, ...a);
const fs = require("fs");
const FX_EVENTS = ["art:replay", "placar:testGoal", "placar:testSub", "placar:testAdded", "penalty:testAlert", "others:goal"];
const DATA = "/app/data";

const db = window.PLACAR_DB;
const BASE = window.PLACAR_PATH || "placar";
const ref = (p) => db.ref(BASE + (p ? "/" + p : ""));
const myId = "p" + Math.random().toString(36).slice(2, 10);
const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

/* ---------------------------------------------------------------- Socket.IO de mentirinha */
class Hub {
  constructor() { this.sockets = new Set(); this.connHandlers = []; this.tap = null; this.ready = false; this.pending = []; }
  on(ev, fn) { if (ev === "connection") this.connHandlers.push(fn); }
  emit(ev, ...args) {                                  // io.emit: para todos os painéis/prévias + ponte p/ Firebase
    if (this.tap) args = this.tap(ev, args) || args;
    this.sockets.forEach((s) => s._deliver(ev, args));
  }
  connect(opts = {}) {                                 // devolve o "socket" do lado do cliente
    const client = new ClientSocket(this);
    const attach = () => {
      const srv = new ServerSocket(this, client, opts);
      client._srv = srv; this.sockets.add(srv);
      client.connected = true; client.id = srv.id;
      this.connHandlers.forEach((fn) => fn(srv));
      client._fire("connect");
    };
    if (this.ready) setTimeout(attach, 0); else this.pending.push(attach);
    return client;
  }
  start() { this.ready = true; this.pending.splice(0).forEach((f) => setTimeout(f, 0)); }
}
class Emitter {
  constructor() { this._h = {}; }
  on(ev, fn) { (this._h[ev] = this._h[ev] || []).push(fn); return this; }
  off(ev, fn) { this._h[ev] = (this._h[ev] || []).filter((f) => f !== fn); return this; }
  _fire(ev, ...a) { (this._h[ev] || []).slice().forEach((fn) => { try { fn(...a); } catch (e) { console.error(`[engine:${ev}]`, e); } }); }
}
class ServerSocket extends Emitter {
  constructor(hub, client, opts) {
    super();
    this.hub = hub; this.client = client; this.id = "s" + Math.random().toString(36).slice(2, 10); this._any = [];
    this.handshake = { query: opts.query || {}, headers: { referer: opts.referer || "" } };
  }
  onAny(fn) { this._any.push(fn); }
  emit(ev, ...args) { this._deliver(ev, args); }
  _deliver(ev, args) {                                 // servidor -> cliente (cópia, como na rede)
    const c = this.client;
    const copy = args.map((a) => (typeof a === "function" ? a : clone(a)));
    setTimeout(() => c._fire(ev, ...copy), 0);
  }
  _receive(ev, args) {                                 // cliente -> servidor
    const copy = args.map((a) => (typeof a === "function" ? a : clone(a)));
    const ack = typeof copy[copy.length - 1] === "function" ? copy.pop() : null;
    const wrapAck = ack ? (...r) => setTimeout(() => ack(...r.map(clone)), 0) : null;
    const call = wrapAck ? [...copy, wrapAck] : copy;
    this._any.forEach((fn) => { try { fn(ev, ...call); } catch (e) { console.error("[engine:any]", e); } });
    this._fire(ev, ...call);
  }
}
class ClientSocket extends Emitter {
  constructor(hub) { super(); this.hub = hub; this.connected = false; this.id = null; this._srv = null; }
  emit(ev, ...args) {
    const send = () => this._srv && this._srv._receive(ev, args);
    if (this._srv) setTimeout(send, 0); else this.hub.pending.push(() => setTimeout(send, 20));
    return this;
  }
  disconnect() { if (this._srv) { this.hub.sockets.delete(this._srv); this._srv._fire("disconnect"); this._srv = null; this.connected = false; } }
}

const hub = new Hub();
const io = (opts) => hub.connect(opts || {});
window.io = io;
window.__placarEngine = { connect: (opts) => hub.connect(opts || {}) };

/* ---------------------------------------------------------------- Tela de carregamento / erro */
function banner(html, kind) {
  let el = document.getElementById("engineBoot");
  if (!el) {
    el = document.createElement("div"); el.id = "engineBoot";
    el.style.cssText = "position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:#0b1220;color:#e8eefb;font:16px/1.5 system-ui,sans-serif;text-align:center;padding:24px";
    document.body.appendChild(el);
  }
  el.innerHTML = `<div style="max-width:460px"><div style="font-size:18px;font-weight:700;margin-bottom:8px">${kind === "err" ? "Sem conexão com o Firebase" : "Conectando ao Firebase…"}</div><div style="opacity:.85">${html}</div></div>`;
}
const hideBanner = () => { const el = document.getElementById("engineBoot"); if (el) el.remove(); };

/* ---------------------------------------------------------------- Firebase helpers */
const once = (path) => new Promise((res, rej) => ref(path).once("value", (s) => res(s.val()), rej));
function waitConnected(ms) {
  return new Promise((res) => {
    let done = false;
    const h = db.ref(".info/connected").on("value", (s) => { if (s.val() === true && !done) { done = true; db.ref(".info/connected").off("value", h); res(true); } });
    setTimeout(() => { if (!done) { done = true; res(false); } }, ms);
  });
}
const LS = { get(k) { try { return localStorage.getItem("placar_" + BASE + "_" + k); } catch (_) { return null; } }, set(k, v) { try { localStorage.setItem("placar_" + BASE + "_" + k, v); } catch (_) { /* cheio */ } } };

function loadTeamsIntoFs(json) {
  [...fs.__files.keys()].filter((f) => f.startsWith(DATA + "/teams/")).forEach((f) => fs.__files.delete(f));
  fs.mkdirSync(DATA + "/teams");
  let arr = [];
  try { arr = JSON.parse(json || "[]"); } catch (_) { /* ignora */ }
  (Array.isArray(arr) ? arr : []).forEach((t) => { if (t && t.id) fs.writeFileSync(`${DATA}/teams/${t.id}.json`, JSON.stringify(t)); });
}

/* ---------------------------------------------------------------- Boot */
(async function boot() {
  if (!db) { banner("Os scripts do Firebase não carregaram. Verifique a internet e recarregue a página.", "err"); return; }
  banner("Abrindo o banco de dados do placar.");
  const online = await waitConnected(10000);
  let stateJson = null, teamsJson = null;
  if (online) {
    try { [stateJson, teamsJson] = await Promise.all([once("stateJson"), once("teamsJson")]); }
    catch (e) { banner("O Firebase recusou a leitura (" + (e && e.code ? e.code : "erro") + "). Confira as regras do Realtime Database no guia.", "err"); return; }
  } else {
    stateJson = LS.get("state"); teamsJson = LS.get("teams");
    if (!stateJson) { banner("Não consegui conectar e não há cópia salva neste aparelho. Conecte-se à internet e recarregue.", "err"); return; }
  }
  // relógio: usa a hora do servidor do Firebase, para o painel e as artes concordarem mesmo com celulares com hora diferente
  let offset = 0;
  try { offset = await new Promise((r) => db.ref(".info/serverTimeOffset").once("value", (s) => r(Number(s.val()) || 0))); } catch (_) { /* usa 0 */ }
  const realNow = Date.now.bind(Date);
  Date.now = () => realNow() + offset;

  fs.mkdirSync(DATA);
  if (stateJson) fs.writeFileSync(DATA + "/state.json", stateJson);
  loadTeamsIntoFs(teamsJson);

  const runtime = require("./server/runtime");
  const sockets = require("./server/sockets");
  const persistence = require("./server/persistence");
  const teamsStore = require("./server/teamsStore");

  /* ---- motor -> Firebase ---- */
  let adopting = false, lastState = "", lastTeams = "", writeTimer = null, backupTimer = null;
  const flushState = () => {
    writeTimer = null;
    const json = lastState;
    ref().update({ stateJson: json, stateBy: myId }).catch((e) => console.error("[firebase] estado:", e));
    clearTimeout(backupTimer); backupTimer = setTimeout(() => LS.set("state", json), 1500);
  };
  const scheduleState = () => { if (!writeTimer) writeTimer = setTimeout(flushState, 120); };   // junta várias alterações seguidas (ex.: arrastar um controle)
  const connections = { presence: {} };
  hub.tap = (ev, args) => {
    if (ev === "state:sync") {
      const json = JSON.stringify(args[0]);
      if (!adopting && json !== lastState) { lastState = json; scheduleState(); }
      else lastState = json;
    } else if (ev === "teams:sync") {
      const json = JSON.stringify(args[0]);
      if (!adopting && json !== lastTeams) { lastTeams = json; ref().update({ teamsJson: json, stateBy: myId }).catch((e) => console.error("[firebase] times:", e)); LS.set("teams", json); }
      else lastTeams = json;
    } else if (FX_EVENTS.includes(ev)) {
      ref("fx").set({ id: myId + "_" + realNow() + "_" + Math.random().toString(36).slice(2, 6), ev, args: JSON.stringify(args), ts: Date.now() }).catch(() => {});
    } else if (ev === "connections:sync") {
      return [mergeConnections(args[0])];
    }
    return null;
  };
  function mergeConnections(local) {
    const sources = { escalacao: 0, placar: 0, eventos: 0, linhaDoTempo: 0, penaltis: 0, fimDeJogo: 0, informativos: 0, classificacao: 0 };
    let arte = 0;
    Object.values(connections.presence).forEach((p) => { if (p && p.source) { sources[p.source] = (sources[p.source] || 0) + 1; arte++; } });
    return { ...local, arte, sources, total: (local.panel || 0) + (local.previews || 0) + arte };
  }

  /* ---- Firebase -> motor (outra aba do painel mexeu) ---- */
  ref("stateJson").on("value", (snap) => {
    const json = snap.val();
    if (!json || json === lastState) return;
    ref("stateBy").once("value", (b) => {
      if (b.val() === myId) return;
      try {
        adopting = true;
        runtime.setState(persistence.mergeWithDefaults(JSON.parse(json)));
        runtime.broadcastState();
      } catch (e) { console.error("[firebase] estado remoto inválido:", e); } finally { adopting = false; }
    });
  });
  ref("teamsJson").on("value", (snap) => {
    const json = snap.val();
    if (json == null || json === lastTeams) return;
    ref("stateBy").once("value", (b) => {
      if (b.val() === myId) return;
      adopting = true; try { loadTeamsIntoFs(json); runtime.broadcastTeams(); } finally { adopting = false; }
    });
  });
  ref("presence").on("value", (snap) => {
    connections.presence = snap.val() || {};
    if (hub.ready) { try { hub.emit("connections:sync", { total: 0, arte: 0, previews: 0, panel: 0, sources: {}, lastUpdate: Date.now() }); } catch (_) { /* ok */ } }
  });

  sockets.setup(hub);

  /* ---- eventos extras do Placar App (importar dados, zerar tudo) ---- */
  const PARTS = { match: ["match", "meta"], art: ["customization", "modules", "visuals"], tables: ["league", "others", "officials", "stadium", "summary"] };
  hub.on("connection", (srv) => {
    srv.on("engine:import", (p, ack) => {
      try {
        p = p || {}; const parts = p.parts || {}; const res = { teams: 0, state: false };
        if (parts.teams) {
          (p.teams || []).forEach((t) => { if (t && typeof t === "object") { teamsStore.saveTeam(t); res.teams++; } });
          runtime.broadcastTeams();
        }
        if (p.state && (parts.match || parts.art || parts.tables)) {
          fs.writeFileSync(DATA + "/state.json", JSON.stringify(p.state));
          const incoming = persistence.loadState();           // reaproveita migração + valores padrão
          const cur = runtime.getState();
          Object.keys(PARTS).forEach((k) => { if (parts[k]) PARTS[k].forEach((key) => { if (incoming[key] !== undefined) cur[key] = incoming[key]; }); });
          if (parts.match) { cur.match.clock.running = false; cur.match.clock.runningSince = null; }
          runtime.commit(); res.state = true;
        }
        ack && ack({ ok: true, ...res });
      } catch (e) { console.error(e); ack && ack({ ok: false, error: e.message }); }
    });
    srv.on("engine:reset", (ack) => {
      try {
        teamsStore.deleteAllTeams();
        runtime.setState(require("./server/defaultState").getDefaultState());
        runtime.broadcastTeams(); runtime.broadcastState();
        ack && ack({ ok: true });
      } catch (e) { ack && ack({ ok: false, error: e.message }); }
    });
  });
  const summary = require("./server/summary");
  window.__placarSummary = {
    build: (q) => summary.buildSummary(runtime.getState(), null, summary.parseOpts(q || {})),
    text: summary.toText, fileBase: summary.fileBase,
  };
  lastState = JSON.stringify(runtime.getState());
  lastTeams = JSON.stringify(teamsStore.listTeams());
  if (online && !stateJson) { // primeira vez neste banco: grava o estado inicial para as artes já terem o que mostrar
    ref().update({ stateJson: lastState, teamsJson: lastTeams, stateBy: myId });
  }
  window.__placarRuntime = runtime;
  hub.start();
  hideBanner();
  if (!online) {
    const b = document.createElement("div");
    b.textContent = "Sem internet: usando a cópia salva neste aparelho. As alterações sobem quando a conexão voltar.";
    b.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:9998;background:#7a2e0e;color:#fff;padding:8px 12px;font:13px system-ui;text-align:center";
    document.body.appendChild(b);
  }
})().catch((e) => { console.error(e); banner("Erro ao iniciar o motor: " + (e && e.message), "err"); });
