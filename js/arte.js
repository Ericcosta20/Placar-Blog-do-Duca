/**
 * PÁGINA DA ARTE — ESCALAÇÃO (Browser Source do OBS)
 * ---------------------------------------------------------------
 * Página "burra": escuta "state:sync" (partida/customização) e "teams:sync"
 * (cadastro de times) e renderiza a escalação do mandante e do visitante.
 * Toda a lógica de edição fica no painel.
 *
 * v5.0:
 *  - substituição com animação longa: faixa "SAI" → "ENTRA" sobre a linha do jogador;
 *  - reservas (banco) num segundo painel do mesmo tamanho, com as mesmas marcações;
 *  - tamanho das marcações (gol/cartão) ajustável;
 *  - jogador expulso fica com a linha escura;
 *  - nome de quem fez o gol pisca;
 *  - entrada/saída animada ao ligar/desligar o módulo (nunca ao carregar a página).
 *
 * v5.1:
 *  - reservas por time (modules.reservasHome/Away): ocupam o LUGAR dos titulares — os titulares
 *    deslizam para o lado e a lista de reservas entra; com mais reservas que linhas, a lista
 *    sobe em páginas e repete enquanto estiver no ar; ao desligar, tudo volta;
 *  - ícone de substituição (e número de quem saiu) na linha de quem entrou.
 *
 * Animações "em andamento" ficam registradas em `fx` (com o horário de início):
 * se a tela for redesenhada no meio da animação (outra mudança chegou), ela
 * continua de onde estava em vez de reiniciar ou sumir.
 */

const socket = io({ query: { kind: "arte" } });

const root = document.documentElement;
const artWrapper = document.getElementById("artWrapper");

let lastState = null;
let lastTeams = [];

// rastreia quais eventos já foram "vistos": animações só para eventos novos,
// e nunca ao carregar/recarregar a Browser Source.
let seenEventIds = new Set();
let firstEventsSyncDone = false;

/** Animações em andamento: { sub|flash|blink: Map(playerId -> { start, dur, ... }) } */
const fx = { sub: new Map(), flash: new Map(), blink: new Map(), sentOff: new Map() };
const FLASH_MS = 900;
const BLINK_MS = 3600;
const SENTOFF_MS = 1400;

function takeFreshEvents() {
  if (!lastState) return [];
  const events = lastState.match.events || [];
  if (!firstEventsSyncDone) {
    events.forEach((e) => seenEventIds.add(e.id));
    firstEventsSyncDone = true;
    return [];
  }
  const fresh = events.filter((e) => !seenEventIds.has(e.id));
  events.forEach((e) => seenEventIds.add(e.id));
  return fresh;
}

/* ---------- ícones de eventos (SVG próprio, não emoji do sistema) ---------- */
const ICON_GOAL = `<svg class="ev-icon-svg m-goal" viewBox="0 0 24 24" width="13" height="13"><circle cx="12" cy="12" r="10" fill="#fff" stroke="#15181f" stroke-width="1.3"/><polygon points="12,6.7 15.6,9.3 14.2,13.4 9.8,13.4 8.4,9.3" fill="#15181f"/></svg>`;
const ICON_YELLOW = `<svg class="ev-icon-svg m-card" viewBox="0 0 24 24" width="10" height="14"><rect x="3" y="1" width="18" height="22" rx="3" fill="#eab308"/></svg>`;
const ICON_RED = `<svg class="ev-icon-svg m-card" viewBox="0 0 24 24" width="10" height="14"><rect x="3" y="1" width="18" height="22" rx="3" fill="#ef4444"/></svg>`;
const ICON_BY_TYPE = { goal: ICON_GOAL, yellow: ICON_YELLOW, red: ICON_RED };
const ARROW_UP = `<svg class="sub-arrow" viewBox="0 0 24 24"><path d="M12 3l8 9h-5v9H9v-9H4z" fill="currentColor"/></svg>`;
const ARROW_DOWN = `<svg class="sub-arrow" viewBox="0 0 24 24"><path d="M12 21l-8-9h5V3h6v9h5z" fill="currentColor"/></svg>`;
const ICON_SUB = `<svg class="ev-icon-svg m-sub" viewBox="0 0 24 24"><path d="M8 2.5l5.2 6.5H9.6v12.5H6.4V9H2.8z" fill="#22c55e"/><path d="M16 21.5L10.8 15h3.6V2.5h3.2V15h3.6z" fill="#ef4444"/></svg>`;
const ARROW_DOWN_SMALL = `<svg class="out-arrow" viewBox="0 0 24 24"><path d="M12 21l-8-9h5V3h6v9h5z" fill="currentColor"/></svg>`;

