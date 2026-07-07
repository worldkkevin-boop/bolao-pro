-- ======================================================================
-- BOLÃO PRO — SCHEMA CONSOLIDADO (produção)
-- ----------------------------------------------------------------------
-- Estado atual do banco de PRODUÇÃO (Supabase nuvem), juntando todas as
-- migrações que antes eram 14 arquivos soltos. Aqui só como REFERÊNCIA /
-- rebuild — a produção JÁ está aplicada; não precisa rodar nada nela.
--
-- Histórico incremental (o passo a passo de cada feature) está em sql/arquivo/.
-- Este arquivo espelha o RLS de produção (ligado). O banco de DEV (VPS) usa
-- sql/dev-schema.sql, que é o mesmo esqueleto com RLS DESLIGADO.
-- ======================================================================

create extension if not exists "pgcrypto";

-- ============================ TABELAS ============================

-- PROFILES (espelha auth.users; preenchido por trigger no login)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz default now(),
  max_grupos int default 1,
  fichas_desafio int default 3,
  is_gm boolean default false,
  is_banned boolean default false,
  ban_reason text,
  apoiador boolean default false,
  apoiador_desde timestamptz,
  apoiador_ate timestamptz
);

-- GROUPS (bolões) — o motor de pontuação vive nas colunas pt_*
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
  mult_fase_final int default 2,            -- mata-mata x2 (x1 desliga)
  regra_zebra_dinamica boolean default false,
  desafios_ativados boolean default false,
  desafios_enabled boolean default true,
  apenas_mata_mata boolean not null default false
);

-- GROUP_MEMBERS
create table if not exists public.group_members (
  group_id uuid references public.groups(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text default 'member',
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);

-- MATCHES (cache de jogos; id = fixture id da API-Football).
-- notif_* = estado de NOTIFICAÇÃO ao vivo, separado de score_home/away (ranking).
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
  lembrete_enviado_em timestamptz,          -- dedup do lembrete de 20 min
  notif_inicio_em timestamptz,
  notif_fim_em timestamptz,
  notif_score_home int,
  notif_score_away int
);

-- GUESSES (palpites)
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
  unique (user_id, group_id, match_id)      -- upserts (onConflict) do app
);

-- BONUS_CONFIG / BONUS_RESPOSTAS (perguntas bônus por grupo)
create table if not exists public.bonus_config (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade unique,
  prazo timestamptz,
  q1_ativa boolean default false,
  q2_ativa boolean default false,
  q3_ativa boolean default false,
  q4_ativa boolean default false,
  q5_ativa boolean default false,
  pontos int default 10
);
create table if not exists public.bonus_respostas (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  q1_resposta text, q2_resposta text, q3_resposta text, q4_resposta text, q5_resposta text,
  created_at timestamptz default now(),
  unique (group_id, user_id)
);

-- DESAFIOS / DESAFIO_PALPITES (props market)
create table if not exists public.desafios (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade,
  custo_fichas int default 0,
  vencedor text,
  market_type varchar(50),
  prop_line decimal(5,2),
  target_player_id int,
  target_player_name varchar(150),
  premio_pontos int default 10,
  status varchar(20) default 'open',
  created_at timestamptz default now()
);
create table if not exists public.desafio_palpites (
  id uuid primary key default gen_random_uuid(),
  desafio_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  side varchar(20) not null,
  fichas_gastas int default 1,
  created_at timestamptz default now()
);
-- user_desafios: participação/pontos concedidos (usado no app; ver gm/js)
create table if not exists public.user_desafios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  challenge_id uuid,
  points_awarded int default 0,
  created_at timestamptz default now()
);

-- POTES (premiação) / POTES_PARTICIPANTES
create table if not exists public.potes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade,
  status text,
  premiacao text default '100',            -- '100' | '70-30' | '50-30-20' | '60-30-10'
  vencedor_id uuid,
  vencedor_2_id uuid,
  vencedor_3_id uuid,
  created_at timestamptz default now()
);
create table if not exists public.potes_participantes (
  id uuid primary key default gen_random_uuid(),
  pote_id uuid references public.potes(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  status text,
  created_at timestamptz default now()
);

-- TESOURARIA / AUDITORIA
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  amount decimal(10,2) not null,
  status text default 'pending',           -- pending | approved | rejected
  type text not null,                      -- fichas | pacote_grupo | apoiador ...
  mp_id text,                              -- id no Mercado Pago
  details jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users(id) on delete set null,
  action text not null,                    -- BAN_USER | EDIT_GUESS | DELETE_GROUP ...
  target_type text,
  target_id text,
  details jsonb,
  created_at timestamptz default now()
);

