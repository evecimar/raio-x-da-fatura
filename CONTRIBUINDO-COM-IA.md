# Contribuindo com ajuda de IA

Usar Claude, Copilot, Cursor, ChatGPT ou outro assistente para contribuir é bem-vindo. Este guia complementa o [CONTRIBUINDO.md](CONTRIBUINDO.md) com o que muda quando uma IA escreve parte do código.

A regra de fundo é simples: **quem abre o pull request é o autor**. Você responde pelo que a IA escreveu: entende cada linha, rodou os testes e conferiu que nenhum dado real vazou.

## 1. Privacidade vem antes de tudo

Faturas e notas têm nome, CPF, endereço, número de cartão e tudo o que a pessoa comprou. Quando você cola algo num chat de IA, isso vai para os servidores de quem fornece a IA.

- **Nunca cole na IA** PDF, foto, XML ou texto extraído de fatura ou nota real. Isso vale também para a saída de `npm run testar -- fatura.pdf --detalhes` ou `--celulas`, porque elas mostram os seus dados.
- Para mostrar um layout, **troque tudo o que é pessoal** antes: nomes por "Ana Exemplo", lojas por "Mercado Exemplo", finais de cartão por 1111/2222 e valores por números inventados. Mostre só a estrutura, ou seja, os rótulos fixos do banco e as posições `x`.
- Agentes que rodam comandos no seu computador (Claude Code, Cursor, Copilot agent) podem ler os seus arquivos. Deixe as faturas **fora da pasta do projeto** ou na pasta `faturas/`, e não peça para o agente abrir, resumir ou "dar uma olhada" nelas. Se precisar conferir uma fatura real, rode você mesmo `npm run testar` e conte só o resultado (✓ ou a diferença).
- Casos de teste escritos pela IA também precisam ser **100% inventados**. Confira linha por linha: é comum a IA "aproveitar" um nome ou uma loja que apareceu na conversa.

## 2. Dê o contexto certo para a IA

O projeto já tem instruções escritas para agentes:

| Arquivo | O que tem |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Princípios, arquitetura, regras de Despesas, comandos. O Claude Code lê sozinho; em outras ferramentas, peça para ler este arquivo antes de tudo. |
| [`PLUGINS.md`](PLUGINS.md) e [`app/tipos.d.ts`](app/tipos.d.ts) | Contrato dos leitores de banco (plugins). |
| [`.claude/skills/`](.claude/skills) | Roteiros prontos: `/adicionar-banco`, `/ajustar-categorias`, `/melhorar-leitura-de-notas`, `/verificar-antes-de-publicar`. No Claude Code, chame pelo nome; nas outras ferramentas, cole o conteúdo do `SKILL.md` como instrução. |

Em ferramentas que não leem o `CLAUDE.md` sozinhas, comece a conversa com algo como:

> Leia CLAUDE.md, CONTRIBUINDO.md e CONTRIBUINDO-COM-IA.md antes de mexer em qualquer coisa. Siga as regras deles. Ao terminar, rode `npm test` e me mostre o resultado.

## 3. Pedidos que funcionam bem

**Banco novo**
> Quero um leitor para o Banco X. Siga PLUGINS.md: rode `npm run novo-leitor -- bancox "Banco X"`, escreva o caso fictício em testes/casos/faturas/bancox.js com o layout abaixo (já anonimizado) e ajuste o leitor até `npm run test:unit` passar. Não use nenhum dado real.
> [estrutura do PDF com dados trocados]

**Bug**
> A Despesas de outubro está contando a compra X duas vezes. Primeiro escreva um teste em testes/unit/despesas.test.js que mostre o erro (com dados inventados) e confirme que ele falha. Só depois corrija app/despesas-calculo.js e rode `npm test`.

**Categoria**
> "LOJA EXEMPLO TINTAS" está caindo em "Outros". Acrescente o caso em testes/unit/categorias.test.js, veja falhar e ajuste a regra em app/categorias.js sem quebrar as outras.

Peça sempre **o teste antes da correção**. Assim você vê que o teste pega o erro de verdade, e não um teste escrito para passar.

## 4. O que a IA costuma errar neste projeto

Revise o diff procurando estes deslizes, que são comuns:

- **Quebrar o `file://`**: usar `import`/`export`, `type="module"`, `fetch` de arquivo local, CDN ou fonte externa. O app abre com duplo clique e sem internet; scripts são clássicos e compartilham `window.RaioX`.
- **Editar `index.html` ou `exemplo.html` à mão.** Eles são gerados: mude as partes em `app/` ou `ferramentas/inicio.html` e rode `npm run montar`.
- **Usar `innerHTML` com dados** da fatura ou da nota. Use só `textContent`.
- **"Ajustar" um valor para a soma fechar** ou afrouxar a conferência (a tolerância de R$ 0,05). Se a soma não bate, o leitor perdeu um lançamento: é isso que precisa ser achado.
- **Mudar um teste para ele passar** em vez de corrigir o código. Teste só muda quando a regra mudou de propósito, e isso precisa estar explicado no PR.
- **Regra de Despesas mudada sem teste.** Qualquer mudança em `app/despesas-calculo.js` vem com teste em `testes/unit/despesas.test.js`.
- **Dependência nova** (npm ou CDN) sem necessidade. No app, biblioteca só vendorizada em `vendor/` e com licença; para desenvolver, prefira o que já existe.
- **Texto em inglês** na interface ou nos comentários, ou nome de função em inglês. Tudo em português do Brasil.
- **Texto fixo sobre uma pessoa, banco ou loja** no painel. Todo destaque é calculado dos dados.
- **Mudanças grandes demais.** Peça uma coisa por vez, e um PR por assunto.

## 5. Antes de abrir o pull request

- [ ] Você leu e entendeu todo o diff, não só o resumo que a IA fez.
- [ ] `npm test` passa no seu computador (lint, tipos, testes de lógica e de tela).
- [ ] Mexeu em leitor? `npm run testar -- sua-fatura.pdf` dá ✓, rodado por você, sem mostrar a saída para a IA.
- [ ] `git status` não mostra PDF, foto, XML real nem a pasta `faturas/`. O CI também barra, mas não deixe chegar lá.
- [ ] Nenhum dado real em testes, comentários, mensagens de commit ou na descrição do PR.
- [ ] Na descrição do PR, diga **que usou IA e para quê** (ex.: "o Claude escreveu o leitor e os casos; eu revisei e testei com 3 faturas"). Isso ajuda quem revisa e não é motivo para recusar nada.

Se o agente fizer commits por você, confira a mensagem e os arquivos de cada commit antes do push. Agentes não devem fazer push direto na `main`, e a proteção da branch também impede isso quando está ativa.
