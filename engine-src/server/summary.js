/**
 * RESUMO DA PARTIDA (v6.0) — monta um relatório com times, placar, arbitragem, escalações iniciais,
 * gols em ordem, cartões e substituições (com o momento do intervalo) e exporta em TXT ou PDF.
 * ---------------------------------------------------------------
 * - buildSummary() lê só o estado (nada é gravado) e devolve um modelo simples;
 *   o painel mostra a prévia a partir dele, e TXT/PDF saem do MESMO modelo.
 * - A escalação INICIAL é reconstruída desfazendo as substituições (a escalação do estado já tem os reservas que entraram).
 * - Substituição lançada durante o intervalo (evento com atInterval) aparece sob um bloco "Intervalo".
 */
const teamsStore = require("./teamsStore");
const stadiumStore = require("./stadium");
const fs = require("fs");

const PERIOD_LABEL = { "1t": "1º tempo", "2t": "2º tempo", p1: "Prorrogação — 1º tempo", p2: "Prorrogação — 2º tempo" };
const OFFICIAL_ROLES = [["main", "Árbitro"], ["ass1", "Assistente 1"], ["ass2", "Assistente 2"], ["fourth", "4º árbitro"], ["var", "VAR"], ["avar1", "AVAR 1"], ["avar2", "AVAR 2"]];

/** Opções vindas da URL (?lineups=0&bench=0 ...) — tudo ligado por padrão. */
function parseOpts(q = {}) {
  const on = (k) => q[k] !== "0" && q[k] !== "false";
  return {
    title: String(q.title || "").slice(0, 80),
    lineups: on("lineups"), bench: on("bench"), goals: on("goals"), cards: on("cards"),
    subs: on("subs"), officials: on("officials"), crests: on("crests"), stadium: on("stadium"),
  };
}

function safeTeam(id) {
  try { return id ? teamsStore.getTeam(id) : null; } catch (_) { return null; }
}
const fmtMinute = (ev) => `${ev.displayMinute != null ? ev.displayMinute : ev.minute}'`;
const scoringSide = (ev) => (ev.goalType === "own" ? (ev.side === "home" ? "away" : "home") : ev.side);

