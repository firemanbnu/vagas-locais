'use server';

import { randomBytes } from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql, tx, settings } from '@/lib/db';
import { requireCompany } from '@/lib/auth';
import { sendVerificationCode, whatsappDemo } from '@/lib/whatsapp';
import { createCharge, pixProvider, pixDemo } from '@/lib/pix';
import { normalizeWhatsapp, parseMoney, slugify } from '@/lib/format';

// ---------- Verificação de WhatsApp ----------

export async function sendCode() {
  const s = await requireCompany();
  let code;
  try {
    code = await tx(s, 'app', async (t) => {
      const [r] = await t`SELECT start_whatsapp_verification(${s.cid}::uuid) AS code`;
      return r.code;
    });
  } catch (e) {
    const m = String(e.message || '');
    if (m.startsWith('OTP_COOLDOWN')) redirect(`/painel/verificar-whatsapp?erro=${encodeURIComponent(`Aguarde ${m.split(':')[1]} segundos para pedir outro código.`)}`);
    if (m === 'OTP_RATE_LIMIT') redirect('/painel/verificar-whatsapp?erro=' + encodeURIComponent('Muitos códigos pedidos para este número. Tente mais tarde.'));
    if (m === 'ALREADY_VERIFIED') redirect('/painel');
    throw e;
  }

  const [c] = await sql`SELECT whatsapp FROM companies WHERE id = ${s.cid}`;
  try {
    await sendVerificationCode(c.whatsapp, code);
  } catch (e) {
    console.error(e);
    redirect('/painel/verificar-whatsapp?erro=' + encodeURIComponent('Falha ao enviar a mensagem. Tente novamente.'));
  }
  const q = new URLSearchParams({ enviado: '1' });
  if (whatsappDemo()) q.set('demo', code);
  redirect(`/painel/verificar-whatsapp?${q}`);
}

const OTP_MSG = {
  INVALID_CODE: 'Código incorreto. Confira e tente de novo.',
  EXPIRED: 'O código expirou. Peça um novo.',
  TOO_MANY_ATTEMPTS: 'Muitas tentativas erradas. Peça um novo código.',
  NO_PENDING_CODE: 'Nenhum código ativo. Peça um novo.',
  NUMBER_CHANGED: 'O número mudou depois do envio. Peça um novo código.',
};

export async function confirmCode(formData) {
  const s = await requireCompany();
  const code = String(formData.get('code') || '').replace(/\D/g, '');
  const r = await tx(s, 'app', async (t) => {
    const [x] = await t`SELECT confirm_whatsapp_verification(${s.cid}::uuid, ${code}::text) AS r`;
    return x.r;
  });
  if (r === 'VERIFIED_QUOTA_GRANTED') redirect('/painel?ok=verificado_cota');
  if (r === 'VERIFIED_NO_QUOTA') redirect('/painel?ok=verificado_sem_cota');
  redirect('/painel/verificar-whatsapp?erro=' + encodeURIComponent(OTP_MSG[r] || 'Não foi possível verificar.'));
}

export async function changeWhatsapp(formData) {
  const s = await requireCompany();
  const w = normalizeWhatsapp(formData.get('whatsapp'));
  if (!w) redirect('/painel/verificar-whatsapp?erro=' + encodeURIComponent('Número inválido.'));
  await tx(s, 'app', (t) => t`UPDATE companies SET whatsapp = ${w} WHERE id = ${s.cid}`);
  redirect('/painel/verificar-whatsapp?ok=numero');
}

// ---------- Vagas ----------

const MODELS = ['ONSITE', 'HYBRID', 'REMOTE'];
const TYPES = ['CLT', 'PJ', 'ESTAGIO', 'TEMPORARIO', 'FREELANCE', 'APRENDIZ'];
const CHANNELS = ['WHATSAPP', 'EMAIL', 'URL'];

/** Tenta publicar e redireciona conforme o resultado. */
async function publishFlow(s, jobId) {
  let result;
  try {
    result = await tx(s, 'app', async (t) => {
      const [r] = await t`SELECT request_job_publication(${jobId}::uuid) AS r`;
      return r.r;
    });
  } catch (e) {
    const m = String(e.message || '');
    if (m === 'WHATSAPP_NOT_VERIFIED') redirect('/painel/verificar-whatsapp?pendente=1');
    if (m === 'COMPANY_NOT_ACTIVE') redirect('/painel?erro=' + encodeURIComponent('Sua conta está suspensa. Fale com a administração.'));
    if (m.startsWith('INVALID_STATUS')) redirect('/painel?erro=' + encodeURIComponent('Esta vaga não pode ser publicada no status atual.'));
    throw e;
  }
  if (result !== 'PAYMENT_REQUIRED') {
    revalidatePath('/');
    redirect(`/painel?ok=${result === 'PUBLISHED_FREE_TIER' ? 'publicada_gratis' : 'publicada'}`);
  }

  // Precisa de PIX: reaproveita cobrança pendente válida ou cria uma nova
  const [pending] = await sql`
    SELECT id FROM payments WHERE job_id = ${jobId} AND status = 'PENDING' AND expires_at > now()`;
  if (!pending) {
    const st = await settings();
    const txid = randomBytes(16).toString('hex'); // 32 caracteres alfanuméricos
    const charge = await createCharge({
      txid,
      amountCents: st.job_price_cents,
      expiresInSeconds: st.pix_expiration_minutes * 60,
      description: 'Anúncio de vaga',
    });
    await tx(s, 'app', async (t) => {
      await t`UPDATE payments SET status = 'CANCELLED' WHERE job_id = ${jobId} AND status = 'PENDING'`;
      await t`
        INSERT INTO payments (company_id, job_id, provider, txid, provider_payment_id, amount_cents,
                              pix_copy_paste, qr_code_image, expires_at)
        VALUES (${s.cid}, ${jobId}, ${pixProvider()}, ${txid}, ${charge.providerPaymentId}, ${st.job_price_cents},
                ${charge.copyPaste}, ${charge.qrImage}, now() + make_interval(mins => ${st.pix_expiration_minutes}))`;
    });
  }
  redirect(`/painel/vagas/${jobId}/pagamento`);
}

