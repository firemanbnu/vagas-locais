import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sql } from '@/lib/db';
import { WORK_MODEL, EMPLOYMENT, REPORT_REASON, salaryText, dateBR } from '@/lib/format';
import { reportJob } from '@/app/actions/public';
import { toggleSaveJob } from '@/app/actions/account';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const [j] = await sql`SELECT title, city_name, company_name FROM v_public_jobs WHERE slug = ${slug}`;
  if (!j) return { title: 'Vaga não encontrada' };
  return { title: `${j.title} em ${j.city_name} — ${j.company_name}` };
}

export default async function JobPage({ params, searchParams }) {
  const { slug } = await params;
  const sp = await searchParams;
  const [job] = await sql`SELECT * FROM v_public_jobs WHERE slug = ${slug}`;
  if (!job) notFound();

  await sql`SELECT track_job_event(${job.id}::uuid, 'VIEW')`;
  const [terms] = await sql`SELECT content_md FROM terms_versions WHERE is_current ORDER BY published_at DESC LIMIT 1`;
  const session = await getSession();
  const isCandidate = session?.role === 'CANDIDATE';
  const saved = isCandidate
    ? (await sql`SELECT 1 FROM saved_jobs WHERE user_id = ${session.uid} AND job_id = ${job.id}`).length > 0
    : false;

  const channelLabel = { WHATSAPP: 'Candidatar-se pelo WhatsApp', EMAIL: 'Candidatar-se por e-mail', URL: 'Candidatar-se no site da empresa' };

  return (
    <div className="container section">
      <p><Link href="/">← Voltar para as vagas</Link></p>
      <div className="grid-2">
        <article className="card">
          <h1>{job.title}</h1>
          <div className="meta">
            <span>{job.company_name}</span>
            <span>📍 {job.city_name}{job.neighborhood ? ` · ${job.neighborhood}` : ''}</span>
          </div>
          <div className="tags">
            <span className="tag">{WORK_MODEL[job.work_model]}</span>
            <span className="tag gray">{EMPLOYMENT[job.employment_type]}</span>
            <span className="tag gray">{job.category_name}</span>
            {job.openings > 1 && <span className="tag gray">{job.openings} vagas</span>}
          </div>
          <p className="salary" style={{ marginTop: 12 }}>{salaryText(job.salary_min_cents, job.salary_max_cents)}</p>

          <h3 style={{ marginTop: 18 }}>Descrição</h3>
          <p className="pre">{job.description}</p>
          {job.requirements && (<><h3>Requisitos</h3><p className="pre">{job.requirements}</p></>)}
          {job.benefits && (<><h3>Benefícios</h3><p className="pre">{job.benefits}</p></>)}
          <p className="hint">Publicada em {dateBR(job.published_at)} · válida até {dateBR(job.expires_at)}</p>

          <div className="sticky-apply">
            <a className="btn block" href={`/api/vagas/${job.id}/candidatar`} rel="nofollow">
              {channelLabel[job.apply_channel]}
            </a>
            {(isCandidate || !session) && (
              <form action={toggleSaveJob} style={{ marginTop: 8 }}>
                <input type="hidden" name="job_id" value={job.id} />
                <input type="hidden" name="slug" value={job.slug} />
                <button className="btn secondary block" type="submit">
                  {saved ? '★ Vaga salva (remover)' : '☆ Salvar vaga'}
                </button>
              </form>
            )}
            {!session && (
              <p className="hint" style={{ textAlign: 'center', marginTop: 6 }}>
                Para salvar vagas, <Link href="/cadastro-candidato">crie uma conta de candidato</Link>.
              </p>
            )}
          </div>

          <div className="legal">
            <strong>Aviso:</strong> esta plataforma apenas divulga a vaga. O anunciante é o único responsável pelas
            informações e pelo processo seletivo. Nenhuma empresa pode cobrar taxa do candidato.{' '}
            <Link href="/termos">Termos de uso</Link>.
            {terms && (
              <details style={{ marginTop: 8 }}>
                <summary>Ler a cláusula de isenção de responsabilidade</summary>
                <p className="pre" style={{ marginTop: 8 }}>{terms.content_md.replace(/\*\*/g, '').replace(/^## /m, '')}</p>
              </details>
            )}
          </div>
        </article>

        <aside className="card" id="denunciar">
          <h3>Reportar vaga</h3>
          <p className="hint">Já preenchida, inexistente ou irregular? Avise a moderação.</p>
          {sp.denuncia === 'ok' && <div className="alert ok">Obrigado! Sua denúncia foi registrada.</div>}
          {sp.denuncia === 'dup' && <div className="alert warn">Você já reportou esta vaga.</div>}
          {sp.denuncia === 'erro' && <div className="alert err">Não foi possível registrar. Tente novamente.</div>}
          <form action={reportJob}>
            <input type="hidden" name="job_id" value={job.id} />
            <input type="hidden" name="slug" value={job.slug} />
            <div className="field">
              <label htmlFor="reason">Motivo</label>
              <select id="reason" name="reason" required defaultValue="FILLED">
                {Object.entries(REPORT_REASON).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="details">Detalhes <span className="hint">(opcional)</span></label>
              <textarea id="details" name="details" maxLength={2000} style={{ minHeight: 80 }} />
            </div>
            <button className="btn secondary block" type="submit">Enviar denúncia</button>
          </form>
        </aside>
      </div>
    </div>
  );
}
