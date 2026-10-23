# Raio-X da Fatura

Aplicativo open source (MIT) que lê de uma pasta os PDFs de faturas de cartão de crédito e as notas fiscais/cupons (foto, PDF ou XML) e mostra um painel: quanto pagar, o que pagar primeiro, onde cortar, evolução mês a mês e todas as despesas, inclusive as pagas em dinheiro/Pix, com as notas ligadas às compras do cartão. Público: pessoas comuns no Brasil, não técnicas. Tudo em **português do Brasil**.

## Princípios que não se negociam

1. **100% offline e local.** Os PDFs são lidos no navegador. Nada de servidor, `fetch`, CDN, analytics, fontes externas ou chamadas de rede. Os dados ficam só no navegador (IndexedDB; `localStorage` como plano B).
2. **Abre com duplo clique (`file://`).** Por isso: sem ES modules (`type="module"`), sem `fetch` de arquivos locais, sem build obrigatório para usar. Scripts clássicos carregados em ordem, compartilhando o namespace `window.RaioX`.
3. **Privacidade.** Nunca coloque PDFs, fotos de cupons, XMLs de notas, textos extraídos de faturas/notas reais, nomes, CPFs ou endereços no repositório, em testes, em issues ou em commits. Exemplos usam só dados fictícios: `dados/exemplo.js` é gerado por `ferramentas/gerar-exemplo.py` (pessoas, lojas e valores inventados) e nunca deve ser derivado de faturas reais. O `.gitignore` bloqueia PDFs, imagens e XMLs (exceto as notas fictícias em `testes/casos/notas/`). Casos de teste são escritos à mão com dados inventados, copiando só a estrutura do layout. Das notas só guardamos loja, CNPJ da loja, data, total, forma de pagamento e itens — nunca endereço/CPF/telefone do cliente que aparecem no cupom.
4. **Conferência de totais.** Um leitor só está correto quando a soma dos lançamentos é igual ao total da fatura (tolerância de R$ 0,05). Nunca "ajuste" um lançamento para fechar a conta: descubra o que o leitor perdeu.
5. **Texto de PDF é dado não confiável.** No DOM, valores vindos das faturas entram só por `textContent` / `d3.text()`. Nunca `innerHTML` com dados.

## Arquitetura

```
index.html / exemplo.html   GERADOS por ferramentas/montar.js (npm run montar) — não edite à mão
ferramentas/inicio.html     marcação da tela inicial (escolher pasta, senha de PDF)
app/painel.html             marcação do painel
app/pdf-texto.js            pdf.js → páginas de linhas {texto, celulas:[{s,x}], y}
app/tipos.d.ts              contrato dos dados e dos plugins (Leitor, FaturaLida, LancamentoLido…); só para editor e `npm run tipos`
app/leitores/comum.js       utilidades (valor, datas, linhasPorColuna) + registrarLeitor (valida o plugin) + validarLeitura + RaioX.lerFatura()
app/leitores/<banco>.js     um leitor (plugin) por banco, registrado com RaioX.registrarLeitor() — guia em PLUGINS.md
app/categorias.js           regras [regex, estabelecimento, categoria]; RaioX.estabelecimento(), RaioX.categorizar()
app/armazenamento.js        IndexedDB (faturas, lancamentos, notas, originais, meta) com fila de gravação, migração do localStorage antigo, plano B em localStorage, arquivos originais e backup .json
app/motor.js                estado em memória, filtro por mês, API `dash` para o painel; grava via RaioX.armazem
app/notas.js                notas fiscais: guardar, sugerir/fazer vínculo com lançamentos, editar, remover, digitar à mão
app/notas-leitura.js        ler nota de XML (NF-e/NFC-e), comprovante de Pix/transferência (vira despesa 'pix', categoria 'Transferências e Pix'; não guarda CPF, conta nem ID da transação), de PDF com texto (DANFE com leitor próprio: emitente pela chave de acesso, itens da tabela de produtos, ignora o destinatário) e de foto (OCR); recorte do papel na foto
app/despesas-calculo.js     cálculo puro da visão Despesas (calcularDespesas, comoVaiSerPago, despesasPorCategoria, despesasPorMes) — sem DOM, testado
app/despesas.*              tela da visão Despesas (cartão + fora do cartão, notas, vínculo manual); chama despesas-calculo.js
app/painel.js               cálculos (dash.calc) e desenho (D3); textos de análise gerados dos dados
app/inicio.js               tela inicial, leitura da pasta, senha, seletor de mês, CSV
app/tema.css / estilo.css / inicio.css   tokens (claro/escuro), painel, tela inicial
vendor/                     pdf.js 3.11.174 (UMD, roda sem worker via pdf.worker.min.js) e D3 v7
vendor/ocr/                 Tesseract.js 5.1.1 + núcleo WASM e dados de português embutidos em .js (carregados só quando há foto)
testes/carregar.js          carrega os scripts clássicos do app num contexto isolado do Node (um RaioX novo por teste)
testes/casos/faturas/       um caso FICTÍCIO por banco: páginas montadas à mão no layout do banco + resultado esperado
testes/casos/notas/         notas fictícias (XML, texto de DANFE, Pix, cupom)
testes/casos/gerar-pdf.js   gera um PDF de verdade a partir de um caso (pdf-lib), para testar pdf.js → leitor → tela
testes/unit/                Vitest: leitores, contrato de plugin, PDF, notas, vínculo, despesas, categorias, faturas reais (opcional)
testes/tela/                Playwright: exemplo.html e index.html em computador (1280px), celular (390px) e celular pequeno (340px), armazenamento
```

