/**
 * PÁGINA DA ARTE — PÊNALTIS (Browser Source do OBS) — v4.1
 * ---------------------------------------------------------------
 * Cartão da disputa de pênaltis: uma linha por time com quadradinhos
 * (cinza = a cobrar · verde = gol · vermelho = perdeu), total de cada time e
 * rodapé com a situação (morte súbita / vencedor).
 *
 * - Só aparece quando match.shootout.visible = true (botão "Mostrar no OBS").
 * - Animações só para cobranças NOVAS — nunca ao carregar/atualizar a página.
 * - ?demo=1 (usado pela prévia do painel) mostra um exemplo se ainda não há cobranças.
 */
const socket = io({ query: { kind: "arte" } });
const DEMO = new URLSearchParams(location.search).get("demo") === "1";

const card = document.getElementById("penCard");
const titleEl = document.getElementById("penTitle");
const rowsEl = document.getElementById("penRows");
const footEl = document.getElementById("penFoot");
const alertEl = document.getElementById("penAlert");

let lastState = null;
let lastTeams = [];
const seenKicks = new Set();
let firstSync = false;
let prevTotals = null;
let lastRowsHtml = "", lastFootHtml = "";
let penShown = null, inOutTimer = null, alertTimer = null;

const ICON_CHECK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5l5 5 10-11"/></svg>`;
const ICON_X = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`;
const MAX_SHOWN = 8; // quadrados visíveis por time (em morte súbita longa, mostra os últimos)

socket.on("teams:sync", (t) => { lastTeams = t; render(); });
socket.on("state:sync", (s) => { lastState = s; render(); });

const esc = (str) => { const d = document.createElement("div"); d.textContent = str == null ? "" : String(str); return d.innerHTML; };
const findTeam = (id) => lastTeams.find((t) => t.id === id) || null;

function parseHex(hex) {
  const c = (hex || "#000000").replace("#", "");
  const f = c.length === 3 ? c.split("").map((x) => x + x).join("") : c;
  return [parseInt(f.slice(0, 2), 16) || 0, parseInt(f.slice(2, 4), 16) || 0, parseInt(f.slice(4, 6), 16) || 0];
}
function rgba(hex, pct) { const [r, g, b] = parseHex(hex); return `rgba(${r},${g},${b},${Math.max(0, Math.min(100, pct)) / 100})`; }
function onColor(hex) {
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const [r, g, b] = parseHex(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) > 0.3 ? "#0b0f14" : "#ffffff";
}

function applyCustomization(c) {
  const r = document.documentElement.style;
  r.setProperty("--pen-font", c.fontFamily);
  r.setProperty("--pen-name-size", c.nameSize + "px");
  r.setProperty("--pen-square", c.squareSize + "px");
  r.setProperty("--pen-radius", c.borderRadius + "px");
  r.setProperty("--pen-bg-rgba", rgba(c.bgColor, c.bgOpacity));
  r.setProperty("--pen-accent", c.accentColor);
  r.setProperty("--pen-on-accent", onColor(c.accentColor));
  r.setProperty("--pen-text", c.textColor);
  r.setProperty("--pen-goal", c.goalColor);
  r.setProperty("--pen-on-goal", onColor(c.goalColor));
  r.setProperty("--pen-miss", c.missColor);
  r.setProperty("--pen-on-miss", onColor(c.missColor));
  r.setProperty("--pen-pending", c.pendingColor);
  document.body.className = document.body.className.replace(/\bpen-pos-\S+/g, "").trim();
  document.body.classList.add("pen-pos-" + (c.position || "bottom-left"));
}

/** Cobranças de exemplo para a prévia do painel. */
const DEMO_KICKS = [
  { id: "d1", side: "home", scored: true }, { id: "d2", side: "away", scored: true },
  { id: "d3", side: "home", scored: false }, { id: "d4", side: "away", scored: true },
  { id: "d5", side: "home", scored: true }, { id: "d6", side: "away", scored: false },
];

/* ---------- v6.1: estilos de entrada/saída do cartão ---------- */
const IN_OK = ["classic", "fade", "slide", "slide-right", "rise", "drop", "zoom", "pop", "flip", "spin", "blur", "wipe", "wipe-down", "bounce", "none"];
const OUT_OK = ["classic", "fade", "slide", "slide-right", "rise", "drop", "zoom", "pop", "flip", "spin", "blur", "wipe", "wipe-down", "none"];
const OUT_MS = { classic: 450, fade: 450, slide: 500, "slide-right": 500, rise: 500, drop: 500, zoom: 450, pop: 500, flip: 600, spin: 600, blur: 600, wipe: 600, "wipe-down": 600, none: 0 };
const pickStyle = (v, ok, def) => (ok.includes(v) ? v : def);
const clearAx = () => { card.className = card.className.replace(/\b(ax-(in|out)-\S+|leaving)\b/g, "").replace(/\s+/g, " ").trim(); };
function playIn() {
  const st = pickStyle(lastState.customization.penaltis.introStyle, IN_OK, "classic");
  clearTimeout(inOutTimer);
  clearAx();
  card.classList.add("on");
  if (st !== "none") { void card.offsetWidth; card.classList.add("ax-in-" + st); inOutTimer = setTimeout(clearAx, 1200); }
}
function playOut(done) {
  const st = pickStyle(lastState.customization.penaltis.outroStyle, OUT_OK, "classic");
  clearTimeout(inOutTimer);
  clearAx();
  if (st === "none") { card.classList.remove("on"); if (done) done(); return; }
  void card.offsetWidth;
  card.classList.add("leaving", "ax-out-" + st);
  inOutTimer = setTimeout(() => { card.classList.remove("on"); clearAx(); if (done) done(); }, (OUT_MS[st] || 450) + 30);
}
// botão "Repetir animação" da aba Arte
socket.on("art:replay", (target) => {
  if (target !== "penaltis" || !lastState || !card.classList.contains("on")) return;
  playOut(() => setTimeout(() => playIn(), 250));
});

/* ---------- v6.1: aviso estiloso a cada cobrança (GOL! / PERDEU!) ---------- */
const ALERT_STYLES = ["faixa", "carimbo", "explosao", "cortina", "brilho"];
function showAlert({ side, scored, name }) {
  if (!lastState) return;
  const c = lastState.customization.penaltis;
  const team = findTeam(lastState.match[side === "away" ? "away" : "home"].teamId);
  const style = ALERT_STYLES.includes(c.kickAlertStyle) ? c.kickAlertStyle : "faixa";
  const secs = Math.max(1.5, Math.min(8, Number(c.kickAlertSeconds) || 3));
  const word = (scored ? c.kickAlertGoalText : c.kickAlertMissText) || (scored ? "GOL!" : "PERDEU!");
  const color = c.useTeamColors && team && team.primaryColor ? team.primaryColor : c.accentColor;
  const crest = team && team.crestDataUrl ? `<img class="pa-crest" src="${esc(team.crestDataUrl)}" alt="">` : "";
  const teamName = team ? team.name : side === "away" ? "Visitante" : "Mandante";
  let extra = "";
  if (style === "explosao") {
    extra = '<i class="pa-ring"></i><i class="pa-ring r2"></i>' + Array.from({ length: 12 }, (_, i) => `<i class="pa-dot" style="--a:${i * 30}deg;--d:${70 + (i % 3) * 22}px"></i>`).join("");
  }
  if (style === "cortina") extra = '<i class="pa-half top"></i><i class="pa-half bottom"></i>';
  if (style === "brilho") extra = '<i class="pa-shine"></i>';
  clearTimeout(alertTimer);
  alertEl.className = "pen-alert";
  alertEl.innerHTML = `<div class="pa-bg"></div>${extra}<div class="pa-body" style="--pa-team:${color}">${crest}<div class="pa-text"><b class="pa-word">${esc(word)}</b><span class="pa-who">${esc(name || "")}</span><span class="pa-team">${esc(teamName)}</span></div></div>`;
  alertEl.style.setProperty("--pa-dur", secs + "s");
  void alertEl.offsetWidth;
  alertEl.classList.add("run", "pa-" + style, scored ? "goal" : "miss");
  alertTimer = setTimeout(() => { alertEl.className = "pen-alert"; alertEl.innerHTML = ""; }, secs * 1000 + 150);
}
// botão "Testar aviso" da aba Arte: usa a última cobrança real (ou um exemplo) sem registrar nada
socket.on("penalty:testAlert", ({ scored } = {}) => {
  if (!lastState) return;
  const kicks = lastState.match.shootout.kicks || [];
  const last = kicks[kicks.length - 1];
  showAlert({ side: last ? last.side : "home", scored: scored !== false, name: (last && last.playerName) || "Nome do batedor" });
});

function render() {
  if (!lastState) return;
  const c = lastState.customization.penaltis;
  const sh = lastState.match.shootout;
  applyCustomization(c);

  let kicks = sh.kicks || [];
  let visible = !!sh.visible;
  let finished = !!sh.finished, winner = sh.winner;
  const rounds = sh.rounds || 5;
  if (DEMO) {
    visible = true;
    if (kicks.length === 0) { kicks = DEMO_KICKS; finished = false; winner = null; }
  }

  titleEl.textContent = c.title || "";

  // ---- contagem por lado ----
  const kicksBy = { home: [], away: [] };
  kicks.forEach((k) => kicksBy[k.side === "away" ? "away" : "home"].push(k));
  const goals = { home: kicksBy.home.filter((k) => k.scored).length, away: kicksBy.away.filter((k) => k.scored).length };
  const total = kicks.length;
  const planned = Math.max(rounds, Math.ceil(total / 2));
  const first = sh.firstSide === "away" ? "away" : "home";
  const nextSide = finished ? null : (total % 2 === 0 ? first : first === "home" ? "away" : "home");

  const rows = ["home", "away"].map((side) => {
    const team = findTeam(lastState.match[side].teamId);
    const name = team ? team.name : side === "home" ? "Mandante" : "Visitante";
    const color = c.useTeamColors && team && team.primaryColor ? team.primaryColor : c.accentColor;
    const list = kicksBy[side];
    const n = Math.max(planned, list.length);
    const start = Math.max(0, n - MAX_SHOWN);
    let sq = "";
    for (let i = start; i < n; i++) {
      const k = list[i];
      let cls = "pen-sq";
      let inner = "";
      if (k) {
        cls += k.scored ? " goal" : " miss";
        inner = k.scored ? ICON_CHECK : ICON_X;
        if (firstSync && !seenKicks.has(k.id)) cls += " pop";
      } else if (nextSide === side && i === list.length) cls += " next";
      if (i === rounds) cls += " sd-first";
      sq += `<span class="${cls}">${inner}</span>`;
    }
    const crest = c.showCrest && team && team.crestDataUrl ? `<img class="pen-crest" src="${esc(team.crestDataUrl)}" alt="">` : "";
    return `<div class="pen-row ${nextSide === side ? "turn" : ""}" style="--pen-team:${color}">
      <div class="pen-team">${crest}<span class="pen-name">${esc(name)}</span></div>
      <div class="pen-squares">${sq}</div>
      <div class="pen-total" data-side="${side}">${goals[side]}</div>
    </div>`;
  }).join("");

  // ---- rodapé ----
  let foot = "", footCls = "pen-foot";
  const teamName = (side) => { const t = findTeam(lastState.match[side].teamId); return t ? t.name : side === "home" ? "Mandante" : "Visitante"; };
  if (finished && winner) {
    footCls += " win";
    foot = `<span class="big">${esc(teamName(winner))} vence</span><span>${goals.home} × ${goals.away}</span>`;
  } else {
    if (total >= rounds * 2) foot += `<span class="sd">Morte súbita</span>`;
    const last = kicks[kicks.length - 1];
    if (c.showShooter && last && last.playerName) {
      foot += `<span class="sub">Última cobrança: ${esc(last.playerName)} — ${last.scored ? "GOL" : "PERDEU"}</span>`;
    }
  }

  // só reescreve o DOM se mudou (evita reiniciar animações à toa)
  const rowsHtml = rows;
  const footHtml = `<div class="${footCls}">${foot}</div>`;
  if (rowsHtml !== lastRowsHtml) { rowsEl.innerHTML = rowsHtml; lastRowsHtml = rowsHtml; }
  if (footHtml !== lastFootHtml) {
    footEl.className = footCls;
    footEl.innerHTML = foot;
    lastFootHtml = footHtml;
  }

  // salto no total que mudou (só depois da primeira carga)
  if (firstSync && prevTotals) {
    ["home", "away"].forEach((s) => {
      if (goals[s] !== prevTotals[s]) { const el = rowsEl.querySelector(`.pen-total[data-side="${s}"]`); if (el) el.classList.add("bump"); }
    });
  }
  prevTotals = goals;

  // cobranças novas (só depois da primeira carga e só com o cartão no ar): dispara o aviso da última
  const fresh = kicks.filter((k) => !seenKicks.has(k.id));
  kicks.forEach((k) => seenKicks.add(k.id));
  if (firstSync && !DEMO && visible && c.kickAlert && fresh.length) {
    const k = fresh[fresh.length - 1];
    if (k.scored || !c.kickAlertOnlyGoals) showAlert({ side: k.side, scored: !!k.scored, name: k.playerName || "" });
  }

  if (penShown === null) { penShown = visible; card.classList.toggle("on", visible); } // primeira carga: sem animação
  else if (visible !== penShown) { penShown = visible; if (visible) playIn(); else playOut(); }

  if (!firstSync) {
    firstSync = true;
    // primeira renderização sem transição (F5 com a arte no ar não "anima")
    requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove("no-anim")));
  }
}
