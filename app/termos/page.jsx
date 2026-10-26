import { sql } from '@/lib/db';
import { dateBR } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Termos de uso — Vagas Locais' };

function renderMd(md) {
  // Markdown mínimo: títulos "## " e negrito "**"
  return md.split(/\n\n+/).map((block, i) => {
    if (block.startsWith('## ')) return <h2 key={i}>{block.slice(3)}</h2>;
    const parts = block.split(/\*\*(.+?)\*\*/g);
    return (
      <p key={i}>
        {parts.map((p, k) => (k % 2 ? <strong key={k}>{p}</strong> : p))}
      </p>
    );
  });
}

export default async function Termos() {
  const [t] = await sql`SELECT version, content_md, published_at FROM terms_versions WHERE is_current ORDER BY published_at DESC LIMIT 1`;
  return (
    <div className="container narrow section">
      <h1>Termos de uso</h1>
      {t ? (
        <div className="card">
          <p className="hint">Versão {t.version} · publicada em {dateBR(t.published_at)}</p>
          {renderMd(t.content_md)}
        </div>
      ) : (
        <p>Termos ainda não publicados.</p>
      )}
    </div>
  );
}
