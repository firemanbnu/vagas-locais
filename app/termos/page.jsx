import Link from 'next/link';
import { sql } from '@/lib/db';
import { dateBR } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Termos e políticas — Empregos Litoral' };

const ORDER = ['anunciantes', 'candidatos', 'privacidade', 'clausula-geral'];
const DESC = {
  anunciantes: 'Regras para empresas e recrutadores que publicam vagas.',
  candidatos: 'Regras e avisos para quem procura emprego na plataforma.',
  privacidade: 'Quais dados coletamos, para que usamos e seus direitos (LGPD).',
  'clausula-geral': 'Resumo da natureza do serviço, exibido em todas as vagas.',
};

export default async function Termos() {
  const docs = await sql`SELECT slug, title, version, published_at FROM terms_versions WHERE is_current AND slug IS NOT NULL`;
  docs.sort((a, b) => ORDER.indexOf(a.slug) - ORDER.indexOf(b.slug));
  return (
    <div className="container narrow section">
      <h1>Termos e políticas</h1>
      <div className="stack">
        {docs.map((d) => (
          <Link key={d.slug} href={`/termos/${d.slug}`} className="card job-card">
            <h3>{d.title}</h3>
            <p className="hint" style={{ margin: 0 }}>{DESC[d.slug]} · versão {d.version} de {dateBR(d.published_at)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
