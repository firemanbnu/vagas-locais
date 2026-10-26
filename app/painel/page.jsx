import Link from 'next/link';
import { sql } from '@/lib/db';
import { requireCompany } from '@/lib/auth';
import { JOB_STATUS, dateBR, formatWhatsapp, brl } from '@/lib/format';
import { closeJob, publishJob } from '@/app/actions/company';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Meu painel — Vagas Locais' };

const OK = {
  verificado_cota: 'WhatsApp confirmado! Suas vagas grátis foram liberadas.',
  verificado_sem_cota: 'WhatsApp confirmado. Este número já usou a cota grátis antes, então as próximas vagas são pagas.',
  publicada_gratis: 'Vaga publicada usando sua cota grátis.',
  publicada: 'Vaga publicada.',
  paga: 'Pagamento confirmado e vaga publicada!',
  rascunho: 'Rascunho salvo.',
  encerrada: 'Vaga encerrada e removida da vitrine.',
};

const TAG = { PUBLISHED: 'tag', PENDING_PAYMENT: 'tag warn', DRAFT: 'tag gray', CLOSED: 'tag gray', EXPIRED: 'tag gray', SUSPENDED: 'tag red' };

export default async function Painel({ searchParams }) {
  const s = await requireCompany();
  const sp = await searchParams;
  const [[c], jobs, [st]] = await Promise.all([
    sql`SELECT * FROM companies WHERE id = ${s.cid}`,
    sql`SELECT j.*, ci.name AS city_name FROM jobs j JOIN cities ci ON ci.id = j.city_id
         WHERE j.company_id = ${s.cid} ORDER BY j.created_at DESC`,
    sql`SELECT job_price_cents, whatsapp_verification_required FROM platform_settings`,
  ]);

  const needsVerify = !c.whatsapp_verified_at && st.whatsapp_verification_required;
  const active = jobs.filter((j) => j.status === 'PUBLISHED').length;

  return (
    <div className="container section">
      <div className="page-head">
        <div>
          <h1>{c.trade_name || c.legal_name}</h1>
          <p className="hint" style={{ margin: 0 }}>
            WhatsApp {formatWhatsapp(c.whatsapp)} {c.whatsapp_verified_at ? '· ✅ verificado' : '· não verificado'}
          </p>
        </div>
        <Link href="/painel/vagas/nova" className="btn">+ Nova vaga</Link>
      </div>

      {sp.ok && OK[sp.ok] && <div className="alert ok">{OK[sp.ok]}</div>}
      {sp.erro && <div className="alert err">{sp.erro}</div>}
      {c.status !== 'ACTIVE' && <div className="alert err">Sua conta está {c.status === 'BANNED' ? 'banida' : 'suspensa'}. {c.status_reason}</div>}
      {needsVerify && (
        <div className="alert warn">
          Confirme seu WhatsApp para publicar vagas e liberar sua cota grátis.{' '}
          <Link href="/painel/verificar-whatsapp"><strong>Verificar agora →</strong></Link>
        </div>
      )}

      <div className="stats" style={{ marginBottom: 20 }}>
        <div className="card stat"><div className="n">{active}</div><div className="l">Vagas ativas</div></div>
        <div className="card stat"><div className="n">{c.free_quota_remaining}</div><div className="l">Vagas grátis restantes</div></div>
        <div className="card stat"><div className="n">{c.paid_credits}</div><div className="l">Créditos pagos</div></div>
        <div className="card stat"><div className="n">{brl(st.job_price_cents)}</div><div className="l">Preço por vaga</div></div>
      </div>

      <h2>Minhas vagas</h2>
      {jobs.length === 0 ? (
        <div className="card empty">
          Você ainda não publicou vagas. <Link href="/painel/vagas/nova">Publicar a primeira</Link>
        </div>
      ) : (
        <div className="stack">
          {jobs.map((j) => (
            <div key={j.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ marginBottom: 4 }}>
                    {j.status === 'PUBLISHED' ? <Link href={`/vaga/${j.slug}`}>{j.title}</Link> : j.title}
                  </h3>
                  <div className="meta">
                    <span className={TAG[j.status]}>{JOB_STATUS[j.status]}</span>
                    <span>📍 {j.city_name}</span>
                    {j.published_at && <span>Publicada {dateBR(j.published_at)}</span>}
                    {j.status === 'PUBLISHED' && <span>Expira {dateBR(j.expires_at)}</span>}
                    {j.billing_type === 'FREE_TIER' && <span>Cota grátis</span>}
                  </div>
                  <div className="meta" style={{ marginTop: 6 }}>
                    <span>👁 {j.views_count} visualizações</span>
                    <span>👆 {j.apply_clicks_count} cliques em candidatar</span>
                  </div>
                  {j.status === 'SUSPENDED' && (
                    <p className="hint" style={{ marginTop: 6 }}>Suspensa pela moderação ({j.suspended_reason}).</p>
                  )}
                </div>
                <div className="actions" style={{ alignItems: 'flex-start' }}>
                  {j.status === 'PENDING_PAYMENT' && (
                    <Link className="btn small" href={`/painel/vagas/${j.id}/pagamento`}>Pagar com PIX</Link>
                  )}
                  {['DRAFT', 'EXPIRED'].includes(j.status) && (
                    <form action={publishJob} className="inline">
                      <input type="hidden" name="job_id" value={j.id} />
                      <button className="btn small" type="submit">{j.status === 'EXPIRED' ? 'Republicar' : 'Publicar'}</button>
                    </form>
                  )}
                  {j.status !== 'CLOSED' && (
                    <form action={closeJob} className="inline">
                      <input type="hidden" name="job_id" value={j.id} />
                      <button className="btn small secondary" type="submit">
                        {j.status === 'PUBLISHED' ? 'Vaga preenchida / Encerrar' : 'Encerrar'}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
