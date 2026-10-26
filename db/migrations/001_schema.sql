-- =====================================================================
--  PLATAFORMA DE VAGAS LOCAIS — Script de inicialização do banco
--  PostgreSQL 15+  (compatível com Supabase e Neon)
--
--  Conteúdo:
--   1. Extensões e tipos (enums de status)
--   2. Tabelas: regiões, usuários, empresas, termos, configurações,
--      vagas, pagamentos PIX, webhooks, denúncias, candidatos,
--      métricas, outbox de notificações e log de auditoria
--   3. Gatilhos: updated_at, busca textual, máquina de estados da vaga,
--      cota gratuita no cadastro, auditoria automática e imutável,
--      suspensão cautelar por denúncias e por banimento
--   4. Funções de negócio: publicar vaga (cota/crédito/PIX),
--      confirmar pagamento (idempotente), expirar vagas, moderar denúncia,
--      registrar visualização/clique
--   5. Views (vitrine pública e métricas do admin), RLS e seeds
--
--  Convenção de auditoria: antes de cada operação, o backend chama
--    SELECT set_audit_context('<user_uuid>', 'COMPANY', 'app', '<request_id>', '<ip>');
--  dentro da mesma transação, para que os gatilhos registrem quem fez o quê.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. EXTENSÕES E TIPOS
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;     -- e-mails case-insensitive
CREATE EXTENSION IF NOT EXISTS unaccent;   -- busca sem acentos
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- busca parcial por cargo

CREATE TYPE user_role        AS ENUM ('ADMIN', 'COMPANY', 'CANDIDATE');
CREATE TYPE company_status   AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED');
CREATE TYPE job_status       AS ENUM ('DRAFT', 'PENDING_PAYMENT', 'PUBLISHED', 'CLOSED', 'EXPIRED', 'SUSPENDED');
CREATE TYPE job_billing      AS ENUM ('FREE_TIER', 'PAID', 'CREDIT', 'ADMIN_GRANT');
CREATE TYPE work_model       AS ENUM ('ONSITE', 'HYBRID', 'REMOTE');
CREATE TYPE employment_type  AS ENUM ('CLT', 'PJ', 'ESTAGIO', 'TEMPORARIO', 'FREELANCE', 'APRENDIZ');
CREATE TYPE apply_channel    AS ENUM ('WHATSAPP', 'EMAIL', 'URL');
CREATE TYPE payment_status   AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED', 'REFUNDED');
CREATE TYPE report_reason    AS ENUM ('FILLED', 'NONEXISTENT', 'MISLEADING', 'DISCRIMINATORY', 'CHARGES_FEE', 'OTHER');
CREATE TYPE report_status    AS ENUM ('OPEN', 'JOB_DEACTIVATED', 'COMPANY_NOTIFIED', 'ARCHIVED');
CREATE TYPE outbox_status    AS ENUM ('PENDING', 'SENT', 'FAILED');

-- ---------------------------------------------------------------------
-- 2. TABELAS
-- ---------------------------------------------------------------------

