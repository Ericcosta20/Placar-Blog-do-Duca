/**
 * Estado padrão da aplicação.
 * Este objeto é usado pelo servidor como estado inicial quando não existe
 * nenhum estado salvo em disco (data/state.json).
 *
 * IMPORTANTE: os TIMES (elenco, cores, escudo etc.) NÃO ficam mais aqui.
 * Cada time é um arquivo próprio em data/teams/<id>.json (ver server/teamsStore.js).
 * Este estado guarda apenas a PARTIDA atual (quem está jogando, escalação
 * escolhida para essa partida, placar, relógio e eventos) e a personalização
 * visual da arte.
 */
function getDefaultMatchSide() {
  return {
    teamId: null,
    starterIds: [], // ids dos jogadores titulares (ordem = ordem de escalação), até 11
    captainId: null,
    // v5.0 — reservas (banco) escolhidos para esta partida, até 15. Aparecem na arte
    // quando modules.reservasHome / reservasAway (v5.1, por time) estiver ligado.
    benchIds: [],
    // Estatísticas por jogador NESTA partida (não altera o cadastro do time)
    // { [playerId]: { yellowCards, redCards, goals, substituted, enteredGame } }
    lineupStats: {},
  };
}

/**
 * Disputa de pênaltis (v4.1).
 * kicks: ordem cronológica das cobranças. O lado de cada cobrança é calculado
 * (alterna a partir de firstSide) — nunca vem do cliente.
 * { id, side, scored, playerId, playerName }
 */
function getDefaultShootout() {
  return {
    visible: false,   // aparece no OBS (/arte/penaltis)
    firstSide: "home", // quem bate primeiro
    rounds: 5,         // cobranças "regulares" por time (depois disso: morte súbita)
    kicks: [],
    finished: false,
    winner: null,      // "home" | "away" | null
  };
}

/** v5.0 — cartão de FIM DE JOGO (/arte/fim-de-jogo): só aparece quando visible = true. */
function getDefaultFinalCard() {
  return { visible: false };
}


/* ===================== v6.0 — CLASSIFICAÇÃO, OUTROS JOGOS E ARBITRAGEM ===================== */
/* Times de exemplo da tabela (Série A) — só nomes: o operador digita os pontos no dia da transmissão. */
const DEFAULT_CLUBS = [
  ["Flamengo", "FLA"], ["Palmeiras", "PAL"], ["Cruzeiro", "CRU"], ["Mirassol", "MIR"], ["Fluminense", "FLU"],
  ["Botafogo", "BOT"], ["Bahia", "BAH"], ["São Paulo", "SAO"], ["Grêmio", "GRE"], ["Bragantino", "RBB"],
  ["Atlético-MG", "CAM"], ["Santos", "SAN"], ["Corinthians", "COR"], ["Vasco", "VAS"], ["Vitória", "VIT"],
  ["Internacional", "INT"], ["Coritiba", "CFC"], ["Athletico-PR", "CAP"], ["Chapecoense", "CHA"], ["Remo", "REM"],
];
/** Faixas da tabela (editáveis): Campeão, Libertadores, Pré-Libertadores, Sul-Americana e Rebaixamento. */
function getDefaultZones() {
  return [
    { id: "z1", label: "Campeão", from: 1, to: 1, color: "#facc15", enabled: true },
    { id: "z2", label: "Libertadores — fase de grupos", from: 2, to: 4, color: "#22c55e", enabled: true },
    { id: "z3", label: "Pré-Libertadores", from: 5, to: 6, color: "#38bdf8", enabled: true },
    { id: "z4", label: "Sul-Americana", from: 7, to: 12, color: "#f97316", enabled: true },
    { id: "z5", label: "Rebaixamento (Z4)", from: 17, to: 20, color: "#ef4444", enabled: true },
  ];
}
function getDefaultLeague() {
  return {
    name: "BRASILEIRÃO SÉRIE A",
    round: "",              // rodada a que a tabela se refere (texto livre: "31")
    visible: false,         // aparece no OBS (/arte/informativos)
    mode: "compact",        // 'compact' (posição, time, pontos) | 'complete' (+ jogos, V, E, D, SG e legenda)
    liveProjection: true,   // soma ao vivo o resultado dos jogos em andamento (outros jogos)
    includeMain: true,      // inclui também o jogo que está sendo transmitido (se os times estiverem na tabela)
    teams: DEFAULT_CLUBS.map(([name, short], i) => ({
      id: "c" + (i + 1), name, short, teamId: null,
      pts: 0, j: null, v: null, e: null, d: null, gp: null, gc: null,
    })),
    zones: getDefaultZones(),
    lastCommit: null,       // para desfazer o último "Lançar na tabela"
  };
}
/** Outros jogos (acontecendo ao mesmo tempo). Cada jogo: { id, homeId, awayId (ids da tabela), homeScore, awayScore,
 *  status: 'live' | 'scheduled' | 'finished', minute, round, onAir } */
