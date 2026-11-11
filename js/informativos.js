/**
 * PÁGINA DA ARTE — INFORMATIVOS (Browser Source do OBS) — v6.0 / v6.1
 * ---------------------------------------------------------------
 * Quatro cartões independentes na mesma fonte (cada um liga/desliga sozinho pelo painel):
 *   1. Classificação  — tabela dos times (modo compacto ou completo), faixas, projeção ao vivo,
 *                       jogo principal em destaque forte e jogos em andamento em destaque suave.
 *   2. Outros jogos   — placares dos jogos que acontecem ao mesmo tempo.
 *   3. Arbitragem     — árbitro, assistentes e 4º árbitro.
 *   4. VAR            — os 3 árbitros de vídeo (mesma animação da classificação).
 * - Animações só para mudanças NOVAS: nada anima ao abrir ou atualizar a página.
 * - ?demo=standings|others|ref|var|all (prévia do painel) mostra o cartão mesmo desligado.
 */
const socket = io({ query: { kind: "arte" } });
const DEMO = new URLSearchParams(location.search).get("demo") || "";
const $ = (id) => document.getElementById(id);
// v6.1 — a mesma página serve duas fontes: /arte/classificacao (só a tabela) e /arte/informativos (o resto)
const MODE = /\/classificacao\/?$/.test(location.pathname) ? "standings" : "info";
document.body.dataset.mode = MODE;

let state = null, teams = [];
let firstSync = false;

socket.on("state:sync", (s) => { state = s; render(); });
socket.on("teams:sync", (t) => { teams = t; render(); });

const esc = (str) => { const d = document.createElement("div"); d.textContent = str == null ? "" : String(str); return d.innerHTML; };
const findTeam = (id) => teams.find((t) => t.id === id) || null;

/* ---------- cores ---------- */
function parseHex(hex) {
  const c = String(hex || "#000000").replace("#", "");
  const f = c.length === 3 ? c.split("").map((x) => x + x).join("") : c;
  return [parseInt(f.slice(0, 2), 16) || 0, parseInt(f.slice(2, 4), 16) || 0, parseInt(f.slice(4, 6), 16) || 0];
}
const rgbStr = (hex) => parseHex(hex).join(",");
const rgba = (hex, pct) => `rgba(${rgbStr(hex)},${Math.max(0, Math.min(100, pct)) / 100})`;
function onColor(hex) {
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const [r, g, b] = parseHex(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) > 0.3 ? "#0b0f14" : "#ffffff";
}

/** Cores e fonte do cartão: as do placar (paleta da transmissão) ou as próprias. */
function theme(cfg, placar) {
  const f = cfg.followPlacar !== false;
  return {
    font: f ? placar.fontFamily : cfg.fontFamily,
    bg: f ? placar.bgColor : cfg.bgColor,
    bgOpacity: f ? placar.bgOpacity : cfg.bgOpacity,
    accent: f ? placar.accentColor : cfg.accentColor,
    text: f ? placar.textColor : cfg.textColor,
    follow: f,
  };
}
function applyLayer(layer, cfg, th, extra = {}) {
  const s = layer.style;
  s.setProperty("--f", th.font);
  s.setProperty("--text", th.text);
  s.setProperty("--accent", th.accent);
  s.setProperty("--accent-rgb", rgbStr(th.accent));
  s.setProperty("--on-accent", onColor(th.accent));
  s.setProperty("--bg-rgba", rgba(th.bg, th.bgOpacity));
  s.setProperty("--radius", (cfg.borderRadius ?? 14) + "px");
  s.setProperty("--fs", cfg.fontSize + "px");
  s.setProperty("--row-h", cfg.rowHeight + "px");
  s.setProperty("--mar-x", (cfg.marginX ?? 40) + "px");
  s.setProperty("--mar-y", (cfg.marginY ?? 40) + "px");
  for (const k of Object.keys(extra)) s.setProperty(k, extra[k]);
  layer.className = "inf-layer pos-" + (cfg.position || "center");
}

/* ---------- liga/desliga um cartão com estilo de ENTRADA e de SAÍDA ----------
 * v6.2: o movimento do cartão inteiro vem de /css/anim-styles.css (ax-in-* / ax-out-*), o mesmo usado no
 * fim de jogo e nos pênaltis. "cascata" é o estilo próprio daqui: as LINHAS entram/saem uma a uma.
 * Nada anima ao abrir/atualizar a página (só quando o cartão liga/desliga depois da primeira carga). */
