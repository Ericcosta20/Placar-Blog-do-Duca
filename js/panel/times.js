/**
 * TIMES (v4.0): lista + editor.
 * Salvamento automático com controle de concorrência (uma gravação por vez) —
 * corrige o bug da v3.x em que digitar rápido um time novo podia criar vários arquivos.
 */
(() => {
  const { $, escapeHtml, socket } = App;

  const TEAM_PALETTES = window.Palettes.TEAMS; // v4.1: 26 paletas prontas (palettes.js)
  const COLOR_FIELDS = [
    ["primaryColor", "Principal"], ["secondaryColor", "Secundária"], ["textColor", "Texto"], ["numberColor", "Números"],
    ["bgColor", "Fundo"], ["dividerColor", "Divisórias"], ["captainColor", "Capitão"], ["shadowColor", "Sombra"],
  ];

  const heavyTeams = () => App.teams.filter((t) => t.crestDataUrl && t.crestDataUrl.length > 400000);

  const blankTeam = () => ({
    id: null, name: "", shortName: "", crestDataUrl: "", captainSymbol: "(C)",
    primaryColor: "#0057ff", secondaryColor: "#ffffff", textColor: "#f5f6f8", numberColor: "#ffffff",
    bgColor: "#0c0f14", dividerColor: "#ffffff", captainColor: "#ffd700", shadowColor: "#000000",
    coach: "", city: "", players: [],
  });

  let draft = null;         // time em edição (fonte da verdade enquanto edita)
  let loadedKey = null;     // id do time carregado no editor ("__new__" para novo)
  let editingPlayerId = null;
  let saving = false, pending = false;

  /* ---------- Grade de cores (gerada uma vez) ---------- */
  $("#teamColorGrid").innerHTML = COLOR_FIELDS.map(([k, l]) =>
    `<div class="ctl ctl-color"><label for="tc_${k}">${l}</label><div class="color-input"><input type="color" id="tc_${k}" data-team-color="${k}"><code id="tch_${k}"></code></div></div>`).join("");
  $("#teamPaletteRow").innerHTML = TEAM_PALETTES.map((p, i) =>
    `<button type="button" class="palette-swatch" data-pal="${i}" title="${p.name}"><span style="background:${p.primaryColor}"></span><span style="background:${p.secondaryColor}"></span><span style="background:${p.bgColor}"></span></button>`).join("");

  /* ---------- Salvamento ---------- */
  function setSaveState(text, kind = "") {
    const el = $("#teamSaveState");
    el.textContent = text; el.className = "save-state " + kind;
  }
  const scheduleSave = App.debounce(doSave, 450);
  function doSave() {
    if (!draft) return;
    if (!draft.id && !draft.name.trim()) { setSaveState("Digite o nome do time para criá-lo"); return; }
    if (saving) { pending = true; return; }
    saving = true;
    setSaveState("Salvando…", "busy");
    socket.emit("teams:save", draft, (res) => {
      saving = false;
      if (res && res.ok) {
        if (!draft.id) { draft.id = res.team.id; loadedKey = res.team.id; }
        setSaveState("Salvo", "ok");
      } else setSaveState("Erro ao salvar: " + ((res && res.error) || "tente de novo"), "err");
      if (pending) { pending = false; doSave(); }
    });
  }
  function touch() { setSaveState("Alterações pendentes…", "busy"); scheduleSave(); renderHeaderBits(); }

  /* ---------- Lista ---------- */
  function renderList() {
    const q = ($("#teamSearch").value || "").trim().toLowerCase();
    const list = App.teams.filter((t) => !q || (t.name || "").toLowerCase().includes(q));
    const heavy = heavyTeams().length;
    $("#optCrestsBtn").hidden = !heavy;
    $("#optCrestsBtn").textContent = `Reduzir ${heavy} escudo${heavy > 1 ? "s" : ""} pesado${heavy > 1 ? "s" : ""}`;
    $("#teamList").innerHTML = list.length
      ? list.map((t) => `
        <button class="team-item ${t.id === (draft && draft.id) ? "active" : ""}" data-team="${t.id}">
          <span class="ti-crest">${t.crestDataUrl ? `<img src="${t.crestDataUrl}" alt="">` : App.ico("teams")}</span>
          <span class="ti-text"><b>${escapeHtml(t.name || "(sem nome)")}</b><small>${t.players.length} jogador${t.players.length === 1 ? "" : "es"}${t.city ? " · " + escapeHtml(t.city) : ""}</small></span>
          <span class="ti-colors"><i style="background:${t.primaryColor}"></i><i style="background:${t.secondaryColor}"></i></span>
        </button>`).join("")
      : `<p class="empty">${q ? "Nenhum time com esse nome." : "Nenhum time cadastrado ainda."}</p>`;
  }
  function renderHeaderBits() {
    $("#playersCount").textContent = draft ? draft.players.length : 0;
  }

  /* ---------- Editor ---------- */
  function loadDraft(team) {
    flushPending();
    draft = team ? JSON.parse(JSON.stringify(team)) : blankTeam();
    loadedKey = draft.id || "__new__";
    editingPlayerId = null;
    resetPlayerForm();
    $("#teamName").value = draft.name || "";
    $("#teamShort").value = draft.shortName || "";
    $("#teamCity").value = draft.city || "";
    $("#teamCoach").value = draft.coach || "";
    $("#captainSymbol").value = draft.captainSymbol || "(C)";
    COLOR_FIELDS.forEach(([k]) => { $("#tc_" + k).value = draft[k] || "#000000"; $("#tch_" + k).textContent = (draft[k] || "").toUpperCase(); });
    renderCrest();
    renderPlayers();
    renderHeaderBits();
    setSaveState(draft.id ? "Salvo" : "Time novo — digite o nome", draft.id ? "ok" : "");
    $("#deleteTeamBtn").disabled = !draft.id;
    $("#duplicateTeamBtn").disabled = !draft.id;
    renderList();
  }
  function flushPending() { /* o debounce dispara em até 450 ms; trocar de time não cancela */ }

  function renderCrest() {
    $("#crestPreview").innerHTML = draft.crestDataUrl ? `<img src="${draft.crestDataUrl}" alt="Escudo">` : App.ico("image");
    $("#crestRemoveBtn").disabled = !draft.crestDataUrl;
  }

  function renderPlayers() {
    const players = draft ? draft.players : [];
    $("#playersEmptyMsg").style.display = players.length ? "none" : "block";
    $("#playersTable").style.display = players.length ? "table" : "none";
    $("#playersTableBody").innerHTML = players.map((p) => `
      <tr class="${p.id === editingPlayerId ? "editing" : ""}">
        <td class="t-num"><span class="num-pill">${App.pad2(p.number)}</span></td>
        <td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.position || "")}</td><td class="muted">${escapeHtml(p.notes || "")}</td>
        <td class="t-act"><button class="icon-btn sm" data-edit="${p.id}" title="Editar">${App.ico("edit")}</button><button class="icon-btn sm danger" data-del="${p.id}" title="Excluir">${App.ico("trash")}</button></td>
      </tr>`).join("");
    $("#playersCount").textContent = players.length;
  }

  function resetPlayerForm() {
    editingPlayerId = null;
    $("#playerForm").reset();
    $("#playerSubmit span").textContent = "Adicionar";
    $("#playerCancel").hidden = true;
  }

  /* ---------- Eventos: campos de identidade ---------- */
  const bindText = (id, key) => $(id).addEventListener("input", (e) => { if (!draft) return; draft[key] = e.target.value; touch(); });
  bindText("#teamName", "name"); bindText("#teamCity", "city"); bindText("#teamCoach", "coach");
  $("#teamShort").addEventListener("input", (e) => { if (!draft) return; e.target.value = e.target.value.toUpperCase(); draft.shortName = e.target.value; touch(); });
  $("#captainSymbol").addEventListener("change", (e) => { draft.captainSymbol = e.target.value; touch(); });

  /* ---------- Escudo (v6.2): aceita PNG, JPG, WebP e GIF; reduz para no máximo 512 px (PNG com transparência) ----------
     Escudo enorme (ex.: 4096 × 4096) pesava no painel, no ar e quebrava o PDF do resumo. */
  const CREST_MAX = 512, CREST_OK = ["image/png", "image/jpeg", "image/webp", "image/gif"];
  const loadImage = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Não consegui abrir essa imagem.")); i.src = src; });
  /** Devolve { dataUrl, w, h, from, reduced } com o escudo redesenhado em PNG (<= 512 px no lado maior). */
  async function normalizeCrest(src) {
    const img = await loadImage(src);
    const k = Math.min(1, CREST_MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    g.imageSmoothingQuality = "high";
    g.drawImage(img, 0, 0, w, h);
    return { dataUrl: c.toDataURL("image/png"), w, h, from: [img.naturalWidth, img.naturalHeight], reduced: k < 1 };
  }
  $("#teamCrest").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (!CREST_OK.includes(file.type)) {
      App.toast(`“${file.name}” não é uma imagem aceita. Use PNG (melhor, com fundo transparente), JPG ou WebP.`, "err", 5200);
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const r = await normalizeCrest(url);
      draft.crestDataUrl = r.dataUrl; renderCrest(); touch();
      if (r.reduced) App.toast(`Escudo reduzido de ${r.from[0]}×${r.from[1]} para ${r.w}×${r.h} px (mais leve para o painel, o OBS e o PDF).`, "ok", 4200);
    } catch (err) { App.toast(err.message, "err", 4200); }
    URL.revokeObjectURL(url);
  });
  /** Reduz de uma vez os escudos já cadastrados que estão pesados (> ~300 KB). */
  async function optimizeCrests() {
    let done = 0;
    for (const t of heavyTeams()) {
      try {
        const r = await normalizeCrest(t.crestDataUrl);
        await new Promise((res) => socket.emit("teams:save", { ...t, crestDataUrl: r.dataUrl }, res));
        done++;
      } catch (_) { /* segue com os outros */ }
    }
    App.toast(done ? `${done} escudo(s) reduzido(s) para até ${CREST_MAX} px.` : "Não consegui reduzir os escudos.", done ? "ok" : "err");
  }
  $("#optCrestsBtn").addEventListener("click", optimizeCrests);
  $("#crestRemoveBtn").addEventListener("click", () => { draft.crestDataUrl = ""; renderCrest(); touch(); });

  $("#teamColorGrid").addEventListener("input", (e) => {
    const k = e.target.dataset.teamColor;
    if (!k || !draft) return;
    draft[k] = e.target.value; $("#tch_" + k).textContent = e.target.value.toUpperCase(); touch();
  });
  $("#teamPaletteRow").addEventListener("click", (e) => {
    const b = e.target.closest("[data-pal]");
    if (!b || !draft) return;
    const pal = TEAM_PALETTES[Number(b.dataset.pal)];
    COLOR_FIELDS.forEach(([k]) => { draft[k] = pal[k]; $("#tc_" + k).value = pal[k]; $("#tch_" + k).textContent = pal[k].toUpperCase(); });
    $("#teamPaletteName").textContent = "— aplicada: " + pal.name;
    touch();
  });

  /* ---------- Elenco ---------- */
  $("#playerForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!draft) return;
    const number = parseInt($("#playerNumber").value, 10);
    const name = $("#playerName").value.trim();
    if (!Number.isFinite(number) || !name) return;
    const data = { number, name, position: $("#playerPosition").value.trim(), notes: $("#playerNotes").value.trim() };
    if (editingPlayerId) {
      const p = draft.players.find((x) => x.id === editingPlayerId);
      if (p) Object.assign(p, data);
    } else draft.players.push({ id: App.generateId(), ...data });
    resetPlayerForm(); renderPlayers(); touch();
    $("#playerNumber").focus();
  });
  $("#playerCancel").addEventListener("click", () => { resetPlayerForm(); renderPlayers(); });

  $("#playersTableBody").addEventListener("click", async (e) => {
    const ed = e.target.closest("[data-edit]"), del = e.target.closest("[data-del]");
    if (ed) {
      const p = draft.players.find((x) => x.id === ed.dataset.edit);
      if (!p) return;
      editingPlayerId = p.id;
      $("#playerNumber").value = p.number; $("#playerName").value = p.name;
      $("#playerPosition").value = p.position || ""; $("#playerNotes").value = p.notes || "";
      $("#playerSubmit span").textContent = "Salvar";
      $("#playerCancel").hidden = false;
      renderPlayers();
      $("#playerName").focus();
    } else if (del) {
      const p = draft.players.find((x) => x.id === del.dataset.del);
      if (!p) return;
      if (!(await App.confirm(`Excluir o jogador "${p.name}"?`, { title: "Excluir jogador", okText: "Excluir", danger: true }))) return;
      draft.players = draft.players.filter((x) => x.id !== p.id);
      renderPlayers(); touch();
    }
  });
  $("#sortByNumber").addEventListener("click", () => { draft.players.sort((a, b) => a.number - b.number); renderPlayers(); touch(); });
  $("#sortByName").addEventListener("click", () => { draft.players.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")); renderPlayers(); touch(); });

  /* ---------- Lista: selecionar / novo / excluir / duplicar ---------- */
  $("#teamList").addEventListener("click", (e) => {
    const b = e.target.closest("[data-team]");
    if (b) loadDraft(App.findTeam(b.dataset.team));
  });
  $("#teamSearch").addEventListener("input", renderList);
  $("#newTeamBtn").addEventListener("click", () => { loadDraft(null); $("#teamName").focus(); });

  $("#deleteTeamBtn").addEventListener("click", async () => {
    if (!draft || !draft.id) return;
    if (!(await App.confirm(`Excluir o time "${draft.name}"? Esta ação não pode ser desfeita.`, { title: "Excluir time", okText: "Excluir", danger: true }))) return;
    const id = draft.id;
    socket.emit("teams:delete", id, () => {
      App.toast("Time excluído.", "ok");
      draft = null; loadedKey = null;
      App.renderPage("times");
    });
  });
  $("#duplicateTeamBtn").addEventListener("click", () => {
    if (!draft || !draft.id) return;
    const copy = JSON.parse(JSON.stringify(draft));
    copy.id = null; copy.name = draft.name + " (cópia)";
    copy.players = copy.players.map((p) => ({ ...p, id: App.generateId() }));
    loadDraft(copy);
    doSave();
  });

  /* ---------- Página ---------- */
  function render() {
    // escolhe o time a mostrar: o que já estava em edição, senão o primeiro
    if (!draft) {
      loadDraft(App.teams[0] || null);
    } else if (draft.id && !App.findTeam(draft.id) && !saving) {
      loadDraft(App.teams[0] || null);
    }
    $("#teamEditor").hidden = false;
    renderList();
  }
  App.registerPage("times", { render });
})();
