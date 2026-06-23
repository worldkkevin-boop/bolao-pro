# 🧙 Bolão Pro — "O Mago" · Doc Central (leitura da IA)

> **O que é este arquivo:** a fonte única de verdade sobre o app, escrita pra uma IA (ou dev) entender tudo rápido sem ter que vasculhar o código. O Claude Code lê este arquivo **automaticamente** no início de cada sessão.

---

## ⚠️ PROTOCOLO DE ATUALIZAÇÃO (leia primeiro)

**Toda vez que algo for feito no app daqui pra frente, ATUALIZE este arquivo na mesma tarefa:**

1. Mudou código/comportamento? → ajuste a seção correspondente.
2. Criou tabela/coluna/função/Edge Function/agendamento? → registre na seção certa.
3. Terminou uma tarefa? → adicione uma linha no **Changelog** (com data).
4. Decidiu um "próximo passo" ou deixou algo pendente? → registre no **Backlog**.
5. Descobriu algo não óbvio pesquisando o código? → registre em **Pesquisas & aprendizados**.

Manter este doc atualizado é parte de "terminar" qualquer tarefa, não um extra.

---

## 1. Visão geral

App de **bolão de futebol** para grupos de amigos. Mobile-first, dark theme, marca **"O Mago"**. É um **PWA** (roda no navegador, sem instalar). Objetivo do momento: ganhar usuários durante a **Copa do Mundo 2026**.

- **Produção:** https://bolao-pro-six.vercel.app
- **GitHub:** `worldkkevin-boop/bolao-pro` (privado)
- **Instagram:** https://www.instagram.com/appbolaopro/
- **Estado:** em produção, com usuários reais. Mudanças afetam gente de verdade → ir incremental, perguntar antes de mexer em estrutura.

---

## 2. Stack & Infra

| Camada | Tecnologia |
|---|---|
| Frontend | HTML + **JavaScript vanilla** (sem framework). Tailwind via **CDN Play** (`cdn.tailwindcss.com` — todas as classes funcionam, nada é purgado) |
| Backend | **Supabase** (Postgres + Edge Functions Deno) |
| Pagamentos | **MercadoPago PIX** (Edge Functions) |
| Notificações | **Web Push** (VAPID, Edge Function `send-push`) |
| Hosting | **Vercel** (estático) |
| Dados de futebol | **API-Football** (api-sports.io v3) |

**Supabase:**
- Project ref: `hkiqozqqcymbhfobydoq` (nome `bolao-saas`, região us-east-1, Postgres 17)
- URL: `https://hkiqozqqcymbhfobydoq.supabase.co`
- Anon key + URL ficam em [js/config.js](js/config.js)
- CLI já está **logada** na máquina do Kevin (via `npx supabase ...`). O token fica no Credential Manager do Windows (não em arquivo).

---

## 3. Fluxo de Deploy (IMPORTANTE)

Cada parte sobe de um jeito diferente:

| O que mudou | Como vai pro ar |
|---|---|
| **Frontend** (html/js/css) | `git push origin main` → Vercel faz deploy automático. Kevin commita **direto no main**. |
| **Migração de banco** (`supabase-migration-*.sql`) | **Manual**: colar no **SQL Editor** do Supabase e rodar. Deploy de código NÃO roda migração. |
| **Edge Function** | `npx supabase functions deploy <nome> --project-ref hkiqozqqcymbhfobydoq` (use `--no-verify-jwt` se for chamada por cron/serviço) |
| **Secret de função** | `npx supabase secrets set NOME=valor --project-ref hkiqozqqcymbhfobydoq` |

### 🔑 Cache busting (NÃO ESQUECER)
Os scripts em [index.html](index.html) têm versão na query: `js/ui.js?v=34`. **Toda vez que editar um arquivo JS, bump o `?v=`** correspondente — senão o navegador dos usuários serve a versão antiga do cache. (Padrão histórico do projeto.)

Versões atuais (índice rápido — confira no index.html antes de bumpar): `config v=31`, `auth v=32`, `api v=31`, `groups v=33`, `ui v=38`, `gm v=32`, `aovivo v=37`, `evento v=42`, `copa v=5`. (gm/index.html: `admin v=44`)

> ℹ️ `telas/telao.html` é página avulsa com **JS inline** (sem `?v=`) — editou, basta `git push` (Vercel serve direto).

---

## 4. Estrutura de arquivos

