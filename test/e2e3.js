// Login: painel protegido, artes públicas.
const { chromium } = require("playwright");
const BASE = process.env.BASE || "http://localhost:8099/placar-app-v1.1/";
let fails = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHOU ") + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1200, height: 800 } });
  await require("./mock-db-node").attach(ctx);
  const errs = []; const watch = (p, n) => { p.on("pageerror", (e) => errs.push(n + ": " + e.message)); p.on("console", (m) => m.type() === "error" && !/Failed to load|net::ERR/.test(m.text()) && errs.push(n + ": " + m.text())); };
  const p = await ctx.newPage(); watch(p, "painel"); await p.goto(BASE); await p.waitForSelector("#loginGate form:not([hidden])");
  ok(await p.evaluate(() => getComputedStyle(document.querySelector("#loginGate")).display !== "none" && document.querySelector("#content").offsetWidth === 0), "sem login: tela de login aparece e o painel fica oculto");
  ok(await p.evaluate(() => typeof App === "undefined" || !App.state), "sem login: o motor não iniciou (nada lido nem gravado)");
  await p.fill("#lgEmail", "eric@teste.com"); await p.fill("#lgPass", "errada"); await p.click("#loginGate button[type=submit]");
  await p.waitForSelector(".lg-err:not([hidden])"); ok(/incorretos/.test(await p.textContent(".lg-err")), "senha errada: " + (await p.textContent(".lg-err")));
  await p.fill("#lgPass", "senha123"); await p.click("#loginGate button[type=submit]");
  await p.waitForFunction(() => typeof App !== "undefined" && App.state, null, { timeout: 8000 });
  ok(await p.evaluate(() => getComputedStyle(document.querySelector("#loginGate")).display === "none" && document.querySelector("#content").offsetWidth > 0), "senha certa: painel abre");
  const denied = await p.evaluate(() => window.__mockDenied); ok(denied === 0, "nenhuma gravação negada pelas regras (" + denied + ")");
  // sessão salva
  await p.reload(); await p.waitForFunction(() => typeof App !== "undefined" && App.state, null, { timeout: 8000 });
  ok(await p.evaluate(() => document.querySelector("#loginGate").offsetParent === null), "recarregar a página: continua logado (sessão salva)");
  ok((await p.textContent("#accountEmail")) === "eric@teste.com", "Configurações mostra a conta");
  // artes públicas
  const a = await ctx.newPage(); watch(a, "arte"); await a.evaluate(() => localStorage.removeItem("__mockuser")).catch(() => {});
  await a.goto(BASE + "arte/placar/"); await a.waitForTimeout(1200);
  ok(await a.evaluate(() => !document.querySelector("#loginGate") && document.body.innerText.length > 0), "arte abre sem login e lê o banco");
  // sair
  await p.evaluate(() => App.go("config")); await p.click("#logoutBtn"); await p.click("#confirmOk");
  await p.waitForSelector("#loginGate form:not([hidden])", { timeout: 6000 }); ok(true, "Sair devolve à tela de login");
  // sem usuário, gravação do painel seria negada: simulamos tentativa
  const d = await ctx.newPage(); watch(d, "semlogin"); await d.goto(BASE + "arte/placar/"); await d.evaluate(() => localStorage.removeItem("__mockuser")); 
  const den = await d.evaluate(async () => { try { await PLACAR_DB.ref("placar/x").set(1); return false; } catch (e) { return e.code; } });
  ok(den === "PERMISSION_DENIED", "sem login não grava no banco (regras simuladas): " + den);
  console.log("erros:", errs); ok(errs.length === 0, "sem erros de JavaScript");
  await b.close(); console.log(fails ? `\n${fails} FALHA(S)` : "\nTUDO OK"); process.exit(fails ? 1 : 0);
})();