socket.on("state:sync", (state) => {
  lastState = state;
  render();
});
socket.on("teams:sync", (teams) => {
  lastTeams = teams;
  render();
});
// botão "Repetir animação de entrada" da aba Arte
socket.on("art:replay", (target) => {
  if (target !== "escalacao" || !lastState || artWrapper.hidden) return;
  playIntro(lastState.customization.introStyle);
});

function findTeam(id) {
  return lastTeams.find((t) => t.id === id) || null;
}

/* ---------- ENTRADA / SAÍDA DO MÓDULO ---------- */
let shown = null; // null = ainda não renderizou (a primeira carga nunca anima)
let outroTimer = null;
let introTimer = null;

function playIntro(style) {
  if (!style || style === "none") return;
  clearTimeout(introTimer);
  artWrapper.dataset.intro = style;
  artWrapper.classList.remove("intro");
  void artWrapper.offsetWidth; // reflow: permite repetir a animação
  artWrapper.classList.add("intro");
  introTimer = setTimeout(() => artWrapper.classList.remove("intro"), 2600);
}

function setShown(want, c) {
  if (shown === null) { shown = want; artWrapper.hidden = !want; return; }
  if (want === shown) return;
  shown = want;
  clearTimeout(outroTimer);
  if (want) {
    artWrapper.classList.remove("outro");
    artWrapper.hidden = false;
    playIntro(c.introStyle);
  } else if (c.outroEnabled && c.introStyle && c.introStyle !== "none") {
    clearTimeout(introTimer);
    artWrapper.classList.remove("intro");
    artWrapper.dataset.intro = c.introStyle;
    artWrapper.classList.add("outro");
    outroTimer = setTimeout(() => { artWrapper.hidden = true; artWrapper.classList.remove("outro"); }, 650);
  } else {
    artWrapper.hidden = true;
  }
}

function render() {
  if (!lastState) return;
  const c = lastState.customization;
  const wantShown = !!lastState.modules.escalacao;

  // eventos novos são sempre "consumidos" (mesmo com o módulo desligado), para
  // nunca animar coisa antiga quando ele for ligado.
  const fresh = takeFreshEvents();
  const now = Date.now();
  if (wantShown) registerFx(fresh, now);

  setShown(wantShown, c);
  if (!wantShown) return;

  applySharedCustomizationVariables(c);
  applyEffectClasses(c.effects);

  renderSide("Home", lastState.match.home, findTeam(lastState.match.home.teamId), c, !!lastState.modules.reservasHome, now);
  renderSide("Away", lastState.match.away, findTeam(lastState.match.away.teamId), c, !!lastState.modules.reservasAway, now);
  cleanupFx(now);
}

