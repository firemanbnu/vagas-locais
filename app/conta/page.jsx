import Link from 'next/link';
import { sql } from '@/lib/db';
import { requireCandidate } from '@/lib/auth';
import { WORK_MODEL, salaryText, dateBR } from '@/lib/format';
import { toggleSaveJob, createAlert, deleteAlert } from '@/app/actions/account';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Minha conta — Vagas Locais' };

const OK = { bemvindo: 'Conta criada! Salve vagas e crie alertas para a sua região.', alerta: 'Alerta criado.' };

export default async function Conta({ searchParams }) {
  const s = await requireCandidate();
  const sp = await searchParams;
  const [[me], saved, alerts, cities, categories] = await Promise.all([
    sql`SELECT u.name, u.email, p.city_id FROM users u LEFT JOIN candidate_profiles p ON p.user_id = u.id WHERE u.id = ${s.uid}`,
    sql`SELECT j.id, j.slug, j.title, j.status, j.expires_at, j.salary_min_cents, j.salary_max_cents, j.salary_visible,
               j.work_model, ci.name AS city, coalesce(c.trade_name, c.legal_name) AS company
          FROM saved_jobs sj JOIN jobs j ON j.id = sj.job_id JOIN cities ci ON ci.id = j.city_id
          JOIN companies c ON c.id = j.company_id
         WHERE sj.user_id = ${s.uid} ORDER BY sj.created_at DESC`,
    sql`SELECT a.*, ci.name AS city, cat.name AS category
          FROM job_alerts a LEFT JOIN cities ci ON ci.id = a.city_id LEFT JOIN categories cat ON cat.id = a.category_id
         WHERE a.user_id = ${s.uid} ORDER BY a.created_at DESC`,
    sql`SELECT c.id, c.name FROM cities c JOIN regions r ON r.id = c.region_id WHERE c.is_active AND r.is_active ORDER BY c.name`,
    sql`SELECT id, name FROM categories WHERE is_active ORDER BY sort_order, name`,
  ]);

  return (
    <div className="container section">
      <div className="page-head" style={{ marginTop: 0 }}>
        <div>
          <h1>Olá, {me.name?.split(' ')[0]}</h1>
          <p className="hint" style={{ margin: 0 }}>{me.email}</p>
        </div>
        <Link href="/" className="btn secondary">Buscar vagas</Link>
      </div>
      {sp.ok && OK[sp.ok] && <div className="alert ok">{OK[sp.ok]}</div>}
      {sp.erro && <div className="alert err">{sp.erro}</div>}

      <div className="grid-2">
        <section>
          <h2>Vagas salvas</h2>
          {saved.length === 0 ? (
            <div className="card empty">Nenhuma vaga salva. Abra uma vaga e toque em “Salvar vaga”.</div>
          ) : (
            <div className="stack">
              {saved.map((j) => {
                const open = j.status === 'PUBLISHED' && new Date(j.expires_at) > new Date();
                return (
                  <div key={j.id} className="card">
                    <h3 style={{ marginBottom: 4 }}>
                      {open ? <Link href={`/vaga/${j.slug}`}>{j.title}</Link> : j.title}
                    </h3>
                    <div className="meta">
                      <span>{j.company}</span>
                      <span>📍 {j.city}</span>
                      <span>{WORK_MODEL[j.work_model]}</span>
                      {!open && <span className="tag gray">Não está mais disponível</span>}
                    </div>
                    {open && (
                      <p className="salary" style={{ margin: '8px 0 0' }}>
                        {j.salary_visible ? salaryText(j.salary_min_cents, j.salary_max_cents) : 'A combinar'}
                        <span className="hint"> · até {dateBR(j.expires_at)}</span>
                      </p>
                    )}
                    <form action={toggleSaveJob} style={{ marginTop: 10 }}>
                      <input type="hidden" name="job_id" value={j.id} />
                      <input type="hidden" name="slug" value={j.slug} />
                      <input type="hidden" name="back" value="conta" />
                      <button className="btn small secondary" type="submit">Remover</button>
                    </form>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2>Alertas de vagas</h2>
          <form action={createAlert} className="card" style={{ marginBottom: 12 }}>
            <div className="field">
              <label htmlFor="keyword">Palavra-chave <span className="hint">(opcional)</span></label>
              <input id="keyword" name="keyword" placeholder="Ex.: vendedor, motorista" maxLength={80} />
            </div>
            <div className="row two">
              <div className="field">
                <label htmlFor="city_id">Cidade</label>
                <select id="city_id" name="city_id" defaultValue={me.city_id || ''}>
                  <option value="">Qualquer</option>
                  {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="category_id">Área</label>
                <select id="category_id" name="category_id" defaultValue="">
                  <option value="">Qualquer</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="work_model">Modelo</label>
              <select id="work_model" name="work_model" defaultValue="">
                <option value="">Qualquer</option>
                {Object.entries(WORK_MODEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <button className="btn" type="submit">Criar alerta</button>
            <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
              Os avisos por e-mail serão ativados quando o envio de e-mails for configurado.
            </p>
          </form>
          {alerts.length > 0 && (
            <div className="stack">
              {alerts.map((a) => (
                <div key={a.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                  <div className="tags" style={{ marginTop: 0 }}>
                    {a.keyword && <span className="tag">“{a.keyword}”</span>}
                    {a.city && <span className="tag gray">📍 {a.city}</span>}
                    {a.category && <span className="tag gray">{a.category}</span>}
                    {a.work_model && <span className="tag gray">{WORK_MODEL[a.work_model]}</span>}
                  </div>
                  <form action={deleteAlert}>
                    <input type="hidden" name="alert_id" value={a.id} />
                    <button className="btn small secondary" type="submit">Excluir</button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
