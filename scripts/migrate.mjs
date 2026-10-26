// Aplica as migrações de db/migrations em ordem e cria o admin inicial.
// Roda antes do `next build` (inclusive na Vercel). Idempotente.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';

// Prefere a conexão direta (sem pooler) para migrações
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.log('[migrate] DATABASE_URL ausente — pulando migrações.');
  process.exit(0);
}

const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });

try {
  await sql`CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;

  const dir = path.join(process.cwd(), 'db', 'migrations');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  const done = new Set((await sql`SELECT name FROM _migrations`).map((r) => r.name));

  for (const f of files) {
    if (done.has(f)) continue;
    console.log(`[migrate] aplicando ${f}`);
    const body = await readFile(path.join(dir, f), 'utf8');
    await sql.unsafe(body).simple(); // vários comandos no mesmo arquivo
    await sql`INSERT INTO _migrations (name) VALUES (${f})`;
  }

  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const r = await sql`
      INSERT INTO users (email, name, role, password_hash, email_verified_at)
      VALUES (${ADMIN_EMAIL}, 'Administrador', 'ADMIN', ${hash}, now())
      ON CONFLICT (email) DO NOTHING
      RETURNING id`;
    if (r.length) console.log('[migrate] administrador criado');
  }

  console.log('[migrate] ok');
} catch (e) {
  console.error('[migrate] falhou:', e.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
