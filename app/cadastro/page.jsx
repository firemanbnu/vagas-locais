import Link from 'next/link';
import { sql } from '@/lib/db';
import { signup } from '@/app/actions/auth';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Anunciar vagas — cadastro da empresa' };

export default async function Cadastro({ searchParams }) {
  const sp = await searchParams;
  const [cities, [st]] = await Promise.all([
    sql`SELECT c.id, c.name FROM cities c JOIN regions r ON r.id = c.region_id WHERE c.is_active AND r.is_active ORDER BY c.name`,
    sql`SELECT onboarding_free_jobs FROM platform_settings`,
  ]);

  return (
    <div className="container narrow section">
      <h1>Anuncie suas vagas</h1>
      <p className="hint">
        {st?.onboarding_free_jobs > 0
          ? `As primeiras ${st.onboarding_free_jobs} vagas são grátis depois de confirmar seu WhatsApp.`
          : 'Cadastre-se para publicar vagas.'}
      </p>
      <div className="card">
        {sp.erro && <div className="alert err">{sp.erro}</div>}
        <form action={signup}>
          <div className="field">
            <label htmlFor="legal_name">Nome da empresa ou seu nome</label>
            <input id="legal_name" name="legal_name" required defaultValue={sp.legal_name || ''} autoComplete="organization" />
          </div>
          <div className="row two">
            <div className="field">
              <label htmlFor="trade_name">Nome fantasia <span className="hint">(opcional)</span></label>
              <input id="trade_name" name="trade_name" defaultValue={sp.trade_name || ''} />
            </div>
            <div className="field">
              <label htmlFor="cnpj">CNPJ <span className="hint">(opcional)</span></label>
              <input id="cnpj" name="cnpj" inputMode="text" placeholder="00.000.000/0000-00" defaultValue={sp.cnpj || ''} />
            </div>
          </div>
          <div className="row two">
            <div className="field">
              <label htmlFor="whatsapp">WhatsApp</label>
              <input id="whatsapp" name="whatsapp" required inputMode="tel" placeholder="(47) 99999-9999" defaultValue={sp.whatsapp || ''} autoComplete="tel" />
              <span className="hint">Você vai receber um código para confirmar.</span>
            </div>
            <div className="field">
              <label htmlFor="city_id">Cidade</label>
              <select id="city_id" name="city_id" defaultValue="">
                <option value="">Selecione</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="row two">
            <div className="field">
              <label htmlFor="email">E-mail</label>
              <input id="email" name="email" type="email" required defaultValue={sp.email || ''} autoComplete="email" />
            </div>
            <div className="field">
              <label htmlFor="password">Senha</label>
              <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
              <span className="hint">Mínimo de 8 caracteres.</span>
            </div>
          </div>
          <div className="field">
            <label className="check">
              <input type="checkbox" name="terms" required />
              <span>
                Li e aceito os <Link href="/termos" target="_blank">Termos de Uso</Link>, incluindo a cláusula de natureza do serviço e
                isenção de responsabilidade, e declaro que não cobrarei taxas de candidatos.
              </span>
            </label>
          </div>
          <button className="btn block" type="submit">Criar conta</button>
        </form>
      </div>
      <p style={{ marginTop: 14 }}>Já tem conta? <Link href="/entrar">Entrar</Link></p>
    </div>
  );
}
