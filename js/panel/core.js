/**
 * NÚCLEO DO PAINEL (v4.0)
 * Socket.IO, estado compartilhado, utilitários, notificações e diálogos.
 * Todos os módulos do painel conversam por aqui (window.App).
 *
 * Duas fontes de dados vindas do servidor:
 *  - state (state:sync) -> partida atual, módulos, personalização
 *  - teams (teams:sync) -> cadastro de todos os times (arquivos separados)
 * O painel NUNCA envia o estado inteiro: só pequenas mudanças (settings:patch,
 * clock:*, match:*), então uma tela desatualizada não sobrescreve nada.
 */
const App = (() => {
  const socket = io();
  const A = { socket, state: null, teams: [], conn: { sources: {}, arte: 0, previews: 0, panel: 0 }, connected: false };

  /* ---------- Constantes ---------- */
  A.PERIOD_BASE = { "1t": 0, "2t": 45, "p1": 90, "p2": 105 };
  A.PERIOD_REGULATION = { "1t": 45, "2t": 45, "p1": 15, "p2": 15 };
  A.PERIOD_LABELS = { "1t": "1º Tempo", "2t": "2º Tempo", "p1": "1ª Prorrogação", "p2": "2ª Prorrogação" };
  A.SOURCES = [
    { key: "escalacao", name: "Escalação", path: "/arte", hint: "Arte com os 11 titulares" },
    { key: "placar", name: "Placar e relógio", path: "/arte/placar", hint: "Placar, tempo e campeonato" },
    { key: "eventos", name: "Eventos animados", path: "/arte/eventos", hint: "Notificação de gol, cartão e substituição" },
    { key: "linhaDoTempo", name: "Linha do tempo", path: "/arte/linha-do-tempo", hint: "Lista permanente dos últimos eventos" },
    // v4.1 — opcional: só entra no ar quando houver disputa de pênaltis
    { key: "penaltis", name: "Pênaltis", path: "/arte/penaltis", hint: "Opcional — cartão da disputa de pênaltis", optional: true },
    // v5.0 — opcional: placar final + quem fez os gols
    { key: "fimDeJogo", name: "Fim de jogo", path: "/arte/fim-de-jogo", hint: "Opcional — placar final e autores dos gols", optional: true },
    // v6.0 — opcional: classificação, outros jogos, arbitragem e VAR
    { key: "classificacao", name: "Classificação", path: "/arte/classificacao", hint: "Opcional — só a tabela de classificação, já na posição escolhida", optional: true },
    { key: "patrocinadores", name: "Patrocinadores", path: "/arte/patrocinadores", hint: "Opcional — logos dos patrocinadores em loop", optional: true },
    { key: "informativos", name: "Informativos", path: "/arte/informativos", hint: "Opcional — outros jogos, arbitragem, VAR e estádio", optional: true },
  ];
  /* Placar App 1.0 — endereços das artes (GitHub Pages): "arte/placar/" etc., relativos à página do painel.
     Se o painel foi aberto com ?sala=nome, as artes recebem o mesmo ?sala=nome. */
  A.rel = (p) => {
    const [pathPart, q] = String(p).split("?");
    let path = pathPart.replace(/^\/+/, "");
    if (path && !path.endsWith("/")) path += "/";
    const params = new URLSearchParams(q || "");
    if (window.PLACAR_SALA) params.set("sala", window.PLACAR_SALA);
    const qs = params.toString();
    return (path || "./") + (qs ? "?" + qs : "");
  };
  A.abs = (p) => new URL(A.rel(p), document.baseURI).href;
  A.undo = { count: 0, label: null, redoCount: 0, redoLabel: null }; // v5.0 — desfazer geral (vem do servidor)

  A.computeDisplayMinute = (totalSeconds, period) => {
    const minute = Math.floor(totalSeconds / 60);
    const base = A.PERIOD_BASE[period] ?? 0;
    const reg = A.PERIOD_REGULATION[period] ?? 45;
    return minute <= reg ? String(base + minute) : `${base + reg}+${minute - reg}`;
  };

  /* ---------- Utilitários ---------- */
  A.$ = (sel, root = document) => root.querySelector(sel);
  A.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  A.escapeHtml = (str) => {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  };
  A.pad2 = (n) => String(n).padStart(2, "0");
  A.formatClock = (s) => `${A.pad2(Math.floor(s / 60))}:${A.pad2(s % 60)}`;
  A.generateId = () => "p_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
  A.findTeam = (id) => A.teams.find((t) => t.id === id) || null;
  A.getByPath = (obj, path) => path.split(".").reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
  A.setByPath = (obj, path, value) => {
    const keys = path.split(".");
    let t = obj;
    for (let i = 0; i < keys.length - 1; i++) { if (!t[keys[i]]) t[keys[i]] = {}; t = t[keys[i]]; }
    t[keys[keys.length - 1]] = value;
  };
  A.ico = (name, cls = "") => `<svg class="ico ${cls}"><use href="#i-${name}"/></svg>`;
  A.teamLabel = (side) => {
    const t = A.state && A.findTeam(A.state.match[side].teamId);
    return t && t.name ? t.name : side === "home" ? "Mandante" : "Visitante";
  };
  A.shortOf = (team, fallback) => {
    if (!team) return fallback || "—";
    return (team.shortName || team.name || fallback || "—").trim().slice(0, 4).toUpperCase();
  };
  /** Só reescreve o HTML se mudou — evita fechar <select> abertos e piscar listas. */
  A.setHtml = (el, html) => { if (el._html !== html) { el.innerHTML = html; el._html = html; } };
  A.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  A.store = {
    get(k, d) { try { const v = localStorage.getItem("v4_" + k); return v === null ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem("v4_" + k, JSON.stringify(v)); } catch (_) { /* ignora */ } },
  };

  /* ---------- Envio de mudanças ---------- */
  A.patch = (path, value) => {
    A.setByPath(A.state, path, value); // otimista: o painel responde na hora
    socket.emit("settings:patch", { path, value });
  };

  /* ---------- Barramento simples de eventos ---------- */
  const handlers = { state: [], teams: [], tick: [], conn: [], status: [], undo: [] };
  A.on = (ev, fn) => { handlers[ev].push(fn); };
  const fire = (ev, ...args) => handlers[ev].forEach((fn) => { try { fn(...args); } catch (e) { console.error(`[panel:${ev}]`, e); } });

  socket.on("connect", () => { A.connected = true; fire("status", true); });
  socket.on("disconnect", () => { A.connected = false; fire("status", false); });
  socket.on("state:sync", (s) => { A.state = s; fire("state"); });
  socket.on("teams:sync", (t) => { A.teams = t; fire("teams"); });
  socket.on("clock:tick", (t) => fire("tick", t));
  socket.on("connections:sync", (c) => { A.conn = c; fire("conn"); });
  socket.on("undo:sync", (u) => { A.undo = u || { count: 0, label: null, redoCount: 0, redoLabel: null }; fire("undo"); });

  /* ---------- Notificações (toast) ---------- */
  A.toast = (message, type = "info", ms = 3600) => {
    const box = document.getElementById("toasts");
    const el = document.createElement("div");
    el.className = "toast toast-" + type;
    el.innerHTML = `<span>${A.escapeHtml(message)}</span>`;
    box.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 250); }, ms);
  };

  /* ---------- Diálogo de confirmação (substitui o confirm() do navegador) ---------- */
  A.confirm = (text, { title = "Confirmar", okText = "Confirmar", danger = false } = {}) =>
    new Promise((resolve) => {
      const ov = document.getElementById("confirmOverlay");
      document.getElementById("confirmTitle").textContent = title;
      document.getElementById("confirmText").textContent = text;
      const ok = document.getElementById("confirmOk");
      const cancel = document.getElementById("confirmCancel");
      ok.textContent = okText;
      ok.className = "btn " + (danger ? "btn-danger" : "btn-primary");
      const done = (v) => {
        ov.classList.remove("open");
        ok.onclick = cancel.onclick = ov.onclick = null;
        document.removeEventListener("keydown", onKey);
        resolve(v);
      };
      const onKey = (e) => { if (e.key === "Escape") done(false); };
      ok.onclick = () => done(true);
      cancel.onclick = () => done(false);
      ov.onclick = (e) => { if (e.target === ov) done(false); };
      document.addEventListener("keydown", onKey);
      ov.classList.add("open");
      ok.focus();
    });

  /* ---------- Chamadas à API do servidor ---------- */
  A.api = async (url, opts = {}) => {
    const init = { method: opts.method || "GET", headers: { ...(opts.headers || {}) } };
    if (opts.json !== undefined) { init.headers["Content-Type"] = "application/json"; init.body = JSON.stringify(opts.json); }
    if (opts.body !== undefined) init.body = opts.body;
    const res = await fetch(url, init);
    let data = null;
    try { data = await res.json(); } catch (_) { /* sem corpo */ }
    if (!res.ok) throw new Error((data && data.error) || `Erro ${res.status}`);
    return data;
  };

  /* ---------- Copiar texto ---------- */
  A.copy = async (text, label = "Copiado") => {
    try { await navigator.clipboard.writeText(text); }
    catch (_) {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e) { /* ignora */ }
      ta.remove();
    }
    A.toast(label, "ok", 1800);
  };
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-copy]");
    if (b) A.copy(b.dataset.copy);
    const f = e.target.closest("[data-copy-from]");
    if (f) A.copy(document.getElementById(f.dataset.copyFrom).textContent);
  });

  /* ---------- Páginas: registro e renderização preguiçosa ---------- */
  A.pages = {};
  A.currentPage = "dashboard";
  A.registerPage = (id, def) => { A.pages[id] = { dirty: true, ...def }; };
  A.renderPage = (id) => {
    const p = A.pages[id];
    if (!p || !A.state) return;
    p.dirty = false;
    try { p.render && p.render(); } catch (e) { console.error(`[page:${id}]`, e); }
  };
  A.markDirty = () => Object.values(A.pages).forEach((p) => { p.dirty = true; });
  A.on("state", () => { A.markDirty(); A.renderPage(A.currentPage); });
  A.on("teams", () => { A.markDirty(); A.renderPage(A.currentPage); });

  A.go = (id) => {
    if (!A.pages[id]) return;
    A.currentPage = id;
    A.$$(".page").forEach((p) => p.classList.toggle("active", p.id === "page-" + id));
    A.$$(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.page === id));
    if (A.revealNav) A.revealNav();
    A.store.set("page", id);
    const p = A.pages[id];
    if (p.dirty) A.renderPage(id);
    if (p.onShow) p.onShow();
    A.$("#content").scrollTop = 0;
  };

  return A;
})();
