/**
 * PÊNALTIS (v4.1): controle da disputa. As regras (vez de bater, morte súbita,
 * fim antecipado) são calculadas no servidor — aqui o painel só mostra e envia
 * "gol" / "perdeu".
 */
(() => {
  const { $, $$, escapeHtml, pad2, socket } = App;
  let shooterKey = "";

  const other = (s) => (s === "home" ? "away" : "home");

  function info() {
    const sh = App.state.match.shootout;
    const kicks = sh.kicks || [];
    const rounds = sh.rounds || 5;
    const by = { home: [], away: [] };
    kicks.forEach((k) => by[k.side === "away" ? "away" : "home"].push(k));
    const goals = { home: by.home.filter((k) => k.scored).length, away: by.away.filter((k) => k.scored).length };
    const total = kicks.length;
    const planned = Math.max(rounds, Math.ceil(total / 2));
    const first = sh.firstSide === "away" ? "away" : "home";
    const nextSide = sh.finished ? null : total % 2 === 0 ? first : other(first);
    return { sh, kicks, rounds, by, goals, total, planned, first, nextSide, round: Math.floor(total / 2) + 1, suddenDeath: total >= rounds * 2 };
  }

  const ICON_CHECK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5l5 5 10-11"/></svg>`;
  const ICON_X = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`;

  function renderBoard(i) {
    const rows = ["home", "away"].map((side) => {
      const list = i.by[side];
      const n = Math.max(i.planned, list.length);
      let sq = "";
      for (let k = 0; k < n; k++) {
        const kick = list[k];
        let cls = "psq", inner = "", attrs = "";
        if (kick) {
          cls += kick.scored ? " goal" : " miss";
          inner = kick.scored ? ICON_CHECK : ICON_X;
          attrs = `data-flip="${kick.id}" title="${kick.playerName ? escapeHtml(kick.playerName) + " — " : ""}clique para corrigir"`;
        } else if (i.nextSide === side && k === list.length) cls += " next";
        if (k === i.rounds) cls += " sd";
        sq += kick ? `<button type="button" class="${cls}" ${attrs}>${inner}</button>` : `<span class="${cls}"></span>`;
      }
      return `<div class="prow ${i.nextSide === side ? "turn" : ""}">
        <span class="pname">${escapeHtml(App.teamLabel(side))}</span>
        <span class="psquares">${sq}</span>
        <span class="ptotal">${i.goals[side]}</span></div>`;
    }).join("");
    App.setHtml($("#penBoard"), rows);
  }

  function shooterOptions(side) {
    const ms = App.state.match[side];
    const team = App.findTeam(ms.teamId);
    const all = team ? team.players || [] : [];
    const starters = new Set(ms.starterIds || []);
    const opt = (p) => `<option value="${p.id}">${pad2(p.number)} — ${escapeHtml(p.name)}</option>`;
    const on = all.filter((p) => starters.has(p.id)), off = all.filter((p) => !starters.has(p.id));
    return `<option value="">— sem nome —</option>` +
      (on.length ? `<optgroup label="Em campo">${on.map(opt).join("")}</optgroup>` : "") +
      (off.length ? `<optgroup label="${on.length ? "Banco / demais" : "Elenco"}">${off.map(opt).join("")}</optgroup>` : "");
  }

  function render() {
    if (!App.state) return;
    const i = info();
    const sh = i.sh;

    $("#penVisible").checked = !!sh.visible;
    $("#penOnAirPill").hidden = !sh.visible;
    $("#penFirstHome").textContent = App.teamLabel("home");
    $("#penFirstAway").textContent = App.teamLabel("away");
    $$("#penFirstSeg button").forEach((b) => { b.classList.toggle("active", b.dataset.first === i.first); b.disabled = i.total > 0; });
    $("#penFirstHint").hidden = i.total > 0 ? false : true;

    const badge = $("#penBadge");
    badge.textContent = sh.finished ? "Encerrada" : i.total === 0 ? "Não iniciada" : i.suddenDeath ? "Morte súbita" : "Em andamento";
    badge.className = "badge " + (sh.finished ? "badge-ok" : i.total > 0 ? "badge-warn" : "");

    renderBoard(i);

    // faixa de situação
    const banner = $("#penBanner");
    if (sh.finished && sh.winner) {
      banner.className = "pen-banner win";
      banner.innerHTML = `<b>${escapeHtml(App.teamLabel(sh.winner))}</b> venceu a disputa por <b>${i.goals.home} × ${i.goals.away}</b>`;
    } else if (i.total === 0) {
      banner.className = "pen-banner";
      banner.textContent = "Escolha quem bate primeiro e lance as cobranças ao lado. Ligue “Mostrar no ar” quando quiser colocar o cartão no ar.";
    } else {
      banner.className = "pen-banner";
      banner.innerHTML = `Parcial: <b>${i.goals.home} × ${i.goals.away}</b>${i.suddenDeath ? " — morte súbita" : ""}`;
    }

    // próxima cobrança
    const next = $("#penNext");
    const canKick = !!i.nextSide;
    if (canKick) {
      next.className = "pen-next";
      next.innerHTML = `<small>Cobrança ${i.round}${i.suddenDeath ? " · morte súbita" : ""}</small><strong>Vez de ${escapeHtml(App.teamLabel(i.nextSide))}</strong>`;
      const key = `${i.nextSide}|${App.state.match[i.nextSide].teamId}|${(App.state.match[i.nextSide].starterIds || []).join(",")}|${App.teams.length}`;
      if (key !== shooterKey) { shooterKey = key; $("#penShooter").innerHTML = shooterOptions(i.nextSide); }
    } else {
      next.className = "pen-next done";
      next.innerHTML = sh.finished ? `<small>Disputa encerrada</small><strong>Use “Desfazer” se lançou algo errado</strong>` : `<small>Limite de cobranças atingido</small>`;
    }
    $("#penShooterField").hidden = !canKick;
    $("#penGoalBtn").disabled = !canKick;
    $("#penMissBtn").disabled = !canKick;
    $("#penUndoBtn").disabled = i.total === 0;
    $("#penResetBtn").disabled = i.total === 0;
  }

  function kick(scored) {
    const i = info();
    if (!i.nextSide) return;
    const id = $("#penShooter").value;
    const team = App.findTeam(App.state.match[i.nextSide].teamId);
    const p = id && team ? team.players.find((x) => x.id === id) : null;
    socket.emit("shootout:kick", { scored, playerId: p ? p.id : null, playerName: p ? p.name : "" });
    $("#penShooter").value = "";
  }

  $("#penGoalBtn").addEventListener("click", () => kick(true));
  $("#penMissBtn").addEventListener("click", () => kick(false));
  $("#penUndoBtn").addEventListener("click", () => socket.emit("shootout:undo"));
  $("#penResetBtn").addEventListener("click", async () => {
    if (await App.confirm("Apagar todas as cobranças desta disputa? O placar da partida não é afetado.", { title: "Reiniciar disputa", okText: "Reiniciar", danger: true })) socket.emit("shootout:reset");
  });
  $("#penVisible").addEventListener("change", (e) => socket.emit("shootout:setVisible", e.target.checked));
  $("#penFirstSeg").addEventListener("click", (e) => {
    const b = e.target.closest("[data-first]");
    if (b && !b.disabled) socket.emit("shootout:setFirst", b.dataset.first);
  });
  $("#penBoard").addEventListener("click", (e) => {
    const f = e.target.closest("[data-flip]");
    if (f) socket.emit("shootout:flip", f.dataset.flip);
  });

  App.registerPage("penaltis", { render });
})();
