# Placar App 1.0

Placar, relógio, escalação, eventos, linha do tempo, pênaltis, classificação e fim de jogo para transmissões — **sem servidor**.
É o mesmo painel e as mesmas artes do app de escalação (v6.2), só que em páginas estáticas que rodam no **GitHub Pages**
e conversam em tempo real pelo **Firebase Realtime Database**. Visual, botões e animações são os mesmos.

**Versão atual: 1.0.0** (baseada no código da escalação v6.2)

## Como funciona

```
 celular do painel                       Firebase                        artes (overlays)
 index.html  ──grava estado──▶  Realtime Database  ──escuta──▶  arte/placar/, arte/…
 (motor do placar roda aqui)     placar/stateJson                (cada uma é uma página)
```

- O **painel** (`index.html`) carrega o motor (`js/engine.js`): é a mesma lógica que rodava no servidor Node (placar, relógio, eventos, desfazer, pênaltis…). Cada alteração é gravada no Firebase.
- As **artes** só leem o Firebase e se atualizam sozinhas. O relógio corre localmente em cada arte, a partir de *rodando/pausado + segundos + horário de início* (hora do servidor do Firebase), então não fica travado nem depende do painel mandar um “tique” por segundo.
- Nada de `npm start`, porta 3000 ou Wi-Fi em comum. Só internet.

## Publicar (uma vez)

1. **GitHub**: crie um repositório e envie *todo o conteúdo desta pasta* (Add file → Upload files).
2. **Settings → Pages → Deploy from a branch** → branch `main`, pasta `/ (root)` → Save. Em 1–2 min o endereço aparece (`https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`). Esse é o **painel**.
3. **Firebase Console → Realtime Database → Regras**, cole e publique:
   ```json
   {
     "rules": {
       "placar": { ".read": true, ".write": true },
       "$other": { ".read": false, ".write": false }
     }
   }
   ```
   Isso deixa o caminho `placar` aberto para quem souber o endereço do banco (o painel não tem login). Use durante os jogos e depois mude para `false`. Para salas extras (veja abaixo) libere também `"placar_NOME"`.
4. Abra o painel. No **Dashboard** deve aparecer “Conectado ao Firebase”. A configuração do Firebase está em `js/firebase-config.js`.

## Endereços das artes

Relativos ao painel (veja também Dashboard → artes):

| Arte | Endereço |
|---|---|
| Escalação | `…/arte/` |
| Placar e relógio | `…/arte/placar/` |
| Eventos animados | `…/arte/eventos/` |
| Linha do tempo | `…/arte/linha-do-tempo/` |
| Pênaltis | `…/arte/penaltis/` |
| Fim de jogo | `…/arte/fim-de-jogo/` |
| Classificação | `…/arte/classificacao/` |
| Informativos | `…/arte/informativos/` |

No aplicativo de transmissão, adicione cada uma como **página da web / navegador** com fundo transparente, 1920×1080.
**Atenção:** só funciona em programas que aceitam uma página da web como sobreposição (como o OBS). Confirme se o aplicativo que você usa no celular tem essa opção — o Placar App não consegue desenhar sobre a imagem sozinho.

### Mais de um jogo ao mesmo tempo (salas)
Abra o painel e as artes com `?sala=quadra2` no final (ex.: `…/arte/placar/?sala=quadra2`). Cada sala é um placar separado (`placar_quadra2` no banco). Sem `?sala`, usa `placar`.

## Trazer os dados da versão de computador
**Banco de Dados** → arraste o `.zip` do app antigo, a pasta `data` ou o backup `.json` (Banco de Dados → Baixar banco de dados, na versão antiga). Escolha o que importar (times, partida, aparência, classificação…) e confirme. Escudos muito grandes são reduzidos a 512 px.

## O que mudou em relação à versão de computador
- **Funciona igual:** placar, relógio, escalação, reservas, eventos, linha do tempo, pênaltis, fim de jogo, classificação, outros jogos, arbitragem/VAR, estádio (texto), módulos visíveis, desfazer/refazer, visuais salvos, resumo em TXT.
- **Não existe nesta versão:** sons/áudio, **fotos do estádio** (precisam de armazenamento de arquivos) e **PDF automático** — use *Resumo → Imprimir / salvar PDF* (o navegador gera o PDF).
- **Dados:** vivem no Firebase (não em arquivos). Os backups automáticos em pasta não existem; use *Baixar banco de dados* antes de jogos importantes. O painel também guarda uma cópia no aparelho para abrir sem internet.
- **Dois painéis abertos:** o último a alterar vale; o outro acompanha.

## Limitações honestas
- Não feche o painel no meio do jogo: é ele que aplica gols, cartões e trocas (o relógio, porém, continua certo nas artes).
- Gravação sem login: as regras acima deixam o placar editável por quem tiver o endereço do banco.
- Testado com o Firebase **simulado** e navegador automatizado (Chromium); não foi testado contra o seu banco real nem em aparelho real.
- Fontes de texto vêm do Google Fonts (precisam de internet).

## Para quem for mexer no código
- `engine-src/` guarda o motor (cópia do `server/` da v6.2 + `entry.js` + adaptadores). `js/engine.js` é **gerado** — depois de mexer em `engine-src/`: `npm install` e `npm run build`.
- Testes: `python3 -m http.server 8099` na pasta *acima* desta e `node test/e2e.js` e `node test/e2e2.js` (precisam do Playwright; usam `test/mock-firebase.js`).

## Histórico
**Placar App 1.0.0** — primeira versão: sem servidor (GitHub Pages + Firebase Realtime Database); relógio local sincronizado por horário do servidor; importação de zip/pasta/backup; salas (`?sala=`); resumo em TXT e impressão/PDF. Sem áudio e sem fotos do estádio. Próximas versões do app de escalação (7.0: foto do jogador) continuam separadas.
