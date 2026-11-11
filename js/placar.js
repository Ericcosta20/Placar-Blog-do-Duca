/**
 * PÁGINA DA ARTE — PLACAR / RELÓGIO (Browser Source do OBS)
 * ---------------------------------------------------------------
 * Página "burra": escuta "state:sync"/"teams:sync" e "clock:tick" (o
 * cronômetro tica no servidor, não no navegador — isso garante que o tempo
 * exibido é sempre o mesmo em qualquer Browser Source conectada).
 *
 * v4.1:
 *  - estilo "Broadcast" (três blocos: time · placar · time);
 *  - aviso "GOL!" cobrindo a caixa do time que marcou. Só dispara para gols
 *    NOVOS lançados como evento — nunca ao carregar/atualizar a página;
 *  - INTERVALO / FIM DE JOGO no lugar do relógio;
 *  - resultado dos pênaltis ao lado do placar: (4) 1 × 1 (3).
 *
 * v5.0:
 *  - modo COMPACTO (só a sigla do time) com transição suave;
 *  - escudo grande: ocupa ~86% da altura do placar (medido na tela);
 *  - cartões amarelos/vermelhos de cada time, acumulando;
 *  - aviso de SUBSTITUIÇÃO igual ao de GOL, com os números de quem entra e sai;
 *  - entrada/saída animada do placar (só ao ligar/desligar o módulo ou no botão
 *    "Repetir animação" — nunca ao carregar a página).
 */

const socket = io({ query: { kind: "arte" } });

let lastState = null;
let lastTeams = [];
let lastScoreKey = null; // detecta mudança de placar para o pulso
const seenEventIds = new Set();
let firstSyncDone = false;

const $ = (id) => document.getElementById(id);
const scoreboard = $("scoreboard");
const sbCompetition = $("sbCompetition");
const sbNameHome = $("sbNameHome");
const sbNameAway = $("sbNameAway");
const sbNameHomeText = sbNameHome.querySelector(".sb-name-text");
const sbNameAwayText = sbNameAway.querySelector(".sb-name-text");
const sbCrestHome = $("sbCrestHome");
const sbCrestAway = $("sbCrestAway");
const sbScore = $("sbScore");
const sbNumHome = $("sbNumHome");
const sbNumAway = $("sbNumAway");
const sbPenHome = $("sbPenHome");
const sbPenAway = $("sbPenAway");
const sbClock = $("sbClock");
const sbCenter = $("sbCenter");
const sbAddedTime = $("sbAddedTime");
const sbPeriod = $("sbPeriod");
const sbRoot = $("sbRoot");
const sbTeamHome = $("sbTeamHome");
const sbTeamAway = $("sbTeamAway");

const SB_NAME_MIN_SIZE = 9;
const PERIOD_LABELS = { "1t": "1º TEMPO", "2t": "2º TEMPO", "p1": "1ª PRORROGAÇÃO", "p2": "2ª PRORROGAÇÃO" };
const STATUS_LABELS = { intervalo: "INTERVALO", fim: "FIM DE JOGO" };

socket.on("state:sync", (state) => {
  const events = (state.match && state.match.events) || [];
  if (!firstSyncDone) {
    // primeira carga: só registra o que já existe, sem animar nada
    events.forEach((ev) => seenEventIds.add(ev.id));
    firstSyncDone = true;
  } else {
    events.forEach((ev) => {
      if (seenEventIds.has(ev.id)) return;
      seenEventIds.add(ev.id);
      if (ev.type === "goal" && ev.showOnAir !== false) triggerGoalFlash(ev, state);
      if (ev.type === "sub" && ev.showOnAir !== false) { triggerSubFlash(ev, state); showSubCounter(ev.side === "away" ? "away" : "home", state); }
    });
  }
  lastState = state;
  render();
});
socket.on("teams:sync", (teams) => {
  lastTeams = teams;
  render();
});
// teste do aviso de GOL (botão na aba Arte) — não registra nada na partida
socket.on("placar:testGoal", (side) => {
  if (!lastState) return;
  triggerGoalFlash({ type: "goal", side, goalType: "normal", playerName: "Nome do Jogador", displayMinute: "27" }, lastState, true);
});
// botão "Repetir animação de entrada" da aba Arte
socket.on("art:replay", (target) => {
  if (target !== "placar" || !lastState || !placarVisible) return;
  playIntro(lastState.customization.placar.introStyle);
});
// teste do aviso de substituição (botão na aba Arte)
socket.on("placar:testSub", (side) => {
  if (!lastState) return;
  const sd = side === "away" ? "away" : "home";
  const team = findTeam(lastState.match[sd].teamId);
  const pl = (team && team.players) || [];
  const ev = { type: "sub", side: sd, playerId: (pl[9] || {}).id, playerName: (pl[9] || {}).name || "Jogador que sai", secondaryPlayerId: (pl[12] || {}).id, secondaryPlayerName: (pl[12] || {}).name || "Jogador que entra" };
  triggerSubFlash(ev, lastState, true);
  showSubCounter(sd, lastState, true);
});
socket.on("clock:tick", ({ seconds, addedTime, period }) => {
  if (!lastState || lastState.match.statusLabel) return;
  sbClock.textContent = formatClock(seconds);
  paintAddedTime(addedTimeLabel(addedTime), !!lastState.modules.relogio);
  sbPeriod.textContent = PERIOD_LABELS[period] || "";
  sbPeriod.hidden = !PERIOD_LABELS[period] || !lastState.modules.relogio;
});

