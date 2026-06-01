# Step 02 — Pesquisa de Tendências

## Configuração
- **Agente**: Pesquisador Pedro (researcher)
- **Execução**: subagent
- **Model Tier**: fast
- **Formato**: instagram-feed

## Context Loading

Carregue os seguintes dados antes de executar:
- Input do usuário do Step 01 (tópico/ângulo do lançamento)
- `pipeline/data/research-brief.md` — briefing de pesquisa base
- `pipeline/data/tone-of-voice.md` — tom de voz do Bolão Pro
- `pipeline/data/domain-framework.md` — framework do pipeline

## Instruções

### Processo

1. **Analise o briefing do usuário**: Extraia o tópico/ângulo do lançamento, data prevista, features prioritárias e qualquer contexto adicional fornecido no checkpoint anterior.

2. **Pesquise tendências atuais do Instagram**: Busque usando web_search as tendências de conteúdo que estão performando bem no Instagram brasileiro, especialmente:
   - Formatos em alta (Reels, carrosséis, collabs, etc.)
   - Hooks que geram alto engajamento
   - Tendências de áudio e edição para Reels
   - Melhores práticas atuais de hashtags
   - Horários de maior engajamento no Brasil

3. **Analise o mercado competitivo**: Pesquise como apps de futebol, bolões e apostas esportivas estão se posicionando no Instagram:
   - Perfis de referência e seus formatos de conteúdo
   - Lacunas de posicionamento que o Bolão Pro pode preencher
   - Estratégias de lançamento de apps concorrentes

4. **Identifique oportunidades para o Bolão Pro**: Cruze tendências com o posicionamento único do produto:
   - Tema "O Mago" 🪄 como diferencial narrativo
   - Estética dark mode + neon green como diferencial visual
   - Features exclusivas (7 regras, Tesouraria, Perguntas Bônus, PWA, rankings ao vivo)
   - Ângulo "bolão com amigos" como diferencial social

5. **Compile hashtags recomendadas**: Monte uma lista estratégica com mix de:
   - Hashtags de alto volume (alcance amplo)
   - Hashtags de nicho (público qualificado)
   - Hashtags de marca (identidade do Bolão Pro)

6. **Sintetize o relatório**: Organize os insights em um relatório estruturado com priorização clara.

## Output Format

```markdown
# 🔍 Relatório de Pesquisa — [Tópico do Lançamento]

## Resumo Executivo
[3-5 linhas com os principais insights]

## Tendências de Formato
### Reels
[Insights sobre Reels: duração ideal, hooks, áudios trending]
### Carrosséis
[Insights sobre carrosséis: número de slides, estrutura, engagement]
### Posts Estáticos
[Insights sobre posts de feed: quando usar, melhores práticas]

## Análise de Mercado
### Concorrentes e Referências
[Lista de perfis analisados com pontos fortes e fracos]
### Lacunas Identificadas
[Oportunidades que ninguém está explorando]

## Oportunidades para o Bolão Pro
[Lista priorizada de ângulos e oportunidades]

## Hashtags Recomendadas
### Volume Alto
[Hashtags com grande alcance]
### Nicho Qualificado
[Hashtags específicas do público-alvo]
### Marca
[Hashtags proprietárias do Bolão Pro]

## Recomendações de Timing
[Melhores dias e horários para publicação]

## Recomendações Priorizadas
1. [Recomendação mais importante]
2. [Segunda recomendação]
3. [Terceira recomendação]
...
```

## Output Example

