/**
 * PÁGINA DA ARTE — EVENTOS ANIMADOS (Browser Source do OBS) — v3.0/v3.2
 * -----------------------------------------------------------------
 * Diferente do placar, esta página NÃO mostra uma lista fixa. Cada evento
 * novo (gol, cartão, substituição) marcado como "no ar" na aba Eventos do
 * painel aparece aqui como uma notificação animada, e some sozinha depois
 * de "durationMs" milissegundos (configurável na aba Arte).
 *
 * Ao carregar a página, o histórico já existente é registrado em silêncio
 * (sem animar) — só eventos que chegarem DEPOIS disso disparam a animação.
 * Isso evita que um F5 no OBS dispare uma enxurrada de notificações antigas.
 *
 * v3.2: ícones próprios em SVG (não emoji do sistema) para aparência
 * consistente entre Chrome / Browser Source do OBS / prévia do Dashboard,
 * e estilos de animação ampliados (sweep, stagger, reveal, pulse, wipe)
 * com duração, atraso entre elementos e direção configuráveis.
 */

const socket = io({ query: { kind: "arte" } });

const stack = document.getElementById("eventosStack");
const seenIds = new Set();
const annulledSeen = new Set(); // v5.0 — gols anulados já avisados
let firstSyncDone = false;
let lastTeams = [];
let currentCustomization = null;
let currentModules = null;

const EVENT_ICONS = {
  goal: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#fff" stroke="#15181f" stroke-width="1.3"/><polygon points="12,6.7 15.6,9.3 14.2,13.4 9.8,13.4 8.4,9.3" fill="#15181f"/></svg>`,
  yellow: `<svg viewBox="0 0 24 24"><rect x="3" y="1" width="18" height="22" rx="3" fill="#eab308"/></svg>`,
  red: `<svg viewBox="0 0 24 24"><rect x="3" y="1" width="18" height="22" rx="3" fill="#ef4444"/></svg>`,
  sub: `<svg viewBox="0 0 24 24"><path d="M4 9h13l-3.5-3.5L15 4l6 6-6 6-1.5-1.5L17 11H4z" fill="#0ea5e9"/><path d="M20 15H7l3.5 3.5L9 20l-6-6 6-6 1.5 1.5L7 13h13z" fill="#0ea5e9" opacity="0.55"/></svg>`,
};
EVENT_ICONS.annulled = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#fff" stroke="#15181f" stroke-width="1.3"/><polygon points="12,6.7 15.6,9.3 14.2,13.4 9.8,13.4 8.4,9.3" fill="#15181f"/><path d="M4.5 4.5l15 15M19.5 4.5l-15 15" stroke="#ef4444" stroke-width="3" stroke-linecap="round"/></svg>`;
const EVENT_TITLES = { goal: "GOL", yellow: "CARTÃO AMARELO", red: "CARTÃO VERMELHO", sub: "SUBSTITUIÇÃO", annulled: "GOL ANULADO" };
// v4.1 — setas da substituição (ENTRA em verde / SAI em vermelho)
const ARROW_UP = `<svg viewBox="0 0 24 24"><path d="M12 3l8 9h-5v9H9v-9H4z" fill="currentColor"/></svg>`;
const ARROW_DOWN = `<svg viewBox="0 0 24 24"><path d="M12 21l-8-9h5V3h6v9h5z" fill="currentColor"/></svg>`;

socket.on("teams:sync", (teams) => {
  lastTeams = teams;
});

socket.on("state:sync", (state) => {
  currentCustomization = state.customization.eventos;
  currentModules = state.modules;
  applyCustomization(currentCustomization);

  const events = state.match.events || [];

  if (!firstSyncDone) {
    // primeira carga: só registra o que já existe, sem animar nada
    events.forEach((ev) => { seenIds.add(ev.id); if (ev.annulled) annulledSeen.add(ev.id); });
    firstSyncDone = true;
    return;
  }

  events.forEach((ev) => {
    if (seenIds.has(ev.id)) {
      // v5.0 — um gol que já existia foi ANULADO agora: avisa "GOL ANULADO"
      if (ev.type === "goal" && ev.annulled && !annulledSeen.has(ev.id)) {
        annulledSeen.add(ev.id);
        if (ev.showOnAir !== false && currentModules.eventos) showEventCard({ ...ev, type: "annulled" }, state);
      }
      return;
    }
    seenIds.add(ev.id);
    if (ev.annulled) annulledSeen.add(ev.id);
    if (ev.showOnAir === false) return;
    if (!currentModules.eventos) return;
    if (ev.annulled) return; // lançado e anulado de uma vez (não acontece pelo painel)
    showEventCard(ev, state);
  });
});

function findTeam(id) {
  return lastTeams.find((t) => t.id === id) || null;
}

