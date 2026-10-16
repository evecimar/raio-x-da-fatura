/* Gera um PDF de verdade a partir de um caso fictício (testes/casos/faturas/*.js), escrevendo cada célula
   na posição (x, y) do caso. Assim os testes passam pelo mesmo caminho de um PDF real:
   PDF → pdf.js → linhas → leitor. Os PDFs são gerados na hora e não ficam no repositório. */
const { PDFDocument, StandardFonts } = require('pdf-lib');

// A fonte padrão do PDF (WinAnsi) não tem alguns caracteres: troca pelos equivalentes.
const TROCAS = { '−': '-', '–': '-', '“': '"', '”': '"' };
const seguro = (s) => String(s).replace(/[−–“”]/g, (c) => TROCAS[c]);

/** @param {{paginas: {y:number, celulas:{s:string,x:number}[]}[][]}} caso @returns {Promise<Uint8Array>} */
async function gerarPdf(caso, { tamanho = 7 } = {}) {
  const doc = await PDFDocument.create();
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  for (const linhas of caso.paginas) {
    const pg = doc.addPage([595, 842]);
    for (const l of linhas) for (const c of l.celulas) pg.drawText(seguro(c.s), { x: c.x, y: l.y, size: tamanho, font: fonte });
  }
  return doc.save();
}

module.exports = { gerarPdf };
