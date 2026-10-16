// @ts-check
/* Raio-X da Fatura — leitor de faturas dos Cartões Caixa (demonstrativo em duas colunas, valores com D/C). */
(function (g) {
  const RX = g.RaioX, U = RX.util;
  const valorDC = (s) => { const m = String(s).trim().match(/^([\d.]+,\d{2})\s?([DC])$/); return m ? (m[2] === 'C' ? -1 : 1) * U.valor(m[1]) : null; };
  RX.registrarLeitor({
    id: 'caixa', banco: 'Caixa',
    reconhece: (t) => /CART[ÕO]ES CAIXA|Cartões Caixa|caixa\.gov\.br/i.test(t) && /Demonstrativo/i.test(t),
    ler(paginas, t) {
      const fatura = {
        cartao: (U.achar(t, /\b(Visa|Mastercard|Elo)\s+(Infinite|Platinum|Gold|Black|Signature|Nanquim|Internacional)?/i, 0) || 'Cartão Caixa').trim(),
        titular: U.achar(t, /Pagador:\s*([A-ZÀ-Ú ]+?)\s{2,}CPF/) || U.achar(t, /\n([A-ZÀ-Ú ]{6,}?)\s+\d{2}\/\d{2}\/\d{4}\n/),
        total: U.valor(U.achar(t, /Valor total desta fatura\s+(R\$\s*[\d.,]+)/i) || U.achar(t, /VALOR TOTAL DESTA FATURA[\s\S]{0,60}?(R\$\s*[\d.,]+)/)),
        vencimento: U.dataBR(U.achar(t, /VENCIMENTO[\s\S]{0,80}?(\d{2}\/\d{2}\/\d{4})/)),
        fechamento: U.dataBR(U.achar(t, /aprovadas até dia\s+(\d{2}\/\d{2}\/\d{4})/i) || U.achar(t, /Data do Processamento[\s\S]{0,120}?(\d{2}\/\d{2}\/\d{4})\s+\d{11,}/)),
        limite_total: U.valor(U.achar(t, /Limite Total[\s\-]*(R\$\s*[\d.,]+)/i) || U.achar(t, /\nTOTAL\s+(R\$\s*[\d.,]+)/)),
        limite_utilizado: U.valor(U.achar(t, /UTILIZADO\s+(R\$\s*[\d.,]+)/)),
        a_vencer: U.valor(U.achar(t, /DESPESAS A VENCER:\s*(R\$\s*[\d.,]+)/i)),
        pagamento_minimo: U.valor(U.achar(t, /não paga juros!\s+(R\$\s*[\d.,]+)/i)),
        juros_rotativo_am: U.valor(U.achar(t, /ROTATIVO\s+(\d{1,2},\d{2})% a\.m/))
      };
      // Produto: "Visa Gold" etc. só se aparecer; senão nome genérico.
      if (!/Visa|Master|Elo/i.test(fatura.cartao)) {
        const bin = U.achar(t, /\b(\d)\d{3}\.XXXX\.XXXX\.\d{4}/);
        fatura.cartao = { 4: 'Visa', 5: 'Mastercard', 6: 'Elo' }[bin] || 'Cartão Caixa';
      }
      const ref = fatura.fechamento || fatura.vencimento;
      const lancamentos = [];
      let cartao = '', portador = fatura.titular, comecou = false;
      for (const ln of U.linhasPorColuna(paginas, /^\d{2}\/\d{2}(\s|$)/)) {
        const cel = ln.celulas.map(c => c.s);
        const txt = cel.join(' ').trim();
        if (/^Demonstrativo/i.test(txt)) comecou = true;
        if (!comecou) continue;
        const h = txt.match(/^(.*?)\s*\(Cart[aã]o\s+(\d{4})\)/i);
        if (h) {
          cartao = h[2];
          const nome = h[1].trim();
          if (nome && !/^(COMPRAS|COMPRAS PARCELADAS|SAQUES?|SERVIÇOS|ENCARGOS|Total)/i.test(nome)) portador = nome;
          continue;
        }
        // Anuidade sem data: "ANUIDADE DIFERENCIADA TIT 03/ 12   25,00D"
        const iV = cel.findIndex(s => valorDC(s) !== null);
        if (/^ANUIDADE/i.test(cel[0] || '') && iV > 0) {
          const v = valorDC(cel[iV]);
          if (v) {
            const p = txt.match(/(\d{1,2})\/\s?(\d{1,2})\s/);
            lancamentos.push({ data: fatura.fechamento || fatura.vencimento, descricao: cel.slice(0, iV).join(' ').replace(/\s*\d{1,2}\/\s?\d{1,2}$/, '').replace(/\s+\d{1,2}$/, '').trim(), cartao, portador, parcela: p ? `${+p[1]}/${+p[2]}` : '', valor: v, tipo: 'anuidade' });
          }
          continue;
        }
        const iData = cel.findIndex(s => /^\d{2}\/\d{2}(\s|$)/.test(s));
        if (iData < 0) continue;
        const iVal = cel.findIndex((s, i) => i >= iData && valorDC(s) !== null);
        if (iVal < 0) continue;
        const primeira = cel[iData];
        const [dd, mm] = primeira.slice(0, 5).split('/').map(Number);
        const meio = [primeira.slice(5).trim(), ...cel.slice(iData + 1, iVal)].filter(Boolean);
        let parcela = '';
        const idxP = meio.findIndex(s => /(^|\s)(\d{2}) DE (\d{2})$/.test(s));
        if (idxP >= 0) {
          const m = meio[idxP].match(/(^|\s)(\d{2}) DE (\d{2})$/);
          parcela = `${+m[2]}/${+m[3]}`;
          meio[idxP] = meio[idxP].slice(0, m.index).trim();
        }
        // A última célula antes do valor é a cidade (quando há mais de uma).
        const partes = meio.filter(Boolean);
        const desc = (partes.length > 1 ? partes.slice(0, -1) : partes).join(' ').replace(/\s+/g, ' ').trim();
        const valor = valorDC(cel[iVal]);
        if (/TOTAL DA FATURA ANTERIOR|OBRIGADO PELO PAGAMENTO|^PAGAMENTO EFETUADO|^PAGTO/i.test(desc)) continue;
        lancamentos.push({
          data: U.comAno(dd, mm, ref), descricao: desc, cartao, portador, parcela, valor,
          tipo: /IOF/i.test(desc) ? 'iof' : /ANUIDADE/i.test(desc) ? (valor < 0 ? 'estorno' : 'anuidade') : /JUROS|MULTA|ENCARGO|MORA/i.test(desc) ? 'encargo' : (valor < 0 ? 'estorno' : 'compra')
        });
      }
      return { fatura, lancamentos };
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
