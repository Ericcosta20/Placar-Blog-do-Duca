/**
 * RESUMO DA PARTIDA (v6.0): prévia + baixar PDF/TXT + copiar texto.
 * A prévia vem do mesmo modelo (motor do painel) que gera o TXT e a impressão/PDF, então o que você vê é o que sai no arquivo.
 */
(() => {
  const { $, $$, escapeHtml } = App;
  const page = $("#page-resumo");
  if (!page) return;
  let timer = null, reqId = 0;

  function query() {
    const q = new URLSearchParams();
    $$("[data-sum]", page).forEach((c) => { if (!c.checked) q.set(c.dataset.sum, "0"); });
    const t = $("#sumTitle").value.trim();
    if (t) q.set("title", t);
    const s = q.toString();
    return s ? "?" + s : "";
  }
  const crest = (src) => (src ? `<img src="${escapeHtml(src)}" alt="" style="height:34px;vertical-align:middle;margin:0 8px">` : "");
  const pl = (p) => `<b>${escapeHtml(p.number ?? "")}</b>${escapeHtml(p.name)}`;

  function html(sm) {
    const o = sm.opts, out = [];
    out.push(`<h2>${escapeHtml(sm.title)}</h2>`);
    out.push(`<div class="sp-sub">${[sm.date, sm.clockText].filter(Boolean).map(escapeHtml).join(" · ") || "&nbsp;"}</div>`);
    out.push(`<div class="sp-score"><span>${o.crests ? crest(sm.home.crest) : ""}${escapeHtml(sm.home.name)}</span><b>${sm.score.home} × ${sm.score.away}</b><span>${escapeHtml(sm.away.name)}${o.crests ? crest(sm.away.crest) : ""}</span></div>`);
    if (sm.pens) out.push(`<div class="sp-sub" style="text-align:center;margin-top:-8px">Pênaltis: <b>${sm.pens.home} × ${sm.pens.away}</b></div>`);
    if (o.stadium && sm.stadium) {
      const sd = sm.stadium;
      out.push(`<h3>Estádio</h3><div class="sp-stadium">${sd.photoUrl ? `<img src="${escapeHtml(sd.photoUrl)}" alt="">` : ""}<div>${sd.name ? `<b>${escapeHtml(sd.name)}</b>${sd.nickname ? ` <span class="sp-muted">(${escapeHtml(sd.nickname)})</span>` : ""}` : ""}<table>${sd.items.map((x) => `<tr><td class="min" style="width:150px">${escapeHtml(x.label)}</td><td>${escapeHtml(x.value)}</td></tr>`).join("")}</table></div></div>`);
    }
    if (o.officials && sm.officials.length) {
      out.push(`<h3>Arbitragem</h3><table>${sm.officials.map((x) => `<tr><td class="min" style="width:120px">${escapeHtml(x.role)}</td><td>${escapeHtml(x.name)}${x.from ? ` <span class="sp-muted">(${escapeHtml(x.from)})</span>` : ""}</td></tr>`).join("")}</table>`);
    }
    if (o.lineups) {
      const col = (t) => `<div><b>${escapeHtml(t.team)}</b><ul>${t.starters.map((p) => `<li>${pl(p)}${p.captain ? ' <span class="tag">C</span>' : ""}</li>`).join("") || '<li class="sp-muted">Escalação não definida</li>'}</ul>` +
        (o.bench && t.bench.length ? `<div class="sp-muted" style="margin-top:8px;font-size:11.5px;letter-spacing:.1em">RESERVAS</div><ul>${t.bench.map((p) => `<li class="sp-muted">${pl(p)}${p.entered ? ' <span class="tag int">entrou</span>' : ""}</li>`).join("")}</ul>` : "") + "</div>";
      out.push(`<h3>Escalações iniciais</h3><div class="sp-two">${col(sm.lineup.home)}${col(sm.lineup.away)}</div>`);
    }
    if (o.goals) {
      out.push(`<h3>Gols</h3>` + (sm.goals.length ? `<table>${sm.goals.map((g) => `<tr><td class="min">${escapeHtml(g.minute)}</td><td><b>${escapeHtml(g.team)}</b> — ${escapeHtml(g.player)}${g.kind === "penalty" ? ' <span class="tag">pênalti</span>' : g.kind === "own" ? ' <span class="tag">gol contra</span>' : ""}${g.annulled ? ` <span class="tag anul">anulado</span>${g.note ? " " + escapeHtml(g.note) : ""}` : ""}</td><td style="text-align:right;font-weight:800">${escapeHtml(g.score)}</td></tr>`).join("")}</table>` : `<div class="sp-muted">Sem gols.</div>`));
    }
    if (o.cards) {
      out.push(`<h3>Cartões</h3>` + (sm.cards.length ? `<table>${sm.cards.map((c) => `<tr><td class="min">${escapeHtml(c.minute)}</td><td><span class="tag" style="background:${c.type === "red" ? "#fee2e2;color:#991b1b" : "#fef3c7;color:#92400e"}">${c.type === "red" ? "vermelho" : "amarelo"}</span> <b>${escapeHtml(c.team)}</b> — ${escapeHtml(c.player)}</td></tr>`).join("")}</table>` : `<div class="sp-muted">Sem cartões.</div>`));
    }
    if (o.subs) {
      out.push(`<h3>Substituições · ${escapeHtml(sm.home.name)} ${sm.subCount.home}/5 · ${escapeHtml(sm.away.name)} ${sm.subCount.away}/5</h3>` + (sm.subs.length ? `<table>${sm.subs.map((s) => s.break
        ? `<tr class="sp-break"><td colspan="2">${escapeHtml(s.break)}</td></tr>`
        : `<tr><td class="min">${escapeHtml(s.minute)}</td><td><b>${escapeHtml(s.team)}</b> — sai <span style="color:#b91c1c">${escapeHtml(s.out.name)}</span> · entra <span style="color:#15803d">${escapeHtml(s.in.name)}</span></td></tr>`).join("")}</table>` : `<div class="sp-muted">Sem substituições.</div>`));
    }
    return out.join("");
  }

  const model = () => {
    const eng = window.__placarSummary;
    if (!eng) throw new Error("Motor ainda carregando.");
    return eng.build(Object.fromEntries(new URLSearchParams(query())));
  };
  function refresh() {
    try {
      const sm = model();
      $("#sumPreview").innerHTML = html(sm);
    } catch (e) {
      $("#sumPreview").innerHTML = `<div class="sp-muted">Não foi possível montar o resumo agora.</div>`;
    }
  }
  const later = () => { clearTimeout(timer); timer = setTimeout(refresh, 250); };
  /* v6.1 — as opções (título e itens marcados) ficam no estado do programa: assim entram no desfazer/refazer
     e continuam iguais em outro aparelho. O painel só reflete o que veio do servidor. */
  function syncFromState() {
    const sm = App.state && App.state.summary;
    if (!sm) return;
    $$("[data-sum]", page).forEach((c) => { c.checked = !sm.off.includes(c.dataset.sum); });
    const t = $("#sumTitle");
    if (document.activeElement !== t && t.value !== sm.title) t.value = sm.title;
  }
  page.addEventListener("change", (e) => {
    const c = e.target.closest("[data-sum]");
    if (c) App.socket.emit("summary:set", { key: c.dataset.sum, on: c.checked });
    later();
  });
  $("#sumTitle").addEventListener("input", () => { App.socket.emit("summary:set", { title: $("#sumTitle").value }); later(); });
  $("#sumRefreshBtn").addEventListener("click", refresh);
  const textOf = () => { const sm = model(); return window.__placarSummary.text(sm).replace(/^\uFEFF/, ""); };
  $("#sumCopyBtn").addEventListener("click", () => {
    try { App.copy(textOf().replace(/\r\n/g, "\n"), "Resumo copiado."); }
    catch (e) { App.toast("Não consegui copiar o resumo.", "err"); }
  });
  $("#sumTxtBtn").addEventListener("click", (e) => {
    e.preventDefault();
    try {
      const sm = model();
      const blob = new Blob(["\uFEFF" + window.__placarSummary.text(sm).replace(/^\uFEFF/, "")], { type: "text/plain;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = window.__placarSummary.fileBase(sm) + ".txt";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (err) { App.toast("Não consegui gerar o TXT.", "err"); }
  });
  /* PDF: abre uma página só com o resumo e chama a impressão — no celular/computador escolha "Salvar como PDF". */
  $("#sumPdfBtn").addEventListener("click", (e) => {
    e.preventDefault();
    try {
      const sm = model();
      const w = window.open("", "_blank");
      if (!w) { App.toast("O navegador bloqueou a janela. Permita pop-ups e tente de novo.", "err", 4500); return; }
      const sheets = [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => `<link rel="stylesheet" href="${l.href}">`).join("");
      w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(window.__placarSummary.fileBase(sm))}</title>${sheets}
        <style>body{background:#fff!important;color:#111!important;margin:0;padding:24px;font-family:system-ui,sans-serif}.sum-paper{max-width:760px;margin:0 auto}.sum-preview{max-height:none!important;overflow:visible!important}@media print{body{padding:0}}</style></head>
        <body><div class="sum-paper"><div id="sumPreview" class="sum-preview">${html(sm)}</div></div></body></html>`);
      w.document.close();
      w.onload = () => setTimeout(() => { w.focus(); w.print(); }, 350);
    } catch (err) { App.toast("Não consegui abrir o resumo para imprimir.", "err"); }
  });

  // atualiza sozinho enquanto a página está aberta e a partida muda (placar, eventos…)
  App.registerPage("resumo", { render: () => { syncFromState(); later(); }, onShow: () => { syncFromState(); refresh(); } });
})();
