# Configuração com PostgreSQL / Neon

## Banco e API

Configure `DATABASE_URL` no `.env` local ou no ambiente privado da hospedagem e execute `npm run db:migrate`. As migrações em `server/migrations/` criam tabelas, catálogo e função transacional de reserva de presentes. Cada migração é aplicada uma vez.

O servidor usa conexões TLS com verificação do certificado quando a URL exige SSL. Nunca inclua credenciais no JavaScript público. As imagens são armazenadas no PostgreSQL e servidas por `/api/images/:id`. Novos uploads aceitam até 4 MB, dentro do limite de requisição da Vercel; imagens antigas de até 5 MB continuam preservadas no banco.

Execute `npm start`. Site e API devem usar a mesma origem para o cookie administrativo. Em produção, configure:

```dotenv
NODE_ENV=production
SITE_URL=https://seu-dominio
API_PUBLIC_URL=https://seu-dominio/api
ALLOWED_ORIGINS=https://seu-dominio
PAYMENTS_ENABLED=false
```

Se houver proxy reverso, configure `TRUST_PROXY` com a quantidade real de proxies confiáveis. O balanceador deve substituir os cabeçalhos de origem do cliente. O cookie de sessão usa HttpOnly, SameSite=Strict e Secure em produção. O servidor só publica os arquivos explicitamente permitidos, sem expor `.env`, fontes de servidor ou dependências.

## Importar os dados antigos

Faça a importação antes de aceitar novos pagamentos no Neon. O processo não apaga dados do Supabase.

Configure a conexão privada antiga como `SUPABASE_DATABASE_URL` no `.env`. Prefira uma URL que verifique o certificado TLS (`sslmode=verify-full`). Execute:

```sh
npm run db:import
```

São copiadas as tabelas `gifts`, `gift_orders`, `payment_events`, `rsvp_responses` e `admin_audit_log`. As imagens são baixadas do Storage antigo e gravadas no Neon. IDs de presentes, pedidos, referências e eventos são preservados. Referências aos usuários antigos são removidas; os administradores devem ser criados no novo sistema. A leitura do banco antigo usa um snapshot consistente e as gravações no destino ocorrem em uma transação. A importação recusa sobrescrever um destino que já contém pedidos ou uma importação completa.

Sem conexão privada, o comando tenta copiar apenas o catálogo público e suas imagens. Isso não inclui presentes ocultos, pedidos, presenças ou saldos privados. Mantenha os pagamentos desativados até concluir a importação completa e conferir os totais. Depois de importar, compare quantidades, pagamentos aprovados, valores e respostas com o banco original.

Também é possível importar com `SUPABASE_ACCESS_TOKEN` e `SUPABASE_PROJECT_REF`, sem conhecer a senha do PostgreSQL antigo. O importador faz uma única consulta de leitura pela Management API. Obtenha o token pelo fluxo autorizado do Supabase; não o grave no repositório. `IMPORT_BACKUP_PATH=output/supabase-snapshot.json` salva uma cópia local dos dados privados antes de transformá-los. Essa pasta é ignorada pelo Git.

A transferência local foi concluída após reativar o projeto antigo: 6 presentes (1 ativo e 5 arquivados), 1 pedido, 2 eventos de pagamento, 20 registros de auditoria, nenhuma resposta de presença e 1 imagem. Todos os campos dos registros foram conferidos com o snapshot, considerando apenas a remoção das referências ao Auth antigo e a troca dos caminhos das imagens. O total aprovado era zero em ambos os bancos. O backup local fica em `output/supabase-snapshot.json`; os dados originais foram preservados.

## Criar administrador

Preencha `ADMIN_EMAIL` e `ADMIN_PASSWORD` no `.env` (mínimo de 12 caracteres) e execute:

```sh
npm run admin:create
```

Remova `ADMIN_PASSWORD` depois. A conta nova não depende do Supabase Auth. O login não permite cadastro público nem reutiliza links antigos de convite/recuperação.

## Turnstile e Mercado Pago

Preencha `TURNSTILE_SECRET_KEY`, `MERCADO_PAGO_ACCESS_TOKEN` e `MERCADO_PAGO_WEBHOOK_SECRET` apenas no servidor. A chave pública Turnstile fica em `registry-config.js`; cadastre o domínio e localhost no widget. A API verifica o token e o hostname retornado pelo Turnstile.

Mantenha `MERCADO_PAGO_ENVIRONMENT=test` durante a homologação. Cadastre no Mercado Pago o novo webhook:

```text
https://seu-dominio/api/mercado-pago-webhook
```

O webhook valida assinatura e timestamp e consulta a API do Mercado Pago antes de atualizar o pedido. O servidor confere moeda e valor; notificações duplicadas não rebaixam um pedido aprovado. Teste Pix aprovado, recusado, pendente, abandono e estorno. Os testes automatizados simulam o provedor e não substituem a homologação com as credenciais reais.

Defina `PAYMENTS_ENABLED=true` somente após importar/conferir os dados e configurar os segredos. Use `MERCADO_PAGO_ENVIRONMENT=production` apenas com as credenciais de produção. A opção de cartão continua direcionando para a Lejour, como na interface anterior.

## Publicar

Use uma hospedagem que execute Node.js ou o `Dockerfile`, com HTTPS e as variáveis privadas no ambiente. Rode as migrações antes de iniciar o servidor. Não copie `.env` para a imagem. Confira `/api/health`, login, catálogo, upload e RSVP. Altere o domínio do site e o webhook somente depois de validar a nova hospedagem. O GitHub Pages anterior não é alterado até uma publicação deliberada.
