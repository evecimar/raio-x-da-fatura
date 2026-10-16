#!/usr/bin/env node
/* Cria o esqueleto de um leitor (plugin) de banco novo e o caso de teste fictício dele.
   Uso: npm run novo-leitor -- <id> "<Nome do banco>"
   Ex.: npm run novo-leitor -- inter "Banco Inter"
   Depois: preencha o leitor e o caso de teste até `npm run test:unit` passar. Veja PLUGINS.md. */
const fs = require('node:fs');
const path = require('node:path');

const [id, ...resto] = process.argv.slice(2);
const banco = resto.join(' ').trim();
if (!/^[a-z0-9-]+$/.test(id || '') || !banco) {
  console.error('Uso: npm run novo-leitor -- <id> "<Nome do banco>"   (id minúsculo, sem espaços; ex.: inter "Banco Inter")');
  process.exit(1);
}
const raiz = path.resolve(__dirname, '..');
const leitor = path.join(raiz, 'app/leitores', id + '.js');
const caso = path.join(raiz, 'testes/casos/faturas', id + '.js');
for (const f of [leitor, caso]) if (fs.existsSync(f)) { console.error('Já existe: ' + path.relative(raiz, f)); process.exit(1); }

fs.writeFileSync(leitor, `// @ts-check
/* Raio-X da Fatura — leitor de faturas do ${banco}.
   Contrato em app/tipos.d.ts; passo a passo em PLUGINS.md. */
(function (g) {
  const RX = g.RaioX, U = RX.util;
  RX.registrarLeitor({
    id: '${id}', banco: '${banco.replace(/'/g, "\\'")}',
    // Algo exclusivo do banco (razão social, CNPJ, nome do produto) E algo exclusivo de fatura.
    reconhece: (t) => /TODO nome do banco/i.test(t) && /TODO palavra de fatura/i.test(t),
    ler(paginas, t) {
      // TODO: ajuste cada expressão ao texto do PDF do banco.
      /** @type {FaturaLida} */
      const fatura = {
        cartao: 'Cartão',
        titular: U.achar(t, /Olá,\\s*([^\\n.!]+)/).trim(),
        total: U.valor(U.achar(t, /Total a pagar\\s+(R\\$\\s*[\\d.,]+)/i)),
        vencimento: U.dataBR(U.achar(t, /Vencimento:?\\s*(\\d{2}\\/\\d{2}\\/\\d{4})/i)),
        fechamento: U.dataBR(U.achar(t, /Fechamento:?\\s*(\\d{2}\\/\\d{2}\\/\\d{4})/i)),
        limite_total: null, limite_utilizado: null, a_vencer: null, pagamento_minimo: null, juros_rotativo_am: null
      };
      const ref = fatura.fechamento || fatura.vencimento;
      /** @type {LancamentoLido[]} */
      const lancamentos = [];
      // Duas colunas? Troque paginas.flat() por U.linhasPorColuna(paginas).
      for (const ln of paginas.flat()) {
        const cel = ln.celulas.map(c => c.s);
        const iData = cel.findIndex(s => /^\\d{2}\\/\\d{2}$/.test(s));
        const iVal = cel.findIndex((s, i) => i > iData && U.ehValor(s));
        if (iData < 0 || iVal < 0) continue;
        const descricao = cel.slice(iData + 1, iVal).join(' ').trim();
        if (/PAGAMENTO DE FATURA/i.test(descricao)) continue; // TODO: como o banco escreve o pagamento da fatura anterior
        const [dd, mm] = cel[iData].split('/').map(Number);
        const valor = U.valor(cel[iVal]);
        lancamentos.push({ data: U.comAno(dd, mm, ref), descricao, cartao: '', portador: fatura.titular, parcela: '', valor, tipo: valor < 0 ? 'estorno' : 'compra' });
      }
      return { fatura, lancamentos };
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
`);

fs.writeFileSync(caso, `/* Fatura FICTÍCIA no layout do ${banco}. Nunca use dados reais aqui:
   copie a ESTRUTURA do PDF (posições x, rótulos fixos do banco) e invente nomes, lojas e valores.
   Para ver as posições x das células do seu PDF: npm run testar -- caminho/fatura.pdf --celulas */
const { L, pagina } = require('../paginas');

const paginas = [
  pagina(
    L(800, [40, 'TODO nome do banco']),
    L(780, [40, 'Olá, Ana Exemplo']),
    L(760, [40, 'Vencimento: 10/11/2026'], [300, 'Fechamento: 01/11/2026']),
    L(740, [40, 'Total a pagar'], [300, 'R$ 150,00']),
    L(700, [40, 'TODO palavra de fatura']),
    L(680, [40, '05/10'], [90, 'MERCADO EXEMPLO'], [400, '100,00']),
    L(660, [40, '20/10'], [90, 'POSTO EXEMPLO'], [400, '50,00'])
  )
];

const esperado = {
  banco: '${banco.replace(/'/g, "\\'")}',
  fatura: { mes: '2026-11', total: 150, vencimento: '2026-11-10', fechamento: '2026-11-01' },
  quantidade: 2,
  lancamentos: [
    { data: '2026-10-05', descricao: 'MERCADO EXEMPLO', valor: 100 }
  ]
};

module.exports = { arquivo: '${id}-ficticia.pdf', paginas, esperado };
`);

console.log(`Criados:
  app/leitores/${id}.js              o leitor (procure os TODO)
  testes/casos/faturas/${id}.js      o caso de teste fictício

Próximos passos:
  1. npm run testar -- caminho/da/sua/fatura.pdf --celulas   (veja as linhas e posições do PDF real)
  2. Ajuste o caso de teste para o layout do banco, com dados inventados
  3. npm run test:watch   e ajuste o leitor até tudo passar
  4. npm run testar -- caminho/da/sua/fatura.pdf             (✓ = soma bate com o total no PDF real)
  5. npm run montar && npm test`);
