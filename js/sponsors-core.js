/**
 * PATROCINADORES — regras compartilhadas entre o painel e a arte (Placar App 1.1).
 * Playlist = lista de blocos { id, type: "image" | "empty", imageId, duration (s), zoom (%) } em loop infinito.
 * A posição de reprodução é calculada, não enviada: ctl = { playing, startedAt, offsetMs, visible }.
 *   tempo decorrido = offsetMs + (agora - startedAt)  (se estiver tocando)  ou  offsetMs  (se pausado)
 * Assim todas as telas mostram o mesmo bloco, sem mandar "tique" a cada segundo, e pausar/pular é só mudar o ctl.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SponsorsCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const DEFAULT_SETTINGS = {
    w: 420, h: 240,            // tamanho do bloco sólido (px, na tela de 1920×1080) — não muda com o tamanho do logo
    pos: "br", mx: 60, my: 60, // posição (tl tc tr / ml mc mr / bl bc br) e margens
    bgOn: true, bg: "#ffffff", // fundo sólido do bloco
    radius: 16, pad: 16,       // cantos e espaço interno
    fit: "contain",            // contain = logo inteiro dentro do bloco; cover = preenche e corta
    animIn: "fade", animOut: "fade", animMs: 600,
    motion: "none",            // none | pulse | float
  };
  const ANIM_IN = ["fade", "up", "down", "left", "right", "zoom"];
  const ANIM_OUT = ["fade", "up", "down", "left", "right", "zoom"];
  const POS = ["tl", "tc", "tr", "ml", "mc", "mr", "bl", "bc", "br"];
  const MOTION = ["none", "pulse", "float"];
  const num = (v, d, lo, hi) => { v = Number(v); if (!isFinite(v)) v = d; return Math.min(hi, Math.max(lo, v)); };

  function normalizeSettings(s) {
    s = s || {}; const d = DEFAULT_SETTINGS;
    return {
      w: num(s.w, d.w, 60, 1920), h: num(s.h, d.h, 40, 1080),
      pos: POS.includes(s.pos) ? s.pos : d.pos, mx: num(s.mx, d.mx, 0, 600), my: num(s.my, d.my, 0, 600),
      bgOn: s.bgOn === undefined ? d.bgOn : !!s.bgOn, bg: /^#[0-9a-f]{6}$/i.test(s.bg || "") ? s.bg : d.bg,
      radius: num(s.radius, d.radius, 0, 200), pad: num(s.pad, d.pad, 0, 200),
      fit: s.fit === "cover" ? "cover" : "contain",
      animIn: ANIM_IN.includes(s.animIn) ? s.animIn : d.animIn, animOut: ANIM_OUT.includes(s.animOut) ? s.animOut : d.animOut,
      animMs: num(s.animMs, d.animMs, 150, 3000), motion: MOTION.includes(s.motion) ? s.motion : d.motion,
    };
  }
  function normalizeBlock(b, i) {
    b = b || {};
    const isImg = b.type === "image" && typeof b.imageId === "string" && b.imageId;
    return { id: String(b.id || "b" + i), type: isImg ? "image" : "empty", imageId: isImg ? b.imageId : null,
      duration: num(b.duration, isImg ? 10 : 5, 1, 3600), zoom: num(b.zoom, 100, 20, 300) };
  }
  function normalize(pkg) {
    pkg = pkg || {};
    return { rev: pkg.rev || 0, blocks: (Array.isArray(pkg.blocks) ? pkg.blocks : []).slice(0, 60).map(normalizeBlock), settings: normalizeSettings(pkg.settings) };
  }
  const blockMs = (b) => Math.round(b.duration * 1000);
  const total = (blocks) => blocks.reduce((n, b) => n + blockMs(b), 0);
  const startOf = (blocks, index) => blocks.slice(0, index).reduce((n, b) => n + blockMs(b), 0);
  function elapsed(ctl, now) {
    if (!ctl) return 0;
    const off = Number(ctl.offsetMs) || 0;
    return ctl.playing ? Math.max(0, off + (now - (Number(ctl.startedAt) || now))) : Math.max(0, off);
  }
  /** Em que bloco estamos (a lista roda em loop infinito). */
  function locate(blocks, elapsedMs) {
    const t = total(blocks);
    if (!blocks.length || t <= 0) return { index: -1, into: 0, remaining: 0, total: t };
    let e = elapsedMs % t, acc = 0;
    for (let i = 0; i < blocks.length; i++) {
      const ms = blockMs(blocks[i]);
      if (e < acc + ms) return { index: i, into: e - acc, remaining: acc + ms - e, total: t };
      acc += ms;
    }
    return { index: 0, into: 0, remaining: blockMs(blocks[0]), total: t };
  }
  return { DEFAULT_SETTINGS, ANIM_IN, ANIM_OUT, POS, MOTION, normalize, normalizeSettings, normalizeBlock, blockMs, total, startOf, elapsed, locate };
});