Vínculo nota ↔ lançamento (`RaioX.sugestoesDeVinculo`): mesmo valor (±R$ 0,01), lançamento de 2 dias antes a 5 dias depois da nota, nome parecido e mesmo final de cartão somam pontos. Vincula sozinho só com candidato claro (≥0,7 e 0,12 à frente do segundo) e nunca para dinheiro/Pix; escolha manual da pessoa nunca é desfeita automaticamente. Compra parcelada: a nota traz o total e a fatura a parcela, então compara também parcela × N; a data pode ser a da compra (PicPay, Caixa) ou a da cobrança (Nubank, n−1 meses depois), e as duas são testadas. Parcelas da mesma compra em várias faturas viram uma sugestão só. A busca manual aceita dd/mm, dd/mm/aaaa e o valor total da compra.

### Armazenamento

- Banco IndexedDB `raio-x-da-fatura` (versão 1). Lojas: `faturas` (chave `banco|mes`), `lancamentos` (`id`), `notas` (`id`), `originais` (`id` → Blob do PDF/foto/XML), `meta` (`config`, `salvoEm`, `migradoDoLocalStorage`).
- `RaioX.carregarSalvo()` é **assíncrono**. Na primeira abertura, se o IndexedDB está vazio e existe a chave antiga `raio-x-da-fatura:v1` no localStorage, copia, confere as contagens e só então apaga a chave antiga.
- Cada `salvar()` regrava faturas/lançamentos/notas numa única transação, pela fila (`RaioX.armazem.esperar()` aguarda). Arquivos originais que nenhuma fatura/nota referencia (`arquivo_id`) são apagados na mesma transação.
- Sem IndexedDB (navegador antigo, modo restrito): usa localStorage e não guarda originais. Sem nenhum dos dois: funciona só em memória.
- Backup: `RaioX.gerarBackup({comOriginais})` → JSON `{app:'raio-x-da-fatura', formato:1, faturas, lancamentos, notas, originais:[{id,nome,tipo,tamanho,base64}]}`; `RaioX.lerBackup(arquivo)` valida; restaurar = `restaurarOriginais` + `substituirEstado`. Mudou o formato? Aumente `formato` e mantenha a leitura dos antigos.
- Ao mudar a estrutura do banco, suba `VERSAO` em `armazenamento.js` e trate a migração em `onupgradeneeded`. Nunca apague dados da pessoa numa migração sem antes conferir a cópia.