function buildSummary(state, teamsList, opts = parseOpts()) {
  const m = state.match, meta = state.meta || {};
  const teams = { home: safeTeam(m.home.teamId), away: safeTeam(m.away.teamId) };
  const nameOf = (side) => (teams[side] && teams[side].name) || (side === "home" ? "Mandante" : "Visitante");
  const player = (side, id, fallbackName) => {
    const t = teams[side];
    const p = t && t.players ? t.players.find((x) => x.id === id) : null;
    return { number: p ? p.number : null, name: p ? p.name : fallbackName || "—" };
  };
  const events = (m.events || []);

  // ----- escalação inicial: desfaz as substituições, da última para a primeira -----
  const lineup = {};
  for (const side of ["home", "away"]) {
    const ms = m[side];
    const starters = [...(ms.starterIds || [])];
    const subs = events.filter((e) => e.type === "sub" && e.side === side && e.secondaryPlayerId);
    for (let i = subs.length - 1; i >= 0; i--) {
      const idx = starters.indexOf(subs[i].secondaryPlayerId);
      if (idx !== -1) starters[idx] = subs[i].playerId;
    }
    const stats = ms.lineupStats || {};
    const cap = ms.captainId;
    const mk = (id) => {
      const p = player(side, id);
      const st = stats[id] || {};
      return { ...p, goals: st.goals || 0, yellow: st.yellowCards || 0, red: st.redCards || 0, out: !!st.substituted, entered: !!st.enteredGame };
    };
    // quem entrou durante o jogo e não estava no banco cadastrado também aparece nos reservas
    const benchIds = [...(ms.benchIds || [])];
    subs.forEach((e) => { if (!benchIds.includes(e.secondaryPlayerId)) benchIds.push(e.secondaryPlayerId); });
    lineup[side] = {
      team: nameOf(side),
      starters: starters.map((id) => ({ ...mk(id), captain: id === cap || (!cap && false) })),
      bench: benchIds.map(mk),
    };
    // o capitão pode ter saído: mantém a marca por id original
    if (cap) lineup[side].starters.forEach((p, i) => { p.captain = starters[i] === cap; });
  }

  // ----- gols em ordem, com o placar a cada gol -----
  const running = { home: 0, away: 0 };
  const goals = [];
  events.filter((e) => e.type === "goal").forEach((ev) => {
    const credited = scoringSide(ev);
    if (!ev.annulled) running[credited] += 1;
    const p = player(ev.side, ev.playerId, ev.playerName);
    goals.push({
      minute: fmtMinute(ev), side: credited, team: nameOf(credited), player: p.name, number: p.number,
      kind: ev.goalType || "normal", score: ev.annulled ? "" : `${running.home} × ${running.away}`,
      annulled: !!ev.annulled, note: ev.annulNote || "", period: PERIOD_LABEL[ev.period] || "",
    });
  });

  // ----- cartões -----
  const cards = events.filter((e) => e.type === "yellow" || e.type === "red").map((ev) => {
    const p = player(ev.side, ev.playerId, ev.playerName);
    return { minute: fmtMinute(ev), side: ev.side, team: nameOf(ev.side), player: p.name, number: p.number, type: ev.type };
  });

  // ----- substituições, com blocos por período e o INTERVALO separado -----
  const subs = [];
  let lastKey = null;
  events.filter((e) => e.type === "sub").forEach((ev) => {
    const key = ev.atInterval ? "int" : ev.period;
    if (key !== lastKey) { subs.push({ break: key === "int" ? "Intervalo" : PERIOD_LABEL[ev.period] || "Jogo" }); lastKey = key; }
    const out = player(ev.side, ev.playerId, ev.playerName), inn = player(ev.side, ev.secondaryPlayerId, ev.secondaryPlayerName);
    subs.push({ minute: ev.atInterval ? "INT" : fmtMinute(ev), side: ev.side, team: nameOf(ev.side), out, in: inn, interval: !!ev.atInterval });
  });
  const subCount = { home: events.filter((e) => e.type === "sub" && e.side === "home").length, away: events.filter((e) => e.type === "sub" && e.side === "away").length };

  // ----- pênaltis -----
  const so = m.shootout || {};
  const kicks = so.kicks || [];
  const pens = kicks.length ? { home: kicks.filter((k) => k.side === "home" && k.scored).length, away: kicks.filter((k) => k.side === "away" && k.scored).length } : null;

  const of = state.officials || {};
  const officials = OFFICIAL_ROLES.map(([k, role]) => ({ role, name: (of[k] && of[k].name) || "", from: (of[k] && of[k].from) || "" })).filter((o) => o.name);

  // ----- estádio (v6.1): só o que foi preenchido; a 1ª foto é a capa -----
  const sd = state.stadium || {};
  const SD_ROWS = [["location", "Onde fica"], ["owner", "De quem é"], ["capacity", "Capacidade"], ["inauguration", "Inauguração"], ["record", "Recorde de público"], ["surface", "Gramado"], ["dimensions", "Campo (m)"], ["attendance", "Público do jogo"]];
  const sdItems = SD_ROWS.filter(([k]) => sd[k]).map(([k, label]) => ({ label, value: sd[k] }));
  const cover = (sd.photos || [])[0];
  const stadium = (sd.name || sdItems.length || cover) ? {
    name: sd.name || "", nickname: sd.nickname || "", items: sdItems,
    photoUrl: cover ? "/stadium/photos/" + encodeURIComponent(cover.file) : "",
  } : null;

  const round = meta.round ? `${meta.round}ª rodada` : "";
  const title = opts.title || [meta.competition || meta.gameName, round].filter(Boolean).join(" · ") || "Resumo da partida";
  const clock = m.clock || {};
  const mins = Math.floor((clock.seconds || 0) / 60);
  return {
    title,
    date: meta.matchDate || "",
    generatedAt: new Date().toISOString(),
    clockText: `${PERIOD_LABEL[clock.period] || ""}${mins ? ` · ${mins}'` : ""}`.replace(/^ · /, ""),
    home: { name: nameOf("home"), short: (teams.home && teams.home.shortName) || "", crest: teams.home ? teams.home.crestDataUrl || "" : "" },
    away: { name: nameOf("away"), short: (teams.away && teams.away.shortName) || "", crest: teams.away ? teams.away.crestDataUrl || "" : "" },
    score: { home: m.score.home, away: m.score.away },
    pens,
    officials, stadium, lineup, goals, cards, subs, subCount,
    opts,
  };
}

