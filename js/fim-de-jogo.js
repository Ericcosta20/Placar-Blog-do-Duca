/**
 * PÁGINA DA ARTE — FIM DE JOGO (Browser Source do OBS) — v5.0
 * ---------------------------------------------------------------
 * Placar final + quem fez os gols de cada time. Opcional: só aparece quando
 * "Mostrar no OBS" está ligado na aba Partida. A animação de entrada/saída roda
 * só quando o botão é ligado/desligado — se a página abrir com o cartão já no ar,
 * ele aparece direto, sem animação.
 */
const socket = io({ query: { kind: "arte" } });

let lastState = null;
let lastTeams = [];
let shown = null; // null = primeira carga (sem animação)
let hideTimer = null;

const $ = (id) => document.getElementById(id);
const card = $("fimCard");
// ?demo=1 (prévia da aba Arte): mostra o cartão mesmo sem estar "no ar", sem animação
const DEMO = new URLSearchParams(location.search).get("demo") === "1";

socket.on("state:sync", (s) => { lastState = s; render(); });
socket.on("teams:sync", (t) => { lastTeams = t; render(); });

const findTeam = (id) => lastTeams.find((t) => t.id === id) || null;
const esc = (str) => { const d = document.createElement("div"); d.textContent = str == null ? "" : String(str); return d.innerHTML; };

function parseHex(hex) {
  const clean = (hex || "#000000").replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  return [parseInt(full.substring(0, 2), 16) || 0, parseInt(full.substring(2, 4), 16) || 0, parseInt(full.substring(4, 6), 16) || 0];
}
const rgba = (hex, pct) => { const [r, g, b] = parseHex(hex); return `rgba(${r},${g},${b},${Math.max(0, Math.min(100, pct)) / 100})`; };
function onColor(hex) {
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const [r, g, b] = parseHex(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) > 0.3 ? "#0b0f14" : "#ffffff";
}

const BALL = `<svg class="fim-ball" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#fff" stroke="#15181f" stroke-width="1.3"/><polygon points="12,6.7 15.6,9.3 14.2,13.4 9.8,13.4 8.4,9.3" fill="#15181f"/></svg>`;

/** Gols de cada time (gol contra conta para o adversário; gol anulado fica de fora). */
function scorersBySide(match) {
  const out = { home: new Map(), away: new Map() };
  (match.events || []).forEach((ev) => {
    if (ev.type !== "goal" || ev.annulled || ev.showOnAir === false) return;
    const own = ev.goalType === "own";
    const side = own ? (ev.side === "away" ? "home" : "away") : ev.side === "away" ? "away" : "home";
    const key = `${ev.playerId}|${own ? "gc" : "g"}`;
    if (!out[side].has(key)) out[side].set(key, { name: ev.playerName || "", own, items: [] });
    out[side].get(key).items.push({ min: ev.displayMinute || ev.minute, pen: ev.goalType === "penalty" });
  });
  return out;
}

function fill(state) {
  const c = state.customization.fimDeJogo;
  const root = document.documentElement.style;
  root.setProperty("--fj-font", c.fontFamily);
  root.setProperty("--fj-width", c.width + "px");
  root.setProperty("--fj-name-size", c.nameSize + "px");
  root.setProperty("--fj-score-size", c.scoreSize + "px");
  root.setProperty("--fj-scorer-size", c.scorerSize + "px");
  root.setProperty("--fj-radius", c.borderRadius + "px");
  root.setProperty("--fj-bg-rgba", rgba(c.bgColor, c.bgOpacity));
  root.setProperty("--fj-accent", c.accentColor);
  root.setProperty("--fj-on-accent", onColor(c.accentColor));
  root.setProperty("--fj-text", c.textColor);
  document.body.classList.remove("pos-top-center", "pos-center", "pos-bottom-center");
  document.body.classList.add("pos-" + (c.position || "center"));

  const m = state.match;
  const home = findTeam(m.home.teamId), away = findTeam(m.away.teamId);
  root.setProperty("--fj-home", c.useTeamColors && home ? home.primaryColor : c.accentColor);
  root.setProperty("--fj-away", c.useTeamColors && away ? away.primaryColor : c.accentColor);

  $("fimTitle").textContent = (c.title || "FIM DE JOGO").trim() || "FIM DE JOGO";
  const comp = [state.meta.competition, state.meta.round].filter(Boolean).join(" — ");
  $("fimComp").textContent = c.showCompetition ? comp : "";
  $("fimNameHome").textContent = home ? home.name.toUpperCase() : "MANDANTE";
  $("fimNameAway").textContent = away ? away.name.toUpperCase() : "VISITANTE";
  [["fimCrestHome", home], ["fimCrestAway", away]].forEach(([id, t]) => {
    const img = $(id);
    if (c.showCrest && t && t.crestDataUrl) { if (img.getAttribute("src") !== t.crestDataUrl) img.src = t.crestDataUrl; img.style.display = "block"; }
    else img.style.display = "none";
  });
  $("fimNumHome").textContent = m.score.home;
  $("fimNumAway").textContent = m.score.away;

  const sh = m.shootout;
  const kicks = (sh && sh.kicks) || [];
  const pen = $("fimPen");
  if (c.showShootout && kicks.length) {
    const g = { home: 0, away: 0 };
    kicks.forEach((k) => { if (k.scored) g[k.side]++; });
    pen.textContent = `PÊNALTIS: ${g.home} × ${g.away}`;
    pen.hidden = false;
  } else pen.hidden = true;

  const sc = scorersBySide(m);
  const list = (side) => {
    let i = 0;
    return [...sc[side].values()].map((p) => {
      const mins = p.items.map((x) => `${esc(x.min)}'${x.pen ? " <em>(pên.)</em>" : ""}`).join(", ");
      const tag = p.own ? ` <em>(contra)</em>` : "";
      return `<li style="--i:${i++}">${side === "home" ? "" : BALL}<b>${esc(p.name)}</b>${tag}<span>${mins}</span>${side === "home" ? BALL : ""}</li>`;
    }).join("");
  };
  const showScorers = !!c.showScorers && (sc.home.size + sc.away.size) > 0;
  $("fimListHome").innerHTML = showScorers ? list("home") : "";
  $("fimListAway").innerHTML = showScorers ? list("away") : "";
  $("fimScorers").classList.toggle("empty", !showScorers);
}