### Despesas: como o mês é contado

Todo o cálculo fica em `app/despesas-calculo.js` (sem tela) e é coberto por `testes/unit/despesas.test.js`. Mudou uma regra? Mude o teste junto.


Despesa = **compra**, no mês em que foi feita e pelo **valor total**. Como e quando é paga é outra informação ("Como vai ser pago").

- Cartão: cada compra conta uma vez, mesmo que suas parcelas apareçam em várias faturas (chave banco|cartão|estabelecimento|N|valor da parcela|mês da compra). Parcelada: parcela × N, na data da compra.
- Data da compra de uma parcela n/N (`dataDaCompra` em `despesas-calculo.js`): se a data impressa cai dentro do ciclo da fatura, é a da cobrança (Nubank) e a compra foi n−1 meses antes; fora do ciclo, já é a data da compra (PicPay, Caixa).
- Estornos (valores negativos) descontam no mês da data do estorno. Créditos sobre tarifas (cashback de anuidade) vão para tarifas.
- Tarifas e juros (IOF, anuidade, encargos) ficam **fora** do total de compras, num card à parte, no mês do ciclo da fatura (`dataEfetiva`: o que é lançado no dia do fechamento ou com data fora do ciclo conta no dia anterior ao fechamento).
- Notas: pela data da nota. Ligadas a um lançamento não somam de novo. No crédito sem vínculo = "próxima fatura (ainda não carregada)" até a fatura chegar e o vínculo automático ligá-las.
- "Como vai ser pago": compras à vista na fatura em que estão; parceladas divididas entre a fatura carregada e "parcelas em outras faturas"; Pix/dinheiro/débito "já saiu da conta". Nota no crédito sem fatura em N vezes (`parcelas`): a 1ª parcela em "próxima fatura", as outras em "parcelas em outras faturas".
- Despesa no crédito parcelada (`parcelas` de 2 a 48, só no crédito): continua contando **pelo total no mês da compra**. As parcelas só servem para prever pagamentos (`valoresDasParcelas`: o centavo que sobra vai na 1ª).
- "Próximos meses" (`proximosMeses`, do mês de hoje em diante, por fatura = mês do vencimento): faturas carregadas não pagas pelo total; parcelas do cartão que continuam depois da última fatura carregada do banco; notas no crédito sem vínculo (e não marcadas como "não está no cartão") divididas em parcelas. A 1ª parcela cai na primeira fatura que fecha no dia da compra ou depois (`faturaDaCompra`: banco achado pelo final do cartão nos lançamentos; sem banco, a fatura do mês seguinte, marcada como estimada).
- **Mês parcial**: cada fatura cobre (fechamento anterior, fechamento]. Se as faturas carregadas não cobrem os dias do mês para algum banco (mais de 3 dias, sem contar dias futuros), o mês é marcado como parcial e o banco é citado.
- A soma das despesas **não** é igual ao total das faturas (de propósito): a visão Faturas mostra o que pagar; Despesas mostra o que foi comprado.

### OCR (fotos)

O Tesseract roda num Web Worker criado de um Blob com o código embutido (`vendor/ocr/ocr-worker.js`), porque `file://` não deixa carregar workers nem fazer `fetch`. O idioma vai em memória (`[{code:'por', data}]`). O worker do Tesseract 5.1.1 tem uma correção local (usa `.code` em vez de `.data` no nome do idioma): ao atualizar a versão, refaça a correção. Antes do OCR a foto é recortada no papel (claro e sem cor), passa para cinza e ganha contraste. Nota lida de foto sempre entra com `revisar: true`.

Fluxo: pasta → `pdf-texto.js` extrai linhas → `lerFatura()` escolhe o leitor pelo `reconhece(texto)` → leitor devolve `{fatura, lancamentos}` → `comum.js` normaliza (portador, adicional, estabelecimento, categoria, id, ano de parcelas) e confere o total → `motor.js` guarda e filtra por mês → `painel.js` desenha.