```
index.html              App do jogador (SPA, várias "views" alternadas por switchView)
gm/index.html           Dashboard GM/Admin desktop (sidebar "Sistema Quantitativo") — usa ALPINE.JS. Tem o "Oráculo Quant"
gm/js/admin.js          Lógica do dashboard (Alpine x-data): tesouraria, membros, auditoria, Oráculo Quant, telão-evento — grande
gm/js/gm.js             Painel GM DENTRO do app (view-gm-panel, abas via switchGMTab) — vanilla JS
js/config.js            Supabase URL + anon key + VARIÁVEIS GLOBAIS de estado
js/auth.js              Login/cadastro + inscrição de push (push_subscriptions)
js/api.js               Integração API-Football (carregarJogos, buscarDadosAoVivo)
js/groups.js            Grupos: criar/entrar, membros, potes/premiação — grande
js/ui.js                UI principal: views, cards de jogo, pontuação, regras — MAIOR arquivo
js/aovivo.js            "Modo TV Ao Vivo" (view-ao-vivo): dashboard ao vivo
js/evento.js            Telão de evento (sorteio/captação de leads) — feature separada
js/copa.js              View "Copa" (view-copa): classificação dos grupos (/standings) + chaveamento do mata-mata (/fixtures). Etapa 1 = só visualização
sw.js                   Service Worker (PWA)
manifest.json           Manifesto PWA
telas/*.html            Páginas avulsas (carrossel, copa, telao) — marketing/projeção de evento
comunicacao/*.js        Scripts de teste de push (dev)
supabase/functions/     Edge Functions (ver seção 7)
supabase-migration-*.sql Migrações manuais
```

---

## 5. Frontend — como funciona

- **SPA por views:** `switchView(id)` em [js/ui.js](js/ui.js) mostra/esconde `<div>`s. Views: `view-inicio`, `view-grupo-home`, `view-jogos`, `view-palpite`, `view-ranking`, `view-painel`, `view-regras`, `view-gm-panel`, `view-ao-vivo`, `view-desafios`, `view-loja`.
- **Estado global** (em [js/config.js](js/config.js)): `sbClient` (cliente Supabase), `usuarioAtual`, `grupoAtual`, `todosOsJogos` (fixtures da API), `palpitesUsuario`, `distribuicaoPalpitesGrupo` (distribuição de palpites do grupo por jogo), `rodadaSelecionada`, `jogoAtual`.
- **Jogos** vêm da API-Football (não do banco). `todosOsJogos[i].fixture.date` = horário do jogo (kickoff, ISO/UTC). `fixture.id` = id da partida.
- **`matches` no banco** só recebe um jogo quando alguém **abre a tela de palpite** dele (upsert em ui.js). Ou seja, a tabela não é a agenda completa — é populada sob demanda. (A função `lembrete-jogos` contorna isso buscando na API.)

### Funções-chave (ui.js)
- `desenharCardsNaTela(jogos, palpites)` — renderiza os cards na aba Jogos.
- `calcularPontosPalpite(pH, pA, rH, rA, round, percentualVencedor)` — motor de pontuação (ver seção 9).
- `renderDistribuicaoZebra(homePct, empatePct, awayPct, total, regraOn)` — **helper compartilhado** (usado em ui.js e aovivo.js) que monta o rodapé "Casa X% · Emp Y% · Fora Z%" + selo "Zebra Ativa/Sem Zebra".
- `verificarExibicaoBotaoBonusJogador()` — mostra a barra de "Perguntas Bônus" se o grupo tiver perguntas ativas (`bonus_config`).

### Funções-chave (aovivo.js)
- `abrirTVAoVivo()` / `atualizarTVAoVivo()` — abre e atualiza (polling 60s) o Modo TV.
- `calcularZebrasTV()` — calcula distribuição + zebras por jogo a partir de `tvDados.palpites`.

---

## 6. Backend — Tabelas do Postgres

Tabelas referenciadas no código (colunas confirmadas; "?" = a confirmar no banco):

| Tabela | Para quê | Colunas conhecidas |
|---|---|---|
| `groups` | Grupos/bolões | id, name, invite_code, owner_id, league_id, max_participants, pt_placar_exato, pt_vencedor_saldo, pt_empate_nao_exato, pt_apenas_vencedor, **regra_zebra_dinamica**, mult_fase_final, desafios_ativados |
| `group_members` | Membros do grupo | group_id, user_id, role (`owner`/membro) |
| `profiles` | Perfil do usuário | id, full_name, avatar_url, max_grupos, fichas_desafio, is_gm |
| `matches` | Partidas (cache sob demanda) | id (=fixture id), league_id, season, home_team, home_team_id, home_logo, away_team, away_team_id, away_logo, kickoff, status, score_home, score_away, **lembrete_enviado_em** |
| `guesses` | Palpites | user_id, group_id, match_id, score_home, score_away |
| `desafios` | Desafios/Perguntas do GM | id, custo_fichas, vencedor, ... (?) |
| `user_desafios` | Participação em desafios | user_id, group_id, points_awarded |
| `bonus_config` | Perguntas bônus do grupo | group_id, q1_ativa..q5_ativa, (textos das perguntas ?) |
| `bonus_respostas` | Respostas dos jogadores às bônus | (?) |
| `potes` | Potes de premiação | id, group_id, divisão top3, ... (?) |
| `potes_participantes` | Quem entrou no pote (PIX) | (?) |
| `push_subscriptions` | Inscrições Web Push | user_id, endpoint, auth, p256dh |
| `transactions` | Tesouraria/PIX | (?) |
| `audit_logs` | Log de auditoria do GM | (?) |
| `evento_sorteio_telao` | Sorteio do telão (evento) | (?) |
| `leads_evento_telao` | Leads captados no telão | (?) |
| `evento_telao_publico` | **View** pública do telão (sem WhatsApp) | (leitura) |

