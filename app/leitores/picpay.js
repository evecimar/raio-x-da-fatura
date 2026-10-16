// @ts-check
/* Raio-X da Fatura — leitor de faturas do cartão PicPay (layout em duas colunas). */
(function (g) {
  const RX = g.RaioX, U = RX.util;
  RX.registrarLeitor({
    id: 'picpay', banco: 'PicPay',
    reconhece: (t) => /PicPay/i.test(t) && /Total geral dos lançamentos|Picpay Card/i.test(t),
    ler(paginas, t) {
      const fatura = {
        cartao: (U.achar(t, /PicPay\s+(Mastercard®?\s*\w*|Visa\s*\w*|Elo\s*\w*)/i) || 'Cartão').replace('®', '').replace(/\b(\w)(\w*)/g, (a, b, c) => b + c.toLowerCase()).trim(),
        titular: U.achar(t, /Olá,\s*([^!\n]+)!/) || U.achar(t, /^([A-ZÀ-Ú ]+),/m),
        total: U.valor(U.achar(t, /Total da fatura\s+(R\$\s*[\d.,]+)/i)) ?? U.valor(U.achar(t, /Total geral dos lançamentos\s+([\d.,]+)/i)),
        vencimento: U.dataBR(U.achar(t, /Vencimento:\s*(\d{2}\/\d{2}\/\d{4})/i)),
        fechamento: U.dataBR(U.achar(t, /Fechamento:\s*(\d{2}\/\d{2}\/\d{4})/i)),
        limite_total: U.valor(U.achar(t, /Limite total\s+([\d.]+,\d{2})/i)),
        limite_utilizado: U.valor(U.achar(t, /Limite utilizado\s+([\d.]+,\d{2})/i)),
        a_vencer: U.valor(U.achar(t, /Total próximas faturas\s+(R\$\s*[\d.,]+)/i)),
        pagamento_minimo: U.valor(U.achar(t, /Pagamento mínimo[ \t]+(R\$\s*[\d.,]+)/i)) ?? U.valor(U.achar(t, /pagamento mínimo no valor de\s+(R\$\s*[\d.,]+)/i)),
        juros_rotativo_am: U.valor(U.achar(t, /Saldo financiado\s+(\d{1,2},\d{2})%/i) || U.achar(t, /Taxas de juros\s+(\d{1,2},\d{2})%/i))
      };
      const ref = fatura.fechamento || fatura.vencimento;
      const lancamentos = [];
      let cartao = '', portador = fatura.titular;
      for (const ln of U.linhasPorColuna(paginas)) {
        const cel = ln.celulas.map(c => c.s);
        const txt = cel.join(' ').trim();
        const card = txt.match(/^Picpay Card(?:\s+final\s+(\d{4}))?$/i);
        if (card) { cartao = card[1] || ''; continue; }
        if (/^[A-ZÀ-Ú][A-ZÀ-Ú ]{4,}$/.test(txt) && !/TRANSA|ESTABELECIMENTO/.test(txt)) { portador = txt; continue; }
        // Uma linha pode ter "dd/mm  descrição  valor"
        const iData = cel.findIndex(s => /^\d{2}\/\d{2}$/.test(s));
        if (iData < 0) continue;
        const iVal = cel.findIndex((s, i) => i > iData && U.ehValor(s));
        if (iVal < 0) continue;
        let desc = cel.slice(iData + 1, iVal).join(' ').trim();
        if (/PAGAMENTO DE FATURA/i.test(desc)) continue;
        let parcela = '';
        const p = desc.match(/\s*PARC\s*(\d{2})\/(\d{2})\s*$/i);
        if (p) { parcela = `${+p[1]}/${+p[2]}`; desc = desc.slice(0, p.index).trim(); }
        const [dd, mm] = cel[iData].split('/').map(Number);
        const valor = U.valor(cel[iVal]);
        lancamentos.push({
          data: U.comAno(dd, mm, ref), descricao: desc, cartao, portador, parcela, valor,
          tipo: /IOF/i.test(desc) ? 'iof' : /ANUIDADE/i.test(desc) ? 'anuidade' : /JUROS|MULTA|ENCARGO/i.test(desc) ? 'encargo' : (valor < 0 ? 'estorno' : 'compra')
        });
      }
      return { fatura, lancamentos };
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
