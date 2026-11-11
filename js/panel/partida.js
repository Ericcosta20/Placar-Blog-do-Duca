/** PARTIDA (v4.0/v4.1/v5.0): placar, relógio, "No ar" (placar compacto, reservas, fim de jogo), eventos, gol anulado e histórico. */
(() => {
  const { $, $$, escapeHtml, pad2, socket } = App;

  const EVENT_LABELS = { goal: "Gol", yellow: "Cartão amarelo", red: "Cartão vermelho", sub: "Substituição" };
  const EVENT_PLAYER_LABELS = { goal: "Jogador que marcou", yellow: "Jogador advertido", red: "Jogador expulso" };
  let pendingType = null;
  let historyCount = App.store.get("history_count", 5); // preferência local (não afeta o OBS)

  /* ---------- Placar ---------- */
  let lastScoreKey = null;
  function renderScore() {
    const sc = App.state.match.score;
    $("#scoreHomeValue").textContent = sc.home;
    $("#scoreAwayValue").textContent = sc.away;
    $("#scoreHomeLabel").textContent = App.teamLabel("home");
    $("#scoreAwayLabel").textContent = App.teamLabel("away");
    const key = `${sc.home}-${sc.away}`;
    if (lastScoreKey !== null && key !== lastScoreKey) {
      ["#scoreHomeValue", "#scoreAwayValue"].forEach((id) => { const el = $(id); el.classList.remove("pulse"); void el.offsetWidth; el.classList.add("pulse"); });
    }
    lastScoreKey = key;
  }
  $$("[data-score]").forEach((btn) => btn.addEventListener("click", () => {
    const side = btn.dataset.score;
    socket.emit("match:setScore", { [side]: Math.max(0, App.state.match.score[side] + Number(btn.dataset.delta)) });
  }));

  /* ---------- No ar (v5.0): placar compacto, reservas, cartão de fim de jogo ---------- */
  App.controls.bind($("#onAirCard"));
  function renderOnAir() {
    const compact = !!App.state.customization.placar.compact;
    $$("#compactSeg button").forEach((b) => b.classList.toggle("active", (b.dataset.compact === "1") === compact));
    $("#finalCardVisible").checked = !!(App.state.match.finalCard && App.state.match.finalCard.visible);
    App.controls.sync($("#onAirCard"));
  }
  $("#compactSeg").addEventListener("click", (e) => {
    const b = e.target.closest("[data-compact]");
    if (b) { App.patch("customization.placar.compact", b.dataset.compact === "1"); renderOnAir(); }
  });
  $("#finalCardVisible").addEventListener("change", (e) => socket.emit("finalcard:setVisible", e.target.checked));

  /* ---------- Relógio ---------- */
  function renderClock() {
    const c = App.state.match.clock;
    $("#clockDisplay").textContent = App.formatClock(c.seconds);
    $("#clockDisplayMinute").textContent = App.computeDisplayMinute(c.seconds, c.period) + "'";
    $$("#periodSeg button").forEach((b) => b.classList.toggle("active", b.dataset.period === (c.period || "1t")));
    $("#clockLive").hidden = !c.running;
    $("#clockStartBtn").disabled = !!c.running;
    $("#clockPauseBtn").disabled = !c.running;
    $("#clockNextBtn").disabled = (c.period || "1t") === "p2";
    const st = App.state.match.statusLabel || "";
    $$("#statusSeg button").forEach((b) => b.classList.toggle("active", b.dataset.status === st));
    const added = $("#addedTimeInput");
    if (document.activeElement !== added) added.value = c.addedTime !== null && c.addedTime !== undefined ? c.addedTime : "";
  }
  App.on("tick", ({ seconds, period }) => {
    $("#clockDisplay").textContent = App.formatClock(seconds);
    $("#clockDisplayMinute").textContent = App.computeDisplayMinute(seconds, period) + "'";
  });
  $("#statusSeg").addEventListener("click", (e) => {
    const b = e.target.closest("[data-status]");
    if (b) socket.emit("match:setStatus", b.dataset.status || null);
  });
  $("#clockStartBtn").addEventListener("click", () => socket.emit("clock:start"));
  $("#clockPauseBtn").addEventListener("click", () => socket.emit("clock:pause"));
  $("#clockResetBtn").addEventListener("click", async () => {
    if (await App.confirm("Zerar o relógio para 00:00? O período escolhido é mantido.", { okText: "Zerar" })) socket.emit("clock:reset");
  });
  $("#clockNextBtn").addEventListener("click", async () => {
    const order = ["1t", "2t", "p1", "p2"];
    const next = order[order.indexOf(App.state.match.clock.period || "1t") + 1];
    if (!next) return;
    if (await App.confirm(`Passar para o ${App.PERIOD_LABELS[next]}? O relógio volta para 00:00 (pausado) e o acréscimo é limpo.`, { okText: "Passar de período" })) socket.emit("clock:nextPeriod");
  });
  $$("[data-clock-delta]").forEach((b) => b.addEventListener("click", () => socket.emit("clock:addSeconds", Number(b.dataset.clockDelta))));
  $("#periodSeg").addEventListener("click", (e) => {
    const b = e.target.closest("[data-period]");
    if (b) socket.emit("clock:setPeriod", b.dataset.period);
  });
  /* v5.1 — máscara do "Ajustar tempo": digita só números e os dois pontos entram sozinhos.
     Com 3 ou mais dígitos os dois últimos são os segundos: 100 → 1:00, 455 → 4:55, 3000 → 30:00.
     Se os segundos passarem de 59 (ex.: 499) o último número digitado é recusado e o campo
     fica no valor anterior. Com 1 ou 2 dígitos o campo mostra o número puro (ainda incompleto)
     e, ao aplicar, vale como minutos exatos (45 → 45:00). */
  const clockInput = $("#clockManualInput");
  let clockDigits = "";
  const maskClock = (d) => (d.length <= 2 ? d : String(Number(d.slice(0, -2))) + ":" + d.slice(-2));
  clockInput.addEventListener("input", () => {
    const digits = clockInput.value.replace(/\D/g, "");
    if (digits.length > 5 || (digits.length >= 3 && Number(digits.slice(-2)) > 59)) {
      // recusa: volta ao último valor válido e dá um aviso rápido no campo
      clockInput.classList.remove("input-reject"); void clockInput.offsetWidth; clockInput.classList.add("input-reject");
      clockInput.value = maskClock(clockDigits);
      return;
    }
    clockDigits = digits;
    clockInput.value = maskClock(digits);
  });
  clockInput.addEventListener("animationend", () => clockInput.classList.remove("input-reject"));
  function applyManualClock() {
    const d = clockDigits;
    if (!d) { App.toast("Digite só números, por exemplo 4500 para 45:00.", "err"); return; }
    const seconds = d.length <= 2 ? Number(d) * 60 : Number(d.slice(0, -2)) * 60 + Number(d.slice(-2));
    socket.emit("clock:setSeconds", seconds);
    App.toast("Relógio ajustado para " + String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0") + ".", "ok");
    clockInput.value = "";
    clockDigits = "";
  }
  $("#clockManualBtn").addEventListener("click", applyManualClock);
  clockInput.addEventListener("keydown", (e) => { if (e.key === "Enter") applyManualClock(); });
  const applyAdded = () => { const v = $("#addedTimeInput").value.trim(); socket.emit("clock:setAddedTime", v === "" ? null : Number(v)); };
  $("#addedTimeApplyBtn").addEventListener("click", applyAdded);
  $("#addedTimeInput").addEventListener("keydown", (e) => { if (e.key === "Enter") applyAdded(); });
  $("#addedTimeClearBtn").addEventListener("click", () => { $("#addedTimeInput").value = ""; socket.emit("clock:setAddedTime", null); });

  /* ---------- Modal de evento ---------- */
  function playerOptions() {
    const side = $("#eventSideSelect").value;
    const ms = App.state.match[side];
    const team = App.findTeam(ms.teamId);
    const all = team ? team.players || [] : [];
    const starterSet = new Set(ms.starterIds || []);
    const opt = (list) => list.map((p) => `<option value="${p.id}">${pad2(p.number)} — ${escapeHtml(p.name)}</option>`).join("");
    const starters = all.filter((p) => starterSet.has(p.id));
    const bench = all.filter((p) => !starterSet.has(p.id));
    // se ainda não há titulares marcados, deixa escolher qualquer jogador do time
    const fieldList = starters.length ? starters : all;
    $("#eventPlayerSelect").innerHTML = `<option value="">Selecione</option>` + opt(fieldList);
    $("#eventPlayerSelectSub").innerHTML = `<option value="">Selecione titular</option>` + opt(fieldList);
    $("#eventSecondaryPlayerSelect").innerHTML = `<option value="">Selecione reserva</option>` + opt(starters.length ? bench : all);
  }
  function sideOptions() {
    const sel = $("#eventSideSelect"), cur = sel.value || "home";
    sel.innerHTML = `<option value="home">${escapeHtml(App.teamLabel("home"))} (mandante)</option><option value="away">${escapeHtml(App.teamLabel("away"))} (visitante)</option>`;
    sel.value = cur;
  }
  function updateGoalTypeUi() {
    const own = pendingType === "goal" && $("#goalTypeSelect").value === "own";
    $("#goalTypeHint").hidden = !own;
    if (pendingType === "goal") $("#eventPlayerLabel").textContent = own ? "Jogador que fez o gol contra" : EVENT_PLAYER_LABELS.goal;
  }
  function openModal(type) {
    pendingType = type;
    const isSub = type === "sub";
    $("#goalTypeField").hidden = type !== "goal";
    $("#goalTypeSelect").value = "normal";
    $("#eventModalTitle").textContent = EVENT_LABELS[type];
    $("#eventModalIcon").className = "modal-icon ev-" + type;
    $("#eventModalIcon").innerHTML = App.ico(type === "goal" ? "goal" : type === "sub" ? "sub" : type);
    $("#eventPlayerField").hidden = isSub;
    $("#eventSubGroup").hidden = !isSub;
    if (!isSub) $("#eventPlayerLabel").textContent = EVENT_PLAYER_LABELS[type];
    updateGoalTypeUi();
    $("#eventMinuteOverride").value = "";
    $("#eventModalError").hidden = true;
    sideOptions();
    playerOptions();
    $("#eventModalOverlay").classList.add("open");
    setTimeout(() => (isSub ? $("#eventPlayerSelectSub") : $("#eventPlayerSelect")).focus(), 30);
  }
  function closeModal() { $("#eventModalOverlay").classList.remove("open"); pendingType = null; }
  const fail = (msg) => { const el = $("#eventModalError"); el.textContent = msg; el.hidden = false; };

  $$("[data-event]").forEach((b) => b.addEventListener("click", () => {
    if (!App.state.match.home.teamId && !App.state.match.away.teamId) { App.toast("Escolha os times na aba Escalação antes de lançar eventos.", "err"); return; }
    openModal(b.dataset.event);
  }));
  $("#eventSideSelect").addEventListener("change", playerOptions);
  $("#goalTypeSelect").addEventListener("change", updateGoalTypeUi);
  $("#eventModalCancel").addEventListener("click", closeModal);
  $("#eventModalOverlay").addEventListener("click", (e) => { if (e.target.id === "eventModalOverlay") closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && pendingType) closeModal(); });

  $("#eventModalConfirm").addEventListener("click", () => {
    const type = pendingType;
    if (!type) return;
    const side = $("#eventSideSelect").value;
    const team = App.findTeam(App.state.match[side].teamId);
    const find = (id) => team && team.players.find((p) => p.id === id);
    let payload;
    if (type === "sub") {
      const outId = $("#eventPlayerSelectSub").value, inId = $("#eventSecondaryPlayerSelect").value;
      if (!outId) return fail("Selecione quem sai de campo.");
      if (!inId) return fail("Selecione quem entra em campo.");
      if (outId === inId) return fail("O jogador que sai não pode ser o mesmo que entra.");
      payload = { type, side, playerId: outId, playerName: (find(outId) || {}).name || "", secondaryPlayerId: inId, secondaryPlayerName: (find(inId) || {}).name || "" };
    } else {
      const id = $("#eventPlayerSelect").value;
      if (!id) return fail("Selecione o jogador.");
      payload = { type, side, playerId: id, playerName: (find(id) || {}).name || "" };
      if (type === "goal") payload.goalType = $("#goalTypeSelect").value;
    }
    const manual = $("#eventMinuteOverride").value.trim();
    if (manual && /^\d+$/.test(manual)) payload.minute = parseInt(manual, 10);
    socket.emit("match:addEvent", payload);
    closeModal();
  });

  /* ---------- Gol anulado (v5.0) ---------- */
  function annulOptions(preselect) {
    const goals = (App.state.match.events || []).filter((e) => e.type === "goal" && !e.annulled);
    const sel = $("#annulGoalSelect");
    sel.innerHTML = goals.length
      ? goals.map((g) => `<option value="${g.id}">${escapeHtml(String(g.displayMinute || g.minute))}' — ${escapeHtml(g.playerName || "")} (${escapeHtml(App.teamLabel(g.side === "away" ? "away" : "home"))}${g.goalType === "own" ? ", contra" : g.goalType === "penalty" ? ", pênalti" : ""})</option>`).join("")
      : `<option value="">Nenhum gol para anular</option>`;
    if (preselect && goals.some((g) => g.id === preselect)) sel.value = preselect;
    else if (goals.length) sel.value = goals[goals.length - 1].id; // por padrão: o último gol
    return goals.length;
  }
  function openAnnul(preselect) {
    if (!annulOptions(preselect)) { App.toast("Ainda não há gols válidos para anular.", "err"); return; }
    $("#annulNote").value = "";
    $("#annulModalError").hidden = true;
    $("#annulModalOverlay").classList.add("open");
    setTimeout(() => $("#annulGoalSelect").focus(), 30);
  }
  const closeAnnul = () => $("#annulModalOverlay").classList.remove("open");
  $("#annulBtn").addEventListener("click", () => openAnnul());
  $("#annulCancel").addEventListener("click", closeAnnul);
  $("#annulModalOverlay").addEventListener("click", (e) => { if (e.target.id === "annulModalOverlay") closeAnnul(); });
  $("#annulConfirm").addEventListener("click", () => {
    const id = $("#annulGoalSelect").value;
    if (!id) { const el = $("#annulModalError"); el.textContent = "Selecione o gol."; el.hidden = false; return; }
    socket.emit("match:annulGoal", { eventId: id, note: $("#annulNote").value.trim() });
    closeAnnul();
    App.toast("Gol anulado. Use o botão de desfazer (topo) se foi engano.", "ok", 3600);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAnnul(); });

  /* ---------- Histórico ---------- */
  function renderEvents() {
    const events = App.state.match.events || [];
    $("#eventsEmptyMsg").style.display = events.length ? "none" : "block";
    let list = [...events].reverse();
    if (historyCount !== "all") list = list.slice(0, historyCount);
    App.setHtml($("#eventsList"), list.map((ev) => {
      const sideLabel = escapeHtml(ev.side === "away" ? App.teamLabel("away") : App.teamLabel("home"));
      const desc = ev.type === "sub"
        ? `<span class="in">${escapeHtml(ev.secondaryPlayerName)}</span> <em>entra</em> · <span class="out">${escapeHtml(ev.playerName)}</span> <em>sai</em>`
        : escapeHtml(ev.playerName) + (ev.type === "goal" && ev.goalType === "penalty" ? ` <em>(pênalti)</em>` : ev.type === "goal" && ev.goalType === "own" ? ` <em>(gol contra)</em>` : "");
      const on = ev.showOnAir !== false;
      const annulBtn = ev.type === "goal" && !ev.annulled
        ? `<button class="icon-btn sm" data-annul="${ev.id}" title="Anular este gol (VAR)">${App.ico("flag")}</button>` : "";
      const annulTag = ev.annulled ? ` <em class="annul-tag">ANULADO${ev.annulNote ? " — " + escapeHtml(ev.annulNote) : ""}</em>` : "";
      return `<li class="event-item ${on ? "" : "off"} ${ev.annulled ? "annulled" : ""}">
        <label class="air-toggle" title="Mostrar no ar"><input type="checkbox" data-toggle="${ev.id}" ${on ? "checked" : ""}><i></i></label>
        <span class="ev-min">${escapeHtml(String(ev.displayMinute || ev.minute))}'</span>
        <span class="ev-ico ev-${ev.type}">${App.ico(ev.type === "goal" ? "goal" : ev.type)}</span>
        <span class="ev-desc"><span class="ev-line">${desc}${annulTag}</span><small>${sideLabel}</small></span>
        ${annulBtn}<button class="icon-btn sm danger" data-remove="${ev.id}" title="Remover evento">${App.ico("trash")}</button></li>`;
    }).join(""));
    const onAir = events.filter((e) => e.showOnAir !== false).length;
    $("#onAirCounter").textContent = `${onAir} no ar`;
    $$("#historyFilter button").forEach((b) => b.classList.toggle("active", String(b.dataset.historyCount) === String(historyCount)));
  }
  $("#historyFilter").addEventListener("click", (e) => {
    const b = e.target.closest("[data-history-count]");
    if (!b) return;
    historyCount = b.dataset.historyCount === "all" ? "all" : Number(b.dataset.historyCount);
    App.store.set("history_count", historyCount);
    renderEvents();
  });
  $("#eventsList").addEventListener("click", async (e) => {
    const rm = e.target.closest("[data-remove]");
    if (rm) {
      const ev = App.state.match.events.find((x) => x.id === rm.dataset.remove);
      const txt = ev && ev.type === "goal" ? "Remover este gol? O placar também será corrigido (o aviso de GOL não é repetido)." : ev && ev.type === "sub" ? "Remover esta substituição? O jogador que saiu volta para a escalação." : "Remover este evento?";
      if (await App.confirm(txt, { title: "Remover evento", okText: "Remover", danger: true })) socket.emit("match:removeEvent", rm.dataset.remove);
      return;
    }
    const an = e.target.closest("[data-annul]");
    if (an) { openAnnul(an.dataset.annul); return; }
    const tg = e.target.closest("[data-toggle]");
    if (tg) socket.emit("match:toggleEventVisibility", tg.dataset.toggle);
  });

  function render() { renderScore(); renderOnAir(); renderClock(); renderEvents(); App.renderPads && App.renderPads(); App.renderOthers && App.renderOthers(); App.renderOfficials && App.renderOfficials(); App.renderStadium && App.renderStadium(); }
  App.registerPage("partida", { render });
})();
