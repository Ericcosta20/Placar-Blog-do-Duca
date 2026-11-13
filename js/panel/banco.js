/**
 * BANCO DE DADOS (Placar App 1.1): importar da versão de computador (zip, pasta data ou .json), baixar uma cópia e recomeçar.
 * Os dados vivem no Firebase; a importação passa pelo motor do painel (evento "engine:import").
 */
(() => {
  const { $, $$, escapeHtml, socket } = App;
  const FORMAT = "blogdoduca-db";
  const CREST_MAX = 512;
  let staged = null;

  /* ---------- leitura de .zip (sem bibliotecas): usa o descompactador do próprio navegador ---------- */
  async function inflateRaw(bytes) {
    const ds = new DecompressionStream("deflate-raw");
    const out = new Response(new Blob([bytes]).stream().pipeThrough(ds));
    return new Uint8Array(await out.arrayBuffer());
  }
  async function readZip(file) {
    const buf = new Uint8Array(await file.arrayBuffer()), dv = new DataView(buf.buffer);
    let eocd = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error("Arquivo .zip inválido ou corrompido.");
    const total = dv.getUint16(eocd + 10, true);
    let off = dv.getUint32(eocd + 16, true);
    const dec = new TextDecoder("utf-8"), out = [];
    for (let n = 0; n < total; n++) {
      if (dv.getUint32(off, true) !== 0x02014b50) throw new Error("Diretório do .zip inválido.");
      const method = dv.getUint16(off + 10, true), comp = dv.getUint32(off + 20, true), size = dv.getUint32(off + 24, true);
      const nl = dv.getUint16(off + 28, true), el = dv.getUint16(off + 30, true), cl = dv.getUint16(off + 32, true), lo = dv.getUint32(off + 42, true);
      const name = dec.decode(buf.slice(off + 46, off + 46 + nl)).replace(/\\/g, "/");
      off += 46 + nl + el + cl;
      if (name.endsWith("/") || !/\.json$/i.test(name)) continue;
      if (/(^|\/)(node_modules|backups)\//i.test(name) || /(^|\/)package(-lock)?\.json$/i.test(name) || /\.corrupt-/.test(name)) continue;
      if (size > 60 * 1024 * 1024) continue;
      const ln = dv.getUint16(lo + 26, true), le = dv.getUint16(lo + 28, true), start = lo + 30 + ln + le;
      const raw = buf.slice(start, start + comp);
      try {
        const bytes = method === 0 ? raw : method === 8 ? await inflateRaw(raw) : null;
        if (bytes) out.push({ name, text: dec.decode(bytes) });
      } catch (_) { /* pula este arquivo */ }
    }
    return out;
  }

  /* ---------- classificar o que veio ---------- */
  const slug = (t) => String(t || "time").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "time";
  function classify(o) {
    if (!o || typeof o !== "object" || Array.isArray(o)) return null;
    if (o.format === FORMAT && (Array.isArray(o.teams) || o.state)) return "bundle";
    if (Array.isArray(o.players) && typeof o.name === "string") return "team";
    if (o.match || o.customization || o.meta || o.modules) return "state";
    return null;
  }
  function collect(files) {
    const col = { teams: new Map(), state: null, statePath: "", warnings: [], read: 0 };
    const addTeam = (t, hint) => {
      let id = slug(t.id || hint || t.name), base = id, n = 2;
      while (col.teams.has(id)) { if (JSON.stringify(col.teams.get(id).players) === JSON.stringify(t.players || [])) return; id = base + "-" + n++; }
      col.teams.set(id, { ...t, id });
    };
    const addState = (st, where) => {
      if (!col.state) { col.state = st; col.statePath = where; return; }
      if (/(^|\/)data\/state\.json$/i.test(where) && !/(^|\/)data\/state\.json$/i.test(col.statePath)) { col.state = st; col.statePath = where; }
    };
    for (const f of files) {
      let o;
      try { o = JSON.parse(f.text.replace(/^﻿/, "")); } catch (e) { col.warnings.push(`“${f.name.split("/").pop()}” não é um JSON válido.`); continue; }
      col.read++;
      const kind = classify(o);
      if (kind === "bundle") { (o.teams || []).forEach((t) => t && typeof t === "object" && addTeam(t)); if (o.state) addState(o.state, f.name); }
      else if (kind === "team") addTeam(o, f.name.split("/").pop().replace(/\.json$/i, ""));
      else if (kind === "state") addState(o, f.name);
    }
    return col;
  }

  /* ---------- escudos grandes: reduz antes de mandar (o Firebase aceita ~10 MB por gravação) ---------- */
  function shrinkCrest(dataUrl) {
    return new Promise((resolve) => {
      if (!dataUrl || dataUrl.length < 120000) return resolve(dataUrl);
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, CREST_MAX / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/png"));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  /* ---------- tela ---------- */
  function status(msg, kind) {
    const el = $("#dbStageStatus");
    el.hidden = !msg; el.className = "db-status" + (kind ? " " + kind : "");
    el.textContent = msg || "";
  }
  async function handleFiles(list) {
    status("Lendo arquivos…");
    try {
      const files = [];
      for (const f of Array.from(list)) {
        const name = f.webkitRelativePath || f.name;
        if (/\.zip$/i.test(f.name)) files.push(...(await readZip(f)));
        else if (/\.json$/i.test(f.name)) {
          if (/(^|\/)(node_modules|backups)\//i.test(name) || /(^|\/)package(-lock)?\.json$/i.test(name) || /\.corrupt-/.test(name)) continue;
          files.push({ name, text: await f.text() });
        }
      }
      const col = collect(files);
      if (!col.teams.size && !col.state) { staged = null; status("Não encontrei times nem estado nesses arquivos.", "err"); renderReview(); return; }
      staged = col;
      status(`Pronto: ${col.teams.size} time(s)${col.state ? " e o estado da partida" : ""} encontrados.`, "ok");
      renderReview();
    } catch (e) { staged = null; status(e.message || "Não consegui ler esses arquivos.", "err"); renderReview(); }
  }

  function renderReview() {
    $("#dbReviewEmpty").hidden = !!staged;
    const body = $("#dbReviewBody");
    body.hidden = !staged;
    if (!staged) { body.innerHTML = ""; return; }
    const st = staged.state || {};
    const players = [...staged.teams.values()].reduce((n, t) => n + (t.players || []).length, 0);
    const row = (key, label, detail, has) => `<label class="check-row"><input type="checkbox" class="rv-part" data-part="${key}" ${has ? "checked" : "disabled"}> <span><b>${label}</b><small>${detail}</small></span></label>`;
    body.innerHTML = `<div class="review-list">
      ${row("teams", "Times", `${staged.teams.size} time(s), ${players} jogador(es). Times com o mesmo nome do cadastro atual são substituídos.`, staged.teams.size > 0)}
      ${row("match", "Partida e informações", st.match ? "Escalação, placar, eventos e dados da transmissão (o relógio volta pausado)." : "Não veio no arquivo.", !!st.match)}
      ${row("art", "Aparência das artes e módulos", st.customization ? "Cores, tamanhos, estilos, posições e módulos ligados." : "Não veio no arquivo.", !!st.customization)}
      ${row("tables", "Classificação, outros jogos, arbitragem e estádio", st.league || st.others || st.officials || st.stadium ? "Tabela, jogos paralelos, árbitros e ficha do estádio (sem fotos)." : "Não veio no arquivo.", !!(st.league || st.others || st.officials || st.stadium))}
    </div>
    ${staged.warnings.length ? `<p class="muted small">${staged.warnings.map(escapeHtml).join(" ")}</p>` : ""}
    <div class="row-gap"><button class="btn btn-primary" id="dbImportBtn">${App.ico("upload")}Importar agora</button><button class="btn" id="dbCancelBtn">Cancelar</button></div>`;
  }

  $("#dbReviewBody").addEventListener("click", async (e) => {
    if (e.target.closest("#dbCancelBtn")) { staged = null; status(""); renderReview(); return; }
    if (!e.target.closest("#dbImportBtn") || !staged) return;
    const parts = {};
    $$(".rv-part", $("#dbReviewBody")).forEach((c) => { parts[c.dataset.part] = c.checked && !c.disabled; });
    if (!Object.values(parts).some(Boolean)) { App.toast("Marque pelo menos uma parte para importar.", "err"); return; }
    if (!(await App.confirm("Importar o que está marcado? Isso substitui os dados atuais dessas partes. Baixe uma cópia antes se quiser guardar o que existe agora.", { title: "Importar dados", okText: "Importar" }))) return;
    const btn = $("#dbImportBtn"); btn.disabled = true;
    const teams = [];
    for (const t of staged.teams.values()) teams.push({ ...t, crestDataUrl: await shrinkCrest(t.crestDataUrl) });
    socket.emit("engine:import", { teams, state: staged.state, parts }, (res) => {
      if (res && res.ok) {
        App.toast(`Importado: ${res.teams} time(s)${res.state ? " e dados da partida/arte" : ""}.`, "ok", 4200);
        staged = null; status(""); renderReview();
      } else { btn.disabled = false; App.toast((res && res.error) || "Não consegui importar.", "err", 5000); }
    });
  });

  const dz = $("#dropzone");
  ["dragenter", "dragover"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("over"); }));
  dz.addEventListener("drop", (e) => { if (e.dataTransfer && e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); });
  $("#dbFileInput").addEventListener("change", (e) => { handleFiles(e.target.files); e.target.value = ""; });
  $("#dbFolderInput").addEventListener("change", (e) => { handleFiles(e.target.files); e.target.value = ""; });

  /* ---------- exportar ---------- */
  $("#dbExportBtn").addEventListener("click", () => {
    const bundle = { format: FORMAT, appVersion: "placar-app-1.1.0", exportedAt: new Date().toISOString(), state: App.state, teams: App.teams };
    const blob = new Blob([JSON.stringify(bundle)], { type: "application/json" });
    const a = document.createElement("a");
    const d = new Date(), p = (n) => String(n).padStart(2, "0");
    a.href = URL.createObjectURL(blob); a.download = `backup-placar-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    App.toast("Cópia baixada.", "ok", 2400);
  });

  /* ---------- recomeçar ---------- */
  $("#dbResetBtn").addEventListener("click", async () => {
    if (!(await App.confirm("Apagar TODOS os times, a partida, a classificação e a personalização deste placar? Isso não tem volta — baixe uma cópia antes.", { title: "Apagar tudo", okText: "Apagar tudo", danger: true }))) return;
    socket.emit("engine:reset", (res) => App.toast(res && res.ok ? "Tudo apagado. Placar zerado." : "Não consegui apagar.", res && res.ok ? "ok" : "err"));
  });

  function render() {
    $("#dbPathLabel").textContent = window.PLACAR_PATH || "placar";
    $("#dbTeamsN").textContent = App.teams.length;
    $("#dbPlayersN").textContent = App.teams.reduce((n, t) => n + (t.players || []).length, 0);
    $("#dbEventsN").textContent = App.state ? App.state.match.events.length : 0;
  }
  App.registerPage("banco", { render });
})();
