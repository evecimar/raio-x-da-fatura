/* Raio-X da Fatura — visão "Despesas".
   Junta as compras no cartão (pelo MÊS DA COMPRA, não o da fatura) com as notas fiscais, cupons e
   despesas digitadas, sem contar duas vezes a nota que já está ligada a um lançamento.
   Usa as ações de app/notas.js (vincularNota, editarNota, removerNota, novaNota, csvNotas); cada ação
   salva e redesenha sozinha. Dados entram na página só por textContent. */
(function () {
  'use strict';
  const RX = window.RaioX = window.RaioX || {};

  /* ---------- utilidades ---------- */
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const fill = (node, parts) => { node.replaceChildren(); parts.forEach(p => { if (p == null || p === false) return; node.append(typeof p === 'string' ? document.createTextNode(p) : p); }); return node; };
  const B = (t) => el('b', null, t);
  const N = (v) => { if (v == null || v === '') return 0; const n = Number(String(v).trim()); return Number.isFinite(n) ? n : 0; };
  const temValor = (v) => v != null && v !== '' && Number.isFinite(Number(v)) && Number(v) > 0;
  const r2 = (v) => Math.round(v * 100) / 100;
  const soma = (rows, f) => rows.reduce((t, r) => t + f(r), 0);
  const div = (a, b) => (b ? a / b : 0);
  const pl = (n, s, p) => n + ' ' + (n === 1 ? s : p);
  const sem = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const isoOk = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  const mesOk = (s) => /^\d{4}-\d{2}$/.test(String(s || ''));
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const pct0 = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });
  const num = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });
  const money = (v) => brl.format(N(v));
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const mesExt = (m) => mesOk(m) ? MESES[+m.slice(5) - 1] + ' de ' + m.slice(0, 4) : '';
  const MesExt = (m) => { const t = mesExt(m); return t ? t[0].toUpperCase() + t.slice(1) : ''; };
  const mesNome = (m) => mesOk(m) ? MESES[+m.slice(5) - 1] : '';
  const mesCurto = (m) => mesOk(m) ? MESES[+m.slice(5) - 1].slice(0, 3) + '/' + m.slice(2, 4) : '';
  const dbr = (iso) => isoOk(iso) ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '';
  const ddm = (iso) => isoOk(iso) ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '';
  const hoje = () => new Date().toLocaleDateString('sv-SE');
  /** Número digitado em pt-BR ("1.234,56", "54,9", "R$ 10") → número, ou null. */
  function lerNumero(s) {
    let t = String(s == null ? '' : s).replace(/\s|R\$/g, '');
    if (!t) return null;
    if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  const numCampo = (v) => v == null || v === '' || !Number.isFinite(Number(v)) ? '' : String(v).replace('.', ',');
  const dados = (id) => { const st = window.dash && dash.data(id); return st && st.status === 'ok' && Array.isArray(st.data) ? st.data : []; };
  const FORMAS = () => RX.FORMAS_PAGAMENTO || { dinheiro: 'Dinheiro', pix: 'Pix', debito: 'Débito', credito: 'Crédito', outro: 'Outro', '': 'Não informado' };
  const formaRot = (f) => FORMAS()[f || ''] || FORMAS()[''] || 'Não informado';
  const ORIGEM = { foto: 'Foto', pdf: 'PDF', xml: 'XML', manual: 'Digitada' };
  const nomeLoja = (n) => String(n.loja || '').trim() || 'Loja não identificada';
  const catNota = (n) => String(n.categoria || '').trim() || 'Sem categoria';

  /* ---------- montagem: move a visão e os diálogos para dentro do painel ---------- */
  const parte = $('rx-despesas-parte'), root = $('rx-root');
  if (!parte || !root) return;
  const rodape = root.querySelector(':scope > .rx-footer');
  [...parte.children].forEach(n => root.insertBefore(n, rodape || null));
  parte.remove();
  const visaoF = $('rx-visao-faturas'), visaoD = $('rx-visao-despesas');

  /* ---------- alternância Faturas | Despesas ---------- */
  const CHAVE_VISAO = 'raio-x-da-fatura:visao';
  let visao = 'faturas';
  try { const v = localStorage.getItem(CHAVE_VISAO); if (v === 'despesas' || v === 'faturas') visao = v; } catch (e) { /* sem armazenamento */ }
  const slot = $('rx-visoes');
  const botoes = {};
  if (slot) {
    const seg = el('div', 'dp-visoes'); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'Escolher visão');
    [['faturas', 'Faturas'], ['despesas', 'Despesas']].forEach(([k, t]) => {
      const b = el('button', null, t); b.type = 'button'; b.dataset.visao = k;
      b.addEventListener('click', () => RX.mostrarVisao(k));
      botoes[k] = b; seg.appendChild(b);
    });
    slot.appendChild(seg);
  }
  function aplicarVisao() {
    if (visaoF) visaoF.hidden = visao !== 'faturas';
    if (visaoD) visaoD.hidden = visao !== 'despesas';
    root.classList.toggle('rx-em-despesas', visao === 'despesas');
    Object.entries(botoes).forEach(([k, b]) => b.setAttribute('aria-pressed', String(k === visao)));
  }
  RX.visao = () => visao;
  /** Troca entre 'faturas' e 'despesas'. Lembra a escolha neste navegador. */
  RX.mostrarVisao = function (v) {
    visao = v === 'despesas' ? 'despesas' : 'faturas';
    if (visao === 'faturas') mesLocal = null;
    try { localStorage.setItem(CHAVE_VISAO, visao); } catch (e) { /* sem armazenamento */ }
    aplicarVisao();
    if (RX.atualizar) RX.atualizar();
    const topo = $('topo');
    if (topo && topo.getBoundingClientRect().bottom < 0) window.scrollTo(0, 0);
  };
  aplicarVisao();

  /* ---------- cálculos: ficam em app/despesas-calculo.js (testados sem tela) ---------- */

  /* Mês da compra. Segue o seletor do topo; só quando o mês desejado não existe nele (nenhuma fatura vence
     nesse mês, ou "Todos os meses" não é oferecido por haver um mês só) a visão guarda um mês próprio,
     que é esquecido assim que a pessoa mexe no seletor do topo ou volta para Faturas. */
  let mesLocal = null, ultimoGlobal = RX.mesSelecionado;
  const noSeletor = (m) => m === (RX.TODOS || '*') ? (RX.meses ? RX.meses().length > 1 : false) : (RX.meses ? RX.meses() : []).includes(m);
  function irParaMes(m) {
    if (noSeletor(m)) { mesLocal = null; RX.selecionarMes(m); }
    else { mesLocal = m; desenhar(); }
    const v = $('rx-visao-despesas'); if (v && v.getBoundingClientRect().top < 0) v.scrollIntoView({ block: 'start' });
  }
  function contexto() {
    if (RX.mesSelecionado !== ultimoGlobal) { mesLocal = null; ultimoGlobal = RX.mesSelecionado; }
    const sel = mesLocal || RX.mesSelecionado;
    const C = RX.calcularDespesas({ faturas: dados('historico_faturas'), lancamentos: dados('historico_lancamentos'), notas: dados('notas'), mes: mesOk(sel) ? sel : '*', hoje: hoje() });
    C.local = !!mesLocal;
    return C;
  }
  const periodo = (ms) => {
    const s = [...new Set(ms.filter(mesOk))].sort();
    if (!s.length) return '';
    const a = s[0], b = s[s.length - 1];
    if (a === b) return mesExt(a);
    return mesNome(a) + (a.slice(0, 4) === b.slice(0, 4) ? '' : ' de ' + a.slice(0, 4)) + ' a ' + mesExt(b);
  };

  /* ---------- desenho ---------- */
  let D = null, filtro = '', feito = '';
  function desenhar() {
    if (visao !== 'despesas' || !visaoD) return;
    D = contexto();
    const passos = [drawTopo, drawResumo, drawAtencao, drawFormas, drawCategorias, drawMensal, drawNotas];
    passos.forEach(f => { try { f(); } catch (e) { console.error('Raio-X da Fatura: despesas', f.name || '', e); } });
  }

  function rotuloMes() {
    if (D.todos) { const p = periodo(D.mesesNotas.concat(D.mesesCartao)); return p ? 'compras de ' + p : 'todas as compras'; }
    return 'compras feitas em ' + mesExt(D.mes);
  }

  function drawTopo() {
    const t = $('rx-mes'), box = $('takeaway');
    if (t) t.textContent = D.todos ? 'Despesas · todos os meses' : 'Despesas · compras de ' + mesExt(D.mes);
    if (!box) return;
    if (!D.total && !D.notasMes.length) { fill(box, [D.todos ? 'Nenhuma compra encontrada ainda.' : `Nenhuma compra feita em ${mesExt(D.mes)} encontrada.`]); return; }
    const p = [B(money(D.total)), ` em ${D.todos ? 'todas as compras' : mesExt(D.mes)}: `, B(money(D.totCartao)), ' no cartão de crédito'];
    if (D.totFora > 0) p.push(' e ', B(money(D.totFora)), ' fora dele');
    p.push('.');
    const nr = D.revisar.length;
    if (nr) p.push(' ', B(pl(nr, 'nota precisa', 'notas precisam')), ' da sua atenção.');
    fill(box, p);
  }

  function kpi(label, big, sub, cls) {
    const c = el('div', 'card kpi' + (cls ? ' ' + cls : ''));
    c.append(el('div', 'label', label), el('div', 'big', big));
    if (sub) c.appendChild(el('div', 'sub', sub));
    return c;
  }
  function drawResumo() {
    $('dp-titulo').textContent = D.todos ? 'Despesas de todos os meses' : 'Despesas de ' + mesExt(D.mes);
    const sub = $('dp-sub');
    fill(sub, [D.todos ? 'Todas as ' : 'Contando as ', B(rotuloMes()), ', pela data da compra (não pelo mês da fatura): tudo o que você comprou, no cartão ou fora dele, pelo valor total — parceladas também. Estornos são descontados; tarifas e juros ficam à parte.']);
    if (!D.todos && !noSeletor(RX.TODOS || '*')) {
      const b = el('button', 'dp-link', 'Ver todas as compras'); b.type = 'button';
      b.addEventListener('click', () => irParaMes(RX.TODOS || '*'));
      sub.append(' ', b);
    }
    // Dica: as compras de uma fatura costumam ser do mês anterior.
    const dica = $('dp-dica');
    dica.replaceChildren();
    dica.hidden = true;
    if (D.local) {
      dica.hidden = false;
      dica.append(el('span', 'dp-dica-ic', 'i'));
      const t = el('p'), g = RX.mesSelecionado;
      fill(t, ['Mostrando ', B(D.todos ? 'todas as compras' : 'as compras de ' + mesExt(D.mes)), D.todos ? '' : ', um mês que não aparece no seletor do topo porque nenhuma fatura carregada vence nele', '.']);
      const b = el('button', 'dp-btn dp-btn-sm', mesOk(g) ? `Voltar para ${mesNome(g)}` : 'Voltar'); b.type = 'button';
      b.addEventListener('click', () => { mesLocal = null; desenhar(); });
      dica.append(t, b);
    } else if (!D.todos && D.mesDasCompras) {
      const m = D.mesDasCompras;
      dica.hidden = false;
      dica.append(el('span', 'dp-dica-ic', 'i'));
      const t = el('p');
      fill(t, ['Procurando os gastos da ', B('fatura de ' + mesExt(D.mes)), '? As compras dela foram feitas, em sua maioria, em ', B(mesNome(m)), '.']);
      const vazioMes = !D.total && !D.notasMes.length;
      const b = el('button', 'dp-btn' + (vazioMes ? ' dp-btn-pri' : ' dp-btn-sm'), `Ver compras de ${mesNome(m)}`);
      b.type = 'button';
      b.addEventListener('click', () => irParaMes(m));
      dica.append(t, b);
    }
    const intro = $('dp-intro');
    intro.replaceChildren();
    intro.hidden = D.notas.length > 0;
    if (!D.notas.length) {
      intro.append(el('h3', null, 'Ainda não há notas fiscais nem cupons'),
        el('p', null, 'Coloque as fotos, PDFs ou XMLs das notas e cupons na mesma pasta das faturas e use “+ Faturas” para lê-los.'),
        el('p', null, 'Pagou em dinheiro ou Pix sem nota? Registre com “+ Despesa à mão”. Enquanto isso, aqui aparecem só os gastos do cartão.'));
      const b = el('button', 'dp-btn dp-btn-pri', '+ Despesa à mão'); b.type = 'button'; b.addEventListener('click', () => abrirEdicao(null));
      intro.appendChild(b);
    }
    const box = $('dp-kpis');
    box.replaceChildren();
    const vazio = !D.total && !D.notasMes.length;
    $('dp-graficos').hidden = vazio;
    if (vazio) {
      const c = el('div', 'card dp-vazio');
      c.append(el('h3', null, D.todos ? 'Nenhuma compra por aqui' : `Nenhuma compra feita em ${mesExt(D.mes)} por aqui`),
        el('p', null, D.todos ? 'Carregue faturas ou notas para ver as despesas.' : 'Nem no cartão (nas faturas carregadas) nem em notas. Compras feitas depois do fechamento entram na próxima fatura.'));
      box.appendChild(c);
      return;
    }
    const nc = D.cartao.length;
    const semTotal = D.revisar.filter(n => !(Number(n.total) > 0));
    const subTotal = `${money(D.totCartao)} no cartão` + (D.totPend ? ` (${money(D.totPend)} ainda sem fatura)` : '') + ` · ${money(D.totFora)} fora dele` +
      (semTotal.length ? ` · ${pl(semTotal.length, 'nota', 'notas')} sem total (corrija em “Precisa da sua atenção”)` : '');
    const incompleto = !D.todos && D.mes && D.parcial(D.mes);
    const cardTotal = kpi(D.todos ? 'Total gasto' : 'Total gasto em ' + mesNome(D.mes), D.total > 0 || !semTotal.length ? money(D.total) : 'Falta o total', subTotal);
    if (semTotal.length || incompleto) cardTotal.classList.add('dp-kpi-aviso');
    if (incompleto) cardTotal.appendChild(el('div', 'sub dp-parcial', `Mês parcial: falta a fatura de ${D.faltaFatura(D.mes).join(', ')} que cobre parte deste mês. As compras desses dias ainda não aparecem aqui (só as parceladas e as notas).`));
    box.appendChild(cardTotal);
    if (!D.notas.length) {
      box.appendChild(kpi('Compras no cartão', String(nc), `${pl(D.parceladas.length, 'parcelada', 'parceladas')} · sem notas para comparar ainda`));
      return;
    }
    if (D.totTarifas > 0) box.appendChild(kpi('Tarifas e juros do cartão', money(D.totTarifas), `${pl(D.tarifas.length, 'cobrança', 'cobranças')} de IOF, anuidade ou juros · fora do total de compras`, 'dp-kpi-tarifa'));
    box.appendChild(kpi('Fora do cartão', money(D.totFora), D.fora.length ? `${pl(D.fora.length, 'despesa', 'despesas')} em dinheiro, Pix, débito ou outra forma` : 'Nenhuma despesa fora do cartão', ''));
    const lidas = D.notasMes.filter(n => n.origem !== 'manual').length, digit = D.notasMes.length - lidas;
    box.appendChild(kpi('Notas', String(D.notasMes.length), D.notasMes.length ? [lidas ? pl(lidas, 'lida', 'lidas') + ' de foto, PDF ou XML' : '', digit ? pl(digit, 'digitada', 'digitadas') : ''].filter(Boolean).join(' · ') : 'Nenhuma nota neste mês'));
    const nv = D.notasMes.filter(n => D.vinc(n)).length;
    box.appendChild(kpi('Vinculadas ao cartão', D.notasMes.length ? `${nv} de ${D.notasMes.length}` : '0', `${pl(nc, 'compra', 'compras')} no cartão${nv ? `, ${nv} com nota` : ''}`));
    const nr = D.revisar.length;
    box.appendChild(kpi('A revisar', String(nr), nr ? 'Confira abaixo, em “Precisa da sua atenção”' : 'Tudo certo com as notas', nr ? 'alert' : 'good'));
  }

  function drawAtencao() {
    const sec = $('dp-atencao'), ul = $('dp-atencao-lista');
    ul.replaceChildren();
    const itens = [];
    D.revisar.forEach(n => itens.push({ n, tipo: 'revisar' }));
    D.credSemVinculo.filter(n => !D.revisar.includes(n)).forEach(n => itens.push({ n, tipo: 'credito' }));
    sec.hidden = !itens.length;
    itens.forEach(({ n, tipo }) => {
      const li = el('li', 'card dp-at ' + tipo);
      const txt = el('div', 'dp-at-txt');
      const t = el('div', 'dp-at-tit');
      t.append(el('b', null, nomeLoja(n)), el('span', 'muted', [dbr(n.data) || 'sem data', temValor(n.total) ? money(n.total) : 'total não lido'].join(' · ')));
      const motivo = tipo === 'revisar'
        ? ((n.avisos && n.avisos.length ? n.avisos.join(' ') : '') || 'Algum campo pode ter sido lido errado.')
        : 'Pago no crédito, mas sem lançamento ligado. Pode estar numa fatura que ainda não foi carregada.';
      txt.append(t, el('p', null, motivo));
      const b = el('button', 'dp-btn dp-btn-pri', tipo === 'revisar' ? 'Corrigir' : 'Vincular'); b.type = 'button';
      b.addEventListener('click', () => tipo === 'revisar' ? abrirEdicao(n.id) : abrirVinculo(n.id));
      li.append(el('span', 'dp-at-ic', '!'), txt, b);
      ul.appendChild(li);
    });
  }

  function drawFormas() {
    const bar = $('dp-formas-bar'), ul = $('dp-formas');
    bar.replaceChildren(); ul.replaceChildren();
    const P = RX.comoVaiSerPago(D);
    const linhas = [];
    P.faturas.forEach(({ banco, mes: mesF, valor: v, fatura: f }) => {
      linhas.push({ cls: 'credito', nome: `Fatura ${banco} de ${mesNome(mesF)}`, det: f && f.paga === 'sim' ? 'já paga' : (f && isoOk(f.vencimento) ? 'vence ' + dbr(f.vencimento).slice(0, 5) : ''), v });
    });
    if (P.outras > 0) linhas.push({ cls: 'credito', nome: 'Parcelas em outras faturas', det: P.ultimoMesParcela ? 'até ' + mesNome(P.ultimoMesParcela) + ' de ' + P.ultimoMesParcela.slice(0, 4) : '', v: P.outras });
    if (P.pendentes > 0) linhas.push({ cls: 'credito', nome: 'Próxima fatura (ainda não carregada)', det: pl(D.pendentes.length, 'nota no crédito', 'notas no crédito'), v: P.pendentes });
    if (P.estornos) linhas.push({ cls: 'estorno', nome: 'Estornos e créditos', det: 'descontados', v: P.estornos });
    P.fora.forEach(({ forma: f, valor: v, quantidade }) => {
      linhas.push({ cls: f || 'nd', nome: formaRot(f), det: ['pix', 'dinheiro', 'debito'].includes(f) ? 'já saiu da conta' : pl(quantidade, 'despesa', 'despesas'), v });
    });
    const pos = linhas.filter(x => x.v > 0), tot = soma(pos, x => x.v) || 1;
    pos.forEach(x => { const i = el('i', 'dp-f-' + x.cls); i.style.flex = String(Math.max(0.001, x.v / tot)); i.title = x.nome; bar.appendChild(i); });
    linhas.forEach(x => {
      const li = el('li');
      li.append(el('span', 'dp-sw dp-f-' + x.cls), el('span', 'nm', x.nome), el('span', 'qt', x.det || ''), el('span', 'share', x.v > 0 ? pct0.format(x.v / tot) : ''), el('span', 'money', money(x.v)));
      ul.appendChild(li);
    });
    if (!linhas.length) ul.appendChild(el('li', 'vazio', 'Nenhum gasto neste período.'));
    $('dp-formas-sub').textContent = 'Onde cada compra do período é paga: em qual fatura do cartão, em parcelas futuras ou já paga por Pix, dinheiro ou débito.' +
      (D.parceladas.length ? ` ${pl(D.parceladas.length, 'compra parcelada', 'compras parceladas')} entra${D.parceladas.length > 1 ? 'm' : ''} pelo valor total.` : '');
  }

  function drawCategorias() {
    const box = $('dp-cats');
    box.replaceChildren();
    const rows = RX.despesasPorCategoria(D);
    if (!rows.length) { box.appendChild(el('div', 'vazio', 'Sem gastos neste período.')); return; }
    const max = rows[0].v || 1, tot = soma(rows, r => r.v);
    rows.slice(0, 10).forEach((r, i) => {
      const row = el('div', 'hbar' + (i === 0 ? ' first' : ''));
      const lab = el('div', 'lab');
      lab.append(el('span', null, r.c));
      if (r.fora > 0) lab.appendChild(el('small', null, r.cartao > 0 ? `${money(r.fora)} fora do cartão` : 'só fora do cartão'));
      lab.title = r.c;
      const val = el('div', 'val', money(r.v)); val.appendChild(el('small', null, pct0.format(div(r.v, tot))));
      const tr = el('div', 'track'), f = el('div', 'fill dp-fill');
      f.style.width = (r.v / max * 100) + '%';
      if (r.fora > 0) { const fo = el('i', 'dp-fill-fora'); fo.style.width = (r.fora / r.v * 100) + '%'; f.appendChild(fo); }
      tr.appendChild(f);
      row.append(lab, val, tr); box.appendChild(row);
    });
    if (rows.length > 10) box.appendChild(el('p', 'nota', `E mais ${pl(rows.length - 10, 'categoria', 'categorias')}, somando ${money(soma(rows.slice(10), r => r.v))}.`));
    $('dp-cats-sub').textContent = 'Cartão e despesas fora dele, sem contar duas vezes a nota ligada a um lançamento.' + (D.fora.length ? ' A parte mais escura da barra é o que foi pago fora do cartão.' : '') +
      (D.totEstornos ? ` Estornos (${money(Math.abs(D.totEstornos))}) não aparecem nas barras, mas são descontados do total.` : '');
  }

  function drawMensal() {
    const sec = $('dp-mensal'), body = $('dp-mensal-body');
    body.replaceChildren();
    sec.hidden = !D.todos;
    if (!D.todos) return;
    const linhasMes = RX.despesasPorMes(D);
    if (!linhasMes.length) { body.appendChild(el('div', 'vazio', 'Sem compras com data.')); return; }
    const tb = el('table', 'vt dp-mensal'), th = el('thead'), hr = el('tr');
    hr.append(el('th', null, 'Mês da compra'), el('th', 'r', 'Cartão'), el('th', 'r hide-sm', 'Fora do cartão'), el('th', 'r', 'Total'), el('th', 'r', ''));
    th.appendChild(hr);
    const bd = el('tbody');
    linhasMes.forEach(({ mes: m, cartao: c, fora: f, total, parcial }) => {
      const tr = el('tr');
      const acao = el('td', 'r');
      const b = el('button', 'dp-link', 'ver'); b.type = 'button'; b.setAttribute('aria-label', 'Ver compras de ' + mesExt(m)); b.addEventListener('click', () => irParaMes(m)); acao.appendChild(b);
      tr.append(el('td', null, MesExt(m) + (parcial ? ' · parcial' : '')), el('td', 'r', money(c)), el('td', 'r hide-sm', money(f)), el('td', 'r', money(total)), acao);
      bd.appendChild(tr);
    });
    tb.append(th, bd);
    body.appendChild(tb);
  }

  /* ---------- lista de notas ---------- */
  const FILTROS = [['', 'Todas'], ['sem', 'Sem vínculo'], ['vinc', 'Vinculadas'], ['rev', 'A revisar']];
  function drawNotas() {
    const lista = D.todos ? D.notas : D.notasMes;
    $('dp-notas-sub').textContent = lista.length
      ? `${pl(lista.length, 'nota ou despesa', 'notas ou despesas')}${D.todos ? '' : ' com data em ' + mesExt(D.mes)}, da mais recente para a mais antiga.`
      : (D.notas.length ? `Nenhuma nota com data em ${mesExt(D.mes)}.` : 'Nenhuma nota ainda.');
    const fb = $('dp-feito');
    fb.hidden = !feito; fb.textContent = feito; feito = '';
    $('dp-tools').hidden = !lista.length;
    const seg = $('dp-filtro');
    seg.replaceChildren();
    const conta = { '': lista.length, sem: lista.filter(n => !D.vinc(n)).length, vinc: lista.filter(n => D.vinc(n)).length, rev: lista.filter(n => n.revisar || !temValor(n.total)).length };
    if (!conta[filtro]) filtro = '';
    FILTROS.forEach(([k, t]) => {
      if (k && !conta[k]) return;
      const b = el('button', null, t + (k ? ` (${conta[k]})` : '')); b.type = 'button'; b.dataset.f = k; b.setAttribute('aria-pressed', String(k === filtro));
      seg.appendChild(b);
    });
    const q = sem($('dp-q').value.trim());
    const alvo = (n) => sem([n.loja, n.categoria, formaRot(n.forma), dbr(n.data), (n.itens || []).map(i => i.descricao).join(' '), temValor(n.total) ? money(n.total) : ''].join(' '));
    const rows = lista.filter(n => (filtro === '' || (filtro === 'sem' && !D.vinc(n)) || (filtro === 'vinc' && D.vinc(n)) || (filtro === 'rev' && (n.revisar || !temValor(n.total)))) && (!q || alvo(n).includes(q)))
      .sort((a, b) => (String(b.data || '') + (b.hora || '')).localeCompare(String(a.data || '') + (a.hora || '')));
    $('dp-count').textContent = `${pl(rows.length, 'nota', 'notas')} · ${money(soma(rows, n => temValor(n.total) ? N(n.total) : 0))}`;
    const ul = $('dp-notas');
    ul.replaceChildren();
    if (!rows.length && lista.length) ul.appendChild(el('li', 'vazio dp-vazio-lista', 'Nenhuma nota com esses filtros.'));
    rows.forEach(n => ul.appendChild(cartaoNota(n)));
  }
  $('dp-filtro').addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (!b) return; filtro = b.dataset.f || ''; desenhar(); });
  $('dp-q').addEventListener('input', () => { if (D) drawNotas(); });

  function chipOrigem(n) { return el('span', 'dp-chip dp-o-' + (n.origem || 'manual'), ORIGEM[n.origem] || 'Digitada'); }
  function chipForma(n) { return el('span', 'dp-chip dp-forma dp-f-' + (n.forma || 'nd'), formaRot(n.forma)); }
  function textoVinculo(l, n) {
    return [l.banco, l.cartao ? 'final ' + l.cartao : '', l.descricao || l.estabelecimento || ''].filter(Boolean).join(' · ') + (n.vinculo_tipo === 'manual' ? ' (manual)' : ' (automático)');
  }

  function tabelaItens(n) {
    const t = el('table', 'dp-itens-tab'), bd = el('tbody');
    (n.itens || []).forEach(i => {
      const tr = el('tr');
      const q = N(i.qtd), u = N(i.unitario), tt = temValor(i.total) ? N(i.total) : r2(q * u);
      tr.append(el('td', null, i.descricao || 'Item'), el('td', 'r muted', q ? num.format(q) + (u ? ' × ' + money(u) : '') : ''), el('td', 'r', tt ? money(tt) : ''));
      bd.appendChild(tr);
    });
    t.appendChild(bd);
    return t;
  }

  function cartaoNota(n) {
    const li = el('li', 'card dp-nota' + (n.revisar || !temValor(n.total) ? ' revisar' : ''));
    li.dataset.id = n.id;
    const head = el('div', 'dp-nota-head');
    const tit = el('div', 'dp-nota-tit');
    tit.append(el('h3', null, nomeLoja(n)));
    const meta = el('div', 'dp-meta');
    meta.append(el('span', 'muted', [dbr(n.data) || 'sem data', n.hora || ''].filter(Boolean).join(' · ')), chipForma(n), chipOrigem(n), el('span', 'dp-cat', catNota(n)));
    tit.appendChild(meta);
    head.append(tit, el('div', 'dp-nota-val' + (temValor(n.total) ? '' : ' muted'), temValor(n.total) ? money(n.total) : 'sem total'));
    li.appendChild(head);
    // vínculo
    const vl = el('div', 'dp-vinc');
    const l = D.vinc(n);
    if (l) {
      vl.classList.add('on');
      const t = el('p'); fill(t, [el('span', 'dp-vinc-ic', '✓'), 'Vinculada a ', B(textoVinculo(l, n))]);
      const b = el('button', 'dp-link', 'Desfazer'); b.type = 'button';
      b.addEventListener('click', () => { feito = `Vínculo de ${nomeLoja(n)} desfeito.`; RX.vincularNota(n.id, ''); });
      vl.append(t, b);
    } else {
      const fora = n.forma && n.forma !== 'credito';
      const t = el('p'); fill(t, [el('span', 'dp-vinc-ic', fora ? '•' : '?'), fora ? `Fora do cartão (${formaRot(n.forma).toLowerCase()})` : (n.vinculo_tipo === 'manual' ? 'Marcada como fora do cartão' : 'Sem vínculo')]);
      const b = el('button', fora ? 'dp-link' : 'dp-btn dp-btn-sm', fora ? 'Está no cartão?' : 'Vincular a um lançamento'); b.type = 'button';
      if (fora) b.title = 'Vincular a um lançamento do cartão';
      b.addEventListener('click', () => abrirVinculo(n.id));
      vl.append(t, b);
    }
    li.appendChild(vl);
    if (n.avisos && n.avisos.length) li.appendChild(el('p', 'dp-aviso', n.avisos.join(' ')));
    const pe = el('div', 'dp-nota-pe');
    if (n.itens && n.itens.length) {
      const d = el('details', 'dp-det');
      const s = el('summary', null, pl(n.itens.length, 'item', 'itens'));
      d.append(s, tabelaItens(n));
      pe.appendChild(d);
    } else pe.appendChild(el('span', 'muted dp-semitens', 'Sem itens'));
    const ac = el('div', 'dp-nota-acoes');
    const ed = el('button', 'dp-btn dp-btn-sm', 'Editar'); ed.type = 'button'; ed.addEventListener('click', () => abrirEdicao(n.id));
    const rm = el('button', 'dp-btn dp-btn-sm dp-perigo', 'Remover'); rm.type = 'button';
    rm.addEventListener('click', () => confirmarRemocao(ac, rm, n));
    ac.append(ed, rm);
    if (n.arquivo_id && RX.abrirOriginal) { const vo = el('button', 'dp-btn dp-btn-sm', 'Ver original'); vo.type = 'button'; vo.title = n.arquivo || 'Arquivo original'; vo.addEventListener('click', () => RX.abrirOriginal(n.arquivo_id)); ac.prepend(vo); }
    pe.appendChild(ac);
    li.appendChild(pe);
    return li;
  }

  function confirmarRemocao(ac, rm, n) {
    rm.hidden = true;
    const box = el('span', 'dp-confirma');
    box.append(el('span', null, 'Remover esta nota?'));
    const sim = el('button', 'dp-btn dp-btn-sm dp-perigo-on', 'Sim, remover'); sim.type = 'button';
    const nao = el('button', 'dp-btn dp-btn-sm', 'Cancelar'); nao.type = 'button';
    const voltar = () => { box.remove(); rm.hidden = false; rm.focus(); };
    sim.addEventListener('click', () => { feito = `${nomeLoja(n)} removida.`; RX.removerNota(n.id); });
    nao.addEventListener('click', voltar);
    box.append(sim, nao);
    ac.appendChild(box);
    sim.focus();
    setTimeout(() => { if (box.isConnected) voltar(); }, 8000);
  }

  /* ---------- diálogos ---------- */
  const acharNota = (id) => (RX.estado ? RX.estado().notas : dados('notas')).find(n => n.id === id);
  document.querySelectorAll('.dp-dlg').forEach(d => {
    d.addEventListener('click', (ev) => { if (ev.target === d || ev.target.closest('[data-fechar]')) { ev.preventDefault(); d.close(); } });
  });
  const abrir = (d) => { if (d.open) d.close(); d.showModal(); };

  // Vincular
  const dlgV = $('dp-dlg-vinc');
  let notaV = null;
  function linhaCand(l, extra) {
    const li = el('li');
    const b = el('button', 'dp-cand'); b.type = 'button';
    const dot = el('span', 'dp-cand-bk', l.banco ? l.banco.slice(0, 1) : '?');
    const info = el('span', 'dp-cand-info');
    info.append(el('b', null, l.descricao || l.estabelecimento || 'Lançamento'),
      el('small', null, [ddm(l.data), l.banco, l.cartao ? 'final ' + l.cartao : '', l.parcela ? 'parcela ' + l.parcela + (RX.valorTotalDaCompra && RX.valorTotalDaCompra(l) !== N(l.valor) ? ' (total ' + money(RX.valorTotalDaCompra(l)) + ')' : '') : '', mesOk(l.mes) ? 'fatura ' + mesCurto(l.mes) : ''].filter(Boolean).join(' · ')));
    if (extra) info.appendChild(extra);
    const val = el('span', 'dp-cand-val', money(l.valor));
    b.append(dot, info, val);
    b.addEventListener('click', () => { const nm = nomeLoja(notaV); feito = `${nm} vinculada a ${l.descricao || l.banco}.`; dlgV.close(); RX.vincularNota(notaV.id, l.id); });
    li.appendChild(b);
    return li;
  }
  function abrirVinculo(id) {
    const n = acharNota(id); if (!n) return;
    notaV = n;
    const resumo = $('dp-vinc-nota');
    resumo.replaceChildren(el('b', null, nomeLoja(n)), el('span', null, [dbr(n.data) || 'sem data', temValor(n.total) ? money(n.total) : 'sem total', formaRot(n.forma)].join(' · ')));
    const sug = RX.sugestoesDeVinculo ? RX.sugestoesDeVinculo(n) : [];
    const ul = $('dp-vinc-sug'); ul.replaceChildren();
    $('dp-vinc-sug-t').textContent = sug.length ? 'Mais prováveis' : 'Sugestões';
    sug.forEach(s => {
      const ex = el('span', 'dp-cand-mot');
      ex.append(el('span', 'dp-score' + (s.score >= 0.7 ? ' alto' : ''), pct0.format(s.score)), document.createTextNode(' ' + (s.motivos || []).join(', ')));
      ul.appendChild(linhaCand(s.lancamento, ex));
    });
    if (!sug.length) ul.appendChild(el('li', 'vazio', temValor(n.total) ? 'Nenhum lançamento com o mesmo valor perto dessa data. Procure abaixo pelo nome, pela data (ex.: 17/08) ou pelo valor.' : 'Sem o total da nota não dá para sugerir. Corrija a nota ou procure abaixo.'));
    $('dp-vinc-q').value = '';
    buscarVinculo();
    abrir(dlgV);
  }
  function buscarVinculo() {
    const n = notaV, res = $('dp-vinc-res'); if (!n) return;
    res.replaceChildren();
    const q = $('dp-vinc-q').value.trim();
    const sugIds = new Set((RX.sugestoesDeVinculo ? RX.sugestoesDeVinculo(n) : []).map(s => s.lancamento.id));
    let cands;
    if (!q) {
      cands = (RX.sugestoesDeVinculo ? RX.sugestoesDeVinculo(n, { todas: true }) : []).map(s => s.lancamento).filter(l => !sugIds.has(l.id));
      if (cands.length) res.appendChild(el('li', 'dp-cands-t', 'Outros parecidos (valor ou data próximos)'));
    } else {
      const ocupados = new Set(dados('notas').filter(x => x.id !== n.id && x.vinculo).map(x => x.vinculo));
      const qn = sem(q), qv = lerNumero(q), qd = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/.exec(q);
      const datas = (l) => RX.datasPossiveisDaCompra ? RX.datasPossiveisDaCompra(l) : (isoOk(l.data) ? [l.data] : []);
      const totalDe = (l) => RX.valorTotalDaCompra ? RX.valorTotalDaCompra(l) : N(l.valor);
      cands = dados('historico_lancamentos').filter(l => N(l.valor) > 0 && !ocupados.has(l.id)).filter(l => {
        if (qd) return datas(l).some(d => +d.slice(8, 10) === +qd[1] && +d.slice(5, 7) === +qd[2] && (!qd[3] || d.slice(0, 4).endsWith(qd[3])));
        if (qv != null && /^[\d.,\sR$]+$/.test(q)) return Math.abs(N(l.valor) - qv) < 0.995 || Math.abs(totalDe(l) - qv) < 0.995;
        return sem([l.descricao, l.estabelecimento, l.categoria, l.banco].join(' ')).includes(qn);
      }).sort((a, b) => String(b.data).localeCompare(String(a.data))).slice(0, 40);
      res.appendChild(el('li', 'dp-cands-t', cands.length ? `${pl(cands.length, 'lançamento encontrado', 'lançamentos encontrados')}${cands.length === 40 ? ' (os 40 mais recentes)' : ''}` : 'Nenhum lançamento encontrado.'));
    }
    cands.forEach(l => res.appendChild(linhaCand(l)));
  }
  $('dp-vinc-q').addEventListener('input', buscarVinculo);
  $('dp-vinc-fora').addEventListener('click', () => { const n = notaV; dlgV.close(); if (n) { feito = `${nomeLoja(n)} marcada como fora do cartão.`; RX.vincularNota(n.id, ''); } });

  // Editar / nova despesa
  const dlgE = $('dp-dlg-edit'), form = $('dp-edit-form');
  let editId = null;
  const F = (nome) => form.elements[nome];
  function linhaItem(i) {
    const row = el('div', 'dp-item');
    const mk = (nome, ph, val, mode) => { const inp = el('input'); inp.name = nome; inp.placeholder = ph; inp.value = val; inp.autocomplete = 'off'; if (mode) inp.inputMode = mode; inp.setAttribute('aria-label', ph); return inp; };
    const rm = el('button', 'dp-x dp-x-sm', '×'); rm.type = 'button'; rm.setAttribute('aria-label', 'Tirar este item');
    rm.addEventListener('click', () => { row.remove(); somaItens(); });
    row.append(mk('i_desc', 'Descrição', i ? i.descricao || '' : ''), mk('i_qtd', 'Qtd.', i ? numCampo(i.qtd) : '1', 'decimal'),
      mk('i_unit', 'Unitário', i ? numCampo(i.unitario) : '', 'decimal'), mk('i_tot', 'Total', i ? numCampo(i.total) : '', 'decimal'), rm);
    row.addEventListener('input', somaItens);
    return row;
  }
  function lerItens() {
    return [...$('dp-itens-lista').querySelectorAll('.dp-item')].map(r => {
      const g = (k) => r.querySelector(`[name=${k}]`).value;
      const descricao = g('i_desc').trim(); if (!descricao) return null;
      const qtd = lerNumero(g('i_qtd')) ?? 1, unitario = lerNumero(g('i_unit')), tot = lerNumero(g('i_tot'));
      const total = tot != null ? r2(tot) : (unitario != null ? r2(qtd * unitario) : null);
      return { descricao, qtd, unitario: unitario != null ? unitario : (total != null && qtd ? r2(total / qtd) : null), total };
    }).filter(Boolean);
  }
  function somaItens() {
    const its = lerItens().filter(i => i.total != null), box = $('dp-itens-soma');
    box.replaceChildren();
    if (!its.length) return;
    const s = r2(soma(its, i => i.total));
    box.append(document.createTextNode('Soma dos itens: ' + money(s) + ' '));
    const tot = lerNumero(F('total').value);
    if (tot == null || Math.abs(tot - s) > 0.005) {
      const b = el('button', 'dp-link', 'usar como total'); b.type = 'button';
      b.addEventListener('click', () => { F('total').value = numCampo(s); somaItens(); });
      box.appendChild(b);
    }
  }
  $('dp-item-add').addEventListener('click', () => { const r = linhaItem(null); $('dp-itens-lista').appendChild(r); r.querySelector('input').focus(); });
  const mostrarCartao = () => { $('dp-campo-cartao').hidden = !['credito', 'debito'].includes(F('forma').value); };
  form.addEventListener('input', (ev) => { if (ev.target.name === 'total') somaItens(); });
  form.addEventListener('change', (ev) => { if (ev.target.name === 'forma') mostrarCartao(); });

  function categoriasConhecidas() {
    const s = new Set(['Mercado', 'Alimentação fora', 'Farmácia e saúde', 'Casa', 'Transporte', 'Combustível', 'Lazer', 'Educação', 'Vestuário', 'Veículo', 'Outros']);
    dados('historico_lancamentos').forEach(l => { if (l.categoria) s.add(l.categoria); });
    dados('notas').forEach(n => { if (n.categoria) s.add(n.categoria); });
    return [...s].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }
  function abrirEdicao(id) {
    const n = id ? acharNota(id) : null;
    editId = n ? n.id : null;
    form.reset();
    $('dp-edit-t').textContent = n ? 'Editar nota' : 'Nova despesa à mão';
    $('dp-edit-ok').textContent = n ? 'Salvar' : 'Adicionar';
    const av = $('dp-edit-aviso');
    av.hidden = !(n && n.avisos && n.avisos.length);
    av.textContent = n && n.avisos ? n.avisos.join(' ') : '';
    $('dp-edit-erro').hidden = true;
    const sel = F('forma'); sel.replaceChildren();
    const fs = FORMAS();
    ['dinheiro', 'pix', 'debito', 'credito', 'outro', ''].filter(k => k in fs).forEach(k => sel.add(new Option(fs[k], k)));
    const dl = $('dp-cats-lista'); dl.replaceChildren(); categoriasConhecidas().forEach(c => dl.appendChild(new Option(c)));
    F('loja').value = n ? n.loja || '' : '';
    F('data').value = n ? (isoOk(n.data) ? n.data : '') : hoje();
    F('hora').value = n && /^\d{1,2}:\d{2}$/.test(n.hora || '') ? n.hora.padStart(5, '0') : '';
    F('total').value = n ? numCampo(n.total) : '';
    sel.value = n ? (n.forma || '') : 'dinheiro';
    F('cartao_final').value = n ? n.cartao_final || '' : '';
    F('categoria').value = n ? n.categoria || '' : '';
    F('cnpj').value = n ? n.cnpj || '' : '';
    $('dp-campo-cnpj').hidden = !n;
    const li = $('dp-itens-lista'); li.replaceChildren();
    (n && n.itens && n.itens.length ? n.itens : []).forEach(i => li.appendChild(linhaItem(i)));
    somaItens(); mostrarCartao();
    if (dlgV.open) dlgV.close();
    if ($('dp-dlg-ver').open) $('dp-dlg-ver').close();
    abrir(dlgE);
    (n && n.revisar && !temValor(n.total) ? F('total') : F('loja')).focus();
  }
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const erro = $('dp-edit-erro');
    const total = lerNumero(F('total').value);
    const campos = {
      loja: F('loja').value.trim(), data: F('data').value, hora: F('hora').value, total: total != null ? r2(total) : null,
      forma: F('forma').value, cartao_final: ['credito', 'debito'].includes(F('forma').value) ? F('cartao_final').value.replace(/\D/g, '').slice(-4) : '',
      categoria: F('categoria').value.trim(), itens: lerItens()
    };
    if (editId) campos.cnpj = F('cnpj').value.trim();
    const falta = [];
    if (!editId && !campos.loja) falta.push('onde foi a compra');
    if (!editId && !isoOk(campos.data)) falta.push('a data');
    if (F('total').value.trim() && (total == null || total <= 0)) falta.push('um total válido (ex.: 54,90)');
    else if (!editId && !(total > 0)) falta.push('o total');
    if (falta.length) { erro.hidden = false; erro.textContent = 'Falta ' + falta.join(', ') + '.'; return; }
    dlgE.close();
    if (editId) { feito = `${campos.loja || 'Nota'} atualizada.`; RX.editarNota(editId, campos); }
    else {
      const m = campos.data.slice(0, 7), sel = RX.mesSelecionado;
      feito = `Despesa “${campos.loja}” adicionada em ${dbr(campos.data)}.` + (sel !== (RX.TODOS || '*') && m !== sel ? ` Ela aparece em ${mesExt(m)}${(RX.meses ? RX.meses() : []).includes(m) ? '' : ' (veja em “Todos os meses”)'}.` : '');
      RX.novaNota(campos);
    }
  });

  // Ver nota (a partir do indicador "nota" na tabela de lançamentos)
  const dlgN = $('dp-dlg-ver');
  RX.abrirNota = function (id) {
    const n = acharNota(id); if (!n) return;
    $('dp-ver-t').textContent = nomeLoja(n);
    const c = $('dp-ver-corpo'); c.replaceChildren();
    const meta = el('div', 'dp-meta');
    meta.append(el('span', 'muted', [dbr(n.data) || 'sem data', n.hora || ''].filter(Boolean).join(' · ')), chipForma(n), chipOrigem(n));
    c.append(el('div', 'dp-ver-total', temValor(n.total) ? money(n.total) : 'sem total'), meta);
    const HL = dados('historico_lancamentos'), l = n.vinculo ? HL.find(x => x.id === n.vinculo) : null;
    if (l) { const p = el('p', 'dp-vinc on'); fill(p, [el('span', 'dp-vinc-ic', '✓'), 'Vinculada a ', B(textoVinculo(l, n))]); c.appendChild(p); }
    if (n.cnpj) c.appendChild(el('p', 'muted', 'CNPJ ' + n.cnpj));
    if (n.itens && n.itens.length) { c.appendChild(el('h4', null, pl(n.itens.length, 'item', 'itens'))); c.appendChild(tabelaItens(n)); }
    else c.appendChild(el('p', 'muted', 'A nota não tem itens registrados.'));
    const pe = $('dp-ver-pe'); pe.replaceChildren();
    const ed = el('button', 'dp-btn dp-btn-pri', 'Editar'); ed.type = 'button'; ed.addEventListener('click', () => abrirEdicao(n.id));
    pe.appendChild(ed);
    if (n.arquivo_id && RX.abrirOriginal) { const vo = el('button', 'dp-btn', 'Ver original'); vo.type = 'button'; vo.addEventListener('click', () => RX.abrirOriginal(n.arquivo_id)); pe.appendChild(vo); }
    if (l) { const d = el('button', 'dp-btn', 'Desfazer vínculo'); d.type = 'button'; d.addEventListener('click', () => { dlgN.close(); feito = `Vínculo de ${nomeLoja(n)} desfeito.`; RX.vincularNota(n.id, ''); }); pe.appendChild(d); }
    const f = el('button', 'dp-btn', 'Fechar'); f.type = 'button'; f.addEventListener('click', () => dlgN.close()); pe.appendChild(f);
    abrir(dlgN);
  };
  RX.abrirVinculoNota = abrirVinculo;
  RX.editarNotaNaTela = abrirEdicao;

  $('dp-nova').addEventListener('click', () => abrirEdicao(null));
  $('dp-csv').addEventListener('click', () => {
    if (!RX.csvNotas) return;
    const blob = new Blob(['\uFEFF' + RX.csvNotas()], { type: 'text/csv;charset=utf-8' });
    const a = el('a'); a.href = URL.createObjectURL(blob); a.download = 'raio-x-da-fatura-notas.csv';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  if (window.dash) dash.onData(desenhar);
})();
