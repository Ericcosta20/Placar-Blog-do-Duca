/**
 * ESTADO EM MEMÓRIA (single source of truth) + utilitários de relógio.
 * Todos os módulos do servidor leem/gravam o estado por aqui.
 */
const { loadState, saveState, saveStateSync } = require("./persistence");
const teamsStore = require("./teamsStore");

let io = null;
let currentState = loadState();
let saveTimeout = null;

/* ---------- PERÍODOS ---------- */
const PERIOD_BASE = { "1t": 0, "2t": 45, "p1": 90, "p2": 105 };
const PERIOD_REGULATION = { "1t": 45, "2t": 45, "p1": 15, "p2": 15 };
const PERIOD_ORDER = ["1t", "2t", "p1", "p2"];

function computeDisplayMinuteFromMinute(minute, period) {
  const base = PERIOD_BASE[period] ?? 0;
  const reg = PERIOD_REGULATION[period] ?? 45;
  if (minute <= reg) return String(base + minute);
  return `${base + reg}+${minute - reg}`;
}
function computeDisplayMinute(totalSeconds, period) {
  return computeDisplayMinuteFromMinute(Math.floor(totalSeconds / 60), period);
}

function computeCurrentSeconds() {
  const clock = currentState.match.clock;
  if (clock.running && clock.runningSince) {
    return clock.seconds + Math.floor((Date.now() - clock.runningSince) / 1000);
  }
  return clock.seconds;
}

/* ---------- ESTADO ---------- */
function setIo(instance) { io = instance; }
function getState() { return currentState; }
function setState(next) { currentState = next; }

function scheduleSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => saveState(currentState), 300);
}
function saveNow() {
  clearTimeout(saveTimeout);
  saveStateSync(currentState);
}

function broadcastState() { if (io) io.emit("state:sync", currentState); }
function broadcastTeams() { if (io) io.emit("teams:sync", teamsStore.listTeams()); }
/** Atalho: transmite o estado e agenda o salvamento. */
function commit() {
  broadcastState();
  scheduleSave();
}

module.exports = {
  PERIOD_BASE, PERIOD_REGULATION, PERIOD_ORDER,
  computeDisplayMinuteFromMinute, computeDisplayMinute, computeCurrentSeconds,
  setIo, getState, setState, scheduleSave, saveNow, broadcastState, broadcastTeams, commit,
};
