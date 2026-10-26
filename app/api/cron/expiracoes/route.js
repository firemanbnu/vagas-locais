import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Chamado pelo cron da Vercel (vercel.json). Expira vagas vencidas e PIX abandonados.
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const [r] = await sql`SELECT run_expirations() AS r`;
  return NextResponse.json(r.r);
}
