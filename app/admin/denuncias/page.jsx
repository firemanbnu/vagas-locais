import Link from 'next/link';
import { sql } from '@/lib/db';
import { REPORT_REASON, JOB_STATUS, dateTimeBR } from '@/lib/format';
import { moderate } from '@/app/actions/admin';

export const dynamic = 'force-dynamic';

const OK = {
  JOB_DEACTIVATED: 'Vaga desativada e anunciante notificado.',
  COMPANY_NOTIFIED: 'Anunciante notificado.',
  ARCHIVED: 'Denúncia arquivada.',
};

export default async function Denuncias({ searchParams }) {
  const sp = await searchParams;
  const rows = await sql`
    SELECT r.id, r.reason, r.details, r.created_at, j.title, j.slug, j.status AS job_status, j.reports_count,
           coalesce(c.trade_name, c.legal_name) AS company
      FROM job_reports r JOIN jobs j ON j.id = r.job_id JOIN companies c ON c.id = j.company_id
     WHERE r.status = 'OPEN'
     ORDER BY r.created_at DESC`;
  return (
    <div className="section" style={{ paddingTop: 0 }}>
      {sp.ok && <div className="alert ok">{OK[sp.ok]}</div>}
      {rows.length === 0 ? <div className="card empty">Nenhuma denúncia aberta. 🎉</div> : (
        <div className="stack">
          {rows.map((r) => (
            <div key={r.id} className="card">
              <div className="meta">
                <span className="tag red">{REPORT_REASON[r.reason]}</span>
                <span>{dateTimeBR(r.created_at)}</span>
                <span>Vaga {JOB_STATUS[r.job_status].toLowerCase()} · {r.reports_count} denúncia(s) no total</span>
              </div>
              <h3 style={{ marginTop: 8 }}>
                {r.job_status === 'PUBLISHED' ? <Link href={`/vaga/${r.slug}`} target="_blank">{r.title}</Link> : r.title}
              </h3>
              <p className="hint">{r.company}</p>
              {r.details && <p className="pre">“{r.details}”</p>}
              <form action={moderate} className="stack">
                <input type="hidden" name="report_id" value={r.id} />
                <input name="note" placeholder="Observação para o anunciante (opcional)" />
                <div className="actions">
                  <button className="btn danger small" name="action" value="JOB_DEACTIVATED">Desativar vaga</button>
                  <button className="btn small" name="action" value="COMPANY_NOTIFIED">Notificar contratante</button>
                  <button className="btn secondary small" name="action" value="ARCHIVED">Arquivar denúncia</button>
                </div>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
