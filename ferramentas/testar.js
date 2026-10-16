#!/usr/bin/env node
/* Testa os leitores contra PDFs reais, sem navegador.
   Uso: npm install && npm run testar -- caminho/fatura1.pdf caminho/fatura2.pdf [--detalhes] [--celulas]
   --celulas mostra cada linha com as posições x das células (para escrever um leitor novo).
   Para cada PDF mostra o banco, o mês, o total e se a soma dos lançamentos confere com o total. */
const path = require('path'), fs = require('fs');
const raiz = path.resolve(__dirname, '..');
globalThis.window = globalThis; // os leitores de nota esperam window
const silenciar = console.log; console.log = () => {}; // avisos do pdf.js sobre canvas (não usamos)
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
console.log = silenciar;
['app/pdf-texto.js', 'app/leitores/comum.js', 'app/categorias.js', 'app/notas-leitura.js', ...fs.readdirSync(path.join(raiz, 'app/leitores')).filter(f => f !== 'comum.js').map(f => 'app/leitores/' + f)]
  .forEach(f => require(path.join(raiz, f)));
const RX = globalThis.RaioX;
const AVISO = '\n⚠  A saída abaixo tem os SEUS dados (nome, CPF, endereço, compras). Não cole em issues, chats ou IAs.\n';
const args = process.argv.slice(2), detalhes = args.includes('--detalhes'), celulas = args.includes('--celulas');
(async () => {
  let falhas = 0;
  for (const arq of args.filter(a => !a.startsWith('--'))) {
    const paginas = await RX.extrairLinhas(pdfjs, new Uint8Array(fs.readFileSync(arq)));
    if (celulas) { // posições x das células, para escrever um leitor ou um caso de teste
      console.log(AVISO);
      paginas.forEach((p, i) => { console.log(`=== ${path.basename(arq)} · página ${i + 1}`); p.forEach(l => console.log(String(Math.round(l.y)).padStart(4), l.celulas.map(c => `[${c.x}, '${c.s}']`).join(', '))); });
      continue;
    }
    const r = RX.lerFatura(paginas, path.basename(arq));
    if (!r.ok && RX.lerNotaTexto) {
      const n = RX.lerNotaTexto(RX.util.textoCompleto(paginas), { arquivo: path.basename(arq), origem: 'pdf' });
      if (n.ok && (n.nota.total > 0 || n.nota.loja)) {
        const nt = n.nota, soma = Math.round(nt.itens.reduce((t, i) => t + i.total, 0) * 100) / 100;
        const confere = !nt.itens.length || Math.abs(soma - nt.total) <= 0.05;
        if (!confere) falhas++;
        console.log(`${confere ? '✓' : '✗'} Nota ${nt.documento || ''} · ${nt.loja} · ${nt.data} · total ${nt.total} · itens somam ${soma} (${nt.itens.length})`);
        if (detalhes) { console.log({ ...nt, itens: undefined }); nt.itens.forEach(i => console.log(`   ${String(i.qtd).padStart(8)} × ${String(i.unitario).padStart(8)} = ${String(i.total).padStart(9)}  ${i.descricao}`)); }
        continue;
      }
    }
    if (!r.ok) { falhas++; console.log(`✗ ${arq}: ${r.motivo}`); if (detalhes) { console.log(AVISO); console.log(paginas.map(p => p.map(l => l.texto).join('\n')).join('\n---\n')); } continue; }
    const c = r.conferencia;
    if (!c.confere) falhas++;
    console.log(`${c.confere ? '✓' : '✗'} ${r.banco} ${r.fatura.mes}  total ${c.total}  soma ${c.soma}  (${r.lancamentos.length} lançamentos)`);
    if (detalhes) { console.log(AVISO); console.log(r.fatura); r.lancamentos.forEach(l => console.log(`   ${l.data}  ${l.cartao.padEnd(4)} ${l.portador.padEnd(10)} ${l.descricao.padEnd(32)} ${String(l.estabelecimento).padEnd(22)} ${l.categoria.padEnd(22)} ${l.parcela.padEnd(5)} ${l.valor}`)); }
  }
  process.exit(falhas ? 1 : 0);
})();
