import { sql } from '@/lib/db';
import { dateBR, formatWhatsapp } from '@/lib/format';
import { setCompanyStatus } from '@/app/actions/admin';

export const dynamic = 'force-dynamic';

const STATUS = { ACTIVE: 'Ativa', SUSPENDED: 'Suspensa', BANNED: 'Banida' };

export default async function AdminEmpresas({ searchParams }) {
  const sp = await searchParams;
  const rows = await sql`
    SELECT c.*, ci.name AS city,
           (SELECT count(*) FROM jobs j WHERE j.company_id = c.id) AS jobs_total,
           (SELECT count(*) FROM jobs j WHERE j.company_id = c.id AND j.status = 'PUBLISHED') AS jobs_active
      FROM companies c LEFT JOIN cities ci ON ci.id = c.city_id
     ORDER BY c.created_at DESC LIMIT 300`;
  return (
    <div className="section" style={{ paddingTop: 0 }}>
      {sp.ok && <div className="alert ok">Empresa atualizada.</div>}
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Empresa</th><th>Contato</th><th>Vagas</th><th>Cota</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>
                  <strong>{c.trade_name || c.legal_name}</strong>
                  <div className="hint">{c.cnpj ? `CNPJ ${c.cnpj}` : 'Sem CNPJ'} · {c.city || '—'} · desde {dateBR(c.created_at)}</div>
                </td>
                <td>
                  {formatWhatsapp(c.whatsapp)} {c.whatsapp_verified_at ? '✅' : '⏳'}
                  <div className="hint">{c.contact_email}</div>
                </td>
                <td>{String(c.jobs_active)} ativas / {String(c.jobs_total)}</td>
                <td>{c.free_quota_remaining} de {c.free_quota_granted} grátis · {c.paid_credits} créditos</td>
                <td>{STATUS[c.status]}{c.status_reason ? <div className="hint">{c.status_reason}</div> : null}</td>
                <td>
                  <form action={setCompanyStatus} className="stack" style={{ minWidth: 180 }}>
                    <input type="hidden" name="company_id" value={c.id} />
                    {c.status === 'ACTIVE' ? (
                      <>
                        <input name="reason" placeholder="Motivo" />
                        <div className="actions">
                          <button className="btn small secondary" name="status" value="SUSPENDED">Suspender</button>
                          <button className="btn small danger" name="status" value="BANNED">Banir</button>
                        </div>
                      </>
                    ) : (
                      <button className="btn small" name="status" value="ACTIVE">Reativar conta</button>
                    )}
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint" style={{ marginTop: 10 }}>Suspender ou banir tira imediatamente todas as vagas ativas da empresa do ar.</p>
    </div>
  );
}
