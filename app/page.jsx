import Link from 'next/link';
import { sql } from '@/lib/db';
import { WORK_MODEL, EMPLOYMENT, salaryText, dateBR } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }) {
  const sp = await searchParams;
  const q = (sp.q || '').trim() || null;
  const cidade = sp.cidade || null;
  const categoria = sp.categoria || null;
  const modelo = ['ONSITE', 'HYBRID', 'REMOTE'].includes(sp.modelo) ? sp.modelo : null;

  const [cities, categories, jobs] = await Promise.all([
    sql`SELECT c.name, c.slug FROM cities c JOIN regions r ON r.id = c.region_id
        WHERE c.is_active AND r.is_active ORDER BY c.name`,
    sql`SELECT name, slug FROM categories WHERE is_active ORDER BY sort_order, name`,
    sql`
      SELECT id, slug, title, neighborhood, city_name, category_name, work_model, employment_type,
             salary_min_cents, salary_max_cents, company_name, published_at, openings
        FROM v_public_jobs
       WHERE (${q}::text IS NULL
              OR search_vector @@ websearch_to_tsquery('portuguese', unaccent(${q}::text))
              OR unaccent(title) ILIKE '%' || unaccent(${q}::text) || '%')
         AND (${cidade}::text IS NULL OR city_slug = ${cidade}::text)
         AND (${categoria}::text IS NULL OR category_slug = ${categoria}::text)
         AND (${modelo}::text IS NULL OR work_model::text = ${modelo}::text)
       ORDER BY published_at DESC
       LIMIT 60`,
  ]);

  const filtered = q || cidade || categoria || modelo;

  return (
    <>
      <section className="hero">
        <div className="container">
          <h1>Vagas de emprego perto de você</h1>
          <p>Encontre a vaga e fale direto com a empresa. Sem cadastro, sem taxa.</p>
          <form className="search" action="/" method="get">
            <input name="q" placeholder="Cargo ou palavra-chave" defaultValue={q || ''} aria-label="Cargo ou palavra-chave" />
            <select name="cidade" defaultValue={cidade || ''} aria-label="Cidade">
              <option value="">Todas as cidades</option>
              {cities.map((c) => (
                <option key={c.slug} value={c.slug}>{c.name}</option>
              ))}
            </select>
            <select name="categoria" defaultValue={categoria || ''} aria-label="Categoria">
              <option value="">Todas as áreas</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>{c.name}</option>
              ))}
            </select>
            <select name="modelo" defaultValue={modelo || ''} aria-label="Modelo de trabalho">
              <option value="">Qualquer modelo</option>
              {Object.entries(WORK_MODEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <button className="btn accent" type="submit">Buscar</button>
          </form>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="page-head" style={{ marginTop: 0 }}>
            <h2>{filtered ? `${jobs.length} vaga(s) encontrada(s)` : 'Vagas recentes'}</h2>
            {filtered && <Link href="/">Limpar filtros</Link>}
          </div>
          {jobs.length === 0 ? (
            <div className="card empty">
              Nenhuma vaga encontrada com esses filtros.
              <br />
              <Link href="/">Ver todas as vagas</Link>
            </div>
          ) : (
            <div className="stack">
              {jobs.map((j) => (
                <Link key={j.id} href={`/vaga/${j.slug}`} className="card job-card">
                  <h3>{j.title}</h3>
                  <div className="meta">
                    <span>{j.company_name}</span>
                    <span>📍 {j.city_name}{j.neighborhood ? ` · ${j.neighborhood}` : ''}</span>
                    <span>Publicada em {dateBR(j.published_at)}</span>
                  </div>
                  <div className="tags">
                    <span className="tag">{WORK_MODEL[j.work_model]}</span>
                    <span className="tag gray">{EMPLOYMENT[j.employment_type]}</span>
                    <span className="tag gray">{j.category_name}</span>
                    {j.openings > 1 && <span className="tag gray">{j.openings} vagas</span>}
                  </div>
                  <p className="salary" style={{ marginTop: 10, marginBottom: 0 }}>
                    {salaryText(j.salary_min_cents, j.salary_max_cents)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
