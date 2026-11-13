/**
 * FIREBASE (Placar App 1.1) — configuração única, usada pelo painel e por todas as artes.
 * O banco guarda o estado do placar em "placar/..." (ou "placar_<sala>/..." se o endereço tiver ?sala=nome).
 * O painel (index.html) carrega também o Firebase Auth e só abre depois do login; as artes (/arte/...) NÃO usam login.
 */
const firebaseConfig = {
  apiKey: "AIzaSyC3j4qL7QVBW-ZptRBai0qVngm-aUiHV-w",
  authDomain: "placar-copa-empresa-2026.firebaseapp.com",
  databaseURL: "https://placar-copa-empresa-2026-default-rtdb.firebaseio.com",
  projectId: "placar-copa-empresa-2026",
  storageBucket: "placar-copa-empresa-2026.firebasestorage.app",
  messagingSenderId: "787628954723",
  appId: "1:787628954723:web:7ff996dca951e15dce1456"
};

if (window.firebase) firebase.initializeApp(firebaseConfig);
// a conexão com o banco só é aberta quando alguém usa PLACAR_DB (prévias dentro do painel reaproveitam a do painel)
let _placarDb = null;
Object.defineProperty(window, "PLACAR_DB", { get() { if (!_placarDb && window.firebase) _placarDb = firebase.database(); return _placarDb; } });

// "sala": permite mais de um placar ao mesmo tempo (ex.: ?sala=quadra2). Sem ela, usa "placar".
window.PLACAR_SALA = (new URLSearchParams(location.search).get("sala") || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30);
window.PLACAR_PATH = window.PLACAR_SALA ? "placar_" + window.PLACAR_SALA : "placar";

// Login: só existe se a página carregou o SDK de autenticação (apenas o painel). O motor espera esta promessa.
window.PLACAR_AUTH_READY = null;
if (window.firebase && firebase.auth) {
  document.documentElement.classList.add("auth-locked");
  window.PLACAR_AUTH_READY = new Promise((resolve) => { window.__placarAuthResolve = resolve; });
}