> Quando for mexer numa tabela com colunas "?", confirme o schema real antes (REST `?select=...&limit=1` ou SQL Editor) e **atualize esta tabela aqui**.

---

## 7. Edge Functions (`supabase/functions/`)

| Função | O que faz | Disparo |
|---|---|---|
| `create-pix` | Gera cobrança PIX (MercadoPago) pra entrar em pote | App |
| `mercadopago-webhook` | Recebe confirmação de pagamento e libera o participante | MercadoPago |
| `send-push` | Envia Web Push (por userId, groupId ou global) via VAPID | App/serviço |
| `lembrete-jogos` | **(novo)** A cada 5 min, acha jogos começando em ≤20 min e manda push só pra quem **ainda não palpitou**. Marca `matches.lembrete_enviado_em` pra não repetir. Protegida por header `x-cron-secret` (env `CRON_SECRET`). | **pg_cron** (5 min) |

---

## 8. Agendamentos (pg_cron) & extensões

- Extensões: `pg_cron` + `pg_net` (habilitadas no projeto).
- Job **`lembrete-jogos`**: `*/5 * * * *` → chama a Edge Function via `net.http_post` com header `x-cron-secret`.
- Útil: `select * from cron.job;` · histórico: `select * from cron.job_run_details order by start_time desc limit 20;`
- Migração que cria isso: [supabase-migration-lembrete-jogos.sql](supabase-migration-lembrete-jogos.sql) (contém o valor do `CRON_SECRET`).

---

## 9. Regras de negócio importantes

### Trava de palpite
Palpite **fecha 10 minutos antes** do kickoff. Em vários pontos: `dezMinutosAntes = kickoff - 10min; isLocked = agora > dezMinutosAntes`.

### Motor de pontuação (`calcularPontosPalpite`) — cascata
Pega o **maior** que se aplica (valores padrão; o GM customiza por grupo):
1. **Placar exato** = 12 pts
2. **Empate não-exato** (acertou que foi empate) = 6 pts
3. **Vencedor + saldo de gols** = 7 pts
4. **Apenas o vencedor** = 3 pts

**Multiplicadores** (sobre os pts base):
- **Mata-mata** (`mult_fase_final`, padrão x2) em fases de `round` que contenham round/oitavas/quartas/semi/final.
- **Zebra Dinâmica** (x2) — ver abaixo.

### 🦓 Zebra Dinâmica
- Liga/desliga por grupo: `groups.regra_zebra_dinamica`.
- Definição: o **resultado vencedor** recebeu **menos de 15%** dos palpites do grupo naquele jogo → dobra os pontos de quem acertou.
- A % é sobre **quem palpitou naquele jogo** (não sobre o total de membros). Ex.: 17 palpitando → time com ≤2 palpites (≤11,8%) é zebra; com 3 (17,6%) não é.
- **`distribuicaoPalpitesGrupo[matchId] = { home, away, empate, total }`** (porcentagens 0–100) é calculado em [js/api.js](js/api.js) no load do grupo.
- **Marcação visual:** selo 🦓 no time zebra + rodapé "Casa/Emp/Fora %" + selo "Zebra Ativa / Sem Zebra" (considera Casa/Empate/Fora <15%, igual à pontuação), nos cards de Jogos e no Ao Vivo; e 🦓 nos players que foram na zebra, incluindo quem cravou empate em zebra (Ao Vivo).

---

## 10. APIs externas

### API-Football (api-sports.io v3)
- Host: `v3.football.api-sports.io` · Key (no frontend, [js/api.js](js/api.js)): `47ca2bb05eb5931347aca04964818eb5`
- **Plano: Pro** — 7.500 requisições/dia. Inclui **odds**.
- Endpoints usados: `/fixtures?league=&season=2026`, `/fixtures?live=all`, `/fixtures?...&next=N`, `/predictions?fixture=` e `/odds?fixture=` (estes 2 na Estratégia do Mago, no GM). Odds 1X2 = "Match Winner".
- `league_id` vem de `groups.league_id` (Copa = 1). Season fixa **2026** no código.

### MercadoPago
- PIX via `create-pix` + `mercadopago-webhook`. (Credenciais em env das funções.)

### Web Push (VAPID)
- Chaves VAPID hardcoded em `send-push` e `lembrete-jogos` (públicas no repo privado). `mailto:suporte@bolaopro.com.br`.

---

## 11. Changelog

> Formato: `AAAA-MM-DD — o que mudou (arquivos)`