/** Registra as animações dos eventos novos (gol, cartão, substituição). */
function registerFx(fresh, now) {
  const c = lastState.customization;
  fresh.forEach((ev) => {
    if (ev.showOnAir === false) return;
    const side = ev.side === "away" ? "away" : "home";
    const key = side + ":";
    if (ev.type === "goal" || ev.type === "yellow" || ev.type === "red") {
      fx.flash.set(key + ev.playerId, { start: now, dur: FLASH_MS });
      if (ev.type === "goal" && ev.goalType !== "own" && c.scorerBlink) fx.blink.set(key + ev.playerId, { start: now, dur: BLINK_MS });
      if (ev.type === "red") fx.sentOff.set(key + ev.playerId, { start: now, dur: SENTOFF_MS });
    } else if (ev.type === "sub" && ev.secondaryPlayerId) {
      fx.sub.set(key + ev.secondaryPlayerId, {
        start: now, dur: Math.max(1500, Number(c.subAnimationMs) || 5000),
        outId: ev.playerId, outName: ev.playerName || "",
      });
    }
  });
}
function cleanupFx(now) {
  Object.values(fx).forEach((map) => map.forEach((v, k) => { if (now - v.start >= v.dur + 100) map.delete(k); }));
}
/** Devolve "-123ms" (deslocamento para continuar uma animação já em andamento) ou null se acabou. */
function fxOffset(map, key, now) {
  const v = map.get(key);
  if (!v) return null;
  const elapsed = now - v.start;
  return elapsed < v.dur ? { v, off: `-${Math.max(0, elapsed)}ms` } : null;
}

/* ---------- VARIÁVEIS CSS COMPARTILHADAS (tipografia/espaçamento) ---------- */
function applySharedCustomizationVariables(c) {
  root.style.setProperty("--font-family", `'${c.fontFamily.replace(/'/g, "")}', sans-serif`);
  root.style.setProperty("--name-size", c.nameSize + "px");
  root.style.setProperty("--number-size", c.numberSize + "px");
  root.style.setProperty("--team-name-size", c.teamNameSize + "px");

  root.style.setProperty("--line-spacing", c.lineSpacing + "px");
  root.style.setProperty("--row-height", c.rowHeight + "px");
  root.style.setProperty("--inner-padding", c.innerPadding + "px");
  root.style.setProperty("--border-radius", c.borderRadius + "px");

  root.style.setProperty("--art-width", c.artWidth + "px");
  root.style.setProperty("--margin-top", c.marginTop + "px");
  root.style.setProperty("--margin-left", c.marginLeft + "px");

  root.style.setProperty("--crest-size", c.crestSize + "px");
  root.style.setProperty("--crest-gap", c.crestGap + "px");
  root.style.setProperty("--topbar-thickness", c.topBarThickness + "px");
  root.style.setProperty("--divider-thickness", c.dividerThickness + "px");

  root.style.setProperty("--divider-alpha", c.dividerOpacity / 100);
  root.style.setProperty("--bg-opacity-pct", c.bgOpacity + "%");

  // v5.0
  root.style.setProperty("--marker-scale", String((Number(c.markerSize) || 100) / 100));
  root.style.setProperty("--sub-d", Math.max(1500, Number(c.subAnimationMs) || 5000) + "ms");
}

function applyEffectClasses(effects) {
  ["Home", "Away"].forEach((suffix) => {
    const containers = [document.getElementById("artContainer" + suffix), document.getElementById("artBench" + suffix)];
    const topbar = document.getElementById("artTopbar" + suffix);
    containers.forEach((container) => {
      container.classList.toggle("effect-shadow", !!effects.shadow);
      container.classList.toggle("effect-outline", !!effects.outline);
      container.classList.toggle("effect-glow", !!effects.glow);
      container.classList.toggle("effect-translucent", !!effects.translucentBg);
    });
    topbar.classList.toggle("effect-gradient", !!effects.gradient);
    document.querySelector(`#artBench${suffix} .art-topbar`).classList.toggle("effect-gradient", !!effects.gradient);
  });
}

