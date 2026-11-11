/**
 * BLOCOS ARRASTÁVEIS DA ABA PARTIDA (v5.2)
 * ---------------------------------------------------------------
 * Cada bloco (Placar, No ar, Relógio, Lançar evento, Sons, Histórico) tem um ícone de pegada no título.
 * Arraste por ele para outra posição — dentro da coluna ou para a outra coluna. Funciona com mouse e com toque.
 * A ordem fica guardada neste navegador (cada aparelho pode ter a sua: o do computador e o do celular).
 * "Restaurar ordem" volta ao padrão. Só afeta o PAINEL — nada muda nas artes do OBS.
 */
(() => {
  const { $, $$ } = App;
  const grid = $("#page-partida .match-grid");
  if (!grid) return;
  const cols = { left: grid.querySelector(".match-left"), right: grid.querySelector(".match-right") };
  const blocks = {};
  $$("[data-block]", grid).forEach((el) => { blocks[el.dataset.block] = el; });
  const DEFAULT = { left: ["placar", "noar", "relogio"], right: ["eventos", "outros", "arbitragem", "estadio", "historico"] };
  const KEY = "partida_blocks";
  const ALL = Object.keys(blocks);

  /** Ordem guardada. Blocos novos (de versões mais recentes) entram no fim da coluna do padrão; blocos que não existem mais saem. */
  function loadLayout() {
    const saved = App.store.get(KEY, null);
    if (!saved || !Array.isArray(saved.left) || !Array.isArray(saved.right)) return DEFAULT;
    const seen = new Set();
    const clean = (arr) => arr.filter((id) => blocks[id] && !seen.has(id) && seen.add(id));
    const left = clean(saved.left), right = clean(saved.right);
    ALL.forEach((id) => {
      if (seen.has(id)) return;
      (DEFAULT.left.includes(id) ? left : right).push(id);
    });
    return { left, right };
  }
  const current = () => ({
    left: Array.from(cols.left.children).filter((e) => e.dataset.block).map((e) => e.dataset.block),
    right: Array.from(cols.right.children).filter((e) => e.dataset.block).map((e) => e.dataset.block),
  });
  function apply(layout) {
    layout.left.forEach((id) => blocks[id] && cols.left.appendChild(blocks[id]));
    layout.right.forEach((id) => blocks[id] && cols.right.appendChild(blocks[id]));
  }
  apply(loadLayout());

  /* ---------- ícone de pegada em cada bloco ---------- */
  ALL.forEach((id) => {
    const h2 = blocks[id].querySelector(".card-head h2");
    if (!h2) return;
    const g = document.createElement("button");
    g.type = "button"; g.className = "drag-grip"; g.dataset.grip = id;
    g.title = "Arraste para mover este bloco"; g.setAttribute("aria-label", "Mover o bloco " + (h2.textContent || id).trim());
    g.innerHTML = App.ico("grip");
    h2.prepend(g);
  });

  /* ---------- arrastar ---------- */
  let drag = null;
  const content = $("#content");

  function distToRect(x, y, r) {
    const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
    const dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
    return Math.hypot(dx, dy);
  }
  function place(x, y) {
    // coluna mais perto do ponteiro (no celular as colunas ficam empilhadas)
    const target = Object.values(cols).map((c) => ({ c, d: distToRect(x, y, c.getBoundingClientRect()) })).sort((a, b) => a.d - b.d)[0].c;
    const kids = Array.from(target.children).filter((e) => e !== drag.marker && e !== drag.card && e.dataset.block);
    let before = null;
    for (const k of kids) {
      const r = k.getBoundingClientRect();
      if (y < r.top + r.height / 2) { before = k; break; }
    }
    const already = drag.marker.parentElement === target && (before ? drag.marker.nextElementSibling === before : drag.marker.nextElementSibling === null);
    if (!already) target.insertBefore(drag.marker, before);
  }
  function onMove(e) {
    if (!drag) return;
    drag.x = e.clientX; drag.y = e.clientY;
    drag.ghost.style.left = e.clientX - drag.dx + "px";
    drag.ghost.style.top = e.clientY - drag.dy + "px";
    place(e.clientX, e.clientY);
  }
  function autoScroll() {
    if (!drag) return;
    const r = content.getBoundingClientRect(), edge = 70;
    if (drag.y < r.top + edge) content.scrollTop -= Math.ceil((r.top + edge - drag.y) / 6);
    else if (drag.y > r.bottom - edge) content.scrollTop += Math.ceil((drag.y - (r.bottom - edge)) / 6);
    place(drag.x, drag.y);
    drag.raf = requestAnimationFrame(autoScroll);
  }
  function end() {
    if (!drag) return;
    cancelAnimationFrame(drag.raf);
    drag.grip.removeEventListener("pointermove", onMove);
    drag.grip.removeEventListener("pointerup", end);
    drag.grip.removeEventListener("pointercancel", end);
    document.removeEventListener("keydown", onKey);
    try { drag.grip.releasePointerCapture(drag.pid); } catch (_) { /* já solto */ }
    drag.marker.replaceWith(drag.card);
    drag.card.style.display = "";
    drag.ghost.remove();
    document.body.classList.remove("is-block-dragging");
    App.store.set(KEY, current());
    drag = null;
  }
  function onKey(e) { if (e.key === "Escape") end(); }

  grid.addEventListener("pointerdown", (e) => {
    const grip = e.target.closest(".drag-grip");
    if (!grip || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    const card = grip.closest("[data-block]");
    const rect = card.getBoundingClientRect();
    const ghost = card.cloneNode(true);
    ghost.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
    ghost.removeAttribute("data-block");
    ghost.classList.add("drag-ghost");
    Object.assign(ghost.style, { width: rect.width + "px", height: Math.min(rect.height, 260) + "px", left: rect.left + "px", top: rect.top + "px" });
    const marker = document.createElement("div");
    marker.className = "drop-marker";
    marker.style.height = Math.min(rect.height, 160) + "px";
    card.parentElement.insertBefore(marker, card);
    card.style.display = "none";
    document.body.appendChild(ghost);
    document.body.classList.add("is-block-dragging");
    drag = { card, ghost, marker, grip, pid: e.pointerId, dx: e.clientX - rect.left, dy: e.clientY - rect.top, x: e.clientX, y: e.clientY, raf: 0 };
    grip.setPointerCapture(e.pointerId);
    grip.addEventListener("pointermove", onMove);
    grip.addEventListener("pointerup", end);
    grip.addEventListener("pointercancel", end);
    document.addEventListener("keydown", onKey);
    drag.raf = requestAnimationFrame(autoScroll);
  });

  /* ---------- restaurar ---------- */
  function resetBlocks() {
    apply(DEFAULT);
    App.store.set(KEY, null);
  }
  $("#blocksResetBtn").addEventListener("click", () => { resetBlocks(); App.toast("Blocos na ordem original.", "ok", 2000); });
  const baseReset = App.resetLayout;
  App.resetLayout = () => { baseReset && baseReset(); resetBlocks(); };
})();
