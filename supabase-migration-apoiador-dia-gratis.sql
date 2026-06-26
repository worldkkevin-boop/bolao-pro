-- ======================================================================
-- DIA DE APOIADOR GRÁTIS PRA TODO MUNDO — 26/06/2026
-- ======================================================================
-- INSTRUÇÕES:
-- 1. Abra o Supabase → SQL Editor → New Query.
-- 2. Cole este bloco e clique em Run.
-- 3. Rodar UMA vez só. (Pode rodar de novo sem problema — não encurta ninguém.)
--
-- O que faz: dá a TODOS os perfis o status de apoiador até as 23:59
-- (horário de Brasília) de hoje. Isso libera as estatísticas dos times e
-- o visual dourado no ranking pra geral, porque o app calcula "apoiador
-- ativo" pelo apoiador_ate (js/ui.js _apoiadorAtivo).
--
-- GREATEST não encurta quem JÁ é apoiador pago: se a pessoa tem um
-- apoiador_ate maior lá na frente, mantém o dela (NULL é ignorado pelo
-- GREATEST, então quem não tinha nada recebe a data de hoje).
-- Obs.: NÃO mexe no booleano `apoiador` de propósito — assim o Mural de
-- Apoiadores continua só com os pagantes (a query do mural usa apoiador=true).
-- ======================================================================

UPDATE profiles
SET apoiador_ate = GREATEST(apoiador_ate, TIMESTAMPTZ '2026-06-26 23:59:59-03');

-- Conferência (opcional): quantos ficaram ativos agora
-- SELECT count(*) AS apoiadores_ativos FROM profiles WHERE apoiador_ate > now();
