// Envio do código de verificação.
// Sem WHATSAPP_PROVIDER configurado, roda em MODO DEMONSTRAÇÃO:
// o código é devolvido para ser exibido na tela.
export const whatsappDemo = () => !process.env.WHATSAPP_PROVIDER;

export async function sendVerificationCode(to, code) {
  if (whatsappDemo()) return { demo: true };

  if (process.env.WHATSAPP_PROVIDER === 'meta') {
    // WhatsApp Cloud API — modelo de AUTENTICAÇÃO aprovado na Meta
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: process.env.WHATSAPP_TEMPLATE || 'codigo_verificacao',
            language: { code: 'pt_BR' },
            components: [
              { type: 'body', parameters: [{ type: 'text', text: code }] },
              { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
            ],
          },
        }),
      }
    );
    if (!res.ok) throw new Error(`WHATSAPP_SEND_FAILED: ${res.status} ${await res.text()}`);
    return { demo: false };
  }

  throw new Error('WHATSAPP_PROVIDER desconhecido');
}
