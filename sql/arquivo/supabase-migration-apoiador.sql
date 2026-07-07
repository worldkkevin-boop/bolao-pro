-- ============================================================
--  APOIADOR — selo de quem ajudou o app (doação via MercadoPago)
-- ============================================================
-- Adiciona a flag de apoiador no perfil. É marcada pelo
-- mercadopago-webhook quando um PIX de doação (type 'apoiador') é
-- aprovado. O selo 💛 aparece no ranking, no Ao Vivo e no perfil.
--
-- Rodar no SQL Editor do Supabase (deploy de código NÃO roda migração).
-- ============================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS apoiador BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS apoiador_desde TIMESTAMPTZ;
-- Apoio agora tem PRAZO (recorrente): R$5=7d, R$10=15d, R$20=30d.
-- "apoiador ativo" = apoiador_ate > agora. Quando vence, perde os perks e renova.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS apoiador_ate TIMESTAMPTZ;