-- PUSH (Web Push VAPID)
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  endpoint text, p256dh text, auth text,
  created_at timestamptz default now()
);

-- EVENTO TELÃO (feature promocional isolada; não se liga ao bolão)
create table if not exists public.leads_evento_telao (
  id uuid primary key default gen_random_uuid(),
  evento text not null default 'telao_brasil',
  nome text not null,
  whatsapp text not null,
  palpite text not null,
  numero_sorte text not null,
  user_agent text,
  email text,
  criado_em timestamptz not null default now()
);
create index if not exists idx_leads_telao_evento_data on public.leads_evento_telao (evento, criado_em desc);
create index if not exists idx_leads_telao_email on public.leads_evento_telao (email);
create unique index if not exists uq_lead_evento_whatsapp on public.leads_evento_telao (evento, whatsapp);

create table if not exists public.evento_sorteio_telao (
  id uuid primary key default gen_random_uuid(),
  evento text not null,
  numero_sorte text not null,
  nome text not null,
  criado_em timestamptz not null default now()
);
create index if not exists idx_sorteio_telao_evento on public.evento_sorteio_telao (evento, criado_em desc);

-- View pública do telão (sem WhatsApp/user_agent)
create or replace view public.evento_telao_publico as
  select id, evento, nome, palpite, numero_sorte, criado_em from public.leads_evento_telao;
grant select on public.evento_telao_publico to anon, authenticated;

-- ============================ FUNÇÕES ============================

-- Débito atômico de fichas (evita race condition)
create or replace function public.gastar_fichas(usuario_id uuid, qtd int)
returns boolean language plpgsql security definer as $$
declare saldo_atual int;
begin
  select fichas_desafio into saldo_atual from profiles where id = usuario_id for update;
  if saldo_atual < qtd then return false; end if;
  update profiles set fichas_desafio = fichas_desafio - qtd where id = usuario_id;
  return true;
end; $$;

-- Cria o profile quando um usuário se cadastra (Google OAuth)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email),
          new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================ RLS (produção) ============================
-- Padrão "God Mode": políticas FOR ALL liberando is_gm = true (as policies
-- SOMAM/OR, então o acesso do jogador normal continua). Ver sql/arquivo/.

alter table public.guesses enable row level security;
drop policy if exists "GM gerencia todos os palpites" on public.guesses;
create policy "GM gerencia todos os palpites" on public.guesses for all
  using ((select is_gm from public.profiles where id = auth.uid()) = true)
  with check ((select is_gm from public.profiles where id = auth.uid()) = true);
-- (as policies de "cada um mexe no próprio palpite" já existem em prod)

alter table public.transactions enable row level security;
drop policy if exists "GM le tudo em transactions" on public.transactions;
create policy "GM le tudo em transactions" on public.transactions for select
  using ((select is_gm from public.profiles where id = auth.uid()) = true);
drop policy if exists "usuario ve as proprias transactions" on public.transactions;
create policy "usuario ve as proprias transactions" on public.transactions for select
  using (auth.uid() = user_id);

alter table public.audit_logs enable row level security;
drop policy if exists "apenas GM em audit_logs" on public.audit_logs;
create policy "apenas GM em audit_logs" on public.audit_logs for all
  using ((select is_gm from public.profiles where id = auth.uid()) = true);

-- Telão: público insere, só GM lê/edita/apaga (ver sql/arquivo/telao-leads)
alter table public.leads_evento_telao enable row level security;
alter table public.evento_sorteio_telao enable row level security;

-- ============================ CRON (pg_cron) ============================
-- Agendamentos que chamam Edge Functions. Precisa de pg_cron + pg_net.
-- create extension if not exists pg_cron;  create extension if not exists pg_net;
--
--  lembrete-jogos  '*/5 * * * *'  -> functions/v1/lembrete-jogos  (avisa 20 min antes)
--  eventos-jogos   '* * * * *'    -> functions/v1/eventos-jogos   (começou/gol/fim)
-- Header x-cron-secret = CRON_SECRET. Detalhes/DDL completo em:
--   sql/arquivo/supabase-migration-lembrete-jogos.sql
--   sql/arquivo/supabase-migration-eventos-jogos.sql
