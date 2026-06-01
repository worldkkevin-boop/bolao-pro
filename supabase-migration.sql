-- ======================================================================
-- MIGRAÇÃO DE BANCO DE DADOS: MOTOR DE PONTUAÇÃO PREMIUM (BOLÃO PRO)
-- ======================================================================
-- INSTRUÇÕES: 
-- 1. Acesse o painel do Supabase (https://supabase.com).
-- 2. Vá em 'SQL Editor' no menu lateral esquerdo.
-- 3. Clique em 'New Query' (Nova Consulta).
-- 4. Cole este código inteiro e clique em 'Run' (Executar).
-- ======================================================================

-- 1. Atualizando a escala base padrão (O Stat Squish Risco x Retorno)
ALTER TABLE groups ALTER COLUMN pt_placar_exato SET DEFAULT 12;
ALTER TABLE groups ALTER COLUMN pt_vencedor_gols_time SET DEFAULT 7;
ALTER TABLE groups ALTER COLUMN pt_empate_nao_exato SET DEFAULT 6;
ALTER TABLE groups ALTER COLUMN pt_apenas_vencedor SET DEFAULT 3;

-- 2. Adicionando as regras Premium de Engajamento para GMs controlarem
ALTER TABLE groups ADD COLUMN IF NOT EXISTS mult_fase_final integer DEFAULT 2; -- Dobra (x2), Triplica (x3) ou desativa (x1) os pontos no mata-mata
ALTER TABLE groups ADD COLUMN IF NOT EXISTS regra_zebra_dinamica boolean DEFAULT false; -- Ativa a leitura de zebras dinâmicas (menos de 15% de palpites)

-- 3. Adicionando o limite de grupos por usuário na tabela profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS max_grupos integer DEFAULT 1; -- Limite padrão de grupos que um jogador pode criar

-- ======================================================================
-- MIGRAÇÃO: SISTEMA DE FICHAS + FLAGS DE MONETIZAÇÃO (Fase 2)
-- ======================================================================
-- Cole abaixo no SQL Editor e clique em Run

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS fichas_desafio INT DEFAULT 3,   -- Saldo de fichas do jogador (padrão: 3 fichas grátis)
  ADD COLUMN IF NOT EXISTS is_gm BOOLEAN DEFAULT false;    -- Flag de Game Master global

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS desafios_ativados BOOLEAN DEFAULT false; -- Liga/desliga desafios no grupo

ALTER TABLE desafios
  ADD COLUMN IF NOT EXISTS custo_fichas INT DEFAULT 0;     -- Custo em fichas para participar do desafio