```markdown
# 🔍 Relatório de Pesquisa — Lançamento Brasileirão 2026

## Resumo Executivo
O Instagram brasileiro está priorizando Reels curtos (15-30s) com hooks nos
primeiros 2 segundos e carrosséis educativos de 7-10 slides. No nicho de
futebol, o engajamento é 3x maior durante semanas de rodada do Brasileirão.
Nenhum app de bolão tem presença forte no Instagram — oportunidade clara
para o Bolão Pro se posicionar como referência.

## Tendências de Formato
### Reels
- Duração ideal: 15-30 segundos para alcance máximo
- Hook nos primeiros 2s é crítico — 65% do público abandona antes dos 3s
- Áudios trending aumentam distribuição em até 2x
- Formato "storytelling rápido" performa melhor que "tutorial"
- Texto sobreposto é essencial — 80% assistem sem som

### Carrosséis
- 7-10 slides = maior tempo de permanência e saves
- Slide 1 funciona como thumbnail/capa — precisa de hook visual forte
- Último slide com CTA "Salve/Compartilhe" aumenta distribuição
- Carrosséis educativos ("Como funciona X") têm 2x mais compartilhamentos

### Posts Estáticos
- Ideais para anúncios oficiais e marcos do lançamento
- Melhor com design forte + legenda mais longa e narrativa
- Menor alcance orgânico que Reels e carrosséis, mas maior credibilidade

## Análise de Mercado
### Concorrentes e Referências
- @betano_br (1.2M): Memes de futebol, tom humorístico, baixa conversão
- @cartola_fc (850K): Conteúdo educativo, escalações, engajamento estável
- @pixbet (500K): Apostas esportivas, tom agressivo, alta rejeição
- @bolaodaprimazona: Bolões informais, sem identidade visual, amador

### Lacunas Identificadas
- Nenhum perfil combina estética premium com bolões de futebol
- O ângulo "bolão com amigos" é universal mas ninguém explora de forma sofisticada
- Tema misterioso/mágico é inexplorado no nicho de futebol

## Oportunidades para o Bolão Pro
1. 🪄 "O Mago" como personagem narrador — gera curiosidade e identidade única
2. 🌑 Estética dark mode premium — se destaca no feed saturado de cores vibrantes
3. ⚽ "Bolão com amigos" como estilo de vida — não é só app, é experiência social
4. 📊 "7 regras de pontuação" como conteúdo educativo viral — formato listicle no carrossel
5. 💰 Tesouraria automática resolve dor real — "amigo caloteiro" é meme universal

## Hashtags Recomendadas
### Volume Alto
#Brasileirão2026 #FutebolBrasileiro #Futebol #BolãoDeFutebol
### Nicho Qualificado
#BolãoComAmigos #PalpiteDeFutebol #ApostaEntreAmigos #DicasDeBolão
### Marca
#BolãoPro #OMago #BolãoDosBrabos

## Recomendações de Timing
- Terça e quinta: maior engajamento para conteúdo esportivo
- 12h-14h e 19h-21h: picos de atividade no Instagram Brasil
- Evitar publicar durante jogos ao vivo — atenção desviada

## Recomendações Priorizadas
1. Abrir campanha com Reel teaser "O Mago está chegando" — mistério gera shares
2. Usar carrossel educativo sobre as 7 regras — formato com maior potencial viral
3. Fechar campanha com urgência real (data do Brasileirão) — deadline natural
```

## Veto Conditions

1. **Pesquisa superficial**: Se o relatório não contém pelo menos 5 insights acionáveis com fundamentação, deve ser refeito. Dados genéricos copiados de guias de marketing não contam.

2. **Desconexão com o produto**: Se as recomendações não fazem referências específicas ao Bolão Pro (features, tom, estética), o relatório não está personalizado o suficiente e precisa de revisão.

3. **Falta de análise competitiva**: Se não há pelo menos 3 perfis/apps analisados como concorrentes ou referências, a pesquisa está incompleta.

## Quality Criteria
- [ ] Relatório contém resumo executivo de 3-5 linhas
- [ ] Pelo menos 5 insights acionáveis com fundamentação
- [ ] Análise de pelo menos 3 concorrentes/referências
- [ ] Recomendações de hashtags com mix de volume e nicho (mínimo 10)
- [ ] Cada insight conectado a uma ação concreta para o Bolão Pro
- [ ] Recomendações priorizadas em ordem de importância
- [ ] Tendências são atuais (últimos 3-6 meses)
