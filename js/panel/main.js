/** INICIALIZAÇÃO DO PAINEL (v4.0) */
(() => {
  const saved = App.store.get("page", "dashboard");
  const start = App.pages[saved] ? saved : "dashboard";
  App.go(start);
  if (App.state) App.renderPage(App.currentPage);
  App.on("state", () => { /* primeira sincronização já renderiza a página ativa */ });
})();
