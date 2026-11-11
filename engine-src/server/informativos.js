/**
 * INFORMATIVOS (v6.0): classificação (tabela), outros jogos e arbitragem.
 * ---------------------------------------------------------------
 * - league   → tabela de classificação (times, pontos, faixas). Valores BASE digitados pelo operador.
 * - others   → jogos que acontecem ao mesmo tempo. Enquanto "ao vivo" ou "encerrado", entram na tabela
 *              como PROJEÇÃO (a arte soma o resultado provisório); "Lançar na tabela" grava de vez.
 * - officials→ árbitro, assistentes, 4º árbitro e os 3 árbitros de vídeo.
 * Os três ficam FORA da partida (match): não entram no "desfazer" e não somem ao trocar de jogo
 * (só a arbitragem é limpa em "Reiniciar partida").
 */
const Standings = require("../../js/standings-core");
const teamsStore = require("./teamsStore");
const { getDefaultLeague, getDefaultOthers, getDefaultOfficials, getDefaultZones } = require("./defaultState");

const MAX_TEAMS = 30;
const MAX_ZONES = 8;
const MAX_GAMES = 12;
const NUM_KEYS = ["pts", "j", "v", "e", "d", "gp", "gc"];
const OFFICIAL_KEYS = ["main", "ass1", "ass2", "fourth", "var", "avar1", "avar2"];

