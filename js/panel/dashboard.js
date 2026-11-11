/** DASHBOARD (v4.0): checklist "pronto para transmitir", fontes do OBS e resumo. */
(() => {
  const $ = App.$;
  let overview = null;
  let info = null; // v5.0 — endereços do servidor (para abrir o painel no celular/tablet)

  function loadOverview() {
    const players = App.teams.reduce((n, t) => n + ((t.players || []).length), 0);
    overview = { teams: App.teams.length, players, backups: [] };
    info = { lan: [App.abs("/").replace(/index\.html.*$/, "").replace(/\/$/, "")] };
    if (App.currentPage === "dashboard") render();
  }

  function checklist() {
    const s = App.state;
    const items = [];
    const home = App.findTeam(s.match.home.teamId), away = App.findTeam(s.match.away.teamId);
    items.push({ ok: App.teams.length >= 2, text: `Times cadastrados (${App.teams.length})`, detail: App.teams.length >= 2 ? "" : "Cadastre pelo menos dois times.", go: "times" });
    items.push({ ok: !!home && !!away, text: "Mandante e visitante escolhidos", detail: home && away ? `${home.name} × ${away.name}` : "Escolha os dois times na aba Escalação.", go: "escalacao" });
    const hs = s.match.home.starterIds.length, as = s.match.away.starterIds.length;
    items.push({ ok: hs === 11 && as === 11, text: `Titulares marcados (${hs}/11 e ${as}/11)`, detail: hs === 11 && as === 11 ? "" : "Marque os 11 titulares de cada lado.", go: "escalacao" });
    items.push({ ok: !!(s.meta.competition || "").trim(), text: "Campeonato informado", detail: s.meta.competition || "Preencha em Configurações (aparece no placar).", go: "config" });
    const required = App.SOURCES.filter((x) => !x.optional);
    const connected = required.filter((x) => (App.conn.sources || {})[x.key] > 0).length;
    items.push({ ok: connected === required.length, warn: connected > 0 && connected < required.length, text: `Artes conectadas (${connected}/${required.length})`, detail: connected === required.length ? "" : "Adicione as fontes no ar — veja “Como configurar”.", go: connected === 0 ? "guia" : "dashboard" });
    items.push({ ok: App.connected, text: App.connected ? "Conectado ao Firebase" : "Sem conexão com o Firebase", detail: App.connected ? "Cada alteração já sobe para o banco de dados." : "Confira a internet deste aparelho.", go: "dashboard" });
    return items;
  }

  function render() {
    const s = App.state;
    if (!s) return;
    const items = checklist();
    const okCount = items.filter((i) => i.ok).length;
    const badge = $("#readyBadge");
    badge.textContent = `${okCount}/${items.length}`;
    badge.className = "badge " + (okCount === items.length ? "badge-ok" : okCount >= items.length - 2 ? "badge-warn" : "");
    $("#readyList").innerHTML = items.map((i) => `
      <li class="${i.ok ? "ok" : i.warn ? "warn" : "todo"}">
        <span class="chk">${App.ico(i.ok ? "check" : i.warn ? "warn" : "x")}</span>
        <span class="chk-text"><b>${App.escapeHtml(i.text)}</b>${i.detail ? `<small>${App.escapeHtml(i.detail)}</small>` : ""}</span>
        ${i.ok ? "" : `<button class="btn btn-sm" data-go="${i.go}">Resolver</button>`}
      </li>`).join("");

    $("#dashHome").textContent = App.teamLabel("home");
    $("#dashAway").textContent = App.teamLabel("away");
    $("#dashScore").textContent = `${s.match.score.home} × ${s.match.score.away}`;
    $("#dashClock").textContent = App.formatClock(s.match.clock.seconds);
    $("#dashPeriod").textContent = App.PERIOD_LABELS[s.match.clock.period] || "";
    const n = s.match.events.length;
    $("#dashEvents").textContent = `${n} evento${n === 1 ? "" : "s"}`;
    $("#dashCompetition").textContent = [s.meta.competition, s.meta.round].filter(Boolean).join(" — ");
    $("#dashLive").hidden = !s.match.clock.running;

    const counts = App.conn.sources || {};
    $("#sourceList").innerHTML = App.SOURCES.map((x) => {
      const n = counts[x.key] || 0;
      return `<div class="source-row">
        <span class="src-dot ${n ? "on" : ""}" title="${n ? "Conectada" : x.optional ? "Opcional" : "Aguardando"}"></span>
        <div class="src-info"><b>${x.name}</b><small>${x.hint}</small></div>
        <code class="src-url">${App.abs(x.path)}</code>
        <span class="badge ${n ? "badge-ok" : ""}">${n ? "Conectada" : x.optional ? "Opcional" : "Aguardando"}</span>
        <button class="btn btn-sm" data-copy="${App.abs(x.path)}">${App.ico("copy")}Copiar</button>
        <a class="btn btn-sm" href="${App.rel(x.path)}" target="_blank" rel="noopener">${App.ico("link")}Abrir</a>
      </div>`;
    }).join("");
    const live = App.conn.arte || 0;
    $("#dashConnHint").textContent = live ? `${live} arte(s) recebendo dados em tempo real` : "Nenhuma arte conectada ainda";

    // v5.0 — painel no celular/tablet
    if (info) {
      const urls = (info.lan || []).map((u) => u + "/");
      $("#lanBadge").textContent = "Pronto";
      $("#lanBadge").className = "badge badge-ok";
      $("#lanList").innerHTML = urls.map((u) => `<div class="source-row lan-row">
          <div class="src-info"><b>${App.escapeHtml(u)}</b><small>Painel de controle</small></div>
          <button class="btn btn-sm" data-copy="${App.escapeHtml(u)}">${App.ico("copy")}Copiar</button></div>`).join("");
      $("#lanHint").textContent = "Compartilhe o endereço só com quem for operar a transmissão.";
    }

    if (overview) {
      $("#dashTeams").textContent = overview.teams;
      $("#dashPlayers").textContent = overview.players;
      
    }
  }

  App.registerPage("dashboard", { render, onShow: loadOverview });
  App.on("status", () => { App.pages.dashboard.dirty = true; if (App.currentPage === "dashboard") App.renderPage("dashboard"); });
  App.on("teams", loadOverview);
  App.on("conn", () => { App.pages.dashboard.dirty = true; if (App.currentPage === "dashboard") App.renderPage("dashboard"); });
  App.on("tick", ({ seconds }) => { if (App.currentPage === "dashboard") $("#dashClock").textContent = App.formatClock(seconds); });
  App.refreshOverview = loadOverview;
})();