function applyCustomization(c) {
  const root = document.documentElement.style;
  root.setProperty("--ev-font", c.fontFamily);
  root.setProperty("--ev-text-size", c.textSize + "px");
  root.setProperty("--ev-text", c.textColor);
  root.setProperty("--ev-bg-rgba", hexToRgba(c.bgColor, c.bgOpacity));
  root.setProperty("--ev-goal", c.goalColor);
  root.setProperty("--ev-yellow", c.yellowColor);
  root.setProperty("--ev-red", c.redColor);
  root.setProperty("--ev-sub", c.subColor);
  root.setProperty("--ev-sub-in", c.subInColor || "#22c55e");
  root.setProperty("--ev-sub-out", c.subOutColor || "#ef4444");
  // v3.2: duração/direção configuráveis da animação de entrada/saída
  root.setProperty("--ev-anim-duration", (c.animationDurationMs || 500) + "ms");
  root.setProperty("--ev-direction-sign", c.direction === "rtl" ? "-1" : "1");

  document.body.classList.remove("pos-top-left", "pos-top-center", "pos-top-right", "pos-bottom-center");
  document.body.classList.add("pos-" + (c.position || "top-center"));
}

function hexToRgba(hex, alphaPercent) {
  const clean = (hex || "#000000").replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  const a = Math.max(0, Math.min(100, alphaPercent)) / 100;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Lado que recebe o gol (no gol contra é o adversário de quem marcou). */
function scoringSide(ev) {
  const side = ev.side === "away" ? "away" : "home";
  return ev.type === "goal" && ev.goalType === "own" ? (side === "home" ? "away" : "home") : side;
}

function accentColorFor(ev, state) {
  const c = currentCustomization;
  if (ev.type === "annulled") return c.redColor;
  if (c.useTeamColors) {
    const team = findTeam(state.match[scoringSide(ev)].teamId);
    if (team && team.primaryColor) return team.primaryColor;
  }
  return { goal: c.goalColor, yellow: c.yellowColor, red: c.redColor, sub: c.subColor }[ev.type] || c.goalColor;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function playerNumber(team, playerId) {
  const p = team && team.players ? team.players.find((x) => x.id === playerId) : null;
  return p && p.number !== undefined && p.number !== null ? p.number : "";
}

function showEventCard(ev, state) {
  const c = currentCustomization;
  const minuteLabel = `${ev.displayMinute || ev.minute}'`;
  const team = findTeam(state.match[ev.side === "away" ? "away" : "home"].teamId);

  let title = `${EVENT_TITLES[ev.type] || ""} — ${escapeHtml(ev.playerName || "")}`;
  let subtitle = team ? escapeHtml(team.name) : "";
  let extra = "";

  if (ev.type === "annulled") {
    title = `GOL ANULADO — ${escapeHtml(ev.playerName || "")}`;
    subtitle = escapeHtml(ev.annulNote || (team ? team.name : ""));
  } else if (ev.type === "goal" && ev.goalType === "penalty") {
    title = `GOL DE PÊNALTI — ${escapeHtml(ev.playerName || "")}`;
  } else if (ev.type === "goal" && ev.goalType === "own") {
    const scoringTeam = findTeam(state.match[scoringSide(ev)].teamId);
    title = `GOL CONTRA — ${escapeHtml(ev.playerName || "")}`;
    subtitle = scoringTeam ? `A favor do ${escapeHtml(scoringTeam.name)}` : "";
  } else if (ev.type === "sub") {
    // v4.1: ENTRA e SAI em linhas separadas, com número e nome de cada jogador
    title = EVENT_TITLES.sub;
    const row = (cls, arrow, label, id, name) => `
        <span class="ev-sub-row ${cls}">${arrow}<b>${label}</b>${playerNumber(team, id) !== "" ? `<i>${escapeHtml(playerNumber(team, id))}</i>` : ""}<span class="ev-sub-name">${escapeHtml(name || "")}</span></span>`;
    extra = `<span class="ev-subs">${row("in", ARROW_UP, "ENTRA", ev.secondaryPlayerId, ev.secondaryPlayerName)}${row("out", ARROW_DOWN, "SAI", ev.playerId, ev.playerName)}</span>`;
  }

  const isStagger = c.animation === "stagger";
  const staggerDelay = Number(c.staggerDelayMs) || 80;
  // v3.2: no estilo "stagger", cada elemento (ícone / texto / minuto) entra
  // em sequência com um pequeno atraso entre eles.
  const delayFor = (i) => isStagger ? `style="animation-delay:${i * staggerDelay}ms"` : "";

  const card = document.createElement("div");
  card.className = `ev-card anim-${c.animation}`;
  card.style.setProperty("--ev-accent", accentColorFor(ev, state));
  card.innerHTML = `
    <span class="ev-icon" ${delayFor(0)}>${EVENT_ICONS[ev.type] || ""}</span>
    <span class="ev-texts" ${delayFor(1)}>
      <span class="ev-title">${title}</span>
      <span class="ev-subtitle">${subtitle}</span>
      ${extra}
    </span>
    <span class="ev-minute" ${delayFor(2)}>${minuteLabel}</span>
  `;
  stack.appendChild(card);

  const duration = Number(c.durationMs) || 4500;
  const exitAnimMs = Number(c.animationDurationMs) || 500;

  setTimeout(() => {
    card.classList.add("leaving");
    setTimeout(() => card.remove(), exitAnimMs);
  }, duration);
}
