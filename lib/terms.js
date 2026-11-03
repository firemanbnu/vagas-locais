import { sql } from '@/lib/db';

export const CAND_COOKIE = 'el_termos_candidato';

/** Versão vigente de um público: COMPANY | CANDIDATE | PRIVACY | ALL */
export async function currentTerms(audience) {
  const [t] = await sql`
    SELECT id, version, slug, title, content_md, published_at
      FROM terms_versions WHERE is_current AND audience = ${audience}
     ORDER BY published_at DESC LIMIT 1`;
  return t || null;
}

export async function termsBySlug(slug) {
  const [t] = await sql`
    SELECT id, version, slug, title, content_md, published_at, audience
      FROM terms_versions WHERE slug = ${slug} AND is_current
     ORDER BY published_at DESC LIMIT 1`;
  return t || null;
}

/** O usuário já aceitou a versão vigente para o seu público? */
export async function hasAcceptedCurrent(uid, audience) {
  const t = await currentTerms(audience);
  if (!t) return true;
  const r = await sql`SELECT 1 FROM terms_acceptances WHERE user_id = ${uid} AND terms_version_id = ${t.id}`;
  return r.length > 0;
}

export const audienceOf = (role) => (role === 'COMPANY' ? 'COMPANY' : role === 'CANDIDATE' ? 'CANDIDATE' : null);
