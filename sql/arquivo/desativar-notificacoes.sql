-- Desativa os crons de notificação (lembrete de jogo + eventos ao vivo)
-- Motivo: não estão sendo usados agora, só gastando cota de API/recursos.
-- Reversível: pra religar, roda de novo o select cron.schedule(...) dos
-- arquivos supabase-migration-lembrete-jogos.sql / supabase-migration-eventos-jogos.sql.

select cron.unschedule('lembrete-jogos');
select cron.unschedule('eventos-jogos');

-- Confere que sumiram:
select jobname, schedule from cron.job;
