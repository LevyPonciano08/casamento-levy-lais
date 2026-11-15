# Pagamentos InfinitePay

**Estado em 03/11/2026:** pagamentos habilitados em produção por autorização expressa do usuário, que optou por prosseguir sem o pagamento de teste. A confirmação de recebimento real ainda não foi homologada. O `.env` local permanece desativado para desenvolvimento.

O checkout do site usa a conta InfinitePay configurada pela chave privada `INFINITEPAY_API_KEY`. A chave fica somente no `.env` e nas variáveis de produção da Vercel. Nunca deve ser incluída no código público.

## Configuração

- `PAYMENT_PROVIDER=infinitepay`
- `INFINITEPAY_API_KEY`: criada em Checkout → Configurações → API Keys.
- `SITE_URL=https://casamento-levy-lais.vercel.app`
- `API_PUBLIC_URL=https://casamento-levy-lais.vercel.app/api`
- `PAYMENTS_ENABLED=true` em produção por decisão do usuário. Alterar essa variável exige novo deploy na Vercel. Para suspender o checkout, configurar `false` e publicar novamente.

A migração `002_infinitepay.sql` acrescenta campos próprios sem remover o histórico do Mercado Pago. O provedor antigo continua disponível somente se selecionado explicitamente.

## Fluxo

O site reserva o presente pelo valor calculado no banco e cria um checkout de uso único que expira com a reserva. Pix e cartão são oferecidos exclusivamente pela InfinitePay. A opção externa da Lejour foi removida a pedido do usuário. Ao escolher um presente, o formulário abre diretamente.

O webhook `/api/infinitepay-webhook` e o retorno `/api/check-payment` consultam `/payment_check` diretamente na InfinitePay. Parâmetros da URL ou mensagens recebidas não são prova de pagamento. A confirmação exige o pedido, o identificador da cobrança, a transação e o valor original correspondente. O valor pago pode incluir taxas de parcelamento.

Duplicatas não criam outro pagamento. Valor divergente ou pagamento confirmado após a expiração fica como **Revisar**. Não pagar novamente nesses casos: conferir o comprovante e o pedido com o casal. Estornos são feitos e acompanhados na conta InfinitePay; esta integração não automatiza a reconciliação de estornos.

## Homologação

Documentação oficial: https://www.infinitepay.io/checkout-documentacao

A InfinitePay não possui sandbox. Foi criado um checkout real de R$ 1 em 03/11/2026, associado a um presente técnico inativo para não aparecer no catálogo público. O estado desse teste está em `output/infinitepay-smoke.json`, ignorado pelo Git e pela Vercel. Aguardar o usuário concluir o pagamento antes de liberar pagamentos públicos. Não apagar registros financeiros de um teste pago.

Build e 17 testes automatizados passaram antes da publicação da integração. Cobrem confirmação falsa, valor divergente, taxas, duplicatas, reserva expirada e falha de rede. O teste real deve confirmar também a entrega do webhook, a página de retorno e a leitura do pedido.
