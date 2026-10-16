# Plugins: leitores de fatura

O Raio-X da Fatura lê cada banco com um **leitor**, um plugin em JavaScript. Para o app ler um banco novo, basta escrever um arquivo em `app/leitores/` e um caso de teste fictício. Não precisa mexer no resto do app.

## O contrato

Um leitor é um objeto registrado com `RaioX.registrarLeitor`:

```js
RX.registrarLeitor({
  id: 'meubanco',            // curto, minúsculo, sem espaços
  banco: 'Meu Banco',        // como aparece na tela
  reconhece(texto) { ... },  // true se o PDF é uma fatura deste banco
  ler(paginas, texto) {      // devolve { fatura, lancamentos }
    return { fatura: { ... }, lancamentos: [ ... ] };
  }
});
```

Os tipos completos estão em [`app/tipos.d.ts`](app/tipos.d.ts): `Leitor`, `FaturaLida`, `LancamentoLido`, `Pagina`, `Linha` e `Celula`. Com `// @ts-check` no topo do arquivo, o editor completa os campos e `npm run tipos` aponta erros.

**O que o leitor recebe:** `paginas` é uma lista de páginas. Cada página é uma lista de linhas `{ texto, celulas: [{ s, x }], y }`, de cima para baixo, e `x` é a posição horizontal de cada pedaço de texto. Já `texto` é o PDF inteiro como texto, útil para achar total, vencimento e outros campos com expressões regulares.

**O que o leitor devolve:**

- `fatura`: `cartao`, `titular`, `total`, `vencimento`, `fechamento`, além de `limite_total`, `limite_utilizado`, `a_vencer`, `pagamento_minimo` e `juros_rotativo_am` (use `null` quando o PDF não trouxer o campo).
- `lancamentos`: `{ data, descricao, cartao, portador, parcela, valor, tipo }`.
  - `data` no formato `AAAA-MM-DD`. Para datas sem ano, use `U.comAno(dia, mes, fechamento)`.
  - `valor` é um número. Estornos e créditos são **negativos**. O pagamento da fatura anterior fica **de fora**.
  - `parcela` vai no formato `3/12`, ou `''` para compras à vista.
  - `tipo` é `compra`, `estorno`, `iof`, `anuidade` ou `encargo`.

O `RaioX.lerFatura` cuida do resto: banco, mês, id, categoria, nome do estabelecimento, cartão adicional e correção do ano de parcelas antigas. Ele também **confere a soma**.

**Utilidades** (`RaioX.util`, chamado de `U` nos leitores):

- Valores: `valor('1.234,56')` e `ehValor(s)`.
- Datas: `dataBR('15/10/2026')`, `dataExtenso('15 OUT 2026')` e `comAno(d, m, ref)`.
- Texto: `achar(texto, /regex (grupo)/)` e `primeiroNome(nome)`.
- Layouts em duas colunas: `linhasPorColuna(paginas)` devolve as linhas na ordem de leitura.

## Regras

1. **A soma dos lançamentos tem que ser igual ao total da fatura.** É assim que sabemos que nada ficou de fora. Nunca ajuste um valor para a conta fechar: descubra o que o leitor perdeu.
2. **O leitor é uma função pura.** Não usa rede, não guarda nada e não mexe na tela, porque recebe o texto e devolve dados. O app é 100% offline e o leitor também.
3. **`reconhece` precisa ser específico.** Ele não pode reconhecer a fatura de outro banco, e o teste confere isso com todos os casos.
4. **Os casos de teste usam só dados fictícios.** Nunca coloque PDF real, nome, CPF, endereço ou número de cartão no repositório.

## Passo a passo

```bash
npm install
npm run novo-leitor -- meubanco "Meu Banco"
```

Isso cria `app/leitores/meubanco.js` e `testes/casos/faturas/meubanco.js`, que já passam nos testes. Depois:

1. **Veja o PDF real** (ele fica no seu computador e não vai para o repositório):
   ```bash
   npm run testar -- ~/faturas/meubanco-outubro.pdf --celulas
   ```
   O comando mostra cada linha com a posição `x` das células. Observe se a fatura tem uma ou duas colunas, como vêm as datas e os valores, onde aparecem o cartão final, o portador e a parcela, e quais linhas são pagamento da fatura anterior.
2. **Escreva o caso fictício** em `testes/casos/faturas/meubanco.js`. Copie a estrutura do PDF (rótulos fixos do banco e posições `x`) e invente nomes, lojas e valores. Inclua os casos difíceis: parcela, estorno, IOF, cartão adicional e quebra de página.
3. **Ajuste o leitor** até os testes passarem:
   ```bash
   npm run test:watch
   ```
4. **Confira com o PDF real**: `npm run testar -- ~/faturas/meubanco-*.pdf` (✓ = a soma bate com o total). Se possível, teste com duas ou três faturas de meses diferentes.
5. **Integre e rode tudo:**
   ```bash
   npm run montar   # inclui o leitor no index.html
   npm test         # lint, tipos, testes de lógica e testes de tela
   ```
6. Acrescente o banco na tabela "Bancos suportados" do `README.md` e abra o pull request.

Se você guardar suas faturas em `faturas/` (pasta ignorada pelo git), o `npm run test:unit` também confere a soma de cada uma delas.

## Exemplos

| Layout | Modelo |
|---|---|
| Uma coluna, data "08 SET", grupos por portador | [`nubank.js`](app/leitores/nubank.js) |
| Duas colunas, data "dd/mm", parcela "PARC06/10" | [`picpay.js`](app/leitores/picpay.js) |
| Duas colunas, valores com D/C, seções por cartão, anuidade sem data | [`caixa.js`](app/leitores/caixa.js) |
