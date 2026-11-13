/**
 * ARTE DE PATROCINADORES (Placar App 1.1) — lê a playlist publicada no Firebase e roda em loop infinito.
 *   placar/sponsors/live      -> playlist publicada (JSON)
 *   placar/sponsors/ctl       -> { playing, startedAt, offsetMs, visible }  (pausar / pular / reiniciar / mostrar)
 *   placar/sponsors/images/ID -> imagem em Base64
 * Nunca anima ao abrir/atualizar a página: o primeiro bloco aparece direto. Não precisa de login.
 * ?rascunho=1 mostra o rascunho do painel (prévia) em vez do que está no ar. ?preview=1 não registra presença.
 */
(() => {
  const SC = window.SponsorsCore;
  const q = new URLSearchParams(location.search);
  const draftMode = q.get("rascunho") === "1", preview = q.get("preview") === "1";
  const box = document.getElementById("spBox");

  // dentro da prévia do painel reaproveita a conexão do próprio painel (sem abrir outra)
  let db = null;
  try { if (window.parent !== window && window.parent.PLACAR_DB) db = window.parent.PLACAR_DB; } catch (_) { /* outra origem */ }
  db = db || window.PLACAR_DB;
  if (!db) { console.error("Firebase não carregou."); return; }
  const base = (window.PLACAR_PATH || "placar") + "/sponsors";
  const ref = (p) => db.ref(base + "/" + p);

  let offset = 0;
  db.ref(".info/serverTimeOffset").on("value", (s) => { offset = Number(s.val()) || 0; });
  const now = () => Date.now() + offset;

  let pkg = SC.normalize(null), ctl = null, hasPkg = false;
  const t0 = now();                                  // relógio local do modo rascunho
  const images = new Map();                          // imageId -> Promise<dataUrl>
  const loadImage = (id) => {
    if (!images.has(id)) images.set(id, new Promise((res) => ref("images/" + id).once("value", (s) => {
      const url = s.val();
      if (!url) return res(null);
      const im = new Image(); im.onload = im.onerror = () => res(url); im.src = url;     // decodifica antes de mostrar
    }, () => res(null))));
    return images.get(id);
  };
  const preload = () => pkg.blocks.forEach((b) => b.imageId && loadImage(b.imageId));

  /* ---------- aparência do bloco (travado: o logo se ajusta ao bloco, nunca o contrário) ---------- */
  let styleKey = "";
  function applyStyle() {
    const s = pkg.settings, key = JSON.stringify(s);
    if (key === styleKey) return false;
    styleKey = key;
    const st = box.style;
    st.width = s.w + "px"; st.height = s.h + "px";
    st.background = s.bgOn ? s.bg : "transparent";
    st.borderRadius = s.radius + "px";
    st.setProperty("--ms", s.animMs + "ms");
    st.left = st.right = st.top = st.bottom = "auto";
    const h = s.pos[1], v = s.pos[0];
    if (h === "l") st.left = s.mx + "px"; else if (h === "r") st.right = s.mx + "px"; else st.left = (1920 - s.w) / 2 + "px";
    if (v === "t") st.top = s.my + "px"; else if (v === "b") st.bottom = s.my + "px"; else st.top = (1080 - s.h) / 2 + "px";
    box.classList.remove("mo-pulse", "mo-float");
    if (s.motion !== "none") box.classList.add("mo-" + s.motion);
    return true;
  }

  /* ---------- troca de bloco ---------- */
  let shownKey = null, slide = null, first = true, seq = 0;
  const dropSlide = (el, animate) => {
    if (!el) return;
    if (!animate) { el.remove(); return; }
    el.classList.remove("in-" + pkg.settings.animIn); el.classList.add("out-" + pkg.settings.animOut); el.classList.remove("cur");
    setTimeout(() => el.remove(), pkg.settings.animMs + 60);
  };
  async function show(index) {
    const mySeq = ++seq, b = pkg.blocks[index], s = pkg.settings, animate = !first;
    if (!b || b.type !== "image") {                  // bloco vazio: some tudo (o bloco sólido também)
      box.classList.remove("on"); dropSlide(slide, animate); slide = null; first = false; return;
    }
    const url = await loadImage(b.imageId);
    if (mySeq !== seq) return;                       // já mudou de bloco enquanto a imagem carregava
    if (!url) { box.classList.remove("on"); dropSlide(slide, animate); slide = null; first = false; return; }
    const el = document.createElement("div");
    el.className = "sp-slide cur fit-" + s.fit + (animate ? " in-" + s.animIn : "");
    el.style.inset = s.pad + "px";
    const img = document.createElement("img"); img.src = url; img.alt = "";
    img.style.width = img.style.height = b.zoom + "%";
    el.appendChild(img);
    box.appendChild(el);
    if (!animate) { box.style.transition = "none"; box.classList.add("on"); void box.offsetWidth; box.style.transition = ""; }   // ao abrir/recarregar: aparece direto, sem animação
    else box.classList.add("on");
    dropSlide(slide, animate);
    slide = el; first = false;
    if (animate) setTimeout(() => { if (el.isConnected) el.classList.remove("in-" + s.animIn); }, s.animMs + 80);
  }

  /* ---------- relógio da playlist ---------- */
  let wasOff = false;
  function tick() {
    if (!hasPkg) return;
    applyStyle();
    const c = draftMode ? { playing: true, startedAt: t0, offsetMs: 0, visible: true } : ctl;
    if (!c || !pkg.blocks.length || c.visible === false) {       // sem playlist ou arte escondida pelo painel
      if (!wasOff) { wasOff = true; shownKey = null; seq++; box.classList.remove("on"); dropSlide(slide, !first); slide = null; }
      return;
    }
    const loc = SC.locate(pkg.blocks, SC.elapsed(c, now()));
    const b = pkg.blocks[loc.index];
    const key = pkg.rev + ":" + loc.index + ":" + (b ? b.id + b.imageId + b.zoom : "") + (draftMode ? ":" + styleKey : "");
    if (wasOff || key !== shownKey) { wasOff = false; shownKey = key; show(loc.index); }
  }
  setInterval(tick, 100);

  const parse = (json) => { try { return typeof json === "string" ? JSON.parse(json) : json; } catch (_) { return null; } };
  if (draftMode) {
    ref("draft").on("value", (s) => { const v = s.val(); const p = v && parse(v.json); pkg = SC.normalize(p); hasPkg = !!p; preload(); shownKey = null; });
  } else {
    ref("live").on("value", (s) => { const p = parse(s.val()); pkg = SC.normalize(p); hasPkg = !!p; preload(); });
    ref("ctl").on("value", (s) => { ctl = s.val(); });
  }

  /* presença: aparece no Dashboard do painel (a regra do banco permite só este caminho sem login) */
  if (!preview && !draftMode) {
    db.ref(".info/connected").on("value", (s) => {
      if (s.val() !== true) return;
      const id = "art_" + Math.random().toString(36).slice(2, 8), p = db.ref((window.PLACAR_PATH || "placar") + "/presence/" + id);
      p.onDisconnect().remove(); p.set({ source: "patrocinadores", at: firebase.database.ServerValue.TIMESTAMP }).catch(() => {});
    });
  }
})();
