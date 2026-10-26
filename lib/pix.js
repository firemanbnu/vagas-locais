// Cobrança PIX.
// Sem PIX_PROVIDER configurado, roda em MODO DEMONSTRAÇÃO: gera um
// "copia e cola" fictício e a tela oferece um botão para simular o pagamento.
// Para produção, implemente createCharge/getCharge do PSP escolhido
// (Efí: POST /v2/cob/{txid}; Mercado Pago: POST /v1/payments com payment_method_id=pix).
export const pixDemo = () => !process.env.PIX_PROVIDER;
export const pixProvider = () => process.env.PIX_PROVIDER || 'demo';

export async function createCharge({ txid, amountCents, expiresInSeconds, description }) {
  if (pixDemo()) {
    const valor = (amountCents / 100).toFixed(2);
    return {
      providerPaymentId: `demo-${txid}`,
      copyPaste: `00020126DEMONSTRACAO-NAO-PAGUE-${txid}5204000053039865406${valor}5802BR`,
      qrImage: null,
    };
  }
  throw new Error(`PIX_PROVIDER "${process.env.PIX_PROVIDER}" ainda não implementado`);
}

/** Consulta a cobrança no PSP (fonte da verdade no webhook). */
export async function getCharge(txid) {
  if (pixDemo()) return null;
  throw new Error('getCharge não implementado');
}
