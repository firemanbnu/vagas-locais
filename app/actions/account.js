'use server';

import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql, tx } from '@/lib/db';
import { getSession, createSession, requireCandidate } from '@/lib/auth';
import { normalizeWhatsapp } from '@/lib/format';

const qs = (o) => new URLSearchParams(o).toString();

// ---------- Troca de senha (qualquer usuário logado) ----------

export async function changePassword(formData) {
  const s = await getSession();
  if (!s) redirect('/entrar?next=/conta/senha');
  const current = String(formData.get('current') || '');
  const next = String(formData.get('password') || '');
  const confirm = String(formData.get('confirm') || '');

  if (next.length < 8) redirect('/conta/senha?' + qs({ erro: 'A nova senha precisa ter pelo menos 8 caracteres.' }));
  if (next !== confirm) redirect('/conta/senha?' + qs({ erro: 'A confirmação não confere com a nova senha.' }));

  const [u] = await sql`SELECT password_hash FROM users WHERE id = ${s.uid}`;
  const ok = u?.password_hash && (await bcrypt.compare(current, u.password_hash));
  if (!ok) redirect('/conta/senha?' + qs({ erro: 'A senha atual está incorreta.' }));
  if (current === next) redirect('/conta/senha?' + qs({ erro: 'A nova senha deve ser diferente da atual.' }));

  const hash = await bcrypt.hash(next, 10);
  // A auditoria registra que a senha mudou, mas nunca o hash (migração 003)
  await tx(s, 'app', (t) => t`UPDATE users SET password_hash = ${hash} WHERE id = ${s.uid}`);
  redirect('/conta/senha?ok=1');
}

// ---------- Candidato ----------

export async function signupCandidate(formData) {
  const name = String(formData.get('name') || '').trim();
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  const whatsappRaw = String(formData.get('whatsapp') || '').trim();
  const whatsapp = whatsappRaw ? normalizeWhatsapp(whatsappRaw) : null;
  const cityId = Number(formData.get('city_id')) || null;
  const keep = { name, email, whatsapp: whatsappRaw };
  const fail = (m) => redirect('/cadastro-candidato?' + qs({ erro: m, ...keep }));

  if (name.length < 2) fail('Informe seu nome.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail('E-mail inválido.');
  if (password.length < 8) fail('A senha precisa ter pelo menos 8 caracteres.');
  if (whatsappRaw && !whatsapp) fail('WhatsApp inválido. Use DDD + número.');
  if (formData.get('terms') !== 'on') fail('É preciso aceitar os Termos de Uso.');

  const hash = await bcrypt.hash(password, 10);
  let uid;
  try {
    uid = await tx(null, 'app', async (t) => {
      const [u] = await t`
        INSERT INTO users (email, name, role, phone, password_hash)
        VALUES (${email}, ${name}, 'CANDIDATE', ${whatsapp}, ${hash}) RETURNING id`;
      await t`INSERT INTO candidate_profiles (user_id, full_name, whatsapp, city_id)
              VALUES (${u.id}, ${name}, ${whatsapp}, ${cityId})`;
      const [terms] = await t`SELECT id FROM terms_versions WHERE is_current AND audience IN ('ALL','CANDIDATE') ORDER BY published_at DESC LIMIT 1`;
      if (terms) await t`INSERT INTO terms_acceptances (user_id, terms_version_id) VALUES (${u.id}, ${terms.id})`;
      return u.id;
    });
  } catch (e) {
    if (e.code === '23505') fail('Este e-mail já está cadastrado. Faça login.');
    console.error(e);
    fail('Não foi possível concluir o cadastro.');
  }
  await createSession({ uid, role: 'CANDIDATE' });
  redirect('/conta?ok=bemvindo');
}

export async function toggleSaveJob(formData) {
  const s = await getSession();
  const jobId = String(formData.get('job_id') || '');
  const slug = String(formData.get('slug') || '');
  if (!s || s.role !== 'CANDIDATE') redirect(`/entrar?next=/vaga/${slug}`);
  const del = await sql`DELETE FROM saved_jobs WHERE user_id = ${s.uid} AND job_id = ${jobId} RETURNING job_id`;
  if (del.length === 0) {
    await sql`INSERT INTO saved_jobs (user_id, job_id) VALUES (${s.uid}, ${jobId}) ON CONFLICT DO NOTHING`;
  }
  revalidatePath('/conta');
  redirect(formData.get('back') === 'conta' ? '/conta' : `/vaga/${slug}?salva=${del.length ? '0' : '1'}`);
}

export async function createAlert(formData) {
  const s = await requireCandidate();
  const cityId = Number(formData.get('city_id')) || null;
  const categoryId = Number(formData.get('category_id')) || null;
  const model = ['ONSITE', 'HYBRID', 'REMOTE'].includes(String(formData.get('work_model'))) ? String(formData.get('work_model')) : null;
  const keyword = String(formData.get('keyword') || '').trim().slice(0, 80) || null;
  if (!cityId && !categoryId && !model && !keyword) redirect('/conta?' + qs({ erro: 'Escolha pelo menos um filtro para o alerta.' }));
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM job_alerts WHERE user_id = ${s.uid} AND is_active`;
  if (n >= 10) redirect('/conta?' + qs({ erro: 'Limite de 10 alertas ativos.' }));
  await sql`
    INSERT INTO job_alerts (user_id, city_id, category_id, work_model, keyword)
    VALUES (${s.uid}, ${cityId}, ${categoryId}, ${model}, ${keyword})`;
  redirect('/conta?ok=alerta');
}

export async function deleteAlert(formData) {
  const s = await requireCandidate();
  await sql`DELETE FROM job_alerts WHERE id = ${String(formData.get('alert_id'))} AND user_id = ${s.uid}`;
  redirect('/conta');
}
