import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { waLink } from '@/lib/format';

export const dynamic = 'force-dynamic';

// Registra o clique em "Candidatar-se" e redireciona para o canal da empresa.
export async function GET(req, { params }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.redirect(new URL('/', req.url));
  const [j] = await sql`
    SELECT title, apply_channel, apply_whatsapp, apply_email, apply_url
      FROM v_public_jobs WHERE id = ${id}`;
  if (!j) return NextResponse.redirect(new URL('/', req.url));

  await sql`SELECT track_job_event(${id}::uuid, 'APPLY_CLICK')`;

  let target;
  if (j.apply_channel === 'WHATSAPP') {
    target = waLink(j.apply_whatsapp, `Olá! Vi a vaga "${j.title}" no Vagas Locais e gostaria de me candidatar.`);
  } else if (j.apply_channel === 'EMAIL') {
    target = `mailto:${j.apply_email}?subject=${encodeURIComponent(`Candidatura: ${j.title}`)}`;
  } else {
    target = j.apply_url;
  }
  return NextResponse.redirect(target, 302);
}
