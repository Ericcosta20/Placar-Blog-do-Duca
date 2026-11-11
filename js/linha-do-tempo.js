/**
 * PÁGINA DA ARTE — LINHA DO TEMPO (Browser Source do OBS) — v3.2
 * -----------------------------------------------------------------
 * PERMANENTE — diferente de /arte/eventos (notificação chamativa e
 * temporária). Fica visível durante toda a transmissão mostrando os
 * últimos eventos em ordem cronológica (mais recente primeiro).
 *
 * Não cria um segundo cadastro de eventos: lê exatamente a mesma
 * match.events que alimenta o histórico do painel, a animação de
 * /arte/eventos e os ícones da escalação — uma única fonte de verdade.
 */

const socket = io({ query: { kind: "arte" } });

const ltList = document.getElementById("ltList");
let lastState = null;
let lastTeams = [];

const EVENT_ICONS = {
  goal: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#fff" stroke="#15181f" stroke-width="1.3"/><polygon points="12,6.7 15.6,9.3 14.2,13.4 9.8,13.4 8.4,9.3" fill="#15181f"/></svg>`,
  yellow: `<svg viewBox="0 0 24 24"><rect x="3" y="1" width="18" height="22" rx="3" fill="#eab308"/></svg>`,
  red: `<svg viewBox="0 0 24 24"><rect x="3" y="1" width="18" height="22" rx="3" fill="#ef4444"/></svg>`,
  sub: `<svg viewBox="0 0 24 24"><path d="M4 9h13l-3.5-3.5L15 4l6 6-6 6-1.5-1.5L17 11H4z" fill="#0ea5e9"/><path d="M20 15H7l3.5 3.5L9 20l-6-6 6-6 1.5 1.5L7 13h13z" fill="#0ea5e9" opacity="0.55"/></svg>`,
};

socket.on("teams:sync", (teams) => { lastTeams = teams; render(); });
socket.on("state:sync", (state) => { lastState = state; render(); });

function findTeam(id) {
  return lastTeams.find((t) => t.id === id) || null;
}
const ARROW_UP = `<svg class="lt-arrow in" viewBox="0 0 24 24"><path d="M12 3l8 9h-5v9H9v-9H4z" fill="currentColor"/></svg>`;
const ARROW_DOWN = `<svg class="lt-arrow out" viewBox="0 0 24 24"><path d="M12 21l-8-9h5V3h6v9h5z" fill="currentColor"/></svg>`;

function teamAbbrev(team) {
  if (!team) return "";
  // v4.0: usa a sigla cadastrada no time; sem sigla, mantém o comportamento antigo (3 primeiras letras)
  if (team.shortName && team.shortName.trim()) return team.shortName.trim().slice(0, 4).toUpperCase();
  if (!team.name) return "";
  return team.name.trim().slice(0, 3).toUpperCase();
}
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function applyCustomization(c) {
  const root = document.documentElement.style;
  root.setProperty("--lt-font-size", c.fontSize + "px");
  root.setProperty("--lt-icon-size", c.iconSize + "px");
  root.setProperty("--lt-spacing", c.spacing + "px");
  root.setProperty("--lt-row-height", c.rowHeight + "px");
  root.setProperty("--lt-text", c.textColor);
  root.setProperty("--lt-bg-rgba", hexToRgba(c.bgColor, c.bgOpacity));

  document.body.className = "lt-body lt-pos-" + (c.position || "top-right");
}

function hexToRgba(hex, alphaPercent) {
  const clean = (hex || "#000000").replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  const a = Math.max(0, Math.min(100, alphaPercent)) / 100;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function render() {
  if (!lastState) return;
  const c = lastState.customization.linhaDoTempo;
  applyCustomization(c);

  const enabled = c.enabled && lastState.modules.eventos;
  document.body.style.display = enabled ? "flex" : "none";
  if (!enabled) return;

  const events = (lastState.match.events || [])
    .filter((ev) => ev.showOnAir !== false)
    .slice()
    .reverse() // mais recente primeiro
    .slice(0, c.maxEvents || 6);

  ltList.innerHTML = events.map((ev) => {
    const team = findTeam(lastState.match[ev.side === "away" ? "away" : "home"].teamId);
    const minuteLabel = ev.displayMinute || ev.minute;
    const icon = c.showIcon ? `<span class="lt-icon">${EVENT_ICONS[ev.type] || ""}</span>` : "";
    const minute = c.showMinute ? `<span class="lt-minute">${minuteLabel}'</span>` : "";
    const teamTag = c.showTeam && team ? `<span class="lt-team">${escapeHtml(teamAbbrev(team))}</span>` : "";

    let playerText = escapeHtml(ev.playerName || "");
    if (ev.type === "goal" && ev.goalType === "penalty") playerText += ` <span class="lt-tag">PÊN</span>`;
    if (ev.type === "goal" && ev.goalType === "own") playerText += ` <span class="lt-tag">GC</span>`;
    if (ev.type === "sub") {
      // v4.1: quem ENTRA (verde) e quem SAI (vermelho)
      playerText = `<span class="lt-in">${ARROW_UP}${escapeHtml(ev.secondaryPlayerName || "")}</span><span class="lt-out">${ARROW_DOWN}${escapeHtml(ev.playerName || "")}</span>`;
    }

    // v5.0 — gol anulado: continua na lista, riscado e com a marca ANUL
    if (ev.annulled) playerText = `<s>${playerText}</s> <span class="lt-tag lt-tag-annul">ANUL</span>`;

    return `<div class="lt-row${ev.annulled ? " lt-annulled" : ""}">${minute}${icon}<span class="lt-player">${playerText}</span>${teamTag}</div>`;
  }).join("");
}
