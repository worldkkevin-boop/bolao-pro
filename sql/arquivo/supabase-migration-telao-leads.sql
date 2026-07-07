-- ======================================================================
-- MIGRAÇÃO ISOLADA: CAPTAÇÃO DE LEADS — EVENTO TELÃO (PROMOCIONAL)
-- ======================================================================
-- ⚠️ MÓDULO PARALELO E INDEPENDENTE.
-- Esta tabela NÃO se relaciona com profiles / groups / guesses.
-- Nenhuma tabela oficial do bolão é alterada por este script.
--
-- INSTRUÇÕES:
-- 1. Acesse o painel do Supabase (https://supabase.com).
-- 2. Vá em 'SQL Editor' > 'New Query'.
-- 3. Cole este código inteiro e clique em 'Run'.
-- ======================================================================

-- 1. Tabela nova e exclusiva para os leads capturados no telão
CREATE TABLE IF NOT EXISTS leads_evento_telao (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  evento        text          NOT NULL DEFAULT 'telao_brasil', -- slug do deep link (ex: telao_brasil)
  nome          text          NOT NULL,
  whatsapp      text          NOT NULL,
  palpite       text          NOT NULL,                        -- texto livre, ex: "Brasil 2 x 0 Argentina"
  numero_sorte  text          NOT NULL,                        -- número da sorte sorteado p/ o brinde
  user_agent    text,                                          -- diagnóstico opcional (qual aparelho leu o QR)
  criado_em     timestamptz   NOT NULL DEFAULT now()
);

-- 2. Índice para o sorteio/exportação por evento e ordem de chegada
CREATE INDEX IF NOT EXISTS idx_leads_telao_evento_data
  ON leads_evento_telao (evento, criado_em DESC);

-- 3. RLS: protege a base. O público (anon) só pode INSERIR (mão única).
--    Ninguém com a chave anon consegue LER, EDITAR ou APAGAR os leads.
--    A leitura/sorteio é feita pelo painel do Supabase (service_role).
ALTER TABLE leads_evento_telao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "telao_lead_insert_publico" ON leads_evento_telao;
CREATE POLICY "telao_lead_insert_publico"
  ON leads_evento_telao
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 4. RLS: APENAS o GM (e-mail autenticado) pode LER os leads no Painel do GM.
--    Qualquer outro usuário logado continua sem enxergar nada.
DROP POLICY IF EXISTS "telao_lead_select_gm" ON leads_evento_telao;
CREATE POLICY "telao_lead_select_gm"
  ON leads_evento_telao
  FOR SELECT
  TO authenticated
  USING ( (auth.jwt() ->> 'email') = 'worldkkevin@gmail.com' );

-- (Intencional: nenhuma policy de UPDATE/DELETE — os leads são imutáveis pelo cliente.)

-- ======================================================================
-- 5. VIEW PÚBLICA DA SALA DO EVENTO (placar ao vivo + participantes)
-- ======================================================================
-- Os participantes logam no app e acompanham o evento juntos. Para isso
-- precisam LER a lista de quem entrou — MAS sem expor o WhatsApp de ninguém.
-- Esta view expõe SOMENTE colunas não-sensíveis (sem whatsapp / user_agent).
-- Como a view roda com os privilégios do criador, ela contorna o RLS da
-- tabela base de forma controlada, devolvendo apenas o que é seguro.
CREATE OR REPLACE VIEW evento_telao_publico AS
  SELECT id, evento, nome, palpite, numero_sorte, criado_em
  FROM leads_evento_telao;

GRANT SELECT ON evento_telao_publico TO anon, authenticated;

-- ======================================================================
-- 6. ANTI-ABUSO: 1 palpite por WhatsApp em cada evento
-- ======================================================================
-- Impede que a mesma pessoa pegue vários "números da sorte" se cadastrando
-- de novo (mesmo trocando de aparelho ou usando aba anônima). O WhatsApp é
-- gravado só com dígitos (ver telao.html), então a comparação é confiável.

-- 6a. Limpa duplicados pré-existentes (de testes), mantendo o 1º cadastro
--     de cada (evento, whatsapp). Sem isto o índice único abaixo não pode
--     ser criado. É idempotente: depois de limpo, vira no-op.
DELETE FROM leads_evento_telao a
USING leads_evento_telao b
WHERE a.evento = b.evento
  AND a.whatsapp = b.whatsapp
  AND (a.criado_em > b.criado_em
       OR (a.criado_em = b.criado_em AND a.id > b.id));

-- 6b. Agora sim, cria o índice único anti-abuso.
CREATE UNIQUE INDEX IF NOT EXISTS uq_lead_evento_whatsapp
  ON leads_evento_telao (evento, whatsapp);

-- ======================================================================
-- 7. SORTEIO: registra o ganhador p/ o celular dele acender "VOCÊ GANHOU"
-- ======================================================================
-- Quando o GM sorteia, o ganhador é gravado aqui. A sala do evento fica
-- checando: se o número sorteado == o número do aparelho, acende "VOCÊ GANHOU".
-- Guarda só número + nome (nada sensível; sem WhatsApp).
CREATE TABLE IF NOT EXISTS evento_sorteio_telao (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  evento        text          NOT NULL,
  numero_sorte  text          NOT NULL,
  nome          text          NOT NULL,
  criado_em     timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sorteio_telao_evento
  ON evento_sorteio_telao (evento, criado_em DESC);

ALTER TABLE evento_sorteio_telao ENABLE ROW LEVEL SECURITY;

-- Todos podem LER o ganhador (pro celular acender). Só número + nome.
DROP POLICY IF EXISTS "sorteio_select_publico" ON evento_sorteio_telao;
CREATE POLICY "sorteio_select_publico"
  ON evento_sorteio_telao
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Só o GM pode registrar um sorteio.
DROP POLICY IF EXISTS "sorteio_insert_gm" ON evento_sorteio_telao;
CREATE POLICY "sorteio_insert_gm"
  ON evento_sorteio_telao
  FOR INSERT
  TO authenticated
  WITH CHECK ( (auth.jwt() ->> 'email') = 'worldkkevin@gmail.com' );

-- ======================================================================
-- 8. DELETE: o GM pode REMOVER participantes e FINALIZAR o evento
-- ======================================================================
-- Sem estas policies, o "apagar participante" e o "finalizar evento"
-- (que apaga o marcador CONFIG_ATIVO) são bloqueados em silêncio pelo RLS
-- (delete sem policy = 0 linhas, sem erro). Liberadas só para o GM.
DROP POLICY IF EXISTS "telao_lead_delete_gm" ON leads_evento_telao;
CREATE POLICY "telao_lead_delete_gm"
  ON leads_evento_telao
  FOR DELETE
  TO authenticated
  USING ( (auth.jwt() ->> 'email') = 'worldkkevin@gmail.com' );

DROP POLICY IF EXISTS "sorteio_delete_gm" ON evento_sorteio_telao;
CREATE POLICY "sorteio_delete_gm"
  ON evento_sorteio_telao
  FOR DELETE
  TO authenticated
  USING ( (auth.jwt() ->> 'email') = 'worldkkevin@gmail.com' );

-- ======================================================================
-- 9. VÍNCULO POR EMAIL: o palpite carrega em qualquer aparelho da conta
-- ======================================================================
-- O cadastro pelo QR é anônimo (sem login). Quando a pessoa loga no app, ela
-- "reivindica" o próprio palpite (seta o email). Aí consegue ver o palpite de
-- qualquer aparelho onde logar com a mesma conta Google.
ALTER TABLE leads_evento_telao ADD COLUMN IF NOT EXISTS email text;
CREATE INDEX IF NOT EXISTS idx_leads_telao_email ON leads_evento_telao (email);

-- O dono (logado) pode LER os próprios palpites pelo email do token.
DROP POLICY IF EXISTS "telao_lead_select_dono" ON leads_evento_telao;
CREATE POLICY "telao_lead_select_dono"
  ON leads_evento_telao
  FOR SELECT
  TO authenticated
  USING ( email = (auth.jwt() ->> 'email') );

-- Reivindicar: o logado pode setar o PRÓPRIO email num palpite sem dono.
DROP POLICY IF EXISTS "telao_lead_claim" ON leads_evento_telao;
CREATE POLICY "telao_lead_claim"
  ON leads_evento_telao
  FOR UPDATE
  TO authenticated
  USING ( email IS NULL OR email = (auth.jwt() ->> 'email') )
  WITH CHECK ( email = (auth.jwt() ->> 'email') );