function findTeam(id) {
  return lastTeams.find((t) => t.id === id) || null;
}
const pad2 = (n) => String(n).padStart(2, "0");
function formatClock(totalSeconds) {
  return `${pad2(Math.floor(totalSeconds / 60))}:${pad2(totalSeconds % 60)}`;
}
/* ================= v5.1 — DESTAQUE DO ACRÉSCIMO ================= */
let prevAtLabel = null; // null = ainda não recebeu o primeiro estado (a 1ª leitura nunca anima)
let atBurstTimer = null;
function playAddedBurst() {
  sbAddedTime.classList.remove("at-burst");
  void sbAddedTime.offsetWidth;
  sbAddedTime.classList.add("at-burst");
  clearTimeout(atBurstTimer);
  atBurstTimer = setTimeout(() => sbAddedTime.classList.remove("at-burst"), 2100);
}
/** Mostra o acréscimo; anima quando ele aparece ou muda com o placar já no ar (nunca no carregamento). */
let atTestHold = false;
function paintAddedTime(label, clockOn, statusActive) {
  if (atTestHold) return;
  const p = lastState && lastState.customization && lastState.customization.placar;
  const mode = (p && p.addedTimeAnim) || "destaque";
  if (p) {
    const root = document.documentElement.style;
    root.setProperty("--placar-added", p.addedTimeColor || "#facc15");
    root.setProperty("--placar-on-added", onColor(p.addedTimeColor || "#facc15"));
    root.setProperty("--placar-added-glow", hexToRgba(p.addedTimeColor || "#facc15", 70));
  }
  sbAddedTime.classList.toggle("hl", mode === "destaque");
  if (sbAddedTime.textContent !== label) sbAddedTime.textContent = label;
  sbAddedTime.hidden = !label || !clockOn;
  if (statusActive) return; // INTERVALO / FIM DE JOGO: não conta como mudança do acréscimo
  if (mode !== "off" && prevAtLabel !== null && label && label !== prevAtLabel && clockOn && placarVisible) playAddedBurst();
  prevAtLabel = label;
}
socket.on("placar:testAdded", () => {
  if (!lastState || !placarVisible) return;
  if (sbAddedTime.hidden && lastState.modules.relogio) {
    atTestHold = true; sbAddedTime.textContent = "+3"; sbAddedTime.hidden = false;
    setTimeout(() => { atTestHold = false; paintAddedTime(addedTimeLabel(lastState.match.clock.addedTime), !!lastState.modules.relogio); }, 2300);
  }
  playAddedBurst();
});

/** Texto do acréscimo visual (exibido separado do relógio). */
function addedTimeLabel(addedTime) {
  if (addedTime === null || addedTime === undefined) return "";
  return `+${addedTime}`;
}

/**
 * Ajusta APENAS a fonte do nome que não coube, sem nunca alterar a largura
 * da caixa do time (fixa via --placar-box-width) nem empurrar o outro lado.
 */
function fitTeamName(textEl, baseSize) {
  const container = textEl.closest(".sb-name");
  textEl.style.fontSize = baseSize + "px";
  let size = baseSize;
  while (textEl.scrollWidth > container.clientWidth && size > SB_NAME_MIN_SIZE) {
    size -= 0.5;
    textEl.style.fontSize = size + "px";
  }
}

