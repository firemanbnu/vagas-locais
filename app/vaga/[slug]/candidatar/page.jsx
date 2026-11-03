import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sql } from '@/lib/db';
import { acceptCandidateTermsAndApply } from '@/app/actions/terms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Candidatar-se — Empregos Litoral' };

export default async function Candidatar({ params, searchParams }) {
  const { slug } = await params;
  const sp = await searchParams;
  const [job] = await sql`SELECT id, slug, title, company_name, city_name FROM v_public_jobs WHERE slug = ${slug}`;
  if (!job) notFound();

  return (
    <div className="container narrow section">
      <p><Link href={`/vaga/${job.slug}`}>← Voltar para a vaga</Link></p>
      <h1>Antes de se candidatar</h1>
      <div className="card stack">
        <p style={{ margin: 0 }}>
          <strong>{job.title}</strong> · {job.company_name} · {job.city_name}
        </p>
        <div className="alert warn" style={{ margin: 0 }}>
          <strong>Nunca pague para participar de um processo seletivo.</strong> Se a empresa pedir qualquer valor, não pague e
          denuncie a vaga.
        </div>
        <p className="hint" style={{ margin: 0 }}>
          O Empregos Litoral apenas divulga a vaga. O contato e o processo seletivo são feitos diretamente com a empresa.
        </p>
        {sp.erro && <div className="alert err" style={{ margin: 0 }}>Marque a caixa de aceite para continuar.</div>}
        <form action={acceptCandidateTermsAndApply}>
          <input type="hidden" name="job_id" value={job.id} />
          <input type="hidden" name="slug" value={job.slug} />
          <div className="field">
            <label className="check">
              <input type="checkbox" name="terms" required />
              <span>
                Li e concordo com os{' '}
                <Link href="/termos/candidatos" target="_blank">Termos de Uso para Candidatos da Empregos Litoral</Link>.
              </span>
            </label>
          </div>
          <button className="btn block" type="submit">Continuar para a candidatura</button>
        </form>
        <p className="hint" style={{ margin: 0 }}>Você só precisa aceitar uma vez neste aparelho.</p>
      </div>
    </div>
  );
}
