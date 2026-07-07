-- =====================================================================
-- COPA TEST — clonar galera + palpites do Ladaya e ligar TODAS as regras
-- Rodar MANUALMENTE no SQL Editor do Supabase (roda como service role,
-- ignora o RLS; a anon key do app nao consegue fazer esse insert em massa).
--
-- Origem  (Ladaya)    : d20f2029-8b59-4c49-b349-0b8cf9fdbf63  (cod 0VR5A4D)
-- Destino (COPA TEST) : 12f4f81d-a1f6-4b6f-8c5e-ac6f8be3e5fc  (cod MEBGVVJ)
--
-- ATENCAO: depois de rodar, as 18 pessoas passam a VER o grupo COPA TEST
-- no app delas, com os palpites ja preenchidos.
-- Pra desfazer: BLOCO 4 (comentado no fim) apaga tudo do COPA TEST.
-- =====================================================================

-- BLOCO 1 — Ligar TODAS as 7 regras no COPA TEST (novas em 9/5/2)
UPDATE groups SET
  pt_placar_exato          = 12,
  pt_empate_nao_exato      = 6,
  pt_vencedor_saldo        = 7,
  pt_apenas_vencedor       = 3,
  pt_vencedor_gols_time    = 9,   -- NOVA: Vencedor + Gols do Vencedor
  pt_vencedor_gols_perdedor= 5,   -- NOVA: Vencedor + Gols do Perdedor
  pt_gols_um_time          = 2,   -- NOVA: Placar de um Time (errando o vencedor)
  mult_fase_final          = 2,   -- mata-mata x2
  regra_zebra_dinamica     = true,-- zebra x2
  apenas_mata_mata         = false, -- contar TODOS os jogos (igual a simulacao)
  max_participants         = 20
WHERE id = '12f4f81d-a1f6-4b6f-8c5e-ac6f8be3e5fc';

-- BLOCO 2 — Copiar os membros do Ladaya que ainda nao estao no COPA TEST
INSERT INTO group_members (group_id, user_id, role)
SELECT '12f4f81d-a1f6-4b6f-8c5e-ac6f8be3e5fc', gm.user_id, gm.role
FROM group_members gm
WHERE gm.group_id = 'd20f2029-8b59-4c49-b349-0b8cf9fdbf63'
  AND NOT EXISTS (
    SELECT 1 FROM group_members x
    WHERE x.group_id = '12f4f81d-a1f6-4b6f-8c5e-ac6f8be3e5fc'
      AND x.user_id = gm.user_id
  );

-- BLOCO 3 — Copiar TODOS os palpites do Ladaya para o COPA TEST
INSERT INTO guesses (user_id, group_id, match_id, score_home, score_away)
SELECT g.user_id, '12f4f81d-a1f6-4b6f-8c5e-ac6f8be3e5fc', g.match_id, g.score_home, g.score_away
FROM guesses g
WHERE g.group_id = 'd20f2029-8b59-4c49-b349-0b8cf9fdbf63'
ON CONFLICT (user_id, group_id, match_id)
DO UPDATE SET score_home = EXCLUDED.score_home, score_away = EXCLUDED.score_away;

-- Conferir:
-- SELECT count(*) FROM group_members WHERE group_id='12f4f81d-a1f6-4b6f-8c5e-ac6f8be3e5fc';
-- SELECT count(*) FROM guesses       WHERE group_id='12f4f81d-a1f6-4b6f-8c5e-ac6f8be3e5fc';

-- =====================================================================
-- BLOCO 4 (DESFAZER) — descomente e rode pra limpar o COPA TEST:
-- DELETE FROM guesses       WHERE group_id='12f4f81d-a1f6-4b6f-8c5e-ac6f8be3e5fc';
-- DELETE FROM group_members WHERE group_id='12f4f81d-a1f6-4b6f-8c5e-ac6f8be3e5fc'
--   AND user_id <> '7b18cd4e-e293-4d90-863b-572262590e20'; -- mantem voce (owner)
-- =====================================================================
