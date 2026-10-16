/* Raio-X da Fatura — painel genérico.
   Desenha qualquer combinação de bancos, um mês por vez, com histórico de vários meses.
   Todos os textos vêm dos dados; valores entram na página só por textContent. */
(function () {
  'use strict';

  /* ---------- utilidades ---------- */
  const N = (v) => {
    if (v == null) return 0;
    let s = String(v).trim();
    if (!s) return 0;
    if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };
  const tem = (v) => v != null && String(v).trim() !== '' && Number.isFinite(Number(String(v).trim().replace(',', '.')));
  const r2 = (v) => Math.round(v * 100) / 100;
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const soma = (rows, f) => rows.reduce((t, r) => t + (f ? f(r) : N(r.valor)), 0);
  const div = (a, b) => (b ? a / b : 0);
  const chave = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const parcelaDe = (p) => { const m = /^\s*(\d+)\s*\/\s*(\d+)/.exec(p || ''); return m ? { n: +m[1], de: +m[2] } : null; };
  const estabDe = (r) => String(r.estabelecimento || r.descricao || '').trim() || 'Sem nome';
  const catDe = (r) => String(r.categoria || '').trim() || 'Sem categoria';
  const portDe = (r) => String(r.portador || '').trim() || 'Não informado';
  const ehAdic = (r) => chave(r.adicional) === 'sim';
  const ehAssinatura = (r) => chave(r.categoria).includes('assinatura');
  const tipoDe = (r) => chave(r.tipo) || 'compra';
  const isoOk = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  const mesOk = (s) => /^\d{4}-\d{2}$/.test(String(s || ''));

  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const brl0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const pct1 = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const pct0 = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });
  const pctS = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1, signDisplay: 'exceptZero' });
  const brlS = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', signDisplay: 'exceptZero' });
  const num2 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  const money = (v) => brl.format(N(v));
  const taxa = (v) => num2.format(N(v)) + '%';
  const dbr = (iso) => isoOk(iso) ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '—';
  const ddm = (iso) => isoOk(iso) ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '—';
  const pl = (n, s, p) => n + ' ' + (n === 1 ? s : p);
  const listaPt = (a) => a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1];

  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const mesExt = (m) => mesOk(m) ? MESES[+m.slice(5) - 1] + ' de ' + m.slice(0, 4) : '';
  const MesExt = (m) => { const t = mesExt(m); return t ? t[0].toUpperCase() + t.slice(1) : ''; };
  const mesCurto = (m) => mesOk(m) ? MESES[+m.slice(5) - 1].slice(0, 3) + '/' + m.slice(2, 4) : '';

  /* "Todos os meses": o motor entrega faturas e lançamentos de todos os meses juntos. */
  const ehTodos = () => !!window.RaioX && window.RaioX.mesSelecionado === (window.RaioX.TODOS || '*');
  /** Período legível: "Agosto a outubro de 2026" ou "Novembro de 2025 a fevereiro de 2026". */
  function periodoExt(meses) {
    const ms = [...new Set(meses.filter(mesOk))].sort();
    if (!ms.length) return '';
    const a = ms[0], b = ms[ms.length - 1];
    if (a === b) return MesExt(a);
    const na = MESES[+a.slice(5) - 1];
    return (na[0].toUpperCase() + na.slice(1)) + (a.slice(0, 4) === b.slice(0, 4) ? '' : ' de ' + a.slice(0, 4)) + ' a ' + mesExt(b);
  }
  /** A fatura mais recente de cada banco (para limite, juros e saldo futuro, que não se somam entre meses). */
  function ultimasPorBanco(F) {
    const m = new Map();
    F.forEach(r => { const o = m.get(r.banco); if (!o || String(r.mes) > String(o.mes)) m.set(r.banco, r); });
    return [...m.values()];
  }

  const hoje = new Date().toLocaleDateString('sv-SE');
  const diasAte = (iso) => isoOk(iso) ? Math.round((new Date(iso + 'T12:00:00') - new Date(hoje + 'T12:00:00')) / 864e5) : null;
  const diaUTC = (iso) => new Date(iso + 'T00:00:00Z');
  const isoUTC = (d) => d.toISOString().slice(0, 10);

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const B = (t) => el('b', null, t);
  /* Monta texto rico a partir de partes: string → nó de texto; Node → anexado. Nunca usa innerHTML. */
  const fill = (node, parts) => { node.replaceChildren(); parts.forEach(p => { if (p == null || p === false) return; node.append(typeof p === 'string' ? document.createTextNode(p) : p); }); return node; };
  const dados = (id, fb) => { const st = dash.data(id); return st && st.status === 'ok' && Array.isArray(st.data) ? st.data : (fb || []); };
  const estado = (id) => { const st = dash.data(id); return st ? st.status : 'missing'; };

  /* ---------- cores por banco ---------- */
  // [padrão no nome normalizado, cor clara, cor escura, texto sobre a cor (claro), texto sobre a cor (escuro)]
  const MARCAS = [
    [/nubank|^nu$|nupagamentos/, '#8A05BE', '#A944EC'],
    [/picpay/, '#12B76A', '#2FD487', '#fff', '#0B2A1B'],
    [/caixa|^cef$/, '#1A6DFF', '#5B95FF'],
    [/itau/, '#EC7000', '#FF8A1F'],
    [/^(banco)?inter($|banco|pagamentos)/, '#FF7A00', '#FF9533'],
    [/bradesco/, '#CC092F', '#F0445F'],
    [/santander/, '#EC0000', '#FF5A5A'],
    [/bancodobrasil|^bb$|^bbcartoes/, '#E5B900', '#F2CF2E', '#1D1B22', '#1D1B22'],
    [/^c6/, '#242424', '#9A9A9A', '#fff', '#121016'],
    [/mercadopago|mercadolivre/, '#00A6FF', '#33B8FF', '#fff', '#04243A'],
    [/btg/, '#0A2E5C', '#5C8FD6'],
    [/^xp/, '#111111', '#BDBDBD', '#fff', '#121016']
  ];
  const RESERVA = [['#EE46BC', '#F470CE'], ['#06AED4', '#22CCEE'], ['#7A5AF8', '#9B8AFB'], ['#0E9384', '#2ED3B7'],
    ['#DD2590', '#F670C7'], ['#CA8504', '#EAAA08'], ['#4E5BA6', '#8098F9'], ['#667085', '#98A2B3']];
  const corBanco = new Map(); // nome → índice
  const paletaUsada = [];
  let reservaProx = 0;
  function registrarBancos(nomes) {
    const novos = [...new Set(nomes.filter(Boolean))].filter(b => !corBanco.has(b)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    if (!novos.length) return;
    novos.forEach(b => {
      const k = chave(b);
      const m = MARCAS.find(x => x[0].test(k));
      let c;
      if (m) c = { claro: m[1], escuro: m[2], tClaro: m[3] || '#fff', tEscuro: m[4] || '#fff' };
      else {
        let tent = 0, r;
        do { r = RESERVA[reservaProx++ % RESERVA.length]; tent++; } while (tent < RESERVA.length && paletaUsada.some(p => p.claro === r[0]));
        c = { claro: r[0], escuro: r[1], tClaro: '#fff', tEscuro: '#fff' };
      }
      corBanco.set(b, paletaUsada.length);
      paletaUsada.push(c);
    });
    let st = $('rx-cores-bancos');
    if (!st) { st = document.createElement('style'); st.id = 'rx-cores-bancos'; document.head.appendChild(st); }
    const cl = paletaUsada.map((c, i) => `--bk-${i}:${c.claro};--bk-${i}-t:${c.tClaro};`).join('');
    const es = paletaUsada.map((c, i) => `--bk-${i}:${c.escuro};--bk-${i}-t:${c.tEscuro};`).join('');
    st.textContent = `.rx{${cl}}\n@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) .rx{${es}}}\n:root[data-theme="dark"] .rx{${es}}`;
  }
  const bankColor = (b) => corBanco.has(b) ? `var(--bk-${corBanco.get(b)})` : 'var(--cds-chart-muted)';
  const bankInk = (b) => corBanco.has(b) ? `var(--bk-${corBanco.get(b)}-t)` : '#fff';
  const setBank = (n, b) => { n.style.setProperty('--rx-bank', bankColor(b)); n.style.setProperty('--rx-bank-ink', bankInk(b)); return n; };
  const bankDot = (b) => setBank(el('span', 'dot'), b);
  const ordemBancos = (lista) => [...new Set(lista)].sort((a, b) => (corBanco.get(a) ?? 99) - (corBanco.get(b) ?? 99));

  /* ---------- agregações (compartilhadas por cálculos e textos) ---------- */
  function porEstabelecimento(L) {
    const pos = L.filter(r => N(r.valor) > 0);
    const bruto = soma(pos);
    const m = new Map();
    L.forEach(r => {
      const t = tipoDe(r);
      if (t === 'anuidade' || t === 'encargo') return;
      const v = N(r.valor), k = estabDe(r);
      const o = m.get(k) || { estabelecimento: k, valor: 0, compras: 0, estornos: 0, n_estornos: 0, adicional_valor: 0, porBanco: {}, porAdic: {} };
      if (v > 0) {
        o.valor += v;
        if (t === 'compra') o.compras += 1;
        o.porBanco[r.banco] = (o.porBanco[r.banco] || 0) + v;
        if (ehAdic(r)) { o.adicional_valor += v; const pk = portDe(r) + '|' + r.banco; o.porAdic[pk] = (o.porAdic[pk] || 0) + v; }
      } else if (v < 0) { o.estornos += -v; o.n_estornos += 1; }
      m.set(k, o);
    });
    return [...m.values()].filter(o => o.valor > 0).map(o => {
      const bancos = Object.entries(o.porBanco).sort((a, b) => b[1] - a[1]);
      const adic = Object.entries(o.porAdic).sort((a, b) => b[1] - a[1])[0];
      return {
        estabelecimento: o.estabelecimento, valor: r2(o.valor), compras: o.compras, estornos: r2(o.estornos), n_estornos: o.n_estornos,
        fatia: r3(div(o.valor, bruto)), adicional_valor: r2(o.adicional_valor),
        banco_principal: bancos[0] ? bancos[0][0] : '', n_bancos: bancos.length,
        adicional_portador: adic ? adic[0].split('|')[0] : '', adicional_banco: adic ? adic[0].split('|').slice(1).join('|') : ''
      };
    }).sort((a, b) => b.valor - a.valor);
  }
  function porCategoria(L) {
    const pos = L.filter(r => N(r.valor) > 0), tot = soma(pos), m = new Map();
    pos.forEach(r => m.set(catDe(r), (m.get(catDe(r)) || 0) + N(r.valor)));
    return [...m].map(([categoria, v]) => ({ categoria, valor: r2(v), fatia: r3(div(v, tot)) })).sort((a, b) => b.valor - a.valor);
  }
  function duplicadas(L) {
    const g = new Map();
    L.forEach(r => {
      const v = N(r.valor), t = tipoDe(r);
      if (v <= 0 || r.parcela || (t !== 'compra')) return;
      const k = [r.banco, r.cartao || '', estabDe(r), v.toFixed(2), r.data].join('|');
      g.set(k, (g.get(k) || []).concat([r]));
    });
    return [...g.values()].filter(x => x.length > 1).map(x => ({
      estabelecimento: estabDe(x[0]), banco: x[0].banco, cartao: x[0].cartao || '', data: x[0].data, valor: N(x[0].valor), vezes: x.length,
      extra: r2(N(x[0].valor) * (x.length - 1))
    })).sort((a, b) => b.extra - a.extra);
  }

  /* ---------- cálculos registrados no motor ---------- */
  dash.calc('kpis', {
    inputs: ['faturas'], title: 'Números do mês',
    description: 'Soma das faturas do mês selecionado: total a pagar, limite usado e saldo já comprometido em faturas futuras.',
    fn: (F0) => {
      const F = ehTodos() ? ultimasPorBanco(F0) : F0;
      const s = (k) => soma(F, r => N(r[k]));
      const uso = s('limite_utilizado'), lim = s('limite_total');
      return [{ total_pagar: r2(s('total')), limite_utilizado: r2(uso), limite_total: r2(lim), limite_usado_pct: lim ? r3(uso / lim) : null,
        a_vencer: r2(s('a_vencer')), faturas: F.length }];
    }
  });
  dash.calc('por_categoria', {
    inputs: ['lancamentos'], title: 'Gastos por categoria',
    description: 'Soma das compras (valores positivos) por categoria no mês selecionado, com a fatia de cada uma.',
    fn: porCategoria
  });
  dash.calc('por_portador', {
    inputs: ['lancamentos'], title: 'Por cartão e portador',
    description: 'Soma das compras (valores positivos) por banco e portador, com a quantidade de compras e a fatia de cada grupo.',
    fn: (L) => {
      const pos = L.filter(r => N(r.valor) > 0), tot = soma(pos), m = new Map();
      pos.forEach(r => {
        const g = r.banco + ' · ' + portDe(r) + (ehAdic(r) ? ' (adicional)' : '');
        const o = m.get(g) || { grupo: g, banco: r.banco, portador: portDe(r), adicional: ehAdic(r), valor: 0, compras: 0 };
        o.valor += N(r.valor); o.compras += 1; m.set(g, o);
      });
      return [...m.values()].map(o => ({ ...o, valor: r2(o.valor), fatia: r3(div(o.valor, tot)) })).sort((a, b) => b.valor - a.valor);
    }
  });
  dash.calc('por_estabelecimento', {
    inputs: ['lancamentos'], title: 'Gastos por estabelecimento',
    description: 'Compras e IOF por estabelecimento no mês (sem anuidade e encargos), com estornos, fatia e quanto veio de cartão adicional.',
    fn: porEstabelecimento
  });
  dash.calc('por_dia', {
    inputs: ['lancamentos'], title: 'Compras à vista por dia',
    description: 'Compras sem parcela do mês selecionado, somadas por dia e banco.',
    fn: (L) => {
      const m = new Map();
      L.filter(r => !r.parcela && N(r.valor) > 0 && tipoDe(r) === 'compra' && isoOk(r.data)).forEach(r => {
        const k = r.data + '|' + r.banco;
        const o = m.get(k) || { dia: r.data, banco: r.banco, valor: 0, compras: 0 };
        o.valor += N(r.valor); o.compras += 1; m.set(k, o);
      });
      return [...m.values()].map(o => ({ ...o, valor: r2(o.valor) })).sort((a, b) => a.dia < b.dia ? -1 : a.dia > b.dia ? 1 : 0);
    }
  });
  dash.calc('evolucao_mensal', {
    inputs: ['historico_faturas'], title: 'Total por mês e banco',
    description: 'Total das faturas de cada mês carregado, por banco.',
    fn: (HF) => {
      const m = new Map();
      HF.filter(r => mesOk(r.mes)).forEach(r => { const k = r.mes + '|' + r.banco; m.set(k, { mes: r.mes, banco: r.banco, total: r2((m.get(k) ? m.get(k).total : 0) + N(r.total)) }); });
      return [...m.values()].sort((a, b) => a.mes < b.mes ? -1 : a.mes > b.mes ? 1 : 0);
    }
  });
  dash.calc('variacao_categorias', {
    inputs: ['historico_lancamentos', 'faturas'], title: 'Variação por categoria',
    description: 'Compras por categoria no mês selecionado contra o mês anterior carregado.',
    fn: (HL, F) => {
      if (ehTodos()) return [];
      const mes = mesSelecionado(F, HL);
      const meses = [...new Set(HL.map(r => r.mes).filter(mesOk))].sort();
      const ant = meses.filter(x => x < mes).pop();
      if (!ant) return [];
      const a = new Map(porCategoria(HL.filter(r => r.mes === ant)).map(r => [r.categoria, r.valor]));
      const b = new Map(porCategoria(HL.filter(r => r.mes === mes)).map(r => [r.categoria, r.valor]));
      return [...new Set([...a.keys(), ...b.keys()])].map(c => {
        const va = a.get(c) || 0, vb = b.get(c) || 0;
        return { categoria: c, mes_anterior: ant, mes: mes, anterior: va, atual: vb, diferenca: r2(vb - va), variacao: va ? r3((vb - va) / va) : null };
      }).sort((x, y) => Math.abs(y.diferenca) - Math.abs(x.diferenca));
    }
  });

  function mesSelecionado(F, L) {
    const g = window.RaioX && window.RaioX.mesSelecionado;
    if (mesOk(g)) return g;
    const r = (F || []).find(x => mesOk(x.mes)) || (L || []).find(x => mesOk(x.mes));
    return r ? r.mes : '';
  }

  /* ---------- contexto de cada redesenho ---------- */
  let C = null;
  function montarContexto() {
    const F = dados('faturas'), L = dados('lancamentos');
    const HF = estado('historico_faturas') === 'ok' ? dados('historico_faturas') : F;
    const HL = estado('historico_lancamentos') === 'ok' ? dados('historico_lancamentos') : L;
    registrarBancos([...HF, ...HL, ...F, ...L].map(r => r.banco));
    const todos = ehTodos();
    const mes = todos ? '' : mesSelecionado(F, L);
    const meses = [...new Set(HF.map(r => r.mes).concat(mes ? [mes] : []).filter(mesOk))].sort();
    const ant = todos ? null : (meses.filter(m => m < mes).pop() || null);
    const ultimo = meses[meses.length - 1];
    const passado = !todos && ((!!ultimo && mes < ultimo) || (F.length > 0 && F.every(r => { const d = diasAte(r.vencimento); return d != null && d < -40; })));
    // Em "Todos os meses", cada fatura de um mês anterior ao último é tratada como mês passado.
    const passadoDe = (r) => todos ? ((!!ultimo && r.mes < ultimo) || (() => { const d = diasAte(r.vencimento); return d != null && d < -40; })()) : passado;
    const pos = L.filter(r => N(r.valor) > 0);
    const bancos = ordemBancos([...F, ...L].map(r => r.banco).filter(Boolean));
    const totalF = soma(F, r => N(r.total));
    const totBanco = (b) => { const t = soma(F.filter(r => r.banco === b), r => N(r.total)); return t > 0 ? t : soma(pos.filter(r => r.banco === b)); };
    const estabs = dados('por_estabelecimento');
    const sit = (r) => r.paga === 'sim' ? { cls: 'ok', txt: 'Paga', d: null, paga: true } : situacao(r.vencimento, passadoDe(r));
    const abertas = F.filter(r => r.paga !== 'sim'), pagas = F.filter(r => r.paga === 'sim');
    C = { F, L, HF, HL, mes, meses, ant, passado, pos, bruto: soma(pos), bancos, totalF, totBanco, estabs, top: estabs[0] || null,
      dups: duplicadas(L), sit, abertas, pagas, aPagar: soma(abertas, r => N(r.total)),
      FAnt: ant ? HF.filter(r => r.mes === ant) : [], LAnt: ant ? HL.filter(r => r.mes === ant) : [] };
    C.todos = todos;
    C.mesesF = [...new Set(F.map(r => r.mes).filter(mesOk))].sort();
    C.periodo = todos ? periodoExt(C.mesesF.length ? C.mesesF : meses) : MesExt(mes);
    C.Fatual = todos ? ultimasPorBanco(F) : F;
    C.noMes = todos ? 'no período' : 'no mês';
    C.doMes = todos ? 'do período' : 'do mês';
    C.nesteMes = todos ? 'neste período' : 'neste mês';
    C.daFatura = (n) => todos || n > 1 ? 'das faturas' : 'da fatura';
    C.totMes = C.mesesF.map(m => ({ mes: m, total: r2(soma(F.filter(r => r.mes === m), r => N(r.total))) }));
    C.vencidas = abertas.filter(r => { const d = diasAte(r.vencimento); return d != null && d < 0; });
    const nl = dados('notas'); C.notaDe = new Map(); nl.forEach(n => { if (n && n.vinculo) C.notaDe.set(n.vinculo, n); });
    C.juros = C.Fatual.filter(r => tem(r.juros_rotativo_am) && N(r.juros_rotativo_am) > 0).sort((a, b) => N(b.juros_rotativo_am) - N(a.juros_rotativo_am));
    C.assin = pos.filter(ehAssinatura);
    C.assinTop = porEstabelecimento(C.assin)[0] || null;
    C.adic = pos.filter(ehAdic);
    C.parcAntigas = pos.filter(r => { const p = parcelaDe(r.parcela); return p && p.n > 1; });
    return C;
  }

  function situacao(venc, passado) {
    const d = diasAte(venc);
    if (d == null) return { cls: 'mute', txt: 'Sem vencimento', d: null };
    if (passado && d < 0) return { cls: 'mute', txt: 'Venceu em ' + ddm(venc), d };
    if (d < 0) return { cls: 'bad', txt: `Vencida há ${pl(-d, 'dia', 'dias')}`, d };
    if (d === 0) return { cls: 'warn', txt: 'Vence hoje', d };
    if (d === 1) return { cls: 'warn', txt: 'Vence amanhã', d };
    return { cls: d <= 5 ? 'warn' : 'ok', txt: `Vence em ${d} dias`, d };
  }

  function ordemPagamento(rows) {
    return [...rows].sort((a, b) => {
      const da = diasAte(a.vencimento), db = diasAte(b.vencimento);
      const va = da != null && da < 0, vb = db != null && db < 0;
      if (va !== vb) return va ? -1 : 1;
      if (va || C.passado) { const j = N(b.juros_rotativo_am) - N(a.juros_rotativo_am); if (j) return j; }
      return (da ?? 1e9) - (db ?? 1e9);
    });
  }
  const anual = (am) => Math.pow(1 + N(am) / 100, 12) - 1;

  /* ---------- topo ---------- */
  function drawTopo() {
    $('rx-mes').textContent = C.todos ? ('Todos os meses' + (C.periodo ? ' · ' + C.periodo : '')) : (MesExt(C.mes) || ' ');
    const box = $('takeaway');
    if (C.todos) { drawTopoTodos(box); return; }
    if (!C.F.length) { fill(box, [C.L.length ? 'Há lançamentos, mas nenhuma fatura deste mês foi carregada.' : 'Nenhuma fatura deste mês foi carregada.']); return; }
    const n = C.F.length;
    if (C.passado) {
      const ult = C.F.map(r => r.vencimento).filter(isoOk).sort().pop();
      fill(box, [B(money(C.totalF)), ` ${n === 1 ? 'na fatura' : 'nas ' + n + ' faturas'} de ${mesExt(C.mes)}`, ult ? `, com vencimento até ${dbr(ult)}.` : '.',
        ' Este mês já passou: use-o para comparar e conferir.']);
      return;
    }
    if (!C.abertas.length) { fill(box, [n === 1 ? 'A fatura de ' : `As ${n} faturas de `, mesExt(C.mes), n === 1 ? ' já está ' : ' já estão ', B(n === 1 ? 'paga' : 'pagas'), ` (${money(C.totalF)}). Nada pendente.`]); return; }
    const venc = C.F.filter(r => C.sit(r).d != null && C.sit(r).d < 0).map(r => r.banco);
    const prox = C.F.filter(r => { const d = C.sit(r).d; return d != null && d >= 0 && d <= 5; });
    const na = C.abertas.length;
    const parts = [B(money(C.aPagar)), ` para pagar em ${pl(na, 'fatura', 'faturas')}`, C.pagas.length ? ` (${listaPt(C.pagas.map(r => r.banco))} já ${C.pagas.length > 1 ? 'pagas' : 'paga'}). ` : '. '];
    const px = prox.map(r => r.banco + ' ' + C.sit(r).txt.toLowerCase() + ` (${ddm(r.vencimento)})`);
    if (venc.length) parts.push(`${listaPt(venc)} já ${venc.length > 1 ? 'venceram' : 'venceu'}` + (px.length ? ', e ' + listaPt(px) : '') + '.');
    else if (px.length) { const t = listaPt(px); parts.push(t[0].toUpperCase() + t.slice(1) + '.'); }
    else parts.push(na === 1 ? 'A fatura ainda não venceu.' : 'Nenhuma fatura vencida.');
    if (venc.length) parts.push(' Pague as vencidas primeiro para parar os juros.');
    fill(box, parts);
  }

  function drawTopoTodos(box) {
    const n = C.F.length;
    if (!n) { fill(box, ['Nenhuma fatura carregada.']); return; }
    const parts = [B(money(C.totalF)), ` em ${pl(n, 'fatura', 'faturas')} de ${C.periodo.toLowerCase()}. `];
    const na = C.abertas.length, nv = C.vencidas.length;
    if (!na) parts.push('Todas estão marcadas como ', B('pagas'), '. Nada pendente.');
    else {
      parts.push(na === n ? (n === 1 ? 'Ela ainda está ' : 'Todas ainda estão ') : `${na} ainda ${na === 1 ? 'está' : 'estão'} `, B('em aberto'), ` (${money(C.aPagar)})`);
      if (nv) parts.push(', ', B(nv === na && na > 1 ? 'todas já vencidas' : pl(nv, 'já vencida', 'já vencidas')), '. Se já pagou, toque em “Já paguei” no card de cada fatura.');
      else parts.push(', nenhuma vencida.');
    }
    fill(box, parts);
  }

  /* ---------- "O que as faturas mostram" ---------- */
  function fraseMaiorGasto(t) {
    const p = ['Seu maior gasto foi em ', B(t.estabelecimento), ': ', B(money(t.valor)),
      t.compras ? ` em ${pl(t.compras, 'compra', 'compras')}, ` : ', ', B(pct0.format(t.fatia)), ` de tudo o que foi comprado ${C.noMes}.`];
    const fa = div(t.adicional_valor, t.valor);
    if (fa > 0.5) p.push(` ${fa >= 0.95 ? 'Quase tudo' : pct0.format(fa)} veio do cartão adicional de `, B(t.adicional_portador), ` (${t.adicional_banco}).`);
    else if (t.n_bancos === 1 && C.bancos.length > 1) p.push(` Tudo na fatura ${t.banco_principal}.`);
    if (t.estornos > 0) p.push(` Outros ${money(t.estornos)} voltaram em ${pl(t.n_estornos, 'estorno', 'estornos')}.`);
    return p;
  }

  function itensGeraisTodos() {
    const g = [];
    if (C.vencidas.length) g.push({ hot: true, p: [B(pl(C.vencidas.length, 'fatura vencida', 'faturas vencidas')), ' sem marcar como paga, somando ', B(money(soma(C.vencidas, r => N(r.total)))), '. Se já pagou, marque “Já paguei”; se não, os juros estão correndo.'] });
    const prox = C.abertas.filter(r => { const d = diasAte(r.vencimento); return d != null && d >= 0; }).sort((a, b) => a.vencimento < b.vencimento ? -1 : 1)[0];
    if (prox) g.push({ hot: diasAte(prox.vencimento) <= 5, p: ['A próxima a vencer é ', B(prox.banco), ` (fatura de ${mesExt(prox.mes)}), em `, B(dbr(prox.vencimento)), '.'] });
    if (C.F.length && !C.abertas.length) g.push({ p: ['Todas as faturas do período estão marcadas como pagas.'] });
    const tm = C.totMes.filter(x => x.total > 0);
    if (tm.length > 1) {
      const media = soma(tm, x => x.total) / tm.length;
      const mx = tm.reduce((a, b) => b.total > a.total ? b : a), mn = tm.reduce((a, b) => b.total < a.total ? b : a);
      g.push({ p: ['Média de ', B(money(media)), ` por mês em ${tm.length} meses. O mais caro foi `, B(mesExt(mx.mes)), ` (${money(mx.total)}); o mais leve, ${mesExt(mn.mes)} (${money(mn.total)}).`] });
      const pri = tm[0].mes, ult = tm[tm.length - 1].mes;
      const va = new Map(porCategoria(C.L.filter(r => r.mes === pri)).map(r => [r.categoria, r.valor]));
      const cres = porCategoria(C.L.filter(r => r.mes === ult)).map(r => ({ c: r.categoria, d: r.valor - (va.get(r.categoria) || 0), a: va.get(r.categoria) || 0, b: r.valor })).sort((x, y) => y.d - x.d)[0];
      if (cres && cres.d >= 1) g.push({ p: [B(cres.c), ` foi a categoria que mais cresceu de ${mesCurto(pri)} para ${mesCurto(ult)}: `, B('+' + money(cres.d)), ` (${money(cres.a)} → ${money(cres.b)}).`] });
    }
    const lim = soma(C.Fatual, r => N(r.limite_total)), uso = soma(C.Fatual, r => N(r.limite_utilizado)), av = soma(C.Fatual, r => N(r.a_vencer));
    if (lim > 0) g.push({ hot: uso / lim >= 0.8, p: [`Na fatura mais recente de cada cartão, limite ${C.Fatual.length > 1 ? 'somado ' : ''}de `, B(brl0.format(lim)), ', com ', B(pct0.format(uso / lim)), ' já utilizado.'] });
    if (av > 0) g.push({ p: [B(money(av)), ' já comprometidos em parcelas e saldos das próximas faturas.'] });
    return g;
  }

  function itensGerais() {
    if (C.todos) return itensGeraisTodos();
    const g = [];
    // Vencimentos
    if (C.F.length && !C.passado) {
      const venc = C.F.filter(r => { const d = C.sit(r).d; return d != null && d < 0; });
      const prox = C.F.filter(r => { const d = C.sit(r).d; return d != null && d >= 0 && d <= 5; });
      if (venc.length) {
        const multa = soma(venc, r => N(r.total)) * 0.02;
        g.push({ hot: true, p: [`${listaPt(venc.map(r => r.banco))} já ${venc.length > 1 ? 'venceram' : 'venceu'}: multa de 2% (cerca de `, B(money(multa)), '), mora de 1% ao mês e juros do rotativo já correm.'] });
      }
      prox.forEach(r => g.push({ hot: false, p: [`${r.banco} ${C.sit(r).txt.toLowerCase()} (`, B(ddm(r.vencimento)), ').'] }));
      if (C.pagas.length) g.push({ p: [B(listaPt(C.pagas.map(r => r.banco))), C.pagas.length > 1 ? ' marcadas como pagas.' : ' marcada como paga.'] });
      if (!C.abertas.length) g.push({ p: ['Todas as faturas deste mês estão pagas.'] });
      else if (!venc.length && !prox.length) {
        const nx = [...C.abertas].filter(r => isoOk(r.vencimento)).sort((a, b) => a.vencimento < b.vencimento ? -1 : 1)[0];
        if (nx) g.push({ p: ['Nenhuma fatura vencida. A próxima é ', B(nx.banco), ', em ', B(dbr(nx.vencimento)), '.'] });
      }
    } else if (C.passado && C.F.length) {
      g.push({ p: [`Faturas de ${mesExt(C.mes)}, já vencidas. Confira no app de cada banco se foram pagas.`] });
    }
    // Comparação com o mês anterior
    if (C.ant && C.FAnt.length && C.F.length) {
      const a = soma(C.FAnt, r => N(r.total)), b = C.totalF, v = div(b - a, a);
      if (a > 0) g.push({ hot: v > 0.15, p: ['Total das faturas ', B(Math.abs(v) < 0.005 ? 'igual' : (v > 0 ? 'subiu ' : 'caiu ') + pct0.format(Math.abs(v))),
        ` em relação a ${mesExt(C.ant)} (${money(a)} → ${money(b)}).`] });
      if (C.LAnt.length) {
        const va = new Map(porCategoria(C.LAnt).map(r => [r.categoria, r.valor]));
        const cres = porCategoria(C.L).map(r => ({ c: r.categoria, d: r.valor - (va.get(r.categoria) || 0), a: va.get(r.categoria) || 0, b: r.valor }))
          .sort((x, y) => y.d - x.d)[0];
        if (cres && cres.d >= 1) g.push({ p: [B(cres.c), ' foi a categoria que mais cresceu: ', B('+' + money(cres.d)), ` (${money(cres.a)} → ${money(cres.b)}).`] });
      }
    }
    // Limite e comprometido
    const lim = soma(C.F, r => N(r.limite_total)), uso = soma(C.F, r => N(r.limite_utilizado)), av = soma(C.F, r => N(r.a_vencer));
    if (lim > 0) g.push({ hot: uso / lim >= 0.8, p: [`Limite ${C.F.length > 1 ? 'somado ' : ''}de `, B(brl0.format(lim)), ', com ', B(pct0.format(uso / lim)), ' já utilizado.'] });
    if (av > 0) g.push({ p: [B(money(av)), ' já comprometidos em parcelas e saldos das próximas faturas.'] });
    return g;
  }

  function itensGastos() {
    const g = [];
    if (C.adic.length) {
      const tot = soma(C.adic), m = new Map();
      C.adic.forEach(r => { const k = portDe(r) + ' (' + r.banco + ')'; m.set(k, (m.get(k) || 0) + N(r.valor)); });
      const quem = [...m].sort((a, b) => b[1] - a[1]);
      const p = ['Cartões adicionais somaram ', B(money(tot)), ', ', B(pct0.format(div(tot, C.bruto))), ' das compras'];
      if (quem.length === 1) p.push(', tudo de ', B(quem[0][0]), '.');
      else { p.push(': '); quem.slice(0, 3).forEach(([k, v], i) => p.push(i ? ', ' : '', B(k), ' ' + money(v))); p.push(quem.length > 3 ? ' e outros.' : '.'); }
      g.push({ hot: div(tot, C.bruto) > 0.3, p });
    }
    if (C.assin.length) {
      const p = ['Assinaturas e serviços digitais somam ', B(money(soma(C.assin))), ` em ${pl(C.assin.length, 'cobrança', 'cobranças')}`];
      if (C.assinTop) p.push('; a maior é ', B(C.assinTop.estabelecimento), ` (${money(C.assinTop.valor)}).`); else p.push('.');
      g.push({ p });
    }
    const varios = C.bancos.length > 1; // com um banco só, o cartão do banco já diz isto
    if (varios && C.dups.length) {
      const d = C.dups[0];
      const p = [B(pl(C.dups.length, 'possível cobrança duplicada', 'possíveis cobranças duplicadas')), ': ',
        `${d.estabelecimento}, ${d.vezes}× ${money(d.valor)} em ${ddm(d.data)} no mesmo cartão (${d.banco})`];
      if (C.dups.length > 1) p.push(` e mais ${C.dups.length - 1}`);
      p.push('.');
      g.push({ hot: true, p });
    }
    if (varios && C.parcAntigas.length && C.totalF > 0) {
      const t = soma(C.parcAntigas);
      g.push({ hot: div(t, C.totalF) > 0.3, p: ['Parcelas de compras de meses anteriores: ', B(money(t)), ', ', B(pct0.format(div(t, C.totalF))), ' do total das faturas.'] });
    }
    if (varios && C.juros.length) {
      const j = C.juros[0];
      g.push({ hot: true, p: [`Rotativo mais caro${C.juros.length > 1 ? '' : ' informado'}: `, B(j.banco), ', ', B(taxa(j.juros_rotativo_am) + ' ao mês'), ` (cerca de ${pct0.format(anual(j.juros_rotativo_am))} ao ano).`] });
    }
    return g;
  }

  function itensBanco(b) {
    const L = C.L.filter(r => r.banco === b), pos = L.filter(r => N(r.valor) > 0), F = C.F.filter(r => r.banco === b);
    const FA = C.Fatual.filter(r => r.banco === b), daF = C.daFatura(F.length);
    const tot = C.totBanco(b), out = [];
    const est = porEstabelecimento(L)[0];
    if (est) { const f = div(est.valor, tot); out.push({ hot: f > 0.3, p: ['Maior gasto: ', B(est.estabelecimento), ', ', B(money(est.valor)), ` (${pct0.format(f)} ${daF}).`] }); }
    if (C.todos && F.length > 1) out.push({ p: [`${F.length} faturas, média de `, B(money(div(soma(F, r => N(r.total)), F.length))), ' por mês.'] });
    const ad = pos.filter(ehAdic);
    if (ad.length) {
      const v = soma(ad), f = div(v, tot), nomes = [...new Set(ad.map(portDe))];
      out.push({ hot: f > 0.5, p: [`Cartão adicional (${listaPt(nomes)}) responde por `, B(pct0.format(f)), ` ${daF} (${money(v)}).`] });
    }
    const fj = FA.find(r => tem(r.juros_rotativo_am) && N(r.juros_rotativo_am) > 0);
    if (fj) {
      const max = C.juros.length > 1 && C.juros[0].banco === b;
      out.push({ hot: max, p: ['Rotativo de ', B(taxa(fj.juros_rotativo_am) + ' ao mês'), max ? ', o mais caro entre as faturas.' : '.'] });
    }
    const dp = C.dups.filter(d => d.banco === b)[0];
    if (dp) out.push({ hot: true, p: ['Possível duplicidade: ', B(dp.estabelecimento), `, ${dp.vezes}× ${money(dp.valor)} em ${ddm(dp.data)}.`] });
    const pa = C.parcAntigas.filter(r => r.banco === b);
    const av = soma(FA, r => N(r.a_vencer));
    if (pa.length) out.push({ p: ['Parcelas de compras antigas: ', B(money(soma(pa))), ` (${pct0.format(div(soma(pa), tot))} ${daF})`, av > 0 ? '; ainda faltam ' : '.', av > 0 ? B(money(av)) : null, av > 0 ? ' nas próximas faturas.' : null] });
    if (C.ant) {
      const a = soma(C.FAnt.filter(r => r.banco === b), r => N(r.total)), cur = soma(F, r => N(r.total));
      if (a > 0 && cur > 0 && Math.abs(cur - a) >= 1) out.push({ hot: (cur - a) / a > 0.25, p: [B(money(Math.abs(cur - a))), ` a ${cur > a ? 'mais' : 'menos'} que em ${mesExt(C.ant)} (${pctS.format((cur - a) / a)}).`] });
    }
    const es = L.filter(r => N(r.valor) < 0);
    if (es.length) {
      const m = new Map(); es.forEach(r => m.set(estabDe(r), (m.get(estabDe(r)) || 0) + 1));
      const [ke, kn] = [...m].sort((a, c) => c[1] - a[1])[0];
      out.push({ p: [B(money(-soma(es))), ` em ${pl(es.length, 'estorno', 'estornos')}`, kn >= 3 ? `, ${kn} de ${ke}: sinal de devoluções frequentes.` : '.'] });
    }
    const tx = pos.filter(r => ['iof', 'anuidade', 'encargo'].includes(tipoDe(r)));
    if (tx.length) out.push({ p: ['IOF, anuidade e encargos: ', B(money(soma(tx))), '.'] });
    const lim = soma(FA, r => N(r.limite_total)), uso = soma(FA, r => N(r.limite_utilizado));
    if (lim > 0) out.push({ hot: uso / lim >= 0.8, p: ['Limite em ', B(pct0.format(uso / lim)), ` de uso (${brl0.format(uso)} de ${brl0.format(lim)})`, C.todos && F.length > 1 ? ', pela fatura mais recente.' : '.'] });
    if (!out.length) out.push({ p: [pos.length ? `${pl(pos.length, 'compra', 'compras')} ${C.noMes}.` : `Sem compras ${C.nesteMes}.`] });
    return out.slice(0, 4);
  }

  function anCard(titulo, itens, banco) {
    const c = el('article', 'card an-card');
    if (banco) setBank(c, banco);
    const h = el('h3');
    if (banco) h.append(bankDot(banco));
    h.append(document.createTextNode(titulo));
    const ul = el('ul');
    itens.forEach(it => { const li = el('li', it.hot ? 'hot' : null); fill(li, it.p); ul.appendChild(li); });
    c.append(h, ul);
    return c;
  }

  function drawAnalise() {
    const lead = $('an-lead');
    if (C.top) { lead.hidden = false; fill($('an-lead-txt'), fraseMaiorGasto(C.top)); } else lead.hidden = true;
    const n = C.F.length;
    const de = C.todos ? C.periodo.toLowerCase() : mesExt(C.mes);
    $('an-sub').textContent = n ? `Resumo ${n === 1 ? 'da fatura' : 'das ' + n + ' faturas'} de ${de}: onde o dinheiro foi e o que merece atenção.` : 'Onde o dinheiro foi e o que merece atenção.';
    const grid = $('an-grid');
    grid.replaceChildren();
    const g = itensGerais(), s = itensGastos();
    if (g.length) grid.appendChild(anCard('Visão geral', g));
    if (s.length) grid.appendChild(anCard('Gastos que chamam atenção', s));
    C.bancos.forEach(b => grid.appendChild(anCard(b, itensBanco(b), b)));
  }

  /* ---------- Cada fatura ---------- */
  function drawBanks() {
    const box = $('bank-cards');
    box.replaceChildren();
    if (!C.F.length) { box.appendChild(el('div', 'card vazio', 'Nenhuma fatura carregada para este mês.')); return; }
    // Em "Todos os meses": agrupadas por mês da fatura, do mais recente para o mais antigo.
    const porVenc = (a, b) => (a.vencimento || '9') < (b.vencimento || '9') ? -1 : 1;
    const grupos = C.todos
      ? [...new Set(C.F.map(r => r.mes))].sort().reverse().map(m => ({ mes: m, F: C.F.filter(r => r.mes === m).sort(porVenc) }))
      : [{ mes: '', F: [...C.F].sort(porVenc) }];
    grupos.forEach(gr => {
    if (gr.mes) {
      const h = el('div', 'rx-grupo-mes');
      const ab = gr.F.filter(r => r.paga !== 'sim').length;
      h.append(el('h3', null, MesExt(gr.mes) || 'Mês não informado'),
        el('span', null, `${pl(gr.F.length, 'fatura', 'faturas')} · ${money(soma(gr.F, r => N(r.total)))}` + (ab ? (ab === gr.F.length ? '' : ` · ${ab} em aberto`) : ' · todas pagas')));
      box.appendChild(h);
    }
    gr.F.forEach(r => {
      const b = r.banco, s = C.sit(r);
      const c = setBank(el('article', 'card bank'), b);
      const head = el('div', 'bank-head');
      const nm = el('div', 'bank-name');
      const h = el('h3', null, b);
      const sub = [r.cartao, chave(r.titular) && chave(r.titular) !== 'titular' ? r.titular : ''].filter(Boolean).join(' · ');
      if (sub) h.appendChild(el('small', null, sub));
      nm.append(bankDot(b), h);
      head.append(nm, el('span', 'chip ' + s.cls, s.txt));
      const big = el('div', 'big money', money(r.total));
      const dl = el('dl');
      const item = (label, raw, fmt, hot) => {
        const dd = el('dd', hot ? 'hot' : null);
        dd.textContent = tem(raw) || (raw && isoOk(raw)) ? fmt(raw) : 'não informado';
        if (!(tem(raw) || isoOk(raw))) dd.classList.add('muted');
        dl.append(el('dt', null, label), dd);
      };
      item('Vencimento', r.vencimento, dbr, s.cls === 'bad');
      item('Pagamento mínimo', r.pagamento_minimo, money);
      item('Juros do rotativo', r.juros_rotativo_am, v => taxa(v) + ' a.m.');
      item('Já comprometido adiante', r.a_vencer, money);
      const used = N(r.limite_utilizado), lim = N(r.limite_total);
      const mw = el('div', 'meterwrap');
      const cap = el('div', 'meter-cap');
      if (lim > 0) {
        const p = used / lim;
        const m = el('div', 'meter'), f = el('i'); f.style.width = Math.min(100, p * 100) + '%'; if (p >= 0.7) f.className = 'high'; m.appendChild(f);
        cap.append(el('span', null, brl0.format(used) + ' de ' + brl0.format(lim)), el('span', null, pct0.format(p) + ' do limite'));
        mw.append(m, cap);
      } else { cap.append(el('span', null, 'Limite não informado')); mw.append(cap); }
      c.append(head, big, dl, mw);
      if (window.RaioX && window.RaioX.marcarPaga) {
        const pg = r.paga === 'sim';
        const bt = el('button', 'btn-paga' + (pg ? ' on' : ''), pg ? '✓ Paga · desfazer' : 'Já paguei');
        bt.type = 'button';
        bt.setAttribute('aria-pressed', String(pg));
        bt.addEventListener('click', () => window.RaioX.marcarPaga(r.banco, r.mes, !pg));
        c.appendChild(bt);
      }
      if (r.arquivo_id && window.RaioX && window.RaioX.abrirOriginal) {
        const vo = el('button', 'rx-btn-orig', 'Ver PDF da fatura'); vo.type = 'button'; vo.title = r.arquivo || '';
        vo.addEventListener('click', () => window.RaioX.abrirOriginal(r.arquivo_id));
        c.appendChild(vo);
      }
      if (r.paga === 'sim') c.classList.add('paga');
      box.appendChild(c);
    });
    });
  }

  /* ---------- O que pagar primeiro ---------- */
  function drawPlan() {
    const box = $('plan');
    box.replaceChildren();
    $('plan-sub').textContent = C.todos
      ? 'Só as faturas em aberto, de todos os meses: as vencidas primeiro, começando pelos juros mais altos, depois a que vence antes.'
      : C.passado
      ? `Estas faturas são de ${mesExt(C.mes)}, um mês que já passou. Se alguma ficou sem pagar, quite primeiro a de juros mais altos.`
      : 'Pela ordem: as vencidas, começando pelos juros mais altos, depois a que vence antes.';
    if (!C.F.length) { box.appendChild(el('li', 'vazio', 'Nenhuma fatura para pagar neste mês.')); return; }
    if (!C.abertas.length) box.appendChild(el('li', 'vazio', `Tudo pago ${C.nesteMes}. Nada pendente.`));
    ordemPagamento(C.abertas).forEach((r, i) => {
      const s = C.sit(r);
      const li = setBank(el('li', 'step'), r.banco);
      const name = el('div', 'step-name');
      name.append(document.createTextNode(r.banco));
      if (C.todos && mesOk(r.mes)) name.append(el('span', 'step-mes', 'fatura de ' + mesCurto(r.mes)));
      name.append(el('span', 'chip ' + s.cls, s.txt));
      const val = el('div', 'step-val', money(r.total));
      const why = el('div', 'step-why');
      const juros = tem(r.juros_rotativo_am) && N(r.juros_rotativo_am) > 0;
      const parts = [];
      if ((s.d != null && s.d < 0) || C.passado) {
        parts.push(i === 0 ? 'Primeiro: ' : 'Em seguida: ');
        if (juros) parts.push('rotativo de ', B(taxa(r.juros_rotativo_am)), ' ao mês');
        else parts.push(C.passado ? 'juros não informados na fatura' : 'já está vencida');
      } else if (isoOk(r.vencimento)) parts.push('Pague até ', B(ddm(r.vencimento)), ' para não entrar no rotativo');
      else parts.push('Vencimento não informado');
      if (tem(r.pagamento_minimo)) parts.push('. Mínimo: ', el('span', 'money', money(r.pagamento_minimo)));
      parts.push('.');
      fill(why, parts);
      li.append(name, val, why);
      box.appendChild(li);
    });
    (C.todos ? [] : C.pagas).forEach(r => {
      const li = setBank(el('li', 'step paga'), r.banco);
      const name = el('div', 'step-name');
      name.append(document.createTextNode(r.banco), el('span', 'chip ok', 'Paga'));
      li.append(name, el('div', 'step-val', money(r.total)), el('div', 'step-why', 'Já paga. Nada a fazer.'));
      box.appendChild(li);
    });
  }

  function drawMix() {
    const bar = $('mix'), keys = $('mix-keys');
    bar.replaceChildren(); keys.replaceChildren();
    const um = C.F.length === 1 ? 'Total da fatura' : 'Total das faturas';
    $('total-lab').textContent = C.todos ? `Total das ${pl(C.F.length, 'fatura', 'faturas')} · ${C.periodo.toLowerCase()}`
      : C.passado ? `${um} de ${mesExt(C.mes)}` : `${um} deste mês`;
    $('total-num').textContent = money(C.totalF);
    const tot = C.totalF || 1;
    // Uma fatia por banco (em "Todos os meses" o mesmo banco tem várias faturas).
    const pb = new Map();
    C.F.forEach(r => pb.set(r.banco, (pb.get(r.banco) || 0) + N(r.total)));
    [...pb].sort((a, b) => b[1] - a[1]).forEach(([b, v]) => {
      const i = setBank(el('i'), b); i.style.flex = String(Math.max(0.001, v / tot)); i.title = b;
      bar.appendChild(i);
      const li = el('li');
      li.append(bankDot(b), el('span', 'nm', b), el('span', 'share', pct0.format(v / tot)), el('span', 'money', money(v)));
      keys.appendChild(li);
    });
    if (C.todos && C.abertas.length && C.abertas.length < C.F.length) {
      const li = el('li', 'rx-mix-aberto');
      li.append(el('span'), el('span', 'nm', 'Em aberto'), el('span', 'share', ''), el('span', 'money', money(C.aPagar)));
      keys.appendChild(li);
    }
  }

  /* ---------- Números-chave ---------- */
  function kpi(label, big, sub, cls) {
    const c = el('div', 'card kpi' + (cls ? ' ' + cls : ''));
    c.append(el('div', 'label', label), el('div', 'big', big));
    if (sub && sub.meter != null) { const m = el('div', 'meter'), i = el('i'); i.style.width = Math.min(100, sub.meter * 100) + '%'; if (sub.meter >= 0.7) i.className = 'high'; m.appendChild(i); c.appendChild(m); sub = sub.txt; }
    if (sub) c.appendChild(el('div', 'sub', sub));
    return c;
  }
  function drawKpis() {
    const box = $('numeros');
    box.replaceChildren();
    const k = dados('kpis')[0] || {};
    const n = C.Fatual.length;
    if (N(k.limite_total) > 0) box.appendChild(kpi((n > 1 ? `Limite usado nos ${n} cartões` : 'Limite usado') + (C.todos ? ' (fatura mais recente)' : ''), pct1.format(N(k.limite_usado_pct)),
      { meter: N(k.limite_usado_pct), txt: brl0.format(N(k.limite_utilizado)) + ' de ' + brl0.format(N(k.limite_total)) }));
    else box.appendChild(kpi('Limite usado', '—', 'Limite não informado nas faturas'));
    box.appendChild(kpi('Já comprometido em faturas futuras', money(k.a_vencer), 'Parcelas e saldos que ainda vão cair'));
    if (C.top) {
      const fa = div(C.top.adicional_valor, C.top.valor);
      box.appendChild(kpi(`${C.top.estabelecimento} ${C.noMes}`, money(C.top.valor),
        `${pl(C.top.compras, 'compra', 'compras')}` + (fa > 0.5 ? ` no cartão adicional (${C.top.adicional_banco})` : ` · ${pct0.format(C.top.fatia)} das compras`), 'alert'));
    }
    const tm = C.totMes.filter(x => x.total > 0);
    if (C.todos && tm.length > 1) {
      const media = soma(tm, x => x.total) / tm.length, mx = tm.reduce((a, b) => b.total > a.total ? b : a);
      box.appendChild(kpi('Média por mês', money(media), `${pl(tm.length, 'mês', 'meses')} · ${money(C.totalF)} no total`));
      const nm = MESES[+mx.mes.slice(5) - 1];
      box.appendChild(kpi('Mês mais caro', nm[0].toUpperCase() + nm.slice(1), `${mesExt(mx.mes)}: ${money(mx.total)} · ${pctS.format(div(mx.total - media, media))} sobre a média`, div(mx.total - media, media) > 0.1 ? 'alert' : ''));
    } else if (C.todos) {
      box.appendChild(kpi('Compras no período', money(C.bruto), pl(C.pos.length, 'lançamento', 'lançamentos')));
    } else if (C.ant && C.FAnt.length) {
      const a = soma(C.FAnt, r => N(r.total)), v = div(C.totalF - a, a);
      box.appendChild(kpi(`Comparado a ${mesExt(C.ant)}`, a > 0 ? pctS.format(v) : '—', `${money(a)} → ${money(C.totalF)}`, v > 0.1 ? 'alert' : v < 0 ? 'good' : ''));
    } else if (C.assin.length) {
      box.appendChild(kpi('Assinaturas digitais', money(soma(C.assin)), pl(C.assin.length, 'cobrança', 'cobranças') + (C.assinTop ? ` · maior: ${C.assinTop.estabelecimento}` : '')));
    } else {
      box.appendChild(kpi('Compras no mês', money(C.bruto), pl(C.pos.length, 'lançamento', 'lançamentos')));
    }
  }

  /* ---------- Onde cortar ---------- */
  function cut(tag, tagCls, numero, parts, hot) {
    const li = el('li', 'card cut' + (hot ? ' hot' : ''));
    li.append(el('span', 'chip ' + tagCls + ' tag', tag), el('div', 'cut-num', numero), fill(el('p'), parts));
    return li;
  }
  function drawCortes() {
    const ul = $('alerts');
    ul.replaceChildren();
    const t = C.top;
    if (t) {
      const p = [B(t.estabelecimento), ': ', pl(t.compras, 'compra', 'compras')];
      if (t.compras > 1) p.push(', média de ', money(t.valor / t.compras), ' cada');
      if (t.estornos > 0) p.push(', mais ', money(t.estornos), ' em estornos');
      p.push('. Sozinho, é ', B(pct0.format(t.fatia)), ` das compras ${C.doMes}`);
      const fa = div(t.adicional_valor, t.valor);
      if (fa > 0.5) p.push(`, ${fa >= 0.95 ? 'quase tudo' : pct0.format(fa)} no cartão adicional de ${t.adicional_portador} (${t.adicional_banco})`);
      else if (t.n_bancos === 1 && C.bancos.length > 1) {
        const tb = C.totBanco(t.banco_principal);
        if (tb > 0) p.push(` e ${pct0.format(t.valor / tb)} ${C.todos ? 'das faturas' : 'da fatura'} ${t.banco_principal}`);
      }
      p.push('.');
      ul.appendChild(cut('Maior gasto', 'bad', money(t.valor), p, true));
    }
    if (C.juros.length) {
      const j = C.juros[0], outros = C.juros.slice(1);
      const p = ['É o rotativo da fatura ', B(j.banco), `, cerca de ${pct0.format(anual(j.juros_rotativo_am))} ao ano`];
      if (outros.length) { p.push(', contra '); outros.slice(0, 2).forEach((o, i) => p.push(i ? ' e ' : '', B(taxa(o.juros_rotativo_am)), ` na fatura ${o.banco}`)); p.push('. Se o dinheiro não der para tudo, quite essa primeiro.'); }
      else p.push('. Evite pagar só o mínimo: o saldo restante cai nesses juros.');
      ul.appendChild(cut('Juros mais caros', 'bad', taxa(j.juros_rotativo_am) + ' ao mês', p, true));
    }
    if (C.assin.length) {
      const tot = soma(C.assin);
      const p = [`${pl(C.assin.length, 'cobrança', 'cobranças')} de assinaturas e serviços digitais`];
      if (C.assinTop) p.push('. A maior é ', B(C.assinTop.estabelecimento), `: ${money(C.assinTop.valor)} (${pct0.format(div(C.assinTop.valor, tot))} do grupo)`);
      p.push('. Vale revisar o que ainda é usado.');
      ul.appendChild(cut('Assinaturas', 'warn', money(tot), p));
    }
    if (C.dups.length) {
      const p = [];
      C.dups.slice(0, 3).forEach((d, i) => p.push(i ? '; ' : '', B(d.estabelecimento), `: ${d.vezes}× ${money(d.valor)} em ${ddm(d.data)} no mesmo cartão (${d.banco}${d.cartao ? ' final ' + d.cartao : ''})`));
      if (C.dups.length > 3) p.push(`; e mais ${C.dups.length - 3}`);
      p.push('. Pode ser duplicidade: confira com o banco.');
      ul.appendChild(cut('Conferir', 'warn', money(soma(C.dups, d => d.extra)), p));
    }
    if (C.parcAntigas.length && div(soma(C.parcAntigas), C.totalF) > 0.2) {
      const v = soma(C.parcAntigas);
      ul.appendChild(cut('Parcelas', 'warn', money(v), [`Parcelas de compras feitas em meses anteriores, `, B(pct0.format(v / C.totalF)), ' das faturas. Evite novas compras parceladas até elas acabarem.']));
    }
    if (C.adic.length && (!t || div(t.adicional_valor, t.valor) <= 0.5) && div(soma(C.adic), C.bruto) > 0.3) {
      const v = soma(C.adic);
      ul.appendChild(cut('Cartão adicional', 'warn', money(v), ['Gastos em cartões adicionais: ', B(pct0.format(v / C.bruto)), ` das compras ${C.doMes}. Combine um teto com quem usa.`]));
    }
    if (!ul.childElementCount) ul.appendChild(el('li', 'card cut vazio', `Nada fora do comum ${C.nesteMes}.`));
  }

  /* ---------- Barras horizontais ---------- */
  function drawHBars(elId, rows, kind) {
    const box = $(elId);
    box.replaceChildren();
    if (!rows.length) { box.appendChild(el('div', 'vazio', `Sem compras ${C ? C.nesteMes : 'neste mês'}.`)); return; }
    const max = d3.max(rows, r => N(r.valor)) || 1;
    rows.forEach((r, i) => {
      const row = el('div', 'hbar' + (i === 0 ? ' first' : ''));
      const lab = el('div', 'lab');
      if (kind === 'port') {
        lab.append(bankDot(r.banco), el('span', null, r.portador), el('small', null, r.banco + (r.adicional ? ' · adicional' : '') + ' · ' + pl(N(r.compras), 'compra', 'compras')));
        lab.title = r.grupo;
      } else { lab.append(el('span', null, r.categoria)); lab.title = r.categoria; }
      const val = el('div', 'val', money(r.valor));
      if (r.fatia != null) val.appendChild(el('small', null, pct1.format(N(r.fatia))));
      const tr = el('div', 'track'), f = el('div', 'fill');
      f.style.width = (N(r.valor) / max * 100) + '%';
      if (kind === 'port') f.style.background = i === 0 ? bankColor(r.banco) : `color-mix(in srgb, ${bankColor(r.banco)} 45%, transparent)`;
      tr.appendChild(f);
      row.append(lab, val, tr); box.appendChild(row);
    });
  }

  function posTip(tip, box, ev) {
    tip.style.display = 'block';
    const [px, py] = d3.pointer(ev, box);
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let lx = px + 14; if (lx + tw > box.clientWidth) lx = px - tw - 14;
    tip.style.left = Math.max(0, Math.min(box.clientWidth - tw, lx)) + 'px';
    tip.style.top = Math.max(0, Math.min(box.clientHeight - th, py - th / 2)) + 'px';
  }
  function tipLinhas(tip, titulo, total, linhas) {
    const t = el('div', 't'); t.append(el('span', null, titulo), el('b', null, total));
    tip.replaceChildren(t);
    linhas.forEach(([b, v]) => {
      const l = el('div', 'ln'), sw = el('span', 'sw'); sw.style.background = bankColor(b);
      l.append(sw, el('span', null, b), el('span', null, money(v))); tip.appendChild(l);
    });
  }
  function legenda(box, bancos) {
    box.replaceChildren();
    bancos.forEach(b => { const s = el('span'); s.append(bankDot(b), document.createTextNode(b)); box.appendChild(s); });
  }
  function medir(svg, txt) {
    const t = svg.append('text').attr('font-size', 11).text(txt);
    const w = t.node().getComputedTextLength(); t.remove(); return w;
  }

  /* ---------- Compras à vista dia a dia ---------- */
  function drawDaily() {
    // Em "Todos os meses" o eixo de dias ficaria enorme; a Evolução mês a mês já mostra o gasto por mês.
    $('dia-a-dia').hidden = C.todos;
    if (C.todos) return;
    const box = $('dia-chart'), tip = $('dia-tip'), leg = $('dia-legend');
    box.querySelectorAll('svg, .vazio').forEach(n => n.remove());
    tip.style.display = 'none';
    const raw = dados('por_dia');
    const bancos = ordemBancos(raw.map(r => r.banco));
    legenda(leg, bancos);
    if (!raw.length) { $('dia-sub').textContent = 'Somente compras sem parcela, empilhadas por banco.'; box.appendChild(el('div', 'vazio', 'Nenhuma compra à vista neste mês.')); return; }
    const byDay = new Map();
    raw.forEach(r => { const o = byDay.get(r.dia) || { dia: r.dia, total: 0, v: {} }; o.v[r.banco] = (o.v[r.banco] || 0) + N(r.valor); o.total += N(r.valor); byDay.set(r.dia, o); });
    let dias = [...byDay.keys()].sort();
    const last = dias[dias.length - 1];
    let first = dias[0], fora = 0;
    const span = (diaUTC(last) - diaUTC(first)) / 864e5;
    if (span > 45) { first = isoUTC(d3.utcDay.offset(diaUTC(last), -34)); fora = dias.filter(d => d < first).reduce((t, d) => t + byDay.get(d).total, 0); }
    const rows = dias.filter(d => d >= first).map(d => byDay.get(d));
    $('dia-sub').textContent = `Somente compras sem parcela, de ${ddm(first)} a ${ddm(last)}, empilhadas por banco. O dia mais alto leva o valor em cima.` +
      (fora > 0 ? ` Outros ${money(fora)} em datas anteriores ficaram fora do gráfico.` : '');
    const W = box.clientWidth || 600, H = 280;
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img')
      .attr('aria-label', 'Compras à vista por dia').style('display', 'block').style('overflow', 'visible');
    const peak = rows.reduce((a, b) => b.total > a.total ? b : a);
    const y = d3.scaleLinear([0, peak.total * 1.12], [0, 1]).nice();
    const ticks = y.ticks(W < 500 ? 3 : 4);
    const m = { t: 22, r: 4, b: 26, l: medir(svg, brl0.format(d3.max(ticks))) + 12 };
    y.range([H - m.b, m.t]);
    const days = d3.utcDay.range(diaUTC(first), d3.utcDay.offset(diaUTC(last), 1)).map(isoUTC);
    const x = d3.scaleBand(days, [m.l, W - m.r]).paddingInner(W < 500 ? 0.2 : 0.3).paddingOuter(0.1);
    svg.append('g').selectAll('line').data(ticks.filter(t => t > 0)).join('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', d => y(d)).attr('y2', d => y(d))
      .attr('stroke', 'var(--cds-chart-grid)').attr('stroke-dasharray', '2 3');
    svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', 'var(--cds-chart-axis)');
    svg.append('g').selectAll('text').data(ticks).join('text').attr('x', m.l - 8).attr('y', d => y(d)).attr('dy', '0.32em').attr('text-anchor', 'end')
      .attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text(d => brl0.format(d));
    const every = Math.max(1, Math.ceil(days.length / Math.max(2, Math.floor((W - m.l) / 56))));
    svg.append('g').selectAll('text').data(days.filter((d, i) => i % every === 0)).join('text').attr('x', d => x(d) + x.bandwidth() / 2).attr('y', H - 6)
      .attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text(d => ddm(d));
    const defs = svg.append('defs');
    const uid = 'fxd' + Math.random().toString(36).slice(2, 7);
    const rx = Math.min(4, x.bandwidth() / 2);
    rows.forEach((r, i) => {
      defs.append('clipPath').attr('id', uid + i).append('rect').attr('x', x(r.dia)).attr('width', x.bandwidth())
        .attr('y', y(r.total)).attr('height', Math.max(0, y(0) - y(r.total)) + rx).attr('rx', rx);
    });
    const cols = svg.append('g').selectAll('g').data(rows).join('g').attr('clip-path', (d, i) => `url(#${uid}${i})`);
    cols.each(function (d) {
      let acc = 0;
      const g = d3.select(this);
      bancos.forEach(b => {
        if (!d.v[b]) return;
        g.append('rect').attr('x', x(d.dia)).attr('width', x.bandwidth()).attr('y', y(acc + d.v[b])).attr('height', Math.max(0, y(acc) - y(acc + d.v[b]))).style('fill', bankColor(b));
        acc += d.v[b];
      });
    });
    const pl0 = svg.append('text').attr('y', y(peak.total) - 7).attr('font-size', 11).attr('fill', 'var(--color-fg)').attr('font-weight', 600).text(brl0.format(peak.total));
    const pw = pl0.node().getComputedTextLength(), pcx = x(peak.dia) + x.bandwidth() / 2;
    pl0.attr('text-anchor', 'middle').attr('x', Math.max(m.l + pw / 2, Math.min(W - m.r - pw / 2, pcx)));
    const hl = svg.append('rect').attr('fill', 'var(--color-fg)').attr('opacity', 0).attr('rx', 3).attr('y', m.t).attr('height', y(0) - m.t).attr('width', x.step()).attr('pointer-events', 'none');
    const show = (ev, day) => {
      const d = byDay.get(day);
      hl.attr('x', x(day) - x.step() * x.paddingInner() / 2).attr('opacity', 0.05);
      cols.attr('opacity', c => c.dia === day ? 1 : 0.45);
      tipLinhas(tip, dbr(day), money(d ? d.total : 0), d ? bancos.filter(b => d.v[b]).map(b => [b, d.v[b]]) : []);
      if (!d) tip.appendChild(el('div', null, 'Sem compras à vista'));
      posTip(tip, box, ev);
    };
    svg.append('g').selectAll('rect').data(days).join('rect').attr('x', d => x(d) - x.step() * x.paddingInner() / 2).attr('width', x.step())
      .attr('y', m.t).attr('height', y(0) - m.t).attr('fill', 'transparent')
      .on('pointermove', show).on('pointerdown', show)
      .on('pointerleave', () => { tip.style.display = 'none'; hl.attr('opacity', 0); cols.attr('opacity', 1); });
  }

  /* ---------- Evolução mês a mês ---------- */
  function drawEvolucao() {
    const sec = $('evolucao');
    const rows = dados('evolucao_mensal');
    const meses = [...new Set(rows.map(r => r.mes))].sort();
    if (meses.length < 2) { sec.hidden = true; return; }
    sec.hidden = false;
    const bancos = ordemBancos(rows.map(r => r.banco));
    legenda($('evo-legend'), bancos);
    const byMes = new Map(meses.map(m => [m, { mes: m, total: 0, v: {} }]));
    rows.forEach(r => { const o = byMes.get(r.mes); o.v[r.banco] = (o.v[r.banco] || 0) + N(r.total); o.total += N(r.total); });
    const data = meses.map(m => byMes.get(m));
    $('evo-sub').textContent = C.todos ? `Total das faturas de cada um dos ${meses.length} meses carregados, empilhado por banco.`
      : `Total das faturas de cada um dos ${meses.length} meses carregados, empilhado por banco. ${MesExt(C.mes) || 'O mês selecionado'} aparece em destaque.`;
    const sel = (mm) => C.todos || mm === C.mes;

    const box = $('evo-chart'), tip = $('evo-tip');
    box.querySelectorAll('svg').forEach(n => n.remove());
    tip.style.display = 'none';
    const W = box.clientWidth || 600, H = 260;
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img')
      .attr('aria-label', 'Total das faturas por mês').style('display', 'block').style('overflow', 'visible');
    const maxT = d3.max(data, d => d.total) || 1;
    const y = d3.scaleLinear([0, maxT * 1.14], [0, 1]).nice();
    const ticks = y.ticks(W < 500 ? 3 : 4);
    const m = { t: 22, r: 4, b: 28, l: medir(svg, brl0.format(d3.max(ticks))) + 12 };
    y.range([H - m.b, m.t]);
    const x = d3.scaleBand(meses, [m.l, W - m.r]).paddingInner(0.3).paddingOuter(0.2);
    const bw = Math.min(x.bandwidth(), 84), off = (x.bandwidth() - bw) / 2;
    const bx = (mm) => x(mm) + off;
    svg.append('g').selectAll('line').data(ticks.filter(t => t > 0)).join('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', d => y(d)).attr('y2', d => y(d))
      .attr('stroke', 'var(--cds-chart-grid)').attr('stroke-dasharray', '2 3');
    svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', 'var(--cds-chart-axis)');
    svg.append('g').selectAll('text').data(ticks).join('text').attr('x', m.l - 8).attr('y', d => y(d)).attr('dy', '0.32em').attr('text-anchor', 'end')
      .attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text(d => brl0.format(d));
    const every = Math.max(1, Math.ceil(meses.length / Math.max(2, Math.floor((W - m.l) / 52))));
    svg.append('g').selectAll('text').data(meses.filter((d, i) => i % every === 0 || sel(d))).join('text')
      .attr('x', d => x(d) + x.bandwidth() / 2).attr('y', H - 8).attr('text-anchor', 'middle').attr('font-size', 11)
      .attr('font-weight', d => sel(d) ? 700 : 400).attr('fill', d => sel(d) ? 'var(--color-fg)' : 'var(--color-fg-muted)').text(mesCurto);
    const defs = svg.append('defs');
    const uid = 'fxe' + Math.random().toString(36).slice(2, 7);
    const rx = Math.min(5, bw / 2);
    data.forEach((d, i) => defs.append('clipPath').attr('id', uid + i).append('rect').attr('x', bx(d.mes)).attr('width', bw)
      .attr('y', y(d.total)).attr('height', Math.max(0, y(0) - y(d.total)) + rx).attr('rx', rx));
    const cols = svg.append('g').selectAll('g').data(data).join('g').attr('clip-path', (d, i) => `url(#${uid}${i})`)
      .attr('opacity', d => sel(d.mes) ? 1 : 0.42);
    cols.each(function (d) {
      let acc = 0;
      const g = d3.select(this);
      bancos.forEach(b => {
        if (!d.v[b]) return;
        g.append('rect').attr('x', bx(d.mes)).attr('width', bw).attr('y', y(acc + d.v[b])).attr('height', Math.max(0, y(acc) - y(acc + d.v[b]))).style('fill', bankColor(b));
        acc += d.v[b];
      });
    });
    const roomy = x.step() >= 66;
    svg.append('g').selectAll('text').data(data.filter(d => roomy || sel(d.mes))).join('text')
      .attr('x', d => x(d.mes) + x.bandwidth() / 2).attr('y', d => y(d.total) - 7).attr('text-anchor', 'middle').attr('font-size', 11)
      .attr('font-weight', d => sel(d.mes) ? 700 : 400).attr('fill', d => sel(d.mes) ? 'var(--color-fg)' : 'var(--color-fg-muted)')
      .text(d => brl0.format(d.total))
      .each(function () { const w = this.getComputedTextLength(), cx = +this.getAttribute('x'); this.setAttribute('x', Math.max(m.l + w / 2, Math.min(W - m.r - w / 2, cx))); });
    const show = (ev, d) => {
      tipLinhas(tip, MesExt(d.mes), money(d.total), bancos.filter(b => d.v[b]).map(b => [b, d.v[b]]));
      posTip(tip, box, ev);
      cols.attr('opacity', c => c.mes === d.mes ? 1 : (!C.todos && c.mes === C.mes) ? 0.7 : 0.3);
    };
    svg.append('g').selectAll('rect').data(data).join('rect').attr('x', d => x(d.mes) - x.step() * x.paddingInner() / 2).attr('width', x.step())
      .attr('y', m.t).attr('height', y(0) - m.t).attr('fill', 'transparent')
      .on('pointermove', show).on('pointerdown', show)
      .on('pointerleave', () => { tip.style.display = 'none'; cols.attr('opacity', d => sel(d.mes) ? 1 : 0.42); });

    // Resumo de cada mês com a variação sobre o anterior
    const res = $('evo-resumo');
    res.replaceChildren();
    data.slice(-6).forEach(d => {
      const i = data.indexOf(d), a = i > 0 ? data[i - 1].total : 0;
      const li = el('li', !C.todos && d.mes === C.mes ? 'sel' : null);
      li.append(el('span', 'm', mesCurto(d.mes)), el('b', 'money', money(d.total)));
      if (a > 0) { const v = (d.total - a) / a; li.appendChild(el('small', v > 0.005 ? 'up' : v < -0.005 ? 'down' : null, pctS.format(v))); }
      res.appendChild(li);
    });

    // Variação por categoria
    const body = $('evo-var-body');
    body.replaceChildren();
    $('evo-var').querySelector('h3').textContent = C.todos ? 'Categorias mês a mês' : 'O que mudou por categoria';
    if (C.todos) { drawCategoriasPorMes(body, data.map(d => d.mes)); return; }
    const vr = dados('variacao_categorias');
    if (!C.ant || !vr.length) {
      $('evo-var-sub').textContent = 'Compras por categoria contra o mês anterior.';
      body.appendChild(el('div', 'vazio', C.ant ? 'Sem lançamentos do mês anterior para comparar.' : `${MesExt(C.mes)} é o primeiro mês carregado: não há mês anterior para comparar.`));
      return;
    }
    $('evo-var-sub').textContent = `Compras de ${mesExt(C.mes)} contra ${mesExt(C.ant)}, sem estornos. As maiores mudanças primeiro.`;
    const tb = el('table', 'vt');
    const th = el('thead'), hr = el('tr');
    hr.append(el('th', null, 'Categoria'), el('th', 'r hide-sm', mesCurto(C.ant)), el('th', 'r', mesCurto(C.mes)), el('th', 'r', 'Variação'));
    th.appendChild(hr);
    const bd = el('tbody');
    const top = vr.filter(r => Math.abs(N(r.diferenca)) >= 0.01).slice(0, 8);
    top.forEach(r => {
      const d = N(r.diferenca), tr = el('tr');
      const vc = el('td', 'r var ' + (d > 0 ? 'up' : 'down'));
      vc.append(el('span', null, brlS.format(d)), el('small', null, r.variacao == null || r.variacao === '' ? 'novo' : pctS.format(N(r.variacao))));
      tr.append(el('td', 'cat-n', r.categoria), el('td', 'r hide-sm muted', money(r.anterior)), el('td', 'r', money(r.atual)), vc);
      bd.appendChild(tr);
    });
    const ta = soma(vr, r => N(r.anterior)), tt = soma(vr, r => N(r.atual)), tf = el('tfoot'), fr = el('tr');
    const fv = el('td', 'r var ' + (tt - ta > 0 ? 'up' : 'down'));
    fv.append(el('span', null, brlS.format(tt - ta)), el('small', null, ta ? pctS.format((tt - ta) / ta) : ''));
    fr.append(el('td', null, 'Todas as compras'), el('td', 'r hide-sm', money(ta)), el('td', 'r', money(tt)), fv);
    tf.appendChild(fr);
    tb.append(th, bd, tf);
    body.appendChild(tb);
    if (vr.length > top.length) body.appendChild(el('p', 'nota', `Mostrando as ${top.length} categorias que mais mudaram de ${vr.length}.`));
  }

  /** "Todos os meses": média mensal de cada categoria e o mês em que ela pesou mais. */
  function drawCategoriasPorMes(body, meses) {
    $('evo-var').querySelector('h3').textContent = 'Categorias mês a mês';
    const ms = meses.filter(m => C.L.some(r => r.mes === m));
    $('evo-var-sub').textContent = `Média por mês de cada categoria em ${pl(ms.length, 'mês', 'meses')}, e o mês em que ela pesou mais. Sem estornos.`;
    if (!ms.length) { body.appendChild(el('div', 'vazio', 'Sem lançamentos para comparar.')); return; }
    const porMes = new Map(ms.map(m => [m, new Map(porCategoria(C.L.filter(r => r.mes === m)).map(r => [r.categoria, r.valor]))]));
    const cats = [...new Set([...porMes.values()].flatMap(x => [...x.keys()]))].map(c => {
      const vals = ms.map(m => ({ mes: m, v: porMes.get(m).get(c) || 0 }));
      const mx = vals.reduce((a, b) => b.v > a.v ? b : a);
      return { c, media: soma(vals, x => x.v) / ms.length, mx };
    }).sort((a, b) => b.media - a.media);
    const tb = el('table', 'vt'), th = el('thead'), hr = el('tr');
    hr.append(el('th', null, 'Categoria'), el('th', 'r', 'Média/mês'), el('th', 'r', 'Mês mais alto'));
    th.appendChild(hr);
    const bd = el('tbody');
    const top = cats.slice(0, 8);
    top.forEach(r => {
      const tr = el('tr'), vc = el('td', 'r var');
      vc.append(el('span', null, money(r.mx.v)), el('small', null, mesCurto(r.mx.mes)));
      tr.append(el('td', 'cat-n', r.c), el('td', 'r', money(r.media)), vc);
      bd.appendChild(tr);
    });
    const tf = el('tfoot'), fr = el('tr');
    fr.append(el('td', null, 'Todas as compras'), el('td', 'r', money(soma(cats, x => x.media))), el('td', 'r', ''));
    tf.appendChild(fr);
    tb.append(th, bd, tf);
    body.appendChild(tb);
    if (cats.length > top.length) body.appendChild(el('p', 'nota', `Mostrando as ${top.length} categorias de maior média, de ${cats.length}.`));
  }

  /* ---------- Tabela de lançamentos ---------- */
  let sortK = 'data', sortDir = -1, fBanco = '';
  const sortVal = (r, k) => {
    if (k === 'valor') return N(r.valor);
    if (k === 'parcela') { const p = parcelaDe(r.parcela); return p ? p.n * 1000 + p.de : -1; }
    if (k === 'estabelecimento') return estabDe(r).toLowerCase();
    return String(r[k] || '').toLowerCase();
  };
  function drawFiltros() {
    const seg = $('f-banco');
    const bancos = ordemBancos(C.L.map(r => r.banco).filter(Boolean));
    if (fBanco && !bancos.includes(fBanco)) fBanco = '';
    seg.replaceChildren();
    seg.hidden = bancos.length < 2;
    ['', ...bancos].forEach(b => {
      const bt = el('button'); bt.type = 'button'; bt.dataset.b = b; bt.setAttribute('aria-pressed', String(b === fBanco));
      if (b) bt.append(bankDot(b), document.createTextNode(b)); else bt.textContent = 'Todos';
      seg.appendChild(bt);
    });
    const sel = $('f-cat'), atual = sel.value;
    const cats = [...new Set(C.L.map(catDe))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    sel.replaceChildren(new Option('Todas as categorias', ''));
    cats.forEach(c => sel.add(new Option(c, c)));
    sel.value = cats.includes(atual) ? atual : '';
    // A coluna "Estabelecimento" só aparece quando acrescenta algo à descrição.
    $('tx').classList.toggle('sem-estab', !C.L.some(r => r.estabelecimento && r.estabelecimento.trim() && r.estabelecimento.trim() !== String(r.descricao || '').trim()));
  }
  function drawTable() {
    if (!C) return;
    const tb = document.querySelector('#tx tbody'), cnt = $('count');
    tb.replaceChildren();
    const sel = $('f-cat').value;
    const q = chave($('q').value) ? $('q').value.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') : '';
    $('tx').classList.toggle('com-mes', C.todos);
    const alvo = (r) => [r.descricao, r.estabelecimento, r.categoria, r.portador, r.banco, r.cartao, C.todos ? mesCurto(r.mes) : '', (C.notaDe.get(r.id) || {}).loja].join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const rows = C.L.filter(r => (!fBanco || r.banco === fBanco) && (!sel || catDe(r) === sel) && (!q || alvo(r).includes(q)));
    rows.sort((a, b) => { const va = sortVal(a, sortK), vb = sortVal(b, sortK); return (va < vb ? -1 : va > vb ? 1 : 0) * sortDir; });
    const tot = soma(rows);
    cnt.textContent = `${pl(rows.length, 'lançamento', 'lançamentos')} · ${money(tot)}`;
    const topNome = C.top ? C.top.estabelecimento : null;
    const frag = document.createDocumentFragment();
    if (!rows.length) { const tr = el('tr'), td = el('td', 'vazio', C.L.length ? 'Nenhum lançamento com esses filtros.' : 'Nenhum lançamento neste mês.'); td.colSpan = 10; tr.appendChild(td); frag.appendChild(tr); }
    rows.forEach(r => {
      const v = N(r.valor);
      const tr = el('tr'); tr.dataset.key = r.id || '';
      const bk = el('td', 'hide-sm'); const bs = el('span', 'bk'); bs.append(bankDot(r.banco), document.createTextNode(r.banco || '')); bk.appendChild(bs);
      const desc = el('td', 'desc');
      const dl = el('div', null, r.descricao || estabDe(r));
      const sub = el('div', 'sub'); const sb = el('span', 'bk');
      sb.append(bankDot(r.banco), document.createTextNode([r.banco, portDe(r), r.parcela, C.todos && mesOk(r.mes) ? 'fatura ' + mesCurto(r.mes) : ''].filter(Boolean).join(' · '))); sub.appendChild(sb);
      const nota = r.id && C.notaDe.get(r.id);
      if (nota) {
        // Indicador discreto: este lançamento tem nota fiscal vinculada.
        const nb = el('button', 'rx-nota-chip', 'nota'); nb.type = 'button';
        nb.title = 'Ver a nota' + (nota.loja ? ' de ' + nota.loja : '');
        nb.setAttribute('aria-label', nb.title);
        nb.addEventListener('click', () => { if (window.RaioX && window.RaioX.abrirNota) window.RaioX.abrirNota(nota.id); });
        dl.append(' ', nb);
      }
      desc.append(dl, sub);
      const es = el('td', 'hide-md col-estab muted', r.estabelecimento && r.estabelecimento.trim() !== String(r.descricao || '').trim() ? r.estabelecimento : '');
      const cat = el('td', 'hide-sm'); cat.appendChild(el('span', 'cat' + (v < 0 ? ' good' : topNome && estabDe(r) === topNome ? ' hot' : ''), catDe(r)));
      tr.append(el('td', 'date', ddm(r.data)), el('td', 'hide-sm col-mes muted', mesCurto(r.mes)), bk, el('td', 'hide-md muted', r.cartao || ''), el('td', 'hide-sm', portDe(r) + (ehAdic(r) ? ' (adic.)' : '')), desc, es, cat,
        el('td', 'hide-sm muted', r.parcela || ''), el('td', 'r' + (v < 0 ? ' neg' : ''), money(v)));
      frag.appendChild(tr);
    });
    tb.appendChild(frag);
    document.querySelectorAll('#tx th').forEach(th => th.setAttribute('aria-sort', th.dataset.field === sortK ? (sortDir > 0 ? 'ascending' : 'descending') : 'none'));
  }
  // Listeners registrados uma única vez (os botões de banco usam delegação, pois são recriados a cada mês).
  document.querySelectorAll('#tx th button').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.k; if (sortK === k) sortDir = -sortDir; else { sortK = k; sortDir = k === 'valor' || k === 'data' ? -1 : 1; } drawTable();
  }));
  $('f-banco').addEventListener('click', (ev) => {
    const bt = ev.target.closest('button'); if (!bt) return;
    fBanco = bt.dataset.b || '';
    $('f-banco').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.b === fBanco)));
    drawTable();
  });
  ['q', 'f-cat'].forEach(id => $(id).addEventListener('input', drawTable));

  /* ---------- estados de carga ---------- */
  const CAIXAS = ['an-grid', 'bank-cards', 'plan', 'numeros', 'alerts', 'cat-bars', 'port-bars', 'dia-chart', 'mix'];
  function drawEstado(st) {
    const erro = st === 'error';
    $('takeaway').replaceChildren(el('span', erro ? 'fail' : 'dash-skeleton', erro ? 'Não foi possível carregar as faturas.' : 'Carregando…'));
    $('an-lead').hidden = true; $('evolucao').hidden = true;
    CAIXAS.forEach(id => {
      const n = $(id);
      n.querySelectorAll(':scope > :not(.tip)').forEach(c => c.remove());
      n.classList.toggle('dash-skeleton', !erro);
      if (erro) n.appendChild(el('div', 'fail', 'Não foi possível carregar'));
    });
    document.querySelector('#tx tbody').replaceChildren();
    $('count').textContent = '';
  }

  /* ---------- ciclo de desenho ---------- */
  const root = $('rx-root');
  let intro = false;
  dash.onData(() => {
    const sf = estado('faturas'), sl = estado('lancamentos');
    if (sf !== 'ok' || sl !== 'ok') {
      const st = [sf, sl].includes('error') ? 'error' : 'loading';
      $('rx-mes').textContent = MesExt(mesSelecionado()) || ' ';
      drawEstado(st);
      return;
    }
    CAIXAS.forEach(id => $(id).classList.remove('dash-skeleton'));
    montarContexto();
    const passos = [drawTopo, drawAnalise, drawBanks, drawPlan, drawMix, drawKpis, drawCortes,
      () => drawHBars('cat-bars', dados('por_categoria'), 'cat'), () => drawHBars('port-bars', dados('por_portador'), 'port'),
      () => { const nb = C.F.length; $('cat-sub').textContent = `Compras ${nb > 1 ? 'das ' + nb + ' faturas' : 'do mês'}${C.todos ? ' de ' + C.periodo.toLowerCase() : ''}, sem estornos. Total de ${money(C.bruto)}.`; },
      drawEvolucao, drawDaily, drawFiltros, drawTable];
    passos.forEach(f => { try { f(); } catch (e) { console.error('Raio-X da Fatura: falha ao desenhar', f.name || '', e); } });
    if (!intro) {
      intro = true; root.classList.add('intro');
      setTimeout(() => root.classList.remove('intro'), 1500);
    }
  });
})();
