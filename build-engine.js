// Gera js/engine.js (o motor que roda no navegador) a partir de engine-src/.
// Só precisa rodar de novo se você mexer em engine-src/. Uso:  npm install  &&  npm run build
const esbuild = require("esbuild");
const path = require("path");
const root = __dirname;
esbuild.build({
  entryPoints: [path.join(root, "engine-src", "entry.js")],
  bundle: true, format: "iife", platform: "browser", target: ["es2019"],
  outfile: path.join(root, "js", "engine.js"),
  alias: {
    fs: path.join(root, "engine-src", "shims", "fs.js"),
    path: path.join(root, "engine-src", "shims", "path.js"),
    pdfkit: path.join(root, "engine-src", "shims", "pdfkit.js"),
  },
  define: { __dirname: '"/app/server"', "process.env.NODE_ENV": '"production"' },
  banner: { js: "/* Placar App 1.1 — motor (gerado por build-engine.js a partir de engine-src/). Não edite este arquivo. */" },
  logLevel: "info",
}).catch(() => process.exit(1));
