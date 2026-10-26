'use server';

import { createHash } from 'node:crypto';
import { redirect } from 'next/navigation';
import { tx, clientIp } from '@/lib/db';
import { getSession } from '@/lib/auth';

const REASONS = ['FILLED', 'NONEXISTENT', 'MISLEADING', 'DISCRIMINATORY', 'CHARGES_FEE', 'OTHER'];

export async function reportJob(formData) {
  const jobId = String(formData.get('job_id') || '');
  const slug = String(formData.get('slug') || '');
  const reason = String(formData.get('reason') || '');
  const details = String(formData.get('details') || '').slice(0, 2000) || null;
  if (!REASONS.includes(reason)) redirect(`/vaga/${slug}?denuncia=erro#denunciar`);

  const ip = (await clientIp()) || 'sem-ip';
  const ipHash = createHash('sha256').update(ip + (process.env.SESSION_SECRET || '')).digest('hex');
  const s = await getSession();

  let result = 'ok';
  try {
    await tx(s, 'app', (t) => t`
      INSERT INTO job_reports (job_id, reason, details, reporter_user_id, reporter_ip_hash)
      VALUES (${jobId}, ${reason}, ${details}, ${s?.uid ?? null}, ${ipHash})`);
  } catch (e) {
    result = e.code === '23505' ? 'dup' : 'erro';
  }
  redirect(`/vaga/${slug}?denuncia=${result}#denunciar`);
}
