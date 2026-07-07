-- ======================================================================
-- MIGRAÇÃO DE BANCO DE DADOS: DESAFIOS QUANTITATIVOS (PROPS MARKET)
-- ======================================================================
-- INSTRUÇÕES:
-- 1. Acesse o painel do Supabase (https://supabase.com).
-- 2. Vá em 'SQL Editor' no menu lateral esquerdo.
-- 3. Clique em 'New Query' (Nova Consulta).
-- 4. Cole este código inteiro e clique em 'Run' (Executar).
-- ======================================================================

-- 1. Expandindo a Tabela de Desafios para suportar os 18 Mercados
ALTER TABLE public.desafios
  ADD COLUMN IF NOT EXISTS market_type VARCHAR(50),      -- Ex: 'total_gols', 'btts', 'player_shots'
  ADD COLUMN IF NOT EXISTS prop_line DECIMAL(5, 2),      -- Ex: 2.5, 0.5, 8.5
  ADD COLUMN IF NOT EXISTS target_player_id INT,         -- ID do jogador (da API-Football)
  ADD COLUMN IF NOT EXISTS target_player_name VARCHAR(150), -- Nome do Jogador alvo
  ADD COLUMN IF NOT EXISTS premio_pontos INT DEFAULT 10, -- Quantos pontos no Bolão o usuário ganha se acertar
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'open'; -- 'open', 'resolved', 'cancelled'

-- 2. Criando a tabela de Apostas dos Usuários nos Desafios
CREATE TABLE IF NOT EXISTS public.desafio_palpites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  desafio_id UUID NOT NULL, -- Referência ao Desafio
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  side VARCHAR(20) NOT NULL, -- 'over', 'under', 'yes', 'no', 'home', 'away'
  fichas_gastas INT DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS (Segurança) na nova tabela
ALTER TABLE public.desafio_palpites ENABLE ROW LEVEL SECURITY;

-- Política: Usuário pode ler seus próprios palpites
CREATE POLICY "Usuários podem ver seus próprios palpites de desafio"
  ON public.desafio_palpites
  FOR SELECT
  USING (auth.uid() = user_id);

-- Política: Usuário autenticado pode inserir palpites
CREATE POLICY "Usuários podem criar palpites em desafios"
  ON public.desafio_palpites
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Política: GM pode ler tudo (via API)
CREATE POLICY "Acesso total para God Mode"
  ON public.desafio_palpites
  FOR ALL
  USING (true);

-- 3. Inserindo uma função de ajuda para debito seguro de fichas (Transação Atomica)
CREATE OR REPLACE FUNCTION gastar_fichas(usuario_id UUID, qtd INT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  saldo_atual INT;
BEGIN
  -- Bloqueia a linha do usuário para evitar concorrência (Race Condition)
  SELECT fichas_desafio INTO saldo_atual
  FROM profiles
  WHERE id = usuario_id
  FOR UPDATE;

  -- Se não tiver saldo suficiente, falha a operação
  IF saldo_atual < qtd THEN
    RETURN FALSE;
  END IF;

  -- Debita as fichas
  UPDATE profiles
  SET fichas_desafio = fichas_desafio - qtd
  WHERE id = usuario_id;

  RETURN TRUE;
END;
$$;