/* ======================= TXT ======================= */
const W = 66;
const line = (ch) => ch.repeat(W);
const center = (s) => { s = String(s); const pad = Math.max(0, Math.floor((W - s.length) / 2)); return " ".repeat(pad) + s; };
const pad = (s, n) => { s = String(s); return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length); };
const clip = (s, n) => { s = String(s); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
const num = (n) => (n === null || n === undefined || n === 0 ? "  " : String(n).padStart(2, " "));
const KIND = { penalty: " (pênalti)", own: " (gol contra)", normal: "" };

function fmtDate(iso) {
  const d = new Date(iso);
  const p2 = (n) => String(n).padStart(2, "0");
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

function toText(sm) {
  const o = sm.opts, L = [];
  L.push(line("═"), center(sm.title.toUpperCase()), line("═"), "");
  L.push(center(`${sm.home.name.toUpperCase()}  ${sm.score.home} x ${sm.score.away}  ${sm.away.name.toUpperCase()}`));
  if (sm.pens) L.push(center(`(pênaltis: ${sm.pens.home} x ${sm.pens.away})`));
  L.push("");
  const info = [sm.date && `Data: ${sm.date}`, sm.clockText && `Tempo: ${sm.clockText}`].filter(Boolean).join("   ·   ");
  if (info) L.push(center(info));
  L.push(line("─"));

  if (o.officials && sm.officials.length) {
    L.push("ARBITRAGEM", "");
    sm.officials.forEach((x) => L.push(`  ${pad(x.role, 14)} ${x.name}${x.from ? ` (${x.from})` : ""}`));
    L.push("", line("─"));
  }
  if (o.stadium && sm.stadium) {
    L.push("ESTÁDIO", "");
    if (sm.stadium.name) L.push(`  ${sm.stadium.name}${sm.stadium.nickname ? "  (" + sm.stadium.nickname + ")" : ""}`);
    sm.stadium.items.forEach((x) => L.push(`  ${pad(x.label, 20)} ${x.value}`));
    L.push("", line("─"));
  }
  if (o.lineups) {
    L.push("ESCALAÇÕES INICIAIS", "");
    const h = sm.lineup.home, a = sm.lineup.away, col = 31;
    L.push(`  ${pad(h.team.toUpperCase(), col)}${a.team.toUpperCase()}`);
    const n = Math.max(h.starters.length, a.starters.length);
    const cell = (p) => (p ? `${num(p.number)}  ${p.name}${p.captain ? " (C)" : ""}` : "");
    for (let i = 0; i < n; i++) L.push(`  ${pad(cell(h.starters[i]), col)}${cell(a.starters[i])}`);
    if (!n) L.push("  (escalação não definida)");
    if (o.bench) {
      L.push("", "  Reservas", "");
      const nb = Math.max(h.bench.length, a.bench.length);
      const bcell = (p) => (p ? `${num(p.number)}  ${p.name}${p.entered ? " *" : ""}` : "");
      for (let i = 0; i < nb; i++) L.push(`  ${pad(bcell(h.bench[i]), col)}${bcell(a.bench[i])}`);
      if (nb) L.push("", "  * entrou durante o jogo");
    }
    L.push("", line("─"));
  }
  if (o.goals) {
    L.push("GOLS", "");
    if (!sm.goals.length) L.push("  Sem gols.");
    sm.goals.forEach((g) => {
      const txt = `  ${pad(g.minute, 6)} ${pad(clip(g.team.toUpperCase(), 20), 20)} ${g.player}${KIND[g.kind] || ""}`;
      L.push(g.annulled ? `${txt}  [ANULADO${g.note ? ": " + g.note : ""}]` : `${txt}   >> ${g.score}`);
    });
    L.push("", line("─"));
  }
  if (o.cards) {
    L.push("CARTÕES", "");
    if (!sm.cards.length) L.push("  Sem cartões.");
    sm.cards.forEach((c) => L.push(`  ${pad(c.minute, 6)} ${pad(c.type === "red" ? "VERMELHO" : "AMARELO", 9)} ${pad(clip(c.team.toUpperCase(), 20), 20)} ${c.player}`));
    L.push("", line("─"));
  }
  if (o.subs) {
    L.push(`SUBSTITUIÇÕES  (${clip(sm.home.name, 18)}: ${sm.subCount.home}/5 · ${clip(sm.away.name, 18)}: ${sm.subCount.away}/5)`);
    if (!sm.subs.length) L.push("", "  Sem substituições.");
    sm.subs.forEach((s) => {
      if (s.break) L.push("", `  ── ${s.break.toUpperCase()} ──`);
      else L.push(`  ${pad(s.minute, 6)} ${pad(clip(s.team.toUpperCase(), 20), 20)} sai ${s.out.number ?? ""} ${s.out.name}  ->  entra ${s.in.number ?? ""} ${s.in.name}`);
    });
    L.push("", line("─"));
  }
  L.push(center(`Resumo gerado em ${fmtDate(sm.generatedAt)} — painel Transmissão OBS`));
  return "﻿" + L.join("\r\n") + "\r\n";
}

/* ======================= PDF ======================= */
function crestBuffer(dataUrl) {
  const m = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(dataUrl || "");
  return m ? Buffer.from(m[2], "base64") : null;
}

function toPdf(sm, res, filename) {
  const PDFDocument = require("pdfkit");
  const o = sm.opts;
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true, info: { Title: sm.title, Author: "Transmissão OBS" } });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  doc.pipe(res);

  const L = 40, R = doc.page.width - 40, CW = R - L;
  const C = { ink: "#0f172a", mute: "#64748b", blue: "#2563eb", soft: "#eff6ff", line: "#e2e8f0", band: "#0f172a", yellow: "#eab308", red: "#dc2626", green: "#16a34a" };
  const bottom = () => doc.page.height - 56;
  const ensure = (h) => { if (doc.y + h > bottom()) doc.addPage(); };

  // ---- cabeçalho ----
  doc.rect(0, 0, doc.page.width, 150).fill(C.band);
  doc.fillColor("#93c5fd").font("Helvetica-Bold").fontSize(10).text(sm.title.toUpperCase(), L, 26, { width: CW, align: "center", characterSpacing: 1 });
  const cy = 50;
  const sideW = 130, crestW = 62, scoreW = CW - 2 * (sideW + crestW);
  const drawSide = (side, left) => {
    const nx = left ? L + crestW : R - crestW - sideW;
    const cx = left ? L : R - crestW;
    if (o.crests) {
      const buf = crestBuffer(sm[side].crest);
      if (buf) {
        // placa branca atrás do escudo: escudos escuros/transparentes somem no fundo azul-marinho e parecem "cortados"
        const plate = crestW - 2;
        try {
          doc.roundedRect(cx, cy + 2, plate, plate, 10).fill("#ffffff");
          doc.image(buf, cx + 6, cy + 8, { fit: [plate - 12, plate - 12], align: "center", valign: "center" });
        } catch (_) { /* PNG que o PDF não lê: segue sem escudo */ }
      }
    }
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(13);
    const name = sm[side].name.toUpperCase();
    const h = doc.heightOfString(name, { width: sideW - 8 });
    doc.text(name, nx, cy + 32 - h / 2, { width: sideW - 8, align: left ? "right" : "left" });
  };
  drawSide("home", true);
  drawSide("away", false);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(30).text(`${sm.score.home} × ${sm.score.away}`, L + crestW + sideW, cy + 14, { width: scoreW, align: "center", lineBreak: false });
  const sub = [];
  if (sm.pens) sub.push(`Pênaltis: ${sm.pens.home} × ${sm.pens.away}`);
  if (sm.date) sub.push(sm.date);
  if (sm.clockText) sub.push(sm.clockText);
  doc.fillColor("#cbd5e1").font("Helvetica").fontSize(10).text(sub.join("   -   "), L, cy + 82, { width: CW, align: "center" });
  doc.y = 170;

  const section = (label) => {
    ensure(60);
    doc.moveDown(0.4);
    const y = doc.y;
    doc.fillColor(C.blue).font("Helvetica-Bold").fontSize(10).text(label.toUpperCase(), L, y, { characterSpacing: 1.4 });
    doc.moveTo(L, doc.y + 3).lineTo(R, doc.y + 3).lineWidth(1.5).strokeColor("#bfdbfe").stroke();
    doc.y += 10;
  };
  const fit = (txt, w, bold, size) => {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(size);
    let t = String(txt);
    if (doc.widthOfString(t) <= w) return t;
    while (t.length > 1 && doc.widthOfString(t + "...") > w) t = t.slice(0, -1);
    return t.trimEnd() + "...";
  };
  const row = (cols, opt = {}) => {
    // cols: [{ t, w, bold, color, align }]
    const h = opt.h || 17;
    ensure(h + 2);
    const y = doc.y;
    if (opt.bg) doc.rect(L, y - 2, CW, h).fill(opt.bg);
    let x = L + 4;
    cols.forEach((c) => {
      doc.fillColor(c.color || C.ink).font(c.bold ? "Helvetica-Bold" : "Helvetica").fontSize(opt.size || 10)
        .text(fit(c.t, c.w - 6, c.bold, opt.size || 10), x, y + 1, { width: c.w - 4, align: c.align || "left", lineBreak: false });
      x += c.w;
    });
    doc.y = y + h;
    if (!opt.noLine) doc.moveTo(L, doc.y - 1).lineTo(R, doc.y - 1).lineWidth(0.5).strokeColor(C.line).stroke();
  };

  if (o.officials && sm.officials.length) {
    section("Arbitragem");
    sm.officials.forEach((x) => row([{ t: x.role, w: 110, bold: true, color: C.mute }, { t: x.name, w: CW - 170, bold: true }, { t: x.from, w: 60, color: C.mute, align: "right" }]));
  }

  if (o.stadium && sm.stadium) {
    section("Estádio");
    const sd = sm.stadium;
    let buf = null;
    if (sd.photoUrl) {
      try {
        const file = decodeURIComponent(sd.photoUrl.replace("/stadium/photos/", ""));
        const pth = stadiumStore.photoPath(file);
        if (pth) buf = fs.readFileSync(pth);
      } catch (_) { buf = null; }
    }
    const PH_W = 190, PH_H = 125;
    ensure(buf ? PH_H + 10 : 20 + sd.items.length * 17);
    const y0 = doc.y;
    let tx = L;
    if (buf) {
      try {
        doc.save().roundedRect(L, y0, PH_W, PH_H, 8).clip();
        doc.image(buf, L, y0, { cover: [PH_W, PH_H], align: "center", valign: "center" });
        doc.restore();
        tx = L + PH_W + 18;
      } catch (_) { doc.restore(); }
    }
    let ty = y0;
    if (sd.name) {
      doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(14).text(sd.name.toUpperCase(), tx, ty, { width: R - tx });
      ty = doc.y;
      if (sd.nickname) { doc.fillColor(C.mute).font("Helvetica").fontSize(10).text(sd.nickname, tx, ty, { width: R - tx }); ty = doc.y; }
      ty += 6;
    }
    sd.items.forEach((x) => {
      doc.fillColor(C.mute).font("Helvetica-Bold").fontSize(8).text(x.label.toUpperCase(), tx, ty, { width: 110, characterSpacing: 0.6, lineBreak: false });
      doc.fillColor(C.ink).font("Helvetica").fontSize(10).text(x.value, tx + 118, ty - 1.5, { width: R - tx - 118, lineBreak: false, ellipsis: true });
      ty += 16;
    });
    doc.y = Math.max(buf ? y0 + PH_H : y0, ty) + 6;
  }

  if (o.lineups) {
    section("Escalações iniciais");
    // v6.2 — as duas colunas descem JUNTAS, linha a linha, e a página vira quando falta espaço. (Na 6.1 a lista de
    // reservas era desenhada em posições fixas: passando do fim da página, cada nome abria uma página nova.)
    const half = (CW - 20) / 2;
    const colsOf = (side) => {
      const t = sm.lineup[side], list = [{ k: "title", t: t.team.toUpperCase(), h: 18 }];
      t.starters.forEach((p) => list.push({ k: "starter", p, h: 15 }));
      if (!t.starters.length) list.push({ k: "empty", h: 15 });
      if (o.bench && t.bench.length) {
        list.push({ k: "gap", h: 6 }, { k: "benchTitle", h: 13 });
        t.bench.forEach((p) => list.push({ k: "bench", p, h: 13.5 }));
      }
      return list;
    };
    const A = colsOf("home"), B = colsOf("away");
    const drawCell = (c, x, y) => {
      if (!c) return;
      if (c.k === "title") doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(10.5).text(c.t, x, y, { width: half, lineBreak: false, ellipsis: true });
      else if (c.k === "starter") {
        doc.fillColor(C.mute).font("Helvetica-Bold").fontSize(9.5).text(String(c.p.number ?? ""), x, y, { width: 22, align: "right", lineBreak: false });
        doc.fillColor(C.ink).font("Helvetica").fontSize(10).text(`${c.p.name}${c.p.captain ? "  (C)" : ""}`, x + 30, y, { width: half - 30, lineBreak: false, ellipsis: true });
      } else if (c.k === "empty") doc.fillColor(C.mute).font("Helvetica").fontSize(10).text("(escalação não definida)", x, y, { width: half, lineBreak: false });
      else if (c.k === "benchTitle") doc.fillColor(C.mute).font("Helvetica-Bold").fontSize(8.5).text("RESERVAS", x, y, { characterSpacing: 1, lineBreak: false });
      else if (c.k === "bench") {
        doc.fillColor(C.mute).font("Helvetica").fontSize(9).text(String(c.p.number ?? ""), x, y, { width: 22, align: "right", lineBreak: false });
        doc.fillColor(C.ink).font("Helvetica").fontSize(9.5).text(`${c.p.name}${c.p.entered ? "  (entrou)" : ""}`, x + 30, y, { width: half - 30, lineBreak: false, ellipsis: true });
      }
    };
    const n = Math.max(A.length, B.length);
    let y = doc.y;
    for (let i = 0; i < n; i++) {
      const h = Math.max(A[i] ? A[i].h : 0, B[i] ? B[i].h : 0);
      if (y + h > bottom()) { doc.addPage(); y = doc.y; }
      drawCell(A[i], L, y);
      drawCell(B[i], L + half + 20, y);
      y += h;
    }
    doc.y = y + 4;
  }

  if (o.goals) {
    section("Gols");
    if (!sm.goals.length) row([{ t: "Sem gols.", w: CW, color: C.mute }], { noLine: true });
    sm.goals.forEach((g) => {
      const kind = g.kind === "penalty" ? "  (pênalti)" : g.kind === "own" ? "  (gol contra)" : "";
      row([
        { t: g.minute, w: 44, bold: true },
        { t: g.team.toUpperCase(), w: 200, bold: true, color: g.annulled ? C.mute : C.ink },
        { t: `${g.player}${kind}${g.annulled ? `   ANULADO${g.note ? ": " + g.note : ""}` : ""}`, w: CW - 44 - 200 - 70, color: g.annulled ? C.red : C.ink },
        { t: g.score, w: 70, bold: true, align: "right", color: C.blue },
      ], { h: 19, size: 10.5 });
    });
  }

  if (o.cards) {
    section("Cartões");
    if (!sm.cards.length) row([{ t: "Sem cartões.", w: CW, color: C.mute }], { noLine: true });
    sm.cards.forEach((c) => {
      ensure(20);
      doc.rect(L + 6, doc.y + 1, 9, 13).fill(c.type === "red" ? C.red : C.yellow);
      row([{ t: "", w: 22 }, { t: c.minute, w: 44, bold: true }, { t: c.team.toUpperCase(), w: 200, bold: true }, { t: c.player, w: CW - 266 }], { h: 17 });
    });
  }

  if (o.subs) {
    section(`Substituições  ·  ${sm.home.name} ${sm.subCount.home}/5  ·  ${sm.away.name} ${sm.subCount.away}/5`);
    if (!sm.subs.length) row([{ t: "Sem substituições.", w: CW, color: C.mute }], { noLine: true });
    sm.subs.forEach((s) => {
      if (s.break) {
        row([{ t: s.break.toUpperCase(), w: CW, bold: true, color: C.blue, align: "center" }], { bg: C.soft, h: 17, size: 9, noLine: true });
      } else {
        row([
          { t: s.minute, w: 44, bold: true },
          { t: s.team.toUpperCase(), w: 150, bold: true },
          { t: `sai  ${s.out.number ?? ""}  ${s.out.name}`, w: (CW - 194) / 2, color: C.red },
          { t: `entra  ${s.in.number ?? ""}  ${s.in.name}`, w: (CW - 194) / 2, color: C.green },
        ], { h: 18 });
      }
    });
  }

  // rodapé em todas as páginas (margem inferior zerada para o texto não abrir página nova)
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.page.margins.bottom = 0;
    doc.fillColor(C.mute).font("Helvetica").fontSize(8).text(`Resumo gerado em ${fmtDate(sm.generatedAt)} — painel Transmissão OBS  ·  página ${i + 1} de ${range.count}`, L, doc.page.height - 34, { width: CW, align: "center", lineBreak: false });
  }
  doc.end();
}

function fileBase(sm) {
  const slug = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const d = new Date(sm.generatedAt);
  const p2 = (n) => String(n).padStart(2, "0");
  return `resumo-${slug(sm.home.name) || "mandante"}-x-${slug(sm.away.name) || "visitante"}-${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}`;
}

module.exports = { buildSummary, toText, toPdf, parseOpts, fileBase };