/* ---------- LINHA DE JOGADOR ---------- */
function buildRow({ player, idx, team, matchSide, sideKey, sideEvents, useSeparators, now, isBench, custom }) {
  const row = document.createElement("div");
  row.className = "art-player-row" + (useSeparators ? " has-separators" : "");
  row.style.setProperty("--i", idx);
  const key = sideKey + ":" + player.id;
  const stats = (matchSide.lineupStats || {})[player.id] || {};

  const isCaptain = !isBench && matchSide.captainId === player.id;
  const captainBadge = isCaptain ? `<span class="art-captain">${escapeHtml(team.captainSymbol || "(C)")}</span>` : "";

  // ícones de gol/amarelo/vermelho à direita do nome (contêiner à parte: nunca mexe no alinhamento)
  const playerEvents = sideEvents.filter((ev) => ev.playerId === player.id).slice(0, 6);
  // v5.1 — ícone de substituição na linha de quem entrou (+ número de quem saiu)
  let subHtml = "";
  if (!isBench && custom && custom.subMarker !== false && stats.enteredGame) {
    let fromNum = "";
    if (custom.subMarkerShowOut !== false) {
      const subEv = [...(lastState.match.events || [])].reverse().find((e) => e.type === "sub" && e.side === sideKey && e.secondaryPlayerId === player.id);
      const outP = subEv && (team.players || []).find((p) => p.id === subEv.playerId);
      if (outP) fromNum = `<span class="sub-from">${ARROW_DOWN_SMALL}${String(outP.number).padStart(2, "0")}</span>`;
    }
    subHtml = `<span class="sub-marker" title="Entrou na partida">${ICON_SUB}${fromNum}</span>`;
  }
  const iconsHtml = (playerEvents.length || subHtml)
    ? `<span class="art-event-icons">${subHtml}${playerEvents.map((ev) => ICON_BY_TYPE[ev.type] || "").join("")}</span>` : "";
  const outTag = isBench && stats.substituted ? `<span class="art-out-tag" title="Já saiu">${ARROW_DOWN_SMALL}</span>` : "";

  row.innerHTML = `
    <span class="art-number">${String(player.number).padStart(2, "0")}</span>
    <span class="art-name">${escapeHtml(player.name)}</span>
    ${outTag}${iconsHtml}${captainBadge}`;

  // jogador expulso: linha escura
  if ((stats.redCards || 0) > 0) {
    row.classList.add("is-sent-off");
    const so = fxOffset(fx.sentOff, key, now);
    if (so) { row.classList.add("just-sent-off"); row.style.setProperty("--so-off", so.off); }
  }
  if (isBench && stats.substituted) row.classList.add("is-out");

  // flash de gol/cartão (continua se a tela for redesenhada no meio)
  const fl = fxOffset(fx.flash, key, now);
  if (fl) { row.classList.add("event-flash"); row.style.setProperty("--flash-off", fl.off); }

  // nome de quem fez o gol pisca
  const bl = fxOffset(fx.blink, key, now);
  if (bl) { row.querySelector(".art-name").classList.add("name-blink"); row.style.setProperty("--blink-off", bl.off); }

  // substituição: faixa SAI -> ENTRA sobre a linha de quem entrou
  const sb = !isBench ? fxOffset(fx.sub, key, now) : null;
  if (sb) {
    const outPlayer = (team.players || []).find((p) => p.id === sb.v.outId);
    const outNum = outPlayer ? String(outPlayer.number).padStart(2, "0") : "";
    const outName = outPlayer ? outPlayer.name : sb.v.outName;
    row.classList.add("sub-enter");
    row.style.setProperty("--sub-off", sb.off);
    const ov = document.createElement("div");
    ov.className = "sub-overlay";
    ov.innerHTML = `
      <div class="sub-layer sub-out">${ARROW_DOWN}<b>SAI</b><i>${outNum}</i><span>${escapeHtml(outName)}</span></div>
      <div class="sub-layer sub-in">${ARROW_UP}<b>ENTRA</b><i>${String(player.number).padStart(2, "0")}</i><span>${escapeHtml(player.name)}</span></div>`;
    row.appendChild(ov);
  }
  return row;
}

