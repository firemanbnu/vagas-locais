import postgres from 'postgres';
import { headers } from 'next/headers';

const g = globalThis;

export const sql =
  g.__sql ??
  (g.__sql = postgres(process.env.DATABASE_URL, {
    prepare: false, // compatível com o pooler (PgBouncer) da Neon
    max: 5,
    idle_timeout: 20,
    onnotice: () => {},
  }));

export async function clientIp() {
  const h = await headers();
  const raw = (h.get('x-forwarded-for') || h.get('x-real-ip') || '').split(',')[0].trim();
  // aceita só IPv4/IPv6 válidos para não quebrar o cast ::inet da auditoria
  if (/^[0-9]{1,3}(\.[0-9]{1,3}){3}$/.test(raw) || /^[0-9a-fA-F:]+$/.test(raw)) return raw;
  return null;
}

/**
 * Transação com contexto de auditoria (quem fez, origem, IP).
 * session: { uid, role } ou null
 */
export async function tx(session, source, fn) {
  const ip = await clientIp();
  return sql.begin(async (t) => {
    await t`SELECT set_audit_context(${session?.uid ?? null}::uuid, ${session?.role ?? 'ANON'}, ${source}, ${null}, ${ip})`;
    return fn(t);
  });
}

export async function settings() {
  const [s] = await sql`SELECT * FROM platform_settings`;
  return s;
}
