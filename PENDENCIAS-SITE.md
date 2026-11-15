# O que falta para o site ficar pronto

## Atualização — 02/11/2026

- Turnstile: chave secreta configurada no ambiente privado local. O usuário concluiu uma confirmação real pelo navegador; registro “Teste técnico RSVP”, com presença confirmada, verificado no PostgreSQL em 02/11/2026. Ainda falta conferir sua exibição no painel e validar o domínio definitivo após a publicação. O registro técnico foi preservado.
- Pagamentos: por decisão do usuário, a próxima integração será InfinitePay, substituindo a configuração prevista com Mercado Pago. Ainda não implementada nem habilitada.
- A lista abaixo preserva o diagnóstico de 31/10/2026; as atualizações acima prevalecem sobre seu estado antigo.

Revisão local em 31/10/2026. Inspeção do código, presença de configurações privadas sem expor seus valores e navegação em Chromium nas larguras 1440, 390 e 320px. Nenhuma presença, cobrança ou alteração no banco foi criada. Nenhum código funcional foi alterado nesta revisão.

## Prioridades

### 1. [P0] Fazer a confirmação de presença funcionar de ponta a ponta

`TURNSTILE_SECRET_KEY` não está preenchida no ambiente local. A chave pública existe e o formulário aparece, mas o servidor exige a chave secreta em `server/payments.js`, na função `verifyHuman`, antes de salvar a resposta. A ausência bloqueia a confirmação real, mesmo quando o widget aparece normalmente.

**Falta:** configurar o segredo no servidor e cadastrar os hostnames corretos; depois validar uma resposta autorizada e sua exibição no painel. Usar `$impeccable harden` para a validação do fluxo e das mensagens de indisponibilidade.

### 2. [P1] Concluir o pagamento por Pix

`PAYMENTS_ENABLED=false`. As credenciais `MERCADO_PAGO_ACCESS_TOKEN` e `MERCADO_PAGO_WEBHOOK_SECRET` também estão ausentes no ambiente local. O ambiente está em teste. Abrir o formulário Pix funciona visualmente; concluir o checkout ainda depende dessa configuração.

**Falta:** concluir configuração do Mercado Pago e webhook, homologar aprovação, pendência, falha e atualização no painel antes de habilitar pagamentos reais. O cartão continua sendo um fluxo separado na Lejour; sua compra externa não foi testada nesta revisão. Usar `$impeccable harden` para os estados do fluxo.

### 3. [P1] Concluir e verificar a publicação definitiva

O projeto tem configuração e build preparados para Vercel. O documento `CONTINUAR-CONFIGURACAO.md` registra que a autorização/publicação não foi concluída, e não há vínculo local `.vercel/project.json`. Isso não prova ausência de um deploy remoto: a publicação definitiva permanece **não verificada** nesta revisão. O `siteUrl` público do código ainda aponta para o GitHub Pages antigo.

**Falta:** confirmar hospedagem e endereço público, configurar as variáveis privadas e os endereços de retorno/webhook, cadastrar o domínio no Turnstile e testar banco, login, imagens, RSVP e pagamentos nessa origem. Os testes anteriores de interface com respostas simuladas não substituem essa homologação.

### 4. [P2] Revisar e completar a lista de presentes

A API real respondeu com um único presente público: **Kit copo**, R$ 50, sem imagem. O histórico de importação registra outros itens arquivados, cuja reativação depende da decisão do casal.

**Falta:** decidir quais presentes serão oferecidos e revisar fotos, títulos, valores, quantidades e categorias no painel. Não é obrigatório publicar uma quantidade específica de itens.

### 5. [P2] Substituir informações provisórias sobre o casamento

Em `index.html`, traje ainda está “Em breve”; crianças, estacionamento e prazo da confirmação ainda não têm respostas definitivas. Acompanhantes dependem do convite individual.

**Falta:** o casal definir essas informações e atualizar os textos, sem inventar regras. Usar `$impeccable clarify` para tornar as orientações finais claras.

