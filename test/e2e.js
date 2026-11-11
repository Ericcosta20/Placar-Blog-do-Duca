// Teste de ponta a ponta com Firebase simulado:  node test/e2e.js  (precisa de playwright e de um servidor estático em http://localhost:8099/)
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const BASE = process.env.BASE || "http://localhost:8099/placar-app-v1.0/";
const MOCK = fs.readFileSync(path.join(__dirname, "mock-firebase.js"), "utf8");
let fails = 0;
const ok = (c, m) => { console.log((c ? "OK   " : "FALHOU ") + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1300, height: 900 } });
  await ctx.route("https://www.gstatic.com/firebasejs/**", (r) => r.fulfill({ contentType: "application/javascript", body: r.request().url().includes("app-compat") ? MOCK : "" }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const errs = []; const watch = (p, n) => { p.on("pageerror", (e) => errs.push(n + ": " + e.message)); p.on("console", (m) => m.type() === "error" && !/Failed to load|net::ERR/.test(m.text()) && errs.push(n + ": " + m.text())); };
  const panel = await ctx.newPage(); watch(panel, "painel");
  await panel.goto(BASE); await panel.waitForFunction(() => typeof App !== "undefined" && App.state, null, { timeout: 8000 });
  ok(true, "painel iniciou e recebeu o estado do motor");
  ok(await panel.evaluate(() => document.getElementById("engineBoot") === null), "tela de carregamento sumiu");
  // times
  const mk = (name, short, n) => ({ name, shortName: short, players: Array.from({ length: 14 }, (_, i) => ({ id: short + i, number: i + 1, name: name + " Jogador " + (i + 1), position: "" })) });
  for (const t of [mk("Alfa FC", "ALF"), mk("Beta EC", "BET")]) await panel.evaluate((t) => new Promise((r) => App.socket.emit("teams:save", t, r)), t);
  await panel.waitForFunction(() => App.teams.length === 2);
  ok(true, "2 times salvos pelo painel (teams:save)");
  const ids = await panel.evaluate(() => App.teams.map((t) => t.id));
  await panel.evaluate((ids) => { App.socket.emit("match:setSide", { side: "home", data: { teamId: ids[0], starterIds: App.teams[0].players.slice(0, 5).map((p) => p.id) } }); App.socket.emit("match:setSide", { side: "away", data: { teamId: ids[1], starterIds: App.teams[1].players.slice(0, 5).map((p) => p.id) } }); }, ids);
  // overlay do placar em outra aba (caminho Firebase)
  const ov = await ctx.newPage(); watch(ov, "placar"); await ov.goto(BASE + "arte/placar/");
  await ov.waitForFunction(() => document.body.innerText.includes("ALF") || document.body.innerText.toUpperCase().includes("ALFA"), null, { timeout: 8000 }).catch(() => {});
  const txt = await ov.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  ok(/ALF|ALFA/i.test(txt) && /BET/i.test(txt), "arte do placar mostra os dois times lidos do Firebase: " + txt.slice(0, 60));
  // gol + relógio
  const ev = await panel.evaluate(() => App.state.match.events.length);
  await panel.evaluate(() => { App.socket.emit("clock:start"); });
  await ov.waitForTimeout(2600);
  const c1 = await ov.evaluate(() => document.querySelector("#sbClock, .sb-clock, [id*=lock]") && (document.querySelector("#sbClock") || document.querySelector(".sb-clock")).textContent);
  ok(/^00:0[1-9]$|^00:[1-5]\d$/.test(c1 || ""), "relógio da arte corre sozinho: " + c1);
  await panel.evaluate(() => App.socket.emit("clock:pause"));
  await ov.waitForTimeout(600);
  const c2 = await ov.evaluate(() => (document.querySelector("#sbClock") || document.querySelector(".sb-clock")).textContent);
  await ov.waitForTimeout(1500);
  const c3 = await ov.evaluate(() => (document.querySelector("#sbClock") || document.querySelector(".sb-clock")).textContent);
  ok(c2 === c3, "relógio para quando o painel pausa: " + c2 + " = " + c3);
  // placar: lançar um gol
  const evNames = await panel.evaluate(() => Object.keys(App.socket._h || {}));
  await panel.evaluate(() => App.socket.emit("match:addEvent", { type: "goal", side: "home", playerId: App.teams[0].players[0].id }));
  await panel.waitForTimeout(600);
  const sc = await panel.evaluate(() => App.state.match.score);
  ok(sc.home === 1 && sc.away === 0, "gol lançado no motor: " + JSON.stringify(sc));
  await ov.waitForTimeout(600);
  const scoreTxt = await ov.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  ok(/\b1\b/.test(scoreTxt), "placar da arte mostra o gol");
  // prévias do painel (loopback)
  await panel.evaluate(() => { App.go("arte"); App.setPreview("all"); }); await panel.waitForTimeout(2500);
  const frames = await panel.evaluate(() => [...document.querySelectorAll("#stageInner iframe")].map((f) => { try { return f.contentDocument.body.innerText.length; } catch (e) { return -1; } }));
  ok(frames.length >= 6 && frames.every((n) => n >= 0), "prévias carregam dentro do painel (" + frames.length + " iframes)");
  const pf = await panel.evaluate(() => { const f = [...document.querySelectorAll("#stageInner iframe")].find((x) => /arte\/placar/.test(x.src)); return f && f.contentDocument.body.innerText.replace(/\s+/g, " "); });
  ok(/ALF|ALFA/i.test(pf || ""), "prévia do placar (sem rede) mostra o jogo");
  // presença
  await panel.evaluate(() => App.go("dashboard")); await panel.waitForTimeout(800);
  const conn = await panel.evaluate(() => App.conn);
  ok(conn.sources && conn.sources.placar >= 1, "Dashboard conta a arte do placar conectada: " + JSON.stringify(conn.sources));
  // fx: não dispara ao carregar; dispara depois
  const ov2 = await ctx.newPage(); watch(ov2, "arte"); await ov2.goto(BASE + "arte/");
  await ov2.waitForTimeout(800);
  await ov2.evaluate(() => { window.__fx = 0; });
  // recarregar painel: estado persiste no Firebase
  await panel.reload(); await panel.waitForFunction(() => typeof App !== "undefined" && App.state && App.teams.length === 2, null, { timeout: 8000 });
  ok(await panel.evaluate(() => App.state.match.score.home === 1 && App.state.match.events.length >= 1), "recarregar o painel mantém placar e eventos (estado veio do Firebase)");
  // segunda aba do painel adota alterações
  const panel2 = await ctx.newPage(); watch(panel2, "painel2"); await panel2.goto(BASE); await panel2.waitForFunction(() => typeof App !== "undefined" && App.state);
  await panel.evaluate(() => App.socket.emit("match:addEvent", { type: "goal", side: "away", playerId: App.teams[1].players[0].id }));
  await panel2.waitForFunction(() => App.state.match.score.away === 1, null, { timeout: 5000 }).then(() => ok(true, "2ª aba do painel acompanha o gol feito na 1ª"), () => ok(false, "2ª aba do painel acompanha o gol feito na 1ª"));
  console.log("erros de console:", errs);
  ok(errs.length === 0, "sem erros de JavaScript nas páginas");
  await b.close();
  console.log(fails ? `\n${fails} FALHA(S)` : "\nTUDO OK");
  process.exit(fails ? 1 : 0);
})();
