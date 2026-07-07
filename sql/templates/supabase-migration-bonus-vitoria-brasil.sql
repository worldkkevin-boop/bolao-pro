-- ======================================================================
-- BÔNUS DE APOIADOR POR VITÓRIA DE UM TIME — TEMPLATE REUTILIZÁVEL
-- ======================================================================
-- Dá X dias de Apoiador grátis SÓ pra quem cravou a vitória de um time
-- num jogo específico (ex.: Brasil venceu hoje → quem palpitou vitória
-- do Brasil ganha o prêmio). Irmão da campanha "Dia de Apoiador grátis"
-- (supabase-migration-apoiador-dia-gratis.sql), mas FILTRADO pelos palpites.
--
-- COMO REUSAR (próxima vitória que quiser premiar):
--   1. Descubra o fixture do jogo e SE o time premiado era mandante ou
--      visitante (a API-Football mostra home/away). Pra "vitória do time":
--        - time é MANDANTE  → score_home > score_away
--        - time é VISITANTE → score_away > score_home
--   2. Troque os 2 valores abaixo (FIXTURE e a condição do WHERE).
--   3. Ajuste o interval (dias).
--   4. Supabase → SQL Editor → New Query → cole → Run.
--   5. No app (js/ui.js), atualize o bloco PROMO_VITORIA (FIXTURE, placar,
--      LADO, FIM, CHAVE) com o mesmo jogo e dê push, pro popup aparecer.
--
-- GREATEST não encurta quem JÁ é apoiador pago (mantém o apoiador_ate
-- maior; NULL é ignorado). NÃO mexe no booleano `apoiador` (o Mural
-- continua só com os pagantes). "Apoiador ativo" no app olha apoiador_ate.
-- ======================================================================

-- Brasil 2 x 1 Japão — 29/06/2026, Round of 32. Brasil era MANDANTE.
-- Premia quem palpitou vitória do Brasil (score_home > score_away).
UPDATE profiles
SET apoiador_ate = GREATEST(apoiador_ate, now() + interval '2 days')
WHERE id IN (
  SELECT DISTINCT user_id
  FROM guesses
  WHERE match_id = 1562344        -- <-- fixture do jogo
    AND score_home > score_away   -- <-- Brasil mandante venceu (troque p/ score_away > score_home se for visitante)
);

-- Conferência (opcional): quantos ganharam o bônus agora
-- SELECT count(DISTINCT user_id) AS premiados
-- FROM guesses WHERE match_id = 1562344 AND score_home > score_away;
