---
name: adicionar-banco
description: Cria o leitor (plugin) de faturas de um banco novo no Raio-X da Fatura a partir de um PDF de exemplo, com caso de teste fictício, até a soma dos lançamentos bater com o total. Use quando pedirem suporte a um banco/cartão que ainda não é lido ou quando um PDF aparecer como "banco não reconhecido".
---

# Adicionar um banco novo

Objetivo: `app/leitores/<id>.js`, que reconhece o PDF do banco e devolve `{ fatura, lancamentos }` cuja soma é igual ao total da fatura, e `testes/casos/faturas/<id>.js`, um caso **fictício** no mesmo layout, que prova isso nos testes. O contrato está em `app/tipos.d.ts` e o guia público em `PLUGINS.md`.

## Regras de privacidade (antes de tudo)

- O PDF da pessoa fica fora do repositório (ex.: `../faturas/` ou `faturas/`, que é ignorada). Nunca copie o PDF, o texto extraído, nomes, CPF, endereço, números de cartão, lojas ou valores reais para arquivos versionados, para o caso de teste ou para mensagens de commit.
- O caso de teste copia só a **estrutura** (rótulos fixos do banco, posições x, formato de datas e valores) e inventa todo o resto: "Ana Exemplo", "Mercado Exemplo", finais 1111/2222.
- Regex e comentários descrevem o **layout**, não os dados da pessoa.

## Passos

1. **Esqueleto**: `npm run novo-leitor -- <id> "<Banco>"`. Isso cria o leitor e o caso, e os dois já passam no teste.
2. **Ver o PDF real**: `npm run testar -- caminho/fatura.pdf --celulas` mostra cada linha com `[x, 'texto']`. Observe:
   - se há uma ou duas colunas;
   - o formato da data e o ano;
   - o formato do valor (`R$`, `D`/`C`, sinal);
   - como aparecem cartão final, portador (adicional) e parcela (`3/12`, `PARC03/12`, `03 DE 12`);
   - onde ficam total, vencimento, fechamento, limites, saldo a vencer, mínimo e juros;
   - quais linhas são pagamento da fatura anterior (essas ficam de fora).
3. **Escrever o caso fictício** no mesmo layout, com os casos difíceis que o PDF tem: parcela, estorno, IOF, anuidade, cartão adicional, segunda coluna e quebra de página. Preencha `esperado` à mão: some os valores inventados para o total.
4. **Escrever o leitor** (`npm run test:watch`) até o caso passar. Use como modelo `nubank.js` (uma coluna, data por extenso), `picpay.js` (duas colunas, `U.linhasPorColuna`) ou `caixa.js` (seções por cartão, D/C).
   - `reconhece`: algo exclusivo do banco **e** algo de fatura. O teste confere que nenhum outro leitor reconhece o caso, e vice-versa.
   - Campo ausente no PDF → `null`. Datas com `U.dataBR` / `U.dataExtenso` / `U.comAno(d, m, fechamento)`. Estornos negativos.
   - Use `[ \t]+` em vez de `\s+` em regex de rótulo → valor quando o valor tem que estar na mesma linha (`\s` atravessa quebras de linha e pega o número de baixo).
5. **Conferir com o PDF real**: `npm run testar -- caminho/fatura.pdf` (✓) e, se houver, `RX_FATURAS=pasta npm test`. Se a diferença for o valor exato de um lançamento, ele foi perdido: procure linha quebrada, célula em outra coluna (tolerância em `linhasPorColuna`), valor sem centavos ou página de continuação. Teste com pelo menos duas faturas de meses diferentes, se houver.
6. **Integrar**: `npm run montar`. Adicione a cor da marca em `app/painel.js`, se for o caso, e o banco na tabela "Bancos suportados" do `README.md`. Rode `/verificar-antes-de-publicar`.
7. **Entregar**: diga quais campos o PDF não traz, quantos lançamentos foram lidos e a conferência ✓. Nenhum dado pessoal na resposta.
