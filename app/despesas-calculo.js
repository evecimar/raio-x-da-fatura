// @ts-check
/* Raio-X da Fatura — cálculo da visão Despesas (sem tela: só dados entram e saem, para poder testar).

   Regra (pedido de quem usa): despesa é o que você COMPROU no mês.
   - Compra no cartão conta no mês da compra, pelo valor total — parcelada também, uma vez só,
     mesmo que as parcelas apareçam em várias faturas.
   - Estornos são descontados; tarifas e juros (IOF, anuidade, encargos e créditos sobre eles) ficam à parte.
   - Nota ligada a um lançamento não soma de novo. Nota no crédito sem vínculo = "próxima fatura" até a
     fatura chegar. Nota em dinheiro, Pix ou débito = "fora do cartão" (já saiu da conta).
   - Um mês é "parcial" para um banco quando as faturas carregadas não cobrem os dias dele. */
(function (g) {
  'use strict';
  /** @type {any} */
  const RX = g.RaioX = g.RaioX || /** @type {any} */ ({});

  const N = (v) => { if (v == null || v === '') return 0; const n = Number(String(v).trim()); return Number.isFinite(n) ? n : 0; };
  const temValor = (v) => v != null && v !== '' && Number.isFinite(Number(v)) && Number(v) > 0;
  const r2 = (v) => Math.round(v * 100) / 100;
  const soma = (rows, f) => rows.reduce((t, r) => t + f(r), 0);
  const isoOk = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  const mesOk = (s) => /^\d{4}-\d{2}$/.test(String(s || ''));
  const parcelaDe = (p) => { const m = /^\s*(\d+)\s*\/\s*(\d+)/.exec(p || ''); return m ? { n: +m[1], de: +m[2] } : null; };
  const mesAnterior = (m) => { const [a, n] = String(m).split('-').map(Number); return n === 1 ? `${a - 1}-12` : `${a}-${String(n - 1).padStart(2, '0')}`; };
  /** Soma k meses a uma data ISO, sem passar do último dia do mês (31/01 + 1 → 28/02). */
  const addMeses = (iso, k) => {
    const [a, m, d] = iso.split('-').map(Number);
    const alvo = new Date(Date.UTC(a, m - 1 + k, 1));
    const ult = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
    return `${alvo.getUTCFullYear()}-${String(alvo.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(d, ult)).padStart(2, '0')}`;
  };
  const addMesesMes = (mes, k) => addMeses(mes + '-01', k).slice(0, 7);
  const dias = (x, y) => Math.round((new Date(y + 'T12:00:00Z').getTime() - new Date(x + 'T12:00:00Z').getTime()) / 864e5);
  const semAcentoMin = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  /** Valor de um lançamento do cartão: o que foi cobrado (parcela pelo valor da parcela; estorno negativo). */
  const valorCompra = (l) => N(l.valor);
  /** Tarifas: IOF, anuidade, juros/encargos — e créditos sobre elas (cashback/estorno de anuidade, IOF…). */
  const ehTarifa = (l) => ['iof', 'anuidade', 'encargo'].includes(String(l.tipo || '').toLowerCase()) || (N(l.valor) < 0 && /anuidade|tarifa|\biof\b|juros|encargo|multa/i.test(String(l.descricao || '')));

  RX.despesasUtil = { N, temValor, r2, soma, isoOk, mesOk, parcelaDe, mesAnterior, addMeses, addMesesMes, valorCompra, ehTarifa };

  /** Em quantas vezes a despesa foi parcelada: só vale no crédito, de 1 a 48 (o resto vira 1, à vista). */
  RX.parcelasDaNota = function (n) {
    if (!n || n.forma !== 'credito') return 1;
    const p = String(n.parcelas == null ? '' : n.parcelas).trim();
    return /^\d{1,2}$/.test(p) && +p >= 1 && +p <= 48 ? +p : 1;
  };
  /** Divide o total em N parcelas que somam exatamente o total; o centavo que sobra vai na 1ª (como fazem os bancos). */
  RX.valoresDasParcelas = function (total, de) {
    const cent = Math.round(N(total) * 100), k = Math.max(1, de | 0), base = Math.floor(cent / k);
    return Array.from({ length: k }, (_, i) => (i === 0 ? cent - base * (k - 1) : base) / 100);
  };

  /** Banco do cartão de final `fim`, pelo que aparece nos lançamentos (o mais frequente). */
  function bancoDoCartao(fim, lancamentos) {
    if (!/^\d{4}$/.test(String(fim || ''))) return '';
    const c = new Map();
    lancamentos.forEach(l => { if (l.cartao === fim && l.banco) c.set(l.banco, (c.get(l.banco) || 0) + 1); });
    const top = [...c].sort((a, b) => b[1] - a[1])[0];
    return top ? top[0] : '';
  }
  /**
   * Fatura (mês do vencimento, 'AAAA-MM') em que cai a 1ª parcela de uma compra no crédito feita em `data`.
   * Com o banco conhecido: a primeira fatura que fecha no dia da compra ou depois (fechamentos que não estão
   * carregados seguem o dia de fechamento da fatura carregada mais recente). Sem banco conhecido: a fatura do mês seguinte
   * (estimado: true, porque não se sabe o dia em que o cartão fecha).
   * @returns {{mes: string, banco: string, estimado: boolean}}
   */
  RX.faturaDaCompra = function (data, fim, { faturas = [], lancamentos = [] } = {}) {
    if (!isoOk(data)) return { mes: '', banco: '', estimado: true };
    const banco = bancoDoCartao(fim, lancamentos);
    const doBanco = faturas.filter(f => f.banco === banco && mesOk(f.mes) && isoOk(f.fechamento)).sort((a, b) => a.mes < b.mes ? -1 : 1);
    if (!banco || !doBanco.length) return { mes: addMesesMes(data.slice(0, 7), 1), banco, estimado: true };
    const ult = doBanco[doBanco.length - 1];
    const carregado = new Map(doBanco.map(f => [f.mes, f.fechamento]));
    for (let k = -60; k <= 60; k++) {
      const m = addMesesMes(ult.mes, k), fe = carregado.get(m) || addMeses(ult.fechamento, k);
      if (fe >= data) return { mes: m, banco, estimado: false };
    }
    return { mes: addMesesMes(data.slice(0, 7), 1), banco, estimado: true };
  };

  /** Fechamento de cada fatura (banco|mes → ISO). Sem fechamento, estima 9 dias antes do vencimento. */
  function mapaFechamentos(faturas) {
    const m = new Map();
    faturas.forEach(f => {
      const fe = isoOk(f.fechamento) ? f.fechamento : (isoOk(f.vencimento) ? new Date(new Date(f.vencimento + 'T12:00:00Z').getTime() - 9 * 864e5).toISOString().slice(0, 10) : '');
      if (fe) m.set(f.banco + '|' + f.mes, fe);
    });
    return m;
  }

  /**
   * Calcula a visão Despesas de um mês (ou de todos).
   * @param {{faturas?: Fatura[], lancamentos?: Lancamento[], notas?: any[], mes?: string, hoje?: string}} entrada
   *   mes: 'AAAA-MM' ou '*' (todos os meses); hoje: 'AAAA-MM-DD' (padrão: data de hoje), usado para meses parciais.
   */
  RX.calcularDespesas = function ({ faturas = [], lancamentos = [], notas = [], mes = '*', hoje = '' } = /** @type {any} */ ({})) {
    const todos = mes === (RX.TODOS || '*') || !mesOk(mes);
    if (todos) mes = '';
    const HL = lancamentos;
    const fechamentos = mapaFechamentos(faturas);
    const cicloDe = (l, f) => {
      const ant = fechamentos.get(l.banco + '|' + mesAnterior(l.mes));
      return ant ? Math.max(25, Math.min(35, dias(ant, f))) : 30;
    };

    /** Dia em que o lançamento foi cobrado. Compras à vista já trazem a data certa. Parcelas e estornos
        podem vir com a data da compra original (PicPay, Caixa) ou com a da cobrança (Nubank): se a data cai fora
        do ciclo da fatura, foi cobrada neste ciclo e conta no dia anterior ao fechamento. No próprio dia do
        fechamento (anuidade, cashback, IOF lançados no fechamento) conta no ciclo, não no mês seguinte. */
    function dataEfetiva(l) {
      if (!isoOk(l.data)) return l.data;
      const f = fechamentos.get(l.banco + '|' + l.mes);
      if (!f) return l.data;
      const d = dias(l.data, f), p = parcelaDe(l.parcela);
      if (d >= 1 && d <= (p && p.n > 1 ? cicloDe(l, f) : 35)) return l.data;
      const v = new Date(f + 'T12:00:00Z'); v.setUTCDate(v.getUTCDate() - 1);
      return v.toISOString().slice(0, 10);
    }
    /** Data em que a compra foi feita. Parcela n/N com data dentro do ciclo da fatura é a data da cobrança
        (ex.: Nubank): a compra foi n−1 meses antes. Fora do ciclo, a data impressa já é a da compra (PicPay, Caixa). */
    function dataDaCompra(l) {
      const p = parcelaDe(l.parcela);
      if (!p || p.n <= 1 || !isoOk(l.data)) return l.data;
      const f = fechamentos.get(l.banco + '|' + l.mes);
      if (!f) return l.data;
      const d = dias(l.data, f);
      return d >= 0 && d <= cicloDe(l, f) ? addMeses(l.data, -(p.n - 1)) : l.data;
    }

    const porId = new Map(HL.map(l => [l.id, l]));
    const vinc = (n) => n.vinculo && porId.has(n.vinculo) ? porId.get(n.vinculo) : null;
    const noMes = (iso) => isoOk(iso) && (todos || iso.slice(0, 7) === mes);

    // Cada compra uma vez: parcelas da mesma compra (banco, cartão, loja, nº de parcelas, valor, mês da compra)
    // viram uma só, guardando a parcela mais adiantada.
    const vistas = new Map();
    HL.forEach(l => {
      const v = N(l.valor);
      if (!(v > 0) || ehTarifa(l)) return;
      const p = parcelaDe(l.parcela), parcelado = !!(p && p.de > 1);
      const data = dataDaCompra(l);
      const chave = parcelado ? [l.banco, l.cartao, semAcentoMin(l.estabelecimento || l.descricao), p.de, v.toFixed(2), String(data).slice(0, 7)].join('|') : 'id:' + l.id;
      const atual = vistas.get(chave);
      if (!atual || (parcelado && p.n > atual.n)) vistas.set(chave, { l, data, valor: parcelado ? r2(v * p.de) : v, parcelado, n: p ? p.n : 1, de: parcelado ? p.de : 1, parcela: v });
    });
    const todasCompras = [...vistas.values()];
    const compras = todasCompras.filter(c => noMes(c.data));
    const estornos = HL.filter(l => N(l.valor) < 0 && !ehTarifa(l) && noMes(l.data));
    const tarifas = HL.filter(l => ehTarifa(l) && noMes(dataEfetiva(l)));
    const cartao = compras.map(c => c.l), parceladas = compras.filter(c => c.parcelado);
    const notasMes = notas.filter(n => todos ? true : n.mes === mes);
    // "Fora do cartão": sem vínculo e paga de outro jeito, ou no crédito mas marcada pela pessoa como "não está no cartão".
    const foraDoCartao = (n) => !vinc(n) && (n.forma !== 'credito' || n.vinculo_tipo === 'manual');
    const fora = notasMes.filter(foraDoCartao);
    const totEstornos = r2(soma(estornos, valorCompra));
    // Nota no crédito que ainda não está numa fatura carregada: conta como cartão até a fatura chegar.
    const pendentes = notasMes.filter(n => !vinc(n) && n.forma === 'credito' && n.vinculo_tipo !== 'manual' && temValor(n.total));
    const totPend = r2(soma(pendentes, n => N(n.total)));
    const totCompras = r2(soma(compras, c => c.valor));
    const totTarifas = r2(soma(tarifas, valorCompra));
    const totCartaoFaturas = r2(totCompras + totEstornos);
    const totCartao = r2(totCartaoFaturas + totPend);
    const totFora = r2(soma(fora, n => temValor(n.total) ? N(n.total) : 0));
    const revisar = notas.filter(n => (n.revisar || !temValor(n.total)) && (todos || n.mes === mes || !n.mes));
    const credSemVinculo = (todos ? notasMes : notasMes.concat(notas.filter(n => !n.mes))).filter(n => !n.revisar && temValor(n.total) && n.forma === 'credito' && !vinc(n) && n.vinculo_tipo !== 'manual');

    // Mês das compras da fatura selecionada (normalmente o anterior): para a dica "ver compras de ...".
    let mesDasCompras = '';
    if (mes) {
      const c = new Map();
      HL.filter(l => l.mes === mes && N(l.valor) > 0 && isoOk(l.data) && !parcelaDe(l.parcela)).forEach(l => c.set(l.data.slice(0, 7), (c.get(l.data.slice(0, 7)) || 0) + 1));
      const top = [...c].sort((a, b) => b[1] - a[1])[0];
      if (top && top[0] !== mes) mesDasCompras = top[0];
    }

    // Cobertura: cada fatura cobre o ciclo (fechamento anterior, fechamento]. Um mês de compras está completo para um
    // banco quando os ciclos das faturas carregadas cobrem os dias do mês (tolerância de 3 dias).
    const bancos = [...new Set(faturas.map(f => f.banco))];
    const DIA = 864e5, t = (iso) => new Date(iso + 'T12:00:00Z').getTime();
    const ciclos = new Map();
    faturas.forEach(f => {
      const fe = fechamentos.get(f.banco + '|' + f.mes); if (!fe) return;
      const ant = fechamentos.get(f.banco + '|' + mesAnterior(f.mes));
      const ini = ant ? t(ant) + DIA : t(fe) - 29 * DIA;
      if (!ciclos.has(f.banco)) ciclos.set(f.banco, []);
      ciclos.get(f.banco).push([ini, t(fe)]);
    });
    const diaDeHoje = isoOk(hoje) ? hoje : new Date().toISOString().slice(0, 10);
    /** Bancos cujas faturas carregadas não cobrem o mês m (dias futuros não contam). */
    const faltaFatura = (m) => {
      if (!mesOk(m)) return [];
      const ini = t(m + '-01'), fim = t(addMesesMes(m, 1) + '-01') - DIA;
      const ultimo = Math.min(fim, t(diaDeHoje));
      if (ultimo < ini) return [];
      return bancos.filter(b => {
        const cs = ciclos.get(b) || []; let faltam = 0;
        for (let d = ini; d <= ultimo; d += DIA) if (!cs.some(([a, z]) => d >= a && d <= z)) faltam++;
        return faltam > 3;
      });
    };
    const parcial = (m) => bancos.length > 0 && faltaFatura(m).length > 0;
    const mesesNotas = [...new Set(notas.map(n => n.mes).filter(mesOk))];
    const mesesCartao = [...new Set(todasCompras.map(c => String(c.data).slice(0, 7)).filter(mesOk))];

    return {
      todos, mes, HL, notas, faturas, porId, vinc, cartao, compras, todasCompras, estornos, totEstornos, tarifas, totTarifas, totCompras,
      dataEfetiva, dataDaCompra, parceladas, notasMes, fora, foraDoCartao, pendentes, totPend, totCartaoFaturas, totCartao, totFora,
      total: r2(totCartao + totFora), revisar, credSemVinculo, mesDasCompras, mesesNotas, mesesCartao, parcial, faltaFatura
    };
  };

  /**
   * "Como vai ser pago": em qual fatura cai cada compra do período, quanto fica para parcelas de outras faturas,
   * o que está pendente (próxima fatura) e o que já saiu da conta (Pix, dinheiro, débito).
   * @param {ReturnType<typeof RX.calcularDespesas>} C
   * @returns {{faturas: {banco: string, mes: string, valor: number, fatura: object|undefined}[], outras: number, ultimoMesParcela: string,
   *   pendentes: number, estornos: number, fora: {forma: string, valor: number, quantidade: number}[]}}
   */
  RX.comoVaiSerPago = function (C) {
    const porFatura = new Map(); let outras = 0, ultimoMesParcela = '';
    const somaF = (k, v) => porFatura.set(k, r2((porFatura.get(k) || 0) + v));
    C.compras.forEach(c => {
      if (!c.parcelado) { somaF(c.l.banco + '|' + c.l.mes, c.valor); return; }
      const mes1 = addMesesMes(c.l.mes, -(c.n - 1)); // fatura da 1ª parcela
      for (let k = 1; k <= c.de; k++) {
        const mesK = addMesesMes(mes1, k - 1);
        if (mesK === c.l.mes) somaF(c.l.banco + '|' + mesK, c.parcela);
        else { outras = r2(outras + c.parcela); if (mesK > ultimoMesParcela) ultimoMesParcela = mesK; }
      }
    });
    // Nota no crédito ainda sem fatura: a 1ª parcela vai para a próxima fatura; as outras, para as seguintes.
    let pendentes = 0;
    C.pendentes.forEach(n => {
      const vals = RX.valoresDasParcelas(N(n.total), RX.parcelasDaNota(n));
      pendentes = r2(pendentes + vals[0]);
      if (vals.length < 2) return;
      outras = r2(outras + soma(vals.slice(1), v => v));
      const f = RX.faturaDaCompra(n.data, n.cartao_final, { faturas: C.faturas, lancamentos: C.HL });
      const ultimo = f.mes ? addMesesMes(f.mes, vals.length - 1) : '';
      if (ultimo > ultimoMesParcela) ultimoMesParcela = ultimo;
    });
    const faturas = [...porFatura].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([k, valor]) => {
      const [banco, mes] = k.split('|');
      return { banco, mes, valor, fatura: C.faturas.find(x => x.banco === banco && x.mes === mes) };
    });
    const fora = ['dinheiro', 'pix', 'debito', 'outro', ''].map(forma => {
      const ns = C.fora.filter(n => (n.forma || '') === forma && temValor(n.total));
      return { forma, valor: r2(soma(ns, n => N(n.total))), quantidade: ns.length };
    }).filter(x => x.valor > 0);
    return { faturas, outras, ultimoMesParcela, pendentes, estornos: C.totEstornos, fora };
  };

  /**
   * "Próximos meses": o que esperar pagar no cartão, do mês de `hoje` em diante, por fatura (mês do vencimento).
   * - faturas carregadas que ainda não foram pagas, pelo total;
   * - parcelas de compras do cartão que continuam depois da última fatura carregada daquele banco;
   * - despesas digitadas (ou notas) no crédito ainda sem lançamento ligado, divididas em parcelas.
   * Nota ligada a um lançamento ou marcada como "não está no cartão" não entra (já está, ou não vai estar, numa fatura).
   * @param {{faturas?: any[], lancamentos?: any[], notas?: any[], hoje?: string}} entrada
   * @returns {{meses: {mes: string, total: number, itens: {tipo: 'fatura'|'parcela'|'nota', descricao: string, banco: string,
   *   parcela: string, valor: number, estimado: boolean, id: string}[]}[], total: number}}
   */
  RX.proximosMeses = function ({ faturas = [], lancamentos = [], notas = [], hoje = '' } = {}) {
    const diaHoje = isoOk(hoje) ? hoje : new Date().toISOString().slice(0, 10), mesHoje = diaHoje.slice(0, 7);
    const C = RX.calcularDespesas({ faturas, lancamentos, notas, mes: '*', hoje: diaHoje });
    const itens = [];
    const add = (mes, item) => { if (mesOk(mes) && mes >= mesHoje && item.valor > 0) itens.push({ mes, ...item }); };
    faturas.forEach(f => {
      if (f.paga === 'sim' || !temValor(f.total)) return;
      add(f.mes, { tipo: 'fatura', descricao: 'Fatura ' + f.banco, banco: f.banco, parcela: '', valor: r2(N(f.total)), estimado: false, id: f.banco + '|' + f.mes });
    });
    const ultimoMes = new Map();
    faturas.forEach(f => { if (mesOk(f.mes) && !(String(ultimoMes.get(f.banco) || '') >= f.mes)) ultimoMes.set(f.banco, f.mes); });
    C.todasCompras.forEach(c => {
      if (!c.parcelado || !mesOk(c.l.mes)) return;
      const fim = ultimoMes.get(c.l.banco) || c.l.mes;
      for (let k = c.n + 1; k <= c.de; k++) {
        const m = addMesesMes(c.l.mes, k - c.n);
        if (m <= fim) continue; // fatura carregada: se a parcela não está nela, não há o que prever
        add(m, { tipo: 'parcela', descricao: c.l.estabelecimento || c.l.descricao || 'Compra parcelada', banco: c.l.banco, parcela: `${k}/${c.de}`, valor: r2(c.parcela), estimado: false, id: c.l.id });
      }
    });
    C.notas.filter(n => !C.vinc(n) && n.forma === 'credito' && n.vinculo_tipo !== 'manual' && temValor(n.total)).forEach(n => {
      const de = RX.parcelasDaNota(n), vals = RX.valoresDasParcelas(N(n.total), de);
      const f = RX.faturaDaCompra(n.data, n.cartao_final, { faturas, lancamentos });
      if (!f.mes) return;
      vals.forEach((v, i) => add(addMesesMes(f.mes, i), { tipo: 'nota', descricao: String(n.loja || '').trim() || 'Despesa no crédito', banco: f.banco, parcela: de > 1 ? `${i + 1}/${de}` : '', valor: v, estimado: f.estimado, id: n.id }));
    });
    const ordem = { fatura: 0, parcela: 1, nota: 2 };
    const meses = [...new Set(itens.map(i => i.mes))].sort().map(mes => {
      const doMes = itens.filter(i => i.mes === mes).sort((a, b) => ordem[a.tipo] - ordem[b.tipo] || b.valor - a.valor).map(({ mes: _, ...i }) => i);
      return { mes, total: r2(soma(doMes, i => i.valor)), itens: doMes };
    });
    return { meses, total: r2(soma(meses, m => m.total)) };
  };

  /** Gastos por categoria (cartão + fora dele + pendentes), do maior para o menor. */
  RX.despesasPorCategoria = function (C) {
    const m = new Map();
    const add = (c, v, onde) => { const o = m.get(c) || { c, v: 0, cartao: 0, fora: 0 }; o.v += v; o[onde] += v; m.set(c, o); };
    const cat = (x) => String(x || '').trim() || 'Sem categoria';
    C.compras.forEach(c => add(cat(c.l.categoria), c.valor, 'cartao'));
    C.fora.forEach(n => { if (temValor(n.total)) add(cat(n.categoria), N(n.total), 'fora'); });
    C.pendentes.forEach(n => add(cat(n.categoria), N(n.total), 'cartao'));
    return [...m.values()].sort((a, b) => b.v - a.v);
  };

  /** Mês a mês (para "Todos os meses"): cartão (compras − estornos + pendentes) e fora do cartão, do mais recente. */
  RX.despesasPorMes = function (C) {
    const ms = [...new Set(C.todasCompras.map(c => String(c.data).slice(0, 7)).concat(C.fora.map(n => n.mes), C.pendentes.map(n => n.mes)).filter(mesOk))].sort().reverse();
    return ms.map(m => {
      const cartao = r2(soma(C.todasCompras.filter(x => String(x.data).slice(0, 7) === m), x => x.valor) +
        soma(C.HL.filter(l => N(l.valor) < 0 && !ehTarifa(l) && String(l.data).slice(0, 7) === m), valorCompra) +
        soma(C.pendentes.filter(n => n.mes === m), n => N(n.total)));
      const fora = r2(soma(C.fora.filter(n => n.mes === m), n => temValor(n.total) ? N(n.total) : 0));
      return { mes: m, cartao, fora, total: r2(cartao + fora), parcial: C.parcial(m) };
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
