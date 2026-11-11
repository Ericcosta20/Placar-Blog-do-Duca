/**
 * CÁLCULO DA CLASSIFICAÇÃO (v6.0) — usado pela arte (/arte/informativos) e pela prévia do painel.
 * ---------------------------------------------------------------
 * Entrada: state (league, others, match) e teams (cadastro). Saída: linhas já ordenadas.
 *  - Os pontos digitados pelo operador são a BASE.
 *  - Jogos de "Outros jogos" (ao vivo ou encerrados) e o jogo principal entram como PROJEÇÃO:
 *    soma provisória do resultado atual (3 pontos pela vitória, 1 pelo empate).
 *  - Desempate: pontos, vitórias, saldo de gols, gols pró e, por fim, a ordem da lista.
 * Nada aqui grava nada: é só conta em cima do estado.
 */
(function (root) {
  const norm = (v) => String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

  /* ---------- vínculo linha da tabela <-> time cadastrado (v6.1) ----------
   * Antes só ligava com o nome IGUAL. Agora o nome é "limpo" (sem de/da/clube/esporte/FC…) e comparado
   * de várias formas; só vale quando existe UM único melhor candidato (se dois times empatam, não chuta). */
  const STOP = new Set(["de", "da", "do", "das", "dos", "e", "ec", "fc", "sc", "ac", "ad", "cr", "clube", "esporte", "esportes", "associacao", "atletica", "sociedade", "desportiva", "desportivo", "futebol", "regatas", "recreativa", "recreativo", "football", "club", "sad"]);
  const tokens = (v) => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const keyOf = (v) => tokens(v).filter((t) => !STOP.has(t)).join("");
  const UF = new Set("ac al ap am ba ce df es go ma mt ms mg pa pb pr pe pi rj rn rs ro rr sc sp se to".split(" "));
  const sigTokens = (v) => tokens(v).filter((t) => !STOP.has(t) && !UF.has(t) && t.length >= 3);

  function scoreMatch(name, short, team) {
    const n = norm(name), tn = norm(team.name);
    if (!n || !tn) return 0;
    if (n === tn) return 100;
    const sh = norm(short), ts = norm(team.shortName);
    const k = keyOf(name), tk = keyOf(team.name);
    if (k && k === tk) return 90;
    if (sh && ts && sh === ts && sh.length >= 3) return 85;
    if (k.length >= 4 && tk.length >= 4 && (tk.includes(k) || k.includes(tk))) return 75;
    const a = sigTokens(name), b = sigTokens(team.name);
    if (a.length && b.length) {
      const common = a.filter((t) => b.includes(t) && t.length >= 4);
      if (common.length && common.length === Math.min(a.length, b.length)) return 60;
    }
    return 0;
  }
  /** @returns {{team, ambiguous}} melhor time do cadastro para este nome (ou nenhum). */
  function matchTeam(name, short, teams) {
    let best = null, bestScore = 0, tie = false;
    (teams || []).forEach((t) => {
      const sc = scoreMatch(name, short, t);
      if (sc > bestScore) { best = t; bestScore = sc; tie = false; } else if (sc && sc === bestScore) tie = true;
    });
    if (!best || bestScore < 60) return { team: null, ambiguous: false };
    if (tie && bestScore < 100) return { team: null, ambiguous: true };
    return { team: best, ambiguous: false };
  }
  /** Time do cadastro desta linha: o escolhido à mão (teamId) ou o encontrado pelo nome. */
  function teamForRow(row, teams) {
    if (!row) return null;
    if (row.teamId) { const t = (teams || []).find((x) => x.id === row.teamId); if (t) return t; }
    return matchTeam(row.name, row.short, teams).team;
  }
  /** A linha da tabela é este time do cadastro? */
  function rowIsTeam(row, team, teams) {
    if (!row || !team) return false;
    if (row.teamId && row.teamId === team.id) return true;
    if (!row.teamId && teams) { const t = teamForRow(row, teams); if (t) return t.id === team.id; }
    return !!(row.name && team.name && norm(row.name) === norm(team.name));
  }

  function addResult(r, gf, ga) {
    const win = gf > ga, draw = gf === ga;
    r.pts += win ? 3 : draw ? 1 : 0;
    const inc = (k, by) => { if (r[k] !== null && r[k] !== undefined) r[k] += by; };
    inc("j", 1); inc(win ? "v" : draw ? "e" : "d", 1); inc("gp", gf); inc("gc", ga);
  }
  const sg = (r) => (r.gp !== null && r.gp !== undefined && r.gc !== null && r.gc !== undefined ? r.gp - r.gc : null);
  const cmp = (a, b) => b.pts - a.pts || (b.v || 0) - (a.v || 0) || (sg(b) || 0) - (sg(a) || 0) || (b.gp || 0) - (a.gp || 0) || a.order - b.order;

  function zoneFor(zones, pos) {
    return (zones || []).find((z) => z.enabled !== false && pos >= z.from && pos <= z.to) || null;
  }

  /**
   * @returns {{ rows, cols, projecting, mainRound, tableRound }}
   *  rows[i] = { id, name, short, teamId, team, pos, delta, zone, pts, j, v, e, d, gp, gc, sg,
   *              main: {gf, ga, opp}|null, live: {gf, ga, status, minute, round, oppName, gameId}|null }
   */
  function compute(state, teams) {
    const lg = state.league;
    const findTeam = (id) => (teams || []).find((t) => t.id === id) || null;
    const rows = lg.teams.map((t, i) => ({ ...t, order: i, base: { pts: t.pts }, main: null, live: null, team: null }));
    const byId = new Map(rows.map((r) => [r.id, r]));
    rows.forEach((r) => { r.team = teamForRow(r, teams); });

    // posição ANTES da projeção
    const baseSorted = [...rows].sort(cmp);
    const basePos = new Map(baseSorted.map((r, i) => [r.id, i + 1]));

    let projecting = false;
    const m = state.match || {};
    const mainRound = (state.meta && state.meta.round) || "";

    // ---- jogo principal (se os times estiverem na tabela) ----
    const homeTeam = findTeam(m.home && m.home.teamId), awayTeam = findTeam(m.away && m.away.teamId);
    const homeRow = homeTeam ? rows.find((r) => rowIsTeam(r, homeTeam, teams)) : null;
    const awayRow = awayTeam ? rows.find((r) => rowIsTeam(r, awayTeam, teams)) : null;
    const sc = (m.score) || { home: 0, away: 0 };
    const started = !!(m.clock && (m.clock.seconds > 0 || m.clock.running)) || sc.home + sc.away > 0 || (m.events || []).length > 0;
    if (homeRow) homeRow.main = { gf: sc.home, ga: sc.away, oppName: awayTeam ? awayTeam.name : "" };
    if (awayRow) awayRow.main = { gf: sc.away, ga: sc.home, oppName: homeTeam ? homeTeam.name : "" };

    if (lg.liveProjection !== false) {
      if (lg.includeMain !== false && started) {
        if (homeRow) { addResult(homeRow, sc.home, sc.away); homeRow.projected = true; projecting = true; }
        if (awayRow) { awayRow.projected = true; addResult(awayRow, sc.away, sc.home); projecting = true; }
      }
    }
    // ---- outros jogos ----
    const others = (state.others && state.others.games) || [];
    others.forEach((g) => {
      const h = byId.get(g.homeId), a = byId.get(g.awayId);
      const info = (r, gf, ga, opp) => ({ gf, ga, status: g.status, minute: g.minute, round: g.round, oppName: opp ? opp.name : "", gameId: g.id });
      if (h && !h.main) h.live = info(h, g.homeScore, g.awayScore, a);
      if (a && !a.main) a.live = info(a, g.awayScore, g.homeScore, h);
      if (lg.liveProjection !== false && g.status !== "scheduled") {
        if (h) { addResult(h, g.homeScore, g.awayScore); h.projected = true; projecting = true; }
        if (a) { addResult(a, g.awayScore, g.homeScore); a.projected = true; projecting = true; }
      }
    });

    const sorted = [...rows].sort(cmp);
    sorted.forEach((r, i) => {
      r.pos = i + 1;
      r.delta = basePos.get(r.id) - r.pos; // positivo = subiu
      r.zone = zoneFor(lg.zones, r.pos);
      r.sg = sg(r);
    });
    const has = (k) => sorted.some((r) => r[k] !== null && r[k] !== undefined);
    return {
      rows: sorted,
      cols: { j: has("j"), v: has("v"), e: has("e"), d: has("d"), sg: sorted.some((r) => r.sg !== null) },
      projecting,
      mainRound,
      tableRound: lg.round || "",
    };
  }

  root.Standings = { compute, rowIsTeam, norm, zoneFor, matchTeam, teamForRow };
  if (typeof module !== "undefined" && module.exports) module.exports = root.Standings;
})(typeof window !== "undefined" ? window : globalThis);
