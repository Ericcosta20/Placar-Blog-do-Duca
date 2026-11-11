// "Disco" em memória: o motor (copiado do servidor) continua lendo/gravando arquivos como antes,
// mas aqui eles vivem na memória da página. Quem guarda de verdade é o Firebase (ver entry.js).
const path = require("./path");
const files = new Map();   // caminho -> string
const dirs = new Set(["/"]);
const err = (code, p) => Object.assign(new Error(`${code}: ${p}`), { code });
const n = (p) => path.resolve(String(p));

exports.existsSync = (p) => files.has(n(p)) || dirs.has(n(p));
exports.mkdirSync = (p) => { let cur = ""; for (const s of n(p).split("/").filter(Boolean)) { cur += "/" + s; dirs.add(cur); } };
exports.readFileSync = (p, enc) => { const v = files.get(n(p)); if (v === undefined) throw err("ENOENT", p); return v; };
exports.writeFileSync = (p, data) => { files.set(n(p), typeof data === "string" ? data : String(data)); };
exports.writeFile = (p, data, cb) => { try { exports.writeFileSync(p, data); cb && cb(null); } catch (e) { cb && cb(e); } };
exports.renameSync = (a, b) => { const v = files.get(n(a)); if (v === undefined) throw err("ENOENT", a); files.delete(n(a)); files.set(n(b), v); };
exports.rename = (a, b, cb) => { try { exports.renameSync(a, b); cb && cb(null); } catch (e) { cb && cb(e); } };
exports.copyFileSync = (a, b) => { const v = files.get(n(a)); if (v === undefined) throw err("ENOENT", a); files.set(n(b), v); };
exports.unlinkSync = (p) => { if (!files.delete(n(p))) throw err("ENOENT", p); };
exports.readdirSync = (p) => {
  const base = n(p) === "/" ? "/" : n(p) + "/";
  const out = new Set();
  for (const f of files.keys()) if (f.startsWith(base)) out.add(f.slice(base.length).split("/")[0]);
  return [...out];
};
exports.statSync = (p) => { const v = files.get(n(p)); if (v === undefined) throw err("ENOENT", p); return { size: v.length, isFile: () => true }; };
// usado só pela entrada (entry.js) para carregar/limpar o conteúdo
exports.__files = files;