function parseHex(hex) {
  const clean = (hex || "#000000").replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  return [parseInt(full.substring(0, 2), 16) || 0, parseInt(full.substring(2, 4), 16) || 0, parseInt(full.substring(4, 6), 16) || 0];
}
function hexToRgba(hex, alphaPercent) {
  const [r, g, b] = parseHex(hex);
  const a = Math.max(0, Math.min(100, alphaPercent)) / 100;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
/** Cor de texto legível (branco ou quase preto) sobre uma cor de fundo. */
function onColor(hex) {
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const [r, g, b] = parseHex(hex);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.3 ? "#0b0f14" : "#ffffff";
}

/** Aplica a personalização do placar (aba Arte -> Placar) via CSS vars. */
function applyPlacarCustomization(p, homeTeam, awayTeam) {
  const root = document.documentElement.style;
  root.setProperty("--placar-font", p.fontFamily);
  root.setProperty("--placar-name-size", p.nameSize + "px");
  root.setProperty("--placar-score-size", p.scoreSize + "px");
  root.setProperty("--placar-clock-size", p.clockSize + "px");
  root.setProperty("--placar-box-width", p.boxWidth + "px");
  root.setProperty("--placar-radius", p.borderRadius + "px");
  root.setProperty("--placar-bg", p.bgColor);
  root.setProperty("--placar-bg-rgba", hexToRgba(p.bgColor, p.bgOpacity));
  root.setProperty("--placar-accent", p.accentColor);
  root.setProperty("--placar-text", p.textColor);
  const onAccent = onColor(p.accentColor);
  root.setProperty("--placar-on-accent", onAccent);
  root.setProperty("--placar-on-accent-soft", hexToRgba(onAccent, 16));

  const homeAccent = p.useTeamColors && homeTeam && homeTeam.primaryColor ? homeTeam.primaryColor : p.accentColor;
  const awayAccent = p.useTeamColors && awayTeam && awayTeam.primaryColor ? awayTeam.primaryColor : p.accentColor;
  root.setProperty("--placar-home-accent", homeAccent);
  root.setProperty("--placar-away-accent", awayAccent);

  scoreboard.classList.toggle("style-card", p.style === "card");
  scoreboard.classList.toggle("style-broadcast", p.style === "broadcast");
  document.body.classList.toggle("has-broadcast", p.style === "broadcast");

  document.body.classList.remove("pos-top-left", "pos-top-center", "pos-top-right");
  document.body.classList.add("pos-" + (p.position || "top-center"));

  // v3.2 — personalização do texto do campeonato
  root.setProperty("--placar-competition-font", p.competitionFontFamily || "Montserrat");
  root.setProperty("--placar-competition-size", (p.competitionFontSize || 15) + "px");
  root.setProperty("--placar-competition-weight", p.competitionFontWeight || 700);
  root.setProperty("--placar-competition-color", p.competitionColor || "#dbe4ff");
  root.setProperty("--placar-competition-opacity", (p.competitionOpacity ?? 100) / 100);
  root.setProperty("--placar-competition-spacing", (p.competitionSpacing ?? 6) + "px");
}

/** Sigla do time (cadastrada em Times; sem ela, as 3 primeiras letras do nome). */
function teamShort(team, fallback) {
  if (!team) return fallback;
  if (team.shortName && team.shortName.trim()) return team.shortName.trim().slice(0, 4).toUpperCase();
  return (team.name || fallback).trim().slice(0, 3).toUpperCase();
}

function setCrest(img, team) {
  if (team && team.crestDataUrl) {
    if (img.getAttribute("src") !== team.crestDataUrl) img.src = team.crestDataUrl;
    img.style.display = "block";
  } else img.style.display = "none";
}

function render() {
  if (!lastState) return;
  const { match, modules, meta, customization } = lastState;
  const p = customization.placar;
  const homeTeam = findTeam(match.home.teamId);
  const awayTeam = findTeam(match.away.teamId);

  applyPlacarCustomization(p, homeTeam, awayTeam);

  // "competitionTextOverride" preenchido sobrescreve o campeonato das Configurações
  const competitionText = (p.competitionTextOverride && p.competitionTextOverride.trim()) || (meta && meta.competition) || "";
  sbCompetition.hidden = !modules.campeonato || !competitionText;
  if (!sbCompetition.hidden) sbCompetition.textContent = competitionText;

  setPlacarShown(!!modules.placar, p);
  scoreboard.hidden = !placarVisible;
  if (placarVisible) {
    // modo compacto: só a sigla, com transição de largura
    const compact = !!p.compact;
    const compactChanged = prevCompact !== null && prevCompact !== compact;
    const showNames = modules.nomesTimes !== false;
    sbNameHome.hidden = !showNames;
    sbNameAway.hidden = !showNames;
    const setNames = () => {
      sbNameHomeText.textContent = compact ? teamShort(homeTeam, "MAN") : homeTeam ? homeTeam.name.toUpperCase() : "MANDANTE";
      sbNameAwayText.textContent = compact ? teamShort(awayTeam, "VIS") : awayTeam ? awayTeam.name.toUpperCase() : "VISITANTE";
    };
    if (compactChanged && showNames) {
      // v5.1 — corrige o "nome pequenininho" ao voltar para o completo: o tamanho da
      // fonte é calculado já na LARGURA FINAL da caixa (mede no estado novo sem
      // transição, volta ao estado antigo e só então anima — tudo no mesmo quadro).
      scoreboard.classList.add("measure");
      scoreboard.classList.toggle("compact", compact);
      setNames();
      fitTeamName(sbNameHomeText, p.nameSize);
      fitTeamName(sbNameAwayText, p.nameSize);
      scoreboard.classList.toggle("compact", !compact);
      void scoreboard.offsetWidth;
      scoreboard.classList.remove("measure");
      void scoreboard.offsetWidth;
    }
    if (compactChanged) {
      [sbNameHome, sbNameAway].forEach((el) => { el.classList.remove("name-swap"); void el.offsetWidth; el.classList.add("name-swap"); });
      clearTimeout(refitTimer);
      refitTimer = setTimeout(refitAll, 560); // confere de novo depois que a largura terminou de mudar
    }
    prevCompact = compact;
    scoreboard.classList.toggle("compact", compact);

    if (showNames) {
      setNames();
      // durante a transição a caixa ainda está mudando de largura: o ajuste já foi feito acima
      if (!compactChanged) {
        fitTeamName(sbNameHomeText, p.nameSize);
        fitTeamName(sbNameAwayText, p.nameSize);
      }
    }
    setCrest(sbCrestHome, homeTeam);
    setCrest(sbCrestAway, awayTeam);
    renderCards(match, p);
    renderSubCounters(match, p);
    layoutMetrics(p);

    const scoreKey = `${match.score.home}-${match.score.away}`;
    sbNumHome.textContent = match.score.home;
    sbNumAway.textContent = match.score.away;
    if (p.pulseOnGoal && lastScoreKey !== null && scoreKey !== lastScoreKey) {
      triggerPulse(lastScoreKey, scoreKey);
    }
    lastScoreKey = scoreKey;

    // v4.1 — resultado dos pênaltis ao lado do placar
    const sh = match.shootout;
    const showPen = !!(p.showShootoutResult && sh && sh.visible && sh.kicks && sh.kicks.length > 0);
    if (showPen) {
      const goals = { home: 0, away: 0 };
      sh.kicks.forEach((k) => { if (k.scored) goals[k.side]++; });
      sbPenHome.textContent = `(${goals.home})`;
      sbPenAway.textContent = `(${goals.away})`;
    }
    sbPenHome.hidden = !showPen;
    sbPenAway.hidden = !showPen;
  }

  // relógio / INTERVALO / FIM DE JOGO
  sbCenter.classList.toggle("no-clock", !modules.relogio);
  sbClock.hidden = !modules.relogio;
  const status = STATUS_LABELS[match.statusLabel];
  if (modules.relogio) sbClock.textContent = status || formatClock(match.clock.seconds);
  paintAddedTime(status ? "" : addedTimeLabel(match.clock.addedTime), !!modules.relogio, !!status);

  // período atual (1º TEMPO, 2º TEMPO, PRORROGAÇÃO...) — some no fim de jogo
  const periodText = match.statusLabel === "fim" ? "" : PERIOD_LABELS[match.clock.period] || "";
  sbPeriod.textContent = periodText;
  sbPeriod.hidden = !periodText || !modules.relogio;
}

/* ================= v5.0 — ESCUDO GRANDE, MODO COMPACTO E CARTÕES ================= */
let prevCompact = null;
let refitTimer = null;

function refitAll() {
  if (!lastState || !placarVisible || lastState.modules.nomesTimes === false) return;
  const p = lastState.customization.placar;
  fitTeamName(sbNameHomeText, p.nameSize);
  fitTeamName(sbNameAwayText, p.nameSize);
  layoutMetrics(p);
}

/** Escudo ≈ crestScale% da altura do placar (medida real) e posição dos cartões. */
function layoutMetrics(p) {
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty("--placar-compact-width", (p.compactBoxWidth || 190) + "px");
  const teamMin = parseFloat(getComputedStyle(sbTeamHome).minHeight) || 0;
  const H = Math.max(sbCenter.offsetHeight, teamMin);
  if (H > 0) {
    const size = Math.max(16, Math.floor(H * Math.min(98, Math.max(30, Number(p.crestScale) || 86)) / 100));
    rootStyle.setProperty("--sb-crest", size + "px");
  }
  rootStyle.setProperty("--sb-card-scale", String((Number(p.cardScale) || 100) / 100));
  // cartões ficam logo abaixo do nome, alinhados com ele
  [[sbTeamHome, sbCrestHome, "home"], [sbTeamAway, sbCrestAway, "away"]].forEach(([box, crest, side]) => {
    const cards = $(side === "home" ? "sbCardsHome" : "sbCardsAway");
    const gap = 10;
    let off;
    if (crest.style.display === "none") off = parseFloat(getComputedStyle(box)[side === "home" ? "paddingLeft" : "paddingRight"]) || 16;
    else off = side === "home" ? crest.offsetLeft + crest.offsetWidth + gap : box.clientWidth - crest.offsetLeft - gap;
    cards.style[side === "home" ? "left" : "right"] = Math.max(0, off) + "px";
    cards.style[side === "home" ? "right" : "left"] = "auto";
  });
}

const CARD_Y = `<svg class="sb-card" viewBox="0 0 24 24"><rect x="3" y="1" width="18" height="22" rx="3" fill="#eab308"/></svg>`;
const CARD_R = `<svg class="sb-card" viewBox="0 0 24 24"><rect x="3" y="1" width="18" height="22" rx="3" fill="#ef4444"/></svg>`;
const prevCards = { home: null, away: null };
/** Amarelos e vermelhos de cada time (cada cartão lançado vira um ícone). */
function renderCards(match, p) {
  ["home", "away"].forEach((side) => {
    const el = $(side === "home" ? "sbCardsHome" : "sbCardsAway");
    if (!p.showCards) { el.innerHTML = ""; el.hidden = true; prevCards[side] = null; return; }
    el.hidden = false;
    const evs = (match.events || []).filter((e) => e.side === side && e.showOnAir !== false);
    const y = evs.filter((e) => e.type === "yellow").length;
    const r = evs.filter((e) => e.type === "red").length;
    const prev = prevCards[side];
    const icons = (n, svg, kind) => {
      const shown = Math.min(n, 5);
      let h = "";
      for (let i = 0; i < shown; i++) {
        const isNew = prev && ((kind === "y" && n > prev.y && i === shown - 1) || (kind === "r" && n > prev.r && i === shown - 1));
        h += svg.replace('class="sb-card"', `class="sb-card${isNew ? " pop" : ""}"`);
      }
      if (n > 5) h += `<b class="sb-card-more">+${n - 5}</b>`;
      return h;
    };
    const html = icons(y, CARD_Y, "y") + icons(r, CARD_R, "r");
    if (el._html !== html) { el.innerHTML = html; el._html = html; }
    prevCards[side] = { y, r };
  });
}

/* ================= v5.0 — ENTRADA / SAÍDA DO PLACAR ================= */
let placarShown = null;      // null = ainda não renderizou (primeira carga nunca anima)
let placarVisible = false;   // continua true durante a animação de saída
let outroTimer = null;
let introTimer = null;

function playIntro(style) {
  if (!style || style === "none") return;
  clearTimeout(introTimer);
  sbRoot.dataset.intro = style;
  sbRoot.classList.remove("intro");
  void sbRoot.offsetWidth; // reflow: permite repetir
  sbRoot.classList.add("intro");
  introTimer = setTimeout(() => sbRoot.classList.remove("intro"), 2400);
}
function setPlacarShown(want, p) {
  if (placarShown === null) { placarShown = want; placarVisible = want; return; }
  if (want === placarShown) return;
  placarShown = want;
  clearTimeout(outroTimer);
  if (want) {
    sbRoot.classList.remove("outro");
    placarVisible = true;
    scoreboard.hidden = false;
    playIntro(p.introStyle);
  } else if (p.outroEnabled && p.introStyle && p.introStyle !== "none") {
    clearTimeout(introTimer);
    sbRoot.classList.remove("intro");
    sbRoot.dataset.intro = p.introStyle;
    sbRoot.classList.add("outro");
    outroTimer = setTimeout(() => {
      placarVisible = false; sbRoot.classList.remove("outro");
      scoreboard.hidden = true;
    }, 620);
  } else {
    placarVisible = false;
  }
}

function triggerPulse(prevKey, newKey) {
  [sbScore, sbCenter].forEach((el) => {
    el.classList.remove("pulse");
    void el.offsetWidth; // reflow: permite reiniciar a animação em pulsos seguidos
    el.classList.add("pulse");
  });
  // salto só no número que mudou
  const [ph, pa] = prevKey.split("-");
  const [nh, na] = newKey.split("-");
  [[sbNumHome, ph !== nh], [sbNumAway, pa !== na]].forEach(([el, changed]) => {
    if (!changed) return;
    el.classList.remove("bump");
    void el.offsetWidth;
    el.classList.add("bump");
  });
}

/* ================= AVISO "GOL!" ================= */
const flashTimers = { home: null, away: null };

function triggerGoalFlash(ev, state, isTest = false) {
  const p = state.customization.placar;
  if (!isTest && (!p.goalFlashEnabled || !state.modules.placar)) return;
  if (isTest && !state.modules.placar) return;
  // no gol contra, o aviso aparece no time que RECEBEU o gol
  const side = ev.goalType === "own" ? (ev.side === "away" ? "home" : "away") : ev.side === "away" ? "away" : "home";
  const el = $(side === "home" ? "sbGoalHome" : "sbGoalAway");
  const team = findTeam(state.match[side].teamId);

  const useTeam = p.goalFlashUseTeamColor && team && team.primaryColor;
  const bg = useTeam ? team.primaryColor : p.goalFlashColor;
  el.style.setProperty("--gf-bg", bg);
  el.style.setProperty("--gf-text", useTeam ? onColor(bg) : p.goalFlashTextColor);

  el.querySelector(".sb-goal-text").textContent = (p.goalFlashText || "GOL").trim() || "GOL";
  let scorer = "";
  if (p.goalFlashShowScorer && ev.playerName) {
    const tag = ev.goalType === "penalty" ? " (pênalti)" : ev.goalType === "own" ? " (contra)" : "";
    scorer = `${ev.playerName}${tag} ${ev.displayMinute || ev.minute}'`;
  }
  el.querySelector(".sb-goal-scorer").textContent = scorer;

  // reinicia a animação se vier outro gol antes do anterior terminar
  clearTimeout(flashTimers[side]);
  el.classList.remove("show", "leaving");
  void el.offsetWidth;
  el.classList.add("show");
  const hold = Math.max(1500, Number(p.goalFlashDurationMs) || 4000);
  flashTimers[side] = setTimeout(() => {
    el.classList.remove("show");
    el.classList.add("leaving");
    flashTimers[side] = setTimeout(() => el.classList.remove("leaving"), 460);
  }, hold);
}

/* ================= v5.0 — AVISO DE SUBSTITUIÇÃO ================= */
const subTimers = { home: null, away: null };

function triggerSubFlash(ev, state, isTest = false) {
  const p = state.customization.placar;
  if (!state.modules.placar || !placarVisible) return;
  if (!isTest && !p.subFlashEnabled) return;
  const side = ev.side === "away" ? "away" : "home";
  const el = $(side === "home" ? "sbSubHome" : "sbSubAway");
  const team = findTeam(state.match[side].teamId);
  const ec = state.customization.eventos || {};
  const inColor = ec.subInColor || "#22c55e", outColor = ec.subOutColor || "#ef4444";
  const num = (id) => {
    const pl = team && team.players ? team.players.find((x) => x.id === id) : null;
    return pl && pl.number !== undefined && pl.number !== null ? String(pl.number) : "";
  };
  const fill = (row, color, id, name) => {
    row.style.background = color;
    row.style.color = onColor(color);
    row.querySelector(".sb-sub-num").textContent = num(id);
    row.querySelector(".sb-sub-name").textContent = p.subFlashShowNames === false ? "" : name || "";
  };
  fill(el.querySelector(".sb-sub-in"), inColor, ev.secondaryPlayerId, ev.secondaryPlayerName);
  fill(el.querySelector(".sb-sub-out"), outColor, ev.playerId, ev.playerName);
  el.classList.toggle("no-names", p.subFlashShowNames === false);

  clearTimeout(subTimers[side]);
  el.classList.remove("show", "leaving");
  void el.offsetWidth;
  el.classList.add("show");
  const hold = Math.max(1500, Number(p.subFlashDurationMs) || 5000);
  subTimers[side] = setTimeout(() => {
    el.classList.remove("show");
    el.classList.add("leaving");
    subTimers[side] = setTimeout(() => el.classList.remove("leaving"), 460);
  }, hold);
}

window.addEventListener("resize", () => {
  if (lastState && lastState.modules.placar && lastState.modules.nomesTimes !== false) {
    const p = lastState.customization.placar;
    fitTeamName(sbNameHomeText, p.nameSize);
    fitTeamName(sbNameAwayText, p.nameSize);
  }
});

// quando as fontes terminam de carregar a altura do placar muda: recalcula o escudo
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => refitAll());

