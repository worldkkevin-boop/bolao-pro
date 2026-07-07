-- ============================================================
-- MIGRAÇÃO: Premiação do Pote (1º / 2º / 3º lugar)
-- ------------------------------------------------------------
-- Permite ao admin escolher, na CRIAÇÃO do pote, como o bolo
-- será dividido entre os colocados.
--
-- potes.premiacao guarda o preset escolhido (texto):
--   '100'      -> tudo pro campeão (100%)            [padrão]
--   '70-30'    -> 1º 70% / 2º 30%
--   '50-30-20' -> 1º 50% / 2º 30% / 3º 20%  (clássico)
--   '60-30-10' -> 1º 60% / 2º 30% / 3º 10%
--
-- vencedor_id já existe (1º lugar). Adicionamos 2º e 3º.
-- Potes antigos ficam com premiacao = '100' e seguem
-- funcionando exatamente como antes (campeão único).
-- ============================================================

-- uuid simples (mesmo formato do vencedor_id existente, sem assumir FK).
ALTER TABLE potes
  ADD COLUMN IF NOT EXISTS premiacao     text DEFAULT '100',
  ADD COLUMN IF NOT EXISTS vencedor_2_id uuid,
  ADD COLUMN IF NOT EXISTS vencedor_3_id uuid;

-- Garante que potes já existentes tenham um valor válido
UPDATE potes SET premiacao = '100' WHERE premiacao IS NULL;
