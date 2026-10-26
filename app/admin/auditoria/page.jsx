import Link from 'next/link';
import { sql } from '@/lib/db';
import { dateTimeBR } from '@/lib/format';

export const dynamic = 'force-dynamic';

const ENTITIES = ['jobs', 'companies', 'payments', 'job_reports', 'platform_settings', 'users', 'cities', 'regions', 'whatsapp_quota_claims'];

export default async function Auditoria({ searchParams }) {
  const sp = await searchParams;
  const entity = ENTITIES.includes(sp.e) ? sp.e : null;
  const rows = await sql`
    SELECT a.*, u.email AS actor_email
      FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id
     WHERE (${entity}::text IS NULL OR a.entity_type = ${entity}::text)
     ORDER BY a.occurred_at DESC, a.id DESC
     LIMIT 200`;
  return (
    <div className="section" style={{ paddingTop: 0 }}>
      <p className="hint">Registro imutável: o banco bloqueia alteração e exclusão destas linhas.</p>
      <div className="subnav">
        <Link href="/admin/auditoria" className={!entity ? 'on' : ''}>Tudo</Link>
        {ENTITIES.map((e) => (
          <Link key={e} href={`/admin/auditoria?e=${e}`} className={entity === e ? 'on' : ''}>{e}</Link>
        ))}
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Entidade</th><th>Detalhe</th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={String(a.id)}>
                <td style={{ whiteSpace: 'nowrap' }}>{dateTimeBR(a.occurred_at)}</td>
                <td>{a.actor_email || a.actor_role || '—'}<div className="hint">{a.source}</div></td>
                <td><strong>{a.action}</strong></td>
                <td>{a.entity_type}<div className="hint mono">{a.entity_id?.slice(0, 8)}</div></td>
                <td>
                  {a.changed_fields?.length ? <div>Campos: {a.changed_fields.join(', ')}</div> : null}
                  <details>
                    <summary>dados</summary>
                    <pre className="mono" style={{ whiteSpace: 'pre-wrap', maxWidth: 420 }}>
                      {JSON.stringify(a.action === 'UPDATE' ? diff(a.old_data, a.new_data, a.changed_fields) : (a.new_data || a.old_data), null, 1)}
                    </pre>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function diff(oldD, newD, fields) {
  const out = {};
  for (const f of fields || []) out[f] = { de: oldD?.[f] ?? null, para: newD?.[f] ?? null };
  return out;
}
