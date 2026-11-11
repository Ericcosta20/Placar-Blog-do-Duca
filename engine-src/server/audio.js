/**
 * SONS (v5.2) — biblioteca de sons sugeridos + áudios do operador + resolução para a Browser Source /arte/audio.
 *
 *  - Sons sugeridos: public/audio/presets/<id>.mp3 (acompanham o programa).
 *  - Áudios do operador: data/audio/<arquivo> (enviados pela aba Áudio; entram nos backups só como pasta, não no JSON).
 *  - A configuração (qual som toca em cada ação, volumes, botões de soundpad) fica em
 *    customization.audio — campos simples, validados pelo mesmo settings:patch do resto.
 *  - O servidor decide QUE som tocar e manda "audio:play" para as Browser Sources de áudio.
 */
const fs = require("fs");
const path = require("path");
const { DATA_DIR } = require("./persistence");

const USER_DIR = path.join(DATA_DIR, "audio");
const EXTS = [".mp3", ".wav", ".ogg", ".m4a", ".aac", ".webm"];
const MAX_BYTES = 12 * 1024 * 1024;
const MAX_FILES = 60;

/** Sons sugeridos. "cue" = para qual ação o som foi pensado ("pad" = botão de soundpad). */
const PRESETS = [
  { id: "gol-buzina-torcida", name: "Buzina + torcida", cue: "gol", desc: "Buzina de estádio com a torcida explodindo (5 s)" },
  { id: "gol-torcida", name: "Torcida explodindo", cue: "gol", desc: "Só a torcida, com pancada de graves no início (5,5 s)" },
  { id: "gol-sino", name: "Sino de gol", cue: "gol", desc: "Sequência de sinos subindo + festa curta (3,4 s)" },
  { id: "sub-sino-duplo", name: "Sino duplo", cue: "sub", desc: "Dois toques de sino, limpo e discreto (1,7 s)" },
  { id: "sub-bip", name: "Bip de painel", cue: "sub", desc: "Bips curtos, como painel eletrônico do quarto árbitro (0,8 s)" },
  { id: "sub-passagem", name: "Passagem + toque", cue: "sub", desc: "Varredura rápida e um toque de sino (1,5 s)" },
  { id: "amarelo-apito", name: "Apito curto", cue: "yellow", desc: "Um apito seco (0,45 s)" },
  { id: "amarelo-alerta", name: "Apito + alerta", cue: "yellow", desc: "Apito e dois bips de alerta (1 s)" },
  { id: "amarelo-toque", name: "Toque seco", cue: "yellow", desc: "Dois toques secos, sem apito (0,6 s)" },
  { id: "vermelho-apito-longo", name: "Apito longo", cue: "red", desc: "Apito curto e um longo (1,7 s)" },
  { id: "vermelho-buzina-grave", name: "Buzina grave", cue: "red", desc: "Buzina grave e pesada (1,4 s)" },
  { id: "vermelho-sirene", name: "Sirene curta", cue: "red", desc: "Sirene subindo e descendo (1,5 s)" },
  { id: "anulado-buzina-descendente", name: "Buzina descendente", cue: "annul", desc: "Buzina que desce de tom, como “não valeu” (1,3 s)" },
  { id: "anulado-erro", name: "Erro (bu-bum)", cue: "annul", desc: "Dois tons graves descendo (1,3 s)" },
  { id: "anulado-apito-triplo", name: "Apito triplo", cue: "annul", desc: "Dois apitos curtos e um longo (1,3 s)" },
  { id: "buzina", name: "Buzina", cue: "pad", desc: "Buzina curta (1 s)" },
  { id: "torcida", name: "Torcida", cue: "pad", desc: "Torcida em ambiente, entra e sai suave (7 s)" },
  { id: "apito-final", name: "Apito final", cue: "pad", desc: "Dois apitos curtos e um longo (2,4 s)" },
  { id: "palmas", name: "Palmas", cue: "pad", desc: "Palmas de plateia (4 s)" },
  { id: "sirene", name: "Sirene", cue: "pad", desc: "Sirene de alerta (2,2 s)" },
  { id: "tambor", name: "Tambor", cue: "pad", desc: "Batida de bumbo e caixa (4 s)" },
  { id: "suspense", name: "Suspense", cue: "pad", desc: "Som subindo, para criar expectativa (3,2 s)" },
  { id: "vinheta", name: "Vinheta", cue: "pad", desc: "Sequência de sinos, para abrir um quadro (2,4 s)" },
];
const PRESET_IDS = new Set(PRESETS.map((p) => p.id));

/** Ações que podem tocar sozinhas. A chave é a mesma usada nos campos de customization.audio. */
const CUES = ["gol", "sub", "yellow", "red", "annul"];
const PAD_COUNT = 8;

