import Link from 'next/link';
import { sql } from '@/lib/db';
import { signupCandidate } from '@/app/actions/account';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Criar conta de candidato — Vagas Locais' };

export default async function CadastroCandidato({ searchParams }) {
  const sp = await searchParams;
  const cities = await sql`
    SELECT c.id, c.name FROM cities c JOIN regions r ON r.id = c.region_id
     WHERE c.is_active AND r.is_active ORDER BY c.name`;
  return (
    <div className="container narrow section">
      <h1>Conta de candidato</h1>
      <p className="hint">
        Opcional: você pode se candidatar às vagas sem conta. Com a conta, você salva vagas e cria alertas para a sua região.
      </p>
      <div className="card">
        {sp.erro && <div className="alert err">{sp.erro}</div>}
        <form action={signupCandidate}>
          <div className="field">
            <label htmlFor="name">Nome</label>
            <input id="name" name="name" required defaultValue={sp.name || ''} autoComplete="name" />
          </div>
          <div className="row two">
            <div className="field">
              <label htmlFor="email">E-mail</label>
              <input id="email" name="email" type="email" required defaultValue={sp.email || ''} autoComplete="email" />
            </div>
            <div className="field">
              <label htmlFor="password">Senha</label>
              <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
            </div>
          </div>
          <div className="row two">
            <div className="field">
              <label htmlFor="whatsapp">WhatsApp <span className="hint">(opcional)</span></label>
              <input id="whatsapp" name="whatsapp" inputMode="tel" placeholder="(47) 99999-9999" defaultValue={sp.whatsapp || ''} />
            </div>
            <div className="field">
              <label htmlFor="city_id">Sua cidade</label>
              <select id="city_id" name="city_id" defaultValue="">
                <option value="">Selecione</option>
                {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label className="check">
              <input type="checkbox" name="terms" required />
              <span>Li e aceito os <Link href="/termos" target="_blank">Termos de Uso</Link>.</span>
            </label>
          </div>
          <button className="btn block" type="submit">Criar conta</button>
        </form>
      </div>
      <p style={{ marginTop: 14 }}>Já tem conta? <Link href="/entrar">Entrar</Link></p>
    </div>
  );
}
