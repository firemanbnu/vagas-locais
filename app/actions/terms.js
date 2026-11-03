'use server';

import { createHash } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { sql, tx, clientIp } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { currentTerms, audienceOf, CAND_COOKIE } from '@/lib/terms';

const safeNext = (n) => (typeof n === 'string' && n.startsWith('/') && !n.startsWith('//') ? n : null);

/** Usuário logado aceita a versão vigente dos termos do seu público. */
export async function acceptCurrentTerms(formData) {
  const s = await getSession();
  if (!s) redirect('/entrar');
  const audience = audienceOf(s.role);
  const next = safeNext(String(formData.get('next') || '')) || (s.role === 'COMPANY' ? '/painel' : '/conta');
  if (!audience) redirect(next);
  if (formData.get('terms') !== 'on') redirect(`/termos/aceitar?next=${encodeURIComponent(next)}&erro=1`);

  const t = await currentTerms(audience);
  const ip = await clientIp();
  const ua = (await headers()).get('user-agent')?.slice(0, 300) || null;
  await tx(s, 'app', (q) => q`
    INSERT INTO terms_acceptances (user_id, company_id, terms_version_id, ip, user_agent)
    VALUES (${s.uid}, ${s.cid ?? null}, ${t.id}, ${ip}::inet, ${ua})
    ON CONFLICT (user_id, terms_version_id) DO NOTHING`);
  redirect(next);
}

/** Candidato (com ou sem conta) aceita os Termos para Candidatos antes de se candidatar. */
export async function acceptCandidateTermsAndApply(formData) {
  const jobId = String(formData.get('job_id') || '');
  const slug = String(formData.get('slug') || '');
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) redirect('/');
  if (formData.get('terms') !== 'on') redirect(`/vaga/${slug}/candidatar?erro=1`);

  const t = await currentTerms('CANDIDATE');
  const s = await getSession();
  const ip = await clientIp();
  const ua = (await headers()).get('user-agent')?.slice(0, 300) || null;

  if (s?.role === 'CANDIDATE') {
    await sql`
      INSERT INTO terms_acceptances (user_id, terms_version_id, ip, user_agent)
      VALUES (${s.uid}, ${t.id}, ${ip}::inet, ${ua})
      ON CONFLICT (user_id, terms_version_id) DO NOTHING`;
  } else {
    const ipHash = ip ? createHash('sha256').update(ip + (process.env.SESSION_SECRET || '')).digest('hex') : null;
    await sql`
      INSERT INTO anonymous_terms_acceptances (terms_version_id, job_id, ip_hash, ip, user_agent)
      VALUES (${t.id}, ${jobId}, ${ipHash}, ${ip}::inet, ${ua})`;
  }

  const c = await cookies();
  c.set(CAND_COOKIE, String(t.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect(`/api/vagas/${jobId}/candidatar`);
}
