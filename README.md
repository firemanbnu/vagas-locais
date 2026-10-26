# Vagas Locais

Plataforma de classificados de vagas de emprego locais, com expansão por cidades/regiões.

- **Stack:** Next.js (App Router), PostgreSQL (Neon), Vercel.
- **Banco:** toda a regra crítica fica no Postgres (`db/migrations/001_schema.sql`): cota grátis, verificação de WhatsApp,
  publicação, PIX idempotente, denúncias com suspensão automática, máquina de estados da vaga e auditoria imutável.

## Funcionalidades

| Área | O que tem |
|---|---|
| Pública | Busca por cargo, cidade, área e modelo; página da vaga; candidatura por WhatsApp/e-mail/link (com contagem de cliques); denúncia; termos |
| Empresa | Cadastro sem CPF (CNPJ opcional), verificação do WhatsApp por código, publicação guiada com prévia, PIX, "vaga preenchida" em 1 clique, views e cliques |
| Admin | Métricas e receita, denúncias (desativar / notificar / arquivar), vagas, empresas (suspender/banir), configurações, regiões e cidades, auditoria |

## Modo demonstração

Enquanto `WHATSAPP_PROVIDER` e `PIX_PROVIDER` estiverem vazios:

- o código de verificação aparece na tela, em vez de ir pelo WhatsApp;
- o PIX gera um "copia e cola" fictício e a tela tem o botão **Simular pagamento confirmado**, que percorre o mesmo caminho do webhook.

Para produção:

- **WhatsApp:** `WHATSAPP_PROVIDER=meta`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` e um modelo de autenticação aprovado (`WHATSAPP_TEMPLATE`).
- **PIX:** implemente `createCharge`/`getCharge` em `lib/pix.js` para o PSP (Efí ou Mercado Pago), defina `PIX_PROVIDER`
  e `PIX_WEBHOOK_SECRET`, e cadastre o webhook `https://SEU_DOMINIO/api/webhooks/pix/<provider>?token=<PIX_WEBHOOK_SECRET>`.

## Variáveis de ambiente

Veja `.env.example`. As migrações rodam sozinhas no `npm run build` (inclusive na Vercel). Na primeira execução, é criado
o administrador definido em `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

## Rodar localmente

```bash
npm install
cp .env.example .env.local   # preencha DATABASE_URL e SESSION_SECRET
npm run migrate
npm run dev
```
