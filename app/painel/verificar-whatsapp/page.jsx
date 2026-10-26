import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireCompany } from '@/lib/auth';
import { formatWhatsapp } from '@/lib/format';
import { whatsappDemo } from '@/lib/whatsapp';
import { sendCode, confirmCode, changeWhatsapp } from '@/app/actions/company';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Verificar WhatsApp — Vagas Locais' };

export default async function VerificarWhatsapp({ searchParams }) {
  const s = await requireCompany();
  const sp = await searchParams;
  const [[c], [st]] = await Promise.all([
    sql`SELECT whatsapp, whatsapp_verified_at FROM companies WHERE id = ${s.cid}`,
    sql`SELECT onboarding_free_jobs, otp_ttl_minutes FROM platform_settings`,
  ]);
  if (c.whatsapp_verified_at) redirect('/painel');

  const [pending] = await sql`
    SELECT 1 FROM whatsapp_verifications
     WHERE company_id = ${s.cid} AND consumed_at IS NULL AND expires_at > now() LIMIT 1`;

  return (
    <div className="container narrow section">
      <h1>Confirme seu WhatsApp</h1>
      <p className="hint">
        Enviamos um código de 6 dígitos para <strong>{formatWhatsapp(c.whatsapp)}</strong>. Depois de confirmar, você pode publicar
        vagas{st.onboarding_free_jobs > 0 ? ` e ganha ${st.onboarding_free_jobs} vagas grátis (uma vez por número)` : ''}.
      </p>

      {sp.pendente && <div className="alert warn">Para publicar, confirme primeiro seu WhatsApp. Sua vaga ficou salva como rascunho.</div>}
      {sp.erro && <div className="alert err">{sp.erro}</div>}
      {sp.ok === 'numero' && <div className="alert ok">Número atualizado. Peça um novo código.</div>}
      {sp.enviado && !sp.demo && <div className="alert ok">Código enviado! Ele vale por {st.otp_ttl_minutes} minutos.</div>}
      {sp.demo && (
        <div className="alert warn">
          <strong>Modo demonstração:</strong> o envio pelo WhatsApp ainda não está configurado. Seu código é:
          <div className="demo-code">{sp.demo}</div>
        </div>
      )}

      <div className="card stack">
        {pending ? (
          <form action={confirmCode}>
            <div className="field">
              <label htmlFor="code">Código recebido</label>
              <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6}
                     required placeholder="000000" style={{ fontSize: '1.4rem', letterSpacing: '0.3em', textAlign: 'center' }} />
            </div>
            <button className="btn block" type="submit">Confirmar</button>
          </form>
        ) : null}
        <form action={sendCode}>
          <button className={pending ? 'btn secondary block' : 'btn block'} type="submit">
            {pending ? 'Reenviar código' : 'Enviar código pelo WhatsApp'}
          </button>
        </form>
      </div>

      <details style={{ marginTop: 16 }}>
        <summary>O número está errado?</summary>
        <form action={changeWhatsapp} className="card" style={{ marginTop: 10 }}>
          <div className="field">
            <label htmlFor="whatsapp">Novo WhatsApp</label>
            <input id="whatsapp" name="whatsapp" inputMode="tel" placeholder="(47) 99999-9999" required />
          </div>
          <button className="btn secondary" type="submit">Atualizar número</button>
        </form>
      </details>
      <p style={{ marginTop: 16 }}><Link href="/painel">Voltar ao painel</Link></p>
    </div>
  );
}