const IN_OK = ["cascade", "fade", "slide", "rise", "drop", "zoom", "pop", "flip", "spin", "blur", "wipe", "wipe-down", "bounce", "none"];
const OUT_OK = ["cascade", "fade", "slide", "rise", "drop", "zoom", "pop", "flip", "spin", "blur", "wipe", "wipe-down", "none"];
const OUT_MS = { fade: 450, slide: 500, rise: 500, drop: 500, zoom: 450, pop: 500, flip: 600, spin: 600, blur: 600, wipe: 600, "wipe-down": 600, none: 0 };
const clearAx = (card) => { card.className = card.className.replace(/\b(ax-(in|out)-\S+|leaving|intro-cascade)\b/g, "").replace(/\s+/g, " ").trim(); };
function setShown(card, on, cfg) {
  const inStyle = IN_OK.includes(cfg && cfg.introStyle) ? cfg.introStyle : "cascade";
  const outStyle = OUT_OK.includes(cfg && cfg.outroStyle) ? cfg.outroStyle : "fade";
  if (on === !!card._on && card._init) return;
  card._on = on;
  const first = !card._init;
  card._init = true;
  clearTimeout(card._leaveT); clearTimeout(card._cascadeT);
  clearAx(card);
  const animate = !first && firstSync;
  if (on) {
    card.classList.add("on");
    if (!animate) return;
    if (inStyle === "cascade") {
      card.classList.add("intro-cascade");
      card._cascadeT = setTimeout(() => card.classList.remove("intro-cascade"), 3200);
    } else if (inStyle !== "none") {
      void card.offsetWidth;
      card.classList.add("ax-in-" + inStyle);
      card._cascadeT = setTimeout(() => card.classList.remove("ax-in-" + inStyle), 1300);
    }
  } else if (!animate || outStyle === "none") {
    card.classList.remove("on");
  } else if (outStyle === "cascade") {
    // saída em cascata: as linhas saem uma a uma e, no fim, o cartão some
    card.classList.add("leaving");
    const rows = card.querySelectorAll(".st-row, .ot-row, .of-row, .sd-item").length || 6;
    card._leaveT = setTimeout(() => { clearAx(card); card.classList.remove("on"); }, Math.min(1800, rows * 70 + 500));
  } else {
    card.classList.add("ax-out-" + outStyle);
    card._leaveT = setTimeout(() => { clearAx(card); card.classList.remove("on"); }, (OUT_MS[outStyle] || 450) + 40);
  }
}

/* ================= 1. CLASSIFICAÇÃO ================= */
const stCard = $("stCard");
stCard.innerHTML = `
  <div class="card-title"><span class="t"></span><small class="r"></small></div>
  <div class="st-colhead"><span class="c-pos">#</span><span class="c-crest"></span><span class="c-name">Time</span><span class="c-delta"></span><span class="c-pts">PTS</span><span class="c-x c-j">J</span><span class="c-x c-v">V</span><span class="c-x c-e">E</span><span class="c-x c-d">D</span><span class="c-x c-sg">SG</span></div>
  <div class="st-rows"></div>
  <div class="st-legend"></div>
  <div class="st-foot"></div>`;
const stTitle = stCard.querySelector(".t"), stRound = stCard.querySelector(".r"), stRows = stCard.querySelector(".st-rows"),
  stLegend = stCard.querySelector(".st-legend"), stFoot = stCard.querySelector(".st-foot");
const stEls = new Map();      // id da linha -> elemento
const stPrev = new Map();     // id da linha -> { pts, pos }
let stMarkT = null;

