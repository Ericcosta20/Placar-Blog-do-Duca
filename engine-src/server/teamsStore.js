/**
 * CADASTRO DE TIMES — cada time é um arquivo em data/teams/<id>.json
 * v4.0: ids sanitizados (nunca saem da pasta), sigla do time (shortName),
 * normalização de elenco (importação de versões antigas) e escrita atômica.
 */
const fs = require("fs");
const path = require("path");

const TEAMS_DIR = path.join(__dirname, "..", "data", "teams");

function ensureTeamsDir() {
  if (!fs.existsSync(TEAMS_DIR)) fs.mkdirSync(TEAMS_DIR, { recursive: true });
}

function slugify(name) {
  return (
    (name || "time")
      .toString()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "time"
  );
}

/** Garante que o id só tenha [a-z0-9_-] — impede caminhos como ../../x */
function sanitizeId(id) {
  return String(id == null ? "" : id)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function defaultTeam(id, name) {
  return {
    id,
    name: name || "",
    shortName: "", // v4.0 — sigla usada na Linha do Tempo (vazio = 3 primeiras letras do nome)
    crestDataUrl: "",
    captainSymbol: "(C)",
    primaryColor: "#0057ff",
    secondaryColor: "#ffffff",
    textColor: "#f5f6f8",
    numberColor: "#ffffff",
    bgColor: "#0c0f14",
    dividerColor: "#ffffff",
    captainColor: "#ffd700",
    shadowColor: "#000000",
    coach: "",
    city: "",
    players: [],
    updatedAt: Date.now(),
  };
}

function newPlayerId() {
  return "p_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
}

/**
 * Normaliza um time vindo de QUALQUER versão (2.x–4.x) ou de importação:
 * completa campos que faltam e garante que cada jogador tenha id/número/nome.
 */
function normalizeTeam(raw, forcedId) {
  const src = raw && typeof raw === "object" ? raw : {};
  const id = sanitizeId(forcedId || src.id) || null;
  const base = defaultTeam(id, src.name);
  const merged = { ...base, ...src, id };
  const seen = new Set();
  merged.players = (Array.isArray(src.players) ? src.players : [])
    .filter((p) => p && typeof p === "object")
    .map((p) => {
      let pid = p.id != null && String(p.id) !== "" ? String(p.id) : newPlayerId();
      while (seen.has(pid)) pid = newPlayerId();
      seen.add(pid);
      const num = parseInt(p.number, 10);
      return {
        ...p,
        id: pid,
        number: Number.isFinite(num) ? num : 0,
        name: String(p.name == null ? "" : p.name),
        position: String(p.position == null ? "" : p.position),
      };
    });
  merged.name = String(merged.name || "");
  // v6.2 — o escudo só pode ser uma imagem (data URL png/jpeg/webp/gif); qualquer outra coisa é descartada
  if (!/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(String(merged.crestDataUrl || ""))) merged.crestDataUrl = "";
  merged.shortName = String(merged.shortName || "");
  return merged;
}

/** Gera um id único a partir do nome, evitando colisão com arquivos existentes. */
function generateId(name) {
  ensureTeamsDir();
  const base = sanitizeId(slugify(name)) || "time";
  let id = base;
  let n = 2;
  while (fs.existsSync(path.join(TEAMS_DIR, `${id}.json`))) {
    id = `${base}-${n}`;
    n++;
  }
  return id;
}

function listTeams() {
  ensureTeamsDir();
  const files = fs.readdirSync(TEAMS_DIR).filter((f) => f.endsWith(".json"));
  const teams = [];
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(TEAMS_DIR, file), "utf-8");
      const parsed = JSON.parse(raw);
      if (!parsed.id) parsed.id = file.replace(/\.json$/, "");
      teams.push(normalizeTeam(parsed, parsed.id));
    } catch (err) {
      console.error(`[teamsStore] Falha ao ler ${file}:`, err.message);
    }
  }
  teams.sort((a, b) => (a.name || "").localeCompare(b.name || "", "pt-BR"));
  return teams;
}

function getTeam(id) {
  ensureTeamsDir();
  const safe = sanitizeId(id);
  if (!safe) return null;
  const file = path.join(TEAMS_DIR, `${safe}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (err) {
    console.error(`[teamsStore] Falha ao ler time ${safe}:`, err.message);
    return null;
  }
}

function writeAtomic(file, content) {
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}

/** Cria ou atualiza um time. Se team.id não existir, cria um novo id a partir do nome. */
function saveTeam(team) {
  ensureTeamsDir();
  let id = sanitizeId(team.id);
  if (!id) id = generateId(team.name);
  const existing = getTeam(id) || defaultTeam(id, team.name);
  const merged = normalizeTeam(
    {
      ...existing,
      ...team,
      id,
      players: Array.isArray(team.players) ? team.players : existing.players,
    },
    id
  );
  merged.updatedAt = Date.now();
  writeAtomic(path.join(TEAMS_DIR, `${id}.json`), JSON.stringify(merged, null, 2));
  return merged;
}

function deleteTeam(id) {
  ensureTeamsDir();
  const safe = sanitizeId(id);
  if (!safe) return false;
  const file = path.join(TEAMS_DIR, `${safe}.json`);
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
    return true;
  }
  return false;
}

function deleteAllTeams() {
  ensureTeamsDir();
  for (const f of fs.readdirSync(TEAMS_DIR)) {
    if (f.endsWith(".json")) fs.unlinkSync(path.join(TEAMS_DIR, f));
  }
}

module.exports = {
  TEAMS_DIR,
  listTeams,
  getTeam,
  saveTeam,
  deleteTeam,
  deleteAllTeams,
  defaultTeam,
  normalizeTeam,
  generateId,
  sanitizeId,
};
