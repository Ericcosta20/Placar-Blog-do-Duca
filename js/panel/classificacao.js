/**
 * CLASSIFICAÇÃO (v6.0): editor da tabela, faixas, "colar a tabela" e controles de exibição no ar.
 * As linhas são mantidas no lugar e só os valores mudam (quem está digitando nunca perde o foco).
 */
(() => {
  const { $, $$, escapeHtml, socket } = App;
  const page = $("#page-classificacao");
  if (!page) return;

  const COLS_BASE = [["pts", "PTS"], ["j", "J"]];
  const COLS_MORE = [["v", "V"], ["e", "E"], ["d", "D"], ["gp", "GP"], ["gc", "GC"]];
  let showMore = !!App.store.get("cl_more", false);
  const rowEls = new Map();
  const zoneEls = new Map();

  /* ---------- controles de exibição ---------- */
  function renderTop() {
    const lg = App.state.league;
    $("#stVisible").checked = !!lg.visible;
    $("#stOnAirPill").hidden = !lg.visible;
    $$("#stModeSeg button").forEach((b) => b.classList.toggle("active", b.dataset.mode === lg.mode));
    $("#stProjection").checked = lg.liveProjection !== false;
    $("#stIncludeMain").checked = lg.includeMain !== false;
    if (document.activeElement !== $("#stName")) $("#stName").value = lg.name || "";
    if (document.activeElement !== $("#stRound")) $("#stRound").value = lg.round || "";
    const lc = lg.lastCommit;
    const ub = $("#stUndoCommitBtn");
    ub.hidden = !lc;
    if (lc) ub.querySelector("span").textContent = `Desfazer lançamento: ${lc.label}`;
  }
  $("#stVisible").addEventListener("change", (e) => socket.emit("league:setVisible", e.target.checked));
  $("#stModeSeg").addEventListener("click", (e) => { const b = e.target.closest("[data-mode]"); if (b) socket.emit("league:setMode", b.dataset.mode); });
  $("#stProjection").addEventListener("change", (e) => socket.emit("league:setMeta", { liveProjection: e.target.checked }));
  $("#stIncludeMain").addEventListener("change", (e) => socket.emit("league:setMeta", { includeMain: e.target.checked }));
  $("#stName").addEventListener("change", (e) => socket.emit("league:setMeta", { name: e.target.value }));
  $("#stRound").addEventListener("change", (e) => socket.emit("league:setMeta", { round: e.target.value.trim() }));
  $("#stUndoCommitBtn").addEventListener("click", () => socket.emit("league:undoCommit"));

  /* ---------- editor da tabela ---------- */
  function headHtml() {
    const cols = [...COLS_BASE, ...(showMore ? COLS_MORE : [])];
    return `<span class="cl-pos">#</span><span class="cl-nm">Time</span>${cols.map(([, l]) => `<span class="cl-n">${l}</span>`).join("")}<span class="cl-act"></span>`;
  }
  function newRow(r) {
    const el = document.createElement("div");
    el.className = "cl-row";
    el.dataset.id = r.id;
    const nums = [...COLS_BASE, ...COLS_MORE].map(([k, l]) =>
      `<input type="number" class="cl-n ${COLS_MORE.some((c) => c[0] === k) ? "more" : ""}" data-k="${k}" min="0" max="9999" step="1" inputmode="numeric" aria-label="${l}">`).join("");
    el.innerHTML = `<span class="cl-pos"></span>
      <span class="cl-nm"><span class="cl-link" title="Escudo do time"><span class="cl-crest"></span><select class="cl-pick" aria-label="Escolher o escudo (time cadastrado) deste time"></select></span><input type="text" class="cl-name" data-k="name" list="clNames" maxlength="40" autocomplete="off" aria-label="Nome do time"></span>
      ${nums}
      <span class="cl-act"><button class="icon-btn sm" data-act="up" title="Subir (desempate manual)">${App.ico("up")}</button><button class="icon-btn sm" data-act="down" title="Descer (desempate manual)">${App.ico("down")}</button><button class="icon-btn sm danger" data-act="del" title="Remover time">${App.ico("trash")}</button></span>`;
    return el;
  }
  function renderTable() {
    const lg = App.state.league;
    const box = $("#clRows");
    page.classList.toggle("show-more", showMore);
    $("#stMoreBtn").setAttribute("aria-pressed", showMore);
    $("#stMoreBtn").classList.toggle("active", showMore);
    $("#stMoreBtn").textContent = showMore ? "Menos colunas" : "Mais colunas";
    App.setHtml($("#clHead"), headHtml());

    // posição pela ordem dos pontos (base, sem projeção)
    const base = Standings.compute({ ...App.state, league: { ...lg, liveProjection: false }, others: { games: [] } }, App.teams);
    const pos = new Map(base.rows.map((r) => [r.id, r]));

    const seen = new Set();
    let crestOk = 0;
    const missing = [];
    const pickHtml = `<option value="">Automático (pelo nome)</option>` + [...App.teams].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`).join("");
    lg.teams.forEach((r, i) => {
      seen.add(r.id);
      let el = rowEls.get(r.id);
      if (!el) { el = newRow(r); rowEls.set(r.id, el); }
      if (box.children[i] !== el) box.insertBefore(el, box.children[i] || null);
      const info = pos.get(r.id);
      const p = el.querySelector(".cl-pos");
      p.textContent = info ? info.pos : "";
      p.style.setProperty("--zone", info && info.zone ? info.zone.color : "transparent");
      p.title = info && info.zone ? info.zone.label : "";
      const tm = Standings.teamForRow(r, App.teams);
      if (tm && tm.crestDataUrl) crestOk++; else missing.push(r.name || "?");
      const link = el.querySelector(".cl-crest");
      const lh = tm && tm.crestDataUrl ? `<img src="${escapeHtml(tm.crestDataUrl)}" alt="">` : `<span class="cl-noc">${tm ? "?" : "+"}</span>`;
      if (link._h !== lh) { link.innerHTML = lh; link._h = lh; }
      const pick = el.querySelector(".cl-pick");
      if (pick._o !== pickHtml) { pick.innerHTML = pickHtml; pick._o = pickHtml; }
      const want = r.teamId || "";
      if (document.activeElement !== pick && pick.value !== want) pick.value = want;
      el.querySelector(".cl-link").title = tm ? `Escudo: ${tm.name}${r.teamId ? " (escolhido por você)" : " (achado pelo nome)"}` : "Sem escudo — clique para escolher um time cadastrado";
      el.classList.toggle("linked", !!tm);
      $$("input[data-k]", el).forEach((inp) => {
        if (document.activeElement === inp) return;
        const v = r[inp.dataset.k];
        const txt = v === null || v === undefined ? "" : String(v);
        if (inp.value !== txt) inp.value = txt;
      });
      el.querySelector('[data-act="up"]').disabled = i === 0;
      el.querySelector('[data-act="down"]').disabled = i === lg.teams.length - 1;
    });
    for (const [id, el] of rowEls) if (!seen.has(id)) { el.remove(); rowEls.delete(id); }
    const hint = $("#clCrestHint");
    if (hint) {
      hint.classList.toggle("warn", missing.length > 0);
      hint.textContent = !App.teams.length ? "Nenhum time cadastrado ainda: cadastre os times (com escudo) na aba Times para os escudos aparecerem."
        : missing.length ? `Escudos: ${crestOk} de ${lg.teams.length}. Sem escudo: ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? "…" : ""}. Clique no quadradinho do escudo para escolher o time cadastrado.`
        : `Escudos: ${crestOk} de ${lg.teams.length} — todos encontrados.`;
    }

    // sugestões de nome: times cadastrados + os que já estão na tabela
    const names = [...new Set([...App.teams.map((t) => t.name), ...lg.teams.map((t) => t.name)])].filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR"));
    App.setHtml($("#clNames"), names.map((n) => `<option value="${escapeHtml(n)}">`).join(""));
  }
  $("#clRows").addEventListener("change", (e) => {
    const pk = e.target.closest(".cl-pick");
    if (pk) { socket.emit("league:setRow", { id: pk.closest(".cl-row").dataset.id, patch: { teamId: pk.value } }); return; }
    const inp = e.target.closest("input[data-k]");
    if (!inp) return;
    const id = inp.closest(".cl-row").dataset.id;
    const k = inp.dataset.k;
    socket.emit("league:setRow", { id, patch: { [k]: k === "name" ? inp.value.trim() : inp.value === "" ? null : Number(inp.value) } });
  });
  $("#clRows").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const row = b.closest(".cl-row"), id = row.dataset.id;
    if (b.dataset.act === "up") socket.emit("league:moveRow", { id, dir: -1 });
    else if (b.dataset.act === "down") socket.emit("league:moveRow", { id, dir: 1 });
    else if (b.dataset.act === "del") {
      const name = row.querySelector(".cl-name").value || "este time";
      if (await App.confirm(`Remover ${name} da tabela? Jogos de “Outros jogos” que usam esse time também saem.`, { title: "Remover time", okText: "Remover", danger: true })) socket.emit("league:removeRow", id);
    }
  });
  $("#stMoreBtn").addEventListener("click", () => { showMore = !showMore; App.store.set("cl_more", showMore); renderTable(); });
  $("#stSortBtn").addEventListener("click", () => { socket.emit("league:sortByPoints"); App.toast("Lista ordenada por pontos.", "ok", 1800); });
  $("#stAddRowBtn").addEventListener("click", () => socket.emit("league:addRow", {}));
  $("#stZeroBtn").addEventListener("click", async () => {
    if (await App.confirm("Zerar os pontos e as demais colunas de todos os times? Os nomes e as faixas continuam.", { title: "Zerar pontos", okText: "Zerar", danger: true })) socket.emit("league:resetPoints");
  });
  $("#stResetAllBtn").addEventListener("click", async () => {
    if (await App.confirm("Voltar para a lista padrão de 20 times, sem pontos? Isso também limpa a lista de Outros jogos.", { title: "Voltar ao padrão", okText: "Voltar ao padrão", danger: true })) socket.emit("league:resetAll");
  });

  /* ---------- faixas ---------- */
  function zoneRow(z) {
    const el = document.createElement("div");
    el.className = "zone-row";
    el.dataset.id = z.id;
    el.innerHTML = `<input type="color" data-k="color" aria-label="Cor da faixa">
      <input type="text" data-k="label" maxlength="40" aria-label="Nome da faixa">
      <span class="zone-range"><input type="number" data-k="from" min="1" max="99" aria-label="Da posição"><i>a</i><input type="number" data-k="to" min="1" max="99" aria-label="Até a posição"></span>
      <label class="zone-on" title="Mostrar esta faixa"><input type="checkbox" data-k="enabled"><i></i></label>
      <button class="icon-btn sm danger" data-act="del" title="Remover faixa">${App.ico("trash")}</button>`;
    return el;
  }
  function renderZones() {
    const zones = App.state.league.zones || [];
    const box = $("#zoneList");
    const seen = new Set();
    zones.forEach((z, i) => {
      seen.add(z.id);
      let el = zoneEls.get(z.id);
      if (!el) { el = zoneRow(z); zoneEls.set(z.id, el); }
      if (box.children[i] !== el) box.insertBefore(el, box.children[i] || null);
      $$("input[data-k]", el).forEach((inp) => {
        if (document.activeElement === inp) return;
        const v = z[inp.dataset.k];
        if (inp.type === "checkbox") inp.checked = v !== false;
        else if (String(inp.value) !== String(v)) inp.value = v;
      });
    });
    for (const [id, el] of zoneEls) if (!seen.has(id)) { el.remove(); zoneEls.delete(id); }
    $("#zoneAddBtn").disabled = zones.length >= 8;
  }
  $("#zoneList").addEventListener("change", (e) => {
    const inp = e.target.closest("input[data-k]");
    if (!inp) return;
    const id = inp.closest(".zone-row").dataset.id, k = inp.dataset.k;
    const v = inp.type === "checkbox" ? inp.checked : inp.type === "number" ? Number(inp.value) : inp.value;
    socket.emit("league:setZone", { id, patch: { [k]: v } });
  });
  $("#zoneList").addEventListener("click", (e) => { const b = e.target.closest('[data-act="del"]'); if (b) socket.emit("league:removeZone", b.closest(".zone-row").dataset.id); });
  $("#zoneAddBtn").addEventListener("click", () => socket.emit("league:addZone"));
  $("#zoneResetBtn").addEventListener("click", async () => {
    if (await App.confirm("Voltar às faixas padrão (Campeão, Libertadores, Pré-Libertadores, Sul-Americana e Rebaixamento)?", { okText: "Restaurar" })) socket.emit("league:resetZones");
  });

  /* ---------- colar a tabela ---------- */
  $("#stPasteBtn").addEventListener("click", () => {
    const text = $("#stPaste").value;
    if (!text.trim()) { App.toast("Cole a lista primeiro.", "err"); return; }
    socket.emit("league:bulk", { text, replace: $("#stPasteReplace").checked }, (res) => {
      if (res && res.ok) { App.toast(`Tabela atualizada: ${res.updated} atualizados, ${res.added} novos.`, "ok", 3200); $("#stPaste").value = ""; }
      else App.toast((res && res.error) || "Não consegui ler a lista.", "err", 4200);
    });
  });

  function render() { renderTop(); renderTable(); renderZones(); }
  App.registerPage("classificacao", { render });
})();
