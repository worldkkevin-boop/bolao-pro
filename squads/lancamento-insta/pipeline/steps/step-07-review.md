# Step 07 — Revisão de Qualidade

## Configuração
- **Agente**: Revisora Renata (reviewer)
- **Execução**: inline
- **On Reject**: step-06-copywriting (retorna para Redatora Rita com feedback)

## Context Loading

Carregue os seguintes dados antes de executar:
- Output do Step 06 — Copies completas da Redatora Rita
- Output do Step 04 — Calendário editorial (para verificar aderência)
- `pipeline/data/quality-criteria.md` — critérios de qualidade
- `pipeline/data/tone-of-voice.md` — tom de voz do Bolão Pro
- `pipeline/data/anti-patterns.md` — erros comuns a evitar
- `pipeline/data/output-examples.md` — exemplos de referência

## Instruções

### Processo

1. **Leitura completa sem anotações**: Leia todo o material da Redatora Rita de uma vez — todos os 7 posts com slides/roteiros, legendas, hashtags e briefings visuais. Absorva o conjunto antes de avaliar partes.

2. **Verificação de arco narrativo**: Confirme que os 7 posts seguem a progressão definida no calendário editorial:
   - Os temas estão na ordem correta?
   - Os tons emocionais progridem adequadamente?
   - A história faz sentido lida em sequência?

3. **Análise de hooks**: Avalie cada hook (primeiro slide ou primeiros 2 segundos de Reel) com a pergunta: "Isso me faria parar de scrollar?" Se a resposta é "talvez" ou "não", sinalize como 🟡 ou 🔴.

4. **Verificação de tom de voz**: Confirme que TODOS os posts soam como Bolão Pro / "O Mago":
   - Empolgante e competitivo (não burocrático)
   - Misterioso quando apropriado (não confuso)
   - Informal premium (não desleixado nem corporativo)
   - Referências ao tema "O Mago" presentes

5. **Checklist de CTAs**: Verifique a progressão dos CTAs ao longo dos 7 posts:
   - D1-D2: Curiosidade/Awareness ("Fique de olho", "Conheça")
   - D3-D5: Consideração/Educação ("Salve", "Descubra")
   - D6-D7: Conversão ("Entre pro bolão", "Baixe agora")

