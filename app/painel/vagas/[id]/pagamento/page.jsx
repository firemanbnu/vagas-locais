import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireCompany } from '@/lib/auth';
import { brl, dateTimeBR } from '@/lib/format';
import { pixDemo } from '@/lib/pix';
import { publishJob, simulatePixPayment } from '@/app/actions/company';
import AutoRefresh from './AutoRefresh';
import CopyButton from './CopyButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pagamento PIX — Vagas Locais' };

export default async function Pagamento({ params }) {
  const s = await requireCompany();
  const { id } = await params;
  const [job] = await sql`SELECT id, title, status FROM jobs WHERE id = ${id} AND company_id = ${s.cid}`;
  if (!job) redirect('/painel');
  if (job.status === 'PUBLISHED') redirect('/painel?ok=paga');

  const [p] = await sql`
    SELECT * FROM payments WHERE job_id = ${id} ORDER BY created_at DESC LIMIT 1`;
  const expired = !p || p.status !== 'PENDING' || new Date(p.expires_at) <= new Date();

  return (
    <div className="container narrow section">
      <h1>Pagamento via PIX</h1>
      <p className="hint">Vaga: <strong>{job.title}</strong></p>

      {expired ? (
        <div className="card stack">
          <div className="alert warn">Esta cobrança expirou ou não existe mais.</div>
          <form action={publishJob}>
            <input type="hidden" name="job_id" value={id} />
            <button className="btn block" type="submit">Gerar novo PIX</button>
          </form>
        </div>
      ) : (
        <div className="card stack">
          <AutoRefresh seconds={4} />
          <div style={{ textAlign: 'center' }}>
            <div className="hint">Valor</div>
            <div style={{ fontSize: '2rem', fontWeight: 800 }}>{brl(p.amount_cents)}</div>
            <div className="hint">Pague até {dateTimeBR(p.expires_at)}</div>
          </div>
          {p.qr_code_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.qr_code_image} alt="QR Code PIX" style={{ width: 240, height: 240, margin: '0 auto', display: 'block' }} />
          ) : (
            <div style={{ width: 200, height: 200, margin: '0 auto', border: '2px dashed var(--line)', borderRadius: 12,
                          display: 'grid', placeItems: 'center', color: 'var(--muted)', textAlign: 'center', padding: 12 }}>
              QR Code PIX
              <br />
              (demonstração)
            </div>
          )}
          <div>
            <label>PIX copia e cola</label>
            <div className="mono card" style={{ padding: 10, boxShadow: 'none' }}>{p.pix_copy_paste}</div>
            <div style={{ marginTop: 8 }}><CopyButton text={p.pix_copy_paste} /></div>
          </div>
          <p className="hint" style={{ textAlign: 'center' }}>
            A vaga é publicada automaticamente assim que o pagamento for confirmado. Esta página se atualiza sozinha.
          </p>
          {pixDemo() && (
            <form action={simulatePixPayment}>
              <input type="hidden" name="job_id" value={id} />
              <div className="alert warn">
                <strong>Modo demonstração:</strong> nenhum banco está conectado. Use o botão abaixo para simular a confirmação do PIX
                (o mesmo caminho que o webhook do banco percorre).
              </div>
              <button className="btn accent block" type="submit">Simular pagamento confirmado</button>
            </form>
          )}
        </div>
      )}
      <p style={{ marginTop: 16 }}><Link href="/painel">Voltar ao painel</Link></p>
    </div>
  );
}