function rowHtml(r, ctx) {
  const c = ctx.cfg;
  const crest = c.showCrests !== false && r.team && r.team.crestDataUrl ? `<img src="${esc(r.team.crestDataUrl)}" alt="">` : "";
  let chip = "";
  const info = r.main ? { gf: r.main.gf, ga: r.main.ga, status: "live", round: "" } : r.live;
  if (info && info.status !== "scheduled") {
    const rd = info.round && info.round !== (ctx.mainRound || ctx.tableRound) ? `<em>R${esc(info.round)}</em>` : "";
    chip = `<span class="st-chip c-live ${info.status === "finished" ? "fin" : ""}"><i></i>${info.gf}×${info.ga}${rd}</span>`;
  }
  const d = r.delta;
  const delta = d > 0 ? `<i class="tri up"></i>${d}` : d < 0 ? `<i class="tri down"></i>${-d}` : "";
  const cell = (k) => (r[k] === null || r[k] === undefined ? "–" : r[k]);
  const sg = r.sg === null || r.sg === undefined ? "–" : (r.sg > 0 ? "+" + r.sg : r.sg);
  return `<span class="c-pos">${r.pos}</span><span class="c-crest">${crest}</span>
    <span class="c-name"><span class="short">${esc(r.short || r.name)}</span><span class="full">${esc(r.name)}</span></span>${chip}
    <span class="c-delta ${d > 0 ? "up" : d < 0 ? "down" : ""}">${delta}</span><span class="c-pts">${r.pts}</span>
    <span class="c-x c-j">${cell("j")}</span><span class="c-x c-v">${cell("v")}</span><span class="c-x c-e">${cell("e")}</span><span class="c-x c-d">${cell("d")}</span><span class="c-x c-sg">${sg}</span>`;
}

function renderStandings() {
  const lg = state.league, c = state.customization.classificacao, p = state.customization.placar;
  const layer = $("layerStandings");
  const th = theme(c, p);
  const mainColor = th.follow ? th.accent : c.mainColor;
  applyLayer(layer, c, th, {
    "--w-compact": c.widthCompact + "px", "--w-complete": c.widthComplete + "px",
    "--main": mainColor, "--main-rgb": rgbStr(mainColor), "--on-main": onColor(mainColor),
    "--dim": String((Number(c.dimLive) || 0) / 100),
  });
  const show = DEMO ? DEMO === "standings" || DEMO === "all" : !!lg.visible;

  const res = Standings.compute(state, teams);
  const ctx = { cfg: c, mainRound: res.mainRound, tableRound: res.tableRound };
  const complete = lg.mode === "complete";

  stCard.classList.toggle("mode-complete", complete);
  stCard.classList.toggle("show-stripe", c.showZoneStripe !== false);
  stCard.classList.toggle("show-legend", c.showLegend !== false);
  stCard.classList.toggle("no-crest", c.showCrests === false);
  stCard.classList.toggle("no-delta", c.showDelta === false || !res.projecting);
  stCard.classList.toggle("hide-livescore", c.showLiveScore === false);
  stCard.classList.toggle("name-always-full", !!c.compactShowName);
  ["j", "v", "e", "d", "sg"].forEach((k) => stCard.classList.toggle("colhide-" + k, !res.cols[k]));
  stCard.style.setProperty("--n", res.rows.length);

  stTitle.textContent = lg.name || "CLASSIFICAÇÃO";
  stRound.textContent = lg.round ? `RODADA ${lg.round}` : "";

  // linhas (mantém os elementos: a troca de posição anima sozinha)
  const seen = new Set();
  res.rows.forEach((r, i) => {
    seen.add(r.id);
    let el = stEls.get(r.id);
    if (!el) {
      el = document.createElement("div");
      el.className = "st-row";
      el.innerHTML = `<div class="st-row-in"></div>`;
      stRows.appendChild(el);
      stEls.set(r.id, el);
    }
    const inner = el.firstChild;
    el.style.setProperty("--i", i);
    el.classList.toggle("is-main", !!r.main);
    el.classList.toggle("is-live", !r.main && !!r.live && r.live.status !== "scheduled");
    inner.style.setProperty("--zone", r.zone ? r.zone.color : "transparent");
    const html = rowHtml(r, ctx);
    if (inner._h !== html) {
      inner.innerHTML = html;
      inner._h = html;
      const prev = stPrev.get(r.id);
      if (firstSync && prev && prev.pts !== r.pts) { const pc = inner.querySelector(".c-pts"); if (pc) pc.classList.add("bump"); }
    }
    const prev = stPrev.get(r.id);
    if (firstSync && prev && prev.pos !== r.pos) {
      inner.classList.remove("mark-on"); void inner.offsetWidth; inner.classList.add("mark-on");
      setTimeout(() => inner.classList.remove("mark-on"), 1500);
    }
    stPrev.set(r.id, { pts: r.pts, pos: r.pos });
  });
  for (const [id, el] of stEls) if (!seen.has(id)) { el.remove(); stEls.delete(id); stPrev.delete(id); }

  // legenda das faixas e rodapé
  const zones = (lg.zones || []).filter((z) => z.enabled !== false).sort((a, b) => a.from - b.from);
  const legend = zones.map((z) => `<span><i style="background:${esc(z.color)}"></i>${z.from === z.to ? z.from + "º" : z.from + "º–" + z.to + "º"} ${esc(z.label)}</span>`).join("");
  if (stLegend._h !== legend) { stLegend.innerHTML = legend; stLegend._h = legend; }
  const foot = [];
  if (res.projecting) foot.push("Tabela com projeção dos jogos em andamento");
  if (res.projecting && res.tableRound) foot.push(`base: rodada ${esc(res.tableRound)}`);
  const f = foot.join(" · ");
  if (stFoot._h !== f) { stFoot.innerHTML = f; stFoot._h = f; }

  setShown(stCard, show, c);
}

