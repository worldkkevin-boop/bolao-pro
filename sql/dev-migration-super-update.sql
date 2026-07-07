-- ============================================================
-- SUPER UPDATE — migração do banco DEV (VPS)
-- Rodar no SQL Editor do Studio DEV: https://supabase-dev.ksstudio.cloud
-- (⚠️ NÃO rodar em produção — feature em desenvolvimento no branch super-update)
-- ============================================================

-- GROUPS: novo sistema de pontuação + identidade do wizard
alter table public.groups add column if not exists icone text default 'trofeu';
alter table public.groups add column if not exists sistema_pontos text default 'classico';  -- classico | mercado | so_vencedor | custom
alter table public.groups add column if not exists config_pontos jsonb;                     -- knobs do motor V2 (piso/teto/bônus/extras)
alter table public.groups add column if not exists peso_modo text default 'unico';          -- gradual | acelerado | unico_final_dobro | unico
alter table public.groups add column if not exists filtro_jogos jsonb;                      -- {equipes:[ids], fases:[...]} — null = todos

-- MATCHES: probabilidades congeladas (odds -> prob implícita, na trava do palpite)
alter table public.matches add column if not exists prob_home int;
alter table public.matches add column if not exists prob_draw int;
alter table public.matches add column if not exists prob_away int;
alter table public.matches add column if not exists probs_updated_at timestamptz;

-- GUESSES: palpites de tempo extra (mata-mata), independentes do 90'
alter table public.guesses add column if not exists palpite_prorrogacao text;  -- 'home' | 'empate' | 'away'
alter table public.guesses add column if not exists palpite_penaltis text;     -- 'home' | 'away'

-- Conferir:
-- select column_name from information_schema.columns where table_name='groups' order by ordinal_position;
