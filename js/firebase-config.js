/**
 * FIREBASE (Placar App 1.0) — configuração única, usada pelo painel e por todas as artes.
 * O banco guarda o estado do placar em "placar/..." (ou "placar_<sala>/..." se o endereço tiver ?sala=nome).
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

if (window.firebase) {
  firebase.initializeApp(firebaseConfig);
  window.PLACAR_DB = firebase.database();
}
// "sala": permite mais de um placar ao mesmo tempo (ex.: ?sala=quadra2). Sem ela, usa "placar".
window.PLACAR_SALA = (new URLSearchParams(location.search).get("sala") || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30);
window.PLACAR_PATH = window.PLACAR_SALA ? "placar_" + window.PLACAR_SALA : "placar";
