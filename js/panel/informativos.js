/**
 * PARTIDA — OUTROS JOGOS e ARBITRAGEM (v6.0)
 * Dois blocos da aba Partida (arrastáveis como os outros). Os elementos de cada jogo ficam no lugar
 * e só os valores mudam, para não atrapalhar quem está digitando.
 */
(() => {
  const { $, $$, escapeHtml, socket } = App;
  if (!$("#othersCard")) return;

  /* ================= OUTROS JOGOS ================= */
  const gameEls = new Map();
  let optionsSig = "", optsCache = "";

  function teamOptions() {
    const rows = [...App.state.league.teams].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return `<option value="">— time —</option>` + rows.map((r) => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join("");
  }
  function newGame(g) {
    const el = document.createElement("div");
    el.className = "og";
    el.dataset.id = g.id;
    el.innerHTML = `
      <div class="og-top">
        <select class="og-home" data-k="homeId" aria-label="Time da casa"></select>
        <div class="og-score" role="group" aria-label="Placar">
          <button class="btn btn-round btn-sm" data-score="home" data-d="-1" aria-label="Diminuir casa">${App.ico("minus")}</button>
          <b class="og-hs">0</b>
          <button class="btn btn-round btn-sm og-plus" data-score="home" data-d="1" aria-label="Gol da casa">${App.ico("plus")}</button>
          <span class="og-x">×</span>
          <button class="btn btn-round btn-sm" data-score="away" data-d="-1" aria-label="Diminuir visitante">${App.ico("minus")}</button>
          <b class="og-as">0</b>
          <button class="btn btn-round btn-sm og-plus" data-score="away" data-d="1" aria-label="Gol do visitante">${App.ico("plus")}</button>
        </div>
        <select class="og-away" data-k="awayId" aria-label="Time visitante"></select>
      </div>
      <div class="og-bottom">
        <select data-k="status" aria-label="Situação"><option value="live">Ao vivo</option><option value="finished">Encerrado</option><option value="scheduled">Agendado</option></select>
        <input type="text" data-k="minute" maxlength="12" placeholder="Minuto" aria-label="Minuto ou horário">
        <input type="text" data-k="round" maxlength="12" placeholder="Rodada" inputmode="numeric" aria-label="Rodada deste jogo">
        <label class="og-air" title="Aparece quando você mostra os jogos no ar"><input type="checkbox" data-k="onAir"><i></i><span>No ar</span></label>
        <button class="btn btn-sm og-commit" data-act="commit" title="Grava este resultado nos pontos da tabela e tira o jogo da lista">Lançar na tabela</button>
        <button class="icon-btn sm danger" data-act="del" title="Remover jogo">${App.ico("trash")}</button>
      </div>`;
    return el;
  }
  function renderOthers() {
    const s = App.state, games = s.others.games || [];
    const box = $("#othersList");
    const sig = s.league.teams.map((t) => t.id + t.name).join("|");
    const optHtml = sig !== optionsSig ? (optsCache = teamOptions()) : null;
    const seen = new Set();
    games.forEach((g, i) => {
      seen.add(g.id);
      let el = gameEls.get(g.id);
      if (!el) { el = newGame(g); gameEls.set(g.id, el); $$("select.og-home, select.og-away", el).forEach((sel) => { sel.innerHTML = optsCache; }); }
      if (box.children[i] !== el) box.insertBefore(el, box.children[i] || null);
      if (optHtml !== null) $$("select.og-home, select.og-away", el).forEach((sel) => { sel.innerHTML = optHtml; sel._v = null; });
      $$("[data-k]", el).forEach((inp) => {
        if (document.activeElement === inp) return;
        const v = g[inp.dataset.k];
        if (inp.type === "checkbox") inp.checked = v !== false;
        else if (String(inp.value) !== String(v ?? "")) inp.value = v ?? "";
      });
      el.querySelector(".og-hs").textContent = g.homeScore;
      el.querySelector(".og-as").textContent = g.awayScore;
      el.classList.toggle("is-off", g.onAir === false);
      el.classList.toggle("is-sched", g.status === "scheduled");
      el.classList.toggle("is-fin", g.status === "finished");
    });
    for (const [id, el] of gameEls) if (!seen.has(id)) { el.remove(); gameEls.delete(id); }
    if (optHtml !== null) optionsSig = sig;
    // opções recriadas: reaplica o time escolhido
    $$(".og", box).forEach((el) => {
      const g = games.find((x) => x.id === el.dataset.id); if (!g) return;
      [["og-home", g.homeId], ["og-away", g.awayId]].forEach(([c, v]) => { const sel = el.querySelector("select." + c); if (document.activeElement !== sel && sel.value !== v) sel.value = v; });
    });

    const on = !!s.others.visible;
    const onAirCount = games.filter((g) => g.onAir !== false).length;
    $("#othersEmpty").style.display = games.length ? "none" : "block";
    $("#othersBadge").textContent = games.length === 1 ? "1 jogo" : `${games.length} jogos`;
    const btn = $("#othersShowBtn");
    btn.classList.toggle("btn-primary", !on);
    btn.classList.toggle("btn-danger", on);
    btn.setAttribute("aria-pressed", on);
    btn.querySelector("span").textContent = on ? "Tirar jogos do ar" : onAirCount === 1 ? "Mostrar 1 jogo no ar" : "Mostrar jogos no ar";
    btn.disabled = !on && !onAirCount;
    $("#othersLivePill").hidden = !on;
    $("#othersClearBtn").disabled = !games.length;
  }
  $("#othersShowBtn").addEventListener("click", () => socket.emit("others:setVisible", !App.state.others.visible));
  $("#othersAddBtn").addEventListener("click", () => socket.emit("others:addGame", {}));
  $("#othersClearBtn").addEventListener("click", async () => {
    if (await App.confirm("Remover todos os jogos da lista de Outros jogos? Os pontos da tabela não mudam.", { title: "Limpar lista", okText: "Limpar", danger: true })) socket.emit("others:clear");
  });
  $("#othersList").addEventListener("change", (e) => {
    const inp = e.target.closest("[data-k]");
    if (!inp) return;
    const id = inp.closest(".og").dataset.id, k = inp.dataset.k;
    socket.emit("others:updateGame", { id, patch: { [k]: inp.type === "checkbox" ? inp.checked : inp.value } });
  });
  $("#othersList").addEventListener("click", async (e) => {
    const el = e.target.closest(".og");
    if (!el) return;
    const id = el.dataset.id;
    const sc = e.target.closest("[data-score]");
    if (sc) { socket.emit("others:score", { id, side: sc.dataset.score, delta: Number(sc.dataset.d) }); return; }
    const act = e.target.closest("[data-act]");
    if (!act) return;
    if (act.dataset.act === "del") {
      if (await App.confirm("Remover este jogo da lista?", { title: "Remover jogo", okText: "Remover", danger: true })) socket.emit("others:removeGame", id);
    } else if (act.dataset.act === "commit") {
      const g = App.state.others.games.find((x) => x.id === id);
      const nm = (rid) => { const r = App.state.league.teams.find((t) => t.id === rid); return r ? r.name : "?"; };
      if (!g || (!g.homeId && !g.awayId)) { App.toast("Escolha os times do jogo antes de lançar.", "err"); return; }
      if (await App.confirm(`Gravar ${nm(g.homeId)} ${g.homeScore} × ${g.awayScore} ${nm(g.awayId)} nos pontos da tabela e tirar o jogo da lista? (Dá para desfazer em Classificação.)`, { title: "Lançar na tabela", okText: "Lançar" })) {
        socket.emit("others:commitGame", id, (res) => { if (res && res.ok) App.toast("Resultado lançado na tabela.", "ok", 2600); else App.toast((res && res.error) || "Não foi possível lançar.", "err"); });
      }
    }
  });

  /* ================= ARBITRAGEM ================= */
  const ROLES = [
    ["main", "Árbitro", "ref"], ["ass1", "Assistente 1", "ref"], ["ass2", "Assistente 2", "ref"], ["fourth", "4º árbitro", "ref"],
    ["var", "VAR", "var"], ["avar1", "AVAR 1", "var"], ["avar2", "AVAR 2", "var"],
  ];
  $("#officialsGrid").innerHTML = ROLES.map(([k, l]) => `<div class="of-line" data-key="${k}"><label for="of_${k}">${l}</label>
    <input type="text" id="of_${k}" data-f="name" maxlength="60" placeholder="Nome" autocomplete="off">
    <input type="text" data-f="from" maxlength="30" placeholder="UF" class="of-uf" autocomplete="off" aria-label="UF ou federação de ${l}"></div>`).join("");

  function renderOfficials() {
    const o = App.state.officials;
    let filled = 0;
    $$("#officialsGrid .of-line").forEach((line) => {
      const e = o[line.dataset.key] || {};
      if (e.name) filled++;
      $$("input", line).forEach((inp) => { if (document.activeElement !== inp && inp.value !== (e[inp.dataset.f] || "")) inp.value = e[inp.dataset.f] || ""; });
    });
    $("#officialsCount").textContent = filled ? `(${filled} de 7)` : "(vazio)";
    const setBtn = (id, on, labelOn, labelOff) => {
      const b = $(id);
      b.classList.toggle("btn-danger", on);
      b.classList.toggle("btn-primary", !on);
      b.setAttribute("aria-pressed", on);
      b.querySelector("span").textContent = on ? labelOn : labelOff;
    };
    setBtn("#refShowBtn", !!o.refVisible, "Tirar arbitragem do ar", "Mostrar arbitragem");
    setBtn("#varShowBtn", !!o.varVisible, "Tirar VAR do ar", "Mostrar VAR");
    $("#officialsLivePill").hidden = !(o.refVisible || o.varVisible);
  }
  $("#officialsGrid").addEventListener("change", (e) => {
    const inp = e.target.closest("input[data-f]");
    if (!inp) return;
    socket.emit("officials:set", { key: inp.closest(".of-line").dataset.key, [inp.dataset.f]: inp.value });
  });
  $("#refShowBtn").addEventListener("click", () => socket.emit("officials:setVisible", { which: "ref", visible: !App.state.officials.refVisible }));
  $("#varShowBtn").addEventListener("click", () => socket.emit("officials:setVisible", { which: "var", visible: !App.state.officials.varVisible }));
  $("#officialsClearBtn").addEventListener("click", async () => {
    if (await App.confirm("Apagar todos os nomes da arbitragem e do VAR?", { title: "Limpar nomes", okText: "Limpar", danger: true })) socket.emit("officials:clear");
  });

  App.renderOthers = renderOthers;
  App.renderOfficials = renderOfficials;
})();
