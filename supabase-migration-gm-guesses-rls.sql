-- ============================================================
--  GM (God Mode) pode gerenciar palpites de QUALQUER jogador
-- ============================================================
-- Contexto: a tabela `guesses` tem RLS que só deixa cada usuário
-- gravar o PRÓPRIO palpite (user_id = auth.uid()). No dashboard do GM
-- ("Placar da Galera por Jogo") o GM precisa criar/editar o palpite de
-- outros membros — isso batia em:
--   "new row violates row-level security policy for table guesses"
--
-- Solução: adicionar UMA política permissiva FOR ALL que libera tudo
-- SÓ para quem tem profiles.is_gm = true. As políticas de RLS se SOMAM
-- (OR), então as regras dos jogadores normais continuam intactas — esta
-- só amplia o acesso para o GM. Mesmo padrão já usado em audit_logs e
-- transactions ("Acesso total para God Mode").
--
-- Rodar no SQL Editor do Supabase (deploy de código NÃO roda migração).
-- ============================================================

ALTER TABLE public.guesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "GM gerencia todos os palpites" ON public.guesses;
CREATE POLICY "GM gerencia todos os palpites"
  ON public.guesses
  FOR ALL
  USING (
    (SELECT is_gm FROM public.profiles WHERE id = auth.uid()) = true
  )
  WITH CHECK (
    (SELECT is_gm FROM public.profiles WHERE id = auth.uid()) = true
  );
