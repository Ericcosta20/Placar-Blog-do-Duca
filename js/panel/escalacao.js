/** ESCALAÇÃO (v4.0/v5.0): escolha dos times da partida, titulares, capitães e reservas. */
(() => {
  const { $, escapeHtml, pad2, socket } = App;
  const SIDES = { home: "Mandante", away: "Visitante" };
  const MAX_BENCH = 15;

  function renderSide(side) {
    const ms = App.state.match[side];
    const team = App.findTeam(ms.teamId);
    const opts = `<option value="">Selecione o time ${side === "home" ? "mandante" : "visitante"}</option>` +
      App.teams.map((t) => `<option value="${t.id}">${escapeHtml(t.name || "(sem nome)")}</option>`).join("");
    const sel = $(`#${side}TeamSelect`);
    App.setHtml(sel, opts);
    sel.value = ms.teamId || "";

    const pool = $(`#${side}StarterPool`), counter = $(`#${side}StarterCounter`), cap = $(`#${side}CaptainSelect`);
    const n = ms.starterIds.length;
    counter.textContent = `${n} / 11`;
    counter.className = "badge " + (n === 11 ? "badge-ok" : "");
    $(`#${side}ClearBtn`).disabled = n === 0;

    renderBench(side, team);

    if (!team) {
      App.setHtml(pool, `<p class="empty">Selecione o time ${side === "home" ? "mandante" : "visitante"}.</p>`);
      App.setHtml(cap, `<option value="">Selecione o time primeiro</option>`);
      cap.disabled = true;
      return;
    }
    const players = team.players || [];
    if (!players.length) {
      App.setHtml(pool, `<p class="empty">Este time ainda não tem jogadores. Cadastre o elenco na aba Times.</p>`);
    } else {
      App.setHtml(pool, players.map((p) => {
        const on = ms.starterIds.includes(p.id);
        const disabled = !on && n >= 11;
        return `<button type="button" class="chip ${on ? "on" : ""}" data-side="${side}" data-player="${p.id}" ${disabled ? "disabled" : ""}>
          <span class="chip-num">${pad2(p.number)}</span><span class="chip-name">${escapeHtml(p.name)}</span><span class="chip-pos">${escapeHtml(p.position || "")}</span><span class="chip-check">${App.ico("check")}</span></button>`;
      }).join(""));
    }
    const starters = players.filter((p) => ms.starterIds.includes(p.id));
    cap.disabled = starters.length === 0;
    App.setHtml(cap, starters.length
      ? `<option value="">Sem capitão</option>` + starters.map((p) => `<option value="${p.id}">${pad2(p.number)} — ${escapeHtml(p.name)}</option>`).join("")
      : `<option value="">Marque os titulares primeiro</option>`);
    cap.value = ms.captainId && starters.some((p) => p.id === ms.captainId) ? ms.captainId : "";
  }

  /* ---------- Reservas (v5.0): só aparecem jogadores que NÃO são titulares ---------- */
  function renderBench(side, team) {
    const ms = App.state.match[side];
    const pool = $(`#${side}BenchPool`), counter = $(`#${side}BenchCounter`);
    const bench = (ms.benchIds || []).filter((id) => !ms.starterIds.includes(id));
    counter.textContent = `${bench.length} / ${MAX_BENCH}`;
    counter.className = "badge " + (bench.length > 0 ? "badge-ok" : "");
    $(`#${side}BenchClearBtn`).disabled = bench.length === 0;
    if (!team) {
      App.setHtml(pool, `<p class="empty">Selecione o time primeiro.</p>`);
      $(`#${side}BenchAllBtn`).disabled = true;
      return;
    }
    const others = (team.players || []).filter((p) => !ms.starterIds.includes(p.id));
    $(`#${side}BenchAllBtn`).disabled = others.length === 0;
    if (!others.length) { App.setHtml(pool, `<p class="empty">Marque os titulares — os demais jogadores aparecem aqui.</p>`); return; }
    App.setHtml(pool, others.map((p) => {
      const on = bench.includes(p.id);
      const disabled = !on && bench.length >= MAX_BENCH;
      return `<button type="button" class="chip ${on ? "on" : ""}" data-side="${side}" data-bench="${p.id}" ${disabled ? "disabled" : ""}>
        <span class="chip-num">${pad2(p.number)}</span><span class="chip-name">${escapeHtml(p.name)}</span><span class="chip-pos">${escapeHtml(p.position || "")}</span><span class="chip-check">${App.ico("check")}</span></button>`;
    }).join(""));
  }

  function render() {
    renderSide("home"); renderSide("away");
    App.controls.sync($("#page-escalacao"));
  }

  App.controls.bind($("#page-escalacao"));

  ["home", "away"].forEach((side) => {
    $(`#${side}TeamSelect`).addEventListener("change", (e) => {
      socket.emit("match:setSide", { side, data: { teamId: e.target.value || null, starterIds: [], benchIds: [], captainId: null } });
    });
    $(`#${side}CaptainSelect`).addEventListener("change", (e) => {
      socket.emit("match:setSide", { side, data: { captainId: e.target.value || null } });
    });
    $(`#${side}ClearBtn`).addEventListener("click", async () => {
      if (!(await App.confirm(`Limpar os titulares do ${SIDES[side].toLowerCase()}?`, { okText: "Limpar" }))) return;
      socket.emit("match:setSide", { side, data: { starterIds: [], captainId: null } });
    });
    $(`#${side}StarterPool`).addEventListener("click", (e) => {
      const chip = e.target.closest("[data-player]");
      if (!chip || chip.disabled) return;
      const ms = App.state.match[side];
      const ids = [...ms.starterIds];
      const i = ids.indexOf(chip.dataset.player);
      let captainId = ms.captainId;
      if (i >= 0) { ids.splice(i, 1); if (captainId === chip.dataset.player) captainId = null; }
      else if (ids.length < 11) ids.push(chip.dataset.player);
      else return;
      socket.emit("match:setSide", { side, data: { starterIds: ids, captainId } });
    });
    // reservas
    $(`#${side}BenchPool`).addEventListener("click", (e) => {
      const chip = e.target.closest("[data-bench]");
      if (!chip || chip.disabled) return;
      const ms = App.state.match[side];
      const ids = (ms.benchIds || []).filter((id) => !ms.starterIds.includes(id));
      const i = ids.indexOf(chip.dataset.bench);
      if (i >= 0) ids.splice(i, 1);
      else if (ids.length < MAX_BENCH) ids.push(chip.dataset.bench);
      else return;
      socket.emit("match:setSide", { side, data: { benchIds: ids } });
    });
    $(`#${side}BenchAllBtn`).addEventListener("click", () => {
      const ms = App.state.match[side];
      const team = App.findTeam(ms.teamId);
      if (!team) return;
      const ids = (team.players || []).filter((p) => !ms.starterIds.includes(p.id)).map((p) => p.id).slice(0, MAX_BENCH);
      socket.emit("match:setSide", { side, data: { benchIds: ids } });
      if ((team.players || []).filter((p) => !ms.starterIds.includes(p.id)).length > MAX_BENCH) App.toast(`Só cabem ${MAX_BENCH} reservas — os primeiros foram marcados.`, "info", 3200);
    });
    $(`#${side}BenchClearBtn`).addEventListener("click", () => socket.emit("match:setSide", { side, data: { benchIds: [] } }));
  });

  // v5.1 — liga os reservas de um time: avisa se ainda não há nenhum reserva escolhido
  [["Home", "home"], ["Away", "away"]].forEach(([suffix, side]) => {
    [`#benchOnAir${suffix}`, `#benchOnAir${suffix}2`].forEach((sel) => {
      const el = $(sel);
      if (!el) return;
      el.addEventListener("change", () => {
        if (!el.checked) return;
        const ms = App.state.match[side];
        const n = (ms.benchIds || []).filter((id) => !ms.starterIds.includes(id)).length;
        if (!n) App.toast(`Escolha os reservas do ${side === "home" ? "mandante" : "visitante"} na aba Escalação — ainda não há nenhum marcado.`, "err", 4200);
      });
    });
  });

  App.registerPage("escalacao", { render });
})();
