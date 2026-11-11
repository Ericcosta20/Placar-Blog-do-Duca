/** CONFIGURAÇÕES (v4.0): informações da partida e ações gerais. */
(() => {
  const { $, socket } = App;
  App.controls.bind($("#page-config"));
  function render() { App.controls.sync($("#page-config")); }
  $("#matchResetBtn").addEventListener("click", async () => {
    if (await App.confirm("Reiniciar placar, relógio, eventos e a escalação escolhida da partida atual? Os times cadastrados não são afetados.", { title: "Reiniciar partida", okText: "Reiniciar", danger: true })) {
      socket.emit("match:reset");
      App.toast("Partida reiniciada.", "ok");
    }
  });
  $("#resetLayoutBtn").addEventListener("click", () => { App.resetLayout(); App.toast("Layout do painel restaurado.", "ok"); });
  App.registerPage("config", { render });
})();