// a altura do placar muda (fontes, relógio ligado/desligado, tamanho dos números): o escudo acompanha
if (window.ResizeObserver) {
  new ResizeObserver(() => {
    if (lastState && placarVisible) layoutMetrics(lastState.customization.placar);
  }).observe(sbCenter);
}


/* ================= v6.0 — CONTADOR DE SUBSTITUIÇÕES ================= */
const SUB_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h13M13.5 4.5L17 8l-3.5 3.5"/><path d="M20 16H7M10.5 12.5L7 16l3.5 3.5"/></svg>`;
const subCountPrev = { home: null, away: null };
const subCountTimers = { home: null, away: null };
const subCountForce = { home: false, away: false };   // aparece por tempo limitado (modo "a cada substituição")
const subCountDemo = { home: null, away: null };      // prévia do botão "Testar"

function subCountEls(side) { return $(side === "home" ? "sbSubCountHome" : "sbSubCountAway"); }

/** Desenha os marcadores de cada time e decide se o contador está visível. */
function renderSubCounters(match, p) {
  const mode = p.subCounterMode || "event";
  const max = Math.max(1, Math.min(9, Number(p.subCounterMax) || 5));
  const ec = (lastState && lastState.customization.eventos) || {};
  const color = ec.subColor || "#0ea5e9";
  document.documentElement.style.setProperty("--sb-sub-color", color);
  document.documentElement.style.setProperty("--sb-sub-on", onColor(color));
  ["home", "away"].forEach((side) => {
    const el = subCountEls(side);
    const real = (match.events || []).filter((e) => e.type === "sub" && e.side === side).length;
    const n = subCountDemo[side] !== null ? subCountDemo[side] : real;
    const prev = subCountPrev[side];
    const isNew = prev !== null && real > prev && subCountDemo[side] === null;
    let sq = "";
    for (let i = 0; i < max; i++) sq += `<span class="sb-sq${i < n ? " used" : ""}${isNew && i === n - 1 ? " pop" : ""}">${i < n ? SUB_ICON : ""}</span>`;
    const html = `<span class="lbl">Subst.</span><span class="sqs">${sq}</span><span class="tot">${n}/${max}</span>`;
    if (el._html !== html) { el.innerHTML = html; el._html = html; }
    el.classList.toggle("full", n >= max);
    subCountPrev[side] = real;
    const visible = mode !== "off" && (mode === "always" ? n > 0 || subCountDemo[side] !== null : subCountForce[side]);
    el.classList.toggle("show", visible);
  });
}

/** Modo "a cada substituição": mostra o contador junto do aviso de substituição e depois esconde. */
function showSubCounter(side, state, isTest = false) {
  const p = state.customization.placar;
  if (!state.modules.placar || !placarVisible || (p.subCounterMode || "event") === "off") return;
  if (isTest) subCountDemo[side] = 3;
  subCountForce[side] = true;
  renderSubCounters(state.match, p);
  clearTimeout(subCountTimers[side]);
  const hold = Math.max(1500, Number(p.subFlashDurationMs) || 5000) + Math.max(0, Number(p.subCounterExtraMs) || 0);
  subCountTimers[side] = setTimeout(() => {
    subCountForce[side] = false;
    subCountDemo[side] = null;
    if (lastState) renderSubCounters(lastState.match, lastState.customization.placar);
  }, hold);
}
