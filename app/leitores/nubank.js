// @ts-check
/* Raio-X da Fatura — leitor de faturas do Nubank (PDF enviado pelo app/e-mail). */
(function (g) {
  const RX = g.RaioX, U = RX.util;
  RX.registrarLeitor({
    id: 'nubank', banco: 'Nubank',
    reconhece: (t) => /Nubank|Nu Pagamentos|aplicativo do Nu\b/i.test(t) && /TRANSAÇÕES/i.test(t),
    ler(paginas, t) {
      const fatura = {
        cartao: 'Mastercard',
        titular: U.achar(t, /Olá,\s*([^.\n]+)\./) || U.achar(t, /\n([A-ZÀ-Ú ]{6,})\nFATURA /),
        total: U.valor(U.achar(t, /Total a pagar\s+(R\$\s*[\d.,]+)/i)),
        vencimento: U.dataExtenso(U.achar(t, /Data de vencimento:\s*([^\n]+)/i)) || U.dataExtenso(U.achar(t, /FATURA\s+(\d{1,2} \w{3} \d{4})/)),
        fechamento: U.dataExtenso(U.achar(t, /EMISSÃO E ENVIO\s+(\d{1,2} \w{3} \d{4})/i)),
        limite_total: U.valor(U.achar(t, /Limite total do cartão de crédito:\s*(R\$\s*[\d.,]+)/i)),
        limite_utilizado: U.valor(U.achar(t, /\nLimite total\s+(R\$\s*[\d.,]+)/)),
        a_vencer: U.valor(U.achar(t, /Saldo em aberto total\s+(R\$\s*[\d.,]+)/i)),
        pagamento_minimo: U.valor(U.achar(t, /Pagamento mínimo\s+(R\$\s*[\d.,]+)/i)),
        juros_rotativo_am: U.valor(U.achar(t, /rotativo[^\n]*?(\d{1,2},\d{2})\s*% ?a\.?m/i))
      };
      const ref = fatura.fechamento || fatura.vencimento;
      const lancamentos = [];
      let dentro = false, portador = fatura.titular, ignorar = false;
      const linhas = paginas.flat().map(l => l.texto.trim());
      for (const ln of linhas) {
        if (/^TRANSAÇÕES/i.test(ln)) { dentro = true; continue; }
        if (!dentro) continue;
        if (/^(Em cumprimento|Como assegurado|\d+ de \d+$)/i.test(ln)) { dentro = /^\d+ de \d+$/.test(ln) ? dentro : false; continue; }
        const grupo = ln.match(/^([^\d•]+?)\s{2,}[−\-]?R\$\s*[\d.,]+$/);
        if (grupo) {
          const nome = grupo[1].trim();
          ignorar = /^Pagamentos?$|^Pagamentos e/i.test(nome);
          if (!ignorar && !/^(Total|Saldo|Fatura)/i.test(nome)) portador = nome;
          continue;
        }
        const m = ln.match(/^(\d{2})\s+(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s+(.+?)\s{2,}([−\-]?R\$\s*[\d.,]+)$/i);
        if (!m || ignorar) continue;
        let desc = m[3].trim(), cartao = '';
        const c = desc.match(/^•+\s*(\d{4})\s+(.*)$/);
        if (c) { cartao = c[1]; desc = c[2].trim(); }
        if (/^Pagamento em /i.test(desc)) continue;
        let parcela = '';
        const p = desc.match(/\s*-\s*Parcela\s+(\d+)\/(\d+)\s*$/i);
        if (p) { parcela = `${+p[1]}/${+p[2]}`; desc = desc.slice(0, p.index).trim(); }
        const valor = U.valor(m[4]);
        const iof = /^IOF de /i.test(desc);
        lancamentos.push({
          data: U.comAno(+m[1], U.MESES[m[2].toUpperCase()], ref), descricao: desc, cartao, portador,
          parcela, valor, tipo: iof ? 'iof' : (valor < 0 ? 'estorno' : (/juros|multa|encargo/i.test(desc) ? 'encargo' : 'compra'))
        });
      }
      return { fatura, lancamentos };
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