- **2026-06-22** — **Copa: bracket VISUAL do mata-mata (modo Chave) com navegação por lado** (js/copa.js + index.html CSS). Aba Chaveamento agora tem 3 modos: **🗂 Chave** (bracket visual conectado, padrão), **📋 Lista** (a lista por round que já existia) e **✅ Reais** (quando a API tiver). O bracket usa a árvore oficial de progressão (`COPA_FEED`: 89=V74/V77, …, 104=V101/V102, 103=perdedores das semis). Layout recursivo (`_copaTree`/`_copaRenderNode`) com conectores em L via CSS (`.bkt-*`): cada nó centraliza o "self" entre os 2 filhos (flex:1 nas células → centros em 25%/75%, conector `.bkt-conn::before/after`). Mobile: mostra **um lado por vez** (Esquerda → Final → Direita) com setas ‹ › + bolinhas (`_copaLado`, `setCopaLado`); o lado abre com scroll horizontal. R32 já vem com os times projetados (1º/2º atuais) e o bolsão de 3º destacado; rounds seguintes mostram "Venc. #N". Bump copa v=5. ⚠️ Conectores podem precisar de ajuste fino visual — validar com screenshot no cel.
- **2026-06-22** — **Copa: data/horário (Brasília) no chaveamento** (js/copa.js). Cada jogo das 16-avos no modo Projeção agora mostra a data e hora oficiais em **horário de Brasília** (`COPA_R32_TEMPLATE` ganhou `kickoff` em UTC = ET+4h, pois jun/jul o leste dos EUA é UTC-4; helper `_copaDataBR` formata com `timeZone: 'America/Sao_Paulo'` — independe do fuso do aparelho). Modo "Confrontos reais" (`_copaCardConfronto`) também passou a fixar Brasília. Calendário oficial das 16-avos (28/06 a 03/07). Bump copa v=4.
- **2026-06-22** — **Ao Vivo: posição do time recalculada AO VIVO + movimento dos players no ranking** (js/aovivo.js + index.html CSS). (A) `_tvCalcPosLive(jogosAtivos)` recalcula a posição no grupo somando o placar do jogo que está rolando (win+3/draw+1, ajusta saldo e gols pró, reordena o grupo); o selo agora mostra "Grupo A · 2º ▲1/▼1" (`tvStandings.grupos`/`liveMapa`; `_tvPosChip` usa o liveMapa). (B) No ranking provisório dos jogadores, calcula `rankFixoMap` (posição só com pontos fixos) vs posição provisória → mostra ▲/▼ com a qtd de posições e pinta a borda: `tv-rank-up`/`tv-rank-down` (glow verde/vermelho) e `tv-rank-up-strong`/`tv-rank-down-strong` (pulsa forte quando sobe/cai **≥3**). Badge `.tv-mov-wrap` ao lado da posição, atualizado no diffing seletivo do DOM. CSS+keyframes no index.html (servido direto). Bump aovivo v=37.
- **2026-06-22** — **Ao Vivo (Modo TV): posição no grupo no card do jogo** (js/aovivo.js). No card de "Partidas em Andamento", agora aparece embaixo do nome de cada seleção a posição na classificação (ex.: "Grupo A · 2º"). `_tvCarregarStandings(leagueId)` busca `/standings?league=X&season=2026` e monta `tvStandings.mapa[teamId] = {rank, grupo}` (cache 5 min, chamado dentro de `atualizarTVAoVivo`); `_tvPosChip(teamId)` renderiza o selo. ⚠️ Mostra a posição **oficial atual** (jogos encerrados) — não recalcula a posição com o placar do jogo que está rolando (a API só atualiza standings após o jogo acabar). Bump aovivo v=36.
- **2026-06-22** — **Copa Passo 2 — Melhores 3º lugares (real) + bolsão destacado** (js/copa.js). **Descoberta importante (testado por script):** a alocação exata de qual 3º vai pra qual jogo NÃO é reproduzível por algoritmo — as 495 combinações de 8-de-12 grupos têm **todas múltiplas soluções** válidas nos bolsões (0 únicas), então só a tabela oficial Annex C da FIFA (não acessível pra copiar de forma confiável) define. Cravar o adversário seria chute → não foi feito. Em vez disso: `_copaMelhores3` ranqueia os 12 terceiros pelos critérios FIFA (pts, saldo, gols pró) e marca os 8 que classificam; nova tabela "Melhores 3º lugares" na aba Projeção; e nos jogos contra 3º o bolsão agora destaca em verde os grupos que estão classificando o 3º (`_copaThirdSlotHTML`), riscando os que estão fora. Quando a fase de grupos acabar, o sorteio real vem pela API (modo Confrontos reais). Bump copa v=3.
- **2026-06-22** — **Copa Etapa 1.5 — Chaveamento PARCIAL (projeção)** (js/copa.js + index.html). Aba Chaveamento ganhou modo **Projeção**: monta os 16 jogos do Round of 32 (16-avos) a partir da classificação atual, seguindo o **template oficial do bracket 2026** (`COPA_R32_TEMPLATE`, cruzamentos por posição — ex.: 1ºA × 3º[C/E/F/H/I], 2ºA × 2ºB). Os 8 jogos sem 3º lugar saem exatos (1º/2º de cada grupo via standings); os 8 com "melhor 3º" mostram o bolsão de grupos possíveis (`3º [C/E/F/H/I]`) — a alocação exata dos 3ºs (tabela Annex C, 495 combinações) fica pra Etapa 2. `_copaResolverSlot` resolve cada slot do mapa de grupos (`_copaMapaGrupos`). Quando a API tiver os confrontos reais, aparece um toggle **Projeção / Confrontos reais** (`setCopaBracketModo`); `renderCopaBracket()` agora lê do `_copaCache`. Dedução validada: 1ºD e 1ºE nos jogos 74/81 pela regra "1º não pega 3º do próprio grupo". Bump copa v=2.
- **2026-06-22** — **Nova view "Copa" — Etapa 1 (classificação + chaveamento, só visualização)** (novo `js/copa.js` + index.html + js/ui.js). Nova `view-copa` no app do jogador, acessível por banner 🏆 na home do grupo. Duas abas: **Grupos** (classificação dos 12 grupos via `/standings?league=<grupo.league_id>&season=2026` — rank, seleção c/ bandeira, J, SG, P; top 2 destacados em verde) e **Chaveamento** (mata-mata via `/fixtures`, filtra rounds que não são "Group Stage"; `COPA_ROUNDS` mapeia Round of 32→16-avos, Round of 16→Oitavas, etc.). Cache de 5 min por liga (`_copaCache`). **Importante (pesquisado na API):** a Copa 2026 só tem "Group Stage - 1/2/3" disponível — os jogos do mata-mata AINDA não existem na API, então o chaveamento mostra um scaffold "A definir" + aviso, e preenche sozinho quando a API liberar os confrontos. `switchCopaTab` alterna as abas. Registrada em `switchView` (array + branch chama `carregarViewCopa()`). Bump ui v=38, copa v=1 (novo). **Etapa 2 = palpite no chaveamento** (ver Backlog).
- **2026-06-22** — **RLS: GM pode gerenciar palpite de qualquer jogador** (`supabase-migration-gm-guesses-rls.sql` — **rodar manual no SQL Editor**). A tabela `guesses` só tinha policy de "cada um mexe no próprio palpite" (`user_id = auth.uid()`), então o GM editando/criando palpite de outro membro batia em `new row violates row-level security policy for table "guesses"`. Adicionada policy `FOR ALL` permissiva liberando tudo só pra `profiles.is_gm = true` (políticas RLS somam/OR, jogador normal não muda). Mesmo padrão "God Mode" de `audit_logs`/`transactions`. Conserta tanto o painel "Placar da Galera por Jogo" quanto o editor "✏️ Palpite" por membro. Sem bump (migração, não código).
- **2026-06-22** — **Placar da Galera por Jogo no dashboard GM** (gm/index.html + gm/js/admin.js). Novo painel dentro de "Controle da Matriz" → grupo (abaixo de "Habitantes da Matriz"). Carrega sob demanda (botão) os jogos **rolando + futuros** da liga do grupo (API-Football, season 2026, janela -2d a +30d, exclui status encerrados FT/AET/PEN/PST/CANC/ABD/AWD/WO). Cada jogo é expansível e mostra a tabela de **todos os membros** com o placar de cada um; quem **não palpitou** fica destacado (linha âmbar + selo "sem palpite") e o cabeçalho mostra "N sem palpite / todos palpitaram" e selo "● Ao vivo" + placar ao vivo. O GM edita inline (inputs home/away) e salva por linha: botão "Salvar" (já tinha) ou "Criar" (quem não tinha). Antes do upsert em `guesses` (`onConflict: user_id,group_id,match_id`), faz upsert do jogo em `matches` (FK) com os dados do fixture. Loga em `audit_logs` (`EDIT_GUESS`/`CREATE_GUESS`, target_id null pois não temos o uuid da linha). Estado `placarJogos` (resetado em `carregarMembrosGrupo`); funções `carregarPlacarJogos`/`togglePlacarJogo`/`salvarPalpiteGM`. Diferente do "✏️ Palpite" por membro (que é por jogador): este é **por jogo**, mostra a galera toda lado a lado e cria palpite pra quem faltou. Sem trava de horário (GM edita até em jogo ao vivo). Bump admin v=44.
- **2026-06-19** — **Fix: dashboard GM não rolava até o fim** (gm/index.html). App-shell: `<body>` com altura fixa + `overflow-hidden`, scroll no container interno (`flex-1 overflow-y-auto`). A altura vinha da classe Tailwind `h-screen` (100vh) — que no celular esconde o fim do conteúdo atrás da barra do navegador. A altura saiu da classe e foi pro CSS do `body` com fallback: `height:100vh; height:100dvh;` — `100vh` garante altura definida em qualquer navegador (scroll do desktop nunca quebra) e `100dvh` (quando suportado) respeita a barra no mobile. Tirar a classe de altura evita depender do CDN gerar `h-[100dvh]`. Sem bump (HTML servido direto).
- **2026-06-19** — **Telão evento: "modo sorteio" com o jogo rolando** (`telas/telao.html` + `gm/js/admin.js` + `gm/index.html`). Antes, quando o GM travava os palpites (jogo começou), o link virava um beco sem saída — quem abria via "Palpites encerrados" e ia pro bolão, **sem entrar no sorteio**. Agora, com a trava ligada, o **mesmo link** entra em modo sorteio: o convite continua, pula a etapa de palpite e o fluxo vira **nome → WhatsApp → número da sorte** (`aplicarModoSorteio()`; palpite salvo como `null`, então não polui a distribuição). A re-checagem de trava no envio não barra mais — se travou na hora, migra pro modo sorteio. Textos do GM (toast + legenda do botão) alinhados: "palpites fechados, quem abrir o link concorre só no sorteio". Bump admin v=43. (telao.html é JS inline, sem `?v=`.)
- **2026-06-18** — **Painel do GM responsivo pro celular** (gm/index.html + gm/js/admin.js). A sidebar (`w-64`, sempre visível) tomava boa parte da tela num celular e o header com `px-8` não cabia — ficava "bugado" pra dar uma olhada rápida no painel. Agora a sidebar virou um **drawer deslizante** no mobile: some por padrão (`-translate-x-full`), abre com o botão ☰ no header (novo estado `sidebarMobileAberta`), tem um backdrop escuro pra fechar tocando fora, fecha sozinha ao clicar numa aba, e ganhou um botão ✕ pra fechar. No desktop (`md:`) continua fixa do lado, como sempre foi. Header e conteúdo ganharam padding menor no mobile (`px-3`/`p-4` vs `px-8`/`p-8`) e o título trunca em vez de quebrar o layout. Duas tabelas que cortavam conteúdo (`overflow-hidden`) passaram a rolar horizontalmente (`overflow-x-auto`) — Habitantes da Matriz e Fila de Liberação PIX. Bump admin v=42.
- **2026-06-18** — **Fix: selo "Zebra Ativa" não considerava o empate** (`renderDistribuicaoZebra` em js/ui.js, `calcularZebrasTV` + tag de jogador em js/aovivo.js). A pontuação já dobrava pontos quando o empate tinha <15% dos palpites, mas o selo visual só olhava Casa/Fora — então um jogo podia estar "Zebra Ativa" pra pontuação e mostrar "Sem Zebra" na tela. Agora `renderDistribuicaoZebra` também entra em "Zebra Ativa" se `empatePct < 15` e mostra 🦓 ao lado de "Emp. X%" no rodapé do card (Jogos e Ao Vivo). No Ao Vivo, `calcularZebrasTV` retorna `empateZebra` e o selo 🦓 nos jogadores que cravaram empate em zebra agora aparece (antes só pegava quem foi no time vencedor zebra). Bump ui v=37, aovivo v=35. Resolve o item do Backlog sobre alinhar zebra de empate.
- **2026-06-18** — **Fix: exclusão nuclear de grupo rejeitava código digitado certo** (`deletarGrupoNuclear` em gm/js/admin.js). A comparação do código de confirmação era estritamente case/whitespace-sensitive (`===`), então autocapitalize do teclado mobile ou um espaço a mais no `prompt()` fazia o GM digitar a frase certa e ainda ver "Código nuclear incorreto". Agora compara com `.trim().toUpperCase()`. Bump admin v=41.
- **2026-06-18** — **Editor rápido de palpite no GM** (gm/index.html + gm/js/admin.js). Na aba "Controle da Matriz" → grupo → "Habitantes da Matriz", novo botão "✏️ Palpite" por membro abre modal listando os jogos que ele já palpitou (com nomes dos times via tabela `matches`) e permite editar `score_home`/`score_away` direto (upsert em `guesses`, `onConflict: 'user_id,group_id,match_id'`). Loga em `audit_logs` (`EDIT_GUESS`). Estado `editorPalpite` + funções `abrirEditorPalpite`/`salvarPalpiteEditado`/`fecharEditorPalpite`. Bump admin v=40.
- **2026-06-16** — **Análise Quant do Oráculo — dados reais da API** (gm/index.html + gm/js/admin.js). A aba "Análise Quant" era um mockup hardcoded. Agora exibe dados reais do `/predictions` já chamado: (1) Forma recente (badges W/D/L + gols/jogo); (2) Comparação de atributos (barras duplas de att/def/form/h2h/goals/total); (3) Under/Over + temporada 2026; (4) H2H cara a cara. Zero requests extras. `analisarDistorcaoPalpites` agora retorna `comparison`, `h2h`, `homeLast5/awayLast5`, `homeFixtures/awayFixtures`, `under_over`, `win_or_draw`. Estado `oraculo.quantData` adicionado. Bump admin v=33.
- **2026-06-14** — **Fix: Ao Vivo (Modo TV) não contava a zebra** (`atualizarTVAoVivo` em aovivo.js). As 3 chamadas de `calcularPontosPalpite` eram sem `round`/`pctVencedor`, então o "Fixo", o parcial ao vivo e o selo de pontos por palpite ignoravam zebra dinâmica + mata-mata (Ray Mundo aparecia Fixo 27 em vez de 39). Agora passam a % do resultado vencedor via `zebrasTV[matchId]` (usa `homePct/empatePct/awayPct`) + `jogo.league.round`. Também corrigido bug legado `pts === 30` (placar exato é 12/configurável, nunca 30) → exato agora comparado pelos placares e o selo mostra "+N PTS (Exato)" com o valor real. Bump aovivo v=33.
- **2026-06-14** — **Fix: painel de detalhes do jogador não contava a zebra** (`abrirHistoricoUsuario` em ui.js). O resumo de pontos usava `detalharPontosPalpite` (cascata base) e somava `pts × qtd`, ignorando zebra dinâmica e mata-mata — então um placar exato em zebra aparecia como 12 em vez de 24 e o total não batia com o Ranking Oficial. Agora cada acerto soma os **pontos reais** via `calcularPontosPalpite(..., round, pctVencedor)` (mesmo motor do ranking, usando `distribuicaoPalpitesGrupo`), acumulando `totalPts`/`zebra` por categoria. A linha mostra "🦓 N zebras (x2)" e fica roxa quando houve dobra. Bump ui v=36.

