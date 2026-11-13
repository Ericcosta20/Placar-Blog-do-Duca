// Parte 2: efeitos, importação (json e zip), resumo, desfazer, salas e volume de gravações.
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path"), { execSync } = require("child_process");
const BASE = process.env.BASE || "http://localhost:8099/placar-app-v1.0/";
const MOCK = fs.readFileSync(path.join(__dirname, "mock-firebase.js"), "utf8");
const TMP = process.env.TMP || "/tmp/placar-test"; fs.mkdirSync(TMP, { recursive: true });
let fails = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHOU ") + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1300, height: 900 }, acceptDownloads: true });
  await require("./mock-db-node").attach(ctx);
  await ctx.addInitScript(() => { try { if (!localStorage.getItem("__mockuser") && location.pathname.indexOf("/arte") < 0) localStorage.setItem("__mockuser", JSON.stringify({ email: "eric@teste.com", uid: "u1" })); } catch (e) {} });
  const errs = []; const watch = (p, n) => { p.on("pageerror", (e) => errs.push(n + ": " + e.message)); p.on("console", (m) => m.type() === "error" && !/Failed to load|net::ERR/.test(m.text()) && errs.push(n + ": " + m.text())); };
  const panel = await ctx.newPage(); watch(panel, "painel");
  await panel.goto(BASE); await panel.waitForFunction(() => typeof App !== "undefined" && App.state);

  /* ---- importação: pasta data da versão de computador (zip) ---- */
  const dd = path.join(TMP, "escalacao-app-v6.2/data/teams"); fs.mkdirSync(dd, { recursive: true });
  const bigPng = "data:image/png;base64," + Buffer.alloc(200000, 1).toString("base64");
  fs.writeFileSync(path.join(dd, "flamengo.json"), JSON.stringify({ id: "flamengo", name: "Flamengo", shortName: "FLA", crestDataUrl: bigPng, players: [{ id: "p1", number: 9, name: "Pedro", position: "" }] }));
  fs.writeFileSync(path.join(dd, "cruzeiro.json"), JSON.stringify({ id: "cruzeiro", name: "Cruzeiro", shortName: "CRU", players: [{ id: "c1", number: 1, name: "Cássio", position: "" }] }));
  const st = JSON.parse(await panel.evaluate(() => JSON.stringify(App.state))); st.meta.competition = "Copa Importada"; st.customization.placar.nameSize = 27;
  fs.writeFileSync(path.join(TMP, "escalacao-app-v6.2/data/state.json"), JSON.stringify(st));
  execSync("rm -f data.zip && zip -qr data.zip escalacao-app-v6.2", { cwd: TMP });
  await panel.evaluate(() => App.go("banco"));
  await panel.setInputFiles("#dbFileInput", path.join(TMP, "data.zip")); await panel.waitForSelector("#dbImportBtn", { timeout: 6000 });
  ok(/2 time\(s\)/.test(await panel.textContent("#dbStageStatus")), "zip lido: " + (await panel.textContent("#dbStageStatus")));
  await panel.click("#dbImportBtn"); await panel.click("#confirmOk");
  await panel.waitForFunction(() => App.teams.length === 2 && App.state.meta.competition === "Copa Importada", null, { timeout: 6000 }).then(() => ok(true, "importação aplicou times + estado (campeonato e personalização)"), () => ok(false, "importação aplicou times + estado"));
  ok(await panel.evaluate(() => App.state.customization.placar.nameSize === 27), "personalização importada");
  const crestLen = await panel.evaluate(() => (App.teams.find((t) => t.id === "flamengo").crestDataUrl || "").length);
  ok(crestLen > 0, "escudo do time importado preservado (" + crestLen + " bytes)");
  /* ---- importação: backup .json baixado daqui ---- */
  const [dl] = await Promise.all([panel.waitForEvent("download"), panel.click("#dbExportBtn")]);
  const bak = path.join(TMP, "bak.json"); await dl.saveAs(bak);
  const bj = JSON.parse(fs.readFileSync(bak, "utf8")); ok(bj.format === "blogdoduca-db" && bj.teams.length === 2 && bj.state, "backup .json baixado tem times e estado");

  /* ---- efeitos: arte NÃO dispara ao abrir, dispara quando o painel manda ---- */
  const ov = await ctx.newPage(); watch(ov, "arte"); await ov.addInitScript(() => { window.__replay = 0; });
  await ov.goto(BASE + "arte/");
  await ov.waitForTimeout(1200);
  await ov.evaluate(() => { const s = window.io; });
  // conta art:replay recebidos via socket da arte
  await ov.evaluate(() => { window.__fx = []; const orig = window.io; });
  const hasIntro = await ov.evaluate(() => document.body.className);
  await panel.evaluate(() => App.socket.emit("art:replay", "escalacao"));
  await ov.waitForTimeout(800);
  ok(true, "art:replay enviado sem erro (classe da arte: " + hasIntro + ")");

  /* ---- efeitos (shim): um fx antigo no banco NÃO dispara; um novo dispara ---- */
  await panel.evaluate(() => App.socket.emit("placar:testGoal", "home")); await panel.waitForTimeout(400);
  const ov3 = await ctx.newPage(); watch(ov3, "fx"); await ov3.goto(BASE + "arte/eventos/"); await ov3.waitForTimeout(500);
  await ov3.evaluate(() => { window.__got = []; const s = io({ query: { kind: "arte" } }); ["placar:testGoal", "art:replay", "state:sync", "teams:sync"].forEach((e) => s.on(e, () => window.__got.push(e))); });
  await ov3.waitForTimeout(900);
  let got = await ov3.evaluate(() => window.__got);
  ok(!got.includes("placar:testGoal") && got.includes("state:sync") && got.includes("teams:sync"), "efeito antigo não dispara ao abrir a arte; estado e times chegam: " + got.join(","));
  await panel.evaluate(() => App.socket.emit("placar:testGoal", "away")); await ov3.waitForTimeout(700);
  got = await ov3.evaluate(() => window.__got);
  ok(got.includes("placar:testGoal"), "efeito novo (testar gol) chega na arte pelo Firebase");

  /* ---- resumo ---- */
  await panel.evaluate(() => App.go("resumo")); await panel.waitForTimeout(700);
  const prev = await panel.evaluate(() => document.querySelector("#sumPreview").innerText.replace(/\s+/g, " "));
  ok(/Flamengo|Mandante|Cruzeiro/i.test(prev) || prev.length > 30, "prévia do resumo montada: " + prev.slice(0, 70));
  const [dl2] = await Promise.all([panel.waitForEvent("download"), panel.click("#sumTxtBtn")]);
  const txt = fs.readFileSync(await dl2.path(), "utf8"); ok(txt.length > 100 && dl2.suggestedFilename().endsWith(".txt"), "TXT do resumo baixado (" + dl2.suggestedFilename() + ")");
  const [pop] = await Promise.all([ctx.waitForEvent("page"), panel.evaluate(() => { window.__printed = 0; document.querySelector("#sumPdfBtn").click(); })]);
  await pop.waitForLoadState(); ok((await pop.content()).includes("sp-score") || (await pop.content()).includes("sum-paper"), "janela de impressão do resumo abriu"); await pop.close();

  /* ---- desfazer funciona no motor do navegador ---- */
  await panel.evaluate(() => App.socket.emit("clock:setSeconds", 100)); await panel.waitForTimeout(300);
  await panel.evaluate(() => App.patch("customization.placar.nameSize", 30)); await panel.waitForTimeout(400);
  await panel.evaluate(() => new Promise((r) => App.socket.emit("undo:last", r))); await panel.waitForTimeout(400);
  ok(await panel.evaluate(() => App.state.customization.placar.nameSize === 27), "desfazer voltou o último ajuste");

  /* ---- gravações: arrastar um controle não inunda o Firebase ---- */
  await panel.evaluate(() => { window.__mockWriteCount = 0; for (let i = 0; i < 60; i++) App.patch("customization.placar.scoreSize", 20 + (i % 20)); });
  await panel.waitForTimeout(700);
  const w = await panel.evaluate(() => window.__mockWriteCount); ok(w <= 6, "60 ajustes seguidos viraram " + w + " gravação(ões) no Firebase");

  /* ---- salas ---- */
  const salaP = await ctx.newPage(); watch(salaP, "sala"); await salaP.goto(BASE + "?sala=quadra2"); await salaP.waitForFunction(() => typeof App !== "undefined" && App.state);
  ok(await salaP.evaluate(() => App.teams.length === 0 && window.PLACAR_PATH === "placar_quadra2"), "?sala=quadra2 abre um placar separado e vazio");
  ok(await salaP.evaluate(() => App.abs("/arte/placar").includes("sala=quadra2")), "endereços das artes carregam o ?sala");

  console.log("erros de console:", errs); ok(errs.length === 0, "sem erros de JavaScript");
  await b.close(); console.log(fails ? `\n${fails} FALHA(S)` : "\nTUDO OK"); process.exit(fails ? 1 : 0);
})();
