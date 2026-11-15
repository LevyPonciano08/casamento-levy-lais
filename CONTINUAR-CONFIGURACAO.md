# Retomada atual — pausa em 03/11/2026

Leia primeiro o resumo consolidado no início de MEMORIA-SITE-CASAMENTO.md. Site já publicado e pagamentos habilitados por decisão expressa sem teste real. Primeira pendência: usuário relatou imagem da aba ausente após alterar título para Laís & Levy; ainda não diagnosticada/corrigida. Não continuar alterações até ele retomar. O histórico abaixo está parcialmente desatualizado.

---

# Retomar a configuração

## Pausa solicitada pelo usuário — 31/10/2026

O usuário pediu para guardar o estado e continuar depois. Não prosseguir com configuração, publicação ou cobranças até ele retomar.

### Ponto exato de retomada

Começamos a primeira pendência, **confirmação de presença com Turnstile**. A janela da Cloudflare foi reaberta, mas o login ainda não foi confirmado. Nenhuma chave secreta foi obtida ou configurada; nenhuma presença de teste foi enviada nesta etapa.

- Pedir ao usuário para concluir o login na janela da Cloudflare quando retomar. Não pedir sua senha no chat.
- A sessão Playwright antiga `setup` não está disponível. A janela atual usa Chromium com perfil persistente ignorado pelo Git em `output/cloudflare-auth` e CDP local `http://127.0.0.1:9223`; não presumir que continuará aberta.
- Para reabrir: `node output/playwright/cloudflare-setup.cjs`. Se o navegador já estiver aberto, usar `node output/playwright/reopen-cloudflare.cjs`. Esses scripts usam o Playwright local e o Chromium instalado; o Chrome padrão não foi encontrado e a tentativa via Edge CLI não foi confiável.
- Após autenticar: localizar o widget correspondente à chave pública de `registry-config.js`, conferir hostnames (localhost e depois o domínio definitivo) e guardar a chave secreta somente no `.env` privado. Não imprimir o segredo em logs, snapshots ou mensagens.
- Reiniciar o servidor para recarregar o ambiente e validar uma confirmação real, seu registro e a leitura no painel, limpando apenas os dados técnicos de teste. O fato de o widget aparecer não comprova validação no servidor.
- Só depois seguir para Mercado Pago, publicação e demais itens de `PENDENCIAS-SITE.md`, na ordem aprovada pelo usuário.

### Estado atual confirmado

- Banco local/API conectados; catálogo real tem um presente público: Kit copo, R$ 50, sem imagem.
- `TURNSTILE_SECRET_KEY`, `MERCADO_PAGO_ACCESS_TOKEN` e `MERCADO_PAGO_WEBHOOK_SECRET` ausentes na última verificação; `PAYMENTS_ENABLED=false` e Mercado Pago em teste. Nunca substituir isso por chaves de demonstração como se fossem configuração final.
- Redesign cinematográfico concluído localmente: fotos grandes, transições, carrossel com pausa, alternativa de movimento reduzido e botão de presentes persistente. Layouts verificados no computador e celular, incluindo 320 × 568.
- **Cor obrigatória: azul serenity `#A7BED3`. Nome da noiva sempre primeiro: Laís & Levy.**
- Capa escolhida: `C:/Users/Levy/Downloads/IMG_2682.HEIF`, convertida para `img/capa-principal.jpg`; original preservado.
- As quatro páginas já usam Laís primeiro. Ainda há nomes na ordem antiga nos textos enviados ao Mercado Pago em `server/payments.js`; essa pendência consta na revisão.
- Backup anterior ao redesign: `C:/Users/Levy/backups-casamento/antes-redesign-20261031-204232`. `RESTAURAR.cmd` guarda o redesign antes de restaurar; processo testado em pasta isolada. Instruções: `RESTAURAR-VISUAL.md`.
- Há muitas alterações locais anteriores à sessão, ainda sem commit/publicação. Preservá-las; não fazer reset ou limpeza geral.
- Documentação: `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json` e `PENDENCIAS-SITE.md`. Evidências de verificação em `output/playwright/`.

