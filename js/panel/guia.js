/** COMO CONFIGURAR (v4.0/v5.0): guia passo a passo com as URLs reais deste computador. */
(() => {
  const { $, escapeHtml } = App;
  const url = (p) => App.abs(p);
  const panelUrl = () => App.abs("/").replace(/index\.html.*$/, "").replace(/\?.*$/, "");
  const urlRow = (p, label) => `<div class="url-row"><span>${label}</span><code>${url(p)}</code><button class="btn btn-sm" data-copy="${url(p)}">${App.ico("copy")}Copiar</button></div>`;

  function render() {
    $("#guideBody").innerHTML = `
    <div class="card guide-card"><div class="guide-step"><span class="step-num">1</span><div>
      <h2>Publicar o site (só na primeira vez)</h2>
      <ol>
        <li>No <b>GitHub</b>, crie um repositório (pode ser público) e envie <b>todos os arquivos desta pasta</b> para ele (Add file → Upload files).</li>
        <li>No repositório: <b>Settings → Pages → Build and deployment → Deploy from a branch</b>, escolha a branch <code>main</code> e a pasta <code>/ (root)</code>, e salve.</li>
        <li>Em 1 a 2 minutos o endereço aparece no topo da página (algo como <code>https://seu-usuario.github.io/nome-do-repositorio/</code>). Esse é o endereço do <b>painel</b>; abra no celular que vai controlar o jogo.</li>
        <li>Agora você está em <code>${panelUrl()}</code>. Não precisa de computador, terminal nem <code>npm start</code>.</li>
      </ol>
    </div></div></div>

    <div class="card guide-card"><div class="guide-step"><span class="step-num">2</span><div>
      <h2>Liberar o banco de dados do Firebase (só na primeira vez)</h2>
      <ol>
        <li>No <b>Firebase Console</b>, abra o projeto → <b>Realtime Database → Regras</b>.</li>
        <li>Cole as regras abaixo e clique em <b>Publicar</b>. As artes (Camera Live, CameraFi, OBS) <b>leem sem senha</b>; só quem está <b>logado</b> no painel consegue gravar. O aviso “presence” permite que as artes apareçam como conectadas no Dashboard:
          <pre class="code-block">{
  "rules": {
    "$sala": {
      ".read": "$sala.matches(/^placar(_.*)?$/)",
      ".write": "auth != null &amp;&amp; $sala.matches(/^placar(_.*)?$/)",
      "presence": { "$id": { ".write": "$sala.matches(/^placar(_.*)?$/)" } }
    }
  }
}</pre>
          Essas regras valem para <code>placar</code> e para qualquer sala (<code>placar_quadra2</code>…).</li>
        <li><b>Login do painel:</b> no Firebase Console abra <b>Authentication → Sign-in method</b>, ative <b>E-mail/senha</b>. Depois, em <b>Authentication → Users → Add user</b>, crie o seu usuário (e-mail e senha). Não existe tela de cadastro no painel — só quem você criou entra. Em <b>Authentication → Settings → Authorized domains</b>, confira se o endereço <code>seu-usuario.github.io</code> está na lista.</li>
        <li>Ao abrir o painel, aparece a tela de <b>Entrar</b>. A sessão fica salva no aparelho (não pede senha de novo a cada vez); o botão <b>Sair</b> fica em Configurações. As artes <b>nunca</b> pedem login.</li>
        <li>Sem login, ninguém consegue alterar o placar nem os patrocinadores (qualquer pessoa ainda consegue <b>ler</b>, que é o que as artes precisam). Para mais de um jogo ao mesmo tempo, abra o painel com <code>?sala=quadra2</code> no final do endereço (e as artes com o mesmo final) — cada sala é um placar separado; neste caso as regras precisam liberar também <code>"placar_quadra2"</code>.</li>
        <li>O painel mostra “Conectado ao Firebase” no Dashboard quando está tudo certo.</li>
      </ol>
    </div></div></div>

    <div class="card guide-card"><div class="guide-step"><span class="step-num">3</span><div>
      <h2>Cadastrar times e escalar</h2>
      <ol>
        <li><b>Times</b>: cadastre nome, sigla, escudo (PNG, JPG ou WebP — o painel reduz para 512 px sozinho), cores e elenco. Salva sozinho.</li>
        <li><b>Escalação</b>: escolha mandante e visitante e marque os 11 titulares de cada lado (e o capitão). Marque também os <b>reservas</b> — quando você ligar “Reservas do mandante / do visitante na arte”, os titulares deslizam e os reservas ocupam o lugar (cada time liga sozinho; com mais de 11, a lista sobe em páginas).</li>
        <li><b>Configurações</b>: preencha o campeonato — ele aparece no placar.</li>
      </ol>
    </div></div></div>

    <div class="card guide-card"><div class="guide-step"><span class="step-num">4</span><div>
      <h2>Colocar as artes na transmissão</h2>
      <p>Cada arte é uma página com <b>fundo transparente</b>. No aplicativo ou programa de transmissão (Camera Live, OBS…) adicione uma fonte de <b>página da web / navegador</b> por endereço, uma para cada item abaixo, no tamanho <b>1920 × 1080</b>. Se o seu aplicativo não aceitar página da web como sobreposição, ele não vai mostrar as artes — nesse caso use um programa que aceite (como o OBS) para compor a imagem.</p>
      <div class="url-list">
        ${urlRow("/arte", "Escalação")}
        ${urlRow("/arte/placar", "Placar e relógio")}
        ${urlRow("/arte/eventos", "Eventos animados")}
        ${urlRow("/arte/linha-do-tempo", "Linha do tempo")}
      </div>
      <p><b>Opcional — Fim de jogo:</b> cartão com o placar final e quem fez os gols. Fica invisível até você ligar “Cartão de fim de jogo” na aba <b>Partida</b>:</p>
      <div class="url-list">
        ${urlRow("/arte/fim-de-jogo", "Fim de jogo (opcional)")}
      </div>
      <p><b>Opcional — Pênaltis:</b> se o jogo puder ir para as penalidades, adicione também esta fonte (mesmo tamanho 1920×1080). Ela fica invisível até você clicar em “Mostrar no ar” na aba <b>Pênaltis</b>:</p>
      <div class="url-list">
        ${urlRow("/arte/penaltis", "Pênaltis (opcional)")}
      </div>
      <p><b>Opcional — Classificação e Informativos (v6.1):</b> a <b>Classificação</b> tem fonte própria (só a tabela) e os <b>Informativos</b> trazem <b>Outros jogos</b>, <b>Arbitragem/VAR</b> e <b>Estádio</b>. Cada posição é ajustada em <b>Arte</b>; ficam invisíveis até você mostrar:</p>
      <div class="url-list">
        ${urlRow("/arte/classificacao", "Classificação (opcional)")}
        ${urlRow("/arte/informativos", "Informativos (opcional)")}
      </div>
      <p><b>Opcional — Patrocinadores (1.1):</b> logos em loop, na ordem e com o tempo que você definir na aba <b>Patrocinadores</b>. Fica transparente quando o bloco é “vazio”:</p>
      <div class="url-list">
        ${urlRow("/arte/patrocinadores", "Patrocinadores (opcional)")}
      </div>
      <ul>
        <li>Empilhe as artes na mesma cena, no tamanho da tela. A posição de cada uma é ajustada na aba <b>Arte</b>, não na transmissão.</li>
        <li>As artes só <b>leem</b> o Firebase: funcionam em qualquer aparelho com internet, sem precisar do painel aberto no mesmo lugar.</li>
      </ul>
      <button class="btn" data-go="dashboard">${App.ico("dashboard")}Ver se as fontes estão conectadas</button>
    </div></div></div>

    <div class="card guide-card"><div class="guide-step"><span class="step-num">★</span><div>
      <h2>Patrocinadores (1.1)</h2>
      <ol>
        <li>Aba <b>Patrocinadores → Galeria</b>: <b>Adicionar imagens</b> (PNG, JPG ou WebP; o painel reduz para até 700 px). Dê um <b>nome</b> a cada patrocinador no campo abaixo da imagem.</li>
        <li><b>Playlist (rascunho)</b>: <b>Adicionar bloco</b> (logo) ou <b>Adicionar bloco vazio</b> (tela limpa). Em cada bloco escolha a imagem (ou Vazio), o <b>tempo em segundos</b> e o <b>zoom</b>; reordene com as setas ou exclua.</li>
        <li><b>Aparência do bloco</b>: tamanho fixo (largura e altura), posição na tela, fundo sólido, margem, animação de entrada e de saída (ou só <i>fade</i>) e movimento leve. O logo sempre cabe dentro do bloco, seja grande ou pequeno.</li>
        <li>Nada vai ao ar sozinho: confira na prévia <b>Rascunho</b> e clique em <b>Atualizar no ar / Salvar playlist</b>. A playlist começa do primeiro bloco.</li>
        <li><b>Ao vivo</b>: <b>Pausar/Continuar</b> congela o bloco (com contador de tempo restante), <b>Próximo</b> pula para o próximo bloco (logo ou vazio), <b>Anterior</b>, <b>Reiniciar</b>, clicar em um bloco da fila toca ele na hora e <b>Tirar do ar</b> esconde tudo sem perder o ponto.</li>
      </ol>
    </div></div></div>

    <div class="card guide-card"><div class="guide-step"><span class="step-num">5</span><div>
      <h2>Durante o jogo</h2>
      <ol>
        <li>Na aba <b>Partida</b>, escolha o período e clique em <b>Iniciar</b>. O relógio nunca para sozinho.</li>
        <li>No intervalo, use <b>Próximo período</b>: ele zera o relógio (pausado) e muda para o 2º tempo. Aí é só dar <b>Iniciar</b>.</li>
        <li>Informe o <b>acréscimo</b> quando o árbitro indicar — é só visual, não interfere no relógio; no placar o +N aparece com uma animação de destaque. Para acertar o tempo, digite só números em <b>Ajustar tempo</b> (455 vira 4:55).</li>
        <li>Lance <b>Gol</b>, <b>Cartões</b> e <b>Substituições</b> pelos botões grandes. No gol dá para marcar <b>pênalti</b> ou <b>gol contra</b>. O placar mostra o aviso de <b>GOL</b> sobre o time que marcou, e a substituição mostra quem <b>entra</b> e quem <b>sai</b>.</li>
        <li>No intervalo e no fim, use os botões <b>Intervalo</b> / <b>Fim de jogo</b> (em Partida → Relógio) para trocar o relógio do placar por esse texto. Ao dar <b>Iniciar</b> ele volta sozinho.</li>
        <li>Em <b>Partida → No ar</b> você alterna o placar entre <b>Completo</b> (nome inteiro) e <b>Compacto</b> (só a sigla), liga os <b>reservas</b> de cada time e, no apito final, o <b>cartão de fim de jogo</b>.</li>
        <li>Quando o placar está em <b>Compacto</b>, o <b>gol</b> abre o placar <b>Completo</b> sozinho e ele continua completo (dá para desligar em Arte → Placar).</li>
        <li>Quer outra ordem na tela? Na Partida, <b>arraste os blocos</b> pelo ícone de pegada no título de cada um. <b>Restaurar ordem</b> volta ao padrão.</li>
        <li><b>Gol anulado</b> (VAR): botão no lançamento de eventos — tira o gol do placar, risca no histórico e avisa no ar.</li>
        <li><b>Substituições</b>: cada time tem 5. A cada troca aparece, junto do aviso, um mini-placar de 5 quadradinhos que vão enchendo (Arte → Placar → Contador de substituições).</li>
        <li><b>Outros jogos</b> (Partida): cadastre os jogos que acontecem ao mesmo tempo, aperte <b>+</b> no gol e use <b>Mostrar jogos no ar</b>. Com o aviso automático ligado, o gol aparece sozinho mesmo com a lista escondida. A classificação acompanha os placares.</li>
        <li><b>Arbitragem</b> (Partida): preencha árbitro, assistentes, 4º árbitro e os 3 do VAR e mostre cada grupo no ar. <b>Classificação</b> (menu): edite pontos, use <b>Mostrar no ar</b> e alterne <b>Compacta</b> / <b>Completa</b>. O jogo da transmissão fica em destaque forte e os jogos paralelos em destaque suave, cada um com a sua rodada.</li>
        <li><b>Resumo</b> (menu): baixe o relatório da partida em <b>TXT</b> ou use <b>Imprimir / salvar PDF</b>, com gols em ordem e as substituições separadas por intervalo.</li>
        <li>Errou algo? O botão <b>desfazer</b> (seta, no topo) volta a última mudança do painel inteiro — placar, eventos, escalação, tabela de classificação, outros jogos, arbitragem, estádio, opções do resumo e qualquer ajuste da aba Arte, inclusive os dos pênaltis (clique em <b>histórico</b> para ver a lista com a categoria de cada passo e voltar vários de uma vez; o botão <b>refazer</b> traz de volta; até 60 passos). Arrastar um controle deslizante conta como um passo só. O relógio e o que está no ar (mostrar/esconder placar, tabela, estádio…) nunca voltam atrás. Também dá para remover o evento no histórico.</li>
      </ol>
    </div></div></div>

    <div class="card guide-card"><div class="guide-step"><span class="step-num">6</span><div>
      <h2>Disputa de pênaltis</h2>
      <ol>
        <li>Abra a aba <b>Pênaltis</b> e escolha <b>quem bate primeiro</b>.</li>
        <li>Ligue <b>Mostrar no ar</b> para colocar o cartão no ar.</li>
        <li>A cada cobrança, (opcional) escolha o batedor e clique em <b>GOL</b> ou <b>PERDEU</b>. O quadrado fica verde ou vermelho no ar.</li>
        <li>O sistema alterna os times, passa para a <b>morte súbita</b> se empatar depois das 5 e encerra sozinho quando houver vencedor. Lançou errado? Clique no quadrado para corrigir ou use <b>Desfazer última</b>.</li>
      </ol>
    </div></div></div>

    <div class="card guide-card"><div class="guide-step"><span class="step-num">7</span><div>
      <h2>Controlar pelo celular</h2>
      <ol>
        <li>Abra o endereço do painel (<code>${panelUrl()}</code>) no celular que vai operar o placar. Dá para abrir em dois aparelhos: o último a mexer vale, e o outro acompanha.</li>
        <li>O painel se adapta à tela: menu embaixo, botões grandes e a partida em tempo real. A prévia fica oculta nas telas pequenas.</li>
        <li>O relógio é contado em cada aparelho a partir do horário do servidor do Firebase — se o painel fechar, o tempo continua certo nas artes. <b>Não feche o painel no meio do jogo mesmo assim</b>: é ele que aplica os gols, cartões e trocas.</li>
        <li>Se a internet do celular do painel cair, as alterações ficam na fila e sobem quando voltar.</li>
      </ol>
    </div></div></div>

    <div class="card guide-card"><div class="guide-step"><span class="step-num">8</span><div>
      <h2>Visuais salvos</h2>
      <p>Em <b>Arte → Visuais salvos</b> há 3 vagas para guardar a aparência inteira da arte (cores, tamanhos, estilo do placar, escalação…). Monte um visual, salve numa vaga e troque entre eles com um clique — por exemplo, um para jogos em casa e outro para transmissões especiais.</p>
      <button class="btn" data-go="arte">${App.ico("art")}Ir para Arte</button>
    </div></div></div>

    <div class="card guide-card"><div class="guide-step"><span class="step-num">!</span><div>
      <h2>Problemas comuns</h2>
      <dl class="faq">
        <dt>O painel fica em “Conectando ao Firebase…” ou mostra erro.</dt><dd>Confira a internet e as regras do banco (passo 2). Se disser “permissão negada”, as regras não foram publicadas.</dd>
        <dt>A arte fica em branco.</dt><dd>Abra o painel pelo menos uma vez (ele grava o primeiro estado no banco) e confira se o endereço da arte é o mesmo do painel, incluindo <code>?sala=</code> se usar.</dd>
        <dt>Os dados antigos não aparecem.</dt><dd>Em Banco de Dados, importe o <code>.zip</code>, a pasta <code>data</code> ou o backup .json da versão de computador.</dd>
        <dt>O escudo ou a fonte não aparece direito.</dt><dd>Use PNG com fundo transparente (o painel reduz imagens grandes para 512 px). As fontes de texto vêm do Google Fonts e precisam de internet.</dd>
        <dt>O que não existe nesta versão?</dt><dd>Sons (áudio), fotos do estádio e PDF automático — o PDF é feito pelo botão Imprimir / salvar PDF do navegador.</dd>
      </dl>
    </div></div></div>`;
  }
  App.registerPage("guia", { render });
})();
