/**
 * COMUNICAÇÃO EM TEMPO REAL (Socket.IO)
 * Protocolo idêntico ao das versões 3.x (as 4 Browser Sources continuam
 * funcionando sem alteração) + eventos novos:
 *   v4.0: settings:patch, settings:resetSection, clock:nextPeriod
 *   v4.1: match:setStatus (INTERVALO / FIM DE JOGO), disputa de pênaltis
 *         (shootout:*) e tipo de gol (goalType: normal | penalty | own)
 *   v5.0: undo:last / undo:sync (desfazer geral), match:annulGoal (gol anulado),
 *         finalcard:setVisible (cartão de fim de jogo), visual:save/load/delete
 *         (visuais salvos), art:replay (repete a animação de entrada), benchIds
 *         (reservas) em match:setSide
 *   v5.2: sons — audio:playPad / audio:test / audio:stop e "audio:play" para a fonte /arte/audio;
 *         gol lançado abre o placar compacto no modo completo
 *   v6.0: league:* (classificação), others:* (outros jogos), officials:* (arbitragem — ver informativos.js),
 *         undo:list / undo:to / redo:last / redo:to (lista de desfazer e refazer), evento com atInterval
 */
const runtime = require("./runtime");
const teamsStore = require("./teamsStore");
const { getDefaultState, getDefaultMatchSide, getDefaultShootout, getDefaultFinalCard, getDefaultOfficials } = require("./defaultState");
const { mergeCustomization, VISUAL_SLOTS } = require("./persistence");
const shootoutRules = require("./shootout");
const audio = require("./audio");
const informativos = require("./informativos");
const stadium = require("./stadium");

const { computeDisplayMinute, computeDisplayMinuteFromMinute, computeCurrentSeconds, PERIOD_ORDER } = runtime;

const SOURCE_BY_PATH = {
  "/arte": "escalacao",
  "/arte/placar": "placar",
  "/arte/eventos": "eventos",
  "/arte/linha-do-tempo": "linhaDoTempo",
  "/arte/penaltis": "penaltis",
  "/arte/fim-de-jogo": "fimDeJogo",
  "/arte/audio": "audio",
  "/arte/informativos": "informativos",
  "/arte/classificacao": "classificacao",
};
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const RESET_SECTIONS = {
  placar: (d) => ["customization", "placar", d.customization.placar],
  eventos: (d) => ["customization", "eventos", d.customization.eventos],
  linhaDoTempo: (d) => ["customization", "linhaDoTempo", d.customization.linhaDoTempo],
  effects: (d) => ["customization", "effects", d.customization.effects],
  penaltis: (d) => ["customization", "penaltis", d.customization.penaltis],
  fimDeJogo: (d) => ["customization", "fimDeJogo", d.customization.fimDeJogo],
  audio: (d) => ["customization", "audio", d.customization.audio],
  classificacao: (d) => ["customization", "classificacao", d.customization.classificacao],
  outrosJogos: (d) => ["customization", "outrosJogos", d.customization.outrosJogos],
  arbitragem: (d) => ["customization", "arbitragem", d.customization.arbitragem],
  estadio: (d) => ["customization", "estadio", d.customization.estadio],
};
const MAX_UNDO = 60;
const otherSide = (side) => (side === "home" ? "away" : "home");
/** Lado que RECEBE o gol: no gol contra, é o adversário de quem marcou. */
const scoringSide = (ev) => (ev.type === "goal" && ev.goalType === "own" ? otherSide(ev.side) : ev.side);

function detectClient(socket) {
  const q = socket.handshake.query || {};
  if (q.kind !== "arte") return { kind: "panel", source: null, preview: false };
  let source = null, preview = false;
  try {
    const u = new URL(socket.handshake.headers.referer || "");
    source = SOURCE_BY_PATH[u.pathname.replace(/\/+$/, "") || "/"] || null;
    preview = u.searchParams.get("preview") === "1";
  } catch (_) { /* sem referer */ }
  return { kind: "arte", source, preview };
}