export async function createJob(formData) {
  const s = await requireCompany();
  const f = (k) => String(formData.get(k) || '').trim();
  const title = f('title');
  const description = f('description');
  const cityId = Number(f('city_id'));
  const categoryId = Number(f('category_id'));
  const workModel = MODELS.includes(f('work_model')) ? f('work_model') : 'ONSITE';
  const empType = TYPES.includes(f('employment_type')) ? f('employment_type') : 'CLT';
  const openings = Math.max(1, Math.min(999, Number(f('openings')) || 1));
  const smin = parseMoney(f('salary_min'));
  const smax = parseMoney(f('salary_max'));
  const channel = CHANNELS.includes(f('apply_channel')) ? f('apply_channel') : 'WHATSAPP';
  const applyWa = channel === 'WHATSAPP' ? normalizeWhatsapp(f('apply_whatsapp')) : null;
  const applyEmail = channel === 'EMAIL' ? f('apply_email').toLowerCase() : null;
  const applyUrl = channel === 'URL' ? f('apply_url') : null;
  const intent = f('intent'); // 'publish' | 'draft'

  const fail = (m) => redirect('/painel/vagas/nova?erro=' + encodeURIComponent(m));
  if (title.length < 3 || title.length > 120) fail('O título precisa ter entre 3 e 120 caracteres.');
  if (description.length < 10) fail('Descreva a vaga (mínimo de 10 caracteres).');
  if (!cityId || !categoryId) fail('Escolha a cidade e a área da vaga.');
  if (smin && smax && smax < smin) fail('O salário máximo deve ser maior que o mínimo.');
  if (channel === 'WHATSAPP' && !applyWa) fail('Informe um WhatsApp válido para receber candidatos.');
  if (channel === 'EMAIL' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(applyEmail)) fail('Informe um e-mail válido para receber candidatos.');
  if (channel === 'URL' && !/^https:\/\//i.test(applyUrl)) fail('O link deve começar com https://');

  const slug = `${slugify(title)}-${randomBytes(3).toString('hex')}`;
  const [job] = await tx(s, 'app', (t) => t`
    INSERT INTO jobs (company_id, city_id, category_id, slug, title, description, requirements, benefits,
                      neighborhood, work_model, employment_type, openings, salary_min_cents, salary_max_cents,
                      salary_visible, apply_channel, apply_whatsapp, apply_email, apply_url)
    VALUES (${s.cid}, ${cityId}, ${categoryId}, ${slug}, ${title}, ${description}, ${f('requirements') || null},
            ${f('benefits') || null}, ${f('neighborhood') || null}, ${workModel}, ${empType}, ${openings},
            ${smin}, ${smax}, ${formData.get('hide_salary') !== 'on'}, ${channel}, ${applyWa}, ${applyEmail}, ${applyUrl})
    RETURNING id`);

  if (intent === 'draft') redirect('/painel?ok=rascunho');
  await publishFlow(s, job.id);
}

export async function publishJob(formData) {
  const s = await requireCompany();
  const id = String(formData.get('job_id'));
  const [j] = await sql`SELECT id FROM jobs WHERE id = ${id} AND company_id = ${s.cid}`;
  if (!j) redirect('/painel');
  await publishFlow(s, id);
}

export async function closeJob(formData) {
  const s = await requireCompany();
  const id = String(formData.get('job_id'));
  await tx(s, 'app', (t) => t`
    UPDATE jobs SET status = 'CLOSED' WHERE id = ${id} AND company_id = ${s.cid} AND status <> 'CLOSED'`);
  revalidatePath('/');
  redirect('/painel?ok=encerrada');
}

// Modo demonstração: simula o webhook do PSP confirmando o PIX
export async function simulatePixPayment(formData) {
  const s = await requireCompany();
  if (!pixDemo()) redirect('/painel');
  const id = String(formData.get('job_id'));
  const [p] = await sql`
    SELECT txid, amount_cents FROM payments
     WHERE job_id = ${id} AND company_id = ${s.cid} AND status = 'PENDING'
     ORDER BY created_at DESC LIMIT 1`;
  if (!p) redirect(`/painel/vagas/${id}/pagamento`);
  const e2e = 'E2EDEMO' + randomBytes(10).toString('hex');
  await sql.begin(async (t) => {
    await t`SELECT set_audit_context(${null}::uuid, 'SYSTEM', 'webhook', ${'demo-' + e2e}, ${null})`;
    await t`SELECT confirm_pix_payment('demo', ${p.txid}::text, ${e2e}::text, ${p.amount_cents}::int, now(), ${JSON.stringify({ demo: true })}::jsonb)`;
  });
  revalidatePath('/');
  redirect('/painel?ok=paga');
}
