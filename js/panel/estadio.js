/**
 * PARTIDA — ESTÁDIO (v6.1): dados opcionais + várias fotos (viram um slide na arte e a 1ª foto vai para o resumo).
 * As fotos são reduzidas aqui no painel (JPEG até 1600 px) antes de serem enviadas: ficam leves e abrem em qualquer lugar.
 */
(() => {
  const { $, $$, escapeHtml, socket } = App;
  if (!$("#stadiumCard")) return;

  const FIELDS = [
    ["name", "Nome", "Ex.: Estádio Municipal"], ["nickname", "Apelido", "Ex.: A Fortaleza"], ["location", "Onde fica", "Cidade — UF / bairro"],
    ["owner", "De quem é", "Prefeitura, clube…"], ["capacity", "Capacidade", "Ex.: 12.500"], ["inauguration", "Inauguração", "Ex.: 12/03/1975"],
    ["record", "Recorde de público", "Ex.: 14.203 (1998)"], ["surface", "Gramado", "Natural / sintético"], ["dimensions", "Campo (m)", "105 × 68"], ["attendance", "Público do jogo", "Se souber"],
  ];
  $("#stadiumGrid").innerHTML = FIELDS.map(([k, l, ph]) => `<div class="of-line sd-line" data-key="${k}"><label for="sd_${k}">${l}</label>
    <input type="text" id="sd_${k}" data-f="${k}" maxlength="90" placeholder="${escapeHtml(ph)}" autocomplete="off"></div>`).join("");

  function renderStadium() {
    const d = App.state.stadium;
    if (!d) return;
    $$("#stadiumGrid input").forEach((inp) => { if (document.activeElement !== inp && inp.value !== (d[inp.dataset.f] || "")) inp.value = d[inp.dataset.f] || ""; });
    const html = d.photos.map((p, i) => `<figure class="sdp" data-id="${p.id}"><img src="/stadium/photos/${encodeURIComponent(p.file)}" alt="Foto ${i + 1}">
      <figcaption>${i === 0 ? "<b>Capa</b>" : i + 1}</figcaption>
      <div class="sdp-act"><button class="icon-btn sm" data-act="left" title="Mover para trás"${i === 0 ? " disabled" : ""}>${App.ico("up")}</button><button class="icon-btn sm" data-act="right" title="Mover para frente"${i === d.photos.length - 1 ? " disabled" : ""}>${App.ico("down")}</button><button class="icon-btn sm danger" data-act="del" title="Remover foto">${App.ico("trash")}</button></div></figure>`).join("");
    const box = $("#stadiumPhotos");
    if (box._h !== html) { box.innerHTML = html; box._h = html; }
    $("#stadiumAddPhoto").hidden = true;
    $("#stadiumPhotoInfo").textContent = "Fotos do estádio não estão disponíveis no Placar App 1.0 (só os dados em texto).";
    const on = !!d.visible;
    const btn = $("#stadiumShowBtn");
    btn.classList.toggle("btn-danger", on); btn.classList.toggle("btn-primary", !on);
    btn.setAttribute("aria-pressed", on);
    btn.querySelector("span").textContent = on ? "Tirar estádio do ar" : "Mostrar estádio";
    $("#stadiumLivePill").hidden = !on;
    const filled = FIELDS.filter(([k]) => d[k]).length;
    $("#stadiumDetails").querySelector("summary").textContent = filled ? `Dados do estádio (${filled} preenchidos)` : "Dados do estádio";
  }
  $("#stadiumGrid").addEventListener("change", (e) => {
    const inp = e.target.closest("input[data-f]");
    if (inp) socket.emit("stadium:set", { [inp.dataset.f]: inp.value });
  });
  $("#stadiumShowBtn").addEventListener("click", () => socket.emit("stadium:setVisible", !App.state.stadium.visible));
  $("#stadiumClearBtn").addEventListener("click", async () => {
    if (await App.confirm("Apagar os dados e as fotos do estádio? (Dá para voltar atrás no botão de desfazer.)", { title: "Limpar estádio", okText: "Limpar", danger: true })) socket.emit("stadium:clear");
  });
  $("#stadiumPhotos").addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const id = b.closest(".sdp").dataset.id;
    if (b.dataset.act === "del") socket.emit("stadium:removePhoto", id);
    else socket.emit("stadium:movePhoto", { id, dir: b.dataset.act === "left" ? -1 : 1 });
  });

  /* ---- fotos: reduz para JPEG (máx. 1600 px) e envia ---- */
  function shrink(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 1600 / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        const g = c.getContext("2d");
        g.fillStyle = "#ffffff"; g.fillRect(0, 0, c.width, c.height);
        g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob((b) => (b ? resolve(b) : reject(new Error("Não consegui reduzir a foto."))), "image/jpeg", 0.86);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Não consegui abrir essa imagem (use JPG, PNG ou WebP).")); };
      img.src = url;
    });
  }
  $("#stadiumAddPhoto").addEventListener("click", () => $("#stadiumFile").click());
  $("#stadiumFile").addEventListener("change", async (e) => {
    const files = [...e.target.files];
    e.target.value = "";
    let room = 8 - App.state.stadium.photos.length;
    for (const f of files) {
      if (room <= 0) { App.toast("Limite de 8 fotos.", "err"); break; }
      try {
        const blob = await shrink(f);
        const r = await fetch("/api/stadium/photo", { method: "POST", headers: { "x-file-name": encodeURIComponent(f.name), "content-type": "image/jpeg" }, body: blob });
        const j = await r.json();
        if (!r.ok || j.error) throw new Error(j.error || "Falha ao enviar a foto.");
        socket.emit("stadium:addPhoto", { file: j.file, name: j.name });
        room--;
      } catch (err) { App.toast(err.message, "err", 4200); }
    }
  });

  App.renderStadium = renderStadium;
})();
