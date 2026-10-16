/* Raio-X da Fatura — motor de dados.
   Guarda as faturas lidas, filtra pelo mês escolhido e entrega os conjuntos ao painel
   pela mesma API mínima usada pelo painel: dash.data, dash.calc, dash.onData, dash.colors. */
(function (g) {
  const RX = g.RaioX = g.RaioX || {};
  const COL_F = ['mes', 'banco', 'cartao', 'titular', 'total', 'vencimento', 'fechamento', 'limite_total', 'limite_utilizado', 'a_vencer', 'pagamento_minimo', 'juros_rotativo_am', 'arquivo', 'paga', 'arquivo_id'];
  const COL_L = ['id', 'mes', 'banco', 'cartao', 'portador', 'adicional', 'data', 'descricao', 'estabelecimento', 'categoria', 'parcela', 'valor', 'tipo'];

  const vazio = () => ({ faturas: [], lancamentos: [], notas: [] });
  let estado = vazio();
  let persistir = true;
  RX.mesSelecionado = '';
  RX.TODOS = '*'; // valor de mesSelecionado para "Todos os meses"

  const texto = (v) => v == null || (typeof v === 'number' && !isFinite(v)) ? '' : String(v);
  const linha = (o, cols) => { const r = {}; cols.forEach(c => { r[c] = texto(o[c]); }); return r; };
  const comColunas = (rows, cols) => { rows.columns = cols; return rows; };

  RX.meses = () => {
    const m = estado.faturas.length ? estado.faturas.map(f => f.mes) : estado.notas.map(n => n.mes); // só notas: meses das compras
    return [...new Set(m)].filter(Boolean).sort().reverse();
  };
  RX.temDados = () => estado.faturas.length > 0 || estado.notas.length > 0;
  RX.temFaturas = () => estado.faturas.length > 0;
  RX.estado = () => estado;

  /** Junta faturas novas às já guardadas. Uma fatura do mesmo banco e mês substitui a anterior. */
  RX.adicionar = function (resultados, { substituir = false } = {}) {
    if (substituir) estado = vazio();
    for (const r of resultados) {
      if (!r.ok) continue;
      const f = r.fatura;
      const chave = (x) => `${x.banco}|${x.mes}`;
      const k = chave(f);
      const antiga = estado.faturas.find(x => chave(x) === k);
      if (antiga && antiga.paga && !f.paga) f.paga = antiga.paga;
      estado.faturas = estado.faturas.filter(x => chave(x) !== k);
      estado.lancamentos = estado.lancamentos.filter(x => chave(x) !== k);
      estado.faturas.push(linha(f, COL_F));
      r.lancamentos.forEach(l => estado.lancamentos.push(linha(l, COL_L)));
    }
    if (RX.revincularNotas) RX.revincularNotas(estado);
    salvar();
    const meses = RX.meses();
    if (RX.mesSelecionado !== RX.TODOS && !meses.includes(RX.mesSelecionado)) RX.mesSelecionado = meses[0] || '';
    atualizar();
  };

  RX.usarDados = function (dados, { salvarNoNavegador = false } = {}) {
    estado = { faturas: (dados.faturas || []).map(f => linha(f, COL_F)), lancamentos: (dados.lancamentos || []).map(l => linha(l, COL_L)), notas: (dados.notas || []).map(n => ({ ...n })) };
    persistir = salvarNoNavegador;
    if (persistir) salvar();
    RX.mesSelecionado = RX.meses()[0] || '';
    atualizar();
  };

  RX.limpar = async function () {
    estado = vazio();
    if (RX.armazem) await RX.armazem.limpar();
    RX.mesSelecionado = '';
    atualizar();
  };

  /** Troca todo o estado (usado ao restaurar um backup). */
  RX.substituirEstado = function (dados) {
    estado = { faturas: (dados.faturas || []).map(f => linha(f, COL_F)), lancamentos: (dados.lancamentos || []).map(l => linha(l, COL_L)), notas: (dados.notas || []).map(n => JSON.parse(JSON.stringify(n))) };
    persistir = true;
    const meses = RX.meses();
    RX.mesSelecionado = meses[0] || '';
    const gravando = salvar();
    atualizar();
    return gravando;
  };

  /** Marca (ou desmarca) uma fatura como paga. Fica guardado junto com os dados. */
  RX.marcarPaga = function (banco, mes, paga) {
    const f = estado.faturas.find(x => x.banco === banco && x.mes === mes);
    if (!f) return;
    f.paga = paga ? 'sim' : '';
    salvar(); atualizar();
  };

  RX.selecionarMes = function (mes) { RX.mesSelecionado = mes; atualizar(); };

  function salvar() {
    if (!persistir || !RX.armazem) return Promise.resolve();
    return RX.armazem.gravarEstado(estado);
  }
  /** Carrega o que estiver guardado (IndexedDB, com migração do localStorage antigo). Assíncrono. */
  RX.carregarSalvo = async function () {
    try {
      const s = RX.armazem ? await RX.armazem.lerEstado() : null;
      if (s) { estado = { faturas: (s.faturas || []).map(f => linha(f, COL_F)), lancamentos: (s.lancamentos || []).map(l => linha(l, COL_L)), notas: s.notas || [] }; RX.mesSelecionado = RX.meses()[0] || ''; return true; }
    } catch (e) { console.error('Raio-X da Fatura: não foi possível ler os dados guardados.', e); }
    return false;
  };

  /** CSV com todos os lançamentos de todos os meses (para planilhas). */
  RX.csv = function () {
    const esc = (v) => { v = RX.celulaCSV(v); return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return [COL_L.join(','), ...estado.lancamentos.map(l => COL_L.map(c => esc(texto(l[c]))).join(','))].join('\n');
  };

  // ---- API "dash" usada pelo painel ----
  const calcs = {}, ouvintes = [];
  let cache = {};
  const base = () => {
    const m = RX.mesSelecionado, todos = m === RX.TODOS;
    return {
      faturas: comColunas(estado.faturas.filter(f => todos || f.mes === m).map(f => ({ ...f })), COL_F),
      lancamentos: comColunas(estado.lancamentos.filter(l => todos || l.mes === m).map(l => ({ ...l })), COL_L),
      historico_faturas: comColunas(estado.faturas.map(f => ({ ...f })), COL_F),
      historico_lancamentos: comColunas(estado.lancamentos.map(l => ({ ...l })), COL_L),
      notas: estado.notas.map(n => ({ ...n, itens: (n.itens || []).map(i => ({ ...i })) }))
    };
  };
  let conjuntos = base();
  const obter = (id) => {
    if (!RX.temDados()) return { status: 'loading', data: [] };
    if (conjuntos[id]) return { status: 'ok', data: conjuntos[id], columns: conjuntos[id].columns };
    if (cache[id]) return cache[id];
    const c = calcs[id];
    if (!c) return { status: 'missing', data: [] };
    const ins = c.inputs.map(obter);
    const ruim = ins.find(s => s.status !== 'ok');
    if (ruim) return (cache[id] = { status: ruim.status, data: [] });
    try { return (cache[id] = { status: 'ok', data: c.fn(...ins.map(s => s.data)) }); }
    catch (e) { console.error('Raio-X da Fatura: cálculo', id, e); return (cache[id] = { status: 'error', data: [], message: String(e) }); }
  };
  function atualizar() {
    conjuntos = base(); cache = {};
    ouvintes.forEach(fn => { try { fn(); } catch (e) { console.error('Raio-X da Fatura: painel', e); } });
    document.dispatchEvent(new CustomEvent('raio-x:atualizado'));
  }
  RX.atualizar = atualizar;
  RX._salvar = () => salvar();

  g.dash = {
    data: obter,
    calc: (id, def) => { calcs[id] = def; },
    onData: (fn) => { ouvintes.push(fn); },
    colors: ['#8A05BE', '#12B76A', '#1A6DFF', '#F79009', '#EE46BC', '#06AED4', '#7A5AF8', '#667085'],
    loader: () => {}, refresh: () => {}, params: () => ({}), setParams: () => {}, resetParams: () => {}, setLink: () => {}
  };
  let t;
  g.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { if (RX.temDados()) atualizar(); }, 150); });
})(window);