function setup(io) {
  /** Toca o som da ação (gol, sub, yellow, red, annul) nas fontes /arte/audio, se estiver ligado. */
  const playCue = (cue) => {
    const req = audio.buildPlay(runtime.getState().customization.audio, cue);
    if (req) io.emit("audio:play", req);
  };
  runtime.setIo(io);
  const clients = {}; // socket.id -> { kind, source, preview }

  /* ---------- Desfazer e refazer (v5.0 / v6.0 / v6.1) ----------
     v6.1: vale para o PAINEL INTEIRO, não só a partida. Antes de cada ação que muda alguma coisa guardamos
     uma cópia de tudo o que o painel edita: partida, classificação, outros jogos, arbitragem, estádio,
     dados da transmissão, módulos, toda a personalização da Arte, visuais salvos e opções do resumo.
     Funciona assim (sem mexer em cada botão): um "ouvinte geral" (socket.onAny) tira a cópia ANTES do
     evento; logo depois que o evento termina, se algo mudou de verdade, a cópia vira um passo da lista.
     - Arrastar um controle deslizante (muitos eventos seguidos no mesmo ajuste) vira UM passo só.
     - Nunca voltam atrás (continuam como estão): o relógio e o que está no AR (mostrar/esconder placar de
       pênaltis, fim de jogo, tabela, outros jogos, arbitragem, VAR, estádio). Desfazer não liga nem desliga a transmissão.
     - Também não entram: times cadastrados (escudos/jogadores) e arquivos de áudio/foto no disco.
     "Desfazer" devolve a última cópia e põe o estado de antes na pilha de "refazer"; qualquer ação nova
     apaga o que dava para refazer. Fica só na memória (some ao reiniciar o programa). */
  const TRACKED = ["match", "league", "others", "officials", "stadium", "summary", "meta", "modules", "customization", "visuals"];
  const undoStack = [];
  const redoStack = [];
  const undoInfo = () => ({
    count: undoStack.length, label: undoStack.length ? undoStack[undoStack.length - 1].label : null,
    redoCount: redoStack.length, redoLabel: redoStack.length ? redoStack[redoStack.length - 1].label : null,
  });
  const broadcastUndo = () => io.emit("undo:sync", undoInfo());
  /** Cópia do que o desfazer controla (sem o relógio, que muda sozinho e nunca volta). */
  function copyTracked() {
    const st = runtime.getState(), snap = {};
    TRACKED.forEach((k) => { if (st[k] !== undefined) snap[k] = JSON.parse(JSON.stringify(k === "match" ? { ...st.match, clock: undefined } : st[k])); });
    return snap;
  }
  const keyOfSnap = (snap) => JSON.stringify(snap);
  /** Troca o estado por uma cópia guardada, preservando relógio e o que está no ar. */
  function restoreTracked(snap) {
    const st = runtime.getState();
    const cur = { match: st.match, league: st.league, others: st.others, officials: st.officials, stadium: st.stadium };
    if (snap.match) {
      snap.match.clock = cur.match.clock; // o relógio nunca volta atrás
      snap.match.finalCard = cur.match.finalCard; // o que está no ar (fim de jogo / pênaltis) não é desfeito
      if (snap.match.shootout && cur.match.shootout) snap.match.shootout.visible = cur.match.shootout.visible;
    }
    if (snap.league && cur.league) snap.league.visible = cur.league.visible;
    if (snap.others && cur.others) snap.others.visible = cur.others.visible;
    if (snap.officials && cur.officials) { snap.officials.refVisible = cur.officials.refVisible; snap.officials.varVisible = cur.officials.varVisible; }
    if (snap.stadium && cur.stadium) snap.stadium.visible = cur.stadium.visible;
    TRACKED.forEach((k) => { if (snap[k] !== undefined) st[k] = snap[k]; });
  }
  const MAX_UNDO_AGE_MERGE = 2000; // ms: ajustes seguidos do mesmo controle viram um passo
  /** Eventos que nunca entram no desfazer (relógio, áudio, mostrar/esconder, o próprio desfazer, cadastro de times). */
  const UNTRACKED = /^(clock:|undo:|redo:|audio:|art:|teams:|placar:test|visual:rename)|:setVisible$|toggleEventVisibility$|^finalcard:/;
  const CATEGORY = [
    [/^(match:|shootout:)/, "Partida"], [/^(league:|others:)/, "Classificação"], [/^officials:/, "Arbitragem"],
    [/^stadium:/, "Estádio"], [/^summary:/, "Resumo"], [/^(settings:|visual:)/, "Arte"],
  ];
  const ART_NAMES = {
    placar: "Placar", eventos: "Eventos", linhaDoTempo: "Linha do tempo", effects: "Efeitos", penaltis: "Pênaltis", fimDeJogo: "Fim de jogo",
    audio: "Áudio", classificacao: "Classificação", outrosJogos: "Outros jogos", arbitragem: "Arbitragem", estadio: "Estádio", escalacao: "Escalação",
  };
  const LABELS = {
    "league:setMeta": "Dados da tabela", "league:setMode": "Tabela: modo", "league:setRow": "Tabela: time alterado", "league:addRow": "Tabela: time adicionado",
    "league:removeRow": "Tabela: time removido", "league:moveRow": "Tabela: time movido", "league:sortByPoints": "Tabela ordenada por pontos",
    "league:bulk": "Tabela colada", "league:resetPoints": "Pontos zerados", "league:resetAll": "Tabela reiniciada", "league:setZone": "Zona da tabela",
    "league:addZone": "Zona adicionada", "league:removeZone": "Zona removida", "league:resetZones": "Zonas restauradas",
    "others:addGame": "Outro jogo adicionado", "others:updateGame": "Outro jogo alterado", "others:score": "Gol em outro jogo", "others:removeGame": "Outro jogo removido",
    "others:clear": "Outros jogos limpos", "others:commitGame": "Resultado lançado na tabela",
    "officials:set": "Arbitragem alterada", "officials:clear": "Arbitragem limpa",
    "stadium:set": "Dados do estádio", "stadium:addPhoto": "Foto do estádio adicionada", "stadium:removePhoto": "Foto do estádio removida",
    "stadium:movePhoto": "Foto do estádio movida", "stadium:clear": "Estádio limpo",
    "summary:set": "Opções do resumo", "settings:resetSection": "Ajustes da arte restaurados", "visual:save": "Visual salvo", "visual:load": "Visual carregado",
    "visual:delete": "Visual apagado", "state:update": "Estado atualizado", "match:setStatus": "Situação da partida", "shootout:setFirst": "Quem cobra primeiro",
    "shootout:flip": "Cobrança invertida", "match:setSide": "Time / escalação alterado",
  };
  function labelFor(event, args) {
    if (event === "settings:patch") {
      const parts = String((args[0] && args[0].path) || "").split(".");
      if (parts[0] === "customization") return `Arte — ${ART_NAMES[parts[1]] || parts[1] || "ajuste"}`;
      return parts[0] === "meta" ? "Dados da transmissão" : parts[0] === "modules" ? "Módulos ligados" : "Ajuste";
    }
    if (event === "settings:resetSection") return `Arte — ${ART_NAMES[args[0]] || args[0] || ""} restaurada`.replace("  ", " ");
    return LABELS[event] || event;
  }
  /** Chave de agrupamento: o mesmo controle mexido várias vezes seguidas = um passo. */
  function mergeKey(event, args) {
    const a = args[0];
    if (event === "settings:patch") return "sp:" + (a && a.path);
    if (event === "league:setRow" || event === "others:updateGame") return event + ":" + (a && (a.id || "")) + ":" + (a && a.patch ? Object.keys(a.patch).sort().join(",") : "");
    if (event === "officials:set") return event + ":" + (a && a.key);
    if (event === "stadium:set" || event === "summary:set") return event + ":" + (a && typeof a === "object" ? Object.keys(a).sort().join(",") : "");
    if (event === "league:setMeta") return event;
    return null;
  }
  const categoryOf = (event) => { const c = CATEGORY.find(([re]) => re.test(event)); return c ? c[1] : "Geral"; };
  let pendingLabel = null;
  /** Compat v6.0: os eventos da partida chamam pushUndo("rótulo") — agora só definem o nome do passo. */
  function pushUndo(label) { pendingLabel = label; }
  function trackEvent(event, args) {
    if (UNTRACKED.test(event)) return;
    const before = copyTracked(), beforeKey = keyOfSnap(before);
    pendingLabel = null;
    setImmediate(() => {
      const after = copyTracked();
      if (keyOfSnap(after) === beforeKey) { pendingLabel = null; return; } // nada mudou: não vira passo
      const key = mergeKey(event, args), now = Date.now(), last = undoStack[undoStack.length - 1];
      redoStack.length = 0; // ação nova: o que estava para refazer deixa de valer
      if (key && last && last.key === key && now - last.at < MAX_UNDO_AGE_MERGE) { last.at = now; broadcastUndo(); return; }
      undoStack.push({ label: pendingLabel || labelFor(event, args), category: categoryOf(event), key, at: now, snap: before });
      pendingLabel = null;
      if (undoStack.length > MAX_UNDO) undoStack.shift();
      broadcastUndo();
    });
  }
  function doUndo() {
    const entry = undoStack.pop();
    if (!entry) return null;
    redoStack.push({ label: entry.label, category: entry.category, at: entry.at, snap: copyTracked() });
    restoreTracked(entry.snap);
    return entry;
  }
  function doRedo() {
    const entry = redoStack.pop();
    if (!entry) return null;
    undoStack.push({ label: entry.label, category: entry.category, key: null, at: entry.at, snap: copyTracked() });
    restoreTracked(entry.snap);
    return entry;
  }

  function broadcastConnectionInfo() {
    const arr = Object.values(clients);
    const sources = { escalacao: 0, placar: 0, eventos: 0, linhaDoTempo: 0, penaltis: 0, fimDeJogo: 0, audio: 0, informativos: 0, classificacao: 0 };
    arr.forEach((c) => { if (c.kind === "arte" && !c.preview && c.source) sources[c.source]++; });
    io.emit("connections:sync", {
      total: arr.length,
      arte: arr.filter((c) => c.kind === "arte" && !c.preview).length, // Browser Sources reais (OBS)
      previews: arr.filter((c) => c.kind === "arte" && c.preview).length,
      panel: arr.filter((c) => c.kind === "panel").length,
      sources,
      lastUpdate: Date.now(),
    });
  }

  /* ---------- Relógio: um tick por segundo ---------- */
  setInterval(() => {
    const clock = runtime.getState().match.clock;
    if (!clock.running) return;
    const secondsNow = computeCurrentSeconds();
    io.emit("clock:tick", {
      seconds: secondsNow,
      addedTime: clock.addedTime ?? null,
      period: clock.period || "1t",
      displayMinute: computeDisplayMinute(secondsNow, clock.period || "1t"),
      stoppageLabel: clock.stoppageLabel || null, // compat v3.0
    });
  }, 1000);

  io.on("connection", (socket) => {
    clients[socket.id] = { ...detectClient(socket), connectedAt: Date.now() };
    const S = () => runtime.getState();
    const commit = runtime.commit;

    socket.emit("state:sync", S());
    socket.emit("teams:sync", teamsStore.listTeams());
    socket.emit("undo:sync", undoInfo());
    socket.onAny((event, ...args) => trackEvent(event, args)); // v6.1 — desfazer do painel inteiro (roda antes de cada ação)
    broadcastConnectionInfo();
    informativos.register(socket, { S, commit, io }); // v6.0 — classificação, outros jogos e arbitragem
    stadium.register(socket, { S, commit });           // v6.1 — estádio e fotos

    /* ---------- Configurações (meta, módulos, personalização) ---------- */
    // v4.0: o painel envia só o que mudou (caminho + valor), nunca o estado inteiro —
    // assim uma tela desatualizada nunca sobrescreve relógio/placar/eventos.
    socket.on("settings:patch", (payload) => {
      if (!payload || typeof payload.path !== "string") return;
      const parts = payload.path.split(".");
      if (!["meta", "modules", "customization"].includes(parts[0])) return;
      if (parts.some((k) => FORBIDDEN_KEYS.has(k) || k === "")) return;
      const defaults = getDefaultState();
      let defTarget = defaults, target = S();
      for (let i = 0; i < parts.length - 1; i++) {
        defTarget = defTarget && defTarget[parts[i]];
        if (!target[parts[i]] || typeof target[parts[i]] !== "object") target[parts[i]] = {};
        target = target[parts[i]];
      }
      const last = parts[parts.length - 1];
      const defVal = defTarget ? defTarget[last] : undefined;
      if (defVal === undefined || (defVal !== null && typeof defVal === "object")) return;
      let value = payload.value;
      if (typeof defVal === "number") { value = Number(value); if (!Number.isFinite(value)) return; }
      else if (typeof defVal === "boolean") value = !!value;
      else value = String(value == null ? "" : value).slice(0, 300);
      target[last] = value;
      commit();
    });

    socket.on("settings:resetSection", (section) => {
      const fn = RESET_SECTIONS[section];
      if (section === "escalacao") {
        const d = getDefaultState().customization;
        for (const k of Object.keys(d)) {
          if (typeof d[k] !== "object") S().customization[k] = d[k];
        }
        commit();
        return;
      }
      if (!fn) return;
      const [root, key, value] = fn(getDefaultState());
      S()[root][key] = JSON.parse(JSON.stringify(value));
      commit();
    });

    // Compat v3.x: aceita um patch parcial, mas só de meta/modules/customization.
    socket.on("state:update", (incoming) => {
      if (!incoming || typeof incoming !== "object") return;
      const cur = S();
      if (incoming.meta) cur.meta = { ...cur.meta, ...incoming.meta };
      if (incoming.modules) cur.modules = { ...cur.modules, ...incoming.modules };
      if (incoming.customization) {
        const c = incoming.customization;
        cur.customization = {
          ...cur.customization, ...c,
          effects: { ...cur.customization.effects, ...(c.effects || {}) },
          placar: { ...cur.customization.placar, ...(c.placar || {}) },
          eventos: { ...cur.customization.eventos, ...(c.eventos || {}) },
          linhaDoTempo: { ...cur.customization.linhaDoTempo, ...(c.linhaDoTempo || {}) },
          penaltis: { ...cur.customization.penaltis, ...(c.penaltis || {}) },
          fimDeJogo: { ...cur.customization.fimDeJogo, ...(c.fimDeJogo || {}) },
        };
      }
      commit();
    });

    /* ---------- Times (CRUD) ---------- */
    socket.on("teams:list", () => socket.emit("teams:sync", teamsStore.listTeams()));

    socket.on("teams:save", (team, ack) => {
      try {
        const saved = teamsStore.saveTeam(team || {});
        runtime.broadcastTeams();
        if (typeof ack === "function") ack({ ok: true, team: saved });
      } catch (err) {
        console.error("[teams:save]", err.message);
        if (typeof ack === "function") ack({ ok: false, error: err.message });
      }
    });

    socket.on("teams:delete", (teamId, ack) => {
      try {
        teamsStore.deleteTeam(teamId);
        let touched = false;
        for (const side of ["home", "away"]) {
          if (S().match[side].teamId === teamId) {
            S().match[side] = getDefaultMatchSide();
            touched = true;
          }
        }
        if (touched) commit();
        runtime.broadcastTeams();
        if (typeof ack === "function") ack({ ok: true });
      } catch (err) {
        console.error("[teams:delete]", err.message);
        if (typeof ack === "function") ack({ ok: false, error: err.message });
      }
    });

    /* ---------- Escalação ---------- */
    socket.on("match:setSide", ({ side, data } = {}) => {
      if ((side !== "home" && side !== "away") || !data || typeof data !== "object") return;
      const allowed = {};
      if ("teamId" in data) allowed.teamId = data.teamId ? teamsStore.sanitizeId(data.teamId) || null : null;
      if ("starterIds" in data && Array.isArray(data.starterIds)) allowed.starterIds = data.starterIds.map(String).slice(0, 11);
      if ("captainId" in data) allowed.captainId = data.captainId ? String(data.captainId) : null;
      if ("benchIds" in data && Array.isArray(data.benchIds)) allowed.benchIds = [...new Set(data.benchIds.map(String))].slice(0, 15);
      if ("lineupStats" in data && data.lineupStats && typeof data.lineupStats === "object") allowed.lineupStats = data.lineupStats;
      pushUndo("teamId" in allowed ? "Troca de time" : "Escalação alterada");
      // quem virou titular deixa o banco de reservas
      const merged = { ...S().match[side], ...allowed };
      if (Array.isArray(merged.benchIds)) merged.benchIds = merged.benchIds.filter((id) => !merged.starterIds.includes(id));
      S().match[side] = merged;
      commit();
    });

    /* ---------- Placar ---------- */
    socket.on("match:setScore", ({ home, away } = {}) => {
      pushUndo("Placar alterado");
      if (typeof home === "number" && Number.isFinite(home)) S().match.score.home = Math.max(0, Math.floor(home));
      if (typeof away === "number" && Number.isFinite(away)) S().match.score.away = Math.max(0, Math.floor(away));
      commit();
    });

    /* ---------- Relógio ---------- */
    socket.on("clock:start", () => {
      const clock = S().match.clock;
      if (!clock.running) { clock.running = true; clock.runningSince = Date.now(); S().match.statusLabel = null; commit(); }
    });
    socket.on("clock:pause", () => {
      const clock = S().match.clock;
      if (clock.running) {
        clock.seconds = computeCurrentSeconds();
        clock.running = false;
        clock.runningSince = null;
        commit();
      }
    });
    socket.on("clock:reset", () => {
      // v4.0: mantém o período escolhido (na v3.2 o reset apagava o período).
      const old = S().match.clock;
      S().match.clock = { seconds: 0, running: false, period: old.period || "1t", addedTime: null, stoppageLabel: null, runningSince: null };
      S().match.statusLabel = null;
      commit();
    });
    socket.on("clock:setSeconds", (seconds) => {
      const clock = S().match.clock;
      const n = Number(seconds);
      if (!Number.isFinite(n)) return;
      clock.seconds = Math.max(0, Math.floor(n));
      if (clock.running) clock.runningSince = Date.now();
      commit();
    });
    socket.on("clock:addSeconds", (delta) => {
      const clock = S().match.clock;
      const n = Number(delta);
      if (!Number.isFinite(n)) return;
      clock.seconds = Math.max(0, computeCurrentSeconds() + Math.floor(n));
      clock.runningSince = clock.running ? Date.now() : null;
      commit();
    });
    socket.on("clock:setStoppage", (label) => { // COMPAT v3.0
      S().match.clock.stoppageLabel = label || null;
      commit();
    });
    socket.on("clock:setPeriod", (period) => {
      if (!PERIOD_ORDER.includes(period)) return;
      S().match.clock.period = period;
      S().match.statusLabel = null;
      commit();
    });
    // v4.0 — avança para o próximo período: zera o relógio (pausado) e limpa o acréscimo.
    socket.on("clock:nextPeriod", () => {
      const clock = S().match.clock;
      const idx = PERIOD_ORDER.indexOf(clock.period || "1t");
      if (idx < 0 || idx >= PERIOD_ORDER.length - 1) return;
      S().match.clock = { seconds: 0, running: false, period: PERIOD_ORDER[idx + 1], addedTime: null, stoppageLabel: null, runningSince: null };
      S().match.statusLabel = null;
      commit();
    });
    socket.on("clock:setAddedTime", (minutes) => {
      const parsed = minutes === null || minutes === "" || minutes === undefined ? null : parseInt(minutes, 10);
      S().match.clock.addedTime = Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
      commit();
    });

    /* ---------- Rótulo no lugar do relógio (v4.1) ---------- */
    // "intervalo" | "fim" | null. Some sozinho quando o relógio volta a correr.
    socket.on("match:setStatus", (status) => {
      pushUndo("Rótulo do placar");
      const clock = S().match.clock;
      if (status === "intervalo" || status === "fim") {
        if (clock.running) { clock.seconds = computeCurrentSeconds(); clock.running = false; clock.runningSince = null; }
        S().match.statusLabel = status;
      } else S().match.statusLabel = null;
      commit();
    });

    /* ---------- Eventos da partida ---------- */
    socket.on("match:addEvent", (event) => {
      if (!event || typeof event !== "object" || !["goal", "yellow", "red", "sub"].includes(event.type)) return;
      if (!event.playerId) return;
      const clock = S().match.clock;
      const secondsNow = computeCurrentSeconds();
      const period = PERIOD_ORDER.includes(event.period) ? event.period : clock.period || "1t";
      const minuteForDisplay = typeof event.minute === "number" && event.minute >= 0 ? Math.floor(event.minute) : Math.floor(secondsNow / 60);
      const str = (v, n = 120) => String(v == null ? "" : v).slice(0, n);
      // v4.1: só campos conhecidos entram no evento (nada de campos arbitrários vindos do cliente)
      const fullEvent = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        minute: minuteForDisplay,
        secondsElapsed: secondsNow,
        period,
        displayMinute: computeDisplayMinuteFromMinute(minuteForDisplay, period),
        addedTime: clock.addedTime ?? null,
        stoppageLabel: null,
        showOnAir: event.showOnAir === false ? false : true,
        atInterval: S().match.statusLabel === "intervalo", // v6.0 — lançado durante o intervalo (aparece no resumo da partida)
        type: event.type,
        side: event.side === "away" ? "away" : "home",
        playerId: str(event.playerId, 80),
        playerName: str(event.playerName),
        secondaryPlayerId: event.secondaryPlayerId ? str(event.secondaryPlayerId, 80) : undefined,
        secondaryPlayerName: event.secondaryPlayerName ? str(event.secondaryPlayerName) : undefined,
        note: event.note ? str(event.note, 300) : undefined,
      };
      if (fullEvent.type === "goal") fullEvent.goalType = ["penalty", "own"].includes(event.goalType) ? event.goalType : "normal";

      pushUndo({ goal: "Gol", yellow: "Cartão amarelo", red: "Cartão vermelho", sub: "Substituição" }[fullEvent.type] + (fullEvent.playerName ? ` — ${fullEvent.playerName}` : ""));
      S().match.events.push(fullEvent);

      // v5.2 — gol lançado abre o placar compacto no modo completo (e ele fica completo)
      if (fullEvent.type === "goal" && fullEvent.showOnAir) {
        const pc = S().customization.placar;
        if (pc.goalExpandsCompact !== false && pc.compact) pc.compact = false;
      }
      // v5.2 — som da ação (só para o que vai ao ar)
      if (fullEvent.showOnAir) playCue(fullEvent.type === "sub" ? "sub" : fullEvent.type === "goal" ? "gol" : fullEvent.type);

      const side = fullEvent.side;
      const matchSide = S().match[side];
      const stats = matchSide.lineupStats;
      const blank = () => ({ yellowCards: 0, redCards: 0, goals: 0, substituted: false, enteredGame: false });
      if (!stats[fullEvent.playerId]) stats[fullEvent.playerId] = blank();

      if (fullEvent.type === "goal") {
        if (fullEvent.goalType === "own") {
          // gol contra: o gol vai para o adversário e NÃO conta como gol do jogador
          stats[fullEvent.playerId].ownGoals = (stats[fullEvent.playerId].ownGoals || 0) + 1;
        } else {
          stats[fullEvent.playerId].goals += 1;
        }
        S().match.score[scoringSide(fullEvent)] += 1;
      } else if (fullEvent.type === "yellow") {
        stats[fullEvent.playerId].yellowCards += 1;
      } else if (fullEvent.type === "red") {
        stats[fullEvent.playerId].redCards += 1;
      } else if (fullEvent.type === "sub") {
        stats[fullEvent.playerId].substituted = true;
        if (fullEvent.secondaryPlayerId) {
          if (!stats[fullEvent.secondaryPlayerId]) stats[fullEvent.secondaryPlayerId] = blank();
          stats[fullEvent.secondaryPlayerId].enteredGame = true;
          // A substituição atualiza a escalação de verdade: o reserva assume a vaga do titular.
          const starterIds = matchSide.starterIds;
          const idx = starterIds.indexOf(fullEvent.playerId);
          if (idx !== -1) starterIds[idx] = fullEvent.secondaryPlayerId;
          else if (!starterIds.includes(fullEvent.secondaryPlayerId)) starterIds.push(fullEvent.secondaryPlayerId);
          if (matchSide.captainId === fullEvent.playerId) matchSide.captainId = null;
        }
      }
      commit();
    });

    socket.on("match:toggleEventVisibility", (eventId) => {
      const ev = S().match.events.find((e) => e.id === eventId);
      if (ev) { ev.showOnAir = !ev.showOnAir; commit(); }
    });

    socket.on("match:removeEvent", (eventId) => {
      const ev = S().match.events.find((e) => e.id === eventId);
      if (!ev) return;
      pushUndo("Evento removido");
      S().match.events = S().match.events.filter((e) => e.id !== eventId);
      const side = ev.side === "away" ? "away" : "home";
      const matchSide = S().match[side];
      const stats = matchSide.lineupStats[ev.playerId];
      // v4.0: desfaz o efeito do evento removido (gol, cartões e substituição).
      if (ev.type === "goal" && !ev.annulled) { // gol anulado já foi descontado do placar
        const sc = scoringSide(ev);
        S().match.score[sc] = Math.max(0, S().match.score[sc] - 1);
        if (stats) {
          if (ev.goalType === "own") stats.ownGoals = Math.max(0, (stats.ownGoals || 0) - 1);
          else stats.goals = Math.max(0, stats.goals - 1);
        }
      } else if (ev.type === "yellow" && stats) {
        stats.yellowCards = Math.max(0, stats.yellowCards - 1);
      } else if (ev.type === "red" && stats) {
        stats.redCards = Math.max(0, stats.redCards - 1);
      } else if (ev.type === "sub" && ev.secondaryPlayerId) {
        const idx = matchSide.starterIds.indexOf(ev.secondaryPlayerId);
        if (idx !== -1 && !matchSide.starterIds.includes(ev.playerId)) matchSide.starterIds[idx] = ev.playerId;
        if (stats) stats.substituted = false;
        const inStats = matchSide.lineupStats[ev.secondaryPlayerId];
        if (inStats) inStats.enteredGame = false;
      }
      commit();
    });

    // v5.0 — GOL ANULADO (VAR, impedimento…): o gol continua no histórico (riscado),
    // mas sai do placar e das marcações. A arte de eventos mostra o aviso "GOL ANULADO".
    socket.on("match:annulGoal", (data) => {
      const d = data && typeof data === "object" ? data : { eventId: data };
      const ev = S().match.events.find((e) => e.id === d.eventId);
      if (!ev || ev.type !== "goal" || ev.annulled) return;
      pushUndo(`Gol anulado — ${ev.playerName || ""}`.trim());
      ev.annulled = true;
      if (d.note) ev.annulNote = String(d.note).slice(0, 60);
      playCue("annul");
      const sc = scoringSide(ev);
      S().match.score[sc] = Math.max(0, S().match.score[sc] - 1);
      const stats = S().match[ev.side === "away" ? "away" : "home"].lineupStats[ev.playerId];
      if (stats) {
        if (ev.goalType === "own") stats.ownGoals = Math.max(0, (stats.ownGoals || 0) - 1);
        else stats.goals = Math.max(0, (stats.goals || 0) - 1);
      }
      commit();
    });

    // v5.0 — cartão de fim de jogo no OBS (/arte/fim-de-jogo)
    socket.on("finalcard:setVisible", (visible) => {
      S().match.finalCard = { ...getDefaultFinalCard(), ...(S().match.finalCard || {}), visible: !!visible };
      commit();
    });

    // v6.1 — opções do resumo (título e itens desmarcados): guardadas no estado para entrar no desfazer
    socket.on("summary:set", (d = {}) => {
      if (!d || typeof d !== "object") return;
      const sm = S().summary || (S().summary = { title: "", off: [] });
      if (typeof d.title === "string") sm.title = d.title.slice(0, 80);
      if (typeof d.key === "string" && /^[a-z]{3,12}$/.test(d.key)) {
        const off = new Set(sm.off);
        if (d.on) off.delete(d.key); else off.add(d.key);
        sm.off = [...off];
      }
      commit();
    });

    // v5.0 — repete a animação de entrada do placar ou da escalação (botão da aba Arte)
    socket.on("art:replay", (target) => {
      if (["placar", "escalacao", "fimDeJogo", "penaltis"].includes(target)) io.emit("art:replay", target);
    });

    // v5.0 — DESFAZER GERAL (v6.0: com refazer e lista)
    socket.on("undo:last", (ack) => {
      const entry = doUndo();
      if (!entry) { if (typeof ack === "function") ack({ ok: false }); return; }
      broadcastUndo();
      commit();
      if (typeof ack === "function") ack({ ok: true, label: entry.label });
    });
    socket.on("redo:last", (ack) => {
      const entry = doRedo();
      if (!entry) { if (typeof ack === "function") ack({ ok: false }); return; }
      broadcastUndo();
      commit();
      if (typeof ack === "function") ack({ ok: true, label: entry.label });
    });
    // lista (do mais recente para o mais antigo) do que dá para desfazer e do que dá para refazer
    socket.on("undo:list", (ack) => {
      if (typeof ack !== "function") return;
      const map = (arr) => arr.map((e) => ({ label: e.label, category: e.category || "", at: e.at })).reverse();
      ack({ undo: map(undoStack), redo: map(redoStack) });
    });
    // volta N passos de uma vez (1 = só o último). Os passos desfeitos ficam na lista de refazer.
    socket.on("undo:to", (steps, ack) => {
      const n = Math.max(1, Math.min(undoStack.length, Math.floor(Number(steps)) || 0));
      let last = null, done = 0;
      for (let i = 0; i < n; i++) { const e = doUndo(); if (!e) break; last = e; done++; }
      if (done) { broadcastUndo(); commit(); }
      if (typeof ack === "function") ack({ ok: done > 0, steps: done, label: last && last.label });
    });
    // refaz N passos de uma vez
    socket.on("redo:to", (steps, ack) => {
      const n = Math.max(1, Math.min(redoStack.length, Math.floor(Number(steps)) || 0));
      let last = null, done = 0;
      for (let i = 0; i < n; i++) { const e = doRedo(); if (!e) break; last = e; done++; }
      if (done) { broadcastUndo(); commit(); }
      if (typeof ack === "function") ack({ ok: done > 0, steps: done, label: last && last.label });
    });

    // v5.0 — VISUAIS SALVOS (3 vagas): guardam toda a personalização da arte
    socket.on("visual:save", ({ slot, name } = {}) => {
      const i = Number(slot);
      if (!Number.isInteger(i) || i < 0 || i >= VISUAL_SLOTS) return;
      if (!Array.isArray(S().visuals)) S().visuals = Array(VISUAL_SLOTS).fill(null);
      const prev = S().visuals[i];
      S().visuals[i] = {
        name: String(name || (prev && prev.name) || `Visual ${i + 1}`).slice(0, 40),
        savedAt: Date.now(),
        customization: (() => { const c = JSON.parse(JSON.stringify(S().customization)); delete c.audio; return c; })(), // sons não fazem parte do visual
      };
      commit();
    });
    socket.on("visual:rename", ({ slot, name } = {}) => {
      const v = Array.isArray(S().visuals) ? S().visuals[Number(slot)] : null;
      if (!v) return;
      v.name = String(name || "").trim().slice(0, 40) || v.name;
      commit();
    });
    socket.on("visual:load", (slot) => {
      const v = Array.isArray(S().visuals) ? S().visuals[Number(slot)] : null;
      if (!v) return;
      const keepAudio = S().customization.audio;
      S().customization = mergeCustomization(getDefaultState().customization, JSON.parse(JSON.stringify(v.customization)));
      S().customization.audio = keepAudio || getDefaultState().customization.audio; // aplicar um visual nunca troca os sons
      commit();
    });
    socket.on("visual:delete", (slot) => {
      const i = Number(slot);
      if (!Array.isArray(S().visuals) || !Number.isInteger(i) || i < 0 || i >= VISUAL_SLOTS) return;
      S().visuals[i] = null;
      commit();
    });

    socket.on("match:reset", () => {
      pushUndo("Partida reiniciada");
      const m = S().match;
      m.home = { ...getDefaultMatchSide(), teamId: m.home.teamId };
      m.away = { ...getDefaultMatchSide(), teamId: m.away.teamId };
      m.score = { home: 0, away: 0 };
      m.clock = { seconds: 0, running: false, stoppageLabel: null, period: "1t", addedTime: null, runningSince: null };
      m.events = [];
      m.statusLabel = null;
      m.shootout = getDefaultShootout();
      m.finalCard = getDefaultFinalCard();
      // v6.0 — nova partida: a arbitragem anterior não vale mais (classificação e outros jogos continuam)
      S().officials = { ...getDefaultOfficials(), refVisible: false, varVisible: false };
      commit();
    });

    // v4.1 — botão "Testar aviso de GOL" da aba Arte: todas as Browser Sources de placar
    // (OBS e prévia) mostram um gol de exemplo, sem registrar nada na partida.
    socket.on("placar:testGoal", (side) => io.emit("placar:testGoal", side === "away" ? "away" : "home"));
    // v6.1 — idem para o aviso de cobrança de pênalti (GOL! / PERDEU!)
    socket.on("penalty:testAlert", (scored) => io.emit("penalty:testAlert", { scored: scored !== false && scored !== "miss" }));
    // v5.0 — idem para o aviso de SUBSTITUIÇÃO
    socket.on("placar:testAdded", () => io.emit("placar:testAdded"));

    /* ---------- Sons (v5.2) ---------- */
    // botão de soundpad (1..8) -> toca na fonte /arte/audio
    socket.on("audio:playPad", (n) => {
      const req = audio.buildPlay(S().customization.audio, `pad${Number(n) || 0}`);
      if (req) io.emit("audio:play", req);
    });
    // "Testar no ar" de uma ação (ignora a chave de ligado/desligado)
    socket.on("audio:test", (cue) => {
      const req = audio.buildPlay(S().customization.audio, String(cue), { force: true });
      if (req) io.emit("audio:play", req);
    });
    socket.on("audio:stop", () => io.emit("audio:stop"));
    // o painel avisa quando a biblioteca mudou (upload/exclusão), para as outras telas atualizarem
    socket.on("audio:libraryChanged", () => io.emit("audio:library"));
    // um áudio do operador foi apagado: quem usava esse áudio fica sem som
    socket.on("audio:fileDeleted", (file) => {
      if (audio.clearReferences(S().customization.audio, String(file || ""))) commit();
      io.emit("audio:library");
    });
    socket.on("placar:testSub", (side) => io.emit("placar:testSub", side === "away" ? "away" : "home"));

    /* ---------- Disputa de pênaltis (v4.1) ---------- */
    // Não altera o placar da partida. As cobranças alternam sozinhas a partir de
    // "firstSide"; o servidor decide de quem é a vez e quando a disputa termina.
    const SH = () => S().match.shootout;
    const shCommit = () => { shootoutRules.refresh(SH()); commit(); };

    socket.on("shootout:setVisible", (visible) => {
      SH().visible = !!visible;
      commit();
    });
    socket.on("shootout:setFirst", (side) => {
      if (side !== "home" && side !== "away") return;
      if (SH().kicks.length > 0) return; // só antes da primeira cobrança
      SH().firstSide = side;
      shCommit();
    });
    socket.on("shootout:kick", (data) => {
      const sh = SH();
      const info = shootoutRules.compute(sh);
      if (info.finished || !info.next) return;
      pushUndo("Cobrança de pênalti");
      const d = data && typeof data === "object" ? data : {};
      sh.kicks.push({
        id: `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
        side: info.next.side, round: info.next.round,
        scored: !!d.scored,
        playerId: d.playerId ? String(d.playerId).slice(0, 80) : null,
        playerName: d.playerName ? String(d.playerName).slice(0, 80) : "",
      });
      shCommit();
    });
    socket.on("shootout:undo", () => {
      if (SH().kicks.length === 0) return;
      SH().kicks.pop();
      shCommit();
    });
    // corrige uma cobrança lançada errado (gol <-> perdeu)
    socket.on("shootout:flip", (kickId) => {
      const k = SH().kicks.find((x) => x.id === kickId);
      if (!k) return;
      pushUndo("Cobrança corrigida");
      k.scored = !k.scored;
      shCommit();
    });
    socket.on("shootout:reset", () => {
      pushUndo("Disputa reiniciada");
      const visible = SH().visible;
      S().match.shootout = { ...getDefaultShootout(), visible, firstSide: SH().firstSide };
      commit();
    });

    socket.on("disconnect", () => {
      delete clients[socket.id];
      broadcastConnectionInfo();
    });
  });
}

module.exports = { setup };
