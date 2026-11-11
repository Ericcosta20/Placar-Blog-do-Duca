/**
 * MÓDULOS VISÍVEIS (v6.2): painel único de liga e desliga de tudo que pode aparecer no ar.
 * Cada módulo tem um interruptor principal e, ao lado, as opções que pertencem a ele
 * (reservas junto da escalação, compacto/maior junto do placar, etc.). Nada novo é guardado:
 * cada botão só chama o mesmo evento que o botão original já chamava na aba de origem.
 */
(() => {
  const { socket, escapeHtml: esc } = App;
  const patch = (path) => (v) => App.patch(path, v);
  const mod = (k) => ({ get: (s) => !!s.modules[k], set: patch("modules." + k) });
  const league = (s) => s.league || {};

  /** Cada item: kind "switch" (liga/desliga) ou "seg" (duas opções). */
  const MODS = [
    { id: "escalacao", name: "Escalação", hint: "Fonte /arte — os 11 titulares",
      main: mod("escalacao"),
      subs: [
        { label: "Reservas do mandante", ...mod("reservasHome") },
        { label: "Reservas do visitante", ...mod("reservasAway") },
      ] },
    { id: "placar", name: "Placar", hint: "Fonte /arte/placar",
      main: mod("placar"),
      subs: [
        { label: "Relógio", ...mod("relogio") },
        { label: "Nome dos times", ...mod("nomesTimes") },
        { label: "Nome do campeonato", ...mod("campeonato") },
        { kind: "seg", label: "Tamanho", opts: [["0", "Maior"], ["1", "Compacto"]],
          get: (s) => (s.customization.placar.compact ? "1" : "0"), set: (v) => App.patch("customization.placar.compact", v === "1") },
      ] },
    { id: "eventos", name: "Eventos e linha do tempo", hint: "Fontes /arte/eventos e /arte/linha-do-tempo",
      main: mod("eventos"), subs: [] },
    { id: "fim", name: "Cartão de fim de jogo", hint: "Fonte /arte/fim-de-jogo — placar final e autores dos gols",
      main: { get: (s) => !!(s.match.finalCard && s.match.finalCard.visible), set: (v) => socket.emit("finalcard:setVisible", v) }, subs: [] },
    { id: "penaltis", name: "Pênaltis", hint: "Fonte /arte/penaltis — a disputa de pênaltis",
      main: { get: (s) => !!(s.match.shootout && s.match.shootout.visible), set: (v) => socket.emit("shootout:setVisible", v) }, subs: [] },
    { id: "classificacao", name: "Classificação", hint: "Fonte /arte/classificacao",
      main: { get: (s) => !!league(s).visible, set: (v) => socket.emit("league:setVisible", v) },
      subs: [
        { kind: "seg", label: "Tabela", opts: [["compact", "Compacta"], ["complete", "Completa"]],
          get: (s) => (league(s).mode === "complete" ? "complete" : "compact"), set: (v) => socket.emit("league:setMode", v) },
      ] },
    { id: "outros", name: "Outros jogos", hint: "Fonte /arte/informativos",
      main: { get: (s) => !!(s.others && s.others.visible), set: (v) => socket.emit("others:setVisible", v) }, subs: [] },
    { id: "arbitragem", name: "Arbitragem", hint: "Fonte /arte/informativos",
      main: { get: (s) => !!(s.officials && s.officials.refVisible), set: (v) => socket.emit("officials:setVisible", { which: "ref", visible: v }) },
      subs: [
        { label: "Árbitros de vídeo (VAR)", get: (s) => !!(s.officials && s.officials.varVisible), set: (v) => socket.emit("officials:setVisible", { which: "var", visible: v }) },
      ] },
    { id: "estadio", name: "Estádio", hint: "Fonte /arte/informativos — ficha e fotos",
      main: { get: (s) => !!(s.stadium && s.stadium.visible), set: (v) => socket.emit("stadium:setVisible", v) }, subs: [] },
  ];

  const items = []; // índice plano: data-m="i" -> item
  const reg = (it) => { items.push(it); return items.length - 1; };

  const sw = (it, cls) => `<label class="switch ${cls}"><input type="checkbox" data-m="${reg(it)}"><i></i>
      <span class="switch-text"><b>${esc(it.label || it.name)}</b>${it.hint ? `<small>${esc(it.hint)}</small>` : ""}</span></label>`;
  const seg = (it) => `<div class="mod-seg"><span class="muted small">${esc(it.label)}</span>
      <div class="seg seg-sm" data-m="${reg(it)}">${it.opts.map(([v, l]) => `<button type="button" data-v="${v}">${esc(l)}</button>`).join("")}</div></div>`;

  App.modulosHtml = () => {
    items.length = 0;
    const cards = MODS.map((m) => {
      const main = sw({ ...m.main, name: m.name, hint: m.hint, kind: "switch" }, "mod-main");
      const subs = m.subs.length
        ? `<div class="mod-subs">${m.subs.map((x) => (x.kind === "seg" ? seg(x) : sw(x, "switch-sm"))).join("")}</div>` : "";
      return `<div class="mod-card" data-mod-id="${m.id}">${main}${subs}</div>`;
    }).join("");
    return `<div class="ctl-group"><h3>O que aparece no ar</h3>
      <p class="muted small">Cada interruptor liga ou desliga na hora aquela parte no ar. As opções menores ficam do lado do módulo a que pertencem. Os módulos opcionais (fim de jogo, pênaltis, classificação, outros jogos, arbitragem, estádio) só entram quando a fonte correspondente está adicionada no ar.</p>
      <div class="mod-grid" id="modGrid">${cards}</div></div>`;
  };

  App.modulosSync = () => {
    const root = document.getElementById("modGrid");
    if (!root || !App.state) return;
    root.querySelectorAll("[data-m]").forEach((el) => {
      const it = items[Number(el.dataset.m)];
      if (!it) return;
      let v;
      try { v = it.get(App.state); } catch (_) { return; }
      if (el.matches("input")) el.checked = !!v;
      else el.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.v === v));
    });
    root.querySelectorAll(".mod-card").forEach((c) => {
      const on = c.querySelector(".mod-main input");
      c.classList.toggle("is-on", !!(on && on.checked));
    });
  };

  document.getElementById("arteBody").addEventListener("change", (e) => {
    const el = e.target.closest("input[data-m]");
    if (!el) return;
    const it = items[Number(el.dataset.m)];
    if (it) { it.set(el.checked); App.modulosSync(); }
  });
  document.getElementById("arteBody").addEventListener("click", (e) => {
    const b = e.target.closest(".mod-seg button[data-v]");
    if (!b) return;
    const it = items[Number(b.parentElement.dataset.m)];
    if (it) { it.set(b.dataset.v); b.parentElement.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b)); }
  });
})();
