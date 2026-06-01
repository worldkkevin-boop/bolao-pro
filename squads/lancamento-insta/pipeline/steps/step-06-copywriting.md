# Step 06 — Produção de Copies

## Configuração
- **Agente**: Redatora Rita (copywriter)
- **Execução**: subagent
- **Model Tier**: powerful
- **Formato**: instagram-feed

## Context Loading

Carregue os seguintes dados antes de executar:
- Output do Step 04 — Calendário editorial aprovado
- Output do Step 02 — Relatório de pesquisa (para referência de hashtags e tendências)
- Input original do usuário do Step 01 (tópico/ângulo do lançamento)
- `pipeline/data/tone-of-voice.md` — tom de voz do Bolão Pro
- `pipeline/data/output-examples.md` — exemplos de conteúdo de referência
- `pipeline/data/quality-criteria.md` — critérios de qualidade
- `pipeline/data/anti-patterns.md` — erros comuns a evitar
- Feedback da Revisora Renata (se houver rejeição do Step 07)

## Instruções

### Processo

1. **Estude o calendário editorial**: Absorva completamente cada post do calendário — tema, formato, tom emocional, CTA e direção visual. Cada copy deve ser fiel ao briefing estratégico.

2. **Entre no tom "O Mago"**: Antes de escrever, releia o tom de voz do Bolão Pro. Todo conteúdo deve soar empolgante, competitivo e misterioso — como se o Mago estivesse falando diretamente com o leitor. Lembre-se: cores dark (#09090b) + neon green (#10b981), tema de magia e futebol.

3. **Produza as copies para cada post**: Para cada um dos 7 posts, escreva:

   **Se Carrossel:**
   - Texto de cada slide (máximo 15 palavras por slide)
   - Slide 1 = hook visual/textual
   - Último slide = CTA
   - Indicação de elementos visuais por slide

   **Se Reel:**
   - Roteiro completo com timestamps (ex: "0-2s: Hook", "3-8s: Desenvolvimento")
   - Indicação de transições e efeitos
   - Sugestão de áudio/trilha
   - Texto sobreposto para cada trecho

   **Se Post Estático:**
   - Texto principal do visual
   - Elementos de design sugeridos

4. **Escreva as legendas**: Para cada post, produza legenda com:
   - Hook na primeira linha (o que aparece antes do "...mais")
   - Corpo da legenda (80-300 palavras)
   - CTA no final
   - Hashtags relevantes (8-15 por post)
   - Emojis estratégicos

5. **Crie os briefings visuais**: Para cada post, descreva:
   - Prompt detalhado para geração de imagem AI
   - Cores (usar hex codes: #09090b para fundo, #10b981 para destaques)
   - Composição e layout
   - Elementos do tema "O Mago" (silhueta, partículas, glow, magia)
   - Texto que aparece na arte
   - Mood/atmosfera geral

6. **Revise hooks e CTAs**: Releia todos os hooks em sequência — cada um precisa parar o scroll. Releia todos os CTAs — devem progredir de curiosidade para conversão.

## Output Format

```markdown
# ✍️ Conteúdo de Lançamento — Bolão Pro Instagram

## Post D[N] — [Título do Post]

### [Formato: Slides / Roteiro de Reel / Arte Estática]

#### Slide 1 / Cena 1
**Texto**: "[Conteúdo do slide/cena]"
**Visual**: [Descrição visual]
**Timing**: [Se Reel: duração em segundos]

[Repetir para cada slide/cena]

### Legenda
[Hook na primeira linha]

[Corpo da legenda]

[CTA]

[Hashtags]

### Briefing Visual para Geração de Imagem
**Prompt**: [Descrição detalhada para AI de geração de imagem]
**Paleta**: [Cores hex]
**Elementos**: [Lista de elementos visuais]
**Composição**: [Layout e posicionamento]
**Mood**: [Atmosfera geral]
**Texto na arte**: [Texto que deve aparecer na imagem]

---
[Repetir para todos os 7 posts]
```

## Output Example

```markdown
# ✍️ Conteúdo de Lançamento — Bolão Pro Instagram

## Post D1 — O Mago Está Chegando 🪄

### Roteiro de Reel (15 segundos)

#### Cena 1 (0-2s) — Hook
**Texto sobreposto**: "ALGO ESTÁ CHEGANDO..."
**Visual**: Tela 100% preta, texto aparece com efeito de digitação neon green
**Transição**: Fade in rápido
**Áudio**: Trilha misteriosa — baixa, pulsante

#### Cena 2 (3-6s) — Atmosfera
**Texto sobreposto**: "O mundo dos bolões vai mudar"
**Visual**: Partículas neon green flutuando em fundo escuro, formando padrões
**Transição**: Zoom lento para frente
**Áudio**: Batida crescendo

#### Cena 3 (7-11s) — Reveal parcial
**Texto sobreposto**: "O MAGO"
**Visual**: Silhueta de mago aparecendo entre as partículas, glow verde ao redor
**Transição**: Flash rápido
**Áudio**: Drop sutil

#### Cena 4 (12-15s) — Mistério
**Texto sobreposto**: "Prepare-se. 🪄"
**Visual**: Logo do Bolão Pro aparecendo parcialmente, desfocado, com data "EM BREVE"
**Transição**: Fade to black
**Áudio**: Silêncio dramático + sound effect mágico

### Legenda
Algo poderoso está se formando nas sombras... 🪄

Os bolões de futebol nunca mais serão os mesmos.

Fique de olho. O Mago está chegando.

Ative as notificações 🔔 e seja o primeiro a saber.

#OMago #AlgoEstáChegando #Brasileirão2026 #BolãoPro
#FutebolBrasileiro #BolãoDeFutebol #MistérioNoFutebol
#FutebolComAmigos #DicasDeBolão

### Briefing Visual para Geração de Imagem
**Prompt**: "Dark cinematic scene with floating neon green particles (#10b981)
against pure black background (#09090b). A mysterious wizard silhouette
emerging from the darkness, surrounded by magical green glow. Subtle
football elements integrated into the particle effects. Text 'O MAGO
ESTÁ CHEGANDO' in bold white sans-serif font with green glow effect.
Premium dark mode aesthetic, cyberpunk-meets-fantasy mood."
**Paleta**: Fundo #09090b, partículas e glow #10b981, texto #FFFFFF
**Elementos**: Silhueta de mago, partículas flutuantes, glow neon, bola de futebol sutil
**Composição**: Centralizado, silhueta no terço inferior, texto no terço superior
**Mood**: Misterioso, cinematográfico, premium, antecipação
**Texto na arte**: "O MAGO ESTÁ CHEGANDO" + "EM BREVE"

---

## Post D2 — Revelação do Bolão Pro ⚽

### Slides do Carrossel (8 Slides)

#### Slide 1 (Capa/Hook)
**Texto**: "Seu bolão com os amigos acaba de mudar pra sempre 🪄"
**Visual**: Fundo escuro (#09090b), texto grande em branco com glow neon green,
silhueta do mago no canto inferior direito, partículas brilhantes espalhadas

#### Slide 2
**Texto**: "Chega de planilha. Chega de confusão. Chega de calote."
**Visual**: Ícones de planilha, confusão e dinheiro com X vermelho,
fundo escuro com textura sutil

#### Slide 3
**Texto**: "Apresentamos o Bolão Pro ⚽🏆"
**Visual**: Logo completo do Bolão Pro centralizado com efeito reveal,
explosão de partículas neon green ao redor, fundo dark

#### Slide 4
**Texto**: "7 regras de pontuação pra ninguém reclamar 📊"
**Visual**: Interface do app mostrando configuração de regras, dark mode,
destaques em neon green nos números

#### Slide 5
**Texto**: "Tesouraria automática — todo mundo paga 💰"
**Visual**: Tela do módulo Tesouraria, indicadores de pagamento em verde,
ícones de moedas com glow

#### Slide 6
**Texto**: "Perguntas Bônus que mudam tudo 🎯"
**Visual**: Interface de Perguntas Bônus com efeito de interrogação mágica,
glow misterioso, partículas ao redor

#### Slide 7
**Texto**: "Rankings ao vivo — a disputa em tempo real 🔥"
**Visual**: Tela de ranking com posições animadas, setas subindo/descendo,
neon green nos destaques de posição

#### Slide 8 (CTA)
**Texto**: "O Mago chegou. Link na bio 🪄🔗"
**Visual**: Logo + botão CTA "Conheça agora" em neon green (#10b981),
fundo escuro com partículas, QR code sutil no canto

### Legenda
Cansou de bolão bagunçado? 😤 Planilha perdida, amigo caloteiro, regras
que ninguém concorda?

O Bolão Pro chegou pra acabar com a bagunça — e transformar seu bolão
numa experiência de outro nível. 🪄

⚽ 7 regras de pontuação justas e configuráveis
💰 Tesouraria automática — acabou o calote
🎯 Perguntas Bônus exclusivas que mudam o jogo
🏆 Rankings ao vivo pra acompanhar a disputa
📱 Funciona direto no celular — sem baixar nada (PWA)

O Mago tá no comando. Seu bolão nunca mais vai ser o mesmo.

Quer conhecer? 🔗 Link na bio!

#BolãoPro #FutebolComAmigos #Brasileirão2026 #OMago
#BolãoDeFutebol #ApostaEntreAmigos #FutebolBrasileiro
#DicasDeBolão #AppDeFutebol #BolãoDosBrabos
```

## Veto Conditions

1. **Tom inconsistente**: Se algum post não soa como Bolão Pro / "O Mago" (ex: linguagem corporativa, tom burocrático ou genérico), deve ser reescrito no tom correto.

2. **Hooks fracos**: Se o hook de algum post não "para o scroll" — ou seja, se é informativo demais ou não provoca curiosidade/emoção — precisa ser reescrito.

3. **Briefings visuais vagos**: Se algum briefing visual não tem cores hex, composição descrita ou elementos específicos suficientes para geração de imagem AI, precisa ser detalhado.

4. **Hashtags inadequadas**: Se algum post tem menos de 8 ou mais de 15 hashtags, ou se as hashtags não são relevantes para o nicho de futebol/bolões, precisa de ajuste.

## Quality Criteria
- [ ] Todos os 7 posts têm copy completa (slides/roteiro + legenda + briefing visual)
- [ ] Hooks "param o scroll" nos primeiros 2 segundos / primeira linha
- [ ] Tom de voz consistente com Bolão Pro em todos os posts
- [ ] CTAs progridem de curiosidade a conversão ao longo dos 7 posts
- [ ] Legendas têm entre 80-300 palavras cada
- [ ] Hashtags relevantes (8-15 por post) com mix de volume e nicho
- [ ] Briefings visuais têm cores hex, composição e elementos detalhados
- [ ] Slides de carrossel têm no máximo 15 palavras cada
- [ ] Roteiros de Reel têm timestamps e indicações de transição
- [ ] Emojis usados estrategicamente, não decorativamente
