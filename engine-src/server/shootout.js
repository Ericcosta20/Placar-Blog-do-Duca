/**
 * DISPUTA DE PÊNALTIS (v4.1) — regras puras, sem Socket.IO.
 *
 * Cobranças alternam a partir de `firstSide`. Cada time tem `rounds` (5)
 * cobranças "regulares"; se empatar depois delas, segue a MORTE SÚBITA
 * (uma cobrança de cada por rodada, até alguém sair na frente ao fim da rodada).
 * Termina antes quando um time já não pode ser alcançado.
 */
const { getDefaultShootout } = require("./defaultState");

const MAX_KICKS = 60;
const other = (side) => (side === "home" ? "away" : "home");

/** Lado de cada cobrança (índice 0 = firstSide) */
function sideOfKick(index, firstSide) {
  return index % 2 === 0 ? firstSide : other(firstSide);
}

/** Calcula contagem, de quem é a vez e se terminou (a partir de kicks + firstSide). */
function compute(sh) {
  const rounds = sh.rounds || 5;
  const taken = { home: 0, away: 0 };
  const goals = { home: 0, away: 0 };
  sh.kicks.forEach((k, i) => {
    const side = sideOfKick(i, sh.firstSide);
    taken[side]++;
    if (k.scored) goals[side]++;
  });
  const total = sh.kicks.length;
  const planned = Math.max(rounds, Math.ceil(total / 2));
  const remaining = { home: Math.max(0, planned - taken.home), away: Math.max(0, planned - taken.away) };
  let winner = null;
  if (goals.home > goals.away + remaining.away) winner = "home";
  else if (goals.away > goals.home + remaining.home) winner = "away";
  const finished = winner !== null;
  return {
    taken, goals, total, planned, finished, winner,
    next: finished || total >= MAX_KICKS ? null : { side: sideOfKick(total, sh.firstSide), round: Math.floor(total / 2) + 1 },
    suddenDeath: total >= rounds * 2,
  };
}

/** Recalcula lado de cada cobrança e os campos derivados (finished/winner). */
function refresh(sh) {
  sh.kicks.forEach((k, i) => { k.side = sideOfKick(i, sh.firstSide); k.round = Math.floor(i / 2) + 1; });
  const c = compute(sh);
  sh.finished = c.finished;
  sh.winner = c.winner;
  return sh;
}

/** Normaliza o que veio do disco / importação (qualquer lixo vira um estado válido). */
function normalize(raw) {
  const d = getDefaultShootout();
  const src = raw && typeof raw === "object" ? raw : {};
  const sh = {
    visible: !!src.visible,
    firstSide: src.firstSide === "away" ? "away" : "home",
    rounds: Number.isInteger(src.rounds) && src.rounds >= 1 && src.rounds <= 10 ? src.rounds : d.rounds,
    kicks: [],
    finished: false,
    winner: null,
  };
  const list = Array.isArray(src.kicks) ? src.kicks.slice(0, MAX_KICKS) : [];
  list.forEach((k, i) => {
    if (!k || typeof k !== "object") return;
    sh.kicks.push({
      id: typeof k.id === "string" && k.id ? k.id.slice(0, 40) : `k${Date.now().toString(36)}${i}`,
      side: "home", round: 1,
      scored: !!k.scored,
      playerId: k.playerId ? String(k.playerId).slice(0, 80) : null,
      playerName: k.playerName ? String(k.playerName).slice(0, 80) : "",
    });
  });
  return refresh(sh);
}

module.exports = { compute, refresh, normalize, sideOfKick, other, MAX_KICKS };
