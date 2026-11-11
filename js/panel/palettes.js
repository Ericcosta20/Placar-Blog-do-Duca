/**
 * PALETAS PRONTAS (v4.1) — dados puros, usados pela aba Arte e pelo cadastro de Times.
 * Todas as combinações foram conferidas para ter texto legível sobre o fundo
 * (contraste mínimo 4.5:1) — ver README, "Paletas".
 *
 * Formato (Arte): { name, set: { <campo>: "#hex", ... } } — cada campo é gravado em
 * customization.<fonte>.<campo>. `swatch` (opcional) define as cores da bolinha.
 */
(() => {
  const pal = (name, bg, accent, text) => ({ name, set: { bgColor: bg, accentColor: accent, textColor: text }, swatch: [bg, accent, text] });

  const PLACAR = [
    pal("Azul Clássico", "#0c0f14", "#0057ff", "#f5f6f8"),
    pal("Azul Marinho", "#071a33", "#1d4ed8", "#ffffff"),
    pal("Celeste", "#0a1f33", "#38bdf8", "#f5faff"),
    pal("Verde Campo", "#06210f", "#16a34a", "#ffffff"),
    pal("Verde Escuro", "#0a1f14", "#15803d", "#f0fdf4"),
    pal("Vermelho Vivo", "#210606", "#dc2626", "#ffffff"),
    pal("Rubro-negro", "#0b0b0c", "#e11d2e", "#ffffff"),
    pal("Grená", "#1f0a14", "#9f1239", "#ffffff"),
    pal("Roxo", "#160a2e", "#7c3aed", "#f5f3ff"),
    pal("Rosa", "#2a0a1c", "#ec4899", "#fff1f8"),
    pal("Laranja", "#1f1005", "#f97316", "#fff7ed"),
    pal("Amarelo", "#14110a", "#facc15", "#fffbea"),
    pal("Dourado", "#1a1204", "#caa127", "#fff8e6"),
    pal("Preto e Dourado", "#0a0a0a", "#d4af37", "#f5e9b8"),
    pal("Turquesa", "#052026", "#14b8a6", "#f0fdfa"),
    pal("Alvinegro", "#0b0b0c", "#f4f4f5", "#f4f4f5"),
    pal("Grafite", "#111418", "#475569", "#f1f5f9"),
    pal("Escuro Neutro", "#0a0c10", "#1f2430", "#f5f6f8"),
    pal("Claro", "#f8fafc", "#0f172a", "#0f172a"),
    pal("Branco e Azul", "#f1f5f9", "#1d4ed8", "#0f172a"),
  ];

  const ev = (name, bg, text, goal, sub) => ({ name, set: { bgColor: bg, textColor: text, goalColor: goal, subColor: sub }, swatch: [bg, goal, text] });
  const EVENTOS = [
    ev("Escuro e Verde", "#0c0f14", "#f5f6f8", "#22c55e", "#0ea5e9"),
    ev("Azul Noite", "#0a1426", "#eef4ff", "#3b82f6", "#38bdf8"),
    ev("Rubro-negro", "#0b0b0c", "#ffffff", "#e11d2e", "#f59e0b"),
    ev("Roxo", "#160a2e", "#f5f3ff", "#a855f7", "#22d3ee"),
    ev("Dourado", "#14110a", "#fff8e6", "#facc15", "#38bdf8"),
    ev("Verde Campo", "#06210f", "#ffffff", "#22c55e", "#a3e635"),
    ev("Grená", "#1f0a14", "#ffffff", "#f43f5e", "#fb7185"),
    ev("Turquesa", "#052026", "#f0fdfa", "#2dd4bf", "#38bdf8"),
    ev("Laranja", "#1f1005", "#fff7ed", "#f97316", "#fbbf24"),
    ev("Rosa", "#2a0a1c", "#fff1f8", "#ec4899", "#a78bfa"),
    ev("Grafite", "#111418", "#f1f5f9", "#34d399", "#60a5fa"),
    ev("Claro", "#f8fafc", "#0f172a", "#16a34a", "#0284c7"),
  ];

  const lt = (name, bg, text) => ({ name, set: { bgColor: bg, textColor: text }, swatch: [bg, text] });
  const LINHA = [
    lt("Escuro", "#0c0f14", "#f5f6f8"),
    lt("Preto", "#000000", "#ffffff"),
    lt("Azul Noite", "#0a1426", "#eef4ff"),
    lt("Verde Campo", "#06210f", "#ffffff"),
    lt("Grená", "#1f0a14", "#ffffff"),
    lt("Roxo", "#160a2e", "#f5f3ff"),
    lt("Dourado", "#14110a", "#fff8e6"),
    lt("Turquesa", "#052026", "#f0fdfa"),
    lt("Laranja", "#1f1005", "#fff7ed"),
    lt("Grafite", "#1e2430", "#f1f5f9"),
    lt("Claro", "#f8fafc", "#0f172a"),
    lt("Azul Claro", "#e0ecff", "#0a1e4a"),
  ];

  const pen = (name, bg, accent, text, goal, miss, pending) => ({ name, set: { bgColor: bg, accentColor: accent, textColor: text, goalColor: goal, missColor: miss, pendingColor: pending }, swatch: [bg, accent, goal, miss] });
  const PENALTIS = [
    pen("Escuro e Azul", "#0c0f14", "#0057ff", "#f5f6f8", "#22c55e", "#ef4444", "#2a3140"),
    pen("Verde Campo", "#06210f", "#16a34a", "#ffffff", "#4ade80", "#ef4444", "#1f4d2c"),
    pen("Rubro-negro", "#0b0b0c", "#e11d2e", "#ffffff", "#22c55e", "#ef4444", "#2b2b30"),
    pen("Roxo", "#160a2e", "#7c3aed", "#f5f3ff", "#22c55e", "#fb7185", "#32215a"),
    pen("Dourado", "#14110a", "#caa127", "#fff8e6", "#22c55e", "#ef4444", "#3a3220"),
    pen("Celeste", "#0a1f33", "#38bdf8", "#f5faff", "#22c55e", "#ef4444", "#1d3a57"),
    pen("Grafite", "#111418", "#475569", "#f1f5f9", "#34d399", "#f87171", "#2b3340"),
    pen("Claro", "#f8fafc", "#0f172a", "#0f172a", "#16a34a", "#dc2626", "#cbd5e1"),
  ];

  /* ---------- Paletas de TIMES (cadastro) ---------- */
  // Na arte da escalação: o NOME do time (secundária) e o NÚMERO dos jogadores ficam sobre a cor
  // principal; o NOME dos jogadores (texto) fica sobre o fundo. Por isso o número é calculado
  // automaticamente (branco ou preto, o que ler melhor sobre a cor principal).
  const lum = (hex) => {
    const c = hex.replace("#", ""), f = c.length === 3 ? c.split("").map((x) => x + x).join("") : c;
    const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * lin(parseInt(f.slice(0, 2), 16)) + 0.7152 * lin(parseInt(f.slice(2, 4), 16)) + 0.0722 * lin(parseInt(f.slice(4, 6), 16));
  };
  const onPrimary = (hex) => (lum(hex) > 0.3 ? "#0b0f14" : "#ffffff");
  const team = (name, primary, secondary, text, bg, divider, captain, extra = {}) => ({
    name, primaryColor: primary, secondaryColor: secondary, textColor: text, numberColor: extra.number || onPrimary(primary),
    bgColor: bg, dividerColor: divider, captainColor: captain, shadowColor: extra.shadow || "#000000",
  });
  const TEAMS = [
    team("Azul Clássico", "#0057ff", "#ffffff", "#ffffff", "#0c0f14", "#2a3444", "#ffd400"),
    team("Azul e Branco", "#1e6fd9", "#ffffff", "#ffffff", "#081a33", "#1c3f73", "#ffd400"),
    team("Azul Marinho", "#1d3a8a", "#ffffff", "#ffffff", "#060f24", "#1b2c57", "#ffd400"),
    team("Celeste", "#4aa8ff", "#06182b", "#ffffff", "#0a1f33", "#1d4163", "#ffd400"),
    team("Tricolor Azul e Vermelho", "#0b4aa8", "#ffffff", "#ffffff", "#071530", "#1f3a6e", "#ffd400"),
    team("Verde Bahia", "#0a8f3c", "#ffffff", "#ffffff", "#08240f", "#1f4d2c", "#ffd400"),
    team("Verde e Branco", "#15803d", "#ffffff", "#ffffff", "#052e16", "#17532f", "#ffd400"),
    team("Verde Escuro", "#166534", "#d9f99d", "#ffffff", "#04200f", "#14502a", "#facc15"),
    team("Vermelho Clássico", "#d81c1c", "#ffffff", "#ffffff", "#210606", "#4d1a1a", "#ffd400"),
    team("Rubro-negro", "#c8102e", "#000000", "#ffffff", "#0b0b0c", "#3a1015", "#ffd400"),
    team("Alvinegro", "#ffffff", "#000000", "#ffffff", "#0b0b0c", "#3a3a3d", "#ffd400"),
    team("Tricolor Vermelho, Branco e Preto", "#d71920", "#ffffff", "#ffffff", "#0b0b0c", "#44171a", "#ffd400"),
    team("Grená e Verde", "#7b1e3a", "#ffffff", "#ffffff", "#1a0a10", "#4a1c2b", "#ffd400"),
    team("Grená", "#8c1d40", "#ffffff", "#ffffff", "#1f0a14", "#4d1c30", "#ffd400"),
    team("Roxo Piseiro", "#7c3aed", "#f5f3ff", "#ffffff", "#160a2e", "#3b2568", "#ffd400"),
    team("Roxo e Branco", "#6d28d9", "#ffffff", "#ffffff", "#0f0720", "#33205e", "#facc15"),
    team("Amarelo e Preto", "#facc15", "#111111", "#ffffff", "#0b0b0c", "#4a4310", "#ffffff"),
    team("Amarelo e Azul", "#facc15", "#1d3a9a", "#ffffff", "#0b1220", "#2a3a66", "#ffffff"),
    team("Laranja", "#f97316", "#1f1005", "#ffffff", "#1f1005", "#5a3010", "#ffd400"),
    team("Rosa", "#ec4899", "#2a0a1c", "#ffffff", "#2a0a1c", "#5e1f43", "#ffd400"),
    team("Turquesa", "#14b8a6", "#04201c", "#ffffff", "#052026", "#12505a", "#ffd400"),
    team("Preto e Dourado", "#d4af37", "#000000", "#f5e9b8", "#0a0a0a", "#4a3e14", "#ffffff"),
    team("Dourado", "#caa127", "#1a1204", "#1a1204", "#fff8e6", "#e6d190", "#d81c1c", { shadow: "#8a6c10" }),
    team("Branco e Preto (claro)", "#111827", "#ffffff", "#111827", "#f8fafc", "#cbd5e1", "#b45309", { shadow: "#94a3b8" }),
    team("Cinza e Prata", "#94a3b8", "#0b1220", "#f1f5f9", "#111418", "#334155", "#ffd400"),
    team("Escuro Neutro", "#1f2430", "#f5f6f8", "#f5f6f8", "#0a0c10", "#2a3040", "#ffd400"),
  ];

  window.Palettes = { PLACAR, EVENTOS, LINHA, PENALTIS, TEAMS };
})();