/* ================= 2. OUTROS JOGOS ================= */
const otCard = $("otCard");
otCard.innerHTML = `<div class="card-title"><span class="t"></span><small class="r"></small></div><div class="ot-rows"></div>`;
const otTitle = otCard.querySelector(".t"), otTag = otCard.querySelector(".r"), otRows = otCard.querySelector(".ot-rows");
const otEls = new Map();
const otPrevScore = new Map();   // id do jogo -> [casa, fora]
let alertGame = null, alertTimer = null;

socket.on("others:goal", ({ id, side } = {}) => {
  if (!state) return;
  const c = state.customization.outrosJogos;
  if (c.autoAlert && !state.others.visible) {
    alertGame = id;
    clearTimeout(alertTimer);
    alertTimer = setTimeout(() => { alertGame = null; render(); }, Math.max(2500, Number(c.alertMs) || 7000));
    render();
  }
  flashRow(id, side);
});

function flashRow(id, side) {
  const el = otEls.get(id);
  if (!el || !firstSync) return;
  if (el._flashAt && Date.now() - el._flashAt < 700) return;
  el._flashAt = Date.now();
  el.classList.remove("goal-flash"); void el.offsetWidth; el.classList.add("goal-flash");
  const b = el.querySelector(side === "away" ? ".sc-a" : ".sc-h");
  if (b) { b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump"); }
  setTimeout(() => el.classList.remove("goal-flash"), 3400);
}

function viewGames() {
  const lg = state.league, rows = new Map(lg.teams.map((t) => [t.id, t]));
  const side = (id) => {
    const r = rows.get(id);
    const tm = r ? Standings.teamForRow(r, teams) : null;
    return { name: r ? r.name : "—", short: r ? r.short || r.name : "—", crest: tm && tm.crestDataUrl ? tm.crestDataUrl : "" };
  };
  return state.others.games.map((g) => ({ id: g.id, h: side(g.homeId), a: side(g.awayId), hs: g.homeScore, as: g.awayScore, status: g.status, minute: g.minute, round: g.round, onAir: g.onAir }));
}
const DEMO_GAMES = [
  { id: "d1", h: { name: "Palmeiras", short: "PAL", crest: "" }, a: { name: "Corinthians", short: "COR", crest: "" }, hs: 1, as: 0, status: "live", minute: "67'", round: "", onAir: true },
  { id: "d2", h: { name: "Grêmio", short: "GRE", crest: "" }, a: { name: "Internacional", short: "INT", crest: "" }, hs: 2, as: 2, status: "live", minute: "81'", round: "", onAir: true },
];

function renderOthers() {
  const c = state.customization.outrosJogos, p = state.customization.placar;
  const layer = $("layerOthers");
  const th = theme(c, p);
  applyLayer(layer, c, th, { "--w": c.width + "px", "--goal": c.goalColor, "--goal-rgb": rgbStr(c.goalColor), "--on-goal": onColor(c.goalColor) });

  let games = viewGames();
  // detecta gols novos (placar subiu) — só depois da primeira carga
  games.forEach((g) => {
    const prev = otPrevScore.get(g.id);
    if (firstSync && prev) {
      if (g.hs > prev[0]) setTimeout(() => flashRow(g.id, "home"), 30);
      else if (g.as > prev[1]) setTimeout(() => flashRow(g.id, "away"), 30);
    }
    otPrevScore.set(g.id, [g.hs, g.as]);
  });
  const demo = DEMO === "others" || DEMO === "all";
  let show = !!state.others.visible && games.some((g) => g.onAir);
  let list = games.filter((g) => g.onAir);
  let alerting = false;
  if (!show && alertGame) {
    const g = games.find((x) => x.id === alertGame);
    if (g) { list = [g]; show = true; alerting = true; }
  }
  if (demo) { if (!list.length) list = DEMO_GAMES; show = true; }

  otCard.classList.toggle("no-crest", c.showCrests === false);
  otTitle.innerHTML = alerting ? "GOL EM OUTRO JOGO" : `<span class="live-dot"></span>${esc(c.title || "OUTROS JOGOS")}`;
  const mainRound = (state.meta && state.meta.round) || state.league.round || "";
  otTag.textContent = "";

  const seen = new Set();
  list.forEach((g, i) => {
    seen.add(g.id);
    let el = otEls.get(g.id);
    if (!el) { el = document.createElement("div"); el.className = "ot-row"; otEls.set(g.id, el); }
    el.style.setProperty("--i", i);
    const nm = (t) => esc(c.fullNames !== false ? t.name : t.short);
    const crest = (t) => (t.crest ? `<img src="${esc(t.crest)}" alt="">` : "");
    const rd = c.showRound !== false && g.round && g.round !== mainRound ? `<span class="rd">RODADA ${esc(g.round)}</span>` : "";
    const min = g.status === "finished" ? `<span class="min">FIM</span>` : g.status === "scheduled" ? `<span class="min">${esc(g.minute || "—")}</span>` : `<span class="min ao">${esc(g.minute || "AO VIVO")}</span>`;
    const score = g.status === "scheduled" ? `<b>–</b><span>×</span><b>–</b>` : `<b class="sc-h">${g.hs}</b><span>×</span><b class="sc-a">${g.as}</b>`;
    const html = `<span class="ot-team home"><span class="nm">${nm(g.h)}</span>${crest(g.h)}</span><span class="ot-score">${score}</span><span class="ot-team away">${crest(g.a)}<span class="nm">${nm(g.a)}</span></span><span class="ot-meta">${min}${rd}</span>`;
    if (el._h !== html) {
      // mantém o "bump" em andamento: só troca o conteúdo se mudou de fato
      el.innerHTML = html; el._h = html;
    }
    if (el.parentNode !== otRows || otRows.children[i] !== el) otRows.insertBefore(el, otRows.children[i] || null);
  });
  for (const [id, el] of otEls) if (!seen.has(id)) { el.remove(); otEls.delete(id); }

  setShown(otCard, show, c);
}

/* ================= 3 e 4. ARBITRAGEM E VAR ================= */
const rfCard = $("rfCard"), vrCard = $("vrCard");
const REF_ROLES = [["main", "Árbitro"], ["ass1", "Assistente 1"], ["ass2", "Assistente 2"], ["fourth", "4º árbitro"]];
const VAR_ROLES = [["var", "VAR"], ["avar1", "AVAR 1"], ["avar2", "AVAR 2"]];
const DEMO_NAMES = { main: "Nome do Árbitro", ass1: "Nome do Assistente", ass2: "Nome do Assistente", fourth: "Nome do 4º Árbitro", var: "Nome do VAR", avar1: "Nome do AVAR", avar2: "Nome do AVAR" };

function renderOfficials(card, layerId, roles, title, visible, demo) {
  const c = state.customization.arbitragem, p = state.customization.placar;
  const layer = $(layerId);
  applyLayer(layer, c, theme(c, p), { "--w": c.width + "px" });
  const o = state.officials || {};
  const items = roles.map(([k, label]) => {
    const e = o[k] || {};
    const name = e.name || (demo ? DEMO_NAMES[k] : "");
    return { label, name, from: e.from || (demo && name ? "UF" : "") };
  });
  const filled = items.filter((x) => x.name);
  const rows = (filled.length ? filled : items.map((x) => ({ ...x, name: "—" })));
  card.classList.toggle("hide-from", c.showFrom === false);
  const html = `<div class="card-title"><span class="t">${esc(title)}</span></div><div class="of-rows">${rows.map((x, i) =>
    `<div class="of-row" style="--i:${i}"><span class="of-role">${esc(x.label)}</span><span class="of-name">${esc(x.name)}</span><span class="of-from">${esc(x.from)}</span></div>`).join("")}</div>`;
  if (card._h !== html) { card.innerHTML = html; card._h = html; }
  setShown(card, visible || demo, c);
}

/* ================= 5. ESTÁDIO (v6.1) ================= */
const sdCard = $("sdCard");
const SD_LABELS = [["location", "Onde fica"], ["owner", "De quem é"], ["capacity", "Capacidade"], ["inauguration", "Inauguração"], ["record", "Recorde de público"], ["surface", "Gramado"], ["dimensions", "Campo"], ["attendance", "Público do jogo"]];
const SD_DEMO = { name: "Estádio Modelo", nickname: "A Casa do Time", location: "Cidade — UF", owner: "Prefeitura Municipal", capacity: "12.500", inauguration: "12/03/1975", record: "14.203 (1998)", surface: "Natural", dimensions: "105 × 68 m", attendance: "", photos: [] };
let sdTimer = null, sdIdx = 0, sdSig = "";

function sdAdvance() {
  const slides = sdCard.querySelectorAll(".sd-slide");
  if (slides.length < 2) return;
  const prev = sdIdx;
  sdIdx = (sdIdx + 1) % slides.length;
  slides.forEach((s, i) => { s.classList.toggle("cur", i === sdIdx); s.classList.toggle("was", i === prev && i !== sdIdx); });
  sdCard.querySelectorAll(".sd-dots i").forEach((d, i) => d.classList.toggle("cur", i === sdIdx));
}
function renderStadium() {
  const c = state.customization.estadio, p = state.customization.placar;
  const layer = $("layerStadium");
  applyLayer(layer, c, theme(c, p), { "--w": c.width + "px", "--photo-h": c.photoHeight + "px" });
  const demo = DEMO === "stadium" || DEMO === "all";
  let d = state.stadium || {};
  const hasAny = d.name || d.photos.length || SD_LABELS.some(([k]) => d[k]);
  if (demo && !hasAny) d = SD_DEMO;
  const photos = (d.photos || []).map((x) => "/stadium/photos/" + encodeURIComponent(x.file));
  sdCard.classList.toggle("layout-side", c.layout === "side");
  sdCard.classList.toggle("no-photo", !photos.length && !(demo && d === SD_DEMO));
  sdCard.classList.remove("ss-fade", "ss-slide", "ss-zoom"); sdCard.classList.add("ss-" + (c.slideStyle || "fade"));
  sdCard.style.setProperty("--slide-ms", Math.max(2000, Number(c.slideMs) || 5000) + "ms");
  const rows = SD_LABELS.filter(([k]) => d[k]).map(([k, l], n) => `<div class="sd-item" style="--i:${n}"><span class="sd-l">${l}</span><span class="sd-v">${esc(d[k])}</span></div>`).join("");
  const slides = photos.length ? photos.map((u, i) => `<img class="sd-slide ${i === 0 ? "cur" : ""}" src="${esc(u)}" alt="">`).join("")
    : (demo && d === SD_DEMO ? `<div class="sd-slide cur sd-ph"></div>` : "");
  const dots = photos.length > 1 && c.showDots !== false ? `<div class="sd-dots">${photos.map((_, i) => `<i class="${i === 0 ? "cur" : ""}"></i>`).join("")}</div>` : "";
  const html = `<div class="card-title"><span class="t">${esc(c.title || "ESTÁDIO")}</span></div>
    <div class="sd-body"><div class="sd-photo">${slides}<div class="sd-name"><b>${esc(d.name || "")}</b>${d.nickname ? `<small>${esc(d.nickname)}</small>` : ""}</div>${dots}</div>
    <div class="sd-info">${rows || ""}</div></div>`;
  const sig = html + "|" + c.slideMs;
  if (sig !== sdSig) {   // só refaz quando o conteúdo muda (o slide não reinicia a cada gol, relógio etc.)
    sdSig = sig; sdCard.innerHTML = html; sdIdx = 0;
    clearInterval(sdTimer);
    if (photos.length > 1) sdTimer = setInterval(sdAdvance, Math.max(2000, Number(c.slideMs) || 5000));
  }
  setShown(sdCard, demo || !!d.visible && (hasAny), c);
}

function render() {
  if (!state) return;
  if (MODE === "standings") renderStandings();
  else {
    renderOthers();
    const a = state.customization.arbitragem;
    renderOfficials(rfCard, "layerRef", REF_ROLES, a.titleRef || "ARBITRAGEM", !!(state.officials && state.officials.refVisible), DEMO === "ref" || DEMO === "all");
    renderOfficials(vrCard, "layerVar", VAR_ROLES, a.titleVar || "ÁRBITROS DE VÍDEO", !!(state.officials && state.officials.varVisible), DEMO === "var" || DEMO === "all");
    renderStadium();
  }
  if (!firstSync) {
    firstSync = true;
    // primeira renderização sem transição: F5 com a arte no ar não "anima"
    requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove("no-anim")));
  }
}
