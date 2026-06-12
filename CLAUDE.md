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

Versões atuais (índice rápido — confira no index.html antes de bumpar): `config v=31`, `auth v=32`, `api v=31`, `groups v=33`, `ui v=34`, `gm v=32`, `aovivo v=32`, `evento v=42`.

---

## 4. Estrutura de arquivos

```
index.html              App do jogador (SPA, várias "views" alternadas por switchView)
gm/index.html           Painel do GM/Admin (Game Master)
gm/js/admin.js          Lógica admin (tesouraria, membros, desafios, telão-evento) — grande
gm/js/gm.js             Lógica do GM (desafios, resolução)
js/config.js            Supabase URL + anon key + VARIÁVEIS GLOBAIS de estado
js/auth.js              Login/cadastro + inscrição de push (push_subscriptions)
js/api.js               Integração API-Football (carregarJogos, buscarDadosAoVivo)
js/groups.js            Grupos: criar/entrar, membros, potes/premiação — grande
js/ui.js                UI principal: views, cards de jogo, pontuação, regras — MAIOR arquivo
js/aovivo.js            "Modo TV Ao Vivo" (view-ao-vivo): dashboard ao vivo
js/evento.js            Telão de evento (sorteio/captação de leads) — feature separada
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
- **Marcação visual (feita nesta sessão):** selo 🦓 no time zebra + rodapé "Casa/Emp/Fora %" + selo "Zebra Ativa / Sem Zebra", nos cards de Jogos e no Ao Vivo; e 🦓 nos players que foram na zebra (Ao Vivo).
- ⚠️ **Inconsistência conhecida:** na *pontuação*, o **empate** também pode ser zebra (se <15% cravaram empate e o jogo empatou → 2x). Mas a *marcação visual* hoje só sinaliza zebra de **time** (Casa/Fora), não de empate. (Ver Backlog.)

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

- **2026-06-12** — **Estratégia do Mago**: nova aba no painel GM (`gm-section-estrategia`). Pra cada jogo, busca `predictions`+`odds` da API e sugere placares pras 2 contas (🎩 Você + 💜 Gaby) com probabilidades, leitura e nota de zebra. Funções em [gm/js/gm.js](gm/js/gm.js): `carregarGMEstrategia`, `analisarJogoEstrategia`, `gerarEstrategiaPlacar`, `extrairOdds1x2Media`, `renderEstrategiaHTML` (gm v=32).
- **2026-06-12** — Doc central `CLAUDE.md` criado (este arquivo).
- **2026-06-12** — Botão "Perguntas Bônus" minimizado pra barra fininha de 1 linha (ui.js v=34).
- **2026-06-12** — Zebra: rodapé "Casa/Emp/Fora %" + selo "Zebra Ativa/Sem Zebra" nos cards de Jogos e no Ao Vivo; 🦓 nos players que foram na zebra; helper `renderDistribuicaoZebra` (ui.js v=33, aovivo.js v=32).
- **2026-06-11/12** — Zebra: selo 🦓 no time com <15% dos palpites, exibido quando o palpite fecha (ui.js v=32).
- **2026-06-11/12** — **Lembrete de jogos**: Edge Function `lembrete-jogos` + `pg_cron` (5 min) + coluna `matches.lembrete_enviado_em` + `CRON_SECRET`. Manda push 20 min antes só pra quem não palpitou. (No ar.)

---

## 12. Backlog / próximos passos

- [ ] **Odds 1X2 nos jogos** (PESQUISADO, pronto pra fazer). Plano recomendado: guardar odds na tabela `matches` (colunas `odd_home/odd_draw/odd_away/odds_updated_at`) via agendamento `pg_cron` (1x/hora) e **média das casas**; exibir do lado da distribuição de palpites. Plano alternativo: buscar na hora que abre o jogo. API já confirmada (ex.: USA x Paraguai → 1.91 / 3.30 / 4.20, 14 casas).
- [ ] **Alinhar zebra de empate**: fazer o selo "Zebra Ativa" considerar também o empate <15% (pra bater com a pontuação), marcando "Emp. 🦓 8%". (Pergunta aberta com o Kevin: marcar empate OU mudar a pontuação pra não dar 2x em empate.)
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