function ensureDir() { if (!fs.existsSync(USER_DIR)) fs.mkdirSync(USER_DIR, { recursive: true }); }

/** Nome seguro de arquivo (sem pastas, sem caracteres estranhos). */
function safeFileName(name) {
  const ext = path.extname(String(name || "")).toLowerCase();
  const base = path.basename(String(name || ""), path.extname(String(name || "")))
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._ -]/g, "").replace(/\s+/g, "-").replace(/^[.-]+/, "").slice(0, 60) || "audio";
  return { base, ext };
}

function listUser() {
  ensureDir();
  return fs.readdirSync(USER_DIR)
    .filter((f) => EXTS.includes(path.extname(f).toLowerCase()))
    .map((f) => {
      const st = fs.statSync(path.join(USER_DIR, f));
      return { file: f, name: path.basename(f, path.extname(f)).replace(/-/g, " "), size: st.size, addedAt: st.mtimeMs };
    })
    .sort((a, b) => b.addedAt - a.addedAt);
}

function saveUser(originalName, buffer) {
  const { base, ext } = safeFileName(originalName);
  if (!EXTS.includes(ext)) throw new Error("Formato não aceito. Use .mp3, .wav, .ogg, .m4a, .aac ou .webm.");
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new Error("Arquivo vazio.");
  if (buffer.length > MAX_BYTES) throw new Error(`Arquivo grande demais (máximo ${Math.round(MAX_BYTES / 1048576)} MB).`);
  if (listUser().length >= MAX_FILES) throw new Error(`Limite de ${MAX_FILES} áudios. Apague algum para enviar outro.`);
  ensureDir();
  let file = base + ext, n = 2;
  while (fs.existsSync(path.join(USER_DIR, file))) file = `${base}-${n++}${ext}`;
  fs.writeFileSync(path.join(USER_DIR, file), buffer);
  return file;
}

function deleteUser(file) {
  const f = path.basename(String(file || ""));
  const p = path.join(USER_DIR, f);
  if (!EXTS.includes(path.extname(f).toLowerCase()) || !fs.existsSync(p)) throw new Error("Áudio não encontrado.");
  fs.unlinkSync(p);
  return f;
}

/** "preset:<id>" | "user:<arquivo>" | "" -> URL tocável (ou null se não existir mais). */
function resolveUrl(src) {
  const s = String(src || "");
  if (s.startsWith("preset:")) {
    const id = s.slice(7);
    return PRESET_IDS.has(id) ? `/audio/presets/${id}.mp3` : null;
  }
  if (s.startsWith("user:")) {
    const f = path.basename(s.slice(5));
    return fs.existsSync(path.join(USER_DIR, f)) ? `/audio/user/${encodeURIComponent(f)}` : null;
  }
  return null;
}

const clamp01 = (n) => Math.max(0, Math.min(1, n));
/** Monta o pedido de reprodução para uma ação ("gol"...) ou para um botão ("pad3"). */
function buildPlay(audio, key, { force = false } = {}) {
  if (!audio) return null;
  let src, vol, label;
  const m = /^pad(\d+)$/.exec(key);
  if (m) {
    const i = Number(m[1]);
    if (i < 1 || i > PAD_COUNT) return null;
    src = audio[`pad${i}Src`]; vol = audio[`pad${i}Vol`]; label = audio[`pad${i}Label`] || `Botão ${i}`;
  } else if (CUES.includes(key)) {
    if (!force && (!audio.autoEnabled || !audio[`${key}On`])) return null;
    src = audio[`${key}Src`]; vol = audio[`${key}Vol`]; label = key;
  } else return null;
  const url = resolveUrl(src);
  if (!url) return null;
  const volume = clamp01((Number(audio.masterVolume) / 100) * (Number(vol) / 100));
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, key, url, volume, label };
}

/** Lista de URLs que a fonte de áudio deve pré-carregar (para tocar sem atraso). */
function activeUrls(audio) {
  const urls = new Set();
  if (!audio) return [];
  CUES.forEach((c) => { const u = resolveUrl(audio[`${c}Src`]); if (u) urls.add(u); });
  for (let i = 1; i <= PAD_COUNT; i++) { const u = resolveUrl(audio[`pad${i}Src`]); if (u) urls.add(u); }
  return [...urls];
}

/** Se um áudio do operador foi apagado, limpa as ações/botões que o usavam. Devolve true se mudou algo. */
function clearReferences(audio, file) {
  if (!audio) return false;
  const ref = `user:${file}`;
  let changed = false;
  for (const k of Object.keys(audio)) {
    if (/Src$/.test(k) && audio[k] === ref) { audio[k] = ""; changed = true; }
  }
  return changed;
}

module.exports = { USER_DIR, PRESETS, CUES, PAD_COUNT, listUser, saveUser, deleteUser, resolveUrl, buildPlay, activeUrls, clearReferences, ensureDir };