/* ---------- RENDERIZA UM LADO (mandante ou visitante) ---------- */
function renderSide(suffix, matchSide, team, customization, showBench, now) {
  const sideKey = suffix === "Home" ? "home" : "away";
  const side = document.getElementById("artSide" + suffix);
  const container = document.getElementById("artContainer" + suffix);
  const bench = document.getElementById("artBench" + suffix);
  const crestEl = document.getElementById("artCrest" + suffix);
  const nameEl = document.getElementById("artTeamName" + suffix);
  const lineupEl = document.getElementById("artLineup" + suffix);
  const benchList = document.getElementById("artBenchList" + suffix);

  if (!team) {
    side.hidden = true;
    return;
  }
  side.hidden = false;

  // cores do time valem para os dois painéis (titulares e reservas)
  const vars = {
    "--team-primary": team.primaryColor, "--team-secondary": team.secondaryColor, "--text-color": team.textColor,
    "--number-color": team.numberColor, "--bg-color": team.bgColor, "--divider-color": team.dividerColor,
    "--captain-color": team.captainColor, "--shadow-color": team.shadowColor,
  };
  Object.entries(vars).forEach(([k, v]) => side.style.setProperty(k, v));

  const bgAlpha = (1 - customization.bgTransparency / 100) * (customization.bgOpacity / 100);
  const bg = bgAlpha <= 0 ? "transparent" : `color-mix(in srgb, ${team.bgColor} ${Math.round(bgAlpha * 100)}%, transparent)`;
  container.style.background = bg;
  bench.style.background = bg;

  nameEl.textContent = team.name ? team.name.toUpperCase() : "NOME DO TIME";
  if (team.crestDataUrl) {
    crestEl.src = team.crestDataUrl;
    crestEl.style.display = "block";
  } else {
    crestEl.style.display = "none";
  }

  const byId = (id) => (team.players || []).find((p) => p.id === id);
  const starters = matchSide.starterIds.map(byId).filter(Boolean);

  // eventos de gol/cartão deste lado (ícones) — vêm da mesma fonte de verdade (match.events)
  const sideEvents = (lastState.match.events || [])
    .filter((ev) => ev.side === sideKey && ["goal", "yellow", "red"].includes(ev.type) && ev.showOnAir !== false && ev.goalType !== "own" && !ev.annulled);
  const useSeparators = !!customization.effects.separators;
  const common = { team, matchSide, sideKey, sideEvents, useSeparators, now, custom: customization };

  lineupEl.innerHTML = "";
  if (starters.length === 0) {
    lineupEl.innerHTML = `<p class="art-empty-msg">Nenhum titular escalado ainda.</p>`;
  } else {
    starters.forEach((player, idx) => lineupEl.appendChild(buildRow({ ...common, player, idx })));
  }

  // reservas: quem está no banco (e ainda não entrou) + quem já saiu (cinza, com seta)
  const benchPlayers = [];
  (matchSide.benchIds || []).forEach((id) => {
    const p = byId(id);
    if (p && !matchSide.starterIds.includes(id)) benchPlayers.push(p);
  });
  Object.entries(matchSide.lineupStats || {}).forEach(([id, st]) => {
    const p = byId(id);
    if (p && st && st.substituted && !matchSide.starterIds.includes(id) && !benchPlayers.includes(p)) benchPlayers.push(p);
  });
  const wantBench = showBench && benchPlayers.length > 0;
  const swapMode = customization.benchMode !== "below";
  const trackEl = document.getElementById("artBenchTrack" + suffix);
  const benchTitle = (customization.benchTitle || "RESERVAS").toUpperCase();

  // --- modo "embaixo" (v5.0): segundo painel do mesmo tamanho ---
  bench.hidden = swapMode || !wantBench;
  if (!swapMode && wantBench) {
    document.getElementById("artBenchTitle" + suffix).textContent = benchTitle;
    benchList.innerHTML = "";
    benchPlayers.forEach((player, idx) => benchList.appendChild(buildRow({ ...common, player, idx: idx + starters.length, isBench: true })));
  }

  // --- modo "trocar" (v5.1): os reservas entram no lugar dos titulares ---
  trackEl.innerHTML = "";
  if (swapMode) {
    benchPlayers.forEach((player, idx) => trackEl.appendChild(buildRow({ ...common, player, idx, isBench: true })));
    document.getElementById("artBenchTag" + suffix).textContent = benchTitle;
  }
  updateBenchSwap(sideKey, container, trackEl, swapMode && wantBench, customization);
}

