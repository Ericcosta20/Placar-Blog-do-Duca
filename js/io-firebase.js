/**
 * io() das ARTES (Placar App 1.0) — no lugar do Socket.IO.
 * As artes continuam escutando "state:sync", "teams:sync", "clock:tick" e os efeitos (art:replay…),
 * só que agora esses eventos vêm do Firebase:
 *   placar/stateJson  -> state:sync        placar/teamsJson -> teams:sync
 *   placar/fx         -> efeitos de um disparo só (nunca disparam ao abrir/atualizar a página)
 *   o relógio é contado AQUI, localmente, a partir de { rodando, segundos, horário de início } do estado.
 * Dentro da prévia do painel (mesma aba/origem) a arte conversa direto com o motor do painel, sem rede.
 */
(function () {
  const PERIOD_BASE = { "1t": 0, "2t": 45, "p1": 90, "p2": 105 };
  const PERIOD_REG = { "1t": 45, "2t": 45, "p1": 15, "p2": 15 };
  const displayMinute = (sec, period) => {
    const m = Math.floor(sec / 60), base = PERIOD_BASE[period] ?? 0, reg = PERIOD_REG[period] ?? 45;
    return m <= reg ? String(base + m) : `${base + reg}+${m - reg}`;
  };
  const SOURCE_BY_SEG = { "": "escalacao", placar: "placar", eventos: "eventos", "linha-do-tempo": "linhaDoTempo", penaltis: "penaltis", "fim-de-jogo": "fimDeJogo", classificacao: "classificacao", informativos: "informativos" };
  const sourceOfPage = () => {
    const m = location.pathname.replace(/\/index\.html$/, "").replace(/\/+$/, "").match(/\/arte(?:\/([^/]+))?$/);
    return m ? (SOURCE_BY_SEG[m[1] || ""] || null) : null;
  };

  /* prévia dentro do painel: usa o motor da própria aba do painel (sem Firebase, sem rede) */
  let parentEngine = null;
  try { if (window.parent !== window && window.parent.__placarEngine) parentEngine = window.parent.__placarEngine; } catch (_) { /* outra origem */ }

  function makeFirebaseSocket(opts) {
    const handlers = {};
    const sock = {
      connected: false, id: "art_" + Math.random().toString(36).slice(2, 8),
      on(ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); return sock; },
      off(ev, fn) { handlers[ev] = (handlers[ev] || []).filter((f) => f !== fn); return sock; },
      emit() { return sock; },            // as artes não mandam nada para o painel
      disconnect() {},
    };
    const fire = (ev, ...a) => (handlers[ev] || []).slice().forEach((fn) => { try { fn(...a); } catch (e) { console.error("[arte:" + ev + "]", e); } });
    const db = window.PLACAR_DB, base = window.PLACAR_PATH || "placar";
    const ref = (p) => db.ref(base + (p ? "/" + p : ""));
    if (!db) { console.error("Firebase não carregou."); return sock; }

    let offset = 0, state = null;
    db.ref(".info/serverTimeOffset").on("value", (s) => { offset = Number(s.val()) || 0; });
    const serverNow = () => Date.now() + offset;

    db.ref(".info/connected").on("value", (s) => {
      const on = s.val() === true;
      if (on === sock.connected) return;
      sock.connected = on; fire(on ? "connect" : "disconnect");
      if (on && !opts.preview) {      // presença: aparece no Dashboard do painel
        const p = ref("presence/" + sock.id);
        p.onDisconnect().remove();
        p.set({ source: sourceOfPage(), at: firebase.database.ServerValue.TIMESTAMP });
      }
    });

    const tick = () => {
      if (!state) return;
      const c = state.match.clock;
      if (!c.running) return;
      const seconds = c.seconds + Math.floor((serverNow() - (c.runningSince || serverNow())) / 1000);
      fire("clock:tick", { seconds, addedTime: c.addedTime ?? null, period: c.period || "1t", displayMinute: displayMinute(seconds, c.period || "1t"), stoppageLabel: c.stoppageLabel || null });
    };
    setInterval(tick, 1000);

    ref("stateJson").on("value", (snap) => {
      const json = snap.val();
      if (!json) return;
      try { state = JSON.parse(json); } catch (_) { return; }
      fire("state:sync", state);
      tick();                           // não espera 1 s para acertar o relógio
    });
    ref("teamsJson").on("value", (snap) => {
      const json = snap.val();
      if (json == null) return;
      try { fire("teams:sync", JSON.parse(json)); } catch (_) { /* ignora */ }
    });

    // efeitos de um disparo só: a 1ª leitura (estado antigo do banco) é ignorada, e só vale o que for recente
    let firstFx = true, lastFx = null;
    ref("fx").on("value", (snap) => {
      const v = snap.val();
      if (firstFx) { firstFx = false; lastFx = v && v.id; return; }
      if (!v || v.id === lastFx) return;
      lastFx = v.id;
      if (Math.abs(serverNow() - (v.ts || 0)) > 15000) return;
      let args = []; try { args = JSON.parse(v.args || "[]"); } catch (_) { /* sem args */ }
      fire(v.ev, ...args);
    });
    return sock;
  }

  function makeLoopbackSocket(opts) {
    return parentEngine.connect({ query: opts.query || { kind: "arte" }, referer: location.origin + "/arte" + (sourceOfPage() ? "/" + ({ escalacao: "", placar: "placar", eventos: "eventos", linhaDoTempo: "linha-do-tempo", penaltis: "penaltis", fimDeJogo: "fim-de-jogo", classificacao: "classificacao", informativos: "informativos" })[sourceOfPage()] : "") + (opts.preview ? "?preview=1" : "") });
  }

  window.io = function (userOpts) {
    const preview = new URLSearchParams(location.search).get("preview") === "1";
    const opts = { ...(userOpts || {}), preview };
    return parentEngine ? makeLoopbackSocket(opts) : makeFirebaseSocket(opts);
  };
})();
