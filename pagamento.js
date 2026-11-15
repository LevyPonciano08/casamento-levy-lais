const message = document.querySelector('.payment-message');
const params = new URLSearchParams(location.search);
const order = params.get('order_nsu');
const slug = params.get('slug');
const transaction = params.get('transaction_nsu');

async function confirmPayment() {
  if (!order || !slug || !transaction) {
    message.textContent = 'Consulte o resultado na InfinitePay. Se você já pagou, aguarde a confirmação antes de tentar novamente.';
    return;
  }
  message.textContent = 'Conferindo seu pagamento com a InfinitePay…';
  try {
    const response = await fetch('/api/check-payment', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_nsu: order, slug, transaction_nsu: transaction })
    });
    if (!response.ok) throw new Error('verification_unavailable');
    const result = await response.json();
    const messages = {
      approved: 'Pagamento confirmado! Obrigada pelo carinho. Seu presente já foi registrado para os noivos.',
      pending: 'A InfinitePay ainda não confirmou o pagamento. Se você já pagou, aguarde e consulte seu comprovante antes de tentar novamente.',
      review: 'Recebemos a confirmação do pagamento, mas precisamos conferir os detalhes. Não pague novamente; fale com os noivos.',
      refunded: 'Este pagamento consta como estornado. Consulte os detalhes na InfinitePay.'
    };
    message.textContent = messages[result.status] || messages.pending;
  } catch {
    message.textContent = 'Não conseguimos conferir o pagamento agora. Se você já pagou, guarde o comprovante e fale com os noivos antes de tentar novamente.';
  }
}
confirmPayment();
