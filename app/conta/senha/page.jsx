import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { changePassword } from '@/app/actions/account';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Alterar senha — Vagas Locais' };

const HOME = { ADMIN: '/admin', COMPANY: '/painel', CANDIDATE: '/conta' };

export default async function AlterarSenha({ searchParams }) {
  const s = await getSession();
  if (!s) redirect('/entrar?next=/conta/senha');
  const sp = await searchParams;
  return (
    <div className="container narrow section">
      <h1>Alterar senha</h1>
      <div className="card">
        {sp.ok && <div className="alert ok">Senha alterada com sucesso.</div>}
        {sp.erro && <div className="alert err">{sp.erro}</div>}
        <form action={changePassword}>
          <div className="field">
            <label htmlFor="current">Senha atual</label>
            <input id="current" name="current" type="password" required autoComplete="current-password" />
          </div>
          <div className="field">
            <label htmlFor="password">Nova senha</label>
            <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
            <span className="hint">Mínimo de 8 caracteres.</span>
          </div>
          <div className="field">
            <label htmlFor="confirm">Confirme a nova senha</label>
            <input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" />
          </div>
          <button className="btn block" type="submit">Salvar nova senha</button>
        </form>
      </div>
      <p style={{ marginTop: 14 }}><Link href={HOME[s.role] || '/'}>Voltar</Link></p>
    </div>
  );
}
