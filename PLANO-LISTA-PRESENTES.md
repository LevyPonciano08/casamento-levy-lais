# Plano da lista de presentes

## Decisão recomendada

Manter o site público no GitHub Pages e acrescentar:

- Supabase para banco de dados, autenticação do painel, armazenamento das fotos e funções de servidor;
- Mercado Pago Checkout Pro para receber por Pix e cartão;
- HTML, CSS e JavaScript existentes no site, sem migração para React ou Next.js nesta etapa.

Essa combinação exige menos reescrita, mantém a hospedagem do site em R$ 0 e evita que o nosso código receba ou armazene dados de cartão. O Checkout Pro abre o ambiente seguro do Mercado Pago e devolve o convidado ao site após o pagamento.

Não existe processamento de cartão realmente gratuito. Mercado Pago não exige mensalidade para integrar o checkout, mas desconta uma taxa de cada pagamento. O valor depende do método e do prazo de liberação configurado na conta.

## Arquitetura

```text
Convidado
   |
   v
Site público no GitHub Pages
   | lista de presentes
   v
Supabase Database + Storage
   |
   | criar pagamento (função protegida)
   v
Mercado Pago Checkout Pro
   |
   | webhook assinado
   v
Supabase Edge Function ---> atualiza pagamento e disponibilidade do presente

Administrador
   |
   v
/admin (login Supabase Auth)
   |
   v
Adicionar, editar, ordenar, ocultar e acompanhar presentes e pagamentos
```

## Funcionalidades do convidado

- catálogo responsivo com imagem, nome, descrição e valor;
- identificação de presente disponível, reservado ou já presenteado;
- busca e filtros opcionais por faixa de preço e categoria;
- página ou janela de detalhes;
- botão `Presentear`;
- identificação do convidado, mensagem aos noivos e opção de manter o nome oculto na lista pública;
- redirecionamento ao Mercado Pago, onde o convidado escolhe Pix ou cartão;
- páginas de retorno para pagamento aprovado, pendente ou recusado;
- confirmação definitiva somente após o webhook do Mercado Pago;
- proteção contra duas pessoas comprarem simultaneamente a última unidade.

## Funcionalidades do painel

- login restrito aos noivos;
- criar e editar presente;
- nome, descrição, categoria, imagem, valor em centavos, quantidade e ordem de exibição;
- ativar, ocultar e arquivar presentes sem apagar o histórico;
- permitir presente completo ou cotas/contribuições, se essa modalidade for ativada;
- visualizar pagamentos pendentes, aprovados, recusados e reembolsados;
- visualizar nome, mensagem e valor do convidado;
- exportar pagamentos aprovados em CSV;
- registrar alterações importantes do painel.

## Estrutura inicial dos dados

### gifts

- `id`
- `title`
- `description`
- `category`
- `price_cents`
- `image_path`
- `quantity_total`
- `quantity_paid`
- `allow_partial`
- `minimum_contribution_cents`
- `is_active`
- `sort_order`
- `created_at`
- `updated_at`

### orders

- `id`
- `gift_id`
- `guest_name`
- `guest_email`
- `guest_message`
- `amount_cents`
- `quantity`
- `status` (`created`, `pending`, `approved`, `rejected`, `cancelled`, `refunded`, `expired`)
- `mercado_pago_preference_id`
- `mercado_pago_payment_id`
- `external_reference`
- `expires_at`
- `created_at`
- `updated_at`

### admin_audit_log

- `id`
- `admin_user_id`
- `action`
- `entity_type`
- `entity_id`
- `metadata`
- `created_at`

## Endpoints/funções

- `GET /gifts`: lista apenas presentes ativos e dados públicos;
- `POST /create-checkout`: valida o presente e o preço diretamente no banco, cria a ordem e a preferência do Mercado Pago;
- `POST /mercado-pago-webhook`: valida a origem da notificação, consulta o pagamento no Mercado Pago e atualiza a ordem;
- operações administrativas de presentes exigem usuário autenticado e autorizado.