-- 2.1 Expansão regional --------------------------------------------------
CREATE TABLE regions (
  id           smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name         text        NOT NULL,                 -- ex.: "Litoral Norte"
  slug         text        NOT NULL UNIQUE,
  state        char(2)     NOT NULL,
  is_active    boolean     NOT NULL DEFAULT false,   -- liberação gradual
  launched_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cities (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  region_id   smallint NOT NULL REFERENCES regions(id),
  ibge_code   integer  UNIQUE,
  name        text     NOT NULL,
  slug        text     NOT NULL,
  state       char(2)  NOT NULL,
  is_active   boolean  NOT NULL DEFAULT false,
  UNIQUE (state, slug)
);
CREATE INDEX cities_region_active_idx ON cities (region_id) WHERE is_active;

CREATE TABLE categories (
  id         smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       text NOT NULL UNIQUE,
  slug       text NOT NULL UNIQUE,
  sort_order smallint NOT NULL DEFAULT 0,
  is_active  boolean  NOT NULL DEFAULT true
);

-- 2.2 Usuários -----------------------------------------------------------
-- Supabase: use o mesmo id de auth.users. Neon + Auth.js: tabela principal.
CREATE TABLE users (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email              citext      NOT NULL UNIQUE,
  name               text,
  role               user_role   NOT NULL,
  phone              text,
  email_verified_at  timestamptz,
  is_blocked         boolean     NOT NULL DEFAULT false,
  last_login_at      timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- 2.3 Empresas / contratantes -------------------------------------------
CREATE TABLE companies (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id         uuid           NOT NULL REFERENCES users(id),
  -- CNPJ opcional (pessoa física se cadastra sem documento).
  -- Somente dígitos/letras, sem máscara; aceita o formato alfanumérico.
  cnpj                  varchar(14)    UNIQUE,
  legal_name            text           NOT NULL,   -- razão social ou nome do contratante
  trade_name            text,                      -- nome fantasia
  whatsapp              varchar(13)    NOT NULL,   -- 55 + DDD + número
  whatsapp_verified_at  timestamptz,               -- zerado se o número mudar
  contact_email         citext         NOT NULL,
  city_id               integer        REFERENCES cities(id),
  logo_url              text,
  status                company_status NOT NULL DEFAULT 'ACTIVE',
  status_reason         text,
  free_quota_granted    integer        NOT NULL DEFAULT 0,
  free_quota_remaining  integer        NOT NULL DEFAULT 0 CHECK (free_quota_remaining >= 0),
  paid_credits          integer        NOT NULL DEFAULT 0 CHECK (paid_credits >= 0),
  created_at            timestamptz    NOT NULL DEFAULT now(),
  updated_at            timestamptz    NOT NULL DEFAULT now(),
  CONSTRAINT companies_cnpj_format CHECK (cnpj IS NULL OR cnpj ~ '^[0-9A-Z]{12}[0-9]{2}$'),
  CONSTRAINT companies_whatsapp_format CHECK (whatsapp ~ '^55[0-9]{10,11}$')
);
CREATE INDEX companies_owner_idx  ON companies (owner_user_id);
CREATE INDEX companies_status_idx ON companies (status) WHERE status <> 'ACTIVE';

-- 2.4 Termos de uso versionados + aceite --------------------------------
CREATE TABLE terms_versions (
  id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  version       text        NOT NULL UNIQUE,
  audience      text        NOT NULL CHECK (audience IN ('COMPANY', 'CANDIDATE', 'ALL')),
  content_md    text        NOT NULL,
  is_current    boolean     NOT NULL DEFAULT false,
  published_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX terms_one_current_per_audience ON terms_versions (audience) WHERE is_current;

CREATE TABLE terms_acceptances (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id           uuid    NOT NULL REFERENCES users(id),
  company_id        uuid    REFERENCES companies(id),
  terms_version_id  integer NOT NULL REFERENCES terms_versions(id),
  accepted_at       timestamptz NOT NULL DEFAULT now(),
  ip                inet,
  user_agent        text,
  UNIQUE (user_id, terms_version_id)
);

-- 2.5 Configurações da plataforma (linha única) --------------------------
CREATE TABLE platform_settings (
  id                              boolean PRIMARY KEY DEFAULT true CHECK (id),
  job_price_cents                 integer NOT NULL DEFAULT 1990 CHECK (job_price_cents >= 0),
  onboarding_free_jobs            integer NOT NULL DEFAULT 10   CHECK (onboarding_free_jobs >= 0),
  job_duration_days               integer NOT NULL DEFAULT 30   CHECK (job_duration_days BETWEEN 1 AND 365),
  pix_expiration_minutes          integer NOT NULL DEFAULT 30   CHECK (pix_expiration_minutes BETWEEN 5 AND 1440),
  auto_suspend_report_threshold   integer NOT NULL DEFAULT 3    CHECK (auto_suspend_report_threshold >= 0), -- 0 = desligado
  whatsapp_verification_required  boolean NOT NULL DEFAULT true,  -- exige código para publicar e ganhar cota
  otp_ttl_minutes                 integer NOT NULL DEFAULT 10   CHECK (otp_ttl_minutes BETWEEN 2 AND 60),
  otp_max_attempts                integer NOT NULL DEFAULT 5    CHECK (otp_max_attempts BETWEEN 1 AND 10),
  otp_resend_cooldown_seconds     integer NOT NULL DEFAULT 60   CHECK (otp_resend_cooldown_seconds >= 0),
  otp_max_per_number_per_hour     integer NOT NULL DEFAULT 5    CHECK (otp_max_per_number_per_hour >= 1),
  updated_at                     timestamptz NOT NULL DEFAULT now(),
  updated_by                      uuid REFERENCES users(id)
);

-- 2.5b Verificação de WhatsApp (anti-abuso da cota grátis) ----------------
-- Códigos de uso único; guardamos só o hash bcrypt, nunca o código.
CREATE TABLE whatsapp_verifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  whatsapp      varchar(13) NOT NULL,           -- número para o qual o código foi enviado
  code_hash     text        NOT NULL,
  attempts      integer     NOT NULL DEFAULT 0,
  expires_at    timestamptz NOT NULL,
  consumed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX whatsapp_verifications_company_idx ON whatsapp_verifications (company_id, created_at DESC);
CREATE INDEX whatsapp_verifications_number_idx  ON whatsapp_verifications (whatsapp, created_at DESC);

-- Cada número (forma canônica) libera a cota grátis UMA única vez, para sempre.
CREATE TABLE whatsapp_quota_claims (
  whatsapp_canonical  varchar(13) PRIMARY KEY,
  company_id          uuid        NOT NULL REFERENCES companies(id),
  quota_granted       integer     NOT NULL,
  claimed_at          timestamptz NOT NULL DEFAULT now()
);

-- 2.6 Vagas ---------------------------------------------------------------
CREATE TABLE jobs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid            NOT NULL REFERENCES companies(id),
  city_id             integer         NOT NULL REFERENCES cities(id),
  category_id         smallint        NOT NULL REFERENCES categories(id),
  slug                text            NOT NULL UNIQUE,      -- titulo-curto-ab12cd
  title               text            NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  description         text            NOT NULL CHECK (char_length(description) <= 8000),
  requirements        text,
  benefits            text,
  neighborhood        text,
  work_model          work_model      NOT NULL DEFAULT 'ONSITE',
  employment_type     employment_type NOT NULL DEFAULT 'CLT',
  openings            smallint        NOT NULL DEFAULT 1 CHECK (openings > 0),
  salary_min_cents    integer         CHECK (salary_min_cents >= 0),
  salary_max_cents    integer,
  salary_visible      boolean         NOT NULL DEFAULT true,
  apply_channel       apply_channel   NOT NULL,
  apply_whatsapp      varchar(13)     CHECK (apply_whatsapp ~ '^55[0-9]{10,11}$'),
  apply_email         citext,
  apply_url           text            CHECK (apply_url ~* '^https://'),
  status              job_status      NOT NULL DEFAULT 'DRAFT',
  billing_type        job_billing,
  suspended_reason    text,
  published_at        timestamptz,
  expires_at          timestamptz,
  closed_at           timestamptz,
  views_count         integer NOT NULL DEFAULT 0,
  apply_clicks_count  integer NOT NULL DEFAULT 0,
  reports_count       integer NOT NULL DEFAULT 0,
  search_vector       tsvector,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT jobs_salary_range CHECK (salary_max_cents IS NULL OR salary_min_cents IS NULL OR salary_max_cents >= salary_min_cents),
  CONSTRAINT jobs_apply_channel_filled CHECK (
       (apply_channel = 'WHATSAPP' AND apply_whatsapp IS NOT NULL)
    OR (apply_channel = 'EMAIL'    AND apply_email    IS NOT NULL)
    OR (apply_channel = 'URL'      AND apply_url      IS NOT NULL)
  ),
  CONSTRAINT jobs_published_has_dates CHECK (
    status NOT IN ('PUBLISHED', 'EXPIRED') OR (published_at IS NOT NULL AND expires_at IS NOT NULL AND billing_type IS NOT NULL)
  )
);
-- Vitrine pública: filtros mais comuns só sobre vagas no ar
CREATE INDEX jobs_public_city_idx     ON jobs (city_id, published_at DESC)     WHERE status = 'PUBLISHED';
CREATE INDEX jobs_public_category_idx ON jobs (category_id, published_at DESC) WHERE status = 'PUBLISHED';
CREATE INDEX jobs_public_model_idx    ON jobs (work_model, published_at DESC)  WHERE status = 'PUBLISHED';
CREATE INDEX jobs_search_idx          ON jobs USING gin (search_vector);
CREATE INDEX jobs_title_trgm_idx      ON jobs USING gin (title gin_trgm_ops);
CREATE INDEX jobs_company_idx         ON jobs (company_id, created_at DESC);
CREATE INDEX jobs_expiring_idx        ON jobs (expires_at) WHERE status = 'PUBLISHED';

-- 2.7 Pagamentos PIX ----------------------------------------------------
CREATE TABLE payments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           uuid           NOT NULL REFERENCES companies(id),
  job_id               uuid           NOT NULL REFERENCES jobs(id),
  provider             text           NOT NULL,                -- 'efi' | 'mercadopago' | 'asaas'
  -- txid gerado por nós (regra Bacen: 26–35 alfanuméricos) e enviado ao PSP
  txid                 varchar(35)    NOT NULL UNIQUE
                         DEFAULT replace(gen_random_uuid()::text, '-', '')
                         CHECK (txid ~ '^[a-zA-Z0-9]{26,35}$'),
  provider_payment_id  text,                                   -- id da cobrança no PSP
  end_to_end_id        text           UNIQUE,                  -- E2E do PIX recebido
  amount_cents         integer        NOT NULL CHECK (amount_cents > 0),
  paid_amount_cents    integer,
  status               payment_status NOT NULL DEFAULT 'PENDING',
  pix_copy_paste       text,                                   -- BR Code "copia e cola"
  qr_code_image        text,                                   -- base64/URL devolvido pelo PSP
  expires_at           timestamptz    NOT NULL,
  paid_at              timestamptz,
  provider_payload     jsonb,
  created_at           timestamptz    NOT NULL DEFAULT now(),
  updated_at           timestamptz    NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_payment_id)
);
-- No máximo UMA cobrança pendente por vaga
CREATE UNIQUE INDEX payments_one_pending_per_job ON payments (job_id) WHERE status = 'PENDING';
CREATE INDEX payments_company_idx ON payments (company_id, created_at DESC);
CREATE INDEX payments_paid_idx    ON payments (paid_at) WHERE status = 'PAID';
CREATE INDEX payments_pending_exp ON payments (expires_at) WHERE status = 'PENDING';