## Concluído

- Git e SSH do GitHub instalados/configurados.
- Aplicação migrada para Node.js/Express e PostgreSQL no Neon.
- Dados antigos importados e conferidos: 6 presentes (1 ativo), 1 pedido, 2 eventos de pagamento, 20 registros de auditoria, nenhuma presença e 1 imagem.
- Administrador criado com o e-mail informado; senha armazenada com scrypt.
- Os 10 testes passaram após os ajustes para Vercel.
- Entrada Express, build dos arquivos públicos e configuração da Vercel preparados; build local validado.
- Ambiente local preparado no `.env`, ignorado pelo Git. Pagamentos desativados e ambiente Mercado Pago definido como teste.

## Próximos passos

1. Retomar primeiro o login na Cloudflare conforme o ponto exato acima. Depois concluir o login no Mercado Pago. O usuário confirmou que deseja manter o Turnstile.
2. Obter o Access Token de teste do Mercado Pago, a assinatura secreta do webhook e a chave secreta Turnstile. Não imprimir esses valores nem gravá-los em arquivos públicos.
3. Refazer `npx vercel login` se necessário. O usuário escolheu a Vercel, mas a autorização não foi concluída/verificada; o comando pendente foi interrompido a pedido do usuário.
4. Revisar o gerenciamento do pool PostgreSQL para Vercel Fluid Compute (`attachDatabasePool`, conforme documentação oficial). Ainda não foi acrescentado.
5. Configurar as variáveis privadas na Vercel e as URLs/hostnames definitivos no servidor, Turnstile e webhook do Mercado Pago.
6. Publicar e conferir saúde do banco, login, catálogo, imagens e RSVP. Homologar pagamentos com as credenciais de teste antes de habilitar cobranças reais.

## Estado local

- Projeto: `C:\Users\Levy\casamento-levy-lais`.
- Site local: `http://localhost:3000`; painel: `/admin.html`. Se necessário, iniciar com `npm start`.
- Backup privado da origem: `output/supabase-snapshot.json`, ignorado pelo Git.
- O Supabase antigo foi reativado para a cópia e seus dados foram preservados.
- Não houve commit, push ou publicação na Vercel.

## Publicação — 02/11/2026

- Usuário autorizou avançar com a publicação na Vercel e solicitar apenas intervenções indispensáveis.
- CLI Vercel 65.10.0 instalada via npx; conta ainda não autenticada. Fluxo `vercel login` iniciado, aguardando autorização pessoal pelo navegador. Se expirar, iniciar um novo login.
- Ajustado `server/db.js` com `attachDatabasePool` da dependência `@vercel/functions` quando executado na Vercel.
- `registry-config.js` usa a origem atual em vez do endereço antigo do GitHub Pages.
- Exclusões de upload reforçadas em `.vercelignore`; `.env`, histórico privado e evidências locais não devem ser enviados.
- Após os ajustes, os 10 testes passaram, build concluído e instalação auditada sem vulnerabilidades.
- DATABASE_URL e TURNSTILE_SECRET_KEY presentes no ambiente privado; pagamentos continuam desativados.
- Publicação ainda não executada: falta login Vercel. Depois vincular/criar projeto, obter domínio definitivo, transferir somente variáveis necessárias privadamente, configurar SITE_URL/API_PUBLIC_URL/ALLOWED_ORIGINS/NODE_ENV/TRUST_PROXY e PAYMENTS_ENABLED=false, conferir hostname Turnstile, publicar e validar páginas/API/RSVP/painel.
- A escolha atual de pagamentos é InfinitePay; referências antigas a Mercado Pago não representam a integração futura.

## Nova pausa solicitada — 02/11/2026

Usuário pediu para salvar e fazer depois. Preparação local concluída; publicação não realizada. Interrompida a tentativa de login Vercel. Na retomada, gerar novo link de autenticação (não reutilizar o código anterior) e continuar conforme a seção Publicação de 02/11. Nenhum segredo registrado nestes documentos.
