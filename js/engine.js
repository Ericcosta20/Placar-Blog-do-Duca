/* Placar App 1.1 — motor (gerado por build-engine.js a partir de engine-src/). Não edite este arquivo. */
(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };

  // engine-src/shims/path.js
  var require_path = __commonJS({
    "engine-src/shims/path.js"(exports, module) {
      function normalize(p) {
        const abs = p.startsWith("/");
        const out = [];
        for (const seg of p.split("/")) {
          if (!seg || seg === ".") continue;
          if (seg === "..") out.pop();
          else out.push(seg);
        }
        return (abs ? "/" : "") + out.join("/");
      }
      var join = (...a) => normalize(a.filter(Boolean).join("/")) || ".";
      var resolve = (...a) => {
        let r = "";
        for (const x of a) r = x.startsWith("/") ? x : r + "/" + x;
        return normalize(r) || "/";
      };
      var basename = (p, ext) => {
        let b = p.split("/").filter(Boolean).pop() || "";
        if (ext && b.endsWith(ext)) b = b.slice(0, -ext.length);
        return b;
      };
      var extname = (p) => {
        const b = basename(p);
        const i = b.lastIndexOf(".");
        return i > 0 ? b.slice(i) : "";
      };
      var dirname = (p) => {
        const parts = p.split("/");
        parts.pop();
        return parts.join("/") || "/";
      };
      module.exports = { join, resolve, basename, extname, dirname, sep: "/", normalize };
    }
  });

  // engine-src/shims/fs.js
  var require_fs = __commonJS({
    "engine-src/shims/fs.js"(exports) {
      var path = require_path();
      var files = /* @__PURE__ */ new Map();
      var dirs = /* @__PURE__ */ new Set(["/"]);
      var err = (code, p) => Object.assign(new Error(`${code}: ${p}`), { code });
      var n = (p) => path.resolve(String(p));
      exports.existsSync = (p) => files.has(n(p)) || dirs.has(n(p));
      exports.mkdirSync = (p) => {
        let cur = "";
        for (const s of n(p).split("/").filter(Boolean)) {
          cur += "/" + s;
          dirs.add(cur);
        }
      };
      exports.readFileSync = (p, enc) => {
        const v = files.get(n(p));
        if (v === void 0) throw err("ENOENT", p);
        return v;
      };
      exports.writeFileSync = (p, data) => {
        files.set(n(p), typeof data === "string" ? data : String(data));
      };
      exports.writeFile = (p, data, cb) => {
        try {
          exports.writeFileSync(p, data);
          cb && cb(null);
        } catch (e) {
          cb && cb(e);
        }
      };
      exports.renameSync = (a, b) => {
        const v = files.get(n(a));
        if (v === void 0) throw err("ENOENT", a);
        files.delete(n(a));
        files.set(n(b), v);
      };
      exports.rename = (a, b, cb) => {
        try {
          exports.renameSync(a, b);
          cb && cb(null);
        } catch (e) {
          cb && cb(e);
        }
      };
      exports.copyFileSync = (a, b) => {
        const v = files.get(n(a));
        if (v === void 0) throw err("ENOENT", a);
        files.set(n(b), v);
      };
      exports.unlinkSync = (p) => {
        if (!files.delete(n(p))) throw err("ENOENT", p);
      };
      exports.readdirSync = (p) => {
        const base = n(p) === "/" ? "/" : n(p) + "/";
        const out = /* @__PURE__ */ new Set();
        for (const f of files.keys()) if (f.startsWith(base)) out.add(f.slice(base.length).split("/")[0]);
        return [...out];
      };
      exports.statSync = (p) => {
        const v = files.get(n(p));
        if (v === void 0) throw err("ENOENT", p);
        return { size: v.length, isFile: () => true };
      };
      exports.__files = files;
    }
  });

  // engine-src/server/stadium.js
  var require_stadium = __commonJS({
    "engine-src/server/stadium.js"(exports, module) {
      var fs2 = require_fs();
      var path = require_path();
      var DATA_DIR = path.join("/app/server", "..", "data");
      var DIR = path.join(DATA_DIR, "stadium");
      var MAX_PHOTOS = 8;
      var MAX_BYTES = 9 * 1024 * 1024;
      var FIELDS = {
        name: 70,
        nickname: 50,
        location: 90,
        owner: 70,
        capacity: 20,
        inauguration: 30,
        record: 60,
        surface: 40,
        dimensions: 20,
        attendance: 20
      };
      var str = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
      var uid = () => "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      function getDefaultStadium() {
        const s = { visible: false, photos: [] };
        Object.keys(FIELDS).forEach((k) => {
          s[k] = "";
        });
        return s;
      }
      function ensureDir() {
        fs2.mkdirSync(DIR, { recursive: true });
      }
      function normalizeStadium(raw) {
        const r = raw && typeof raw === "object" ? raw : {};
        const out = getDefaultStadium();
        out.visible = !!r.visible;
        Object.keys(FIELDS).forEach((k) => {
          out[k] = str(r[k], FIELDS[k]);
        });
        out.photos = (Array.isArray(r.photos) ? r.photos : []).slice(0, MAX_PHOTOS).map((p) => ({
          id: str(p && p.id, 20) || uid(),
          file: path.basename(str(p && p.file, 80)),
          name: str(p && p.name, 60)
        })).filter((p) => /\.(jpe?g|png)$/i.test(p.file));
        return out;
      }
      function savePhoto(buffer, contentType) {
        if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error("Arquivo vazio.");
        if (buffer.length > MAX_BYTES) throw new Error(`Foto grande demais (m\xE1ximo ${Math.round(MAX_BYTES / 1048576)} MB).`);
        const isPng = buffer.slice(0, 4).equals(Buffer.from([137, 80, 78, 71]));
        const isJpg = buffer[0] === 255 && buffer[1] === 216;
        if (!isPng && !isJpg) throw new Error("Use uma foto JPG ou PNG.");
        ensureDir();
        const file = `${uid()}${isPng ? ".png" : ".jpg"}`;
        fs2.writeFileSync(path.join(DIR, file), buffer);
        return file;
      }
      function photoPath(file) {
        const f = path.basename(String(file || ""));
        const p = path.join(DIR, f);
        return /\.(jpe?g|png)$/i.test(f) && fs2.existsSync(p) ? p : null;
      }
      function deleteFile(file) {
        const p = photoPath(file);
        if (p) {
          try {
            fs2.unlinkSync(p);
          } catch (_) {
          }
        }
      }
      function pruneUnused(state) {
        try {
          ensureDir();
          const keep = new Set(state.stadium.photos.map((p) => p.file));
          fs2.readdirSync(DIR).forEach((f) => {
            if (!keep.has(f) && /\.(jpe?g|png)$/i.test(f)) deleteFile(f);
          });
        } catch (_) {
        }
      }
      function register(socket, { S, commit }) {
        const D = () => S().stadium;
        socket.on("stadium:set", (patch = {}) => {
          if (!patch || typeof patch !== "object") return;
          const d = D();
          Object.keys(FIELDS).forEach((k) => {
            if (k in patch) d[k] = str(patch[k], FIELDS[k]);
          });
          commit();
        });
        socket.on("stadium:setVisible", (v) => {
          D().visible = !!v;
          commit();
        });
        socket.on("stadium:addPhoto", ({ file, name } = {}) => {
          const d = D();
          if (d.photos.length >= MAX_PHOTOS || !photoPath(file)) return;
          d.photos.push({ id: uid(), file: path.basename(file), name: str(name, 60) });
          commit();
        });
        socket.on("stadium:removePhoto", (id) => {
          const d = D();
          const p = d.photos.find((x) => x.id === id);
          if (!p) return;
          d.photos = d.photos.filter((x) => x.id !== id);
          commit();
        });
        socket.on("stadium:movePhoto", ({ id, dir } = {}) => {
          const a = D().photos, i = a.findIndex((x) => x.id === id), j = i + (Number(dir) < 0 ? -1 : 1);
          if (i < 0 || j < 0 || j >= a.length) return;
          [a[i], a[j]] = [a[j], a[i]];
          commit();
        });
        socket.on("stadium:clear", () => {
          const v = D().visible;
          S().stadium = { ...getDefaultStadium(), visible: v };
          commit();
        });
      }
      module.exports = { DIR, FIELDS, MAX_PHOTOS, getDefaultStadium, normalizeStadium, savePhoto, photoPath, deleteFile, pruneUnused, ensureDir, register };
    }
  });

  // engine-src/server/defaultState.js
  var require_defaultState = __commonJS({
    "engine-src/server/defaultState.js"(exports, module) {
      function getDefaultMatchSide() {
        return {
          teamId: null,
          starterIds: [],
          // ids dos jogadores titulares (ordem = ordem de escalação), até 11
          captainId: null,
          // v5.0 — reservas (banco) escolhidos para esta partida, até 15. Aparecem na arte
          // quando modules.reservasHome / reservasAway (v5.1, por time) estiver ligado.
          benchIds: [],
          // Estatísticas por jogador NESTA partida (não altera o cadastro do time)
          // { [playerId]: { yellowCards, redCards, goals, substituted, enteredGame } }
          lineupStats: {}
        };
      }
      function getDefaultShootout() {
        return {
          visible: false,
          // aparece no OBS (/arte/penaltis)
          firstSide: "home",
          // quem bate primeiro
          rounds: 5,
          // cobranças "regulares" por time (depois disso: morte súbita)
          kicks: [],
          finished: false,
          winner: null
          // "home" | "away" | null
        };
      }
      function getDefaultFinalCard() {
        return { visible: false };
      }
      var DEFAULT_CLUBS = [
        ["Flamengo", "FLA"],
        ["Palmeiras", "PAL"],
        ["Cruzeiro", "CRU"],
        ["Mirassol", "MIR"],
        ["Fluminense", "FLU"],
        ["Botafogo", "BOT"],
        ["Bahia", "BAH"],
        ["S\xE3o Paulo", "SAO"],
        ["Gr\xEAmio", "GRE"],
        ["Bragantino", "RBB"],
        ["Atl\xE9tico-MG", "CAM"],
        ["Santos", "SAN"],
        ["Corinthians", "COR"],
        ["Vasco", "VAS"],
        ["Vit\xF3ria", "VIT"],
        ["Internacional", "INT"],
        ["Coritiba", "CFC"],
        ["Athletico-PR", "CAP"],
        ["Chapecoense", "CHA"],
        ["Remo", "REM"]
      ];
      function getDefaultZones() {
        return [
          { id: "z1", label: "Campe\xE3o", from: 1, to: 1, color: "#facc15", enabled: true },
          { id: "z2", label: "Libertadores \u2014 fase de grupos", from: 2, to: 4, color: "#22c55e", enabled: true },
          { id: "z3", label: "Pr\xE9-Libertadores", from: 5, to: 6, color: "#38bdf8", enabled: true },
          { id: "z4", label: "Sul-Americana", from: 7, to: 12, color: "#f97316", enabled: true },
          { id: "z5", label: "Rebaixamento (Z4)", from: 17, to: 20, color: "#ef4444", enabled: true }
        ];
      }
      function getDefaultLeague() {
        return {
          name: "BRASILEIR\xC3O S\xC9RIE A",
          round: "",
          // rodada a que a tabela se refere (texto livre: "31")
          visible: false,
          // aparece no OBS (/arte/informativos)
          mode: "compact",
          // 'compact' (posição, time, pontos) | 'complete' (+ jogos, V, E, D, SG e legenda)
          liveProjection: true,
          // soma ao vivo o resultado dos jogos em andamento (outros jogos)
          includeMain: true,
          // inclui também o jogo que está sendo transmitido (se os times estiverem na tabela)
          teams: DEFAULT_CLUBS.map(([name, short], i) => ({
            id: "c" + (i + 1),
            name,
            short,
            teamId: null,
            pts: 0,
            j: null,
            v: null,
            e: null,
            d: null,
            gp: null,
            gc: null
          })),
          zones: getDefaultZones(),
          lastCommit: null
          // para desfazer o último "Lançar na tabela"
        };
      }
      function getDefaultOthers() {
        return { visible: false, games: [] };
      }
      function getDefaultOfficials() {
        const o = () => ({ name: "", from: "" });
        return {
          refVisible: false,
          varVisible: false,
          main: o(),
          ass1: o(),
          ass2: o(),
          fourth: o(),
          var: o(),
          avar1: o(),
          avar2: o()
        };
      }
      function getDefaultState() {
        return {
          // v5.0 — visuais salvos (3 vagas). Cada vaga: null ou { name, savedAt, customization }.
          visuals: [null, null, null],
          // v6.0 — tabela de classificação, outros jogos e arbitragem (ficam FORA da partida: não somem ao reiniciar o jogo,
          // exceto a arbitragem, que é limpa em "Reiniciar partida")
          league: getDefaultLeague(),
          others: getDefaultOthers(),
          officials: getDefaultOfficials(),
          // v6.1 — estádio (informações + fotos em data/stadium). Não some ao reiniciar a partida.
          stadium: require_stadium().getDefaultStadium(),
          // v6.1 — opções do resumo da partida (título e o que fica de fora). Ficam no estado para entrarem no desfazer.
          summary: { title: "", off: [] },
          // Metadados gerais da transmissão (usados no Dashboard)
          meta: {
            gameName: "",
            competition: "",
            round: "",
            matchDate: ""
          },
          match: {
            home: getDefaultMatchSide(),
            away: getDefaultMatchSide(),
            score: { home: 0, away: 0 },
            clock: {
              seconds: 0,
              // tempo decorrido, em segundos — nunca convertido para horas
              running: false,
              // Período atual da partida (informado pelo operador, não controla o relógio)
              // '1t' | '2t' | 'p1' | 'p2'
              period: "1t",
              // Acréscimo informado pelo operador (número inteiro, minutos). null = sem acréscimo exibido.
              // NÃO controla nem limita o relógio — é puramente visual/informativo.
              addedTime: null,
              // COMPAT v3.0: stoppageLabel ainda aceito pelo servidor, mas depreciado.
              // Na v3.1 usa-se addedTime (numérico) + period. Mantido para merge com
              // estados salvos na v3.0 não quebrarem na inicialização.
              stoppageLabel: null,
              // timestamp (epoch ms) de quando o relógio foi iniciado/retomado pela última vez;
              // usado pelo servidor para calcular o tempo decorrido sem depender do relógio do cliente
              runningSince: null
            },
            // Histórico de eventos da partida (ordem cronológica, exibição reversa)
            // { id, minute, secondsElapsed, period, addedTime, showOnAir,
            //   type: 'goal'|'yellow'|'red'|'sub', side: 'home'|'away',
            //   annulled: true (v5.0 — gol anulado; continua no histórico mas não conta), annulNote,
            //   playerId, playerName, secondaryPlayerId, secondaryPlayerName, note,
            //   goalType: 'normal'|'penalty'|'own' (só para gols — v4.1) }
            // secondsElapsed e period são registrados automaticamente no momento do evento
            // e permitem construir uma linha do tempo futura sem reprocessar.
            events: [],
            // v4.1 — rótulo no lugar do relógio: null | "intervalo" | "fim"
            // (limpo automaticamente quando o relógio volta a correr ou o período muda)
            statusLabel: null,
            // v4.1 — disputa de pênaltis (módulo à parte; NÃO altera o placar da partida)
            shootout: getDefaultShootout(),
            // v5.0 — cartão de fim de jogo (placar final + autores dos gols)
            finalCard: getDefaultFinalCard()
          },
          // Visibilidade independente de cada módulo na arte (Browser Source)
          // Alterado em tempo real pela aba "Arte" -> reflete instantaneamente no
          // OBS, sem precisar atualizar a página do Browser Source.
          modules: {
            escalacao: true,
            placar: true,
            relogio: true,
            eventos: true,
            campeonato: true,
            nomesTimes: true,
            reservasHome: false,
            // v5.1 — reservas do MANDANTE no lugar dos titulares (cada time liga/desliga sozinho)
            reservasAway: false
            // v5.1 — reservas do VISITANTE
          },
          customization: {
            // Tipografia
            fontFamily: "Montserrat",
            nameSize: 16,
            numberSize: 16,
            teamNameSize: 24,
            // Espaçamento e dimensões das linhas
            lineSpacing: 4,
            rowHeight: 40,
            innerPadding: 20,
            borderRadius: 14,
            // Dimensões gerais da arte
            artWidth: 560,
            marginTop: 40,
            marginLeft: 40,
            // Escudo e barra superior
            crestSize: 44,
            crestGap: 14,
            topBarThickness: 62,
            dividerThickness: 3,
            // Transparência / opacidade
            bgTransparency: 0,
            bgOpacity: 100,
            dividerOpacity: 85,
            // Efeitos (checkboxes)
            effects: {
              shadow: true,
              outline: false,
              glow: false,
              translucentBg: false,
              separators: true,
              gradient: true
            },
            // ===== v5.0 — ESCALAÇÃO: marcações, substituição, reservas e entrada animada =====
            markerSize: 100,
            // % — tamanho dos ícones de gol/cartão ao lado do nome
            subAnimationMs: 5e3,
            // duração da animação de substituição na linha do jogador
            scorerBlink: true,
            // o nome de quem fez o gol pisca por alguns segundos
            benchTitle: "RESERVAS",
            // título do painel de reservas
            // ===== v5.1 =====
            benchMode: "swap",
            // 'swap' = reservas ocupam o lugar dos titulares (titulares deslizam pro lado) | 'below' = painel embaixo (v5.0)
            benchPageMs: 4e3,
            // quanto tempo cada "página" de reservas fica parada antes de subir (só quando há mais reservas que linhas)
            subMarker: true,
            // ícone de substituição na linha de quem entrou (junto com gol e cartões)
            subMarkerShowOut: true,
            // mostra também o número de quem saiu ao lado do ícone
            // ===== v5.2 — SONS (tocados pela Browser Source /arte/audio) =====
            // Campos simples de propósito: dá para ajustar tudo pelo mesmo settings:patch do resto.
            // Src = "preset:<id>" (sons sugeridos) | "user:<arquivo>" (data/audio) | "" (nenhum).
            audio: {
              autoEnabled: true,
              // chave geral dos sons automáticos (gol, substituição, cartões, gol anulado)
              masterVolume: 80,
              // % — volume geral (vale também para os botões de soundpad)
              golOn: true,
              golSrc: "preset:gol-buzina-torcida",
              golVol: 100,
              subOn: true,
              subSrc: "preset:sub-sino-duplo",
              subVol: 90,
              yellowOn: true,
              yellowSrc: "preset:amarelo-apito",
              yellowVol: 90,
              redOn: true,
              redSrc: "preset:vermelho-apito-longo",
              redVol: 90,
              annulOn: true,
              annulSrc: "preset:anulado-buzina-descendente",
              annulVol: 90,
              // botões de soundpad (aparecem na aba Partida) — nome, som e volume de cada um
              pad1Label: "Buzina",
              pad1Src: "preset:buzina",
              pad1Vol: 90,
              pad2Label: "Torcida",
              pad2Src: "preset:torcida",
              pad2Vol: 90,
              pad3Label: "Apito final",
              pad3Src: "preset:apito-final",
              pad3Vol: 90,
              pad4Label: "Palmas",
              pad4Src: "preset:palmas",
              pad4Vol: 100,
              pad5Label: "Sirene",
              pad5Src: "preset:sirene",
              pad5Vol: 80,
              pad6Label: "Tambor",
              pad6Src: "preset:tambor",
              pad6Vol: 90,
              pad7Label: "Suspense",
              pad7Src: "preset:suspense",
              pad7Vol: 90,
              pad8Label: "Vinheta",
              pad8Src: "preset:vinheta",
              pad8Vol: 90
            },
            introStyle: "cascade",
            // entrada ao ligar o módulo: 'cascade' | 'slide' | 'fade' | 'none'
            outroEnabled: true,
            // saída animada ao desligar o módulo
            // ===== PERSONALIZAÇÃO EXCLUSIVA DO PLACAR (v2.2) =====
            // Independente da personalização da escalação acima — controla só a
            // Browser Source /arte/placar. Tudo aqui é aplicado em tempo real.
            placar: {
              fontFamily: "Montserrat",
              nameSize: 17,
              // px — tamanho BASE do nome do time (reduz automaticamente se não couber)
              scoreSize: 30,
              // px — tamanho do placar (ex: "2 × 1")
              clockSize: 14,
              // px — tamanho do relógio
              boxWidth: 230,
              // px — largura fixa de CADA lado (mandante/visitante)
              borderRadius: 10,
              // px
              bgColor: "#0c0f14",
              bgOpacity: 100,
              // %
              accentColor: "#0057ff",
              // cor de fundo da caixa central (placar/relógio)
              textColor: "#f5f6f8",
              useTeamColors: false,
              // se true, cada lado usa a cor principal do time cadastrado
              style: "broadcast",
              // 'broadcast' (v4.1) | 'bar' (retangular clássico) | 'card' (cantos arredondados + sombra maior)
              position: "top-center",
              // 'top-left' | 'top-center' | 'top-right'
              pulseOnGoal: true,
              // pequena animação de destaque quando o placar muda
              // v3.2 — personalização do texto do campeonato (ex: "BRASILEIRÃO"),
              // que antes era fixo e praticamente invisível na transmissão.
              // Visibilidade continua controlada por modules.campeonato (mostrar/ocultar).
              competitionTextOverride: "",
              // vazio = usa meta.competition (Configurações); se preenchido, sobrescreve
              competitionFontFamily: "Montserrat",
              competitionFontSize: 15,
              competitionFontWeight: 700,
              competitionColor: "#dbe4ff",
              competitionOpacity: 100,
              competitionSpacing: 6,
              // px — espaço entre o texto e o placar
              // v4.1 — "GOL!" cobre o nome do time que marcou (só em gols lançados como evento)
              goalFlashEnabled: true,
              goalFlashText: "GOL",
              goalFlashColor: "#22c55e",
              // cor de fundo do aviso
              goalFlashTextColor: "#04210e",
              // cor do texto do aviso
              goalFlashUseTeamColor: false,
              // true = usa a cor principal do time que marcou
              goalFlashDurationMs: 4e3,
              // quanto tempo o aviso fica na tela
              goalFlashShowScorer: true,
              // mostra "Fulano 27'" em letra menor
              // v4.1 — resultado dos pênaltis ao lado do placar: (4) 1 × 1 (3)
              showShootoutResult: true,
              // ===== v5.0 =====
              compact: false,
              // placar compacto: só a sigla de cada time (botão na aba Partida)
              compactBoxWidth: 190,
              // px — largura de cada lado no modo compacto
              crestScale: 86,
              // % — escudo ocupa essa parte da altura do placar
              showCards: true,
              // cartões amarelos/vermelhos de cada time ao lado do nome
              cardScale: 100,
              // % — tamanho dos cartões no placar
              subFlashEnabled: true,
              // aviso de substituição no placar (números de quem entra e sai)
              subFlashDurationMs: 5e3,
              subFlashShowNames: true,
              introStyle: "sequence",
              // entrada ao ligar o placar: 'sequence' | 'slide' | 'fade' | 'none'
              outroEnabled: true,
              // saída animada ao desligar o placar
              // ===== v5.1 =====
              addedTimeAnim: "destaque",
              // acréscimo: 'destaque' (entra com brilho e fica em pílula colorida) | 'entrada' (só a animação de entrada) | 'off'
              addedTimeColor: "#facc15",
              // cor da pílula/brilho do acréscimo
              goalExpandsCompact: true,
              // v5.2 — ao lançar um gol, o placar compacto abre sozinho no modo completo (e fica assim)
              // ===== v6.0 — contador de substituições (5 marcadores por time) =====
              subCounterMode: "event",
              // 'event' (aparece a cada substituição) | 'always' (fica no ar depois da 1ª) | 'off'
              subCounterMax: 5,
              // substituições permitidas por time
              subCounterExtraMs: 1500
              // quanto tempo fica na tela depois do aviso de substituição (modo 'event')
            },
            // ===== PERSONALIZAÇÃO DA FONTE DE EVENTOS ANIMADOS (v3.0/v3.2) =====
            // Browser Source própria (/arte/eventos), separada do placar. Não é
            // uma lista: cada evento novo aparece como uma notificação animada e
            // some sozinha depois de "durationMs" milissegundos.
            eventos: {
              fontFamily: "Montserrat",
              textSize: 20,
              durationMs: 4500,
              // quanto tempo cada notificação FICA NA TELA
              // v3.2: estilos ampliados — 'slide'|'fade'|'bounce'|'sweep'|'stagger'|'reveal'|'pulse'|'wipe'
              animation: "slide",
              animationDurationMs: 500,
              // v3.2: duração da transição de entrada/saída
              staggerDelayMs: 80,
              // v3.2: atraso entre ícone/evento/jogador/time (estilo "stagger")
              direction: "ltr",
              // v3.2: 'ltr' (esquerda→direita) | 'rtl' (direita→esquerda)
              position: "top-center",
              // 'top-left' | 'top-center' | 'top-right' | 'bottom-center'
              bgColor: "#0c0f14",
              bgOpacity: 92,
              textColor: "#f5f6f8",
              useTeamColors: true,
              // barra lateral da notificação usa a cor do time do evento
              goalColor: "#22c55e",
              yellowColor: "#eab308",
              redColor: "#ef4444",
              subColor: "#0ea5e9",
              // v4.1 — substituição mostra ENTRA (verde) e SAI (vermelho) em linhas separadas
              subInColor: "#22c55e",
              subOutColor: "#ef4444"
            },
            // ===== PERSONALIZAÇÃO DA LINHA DO TEMPO (v3.2) =====
            // Browser Source própria (/arte/linha-do-tempo) — PERMANENTE, diferente
            // da notificação animada de /arte/eventos. Fica ligada durante toda a
            // transmissão mostrando o histórico cronológico. Alimentada pelos
            // mesmos match.events (uma única fonte de verdade).
            linhaDoTempo: {
              enabled: true,
              position: "top-right",
              // 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
              maxEvents: 6,
              // quantidade máxima exibida simultaneamente
              fontSize: 14,
              iconSize: 14,
              spacing: 6,
              // espaçamento vertical entre linhas
              rowHeight: 28,
              bgColor: "#0c0f14",
              bgOpacity: 80,
              textColor: "#f5f6f8",
              showTeam: true,
              showMinute: true,
              showIcon: true
            },
            // ===== PERSONALIZAÇÃO DA DISPUTA DE PÊNALTIS (v4.1) =====
            // Browser Source própria (/arte/penaltis). Só aparece no OBS quando você
            // clica em "Mostrar no OBS" na aba Pênaltis do painel.
            penaltis: {
              fontFamily: "Montserrat",
              position: "bottom-left",
              // 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
              title: "P\xCANALTIS",
              nameSize: 20,
              squareSize: 34,
              borderRadius: 12,
              bgColor: "#0c0f14",
              bgOpacity: 94,
              accentColor: "#0057ff",
              textColor: "#f5f6f8",
              goalColor: "#22c55e",
              missColor: "#ef4444",
              pendingColor: "#2a3140",
              useTeamColors: true,
              // faixa lateral de cada time na cor dele
              showCrest: true,
              showShooter: true,
              // linha "Última cobrança: Fulano — GOL"
              introStyle: "classic",
              // v6.1 — entrada do cartão (mesmas opções do fim de jogo)
              outroStyle: "classic",
              // v6.1 — saída do cartão
              kickAlert: true,
              // v6.1 — aviso estiloso a cada cobrança (GOL! / PERDEU!)
              kickAlertStyle: "faixa",
              // faixa | carimbo | explosao | cortina | brilho
              kickAlertSeconds: 3,
              // quanto tempo o aviso fica na tela
              kickAlertGoalText: "GOL!",
              kickAlertMissText: "PERDEU!",
              // ex.: PERDEU! / DEFENDEU! / PRA FORA!
              kickAlertOnlyGoals: false
              // true = só avisa quando é gol
            },
            // ===== v6.0 — INFORMATIVOS (/arte/informativos): classificação, outros jogos, arbitragem e VAR =====
            // followPlacar = true usa as cores e a fonte do placar (paleta da transmissão); false usa as cores próprias abaixo.
            classificacao: {
              followPlacar: true,
              fontFamily: "Montserrat",
              position: "center-right",
              // 9 posições (como os pênaltis)
              marginX: 40,
              marginY: 40,
              rowHeight: 36,
              fontSize: 18,
              widthCompact: 400,
              widthComplete: 760,
              borderRadius: 14,
              bgColor: "#0c0f14",
              bgOpacity: 94,
              accentColor: "#0057ff",
              textColor: "#f5f6f8",
              mainColor: "#0057ff",
              // cor do destaque do jogo que está sendo transmitido
              showCrests: true,
              // escudos (só times ligados ao cadastro de Times)
              compactShowName: false,
              // modo compacto: false = sigla, true = nome do time
              showZoneStripe: true,
              // faixa colorida da zona na lateral da linha
              showLegend: true,
              // legenda das faixas (modo completo)
              showDelta: true,
              // setinha de subiu/desceu (projeção)
              showLiveScore: true,
              // mostra o placar do jogo em andamento ao lado do time
              dimLive: 55,
              // % — destaque (suave) dos times que estão em jogo agora (o jogo principal é sempre mais forte)
              introStyle: "cascade",
              // entrada: cascade|fade|slide|rise|drop|zoom|pop|flip|spin|blur|wipe|wipe-down|bounce|none
              outroStyle: "fade"
              // saída: fade|cascade|slide|rise|drop|zoom|pop|flip|spin|blur|wipe|wipe-down|none
            },
            outrosJogos: {
              followPlacar: true,
              fontFamily: "Montserrat",
              position: "bottom-left",
              marginX: 40,
              marginY: 40,
              rowHeight: 46,
              fontSize: 20,
              width: 640,
              borderRadius: 14,
              bgColor: "#0c0f14",
              bgOpacity: 94,
              accentColor: "#0057ff",
              textColor: "#f5f6f8",
              goalColor: "#22c55e",
              title: "OUTROS JOGOS",
              showCrests: true,
              fullNames: true,
              // nome inteiro (false = sigla)
              showRound: true,
              // mostra a rodada quando for diferente da do jogo principal
              autoAlert: false,
              // gol lançado em outro jogo aparece sozinho por alguns segundos, mesmo com a lista fora do ar
              alertMs: 7e3,
              introStyle: "cascade",
              outroStyle: "fade"
            },
            arbitragem: {
              followPlacar: true,
              fontFamily: "Montserrat",
              position: "center",
              marginX: 40,
              marginY: 40,
              rowHeight: 56,
              fontSize: 22,
              width: 720,
              borderRadius: 14,
              bgColor: "#0c0f14",
              bgOpacity: 94,
              accentColor: "#0057ff",
              textColor: "#f5f6f8",
              titleRef: "ARBITRAGEM",
              titleVar: "\xC1RBITROS DE V\xCDDEO",
              showFrom: true,
              // mostra a federação / cidade ao lado do nome
              introStyle: "cascade",
              outroStyle: "fade"
            },
            // ===== v6.1 — ESTÁDIO (/arte/informativos): fotos em slide + dados do estádio =====
            estadio: {
              followPlacar: true,
              fontFamily: "Montserrat",
              position: "center",
              marginX: 40,
              marginY: 40,
              fontSize: 20,
              width: 820,
              photoHeight: 340,
              layout: "top",
              // 'top' (foto em cima, dados embaixo) | 'side' (foto ao lado)
              borderRadius: 14,
              bgColor: "#0c0f14",
              bgOpacity: 94,
              accentColor: "#0057ff",
              textColor: "#f5f6f8",
              title: "EST\xC1DIO",
              slideMs: 5e3,
              // tempo de cada foto
              slideStyle: "fade",
              // 'fade' | 'slide' | 'zoom' (zoom lento)
              showDots: true,
              // bolinhas indicando a foto atual
              introStyle: "cascade",
              outroStyle: "fade"
            },
            // ===== v5.0 — CARTÃO DE FIM DE JOGO (/arte/fim-de-jogo) =====
            // Opcional: só aparece quando você clica em "Mostrar no OBS" na aba Partida.
            fimDeJogo: {
              fontFamily: "Montserrat",
              position: "center",
              // 'top-center' | 'center' | 'bottom-center'
              title: "FIM DE JOGO",
              width: 860,
              nameSize: 26,
              scoreSize: 72,
              scorerSize: 17,
              borderRadius: 16,
              bgColor: "#0c0f14",
              bgOpacity: 95,
              accentColor: "#0057ff",
              textColor: "#f5f6f8",
              useTeamColors: true,
              // faixa de cada time na cor dele
              showCrest: true,
              showScorers: true,
              // lista de quem fez os gols
              showCompetition: true,
              // campeonato / rodada
              showShootout: true,
              // resultado dos pênaltis, se houve
              introStyle: "classic",
              // v6.1 — entrada: classic|fade|slide|slide-right|rise|drop|zoom|pop|flip|spin|blur|wipe|wipe-down|bounce|none
              outroStyle: "classic"
              // v6.1 — saída: classic|fade|slide|slide-right|rise|drop|zoom|pop|flip|spin|blur|wipe|wipe-down|none
            }
          }
        };
      }
      module.exports = { getDefaultState, getDefaultMatchSide, getDefaultShootout, getDefaultFinalCard, getDefaultLeague, getDefaultOthers, getDefaultOfficials, getDefaultZones, DEFAULT_CLUBS };
    }
  });

  // js/standings-core.js
  var require_standings_core = __commonJS({
    "js/standings-core.js"(exports, module) {
      (function(root) {
        const norm = (v) => String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const STOP = /* @__PURE__ */ new Set(["de", "da", "do", "das", "dos", "e", "ec", "fc", "sc", "ac", "ad", "cr", "clube", "esporte", "esportes", "associacao", "atletica", "sociedade", "desportiva", "desportivo", "futebol", "regatas", "recreativa", "recreativo", "football", "club", "sad"]);
        const tokens = (v) => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
        const keyOf = (v) => tokens(v).filter((t) => !STOP.has(t)).join("");
        const UF = new Set("ac al ap am ba ce df es go ma mt ms mg pa pb pr pe pi rj rn rs ro rr sc sp se to".split(" "));
        const sigTokens = (v) => tokens(v).filter((t) => !STOP.has(t) && !UF.has(t) && t.length >= 3);
        function scoreMatch(name, short, team) {
          const n = norm(name), tn = norm(team.name);
          if (!n || !tn) return 0;
          if (n === tn) return 100;
          const sh = norm(short), ts = norm(team.shortName);
          const k = keyOf(name), tk = keyOf(team.name);
          if (k && k === tk) return 90;
          if (sh && ts && sh === ts && sh.length >= 3) return 85;
          if (k.length >= 4 && tk.length >= 4 && (tk.includes(k) || k.includes(tk))) return 75;
          const a = sigTokens(name), b = sigTokens(team.name);
          if (a.length && b.length) {
            const common = a.filter((t) => b.includes(t) && t.length >= 4);
            if (common.length && common.length === Math.min(a.length, b.length)) return 60;
          }
          return 0;
        }
        function matchTeam(name, short, teams) {
          let best = null, bestScore = 0, tie = false;
          (teams || []).forEach((t) => {
            const sc = scoreMatch(name, short, t);
            if (sc > bestScore) {
              best = t;
              bestScore = sc;
              tie = false;
            } else if (sc && sc === bestScore) tie = true;
          });
          if (!best || bestScore < 60) return { team: null, ambiguous: false };
          if (tie && bestScore < 100) return { team: null, ambiguous: true };
          return { team: best, ambiguous: false };
        }
        function teamForRow(row, teams) {
          if (!row) return null;
          if (row.teamId) {
            const t = (teams || []).find((x) => x.id === row.teamId);
            if (t) return t;
          }
          return matchTeam(row.name, row.short, teams).team;
        }
        function rowIsTeam(row, team, teams) {
          if (!row || !team) return false;
          if (row.teamId && row.teamId === team.id) return true;
          if (!row.teamId && teams) {
            const t = teamForRow(row, teams);
            if (t) return t.id === team.id;
          }
          return !!(row.name && team.name && norm(row.name) === norm(team.name));
        }
        function addResult(r, gf, ga) {
          const win = gf > ga, draw = gf === ga;
          r.pts += win ? 3 : draw ? 1 : 0;
          const inc = (k, by) => {
            if (r[k] !== null && r[k] !== void 0) r[k] += by;
          };
          inc("j", 1);
          inc(win ? "v" : draw ? "e" : "d", 1);
          inc("gp", gf);
          inc("gc", ga);
        }
        const sg = (r) => r.gp !== null && r.gp !== void 0 && r.gc !== null && r.gc !== void 0 ? r.gp - r.gc : null;
        const cmp = (a, b) => b.pts - a.pts || (b.v || 0) - (a.v || 0) || (sg(b) || 0) - (sg(a) || 0) || (b.gp || 0) - (a.gp || 0) || a.order - b.order;
        function zoneFor(zones, pos) {
          return (zones || []).find((z) => z.enabled !== false && pos >= z.from && pos <= z.to) || null;
        }
        function compute(state, teams) {
          const lg = state.league;
          const findTeam = (id) => (teams || []).find((t) => t.id === id) || null;
          const rows = lg.teams.map((t, i) => ({ ...t, order: i, base: { pts: t.pts }, main: null, live: null, team: null }));
          const byId = new Map(rows.map((r) => [r.id, r]));
          rows.forEach((r) => {
            r.team = teamForRow(r, teams);
          });
          const baseSorted = [...rows].sort(cmp);
          const basePos = new Map(baseSorted.map((r, i) => [r.id, i + 1]));
          let projecting = false;
          const m = state.match || {};
          const mainRound = state.meta && state.meta.round || "";
          const homeTeam = findTeam(m.home && m.home.teamId), awayTeam = findTeam(m.away && m.away.teamId);
          const homeRow = homeTeam ? rows.find((r) => rowIsTeam(r, homeTeam, teams)) : null;
          const awayRow = awayTeam ? rows.find((r) => rowIsTeam(r, awayTeam, teams)) : null;
          const sc = m.score || { home: 0, away: 0 };
          const started = !!(m.clock && (m.clock.seconds > 0 || m.clock.running)) || sc.home + sc.away > 0 || (m.events || []).length > 0;
          if (homeRow) homeRow.main = { gf: sc.home, ga: sc.away, oppName: awayTeam ? awayTeam.name : "" };
          if (awayRow) awayRow.main = { gf: sc.away, ga: sc.home, oppName: homeTeam ? homeTeam.name : "" };
          if (lg.liveProjection !== false) {
            if (lg.includeMain !== false && started) {
              if (homeRow) {
                addResult(homeRow, sc.home, sc.away);
                homeRow.projected = true;
                projecting = true;
              }
              if (awayRow) {
                awayRow.projected = true;
                addResult(awayRow, sc.away, sc.home);
                projecting = true;
              }
            }
          }
          const others = state.others && state.others.games || [];
          others.forEach((g) => {
            const h = byId.get(g.homeId), a = byId.get(g.awayId);
            const info = (r, gf, ga, opp) => ({ gf, ga, status: g.status, minute: g.minute, round: g.round, oppName: opp ? opp.name : "", gameId: g.id });
            if (h && !h.main) h.live = info(h, g.homeScore, g.awayScore, a);
            if (a && !a.main) a.live = info(a, g.awayScore, g.homeScore, h);
            if (lg.liveProjection !== false && g.status !== "scheduled") {
              if (h) {
                addResult(h, g.homeScore, g.awayScore);
                h.projected = true;
                projecting = true;
              }
              if (a) {
                addResult(a, g.awayScore, g.homeScore);
                a.projected = true;
                projecting = true;
              }
            }
          });
          const sorted = [...rows].sort(cmp);
          sorted.forEach((r, i) => {
            r.pos = i + 1;
            r.delta = basePos.get(r.id) - r.pos;
            r.zone = zoneFor(lg.zones, r.pos);
            r.sg = sg(r);
          });
          const has = (k) => sorted.some((r) => r[k] !== null && r[k] !== void 0);
          return {
            rows: sorted,
            cols: { j: has("j"), v: has("v"), e: has("e"), d: has("d"), sg: sorted.some((r) => r.sg !== null) },
            projecting,
            mainRound,
            tableRound: lg.round || ""
          };
        }
        root.Standings = { compute, rowIsTeam, norm, zoneFor, matchTeam, teamForRow };
        if (typeof module !== "undefined" && module.exports) module.exports = root.Standings;
      })(typeof window !== "undefined" ? window : globalThis);
    }
  });

  // engine-src/server/teamsStore.js
  var require_teamsStore = __commonJS({
    "engine-src/server/teamsStore.js"(exports, module) {
      var fs2 = require_fs();
      var path = require_path();
      var TEAMS_DIR = path.join("/app/server", "..", "data", "teams");
      function ensureTeamsDir() {
        if (!fs2.existsSync(TEAMS_DIR)) fs2.mkdirSync(TEAMS_DIR, { recursive: true });
      }
      function slugify(name) {
        return (name || "time").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "time";
      }
      function sanitizeId(id) {
        return String(id == null ? "" : id).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
      }
      function defaultTeam(id, name) {
        return {
          id,
          name: name || "",
          shortName: "",
          // v4.0 — sigla usada na Linha do Tempo (vazio = 3 primeiras letras do nome)
          crestDataUrl: "",
          captainSymbol: "(C)",
          primaryColor: "#0057ff",
          secondaryColor: "#ffffff",
          textColor: "#f5f6f8",
          numberColor: "#ffffff",
          bgColor: "#0c0f14",
          dividerColor: "#ffffff",
          captainColor: "#ffd700",
          shadowColor: "#000000",
          coach: "",
          city: "",
          players: [],
          updatedAt: Date.now()
        };
      }
      function newPlayerId() {
        return "p_" + Date.now() + "_" + Math.floor(Math.random() * 1e5);
      }
      function normalizeTeam(raw, forcedId) {
        const src = raw && typeof raw === "object" ? raw : {};
        const id = sanitizeId(forcedId || src.id) || null;
        const base = defaultTeam(id, src.name);
        const merged = { ...base, ...src, id };
        const seen = /* @__PURE__ */ new Set();
        merged.players = (Array.isArray(src.players) ? src.players : []).filter((p) => p && typeof p === "object").map((p) => {
          let pid = p.id != null && String(p.id) !== "" ? String(p.id) : newPlayerId();
          while (seen.has(pid)) pid = newPlayerId();
          seen.add(pid);
          const num = parseInt(p.number, 10);
          return {
            ...p,
            id: pid,
            number: Number.isFinite(num) ? num : 0,
            name: String(p.name == null ? "" : p.name),
            position: String(p.position == null ? "" : p.position)
          };
        });
        merged.name = String(merged.name || "");
        if (!/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(String(merged.crestDataUrl || ""))) merged.crestDataUrl = "";
        merged.shortName = String(merged.shortName || "");
        return merged;
      }
      function generateId(name) {
        ensureTeamsDir();
        const base = sanitizeId(slugify(name)) || "time";
        let id = base;
        let n = 2;
        while (fs2.existsSync(path.join(TEAMS_DIR, `${id}.json`))) {
          id = `${base}-${n}`;
          n++;
        }
        return id;
      }
      function listTeams() {
        ensureTeamsDir();
        const files = fs2.readdirSync(TEAMS_DIR).filter((f) => f.endsWith(".json"));
        const teams = [];
        for (const file of files) {
          try {
            const raw = fs2.readFileSync(path.join(TEAMS_DIR, file), "utf-8");
            const parsed = JSON.parse(raw);
            if (!parsed.id) parsed.id = file.replace(/\.json$/, "");
            teams.push(normalizeTeam(parsed, parsed.id));
          } catch (err) {
            console.error(`[teamsStore] Falha ao ler ${file}:`, err.message);
          }
        }
        teams.sort((a, b) => (a.name || "").localeCompare(b.name || "", "pt-BR"));
        return teams;
      }
      function getTeam(id) {
        ensureTeamsDir();
        const safe = sanitizeId(id);
        if (!safe) return null;
        const file = path.join(TEAMS_DIR, `${safe}.json`);
        if (!fs2.existsSync(file)) return null;
        try {
          return JSON.parse(fs2.readFileSync(file, "utf-8"));
        } catch (err) {
          console.error(`[teamsStore] Falha ao ler time ${safe}:`, err.message);
          return null;
        }
      }
      function writeAtomic(file, content) {
        const tmp = file + ".tmp";
        fs2.writeFileSync(tmp, content);
        fs2.renameSync(tmp, file);
      }
      function saveTeam(team) {
        ensureTeamsDir();
        let id = sanitizeId(team.id);
        if (!id) id = generateId(team.name);
        const existing = getTeam(id) || defaultTeam(id, team.name);
        const merged = normalizeTeam(
          {
            ...existing,
            ...team,
            id,
            players: Array.isArray(team.players) ? team.players : existing.players
          },
          id
        );
        merged.updatedAt = Date.now();
        writeAtomic(path.join(TEAMS_DIR, `${id}.json`), JSON.stringify(merged, null, 2));
        return merged;
      }
      function deleteTeam(id) {
        ensureTeamsDir();
        const safe = sanitizeId(id);
        if (!safe) return false;
        const file = path.join(TEAMS_DIR, `${safe}.json`);
        if (fs2.existsSync(file)) {
          fs2.unlinkSync(file);
          return true;
        }
        return false;
      }
      function deleteAllTeams() {
        ensureTeamsDir();
        for (const f of fs2.readdirSync(TEAMS_DIR)) {
          if (f.endsWith(".json")) fs2.unlinkSync(path.join(TEAMS_DIR, f));
        }
      }
      module.exports = {
        TEAMS_DIR,
        listTeams,
        getTeam,
        saveTeam,
        deleteTeam,
        deleteAllTeams,
        defaultTeam,
        normalizeTeam,
        generateId,
        sanitizeId
      };
    }
  });

  // engine-src/server/informativos.js
  var require_informativos = __commonJS({
    "engine-src/server/informativos.js"(exports, module) {
      var Standings = require_standings_core();
      var teamsStore = require_teamsStore();
      var { getDefaultLeague, getDefaultOthers, getDefaultOfficials, getDefaultZones } = require_defaultState();
      var MAX_TEAMS = 30;
      var MAX_ZONES = 8;
      var MAX_GAMES = 12;
      var NUM_KEYS = ["pts", "j", "v", "e", "d", "gp", "gc"];
      var OFFICIAL_KEYS = ["main", "ass1", "ass2", "fourth", "var", "avar1", "avar2"];
      var str = (v, n) => String(v == null ? "" : v).slice(0, n);
      var uid = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
      var norm = (v) => String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
      function intOrNull(v) {
        if (v === null || v === void 0 || v === "") return null;
        const n = Math.floor(Number(v));
        return Number.isFinite(n) && n >= 0 && n < 1e4 ? n : null;
      }
      var hexOr = (v, d) => /^#[0-9a-fA-F]{6}$/.test(String(v || "")) ? String(v) : d;
      function autoLink(name, short) {
        let teams = [];
        try {
          teams = teamsStore.listTeams();
        } catch (_) {
          return null;
        }
        const m = Standings.matchTeam(name, short, teams);
        return m.team ? m.team.id : null;
      }
      var makeShort = (name) => String(name || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
      function normalizeRow(r, i) {
        var _a;
        const row = {
          id: str(r && r.id, 40) || uid("c"),
          name: str(r && r.name, 40),
          short: str(r && r.short, 5).toUpperCase(),
          teamId: r && r.teamId ? teamsStore.sanitizeId(r.teamId) || null : null
        };
        for (const k of NUM_KEYS) row[k] = k === "pts" ? (_a = intOrNull(r && r[k])) != null ? _a : 0 : intOrNull(r && r[k]);
        if (!row.short) row.short = makeShort(row.name);
        return row;
      }
      function normalizeZone(z) {
        let from = Math.max(1, Math.min(99, Math.floor(Number(z && z.from)) || 1));
        let to = Math.max(1, Math.min(99, Math.floor(Number(z && z.to)) || from));
        if (to < from) [from, to] = [to, from];
        return { id: str(z && z.id, 40) || uid("z"), label: str(z && z.label, 40), from, to, color: hexOr(z && z.color, "#64748b"), enabled: !(z && z.enabled === false) };
      }
      function normalizeLeague(raw) {
        const d = getDefaultLeague();
        const l = raw && typeof raw === "object" ? raw : {};
        const teams = Array.isArray(l.teams) && l.teams.length ? l.teams.slice(0, MAX_TEAMS).map(normalizeRow) : d.teams;
        const seen = /* @__PURE__ */ new Set();
        teams.forEach((t) => {
          while (seen.has(t.id)) t.id = uid("c");
          seen.add(t.id);
        });
        const zones = Array.isArray(l.zones) ? l.zones.slice(0, MAX_ZONES).map(normalizeZone) : getDefaultZones();
        return {
          name: l.name !== void 0 ? str(l.name, 60) : d.name,
          round: str(l.round, 12),
          visible: !!l.visible,
          mode: l.mode === "complete" ? "complete" : "compact",
          liveProjection: l.liveProjection !== false,
          includeMain: l.includeMain !== false,
          teams,
          zones,
          lastCommit: l.lastCommit && Array.isArray(l.lastCommit.teams) ? { teams: l.lastCommit.teams.map(normalizeRow), game: l.lastCommit.game || null, label: str(l.lastCommit.label, 80) } : null
        };
      }
      function normalizeGame(g) {
        var _a, _b;
        return {
          id: str(g && g.id, 40) || uid("g"),
          homeId: str(g && g.homeId, 40),
          awayId: str(g && g.awayId, 40),
          homeScore: (_a = intOrNull(g && g.homeScore)) != null ? _a : 0,
          awayScore: (_b = intOrNull(g && g.awayScore)) != null ? _b : 0,
          status: ["live", "scheduled", "finished"].includes(g && g.status) ? g.status : "live",
          minute: str(g && g.minute, 12),
          round: str(g && g.round, 12),
          onAir: !(g && g.onAir === false)
        };
      }
      function normalizeOthers(raw) {
        const o = raw && typeof raw === "object" ? raw : {};
        return { visible: !!o.visible, games: Array.isArray(o.games) ? o.games.slice(0, MAX_GAMES).map(normalizeGame) : [] };
      }
      function normalizeOfficials(raw) {
        const d = getDefaultOfficials();
        const o = raw && typeof raw === "object" ? raw : {};
        const out = { refVisible: !!o.refVisible, varVisible: !!o.varVisible };
        for (const k of OFFICIAL_KEYS) out[k] = { name: str(o[k] && o[k].name, 60), from: str(o[k] && o[k].from, 30) };
        return { ...d, ...out };
      }
      function applyResult(row, gf, ga) {
        const win = gf > ga, draw = gf === ga;
        row.pts = (row.pts || 0) + (win ? 3 : draw ? 1 : 0);
        const inc = (k, by) => {
          if (row[k] !== null && row[k] !== void 0) row[k] += by;
        };
        inc("j", 1);
        inc(win ? "v" : draw ? "e" : "d", 1);
        inc("gp", gf);
        inc("gc", ga);
      }
      function parseLine(line) {
        const text = String(line || "").trim();
        if (!text) return null;
        const parts = text.split(/[\t;]+/).map((x) => x.trim()).filter(Boolean);
        let name, nums;
        if (parts.length > 1) {
          if (parts.length > 2 && /^\d+$/.test(parts[0]) && /\D/.test(parts[1])) parts.shift();
          name = parts[0];
          nums = parts.slice(1).join(" ").split(/[\s,]+/);
        } else {
          const m = text.match(/^(.*?[^\d\s,.\-])[\s,]+((?:-?\d+[\s,]*)+)$/);
          if (!m) return null;
          name = m[1];
          nums = m[2].trim().split(/[\s,]+/);
        }
        name = name.replace(/^\d+[.º°)\-\s]+(?=\D)/, "").trim();
        const vals = nums.map((n) => intOrNull(n)).filter((n) => n !== null);
        if (!name || !vals.length) return null;
        return { name: name.slice(0, 40), nums: vals };
      }
      function register(socket, { S, commit, io: io2 }) {
        const L = () => S().league;
        const rowById = (id) => L().teams.find((t) => t.id === id);
        socket.on("league:setMeta", (d = {}) => {
          if (typeof d !== "object") return;
          const l = L();
          if ("name" in d) l.name = str(d.name, 60);
          if ("round" in d) l.round = str(d.round, 12);
          if ("liveProjection" in d) l.liveProjection = !!d.liveProjection;
          if ("includeMain" in d) l.includeMain = !!d.includeMain;
          commit();
        });
        socket.on("league:setVisible", (v) => {
          L().visible = !!v;
          commit();
        });
        socket.on("league:setMode", (m) => {
          L().mode = m === "complete" ? "complete" : "compact";
          commit();
        });
        socket.on("league:setRow", ({ id, patch } = {}) => {
          var _a;
          const row = rowById(id);
          if (!row || !patch || typeof patch !== "object") return;
          if ("name" in patch) {
            row.name = str(patch.name, 40);
            if (!("short" in patch) && !row.short) row.short = makeShort(row.name);
            if (!("teamId" in patch)) row.teamId = autoLink(row.name, row.short);
          }
          if ("short" in patch) row.short = str(patch.short, 5).toUpperCase() || makeShort(row.name);
          if ("teamId" in patch) row.teamId = patch.teamId ? teamsStore.sanitizeId(patch.teamId) || null : null;
          for (const k of NUM_KEYS) if (k in patch) row[k] = k === "pts" ? (_a = intOrNull(patch[k])) != null ? _a : 0 : intOrNull(patch[k]);
          commit();
        });
        socket.on("league:addRow", (d = {}) => {
          if (L().teams.length >= MAX_TEAMS) return;
          const name = str(d && d.name, 40);
          L().teams.push(normalizeRow({ name, teamId: autoLink(name) }));
          commit();
        });
        socket.on("league:removeRow", (id) => {
          const l = L();
          if (l.teams.length <= 2) return;
          l.teams = l.teams.filter((t) => t.id !== id);
          S().others.games = S().others.games.filter((g) => g.homeId !== id && g.awayId !== id);
          commit();
        });
        socket.on("league:moveRow", ({ id, dir } = {}) => {
          const t = L().teams, i = t.findIndex((x) => x.id === id), j = i + (Number(dir) < 0 ? -1 : 1);
          if (i < 0 || j < 0 || j >= t.length) return;
          [t[i], t[j]] = [t[j], t[i]];
          commit();
        });
        socket.on("league:sortByPoints", () => {
          const sg = (r) => r.gp !== null && r.gc !== null ? r.gp - r.gc : 0;
          const keyed = L().teams.map((r, i) => ({ r, i }));
          keyed.sort((a, b) => b.r.pts - a.r.pts || (b.r.v || 0) - (a.r.v || 0) || sg(b.r) - sg(a.r) || (b.r.gp || 0) - (a.r.gp || 0) || a.i - b.i);
          L().teams = keyed.map((x) => x.r);
          commit();
        });
        socket.on("league:bulk", ({ text, replace } = {}, ack) => {
          const lines = String(text || "").split(/\r?\n/).slice(0, 60).map(parseLine).filter(Boolean);
          if (!lines.length) {
            if (typeof ack === "function") ack({ ok: false, error: "N\xE3o entendi a lista. Use uma linha por time, por exemplo: Flamengo 55" });
            return;
          }
          const l = L();
          const orderNames = [];
          let updated = 0, added = 0;
          for (const { name, nums } of lines) {
            const n = norm(name);
            let row = l.teams.find((t) => norm(t.name) === n || t.short && norm(t.short) === n);
            if (!row) {
              if (l.teams.length >= MAX_TEAMS) continue;
              row = normalizeRow({ name, teamId: autoLink(name) });
              l.teams.push(row);
              added++;
            } else updated++;
            NUM_KEYS.forEach((k, i) => {
              if (nums[i] !== void 0) row[k] = nums[i];
            });
            orderNames.push(row.id);
          }
          if (replace) {
            const keep = new Set(orderNames);
            l.teams = orderNames.map((id) => l.teams.find((t) => t.id === id)).filter(Boolean);
            S().others.games = S().others.games.filter((g) => keep.has(g.homeId) && keep.has(g.awayId));
          }
          commit();
          if (typeof ack === "function") ack({ ok: true, updated, added });
        });
        socket.on("league:resetPoints", () => {
          for (const t of L().teams) for (const k of NUM_KEYS) t[k] = k === "pts" ? 0 : null;
          commit();
        });
        socket.on("league:resetAll", () => {
          const keep = { visible: L().visible, mode: L().mode };
          S().league = { ...getDefaultLeague(), ...keep };
          S().others.games = [];
          commit();
        });
        socket.on("league:setZone", ({ id, patch } = {}) => {
          const i = L().zones.findIndex((z) => z.id === id);
          if (i < 0 || !patch || typeof patch !== "object") return;
          L().zones[i] = normalizeZone({ ...L().zones[i], ...patch });
          commit();
        });
        socket.on("league:addZone", () => {
          if (L().zones.length >= MAX_ZONES) return;
          const last = L().zones.reduce((m, z) => Math.max(m, z.to), 0);
          L().zones.push(normalizeZone({ label: "Nova faixa", from: Math.min(99, last + 1), to: Math.min(99, last + 1), color: "#a855f7" }));
          commit();
        });
        socket.on("league:removeZone", (id) => {
          L().zones = L().zones.filter((z) => z.id !== id);
          commit();
        });
        socket.on("league:resetZones", () => {
          L().zones = getDefaultZones();
          commit();
        });
        const O = () => S().others;
        const gameById = (id) => O().games.find((g) => g.id === id);
        const validRow = (id) => id && rowById(id) ? id : "";
        socket.on("others:setVisible", (v) => {
          O().visible = !!v;
          commit();
        });
        socket.on("others:addGame", (d = {}) => {
          if (O().games.length >= MAX_GAMES) return;
          O().games.push(normalizeGame({ homeId: validRow(d && d.homeId), awayId: validRow(d && d.awayId), round: d && d.round, status: "live" }));
          commit();
        });
        socket.on("others:updateGame", ({ id, patch } = {}) => {
          var _a, _b;
          const g = gameById(id);
          if (!g || !patch || typeof patch !== "object") return;
          if ("homeId" in patch) g.homeId = validRow(patch.homeId);
          if ("awayId" in patch) g.awayId = validRow(patch.awayId);
          if ("status" in patch && ["live", "scheduled", "finished"].includes(patch.status)) g.status = patch.status;
          if ("minute" in patch) g.minute = str(patch.minute, 12);
          if ("round" in patch) g.round = str(patch.round, 12);
          if ("onAir" in patch) g.onAir = !!patch.onAir;
          if ("homeScore" in patch) g.homeScore = (_a = intOrNull(patch.homeScore)) != null ? _a : 0;
          if ("awayScore" in patch) g.awayScore = (_b = intOrNull(patch.awayScore)) != null ? _b : 0;
          commit();
        });
        socket.on("others:score", ({ id, side, delta } = {}) => {
          const g = gameById(id);
          if (!g) return;
          const key = side === "away" ? "awayScore" : "homeScore";
          const d = Number(delta) < 0 ? -1 : 1;
          const next = Math.max(0, g[key] + d);
          if (next === g[key]) return;
          g[key] = next;
          if (g.status === "scheduled") g.status = "live";
          commit();
          if (d > 0) io2.emit("others:goal", { id: g.id, side: side === "away" ? "away" : "home" });
        });
        socket.on("others:removeGame", (id) => {
          O().games = O().games.filter((g) => g.id !== id);
          commit();
        });
        socket.on("others:clear", () => {
          O().games = [];
          commit();
        });
        socket.on("others:commitGame", (id, ack) => {
          const g = gameById(id);
          const h = g && rowById(g.homeId), a = g && rowById(g.awayId);
          if (!g || !h && !a) {
            if (typeof ack === "function") ack({ ok: false, error: "Escolha os times do jogo antes de lan\xE7ar." });
            return;
          }
          L().lastCommit = { teams: JSON.parse(JSON.stringify(L().teams)), game: JSON.parse(JSON.stringify(g)), label: `${h ? h.name : "?"} ${g.homeScore} \xD7 ${g.awayScore} ${a ? a.name : "?"}` };
          if (h) applyResult(h, g.homeScore, g.awayScore);
          if (a) applyResult(a, g.awayScore, g.homeScore);
          O().games = O().games.filter((x) => x.id !== id);
          commit();
          if (typeof ack === "function") ack({ ok: true });
        });
        socket.on("league:undoCommit", () => {
          const lc = L().lastCommit;
          if (!lc) return;
          L().teams = lc.teams.map(normalizeRow);
          if (lc.game && O().games.length < MAX_GAMES) O().games.push(normalizeGame(lc.game));
          L().lastCommit = null;
          commit();
        });
        socket.on("officials:set", ({ key, name, from } = {}) => {
          if (!OFFICIAL_KEYS.includes(key)) return;
          const o = S().officials;
          if (!o[key]) o[key] = { name: "", from: "" };
          if (name !== void 0) o[key].name = str(name, 60);
          if (from !== void 0) o[key].from = str(from, 30);
          commit();
        });
        socket.on("officials:setVisible", ({ which, visible } = {}) => {
          const o = S().officials;
          if (which === "ref") o.refVisible = !!visible;
          else if (which === "var") o.varVisible = !!visible;
          else return;
          commit();
        });
        socket.on("officials:clear", () => {
          const v = { refVisible: S().officials.refVisible, varVisible: S().officials.varVisible };
          S().officials = { ...getDefaultOfficials(), ...v };
          commit();
        });
      }
      module.exports = { register, normalizeLeague, normalizeOthers, normalizeOfficials, norm, applyResult, parseLine };
    }
  });

  // engine-src/server/shootout.js
  var require_shootout = __commonJS({
    "engine-src/server/shootout.js"(exports, module) {
      var { getDefaultShootout } = require_defaultState();
      var MAX_KICKS = 60;
      var other = (side) => side === "home" ? "away" : "home";
      function sideOfKick(index, firstSide) {
        return index % 2 === 0 ? firstSide : other(firstSide);
      }
      function compute(sh) {
        const rounds = sh.rounds || 5;
        const taken = { home: 0, away: 0 };
        const goals = { home: 0, away: 0 };
        sh.kicks.forEach((k, i) => {
          const side = sideOfKick(i, sh.firstSide);
          taken[side]++;
          if (k.scored) goals[side]++;
        });
        const total = sh.kicks.length;
        const planned = Math.max(rounds, Math.ceil(total / 2));
        const remaining = { home: Math.max(0, planned - taken.home), away: Math.max(0, planned - taken.away) };
        let winner = null;
        if (goals.home > goals.away + remaining.away) winner = "home";
        else if (goals.away > goals.home + remaining.home) winner = "away";
        const finished = winner !== null;
        return {
          taken,
          goals,
          total,
          planned,
          finished,
          winner,
          next: finished || total >= MAX_KICKS ? null : { side: sideOfKick(total, sh.firstSide), round: Math.floor(total / 2) + 1 },
          suddenDeath: total >= rounds * 2
        };
      }
      function refresh(sh) {
        sh.kicks.forEach((k, i) => {
          k.side = sideOfKick(i, sh.firstSide);
          k.round = Math.floor(i / 2) + 1;
        });
        const c = compute(sh);
        sh.finished = c.finished;
        sh.winner = c.winner;
        return sh;
      }
      function normalize(raw) {
        const d = getDefaultShootout();
        const src = raw && typeof raw === "object" ? raw : {};
        const sh = {
          visible: !!src.visible,
          firstSide: src.firstSide === "away" ? "away" : "home",
          rounds: Number.isInteger(src.rounds) && src.rounds >= 1 && src.rounds <= 10 ? src.rounds : d.rounds,
          kicks: [],
          finished: false,
          winner: null
        };
        const list = Array.isArray(src.kicks) ? src.kicks.slice(0, MAX_KICKS) : [];
        list.forEach((k, i) => {
          if (!k || typeof k !== "object") return;
          sh.kicks.push({
            id: typeof k.id === "string" && k.id ? k.id.slice(0, 40) : `k${Date.now().toString(36)}${i}`,
            side: "home",
            round: 1,
            scored: !!k.scored,
            playerId: k.playerId ? String(k.playerId).slice(0, 80) : null,
            playerName: k.playerName ? String(k.playerName).slice(0, 80) : ""
          });
        });
        return refresh(sh);
      }
      module.exports = { compute, refresh, normalize, sideOfKick, other, MAX_KICKS };
    }
  });

  // engine-src/server/persistence.js
  var require_persistence = __commonJS({
    "engine-src/server/persistence.js"(exports, module) {
      var fs2 = require_fs();
      var path = require_path();
      var { getDefaultState, getDefaultMatchSide, getDefaultFinalCard } = require_defaultState();
      var informativos = require_informativos();
      var stadium = require_stadium();
      var teamsStore = require_teamsStore();
      var shootout = require_shootout();
      var DATA_DIR = path.join("/app/server", "..", "data");
      var STATE_FILE = path.join(DATA_DIR, "state.json");
      function ensureDataDir() {
        if (!fs2.existsSync(DATA_DIR)) fs2.mkdirSync(DATA_DIR, { recursive: true });
      }
      var VISUAL_SLOTS = 3;
      function normalizeVisuals(raw) {
        const defaults = getDefaultState().customization;
        const out = [];
        for (let i = 0; i < VISUAL_SLOTS; i++) {
          const v = Array.isArray(raw) ? raw[i] : null;
          if (!v || typeof v !== "object" || !v.customization || typeof v.customization !== "object") {
            out.push(null);
            continue;
          }
          out.push({
            name: String(v.name || `Visual ${i + 1}`).slice(0, 40),
            savedAt: Number(v.savedAt) || Date.now(),
            customization: mergeCustomization(defaults, v.customization)
          });
        }
        return out;
      }
      function mergeCustomization(defaults, sc) {
        return {
          ...defaults,
          ...sc,
          effects: { ...defaults.effects, ...sc.effects || {} },
          placar: { ...defaults.placar, ...sc.placar || {} },
          eventos: { ...defaults.eventos, ...sc.eventos || {} },
          linhaDoTempo: { ...defaults.linhaDoTempo, ...sc.linhaDoTempo || {} },
          penaltis: { ...defaults.penaltis, ...sc.penaltis || {} },
          fimDeJogo: { ...defaults.fimDeJogo, ...sc.fimDeJogo || {} },
          audio: { ...defaults.audio, ...sc.audio || {} },
          classificacao: { ...defaults.classificacao, ...sc.classificacao || {} },
          outrosJogos: { ...defaults.outrosJogos, ...sc.outrosJogos || {} },
          arbitragem: { ...defaults.arbitragem, ...sc.arbitragem || {} },
          estadio: { ...defaults.estadio, ...sc.estadio || {} }
        };
      }
      function normalizeSummaryOpts(x) {
        const t = x && typeof x.title === "string" ? x.title.slice(0, 80) : "";
        const off = x && Array.isArray(x.off) ? x.off.map(String).filter((k) => /^[a-z]{3,12}$/.test(k)).slice(0, 20) : [];
        return { title: t, off };
      }
      function mergeWithDefaults(saved) {
        const defaults = getDefaultState();
        const s = saved && typeof saved === "object" ? saved : {};
        const savedMatch = s.match || {};
        const sc = s.customization || {};
        const events = Array.isArray(savedMatch.events) ? savedMatch.events : [];
        const out = {
          ...defaults,
          ...s,
          meta: { ...defaults.meta, ...s.meta || {} },
          modules: { ...defaults.modules, ...s.modules || {} },
          match: {
            ...defaults.match,
            ...savedMatch,
            home: { ...getDefaultMatchSide(), ...savedMatch.home || {} },
            away: { ...getDefaultMatchSide(), ...savedMatch.away || {} },
            score: { ...defaults.match.score, ...savedMatch.score || {} },
            clock: { ...defaults.match.clock, ...savedMatch.clock || {} },
            events,
            statusLabel: ["intervalo", "fim"].includes(savedMatch.statusLabel) ? savedMatch.statusLabel : null,
            shootout: shootout.normalize(savedMatch.shootout),
            finalCard: { ...getDefaultFinalCard(), visible: !!(savedMatch.finalCard && savedMatch.finalCard.visible) }
          },
          customization: {
            ...defaults.customization,
            ...sc,
            effects: { ...defaults.customization.effects, ...sc.effects || {} },
            placar: { ...defaults.customization.placar, ...sc.placar || {} },
            eventos: { ...defaults.customization.eventos, ...sc.eventos || {} },
            linhaDoTempo: { ...defaults.customization.linhaDoTempo, ...sc.linhaDoTempo || {} },
            penaltis: { ...defaults.customization.penaltis, ...sc.penaltis || {} },
            fimDeJogo: { ...defaults.customization.fimDeJogo, ...sc.fimDeJogo || {} },
            audio: { ...defaults.customization.audio, ...sc.audio || {} },
            classificacao: { ...defaults.customization.classificacao, ...sc.classificacao || {} },
            outrosJogos: { ...defaults.customization.outrosJogos, ...sc.outrosJogos || {} },
            arbitragem: { ...defaults.customization.arbitragem, ...sc.arbitragem || {} },
            estadio: { ...defaults.customization.estadio, ...sc.estadio || {} }
          },
          visuals: normalizeVisuals(s.visuals),
          // v6.0 — classificação, outros jogos e arbitragem (estados antigos não têm; entram os padrões)
          league: informativos.normalizeLeague(s.league),
          others: informativos.normalizeOthers(s.others),
          officials: informativos.normalizeOfficials(s.officials),
          stadium: stadium.normalizeStadium(s.stadium),
          summary: normalizeSummaryOpts(s.summary)
        };
        for (const side of ["home", "away"]) {
          const m = out.match[side];
          if (!Array.isArray(m.benchIds)) m.benchIds = [];
          m.benchIds = m.benchIds.map(String).slice(0, 15);
          if (!Array.isArray(m.starterIds)) m.starterIds = [];
          if (!m.lineupStats || typeof m.lineupStats !== "object") m.lineupStats = {};
        }
        delete out.match.stats;
        delete out.modules.estatisticas;
        return out;
      }
      function isLegacyState(raw) {
        return !!(raw && raw.team && Array.isArray(raw.players) && !raw.match);
      }
      function legacyToTeam(raw) {
        return teamsStore.normalizeTeam({
          name: raw.team.name,
          crestDataUrl: raw.team.crestDataUrl,
          captainSymbol: raw.team.captainSymbol,
          primaryColor: raw.team.primaryColor,
          secondaryColor: raw.team.secondaryColor,
          textColor: raw.team.textColor,
          numberColor: raw.team.numberColor,
          bgColor: raw.team.bgColor,
          dividerColor: raw.team.dividerColor,
          captainColor: raw.team.captainColor,
          shadowColor: raw.team.shadowColor,
          players: raw.players
        });
      }
      function migrateLegacyIfNeeded(raw) {
        if (!isLegacyState(raw)) return raw;
        const existingTeams = teamsStore.listTeams();
        if (existingTeams.length === 0 && raw.team.name) {
          const saved = teamsStore.saveTeam(legacyToTeam(raw));
          raw.match = {
            home: { teamId: saved.id, starterIds: raw.starterIds || [], captainId: raw.captainId || null, lineupStats: {} }
          };
          console.log(`[persistence] Estado antigo migrado: time "${saved.name}" criado em data/teams/${saved.id}.json`);
        }
        return raw;
      }
      function sanitizeRuntime(state) {
        const clock = state.match.clock;
        if (clock.running) {
          const gap = clock.runningSince ? Date.now() - clock.runningSince : Infinity;
          if (gap > 6 * 3600 * 1e3) {
            clock.running = false;
            clock.runningSince = null;
          }
        } else {
          clock.runningSince = null;
        }
        if (!["1t", "2t", "p1", "p2"].includes(clock.period)) clock.period = "1t";
        return state;
      }
      function loadState() {
        ensureDataDir();
        if (!fs2.existsSync(STATE_FILE)) return getDefaultState();
        try {
          const raw = fs2.readFileSync(STATE_FILE, "utf-8");
          let parsed = JSON.parse(raw);
          parsed = migrateLegacyIfNeeded(parsed);
          return sanitizeRuntime(mergeWithDefaults(parsed));
        } catch (err) {
          console.error("[persistence] Falha ao ler state.json, usando estado padr\xE3o:", err.message);
          try {
            const copy = path.join(DATA_DIR, `state.corrupt-${Date.now()}.json`);
            fs2.copyFileSync(STATE_FILE, copy);
            console.error(`[persistence] C\xF3pia do arquivo com problema salva em ${copy}`);
          } catch (_) {
          }
          return getDefaultState();
        }
      }
      function saveState(state) {
        ensureDataDir();
        const tmp = STATE_FILE + ".tmp";
        fs2.writeFile(tmp, JSON.stringify(state, null, 2), (err) => {
          if (err) return console.error("[persistence] Falha ao salvar state.json:", err.message);
          fs2.rename(tmp, STATE_FILE, (err2) => {
            if (err2) console.error("[persistence] Falha ao finalizar state.json:", err2.message);
          });
        });
      }
      function saveStateSync(state) {
        ensureDataDir();
        const tmp = STATE_FILE + ".tmp";
        fs2.writeFileSync(tmp, JSON.stringify(state, null, 2));
        fs2.renameSync(tmp, STATE_FILE);
      }
      module.exports = {
        DATA_DIR,
        STATE_FILE,
        loadState,
        saveState,
        saveStateSync,
        mergeWithDefaults,
        mergeCustomization,
        normalizeVisuals,
        VISUAL_SLOTS,
        isLegacyState,
        legacyToTeam
      };
    }
  });

  // engine-src/server/runtime.js
  var require_runtime = __commonJS({
    "engine-src/server/runtime.js"(exports, module) {
      var { loadState, saveState, saveStateSync } = require_persistence();
      var teamsStore = require_teamsStore();
      var io2 = null;
      var currentState = loadState();
      var saveTimeout = null;
      var PERIOD_BASE = { "1t": 0, "2t": 45, "p1": 90, "p2": 105 };
      var PERIOD_REGULATION = { "1t": 45, "2t": 45, "p1": 15, "p2": 15 };
      var PERIOD_ORDER = ["1t", "2t", "p1", "p2"];
      function computeDisplayMinuteFromMinute(minute, period) {
        var _a, _b;
        const base = (_a = PERIOD_BASE[period]) != null ? _a : 0;
        const reg = (_b = PERIOD_REGULATION[period]) != null ? _b : 45;
        if (minute <= reg) return String(base + minute);
        return `${base + reg}+${minute - reg}`;
      }
      function computeDisplayMinute(totalSeconds, period) {
        return computeDisplayMinuteFromMinute(Math.floor(totalSeconds / 60), period);
      }
      function computeCurrentSeconds() {
        const clock = currentState.match.clock;
        if (clock.running && clock.runningSince) {
          return clock.seconds + Math.floor((Date.now() - clock.runningSince) / 1e3);
        }
        return clock.seconds;
      }
      function setIo(instance) {
        io2 = instance;
      }
      function getState() {
        return currentState;
      }
      function setState(next) {
        currentState = next;
      }
      function scheduleSave() {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => saveState(currentState), 300);
      }
      function saveNow() {
        clearTimeout(saveTimeout);
        saveStateSync(currentState);
      }
      function broadcastState() {
        if (io2) io2.emit("state:sync", currentState);
      }
      function broadcastTeams() {
        if (io2) io2.emit("teams:sync", teamsStore.listTeams());
      }
      function commit() {
        broadcastState();
        scheduleSave();
      }
      module.exports = {
        PERIOD_BASE,
        PERIOD_REGULATION,
        PERIOD_ORDER,
        computeDisplayMinuteFromMinute,
        computeDisplayMinute,
        computeCurrentSeconds,
        setIo,
        getState,
        setState,
        scheduleSave,
        saveNow,
        broadcastState,
        broadcastTeams,
        commit
      };
    }
  });

  // engine-src/server/audio.js
  var require_audio = __commonJS({
    "engine-src/server/audio.js"(exports, module) {
      var fs2 = require_fs();
      var path = require_path();
      var { DATA_DIR } = require_persistence();
      var USER_DIR = path.join(DATA_DIR, "audio");
      var EXTS = [".mp3", ".wav", ".ogg", ".m4a", ".aac", ".webm"];
      var MAX_BYTES = 12 * 1024 * 1024;
      var MAX_FILES = 60;
      var PRESETS = [
        { id: "gol-buzina-torcida", name: "Buzina + torcida", cue: "gol", desc: "Buzina de est\xE1dio com a torcida explodindo (5 s)" },
        { id: "gol-torcida", name: "Torcida explodindo", cue: "gol", desc: "S\xF3 a torcida, com pancada de graves no in\xEDcio (5,5 s)" },
        { id: "gol-sino", name: "Sino de gol", cue: "gol", desc: "Sequ\xEAncia de sinos subindo + festa curta (3,4 s)" },
        { id: "sub-sino-duplo", name: "Sino duplo", cue: "sub", desc: "Dois toques de sino, limpo e discreto (1,7 s)" },
        { id: "sub-bip", name: "Bip de painel", cue: "sub", desc: "Bips curtos, como painel eletr\xF4nico do quarto \xE1rbitro (0,8 s)" },
        { id: "sub-passagem", name: "Passagem + toque", cue: "sub", desc: "Varredura r\xE1pida e um toque de sino (1,5 s)" },
        { id: "amarelo-apito", name: "Apito curto", cue: "yellow", desc: "Um apito seco (0,45 s)" },
        { id: "amarelo-alerta", name: "Apito + alerta", cue: "yellow", desc: "Apito e dois bips de alerta (1 s)" },
        { id: "amarelo-toque", name: "Toque seco", cue: "yellow", desc: "Dois toques secos, sem apito (0,6 s)" },
        { id: "vermelho-apito-longo", name: "Apito longo", cue: "red", desc: "Apito curto e um longo (1,7 s)" },
        { id: "vermelho-buzina-grave", name: "Buzina grave", cue: "red", desc: "Buzina grave e pesada (1,4 s)" },
        { id: "vermelho-sirene", name: "Sirene curta", cue: "red", desc: "Sirene subindo e descendo (1,5 s)" },
        { id: "anulado-buzina-descendente", name: "Buzina descendente", cue: "annul", desc: "Buzina que desce de tom, como \u201Cn\xE3o valeu\u201D (1,3 s)" },
        { id: "anulado-erro", name: "Erro (bu-bum)", cue: "annul", desc: "Dois tons graves descendo (1,3 s)" },
        { id: "anulado-apito-triplo", name: "Apito triplo", cue: "annul", desc: "Dois apitos curtos e um longo (1,3 s)" },
        { id: "buzina", name: "Buzina", cue: "pad", desc: "Buzina curta (1 s)" },
        { id: "torcida", name: "Torcida", cue: "pad", desc: "Torcida em ambiente, entra e sai suave (7 s)" },
        { id: "apito-final", name: "Apito final", cue: "pad", desc: "Dois apitos curtos e um longo (2,4 s)" },
        { id: "palmas", name: "Palmas", cue: "pad", desc: "Palmas de plateia (4 s)" },
        { id: "sirene", name: "Sirene", cue: "pad", desc: "Sirene de alerta (2,2 s)" },
        { id: "tambor", name: "Tambor", cue: "pad", desc: "Batida de bumbo e caixa (4 s)" },
        { id: "suspense", name: "Suspense", cue: "pad", desc: "Som subindo, para criar expectativa (3,2 s)" },
        { id: "vinheta", name: "Vinheta", cue: "pad", desc: "Sequ\xEAncia de sinos, para abrir um quadro (2,4 s)" }
      ];
      var PRESET_IDS = new Set(PRESETS.map((p) => p.id));
      var CUES = ["gol", "sub", "yellow", "red", "annul"];
      var PAD_COUNT = 8;
      function ensureDir() {
        if (!fs2.existsSync(USER_DIR)) fs2.mkdirSync(USER_DIR, { recursive: true });
      }
      function safeFileName(name) {
        const ext = path.extname(String(name || "")).toLowerCase();
        const base = path.basename(String(name || ""), path.extname(String(name || ""))).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._ -]/g, "").replace(/\s+/g, "-").replace(/^[.-]+/, "").slice(0, 60) || "audio";
        return { base, ext };
      }
      function listUser() {
        ensureDir();
        return fs2.readdirSync(USER_DIR).filter((f) => EXTS.includes(path.extname(f).toLowerCase())).map((f) => {
          const st = fs2.statSync(path.join(USER_DIR, f));
          return { file: f, name: path.basename(f, path.extname(f)).replace(/-/g, " "), size: st.size, addedAt: st.mtimeMs };
        }).sort((a, b) => b.addedAt - a.addedAt);
      }
      function saveUser(originalName, buffer) {
        const { base, ext } = safeFileName(originalName);
        if (!EXTS.includes(ext)) throw new Error("Formato n\xE3o aceito. Use .mp3, .wav, .ogg, .m4a, .aac ou .webm.");
        if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new Error("Arquivo vazio.");
        if (buffer.length > MAX_BYTES) throw new Error(`Arquivo grande demais (m\xE1ximo ${Math.round(MAX_BYTES / 1048576)} MB).`);
        if (listUser().length >= MAX_FILES) throw new Error(`Limite de ${MAX_FILES} \xE1udios. Apague algum para enviar outro.`);
        ensureDir();
        let file = base + ext, n = 2;
        while (fs2.existsSync(path.join(USER_DIR, file))) file = `${base}-${n++}${ext}`;
        fs2.writeFileSync(path.join(USER_DIR, file), buffer);
        return file;
      }
      function deleteUser(file) {
        const f = path.basename(String(file || ""));
        const p = path.join(USER_DIR, f);
        if (!EXTS.includes(path.extname(f).toLowerCase()) || !fs2.existsSync(p)) throw new Error("\xC1udio n\xE3o encontrado.");
        fs2.unlinkSync(p);
        return f;
      }
      function resolveUrl(src) {
        const s = String(src || "");
        if (s.startsWith("preset:")) {
          const id = s.slice(7);
          return PRESET_IDS.has(id) ? `/audio/presets/${id}.mp3` : null;
        }
        if (s.startsWith("user:")) {
          const f = path.basename(s.slice(5));
          return fs2.existsSync(path.join(USER_DIR, f)) ? `/audio/user/${encodeURIComponent(f)}` : null;
        }
        return null;
      }
      var clamp01 = (n) => Math.max(0, Math.min(1, n));
      function buildPlay(audio, key, { force = false } = {}) {
        if (!audio) return null;
        let src, vol, label;
        const m = /^pad(\d+)$/.exec(key);
        if (m) {
          const i = Number(m[1]);
          if (i < 1 || i > PAD_COUNT) return null;
          src = audio[`pad${i}Src`];
          vol = audio[`pad${i}Vol`];
          label = audio[`pad${i}Label`] || `Bot\xE3o ${i}`;
        } else if (CUES.includes(key)) {
          if (!force && (!audio.autoEnabled || !audio[`${key}On`])) return null;
          src = audio[`${key}Src`];
          vol = audio[`${key}Vol`];
          label = key;
        } else return null;
        const url = resolveUrl(src);
        if (!url) return null;
        const volume = clamp01(Number(audio.masterVolume) / 100 * (Number(vol) / 100));
        return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, key, url, volume, label };
      }
      function activeUrls(audio) {
        const urls = /* @__PURE__ */ new Set();
        if (!audio) return [];
        CUES.forEach((c) => {
          const u = resolveUrl(audio[`${c}Src`]);
          if (u) urls.add(u);
        });
        for (let i = 1; i <= PAD_COUNT; i++) {
          const u = resolveUrl(audio[`pad${i}Src`]);
          if (u) urls.add(u);
        }
        return [...urls];
      }
      function clearReferences(audio, file) {
        if (!audio) return false;
        const ref2 = `user:${file}`;
        let changed = false;
        for (const k of Object.keys(audio)) {
          if (/Src$/.test(k) && audio[k] === ref2) {
            audio[k] = "";
            changed = true;
          }
        }
        return changed;
      }
      module.exports = { USER_DIR, PRESETS, CUES, PAD_COUNT, listUser, saveUser, deleteUser, resolveUrl, buildPlay, activeUrls, clearReferences, ensureDir };
    }
  });

  // engine-src/server/sockets.js
  var require_sockets = __commonJS({
    "engine-src/server/sockets.js"(exports, module) {
      var runtime = require_runtime();
      var teamsStore = require_teamsStore();
      var { getDefaultState, getDefaultMatchSide, getDefaultShootout, getDefaultFinalCard, getDefaultOfficials } = require_defaultState();
      var { mergeCustomization, VISUAL_SLOTS } = require_persistence();
      var shootoutRules = require_shootout();
      var audio = require_audio();
      var informativos = require_informativos();
      var stadium = require_stadium();
      var { computeDisplayMinute, computeDisplayMinuteFromMinute, computeCurrentSeconds, PERIOD_ORDER } = runtime;
      var SOURCE_BY_PATH = {
        "/arte": "escalacao",
        "/arte/placar": "placar",
        "/arte/eventos": "eventos",
        "/arte/linha-do-tempo": "linhaDoTempo",
        "/arte/penaltis": "penaltis",
        "/arte/fim-de-jogo": "fimDeJogo",
        "/arte/audio": "audio",
        "/arte/informativos": "informativos",
        "/arte/classificacao": "classificacao"
      };
      var FORBIDDEN_KEYS = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
      var RESET_SECTIONS = {
        placar: (d) => ["customization", "placar", d.customization.placar],
        eventos: (d) => ["customization", "eventos", d.customization.eventos],
        linhaDoTempo: (d) => ["customization", "linhaDoTempo", d.customization.linhaDoTempo],
        effects: (d) => ["customization", "effects", d.customization.effects],
        penaltis: (d) => ["customization", "penaltis", d.customization.penaltis],
        fimDeJogo: (d) => ["customization", "fimDeJogo", d.customization.fimDeJogo],
        audio: (d) => ["customization", "audio", d.customization.audio],
        classificacao: (d) => ["customization", "classificacao", d.customization.classificacao],
        outrosJogos: (d) => ["customization", "outrosJogos", d.customization.outrosJogos],
        arbitragem: (d) => ["customization", "arbitragem", d.customization.arbitragem],
        estadio: (d) => ["customization", "estadio", d.customization.estadio]
      };
      var MAX_UNDO = 60;
      var otherSide = (side) => side === "home" ? "away" : "home";
      var scoringSide = (ev) => ev.type === "goal" && ev.goalType === "own" ? otherSide(ev.side) : ev.side;
      function detectClient(socket) {
        const q = socket.handshake.query || {};
        if (q.kind !== "arte") return { kind: "panel", source: null, preview: false };
        let source = null, preview = false;
        try {
          const u = new URL(socket.handshake.headers.referer || "");
          source = SOURCE_BY_PATH[u.pathname.replace(/\/+$/, "") || "/"] || null;
          preview = u.searchParams.get("preview") === "1";
        } catch (_) {
        }
        return { kind: "arte", source, preview };
      }
      function setup(io2) {
        const playCue = (cue) => {
          const req = audio.buildPlay(runtime.getState().customization.audio, cue);
          if (req) io2.emit("audio:play", req);
        };
        runtime.setIo(io2);
        const clients = {};
        const TRACKED = ["match", "league", "others", "officials", "stadium", "summary", "meta", "modules", "customization", "visuals"];
        const undoStack = [];
        const redoStack = [];
        const undoInfo = () => ({
          count: undoStack.length,
          label: undoStack.length ? undoStack[undoStack.length - 1].label : null,
          redoCount: redoStack.length,
          redoLabel: redoStack.length ? redoStack[redoStack.length - 1].label : null
        });
        const broadcastUndo = () => io2.emit("undo:sync", undoInfo());
        function copyTracked() {
          const st = runtime.getState(), snap = {};
          TRACKED.forEach((k) => {
            if (st[k] !== void 0) snap[k] = JSON.parse(JSON.stringify(k === "match" ? { ...st.match, clock: void 0 } : st[k]));
          });
          return snap;
        }
        const keyOfSnap = (snap) => JSON.stringify(snap);
        function restoreTracked(snap) {
          const st = runtime.getState();
          const cur = { match: st.match, league: st.league, others: st.others, officials: st.officials, stadium: st.stadium };
          if (snap.match) {
            snap.match.clock = cur.match.clock;
            snap.match.finalCard = cur.match.finalCard;
            if (snap.match.shootout && cur.match.shootout) snap.match.shootout.visible = cur.match.shootout.visible;
          }
          if (snap.league && cur.league) snap.league.visible = cur.league.visible;
          if (snap.others && cur.others) snap.others.visible = cur.others.visible;
          if (snap.officials && cur.officials) {
            snap.officials.refVisible = cur.officials.refVisible;
            snap.officials.varVisible = cur.officials.varVisible;
          }
          if (snap.stadium && cur.stadium) snap.stadium.visible = cur.stadium.visible;
          TRACKED.forEach((k) => {
            if (snap[k] !== void 0) st[k] = snap[k];
          });
        }
        const MAX_UNDO_AGE_MERGE = 2e3;
        const UNTRACKED = /^(clock:|undo:|redo:|audio:|art:|teams:|placar:test|visual:rename)|:setVisible$|toggleEventVisibility$|^finalcard:/;
        const CATEGORY = [
          [/^(match:|shootout:)/, "Partida"],
          [/^(league:|others:)/, "Classifica\xE7\xE3o"],
          [/^officials:/, "Arbitragem"],
          [/^stadium:/, "Est\xE1dio"],
          [/^summary:/, "Resumo"],
          [/^(settings:|visual:)/, "Arte"]
        ];
        const ART_NAMES = {
          placar: "Placar",
          eventos: "Eventos",
          linhaDoTempo: "Linha do tempo",
          effects: "Efeitos",
          penaltis: "P\xEAnaltis",
          fimDeJogo: "Fim de jogo",
          audio: "\xC1udio",
          classificacao: "Classifica\xE7\xE3o",
          outrosJogos: "Outros jogos",
          arbitragem: "Arbitragem",
          estadio: "Est\xE1dio",
          escalacao: "Escala\xE7\xE3o"
        };
        const LABELS = {
          "league:setMeta": "Dados da tabela",
          "league:setMode": "Tabela: modo",
          "league:setRow": "Tabela: time alterado",
          "league:addRow": "Tabela: time adicionado",
          "league:removeRow": "Tabela: time removido",
          "league:moveRow": "Tabela: time movido",
          "league:sortByPoints": "Tabela ordenada por pontos",
          "league:bulk": "Tabela colada",
          "league:resetPoints": "Pontos zerados",
          "league:resetAll": "Tabela reiniciada",
          "league:setZone": "Zona da tabela",
          "league:addZone": "Zona adicionada",
          "league:removeZone": "Zona removida",
          "league:resetZones": "Zonas restauradas",
          "others:addGame": "Outro jogo adicionado",
          "others:updateGame": "Outro jogo alterado",
          "others:score": "Gol em outro jogo",
          "others:removeGame": "Outro jogo removido",
          "others:clear": "Outros jogos limpos",
          "others:commitGame": "Resultado lan\xE7ado na tabela",
          "officials:set": "Arbitragem alterada",
          "officials:clear": "Arbitragem limpa",
          "stadium:set": "Dados do est\xE1dio",
          "stadium:addPhoto": "Foto do est\xE1dio adicionada",
          "stadium:removePhoto": "Foto do est\xE1dio removida",
          "stadium:movePhoto": "Foto do est\xE1dio movida",
          "stadium:clear": "Est\xE1dio limpo",
          "summary:set": "Op\xE7\xF5es do resumo",
          "settings:resetSection": "Ajustes da arte restaurados",
          "visual:save": "Visual salvo",
          "visual:load": "Visual carregado",
          "visual:delete": "Visual apagado",
          "state:update": "Estado atualizado",
          "match:setStatus": "Situa\xE7\xE3o da partida",
          "shootout:setFirst": "Quem cobra primeiro",
          "shootout:flip": "Cobran\xE7a invertida",
          "match:setSide": "Time / escala\xE7\xE3o alterado"
        };
        function labelFor(event, args) {
          if (event === "settings:patch") {
            const parts = String(args[0] && args[0].path || "").split(".");
            if (parts[0] === "customization") return `Arte \u2014 ${ART_NAMES[parts[1]] || parts[1] || "ajuste"}`;
            return parts[0] === "meta" ? "Dados da transmiss\xE3o" : parts[0] === "modules" ? "M\xF3dulos ligados" : "Ajuste";
          }
          if (event === "settings:resetSection") return `Arte \u2014 ${ART_NAMES[args[0]] || args[0] || ""} restaurada`.replace("  ", " ");
          return LABELS[event] || event;
        }
        function mergeKey(event, args) {
          const a = args[0];
          if (event === "settings:patch") return "sp:" + (a && a.path);
          if (event === "league:setRow" || event === "others:updateGame") return event + ":" + (a && (a.id || "")) + ":" + (a && a.patch ? Object.keys(a.patch).sort().join(",") : "");
          if (event === "officials:set") return event + ":" + (a && a.key);
          if (event === "stadium:set" || event === "summary:set") return event + ":" + (a && typeof a === "object" ? Object.keys(a).sort().join(",") : "");
          if (event === "league:setMeta") return event;
          return null;
        }
        const categoryOf = (event) => {
          const c = CATEGORY.find(([re]) => re.test(event));
          return c ? c[1] : "Geral";
        };
        let pendingLabel = null;
        function pushUndo(label) {
          pendingLabel = label;
        }
        function trackEvent(event, args) {
          if (UNTRACKED.test(event)) return;
          const before = copyTracked(), beforeKey = keyOfSnap(before);
          pendingLabel = null;
          setImmediate(() => {
            const after = copyTracked();
            if (keyOfSnap(after) === beforeKey) {
              pendingLabel = null;
              return;
            }
            const key = mergeKey(event, args), now = Date.now(), last = undoStack[undoStack.length - 1];
            redoStack.length = 0;
            if (key && last && last.key === key && now - last.at < MAX_UNDO_AGE_MERGE) {
              last.at = now;
              broadcastUndo();
              return;
            }
            undoStack.push({ label: pendingLabel || labelFor(event, args), category: categoryOf(event), key, at: now, snap: before });
            pendingLabel = null;
            if (undoStack.length > MAX_UNDO) undoStack.shift();
            broadcastUndo();
          });
        }
        function doUndo() {
          const entry = undoStack.pop();
          if (!entry) return null;
          redoStack.push({ label: entry.label, category: entry.category, at: entry.at, snap: copyTracked() });
          restoreTracked(entry.snap);
          return entry;
        }
        function doRedo() {
          const entry = redoStack.pop();
          if (!entry) return null;
          undoStack.push({ label: entry.label, category: entry.category, key: null, at: entry.at, snap: copyTracked() });
          restoreTracked(entry.snap);
          return entry;
        }
        function broadcastConnectionInfo() {
          const arr = Object.values(clients);
          const sources = { escalacao: 0, placar: 0, eventos: 0, linhaDoTempo: 0, penaltis: 0, fimDeJogo: 0, audio: 0, informativos: 0, classificacao: 0 };
          arr.forEach((c) => {
            if (c.kind === "arte" && !c.preview && c.source) sources[c.source]++;
          });
          io2.emit("connections:sync", {
            total: arr.length,
            arte: arr.filter((c) => c.kind === "arte" && !c.preview).length,
            // Browser Sources reais (OBS)
            previews: arr.filter((c) => c.kind === "arte" && c.preview).length,
            panel: arr.filter((c) => c.kind === "panel").length,
            sources,
            lastUpdate: Date.now()
          });
        }
        setInterval(() => {
          var _a;
          const clock = runtime.getState().match.clock;
          if (!clock.running) return;
          const secondsNow = computeCurrentSeconds();
          io2.emit("clock:tick", {
            seconds: secondsNow,
            addedTime: (_a = clock.addedTime) != null ? _a : null,
            period: clock.period || "1t",
            displayMinute: computeDisplayMinute(secondsNow, clock.period || "1t"),
            stoppageLabel: clock.stoppageLabel || null
            // compat v3.0
          });
        }, 1e3);
        io2.on("connection", (socket) => {
          clients[socket.id] = { ...detectClient(socket), connectedAt: Date.now() };
          const S = () => runtime.getState();
          const commit = runtime.commit;
          socket.emit("state:sync", S());
          socket.emit("teams:sync", teamsStore.listTeams());
          socket.emit("undo:sync", undoInfo());
          socket.onAny((event, ...args) => trackEvent(event, args));
          broadcastConnectionInfo();
          informativos.register(socket, { S, commit, io: io2 });
          stadium.register(socket, { S, commit });
          socket.on("settings:patch", (payload) => {
            if (!payload || typeof payload.path !== "string") return;
            const parts = payload.path.split(".");
            if (!["meta", "modules", "customization"].includes(parts[0])) return;
            if (parts.some((k) => FORBIDDEN_KEYS.has(k) || k === "")) return;
            const defaults = getDefaultState();
            let defTarget = defaults, target = S();
            for (let i = 0; i < parts.length - 1; i++) {
              defTarget = defTarget && defTarget[parts[i]];
              if (!target[parts[i]] || typeof target[parts[i]] !== "object") target[parts[i]] = {};
              target = target[parts[i]];
            }
            const last = parts[parts.length - 1];
            const defVal = defTarget ? defTarget[last] : void 0;
            if (defVal === void 0 || defVal !== null && typeof defVal === "object") return;
            let value = payload.value;
            if (typeof defVal === "number") {
              value = Number(value);
              if (!Number.isFinite(value)) return;
            } else if (typeof defVal === "boolean") value = !!value;
            else value = String(value == null ? "" : value).slice(0, 300);
            target[last] = value;
            commit();
          });
          socket.on("settings:resetSection", (section) => {
            const fn = RESET_SECTIONS[section];
            if (section === "escalacao") {
              const d = getDefaultState().customization;
              for (const k of Object.keys(d)) {
                if (typeof d[k] !== "object") S().customization[k] = d[k];
              }
              commit();
              return;
            }
            if (!fn) return;
            const [root, key, value] = fn(getDefaultState());
            S()[root][key] = JSON.parse(JSON.stringify(value));
            commit();
          });
          socket.on("state:update", (incoming) => {
            if (!incoming || typeof incoming !== "object") return;
            const cur = S();
            if (incoming.meta) cur.meta = { ...cur.meta, ...incoming.meta };
            if (incoming.modules) cur.modules = { ...cur.modules, ...incoming.modules };
            if (incoming.customization) {
              const c = incoming.customization;
              cur.customization = {
                ...cur.customization,
                ...c,
                effects: { ...cur.customization.effects, ...c.effects || {} },
                placar: { ...cur.customization.placar, ...c.placar || {} },
                eventos: { ...cur.customization.eventos, ...c.eventos || {} },
                linhaDoTempo: { ...cur.customization.linhaDoTempo, ...c.linhaDoTempo || {} },
                penaltis: { ...cur.customization.penaltis, ...c.penaltis || {} },
                fimDeJogo: { ...cur.customization.fimDeJogo, ...c.fimDeJogo || {} }
              };
            }
            commit();
          });
          socket.on("teams:list", () => socket.emit("teams:sync", teamsStore.listTeams()));
          socket.on("teams:save", (team, ack) => {
            try {
              const saved = teamsStore.saveTeam(team || {});
              runtime.broadcastTeams();
              if (typeof ack === "function") ack({ ok: true, team: saved });
            } catch (err) {
              console.error("[teams:save]", err.message);
              if (typeof ack === "function") ack({ ok: false, error: err.message });
            }
          });
          socket.on("teams:delete", (teamId, ack) => {
            try {
              teamsStore.deleteTeam(teamId);
              let touched = false;
              for (const side of ["home", "away"]) {
                if (S().match[side].teamId === teamId) {
                  S().match[side] = getDefaultMatchSide();
                  touched = true;
                }
              }
              if (touched) commit();
              runtime.broadcastTeams();
              if (typeof ack === "function") ack({ ok: true });
            } catch (err) {
              console.error("[teams:delete]", err.message);
              if (typeof ack === "function") ack({ ok: false, error: err.message });
            }
          });
          socket.on("match:setSide", ({ side, data } = {}) => {
            if (side !== "home" && side !== "away" || !data || typeof data !== "object") return;
            const allowed = {};
            if ("teamId" in data) allowed.teamId = data.teamId ? teamsStore.sanitizeId(data.teamId) || null : null;
            if ("starterIds" in data && Array.isArray(data.starterIds)) allowed.starterIds = data.starterIds.map(String).slice(0, 11);
            if ("captainId" in data) allowed.captainId = data.captainId ? String(data.captainId) : null;
            if ("benchIds" in data && Array.isArray(data.benchIds)) allowed.benchIds = [...new Set(data.benchIds.map(String))].slice(0, 15);
            if ("lineupStats" in data && data.lineupStats && typeof data.lineupStats === "object") allowed.lineupStats = data.lineupStats;
            pushUndo("teamId" in allowed ? "Troca de time" : "Escala\xE7\xE3o alterada");
            const merged = { ...S().match[side], ...allowed };
            if (Array.isArray(merged.benchIds)) merged.benchIds = merged.benchIds.filter((id) => !merged.starterIds.includes(id));
            S().match[side] = merged;
            commit();
          });
          socket.on("match:setScore", ({ home, away } = {}) => {
            pushUndo("Placar alterado");
            if (typeof home === "number" && Number.isFinite(home)) S().match.score.home = Math.max(0, Math.floor(home));
            if (typeof away === "number" && Number.isFinite(away)) S().match.score.away = Math.max(0, Math.floor(away));
            commit();
          });
          socket.on("clock:start", () => {
            const clock = S().match.clock;
            if (!clock.running) {
              clock.running = true;
              clock.runningSince = Date.now();
              S().match.statusLabel = null;
              commit();
            }
          });
          socket.on("clock:pause", () => {
            const clock = S().match.clock;
            if (clock.running) {
              clock.seconds = computeCurrentSeconds();
              clock.running = false;
              clock.runningSince = null;
              commit();
            }
          });
          socket.on("clock:reset", () => {
            const old = S().match.clock;
            S().match.clock = { seconds: 0, running: false, period: old.period || "1t", addedTime: null, stoppageLabel: null, runningSince: null };
            S().match.statusLabel = null;
            commit();
          });
          socket.on("clock:setSeconds", (seconds) => {
            const clock = S().match.clock;
            const n = Number(seconds);
            if (!Number.isFinite(n)) return;
            clock.seconds = Math.max(0, Math.floor(n));
            if (clock.running) clock.runningSince = Date.now();
            commit();
          });
          socket.on("clock:addSeconds", (delta) => {
            const clock = S().match.clock;
            const n = Number(delta);
            if (!Number.isFinite(n)) return;
            clock.seconds = Math.max(0, computeCurrentSeconds() + Math.floor(n));
            clock.runningSince = clock.running ? Date.now() : null;
            commit();
          });
          socket.on("clock:setStoppage", (label) => {
            S().match.clock.stoppageLabel = label || null;
            commit();
          });
          socket.on("clock:setPeriod", (period) => {
            if (!PERIOD_ORDER.includes(period)) return;
            S().match.clock.period = period;
            S().match.statusLabel = null;
            commit();
          });
          socket.on("clock:nextPeriod", () => {
            const clock = S().match.clock;
            const idx = PERIOD_ORDER.indexOf(clock.period || "1t");
            if (idx < 0 || idx >= PERIOD_ORDER.length - 1) return;
            S().match.clock = { seconds: 0, running: false, period: PERIOD_ORDER[idx + 1], addedTime: null, stoppageLabel: null, runningSince: null };
            S().match.statusLabel = null;
            commit();
          });
          socket.on("clock:setAddedTime", (minutes) => {
            const parsed = minutes === null || minutes === "" || minutes === void 0 ? null : parseInt(minutes, 10);
            S().match.clock.addedTime = Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
            commit();
          });
          socket.on("match:setStatus", (status) => {
            pushUndo("R\xF3tulo do placar");
            const clock = S().match.clock;
            if (status === "intervalo" || status === "fim") {
              if (clock.running) {
                clock.seconds = computeCurrentSeconds();
                clock.running = false;
                clock.runningSince = null;
              }
              S().match.statusLabel = status;
            } else S().match.statusLabel = null;
            commit();
          });
          socket.on("match:addEvent", (event) => {
            var _a;
            if (!event || typeof event !== "object" || !["goal", "yellow", "red", "sub"].includes(event.type)) return;
            if (!event.playerId) return;
            const clock = S().match.clock;
            const secondsNow = computeCurrentSeconds();
            const period = PERIOD_ORDER.includes(event.period) ? event.period : clock.period || "1t";
            const minuteForDisplay = typeof event.minute === "number" && event.minute >= 0 ? Math.floor(event.minute) : Math.floor(secondsNow / 60);
            const str = (v, n = 120) => String(v == null ? "" : v).slice(0, n);
            const fullEvent = {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              minute: minuteForDisplay,
              secondsElapsed: secondsNow,
              period,
              displayMinute: computeDisplayMinuteFromMinute(minuteForDisplay, period),
              addedTime: (_a = clock.addedTime) != null ? _a : null,
              stoppageLabel: null,
              showOnAir: event.showOnAir === false ? false : true,
              atInterval: S().match.statusLabel === "intervalo",
              // v6.0 — lançado durante o intervalo (aparece no resumo da partida)
              type: event.type,
              side: event.side === "away" ? "away" : "home",
              playerId: str(event.playerId, 80),
              playerName: str(event.playerName),
              secondaryPlayerId: event.secondaryPlayerId ? str(event.secondaryPlayerId, 80) : void 0,
              secondaryPlayerName: event.secondaryPlayerName ? str(event.secondaryPlayerName) : void 0,
              note: event.note ? str(event.note, 300) : void 0
            };
            if (fullEvent.type === "goal") fullEvent.goalType = ["penalty", "own"].includes(event.goalType) ? event.goalType : "normal";
            pushUndo({ goal: "Gol", yellow: "Cart\xE3o amarelo", red: "Cart\xE3o vermelho", sub: "Substitui\xE7\xE3o" }[fullEvent.type] + (fullEvent.playerName ? ` \u2014 ${fullEvent.playerName}` : ""));
            S().match.events.push(fullEvent);
            if (fullEvent.type === "goal" && fullEvent.showOnAir) {
              const pc = S().customization.placar;
              if (pc.goalExpandsCompact !== false && pc.compact) pc.compact = false;
            }
            if (fullEvent.showOnAir) playCue(fullEvent.type === "sub" ? "sub" : fullEvent.type === "goal" ? "gol" : fullEvent.type);
            const side = fullEvent.side;
            const matchSide = S().match[side];
            const stats = matchSide.lineupStats;
            const blank = () => ({ yellowCards: 0, redCards: 0, goals: 0, substituted: false, enteredGame: false });
            if (!stats[fullEvent.playerId]) stats[fullEvent.playerId] = blank();
            if (fullEvent.type === "goal") {
              if (fullEvent.goalType === "own") {
                stats[fullEvent.playerId].ownGoals = (stats[fullEvent.playerId].ownGoals || 0) + 1;
              } else {
                stats[fullEvent.playerId].goals += 1;
              }
              S().match.score[scoringSide(fullEvent)] += 1;
            } else if (fullEvent.type === "yellow") {
              stats[fullEvent.playerId].yellowCards += 1;
            } else if (fullEvent.type === "red") {
              stats[fullEvent.playerId].redCards += 1;
            } else if (fullEvent.type === "sub") {
              stats[fullEvent.playerId].substituted = true;
              if (fullEvent.secondaryPlayerId) {
                if (!stats[fullEvent.secondaryPlayerId]) stats[fullEvent.secondaryPlayerId] = blank();
                stats[fullEvent.secondaryPlayerId].enteredGame = true;
                const starterIds = matchSide.starterIds;
                const idx = starterIds.indexOf(fullEvent.playerId);
                if (idx !== -1) starterIds[idx] = fullEvent.secondaryPlayerId;
                else if (!starterIds.includes(fullEvent.secondaryPlayerId)) starterIds.push(fullEvent.secondaryPlayerId);
                if (matchSide.captainId === fullEvent.playerId) matchSide.captainId = null;
              }
            }
            commit();
          });
          socket.on("match:toggleEventVisibility", (eventId) => {
            const ev = S().match.events.find((e) => e.id === eventId);
            if (ev) {
              ev.showOnAir = !ev.showOnAir;
              commit();
            }
          });
          socket.on("match:removeEvent", (eventId) => {
            const ev = S().match.events.find((e) => e.id === eventId);
            if (!ev) return;
            pushUndo("Evento removido");
            S().match.events = S().match.events.filter((e) => e.id !== eventId);
            const side = ev.side === "away" ? "away" : "home";
            const matchSide = S().match[side];
            const stats = matchSide.lineupStats[ev.playerId];
            if (ev.type === "goal" && !ev.annulled) {
              const sc = scoringSide(ev);
              S().match.score[sc] = Math.max(0, S().match.score[sc] - 1);
              if (stats) {
                if (ev.goalType === "own") stats.ownGoals = Math.max(0, (stats.ownGoals || 0) - 1);
                else stats.goals = Math.max(0, stats.goals - 1);
              }
            } else if (ev.type === "yellow" && stats) {
              stats.yellowCards = Math.max(0, stats.yellowCards - 1);
            } else if (ev.type === "red" && stats) {
              stats.redCards = Math.max(0, stats.redCards - 1);
            } else if (ev.type === "sub" && ev.secondaryPlayerId) {
              const idx = matchSide.starterIds.indexOf(ev.secondaryPlayerId);
              if (idx !== -1 && !matchSide.starterIds.includes(ev.playerId)) matchSide.starterIds[idx] = ev.playerId;
              if (stats) stats.substituted = false;
              const inStats = matchSide.lineupStats[ev.secondaryPlayerId];
              if (inStats) inStats.enteredGame = false;
            }
            commit();
          });
          socket.on("match:annulGoal", (data) => {
            const d = data && typeof data === "object" ? data : { eventId: data };
            const ev = S().match.events.find((e) => e.id === d.eventId);
            if (!ev || ev.type !== "goal" || ev.annulled) return;
            pushUndo(`Gol anulado \u2014 ${ev.playerName || ""}`.trim());
            ev.annulled = true;
            if (d.note) ev.annulNote = String(d.note).slice(0, 60);
            playCue("annul");
            const sc = scoringSide(ev);
            S().match.score[sc] = Math.max(0, S().match.score[sc] - 1);
            const stats = S().match[ev.side === "away" ? "away" : "home"].lineupStats[ev.playerId];
            if (stats) {
              if (ev.goalType === "own") stats.ownGoals = Math.max(0, (stats.ownGoals || 0) - 1);
              else stats.goals = Math.max(0, (stats.goals || 0) - 1);
            }
            commit();
          });
          socket.on("finalcard:setVisible", (visible) => {
            S().match.finalCard = { ...getDefaultFinalCard(), ...S().match.finalCard || {}, visible: !!visible };
            commit();
          });
          socket.on("summary:set", (d = {}) => {
            if (!d || typeof d !== "object") return;
            const sm = S().summary || (S().summary = { title: "", off: [] });
            if (typeof d.title === "string") sm.title = d.title.slice(0, 80);
            if (typeof d.key === "string" && /^[a-z]{3,12}$/.test(d.key)) {
              const off = new Set(sm.off);
              if (d.on) off.delete(d.key);
              else off.add(d.key);
              sm.off = [...off];
            }
            commit();
          });
          socket.on("art:replay", (target) => {
            if (["placar", "escalacao", "fimDeJogo", "penaltis"].includes(target)) io2.emit("art:replay", target);
          });
          socket.on("undo:last", (ack) => {
            const entry = doUndo();
            if (!entry) {
              if (typeof ack === "function") ack({ ok: false });
              return;
            }
            broadcastUndo();
            commit();
            if (typeof ack === "function") ack({ ok: true, label: entry.label });
          });
          socket.on("redo:last", (ack) => {
            const entry = doRedo();
            if (!entry) {
              if (typeof ack === "function") ack({ ok: false });
              return;
            }
            broadcastUndo();
            commit();
            if (typeof ack === "function") ack({ ok: true, label: entry.label });
          });
          socket.on("undo:list", (ack) => {
            if (typeof ack !== "function") return;
            const map = (arr) => arr.map((e) => ({ label: e.label, category: e.category || "", at: e.at })).reverse();
            ack({ undo: map(undoStack), redo: map(redoStack) });
          });
          socket.on("undo:to", (steps, ack) => {
            const n = Math.max(1, Math.min(undoStack.length, Math.floor(Number(steps)) || 0));
            let last = null, done = 0;
            for (let i = 0; i < n; i++) {
              const e = doUndo();
              if (!e) break;
              last = e;
              done++;
            }
            if (done) {
              broadcastUndo();
              commit();
            }
            if (typeof ack === "function") ack({ ok: done > 0, steps: done, label: last && last.label });
          });
          socket.on("redo:to", (steps, ack) => {
            const n = Math.max(1, Math.min(redoStack.length, Math.floor(Number(steps)) || 0));
            let last = null, done = 0;
            for (let i = 0; i < n; i++) {
              const e = doRedo();
              if (!e) break;
              last = e;
              done++;
            }
            if (done) {
              broadcastUndo();
              commit();
            }
            if (typeof ack === "function") ack({ ok: done > 0, steps: done, label: last && last.label });
          });
          socket.on("visual:save", ({ slot, name } = {}) => {
            const i = Number(slot);
            if (!Number.isInteger(i) || i < 0 || i >= VISUAL_SLOTS) return;
            if (!Array.isArray(S().visuals)) S().visuals = Array(VISUAL_SLOTS).fill(null);
            const prev = S().visuals[i];
            S().visuals[i] = {
              name: String(name || prev && prev.name || `Visual ${i + 1}`).slice(0, 40),
              savedAt: Date.now(),
              customization: (() => {
                const c = JSON.parse(JSON.stringify(S().customization));
                delete c.audio;
                return c;
              })()
              // sons não fazem parte do visual
            };
            commit();
          });
          socket.on("visual:rename", ({ slot, name } = {}) => {
            const v = Array.isArray(S().visuals) ? S().visuals[Number(slot)] : null;
            if (!v) return;
            v.name = String(name || "").trim().slice(0, 40) || v.name;
            commit();
          });
          socket.on("visual:load", (slot) => {
            const v = Array.isArray(S().visuals) ? S().visuals[Number(slot)] : null;
            if (!v) return;
            const keepAudio = S().customization.audio;
            S().customization = mergeCustomization(getDefaultState().customization, JSON.parse(JSON.stringify(v.customization)));
            S().customization.audio = keepAudio || getDefaultState().customization.audio;
            commit();
          });
          socket.on("visual:delete", (slot) => {
            const i = Number(slot);
            if (!Array.isArray(S().visuals) || !Number.isInteger(i) || i < 0 || i >= VISUAL_SLOTS) return;
            S().visuals[i] = null;
            commit();
          });
          socket.on("match:reset", () => {
            pushUndo("Partida reiniciada");
            const m = S().match;
            m.home = { ...getDefaultMatchSide(), teamId: m.home.teamId };
            m.away = { ...getDefaultMatchSide(), teamId: m.away.teamId };
            m.score = { home: 0, away: 0 };
            m.clock = { seconds: 0, running: false, stoppageLabel: null, period: "1t", addedTime: null, runningSince: null };
            m.events = [];
            m.statusLabel = null;
            m.shootout = getDefaultShootout();
            m.finalCard = getDefaultFinalCard();
            S().officials = { ...getDefaultOfficials(), refVisible: false, varVisible: false };
            commit();
          });
          socket.on("placar:testGoal", (side) => io2.emit("placar:testGoal", side === "away" ? "away" : "home"));
          socket.on("penalty:testAlert", (scored) => io2.emit("penalty:testAlert", { scored: scored !== false && scored !== "miss" }));
          socket.on("placar:testAdded", () => io2.emit("placar:testAdded"));
          socket.on("audio:playPad", (n) => {
            const req = audio.buildPlay(S().customization.audio, `pad${Number(n) || 0}`);
            if (req) io2.emit("audio:play", req);
          });
          socket.on("audio:test", (cue) => {
            const req = audio.buildPlay(S().customization.audio, String(cue), { force: true });
            if (req) io2.emit("audio:play", req);
          });
          socket.on("audio:stop", () => io2.emit("audio:stop"));
          socket.on("audio:libraryChanged", () => io2.emit("audio:library"));
          socket.on("audio:fileDeleted", (file) => {
            if (audio.clearReferences(S().customization.audio, String(file || ""))) commit();
            io2.emit("audio:library");
          });
          socket.on("placar:testSub", (side) => io2.emit("placar:testSub", side === "away" ? "away" : "home"));
          const SH = () => S().match.shootout;
          const shCommit = () => {
            shootoutRules.refresh(SH());
            commit();
          };
          socket.on("shootout:setVisible", (visible) => {
            SH().visible = !!visible;
            commit();
          });
          socket.on("shootout:setFirst", (side) => {
            if (side !== "home" && side !== "away") return;
            if (SH().kicks.length > 0) return;
            SH().firstSide = side;
            shCommit();
          });
          socket.on("shootout:kick", (data) => {
            const sh = SH();
            const info = shootoutRules.compute(sh);
            if (info.finished || !info.next) return;
            pushUndo("Cobran\xE7a de p\xEAnalti");
            const d = data && typeof data === "object" ? data : {};
            sh.kicks.push({
              id: `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
              side: info.next.side,
              round: info.next.round,
              scored: !!d.scored,
              playerId: d.playerId ? String(d.playerId).slice(0, 80) : null,
              playerName: d.playerName ? String(d.playerName).slice(0, 80) : ""
            });
            shCommit();
          });
          socket.on("shootout:undo", () => {
            if (SH().kicks.length === 0) return;
            SH().kicks.pop();
            shCommit();
          });
          socket.on("shootout:flip", (kickId) => {
            const k = SH().kicks.find((x) => x.id === kickId);
            if (!k) return;
            pushUndo("Cobran\xE7a corrigida");
            k.scored = !k.scored;
            shCommit();
          });
          socket.on("shootout:reset", () => {
            pushUndo("Disputa reiniciada");
            const visible = SH().visible;
            S().match.shootout = { ...getDefaultShootout(), visible, firstSide: SH().firstSide };
            commit();
          });
          socket.on("disconnect", () => {
            delete clients[socket.id];
            broadcastConnectionInfo();
          });
        });
      }
      module.exports = { setup };
    }
  });

  // engine-src/shims/pdfkit.js
  var require_pdfkit = __commonJS({
    "engine-src/shims/pdfkit.js"(exports, module) {
      module.exports = function PDFDocument() {
        throw new Error("PDF n\xE3o est\xE1 dispon\xEDvel nesta vers\xE3o \u2014 use o resumo em texto ou imprima.");
      };
    }
  });

  // engine-src/server/summary.js
  var require_summary = __commonJS({
    "engine-src/server/summary.js"(exports, module) {
      var teamsStore = require_teamsStore();
      var stadiumStore = require_stadium();
      var fs2 = require_fs();
      var PERIOD_LABEL = { "1t": "1\xBA tempo", "2t": "2\xBA tempo", p1: "Prorroga\xE7\xE3o \u2014 1\xBA tempo", p2: "Prorroga\xE7\xE3o \u2014 2\xBA tempo" };
      var OFFICIAL_ROLES = [["main", "\xC1rbitro"], ["ass1", "Assistente 1"], ["ass2", "Assistente 2"], ["fourth", "4\xBA \xE1rbitro"], ["var", "VAR"], ["avar1", "AVAR 1"], ["avar2", "AVAR 2"]];
      function parseOpts(q = {}) {
        const on = (k) => q[k] !== "0" && q[k] !== "false";
        return {
          title: String(q.title || "").slice(0, 80),
          lineups: on("lineups"),
          bench: on("bench"),
          goals: on("goals"),
          cards: on("cards"),
          subs: on("subs"),
          officials: on("officials"),
          crests: on("crests"),
          stadium: on("stadium")
        };
      }
      function safeTeam(id) {
        try {
          return id ? teamsStore.getTeam(id) : null;
        } catch (_) {
          return null;
        }
      }
      var fmtMinute = (ev) => `${ev.displayMinute != null ? ev.displayMinute : ev.minute}'`;
      var scoringSide = (ev) => ev.goalType === "own" ? ev.side === "home" ? "away" : "home" : ev.side;
      function buildSummary(state, teamsList, opts = parseOpts()) {
        const m = state.match, meta = state.meta || {};
        const teams = { home: safeTeam(m.home.teamId), away: safeTeam(m.away.teamId) };
        const nameOf = (side) => teams[side] && teams[side].name || (side === "home" ? "Mandante" : "Visitante");
        const player = (side, id, fallbackName) => {
          const t = teams[side];
          const p = t && t.players ? t.players.find((x) => x.id === id) : null;
          return { number: p ? p.number : null, name: p ? p.name : fallbackName || "\u2014" };
        };
        const events = m.events || [];
        const lineup = {};
        for (const side of ["home", "away"]) {
          const ms = m[side];
          const starters = [...ms.starterIds || []];
          const subs2 = events.filter((e) => e.type === "sub" && e.side === side && e.secondaryPlayerId);
          for (let i = subs2.length - 1; i >= 0; i--) {
            const idx = starters.indexOf(subs2[i].secondaryPlayerId);
            if (idx !== -1) starters[idx] = subs2[i].playerId;
          }
          const stats = ms.lineupStats || {};
          const cap = ms.captainId;
          const mk = (id) => {
            const p = player(side, id);
            const st = stats[id] || {};
            return { ...p, goals: st.goals || 0, yellow: st.yellowCards || 0, red: st.redCards || 0, out: !!st.substituted, entered: !!st.enteredGame };
          };
          const benchIds = [...ms.benchIds || []];
          subs2.forEach((e) => {
            if (!benchIds.includes(e.secondaryPlayerId)) benchIds.push(e.secondaryPlayerId);
          });
          lineup[side] = {
            team: nameOf(side),
            starters: starters.map((id) => ({ ...mk(id), captain: id === cap || !cap && false })),
            bench: benchIds.map(mk)
          };
          if (cap) lineup[side].starters.forEach((p, i) => {
            p.captain = starters[i] === cap;
          });
        }
        const running = { home: 0, away: 0 };
        const goals = [];
        events.filter((e) => e.type === "goal").forEach((ev) => {
          const credited = scoringSide(ev);
          if (!ev.annulled) running[credited] += 1;
          const p = player(ev.side, ev.playerId, ev.playerName);
          goals.push({
            minute: fmtMinute(ev),
            side: credited,
            team: nameOf(credited),
            player: p.name,
            number: p.number,
            kind: ev.goalType || "normal",
            score: ev.annulled ? "" : `${running.home} \xD7 ${running.away}`,
            annulled: !!ev.annulled,
            note: ev.annulNote || "",
            period: PERIOD_LABEL[ev.period] || ""
          });
        });
        const cards = events.filter((e) => e.type === "yellow" || e.type === "red").map((ev) => {
          const p = player(ev.side, ev.playerId, ev.playerName);
          return { minute: fmtMinute(ev), side: ev.side, team: nameOf(ev.side), player: p.name, number: p.number, type: ev.type };
        });
        const subs = [];
        let lastKey = null;
        events.filter((e) => e.type === "sub").forEach((ev) => {
          const key = ev.atInterval ? "int" : ev.period;
          if (key !== lastKey) {
            subs.push({ break: key === "int" ? "Intervalo" : PERIOD_LABEL[ev.period] || "Jogo" });
            lastKey = key;
          }
          const out = player(ev.side, ev.playerId, ev.playerName), inn = player(ev.side, ev.secondaryPlayerId, ev.secondaryPlayerName);
          subs.push({ minute: ev.atInterval ? "INT" : fmtMinute(ev), side: ev.side, team: nameOf(ev.side), out, in: inn, interval: !!ev.atInterval });
        });
        const subCount = { home: events.filter((e) => e.type === "sub" && e.side === "home").length, away: events.filter((e) => e.type === "sub" && e.side === "away").length };
        const so = m.shootout || {};
        const kicks = so.kicks || [];
        const pens = kicks.length ? { home: kicks.filter((k) => k.side === "home" && k.scored).length, away: kicks.filter((k) => k.side === "away" && k.scored).length } : null;
        const of = state.officials || {};
        const officials = OFFICIAL_ROLES.map(([k, role]) => ({ role, name: of[k] && of[k].name || "", from: of[k] && of[k].from || "" })).filter((o) => o.name);
        const sd = state.stadium || {};
        const SD_ROWS = [["location", "Onde fica"], ["owner", "De quem \xE9"], ["capacity", "Capacidade"], ["inauguration", "Inaugura\xE7\xE3o"], ["record", "Recorde de p\xFAblico"], ["surface", "Gramado"], ["dimensions", "Campo (m)"], ["attendance", "P\xFAblico do jogo"]];
        const sdItems = SD_ROWS.filter(([k]) => sd[k]).map(([k, label]) => ({ label, value: sd[k] }));
        const cover = (sd.photos || [])[0];
        const stadium = sd.name || sdItems.length || cover ? {
          name: sd.name || "",
          nickname: sd.nickname || "",
          items: sdItems,
          photoUrl: cover ? "/stadium/photos/" + encodeURIComponent(cover.file) : ""
        } : null;
        const round = meta.round ? `${meta.round}\xAA rodada` : "";
        const title = opts.title || [meta.competition || meta.gameName, round].filter(Boolean).join(" \xB7 ") || "Resumo da partida";
        const clock = m.clock || {};
        const mins = Math.floor((clock.seconds || 0) / 60);
        return {
          title,
          date: meta.matchDate || "",
          generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
          clockText: `${PERIOD_LABEL[clock.period] || ""}${mins ? ` \xB7 ${mins}'` : ""}`.replace(/^ · /, ""),
          home: { name: nameOf("home"), short: teams.home && teams.home.shortName || "", crest: teams.home ? teams.home.crestDataUrl || "" : "" },
          away: { name: nameOf("away"), short: teams.away && teams.away.shortName || "", crest: teams.away ? teams.away.crestDataUrl || "" : "" },
          score: { home: m.score.home, away: m.score.away },
          pens,
          officials,
          stadium,
          lineup,
          goals,
          cards,
          subs,
          subCount,
          opts
        };
      }
      var W = 66;
      var line = (ch) => ch.repeat(W);
      var center = (s) => {
        s = String(s);
        const pad2 = Math.max(0, Math.floor((W - s.length) / 2));
        return " ".repeat(pad2) + s;
      };
      var pad = (s, n) => {
        s = String(s);
        return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
      };
      var clip = (s, n) => {
        s = String(s);
        return s.length > n ? s.slice(0, n - 1) + "\u2026" : s;
      };
      var num = (n) => n === null || n === void 0 || n === 0 ? "  " : String(n).padStart(2, " ");
      var KIND = { penalty: " (p\xEAnalti)", own: " (gol contra)", normal: "" };
      function fmtDate(iso) {
        const d = new Date(iso);
        const p2 = (n) => String(n).padStart(2, "0");
        return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
      }
      function toText(sm) {
        const o = sm.opts, L = [];
        L.push(line("\u2550"), center(sm.title.toUpperCase()), line("\u2550"), "");
        L.push(center(`${sm.home.name.toUpperCase()}  ${sm.score.home} x ${sm.score.away}  ${sm.away.name.toUpperCase()}`));
        if (sm.pens) L.push(center(`(p\xEAnaltis: ${sm.pens.home} x ${sm.pens.away})`));
        L.push("");
        const info = [sm.date && `Data: ${sm.date}`, sm.clockText && `Tempo: ${sm.clockText}`].filter(Boolean).join("   \xB7   ");
        if (info) L.push(center(info));
        L.push(line("\u2500"));
        if (o.officials && sm.officials.length) {
          L.push("ARBITRAGEM", "");
          sm.officials.forEach((x) => L.push(`  ${pad(x.role, 14)} ${x.name}${x.from ? ` (${x.from})` : ""}`));
          L.push("", line("\u2500"));
        }
        if (o.stadium && sm.stadium) {
          L.push("EST\xC1DIO", "");
          if (sm.stadium.name) L.push(`  ${sm.stadium.name}${sm.stadium.nickname ? "  (" + sm.stadium.nickname + ")" : ""}`);
          sm.stadium.items.forEach((x) => L.push(`  ${pad(x.label, 20)} ${x.value}`));
          L.push("", line("\u2500"));
        }
        if (o.lineups) {
          L.push("ESCALA\xC7\xD5ES INICIAIS", "");
          const h = sm.lineup.home, a = sm.lineup.away, col = 31;
          L.push(`  ${pad(h.team.toUpperCase(), col)}${a.team.toUpperCase()}`);
          const n = Math.max(h.starters.length, a.starters.length);
          const cell = (p) => p ? `${num(p.number)}  ${p.name}${p.captain ? " (C)" : ""}` : "";
          for (let i = 0; i < n; i++) L.push(`  ${pad(cell(h.starters[i]), col)}${cell(a.starters[i])}`);
          if (!n) L.push("  (escala\xE7\xE3o n\xE3o definida)");
          if (o.bench) {
            L.push("", "  Reservas", "");
            const nb = Math.max(h.bench.length, a.bench.length);
            const bcell = (p) => p ? `${num(p.number)}  ${p.name}${p.entered ? " *" : ""}` : "";
            for (let i = 0; i < nb; i++) L.push(`  ${pad(bcell(h.bench[i]), col)}${bcell(a.bench[i])}`);
            if (nb) L.push("", "  * entrou durante o jogo");
          }
          L.push("", line("\u2500"));
        }
        if (o.goals) {
          L.push("GOLS", "");
          if (!sm.goals.length) L.push("  Sem gols.");
          sm.goals.forEach((g) => {
            const txt = `  ${pad(g.minute, 6)} ${pad(clip(g.team.toUpperCase(), 20), 20)} ${g.player}${KIND[g.kind] || ""}`;
            L.push(g.annulled ? `${txt}  [ANULADO${g.note ? ": " + g.note : ""}]` : `${txt}   >> ${g.score}`);
          });
          L.push("", line("\u2500"));
        }
        if (o.cards) {
          L.push("CART\xD5ES", "");
          if (!sm.cards.length) L.push("  Sem cart\xF5es.");
          sm.cards.forEach((c) => L.push(`  ${pad(c.minute, 6)} ${pad(c.type === "red" ? "VERMELHO" : "AMARELO", 9)} ${pad(clip(c.team.toUpperCase(), 20), 20)} ${c.player}`));
          L.push("", line("\u2500"));
        }
        if (o.subs) {
          L.push(`SUBSTITUI\xC7\xD5ES  (${clip(sm.home.name, 18)}: ${sm.subCount.home}/5 \xB7 ${clip(sm.away.name, 18)}: ${sm.subCount.away}/5)`);
          if (!sm.subs.length) L.push("", "  Sem substitui\xE7\xF5es.");
          sm.subs.forEach((s) => {
            var _a, _b;
            if (s.break) L.push("", `  \u2500\u2500 ${s.break.toUpperCase()} \u2500\u2500`);
            else L.push(`  ${pad(s.minute, 6)} ${pad(clip(s.team.toUpperCase(), 20), 20)} sai ${(_a = s.out.number) != null ? _a : ""} ${s.out.name}  ->  entra ${(_b = s.in.number) != null ? _b : ""} ${s.in.name}`);
          });
          L.push("", line("\u2500"));
        }
        L.push(center(`Resumo gerado em ${fmtDate(sm.generatedAt)} \u2014 painel Transmiss\xE3o OBS`));
        return "\uFEFF" + L.join("\r\n") + "\r\n";
      }
      function crestBuffer(dataUrl) {
        const m = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(dataUrl || "");
        return m ? Buffer.from(m[2], "base64") : null;
      }
      function toPdf(sm, res, filename) {
        const PDFDocument = require_pdfkit();
        const o = sm.opts;
        const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true, info: { Title: sm.title, Author: "Transmiss\xE3o OBS" } });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        doc.pipe(res);
        const L = 40, R = doc.page.width - 40, CW = R - L;
        const C = { ink: "#0f172a", mute: "#64748b", blue: "#2563eb", soft: "#eff6ff", line: "#e2e8f0", band: "#0f172a", yellow: "#eab308", red: "#dc2626", green: "#16a34a" };
        const bottom = () => doc.page.height - 56;
        const ensure = (h) => {
          if (doc.y + h > bottom()) doc.addPage();
        };
        doc.rect(0, 0, doc.page.width, 150).fill(C.band);
        doc.fillColor("#93c5fd").font("Helvetica-Bold").fontSize(10).text(sm.title.toUpperCase(), L, 26, { width: CW, align: "center", characterSpacing: 1 });
        const cy = 50;
        const sideW = 130, crestW = 62, scoreW = CW - 2 * (sideW + crestW);
        const drawSide = (side, left) => {
          const nx = left ? L + crestW : R - crestW - sideW;
          const cx = left ? L : R - crestW;
          if (o.crests) {
            const buf = crestBuffer(sm[side].crest);
            if (buf) {
              const plate = crestW - 2;
              try {
                doc.roundedRect(cx, cy + 2, plate, plate, 10).fill("#ffffff");
                doc.image(buf, cx + 6, cy + 8, { fit: [plate - 12, plate - 12], align: "center", valign: "center" });
              } catch (_) {
              }
            }
          }
          doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(13);
          const name = sm[side].name.toUpperCase();
          const h = doc.heightOfString(name, { width: sideW - 8 });
          doc.text(name, nx, cy + 32 - h / 2, { width: sideW - 8, align: left ? "right" : "left" });
        };
        drawSide("home", true);
        drawSide("away", false);
        doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(30).text(`${sm.score.home} \xD7 ${sm.score.away}`, L + crestW + sideW, cy + 14, { width: scoreW, align: "center", lineBreak: false });
        const sub = [];
        if (sm.pens) sub.push(`P\xEAnaltis: ${sm.pens.home} \xD7 ${sm.pens.away}`);
        if (sm.date) sub.push(sm.date);
        if (sm.clockText) sub.push(sm.clockText);
        doc.fillColor("#cbd5e1").font("Helvetica").fontSize(10).text(sub.join("   -   "), L, cy + 82, { width: CW, align: "center" });
        doc.y = 170;
        const section = (label) => {
          ensure(60);
          doc.moveDown(0.4);
          const y = doc.y;
          doc.fillColor(C.blue).font("Helvetica-Bold").fontSize(10).text(label.toUpperCase(), L, y, { characterSpacing: 1.4 });
          doc.moveTo(L, doc.y + 3).lineTo(R, doc.y + 3).lineWidth(1.5).strokeColor("#bfdbfe").stroke();
          doc.y += 10;
        };
        const fit = (txt, w, bold, size) => {
          doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(size);
          let t = String(txt);
          if (doc.widthOfString(t) <= w) return t;
          while (t.length > 1 && doc.widthOfString(t + "...") > w) t = t.slice(0, -1);
          return t.trimEnd() + "...";
        };
        const row = (cols, opt = {}) => {
          const h = opt.h || 17;
          ensure(h + 2);
          const y = doc.y;
          if (opt.bg) doc.rect(L, y - 2, CW, h).fill(opt.bg);
          let x = L + 4;
          cols.forEach((c) => {
            doc.fillColor(c.color || C.ink).font(c.bold ? "Helvetica-Bold" : "Helvetica").fontSize(opt.size || 10).text(fit(c.t, c.w - 6, c.bold, opt.size || 10), x, y + 1, { width: c.w - 4, align: c.align || "left", lineBreak: false });
            x += c.w;
          });
          doc.y = y + h;
          if (!opt.noLine) doc.moveTo(L, doc.y - 1).lineTo(R, doc.y - 1).lineWidth(0.5).strokeColor(C.line).stroke();
        };
        if (o.officials && sm.officials.length) {
          section("Arbitragem");
          sm.officials.forEach((x) => row([{ t: x.role, w: 110, bold: true, color: C.mute }, { t: x.name, w: CW - 170, bold: true }, { t: x.from, w: 60, color: C.mute, align: "right" }]));
        }
        if (o.stadium && sm.stadium) {
          section("Est\xE1dio");
          const sd = sm.stadium;
          let buf = null;
          if (sd.photoUrl) {
            try {
              const file = decodeURIComponent(sd.photoUrl.replace("/stadium/photos/", ""));
              const pth = stadiumStore.photoPath(file);
              if (pth) buf = fs2.readFileSync(pth);
            } catch (_) {
              buf = null;
            }
          }
          const PH_W = 190, PH_H = 125;
          ensure(buf ? PH_H + 10 : 20 + sd.items.length * 17);
          const y0 = doc.y;
          let tx = L;
          if (buf) {
            try {
              doc.save().roundedRect(L, y0, PH_W, PH_H, 8).clip();
              doc.image(buf, L, y0, { cover: [PH_W, PH_H], align: "center", valign: "center" });
              doc.restore();
              tx = L + PH_W + 18;
            } catch (_) {
              doc.restore();
            }
          }
          let ty = y0;
          if (sd.name) {
            doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(14).text(sd.name.toUpperCase(), tx, ty, { width: R - tx });
            ty = doc.y;
            if (sd.nickname) {
              doc.fillColor(C.mute).font("Helvetica").fontSize(10).text(sd.nickname, tx, ty, { width: R - tx });
              ty = doc.y;
            }
            ty += 6;
          }
          sd.items.forEach((x) => {
            doc.fillColor(C.mute).font("Helvetica-Bold").fontSize(8).text(x.label.toUpperCase(), tx, ty, { width: 110, characterSpacing: 0.6, lineBreak: false });
            doc.fillColor(C.ink).font("Helvetica").fontSize(10).text(x.value, tx + 118, ty - 1.5, { width: R - tx - 118, lineBreak: false, ellipsis: true });
            ty += 16;
          });
          doc.y = Math.max(buf ? y0 + PH_H : y0, ty) + 6;
        }
        if (o.lineups) {
          section("Escala\xE7\xF5es iniciais");
          const half = (CW - 20) / 2;
          const colsOf = (side) => {
            const t = sm.lineup[side], list = [{ k: "title", t: t.team.toUpperCase(), h: 18 }];
            t.starters.forEach((p) => list.push({ k: "starter", p, h: 15 }));
            if (!t.starters.length) list.push({ k: "empty", h: 15 });
            if (o.bench && t.bench.length) {
              list.push({ k: "gap", h: 6 }, { k: "benchTitle", h: 13 });
              t.bench.forEach((p) => list.push({ k: "bench", p, h: 13.5 }));
            }
            return list;
          };
          const A = colsOf("home"), B = colsOf("away");
          const drawCell = (c, x, y2) => {
            var _a, _b;
            if (!c) return;
            if (c.k === "title") doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(10.5).text(c.t, x, y2, { width: half, lineBreak: false, ellipsis: true });
            else if (c.k === "starter") {
              doc.fillColor(C.mute).font("Helvetica-Bold").fontSize(9.5).text(String((_a = c.p.number) != null ? _a : ""), x, y2, { width: 22, align: "right", lineBreak: false });
              doc.fillColor(C.ink).font("Helvetica").fontSize(10).text(`${c.p.name}${c.p.captain ? "  (C)" : ""}`, x + 30, y2, { width: half - 30, lineBreak: false, ellipsis: true });
            } else if (c.k === "empty") doc.fillColor(C.mute).font("Helvetica").fontSize(10).text("(escala\xE7\xE3o n\xE3o definida)", x, y2, { width: half, lineBreak: false });
            else if (c.k === "benchTitle") doc.fillColor(C.mute).font("Helvetica-Bold").fontSize(8.5).text("RESERVAS", x, y2, { characterSpacing: 1, lineBreak: false });
            else if (c.k === "bench") {
              doc.fillColor(C.mute).font("Helvetica").fontSize(9).text(String((_b = c.p.number) != null ? _b : ""), x, y2, { width: 22, align: "right", lineBreak: false });
              doc.fillColor(C.ink).font("Helvetica").fontSize(9.5).text(`${c.p.name}${c.p.entered ? "  (entrou)" : ""}`, x + 30, y2, { width: half - 30, lineBreak: false, ellipsis: true });
            }
          };
          const n = Math.max(A.length, B.length);
          let y = doc.y;
          for (let i = 0; i < n; i++) {
            const h = Math.max(A[i] ? A[i].h : 0, B[i] ? B[i].h : 0);
            if (y + h > bottom()) {
              doc.addPage();
              y = doc.y;
            }
            drawCell(A[i], L, y);
            drawCell(B[i], L + half + 20, y);
            y += h;
          }
          doc.y = y + 4;
        }
        if (o.goals) {
          section("Gols");
          if (!sm.goals.length) row([{ t: "Sem gols.", w: CW, color: C.mute }], { noLine: true });
          sm.goals.forEach((g) => {
            const kind = g.kind === "penalty" ? "  (p\xEAnalti)" : g.kind === "own" ? "  (gol contra)" : "";
            row([
              { t: g.minute, w: 44, bold: true },
              { t: g.team.toUpperCase(), w: 200, bold: true, color: g.annulled ? C.mute : C.ink },
              { t: `${g.player}${kind}${g.annulled ? `   ANULADO${g.note ? ": " + g.note : ""}` : ""}`, w: CW - 44 - 200 - 70, color: g.annulled ? C.red : C.ink },
              { t: g.score, w: 70, bold: true, align: "right", color: C.blue }
            ], { h: 19, size: 10.5 });
          });
        }
        if (o.cards) {
          section("Cart\xF5es");
          if (!sm.cards.length) row([{ t: "Sem cart\xF5es.", w: CW, color: C.mute }], { noLine: true });
          sm.cards.forEach((c) => {
            ensure(20);
            doc.rect(L + 6, doc.y + 1, 9, 13).fill(c.type === "red" ? C.red : C.yellow);
            row([{ t: "", w: 22 }, { t: c.minute, w: 44, bold: true }, { t: c.team.toUpperCase(), w: 200, bold: true }, { t: c.player, w: CW - 266 }], { h: 17 });
          });
        }
        if (o.subs) {
          section(`Substitui\xE7\xF5es  \xB7  ${sm.home.name} ${sm.subCount.home}/5  \xB7  ${sm.away.name} ${sm.subCount.away}/5`);
          if (!sm.subs.length) row([{ t: "Sem substitui\xE7\xF5es.", w: CW, color: C.mute }], { noLine: true });
          sm.subs.forEach((s) => {
            var _a, _b;
            if (s.break) {
              row([{ t: s.break.toUpperCase(), w: CW, bold: true, color: C.blue, align: "center" }], { bg: C.soft, h: 17, size: 9, noLine: true });
            } else {
              row([
                { t: s.minute, w: 44, bold: true },
                { t: s.team.toUpperCase(), w: 150, bold: true },
                { t: `sai  ${(_a = s.out.number) != null ? _a : ""}  ${s.out.name}`, w: (CW - 194) / 2, color: C.red },
                { t: `entra  ${(_b = s.in.number) != null ? _b : ""}  ${s.in.name}`, w: (CW - 194) / 2, color: C.green }
              ], { h: 18 });
            }
          });
        }
        const range = doc.bufferedPageRange();
        for (let i = 0; i < range.count; i++) {
          doc.switchToPage(range.start + i);
          doc.page.margins.bottom = 0;
          doc.fillColor(C.mute).font("Helvetica").fontSize(8).text(`Resumo gerado em ${fmtDate(sm.generatedAt)} \u2014 painel Transmiss\xE3o OBS  \xB7  p\xE1gina ${i + 1} de ${range.count}`, L, doc.page.height - 34, { width: CW, align: "center", lineBreak: false });
        }
        doc.end();
      }
      function fileBase(sm) {
        const slug = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        const d = new Date(sm.generatedAt);
        const p2 = (n) => String(n).padStart(2, "0");
        return `resumo-${slug(sm.home.name) || "mandante"}-x-${slug(sm.away.name) || "visitante"}-${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}`;
      }
      module.exports = { buildSummary, toText, toPdf, parseOpts, fileBase };
    }
  });

  // engine-src/entry.js
  if (!window.setImmediate) window.setImmediate = (fn, ...a) => setTimeout(fn, 0, ...a);
  var fs = require_fs();
  var FX_EVENTS = ["art:replay", "placar:testGoal", "placar:testSub", "placar:testAdded", "penalty:testAlert", "others:goal"];
  var DATA = "/app/data";
  var db = window.PLACAR_DB;
  var BASE = window.PLACAR_PATH || "placar";
  var ref = (p) => db.ref(BASE + (p ? "/" + p : ""));
  var myId = "p" + Math.random().toString(36).slice(2, 10);
  var clone = (v) => v === void 0 ? v : JSON.parse(JSON.stringify(v));
  var Hub = class {
    constructor() {
      this.sockets = /* @__PURE__ */ new Set();
      this.connHandlers = [];
      this.tap = null;
      this.ready = false;
      this.pending = [];
    }
    on(ev, fn) {
      if (ev === "connection") this.connHandlers.push(fn);
    }
    emit(ev, ...args) {
      if (this.tap) args = this.tap(ev, args) || args;
      this.sockets.forEach((s) => s._deliver(ev, args));
    }
    connect(opts = {}) {
      const client = new ClientSocket(this);
      const attach = () => {
        const srv = new ServerSocket(this, client, opts);
        client._srv = srv;
        this.sockets.add(srv);
        client.connected = true;
        client.id = srv.id;
        this.connHandlers.forEach((fn) => fn(srv));
        client._fire("connect");
      };
      if (this.ready) setTimeout(attach, 0);
      else this.pending.push(attach);
      return client;
    }
    start() {
      this.ready = true;
      this.pending.splice(0).forEach((f) => setTimeout(f, 0));
    }
  };
  var Emitter = class {
    constructor() {
      this._h = {};
    }
    on(ev, fn) {
      (this._h[ev] = this._h[ev] || []).push(fn);
      return this;
    }
    off(ev, fn) {
      this._h[ev] = (this._h[ev] || []).filter((f) => f !== fn);
      return this;
    }
    _fire(ev, ...a) {
      (this._h[ev] || []).slice().forEach((fn) => {
        try {
          fn(...a);
        } catch (e) {
          console.error(`[engine:${ev}]`, e);
        }
      });
    }
  };
  var ServerSocket = class extends Emitter {
    constructor(hub2, client, opts) {
      super();
      this.hub = hub2;
      this.client = client;
      this.id = "s" + Math.random().toString(36).slice(2, 10);
      this._any = [];
      this.handshake = { query: opts.query || {}, headers: { referer: opts.referer || "" } };
    }
    onAny(fn) {
      this._any.push(fn);
    }
    emit(ev, ...args) {
      this._deliver(ev, args);
    }
    _deliver(ev, args) {
      const c = this.client;
      const copy = args.map((a) => typeof a === "function" ? a : clone(a));
      setTimeout(() => c._fire(ev, ...copy), 0);
    }
    _receive(ev, args) {
      const copy = args.map((a) => typeof a === "function" ? a : clone(a));
      const ack = typeof copy[copy.length - 1] === "function" ? copy.pop() : null;
      const wrapAck = ack ? (...r) => setTimeout(() => ack(...r.map(clone)), 0) : null;
      const call = wrapAck ? [...copy, wrapAck] : copy;
      this._any.forEach((fn) => {
        try {
          fn(ev, ...call);
        } catch (e) {
          console.error("[engine:any]", e);
        }
      });
      this._fire(ev, ...call);
    }
  };
  var ClientSocket = class extends Emitter {
    constructor(hub2) {
      super();
      this.hub = hub2;
      this.connected = false;
      this.id = null;
      this._srv = null;
    }
    emit(ev, ...args) {
      const send = () => this._srv && this._srv._receive(ev, args);
      if (this._srv) setTimeout(send, 0);
      else this.hub.pending.push(() => setTimeout(send, 20));
      return this;
    }
    disconnect() {
      if (this._srv) {
        this.hub.sockets.delete(this._srv);
        this._srv._fire("disconnect");
        this._srv = null;
        this.connected = false;
      }
    }
  };
  var hub = new Hub();
  var io = (opts) => hub.connect(opts || {});
  window.io = io;
  window.__placarEngine = { connect: (opts) => hub.connect(opts || {}) };
  function banner(html, kind) {
    let el = document.getElementById("engineBoot");
    if (!el) {
      el = document.createElement("div");
      el.id = "engineBoot";
      el.style.cssText = "position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:#0b1220;color:#e8eefb;font:16px/1.5 system-ui,sans-serif;text-align:center;padding:24px";
      document.body.appendChild(el);
    }
    el.innerHTML = `<div style="max-width:460px"><div style="font-size:18px;font-weight:700;margin-bottom:8px">${kind === "err" ? "Sem conex\xE3o com o Firebase" : "Conectando ao Firebase\u2026"}</div><div style="opacity:.85">${html}</div></div>`;
  }
  var hideBanner = () => {
    const el = document.getElementById("engineBoot");
    if (el) el.remove();
  };
  var once = (path) => new Promise((res, rej) => ref(path).once("value", (s) => res(s.val()), rej));
  function waitConnected(ms) {
    return new Promise((res) => {
      let done = false;
      const h = db.ref(".info/connected").on("value", (s) => {
        if (s.val() === true && !done) {
          done = true;
          db.ref(".info/connected").off("value", h);
          res(true);
        }
      });
      setTimeout(() => {
        if (!done) {
          done = true;
          res(false);
        }
      }, ms);
    });
  }
  var LS = { get(k) {
    try {
      return localStorage.getItem("placar_" + BASE + "_" + k);
    } catch (_) {
      return null;
    }
  }, set(k, v) {
    try {
      localStorage.setItem("placar_" + BASE + "_" + k, v);
    } catch (_) {
    }
  } };
  function loadTeamsIntoFs(json) {
    [...fs.__files.keys()].filter((f) => f.startsWith(DATA + "/teams/")).forEach((f) => fs.__files.delete(f));
    fs.mkdirSync(DATA + "/teams");
    let arr = [];
    try {
      arr = JSON.parse(json || "[]");
    } catch (_) {
    }
    (Array.isArray(arr) ? arr : []).forEach((t) => {
      if (t && t.id) fs.writeFileSync(`${DATA}/teams/${t.id}.json`, JSON.stringify(t));
    });
  }
  (async function boot() {
    if (window.PLACAR_AUTH_READY) await window.PLACAR_AUTH_READY;
    if (!db) {
      banner("Os scripts do Firebase n\xE3o carregaram. Verifique a internet e recarregue a p\xE1gina.", "err");
      return;
    }
    banner("Abrindo o banco de dados do placar.");
    const online = await waitConnected(1e4);
    let stateJson = null, teamsJson = null;
    if (online) {
      try {
        [stateJson, teamsJson] = await Promise.all([once("stateJson"), once("teamsJson")]);
      } catch (e) {
        banner("O Firebase recusou a leitura (" + (e && e.code ? e.code : "erro") + "). Confira as regras do Realtime Database no guia.", "err");
        return;
      }
    } else {
      stateJson = LS.get("state");
      teamsJson = LS.get("teams");
      if (!stateJson) {
        banner("N\xE3o consegui conectar e n\xE3o h\xE1 c\xF3pia salva neste aparelho. Conecte-se \xE0 internet e recarregue.", "err");
        return;
      }
    }
    let offset = 0;
    try {
      offset = await new Promise((r) => db.ref(".info/serverTimeOffset").once("value", (s) => r(Number(s.val()) || 0)));
    } catch (_) {
    }
    const realNow = Date.now.bind(Date);
    Date.now = () => realNow() + offset;
    fs.mkdirSync(DATA);
    if (stateJson) fs.writeFileSync(DATA + "/state.json", stateJson);
    loadTeamsIntoFs(teamsJson);
    const runtime = require_runtime();
    const sockets = require_sockets();
    const persistence = require_persistence();
    const teamsStore = require_teamsStore();
    let adopting = false, lastState = "", lastTeams = "", writeTimer = null, backupTimer = null;
    const flushState = () => {
      writeTimer = null;
      const json = lastState;
      ref().update({ stateJson: json, stateBy: myId }).catch((e) => console.error("[firebase] estado:", e));
      clearTimeout(backupTimer);
      backupTimer = setTimeout(() => LS.set("state", json), 1500);
    };
    const scheduleState = () => {
      if (!writeTimer) writeTimer = setTimeout(flushState, 120);
    };
    const connections = { presence: {} };
    hub.tap = (ev, args) => {
      if (ev === "state:sync") {
        const json = JSON.stringify(args[0]);
        if (!adopting && json !== lastState) {
          lastState = json;
          scheduleState();
        } else lastState = json;
      } else if (ev === "teams:sync") {
        const json = JSON.stringify(args[0]);
        if (!adopting && json !== lastTeams) {
          lastTeams = json;
          ref().update({ teamsJson: json, stateBy: myId }).catch((e) => console.error("[firebase] times:", e));
          LS.set("teams", json);
        } else lastTeams = json;
      } else if (FX_EVENTS.includes(ev)) {
        ref("fx").set({ id: myId + "_" + realNow() + "_" + Math.random().toString(36).slice(2, 6), ev, args: JSON.stringify(args), ts: Date.now() }).catch(() => {
        });
      } else if (ev === "connections:sync") {
        return [mergeConnections(args[0])];
      }
      return null;
    };
    function mergeConnections(local) {
      const sources = { escalacao: 0, placar: 0, eventos: 0, linhaDoTempo: 0, penaltis: 0, fimDeJogo: 0, informativos: 0, classificacao: 0, patrocinadores: 0 };
      let arte = 0;
      Object.values(connections.presence).forEach((p) => {
        if (p && p.source) {
          sources[p.source] = (sources[p.source] || 0) + 1;
          arte++;
        }
      });
      return { ...local, arte, sources, total: (local.panel || 0) + (local.previews || 0) + arte };
    }
    ref("stateJson").on("value", (snap) => {
      const json = snap.val();
      if (!json || json === lastState) return;
      ref("stateBy").once("value", (b) => {
        if (b.val() === myId) return;
        try {
          adopting = true;
          runtime.setState(persistence.mergeWithDefaults(JSON.parse(json)));
          runtime.broadcastState();
        } catch (e) {
          console.error("[firebase] estado remoto inv\xE1lido:", e);
        } finally {
          adopting = false;
        }
      });
    });
    ref("teamsJson").on("value", (snap) => {
      const json = snap.val();
      if (json == null || json === lastTeams) return;
      ref("stateBy").once("value", (b) => {
        if (b.val() === myId) return;
        adopting = true;
        try {
          loadTeamsIntoFs(json);
          runtime.broadcastTeams();
        } finally {
          adopting = false;
        }
      });
    });
    ref("presence").on("value", (snap) => {
      connections.presence = snap.val() || {};
      if (hub.ready) {
        try {
          hub.emit("connections:sync", { total: 0, arte: 0, previews: 0, panel: 0, sources: {}, lastUpdate: Date.now() });
        } catch (_) {
        }
      }
    });
    sockets.setup(hub);
    const PARTS = { match: ["match", "meta"], art: ["customization", "modules", "visuals"], tables: ["league", "others", "officials", "stadium", "summary"] };
    hub.on("connection", (srv) => {
      srv.on("engine:import", (p, ack) => {
        try {
          p = p || {};
          const parts = p.parts || {};
          const res = { teams: 0, state: false };
          if (parts.teams) {
            (p.teams || []).forEach((t) => {
              if (t && typeof t === "object") {
                teamsStore.saveTeam(t);
                res.teams++;
              }
            });
            runtime.broadcastTeams();
          }
          if (p.state && (parts.match || parts.art || parts.tables)) {
            fs.writeFileSync(DATA + "/state.json", JSON.stringify(p.state));
            const incoming = persistence.loadState();
            const cur = runtime.getState();
            Object.keys(PARTS).forEach((k) => {
              if (parts[k]) PARTS[k].forEach((key) => {
                if (incoming[key] !== void 0) cur[key] = incoming[key];
              });
            });
            if (parts.match) {
              cur.match.clock.running = false;
              cur.match.clock.runningSince = null;
            }
            runtime.commit();
            res.state = true;
          }
          ack && ack({ ok: true, ...res });
        } catch (e) {
          console.error(e);
          ack && ack({ ok: false, error: e.message });
        }
      });
      srv.on("engine:reset", (ack) => {
        try {
          teamsStore.deleteAllTeams();
          runtime.setState(require_defaultState().getDefaultState());
          runtime.broadcastTeams();
          runtime.broadcastState();
          ack && ack({ ok: true });
        } catch (e) {
          ack && ack({ ok: false, error: e.message });
        }
      });
    });
    const summary = require_summary();
    window.__placarSummary = {
      build: (q) => summary.buildSummary(runtime.getState(), null, summary.parseOpts(q || {})),
      text: summary.toText,
      fileBase: summary.fileBase
    };
    lastState = JSON.stringify(runtime.getState());
    lastTeams = JSON.stringify(teamsStore.listTeams());
    if (online && !stateJson) {
      ref().update({ stateJson: lastState, teamsJson: lastTeams, stateBy: myId });
    }
    window.__placarRuntime = runtime;
    hub.start();
    hideBanner();
    if (!online) {
      const b = document.createElement("div");
      b.textContent = "Sem internet: usando a c\xF3pia salva neste aparelho. As altera\xE7\xF5es sobem quando a conex\xE3o voltar.";
      b.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:9998;background:#7a2e0e;color:#fff;padding:8px 12px;font:13px system-ui;text-align:center";
      document.body.appendChild(b);
    }
  })().catch((e) => {
    console.error(e);
    banner("Erro ao iniciar o motor: " + (e && e.message), "err");
  });
})();
