/* Raio-X da Fatura — extrai linhas de texto de um PDF (pdf.js), agrupando por altura e ordenando por posição. */
(function (g) {
  const RX = g.RaioX = g.RaioX || {};
  RX.extrairLinhas = async function (pdfjs, dados) {
    const doc = await pdfjs.getDocument({ data: dados, isEvalSupported: false, disableFontFace: true, verbosity: 0 }).promise;
    const paginas = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const pg = await doc.getPage(p);
      const tc = await pg.getTextContent();
      const itens = tc.items.filter(i => i.str && i.str.trim()).map(i => ({ s: i.str, x: i.transform[4], y: i.transform[5], w: i.width, h: Math.abs(i.transform[3]) || 8 }));
      itens.sort((a, b) => b.y - a.y || a.x - b.x);
      const linhas = [];
      for (const it of itens) {
        const l = linhas.find(l => Math.abs(l.y - it.y) <= Math.max(2, Math.min(l.h, it.h) * 0.45));
        if (l) l.itens.push(it); else linhas.push({ y: it.y, h: it.h, itens: [it] });
      }
      linhas.sort((a, b) => b.y - a.y);
      paginas.push(linhas.map(l => {
        l.itens.sort((a, b) => a.x - b.x);
        let txt = '', fim = null;
        for (const it of l.itens) {
          if (fim !== null) { const gap = it.x - fim; txt += gap > 12 ? '   ' : (gap > 1.5 && !txt.endsWith(' ') && !it.s.startsWith(' ') ? ' ' : ''); }
          txt += it.s; fim = it.x + it.w;
        }
        return { texto: txt.replace(/\s+$/, ''), celulas: l.itens.map(i => ({ s: i.s.trim(), x: Math.round(i.x) })), y: l.y };
      }));
    }
    return paginas;
  };
})(typeof window !== 'undefined' ? window : globalThis);
