-- ======================================================================
-- MIGRAÇÃO DE BANCO DE DADOS: OCULTADOR DE DESAFIOS PARA GRUPOS
-- ======================================================================

-- Adiciona a coluna para controlar se os desafios estão ativados no grupo (padrão: TRUE)
ALTER TABLE groups 
  ADD COLUMN IF NOT EXISTS desafios_enabled BOOLEAN DEFAULT true;

-- ======================================================================
-- FINALIZADO: Copie e cole este código no SQL Editor do Supabase e clique em RUN!
-- ======================================================================
