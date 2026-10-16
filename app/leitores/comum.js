// @ts-check
/* Raio-X da Fatura — utilidades compartilhadas pelos leitores de fatura (os plugins).
   Cada leitor se registra com RaioX.registrarLeitor({ id, banco, reconhece(texto), ler(paginas, texto) }).
   ler() devolve { fatura: {...}, lancamentos: [...] } com valores numéricos e datas ISO.
   O contrato completo está em app/tipos.d.ts e o passo a passo em PLUGINS.md. */
(function (g) {
  /** @type {RaioX} */
  const RX = g.RaioX = g.RaioX || /** @type {RaioX} */ ({});
  RX.leitores = RX.leitores || [];
  /** @param {Leitor} l */
  RX.registrarLeitor = (l) => {
    const erro = (m) => { throw new Error(`Leitor inválido${l && l.id ? ' "' + l.id + '"' : ''}: ${m}`); };
    if (!l || typeof l !== 'object') erro('registre um objeto { id, banco, reconhece, ler }.');
    if (!/^[a-z0-9-]+$/.test(String(l.id || ''))) erro('id tem que ser curto, minúsculo e sem espaços (ex.: "nubank").');
    if (!String(l.banco || '').trim()) erro('falta o nome do banco.');
    if (typeof l.reconhece !== 'function' || typeof l.ler !== 'function') erro('reconhece e ler têm que ser funções.');
    if (RX.leitores.some(x => x.id === l.id)) erro('já existe um leitor com este id.');
    RX.leitores.push(l);
  };

  const TIPOS = ['compra', 'estorno', 'iof', 'anuidade', 'encargo'];
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  /** Confere o formato do que um leitor devolveu. Devolve a lista de problemas (vazia = tudo certo).
      @param {{ fatura: FaturaLida, lancamentos: LancamentoLido[] }} r */
  RX.validarLeitura = function (r) {
    const p = [];
    if (!r || typeof r !== 'object' || !r.fatura || !Array.isArray(r.lancamentos)) return ['ler() tem que devolver { fatura, lancamentos: [] }.'];
    const f = r.fatura;
    if (!ISO.test(String(f.vencimento || ''))) p.push('fatura.vencimento não é uma data AAAA-MM-DD.');
    if (f.fechamento && !ISO.test(f.fechamento)) p.push('fatura.fechamento não é uma data AAAA-MM-DD.');
    if (typeof f.total !== 'number' || !Number.isFinite(f.total)) p.push('fatura.total não é um número.');
    r.lancamentos.forEach((l, i) => {
      const onde = `lançamento ${i + 1} (${l && l.descricao})`;
      if (!l || typeof l !== 'object') { p.push(`lançamento ${i + 1} não é um objeto.`); return; }
      if (!ISO.test(String(l.data || ''))) p.push(`${onde}: data "${l.data}" não é AAAA-MM-DD.`);
      if (typeof l.valor !== 'number' || !Number.isFinite(l.valor)) p.push(`${onde}: valor não é um número.`);
      if (!String(l.descricao || '').trim()) p.push(`${onde}: sem descrição.`);
      if (l.parcela && !/^\d+\/\d+$/.test(l.parcela)) p.push(`${onde}: parcela "${l.parcela}" não está no formato n/N.`);
      if (l.tipo && !TIPOS.includes(l.tipo)) p.push(`${onde}: tipo "${l.tipo}" desconhecido (use ${TIPOS.join(', ')}).`);
    });
    return p;
  };

  const MESES = { JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6, JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12 };
  const pad = (n) => String(n).padStart(2, '0');

  const U = RX.util = {
    MESES,
    /** "1.234,56" | "−R$ 100,00" | "-2.500,00" | "R$1.000,00" → número */
    valor(txt) {
      if (txt == null) return null;
      const s = String(txt).replace(/\s/g, '');
      const m = s.match(/([−\-–]?)(?:R\$)?([−\-–]?)(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})/);
      if (!m) return null;
      const n = Number(m[3].replace(/\./g, '') + '.' + m[4]);
      return (m[1] || m[2]) ? -n : n;
    },
    ehValor: (s) => /^[−\-–]?(R\$\s?)?[−\-–]?\d{1,3}(\.\d{3})*,\d{2}\s?[DC]?$/.test(String(s).trim()),
    /** "15/10/2026" → "2026-10-15" */
    dataBR(txt) {
      const m = String(txt || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
      return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
    },
    /** "15 OUT 2026" → "2026-10-15" */
    dataExtenso(txt) {
      const m = String(txt || '').toUpperCase().match(/(\d{1,2})\s+(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\w*\s+(\d{4})/);
      return m ? `${m[3]}-${pad(MESES[m[2]])}-${pad(m[1])}` : '';
    },
    /** Data sem ano (dia, mês) → ISO, usando a data de fechamento como referência.
        Compras parceladas antigas (mês depois do fechamento) ficam no ano anterior. */
    comAno(dia, mes, referenciaISO) {
      const ref = new Date((referenciaISO || new Date().toISOString().slice(0, 10)) + 'T12:00:00Z');
      let ano = ref.getUTCFullYear();
      const d = new Date(Date.UTC(ano, mes - 1, dia, 12));
      if (d.getTime() - ref.getTime() > 20 * 864e5) ano -= 1;
      return `${ano}-${pad(mes)}-${pad(dia)}`;
    },
    primeiroNome(nome) {
      const p = String(nome || '').trim().split(/\s+/)[0] || '';
      return p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : '';
    },
    achar(texto, re, grupo = 1) { const m = texto.match(re); return m ? m[grupo] : ''; },

    /** Ordena as linhas das páginas por coluna (documentos em duas colunas) e depois de cima para baixo.
        As colunas são deduzidas pelas células que começam com uma data dd/mm.
        Devolve [{ pagina, coluna, y, celulas: [{s, x}] , texto }] já na ordem de leitura. */
    linhasPorColuna(paginas, reData = /^\d{2}\/\d{2}(\s|$)/) {
      const saida = [];
      paginas.forEach((linhas, pi) => {
        const xs = [];
        linhas.forEach(l => l.celulas.forEach(c => { if (reData.test(c.s)) xs.push(c.x); }));
        xs.sort((a, b) => a - b);
        const inicios = [];
        xs.forEach(x => { if (!inicios.length || x - inicios[inicios.length - 1] > 120) inicios.push(x); });
        if (!inicios.length) inicios.push(0);
        const colDe = (x) => { let c = -1; inicios.forEach((ini, i) => { if (x >= ini - 12) c = i; }); return c; };
        const porCol = inicios.map(() => []);
        linhas.forEach(l => {
          const grupos = new Map();
          l.celulas.forEach(c => { const k = colDe(c.x); if (k < 0) return; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(c); });
          grupos.forEach((cels, k) => porCol[k].push({ pagina: pi, coluna: k, y: l.y, celulas: cels, texto: cels.map(c => c.s).join('   ') }));
        });
        porCol.forEach(col => { col.sort((a, b) => b.y - a.y); saida.push(...col); });
      });
      return saida;
    },
    textoCompleto: (paginas) => paginas.map(p => p.map(l => l.texto).join('\n')).join('\n')
  };

  /** Lê um PDF já convertido em páginas de linhas: escolhe o leitor, normaliza e categoriza.
      @param {Pagina[]} paginas @param {string} nomeArquivo @returns {ResultadoLeitura} */
  RX.lerFatura = function (paginas, nomeArquivo) {
    const texto = U.textoCompleto(paginas);
    const leitor = RX.leitores.find(l => { try { return l.reconhece(texto); } catch (e) { return false; } });
    if (!leitor) return { ok: false, arquivo: nomeArquivo, motivo: 'Banco não reconhecido. Por enquanto o Raio-X da Fatura lê ' + RX.leitores.map(l => l.banco).join(', ') + '.' };
    let r;
    try { r = leitor.ler(paginas, texto); }
    catch (e) { return { ok: false, arquivo: nomeArquivo, banco: leitor.banco, motivo: 'Erro ao ler a fatura: ' + e.message }; }
    const problemas = RX.validarLeitura(r);
    if (!r || !r.fatura || !Array.isArray(r.lancamentos)) return { ok: false, arquivo: nomeArquivo, banco: leitor.banco, motivo: 'Erro no leitor: ' + problemas.join(' '), problemas };
    const f = /** @type {Fatura} */ (r.fatura);
    const lancs = /** @type {Lancamento[]} */ (r.lancamentos);
    f.banco = leitor.banco; f.arquivo = nomeArquivo; f.mes = (f.vencimento || '').slice(0, 7);
    const titular = U.primeiroNome(f.titular);
    f.titular = titular;
    lancs.forEach((l, i) => {
      l.banco = leitor.banco; l.mes = f.mes;
      l.portador = U.primeiroNome(l.portador || f.titular);
      l.adicional = titular && l.portador && l.portador !== titular ? 'sim' : 'nao';
      // Parcela 2/10 em diante: a compra é anterior ao fechamento, então nunca pode estar no futuro.
      const ref = f.fechamento || f.vencimento;
      const n = Number((l.parcela || '').split('/')[0]);
      if (ref && n > 1 && l.data > ref) l.data = String(Number(l.data.slice(0, 4)) - 1) + l.data.slice(4);
      if (l.tipo === 'encargo' && l.valor < 0) l.tipo = 'estorno';
      l.estabelecimento = RX.estabelecimento ? RX.estabelecimento(l.descricao) : l.descricao;
      l.tipo = l.tipo || (l.valor < 0 ? 'estorno' : 'compra');
      l.categoria = RX.categorizar ? RX.categorizar(l) : 'Outros';
      l.id = `${leitor.id}-${f.mes}-${String(i + 1).padStart(3, '0')}`;
    });
    const soma = Math.round(r.lancamentos.reduce((t, l) => t + l.valor, 0) * 100) / 100;
    const dif = Math.round((soma - (f.total || 0)) * 100) / 100;
    return { ok: true, arquivo: nomeArquivo, banco: leitor.banco, fatura: f, lancamentos: lancs, conferencia: { soma, total: f.total, diferenca: dif, confere: Math.abs(dif) <= 0.05 }, problemas };
  };
})(typeof window !== 'undefined' ? window : globalThis);
