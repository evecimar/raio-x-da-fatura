/* Caminho completo de um PDF: gera um PDF fictício com o layout de cada banco, extrai as linhas com o
   pdf.js (app/pdf-texto.js) e confere que o leitor chega no mesmo resultado do caso de teste. */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { carregar, simples, LEITORES } = require('../carregar.js');
const { gerarPdf } = require('../casos/gerar-pdf.js');

const log = console.log; console.log = () => {};
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
console.log = log;

const pasta = path.join(__dirname, '../casos/faturas');
const casos = fs.readdirSync(pasta).filter(f => f.endsWith('.js')).map(f => ({ nome: f.replace(/\.js$/, ''), ...require(path.join(pasta, f)) }));

describe.each(casos)('PDF fictício $nome', (caso) => {
  it('pdf.js → leitor: soma confere e bate com o caso', async () => {
    const RX = carregar(['app/pdf-texto.js', ...LEITORES]);
    const paginas = await RX.extrairLinhas(pdfjs, await gerarPdf(caso));
    const r = simples(RX.lerFatura(paginas, caso.arquivo));
    expect(r.ok, r.motivo).toBe(true);
    expect(r.banco).toBe(caso.esperado.banco);
    expect(r.conferencia.confere).toBe(true);
    expect(r.fatura).toMatchObject(caso.esperado.fatura);
    expect(r.lancamentos).toHaveLength(caso.esperado.quantidade);
  });
});