const str = (v, n) => String(v == null ? "" : v).slice(0, n);
const uid = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
/** Sem acento, minúsculo, só letras e números — para comparar nomes de times. */
const norm = (v) => String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
/** Número inteiro >= 0, ou null se vazio/inválido. */
function intOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 0 && n < 10000 ? n : null;
}
const hexOr = (v, d) => (/^#[0-9a-fA-F]{6}$/.test(String(v || "")) ? String(v) : d);

/** Procura, no cadastro de Times, o time deste nome/sigla (mesma regra da tabela: ver public/js/standings-core.js). */
function autoLink(name, short) {
  let teams = [];
  try { teams = teamsStore.listTeams(); } catch (_) { return null; }
  const m = Standings.matchTeam(name, short, teams);
  return m.team ? m.team.id : null;
}
const makeShort = (name) => String(name || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();

/* ---------- normalização (estados antigos e dados vindos do cliente) ---------- */
function normalizeRow(r, i) {
  const row = {
    id: str(r && r.id, 40) || uid("c"),
    name: str(r && r.name, 40),
    short: str(r && r.short, 5).toUpperCase(),
    teamId: r && r.teamId ? teamsStore.sanitizeId(r.teamId) || null : null,
  };
  for (const k of NUM_KEYS) row[k] = k === "pts" ? (intOrNull(r && r[k]) ?? 0) : intOrNull(r && r[k]);
  if (!row.short) row.short = makeShort(row.name);
  return row;
}
function normalizeZone(z) {
  let from = Math.max(1, Math.min(99, Math.floor(Number(z && z.from)) || 1));
  let to = Math.max(1, Math.min(99, Math.floor(Number(z && z.to)) || from));
  if (to < from) [from, to] = [to, from];
  return { id: str(z && z.id, 40) || uid("z"), label: str(z && z.label, 40), from, to, color: hexOr(z && z.color, "#64748b"), enabled: !(z && z.enabled === false) };
}
function normalizeLeague(raw) {
  const d = getDefaultLeague();
  const l = raw && typeof raw === "object" ? raw : {};
  const teams = Array.isArray(l.teams) && l.teams.length ? l.teams.slice(0, MAX_TEAMS).map(normalizeRow) : d.teams;
  const seen = new Set();
  teams.forEach((t) => { while (seen.has(t.id)) t.id = uid("c"); seen.add(t.id); });
  const zones = Array.isArray(l.zones) ? l.zones.slice(0, MAX_ZONES).map(normalizeZone) : getDefaultZones();
  return {
    name: l.name !== undefined ? str(l.name, 60) : d.name,
    round: str(l.round, 12),
    visible: !!l.visible,
    mode: l.mode === "complete" ? "complete" : "compact",
    liveProjection: l.liveProjection !== false,
    includeMain: l.includeMain !== false,
    teams,
    zones,
    lastCommit: l.lastCommit && Array.isArray(l.lastCommit.teams) ? { teams: l.lastCommit.teams.map(normalizeRow), game: l.lastCommit.game || null, label: str(l.lastCommit.label, 80) } : null,
  };
}
function normalizeGame(g) {
  return {
    id: str(g && g.id, 40) || uid("g"),
    homeId: str(g && g.homeId, 40), awayId: str(g && g.awayId, 40),
    homeScore: intOrNull(g && g.homeScore) ?? 0, awayScore: intOrNull(g && g.awayScore) ?? 0,
    status: ["live", "scheduled", "finished"].includes(g && g.status) ? g.status : "live",
    minute: str(g && g.minute, 12),
    round: str(g && g.round, 12),
    onAir: !(g && g.onAir === false),
  };
}
function normalizeOthers(raw) {
  const o = raw && typeof raw === "object" ? raw : {};
  return { visible: !!o.visible, games: Array.isArray(o.games) ? o.games.slice(0, MAX_GAMES).map(normalizeGame) : [] };
}
function normalizeOfficials(raw) {
  const d = getDefaultOfficials();
  const o = raw && typeof raw === "object" ? raw : {};
  const out = { refVisible: !!o.refVisible, varVisible: !!o.varVisible };
  for (const k of OFFICIAL_KEYS) out[k] = { name: str(o[k] && o[k].name, 60), from: str(o[k] && o[k].from, 30) };
  return { ...d, ...out };
}

/** Soma um resultado (gols pró/contra) numa linha da tabela. Campos vazios (null) continuam vazios. */
function applyResult(row, gf, ga) {
  const win = gf > ga, draw = gf === ga;
  row.pts = (row.pts || 0) + (win ? 3 : draw ? 1 : 0);
  const inc = (k, by) => { if (row[k] !== null && row[k] !== undefined) row[k] += by; };
  inc("j", 1);
  inc(win ? "v" : draw ? "e" : "d", 1);
  inc("gp", gf); inc("gc", ga);
}

/** Lê uma linha colada ("Flamengo 55 25 16 7 2 ..." ou separada por tab, ; ou ,) → { name, nums[] } */
function parseLine(line) {
  const text = String(line || "").trim();
  if (!text) return null;
  const parts = text.split(/[\t;]+/).map((x) => x.trim()).filter(Boolean);
  let name, nums;
  if (parts.length > 1) {
    if (parts.length > 2 && /^\d+$/.test(parts[0]) && /\D/.test(parts[1])) parts.shift(); // "1<tab>Flamengo<tab>55": ignora a posição
    name = parts[0];
    nums = parts.slice(1).join(" ").split(/[\s,]+/);
  } else {
    const m = text.match(/^(.*?[^\d\s,.\-])[\s,]+((?:-?\d+[\s,]*)+)$/);
    if (!m) return null;
    name = m[1]; nums = m[2].trim().split(/[\s,]+/);
  }
  name = name.replace(/^\d+[.º°)\-\s]+(?=\D)/, "").trim(); // tira "1. " / "1º " do começo
  const vals = nums.map((n) => intOrNull(n)).filter((n) => n !== null);
  if (!name || !vals.length) return null;
  return { name: name.slice(0, 40), nums: vals };
}

/* ---------- eventos do socket ---------- */
function register(socket, { S, commit, io }) {
  const L = () => S().league;
  const rowById = (id) => L().teams.find((t) => t.id === id);

  /* ===== Classificação ===== */
  socket.on("league:setMeta", (d = {}) => {
    if (typeof d !== "object") return;
    const l = L();
    if ("name" in d) l.name = str(d.name, 60);
    if ("round" in d) l.round = str(d.round, 12);
    if ("liveProjection" in d) l.liveProjection = !!d.liveProjection;
    if ("includeMain" in d) l.includeMain = !!d.includeMain;
    commit();
  });
  socket.on("league:setVisible", (v) => { L().visible = !!v; commit(); });
  socket.on("league:setMode", (m) => { L().mode = m === "complete" ? "complete" : "compact"; commit(); });

  socket.on("league:setRow", ({ id, patch } = {}) => {
    const row = rowById(id);
    if (!row || !patch || typeof patch !== "object") return;
    if ("name" in patch) {
      row.name = str(patch.name, 40);
      if (!("short" in patch) && !row.short) row.short = makeShort(row.name);
      if (!("teamId" in patch)) row.teamId = autoLink(row.name, row.short);
    }
    if ("short" in patch) row.short = str(patch.short, 5).toUpperCase() || makeShort(row.name);
    if ("teamId" in patch) row.teamId = patch.teamId ? teamsStore.sanitizeId(patch.teamId) || null : null;
    for (const k of NUM_KEYS) if (k in patch) row[k] = k === "pts" ? (intOrNull(patch[k]) ?? 0) : intOrNull(patch[k]);
    commit();
  });
  socket.on("league:addRow", (d = {}) => {
    if (L().teams.length >= MAX_TEAMS) return;
    const name = str(d && d.name, 40);
    L().teams.push(normalizeRow({ name, teamId: autoLink(name) }));
    commit();
  });
  socket.on("league:removeRow", (id) => {
    const l = L();
    if (l.teams.length <= 2) return;
    l.teams = l.teams.filter((t) => t.id !== id);
    S().others.games = S().others.games.filter((g) => g.homeId !== id && g.awayId !== id);
    commit();
  });
  socket.on("league:moveRow", ({ id, dir } = {}) => {
    const t = L().teams, i = t.findIndex((x) => x.id === id), j = i + (Number(dir) < 0 ? -1 : 1);
    if (i < 0 || j < 0 || j >= t.length) return;
    [t[i], t[j]] = [t[j], t[i]];
    commit();
  });
  // grava a ordem por pontos (desempate: vitórias, saldo, gols pró, ordem atual)
  socket.on("league:sortByPoints", () => {
    const sg = (r) => (r.gp !== null && r.gc !== null ? r.gp - r.gc : 0);
    const keyed = L().teams.map((r, i) => ({ r, i }));
    keyed.sort((a, b) => b.r.pts - a.r.pts || (b.r.v || 0) - (a.r.v || 0) || sg(b.r) - sg(a.r) || (b.r.gp || 0) - (a.r.gp || 0) || a.i - b.i);
    L().teams = keyed.map((x) => x.r);
    commit();
  });
  // cola uma lista: atualiza quem já existe (pelo nome) e acrescenta o que for novo
  socket.on("league:bulk", ({ text, replace } = {}, ack) => {
    const lines = String(text || "").split(/\r?\n/).slice(0, 60).map(parseLine).filter(Boolean);
    if (!lines.length) { if (typeof ack === "function") ack({ ok: false, error: "Não entendi a lista. Use uma linha por time, por exemplo: Flamengo 55" }); return; }
    const l = L();
    const orderNames = [];
    let updated = 0, added = 0;
    for (const { name, nums } of lines) {
      const n = norm(name);
      let row = l.teams.find((t) => norm(t.name) === n || (t.short && norm(t.short) === n));
      if (!row) {
        if (l.teams.length >= MAX_TEAMS) continue;
        row = normalizeRow({ name, teamId: autoLink(name) });
        l.teams.push(row); added++;
      } else updated++;
      // 1 número = pontos; 2 = pontos e jogos; 7+ = pontos, J, V, E, D, GP, GC (na ordem desta mesma lista)
      NUM_KEYS.forEach((k, i) => { if (nums[i] !== undefined) row[k] = nums[i]; });
      orderNames.push(row.id);
    }
    if (replace) {
      const keep = new Set(orderNames);
      l.teams = orderNames.map((id) => l.teams.find((t) => t.id === id)).filter(Boolean);
      S().others.games = S().others.games.filter((g) => keep.has(g.homeId) && keep.has(g.awayId));
    }
    commit();
    if (typeof ack === "function") ack({ ok: true, updated, added });
  });
  socket.on("league:resetPoints", () => {
    for (const t of L().teams) for (const k of NUM_KEYS) t[k] = k === "pts" ? 0 : null;
    commit();
  });
  socket.on("league:resetAll", () => { const keep = { visible: L().visible, mode: L().mode }; S().league = { ...getDefaultLeague(), ...keep }; S().others.games = []; commit(); });

  /* ----- faixas ----- */
  socket.on("league:setZone", ({ id, patch } = {}) => {
    const i = L().zones.findIndex((z) => z.id === id);
    if (i < 0 || !patch || typeof patch !== "object") return;
    L().zones[i] = normalizeZone({ ...L().zones[i], ...patch });
    commit();
  });
  socket.on("league:addZone", () => {
    if (L().zones.length >= MAX_ZONES) return;
    const last = L().zones.reduce((m, z) => Math.max(m, z.to), 0);
    L().zones.push(normalizeZone({ label: "Nova faixa", from: Math.min(99, last + 1), to: Math.min(99, last + 1), color: "#a855f7" }));
    commit();
  });
  socket.on("league:removeZone", (id) => { L().zones = L().zones.filter((z) => z.id !== id); commit(); });
  socket.on("league:resetZones", () => { L().zones = getDefaultZones(); commit(); });

  /* ===== Outros jogos ===== */
  const O = () => S().others;
  const gameById = (id) => O().games.find((g) => g.id === id);
  const validRow = (id) => (id && rowById(id) ? id : "");

  socket.on("others:setVisible", (v) => { O().visible = !!v; commit(); });
  socket.on("others:addGame", (d = {}) => {
    if (O().games.length >= MAX_GAMES) return;
    O().games.push(normalizeGame({ homeId: validRow(d && d.homeId), awayId: validRow(d && d.awayId), round: d && d.round, status: "live" }));
    commit();
  });
  socket.on("others:updateGame", ({ id, patch } = {}) => {
    const g = gameById(id);
    if (!g || !patch || typeof patch !== "object") return;
    if ("homeId" in patch) g.homeId = validRow(patch.homeId);
    if ("awayId" in patch) g.awayId = validRow(patch.awayId);
    if ("status" in patch && ["live", "scheduled", "finished"].includes(patch.status)) g.status = patch.status;
    if ("minute" in patch) g.minute = str(patch.minute, 12);
    if ("round" in patch) g.round = str(patch.round, 12);
    if ("onAir" in patch) g.onAir = !!patch.onAir;
    if ("homeScore" in patch) g.homeScore = intOrNull(patch.homeScore) ?? 0;
    if ("awayScore" in patch) g.awayScore = intOrNull(patch.awayScore) ?? 0;
    commit();
  });
  // +1 / −1 no placar de um jogo; ao aumentar, avisa a arte (aviso automático de gol, se ligado)
  socket.on("others:score", ({ id, side, delta } = {}) => {
    const g = gameById(id);
    if (!g) return;
    const key = side === "away" ? "awayScore" : "homeScore";
    const d = Number(delta) < 0 ? -1 : 1;
    const next = Math.max(0, g[key] + d);
    if (next === g[key]) return;
    g[key] = next;
    if (g.status === "scheduled") g.status = "live";
    commit();
    if (d > 0) io.emit("others:goal", { id: g.id, side: side === "away" ? "away" : "home" });
  });
  socket.on("others:removeGame", (id) => { O().games = O().games.filter((g) => g.id !== id); commit(); });
  socket.on("others:clear", () => { O().games = []; commit(); });
  // "Lançar na tabela": grava o resultado nos pontos base dos dois times e tira o jogo da lista
  socket.on("others:commitGame", (id, ack) => {
    const g = gameById(id);
    const h = g && rowById(g.homeId), a = g && rowById(g.awayId);
    if (!g || (!h && !a)) { if (typeof ack === "function") ack({ ok: false, error: "Escolha os times do jogo antes de lançar." }); return; }
    L().lastCommit = { teams: JSON.parse(JSON.stringify(L().teams)), game: JSON.parse(JSON.stringify(g)), label: `${h ? h.name : "?"} ${g.homeScore} × ${g.awayScore} ${a ? a.name : "?"}` };
    if (h) applyResult(h, g.homeScore, g.awayScore);
    if (a) applyResult(a, g.awayScore, g.homeScore);
    O().games = O().games.filter((x) => x.id !== id);
    commit();
    if (typeof ack === "function") ack({ ok: true });
  });
  socket.on("league:undoCommit", () => {
    const lc = L().lastCommit;
    if (!lc) return;
    L().teams = lc.teams.map(normalizeRow);
    if (lc.game && O().games.length < MAX_GAMES) O().games.push(normalizeGame(lc.game));
    L().lastCommit = null;
    commit();
  });

  /* ===== Arbitragem ===== */
  socket.on("officials:set", ({ key, name, from } = {}) => {
    if (!OFFICIAL_KEYS.includes(key)) return;
    const o = S().officials;
    if (!o[key]) o[key] = { name: "", from: "" };
    if (name !== undefined) o[key].name = str(name, 60);
    if (from !== undefined) o[key].from = str(from, 30);
    commit();
  });
  socket.on("officials:setVisible", ({ which, visible } = {}) => {
    const o = S().officials;
    if (which === "ref") o.refVisible = !!visible;
    else if (which === "var") o.varVisible = !!visible;
    else return;
    commit();
  });
  socket.on("officials:clear", () => { const v = { refVisible: S().officials.refVisible, varVisible: S().officials.varVisible }; S().officials = { ...getDefaultOfficials(), ...v }; commit(); });
}

module.exports = { register, normalizeLeague, normalizeOthers, normalizeOfficials, norm, applyResult, parseLine };
