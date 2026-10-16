---
name: melhorar-leitura-de-notas
description: Melhora a leitura de notas fiscais e cupons no Raio-X da Fatura (app/notas-leitura.js) — loja, data, total, forma de pagamento ou itens lidos errado de uma foto, PDF ou XML, ou um formato novo de nota. Também ajusta o vínculo automático nota↔cartão (app/notas.js). Use quando uma nota sair com dados errados, cair em "revisar" sem motivo ou não ligar à compra certa.
---

# Melhorar a leitura de notas

## Privacidade primeiro

Cupons trazem nome, endereço, CPF e telefone do cliente. A foto/PDF/XML real fica **fora** do repositório (ex.: `../notas/`). Nunca cole o texto lido em arquivos versionados, testes, issues ou commits. Casos de teste só fictícios, em `testes/casos/notas/` (o `.gitignore` libera XML só ali): copie a estrutura da nota e invente loja, CNPJ, itens e valores.

## Onde fica cada coisa

- `app/notas-leitura.js`
  - `RX.lerNotaXML(xml)` — NF-e/NFC-e (exato). Forma de pagamento pelo `tPag` (tabela `TPAG`).
  - `RX.lerNotaTexto(texto, {origem})` — PDF ou OCR: `acharLoja` (linha acima do endereço, com filtro de ruído `qualidade`), `acharData` (prefere data com hora; ignora "última compra", vencimento…), `acharTotal` (regras em ordem: "valor a pagar", "total geral"… tolerando OCR como "lotal"), `acharItens` (qtd, descrição, unitário, total; conserta vírgula perdida usando o total), `forma` (prefere a linha de "pagamento"; ignora "chave pix").
  - `RX.lerNotaFoto(arquivo)` — `recortePapel` (acha o papel claro e sem cor), cinza + contraste, Tesseract. `RX._ultimoOCR` guarda o texto da última foto **só em memória** para depurar.
- `app/notas.js` — `sugestoesDeVinculo` (pontuação valor/data/nome/cartão) e `autoVincular` (limiares 0,7 e folga 0,12; nunca dinheiro/Pix; nunca desfaz escolha manual).

## Passos

1. **Reproduza no navegador** com a nota da pessoa, fora do repositório. Num HTML temporário fora do projeto, carregue `app/leitores/comum.js`, `app/categorias.js` e `app/notas-leitura.js` (com `vendor/` acessível no mesmo caminho relativo), chame `RaioX.lerNotaFoto(file)` / `lerNotaTexto` / `lerNotaXML` e imprima `RaioX._ultimoOCR` e o resultado. Use Playwright (o mesmo Chromium de `npm run test:tela`) para automatizar. Para PDF e XML, `npm run testar -- nota.pdf --detalhes` já mostra a leitura no Node.
2. **Ache a causa no texto lido**, não no resultado: a palavra veio torta (OCR), a regra pegou a linha errada, ou o recorte cortou parte do papel? Para foto, compare com e sem `prepararImagem` antes de mexer nas regras.
3. **Escreva o caso fictício que falha** em `testes/casos/notas/` (texto como sai do PDF/OCR, com dados inventados) e um teste em `testes/unit/notas-leitura.test.js`.
4. **Mude o mínimo**: uma regra nova ou mais tolerante, com o padrão do **layout** (nunca dados da pessoa). Prefira regras que funcionem para muitos cupons, não só para um.
5. **Não quebre o que funciona**: `npm test` e, se a pessoa tiver, `RX_FATURAS=pasta npm test` com as outras notas dela.
6. **Vínculo**: se ligou à compra errada, escreva o caso em `testes/unit/vinculo.test.js`, ajuste pesos/limiares em `sugestoesDeVinculo`/`autoVincular` e confira que dinheiro/Pix continuam sem vínculo automático.
7. Atualize `CLAUDE.md` se mudar comportamento, e regenere `ferramentas/gerar-exemplo.py` → `dados/exemplo.js` se mudar o formato das notas.

Nota lida de foto sempre entra com `revisar: true` — isso é intencional: a pessoa confirma.
