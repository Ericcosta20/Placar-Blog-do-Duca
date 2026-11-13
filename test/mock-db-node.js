// Lado Node do Firebase simulado: guarda o "banco" num só lugar (operações atômicas, como no Firebase real).
const fs = require("fs"), path = require("path");
exports.MOCK = fs.readFileSync(path.join(__dirname, "mock-firebase.js"), "utf8");
exports.attach = async (ctx) => {
  const db = {};
  const getAt = (p) => p.split("/").filter(Boolean).reduce((a, k) => (a == null ? undefined : a[k]), db);
  const setAt = (p, v) => {
    const keys = p.split("/").filter(Boolean); let t = db;
    for (let i = 0; i < keys.length - 1; i++) { if (typeof t[keys[i]] !== "object" || t[keys[i]] === null) t[keys[i]] = {}; t = t[keys[i]]; }
    if (v === null || v === undefined) delete t[keys[keys.length - 1]]; else t[keys[keys.length - 1]] = v;
  };
  await ctx.exposeFunction("__dbGet", (p) => { const v = getAt(p); return v === undefined ? null : JSON.parse(JSON.stringify(v)); });
  await ctx.exposeFunction("__dbApply", (ops) => { ops.forEach(([p, v]) => setAt(p, v)); return true; });
  await ctx.exposeFunction("__dbDump", () => JSON.parse(JSON.stringify(db)));
  await ctx.route("https://www.gstatic.com/firebasejs/**", (r) => { const u = r.request().url(); r.fulfill({ contentType: "application/javascript", body: u.includes("app-compat") ? exports.MOCK : u.includes("auth-compat") ? "firebase.auth=()=>window.__mockAuth;" : "" }); });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  return { dump: (page) => page.evaluate(() => window.__dbDump()) };
};
