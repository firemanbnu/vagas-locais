import { sql } from '@/lib/db';
import { dateTimeBR } from '@/lib/format';
import { saveSettings } from '@/app/actions/admin';

export const dynamic = 'force-dynamic';

export default async function Configuracoes({ searchParams }) {
  const sp = await searchParams;
  const [s] = await sql`SELECT * FROM platform_settings`;
  const price = (s.job_price_cents / 100).toFixed(2).replace('.', ',');
  return (
    <div className="section narrow" style={{ paddingTop: 0 }}>
      {sp.ok && <div className="alert ok">Configurações salvas. A alteração ficou registrada na auditoria.</div>}
      {sp.erro && <div className="alert err">{sp.erro}</div>}
      <form action={saveSettings} className="card">
        <h3>Cobrança</h3>
        <div className="row two">
          <div className="field">
            <label htmlFor="job_price">Valor do anúncio (R$)</label>
            <input id="job_price" name="job_price" inputMode="decimal" defaultValue={price} />
            <span className="hint">0 = publicação gratuita para todos.</span>
          </div>
          <div className="field">
            <label htmlFor="onboarding_free_jobs">Vagas grátis por novo cadastro</label>
            <input id="onboarding_free_jobs" name="onboarding_free_jobs" type="number" min={0} defaultValue={s.onboarding_free_jobs} />
          </div>
        </div>
        <div className="row two">
          <div className="field">
            <label htmlFor="job_duration_days">Validade da vaga (dias)</label>
            <input id="job_duration_days" name="job_duration_days" type="number" min={1} max={365} defaultValue={s.job_duration_days} />
          </div>
          <div className="field">
            <label htmlFor="pix_expiration_minutes">Expiração do PIX (minutos)</label>
            <input id="pix_expiration_minutes" name="pix_expiration_minutes" type="number" min={5} max={1440} defaultValue={s.pix_expiration_minutes} />
          </div>
        </div>
        <h3 style={{ marginTop: 10 }}>Moderação e verificação</h3>
        <div className="field">
          <label htmlFor="auto_suspend_report_threshold">Suspender vaga automaticamente após N denúncias</label>
          <input id="auto_suspend_report_threshold" name="auto_suspend_report_threshold" type="number" min={0} defaultValue={s.auto_suspend_report_threshold} />
          <span className="hint">0 = desligado.</span>
        </div>
        <div className="field">
          <label className="check">
            <input type="checkbox" name="whatsapp_verification_required" defaultChecked={s.whatsapp_verification_required} />
            <span>Exigir confirmação do WhatsApp para publicar e liberar a cota grátis</span>
          </label>
        </div>
        <div className="row two">
          <div className="field">
            <label htmlFor="otp_ttl_minutes">Validade do código (min)</label>
            <input id="otp_ttl_minutes" name="otp_ttl_minutes" type="number" min={2} max={60} defaultValue={s.otp_ttl_minutes} />
          </div>
          <div className="field">
            <label htmlFor="otp_max_attempts">Tentativas por código</label>
            <input id="otp_max_attempts" name="otp_max_attempts" type="number" min={1} max={10} defaultValue={s.otp_max_attempts} />
          </div>
        </div>
        <button className="btn" type="submit">Salvar</button>
        <p className="hint" style={{ marginTop: 10 }}>Última alteração: {dateTimeBR(s.updated_at)}</p>
      </form>
    </div>
  );
}
