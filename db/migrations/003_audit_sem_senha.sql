-- Auditoria nunca guarda o hash da senha (só registra que o campo mudou)
BEGIN;

CREATE OR REPLACE FUNCTION audit_row_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_old     jsonb;
  v_new     jsonb;
  v_changed text[];
  v_ignore  text[] := ARRAY['updated_at', 'views_count', 'apply_clicks_count', 'reports_count', 'search_vector', 'last_login_at'];
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN v_old := to_jsonb(OLD) - 'search_vector'; END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN v_new := to_jsonb(NEW) - 'search_vector'; END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT array_agg(k ORDER BY k) INTO v_changed
      FROM jsonb_object_keys(v_new) AS k
     WHERE (v_new -> k) IS DISTINCT FROM (v_old -> k)
       AND NOT (k = ANY (v_ignore));
    IF v_changed IS NULL THEN
      RETURN NULL;
    END IF;
  END IF;

  -- Remove segredos depois de calcular quais campos mudaram
  v_old := v_old - 'password_hash';
  v_new := v_new - 'password_hash';

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

COMMIT;
