-- Lançamento em fase gratuita: publicação sem cobrança e sem verificação por WhatsApp,
-- até que os provedores reais de PIX e WhatsApp sejam configurados.
-- Para voltar a cobrar: Admin → Configurações (preço da vaga, verificação por WhatsApp e vagas grátis iniciais).
BEGIN;
UPDATE platform_settings
   SET job_price_cents                = 0,
       whatsapp_verification_required = false,
       onboarding_free_jobs           = 0;
COMMIT;
