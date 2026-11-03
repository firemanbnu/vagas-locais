import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { waLink } from '@/lib/format';
import { getSession } from '@/lib/auth';
import { currentTerms, hasAcceptedCurrent, CAND_COOKIE } from '@/lib/terms';

export const dynamic = 'force-dynamic';

// Registra o clique em "Candidatar-se" e redireciona para o canal da empresa.
export async function GET(req, { params }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.redirect(new URL('/', req.url));
  const [j] = await sql`
    SELECT slug, title, apply_channel, apply_whatsapp, apply_email, apply_url
      FROM v_public_jobs WHERE id = ${id}`;
  if (!j) return NextResponse.redirect(new URL('/', req.url));

  // Só redireciona para a empresa depois do aceite dos Termos para Candidatos
  const t = await currentTerms('CANDIDATE');
  if (t) {
    const s = await getSession();
    const okCookie = req.cookies.get(CAND_COOKIE)?.value === String(t.id);
    const okUser = s?.role === 'CANDIDATE' && (await hasAcceptedCurrent(s.uid, 'CANDIDATE'));
    if (!okCookie && !okUser) return NextResponse.redirect(new URL(`/vaga/${j.slug}/candidatar`, req.url));
  }

  await sql`SELECT track_job_event(${id}::uuid, 'APPLY_CLICK')`;

  let target;
  if (j.apply_channel === 'WHATSAPP') {
    target = waLink(j.apply_whatsapp, `Olá! Vi a vaga "${j.title}" no Empregos Litoral e gostaria de me candidatar.`);
  } else if (j.apply_channel === 'EMAIL') {
    target = `mailto:${j.apply_email}?subject=${encodeURIComponent(`Candidatura: ${j.title}`)}`;
  } else {
    target = j.apply_url;
  }
  return NextResponse.redirect(target, 302);
}
