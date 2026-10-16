/* Confere as SUAS faturas, se você as colocar em faturas/ (pasta ignorada pelo git, nunca vai para o GitHub).
   Para cada PDF que um leitor reconhece, a soma dos lançamentos tem que bater com o total da fatura.
   Sem a pasta, estes testes são pulados. Rode com: npm run test:unit */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { carregar, LEITORES, RAIZ } = require('../carregar.js');

const pasta = process.env.RX_FATURAS || path.join(RAIZ, 'faturas');
const pdfs = fs.existsSync(pasta) ? fs.readdirSync(pasta).filter(f => /\.pdf$/i.test(f)).sort() : [];

describe.skipIf(!pdfs.length)('faturas reais em ' + path.relative(RAIZ, pasta), () => {
  const RX = carregar(['app/pdf-texto.js', ...LEITORES]);
  let pdfjs;
  const ler = async (f) => {
    if (!pdfjs) { const log = console.log; console.log = () => {}; pdfjs = require('pdfjs-dist/legacy/build/pdf.js'); console.log = log; }
    const paginas = await RX.extrairLinhas(pdfjs, new Uint8Array(fs.readFileSync(path.join(pasta, f))));
    return RX.lerFatura(paginas, f);
  };
  it.each(pdfs)('%s', async (f) => {
    const r = await ler(f);
    if (!r.ok) return; // não é fatura de um banco conhecido (pode ser nota fiscal)
    expect(r.conferencia.confere, `${r.banco}: soma ${r.conferencia.soma} ≠ total ${r.conferencia.total}`).toBe(true);
    expect(r.lancamentos.length).toBeGreaterThan(0);
  });
});
