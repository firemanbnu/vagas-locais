import { sql } from '@/lib/db';
import { requireCompany } from '@/lib/auth';
import { brl } from '@/lib/format';
import JobForm from './JobForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Nova vaga — Vagas Locais' };

export default async function NovaVaga({ searchParams }) {
  const s = await requireCompany();
  const sp = await searchParams;
  const [cities, categories, [c], [st]] = await Promise.all([
    sql`SELECT c.id, c.name FROM cities c JOIN regions r ON r.id = c.region_id WHERE c.is_active AND r.is_active ORDER BY c.name`,
    sql`SELECT id, name FROM categories WHERE is_active ORDER BY sort_order, name`,
    sql`SELECT trade_name, legal_name, whatsapp, contact_email, city_id, free_quota_remaining, paid_credits FROM companies WHERE id = ${s.cid}`,
    sql`SELECT job_price_cents, job_duration_days FROM platform_settings`,
  ]);

  let costNote;
  if (c.free_quota_remaining > 0) costNote = `Esta vaga usa 1 das suas ${c.free_quota_remaining} vagas grátis.`;
  else if (c.paid_credits > 0) costNote = `Esta vaga usa 1 dos seus ${c.paid_credits} créditos.`;
  else if (st.job_price_cents > 0) costNote = `Valor do anúncio: ${brl(st.job_price_cents)} via PIX.`;
  else costNote = 'Publicação gratuita.';

  return (
    <div className="container section">
      <h1>Publicar vaga</h1>
      <p className="hint">{costNote} A vaga fica no ar por {st.job_duration_days} dias.</p>
      {sp.erro && <div className="alert err">{sp.erro}</div>}
      <JobForm
        cities={cities.map((x) => ({ id: x.id, name: x.name }))}
        categories={categories.map((x) => ({ id: x.id, name: x.name }))}
        company={{
          name: c.trade_name || c.legal_name,
          whatsapp: c.whatsapp,
          email: c.contact_email,
          cityId: c.city_id,
        }}
      />
    </div>
  );
}
