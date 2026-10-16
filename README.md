# Raio-X da Fatura

**Entenda suas faturas de cartão em segundos.** Coloque os PDFs das faturas (e, se quiser, as notas fiscais) numa pasta, abra o Raio-X da Fatura e veja quanto pagar, o que pagar primeiro, onde cortar e todas as suas despesas. Funciona com vários meses e vários bancos ao mesmo tempo.

- 100% offline: os PDFs são lidos no seu navegador. Sem servidor, sem conta, sem internet.
- Vários meses: troque o mês no topo do painel e acompanhe a evolução.
- Conferência automática: cada fatura só é marcada como lida (✓) quando a soma dos lançamentos bate com o total do PDF.

## Notas fiscais e despesas

Coloque na mesma pasta as notas e cupons das suas compras:

- **Foto do cupom** (JPG, PNG ou WEBP): lida no próprio navegador, sem internet. Confira os dados, porque foto pode sair torta ou borrada.
- **XML da NF-e / NFC-e**: leitura exata. Muitas lojas e o app da Receita/SEFAZ enviam o XML por e-mail.
- **PDF da nota** (DANFE ou NFC-e com texto).

Quando a nota foi paga no cartão, o Raio-X liga a nota à compra da fatura (mesmo valor, data próxima, nome parecido). Você também pode ligar à mão ou dizer que não foi no cartão. Pagamentos em dinheiro e Pix aparecem como despesas fora do cartão. Sem nota? Use **+ Despesa à mão**.

Fotos do iPhone em HEIC precisam ser exportadas como JPG.

## Bancos suportados

| Banco | Situação |
|---|---|
| Nubank | ✓ |
| PicPay | ✓ |
| Caixa (Cartões Caixa) | ✓ |

Seu banco não está na lista? Cada banco é um plugin pequeno em JavaScript (costuma ter menos de 80 linhas). Veja [PLUGINS.md](PLUGINS.md).

## Como usar

**Sem baixar nada:** abra **https://evecimar.github.io/raio-x-da-fatura/** no Chrome, Edge ou Firefox. É o mesmo app: ele roda inteiro no seu navegador, e as faturas que você escolhe **não são enviadas** para o GitHub nem para lugar nenhum. Depois que a página carrega, nada mais sai do seu computador.

**Ou baixe e use offline:**

1. Baixe o `.zip` da [última release](https://github.com/evecimar/raio-x-da-fatura/releases/latest).
2. **No Windows**, antes de descompactar: clique com o botão direito no `.zip`, vá em **Propriedades**, marque **Desbloquear** e clique em **OK**. Sem isso, o Windows mostra o aviso "Deseja abrir este arquivo? Fornecedor desconhecido" toda vez. O aviso é normal para qualquer arquivo baixado da internet, e o app não instala nada. Se já descompactou, dá para clicar em **Abrir** ou desmarcar "Sempre perguntar antes de abrir este arquivo".
3. Descompacte e abra o arquivo `index.html` no navegador (Chrome, Edge ou Firefox), com um duplo clique.

Nos dois casos:

1. Clique em **Escolher pasta** (ou arraste a pasta) com os PDFs das faturas.
2. Pronto. Nas próximas vezes o painel abre direto; use **+ Faturas** para acrescentar meses novos.

Os dados ficam guardados no navegador, separados para cada jeito de abrir: o que você leu no site não aparece no arquivo baixado, e vice-versa. Para passar de um para o outro, use **Dados e backup › Baixar backup** e **Restaurar backup**.

Quer ver antes de usar? Abra `exemplo.html`: três meses de faturas inventadas (pessoas, lojas e valores fictícios).

Se o PDF tiver senha, o Raio-X da Fatura pede a senha na hora (muitos bancos usam os primeiros dígitos do CPF). A senha não é guardada.

## O que o painel mostra

- **O que as faturas mostram**: os principais achados em texto (maior gasto, cartão adicional, assinaturas, duplicidades, parcelas antigas, comparação com o mês anterior).
- **Cada fatura**: total, vencimento, situação, pagamento mínimo, juros do rotativo e uso do limite.
- **O que pagar primeiro**: ordem sugerida, com as vencidas de juros mais altos primeiro.
- **Onde cortar**, **gastos por categoria**, **quem gastou**, **compras dia a dia** e **evolução mês a mês**.
- **Todos os lançamentos**: busca, filtros e exportação em CSV.

## Estrutura

```
index.html            app (tela inicial + painel), gerado por `npm run montar`
exemplo.html          painel com dados fictícios
app/leitores/         um leitor (plugin) por banco + comum.js com utilidades
app/tipos.d.ts        contrato dos dados e dos plugins
app/notas*.js         notas fiscais: leitura (foto/OCR, XML, PDF) e vínculo com o cartão
app/despesas-calculo.js  cálculo das despesas (sem tela, testado)
app/categorias.js     regras de estabelecimento e categoria
app/pdf-texto.js      extrai linhas e células do PDF (pdf.js)
app/motor.js          guarda os dados, filtra por mês, alimenta o painel
app/painel.* app/despesas.* app/inicio.*   telas
testes/               testes automáticos (Vitest e Playwright) com casos fictícios
ferramentas/          montar.js, novo-leitor.js, testar.js, gerar-exemplo.py
vendor/               pdf.js (Apache-2.0), D3 (ISC) e Tesseract.js com dados de português (Apache-2.0)
```

## Para desenvolver

Usar o app não precisa de nada. Para mexer no código, você precisa do Node.js 20 ou mais novo:

```bash
npm install
npx playwright install chromium   # só na primeira vez, para os testes de tela
npm test                          # lint, tipos, testes de lógica e testes de tela
```

Os testes usam só dados inventados. Se você quiser conferir as suas faturas reais, coloque-as na pasta `faturas/` (ela nunca vai para o GitHub) e rode `npm test`. Veja [CONTRIBUINDO.md](CONTRIBUINDO.md).

## Privacidade

Os dados lidos ficam guardados apenas no navegador deste computador, num banco de dados local (IndexedDB), junto com os PDFs e fotos originais (dá para desligar). Em **Dados e backup** você:

- baixa um **backup** (.json) com tudo, para trocar de computador ou navegador, e restaura depois;
- vê quanto espaço está sendo usado;
- baixa CSVs para planilhas;
- apaga tudo deste navegador.

Limpar os dados de navegação do Chrome apaga os dados do Raio-X: faça backups de vez em quando. Os dados não são criptografados; quem usa o seu perfil do computador consegue lê-los. O `.gitignore` impede que PDFs, fotos e XMLs sejam enviados ao repositório. Das notas, guardamos só loja, data, total, forma de pagamento e itens — nunca o seu endereço, CPF ou telefone impressos no cupom.

## Licença

MIT. Inclui [pdf.js](https://github.com/mozilla/pdf.js) (Apache-2.0), [D3](https://d3js.org) (ISC) e [Tesseract.js](https://github.com/naptha/tesseract.js) com [tessdata_best](https://github.com/tesseract-ocr/tessdata_best) (Apache-2.0).