/** Estilos de entrada/saída (v6.1): classes ax-in-* / ax-out-* de /css/anim-styles.css */
const IN_OK = ["classic", "fade", "slide", "slide-right", "rise", "drop", "zoom", "pop", "flip", "spin", "blur", "wipe", "wipe-down", "bounce", "none"];
const OUT_OK = ["classic", "fade", "slide", "slide-right", "rise", "drop", "zoom", "pop", "flip", "spin", "blur", "wipe", "wipe-down", "none"];
const OUT_MS = { classic: 450, fade: 450, slide: 500, "slide-right": 500, rise: 500, drop: 500, zoom: 450, pop: 500, flip: 600, spin: 600, blur: 600, wipe: 600, "wipe-down": 600, none: 0 };
const pick = (v, ok, def) => (ok.includes(v) ? v : def);
const clearAx = () => { card.className = card.className.replace(/\b(ax-(in|out)-\S+|show|leaving|no-inner|inner-soft)\b/g, "").replace(/\s+/g, " ").trim(); };

function playIn() {
  const c = (lastState && lastState.customization.fimDeJogo) || {};
  const st = pick(c.introStyle, IN_OK, "classic");
  clearTimeout(hideTimer);
  card.hidden = false;
  clearAx();
  void card.offsetWidth;
  if (st === "none") card.classList.add("no-inner");
  else {
    card.classList.add("show", "ax-in-" + st);
    // "classic" mantém a animação própria de cada parte (título, placar, escudos, autores); os outros estilos
    // movem o cartão inteiro e só deixam os autores dos gols entrarem um a um.
    if (st !== "classic") card.classList.add("inner-soft");
  }
  hideTimer = setTimeout(() => card.classList.remove("show", "ax-in-" + st), 2800);
}
function playOut(done) {
  const c = (lastState && lastState.customization.fimDeJogo) || {};
  const st = pick(c.outroStyle, OUT_OK, "classic");
  clearTimeout(hideTimer);
  clearAx();
  if (st === "none") { card.hidden = true; if (done) done(); return; }
  void card.offsetWidth;
  card.classList.add("leaving", "ax-out-" + st);
  hideTimer = setTimeout(() => { card.hidden = true; clearAx(); if (done) done(); }, (OUT_MS[st] || 450) + 30);
}

function render() {
  if (!lastState) return;
  const want = DEMO || !!(lastState.match.finalCard && lastState.match.finalCard.visible);
  if (want || shown) fill(lastState);

  if (shown === null) { shown = want; card.hidden = !want; return; } // primeira carga: sem animação
  if (want === shown) return;
  shown = want;
  if (want) playIn(); else playOut();
}

// botão "Repetir animação" da aba Arte: sai (estilo de saída) e entra de novo (estilo de entrada)
socket.on("art:replay", (target) => {
  if (target !== "fimDeJogo" || !shown || !lastState) return;
  playOut(() => setTimeout(() => { if (shown) playIn(); }, 250));
});
