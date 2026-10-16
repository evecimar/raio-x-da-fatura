# Contribuindo

Obrigado por ajudar! Antes de tudo: **nunca envie faturas, notas, fotos de cupons ou trechos delas** (nem em issues). Elas têm nome, CPF, endereço e número de cartão. Para relatar um problema, descreva o layout ou troque nomes e valores por inventados.

Vai usar IA (Claude, Copilot, Cursor, ChatGPT…) para ajudar? Leia também [CONTRIBUINDO-COM-IA.md](CONTRIBUINDO-COM-IA.md): tem cuidados de privacidade e os erros mais comuns.

## Preparar

Você precisa do Node.js 20 ou mais novo.

```bash
npm install
npx playwright install chromium   # navegador dos testes de tela (só na primeira vez)
npm test
```

## Comandos

| Comando | O que faz |
|---|---|
| `npm test` | Tudo: privacidade, lint, tipos, testes de lógica e testes de tela. Rode antes de abrir o pull request. |
| `npm run privacidade` | Procura documentos e dados pessoais (CPF, CNPJ, cartão, e-mail, Pix) nos arquivos do repositório. |
| `npm run test:unit` | Testes de lógica (Vitest, em segundos): leitores, notas, vínculo, despesas, categorias. |
| `npm run test:watch` | Os mesmos testes, rodando de novo a cada arquivo salvo. |
| `npm run test:tela` | Abre `exemplo.html` e `index.html` num Chromium sem janela, em 1280px e 390px. |
| `npm run lint` / `npm run tipos` | ESLint e conferência de tipos dos plugins (`app/tipos.d.ts`). |
| `npm run montar` | Regenera `index.html` e `exemplo.html` (nunca edite esses dois à mão). |
| `npm run novo-leitor -- id "Banco"` | Cria um leitor novo e o caso de teste dele. |
| `npm run testar -- fatura.pdf --detalhes` | Lê um PDF real no seu computador e confere a soma. |

## Fluxo

1. Crie uma branch: `git switch -c minha-mudanca`.
2. Faça a mudança com testes e rode `npm test`.
3. Faça push e abra um pull request. O CI roda sozinho e precisa ficar verde. A `main` não aceita push direto.
4. Depois do merge, a release sai sozinha, com o zip do app pronto para usar. A versão sobe o último número (0.2.0 → 0.2.1). Para uma versão maior, mude `version` no `package.json` no próprio PR.

## Como os testes funcionam

- **Casos fictícios** (`testes/casos/`): cada banco tem uma fatura inventada, montada à mão com o mesmo layout do PDF real (rótulos e posições), e o resultado que o leitor tem que dar. Também viram PDFs de verdade na hora do teste, para passar pelo pdf.js como um PDF real.
- **Conferência de soma**: toda fatura precisa ter a soma dos lançamentos igual ao total. Isso vale nos casos fictícios e nas suas faturas reais.
- **Suas faturas, sem publicar nada**: coloque-as em `faturas/` (ignorada pelo git) ou aponte `RX_FATURAS=caminho`. O `npm test` passa a conferir cada uma delas, só no seu computador.
- **Tela**: o exemplo em computador e celular, sem erros de console, sem `NaN`, sem rolagem lateral. Os diálogos de nota, vínculo e edição e o armazenamento (backup, restaurar, apagar) também são testados.
- **GitHub Actions** roda tudo em cada pull request.

Corrigiu um bug? Escreva primeiro o teste que mostra o erro. Depois corrija.

## Banco novo

Cada banco é um plugin. O passo a passo está em [PLUGINS.md](PLUGINS.md).

## Categorias

As regras ficam em `app/categorias.js`, numa lista `[padrão, nome do estabelecimento, categoria]`, e a primeira que bater vence. Ao mudar uma regra, acrescente a descrição que motivou a mudança na tabela de `testes/unit/categorias.test.js`.

## Regras do projeto

- 100% offline: nada de `fetch`, CDN ou módulos ES no app. Ele abre com duplo clique (`file://`).
- Dados das faturas entram na página só por `textContent`, nunca por `innerHTML`.
- Textos em português do Brasil.