function getDefaultOthers() {
  return { visible: false, games: [] };
}
/** Arbitragem da partida: árbitro, assistentes, 4º árbitro e os 3 árbitros de vídeo. */
function getDefaultOfficials() {
  const o = () => ({ name: "", from: "" });
  return {
    refVisible: false, varVisible: false,
    main: o(), ass1: o(), ass2: o(), fourth: o(),
    var: o(), avar1: o(), avar2: o(),
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
    stadium: require("./stadium").getDefaultStadium(),
    // v6.1 — opções do resumo da partida (título e o que fica de fora). Ficam no estado para entrarem no desfazer.
    summary: { title: "", off: [] },

    // Metadados gerais da transmissão (usados no Dashboard)
    meta: {
      gameName: "",
      competition: "",
      round: "",
      matchDate: "",
    },

    match: {
      home: getDefaultMatchSide(),
      away: getDefaultMatchSide(),

      score: { home: 0, away: 0 },

      clock: {
        seconds: 0, // tempo decorrido, em segundos — nunca convertido para horas
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
        runningSince: null,
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
      finalCard: getDefaultFinalCard(),
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
      reservasHome: false, // v5.1 — reservas do MANDANTE no lugar dos titulares (cada time liga/desliga sozinho)
      reservasAway: false, // v5.1 — reservas do VISITANTE
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
        gradient: true,
      },

      // ===== v5.0 — ESCALAÇÃO: marcações, substituição, reservas e entrada animada =====
      markerSize: 100,        // % — tamanho dos ícones de gol/cartão ao lado do nome
      subAnimationMs: 5000,   // duração da animação de substituição na linha do jogador
      scorerBlink: true,      // o nome de quem fez o gol pisca por alguns segundos
      benchTitle: "RESERVAS", // título do painel de reservas
      // ===== v5.1 =====
      benchMode: "swap",      // 'swap' = reservas ocupam o lugar dos titulares (titulares deslizam pro lado) | 'below' = painel embaixo (v5.0)
      benchPageMs: 4000,      // quanto tempo cada "página" de reservas fica parada antes de subir (só quando há mais reservas que linhas)
      subMarker: true,        // ícone de substituição na linha de quem entrou (junto com gol e cartões)
      subMarkerShowOut: true, // mostra também o número de quem saiu ao lado do ícone
      // ===== v5.2 — SONS (tocados pela Browser Source /arte/audio) =====
      // Campos simples de propósito: dá para ajustar tudo pelo mesmo settings:patch do resto.
      // Src = "preset:<id>" (sons sugeridos) | "user:<arquivo>" (data/audio) | "" (nenhum).
      audio: {
        autoEnabled: true,   // chave geral dos sons automáticos (gol, substituição, cartões, gol anulado)
        masterVolume: 80,    // % — volume geral (vale também para os botões de soundpad)
        golOn: true,    golSrc: "preset:gol-buzina-torcida",       golVol: 100,
        subOn: true,    subSrc: "preset:sub-sino-duplo",           subVol: 90,
        yellowOn: true, yellowSrc: "preset:amarelo-apito",         yellowVol: 90,
        redOn: true,    redSrc: "preset:vermelho-apito-longo",     redVol: 90,
        annulOn: true,  annulSrc: "preset:anulado-buzina-descendente", annulVol: 90,
        // botões de soundpad (aparecem na aba Partida) — nome, som e volume de cada um
        pad1Label: "Buzina", pad1Src: "preset:buzina", pad1Vol: 90,
        pad2Label: "Torcida", pad2Src: "preset:torcida", pad2Vol: 90,
        pad3Label: "Apito final", pad3Src: "preset:apito-final", pad3Vol: 90,
        pad4Label: "Palmas", pad4Src: "preset:palmas", pad4Vol: 100,
        pad5Label: "Sirene", pad5Src: "preset:sirene", pad5Vol: 80,
        pad6Label: "Tambor", pad6Src: "preset:tambor", pad6Vol: 90,
        pad7Label: "Suspense", pad7Src: "preset:suspense", pad7Vol: 90,
        pad8Label: "Vinheta", pad8Src: "preset:vinheta", pad8Vol: 90,
      },

      introStyle: "cascade",  // entrada ao ligar o módulo: 'cascade' | 'slide' | 'fade' | 'none'
      outroEnabled: true,     // saída animada ao desligar o módulo

      // ===== PERSONALIZAÇÃO EXCLUSIVA DO PLACAR (v2.2) =====
      // Independente da personalização da escalação acima — controla só a
      // Browser Source /arte/placar. Tudo aqui é aplicado em tempo real.
      placar: {
        fontFamily: "Montserrat",
        nameSize: 17,          // px — tamanho BASE do nome do time (reduz automaticamente se não couber)
        scoreSize: 30,         // px — tamanho do placar (ex: "2 × 1")
        clockSize: 14,         // px — tamanho do relógio
        boxWidth: 230,         // px — largura fixa de CADA lado (mandante/visitante)
        borderRadius: 10,      // px
        bgColor: "#0c0f14",
        bgOpacity: 100,        // %
        accentColor: "#0057ff", // cor de fundo da caixa central (placar/relógio)
        textColor: "#f5f6f8",
        useTeamColors: false,  // se true, cada lado usa a cor principal do time cadastrado
        style: "broadcast",    // 'broadcast' (v4.1) | 'bar' (retangular clássico) | 'card' (cantos arredondados + sombra maior)
        position: "top-center", // 'top-left' | 'top-center' | 'top-right'
        pulseOnGoal: true,     // pequena animação de destaque quando o placar muda

        // v3.2 — personalização do texto do campeonato (ex: "BRASILEIRÃO"),
        // que antes era fixo e praticamente invisível na transmissão.
        // Visibilidade continua controlada por modules.campeonato (mostrar/ocultar).
        competitionTextOverride: "", // vazio = usa meta.competition (Configurações); se preenchido, sobrescreve
        competitionFontFamily: "Montserrat",
        competitionFontSize: 15,
        competitionFontWeight: 700,
        competitionColor: "#dbe4ff",
        competitionOpacity: 100,
        competitionSpacing: 6, // px — espaço entre o texto e o placar

        // v4.1 — "GOL!" cobre o nome do time que marcou (só em gols lançados como evento)
        goalFlashEnabled: true,
        goalFlashText: "GOL",
        goalFlashColor: "#22c55e",     // cor de fundo do aviso
        goalFlashTextColor: "#04210e", // cor do texto do aviso
        goalFlashUseTeamColor: false,  // true = usa a cor principal do time que marcou
        goalFlashDurationMs: 4000,     // quanto tempo o aviso fica na tela
        goalFlashShowScorer: true,     // mostra "Fulano 27'" em letra menor
        // v4.1 — resultado dos pênaltis ao lado do placar: (4) 1 × 1 (3)
        showShootoutResult: true,

        // ===== v5.0 =====
        compact: false,         // placar compacto: só a sigla de cada time (botão na aba Partida)
        compactBoxWidth: 190,   // px — largura de cada lado no modo compacto
        crestScale: 86,         // % — escudo ocupa essa parte da altura do placar
        showCards: true,        // cartões amarelos/vermelhos de cada time ao lado do nome
        cardScale: 100,         // % — tamanho dos cartões no placar
        subFlashEnabled: true,  // aviso de substituição no placar (números de quem entra e sai)
        subFlashDurationMs: 5000,
        subFlashShowNames: true,
        introStyle: "sequence", // entrada ao ligar o placar: 'sequence' | 'slide' | 'fade' | 'none'
        outroEnabled: true,     // saída animada ao desligar o placar

        // ===== v5.1 =====
        addedTimeAnim: "destaque", // acréscimo: 'destaque' (entra com brilho e fica em pílula colorida) | 'entrada' (só a animação de entrada) | 'off'
        addedTimeColor: "#facc15", // cor da pílula/brilho do acréscimo
        goalExpandsCompact: true, // v5.2 — ao lançar um gol, o placar compacto abre sozinho no modo completo (e fica assim)

        // ===== v6.0 — contador de substituições (5 marcadores por time) =====
        subCounterMode: "event",  // 'event' (aparece a cada substituição) | 'always' (fica no ar depois da 1ª) | 'off'
        subCounterMax: 5,         // substituições permitidas por time
        subCounterExtraMs: 1500,  // quanto tempo fica na tela depois do aviso de substituição (modo 'event')
      },

      // ===== PERSONALIZAÇÃO DA FONTE DE EVENTOS ANIMADOS (v3.0/v3.2) =====
      // Browser Source própria (/arte/eventos), separada do placar. Não é
      // uma lista: cada evento novo aparece como uma notificação animada e
      // some sozinha depois de "durationMs" milissegundos.
      eventos: {
        fontFamily: "Montserrat",
        textSize: 20,
        durationMs: 4500,       // quanto tempo cada notificação FICA NA TELA
        // v3.2: estilos ampliados — 'slide'|'fade'|'bounce'|'sweep'|'stagger'|'reveal'|'pulse'|'wipe'
        animation: "slide",
        animationDurationMs: 500,  // v3.2: duração da transição de entrada/saída
        staggerDelayMs: 80,        // v3.2: atraso entre ícone/evento/jogador/time (estilo "stagger")
        direction: "ltr",          // v3.2: 'ltr' (esquerda→direita) | 'rtl' (direita→esquerda)
        position: "top-center", // 'top-left' | 'top-center' | 'top-right' | 'bottom-center'
        bgColor: "#0c0f14",
        bgOpacity: 92,
        textColor: "#f5f6f8",
        useTeamColors: true,    // barra lateral da notificação usa a cor do time do evento
        goalColor: "#22c55e",
        yellowColor: "#eab308",
        redColor: "#ef4444",
        subColor: "#0ea5e9",
        // v4.1 — substituição mostra ENTRA (verde) e SAI (vermelho) em linhas separadas
        subInColor: "#22c55e",
        subOutColor: "#ef4444",
      },

      // ===== PERSONALIZAÇÃO DA LINHA DO TEMPO (v3.2) =====
      // Browser Source própria (/arte/linha-do-tempo) — PERMANENTE, diferente
      // da notificação animada de /arte/eventos. Fica ligada durante toda a
      // transmissão mostrando o histórico cronológico. Alimentada pelos
      // mesmos match.events (uma única fonte de verdade).
      linhaDoTempo: {
        enabled: true,
        position: "top-right",  // 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
        maxEvents: 6,             // quantidade máxima exibida simultaneamente
        fontSize: 14,
        iconSize: 14,
        spacing: 6,               // espaçamento vertical entre linhas
        rowHeight: 28,
        bgColor: "#0c0f14",
        bgOpacity: 80,
        textColor: "#f5f6f8",
        showTeam: true,
        showMinute: true,
        showIcon: true,
      },

      // ===== PERSONALIZAÇÃO DA DISPUTA DE PÊNALTIS (v4.1) =====
      // Browser Source própria (/arte/penaltis). Só aparece no OBS quando você
      // clica em "Mostrar no OBS" na aba Pênaltis do painel.
      penaltis: {
        fontFamily: "Montserrat",
        position: "bottom-left", // 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
        title: "PÊNALTIS",
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
        useTeamColors: true,   // faixa lateral de cada time na cor dele
        showCrest: true,
        showShooter: true,     // linha "Última cobrança: Fulano — GOL"
        introStyle: "classic", // v6.1 — entrada do cartão (mesmas opções do fim de jogo)
        outroStyle: "classic", // v6.1 — saída do cartão
        kickAlert: true,       // v6.1 — aviso estiloso a cada cobrança (GOL! / PERDEU!)
        kickAlertStyle: "faixa", // faixa | carimbo | explosao | cortina | brilho
        kickAlertSeconds: 3,   // quanto tempo o aviso fica na tela
        kickAlertGoalText: "GOL!",
        kickAlertMissText: "PERDEU!", // ex.: PERDEU! / DEFENDEU! / PRA FORA!
        kickAlertOnlyGoals: false, // true = só avisa quando é gol
      },


      // ===== v6.0 — INFORMATIVOS (/arte/informativos): classificação, outros jogos, arbitragem e VAR =====
      // followPlacar = true usa as cores e a fonte do placar (paleta da transmissão); false usa as cores próprias abaixo.
      classificacao: {
        followPlacar: true,
        fontFamily: "Montserrat",
        position: "center-right",  // 9 posições (como os pênaltis)
        marginX: 40, marginY: 40,
        rowHeight: 36,
        fontSize: 18,
        widthCompact: 400,
        widthComplete: 760,
        borderRadius: 14,
        bgColor: "#0c0f14", bgOpacity: 94,
        accentColor: "#0057ff", textColor: "#f5f6f8",
        mainColor: "#0057ff",      // cor do destaque do jogo que está sendo transmitido
        showCrests: true,          // escudos (só times ligados ao cadastro de Times)
        compactShowName: false,    // modo compacto: false = sigla, true = nome do time
        showZoneStripe: true,      // faixa colorida da zona na lateral da linha
        showLegend: true,          // legenda das faixas (modo completo)
        showDelta: true,           // setinha de subiu/desceu (projeção)
        showLiveScore: true,       // mostra o placar do jogo em andamento ao lado do time
        dimLive: 55,               // % — destaque (suave) dos times que estão em jogo agora (o jogo principal é sempre mais forte)
        introStyle: "cascade",     // entrada: cascade|fade|slide|rise|drop|zoom|pop|flip|spin|blur|wipe|wipe-down|bounce|none
        outroStyle: "fade",        // saída: fade|cascade|slide|rise|drop|zoom|pop|flip|spin|blur|wipe|wipe-down|none
      },
      outrosJogos: {
        followPlacar: true,
        fontFamily: "Montserrat",
        position: "bottom-left",
        marginX: 40, marginY: 40,
        rowHeight: 46,
        fontSize: 20,
        width: 640,
        borderRadius: 14,
        bgColor: "#0c0f14", bgOpacity: 94,
        accentColor: "#0057ff", textColor: "#f5f6f8",
        goalColor: "#22c55e",
        title: "OUTROS JOGOS",
        showCrests: true,
        fullNames: true,           // nome inteiro (false = sigla)
        showRound: true,           // mostra a rodada quando for diferente da do jogo principal
        autoAlert: false,          // gol lançado em outro jogo aparece sozinho por alguns segundos, mesmo com a lista fora do ar
        alertMs: 7000,
        introStyle: "cascade",
        outroStyle: "fade",
      },
      arbitragem: {
        followPlacar: true,
        fontFamily: "Montserrat",
        position: "center",
        marginX: 40, marginY: 40,
        rowHeight: 56,
        fontSize: 22,
        width: 720,
        borderRadius: 14,
        bgColor: "#0c0f14", bgOpacity: 94,
        accentColor: "#0057ff", textColor: "#f5f6f8",
        titleRef: "ARBITRAGEM",
        titleVar: "ÁRBITROS DE VÍDEO",
        showFrom: true,            // mostra a federação / cidade ao lado do nome
        introStyle: "cascade",
        outroStyle: "fade",
      },
      // ===== v6.1 — ESTÁDIO (/arte/informativos): fotos em slide + dados do estádio =====
      estadio: {
        followPlacar: true,
        fontFamily: "Montserrat",
        position: "center",
        marginX: 40, marginY: 40,
        fontSize: 20,
        width: 820,
        photoHeight: 340,
        layout: "top",             // 'top' (foto em cima, dados embaixo) | 'side' (foto ao lado)
        borderRadius: 14,
        bgColor: "#0c0f14", bgOpacity: 94,
        accentColor: "#0057ff", textColor: "#f5f6f8",
        title: "ESTÁDIO",
        slideMs: 5000,             // tempo de cada foto
        slideStyle: "fade",        // 'fade' | 'slide' | 'zoom' (zoom lento)
        showDots: true,            // bolinhas indicando a foto atual
        introStyle: "cascade",
        outroStyle: "fade",
      },

      // ===== v5.0 — CARTÃO DE FIM DE JOGO (/arte/fim-de-jogo) =====
      // Opcional: só aparece quando você clica em "Mostrar no OBS" na aba Partida.
      fimDeJogo: {
        fontFamily: "Montserrat",
        position: "center",     // 'top-center' | 'center' | 'bottom-center'
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
        useTeamColors: true,    // faixa de cada time na cor dele
        showCrest: true,
        showScorers: true,      // lista de quem fez os gols
        showCompetition: true,  // campeonato / rodada
        showShootout: true,     // resultado dos pênaltis, se houve
        introStyle: "classic",  // v6.1 — entrada: classic|fade|slide|slide-right|rise|drop|zoom|pop|flip|spin|blur|wipe|wipe-down|bounce|none
        outroStyle: "classic",  // v6.1 — saída: classic|fade|slide|slide-right|rise|drop|zoom|pop|flip|spin|blur|wipe|wipe-down|none
      },
    },
  };
}

module.exports = { getDefaultState, getDefaultMatchSide, getDefaultShootout, getDefaultFinalCard, getDefaultLeague, getDefaultOthers, getDefaultOfficials, getDefaultZones, DEFAULT_CLUBS };