/* ---------- RESERVAS NO LUGAR DOS TITULARES (v5.1) ---------- */
const benchState = { home: { on: false, start: 0, sig: "", anim: null, stopTimer: null, ready: false }, away: { on: false, start: 0, sig: "", anim: null, stopTimer: null, ready: false } };

function updateBenchSwap(sideKey, container, track, want, c) {
  const st = benchState[sideKey];
  // primeira renderização do lado: posiciona sem animar (recarregar a Browser Source nunca anima)
  if (!st.ready) {
    st.ready = true;
    container.classList.add("no-anim");
    requestAnimationFrame(() => requestAnimationFrame(() => container.classList.remove("no-anim")));
  }
  if (want && !st.on) { st.on = true; st.start = Date.now(); }
  if (!want && st.on) { st.on = false; }
  container.classList.toggle("show-bench", want);

  if (want) {
    clearTimeout(st.stopTimer);
    st.stopTimer = null;
    syncBenchScroll(st, track.parentElement, track, c);
  } else if (st.anim && !st.stopTimer) {
    // deixa a lista de reservas terminar de sair e só então para a rolagem
    st.stopTimer = setTimeout(() => { if (st.anim) { st.anim.cancel(); st.anim = null; st.sig = ""; } st.stopTimer = null; }, 900);
  }
}

/**
 * Com mais reservas do que linhas visíveis (ex.: 15 reservas e 11 linhas), a lista sobe em páginas:
 * pausa -> sobe -> pausa ... -> some rapidinho e recomeça. Roda em loop enquanto os reservas estiverem no ar.
 * A animação continua do ponto onde estava quando a tela é redesenhada por outra mudança.
 */
function syncBenchScroll(st, pane, track, c) {
  const viewH = pane.clientHeight;
  const contentH = track.scrollHeight;
  const rows = Array.from(track.children);
  const hold = Math.max(1500, Number(c.benchPageMs) || 4000);
  const sig = [rows.length, viewH, contentH, hold].join("|");
  if (st.sig === sig && st.anim) return;
  if (st.anim) { st.anim.cancel(); st.anim = null; }
  st.sig = sig;
  track.style.transform = "";
  track.style.opacity = "";
  const overflow = contentH - viewH;
  if (overflow <= 2 || rows.length < 2 || !track.animate) return; // cabe tudo: lista parada

  // deslocamentos de cada página (sempre alinhados ao topo de uma linha; a última termina rente ao rodapé)
  const offsets = [0];
  while (offsets[offsets.length - 1] < overflow - 1) {
    const last = offsets[offsets.length - 1];
    const next = rows.find((r) => r.offsetTop + r.offsetHeight > last + viewH + 1);
    offsets.push(Math.min(overflow, next ? next.offsetTop : overflow));
  }
  const SLIDE = 750, FADE = 280;
  const total = offsets.length * hold + (offsets.length - 1) * SLIDE + FADE * 2;
  const frames = [];
  let t = 0;
  const at = (ms, y, o, easing) => frames.push({ offset: Math.min(1, ms / total), transform: `translateY(${-y}px)`, opacity: o, easing: easing || "linear" });
  at(0, 0, 1);
  offsets.forEach((y, i) => {
    t += hold; at(t, y, 1, "cubic-bezier(.65,0,.25,1)");
    if (i < offsets.length - 1) { t += SLIDE; at(t, offsets[i + 1], 1); }
  });
  t += FADE; at(t, offsets[offsets.length - 1], 0);
  at(Math.min(total, t + 1), 0, 0);
  t += FADE; at(t, 0, 1);
  st.anim = track.animate(frames, { duration: total, iterations: Infinity });
  st.anim.currentTime = (Date.now() - st.start) % total;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
