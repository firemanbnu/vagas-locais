import Link from 'next/link';
import { login } from '@/app/actions/auth';

export const metadata = { title: 'Entrar — Vagas Locais' };

export default async function Entrar({ searchParams }) {
  const sp = await searchParams;
  return (
    <div className="container narrow section">
      <h1>Entrar</h1>
      <div className="card">
        {sp.erro && <div className="alert err">{sp.erro}</div>}
        <form action={login}>
          <input type="hidden" name="next" value={sp.next || ''} />
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input id="email" name="email" type="email" required defaultValue={sp.email || ''} autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="password">Senha</label>
            <input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          <button className="btn block" type="submit">Entrar</button>
        </form>
      </div>
      <p style={{ marginTop: 14 }}>
        Ainda não tem conta? <Link href="/cadastro">Sou empresa</Link> · <Link href="/cadastro-candidato">Sou candidato</Link>
      </p>
    </div>
  );
}
