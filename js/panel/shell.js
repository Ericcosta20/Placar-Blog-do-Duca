/**
 * CASCA DO PAINEL (v4.0): navegação, mini-placar ao vivo, status de conexão e prévia.
 *
 * Layout novo (corrige o problema da barra lateral da v3.x):
 *  - a navegação fica numa barra horizontal no topo (desliza para o lado quando não cabe tudo (v6.2));
 *  - a área de trabalho rola por dentro; a página inteira nunca rola;
 *  - a prévia é uma coluna à direita com proporção FIXA 16:9, calculada por
 *    ResizeObserver — não existe mais iframe de 1920px empurrando o layout.
 */
(() => {
  const $ = App.$;

  /* ---------- Navegação ---------- */
  $("#nav").addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-btn");
    if (btn) App.go(btn.dataset.page);
  });
  /* v6.2 — a barra de seções desliza: roda do mouse, arrastar com o mouse ou o dedo; as pontas ganham um esmaecido
     quando ainda há mais seções para o lado, e a seção ativa sempre fica visível. */
  const nav = $("#nav");
  const edges = () => {
    const max = nav.scrollWidth - nav.clientWidth;
    nav.style.setProperty("--nav-fade-l", nav.scrollLeft > 4 ? "28px" : "0px");
    nav.style.setProperty("--nav-fade-r", nav.scrollLeft < max - 4 ? "28px" : "0px");
  };
  nav.addEventListener("scroll", edges, { passive: true });
  window.addEventListener("resize", edges);
  nav.addEventListener("wheel", (e) => {
    if (nav.scrollWidth <= nav.clientWidth) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { nav.scrollLeft += e.deltaY; e.preventDefault(); }
  }, { passive: false });
  let drag = null;
  nav.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch" || e.button !== 0) return; // o dedo já rola sozinho
    drag = { x: e.clientX, left: nav.scrollLeft, moved: false };
  });
  window.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) < 5) return;
    drag.moved = true; nav.classList.add("dragging");
    nav.scrollLeft = drag.left - dx;
  });
  window.addEventListener("pointerup", () => { drag = null; nav.classList.remove("dragging"); });
  App.revealNav = () => {
    const a = nav.querySelector(".nav-btn.active");
    if (!a) return;
    const l = a.offsetLeft - 40, r = a.offsetLeft + a.offsetWidth + 40;
    if (l < nav.scrollLeft) nav.scrollLeft = Math.max(0, l);
    else if (r > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = r - nav.clientWidth;
    edges();
  };
  new ResizeObserver(edges).observe(nav);
  setTimeout(App.revealNav, 50);

  document.addEventListener("click", (e) => {
    const go = e.target.closest("[data-go]");
    if (go) App.go(go.dataset.go);
  });

  /* ---------- Conexão ---------- */
  App.on("status", (ok) => {
    $("#connDot").classList.toggle("ok", ok);
    $("#connLabel").textContent = ok ? "Conectado" : "Reconectando…";
    $("#conn").classList.toggle("off", !ok);
  });

  /* ---------- Desfazer, refazer e lista de alterações (v5.0 / v6.0) ---------- */
  function renderUndo() {
    const u = App.undo || { count: 0, label: null, redoCount: 0, redoLabel: null };
    const btn = $("#undoBtn");
    btn.disabled = !u.count;
    btn.title = u.count ? `Desfazer: ${u.label}` : "Nada para desfazer";
    const n = $("#undoCount");
    n.hidden = !u.count;
    n.textContent = u.count;
    const rb = $("#redoBtn");
    rb.disabled = !u.redoCount;
    rb.title = u.redoCount ? `Refazer: ${u.redoLabel}` : "Nada para refazer";
    const rn = $("#redoCount");
    rn.hidden = !u.redoCount;
    rn.textContent = u.redoCount || 0;
    if (!$("#historyPop").hidden) loadHistory();
  }
  App.on("undo", renderUndo);
  $("#undoBtn").addEventListener("click", () => {
    if (!App.undo || !App.undo.count) return;
    App.socket.emit("undo:last", (res) => {
      if (res && res.ok) App.toast(`Desfeito: ${res.label}`, "ok", 2600);
    });
  });
  $("#redoBtn").addEventListener("click", () => {
    if (!App.undo || !App.undo.redoCount) return;
    App.socket.emit("redo:last", (res) => {
      if (res && res.ok) App.toast(`Refeito: ${res.label}`, "ok", 2600);
    });
  });

  const pop = $("#historyPop");
  const fmtTime = (t) => new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  function loadHistory() {
    App.socket.emit("undo:list", (res) => {
      if (!res) return;
      const item = (e, i, kind) => `<li><button data-${kind}="${i + 1}" title="${kind === "undo" ? "Voltar até aqui (desfaz este e os de cima)" : "Refazer até aqui"}"><span class="hp-n">${i + 1}</span><span>${e.category ? `<small class="hp-cat">${App.escapeHtml(e.category)}</small>` : ""}${App.escapeHtml(e.label)}</span><span class="hp-t">${fmtTime(e.at)}</span></button></li>`;
      // refazer: o mais PRÓXIMO do "agora" fica embaixo da lista (perto da linha Agora)
      const redoRev = [...res.redo].reverse();
      App.setHtml($("#hpRedo"), res.redo.length
        ? redoRev.map((e, i) => item(e, res.redo.length - 1 - i, "redo")).join("")
        : `<li class="hp-empty">Nada para refazer.</li>`);
      App.setHtml($("#hpUndo"), res.undo.length ? res.undo.map((e, i) => item(e, i, "undo")).join("") : `<li class="hp-empty">Nada para desfazer.</li>`);
      $("#hpUndoN").textContent = res.undo.length;
      $("#hpRedoN").textContent = res.redo.length;
    });
  }
  function setHistory(open) {
    pop.hidden = !open;
    $("#historyBtn").setAttribute("aria-expanded", open);
    if (open) loadHistory();
  }
  $("#historyBtn").addEventListener("click", () => setHistory(pop.hidden));
  $("#historyClose").addEventListener("click", () => setHistory(false));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !pop.hidden) setHistory(false); });
  document.addEventListener("click", (e) => { if (!pop.hidden && !pop.contains(e.target) && !e.target.closest("#historyBtn")) setHistory(false); });
  pop.addEventListener("click", (e) => {
    const u = e.target.closest("[data-undo]"), r = e.target.closest("[data-redo]");
    if (u) App.socket.emit("undo:to", Number(u.dataset.undo), (res) => { if (res && res.ok) App.toast(`Voltou ${res.steps} ${res.steps === 1 ? "passo" : "passos"}.`, "ok", 2400); });
    if (r) App.socket.emit("redo:to", Number(r.dataset.redo), (res) => { if (res && res.ok) App.toast(`Refez ${res.steps} ${res.steps === 1 ? "passo" : "passos"}.`, "ok", 2400); });
  });

  /* ---------- Mini-placar ao vivo ---------- */
  function renderLive() {
    const s = App.state;
    if (!s) return;
    const home = App.findTeam(s.match.home.teamId), away = App.findTeam(s.match.away.teamId);
    $("#lbHome").textContent = App.shortOf(home, "MAN");
    $("#lbAway").textContent = App.shortOf(away, "VIS");
    $("#lbScore").textContent = `${s.match.score.home} × ${s.match.score.away}`;
    const c = s.match.clock;
    $("#lbClock").textContent = App.formatClock(c.seconds);
    $("#lbMinute").textContent = App.computeDisplayMinute(c.seconds, c.period) + "'";
    const btn = $("#lbToggle");
    btn.innerHTML = App.ico(c.running ? "pause" : "play");
    btn.classList.toggle("running", !!c.running);
    $("#livebar").classList.toggle("is-live", !!c.running);
  }
  App.on("state", renderLive);
  App.on("teams", renderLive);
  App.on("tick", ({ seconds, period }) => {
    $("#lbClock").textContent = App.formatClock(seconds);
    $("#lbMinute").textContent = App.computeDisplayMinute(seconds, period) + "'";
  });
  $("#lbToggle").addEventListener("click", () => {
    App.socket.emit(App.state && App.state.match.clock.running ? "clock:pause" : "clock:start");
  });

  /* ---------- Prévia ---------- */
  const SIZES = { s: 360, m: 460, l: 620 };
  const ALL = ["/arte", "/arte/placar", "/arte/eventos", "/arte/linha-do-tempo", "/arte/penaltis", "/arte/fim-de-jogo", "/arte/classificacao", "/arte/informativos"];
  const prefs = { size: App.store.get("dock_size", window.innerWidth >= 1800 ? "l" : "m"), hidden: App.store.get("dock_hidden", false), bg: App.store.get("dock_bg", "campo"), source: "all" };
  const stage = $("#stage"), inner = $("#stageInner"), workspace = $("#workspace");
  let builtKey = "";

  function applyLayout() {
    workspace.style.setProperty("--dock-pref", (SIZES[prefs.size] || SIZES.m) + "px");
    workspace.classList.toggle("dock-hidden", !!prefs.hidden);
    $("#dockToggle").classList.toggle("active", !prefs.hidden);
    App.$$("#dockSize button").forEach((b) => b.classList.toggle("active", b.dataset.size === prefs.size));
    App.$$("#dockBg button").forEach((b) => b.classList.toggle("active", b.dataset.bg === prefs.bg));
    stage.dataset.bg = prefs.bg;
    rescale();
  }

  function rescale() {
    const w = stage.clientWidth;
    if (!w) return;
    inner.style.transform = `scale(${w / 1920})`;
  }
  new ResizeObserver(rescale).observe(stage);

  function buildStage() {
    const paths = prefs.source === "all" ? ALL : [prefs.source];
    const key = paths.join("|");
    if (key === builtKey) return;
    builtKey = key;
    const src = (p) => { const r = App.rel(p); return r + (r.includes("?") ? "&" : "?") + "preview=1"; };
    inner.innerHTML = paths.map((p) => `<iframe src="${src(p)}" title="Prévia ${p.split("?")[0]}" loading="eager" tabindex="-1"></iframe>`).join("");
    App.$$("#dockSources button").forEach((b) => b.classList.toggle("active", b.dataset.preview === prefs.source));
    $("#dockOpen").href = App.rel(prefs.source === "all" ? "/arte/placar" : prefs.source.split("?")[0]);
    $("#dockOpen").title = prefs.source === "all" ? "Abre a fonte do placar em uma nova aba" : "Abre esta fonte em uma nova aba";
  }

  App.setPreview = (source) => {
    prefs.source = source;
    buildStage();
  };

  $("#dockSources").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-preview]");
    if (b) App.setPreview(b.dataset.preview);
  });
  $("#dockSize").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-size]");
    if (!b) return;
    prefs.size = b.dataset.size; prefs.hidden = false;
    App.store.set("dock_size", prefs.size); App.store.set("dock_hidden", false);
    applyLayout();
  });
  $("#dockBg").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-bg]");
    if (!b) return;
    prefs.bg = b.dataset.bg; App.store.set("dock_bg", prefs.bg); applyLayout();
  });
  $("#dockToggle").addEventListener("click", () => {
    prefs.hidden = !prefs.hidden; App.store.set("dock_hidden", prefs.hidden); applyLayout();
  });
  App.resetLayout = () => {
    prefs.size = "m"; prefs.hidden = false; prefs.bg = "campo";
    App.store.set("dock_size", "m"); App.store.set("dock_hidden", false); App.store.set("dock_bg", "campo");
    applyLayout();
  };

  applyLayout();
  buildStage();
  window.addEventListener("resize", rescale);
})();