6. **Revisão de hashtags**: Para cada post, verifique:
   - Quantidade adequada (8-15 por post)
   - Mix de volume alto e nicho qualificado
   - Relevância para o conteúdo específico do post
   - Sem hashtags genéricas irrelevantes (#marketing, #digital)

7. **Avaliação de briefings visuais**: Confirme que cada briefing tem:
   - Cores hex da marca (#09090b, #10b981)
   - Descrição de composição e layout
   - Elementos do tema "O Mago" especificados
   - Detalhamento suficiente para geração de imagem AI

8. **Verificação de features**: Confirme que ao longo dos 7 posts, todas as features principais são cobertas:
   - [ ] 7 regras de pontuação
   - [ ] Módulo Tesouraria
   - [ ] Perguntas Bônus
   - [ ] Rankings ao vivo
   - [ ] PWA (funciona no celular)
   - [ ] Tema "O Mago"

9. **Classificação e decisão**: Organize o feedback por prioridade e decida:
   - ✅ **Aprovado** — conteúdo pronto para aprovação final do usuário
   - ⚠️ **Aprovado com ressalvas** — pequenos ajustes que podem ser feitos sem reescrita
   - ❌ **Rejeitado** — problemas significativos que exigem revisão pela Redatora Rita

## Output Format

```markdown
# 🧐 Relatório de Revisão — Conteúdo de Lançamento Bolão Pro

## Decisão Final
**Status**: [✅ Aprovado / ⚠️ Aprovado com ressalvas / ❌ Rejeitado]
**Posts revisados**: 7/7
**Correções obrigatórias (🔴)**: [N]
**Melhorias recomendadas (🟡)**: [N]
**Sugestões opcionais (🟢)**: [N]

## Pontos Fortes 💪
[O que está funcionando bem — mínimo 3 pontos]

## Correções Obrigatórias 🔴
### [Post DN] — [Título do problema]
**Problema**: [Descrição]
**Sugestão**: [Alternativa concreta]
[Repetir para cada correção]

## Melhorias Recomendadas 🟡
### [Post DN] — [Título]
**Problema**: [Descrição]
**Sugestão**: [Alternativa]
[Repetir para cada melhoria]

## Sugestões Opcionais 🟢
[Lista de polimentos que elevariam a qualidade]

## Checklist de Marca
- [x/] Tema "O Mago" presente em X/7 posts
- [x/] Cores da marca nos briefings visuais
- [x/] Features cobertas: [lista]
- [x/] CTAs progressivos
- [x/] Hashtags adequadas

## Resumo para o Próximo Passo
[Se aprovado: resumo do que vai para aprovação final]
[Se rejeitado: direcionamento claro para a Redatora Rita]
```

## Output Example

```markdown
# 🧐 Relatório de Revisão — Conteúdo de Lançamento Bolão Pro

## Decisão Final
**Status**: ⚠️ Aprovado com ressalvas
**Posts revisados**: 7/7
**Correções obrigatórias (🔴)**: 1
**Melhorias recomendadas (🟡)**: 3
**Sugestões opcionais (🟢)**: 2

## Pontos Fortes 💪
1. O arco narrativo está impecável — a progressão de mistério a urgência é envolvente
2. Os hooks dos posts D1 e D4 são excepcionais — param o scroll imediatamente
3. Os briefings visuais estão muito detalhados — geração de imagem AI será precisa
4. O tom "O Mago" está forte e consistente na maioria dos posts
5. As legendas têm o tamanho ideal e os CTAs fluem naturalmente

## Correções Obrigatórias 🔴
### Post D3, Slide 5 — Tom inconsistente
**Problema**: "módulo de gestão financeira integrada" soa corporativo e
quebra o tom empolgante dos slides anteriores.
**Sugestão**: Trocar por "Tesouraria mágica — acabou o calote entre amigos 💰"

## Melhorias Recomendadas 🟡
### Post D5 — Hook mais forte
**Problema**: "Conheça as Perguntas Bônus do Bolão Pro" é descritivo mas não provoca.
**Sugestão**: "A pergunta que pode virar seu bolão de cabeça pra baixo 🎯"

### Post D2 — Mais hashtags necessárias
**Problema**: Apenas 6 hashtags — abaixo do mínimo de 8.
**Sugestão**: Adicionar #PalpiteDeFutebol e #BolãoComAmigos

### Post D6 — CTA do post anterior
**Problema**: CTA "Baixe agora" é forte demais para D6. "Baixe agora" deve ficar no D7.
**Sugestão**: Usar "Monta teu time — link na bio 🔗" no D6

## Sugestões Opcionais 🟢
1. Post D4: Adicionar emoji ⚡ no hook para mais energia visual
2. Post D7: Mencionar data exata do Brasileirão para reforçar urgência real

## Checklist de Marca
- [x] Tema "O Mago" presente em 6/7 posts
- [x] Cores #09090b e #10b981 em todos os briefings visuais
- [x] Features: 7 regras ✅ Tesouraria ✅ Perguntas Bônus ✅ Rankings ✅ PWA ✅
- [x] CTAs progressivos (com ressalva no D6 — ver 🟡 acima)
- [x] Hashtags 8-15 por post (com ressalva no D2 — ver 🟡 acima)

## Resumo para o Próximo Passo
Conteúdo aprovado com 1 correção obrigatória (tom no D3) e 3 melhorias
recomendadas. A correção do D3 deve ser feita antes da aprovação final.
As melhorias são recomendadas mas não bloqueiam publicação.
```

## Veto Conditions

1. **Problemas sistêmicos de tom**: Se mais de 2 posts têm tom inconsistente com o Bolão Pro (corporativo, genérico ou agressivo), o conteúdo todo deve ser rejeitado para reescrita.

2. **Hooks fracos em maioria**: Se mais da metade dos posts têm hooks que não "param o scroll", o material precisa de revisão criativa completa.

3. **Features críticas ausentes**: Se alguma das 5 features principais (7 regras, Tesouraria, Perguntas Bônus, PWA, rankings) não aparece em nenhum dos 7 posts, o conteúdo está incompleto.

## Quality Criteria
- [ ] Relatório cobre todos os 7 posts individualmente
- [ ] Avaliação do conjunto (arco narrativo, progressão de CTAs)
- [ ] Cada feedback tem classificação de prioridade (🔴🟡🟢)
- [ ] Correções obrigatórias incluem sugestão concreta de melhoria
- [ ] Pontos fortes são reconhecidos (mínimo 3)
- [ ] Checklist de marca completo
- [ ] Status final claramente justificado
- [ ] Direcionamento claro para próximo passo (aprovação ou reescrita)
