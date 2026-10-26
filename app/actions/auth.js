'use server';

import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { sql, tx, clientIp } from '@/lib/db';
import { createSession, destroySession } from '@/lib/auth';
import { normalizeWhatsapp } from '@/lib/format';

function back(path, msg, fields = {}) {
  const p = new URLSearchParams({ erro: msg, ...fields });
  redirect(`${path}?${p.toString()}`);
}

export async function signup(formData) {
  const name = String(formData.get('legal_name') || '').trim();
  const trade = String(formData.get('trade_name') || '').trim() || null;
  const cnpjRaw = String(formData.get('cnpj') || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  const cnpj = cnpjRaw || null;
  const whatsapp = normalizeWhatsapp(formData.get('whatsapp'));
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  const cityId = Number(formData.get('city_id')) || null;
  const accepted = formData.get('terms') === 'on';
  const keep = { legal_name: name, trade_name: trade || '', cnpj: cnpjRaw, whatsapp: String(formData.get('whatsapp') || ''), email };

  if (name.length < 2) back('/cadastro', 'Informe o nome ou a razão social.', keep);
  if (cnpj && !/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj)) back('/cadastro', 'CNPJ inválido. Deixe em branco se não tiver.', keep);
  if (!whatsapp) back('/cadastro', 'WhatsApp inválido. Use DDD + número, ex.: (47) 99999-9999.', keep);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) back('/cadastro', 'E-mail inválido.', keep);
  if (password.length < 8) back('/cadastro', 'A senha precisa ter pelo menos 8 caracteres.', keep);
  if (!accepted) back('/cadastro', 'É preciso aceitar os Termos de Uso.', keep);

  const hash = await bcrypt.hash(password, 10);
  const ip = await clientIp();
  let session;
  try {
    session = await tx(null, 'app', async (t) => {
      const [u] = await t`
        INSERT INTO users (email, name, role, phone, password_hash)
        VALUES (${email}, ${name}, 'COMPANY', ${whatsapp}, ${hash}) RETURNING id`;
      await t`SELECT set_audit_context(${u.id}::uuid, 'COMPANY', 'app', ${null}, ${ip})`;
      const [c] = await t`
        INSERT INTO companies (owner_user_id, cnpj, legal_name, trade_name, whatsapp, contact_email, city_id)
        VALUES (${u.id}, ${cnpj}, ${name}, ${trade}, ${whatsapp}, ${email}, ${cityId}) RETURNING id`;
      const [terms] = await t`SELECT id FROM terms_versions WHERE is_current AND audience IN ('ALL','COMPANY') ORDER BY published_at DESC LIMIT 1`;
      if (terms) {
        await t`INSERT INTO terms_acceptances (user_id, company_id, terms_version_id, ip)
                VALUES (${u.id}, ${c.id}, ${terms.id}, ${ip}::inet)`;
      }
      return { uid: u.id, role: 'COMPANY', cid: c.id };
    });
  } catch (e) {
    if (e.code === '23505') {
      const msg = String(e.constraint_name || '').includes('cnpj')
        ? 'Este CNPJ já está cadastrado.'
        : 'Este e-mail já está cadastrado. Faça login.';
      back('/cadastro', msg, keep);
    }
    console.error(e);
    back('/cadastro', 'Não foi possível concluir o cadastro. Tente novamente.', keep);
  }
  await createSession(session);
  redirect('/painel/verificar-whatsapp');
}

export async function login(formData) {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  const next = String(formData.get('next') || '');
  const [u] = await sql`
    SELECT u.id, u.role, u.password_hash, u.is_blocked, c.id AS cid
      FROM users u LEFT JOIN companies c ON c.owner_user_id = u.id
     WHERE u.email = ${email}
     ORDER BY c.created_at
     LIMIT 1`;
  const ok = u && u.password_hash && !u.is_blocked && (await bcrypt.compare(password, u.password_hash));
  if (!ok) back('/entrar', 'E-mail ou senha incorretos.', { email });

  await sql`UPDATE users SET last_login_at = now() WHERE id = ${u.id}`;
  await createSession({ uid: u.id, role: u.role, ...(u.cid ? { cid: u.cid } : {}) });
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : null;
  redirect(safeNext || (u.role === 'ADMIN' ? '/admin' : '/painel'));
}

export async function logout() {
  await destroySession();
  redirect('/');
}