-- 2.8 Eventos de webhook (idempotência + reprocessamento) -----------------
CREATE TABLE webhook_events (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider         text        NOT NULL,
  event_key        text        NOT NULL,   -- id do evento no PSP, ou endToEndId
  payload          jsonb       NOT NULL,
  signature_valid  boolean     NOT NULL,
  received_at      timestamptz NOT NULL DEFAULT now(),
  processed_at     timestamptz,
  result           text,
  attempts         integer     NOT NULL DEFAULT 0,
  last_error       text,
  UNIQUE (provider, event_key)
);
CREATE INDEX webhook_events_unprocessed_idx ON webhook_events (received_at) WHERE processed_at IS NULL;

-- 2.9 Denúncias -----------------------------------------------------------
CREATE TABLE job_reports (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            uuid          NOT NULL REFERENCES jobs(id),
  reason            report_reason NOT NULL,
  details           text          CHECK (char_length(details) <= 2000),
  reporter_user_id  uuid          REFERENCES users(id),
  reporter_contact  text,
  reporter_ip_hash  text,          -- sha256(IP + salt): anti-abuso sem guardar IP cru (LGPD)
  status            report_status NOT NULL DEFAULT 'OPEN',
  resolution_note   text,
  resolved_by       uuid          REFERENCES users(id),
  resolved_at       timestamptz,
  created_at        timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX job_reports_open_idx ON job_reports (created_at) WHERE status = 'OPEN';
CREATE INDEX job_reports_job_idx  ON job_reports (job_id);
-- Mesma origem não denuncia a mesma vaga duas vezes enquanto aberta
CREATE UNIQUE INDEX job_reports_dedupe ON job_reports (job_id, reporter_ip_hash)
  WHERE status = 'OPEN' AND reporter_ip_hash IS NOT NULL;

-- 2.10 Candidatos (cadastro opcional) -------------------------------------
CREATE TABLE candidate_profiles (
  user_id     uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name   text,
  whatsapp    varchar(13),
  city_id     integer REFERENCES cities(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE saved_jobs (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id      uuid NOT NULL REFERENCES jobs(id)  ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);

CREATE TABLE job_alerts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  region_id     smallint REFERENCES regions(id),
  city_id       integer  REFERENCES cities(id),
  category_id   smallint REFERENCES categories(id),
  work_model    work_model,
  keyword       text,
  channel       text NOT NULL DEFAULT 'EMAIL' CHECK (channel IN ('EMAIL', 'WHATSAPP', 'PUSH')),
  is_active     boolean NOT NULL DEFAULT true,
  last_sent_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX job_alerts_active_idx ON job_alerts (city_id, category_id) WHERE is_active;

-- 2.11 Métricas diárias por vaga -----------------------------------------
CREATE TABLE job_daily_stats (
  job_id        uuid    NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  day           date    NOT NULL,
  views         integer NOT NULL DEFAULT 0,
  apply_clicks  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (job_id, day)
);

-- 2.12 Outbox de notificações (e-mail/WhatsApp enviados por worker) -------
CREATE TABLE notifications_outbox (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind             text          NOT NULL,   -- JOB_PUBLISHED, PAYMENT_CREDITED, JOB_EXPIRED...
  recipient_email  citext,
  company_id       uuid REFERENCES companies(id),
  job_id           uuid REFERENCES jobs(id),
  payload          jsonb         NOT NULL DEFAULT '{}',
  status           outbox_status NOT NULL DEFAULT 'PENDING',
  attempts         integer       NOT NULL DEFAULT 0,
  last_error       text,
  created_at       timestamptz   NOT NULL DEFAULT now(),
  sent_at          timestamptz
);
CREATE INDEX notifications_outbox_pending_idx ON notifications_outbox (created_at) WHERE status = 'PENDING';

-- 2.13 Log de auditoria (append-only) --------------------------------------
CREATE TABLE audit_logs (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at     timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor_user_id   uuid,
  actor_role      text,
  source          text NOT NULL DEFAULT 'db',   -- app | admin | webhook | cron | db
  action          text NOT NULL,                -- INSERT/UPDATE/DELETE ou evento de negócio
  entity_type     text NOT NULL,
  entity_id       text,
  old_data        jsonb,
  new_data        jsonb,
  changed_fields  text[],
  request_id      text,
  ip              inet
);
CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, entity_id, occurred_at DESC);
CREATE INDEX audit_logs_time_idx   ON audit_logs (occurred_at DESC);
CREATE INDEX audit_logs_actor_idx  ON audit_logs (actor_user_id, occurred_at DESC);
CREATE INDEX audit_logs_action_idx ON audit_logs (action, occurred_at DESC);

-- ---------------------------------------------------------------------
-- 3. GATILHOS
-- ---------------------------------------------------------------------

-- 3.1 Contexto de auditoria (chamado pelo backend no início da transação)
CREATE FUNCTION set_audit_context(
  p_actor uuid, p_role text, p_source text DEFAULT 'app',
  p_request_id text DEFAULT NULL, p_ip text DEFAULT NULL
) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('app.actor_id',   coalesce(p_actor::text, ''), true),
         set_config('app.actor_role', coalesce(p_role, ''),        true),
         set_config('app.source',     coalesce(p_source, 'app'),   true),
         set_config('app.request_id', coalesce(p_request_id, ''),  true),
         set_config('app.ip',         coalesce(p_ip, ''),          true);
$$;

-- 3.2 Auditoria imutável
CREATE FUNCTION audit_logs_block_changes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs é somente-inserção: % não permitido', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END $$;

CREATE TRIGGER audit_logs_no_update_delete BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_block_changes();
CREATE TRIGGER audit_logs_no_truncate BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_block_changes();

-- 3.3 Registro de evento de negócio (PAYMENT_CONFIRMED, JOB_PUBLISHED...)
CREATE FUNCTION log_business_event(p_action text, p_entity_type text, p_entity_id text, p_data jsonb DEFAULT NULL)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO audit_logs (actor_user_id, actor_role, source, action, entity_type, entity_id, new_data, request_id, ip)
  VALUES (NULLIF(current_setting('app.actor_id', true), '')::uuid,
          NULLIF(current_setting('app.actor_role', true), ''),
          coalesce(NULLIF(current_setting('app.source', true), ''), 'db'),
          p_action, p_entity_type, p_entity_id, p_data,
          NULLIF(current_setting('app.request_id', true), ''),
          NULLIF(current_setting('app.ip', true), '')::inet);
$$;

-- 3.4 Auditoria genérica de linhas (INSERT/UPDATE/DELETE)
CREATE FUNCTION audit_row_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_old     jsonb;
  v_new     jsonb;
  v_changed text[];
  -- Campos de alta frequência que não geram linha de auditoria
  v_ignore  text[] := ARRAY['updated_at', 'views_count', 'apply_clicks_count', 'reports_count', 'search_vector'];
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN v_old := to_jsonb(OLD) - 'search_vector'; END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN v_new := to_jsonb(NEW) - 'search_vector'; END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT array_agg(k ORDER BY k) INTO v_changed
      FROM jsonb_object_keys(v_new) AS k
     WHERE (v_new -> k) IS DISTINCT FROM (v_old -> k)
       AND NOT (k = ANY (v_ignore));
    IF v_changed IS NULL THEN
      RETURN NULL;  -- só contadores mudaram
    END IF;
  END IF;

  INSERT INTO audit_logs (actor_user_id, actor_role, source, action, entity_type, entity_id,
                          old_data, new_data, changed_fields, request_id, ip)
  VALUES (NULLIF(current_setting('app.actor_id', true), '')::uuid,
          NULLIF(current_setting('app.actor_role', true), ''),
          coalesce(NULLIF(current_setting('app.source', true), ''), 'db'),
          TG_OP, TG_TABLE_NAME, coalesce(v_new ->> 'id', v_old ->> 'id'),
          v_old, v_new, v_changed,
          NULLIF(current_setting('app.request_id', true), ''),
          NULLIF(current_setting('app.ip', true), '')::inet);
  RETURN NULL;
END $$;

-- 3.5 updated_at
CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- 3.6 Vetor de busca (cargo > bairro > descrição), sem acentos
CREATE FUNCTION jobs_update_search_vector() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector :=
       setweight(to_tsvector('portuguese', unaccent(coalesce(NEW.title, ''))),        'A')
    || setweight(to_tsvector('portuguese', unaccent(coalesce(NEW.neighborhood, ''))), 'B')
    || setweight(to_tsvector('portuguese', unaccent(coalesce(NEW.description, ''))),  'C');
  RETURN NEW;
END $$;

-- 3.7 Máquina de estados da vaga
CREATE FUNCTION jobs_guard_status() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
         (OLD.status = 'DRAFT'           AND NEW.status IN ('PENDING_PAYMENT', 'PUBLISHED', 'CLOSED'))
      OR (OLD.status = 'PENDING_PAYMENT' AND NEW.status IN ('PUBLISHED', 'DRAFT', 'CLOSED'))
      OR (OLD.status = 'PUBLISHED'       AND NEW.status IN ('CLOSED', 'EXPIRED', 'SUSPENDED'))
      OR (OLD.status = 'SUSPENDED'       AND NEW.status IN ('PUBLISHED', 'CLOSED'))
      OR (OLD.status = 'EXPIRED'         AND NEW.status IN ('PENDING_PAYMENT', 'PUBLISHED', 'CLOSED'))
    ) THEN
      RAISE EXCEPTION 'Transição de status inválida: % -> %', OLD.status, NEW.status
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.status = 'CLOSED' THEN NEW.closed_at := now(); END IF;
    IF NEW.status <> 'SUSPENDED' THEN NEW.suspended_reason := NULL; END IF;
  END IF;
  RETURN NEW;
END $$;

-- 3.8 Cota gratuita no cadastro da empresa (lida do painel admin)
--     Com verificação de WhatsApp ligada, a empresa nasce com cota 0 e só a
--     recebe em confirm_whatsapp_verification(). Desligada, recebe na hora.
CREATE FUNCTION companies_grant_onboarding_quota() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_free     integer;
  v_required boolean;
BEGIN
  SELECT onboarding_free_jobs, whatsapp_verification_required INTO v_free, v_required FROM platform_settings;
  NEW.whatsapp_verified_at := NULL;   -- verificação só pela função própria
  IF coalesce(v_required, true) THEN
    NEW.free_quota_granted   := 0;
    NEW.free_quota_remaining := 0;
  ELSE
    NEW.free_quota_granted   := coalesce(v_free, 0);
    NEW.free_quota_remaining := coalesce(v_free, 0);
  END IF;
  RETURN NEW;
END $$;

-- 3.8b Trocou o WhatsApp? Precisa verificar de novo (a cota já ganha é mantida).
CREATE FUNCTION companies_reset_whatsapp_verification() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.whatsapp IS DISTINCT FROM OLD.whatsapp THEN
    NEW.whatsapp_verified_at := NULL;
  ELSIF NEW.whatsapp_verified_at IS DISTINCT FROM OLD.whatsapp_verified_at
        AND current_setting('app.otp_ok', true) IS DISTINCT FROM 'on' THEN
    -- Impede marcar "verificado" por UPDATE direto, fora do fluxo do código
    NEW.whatsapp_verified_at := OLD.whatsapp_verified_at;
  END IF;
  RETURN NEW;
END $$;

-- 3.9 Suspender/banir empresa tira todas as vagas do ar
CREATE FUNCTION companies_on_status_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('SUSPENDED', 'BANNED') AND OLD.status = 'ACTIVE' THEN
    UPDATE jobs SET status = 'SUSPENDED', suspended_reason = 'COMPANY_' || NEW.status
     WHERE company_id = NEW.id AND status = 'PUBLISHED';
  END IF;
  RETURN NULL;
END $$;

-- 3.10 Denúncia: contador + desativação cautelar automática
CREATE FUNCTION job_reports_after_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_threshold integer;
  v_open      integer;
BEGIN
  UPDATE jobs SET reports_count = reports_count + 1 WHERE id = NEW.job_id;

  SELECT auto_suspend_report_threshold INTO v_threshold FROM platform_settings;
  IF v_threshold > 0 THEN
    SELECT count(DISTINCT coalesce(reporter_ip_hash, id::text)) INTO v_open
      FROM job_reports WHERE job_id = NEW.job_id AND status = 'OPEN';
    IF v_open >= v_threshold THEN
      UPDATE jobs SET status = 'SUSPENDED', suspended_reason = 'AUTO_REPORTS'
       WHERE id = NEW.job_id AND status = 'PUBLISHED';
      IF FOUND THEN
        PERFORM log_business_event('JOB_AUTO_SUSPENDED', 'jobs', NEW.job_id::text,
                                   jsonb_build_object('open_reports', v_open));
        INSERT INTO notifications_outbox (kind, job_id, payload)
        VALUES ('ADMIN_JOB_AUTO_SUSPENDED', NEW.job_id, jsonb_build_object('open_reports', v_open));
      END IF;
    END IF;
  END IF;
  RETURN NULL;
END $$;

-- Ligação dos gatilhos -----------------------------------------------------
CREATE TRIGGER users_updated_at        BEFORE UPDATE ON users              FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER companies_updated_at    BEFORE UPDATE ON companies          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER jobs_updated_at         BEFORE UPDATE ON jobs               FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER payments_updated_at     BEFORE UPDATE ON payments           FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER settings_updated_at     BEFORE UPDATE ON platform_settings  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER candidates_updated_at   BEFORE UPDATE ON candidate_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER jobs_search_vector BEFORE INSERT OR UPDATE OF title, neighborhood, description ON jobs
  FOR EACH ROW EXECUTE FUNCTION jobs_update_search_vector();
CREATE TRIGGER jobs_status_guard BEFORE UPDATE OF status ON jobs
  FOR EACH ROW EXECUTE FUNCTION jobs_guard_status();

CREATE TRIGGER companies_onboarding_quota BEFORE INSERT ON companies
  FOR EACH ROW EXECUTE FUNCTION companies_grant_onboarding_quota();
CREATE TRIGGER companies_whatsapp_reset BEFORE UPDATE OF whatsapp, whatsapp_verified_at ON companies
  FOR EACH ROW EXECUTE FUNCTION companies_reset_whatsapp_verification();
CREATE TRIGGER companies_status_cascade AFTER UPDATE OF status ON companies
  FOR EACH ROW EXECUTE FUNCTION companies_on_status_change();

CREATE TRIGGER job_reports_on_insert AFTER INSERT ON job_reports
  FOR EACH ROW EXECUTE FUNCTION job_reports_after_insert();

-- Auditoria automática nas tabelas de negócio
CREATE TRIGGER audit_users       AFTER INSERT OR UPDATE OR DELETE ON users             FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_companies   AFTER INSERT OR UPDATE OR DELETE ON companies         FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_jobs        AFTER INSERT OR UPDATE OR DELETE ON jobs              FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_payments    AFTER INSERT OR UPDATE OR DELETE ON payments          FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_settings    AFTER INSERT OR UPDATE OR DELETE ON platform_settings FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_reports     AFTER INSERT OR UPDATE OR DELETE ON job_reports       FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_regions     AFTER INSERT OR UPDATE OR DELETE ON regions           FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_cities      AFTER INSERT OR UPDATE OR DELETE ON cities            FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_categories  AFTER INSERT OR UPDATE OR DELETE ON categories        FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_terms       AFTER INSERT OR UPDATE OR DELETE ON terms_versions    FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_wa_claims   AFTER INSERT OR UPDATE OR DELETE ON whatsapp_quota_claims FOR EACH ROW EXECUTE FUNCTION audit_row_change();
-- whatsapp_verifications não é auditada linha a linha (contém hash do código);
-- os eventos OTP_SENT / OTP_VERIFIED / OTP_FAILED vão para audit_logs via log_business_event.

-- ---------------------------------------------------------------------
-- 4. FUNÇÕES DE NEGÓCIO
-- ---------------------------------------------------------------------

-- 4.1 Coloca a vaga no ar (uso interno)
CREATE FUNCTION _publish_job(p_job_id uuid, p_billing job_billing) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_days  integer;
  v_email citext;
  v_comp  uuid;
BEGIN
  SELECT job_duration_days INTO v_days FROM platform_settings;

  UPDATE jobs
     SET status       = 'PUBLISHED',
         billing_type = p_billing,
         published_at = now(),
         expires_at   = now() + make_interval(days => v_days)
   WHERE id = p_job_id
  RETURNING company_id INTO v_comp;

  SELECT contact_email INTO v_email FROM companies WHERE id = v_comp;

  PERFORM log_business_event('JOB_PUBLISHED', 'jobs', p_job_id::text,
                             jsonb_build_object('billing_type', p_billing));
  INSERT INTO notifications_outbox (kind, recipient_email, company_id, job_id, payload)
  VALUES ('JOB_PUBLISHED', v_email, v_comp, p_job_id, jsonb_build_object('billing_type', p_billing));
END $$;

-- 4.2 Pedido de publicação: cota grátis -> crédito -> preço zero -> PIX
--     Retorna: PUBLISHED_FREE_TIER | PUBLISHED_CREDIT | PUBLISHED_FREE_PRICE | PAYMENT_REQUIRED
CREATE FUNCTION request_job_publication(p_job_id uuid) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_job      jobs%ROWTYPE;
  v_company  companies%ROWTYPE;
  v_price    integer;
BEGIN
  -- Ordem de lock fixa (vaga -> empresa) evita deadlock com o webhook
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'JOB_NOT_FOUND';
  END IF;
  IF v_job.status NOT IN ('DRAFT', 'PENDING_PAYMENT', 'EXPIRED') THEN
    RAISE EXCEPTION 'INVALID_STATUS: %', v_job.status;
  END IF;

  SELECT * INTO v_company FROM companies WHERE id = v_job.company_id FOR UPDATE;
  IF v_company.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'COMPANY_NOT_ACTIVE';
  END IF;

  IF v_company.whatsapp_verified_at IS NULL
     AND (SELECT whatsapp_verification_required FROM platform_settings) THEN
    RAISE EXCEPTION 'WHATSAPP_NOT_VERIFIED';
  END IF;

  SELECT job_price_cents INTO v_price FROM platform_settings;

  IF v_company.free_quota_remaining > 0 THEN
    UPDATE companies SET free_quota_remaining = free_quota_remaining - 1 WHERE id = v_company.id;
    PERFORM _publish_job(p_job_id, 'FREE_TIER');
    RETURN 'PUBLISHED_FREE_TIER';
  ELSIF v_company.paid_credits > 0 THEN
    UPDATE companies SET paid_credits = paid_credits - 1 WHERE id = v_company.id;
    PERFORM _publish_job(p_job_id, 'CREDIT');
    RETURN 'PUBLISHED_CREDIT';
  ELSIF v_price = 0 THEN
    PERFORM _publish_job(p_job_id, 'ADMIN_GRANT');
    RETURN 'PUBLISHED_FREE_PRICE';
  ELSE
    IF v_job.status <> 'PENDING_PAYMENT' THEN
      UPDATE jobs SET status = 'PENDING_PAYMENT' WHERE id = p_job_id;
    END IF;
    RETURN 'PAYMENT_REQUIRED';  -- backend gera a cobrança PIX e grava em payments
  END IF;
END $$;

-- 4.3 Confirmação de pagamento (chamada pelo processador do webhook)
--     Idempotente: reentregas do mesmo PIX retornam ALREADY_PROCESSED.
--     Retorna: JOB_PUBLISHED | CREDITED_TO_COMPANY | ALREADY_PROCESSED |
--              UNKNOWN_TXID | AMOUNT_MISMATCH | IGNORED_REFUNDED
CREATE FUNCTION confirm_pix_payment(
  p_provider          text,
  p_txid              text,
  p_end_to_end_id     text,
  p_paid_amount_cents integer,
  p_paid_at           timestamptz,
  p_payload           jsonb
) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_pay    payments%ROWTYPE;
  v_job    jobs%ROWTYPE;
  v_email  citext;
BEGIN
  SELECT * INTO v_pay FROM payments
   WHERE txid = p_txid AND provider = p_provider
   FOR UPDATE;                                   -- serializa webhooks concorrentes
  IF NOT FOUND THEN
    PERFORM log_business_event('PAYMENT_UNKNOWN_TXID', 'payments', p_txid, p_payload);
    RETURN 'UNKNOWN_TXID';
  END IF;

  IF v_pay.status = 'PAID' THEN
    RETURN 'ALREADY_PROCESSED';
  END IF;
  IF v_pay.status = 'REFUNDED' THEN
    PERFORM log_business_event('PAYMENT_AFTER_REFUND', 'payments', v_pay.id::text, p_payload);
    RETURN 'IGNORED_REFUNDED';
  END IF;
  IF p_paid_amount_cents < v_pay.amount_cents THEN
    PERFORM log_business_event('PAYMENT_AMOUNT_MISMATCH', 'payments', v_pay.id::text,
      jsonb_build_object('expected', v_pay.amount_cents, 'paid', p_paid_amount_cents));
    RETURN 'AMOUNT_MISMATCH';
  END IF;

  -- PENDING, EXPIRED ou CANCELLED: o dinheiro entrou, então honramos.
  UPDATE payments
     SET status            = 'PAID',
         paid_at           = coalesce(p_paid_at, now()),
         paid_amount_cents = p_paid_amount_cents,
         end_to_end_id     = p_end_to_end_id,
         provider_payload  = p_payload
   WHERE id = v_pay.id;
  PERFORM log_business_event('PAYMENT_CONFIRMED', 'payments', v_pay.id::text,
    jsonb_build_object('job_id', v_pay.job_id, 'amount_cents', p_paid_amount_cents, 'e2e', p_end_to_end_id));

  SELECT * INTO v_job FROM jobs WHERE id = v_pay.job_id FOR UPDATE;

  IF v_job.status IN ('PENDING_PAYMENT', 'EXPIRED') THEN
    PERFORM _publish_job(v_job.id, 'PAID');
    RETURN 'JOB_PUBLISHED';
  END IF;

  -- Vaga já não aguarda pagamento (encerrada, publicada por outra via...):
  -- o valor vira crédito para a próxima vaga da empresa.
  UPDATE companies SET paid_credits = paid_credits + 1
   WHERE id = v_pay.company_id
  RETURNING contact_email INTO v_email;
  INSERT INTO notifications_outbox (kind, recipient_email, company_id, job_id, payload)
  VALUES ('PAYMENT_CREDITED', v_email, v_pay.company_id, v_pay.job_id,
          jsonb_build_object('payment_id', v_pay.id));
  RETURN 'CREDITED_TO_COMPANY';
END $$;

-- 4.4 Rotina agendada (pg_cron ou cron da Vercel, a cada 5–15 min)
CREATE FUNCTION run_expirations() RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_jobs     integer;
  v_payments integer;
BEGIN
  PERFORM set_config('app.source', 'cron', true);

  WITH expired AS (
    UPDATE jobs SET status = 'EXPIRED'
     WHERE status = 'PUBLISHED' AND expires_at <= now()
    RETURNING id, company_id
  )
  INSERT INTO notifications_outbox (kind, recipient_email, company_id, job_id)
  SELECT 'JOB_EXPIRED', c.contact_email, e.company_id, e.id
    FROM expired e JOIN companies c ON c.id = e.company_id;
  GET DIAGNOSTICS v_jobs = ROW_COUNT;

  -- Margem de 10 min para PIX pago no último segundo ainda chegar pelo webhook
  UPDATE payments SET status = 'EXPIRED'
   WHERE status = 'PENDING' AND expires_at <= now() - interval '10 minutes';
  GET DIAGNOSTICS v_payments = ROW_COUNT;

  RETURN jsonb_build_object('jobs_expired', v_jobs, 'payments_expired', v_payments);
END $$;

-- 4.5 Moderação de denúncia em 1 clique
CREATE FUNCTION moderate_report(p_report_id uuid, p_action report_status, p_admin_id uuid, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_job_id uuid;
  v_comp   uuid;
  v_email  citext;
BEGIN
  IF p_action = 'OPEN' THEN
    RAISE EXCEPTION 'Ação inválida';
  END IF;

  UPDATE job_reports
     SET status = p_action, resolved_by = p_admin_id, resolved_at = now(), resolution_note = p_note
   WHERE id = p_report_id AND status = 'OPEN'
  RETURNING job_id INTO v_job_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPORT_NOT_OPEN';
  END IF;

  SELECT j.company_id, c.contact_email INTO v_comp, v_email
    FROM jobs j JOIN companies c ON c.id = j.company_id WHERE j.id = v_job_id;

  IF p_action = 'JOB_DEACTIVATED' THEN
    UPDATE jobs SET status = 'SUSPENDED', suspended_reason = 'MODERATION'
     WHERE id = v_job_id AND status = 'PUBLISHED';
    -- Encerra as demais denúncias abertas da mesma vaga
    UPDATE job_reports
       SET status = 'JOB_DEACTIVATED', resolved_by = p_admin_id, resolved_at = now(),
           resolution_note = 'Resolvida junto com ' || p_report_id
     WHERE job_id = v_job_id AND status = 'OPEN';
    INSERT INTO notifications_outbox (kind, recipient_email, company_id, job_id, payload)
    VALUES ('JOB_SUSPENDED_BY_MODERATION', v_email, v_comp, v_job_id, jsonb_build_object('note', p_note));
  ELSIF p_action = 'COMPANY_NOTIFIED' THEN
    INSERT INTO notifications_outbox (kind, recipient_email, company_id, job_id, payload)
    VALUES ('REPORT_NOTICE_TO_COMPANY', v_email, v_comp, v_job_id, jsonb_build_object('note', p_note));
  END IF;
END $$;

-- 4.5b Verificação de WhatsApp por código (OTP) ---------------------------

-- Forma canônica de celular BR para deduplicar: insere o 9º dígito quando
-- falta (55 + DDD + 8 dígitos começando em 6–9), evitando burlar a regra
-- cadastrando o mesmo número com e sem o 9.
CREATE FUNCTION normalize_br_whatsapp(p text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN d ~ '^55[0-9]{2}[6-9][0-9]{7}$' THEN substr(d, 1, 4) || '9' || substr(d, 5)
    ELSE d
  END
  FROM (SELECT regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') AS d) s;
$$;

-- Gera e registra um código. Retorna o código em texto para o backend enviar
-- pela API do WhatsApp (o banco guarda apenas o hash).
-- Erros: COMPANY_NOT_FOUND | ALREADY_VERIFIED | OTP_COOLDOWN:<segundos> | OTP_RATE_LIMIT
CREATE FUNCTION start_whatsapp_verification(p_company_id uuid) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_comp      companies%ROWTYPE;
  v_set       platform_settings%ROWTYPE;
  v_last      timestamptz;
  v_recent    integer;
  v_code      text;
  v_wait      integer;
BEGIN
  SELECT * INTO v_set FROM platform_settings;
  SELECT * INTO v_comp FROM companies WHERE id = p_company_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'COMPANY_NOT_FOUND';
  END IF;
  IF v_comp.whatsapp_verified_at IS NOT NULL THEN
    RAISE EXCEPTION 'ALREADY_VERIFIED';
  END IF;

  -- Intervalo mínimo entre reenvios (por empresa)
  SELECT max(created_at) INTO v_last FROM whatsapp_verifications WHERE company_id = p_company_id;
  IF v_last IS NOT NULL AND v_last > now() - make_interval(secs => v_set.otp_resend_cooldown_seconds) THEN
    v_wait := ceil(extract(epoch FROM v_last + make_interval(secs => v_set.otp_resend_cooldown_seconds) - now()));
    RAISE EXCEPTION 'OTP_COOLDOWN:%', v_wait;
  END IF;

  -- Limite por número/hora (protege o custo de envio e contra flood)
  SELECT count(*) INTO v_recent FROM whatsapp_verifications
   WHERE whatsapp = v_comp.whatsapp AND created_at > now() - interval '1 hour';
  IF v_recent >= v_set.otp_max_per_number_per_hour THEN
    RAISE EXCEPTION 'OTP_RATE_LIMIT';
  END IF;

  -- Invalida códigos anteriores ainda abertos
  UPDATE whatsapp_verifications SET consumed_at = now()
   WHERE company_id = p_company_id AND consumed_at IS NULL;

  -- 6 dígitos com gerador criptográfico
  v_code := lpad(((('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');

  INSERT INTO whatsapp_verifications (company_id, whatsapp, code_hash, expires_at)
  VALUES (p_company_id, v_comp.whatsapp, crypt(v_code, gen_salt('bf', 8)),
          now() + make_interval(mins => v_set.otp_ttl_minutes));

  PERFORM log_business_event('OTP_SENT', 'companies', p_company_id::text,
                             jsonb_build_object('whatsapp', v_comp.whatsapp));
  RETURN v_code;
END $$;

-- Confere o código. Nunca lança erro em código errado (para não desfazer a
-- contagem de tentativas); retorna:
--   VERIFIED_QUOTA_GRANTED  -> verificado e cota grátis liberada
--   VERIFIED_NO_QUOTA       -> verificado, mas este número já usou a cota
--   INVALID_CODE | EXPIRED | TOO_MANY_ATTEMPTS | NO_PENDING_CODE | NUMBER_CHANGED
CREATE FUNCTION confirm_whatsapp_verification(p_company_id uuid, p_code text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_set    platform_settings%ROWTYPE;
  v_comp   companies%ROWTYPE;
  v_ver    whatsapp_verifications%ROWTYPE;
  v_canon  text;
  v_claim  integer;
BEGIN
  SELECT * INTO v_set FROM platform_settings;
  SELECT * INTO v_comp FROM companies WHERE id = p_company_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'NO_PENDING_CODE';
  END IF;

  SELECT * INTO v_ver FROM whatsapp_verifications
   WHERE company_id = p_company_id AND consumed_at IS NULL
   ORDER BY created_at DESC LIMIT 1
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'NO_PENDING_CODE';
  END IF;

  IF v_ver.whatsapp <> v_comp.whatsapp THEN
    UPDATE whatsapp_verifications SET consumed_at = now() WHERE id = v_ver.id;
    RETURN 'NUMBER_CHANGED';
  END IF;
  IF v_ver.expires_at <= now() THEN
    UPDATE whatsapp_verifications SET consumed_at = now() WHERE id = v_ver.id;
    RETURN 'EXPIRED';
  END IF;
  IF v_ver.attempts >= v_set.otp_max_attempts THEN
    UPDATE whatsapp_verifications SET consumed_at = now() WHERE id = v_ver.id;
    RETURN 'TOO_MANY_ATTEMPTS';
  END IF;

  IF crypt(coalesce(p_code, ''), v_ver.code_hash) <> v_ver.code_hash THEN
    UPDATE whatsapp_verifications SET attempts = attempts + 1 WHERE id = v_ver.id;
    PERFORM log_business_event('OTP_FAILED', 'companies', p_company_id::text,
                               jsonb_build_object('attempt', v_ver.attempts + 1));
    IF v_ver.attempts + 1 >= v_set.otp_max_attempts THEN
      UPDATE whatsapp_verifications SET consumed_at = now() WHERE id = v_ver.id;
      RETURN 'TOO_MANY_ATTEMPTS';
    END IF;
    RETURN 'INVALID_CODE';
  END IF;

  -- Código correto
  UPDATE whatsapp_verifications SET consumed_at = now() WHERE id = v_ver.id;
  PERFORM set_config('app.otp_ok', 'on', true);
  UPDATE companies SET whatsapp_verified_at = now() WHERE id = p_company_id;
  PERFORM set_config('app.otp_ok', 'off', true);

  -- Cota grátis: só se a empresa ainda não recebeu e o número nunca foi usado
  v_canon := normalize_br_whatsapp(v_comp.whatsapp);
  IF v_comp.free_quota_granted = 0 AND v_set.onboarding_free_jobs > 0 THEN
    INSERT INTO whatsapp_quota_claims (whatsapp_canonical, company_id, quota_granted)
    VALUES (v_canon, p_company_id, v_set.onboarding_free_jobs)
    ON CONFLICT (whatsapp_canonical) DO NOTHING;
    GET DIAGNOSTICS v_claim = ROW_COUNT;

    IF v_claim = 1 THEN
      UPDATE companies
         SET free_quota_granted   = v_set.onboarding_free_jobs,
             free_quota_remaining = free_quota_remaining + v_set.onboarding_free_jobs
       WHERE id = p_company_id;
      PERFORM log_business_event('OTP_VERIFIED', 'companies', p_company_id::text,
                                 jsonb_build_object('quota_granted', v_set.onboarding_free_jobs));
      RETURN 'VERIFIED_QUOTA_GRANTED';
    END IF;
  END IF;

  PERFORM log_business_event('OTP_VERIFIED', 'companies', p_company_id::text,
                             jsonb_build_object('quota_granted', 0, 'reason', 'NUMBER_ALREADY_CLAIMED_OR_GRANTED'));
  RETURN 'VERIFIED_NO_QUOTA';
END $$;

-- 4.6 Visualização / clique em "Candidatar-se"
CREATE FUNCTION track_job_event(p_job_id uuid, p_kind text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_day date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF p_kind = 'VIEW' THEN
    UPDATE jobs SET views_count = views_count + 1 WHERE id = p_job_id AND status = 'PUBLISHED';
    IF FOUND THEN
      INSERT INTO job_daily_stats (job_id, day, views) VALUES (p_job_id, v_day, 1)
      ON CONFLICT (job_id, day) DO UPDATE SET views = job_daily_stats.views + 1;
    END IF;
  ELSIF p_kind = 'APPLY_CLICK' THEN
    UPDATE jobs SET apply_clicks_count = apply_clicks_count + 1 WHERE id = p_job_id AND status = 'PUBLISHED';
    IF FOUND THEN
      INSERT INTO job_daily_stats (job_id, day, apply_clicks) VALUES (p_job_id, v_day, 1)
      ON CONFLICT (job_id, day) DO UPDATE SET apply_clicks = job_daily_stats.apply_clicks + 1;
    END IF;
  ELSE
    RAISE EXCEPTION 'Tipo de evento inválido: %', p_kind;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 5. VIEWS, SEGURANÇA E SEEDS
-- ---------------------------------------------------------------------

-- 5.1 Vitrine pública (somente vagas no ar, em cidades/regiões ativas)
CREATE VIEW v_public_jobs AS
SELECT j.id, j.slug, j.title, j.description, j.requirements, j.benefits,
       j.neighborhood, j.work_model, j.employment_type, j.openings,
       CASE WHEN j.salary_visible THEN j.salary_min_cents END AS salary_min_cents,
       CASE WHEN j.salary_visible THEN j.salary_max_cents END AS salary_max_cents,
       j.apply_channel, j.apply_whatsapp, j.apply_email, j.apply_url,
       j.published_at, j.expires_at, j.search_vector,
       c.id   AS city_id,   c.name AS city_name, c.slug AS city_slug, c.state,
       r.id   AS region_id, r.slug AS region_slug,
       cat.id AS category_id, cat.name AS category_name, cat.slug AS category_slug,
       coalesce(co.trade_name, co.legal_name) AS company_name, co.logo_url
  FROM jobs j
  JOIN cities     c   ON c.id   = j.city_id     AND c.is_active
  JOIN regions    r   ON r.id   = c.region_id   AND r.is_active
  JOIN categories cat ON cat.id = j.category_id
  JOIN companies  co  ON co.id  = j.company_id  AND co.status = 'ACTIVE'
 WHERE j.status = 'PUBLISHED' AND j.expires_at > now();

-- 5.2 Métricas do painel admin
CREATE VIEW v_admin_metrics AS
SELECT
  (SELECT count(*) FROM jobs WHERE status = 'PUBLISHED')                   AS jobs_active,
  (SELECT count(*) FROM jobs WHERE status IN ('CLOSED', 'EXPIRED'))        AS jobs_ended,
  (SELECT count(*) FROM jobs WHERE status = 'PENDING_PAYMENT')             AS jobs_pending_payment,
  (SELECT count(*) FROM jobs WHERE status = 'SUSPENDED')                   AS jobs_suspended,
  (SELECT count(*) FROM companies)                                         AS companies_total,
  (SELECT count(*) FROM users WHERE role = 'CANDIDATE')                    AS candidates_total,
  (SELECT count(*) FROM job_reports WHERE status = 'OPEN')                 AS reports_open,
  (SELECT round(100.0 * count(DISTINCT r.job_id)
                / NULLIF((SELECT count(*) FROM jobs WHERE published_at IS NOT NULL), 0), 2)
     FROM job_reports r)                                                   AS reported_jobs_pct,
  (SELECT coalesce(sum(paid_amount_cents), 0) FROM payments WHERE status = 'PAID') AS revenue_total_cents,
  (SELECT coalesce(sum(paid_amount_cents), 0) FROM payments
    WHERE status = 'PAID'
      AND paid_at >= (date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo'))
                                                                           AS revenue_today_cents,
  (SELECT coalesce(sum(paid_amount_cents), 0) FROM payments
    WHERE status = 'PAID'
      AND paid_at >= (date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo'))
                                                                           AS revenue_month_cents;

-- 5.3 Segurança: todo acesso passa pelo backend (Server Actions / API).
--     RLS ligado sem políticas = nega tudo para papéis públicos
--     (anon/authenticated do Supabase). O dono das tabelas e o
--     service_role continuam com acesso.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'regions', 'cities', 'categories', 'users', 'companies', 'terms_versions',
    'terms_acceptances', 'platform_settings', 'jobs', 'payments', 'webhook_events',
    'job_reports', 'candidate_profiles', 'saved_jobs', 'job_alerts',
    'job_daily_stats', 'notifications_outbox', 'audit_logs',
    'whatsapp_verifications', 'whatsapp_quota_claims'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated';
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION _publish_job(uuid, job_billing), request_job_publication(uuid),
  confirm_pix_payment(text, text, text, integer, timestamptz, jsonb), run_expirations(),
  moderate_report(uuid, report_status, uuid, text), track_job_event(uuid, text),
  start_whatsapp_verification(uuid), confirm_whatsapp_verification(uuid, text)
FROM PUBLIC;

-- 5.4 Seeds
INSERT INTO platform_settings DEFAULT VALUES;

INSERT INTO categories (name, slug, sort_order) VALUES
  ('Administrativo',          'administrativo',     1),
  ('Comércio e Vendas',       'comercio-vendas',    2),
  ('Alimentação',             'alimentacao',        3),
  ('Construção Civil',        'construcao-civil',   4),
  ('Indústria e Produção',    'industria-producao', 5),
  ('Logística e Transporte',  'logistica',          6),
  ('Saúde',                   'saude',              7),
  ('Educação',                'educacao',           8),
  ('Tecnologia',              'tecnologia',         9),
  ('Turismo e Hotelaria',     'turismo-hotelaria',  10),
  ('Serviços Gerais',         'servicos-gerais',    11),
  ('Outros',                  'outros',             99);

INSERT INTO terms_versions (version, audience, is_current, content_md) VALUES (
  '1.0', 'ALL', true,
$terms$## Cláusula de Natureza do Serviço e Isenção de Responsabilidade

1. **Natureza Jurídica:** A Plataforma atua única e exclusivamente como meio de veiculação e publicidade de oportunidades de trabalho, funcionando sob a modalidade de classificados eletrônicos. A Plataforma não é agência de emprego, não atua como intermediadora de mão de obra e não integra nenhuma relação de trabalho ou prestação de serviços entre as partes.

2. **Responsabilidade do Anunciante:** A empresa ou contratante anunciante é a única e exclusiva responsável pela veracidade, legalidade, exatidão das informações divulgadas, bem como pelo cumprimento integral da legislação trabalhista (CLT), previdenciária e civil aplicável. É terminantemente proibida a cobrança de qualquer taxa do candidato para participação em processos seletivos.

3. **Isenção Total da Plataforma:** A Plataforma e seus administradores não possuem ingerência, fiscalização prévia obrigatória ou vínculo sobre os processos seletivos, entrevistas, contratações, promessas de remuneração, condições de trabalho ou condutas das empresas ou dos candidatos. A responsabilidade da Plataforma limita-se estritamente à disponibilidade técnica do anúncio no ar durante o período contratado.

4. **Obrigação de Atualização e Denúncias:** É dever da empresa anunciante remover ou pausar a vaga no painel assim que preenchida. Caso candidatos constatem vagas inexistentes, preenchidas, enganosas ou discriminatórias, deverão utilizar a ferramenta de denúncia no anúncio para que a administração da Plataforma adote as medidas de desativação cautelar e eventual banimento do anunciante.
$terms$);

-- Exemplo de região (descomente e ajuste para a sua):
-- INSERT INTO regions (name, slug, state, is_active, launched_at) VALUES ('Minha Região', 'minha-regiao', 'SC', true, now());
-- INSERT INTO cities (region_id, ibge_code, name, slug, state, is_active) VALUES (1, 0000000, 'Cidade', 'cidade', 'SC', true);

-- Agendamento (Supabase/pg_cron):
-- SELECT cron.schedule('expirations', '*/10 * * * *', $$SELECT run_expirations()$$);

COMMIT;
