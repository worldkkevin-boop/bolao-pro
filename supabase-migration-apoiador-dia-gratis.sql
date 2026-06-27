-- ======================================================================
-- DIA DE APOIADOR GRÁTIS PRA TODO MUNDO — TEMPLATE REUTILIZÁVEL
-- ======================================================================
-- Use sempre que quiser repetir a campanha (ideia: dia 25, véspera da
-- renovação da API). É MANUAL: você cola e roda no SQL Editor no dia.
--
-- COMO REUSAR:
--   1. Troque a data abaixo pelo dia da campanha, às 23:59 horário de
--      Brasília. ATENÇÃO ao fuso: o tipo é TIMESTAMPTZ com -03, então
--      escreva direto em Brasília (ex.: dia 25 → '2026-07-25 23:59:59-03').
--   2. Supabase → SQL Editor → New Query → cole → Run.
--   3. No app (js/ui.js), atualize o bloco PROMO_APOIO (INICIO/FIM/CHAVE/
--      DATA_BR) com o mesmo dia e dê push, pra o popup aparecer nesse dia.
--
-- O que faz: dá a TODOS os perfis o status de apoiador até a data/hora
-- escolhida. Libera estatísticas dos times + visual dourado no ranking,
-- porque o app calcula "apoiador ativo" pelo apoiador_ate (_apoiadorAtivo).
--
-- GREATEST não encurta quem JÁ é apoiador pago: se a pessoa tem um
-- apoiador_ate maior lá na frente, mantém o dela (NULL é ignorado pelo
-- GREATEST, então quem não tinha nada recebe a data da campanha).
-- NÃO mexe no booleano `apoiador` de propósito — o Mural de Apoiadores
-- continua só com os pagantes (a query do mural usa apoiador=true).
--
-- ⚠️ Lembrete: a assinatura da API-Football expira em UTC (≈21h de BR),
-- não às 23:59 BR. Por isso convém rodar a campanha no dia 25 (folga).
-- ======================================================================

UPDATE profiles
SET apoiador_ate = GREATEST(apoiador_ate, TIMESTAMPTZ '2026-06-26 23:59:59-03');
--                                                      ^^^^^^^^^^^^^^^^^^^^^^^
--                                          troque por '2026-07-25 23:59:59-03' etc.

-- Conferência (opcional): quantos ficaram ativos agora
-- SELECT count(*) AS apoiadores_ativos FROM profiles WHERE apoiador_ate > now();
