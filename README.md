# Casamento de Levy & Laís

Site do casamento em 9 de janeiro de 2027, às 15h30, no Porto Cabeção, em Aracati/CE.

O site e a API usam Node.js e PostgreSQL (Neon). O servidor entrega as páginas, autentica administradores, salva imagens, recebe confirmações de presença e integra pagamentos Pix com Mercado Pago. O navegador acessa `/api`; a conexão do banco fica apenas no servidor.

## Executar

Use Node.js 24 ou superior. Copie `.env.example` para `.env`, preencha `DATABASE_URL` e execute:

```sh
npm ci
npm run db:migrate
npm start
```

Abra <http://localhost:3000> ou <http://localhost:3000/admin.html>. O arquivo `.env` é ignorado pelo Git. Não use um servidor estático para esta versão.

Para criar um administrador, preencha `ADMIN_EMAIL` e `ADMIN_PASSWORD` no ambiente local, execute `npm run admin:create` e remova a senha do ambiente. As senhas são armazenadas com scrypt; as sessões expiram após oito horas e ficam no PostgreSQL.

## Dados e pagamentos

Veja [CONFIGURACAO-LISTA-PRESENTES.md](CONFIGURACAO-LISTA-PRESENTES.md) para importar o banco antigo, configurar Turnstile e Mercado Pago e publicar o servidor.

O código em `supabase/` e o documento `PLANO-LISTA-PRESENTES.md` são referências históricas. A aplicação atual não usa o SDK, Auth, Storage nem Edge Functions do Supabase.

## Verificação

```sh
npm test
```

Os testes usam o PostgreSQL configurado, criam registros temporários e os removem ao terminar. Os serviços de pagamento e Turnstile são simulados nos testes; nenhuma cobrança é criada. O CI usa um PostgreSQL isolado.

## Publicação

Hospede o servidor Node.js e as páginas na mesma origem HTTPS. Há um `Dockerfile` pronto. GitHub Pages não executa a API; o workflow agora verifica a aplicação e não publica uma versão incompatível no Pages. Nenhuma alteração é enviada ou publicada automaticamente pelo desenvolvimento local.
