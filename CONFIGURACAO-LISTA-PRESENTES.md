# Configuração da lista de presentes

Esta etapa conecta a interface já pronta ao banco e ao Mercado Pago. Nenhuma chave privada deve ser colocada nos arquivos públicos do site.

## O que já está pronto

- catálogo público responsivo em `presentes.html`;
- painel administrativo em `admin.html`;
- presentes por unidade e por cotas;
- imagens no Supabase Storage;
- criação de checkout Pix/cartão no Mercado Pago;
- webhook com validação de assinatura e consulta do pagamento na API;
- proteção contra robôs com Cloudflare Turnstile validado no servidor;
- controle de quantidade, valor restante e pedidos pendentes;
- página de retorno em `pagamento.html`;
- modo de prévia, sem cobranças, ativo por padrão.

## 1. Criar o projeto Supabase

1. Acesse <https://supabase.com/dashboard> e crie um projeto.
2. Guarde o `Project ref`, exibido em **Project Settings → General**.
3. Em **Project Settings → API**, copie:
   - Project URL;
   - chave pública `publishable` (ou `anon`, em projetos antigos).
4. Nunca copie a chave `service_role` para `registry-config.js` ou para o GitHub.

## 2. Conectar e criar o banco

No PowerShell, dentro da pasta do projeto:

```powershell
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

A migração cria tabelas, regras de acesso, catálogo público, reserva de presentes e o bucket de imagens.

## 3. Criar o administrador

1. No Supabase, abra **Authentication → Users → Add user**.
2. Crie o usuário com o e-mail do casal e uma senha forte.
3. Abra **SQL Editor** e execute, trocando o e-mail:

```sql
insert into public.admin_users (user_id)
select id from auth.users where email = 'SEU_EMAIL_AQUI'
on conflict (user_id) do nothing;
```

O painel não permite cadastro público. Somente usuários presentes em `admin_users` conseguem administrar a lista.

## 4. Criar a aplicação Mercado Pago

1. Acesse <https://www.mercadopago.com.br/developers/panel/app>.
2. Crie uma aplicação de pagamentos on-line com Checkout Pro.
3. Comece com o Access Token das credenciais de teste geradas para a aplicação. Atualmente ele pode usar o prefixo `APP_USR`; confirme sempre que está na seção **Credenciais de teste** antes de copiá-lo.
4. Não coloque o Access Token no navegador, nos arquivos do site ou no GitHub.

## 5. Criar a proteção gratuita contra robôs

1. Crie uma conta gratuita em <https://dash.cloudflare.com/>.
2. Abra **Turnstile → Add widget**.
3. Cadastre `levyponciano08.github.io` e `localhost` como hostnames permitidos.
4. Guarde a Site key pública e a Secret key privada.

Essa verificação impede que chamadas automáticas reservem todos os presentes. O servidor rejeita qualquer checkout sem um token válido.

## 6. Configurar e publicar as funções

Copie o modelo de variáveis para o arquivo local já ignorado pelo Git:

```powershell
Copy-Item supabase/functions/.env.example supabase/functions/.env
notepad supabase/functions/.env
npx supabase secrets set --env-file supabase/functions/.env
npx supabase functions deploy create-checkout
npx supabase functions deploy mercado-pago-webhook
```

Preencha o arquivo `.env` com o Access Token de teste e a Secret key do Turnstile. Nesse primeiro deploy, a chave do webhook pode ser temporária até o passo seguinte. O arquivo `.env` não deve ser enviado ao GitHub.

Depois de publicar, a URL do webhook será:

```text
https://SEU_PROJECT_REF.supabase.co/functions/v1/mercado-pago-webhook
```

## 7. Cadastrar o webhook no Mercado Pago

1. Na aplicação do Mercado Pago, abra **Webhooks**.
2. Cadastre a URL acima para eventos de **Pagamentos**.
3. Copie a chave secreta gerada para validar a assinatura.
4. Substitua `MERCADO_PAGO_WEBHOOK_SECRET` no arquivo local `supabase/functions/.env` e atualize os segredos:

```powershell
npx supabase secrets set --env-file supabase/functions/.env
```

Publique novamente a função após alterar o segredo:

```powershell
npx supabase functions deploy mercado-pago-webhook
```

## 8. Conectar o navegador ao Supabase

Edite somente os valores públicos em `registry-config.js`:

```js
export const registryConfig = Object.freeze({
  supabaseUrl: 'https://SEU_PROJECT_REF.supabase.co',
  supabasePublishableKey: 'SUA_CHAVE_PUBLICA',
  createCheckoutUrl: 'https://SEU_PROJECT_REF.supabase.co/functions/v1/create-checkout',
  turnstileSiteKey: 'SUA_SITE_KEY_PUBLICA_DO_TURNSTILE',
  siteUrl: 'https://levyponciano08.github.io/casamento-levy-lais',
  demoMode: false
});
```

A URL e a chave pública podem ficar no site. O Access Token do Mercado Pago e a chave `service_role` não podem.

## 9. Testar antes de receber pagamentos reais

1. Entre em `admin.html` e cadastre um presente barato de teste.
2. Abra `presentes.html` em uma janela anônima.
3. Use os usuários e cartões de teste fornecidos pelo Mercado Pago.
4. Confira no painel se o pedido muda para `Aprovado` apenas após o webhook.
5. Teste pagamento aprovado, recusado, pendente e abandonado.
6. Confirme que quantidade e cota restante são atualizadas.

Somente depois desses testes substitua o Access Token de teste pelo Access Token de produção, atualize o webhook para produção e faça uma compra real de valor baixo.

## 10. Publicar as páginas

Quando os testes passarem, inclua no deploy do GitHub Pages:

- `presentes.html`, `registry.css`, `registry.js`, `registry-config.js`;
- `pagamento.html`;
- `admin.html`, `admin.css`, `admin.js`.

Depois disso, o botão da seção de presentes do site principal pode apontar para `presentes.html`.
