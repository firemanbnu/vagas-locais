import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { currentTerms, audienceOf, hasAcceptedCurrent } from '@/lib/terms';
import { acceptCurrentTerms } from '@/app/actions/terms';
import TermsBody from '../TermsBody';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Aceite dos Termos de Uso — Empregos Litoral' };

const LABEL = {
  COMPANY: 'Li e concordo com os Termos de Uso para Anunciantes da Empregos Litoral',
  CANDIDATE: 'Li e concordo com os Termos de Uso para Candidatos da Empregos Litoral',
};

export default async function AceitarTermos({ searchParams }) {
  const s = await getSession();
  if (!s) redirect('/entrar');
  const sp = await searchParams;
  const audience = audienceOf(s.role);
  const next = sp.next || (s.role === 'COMPANY' ? '/painel' : '/conta');
  if (!audience || (await hasAcceptedCurrent(s.uid, audience))) redirect(next);
  const t = await currentTerms(audience);

  return (
    <div className="container narrow section">
      <h1>{t.title}</h1>
      <p className="hint">
        Os termos foram atualizados (versão {t.version}). Para continuar usando a plataforma, leia e aceite.
      </p>
      {sp.erro && <div className="alert err">Marque a caixa de aceite para continuar.</div>}
      <div className="card" style={{ maxHeight: 420, overflowY: 'auto' }}>
        <TermsBody md={t.content_md} />
      </div>
      <form action={acceptCurrentTerms} className="card" style={{ marginTop: 12 }}>
        <input type="hidden" name="next" value={next} />
        <div className="field">
          <label className="check">
            <input type="checkbox" name="terms" required />
            <span>{LABEL[audience]}</span>
          </label>
        </div>
        <button className="btn block" type="submit">Aceitar e continuar</button>
      </form>
    </div>
  );
}
