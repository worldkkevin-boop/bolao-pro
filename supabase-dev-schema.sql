-- ============================================================
-- SCHEMA DEV do Bolão Pro — recria as tabelas no Supabase de TESTE (VPS)
-- Rodar no SQL Editor do Studio: https://supabase-dev.ksstudio.cloud → SQL Editor
--
-- Reconstruído a partir da estrutura REAL de produção (colunas/tipos lidos via API).
-- RLS fica DESLIGADO de propósito (acesso aberto) — é ambiente de dev, simplifica os testes.
-- Não copia DADOS de produção, só a ESTRUTURA.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- PROFILES (espelha auth.users; preenchido por trigger no login) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz default now(),
  max_grupos int default 3,
  fichas_desafio int default 3,
  is_gm boolean default false,
  is_banned boolean default false,
  ban_reason text,
  apoiador boolean default false,
  apoiador_desde timestamptz,
  apoiador_ate timestamptz
);

-- ---------- GROUPS ----------
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique,
  owner_id uuid references auth.users(id),
  player_limit int default 5,
  created_at timestamptz default now(),
  league_id int,
  max_participants int default 20,
  limite_membros int,
  pt_placar_exato int default 12,
  pt_vencedor_gols_time int default 0,
  pt_empate_nao_exato int default 6,
  pt_vencedor_saldo int default 7,
  pt_vencedor_gols_perdedor int default 0,
  pt_apenas_vencedor int default 3,
  pt_gols_um_time int default 0,
  privado boolean default false,
  mult_fase_final int default 2,
  regra_zebra_dinamica boolean default false,
  desafios_ativados boolean default false,
  desafios_enabled boolean default false,
  apenas_mata_mata boolean default false
);

-- ---------- GROUP_MEMBERS ----------
create table if not exists public.group_members (
  group_id uuid references public.groups(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text default 'member',
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);

-- ---------- MATCHES (cache de jogos; id = fixture id da API-Football) ----------
create table if not exists public.matches (
  id bigint primary key,
  league_id int,
  season int,
  home_team text,
  home_team_id int,
  home_logo text,
  away_team text,
  away_team_id int,
  away_logo text,
  kickoff timestamptz,
  status text,
  score_home int,
  score_away int,
  minute text,
  round text,
  updated_at timestamptz default now(),
  lembrete_enviado_em timestamptz,
  notif_inicio_em timestamptz,
  notif_fim_em timestamptz,
  notif_score_home int,
  notif_score_away int
);

-- ---------- GUESSES (palpites) ----------
create table if not exists public.guesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  match_id bigint,
  score_home int,
  score_away int,
  points int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, group_id, match_id)   -- necessário pros upserts (onConflict) do app
);

-- ---------- BONUS_CONFIG ----------
create table if not exists public.bonus_config (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade,
  prazo timestamptz,
  q1_ativa boolean default false,
  q2_ativa boolean default false,
  q3_ativa boolean default false,
  q4_ativa boolean default false,
  q5_ativa boolean default false,
  pontos int default 10,
  unique (group_id)
);

-- ---------- BONUS_RESPOSTAS ----------
create table if not exists public.bonus_respostas (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  q1_resposta text,
  q2_resposta text,
  q3_resposta text,
  q4_resposta text,
  q5_resposta text,
  created_at timestamptz default now(),
  unique (group_id, user_id)
);

-- ---------- EVENTO_SORTEIO_TELAO ----------
create table if not exists public.evento_sorteio_telao (
  id uuid primary key default gen_random_uuid(),
  evento text,
  numero_sorte text,
  nome text,
  criado_em timestamptz default now()
);

-- ---------- STUBS das features periféricas (colunas mínimas; refinar quando usar) ----------
-- push (auth.js), desafios/user_desafios (view desafios + perfil), potes/tesouraria (GM), leads (telão)
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  endpoint text, p256dh text, auth text,
  created_at timestamptz default now()
);
create table if not exists public.desafios (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade,
  titulo text, custo_fichas int default 0, vencedor text, status text,
  created_at timestamptz default now()
);
create table if not exists public.user_desafios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  challenge_id uuid, points_awarded int default 0,
  created_at timestamptz default now()
);
create table if not exists public.potes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade,
  status text, created_at timestamptz default now()
);
create table if not exists public.potes_participantes (
  id uuid primary key default gen_random_uuid(),
  pote_id uuid references public.potes(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  status text, created_at timestamptz default now()
);
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid, group_id uuid, valor numeric, tipo text, status text,
  created_at timestamptz default now()
);
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid, action text, target_id text, details jsonb,
  created_at timestamptz default now()
);
create table if not exists public.leads_evento_telao (
  id uuid primary key default gen_random_uuid(),
  evento text, nome text, whatsapp text, created_at timestamptz default now()
);

-- ---------- TRIGGER: cria o profile quando um usuário loga (Google OAuth) ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- GRANTS (RLS desligado -> acesso via grants; garante anon/authenticated) ----------
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- Confere:
-- select table_name from information_schema.tables where table_schema='public' order by 1;
