# Voltar ao visual anterior

Backup criado antes de qualquer alteração deste redesign:

`C:\Users\Levy\backups-casamento\antes-redesign-20261031-204232`

Abra a pasta e dê dois cliques em **RESTAURAR.cmd**. O script primeiro guarda os arquivos atuais em outra pasta `redesign-antes-de-restaurar-DATA-HORA` e então copia os arquivos do front end anterior de volta ao projeto. Ele não restaura o banco de dados, credenciais ou arquivos de configuração do servidor.

Depois, atualize o navegador com **Ctrl + F5**. Para regenerar a pasta de publicação, execute `npm.cmd run build` na pasta do projeto. Nada é publicado automaticamente.

O backup preserva o estado local anterior ao redesign, incluindo a correção do botão flutuante de presentes. Dependências instaladas, histórico do Git, capturas de testes e a pasta `public/` gerada foram excluídos da cópia; os arquivos de código, fotos, configurações e o lockfile foram copiados. O backup deve ficar apenas no computador: contém as configurações locais.

Os novos arquivos `assets/experience.css` e `assets/experience.js` ficam sem uso após a restauração, pois as páginas anteriores não os carregam. Assim, não é preciso apagar arquivos para voltar ao visual anterior.
