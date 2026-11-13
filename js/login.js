/**
 * LOGIN (Placar App 1.1): tela de entrada do painel. E-mail + senha; a sessão fica salva no aparelho.
 * As contas são criadas no Firebase Console (Authentication) — não há cadastro por aqui.
 */
(() => {
  if (!window.PLACAR_AUTH_READY) return;
  const auth = firebase.auth();
  const $ = (s) => document.querySelector(s);
  const gate = $("#loginGate");
  const msgs = {
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/wrong-password": "E-mail ou senha incorretos.",
    "auth/user-not-found": "E-mail ou senha incorretos.",
    "auth/invalid-email": "Esse e-mail não parece válido.",
    "auth/user-disabled": "Essa conta foi desativada no Firebase.",
    "auth/too-many-requests": "Muitas tentativas. Espere alguns minutos e tente de novo.",
    "auth/network-request-failed": "Sem conexão com a internet.",
    "auth/operation-not-allowed": "O login por e-mail e senha não está ativado no Firebase (Authentication → Sign-in method).",
  };
  const show = (mode, text) => {            // "check" | "form"
    gate.querySelector(".lg-check").hidden = mode !== "check";
    gate.querySelector("form").hidden = mode !== "form";
    const err = gate.querySelector(".lg-err"); err.hidden = !text; err.textContent = text || "";
  };
  let opened = false;
  auth.onAuthStateChanged((user) => {
    if (user) {
      window.PLACAR_USER = user;
      const label = document.getElementById("accountEmail"); if (label) label.textContent = user.email || "";
      if (!opened) { opened = true; document.documentElement.classList.remove("auth-locked"); window.__placarAuthResolve(user); }
    } else if (opened) { location.reload(); }          // saiu: volta para a tela de login
    else show("form");
  });
  const form = gate.querySelector("form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "Entrando…"; show("form");
    try { await auth.signInWithEmailAndPassword(form.email.value.trim(), form.password.value); }
    catch (err) { show("form", msgs[err.code] || "Não consegui entrar (" + (err.code || err.message) + ")."); form.password.value = ""; form.password.focus(); }
    btn.disabled = false; btn.textContent = "Entrar";
  });
  window.PLACAR_LOGOUT = () => auth.signOut();
  show("check");
})();
