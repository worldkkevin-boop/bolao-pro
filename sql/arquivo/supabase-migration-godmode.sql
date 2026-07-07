-- ======================================================================
-- MIGRAÇÃO DE BANCO DE DADOS: PROJETO "GOD MODE" (GM PANEL)
-- ======================================================================
-- INSTRUÇÕES: 
-- 1. Acesse o painel do Supabase (https://supabase.com).
-- 2. Vá em 'SQL Editor' no menu lateral esquerdo.
-- 3. Clique em 'New Query' (Nova Consulta).
-- 4. Cole este código inteiro e clique em 'Run' (Executar).
-- ======================================================================

-- 1. PROFILES: Adicionando colunas de punição (Banimento)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ban_reason TEXT;

-- 2. TRANSACTIONS: Criação do histórico PIX / Tesouraria
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  type TEXT NOT NULL, -- 'fichas', 'pacote_grupo', etc.
  mp_id TEXT, -- ID da transação no Mercado Pago
  details JSONB, -- Qualquer metadado extra
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS na tabela transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança para transactions
-- (Opcional, mas recomendado: GM pode ver tudo, usuário pode ver as suas)
CREATE POLICY "Permitir leitura total para GMs nas transacoes" 
  ON transactions FOR SELECT USING (
    (SELECT is_gm FROM profiles WHERE id = auth.uid()) = true
  );

CREATE POLICY "Usuários podem ver suas próprias transações" 
  ON transactions FOR SELECT USING ( auth.uid() = user_id );


-- 3. AUDIT_LOGS: Criação do Registro de Segurança (O Big Brother)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Quem executou a ação
  action TEXT NOT NULL, -- Ex: 'BAN_USER', 'INJECT_FICHAS', 'DELETE_GROUP'
  target_type TEXT, -- Ex: 'profiles', 'groups', 'user_desafios'
  target_id TEXT, -- ID do alvo da ação
  details JSONB, -- O que mudou (antes/depois)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS em audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Apenas GMs podem ver e inserir audit_logs" 
  ON audit_logs FOR ALL USING (
    (SELECT is_gm FROM profiles WHERE id = auth.uid()) = true
  );

-- ======================================================================
-- FINALIZADO: As fundações do God Mode estão prontas.
-- ======================================================================
