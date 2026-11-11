/**
 * PERSISTÊNCIA DO ESTADO (data/state.json)
 * v4.0: escrita atômica (arquivo temporário + rename), salvamento síncrono ao
 * encerrar o servidor e cópia de segurança de um state.json corrompido.
 */
const fs = require("fs");
const path = require("path");
const { getDefaultState, getDefaultMatchSide, getDefaultFinalCard } = require("./defaultState");
const informativos = require("./informativos");
const stadium = require("./stadium");
const teamsStore = require("./teamsStore");
const shootout = require("./shootout");

const DATA_DIR = path.join(__dirname, "..", "data");
const STATE_FILE = path.join(DATA_DIR, "state.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

/** v5.0 — visuais salvos: sempre 3 vagas; cada uma é null ou { name, savedAt, customization }. */
const VISUAL_SLOTS = 3;
function normalizeVisuals(raw) {
  const defaults = getDefaultState().customization;
  const out = [];
  for (let i = 0; i < VISUAL_SLOTS; i++) {
    const v = Array.isArray(raw) ? raw[i] : null;
    if (!v || typeof v !== "object" || !v.customization || typeof v.customization !== "object") { out.push(null); continue; }
    out.push({
      name: String(v.name || `Visual ${i + 1}`).slice(0, 40),
      savedAt: Number(v.savedAt) || Date.now(),
      customization: mergeCustomization(defaults, v.customization),
    });
  }
  return out;
}
function mergeCustomization(defaults, sc) {
  return {
    ...defaults,
    ...sc,
    effects: { ...defaults.effects, ...(sc.effects || {}) },
    placar: { ...defaults.placar, ...(sc.placar || {}) },
    eventos: { ...defaults.eventos, ...(sc.eventos || {}) },
    linhaDoTempo: { ...defaults.linhaDoTempo, ...(sc.linhaDoTempo || {}) },
    penaltis: { ...defaults.penaltis, ...(sc.penaltis || {}) },
    fimDeJogo: { ...defaults.fimDeJogo, ...(sc.fimDeJogo || {}) },
    audio: { ...defaults.audio, ...(sc.audio || {}) },
    classificacao: { ...defaults.classificacao, ...(sc.classificacao || {}) },
    outrosJogos: { ...defaults.outrosJogos, ...(sc.outrosJogos || {}) },
    arbitragem: { ...defaults.arbitragem, ...(sc.arbitragem || {}) },
    estadio: { ...defaults.estadio, ...(sc.estadio || {}) },
  };
}

/** v6.1 — opções do resumo: título (até 80) e a lista de itens desmarcados. */
function normalizeSummaryOpts(x) {
  const t = x && typeof x.title === "string" ? x.title.slice(0, 80) : "";
  const off = x && Array.isArray(x.off) ? x.off.map(String).filter((k) => /^[a-z]{3,12}$/.test(k)).slice(0, 20) : [];
  return { title: t, off };
}

/**
 * Merge profundo entre o estado salvo e o padrão: campos novos de versões
 * futuras nunca quebram estados antigos (v2.x … v4.x).
 */
function mergeWithDefaults(saved) {
  const defaults = getDefaultState();
  const s = saved && typeof saved === "object" ? saved : {};
  const savedMatch = s.match || {};
  const sc = s.customization || {};
  const events = Array.isArray(savedMatch.events) ? savedMatch.events : [];
  const out = {
    ...defaults,
    ...s,
    meta: { ...defaults.meta, ...(s.meta || {}) },
    modules: { ...defaults.modules, ...(s.modules || {}) },
    match: {
      ...defaults.match,
      ...savedMatch,
      home: { ...getDefaultMatchSide(), ...(savedMatch.home || {}) },
      away: { ...getDefaultMatchSide(), ...(savedMatch.away || {}) },
      score: { ...defaults.match.score, ...(savedMatch.score || {}) },
      clock: { ...defaults.match.clock, ...(savedMatch.clock || {}) },
      events,
      statusLabel: ["intervalo", "fim"].includes(savedMatch.statusLabel) ? savedMatch.statusLabel : null,
      shootout: shootout.normalize(savedMatch.shootout),
      finalCard: { ...getDefaultFinalCard(), visible: !!(savedMatch.finalCard && savedMatch.finalCard.visible) },
    },
    customization: {
      ...defaults.customization,
      ...sc,
      effects: { ...defaults.customization.effects, ...(sc.effects || {}) },
      placar: { ...defaults.customization.placar, ...(sc.placar || {}) },
      eventos: { ...defaults.customization.eventos, ...(sc.eventos || {}) },
      linhaDoTempo: { ...defaults.customization.linhaDoTempo, ...(sc.linhaDoTempo || {}) },
      penaltis: { ...defaults.customization.penaltis, ...(sc.penaltis || {}) },
      fimDeJogo: { ...defaults.customization.fimDeJogo, ...(sc.fimDeJogo || {}) },
      audio: { ...defaults.customization.audio, ...(sc.audio || {}) },
      classificacao: { ...defaults.customization.classificacao, ...(sc.classificacao || {}) },
      outrosJogos: { ...defaults.customization.outrosJogos, ...(sc.outrosJogos || {}) },
      arbitragem: { ...defaults.customization.arbitragem, ...(sc.arbitragem || {}) },
      estadio: { ...defaults.customization.estadio, ...(sc.estadio || {}) },
    },
    visuals: normalizeVisuals(s.visuals),
    // v6.0 — classificação, outros jogos e arbitragem (estados antigos não têm; entram os padrões)
    league: informativos.normalizeLeague(s.league),
    others: informativos.normalizeOthers(s.others),
    officials: informativos.normalizeOfficials(s.officials),
    stadium: stadium.normalizeStadium(s.stadium),
    summary: normalizeSummaryOpts(s.summary),
  };
  // v5.0 — garante listas válidas nos dois lados (estados antigos não têm benchIds)
  for (const side of ["home", "away"]) {
    const m = out.match[side];
    if (!Array.isArray(m.benchIds)) m.benchIds = [];
    m.benchIds = m.benchIds.map(String).slice(0, 15);
    if (!Array.isArray(m.starterIds)) m.starterIds = [];
    if (!m.lineupStats || typeof m.lineupStats !== "object") m.lineupStats = {};
  }
  // v4.1 — estatísticas manuais foram removidas do projeto: descarta o que sobrou de estados antigos
  delete out.match.stats;
  delete out.modules.estatisticas;
  return out;
}

/** Formato antigo (v2.0): um único time direto no state.json. */
function isLegacyState(raw) {
  return !!(raw && raw.team && Array.isArray(raw.players) && !raw.match);
}

/** Converte o time do formato antigo em um objeto de time (sem gravar). */
function legacyToTeam(raw) {
  return teamsStore.normalizeTeam({
    name: raw.team.name,
    crestDataUrl: raw.team.crestDataUrl,
    captainSymbol: raw.team.captainSymbol,
    primaryColor: raw.team.primaryColor,
    secondaryColor: raw.team.secondaryColor,
    textColor: raw.team.textColor,
    numberColor: raw.team.numberColor,
    bgColor: raw.team.bgColor,
    dividerColor: raw.team.dividerColor,
    captainColor: raw.team.captainColor,
    shadowColor: raw.team.shadowColor,
    players: raw.players,
  });
}

function migrateLegacyIfNeeded(raw) {
  if (!isLegacyState(raw)) return raw;
  const existingTeams = teamsStore.listTeams();
  if (existingTeams.length === 0 && raw.team.name) {
    const saved = teamsStore.saveTeam(legacyToTeam(raw));
    raw.match = {
      home: { teamId: saved.id, starterIds: raw.starterIds || [], captainId: raw.captainId || null, lineupStats: {} },
    };
    console.log(`[persistence] Estado antigo migrado: time "${saved.name}" criado em data/teams/${saved.id}.json`);
  }
  return raw;
}

/**
 * Ajustes ao carregar. Se o servidor foi reiniciado COM o relógio rodando, ele continua
 * rodando (o jogo real não parou) — exceto se o arquivo for muito antigo (> 6 h), caso em
 * que o relógio volta pausado para não "contar" dias de diferença.
 */
function sanitizeRuntime(state) {
  const clock = state.match.clock;
  if (clock.running) {
    const gap = clock.runningSince ? Date.now() - clock.runningSince : Infinity;
    if (gap > 6 * 3600 * 1000) {
      clock.running = false;
      clock.runningSince = null;
    }
  } else {
    clock.runningSince = null;
  }
  if (!["1t", "2t", "p1", "p2"].includes(clock.period)) clock.period = "1t";
  return state;
}

function loadState() {
  ensureDataDir();
  if (!fs.existsSync(STATE_FILE)) return getDefaultState();
  try {
    const raw = fs.readFileSync(STATE_FILE, "utf-8");
    let parsed = JSON.parse(raw);
    parsed = migrateLegacyIfNeeded(parsed);
    return sanitizeRuntime(mergeWithDefaults(parsed));
  } catch (err) {
    console.error("[persistence] Falha ao ler state.json, usando estado padrão:", err.message);
    try {
      const copy = path.join(DATA_DIR, `state.corrupt-${Date.now()}.json`);
      fs.copyFileSync(STATE_FILE, copy);
      console.error(`[persistence] Cópia do arquivo com problema salva em ${copy}`);
    } catch (_) { /* ignora */ }
    return getDefaultState();
  }
}

function saveState(state) {
  ensureDataDir();
  const tmp = STATE_FILE + ".tmp";
  fs.writeFile(tmp, JSON.stringify(state, null, 2), (err) => {
    if (err) return console.error("[persistence] Falha ao salvar state.json:", err.message);
    fs.rename(tmp, STATE_FILE, (err2) => {
      if (err2) console.error("[persistence] Falha ao finalizar state.json:", err2.message);
    });
  });
}

function saveStateSync(state) {
  ensureDataDir();
  const tmp = STATE_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, STATE_FILE);
}

module.exports = {
  DATA_DIR,
  STATE_FILE,
  loadState,
  saveState,
  saveStateSync,
  mergeWithDefaults,
  mergeCustomization,
  normalizeVisuals,
  VISUAL_SLOTS,
  isLegacyState,
  legacyToTeam,
};
