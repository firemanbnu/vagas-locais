-- Exclusão de vagas (admin e empresa)
--  * Só exclui de verdade vagas SEM pagamento e SEM denúncia (histórico financeiro e de moderação fica preservado).
--  * Vagas com histórico devem apenas ser encerradas.
--  * A exclusão fica registrada na auditoria (gatilho audit_jobs, com old_data da vaga).
--  * Registros de aceite anônimo e da fila de notificações são mantidos, apenas desvinculados da vaga.
BEGIN;

CREATE OR REPLACE FUNCTION delete_job(p_job_id uuid, p_company_id uuid DEFAULT NULL, p_is_admin boolean DEFAULT false)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_status job_status;
BEGIN
  SELECT status INTO v_status FROM jobs
   WHERE id = p_job_id AND (p_is_admin OR company_id = p_company_id)
   FOR UPDATE;
  IF NOT FOUND THEN RETURN 'NOT_FOUND'; END IF;

  -- Vaga suspensa pela moderação não pode ser apagada pela própria empresa
  IF v_status = 'SUSPENDED' AND NOT p_is_admin THEN RETURN 'SUSPENDED'; END IF;

  IF EXISTS (SELECT 1 FROM payments WHERE job_id = p_job_id)
     OR EXISTS (SELECT 1 FROM job_reports WHERE job_id = p_job_id) THEN
    RETURN 'HAS_HISTORY';
  END IF;

  UPDATE anonymous_terms_acceptances SET job_id = NULL WHERE job_id = p_job_id;
  UPDATE notifications_outbox        SET job_id = NULL WHERE job_id = p_job_id;
  DELETE FROM jobs WHERE id = p_job_id;
  RETURN 'DELETED';
END $$;

COMMIT;
