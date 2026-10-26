import { sql } from '@/lib/db';
import { brl, dateTimeBR } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — Vagas Locais' };

export default async function AdminHome() {
  const [[m], payments] = await Promise.all([
    sql`SELECT * FROM v_admin_metrics`,
    sql`SELECT p.paid_at, p.paid_amount_cents, p.provider, j.title, coalesce(c.trade_name, c.legal_name) AS company
          FROM payments p JOIN jobs j ON j.id = p.job_id JOIN companies c ON c.id = p.company_id
         WHERE p.status = 'PAID' ORDER BY p.paid_at DESC LIMIT 10`,
  ]);
  const cards = [
    ['Vagas ativas', m.jobs_active],
    ['Vagas encerradas/expiradas', m.jobs_ended],
    ['Aguardando pagamento', m.jobs_pending_payment],
    ['Vagas suspensas', m.jobs_suspended],
    ['Empresas', m.companies_total],
    ['Candidatos cadastrados', m.candidates_total],
    ['Denúncias abertas', m.reports_open],
    ['Vagas com denúncia', `${m.reported_jobs_pct ?? 0}%`],
    ['Receita hoje', brl(Number(m.revenue_today_cents))],
    ['Receita no mês', brl(Number(m.revenue_month_cents))],
    ['Receita total', brl(Number(m.revenue_total_cents))],
  ];
  return (
    <div className="section" style={{ paddingTop: 0 }}>
      <div className="stats">
        {cards.map(([l, n]) => (
          <div key={l} className="card stat"><div className="n">{String(n)}</div><div className="l">{l}</div></div>
        ))}
      </div>
      <h2 style={{ marginTop: 24 }}>Últimos pagamentos</h2>
      <div className="card table-wrap">
        {payments.length === 0 ? <p className="empty">Nenhum pagamento ainda.</p> : (
          <table>
            <thead><tr><th>Quando</th><th>Empresa</th><th>Vaga</th><th>Valor</th><th>Origem</th></tr></thead>
            <tbody>
              {payments.map((p, i) => (
                <tr key={i}>
                  <td>{dateTimeBR(p.paid_at)}</td><td>{p.company}</td><td>{p.title}</td>
                  <td>{brl(p.paid_amount_cents)}</td><td>{p.provider}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
