import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { sql } from '@/lib/db';
import { getCharge } from '@/lib/pix';

export const dynamic = 'force-dynamic';

function validToken(req) {
  const expected = process.env.PIX_WEBHOOK_SECRET;
  if (!expected) return false;
  const got = req.nextUrl.searchParams.get('token') || req.headers.get('x-webhook-token') || '';
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Webhook PIX (formato da API PIX do Bacen, usado pela Efí: { pix: [{ txid, endToEndId, valor, horario }] }).
 * 1. valida o token  2. registra o evento (idempotência)  3. confirma na fonte (PSP)
 * 4. confirm_pix_payment() publica a vaga  5. responde 200
 */
export async function POST(req, { params }) {
  const { provider } = await params;
  if (!validToken(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const raw = await req.text();
  let body;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }

  const items = Array.isArray(body?.pix) ? body.pix : [];
  for (const p of items) {
    const eventKey = p.endToEndId || `${p.txid}:${p.horario}`;
    const [ev] = await sql`
      INSERT INTO webhook_events (provider, event_key, payload, signature_valid)
      VALUES (${provider}, ${eventKey}, ${JSON.stringify(p)}::jsonb, true)
      ON CONFLICT (provider, event_key) DO NOTHING
      RETURNING id`;
    if (!ev) continue; // reentrega: já processado

    try {
      const charge = await getCharge(p.txid); // fonte da verdade
      if (charge && charge.status !== 'CONCLUIDA') {
        await sql`UPDATE webhook_events SET processed_at = now(), result = 'NOT_CONCLUDED' WHERE id = ${ev.id}`;
        continue;
      }
      const cents = Math.round(Number(p.valor) * 100);
      const result = await sql.begin(async (t) => {
        await t`SELECT set_audit_context(${null}::uuid, 'SYSTEM', 'webhook', ${eventKey}, ${null})`;
        const [r] = await t`
          SELECT confirm_pix_payment(${provider}::text, ${p.txid}::text, ${p.endToEndId || null}::text, ${cents}::int,
                                     ${p.horario || null}::timestamptz, ${JSON.stringify(p)}::jsonb) AS r`;
        return r.r;
      });
      await sql`UPDATE webhook_events SET processed_at = now(), result = ${result}, attempts = attempts + 1 WHERE id = ${ev.id}`;
    } catch (e) {
      await sql`UPDATE webhook_events SET attempts = attempts + 1, last_error = ${String(e.message)} WHERE id = ${ev.id}`;
    }
  }
  return NextResponse.json({ ok: true });
}
