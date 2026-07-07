-- ======================================================================
-- MIGRAÇÃO: EVENTOS DE JOGO AO VIVO (começou / saiu gol / terminou)
-- ----------------------------------------------------------------------
-- Notificações NOVAS, além do lembrete de 20 min (que continua igual).
-- Uma Edge Function (`eventos-jogos`) fica "vigiando" os jogos ao vivo
-- (via /fixtures?live=all da API-Football) e, comparando com o último
-- estado salvo na tabela `matches`, dispara push pra TODOS os membros
-- dos grupos daquela liga quando:
--   • o jogo COMEÇA         (status NS -> 1H)
--   • sai um GOL            (placar aumentou; gol na prorrogação vem
--                            marcado "não conta no bolão")
--   • o jogo TERMINA        (FT/AET/PEN; avisa o placar de 90' que valeu)
--
-- INSTRUÇÕES:
-- 1. Supabase > SQL Editor: rode os BLOCOS 1 e 2.
-- 2. Faça o deploy da função e (re)confirme o CRON_SECRET — ver
--    "PASSOS DE DEPLOY" no fim. Depois rode o BLOCO 3 (agendamento).
-- ======================================================================


-- ---------- BLOCO 1: colunas de controle na tabela matches ----------
-- São colunas de ESTADO DE NOTIFICAÇÃO, separadas das colunas de placar
-- que o app usa pra pontuar (score_home/away). Assim o "vale só o 90'"
-- do ranking nunca é afetado pelo diffing de gols ao vivo.
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS notif_inicio_em   timestamptz,  -- quando avisamos "começou" (NULL = ainda não / não trackeado)
  ADD COLUMN IF NOT EXISTS notif_fim_em      timestamptz,  -- quando avisamos "terminou" (NULL = jogo ainda em andamento p/ nós)
  ADD COLUMN IF NOT EXISTS notif_score_home  integer,      -- último placar avisado (só p/ detectar gol novo)
  ADD COLUMN IF NOT EXISTS notif_score_away  integer;


-- ---------- BLOCO 2: extensões (já habilitadas pelo lembrete) --------
-- pg_cron = roda a função em intervalo fixo | pg_net = chama a Edge Function via HTTP.
-- Se já rodou a migração do lembrete, isto é no-op.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;


-- ---------- BLOCO 3: agenda os eventos a cada 1 MINUTO ---------------
-- 1 min pra o "GOOOL" chegar quente. A função só faz 1 request /live=all
-- por rodada (+ 1 eventual pra confirmar jogos que acabaram) -> ~1440
-- requests/dia, folgado no plano Pro (7500/dia).
-- O 'x-cron-secret' abaixo é o MESMO valor de CRON_SECRET no deploy
-- (reaproveita o segredo já usado pelo lembrete-jogos).
select cron.schedule(
  'eventos-jogos',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://hkiqozqqcymbhfobydoq.supabase.co/functions/v1/eventos-jogos',
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
-- Ver os agendamentos:        select * from cron.job;
-- Histórico de execuções:     select * from cron.job_run_details order by start_time desc limit 20;
-- Remover/refazer:            select cron.unschedule('eventos-jogos');  -- depois rode o BLOCO 3 de novo
--
-- ZERAR o tracking de um jogo (pra re-testar as notificações dele):
--    update matches set notif_inicio_em=null, notif_fim_em=null,
--                       notif_score_home=null, notif_score_away=null
--     where id = <fixture_id>;
-- ======================================================================


-- ======================================================================
-- PASSOS DE DEPLOY (terminal, fora do SQL Editor)
-- ----------------------------------------------------------------------
-- 1) Suba a função:
--      npx supabase functions deploy eventos-jogos --no-verify-jwt --project-ref hkiqozqqcymbhfobydoq
--    (--no-verify-jwt porque quem chama é o cron, não um usuário logado;
--     a proteção é o header x-cron-secret.)
--
-- 2) O CRON_SECRET já existe (setado pelo lembrete). Se precisar reconfirmar:
--      npx supabase secrets set CRON_SECRET=bolao-lembrete-9f3k2m7x --project-ref hkiqozqqcymbhfobydoq
--
-- 3) Teste manual (deve responder {"message":"Eventos processados",...}):
--      curl -X POST -H "x-cron-secret: bolao-lembrete-9f3k2m7x" \
--        https://hkiqozqqcymbhfobydoq.supabase.co/functions/v1/eventos-jogos
-- ======================================================================
