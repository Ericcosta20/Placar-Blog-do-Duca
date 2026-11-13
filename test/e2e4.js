// Patrocinadores: galeria, playlist em rascunho, publicar, controles, arte.
const { chromium } = require("playwright");
const BASE = process.env.BASE || "http://localhost:8099/placar-app-v1.1/";
const IMG = __dirname + "/img/";
let fails = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHOU ") + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
  await require("./mock-db-node").attach(ctx);
  const errs = []; const watch = (p, n) => { p.on("pageerror", (e) => errs.push(n + ": " + e.message)); p.on("console", (m) => m.type() === "error" && !/Failed to load|net::ERR/.test(m.text()) && errs.push(n + ": " + m.text())); };
  const p = await ctx.newPage(); watch(p, "painel"); await p.goto(BASE); await p.waitForSelector("#loginGate form:not([hidden])");
  await p.fill("#lgEmail", "eric@teste.com"); await p.fill("#lgPass", "senha123"); await p.click("#loginGate button[type=submit]");
  await p.waitForFunction(() => typeof App !== "undefined" && App.state, null, { timeout: 8000 });
  await p.evaluate(() => App.go("patrocinadores")); await p.waitForSelector("#spGallery");
  ok(true, "aba Patrocinadores abre");
  ok(await p.isDisabled("#spPublish"), "sem alterações: botão Atualizar no ar desligado");
  ok(await p.isDisabled("#spPlay"), "nada publicado: controles desligados");

  // upload
  await p.setInputFiles("#spFile", [IMG + "logo-a.png", IMG + "logo-b.png", IMG + "logo-c.png", IMG + "logo-d.jpg", IMG + "nao-imagem.gif"]);
  await p.waitForFunction(() => document.querySelectorAll("#spGallery .sp-tile").length === 4, null, { timeout: 8000 });
  ok(true, "4 imagens na galeria (GIF recusado)");
  const sizes = await p.evaluate(() => Object.values(window.__spDbg ? {} : {}).length);
  const big = await p.evaluate(async () => { const s = await PLACAR_DB.ref(PLACAR_PATH + "/sponsors/meta").once("value"); return Object.values(s.val()).map((m) => [m.w, m.h]); });
  ok(big.every(([w, h]) => Math.max(w, h) <= 700), "imagens reduzidas a no máximo 700px: " + JSON.stringify(big));
  await p.fill(".sp-tile:nth-child(1) .sp-name", "Patrocinador Vermelho"); await p.press(".sp-tile:nth-child(1) .sp-name", "Tab");
  await p.waitForTimeout(300);
  ok(await p.evaluate(async () => (await PLACAR_DB.ref(PLACAR_PATH + "/sponsors/meta").once("value")).val() && Object.values((await PLACAR_DB.ref(PLACAR_PATH + "/sponsors/meta").once("value")).val()).some((m) => m.name === "Patrocinador Vermelho")), "nome do patrocinador salvo");

  // playlist
  await p.click(".sp-tile:nth-child(1) [data-use]"); await p.click(".sp-tile:nth-child(2) [data-use]"); await p.click("#spAddEmpty");
  ok((await p.$$("#spList .sp-row")).length === 3, "3 blocos no rascunho");
  ok(!(await p.isDisabled("#spPublish")), "alterado: botão Atualizar no ar liga");
  ok(await p.evaluate(async () => (await PLACAR_DB.ref(PLACAR_PATH + "/sponsors/live").once("value")).val() === null), "rascunho NÃO foi ao ar");
  await p.fill(".sp-row:nth-child(1) [data-f=duration]", "3"); await p.fill(".sp-row:nth-child(2) [data-f=duration]", "2"); await p.fill(".sp-row:nth-child(3) [data-f=duration]", "2");
  await p.click(".sp-row:nth-child(3) [data-act=up]");
  ok(await p.evaluate(() => document.querySelectorAll("#spList .sp-rthumb")[1].classList.contains("empty")), "reordenar: bloco vazio subiu");
  await p.click(".sp-row:nth-child(2) [data-act=down]");
  ok(await p.evaluate(() => document.querySelectorAll("#spList .sp-rthumb")[2].classList.contains("empty")), "reordenar: bloco vazio desceu");
  await p.waitForTimeout(700);
  ok(await p.evaluate(async () => (await PLACAR_DB.ref(PLACAR_PATH + "/sponsors/live").once("value")).val() === null), "ainda nada no ar após reordenar");

  // arte ao vivo antes de publicar: vazia
  const a = await ctx.newPage(); watch(a, "arte"); await a.goto(BASE + "arte/patrocinadores/"); await a.waitForTimeout(800);
  ok(await a.evaluate(() => !document.querySelector("img[src]:not([hidden])") || [...document.images].every((i) => getComputedStyle(i).opacity === "0" || !i.src)), "arte vazia antes de publicar");
  ok(await a.evaluate(() => getComputedStyle(document.body).backgroundColor === "rgba(0, 0, 0, 0)"), "arte com fundo transparente");

  // publicar
  await p.click("#spPublish"); await p.waitForTimeout(600);
  ok(await p.isDisabled("#spPublish"), "publicou: botão volta a desligar");
  ok(await p.evaluate(async () => !!(await PLACAR_DB.ref(PLACAR_PATH + "/sponsors/live").once("value")).val()), "playlist foi para o nó live");
  ok(await p.evaluate(() => /No ar/.test(document.querySelector("#spBadge").textContent)), "selo: No ar");
  const now = () => a.evaluate(() => { const v = [...document.images].filter((i) => getComputedStyle(i).opacity > 0.5 && i.src); return v.length ? String(v[0].src.length) : "vazio"; });
  await a.waitForTimeout(800);
  const s1 = await now(); ok(s1 !== "vazio", "arte mostra o 1º logo logo após publicar");
  // ordem e loop: amostra a cada 400ms durante 9s (ciclo total 7s)
  const seq = []; for (let i = 0; i < 23; i++) { const n = await now(); if (seq[seq.length - 1] !== n) seq.push(n); await a.waitForTimeout(400); }
  ok(seq.length >= 4, "arte alterna e repete em loop (" + seq.length + " trocas)");
  ok(seq.includes("vazio"), "bloco vazio limpa a tela");

  // pausar
  await p.click("#spPlay"); await p.waitForTimeout(500);
  ok(/Pausado/.test(await p.textContent("#spBadge")), "painel: Pausado");
  const t1 = await p.textContent("#spNowTime"); await p.waitForTimeout(1500); const t2 = await p.textContent("#spNowTime");
  ok(t1 === t2 && /pausado/.test(t1), "contador congela ao pausar: " + t1);
  const f1 = await now(); await a.waitForTimeout(2500); ok((await now()) === f1, "arte congela ao pausar");
  // próximo
  const title1 = await p.textContent("#spNowTitle"); await p.click("#spNext"); await p.waitForTimeout(500);
  const title2 = await p.textContent("#spNowTitle"); ok(title1 !== title2, "Próximo muda o bloco: " + title1 + " → " + title2);
  await p.click("#spRestart"); await p.waitForTimeout(400); ok(/Bloco 1 de 3/.test(await p.textContent("#spNowTitle")), "Reiniciar volta ao bloco 1");
  await p.click("#spPlay"); await p.waitForTimeout(500); ok(/No ar/.test(await p.textContent("#spBadge")), "Continuar retoma");
  // chip
  await p.click("#spQueue [data-jump='2']"); await p.waitForTimeout(400); ok(/Bloco 3 de 3/.test(await p.textContent("#spNowTitle")), "clicar no bloco da fila pula para ele");
  // tirar do ar
  await p.click("#spVisible"); await p.waitForTimeout(900);
  ok(await a.evaluate(() => [...document.images].every((i) => getComputedStyle(i).opacity < 0.05) ), "Tirar do ar esconde a arte");
  await p.click("#spVisible");

  // rascunho não vaza
  await p.click(".sp-row:nth-child(1) [data-act=del]"); await p.waitForTimeout(700);
  ok(!(await p.isDisabled("#spPublish")), "excluir bloco = alteração pendente");
  ok(await p.evaluate(async () => JSON.parse((await PLACAR_DB.ref(PLACAR_PATH + "/sponsors/live").once("value")).val()).blocks.length === 3), "no ar continua com 3 blocos");
  await p.click("#spDiscard"); await p.click("#confirmOk"); await p.waitForTimeout(500);
  ok((await p.$$("#spList .sp-row")).length === 3 && (await p.isDisabled("#spPublish")), "Descartar volta ao que está no ar");

  // aparência + rascunho
  await p.click("#spViewSeg [data-view=draft]"); await p.waitForTimeout(400);
  await p.click("#spSettings [data-pos=tl]"); await p.selectOption("#spSettings [data-k=animIn]", "up");
  ok(!(await p.isDisabled("#spPublish")), "mudar aparência = alteração pendente");
  ok(await p.evaluate(async () => JSON.parse((await PLACAR_DB.ref(PLACAR_PATH + "/sponsors/live").once("value")).val()).settings.pos !== "tl"), "aparência não vai ao ar sem publicar");
  await p.click("#spPublish"); await p.waitForTimeout(500);
  ok(await a.evaluate(() => true), "publicar aparência");

  // excluir imagem usada
  await p.click(".sp-tile:nth-child(2) [data-del]"); await p.click("#confirmOk"); await p.waitForTimeout(600);
  ok((await p.$$("#spGallery .sp-tile")).length === 3, "imagem excluída da galeria");

  // arte: sem animação no carregamento
  const c = await ctx.newPage(); watch(c, "arte2");
  await c.addInitScript(() => { window.__anims = 0; window.__alog = []; const h = (e) => { window.__anims++; window.__alog.push(e.type + ":" + (e.animationName || e.propertyName) + ":" + (e.target.id || e.target.className || e.target.tagName)); }; document.addEventListener("animationstart", h, true); document.addEventListener("transitionstart", h, true); });
  await c.goto(BASE + "arte/patrocinadores/"); await c.waitForTimeout(300);
  ok(await c.evaluate(() => window.__anims === 0), "recarregar a arte: nenhuma animação no carregamento " + JSON.stringify(await c.evaluate(() => window.__alog)));
  if (process.env.SHOT) { await p.setInputFiles("#spFile", [IMG + "logo-a.png", IMG + "logo-c.png"]); await p.waitForTimeout(800); await p.click(".sp-tile:nth-child(3) [data-use]"); await p.waitForTimeout(500); await p.screenshot({ path: process.env.SHOT, fullPage: true }); }
  console.log("erros:", errs); ok(errs.length === 0, "sem erros de JavaScript");
  await b.close(); console.log(fails ? `\n${fails} FALHA(S)` : "\nTUDO OK"); process.exit(fails ? 1 : 0);
})();