### 6. [P2] Preparar a prévia de compartilhamento

As páginas têm títulos e descrições, mas não possuem `og:image` para indicar uma imagem de compartilhamento. A aparência do cartão no WhatsApp não foi homologada.

**Falta:** configurar título, descrição, imagem e URL de compartilhamento no endereço público e conferir a prévia. A imagem da capa atual pode servir de base, se o casal desejar.

### 7. [P2] Reduzir o peso de algumas imagens

A foto `img/IMG_1324.jpeg`, usada na história, tem aproximadamente **5,7 MB**. O ícone da cesta tem aproximadamente **994 KB** e o monograma PNG, **612 KB**, apesar de aparecerem pequenos. A capa JPEG nova tem cerca de 410 KB.

**Falta:** criar versões adequadas ao tamanho exibido, preservando os originais e a aparência das fotos. Usar `$impeccable optimize` e conferir a qualidade no celular.

### 8. [P2] Finalizar a ordem dos nomes nos textos do provedor de pagamento

As quatro páginas exibem **Laís & Levy**, como solicitado. Em `server/payments.js`, porém, a descrição alternativa do item ainda usa “Presente para Levy e Laís” e o descritor está como `LEVY E LAIS`.

**Falta:** revisar esses dois textos antes de habilitar o Mercado Pago, mantendo os endereços existentes das integrações. Usar `$impeccable clarify` para manter a nomenclatura consistente.

## O que já está funcionando na revisão local

- Banco conectado: `/api/health` retornou `database: connected`.
- Catálogo público real carregando pela API.
- As quatro páginas abriram sem erros JavaScript ou rolagem horizontal nas três larguras verificadas.
- Nenhuma imagem carregada quebrada ou sem atributo `alt` nas páginas visitadas.
- Formulário Pix e seleção do presente abrem; a transação não foi iniciada.
- Capa escolhida pelo usuário, azul serenity e ordem dos nomes presentes na interface.
- Backup e restauração já preparados; restauração previamente testada em pasta isolada.

## Qualidade técnica da interface

Pontuação indicativa do escopo inspecionado; não representa aprovação para publicação nem auditoria completa de acessibilidade.

| Dimensão | Nota / 4 | Observação |
|---|---:|---|
| Acessibilidade | 3 | Alt e formulários identificados; há foco e alternativa de movimento reduzido. Leitores de tela e cobertura completa de contraste não foram testados. |
| Desempenho | 2 | Implementação leve, mas algumas imagens são grandes para uso no celular. |
| Tema | 2 | Azul serenity aplicado; ainda há valores diretos e regras antigas sobrepostas que podem ser consolidados. |
| Responsividade | 3 | Sem overflow nos tamanhos medidos; faltam dispositivos físicos e outros motores de navegador. |
| Integridade visual | 3 | Identidade coerente; documentação de tokens não cobre todas as variações efetivamente usadas. |
| **Total** | **13 / 20** | **Aceitável, com pendências funcionais que bloqueiam a conclusão.** |

O detector foi executado e os resultados foram separados das conclusões confirmadas. Seus alertas de texto branco sobre fundo claro não consideram adequadamente o fundo fotográfico com sobreposição na abertura; não foram tratados como falhas de contraste confirmadas. Variações de tamanho, raios e transparências fora da documentação são indícios de manutenção, não prova de problema visível. Os links pequenos do rodapé não foram classificados automaticamente como violações: espaçamento e contexto também precisam ser avaliados.

Evidências locais: `output/playwright/readiness-browser.json`, `output/playwright/audit-detect.json` e `output/playwright/audit-pix.png`.

**Ordem recomendada:** configuração do RSVP → configuração/homologação do Pix → publicação e teste real → conteúdo e presentes → otimização e compartilhamento → `$impeccable polish` para a revisão final. Novas verificações devem ser direcionadas às mudanças e aos fluxos ainda não homologados.