- **2026-06-12** — Oráculo: **modo da estratégia** (🛡️ Cobrir cenários = 2ª conta em outro resultado / 🎯 Caçar placar = 2ª conta no 2º melhor EV do mesmo favorito; `oraculo.modoEstrategia` + `recalcEstrategia()`) e **Radar de Zebra do grupo** (`_zebraRadarGrupo`, `oraculo.zebraRadar`): mostra quem cravou cada resultado no grupo focado, status zebra (<15%), e cenários "+1/+2 contas" (mantém <15% verde / estoura ≥15% vermelho) pra PEGAR ou IMPEDIR a zebra. Bump admin v=29.
- **2026-06-12** — Oráculo: **Foco no grupo** (`grupoFoco` + `focarGrupo()`). Campo de código carrega as regras de pontos do grupo (groups table) e o EV passa a usar elas + os palpites SÓ daquele grupo (`_distribuicaoLocalGM(fId, groupId)`), zebra conforme a regra do grupo, e toggle **Mata-mata 2x** (`oraculo.mataMata`). Sem foco, mantém escala padrão + média de todos. Bump admin v=28. Grupo do Kevin: **Ladaya** código `0VR5A4D` (regras 12/7/6/3, zebra on, mata-mata 2x). Próximo: modo por ranking (Segurar/Atacar).
- **2026-06-12** — Oráculo: **EV (pontos esperados)** + **gols esperados**. `_calcEVPlacares` calcula o EV de cada placar (prob × pontos pela escala 12/7/6/3, com zebra 2x aprox. quando a galera <15%); a recomendação passa a escolher por EV. `_calcGolsEsperados` lê o mercado Over/Under (mesmo request de odds) e mostra gols esperados + total mais provável. Tabela mostra `odd` + `pt` (EV) por placar. `_fetchPlacaresProvaveis` virou `_fetchOddsOraculo` (retorna {placares, gols}). Bump admin v=27. ⚠️ EV usa escala padrão e crowd cross-group — versão precisa vem com "focar no grupo".
- **2026-06-12** — Oráculo: card agora mostra a **tabela de odds de placar exato** (Casa/Empate/Fora, estilo Correct Score do bookmaker), com os 2 placares escolhidos destacados (`_agruparPlacares`, estado `oraculo.tabelaPlacares`). Bump admin v=26.
- **2026-06-12** — Estratégia agora usa o mercado **Exact Score** das odds (`_fetchPlacaresProvaveis` em admin.js): ranqueia os placares mais prováveis do mercado e distribui entre as 2 contas (conta1 = #1; conta2 = mais provável de resultado diferente). Card mostra os top placares com %. Fallback heurístico quando não há odds. Bump admin v=25.
- **2026-06-12** — **Estratégia de Placar (2 contas)** adicionada ao **Oráculo Quant** do dashboard (`gm/index.html` + `gm/js/admin.js`, método `_calcEstrategiaPlacar`, estado `oraculo.estrategia`). Sugere placar pra 🎩 Você + 💜 Gaby usando probabilidades + gols esperados que o Oráculo já busca. **Este é o lugar certo** (o GM que o Kevin usa é o dashboard). Bump admin v=24.
- **2026-06-12** — **Estratégia do Mago**: nova aba no painel GM **de dentro do app** (`gm-section-estrategia`, gm.js). ⚠️ Lugar pouco usado — o Kevin usa o dashboard. Mantido pra acesso mobile, mas a versão canônica é a do Oráculo (acima). Pra cada jogo, busca `predictions`+`odds` da API e sugere placares pras 2 contas (🎩 Você + 💜 Gaby) com probabilidades, leitura e nota de zebra. Funções em [gm/js/gm.js](gm/js/gm.js): `carregarGMEstrategia`, `analisarJogoEstrategia`, `gerarEstrategiaPlacar`, `extrairOdds1x2Media`, `renderEstrategiaHTML` (gm v=32).
- **2026-06-12** — Doc central `CLAUDE.md` criado (este arquivo).
- **2026-06-12** — Botão "Perguntas Bônus" minimizado pra barra fininha de 1 linha (ui.js v=34).
- **2026-06-12** — Zebra: rodapé "Casa/Emp/Fora %" + selo "Zebra Ativa/Sem Zebra" nos cards de Jogos e no Ao Vivo; 🦓 nos players que foram na zebra; helper `renderDistribuicaoZebra` (ui.js v=33, aovivo.js v=32).
- **2026-06-11/12** — Zebra: selo 🦓 no time com <15% dos palpites, exibido quando o palpite fecha (ui.js v=32).
- **2026-06-11/12** — **Lembrete de jogos**: Edge Function `lembrete-jogos` + `pg_cron` (5 min) + coluna `matches.lembrete_enviado_em` + `CRON_SECRET`. Manda push 20 min antes só pra quem não palpitou. (No ar.)

---

## 12. Backlog / próximos passos

- [x] **Copa Etapa 1.5 — Chaveamento PARCIAL / projeção (Passo 1 + Passo 2 FEITOS)**. Passo 1: projeção dos 16 jogos do Round of 32 via `COPA_R32_TEMPLATE`. Passo 2: ranking real dos melhores 3º lugares + bolsão destacado. **Cravar o adversário exato do 3º é INVIÁVEL por algoritmo** (495 combinações, todas ambíguas — só a Annex C da FIFA resolve, e ela não está acessível pra hardcode). Resolução exata vem sozinha pela API (modo Confrontos reais) quando a fase de grupos acabar. Projetar Oitavas→Final é predição (vira Etapa 2/palpite).
- [ ] **Copa Etapa 2 — Palpite no chaveamento**. Jogador escolhe quem avança em cada chave do mata-mata. Precisa: tabela nova no banco (palpites de bracket), regras de pontuação (acertar quem avança / placar / campeão), e a UI de palpite no `view-copa`. Depende dos confrontos do mata-mata existirem na API (hoje só tem fase de grupos). `js/copa.js` já é a base (render + cache).
- [ ] **Odds 1X2 nos jogos** (PESQUISADO, pronto pra fazer). Plano recomendado: guardar odds na tabela `matches` (colunas `odd_home/odd_draw/odd_away/odds_updated_at`) via agendamento `pg_cron` (1x/hora) e **média das casas**; exibir do lado da distribuição de palpites. Plano alternativo: buscar na hora que abre o jogo. API já confirmada (ex.: USA x Paraguai → 1.91 / 3.30 / 4.20, 14 casas).
- [ ] **Modo estratégico por posição no ranking** (Oráculo): olhar o ranking do grupo do Kevin (gap pro líder, jogos restantes) e ajustar a sugestão pra "Segurar" (na frente, jogar com a manada) ou "Atacar" (atrás, ir na zebra/diferencial). Precisa focar num grupo específico (hoje o Oráculo olha geral). Refinos extras pesquisados: forma recente + H2H (já vêm no predictions), Over/Under e Ambas Marcam pra calibrar nº de gols, lesões/escalações (~1h antes).
- [ ] **Barra de Perguntas Bônus**: sumir sozinha quando não dá mais pra responder (depende de definir como o app sabe que "fechou").
- [ ] **% de palpites antes da trava?**: hoje as %/selo só aparecem depois do palpite travar (pra não influenciar). Decidir se mostra o tempo todo.

---

## 13. Pesquisas & aprendizados (contexto pra IA)

Coisas não óbvias descobertas vasculhando o código (pra não redescobrir toda vez):

- **Ao Vivo == Modo TV**: são a **mesma tela** (`view-ao-vivo`, arquivo `aovivo.js`, cabeçalho "MODO TV AO VIVO"). Não existe um "Modo TV" separado do "Ao Vivo" dentro do app. As páginas `telas/telao.html` etc. são **telão de evento** (sorteio/leads), feature à parte — não têm a ver com jogos do bolão.
- **Odds**: o plano Pro libera `/odds`; cobertura existe pra Copa 2026; cada jogo traz ~14 casas e dezenas de mercados. O que encaixa no app é **Match Winner (1X2) = Casa/Empate/Fora**.
- **`matches` é cache sob demanda**, não agenda. Por isso a função de lembrete busca os jogos direto na API-Football antes de avisar.
- **Pontuação considera empate como possível zebra** (`vencedorReal` pode ser `'empate'` e entra no `<15%`), mas a UI ainda não reflete isso.
- **Supabase CLI já logada** na máquina (via Credential Manager) — dá pra `functions deploy` e `secrets set` direto. Mas **rodar SQL** (migração/cron) precisa do SQL Editor (não há senha do banco salva acessível).
- **Distribuição de palpites** é pré-calculada uma vez no load do grupo (`distribuicaoPalpitesGrupo` em api.js); no Ao Vivo é recalculada de `tvDados.palpites`.
