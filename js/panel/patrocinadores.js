/**
 * PATROCINADORES (Placar App 1.1) — galeria de logos, playlist em RASCUNHO, controles ao vivo.
 *   placar/sponsors/meta/ID    { name, thumb, w, h, bytes, at }   (lista da galeria, leve)
 *   placar/sponsors/images/ID  imagem em Base64 (só a arte lê, quando precisa)
 *   placar/sponsors/draft      rascunho que você edita (NÃO vai ao ar)
 *   placar/sponsors/live       playlist publicada (a arte lê esta)
 *   placar/sponsors/ctl        pausar / pular / reiniciar / mostrar  (ver js/sponsors-core.js)
 * A playlist só sobe para "live" no botão "Atualizar no ar / Salvar playlist".
 */
(() => {
  const { $, $$, escapeHtml: esc } = App;
  const SC = window.SponsorsCore;
  const root = $("#spRoot");
  const myId = "sp" + Math.random().toString(36).slice(2, 8);
  const MAX_IMAGES = 40, MAX_BLOCKS = 60, MAX_SIDE = 700, ACCEPT = ["image/png", "image/jpeg", "image/webp"];

  let meta = {}, draft = SC.normalize(null), live = null, ctl = null;
  let ready = false, view = "live", saveTimer = null, built = false;
  const base = () => (window.PLACAR_PATH || "placar") + "/sponsors";
  const ref = (p) => window.PLACAR_DB.ref(base() + (p ? "/" + p : ""));
  const parse = (j) => { try { return typeof j === "string" ? JSON.parse(j) : j; } catch (_) { return null; } };
  const sig = (p) => JSON.stringify({ b: p.blocks.map((x) => [x.type, x.imageId, x.duration, x.zoom]), s: p.settings });
  const dirty = () => !live ? draft.blocks.length > 0 : sig(draft) !== sig(live);
  const uid = () => "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const nameOf = (id) => (meta[id] && meta[id].name) || "(imagem removida)";
  const fmtS = (ms) => { const s = Math.ceil(ms / 1000); return s >= 60 ? `${Math.floor(s / 60)}min ${String(s % 60).padStart(2, "0")}s` : `${s}s`; };

  /* ====================================================================== estrutura */
  function build() {
    built = true;
    root.innerHTML = `
    <div class="card sp-live">
      <div class="card-head"><h2>Ao vivo</h2><span class="badge" id="spBadge">—</span></div>
      <div class="sp-live-grid">
        <div>
          <div class="seg seg-sm" id="spViewSeg"><button data-view="live" class="active">No ar</button><button data-view="draft">Rascunho</button></div>
          <div class="sp-stage" id="spStage"><iframe id="spFrame" title="Prévia dos patrocinadores" tabindex="-1"></iframe></div>
          <p class="muted small" id="spViewHint">Mostra o que está no ar agora.</p>
        </div>
        <div class="sp-controls">
          <div class="sp-now"><b id="spNowTitle">Nada no ar</b><span id="spNowTime" class="muted"></span></div>
          <div class="sp-bar"><i id="spBarFill"></i></div>
          <div class="sp-btns">
            <button class="btn" id="spPrev" title="Bloco anterior (ou volta ao início do atual)">${App.ico("prev")}Anterior</button>
            <button class="btn btn-primary" id="spPlay">${App.ico("pause")}Pausar</button>
            <button class="btn" id="spNext" title="Pula para o próximo bloco (logo ou vazio)">${App.ico("next")}Próximo</button>
            <button class="btn" id="spRestart" title="Volta para o primeiro bloco">${App.ico("reset")}Reiniciar</button>
            <button class="btn" id="spVisible">${App.ico("eye")}Tirar do ar</button>
          </div>
          <div class="sp-queue" id="spQueue"></div>
          <p class="muted small">Pausar congela o bloco atual (como um vídeo). “Tirar do ar” esconde a arte sem perder o ponto da playlist.</p>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h2><span class="step-num">1</span> Galeria</h2><span class="muted small" id="spGalleryCount"></span></div>
      <div class="row-gap">
        <label class="btn btn-primary" for="spFile">${App.ico("upload")}Adicionar imagens</label>
        <input type="file" id="spFile" accept="image/png,image/jpeg,image/webp" multiple hidden>
        <span class="muted small">PNG, JPG ou WebP. Imagens grandes são reduzidas (até ${MAX_SIDE}px) para ficarem leves. PNG com fundo transparente é o ideal.</span>
      </div>
      <div class="sp-gallery" id="spGallery"></div>
    </div>

    <div class="card">
      <div class="card-head"><h2><span class="step-num">2</span> Playlist (rascunho)</h2><span class="badge" id="spDirty"></span></div>
      <p class="muted small">Cada bloco é um logo da galeria ou um tempo <b>vazio</b> (a tela fica limpa). A lista roda em loop, na ordem, com o tempo de cada bloco. Nada disso vai ao ar até você clicar em <b>Atualizar no ar</b>.</p>
      <div class="sp-list" id="spList"></div>
      <div class="row-gap">
        <button class="btn" id="spAddBlock">${App.ico("plus")}Adicionar bloco</button>
        <button class="btn" id="spAddEmpty">${App.ico("plus")}Adicionar bloco vazio</button>
        <span class="muted small" id="spTotal"></span>
      </div>
      <div class="sp-publish">
        <button class="btn btn-primary btn-lg" id="spPublish">${App.ico("upload")}Atualizar no ar / Salvar playlist</button>
        <button class="btn" id="spDiscard">Descartar alterações</button>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h2><span class="step-num">3</span> Aparência do bloco</h2></div>
      <p class="muted small">O bloco tem <b>tamanho fixo</b>: logos grandes ou pequenos sempre se ajustam dentro dele. Estas opções também fazem parte do rascunho e só valem no ar depois de “Atualizar no ar”. Use a aba <b>Rascunho</b> acima para ver o resultado.</p>
      <div class="sp-settings" id="spSettings"></div>
    </div>`;
    buildSettings();
    wire();
    setView("live");
    new ResizeObserver(rescale).observe($("#spStage"));
  }

  const FIELDS = [
    { k: "w", label: "Largura do bloco (px)", t: "range", min: 80, max: 1200, step: 5 },
    { k: "h", label: "Altura do bloco (px)", t: "range", min: 60, max: 800, step: 5 },
    { k: "mx", label: "Margem lateral (px)", t: "range", min: 0, max: 400, step: 5 },
    { k: "my", label: "Margem vertical (px)", t: "range", min: 0, max: 400, step: 5 },
    { k: "pad", label: "Espaço interno (px)", t: "range", min: 0, max: 120, step: 2 },
    { k: "radius", label: "Cantos arredondados (px)", t: "range", min: 0, max: 120, step: 2 },
    { k: "bg", label: "Cor do fundo do bloco", t: "color" },
    { k: "bgOn", label: "Fundo sólido ligado", t: "check" },
    { k: "fit", label: "Como o logo cabe", t: "select", opts: [["contain", "Inteiro dentro do bloco"], ["cover", "Preencher o bloco (corta)"]] },
    { k: "animIn", label: "Animação de entrada", t: "select", opts: [["fade", "Só aparecer (fade)"], ["up", "Subir"], ["down", "Descer"], ["left", "Vir da esquerda"], ["right", "Vir da direita"], ["zoom", "Zoom"]] },
    { k: "animOut", label: "Animação de saída", t: "select", opts: [["fade", "Só sumir (fade)"], ["up", "Subir"], ["down", "Descer"], ["left", "Ir para a esquerda"], ["right", "Ir para a direita"], ["zoom", "Zoom"]] },
    { k: "animMs", label: "Duração da animação (ms)", t: "range", min: 150, max: 2500, step: 50 },
    { k: "motion", label: "Movimento durante a exibição", t: "select", opts: [["none", "Parado"], ["pulse", "Pulsar leve"], ["float", "Flutuar"]] },
  ];
  const POS_LABEL = { tl: "Topo esquerda", tc: "Topo centro", tr: "Topo direita", ml: "Meio esquerda", mc: "Centro", mr: "Meio direita", bl: "Base esquerda", bc: "Base centro", br: "Base direita" };
  function buildSettings() {
    const f = (d) => {
      if (d.t === "range") return `<div class="field"><label>${d.label}: <b data-out="${d.k}"></b></label><input type="range" data-k="${d.k}" min="${d.min}" max="${d.max}" step="${d.step}"></div>`;
      if (d.t === "color") return `<div class="field"><label>${d.label}</label><input type="color" data-k="${d.k}"></div>`;
      if (d.t === "check") return `<div class="field"><label class="switch"><input type="checkbox" data-k="${d.k}"><i></i><span class="switch-text"><b>${d.label}</b></span></label></div>`;
      return `<div class="field"><label>${d.label}</label><select data-k="${d.k}">${d.opts.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></div>`;
    };
    $("#spSettings").innerHTML = `<div class="sp-pos"><span class="muted small">Posição na tela</span><div class="sp-pos-grid">${SC.POS.map((p) => `<button type="button" data-pos="${p}" title="${POS_LABEL[p]}"></button>`).join("")}</div></div>
      <div class="form-grid">${FIELDS.map(f).join("")}</div>`;
  }
  function renderSettings() {
    const s = draft.settings;
    $$("#spSettings [data-k]").forEach((el) => {
      if (document.activeElement === el) return;
      const v = s[el.dataset.k];
      if (el.type === "checkbox") el.checked = !!v; else el.value = v;
    });
    $$("#spSettings [data-out]").forEach((o) => { o.textContent = s[o.dataset.out]; });
    $$("#spSettings [data-pos]").forEach((b) => b.classList.toggle("active", b.dataset.pos === s.pos));
  }

  /* ====================================================================== galeria */
  function renderGallery() {
    const ids = Object.keys(meta).sort((a, b) => (meta[a].at || 0) - (meta[b].at || 0));
    $("#spGalleryCount").textContent = `${ids.length}/${MAX_IMAGES} imagens`;
    $("#spGallery").innerHTML = ids.length ? ids.map((id) => {
      const m = meta[id];
      return `<div class="sp-tile" data-id="${id}">
        <div class="sp-thumb"><img src="${m.thumb}" alt=""></div>
        <input type="text" class="sp-name" value="${esc(m.name)}" maxlength="40" placeholder="Nome do patrocinador" aria-label="Nome do patrocinador">
        <small class="muted">${m.w}×${m.h} · ${Math.round((m.bytes || 0) / 1024)} KB</small>
        <div class="row-gap"><button class="btn btn-sm" data-use title="Adicionar ao rascunho da playlist">${App.ico("plus")}Usar</button><button class="btn btn-sm btn-danger-ghost" data-del title="Excluir imagem">${App.ico("trash")}</button></div>
      </div>`;
    }).join("") : `<p class="muted">Nenhuma imagem ainda. Adicione os logos dos patrocinadores.</p>`;
  }

  const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("imagem inválida")); i.src = src; });
  const scaled = (img, max, mime, q) => {
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return { c, url: c.toDataURL(mime, q) };
  };
  async function processFile(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImg(url);
      const jpeg = file.type === "image/jpeg";
      let side = MAX_SIDE, out = scaled(img, side, jpeg ? "image/jpeg" : "image/png", 0.88);
      for (let i = 0; i < 3 && out.url.length > 700000; i++) {          // arquivo ainda pesado: tenta WebP e/ou reduz
        const w = scaled(img, side, "image/webp", 0.9);
        out = w.url.startsWith("data:image/webp") && w.url.length < out.url.length ? w : out;
        if (out.url.length > 700000) { side = Math.round(side * 0.75); out = scaled(img, side, jpeg ? "image/jpeg" : "image/png", 0.85); }
      }
      const th = scaled(img, 160, jpeg ? "image/jpeg" : "image/png", 0.8);
      return { dataUrl: out.url, thumb: th.url, w: out.c.width, h: out.c.height, bytes: Math.round(out.url.length * 0.75) };
    } finally { URL.revokeObjectURL(url); }
  }
  async function addFiles(files) {
    const list = Array.from(files);
    for (const f of list) {
      if (Object.keys(meta).length >= MAX_IMAGES) { App.toast(`A galeria aceita até ${MAX_IMAGES} imagens. Exclua alguma para adicionar mais.`, "err", 5000); break; }
      if (!ACCEPT.includes(f.type)) { App.toast(`“${f.name}” não é PNG, JPG ou WebP — ignorado.`, "err", 5200); continue; }
      if (f.size > 12 * 1024 * 1024) { App.toast(`“${f.name}” é grande demais (máx. 12 MB).`, "err", 5200); continue; }
      try {
        const r = await processFile(f);
        const id = "s_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
        const name = f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").slice(0, 40);
        await ref().update({ ["images/" + id]: r.dataUrl, ["meta/" + id]: { name, thumb: r.thumb, w: r.w, h: r.h, bytes: r.bytes, at: Date.now() } });
        App.toast(`“${name}” adicionada (${Math.round(r.bytes / 1024)} KB).`, "ok", 2400);
      } catch (e) { App.toast(`Não consegui salvar “${f.name}” (${e.code || e.message}).`, "err", 5200); }
    }
  }
  async function deleteImage(id) {
    const used = draft.blocks.filter((b) => b.imageId === id).length + (live ? live.blocks.filter((b) => b.imageId === id).length : 0);
    const msg = used ? `“${nameOf(id)}” é usada em ${used} bloco(s) da playlist. Esses blocos passam a ficar vazios. Excluir mesmo assim?` : `Excluir “${nameOf(id)}” da galeria?`;
    if (!(await App.confirm(msg, { title: "Excluir imagem", okText: "Excluir", danger: true }))) return;
    draft.blocks.forEach((b) => { if (b.imageId === id) { b.type = "empty"; b.imageId = null; } });
    await ref().update({ ["images/" + id]: null, ["meta/" + id]: null });
    saveDraft(true); renderPlaylist();
  }

  /* ====================================================================== playlist (rascunho) */
  function renderPlaylist() {
    const opts = (sel) => `<option value="">Vazio (tela limpa)</option>` + Object.keys(meta).sort((a, b) => (meta[a].at || 0) - (meta[b].at || 0)).map((id) => `<option value="${id}" ${id === sel ? "selected" : ""}>${esc(meta[id].name)}</option>`).join("")
      + (sel && !meta[sel] ? `<option value="${sel}" selected>(imagem removida)</option>` : "");
    $("#spList").innerHTML = draft.blocks.length ? draft.blocks.map((b, i) => `
      <div class="sp-row" data-i="${i}">
        <span class="sp-n">${i + 1}</span>
        <div class="sp-rthumb ${b.type === "image" && meta[b.imageId] ? "" : "empty"}">${b.type === "image" && meta[b.imageId] ? `<img src="${meta[b.imageId].thumb}" alt="">` : "vazio"}</div>
        <select class="sp-sel" data-f="img" aria-label="Conteúdo do bloco">${opts(b.imageId)}</select>
        <label class="sp-num">Tempo <input type="number" data-f="duration" min="1" max="3600" step="1" value="${b.duration}"> s</label>
        <label class="sp-num ${b.type === "image" ? "" : "dim"}">Zoom <input type="number" data-f="zoom" min="20" max="300" step="5" value="${b.zoom}" ${b.type === "image" ? "" : "disabled"}> %</label>
        <div class="sp-acts"><button class="btn btn-sm" data-act="up" title="Subir" ${i === 0 ? "disabled" : ""}>${App.ico("up")}</button><button class="btn btn-sm" data-act="down" title="Descer" ${i === draft.blocks.length - 1 ? "disabled" : ""}>${App.ico("down")}</button><button class="btn btn-sm btn-danger-ghost" data-act="del" title="Excluir bloco">${App.ico("trash")}</button></div>
      </div>`).join("") : `<p class="muted sp-empty">A playlist está vazia. Clique em “Adicionar bloco”.</p>`;
    updateDirty();
  }
  function updateDirty() {
    const d = dirty();
    const badge = $("#spDirty"); badge.textContent = d ? "Alterações não publicadas" : "Igual ao que está no ar";
    badge.className = "badge " + (d ? "badge-warn" : "badge-ok");
    $("#spPublish").disabled = !d;
    $("#spDiscard").disabled = !d;
    $("#spTotal").textContent = draft.blocks.length ? `${draft.blocks.length} bloco(s) · volta ao início a cada ${fmtS(SC.total(draft.blocks))}` : "";
    $("#spAddBlock").disabled = $("#spAddEmpty").disabled = draft.blocks.length >= MAX_BLOCKS;
  }
  function saveDraft(now) {
    clearTimeout(saveTimer);
    const go = () => { saveTimer = null; ref("draft").set({ json: JSON.stringify({ blocks: draft.blocks, settings: draft.settings }), by: myId, at: Date.now() }).catch((e) => App.toast("Não consegui salvar o rascunho (" + (e.code || e.message) + ").", "err")); };
    if (now) go(); else saveTimer = setTimeout(go, 500);
    updateDirty();
  }
  const firstImageId = () => Object.keys(meta).sort((a, b) => (meta[a].at || 0) - (meta[b].at || 0))[0] || null;
  function addBlock(imageId) {
    if (draft.blocks.length >= MAX_BLOCKS) return;
    draft.blocks.push(SC.normalizeBlock({ id: uid(), type: imageId ? "image" : "empty", imageId, duration: imageId ? 10 : 5, zoom: 100 }, draft.blocks.length));
    saveDraft(); renderPlaylist();
  }

  async function publish() {
    if (!dirty()) return;
    const pkg = { rev: Date.now(), blocks: draft.blocks, settings: draft.settings };
    try {
      await ref().update({ live: JSON.stringify(pkg), ctl: { playing: true, startedAt: Date.now(), offsetMs: 0, visible: ctl ? ctl.visible !== false : true, rev: pkg.rev } });
      saveDraft(true);
      App.toast("Playlist atualizada no ar. Começa do primeiro bloco.", "ok", 3200);
    } catch (e) { App.toast("Não consegui publicar (" + (e.code || e.message) + "). Confira o login e as regras do Firebase.", "err", 6000); }
  }

  /* ====================================================================== controles ao vivo */
  const L = () => (live && live.blocks.length ? live : null);
  const writeCtl = (patch) => ref("ctl").set({ ...(ctl || { playing: true, startedAt: Date.now(), offsetMs: 0, visible: true }), ...patch }).catch((e) => App.toast("Não consegui enviar o comando (" + (e.code || e.message) + ").", "err"));
  const jump = (i) => { const l = L(); if (!l) return; writeCtl({ offsetMs: SC.startOf(l.blocks, i), startedAt: Date.now() }); };
  const where = () => { const l = L(); return l ? SC.locate(l.blocks, SC.elapsed(ctl, Date.now())) : null; };
  function renderLive() {
    if (!built) return;
    const l = L(), loc = where(), playing = !!(ctl && ctl.playing);
    ["spPrev", "spPlay", "spNext", "spRestart", "spVisible"].forEach((id) => { $("#" + id).disabled = !l; });
    $("#spPlay").innerHTML = App.ico(playing ? "pause" : "play") + (playing ? "Pausar" : "Continuar");
    const vis = !ctl || ctl.visible !== false;
    $("#spVisible").innerHTML = App.ico("eye") + (vis ? "Tirar do ar" : "Colocar no ar");
    const badge = $("#spBadge");
    if (!l) { badge.textContent = "Nada publicado"; badge.className = "badge"; }
    else if (!vis) { badge.textContent = "Fora do ar"; badge.className = "badge badge-warn"; }
    else if (!playing) { badge.textContent = "Pausado"; badge.className = "badge badge-warn"; }
    else { badge.textContent = "No ar"; badge.className = "badge badge-ok"; }
    if (!l || !loc) { $("#spNowTitle").textContent = "Nada no ar"; $("#spNowTime").textContent = ""; $("#spBarFill").style.width = "0"; $("#spQueue").innerHTML = ""; return; }
    const b = l.blocks[loc.index];
    $("#spNowTitle").textContent = `Bloco ${loc.index + 1} de ${l.blocks.length} · ${b.type === "image" ? nameOf(b.imageId) : "Vazio"}`;
    $("#spNowTime").textContent = (playing ? "restam " : "pausado — restam ") + fmtS(loc.remaining);
    $("#spBarFill").style.width = Math.min(100, (loc.into / SC.blockMs(b)) * 100) + "%";
    const qh = l.blocks.map((x, i) => `<button class="sp-chip ${i === loc.index ? "now" : ""}" data-jump="${i}" title="Tocar este bloco agora (${x.duration}s)">${x.type === "image" && meta[x.imageId] ? `<img src="${meta[x.imageId].thumb}" alt="">` : `<em>vazio</em>`}<small>${x.duration}s</small></button>`).join("");
    App.setHtml($("#spQueue"), qh);
    $$("#spQueue .sp-chip").forEach((c) => c.classList.toggle("now", Number(c.dataset.jump) === loc.index));
  }

  /* ====================================================================== prévia */
  function rescale() {
    const st = $("#spStage"), fr = $("#spFrame");
    if (st && st.clientWidth) fr.style.transform = `scale(${st.clientWidth / 1920})`;
  }
  function setView(v) {
    view = v;
    $$("#spViewSeg button").forEach((b) => b.classList.toggle("active", b.dataset.view === v));
    $("#spViewHint").textContent = v === "live" ? "Mostra o que está no ar agora." : "Mostra o rascunho em loop, só aqui no painel (não vai ao ar).";
    $("#spFrame").src = App.rel("/arte/patrocinadores") + (App.rel("/arte/patrocinadores").includes("?") ? "&" : "?") + (v === "draft" ? "rascunho=1&" : "") + "preview=1";
    rescale();
  }

  /* ====================================================================== eventos */
  function wire() {
    $("#spViewSeg").addEventListener("click", (e) => { const b = e.target.closest("button[data-view]"); if (b) setView(b.dataset.view); });
    $("#spFile").addEventListener("change", (e) => { addFiles(e.target.files).then(() => { e.target.value = ""; }); });
    $("#spGallery").addEventListener("click", (e) => {
      const t = e.target.closest(".sp-tile"); if (!t) return;
      if (e.target.closest("[data-use]")) addBlock(t.dataset.id);
      if (e.target.closest("[data-del]")) deleteImage(t.dataset.id);
    });
    $("#spGallery").addEventListener("change", (e) => {
      const t = e.target.closest(".sp-tile"); if (!t || !e.target.matches(".sp-name")) return;
      const name = e.target.value.trim().slice(0, 40) || "Sem nome";
      ref("meta/" + t.dataset.id + "/name").set(name).catch(() => App.toast("Não consegui renomear.", "err"));
    });
    $("#spAddBlock").addEventListener("click", () => addBlock(firstImageId()));
    $("#spAddEmpty").addEventListener("click", () => addBlock(null));
    $("#spList").addEventListener("click", (e) => {
      const row = e.target.closest(".sp-row"), btn = e.target.closest("[data-act]"); if (!row || !btn) return;
      const i = Number(row.dataset.i), a = btn.dataset.act, bl = draft.blocks;
      if (a === "del") bl.splice(i, 1);
      else if (a === "up" && i > 0) [bl[i - 1], bl[i]] = [bl[i], bl[i - 1]];
      else if (a === "down" && i < bl.length - 1) [bl[i + 1], bl[i]] = [bl[i], bl[i + 1]];
      saveDraft(); renderPlaylist();
    });
    $("#spList").addEventListener("input", (e) => {
      const row = e.target.closest(".sp-row"), f = e.target.dataset.f; if (!row || !f || f === "img") return;
      const b = draft.blocks[Number(row.dataset.i)], v = Number(e.target.value);
      if (!isFinite(v)) return;
      if (f === "duration") b.duration = Math.min(3600, Math.max(1, Math.round(v)));
      if (f === "zoom") b.zoom = Math.min(300, Math.max(20, Math.round(v)));
      saveDraft();
    });
    $("#spList").addEventListener("change", (e) => {
      const row = e.target.closest(".sp-row"), f = e.target.dataset.f; if (!row || !f) return;
      const b = draft.blocks[Number(row.dataset.i)];
      if (f === "img") { b.imageId = e.target.value || null; b.type = b.imageId ? "image" : "empty"; if (b.type === "image" && b.duration < 2) b.duration = 10; saveDraft(); renderPlaylist(); }
      else { e.target.value = b[f]; }                                   // mostra o valor já ajustado aos limites
    });
    $("#spPublish").addEventListener("click", publish);
    $("#spDiscard").addEventListener("click", async () => {
      if (!(await App.confirm("Descartar as alterações do rascunho e voltar ao que está no ar?", { title: "Descartar", okText: "Descartar" }))) return;
      draft = SC.normalize(live ? { blocks: live.blocks, settings: live.settings } : null);
      saveDraft(true); renderPlaylist(); renderSettings();
    });
    $("#spSettings").addEventListener("input", (e) => {
      const k = e.target.dataset.k; if (!k) return;
      draft.settings = SC.normalizeSettings({ ...draft.settings, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.type === "range" ? Number(e.target.value) : e.target.value });
      renderSettings(); saveDraft();
    });
    $("#spSettings").addEventListener("click", (e) => {
      const p = e.target.closest("[data-pos]"); if (!p) return;
      draft.settings = SC.normalizeSettings({ ...draft.settings, pos: p.dataset.pos }); renderSettings(); saveDraft();
    });
    $("#spPrev").addEventListener("click", () => { const l = L(), loc = where(); if (!l) return; jump(loc.into > 2500 ? loc.index : (loc.index - 1 + l.blocks.length) % l.blocks.length); });
    $("#spNext").addEventListener("click", () => { const l = L(), loc = where(); if (l) jump((loc.index + 1) % l.blocks.length); });
    $("#spRestart").addEventListener("click", () => jump(0));
    $("#spPlay").addEventListener("click", () => {
      if (!L()) return;
      if (ctl && ctl.playing) writeCtl({ playing: false, offsetMs: SC.elapsed(ctl, Date.now()) });
      else writeCtl({ playing: true, startedAt: Date.now() });
    });
    $("#spVisible").addEventListener("click", () => writeCtl({ visible: !(ctl ? ctl.visible !== false : true) }));
    $("#spQueue").addEventListener("click", (e) => { const c = e.target.closest("[data-jump]"); if (c) jump(Number(c.dataset.jump)); });
  }

  /* ====================================================================== dados do Firebase */
  function init() {
    if (ready) return; ready = true;
    build();
    ref("meta").on("value", (s) => { meta = s.val() || {}; renderGallery(); renderPlaylist(); renderLive(); });
    ref("live").on("value", (s) => { const p = parse(s.val()); live = p ? SC.normalize(p) : null; updateDirty(); renderLive(); });
    ref("ctl").on("value", (s) => { ctl = s.val(); renderLive(); });
    ref("draft").once("value", (s) => {
      const v = s.val(), p = v && parse(v.json);
      if (p) draft = SC.normalize(p); else if (live) draft = SC.normalize({ blocks: live.blocks, settings: live.settings });
      renderPlaylist(); renderSettings();
      ref("draft").on("value", (s2) => {                                // outro aparelho mexeu no rascunho
        const v2 = s2.val(); if (!v2 || v2.by === myId || saveTimer) return;
        const p2 = parse(v2.json); if (!p2) return;
        draft = SC.normalize(p2); renderPlaylist(); renderSettings();
      });
    });
    setInterval(() => { if (App.currentPage === "patrocinadores") renderLive(); }, 250);
  }
  App.registerPage("patrocinadores", {
    render() { if (!ready) init(); },
    onShow() { if (ready) { renderLive(); rescale(); } },
  });
  App.on("state", () => { if (!ready) init(); });
})();
