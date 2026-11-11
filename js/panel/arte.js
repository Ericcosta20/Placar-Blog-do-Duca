/** ARTE (v4.0/v5.0): personalização das Browser Sources (gerada a partir de schema.js) + visuais salvos. */
(() => {
  const { $, escapeHtml, socket } = App;
  const sections = App.schema.sections;
  let current = App.store.get("arte_section", "placar");
  if (!sections.some((s) => s.id === current)) current = "placar";
  let builtFor = null;

  $("#arteNav").innerHTML = sections.map((s) =>
    `<button data-sec="${s.id}">${App.ico(s.icon)}<span>${escapeHtml(s.title)}</span></button>`).join("");

  /* ---------- Visuais salvos (v5.0) ---------- */
  const SLOTS = 3;
  const fmtDate = (t) => new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  function visualsHtml() {
    const vis = (App.state && App.state.visuals) || [];
    const slots = Array.from({ length: SLOTS }, (_, i) => {
      const v = vis[i];
      return `<div class="visual-slot ${v ? "filled" : ""}" data-slot="${i}">
        <div class="vs-head"><span class="vs-num">${i + 1}</span>
          <input type="text" class="vs-name" data-vs-name="${i}" maxlength="40" value="${escapeHtml(v ? v.name : "")}" placeholder="Visual ${i + 1}" ${v ? "" : "disabled"} aria-label="Nome do visual ${i + 1}"></div>
        <p class="muted small">${v ? "Salvo em " + fmtDate(v.savedAt) : "Vaga vazia"}</p>
        <div class="row-gap">
          <button class="btn btn-sm btn-primary" data-vs-save="${i}">${App.ico("download")}${v ? "Salvar aqui de novo" : "Salvar visual atual"}</button>
          <button class="btn btn-sm" data-vs-load="${i}" ${v ? "" : "disabled"}>${App.ico("upload")}Aplicar</button>
          <button class="btn btn-sm btn-danger-ghost" data-vs-del="${i}" ${v ? "" : "disabled"} title="Apagar">${App.ico("trash")}</button>
        </div></div>`;
    }).join("");
    return `<div class="ctl-group"><h3>Suas 3 vagas</h3>
      <p class="muted small">“Salvar” guarda como a arte está agora. “Aplicar” troca todas as aparências de uma vez (o que está no ar — módulos ligados e a partida — não muda). Os visuais entram nos backups e na exportação do banco de dados.</p>
      <div class="visual-slots" id="visualSlots">${slots}</div></div>`;
  }
  let lastVisualsHtml = "";
  function renderVisuals() {
    const box = $("#visualSlots");
    if (!box) return;
    if (box.contains(document.activeElement) && document.activeElement.tagName === "INPUT") return; // não atrapalha quem está digitando
    const html = visualsHtml();
    if (html !== lastVisualsHtml) { box.closest(".ctl-group").outerHTML = html; lastVisualsHtml = html; }
  }

  function buildSection() {
    const s = sections.find((x) => x.id === current);
    $("#arteBody").innerHTML = `
      <div class="arte-head">
        <div><h2>${escapeHtml(s.title)}</h2><p class="muted">${escapeHtml(s.intro)}</p></div>
        ${s.reset ? `<button class="btn btn-sm" id="arteReset">${App.ico("reset")}Restaurar padrão</button>` : ""}
      </div>
      <div class="ctl-groups">${s.custom === "visuais" ? (lastVisualsHtml = visualsHtml()) : s.custom === "modulos" ? App.modulosHtml() : App.controls.html(s)}</div>`;
    builtFor = current;
    if (s.custom === "modulos") App.modulosSync();
    $$nav();
  }
  function $$nav() {
    App.$$("#arteNav button").forEach((b) => b.classList.toggle("active", b.dataset.sec === current));
  }

  function select(id) {
    current = id;
    App.store.set("arte_section", id);
    buildSection();
    App.controls.sync($("#arteBody"));
    const s = sections.find((x) => x.id === id);
    App.setPreview(s.preview);
  }

  $("#arteNav").addEventListener("click", (e) => {
    const b = e.target.closest("[data-sec]");
    if (b) select(b.dataset.sec);
  });

  App.controls.bind($("#arteBody"));

  /* ---------- Cores a partir de um time ---------- */
  const hex2rgb = (h) => { const c = h.replace("#", ""); const f = c.length === 3 ? c.split("").map((x) => x + x).join("") : c; return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16) || 0); };
  const rgb2hex = (r) => "#" + r.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
  const mixBlack = (hex, amount) => rgb2hex(hex2rgb(hex).map((v) => v * (1 - amount)));
  /** Fundo bem escuro com um toque da cor do time; destaque = cor principal; texto claro. */
  function paletteFromTeam(team) {
    const p = team.primaryColor || "#0057ff";
    return { bgColor: mixBlack(p, 0.88), accentColor: p, textColor: "#ffffff" };
  }

  $("#arteBody").addEventListener("click", async (e) => {
    const sw = e.target.closest("[data-pal-index]");
    if (sw) {
      const row = sw.closest("[data-palettes]");
      const group = sections.flatMap((s) => s.groups).find((g) => g.palettes && g.palettes.key === row.dataset.palettes);
      const pal = group.palettes.items[Number(sw.dataset.palIndex)];
      Object.entries(pal.set).forEach(([k, v]) => App.patch(group.palettes.base + k, v));
      // v6.0: o destaque do jogo da transmissão acompanha a cor de destaque da paleta
      if (group.palettes.mirror) Object.entries(group.palettes.mirror).forEach(([to, from]) => { if (pal.set[from]) App.patch(group.palettes.base + to, pal.set[from]); });
      App.controls.sync($("#arteBody"));
      const label = row.parentElement.querySelector(".pal-name");
      if (label) label.textContent = "— aplicada: " + pal.name;
      return;
    }
    const tp = e.target.closest("[data-team-pal]");
    if (tp) {
      const side = tp.dataset.teamPal;
      const team = App.findTeam(App.state.match[side].teamId);
      if (!team) { App.toast(`Escolha o time ${side === "home" ? "mandante" : "visitante"} na aba Escalação primeiro.`, "err"); return; }
      const group = sections.flatMap((s) => s.groups).find((g) => g.palettes && g.palettes.key === tp.closest(".ctl-group").querySelector("[data-palettes]").dataset.palettes);
      Object.entries(paletteFromTeam(team)).forEach(([k, v]) => App.patch(group.palettes.base + k, v));
      App.controls.sync($("#arteBody"));
      App.toast(`Cores do ${team.name} aplicadas.`, "ok", 2200);
      return;
    }
    const ps = e.target.closest("[data-preset-index]");
    if (ps) {
      const holder = ps.closest("[data-presets]");
      const group = sections.flatMap((s) => s.groups).find((g) => g.presets && g.presets.base === holder.dataset.presets);
      const preset = group.presets.items[Number(ps.dataset.presetIndex)];
      Object.entries(preset.values).forEach(([k, v]) => App.patch(group.presets.base + k, v));
      App.controls.sync($("#arteBody"));
      App.toast("Medidas aplicadas.", "ok", 2000);
      return;
    }
    const act = e.target.closest("[data-action]");
    if (act) {
      if (act.dataset.action === "testGoal") socket.emit("placar:testGoal", act.dataset.arg);
      if (act.dataset.action === "testSub") socket.emit("placar:testSub", act.dataset.arg);
      if (act.dataset.action === "testAdded") socket.emit("placar:testAdded");
      if (act.dataset.action === "testKick") socket.emit("penalty:testAlert", act.dataset.arg === "miss" ? "miss" : "goal");
      if (act.dataset.action === "replay") {
        const mod = act.dataset.arg === "placar" ? "placar" : "escalacao";
        if (!App.state.modules[mod]) App.toast(`Ligue “${mod === "placar" ? "Placar" : "Escalação"}” em Módulos visíveis para ver a animação.`, "err");
        socket.emit("art:replay", act.dataset.arg);
      }
      return;
    }
    // ----- visuais salvos -----
    const vsSave = e.target.closest("[data-vs-save]"), vsLoad = e.target.closest("[data-vs-load]"), vsDel = e.target.closest("[data-vs-del]");
    if (vsSave) {
      const i = Number(vsSave.dataset.vsSave);
      const old = (App.state.visuals || [])[i];
      if (old && !(await App.confirm(`Substituir o visual “${old.name}” pela aparência atual da arte?`, { title: "Salvar visual", okText: "Substituir" }))) return;
      socket.emit("visual:save", { slot: i, name: old ? old.name : `Visual ${i + 1}` });
      App.toast("Visual salvo.", "ok", 2200);
      return;
    }
    if (vsLoad) {
      const i = Number(vsLoad.dataset.vsLoad);
      const v = (App.state.visuals || [])[i];
      if (!v) return;
      if (await App.confirm(`Aplicar o visual “${v.name}”? A aparência atual da arte será trocada (salve-a antes se quiser guardá-la).`, { title: "Aplicar visual", okText: "Aplicar" })) {
        socket.emit("visual:load", i);
        App.toast(`Visual “${v.name}” aplicado.`, "ok", 2400);
      }
      return;
    }
    if (vsDel) {
      const i = Number(vsDel.dataset.vsDel);
      const v = (App.state.visuals || [])[i];
      if (v && await App.confirm(`Apagar o visual “${v.name}”?`, { title: "Apagar visual", okText: "Apagar", danger: true })) socket.emit("visual:delete", i);
      return;
    }
    if (e.target.closest("#arteReset")) {
      const s = sections.find((x) => x.id === current);
      if (await App.confirm(`Restaurar todas as opções de “${s.title}” para o padrão? Os valores atuais serão perdidos.`, { title: "Restaurar padrão", okText: "Restaurar" })) {
        socket.emit("settings:resetSection", s.reset);
        App.toast("Opções restauradas.", "ok");
      }
    }
  });

  // renomear um visual: grava ao sair do campo ou com Enter
  $("#arteBody").addEventListener("change", (e) => {
    const inp = e.target.closest("[data-vs-name]");
    if (inp) socket.emit("visual:rename", { slot: Number(inp.dataset.vsName), name: inp.value });
  });

  function render() {
    if (builtFor !== current) buildSection();
    const sec = sections.find((x) => x.id === current);
    if (sec.custom === "visuais") renderVisuals();
    else if (sec.custom === "modulos") App.modulosSync();
    else App.controls.sync($("#arteBody"));
  }
  App.registerPage("arte", {
    render,
    onShow() { const s = sections.find((x) => x.id === current); App.setPreview(s.preview); },
  });
  buildSection();
})();
