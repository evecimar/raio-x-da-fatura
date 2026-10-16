---
name: ajustar-categorias
description: Corrige ou amplia as regras de estabelecimento e categoria do Raio-X da Fatura (app/categorias.js). Use quando um lançamento cair em "Outros" ou na categoria errada, quando o nome do estabelecimento sair estranho (ex. "Pag S", "12345678loja") ou quando pedirem uma categoria nova.
---

# Ajustar categorias e nomes de estabelecimento

Tudo fica em `app/categorias.js`:

- `MARCAS`: lista `[regex, nomeLimpo | null, categoria]`. **A primeira que bater vence**, então regras específicas vêm antes das genéricas (ex.: `posto` antes de qualquer regra que também pegue "auto").
- `PREFIXOS`: prefixos de adquirente/gateway removidos do nome (`DL*`, `EBN*`, `MP *`, `IFD*`…).
- `RX.estabelecimento(descricao)`: nome normalizado usado em "maior gasto", duplicidades e na tabela.
- `RX.categorizar(lancamento)`: estornos → "Créditos e estornos"; `iof`/`anuidade`/`encargo` → "Taxas, IOF e juros"; depois as regras.

## Passos

1. **Ver o que está saindo**: `npm run testar -- fatura.pdf --detalhes` mostra descrição, estabelecimento e categoria de cada lançamento. Liste os casos errados.
2. **Escolher a mudança mínima**
   - Marca conhecida mal agrupada (ex. várias grafias do mesmo app) → nova linha em `MARCAS` com `nomeLimpo`.
   - Categoria errada para um tipo de comércio → ajuste/adicione regex com `nomeLimpo = null`.
   - Nome feio por prefixo de maquininha → acrescente em `PREFIXOS`.
3. **Regras de escrita**
   - Regex sem acento obrigatório: `farm[aá]cia`, `a[cç]ougue`; use `\b` para palavras curtas (`\bbar\b`, `\btim\b`) e evite pegar demais.
   - Nunca use nome de pessoa física, CPF ou endereço como regra.
   - Mantenha as categorias existentes; criar uma nova só se fizer sentido para muita gente. Categorias atuais: Compras online, Assinaturas digitais, Alimentação fora, Transporte, Combustível, Farmácia e saúde, Mercado, Veículo, Casa, Roupas e infantil, Educação, Pet, Serviços, Lazer, Outros, Créditos e estornos, Taxas, IOF e juros, Transferências e Pix (comprovantes de Pix/transferência).
   - "Assinaturas digitais" alimenta o destaque de assinaturas no painel; só coloque ali serviços recorrentes.
4. **Teste primeiro**: acrescente a descrição que motivou a mudança (no formato do layout, com nome de loja genérico se for de pessoa física) na tabela de `testes/unit/categorias.test.js`, veja falhar e então mude a regra. `npm run test:unit` mostra se a regra nova quebrou alguma antiga.
5. **Conferir**: rode de novo `npm run testar -- fatura.pdf --detalhes` e confirme que os casos mudaram **sem** alterar a soma (categoria não muda valor). Verifique se a regra nova não capturou lançamentos indevidos.
6. Se mudou o nome de uma categoria, atualize `ferramentas/gerar-exemplo.py`, rode-o para regenerar `dados/exemplo.js` e depois `npm test`.
