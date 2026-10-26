export const brl = (cents) =>
  cents == null ? '' : (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const dateBR = (d) =>
  d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '';

export const dateTimeBR = (d) =>
  d
    ? new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
    : '';

export const WORK_MODEL = { ONSITE: 'Presencial', HYBRID: 'Híbrido', REMOTE: 'Home office' };
export const EMPLOYMENT = {
  CLT: 'CLT', PJ: 'PJ', ESTAGIO: 'Estágio', TEMPORARIO: 'Temporário', FREELANCE: 'Freelance', APRENDIZ: 'Jovem Aprendiz',
};
export const JOB_STATUS = {
  DRAFT: 'Rascunho',
  PENDING_PAYMENT: 'Aguardando pagamento',
  PUBLISHED: 'Ativa',
  CLOSED: 'Encerrada',
  EXPIRED: 'Expirada',
  SUSPENDED: 'Suspensa',
};
export const REPORT_REASON = {
  FILLED: 'Vaga já preenchida',
  NONEXISTENT: 'Vaga inexistente',
  MISLEADING: 'Informações enganosas',
  DISCRIMINATORY: 'Conteúdo discriminatório',
  CHARGES_FEE: 'Cobra taxa do candidato',
  OTHER: 'Outro motivo',
};

export function salaryText(min, max) {
  if (min && max) return `${brl(min)} a ${brl(max)}`;
  if (min) return `A partir de ${brl(min)}`;
  if (max) return `Até ${brl(max)}`;
  return 'A combinar';
}

export function onlyDigits(s) {
  return String(s || '').replace(/\D/g, '');
}

/** Normaliza para 55 + DDD + número. Retorna null se inválido. */
export function normalizeWhatsapp(s) {
  let d = onlyDigits(s);
  if (d.length === 10 || d.length === 11) d = '55' + d;
  return /^55[0-9]{10,11}$/.test(d) ? d : null;
}

export function formatWhatsapp(d) {
  if (!d) return '';
  const m = d.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : d;
}

export function slugify(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** "1.234,56" ou "1234.56" -> centavos */
export function parseMoney(s) {
  if (s == null || String(s).trim() === '') return null;
  const n = Number(String(s).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

export function waLink(number, text) {
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
