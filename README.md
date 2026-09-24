# Casamento de Levy & Laís

Site de casamento responsivo para Levy e Laís. A cerimônia será em 9 de janeiro de 2027, às 15h30, no Porto Cabeção, em Aracati/CE.

## Publicação

O site é publicado pelo GitHub Pages a cada atualização enviada para a branch `main`. O fluxo inclui o site principal, a lista de presentes, a página de retorno do pagamento, o painel administrativo e seus arquivos de estilo e scripts.

## Desenvolvimento

Abra `index.html` no navegador ou execute um servidor local na pasta do projeto.

O formulário de RSVP envia as respostas à Edge Function `submit-rsvp` no Supabase. As respostas ficam disponíveis apenas para administradores autenticados no painel.
