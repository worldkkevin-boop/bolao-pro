# 🧮 Pontuação V2 — "Lógica de Mercado" (SUPER UPDATE)

> Fonte: script mestre do Kevin (2026-07-07) + prints de referência do app-base.
> Status: **em desenvolvimento no branch `super-update`** — NÃO está em produção.
> Motor: [js/pontos.js](../js/pontos.js) · Wizard: [js/criarbolao.js](../js/criarbolao.js) · Migração DEV: [sql/dev-migration-super-update.sql](../sql/dev-migration-super-update.sql)

## Conceito
Foge do modelo de pontos fixos: usa **probabilidade × risco × retorno** (estilo bets).
Palpite difícil (zebra) vale mais; palpite seguro (favorito) vale menos.

## 1. Pontuação Base (o termômetro)
Acertar o **vencedor (ou empate)** vale entre **5 e 20 pontos**, inversamente proporcional
à probabilidade do resultado:

- **Piso 5 pts** — favorito absoluto (prob ≥ 90%).
- **Teto 20 pts** — zebra extrema.
- **Fórmula implementada** (calibrada nos prints de referência):
  `base = clamp( ceil( 5 + 4 × ln(100 / prob%) ), 5, 20 )`
  Validação contra os prints: 80%→6 · 21%→12 · 15%→13 · 5%→17 ✔
- Probabilidades: vêm das **odds da API-Football** (Match Winner → prob implícita
  normalizada), congeladas na trava do palpite (10 min antes). Guardadas em
  `matches.prob_home/draw/away`.

## 2. Bônus (fixos, somam à base — só valem se acertou o vencedor)
Mutuamente exclusivos por construção (cascata), EXCETO a goleada que soma à parte:

| Bônus | Pts | Exemplo |
|---|---|---|
| Placar Exato | +5 | palpitou 2x1, deu 2x1 |
| Placar do Vencedor | +3 | palpitou 2x1, deu 2x0 |
| Diferença de Gols | +2 | palpitou 3x0, deu 5x2 |
| Gols do Perdedor | +1 | palpitou 2x1, deu 3x1 |
| Goleada (4+ gols) | +1 extra | palpitou 4+ pra um time E aconteceu (mesmo time) |

Ex. do print: base 6 + exato 5 = **11 pts** ✔ (bônus NÃO empilham entre si).

## 3. Tempo Extra (mata-mata) — palpites SEPARADOS do 90'
- **Prorrogação:** +3 pts (quem vence na prorrogação: casa/empate/fora).
- **Pênaltis:** +3 pts (quem vence nos pênaltis: casa/fora).
- Independem do palpite dos 90' e **multiplicam pelo peso da fase** (print: "vale 6" = 3 × peso 2).
- Colunas: `guesses.palpite_prorrogacao`, `guesses.palpite_penaltis`.

## 4. Peso dos Jogos (multiplica TUDO: base + bônus + tempo extra)
| Modo | Regra |
|---|---|
| `gradual` (recomendado) | Grupos 1× · Mata-mata 2× · Final 4× |
| `acelerado` | Rodada1 1× · Rodada2 2× · Rodada3 3× · Mata-mata 4× · Final 6× |
| `unico_final_dobro` | Tudo 1× · Final 2× |
| `unico` | Tudo 1× |

## 5. Desempate (nesta ordem, estrita)
1. Pontos Totais → 2. Acertou Vencedor → 3. Placar Exato → 4. Gols do Vencedor →
5. Diferença de Gols → 6. Gols do Perdedor → 7. Goleada → 8. Ordem de Entrada no grupo.

## 6. Sistemas disponíveis no wizard (groups.sistema_pontos)
- `mercado` — tudo acima ("O mais justo e equilibrado").
- `classico` — a cascata legada 12/7/6/3 ("Sistema simplificado"; usa o motor antigo).
- `so_vencedor` — base fixa 5 pts por acerto de vencedor, sem bônus ("Sem placar, só vencedor").
- `custom` — mercado com todos os knobs editáveis (`config_pontos`).

⚠️ Sistema de pontos + peso **não podem ser editados** após criar o grupo (regra do produto).

## Decisões de implementação
- Errou o vencedor no sistema mercado → **0 pontos** (não existe "placar de um time" aqui).
- Empate não-exato no mercado → base do empate + bônus "Diferença de Gols" (+2, dif 0 = 0).
- Sem prob salva no jogo → base neutra do piso (5) até o pipeline de odds preencher.
- Grupos legados (sem `sistema_pontos` ou `classico`) seguem 100% no motor antigo — retrocompatível.

## Backlog do super update
- [x] Motor V2 + wizard de criação (8 passos)
- [ ] Pipeline de odds → `matches.prob_*` (congelar na trava)
- [ ] UI de palpite prorrogação/pênaltis (mata-mata)
- [ ] Ranking com motor V2 + desempate de 8 critérios
- [ ] Tela de detalhamento por jogo (base + bônus + peso)