### Contrato de dados (o que o painel recebe)

- `faturas`: mes (AAAA-MM do vencimento), banco, cartao, titular, total, vencimento, fechamento, limite_total, limite_utilizado, a_vencer, pagamento_minimo, juros_rotativo_am, arquivo.
- `lancamentos`: id, mes, banco, cartao (final), portador (primeiro nome), adicional (sim/nao), data (AAAA-MM-DD), descricao, estabelecimento, categoria, parcela (`n/N`), valor (negativo = estorno), tipo (compra|estorno|iof|anuidade|encargo).
- `historico_faturas` / `historico_lancamentos`: as mesmas colunas, todos os meses.
- `notas`: todas as notas (objetos): id, arquivo, origem (foto|pdf|xml|manual), loja, cnpj, data, hora, total (número ou null; na parcelada, o total da compra), forma (dinheiro|pix|debito|credito|outro|''), parcelas (1 a 48; 1 = à vista ou fora do crédito), cartao_final, itens[{descricao,qtd,unitario,total}], categoria, vinculo (id do lançamento), vinculo_tipo (auto|manual|''), revisar, avisos[], mes (mês da COMPRA).
- `RaioX.mesSelecionado` pode ser `RaioX.TODOS` (`'*'`): "Todos os meses"; nesse caso `faturas`/`lancamentos` trazem todos os meses.
- Faturas têm `paga` ('sim' quando a pessoa marca "Já paguei").
- Valores chegam ao painel como texto; converta com `Number()`. Campos podem vir vazios: o painel mostra "não informado", nunca `NaN`.

Mudou o contrato? Atualize os três lados juntos: leitores/`comum.js`, `motor.js` (COL_F/COL_L) e `painel.js`, além de `ferramentas/gerar-exemplo.py` (e regenere o exemplo).

## Comandos

```bash
npm install                                   # só para desenvolver; usar o app não precisa de nada
npm test                                      # tudo: privacidade, lint, tipos, testes de lógica e testes de tela
npm run privacidade                           # procura documentos e dados pessoais (CPF/CNPJ/cartão/e-mail/Pix/NF-e) nos arquivos versionados
npm run test:unit                             # Vitest (rápido): leitores, notas, vínculo, despesas, categorias
npm run test:watch                            # Vitest observando os arquivos
npm run test:tela                             # Playwright: exemplo.html e index.html, 1280px e 390px, armazenamento
npm run lint                                  # ESLint
npm run tipos                                 # TypeScript confere os arquivos com // @ts-check contra app/tipos.d.ts
npm run montar                                # regenera index.html e exemplo.html
npm run novo-leitor -- <id> "<Banco>"         # esqueleto de leitor + caso de teste fictício
npm run testar -- fatura.pdf [--detalhes] [--celulas]   # PDF real no Node; ✓ só se a soma bate; --celulas mostra posições x
python3 ferramentas/gerar-exemplo.py          # regenera dados/exemplo.js (fictício)
```

Faturas e notas reais da pessoa podem ficar em `faturas/` (ignorada pelo git) ou em outra pasta com `RX_FATURAS=caminho`: aí `npm run test:unit` confere a soma de cada fatura e `npm run test:tela` lê todas pelo `index.html`. Sem a pasta, esses testes são pulados.

Depois de editar `app/painel.html`, `app/despesas.html` ou `ferramentas/inicio.html`, ou de criar um leitor, rode `npm run montar`. **Antes de dar uma tarefa por terminada, rode `npm test`** (e, se a pessoa tiver faturas locais, com `RX_FATURAS`). Corrigiu um bug? Escreva primeiro o teste que falha com ele.

### GitHub

