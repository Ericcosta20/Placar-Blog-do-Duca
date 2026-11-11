/**
 * ESTÁDIO (v6.1) — informações do estádio + fotos (slide) para a fonte /arte/informativos e para o resumo.
 * ---------------------------------------------------------------
 * - Tudo é opcional: o cartão mostra só o que estiver preenchido.
 * - As fotos ficam em data/stadium/<arquivo> (o painel reduz para JPEG até 1600 px antes de enviar) e a lista
 *   (ordem, nome) fica em state.stadium.photos. A primeira foto é a que vai para o resumo.
 * - Eventos: stadium:set / setVisible / addPhoto / removePhoto / movePhoto / clear.
 */
const fs = require("fs");
const path = require("path");
const DATA_DIR = path.join(__dirname, "..", "data"); // (igual ao de persistence.js; não importa de lá para evitar dependência circular)

const DIR = path.join(DATA_DIR, "stadium");
const MAX_PHOTOS = 8;
const MAX_BYTES = 9 * 1024 * 1024;
const FIELDS = {
  name: 70, nickname: 50, location: 90, owner: 70, capacity: 20, inauguration: 30,
  record: 60, surface: 40, dimensions: 20, attendance: 20,
};

const str = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
const uid = () => "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function getDefaultStadium() {
  const s = { visible: false, photos: [] };
  Object.keys(FIELDS).forEach((k) => { s[k] = ""; });
  return s;
}
function ensureDir() { fs.mkdirSync(DIR, { recursive: true }); }

function normalizeStadium(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const out = getDefaultStadium();
  out.visible = !!r.visible;
  Object.keys(FIELDS).forEach((k) => { out[k] = str(r[k], FIELDS[k]); });
  out.photos = (Array.isArray(r.photos) ? r.photos : []).slice(0, MAX_PHOTOS).map((p) => ({
    id: str(p && p.id, 20) || uid(),
    file: path.basename(str(p && p.file, 80)),
    name: str(p && p.name, 60),
  })).filter((p) => /\.(jpe?g|png)$/i.test(p.file));
  return out;
}

/** Grava a foto enviada pelo painel e devolve o nome do arquivo. */
function savePhoto(buffer, contentType) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error("Arquivo vazio.");
  if (buffer.length > MAX_BYTES) throw new Error(`Foto grande demais (máximo ${Math.round(MAX_BYTES / 1048576)} MB).`);
  const isPng = buffer.slice(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const isJpg = buffer[0] === 0xff && buffer[1] === 0xd8;
  if (!isPng && !isJpg) throw new Error("Use uma foto JPG ou PNG.");
  ensureDir();
  const file = `${uid()}${isPng ? ".png" : ".jpg"}`;
  fs.writeFileSync(path.join(DIR, file), buffer);
  return file;
}
function photoPath(file) {
  const f = path.basename(String(file || ""));
  const p = path.join(DIR, f);
  return /\.(jpe?g|png)$/i.test(f) && fs.existsSync(p) ? p : null;
}
function deleteFile(file) {
  const p = photoPath(file);
  if (p) { try { fs.unlinkSync(p); } catch (_) { /* já sumiu */ } }
}
/** Apaga do disco as fotos que não estão mais em nenhuma lista (limpeza ao remover). */
function pruneUnused(state) {
  try {
    ensureDir();
    const keep = new Set(state.stadium.photos.map((p) => p.file));
    fs.readdirSync(DIR).forEach((f) => { if (!keep.has(f) && /\.(jpe?g|png)$/i.test(f)) deleteFile(f); });
  } catch (_) { /* melhor esforço */ }
}

function register(socket, { S, commit }) {
  const D = () => S().stadium;
  socket.on("stadium:set", (patch = {}) => {
    if (!patch || typeof patch !== "object") return;
    const d = D();
    Object.keys(FIELDS).forEach((k) => { if (k in patch) d[k] = str(patch[k], FIELDS[k]); });
    commit();
  });
  socket.on("stadium:setVisible", (v) => { D().visible = !!v; commit(); });
  socket.on("stadium:addPhoto", ({ file, name } = {}) => {
    const d = D();
    if (d.photos.length >= MAX_PHOTOS || !photoPath(file)) return;
    d.photos.push({ id: uid(), file: path.basename(file), name: str(name, 60) });
    commit();
  });
  socket.on("stadium:removePhoto", (id) => {
    const d = D();
    const p = d.photos.find((x) => x.id === id);
    if (!p) return;
    d.photos = d.photos.filter((x) => x.id !== id);
    commit();
    // o arquivo só é apagado do disco quando nada mais usa (ex.: o "desfazer" ainda pode trazer a foto de volta: mantém por ora)
  });
  socket.on("stadium:movePhoto", ({ id, dir } = {}) => {
    const a = D().photos, i = a.findIndex((x) => x.id === id), j = i + (Number(dir) < 0 ? -1 : 1);
    if (i < 0 || j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    commit();
  });
  socket.on("stadium:clear", () => { const v = D().visible; S().stadium = { ...getDefaultStadium(), visible: v }; commit(); });
}

module.exports = { DIR, FIELDS, MAX_PHOTOS, getDefaultStadium, normalizeStadium, savePhoto, photoPath, deleteFile, pruneUnused, ensureDir, register };
