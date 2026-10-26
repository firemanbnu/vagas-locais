'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { tx } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { parseMoney } from '@/lib/format';

const int = (v, d) => {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : d;
};

export async function saveSettings(formData) {
  const s = await requireAdmin();
  const price = parseMoney(formData.get('job_price'));
  try {
    await tx(s, 'admin', (t) => t`
      UPDATE platform_settings SET
        job_price_cents               = ${price ?? 0},
        onboarding_free_jobs          = ${int(formData.get('onboarding_free_jobs'), 0)},
        job_duration_days             = ${int(formData.get('job_duration_days'), 30)},
        pix_expiration_minutes        = ${int(formData.get('pix_expiration_minutes'), 30)},
        auto_suspend_report_threshold = ${int(formData.get('auto_suspend_report_threshold'), 3)},
        whatsapp_verification_required = ${formData.get('whatsapp_verification_required') === 'on'},
        otp_ttl_minutes               = ${int(formData.get('otp_ttl_minutes'), 10)},
        otp_max_attempts              = ${int(formData.get('otp_max_attempts'), 5)},
        updated_by                    = ${s.uid}`);
  } catch (e) {
    redirect('/admin/configuracoes?erro=' + encodeURIComponent('Valor fora do permitido: ' + (e.constraint_name || e.message)));
  }
  redirect('/admin/configuracoes?ok=1');
}

export async function moderate(formData) {
  const s = await requireAdmin();
  const action = String(formData.get('action'));
  if (!['JOB_DEACTIVATED', 'COMPANY_NOTIFIED', 'ARCHIVED'].includes(action)) redirect('/admin/denuncias');
  await tx(s, 'admin', (t) => t`
    SELECT moderate_report(${String(formData.get('report_id'))}::uuid, ${action}::report_status, ${s.uid}::uuid, ${String(formData.get('note') || '') || null}::text)`);
  revalidatePath('/');
  redirect('/admin/denuncias?ok=' + action);
}

export async function setJobStatus(formData) {
  const s = await requireAdmin();
  const status = String(formData.get('status'));
  if (!['SUSPENDED', 'PUBLISHED', 'CLOSED'].includes(status)) redirect('/admin/vagas');
  try {
    await tx(s, 'admin', (t) => t`
      UPDATE jobs SET status = ${status}::job_status,
             suspended_reason = ${status === 'SUSPENDED' ? 'ADMIN' : null}
       WHERE id = ${String(formData.get('job_id'))}`);
  } catch (e) {
    redirect('/admin/vagas?erro=' + encodeURIComponent(e.message));
  }
  revalidatePath('/');
  redirect('/admin/vagas?ok=1');
}

export async function setCompanyStatus(formData) {
  const s = await requireAdmin();
  const status = String(formData.get('status'));
  if (!['ACTIVE', 'SUSPENDED', 'BANNED'].includes(status)) redirect('/admin/empresas');
  await tx(s, 'admin', (t) => t`
    UPDATE companies SET status = ${status}::company_status,
           status_reason = ${String(formData.get('reason') || '') || null}
     WHERE id = ${String(formData.get('company_id'))}`);
  revalidatePath('/');
  redirect('/admin/empresas?ok=1');
}

export async function toggleCity(formData) {
  const s = await requireAdmin();
  await tx(s, 'admin', (t) => t`UPDATE cities SET is_active = NOT is_active WHERE id = ${int(formData.get('city_id'), 0)}`);
  revalidatePath('/');
  redirect('/admin/regioes');
}

export async function toggleRegion(formData) {
  const s = await requireAdmin();
  await tx(s, 'admin', (t) => t`
    UPDATE regions SET is_active = NOT is_active, launched_at = coalesce(launched_at, now())
     WHERE id = ${int(formData.get('region_id'), 0)}`);
  revalidatePath('/');
  redirect('/admin/regioes');
}

function slug(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export async function addCity(formData) {
  const s = await requireAdmin();
  const name = String(formData.get('name') || '').trim();
  const state = String(formData.get('state') || 'SC').trim().toUpperCase().slice(0, 2);
  if (!name) redirect('/admin/regioes');
  try {
    await tx(s, 'admin', (t) => t`
      INSERT INTO cities (region_id, name, slug, state, is_active)
      VALUES (${int(formData.get('region_id'), 0)}, ${name}, ${slug(name)}, ${state}, true)`);
  } catch (e) {
    redirect('/admin/regioes?erro=' + encodeURIComponent(e.code === '23505' ? 'Cidade já existe.' : e.message));
  }
  redirect('/admin/regioes?ok=1');
}

export async function addRegion(formData) {
  const s = await requireAdmin();
  const name = String(formData.get('name') || '').trim();
  const state = String(formData.get('state') || 'SC').trim().toUpperCase().slice(0, 2);
  if (!name) redirect('/admin/regioes');
  try {
    await tx(s, 'admin', (t) => t`
      INSERT INTO regions (name, slug, state, is_active) VALUES (${name}, ${slug(name)}, ${state}, false)`);
  } catch (e) {
    redirect('/admin/regioes?erro=' + encodeURIComponent(e.code === '23505' ? 'Região já existe.' : e.message));
  }
  redirect('/admin/regioes?ok=1');
}
