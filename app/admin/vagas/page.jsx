import Link from 'next/link';
import { sql } from '@/lib/db';
import { JOB_STATUS, dateBR } from '@/lib/format';
import { setJobStatus } from '@/app/actions/admin';

export const dynamic = 'force-dynamic';

export default async function AdminVagas({ searchParams }) {
  const sp = await searchParams;
  const status = Object.keys(JOB_STATUS).includes(sp.status) ? sp.status : null;
  const rows = await sql`
    SELECT j.id, j.slug, j.title, j.status, j.billing_type, j.published_at, j.views_count, j.apply_clicks_count,
           j.reports_count, ci.name AS city, coalesce(c.trade_name, c.legal_name) AS company
      FROM jobs j JOIN companies c ON c.id = j.company_id JOIN cities ci ON ci.id = j.city_id
     WHERE (${status}::text IS NULL OR j.status::text = ${status}::text)
     ORDER BY j.created_at DESC LIMIT 200`;
  return (
    <div className="section" style={{ paddingTop: 0 }}>
      {sp.ok && <div className="alert ok">Status atualizado.</div>}
      {sp.erro && <div className="alert err">{sp.erro}</div>}
      <div className="subnav">
        <Link href="/admin/vagas" className={!status ? 'on' : ''}>Todas</Link>
        {Object.entries(JOB_STATUS).map(([k, v]) => (
          <Link key={k} href={`/admin/vagas?status=${k}`} className={status === k ? 'on' : ''}>{v}</Link>
        ))}
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Vaga</th><th>Empresa</th><th>Status</th><th>Views / cliques</th><th>Denúncias</th><th></th></tr></thead>
          <tbody>
            {rows.map((j) => (
              <tr key={j.id}>
                <td>
                  {j.status === 'PUBLISHED' ? <Link href={`/vaga/${j.slug}`} target="_blank">{j.title}</Link> : j.title}
                  <div className="hint">{j.city} · {dateBR(j.published_at)} · {j.billing_type || '—'}</div>
                </td>
                <td>{j.company}</td>
                <td>{JOB_STATUS[j.status]}</td>
                <td>{j.views_count} / {j.apply_clicks_count}</td>
                <td>{j.reports_count}</td>
                <td>
                  <form action={setJobStatus} className="actions">
                    <input type="hidden" name="job_id" value={j.id} />
                    {j.status === 'PUBLISHED' && <button className="btn danger small" name="status" value="SUSPENDED">Suspender</button>}
                    {j.status === 'SUSPENDED' && <button className="btn small" name="status" value="PUBLISHED">Reativar</button>}
                    {j.status !== 'CLOSED' && <button className="btn secondary small" name="status" value="CLOSED">Encerrar</button>}
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="empty">Nenhuma vaga.</p>}
      </div>
    </div>
  );
}
