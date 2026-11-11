// Mínimo do módulo "path" (estilo POSIX) para rodar o motor no navegador.
function normalize(p) {
  const abs = p.startsWith("/");
  const out = [];
  for (const seg of p.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") out.pop(); else out.push(seg);
  }
  return (abs ? "/" : "") + out.join("/");
}
const join = (...a) => normalize(a.filter(Boolean).join("/")) || ".";
const resolve = (...a) => { let r = ""; for (const x of a) r = x.startsWith("/") ? x : r + "/" + x; return normalize(r) || "/"; };
const basename = (p, ext) => { let b = p.split("/").filter(Boolean).pop() || ""; if (ext && b.endsWith(ext)) b = b.slice(0, -ext.length); return b; };
const extname = (p) => { const b = basename(p); const i = b.lastIndexOf("."); return i > 0 ? b.slice(i) : ""; };
const dirname = (p) => { const parts = p.split("/"); parts.pop(); return parts.join("/") || "/"; };
module.exports = { join, resolve, basename, extname, dirname, sep: "/", normalize };
