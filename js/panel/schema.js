/**
 * DEFINIÇÃO DOS CONTROLES DA ABA "ARTE" (v4.0)
 * Em vez de centenas de linhas de HTML, cada controle é descrito aqui uma única
 * vez (caminho no estado, rótulo, tipo e limites). O mesmo gerador cria a tela,
 * liga os eventos e mantém tudo sincronizado em tempo real com o OBS.
 * Todos os caminhos/limites são os mesmos da v3.2 — nada foi removido.
 */
(() => {
  const FONTS = [
    { v: "Montserrat", l: "Montserrat" },
    { v: "Oswald", l: "Oswald" },
    { v: "Anton", l: "Anton" },
    { v: "'Roboto Condensed'", l: "Roboto Condensed" },
    { v: "'League Gothic'", l: "League Gothic" },
    { v: "'Bebas Neue'", l: "Bebas Neue" },
  ];
  const range = (path, label, min, max, step = 1, unit = "px") => ({ type: "range", path, label, min, max, step, unit });
  const color = (path, label) => ({ type: "color", path, label });
  const check = (path, label, help) => ({ type: "check", path, label, help });
  const select = (path, label, options, extra = {}) => ({ type: "select", path, label, options, ...extra });

  // v6.1 — estilos de entrada e de saída dos cartões de informativos (e fim de jogo / pênaltis)
  const IN_STYLES = [
    { v: "cascade", l: "Em cascata (linha por linha)" }, { v: "fade", l: "Aparecer (fade)" }, { v: "slide", l: "Deslizar do lado" },
    { v: "rise", l: "Subir de baixo" }, { v: "drop", l: "Cair de cima" }, { v: "zoom", l: "Zoom (cresce)" }, { v: "pop", l: "Pop (de grande para o normal)" },
    { v: "flip", l: "Virar (de cima)" }, { v: "spin", l: "Girar (de lado)" }, { v: "blur", l: "Desfocar → nítido" },
    { v: "wipe", l: "Cortina (da esquerda)" }, { v: "wipe-down", l: "Cortina (de cima)" }, { v: "bounce", l: "Quicar (mola)" }, { v: "none", l: "Sem animação" },
  ];
  const OUT_STYLES = [
    { v: "fade", l: "Sumir (fade)" }, { v: "cascade", l: "Em cascata (linha por linha)" }, { v: "slide", l: "Deslizar para o lado" },
    { v: "rise", l: "Descer" }, { v: "drop", l: "Subir" }, { v: "zoom", l: "Zoom (encolhe)" }, { v: "pop", l: "Pop (cresce e some)" },
    { v: "flip", l: "Virar" }, { v: "spin", l: "Girar" }, { v: "blur", l: "Desfocar" },
    { v: "wipe", l: "Cortina" }, { v: "wipe-down", l: "Cortina (para cima)" }, { v: "none", l: "Sem animação" },
  ];
  // v6.1 — entrada/saída do cartão inteiro (Fim de jogo e Pênaltis)
  const CARD_IN = [
    { v: "classic", l: "Clássica (sobe e aparece)" }, { v: "fade", l: "Aparecer (fade)" }, { v: "slide", l: "Deslizar da esquerda" }, { v: "slide-right", l: "Deslizar da direita" },
    { v: "rise", l: "Subir de baixo" }, { v: "drop", l: "Cair de cima" }, { v: "zoom", l: "Zoom (cresce)" }, { v: "pop", l: "Pop (de grande para o normal)" },
    { v: "flip", l: "Virar (de cima)" }, { v: "spin", l: "Girar (de lado)" }, { v: "blur", l: "Desfocar → nítido" },
    { v: "wipe", l: "Cortina (da esquerda)" }, { v: "wipe-down", l: "Cortina (de cima)" }, { v: "bounce", l: "Quicar (mola)" }, { v: "none", l: "Sem animação" },
  ];
  const CARD_OUT = [
    { v: "classic", l: "Clássica (desce e some)" }, { v: "fade", l: "Sumir (fade)" }, { v: "slide", l: "Deslizar para a esquerda" }, { v: "slide-right", l: "Deslizar para a direita" },
    { v: "rise", l: "Descer" }, { v: "drop", l: "Subir" }, { v: "zoom", l: "Zoom (encolhe)" }, { v: "pop", l: "Pop (cresce e some)" },
    { v: "flip", l: "Virar" }, { v: "spin", l: "Girar" }, { v: "blur", l: "Desfocar" },
    { v: "wipe", l: "Cortina" }, { v: "wipe-down", l: "Cortina (para cima)" }, { v: "none", l: "Sem animação" },
  ];
  const CARD_ACTIONS = (target) => [{ label: "Testar saída e entrada", action: "replay", arg: target }];
  const P = "customization.placar.";
  const E = "customization.eventos.";
  const L = "customization.linhaDoTempo.";
  const C = "customization.";
  const PN = "customization.penaltis.";
  const FJ = "customization.fimDeJogo.";
  const CL = "customization.classificacao.";
  const OJ = "customization.outrosJogos.";
  const AR = "customization.arbitragem.";
  const ES = "customization.estadio.";
  const INTRO_ACTIONS = (target) => [{ label: "Repetir animação de entrada", action: "replay", arg: target }];

  const PAL = window.Palettes; // paletas prontas (palettes.js)

  const sections = [
    {
      id: "modulos", title: "Módulos visíveis", icon: "eye", preview: "all", reset: null,
      intro: "Liga e desliga, num lugar só, tudo o que pode aparecer na transmissão — com as opções de cada módulo ao lado dele. Vale na hora para o OBS, sem recarregar nada.",
      custom: "modulos", groups: [],
    },
    {
      id: "placar", title: "Placar", icon: "match", preview: "/arte/placar", reset: "placar",
      intro: "Controla só a fonte do placar (/arte/placar), independente da escalação.",
      groups: [
        { title: "Aparência", cols: 2, controls: [
          select(P + "fontFamily", "Fonte", FONTS),
          select(P + "style", "Estilo", [{ v: "broadcast", l: "Broadcast (blocos separados)" }, { v: "bar", l: "Barra clássica" }, { v: "card", l: "Cartão (cantos + sombra)" }]),
          select(P + "position", "Posição na tela", [{ v: "top-left", l: "Topo — esquerda" }, { v: "top-center", l: "Topo — centro" }, { v: "top-right", l: "Topo — direita" }]),
          check(P + "useTeamColors", "Usar as cores de cada time"),
          check(P + "pulseOnGoal", "Pulso quando o placar mudar"),
        ], presets: { base: P, items: [
          { label: "Medidas recomendadas do Broadcast", values: { style: "broadcast", nameSize: 22, scoreSize: 34, clockSize: 15, boxWidth: 260, borderRadius: 10, bgOpacity: 100 } },
        ] } },
        { title: "Tamanhos", cols: 2, controls: [
          range(P + "nameSize", "Nome do time", 10, 32),
          range(P + "scoreSize", "Números do placar", 18, 56),
          range(P + "clockSize", "Relógio", 10, 28),
          range(P + "boxWidth", "Largura de cada lado", 140, 420, 10),
          range(P + "borderRadius", "Arredondamento", 0, 30),
          range(P + "bgOpacity", "Opacidade do fundo", 0, 100, 1, "%"),
        ] },
        { title: "Cores", cols: 3, controls: [
          color(P + "bgColor", "Fundo"),
          color(P + "accentColor", "Destaque (caixa central)"),
          color(P + "textColor", "Texto"),
        ], palettes: { key: "placar", items: PAL.PLACAR, base: P, teamButtons: true } },
        { title: "Aviso de GOL no placar", cols: 2,
          help: "Quando um gol é lançado em Partida → Gol, o nome do time que marcou é coberto por um aviso grande de GOL. Mexer no placar com + / − não dispara o aviso.",
          controls: [
          check(P + "goalFlashEnabled", "Ativar o aviso de GOL"),
          check(P + "goalFlashShowScorer", "Mostrar quem fez o gol"),
          { type: "text", path: P + "goalFlashText", label: "Texto do aviso", placeholder: "GOL" },
          { type: "number", path: P + "goalFlashDurationMs", label: "Tempo na tela (ms)", min: 1500, max: 12000, step: 250 },
          color(P + "goalFlashColor", "Cor do aviso"),
          color(P + "goalFlashTextColor", "Cor do texto"),
          check(P + "goalFlashUseTeamColor", "Usar a cor do time que marcou", "Em vez da cor do aviso"),
          check(P + "showShootoutResult", "Mostrar resultado dos pênaltis", "Ex.: (4) 1 × 1 (3) — só com a disputa no ar"),
        ], actions: [
          { label: "Testar aviso — mandante", action: "testGoal", arg: "home" },
          { label: "Testar aviso — visitante", action: "testGoal", arg: "away" },
        ] },
        { title: "Modo compacto e escudo", cols: 2,
          help: "O botão Completo / Compacto também fica na aba Partida, para trocar durante o jogo. No modo compacto cada lado mostra só a sigla do time (cadastrada em Times).",
          controls: [
          check(P + "compact", "Placar compacto (só a sigla)"),
          check(P + "goalExpandsCompact", "Gol abre o placar completo", "Ao lançar um gol, o compacto vira completo sozinho — e continua completo até você trocar"),
          range(P + "compactBoxWidth", "Largura de cada lado no compacto", 120, 320, 5),
          range(P + "crestScale", "Tamanho do escudo (% da altura do placar)", 40, 98, 1, "%"),
          check(P + "showCards", "Mostrar cartões de cada time", "Amarelos e vermelhos aparecem sob o nome e vão acumulando"),
          range(P + "cardScale", "Tamanho dos cartões", 60, 260, 5, "%"),
        ] },
        { title: "Aviso de SUBSTITUIÇÃO no placar", cols: 2,
          help: "Quando uma substituição é lançada em Partida → Substituição, a caixa do time mostra os números de quem entra (verde) e de quem sai (vermelho), igual ao aviso de GOL. As cores vêm da aba Eventos animados.",
          controls: [
          check(P + "subFlashEnabled", "Ativar o aviso de substituição"),
          check(P + "subFlashShowNames", "Mostrar também os nomes", "No modo compacto só aparecem os números"),
          { type: "number", path: P + "subFlashDurationMs", label: "Tempo na tela (ms)", min: 1500, max: 12000, step: 250 },
        ], actions: [
          { label: "Testar aviso — mandante", action: "testSub", arg: "home" },
          { label: "Testar aviso — visitante", action: "testSub", arg: "away" },
        ] },
        { title: "Contador de substituições (5 por time)", cols: 2,
          help: "Um mini-placar abaixo de cada time com 5 quadradinhos (como nos pênaltis): a cada substituição lançada um quadradinho se preenche, para todo mundo ver quantas já foram e quantas faltam. O botão de testar mostra um exemplo com 3 usadas.",
          controls: [
          select(P + "subCounterMode", "Quando aparece", [{ v: "event", l: "A cada substituição (some depois)" }, { v: "always", l: "Sempre, depois da 1ª substituição" }, { v: "off", l: "Desligado" }]),
          { type: "number", path: P + "subCounterMax", label: "Substituições por time", min: 1, max: 9, step: 1 },
          { type: "number", path: P + "subCounterExtraMs", label: "Fica na tela depois do aviso (ms)", min: 0, max: 20000, step: 250 },
        ], actions: [
          { label: "Testar contador — mandante", action: "testSub", arg: "home" },
          { label: "Testar contador — visitante", action: "testSub", arg: "away" },
        ] },
        { title: "Acréscimo (+N) em destaque", cols: 2,
          help: "O acréscimo é digitado em Partida → Relógio. Quando ele aparece ou muda com o placar no ar, o +N cresce, ganha um anel de luz e um brilho passa por cima. Vale para os três estilos do placar e nunca roda ao recarregar o OBS.",
          controls: [
          select(P + "addedTimeAnim", "Destaque", [{ v: "destaque", l: "Animação + pílula colorida fixa" }, { v: "entrada", l: "Só a animação de entrada" }, { v: "off", l: "Sem destaque (discreto, como antes)" }]),
          color(P + "addedTimeColor", "Cor do destaque"),
        ], actions: [
          { label: "Testar destaque do acréscimo", action: "testAdded" },
        ] },
        { title: "Entrada e saída animada", cols: 2,
          help: "A animação roda quando você liga ou desliga o Placar em Módulos visíveis (nunca ao abrir ou recarregar o OBS). Use o botão para ver de novo.",
          controls: [
          select(P + "introStyle", "Estilo", [{ v: "sequence", l: "Sequência (lados + placar + brilho)" }, { v: "slide", l: "Cair de cima" }, { v: "fade", l: "Fade suave" }, { v: "none", l: "Sem animação" }]),
          check(P + "outroEnabled", "Animar também a saída"),
        ], actions: INTRO_ACTIONS("placar") },
        { title: "Texto do campeonato", cols: 2,
          help: "Aparece acima do placar quando “Nome do campeonato” está ligado em Módulos. Em branco, usa o campo Campeonato das Configurações.",
          controls: [
          { type: "text", path: P + "competitionTextOverride", label: "Texto customizado (opcional)", placeholder: "Em branco usa o campo Campeonato", wide: true },
          select(P + "competitionFontFamily", "Fonte", FONTS),
          color(P + "competitionColor", "Cor do texto"),
          range(P + "competitionFontSize", "Tamanho", 9, 32),
          range(P + "competitionFontWeight", "Peso da fonte", 400, 900, 100, ""),
          range(P + "competitionOpacity", "Opacidade", 10, 100, 5, "%"),
          range(P + "competitionSpacing", "Espaço até o placar", 0, 24),
        ] },
      ],
    },
    {
      id: "eventos", title: "Eventos animados", icon: "goal", preview: "/arte/eventos", reset: "eventos",
      intro: "Fonte /arte/eventos: cada gol, cartão ou substituição aparece como uma notificação animada e some sozinha.",
      groups: [
        { title: "Tempo e animação", cols: 2, controls: [
          { type: "number", path: E + "durationMs", label: "Tempo na tela (ms)", min: 1000, max: 20000, step: 250 },
          select(E + "animation", "Animação", [
            { v: "slide", l: "Deslizar" }, { v: "fade", l: "Fade suave" }, { v: "bounce", l: "Bounce (elástico)" },
            { v: "sweep", l: "Sweep (barra passa antes do texto)" }, { v: "stagger", l: "Stagger (entra em sequência)" },
            { v: "reveal", l: "Reveal (máscara revela o texto)" }, { v: "pulse", l: "Pulse (entra e pulsa)" }, { v: "wipe", l: "Wipe (cor varre da esquerda)" },
          ]),
          select(E + "animationDurationMs", "Duração da animação", [{ v: 300, l: "300 ms" }, { v: 500, l: "500 ms" }, { v: 700, l: "700 ms" }, { v: 1000, l: "1000 ms" }], { num: true }),
          select(E + "direction", "Direção", [{ v: "ltr", l: "Esquerda → Direita" }, { v: "rtl", l: "Direita → Esquerda" }]),
          { type: "number", path: E + "staggerDelayMs", label: "Atraso entre elementos (ms) — estilo Stagger", min: 0, max: 500, step: 10, wide: true },
          select(E + "position", "Posição na tela", [{ v: "top-left", l: "Topo — esquerda" }, { v: "top-center", l: "Topo — centro" }, { v: "top-right", l: "Topo — direita" }, { v: "bottom-center", l: "Rodapé — centro" }]),
        ] },
        { title: "Texto", cols: 2, controls: [
          select(E + "fontFamily", "Fonte", FONTS),
          range(E + "textSize", "Tamanho do texto", 14, 36),
          range(E + "bgOpacity", "Opacidade do fundo", 0, 100, 1, "%"),
          check(E + "useTeamColors", "Barra lateral na cor do time"),
        ] },
        { title: "Cores", cols: 3, controls: [
          color(E + "bgColor", "Fundo"), color(E + "textColor", "Texto"),
          color(E + "goalColor", "Gol"), color(E + "yellowColor", "Cartão amarelo"),
          color(E + "redColor", "Cartão vermelho"), color(E + "subColor", "Substituição"),
          color(E + "subInColor", "Substituição — ENTRA"), color(E + "subOutColor", "Substituição — SAI"),
        ], palettes: { key: "eventos", items: PAL.EVENTOS, base: E } },
      ],
    },
    {
      id: "linha", title: "Linha do tempo", icon: "sub", preview: "/arte/linha-do-tempo", reset: "linhaDoTempo",
      intro: "Fonte /arte/linha-do-tempo: fica no ar a transmissão inteira, mostrando os últimos eventos em ordem. Aceita até 50 itens (o que passar da altura da tela do OBS fica cortado: ajuste a fonte e a altura da linha).",
      groups: [
        { title: "Exibição", cols: 2, controls: [
          check(L + "enabled", "Ativar linha do tempo"),
          select(L + "position", "Posição na tela", [{ v: "top-left", l: "Topo — esquerda" }, { v: "top-right", l: "Topo — direita" }, { v: "bottom-left", l: "Rodapé — esquerda" }, { v: "bottom-right", l: "Rodapé — direita" }]),
          { type: "number", path: L + "maxEvents", label: "Quantidade máxima exibida (até 50)", min: 1, max: 50, step: 1 },
          check(L + "showTeam", "Mostrar sigla do time"),
          check(L + "showMinute", "Mostrar minuto"),
          check(L + "showIcon", "Mostrar ícone"),
        ] },
        { title: "Tamanhos", cols: 2, controls: [
          range(L + "fontSize", "Fonte", 10, 24), range(L + "iconSize", "Ícone", 10, 24),
          range(L + "spacing", "Espaço entre linhas", 0, 20), range(L + "rowHeight", "Altura da linha", 20, 50),
          range(L + "bgOpacity", "Opacidade do fundo", 0, 100, 1, "%"),
        ] },
        { title: "Cores", cols: 3, controls: [color(L + "bgColor", "Fundo"), color(L + "textColor", "Texto")], palettes: { key: "linha", items: PAL.LINHA, base: L } },
      ],
    },
    {
      id: "penaltis", title: "Pênaltis", icon: "penalty", preview: "/arte/penaltis?demo=1", reset: "penaltis",
      intro: "Fonte /arte/penaltis (opcional): o cartão da disputa de pênaltis. A prévia mostra um exemplo; no ar ele só aparece quando você clica em “Mostrar no ar” na aba Pênaltis.",
      groups: [
        { title: "Exibição", cols: 2, controls: [
          select(PN + "position", "Posição na tela", [
            { v: "top-left", l: "Topo — esquerda" }, { v: "top-center", l: "Topo — centro" }, { v: "top-right", l: "Topo — direita" },
            { v: "center-left", l: "Meio — esquerda" }, { v: "center", l: "Centro" }, { v: "center-right", l: "Meio — direita" },
            { v: "bottom-left", l: "Rodapé — esquerda" }, { v: "bottom-center", l: "Rodapé — centro" }, { v: "bottom-right", l: "Rodapé — direita" },
          ]),
          select(PN + "fontFamily", "Fonte", FONTS),
          { type: "text", path: PN + "title", label: "Título do cartão", placeholder: "PÊNALTIS" },
          check(PN + "showCrest", "Mostrar escudos"),
          check(PN + "useTeamColors", "Faixa lateral na cor de cada time"),
          check(PN + "showShooter", "Mostrar a última cobrança", "Só aparece se você escolher o batedor"),
        ] },
        { title: "Animação do cartão", cols: 2, controls: [
          select(PN + "introStyle", "Estilo de entrada", CARD_IN),
          select(PN + "outroStyle", "Estilo de saída", CARD_OUT),
        ], help: "Vale quando você liga e desliga o cartão na aba Pênaltis.", actions: CARD_ACTIONS("penaltis") },
        { title: "Aviso a cada cobrança", cols: 2, controls: [
          check(PN + "kickAlert", "Mostrar aviso a cada cobrança", "Cobre o cartão por alguns segundos com GOL! ou PERDEU!, o batedor e o escudo do time"),
          check(PN + "kickAlertOnlyGoals", "Avisar só quando for gol"),
          select(PN + "kickAlertStyle", "Estilo do aviso", [
            { v: "faixa", l: "Faixa (cobre da esquerda)" }, { v: "carimbo", l: "Carimbo (a palavra bate no cartão)" }, { v: "explosao", l: "Explosão (clarão e faíscas)" },
            { v: "cortina", l: "Cortina (fecha e abre no meio)" }, { v: "brilho", l: "Brilho (letras se juntam)" },
          ]),
          range(PN + "kickAlertSeconds", "Tempo na tela", 2, 6, 0.5, "s"),
          { type: "text", path: PN + "kickAlertGoalText", label: "Palavra do gol", placeholder: "GOL!" },
          { type: "text", path: PN + "kickAlertMissText", label: "Palavra de quem perdeu", placeholder: "PERDEU!" },
        ], help: "O aviso aparece sozinho quando você lança uma cobrança, só com o cartão no ar. Os botões mostram um exemplo na prévia e no ar, sem registrar nada.", actions: [
          { label: "Testar aviso de GOL", action: "testKick", arg: "goal" }, { label: "Testar aviso de perdeu", action: "testKick", arg: "miss" },
        ] },
        { title: "Tamanhos", cols: 2, controls: [
          range(PN + "nameSize", "Nome do time", 14, 32),
          range(PN + "squareSize", "Quadrados das cobranças", 22, 56),
          range(PN + "borderRadius", "Arredondamento", 0, 24),
          range(PN + "bgOpacity", "Opacidade do fundo", 0, 100, 1, "%"),
        ] },
        { title: "Cores", cols: 3, controls: [
          color(PN + "bgColor", "Fundo"), color(PN + "accentColor", "Destaque"), color(PN + "textColor", "Texto"),
          color(PN + "goalColor", "Gol (verde)"), color(PN + "missColor", "Perdeu (vermelho)"), color(PN + "pendingColor", "Cobrança a fazer"),
        ], palettes: { key: "penaltis", items: PAL.PENALTIS, base: PN, teamButtons: true } },
      ],
    },
    {
      id: "fim", title: "Fim de jogo", icon: "flag", preview: "/arte/fim-de-jogo?demo=1", reset: "fimDeJogo",
      intro: "Fonte /arte/fim-de-jogo (opcional): placar final e quem fez os gols. A prévia mostra o cartão sempre; no ar ele só aparece quando você liga “Cartão de fim de jogo” na aba Partida.",
      groups: [
        { title: "Exibição", cols: 2, controls: [
          select(FJ + "position", "Posição na tela", [{ v: "top-center", l: "Topo — centro" }, { v: "center", l: "Centro" }, { v: "bottom-center", l: "Rodapé — centro" }]),
          select(FJ + "fontFamily", "Fonte", FONTS),
          { type: "text", path: FJ + "title", label: "Título do cartão", placeholder: "FIM DE JOGO" },
          check(FJ + "showCrest", "Mostrar escudos"),
          check(FJ + "showScorers", "Mostrar quem fez os gols"),
          check(FJ + "showCompetition", "Mostrar campeonato e rodada"),
          check(FJ + "showShootout", "Mostrar resultado dos pênaltis", "Só se houve disputa"),
          check(FJ + "useTeamColors", "Faixa lateral na cor de cada time"),
        ] },
        { title: "Animação", cols: 2, controls: [
          select(FJ + "introStyle", "Estilo de entrada", CARD_IN),
          select(FJ + "outroStyle", "Estilo de saída", CARD_OUT),
        ], help: "Vale quando você liga e desliga o cartão na aba Partida. Na prévia, use o botão para ver a saída e a entrada.", actions: CARD_ACTIONS("fimDeJogo") },
        { title: "Tamanhos", cols: 2, controls: [
          range(FJ + "width", "Largura do cartão", 500, 1200, 10),
          range(FJ + "nameSize", "Nome do time", 16, 44),
          range(FJ + "scoreSize", "Números do placar", 40, 120),
          range(FJ + "scorerSize", "Texto dos autores dos gols", 12, 30),
          range(FJ + "borderRadius", "Arredondamento", 0, 30),
          range(FJ + "bgOpacity", "Opacidade do fundo", 0, 100, 1, "%"),
        ] },
        { title: "Cores", cols: 3, controls: [
          color(FJ + "bgColor", "Fundo"), color(FJ + "accentColor", "Destaque (título e placar)"), color(FJ + "textColor", "Texto"),
        ], palettes: { key: "fim", items: PAL.PLACAR, base: FJ, teamButtons: true } },
      ],
    },
    {
      id: "classificacao", title: "Classificação", icon: "table", preview: "/arte/classificacao?demo=standings", reset: "classificacao",
      intro: "Fonte /arte/classificacao (opcional): só a tabela de classificação. A prévia mostra a tabela sempre; no ar ela só aparece quando você liga “Mostrar classificação no ar” na aba Classificação. Os pontos e as faixas se editam lá — aqui é só a aparência.",
      groups: [
        { title: "Exibição", cols: 2, controls: [
          select(CL + "position", "Posição na tela", [
            { v: "top-left", l: "Topo — esquerda" }, { v: "top-center", l: "Topo — centro" }, { v: "top-right", l: "Topo — direita" },
            { v: "center-left", l: "Meio — esquerda" }, { v: "center", l: "Centro" }, { v: "center-right", l: "Meio — direita" },
            { v: "bottom-left", l: "Rodapé — esquerda" }, { v: "bottom-center", l: "Rodapé — centro" }, { v: "bottom-right", l: "Rodapé — direita" },
          ]),
          select(CL + "introStyle", "Estilo de entrada", IN_STYLES),
          select(CL + "outroStyle", "Estilo de saída", OUT_STYLES),
          check(CL + "showCrests", "Mostrar escudos", "Só dos times ligados ao cadastro de Times"),
          check(CL + "compactShowName", "Compacto: nome inteiro em vez da sigla"),
          check(CL + "showZoneStripe", "Faixa colorida das zonas na lateral"),
          check(CL + "showLegend", "Legenda das faixas (modo completo)"),
          check(CL + "showDelta", "Setas de subiu / desceu", "Aparecem quando a projeção ao vivo está ativa"),
          check(CL + "showLiveScore", "Placar do jogo em andamento ao lado do time"),
        ] },
        { title: "Tamanhos", cols: 2, controls: [
          range(CL + "fontSize", "Tamanho do texto", 12, 28),
          range(CL + "rowHeight", "Altura de cada linha", 26, 52),
          range(CL + "widthCompact", "Largura — modo compacto", 300, 700, 10),
          range(CL + "widthComplete", "Largura — modo completo", 560, 1100, 10),
          range(CL + "marginX", "Margem lateral", 0, 200, 5),
          range(CL + "marginY", "Margem vertical", 0, 200, 5),
          range(CL + "borderRadius", "Arredondamento", 0, 30),
          range(CL + "dimLive", "Destaque suave dos times em jogo", 0, 100, 5, "%"),
        ] },
        { title: "Cores", cols: 3,
          help: "Com “Usar a paleta do placar” ligado, a tabela copia fonte, fundo, destaque e texto do placar — fica sempre combinando com a transmissão. Desligue para escolher cores só dela.",
          controls: [
          check(CL + "followPlacar", "Usar a paleta do placar"),
          select(CL + "fontFamily", "Fonte (própria)", FONTS),
          range(CL + "bgOpacity", "Opacidade do fundo (própria)", 0, 100, 1, "%"),
          color(CL + "bgColor", "Fundo (própria)"), color(CL + "accentColor", "Destaque (própria)"), color(CL + "textColor", "Texto (própria)"),
          color(CL + "mainColor", "Jogo da transmissão (própria)"),
        ], palettes: { key: "classificacao", items: PAL.PLACAR, base: CL, mirror: { mainColor: "accentColor" } } },
      ],
    },
    {
      id: "outros", title: "Outros jogos", icon: "live", preview: "/arte/informativos?demo=others", reset: "outrosJogos",
      intro: "Fonte /arte/informativos (opcional): os placares dos outros jogos que acontecem ao mesmo tempo. Controle em Partida → Outros jogos.",
      groups: [
        { title: "Exibição", cols: 2, controls: [
          select(OJ + "position", "Posição na tela", [
            { v: "top-left", l: "Topo — esquerda" }, { v: "top-center", l: "Topo — centro" }, { v: "top-right", l: "Topo — direita" },
            { v: "center-left", l: "Meio — esquerda" }, { v: "center", l: "Centro" }, { v: "center-right", l: "Meio — direita" },
            { v: "bottom-left", l: "Rodapé — esquerda" }, { v: "bottom-center", l: "Rodapé — centro" }, { v: "bottom-right", l: "Rodapé — direita" },
          ]),
          select(OJ + "introStyle", "Estilo de entrada", IN_STYLES),
          select(OJ + "outroStyle", "Estilo de saída", OUT_STYLES),
          { type: "text", path: OJ + "title", label: "Título", placeholder: "OUTROS JOGOS" },
          check(OJ + "showCrests", "Mostrar escudos"),
          check(OJ + "fullNames", "Nome inteiro (desligado = sigla)"),
          check(OJ + "showRound", "Mostrar a rodada quando for diferente da do jogo principal"),
          check(OJ + "autoAlert", "Avisar gol sozinho", "Ao lançar um gol em outro jogo, ele aparece por alguns segundos mesmo com a lista fora do ar"),
          { type: "number", path: OJ + "alertMs", label: "Tempo do aviso automático (ms)", min: 2500, max: 20000, step: 500 },
        ] },
        { title: "Tamanhos", cols: 2, controls: [
          range(OJ + "fontSize", "Tamanho do texto", 14, 30),
          range(OJ + "rowHeight", "Altura de cada jogo", 34, 72),
          range(OJ + "width", "Largura", 420, 1000, 10),
          range(OJ + "marginX", "Margem lateral", 0, 200, 5), range(OJ + "marginY", "Margem vertical", 0, 200, 5),
          range(OJ + "borderRadius", "Arredondamento", 0, 30),
        ] },
        { title: "Cores", cols: 3, controls: [
          check(OJ + "followPlacar", "Usar a paleta do placar"),
          select(OJ + "fontFamily", "Fonte (própria)", FONTS),
          range(OJ + "bgOpacity", "Opacidade do fundo (própria)", 0, 100, 1, "%"),
          color(OJ + "bgColor", "Fundo (própria)"), color(OJ + "accentColor", "Destaque (própria)"), color(OJ + "textColor", "Texto (própria)"),
          color(OJ + "goalColor", "Destaque do gol"),
        ], palettes: { key: "outros", items: PAL.PLACAR, base: OJ } },
      ],
    },
    {
      id: "arbitragem", title: "Arbitragem e VAR", icon: "flag", preview: "/arte/informativos?demo=ref", reset: "arbitragem",
      intro: "Fonte /arte/informativos (opcional): os cartões da arbitragem (árbitro, assistentes e 4º árbitro) e dos árbitros de vídeo. Os nomes e os botões de mostrar ficam em Partida → Arbitragem. A prévia mostra a arbitragem; use os botões da prévia para ver o VAR.",
      groups: [
        { title: "Exibição", cols: 2, controls: [
          select(AR + "position", "Posição na tela", [
            { v: "top-left", l: "Topo — esquerda" }, { v: "top-center", l: "Topo — centro" }, { v: "top-right", l: "Topo — direita" },
            { v: "center-left", l: "Meio — esquerda" }, { v: "center", l: "Centro" }, { v: "center-right", l: "Meio — direita" },
            { v: "bottom-left", l: "Rodapé — esquerda" }, { v: "bottom-center", l: "Rodapé — centro" }, { v: "bottom-right", l: "Rodapé — direita" },
          ]),
          select(AR + "introStyle", "Estilo de entrada", IN_STYLES),
          select(AR + "outroStyle", "Estilo de saída", OUT_STYLES),
          { type: "text", path: AR + "titleRef", label: "Título da arbitragem", placeholder: "ARBITRAGEM" },
          { type: "text", path: AR + "titleVar", label: "Título do VAR", placeholder: "ÁRBITROS DE VÍDEO" },
          check(AR + "showFrom", "Mostrar UF / federação ao lado do nome"),
        ] },
        { title: "Tamanhos", cols: 2, controls: [
          range(AR + "fontSize", "Tamanho do texto", 14, 34),
          range(AR + "rowHeight", "Altura de cada linha", 40, 90),
          range(AR + "width", "Largura", 460, 1100, 10),
          range(AR + "marginX", "Margem lateral", 0, 200, 5), range(AR + "marginY", "Margem vertical", 0, 200, 5),
          range(AR + "borderRadius", "Arredondamento", 0, 30),
        ] },
        { title: "Cores", cols: 3, controls: [
          check(AR + "followPlacar", "Usar a paleta do placar"),
          select(AR + "fontFamily", "Fonte (própria)", FONTS),
          range(AR + "bgOpacity", "Opacidade do fundo (própria)", 0, 100, 1, "%"),
          color(AR + "bgColor", "Fundo (própria)"), color(AR + "accentColor", "Destaque (própria)"), color(AR + "textColor", "Texto (própria)"),
        ], palettes: { key: "arbitragem", items: PAL.PLACAR, base: AR } },
      ],
    },
    {
      id: "estadio", title: "Estádio", icon: "image", preview: "/arte/informativos?demo=stadium", reset: "estadio",
      intro: "Fonte /arte/informativos (opcional): cartão do estádio, com as fotos em slide e os dados que você preencher. Os dados, as fotos e o botão de mostrar ficam em Partida → Estádio.",
      groups: [
        { title: "Exibição", cols: 2, controls: [
          select(ES + "position", "Posição na tela", [
            { v: "top-left", l: "Topo — esquerda" }, { v: "top-center", l: "Topo — centro" }, { v: "top-right", l: "Topo — direita" },
            { v: "center-left", l: "Meio — esquerda" }, { v: "center", l: "Centro" }, { v: "center-right", l: "Meio — direita" },
            { v: "bottom-left", l: "Rodapé — esquerda" }, { v: "bottom-center", l: "Rodapé — centro" }, { v: "bottom-right", l: "Rodapé — direita" },
          ]),
          select(ES + "layout", "Disposição", [{ v: "top", l: "Foto em cima, dados embaixo" }, { v: "side", l: "Foto ao lado dos dados" }]),
          select(ES + "introStyle", "Estilo de entrada", IN_STYLES),
          select(ES + "outroStyle", "Estilo de saída", OUT_STYLES),
          { type: "text", path: ES + "title", label: "Título", placeholder: "ESTÁDIO" },
          select(ES + "slideStyle", "Troca de foto", [{ v: "fade", l: "Esmaecer (fade)" }, { v: "slide", l: "Deslizar" }, { v: "zoom", l: "Zoom lento" }]),
          range(ES + "slideMs", "Tempo de cada foto", 2000, 15000, 500, "ms"),
          check(ES + "showDots", "Mostrar bolinhas da foto atual"),
        ] },
        { title: "Tamanhos", cols: 2, controls: [
          range(ES + "fontSize", "Tamanho do texto", 14, 34),
          range(ES + "width", "Largura", 460, 1300, 10),
          range(ES + "photoHeight", "Altura da foto", 160, 620, 10),
          range(ES + "marginX", "Margem lateral", 0, 200, 5), range(ES + "marginY", "Margem vertical", 0, 200, 5),
          range(ES + "borderRadius", "Arredondamento", 0, 30),
        ] },
        { title: "Cores", cols: 3, controls: [
          check(ES + "followPlacar", "Usar a paleta do placar"),
          select(ES + "fontFamily", "Fonte (própria)", FONTS),
          range(ES + "bgOpacity", "Opacidade do fundo (própria)", 0, 100, 1, "%"),
          color(ES + "bgColor", "Fundo (própria)"), color(ES + "accentColor", "Destaque (própria)"), color(ES + "textColor", "Texto (própria)"),
        ], palettes: { key: "estadio", items: PAL.PLACAR, base: ES } },
      ],
    },
    {
      id: "visuais", title: "Visuais salvos", icon: "image", preview: "all", reset: null, custom: "visuais",
      intro: "Guarde até 3 aparências completas da arte (placar, escalação, eventos, linha do tempo, pênaltis e fim de jogo) e troque entre elas com um clique.",
      groups: [],
    },
    {
      id: "escalacao", title: "Escalação", icon: "lineup", preview: "/arte", reset: "escalacao",
      intro: "Personalização da arte com os 11 titulares (fonte /arte).",
      groups: [
        { title: "Texto", cols: 2, controls: [
          select(C + "fontFamily", "Fonte dos jogadores", FONTS),
          range(C + "nameSize", "Nome do jogador", 12, 40), range(C + "numberSize", "Número", 12, 40),
          range(C + "teamNameSize", "Nome do time", 14, 60),
        ] },
        { title: "Linhas e caixas", cols: 2, controls: [
          range(C + "lineSpacing", "Espaço entre linhas", 0, 20), range(C + "rowHeight", "Altura das linhas", 24, 80),
          range(C + "innerPadding", "Espaçamento interno", 0, 48), range(C + "borderRadius", "Arredondamento", 0, 40),
          range(C + "dividerThickness", "Espessura das divisórias", 0, 10),
        ] },
        { title: "Posição e tamanho", cols: 2, controls: [
          range(C + "artWidth", "Largura total da arte", 360, 900, 10), range(C + "marginTop", "Margem superior", 0, 200, 2),
          range(C + "marginLeft", "Margem esquerda", 0, 200, 2),
        ] },
        { title: "Escudo e barra superior", cols: 2, controls: [
          range(C + "crestSize", "Tamanho do escudo", 20, 100, 2), range(C + "crestGap", "Espaço escudo/nome", 0, 40),
          range(C + "topBarThickness", "Espessura da barra superior", 30, 120, 2),
        ] },
        { title: "Marcações, substituição e reservas", cols: 2,
          help: "As marcações (bola de gol, cartões e substituição) ficam à direita do nome. Com mais reservas do que linhas, a lista sobe sozinha em páginas, repetindo enquanto os reservas estiverem no ar. Quem leva cartão vermelho fica com a linha escura; quem faz gol tem o nome piscando por alguns segundos.",
          controls: [
          range(C + "markerSize", "Tamanho das marcações (gol e cartão)", 60, 260, 5, "%"),
          check(C + "scorerBlink", "Nome de quem fez o gol pisca"),
          { type: "number", path: C + "subAnimationMs", label: "Duração da animação de substituição (ms)", min: 2000, max: 12000, step: 250 },
          { type: "text", path: C + "benchTitle", label: "Título do painel de reservas", placeholder: "RESERVAS" },
          select(C + "benchMode", "Como os reservas aparecem", [{ v: "swap", l: "No lugar dos titulares (titulares deslizam)" }, { v: "below", l: "Painel embaixo dos titulares" }]),
          { type: "number", path: C + "benchPageMs", label: "Tempo parado em cada página de reservas (ms)", min: 1500, max: 12000, step: 250 },
          check(C + "subMarker", "Ícone de substituição na escalação", "Aparece na linha de quem entrou, junto com gol e cartão"),
          check(C + "subMarkerShowOut", "Mostrar o número de quem saiu", "Ao lado do ícone de substituição"),
        ] },
        { title: "Entrada e saída animada", cols: 2,
          help: "Roda quando você liga ou desliga a Escalação em Módulos visíveis (nunca ao abrir ou recarregar o OBS).",
          controls: [
          select(C + "introStyle", "Estilo", [{ v: "cascade", l: "Cascata (cabeçalho abre e linhas entram)" }, { v: "slide", l: "Deslizar" }, { v: "fade", l: "Fade suave" }, { v: "none", l: "Sem animação" }]),
          check(C + "outroEnabled", "Animar também a saída"),
        ], actions: INTRO_ACTIONS("escalacao") },
        { title: "Transparência", cols: 2, controls: [
          range(C + "bgTransparency", "Transparência do fundo", 0, 100, 1, "%"),
          range(C + "bgOpacity", "Opacidade do fundo", 0, 100, 1, "%"),
          range(C + "dividerOpacity", "Opacidade das linhas", 0, 100, 1, "%"),
        ] },
      ],
    },
    {
      id: "efeitos", title: "Efeitos", icon: "art", preview: "/arte", reset: "effects",
      intro: "Efeitos visuais da arte da escalação.",
      groups: [{ title: "Efeitos", cols: 2, controls: [
        check(C + "effects.shadow", "Sombra"), check(C + "effects.outline", "Contorno"),
        check(C + "effects.glow", "Brilho"), check(C + "effects.translucentBg", "Fundo translúcido"),
        check(C + "effects.separators", "Separadores"), check(C + "effects.gradient", "Gradiente"),
      ] }],
    },
  ];

  App.schema = { sections, FONTS };

  /* ---------- Gerador de HTML dos controles ---------- */
  const esc = App.escapeHtml;
  function controlHtml(c) {
    const id = "ctl_" + c.path.replace(/\./g, "_");
    const wide = c.wide ? " ctl-wide" : "";
    if (c.type === "range") {
      return `<div class="ctl${wide}"><label for="${id}"><span>${esc(c.label)}</span><output data-out-for="${c.path}"></output></label>
        <input type="range" id="${id}" data-path="${c.path}" data-type="range" data-unit="${esc(c.unit)}" min="${c.min}" max="${c.max}" step="${c.step}"></div>`;
    }
    if (c.type === "color") {
      return `<div class="ctl ctl-color${wide}"><label for="${id}">${esc(c.label)}</label>
        <div class="color-input"><input type="color" id="${id}" data-path="${c.path}" data-type="color"><code data-hex-for="${c.path}"></code></div></div>`;
    }
    if (c.type === "check") {
      return `<label class="switch${wide}" for="${id}"><input type="checkbox" id="${id}" data-path="${c.path}" data-type="check"><i></i>
        <span class="switch-text"><b>${esc(c.label)}</b>${c.help ? `<small>${esc(c.help)}</small>` : ""}</span></label>`;
    }
    if (c.type === "select") {
      return `<div class="ctl${wide}"><label for="${id}">${esc(c.label)}</label>
        <select id="${id}" data-path="${c.path}" data-type="select" ${c.num ? 'data-num="1"' : ""}>${c.options.map((o) => `<option value="${esc(o.v)}">${esc(o.l)}</option>`).join("")}</select></div>`;
    }
    if (c.type === "number") {
      return `<div class="ctl${wide}"><label for="${id}">${esc(c.label)}</label>
        <input type="number" id="${id}" data-path="${c.path}" data-type="number" min="${c.min}" max="${c.max}" step="${c.step}"></div>`;
    }
    if (c.type === "text") {
      return `<div class="ctl${wide}"><label for="${id}">${esc(c.label)}</label>
        <input type="text" id="${id}" data-path="${c.path}" data-type="text" placeholder="${esc(c.placeholder || "")}"></div>`;
    }
    return "";
  }

  function groupHtml(g) {
    let pal = "";
    if (g.palettes) {
      const sw = g.palettes.items.map((p, i) =>
        `<button type="button" class="palette-swatch" data-pal-index="${i}" title="${esc(p.name)}">${p.swatch.map((c) => `<span style="background:${c}"></span>`).join("")}</button>`).join("");
      const tb = g.palettes.teamButtons
        ? `<div class="row-gap pal-team"><span class="muted small">Ou use as cores de um time:</span>
             <button type="button" class="btn btn-sm" data-team-pal="home">Do mandante</button>
             <button type="button" class="btn btn-sm" data-team-pal="away">Do visitante</button></div>` : "";
      pal = `<p class="muted small">Paletas prontas <span class="pal-name" data-pal-name="${g.palettes.key}"></span></p><div class="palette-row" data-palettes="${g.palettes.key}">${sw}</div>${tb}`;
    }
    const presets = g.presets
      ? `<div class="row-gap preset-row" data-presets="${esc(g.presets.base)}">${g.presets.items.map((p, i) => `<button type="button" class="btn btn-sm" data-preset-index="${i}">${esc(p.label)}</button>`).join("")}</div>` : "";
    const actions = g.actions
      ? `<div class="row-gap action-row">${g.actions.map((a) => `<button type="button" class="btn btn-sm" data-action="${esc(a.action)}" data-arg="${esc(a.arg || "")}">${esc(a.label)}</button>`).join("")}</div>` : "";
    return `<div class="ctl-group"><h3>${esc(g.title)}</h3>${g.help ? `<p class="muted small">${esc(g.help)}</p>` : ""}
      <div class="ctl-grid cols-${g.cols || 2}">${g.controls.map(controlHtml).join("")}</div>${presets}${actions}${pal}</div>`;
  }

  App.controls = {
    html: (section) => section.groups.map(groupHtml).join(""),

    /** Liga os eventos (delegação) de um container com controles [data-path]. */
    bind(root, afterChange) {
      const handle = (el, isFinal) => {
        const path = el.dataset.path;
        if (!path) return;
        const type = el.dataset.type;
        let value;
        if (type === "range") value = Number(el.value);
        else if (type === "check") value = el.checked;
        else if (type === "number") {
          if (el.value === "") return;
          value = Number(el.value);
          if (!Number.isFinite(value)) return;
          if (isFinal) { value = Math.min(Number(el.max), Math.max(Number(el.min), value)); el.value = value; }
        } else if (type === "select" && el.dataset.num) value = Number(el.value);
        else value = el.value;
        App.patch(path, value);
        App.controls.syncOne(root, el, value);
        afterChange && afterChange(path, value);
      };
      root.addEventListener("input", (e) => { if (e.target.matches("[data-path]") && e.target.type !== "checkbox" && e.target.tagName !== "SELECT") handle(e.target, false); });
      root.addEventListener("change", (e) => { if (e.target.matches("[data-path]")) handle(e.target, true); });
    },

    syncOne(root, el, value) {
      if (el.dataset.type === "range") {
        const out = root.querySelector(`[data-out-for="${el.dataset.path}"]`);
        if (out) out.textContent = value + (el.dataset.unit || "");
      } else if (el.dataset.type === "color") {
        const hex = root.querySelector(`[data-hex-for="${el.dataset.path}"]`);
        if (hex) hex.textContent = String(value).toUpperCase();
      }
    },

    /** Copia os valores do estado para os controles (sem mexer no que está em foco). */
    sync(root) {
      root.querySelectorAll("[data-path]").forEach((el) => {
        const value = App.getByPath(App.state, el.dataset.path);
        if (value === undefined) return;
        if (el.dataset.type === "check") el.checked = !!value;
        else if (document.activeElement !== el) el.value = value;
        App.controls.syncOne(root, el, value);
      });
    },
  };
})();