O navegador nunca poderá enviar o preço final como fonte de verdade. A função de servidor buscará o valor no banco. O Access Token do Mercado Pago ficará somente nos segredos do Supabase.

## Segurança e consistência

- usar credenciais de teste antes das credenciais de produção;
- nunca colocar Access Token do Mercado Pago no HTML ou no GitHub;
- validar assinatura e conteúdo dos webhooks;
- usar `external_reference` única e chave de idempotência;
- confirmar pagamento pelo webhook/API, nunca apenas pelos parâmetros da URL de retorno;
- políticas RLS: público somente lê presentes ativos; somente administradores alteram catálogo e leem pedidos;
- reservar a quantidade por prazo curto e liberar reservas expiradas;
- não armazenar número, validade ou código de segurança do cartão;
- limitar tamanho e tipo das imagens enviadas pelo painel;
- manter opção de reembolso e histórico do pagamento.

## Custos e limites

- GitHub Pages: permanece gratuito para o site estático.
- Supabase Free: 500 MB de banco, 1 GB de arquivos, 50.000 usuários ativos/mês e 500.000 chamadas de Edge Functions, suficientes para uma lista de casamento pequena.
- Atenção: projetos gratuitos do Supabase podem ser pausados após uma semana de pouca atividade. Antes de enviar os convites, deve-se avaliar o plano Pro ou acompanhar o projeto para garantir disponibilidade.
- Mercado Pago: integração sem mensalidade fixa informada, porém com taxas por transação e por parcelamento/prazo de recebimento. As taxas exatas aparecem no painel da conta.

Uma alternativa sem pausa automática é Cloudflare Workers + D1 + R2, cujos planos gratuitos suportam 100.000 requisições por dia, 5 GB em D1 e 10 GB em R2. Ela exige construir e manter autenticação administrativa adicional, portanto não é a primeira escolha para este projeto.

## Etapas de implementação

1. Criar e configurar o projeto Supabase.
2. Criar tabelas, políticas de segurança, usuário administrador e bucket de imagens.
3. Construir o painel `/admin` e o cadastro de presentes.
4. Substituir a seção “Em breve” pelo catálogo real.
5. Criar a integração Mercado Pago em ambiente de teste.
6. Implementar webhook, reservas, confirmação e páginas de retorno.
7. Testar cartão aprovado, recusado e pendente, além do fluxo Pix.
8. Revisar mobile, acessibilidade, mensagens de erro e concorrência.
9. Inserir credenciais de produção e realizar uma compra real de baixo valor.
10. Publicar e acompanhar os primeiros pagamentos.

## O que será necessário do casal

- conta Mercado Pago verificada em nome de quem receberá os valores;
- chave Pix cadastrada nessa conta;
- criação de uma aplicação em “Suas integrações” do Mercado Pago;
- conta Supabase e um novo projeto;
- e-mail que terá acesso ao painel administrativo;
- decisão sobre presentes únicos, quantidade maior que um e contribuições parciais;
- política para presentes pagos: esconder, marcar como presenteado ou continuar aceitando novas unidades;
- texto de contato e política de cancelamento/reembolso.

Não enviar credenciais privadas em mensagens ou salvar no repositório. Elas serão cadastradas diretamente como segredos do ambiente.

## Referências oficiais consultadas

- Mercado Pago — Checkout Pro: https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/overview
- Mercado Pago — preferências: https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-pro-preferences/overview
- Mercado Pago — URLs de retorno: https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/configure-back-urls
- Mercado Pago — webhooks: https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/notifications
- Mercado Pago — testes: https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/integration-test/test-purchases
- Supabase — preços e limites: https://supabase.com/pricing
- Supabase — Edge Functions: https://supabase.com/docs/guides/functions
- Supabase — pausa de projetos gratuitos: https://supabase.com/docs/guides/platform/free-project-pausing
- Cloudflare Workers — limites: https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare D1 — preços: https://developers.cloudflare.com/d1/platform/pricing/
- Cloudflare R2 — preços: https://developers.cloudflare.com/r2/pricing/
