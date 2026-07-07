-- ======================================================================
-- MIGRAÇÃO: LEMBRETE DE JOGOS ("o jogo já vai começar, palpita!")
-- ----------------------------------------------------------------------
-- INSTRUÇÕES:
-- 1. Acesse o painel do Supabase (https://supabase.com) > SQL Editor.
-- 2. Rode os BLOCOS 1 e 2 abaixo.
-- 3. Antes do BLOCO 3, faça o deploy da função e setе o segredo (ver
--    "PASSOS DE DEPLOY" no final deste arquivo). Depois rode o BLOCO 3.
-- ======================================================================


-- ---------- BLOCO 1: coluna de controle (dedup do lembrete) ----------
-- Guarda QUANDO o lembrete daquele jogo foi enviado. NULL = ainda não avisado.
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS lembrete_enviado_em timestamptz;


-- ---------- BLOCO 2: extensões necessárias pro agendamento -----------
-- pg_cron  = roda a função em intervalo fixo
-- pg_net   = permite o cron chamar a Edge Function via HTTP
-- Obs.: se der erro de permissão aqui, habilite "pg_cron" e "pg_net" em
-- Database > Extensions no painel do Supabase e pule este bloco.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;


-- ---------- BLOCO 3: agenda o lembrete a cada 5 minutos --------------
-- A função olha os jogos que começam nos próximos 20 min e avisa só quem
-- ainda não palpitou. Rodar a cada 5 min garante pegar cada jogo a tempo.
-- A senha 'x-cron-secret' abaixo é a MESMA setada em CRON_SECRET no deploy.
select cron.schedule(
  'lembrete-jogos',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := 'https://hkiqozqqcymbhfobydoq.supabase.co/functions/v1/lembrete-jogos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'bolao-lembrete-9f3k2m7x'
    ),
    body    := '{}'::jsonb
  );
  $$
);


-- ======================================================================
-- COMANDOS ÚTEIS (rodar só se precisar)
-- ----------------------------------------------------------------------
-- Ver os agendamentos existentes:
--    select * from cron.job;
--
-- Ver o histórico de execuções (sucesso/erro):
--    select * from cron.job_run_details order by start_time desc limit 20;
--
-- Remover/refazer o agendamento (ex.: pra corrigir o segredo):
--    select cron.unschedule('lembrete-jogos');
--    -- depois rode o BLOCO 3 de novo
-- ======================================================================


-- ======================================================================
-- PASSOS DE DEPLOY (rodar no terminal, fora do SQL Editor)
-- ----------------------------------------------------------------------
-- 1) Suba a função:
--      supabase functions deploy lembrete-jogos --no-verify-jwt
--    (--no-verify-jwt porque quem chama é o cron, não um usuário logado;
--     a proteção é o header x-cron-secret abaixo.)
--
-- 2) Defina o segredo (use o MESMO valor no BLOCO 3 acima):
--      supabase secrets set CRON_SECRET=algum-valor-bem-aleatorio-aqui
--
-- 3) Teste manual (deve responder {"message":"Lembretes processados",...}):
--      curl -X POST \
--        -H "x-cron-secret: algum-valor-bem-aleatorio-aqui" \
--        https://hkiqozqqcymbhfobydoq.supabase.co/functions/v1/lembrete-jogos
-- ======================================================================