- A `main` é protegida: só entra código por pull request, com o CI verde. Trabalhe numa branch (`git switch -c minha-mudanca`), faça push e abra o PR.
- `.github/workflows/ci.yml` (CI): em todo PR, roda `npm run privacidade` (ferramentas/verificar-privacidade.js), roda lint, tipos e testes de lógica, confere que `index.html`/`exemplo.html` estão montados e roda os testes de tela. O job `testes` é a checagem obrigatória da `main`.
- `.github/workflows/release.yml` (Release): a cada merge na `main`, roda o CI de novo e publica a release `vX.Y.Z` com o zip do app (`ferramentas/empacotar.js`: index.html, exemplo.html, app/, dados/, vendor/, LICENSE, README). A versão vem de `ferramentas/versao.js`: a do `package.json` se ainda não foi publicada, senão sobe o último número. Mudança grande → suba `version` no `package.json` dentro do PR.
- Site (job `site` do `release.yml`): publica o mesmo pacote da release no GitHub Pages (https://evecimar.github.io/raio-x-da-fatura/). Só roda com o repositório público (no plano gratuito o Pages não funciona em privado) e com Settings › Pages › Source = GitHub Actions. Para republicar só o site (sem release nova): aba Actions › Release › Run workflow. O app tem que continuar funcionando igual por `file://` e por `https://`, sem nenhum pedido de rede. O site leva uma Content-Security-Policy (`empacotar.js --site`) que bloqueia qualquer conexão para fora; `testes/tela/site.spec.js` serve o site por HTTP e confere que tudo funciona com ela (inclusive OCR).

### Segurança (auditoria de outubro/2026)

- Originais (PDF/foto/XML) só abrem com tipo seguro (`RaioX.tipoSeguro`: PDF, imagem, XML); qualquer outro vira download, e a aba nova não tem `opener`. Um backup adulterado não consegue rodar script.
- `lerBackup` aceita só objetos e normaliza `itens`/`avisos`/originais.
- CSV: células que começam com `= + - @` ganham `'` (`RaioX.celulaCSV`), exceto números.
- Comprovante de Pix: o nome vem do bloco do recebedor; nunca do pagador.
- `RaioX._ultimoOCR` só existe com `RaioX.depurar = true`.
- Testes com faturas reais (`testes/tela/reais.spec.js`) rodam sem trace/captura/vídeo; `npm run testar --detalhes/--celulas` avisa que a saída tem dados pessoais.

## Convenções

- Namespace global `window.RaioX`; dentro dos arquivos, alias `RX`. Classes e ids de DOM com prefixo `rx-`.
- Datas sempre ISO (`AAAA-MM-DD`); meses `AAAA-MM`. Moeda formatada com `Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'})`.
- Nada de texto fixo sobre uma pessoa, um banco ou um estabelecimento no painel: todo destaque é calculado dos dados e só aparece quando se aplica.
- Cores: cor de marca por banco (mapa em `painel.js`) com paleta de reserva. Violeta `#8A05BE` é a cor da marca do app. Use tokens de `tema.css`; funcione em claro e escuro.
- Layout precisa caber em 390px sem rolagem horizontal.
- Bibliotecas novas só se forem indispensáveis, vendorizadas em `vendor/` com a licença, sem CDN.
- Comentários e mensagens de interface em português; nomes de funções em português também (`lerFatura`, `extrairLinhas`).

## Contribuições com IA

`CONTRIBUINDO-COM-IA.md` é o guia para pessoas que usam assistentes de IA. Ao trabalhar neste projeto, siga-o também: nunca peça, leia ou repita dados de faturas/notas reais; teste antes da correção; nada de afrouxar teste ou ajustar valor para a soma fechar.

## Skills do projeto

- `/adicionar-banco` — criar o leitor (plugin) de um banco novo a partir de um PDF, com caso de teste fictício.
- `/ajustar-categorias` — corrigir ou ampliar as regras de estabelecimento e categoria.
- `/melhorar-leitura-de-notas` — corrigir a leitura de fotos/PDF/XML de notas e o vínculo com o cartão.
- `/verificar-antes-de-publicar` — checagem completa (sintaxe, leitores, painel, privacidade) antes de commit ou release.
