import Link from 'next/link';
import { notFound } from 'next/navigation';
import { termsBySlug } from '@/lib/terms';
import { dateBR } from '@/lib/format';
import TermsBody from '../TermsBody';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const t = await termsBySlug(slug);
  return { title: t ? `${t.title} — Empregos Litoral` : 'Documento não encontrado' };
}

export default async function TermoPage({ params }) {
  const { slug } = await params;
  const t = await termsBySlug(slug);
  if (!t) notFound();
  return (
    <div className="container narrow section">
      <p><Link href="/termos">← Termos e políticas</Link></p>
      <h1>{t.title}</h1>
      <div className="card">
        <p className="hint">Empregos Litoral · versão {t.version} · publicada em {dateBR(t.published_at)}</p>
        <TermsBody md={t.content_md} />
      </div>
    </div>
  );
}
