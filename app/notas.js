/* Raio-X da Fatura — notas fiscais e cupons (despesas).
   Guarda as notas lidas (foto, PDF, XML ou digitadas), sugere e faz o vínculo com lançamentos
   das faturas, e oferece as ações usadas pela tela de Despesas.

   Uma nota:
   { id, arquivo, origem: 'foto'|'pdf'|'xml'|'manual', loja, cnpj, data: 'AAAA-MM-DD', hora: 'HH:MM',
     total: número, forma: 'dinheiro'|'pix'|'debito'|'credito'|'outro'|'', cartao_final: '1234'|'',
     itens: [{ descricao, qtd, unitario, total }], categoria,
     vinculo: id do lançamento | '', vinculo_tipo: 'auto'|'manual'|'',
     revisar: bool (algum campo importante pode estar errado), avisos: [texto], criada_em } */
(function (g) {
  const RX = g.RaioX = g.RaioX || {};
  const r2 = (n) => Math.round(n * 100) / 100;
  const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const VAZIAS = new Set(['ltda', 'me', 'epp', 'eireli', 'sa', 's', 'a', 'de', 'da', 'do', 'das', 'dos', 'e', 'comercio', 'com', 'loja', 'lojas', 'cia', 'industria', 'servicos', 'filial']);
  const tokens = (s) => semAcento(s).replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(t => t.length > 1 && !VAZIAS.has(t));
  const dias = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 864e5);
  const FORMAS = { dinheiro: 'Dinheiro', pix: 'Pix', debito: 'Débito', credito: 'Crédito', outro: 'Outro', '': 'Não informado' };
  RX.FORMAS_PAGAMENTO = FORMAS;

  /** Semelhança entre o nome da loja na nota e a descrição do lançamento (0 a 1). */
  function semelhanca(loja, lanc) {
    const a = tokens(loja), b = new Set(tokens((lanc.descricao || '') + ' ' + (lanc.estabelecimento || '')));
    if (!a.length || !b.size) return 0;
    let acertos = 0;
    for (const t of a) if (b.has(t) || [...b].some(x => x.length >= 4 && (x.startsWith(t.slice(0, 5)) || t.startsWith(x.slice(0, 5))))) acertos++;
    return acertos / a.length;
  }

  const parcelaDe = (p) => { const m = /^\s*(\d+)\s*\/\s*(\d+)/.exec(p || ''); return m ? { n: +m[1], de: +m[2] } : null; };
  const addMeses = (iso, k) => {
    const [a, m, d] = iso.split('-').map(Number);
    const alvo = new Date(Date.UTC(a, m - 1 + k, 1));
    const ult = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
    return `${alvo.getUTCFullYear()}-${String(alvo.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(d, ult)).padStart(2, '0')}`;
  };
  const isoOk = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  /** Datas em que a compra pode ter sido feita. Parcela n/N: o banco imprime a data da compra (PicPay, Caixa)
      ou a da cobrança (Nubank, n−1 meses depois). */
  RX.datasPossiveisDaCompra = function (l) {
    if (!isoOk(l.data)) return [];
    const p = parcelaDe(l.parcela);
    return p && p.n > 1 ? [l.data, addMeses(l.data, -(p.n - 1))] : [l.data];
  };
  /** Valor total da compra: parcela × número de parcelas (à vista, o próprio valor). */
  RX.valorTotalDaCompra = function (l) {
    const p = parcelaDe(l.parcela), v = Number(l.valor);
    return p && p.de > 1 ? r2(v * p.de) : v;
  };

  /** Lançamentos que podem ser esta nota, do mais provável para o menos.
      Compra parcelada: a nota traz o total, a fatura traz a parcela — compara com parcela × N.
      Várias parcelas da mesma compra (uma por fatura) aparecem uma vez só, a da fatura mais recente. */
  RX.sugestoesDeVinculo = function (nota, { estado = RX.estado(), todas = false } = {}) {
    if (!nota || !(nota.total > 0)) return [];
    const ocupados = new Set(estado.notas.filter(n => n.id !== nota.id && n.vinculo).map(n => n.vinculo));
    const out = [];
    for (const l of estado.lancamentos) {
      const v = Number(l.valor);
      if (!(v > 0) || ocupados.has(l.id)) continue;
      const p = parcelaDe(l.parcela), parcelado = !!(p && p.de > 1);
      const tot = parcelado ? r2(v * p.de) : v;
      const dvParc = Math.abs(v - nota.total), dvTot = Math.abs(tot - nota.total);
      const pelaParcela = parcelado && dvTot > Math.max(0.01, 0.01 * p.de) && dvParc <= 0.01;
      const dv = parcelado ? Math.min(dvParc, Math.max(0, dvTot - 0.01 * p.de)) : dvParc;
      let dd = null;
      if (nota.data) for (const d of RX.datasPossiveisDaCompra(l)) { const x = dias(nota.data, d); if (dd == null || Math.abs(x) < Math.abs(dd)) dd = x; }
      const valorIgual = dv <= 0.01;
      const perto = dd != null && dd >= -2 && dd <= 5;
      if (!todas && !(valorIgual && perto)) continue;
      if (todas && !(dv <= Math.max(1, nota.total * 0.05) || (perto && dv <= nota.total * 0.2))) continue;
      const nome = semelhanca(nota.loja, l);
      let score = (valorIgual ? 0.55 : Math.max(0, 0.35 - dv / nota.total)) + (dd == null ? 0 : Math.max(0, 0.3 * (1 - Math.abs(dd) / 6))) + 0.15 * nome;
      if (nota.cartao_final && l.cartao && nota.cartao_final === l.cartao) score += 0.2;
      const motivos = [];
      if (parcelado && !pelaParcela && dvTot <= Math.max(1, nota.total * 0.05)) motivos.push(`${p.de}x = ${tot.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
      motivos.push(valorIgual ? 'mesmo valor' : 'valor parecido');
      if (dd != null) motivos.push(dd === 0 ? 'mesmo dia' : `${Math.abs(dd)} dia${Math.abs(dd) > 1 ? 's' : ''} ${dd > 0 ? 'depois' : 'antes'}`);
      if (nome >= 0.5) motivos.push('nome parecido');
      if (nota.cartao_final && nota.cartao_final === l.cartao) motivos.push('mesmo cartão');
      const chave = parcelado ? [l.banco, l.cartao, tokens(l.estabelecimento || l.descricao).join(' '), p.de, v.toFixed(2)].join('|') : 'id:' + l.id;
      out.push({ lancamento: { ...l }, score: Math.min(1, r2(score)), motivos, chave });
    }
    // Uma sugestão por compra: entre parcelas da mesma compra, fica a da fatura mais recente.
    const porCompra = new Map();
    for (const s of out) {
      const a = porCompra.get(s.chave);
      if (!a || s.score > a.score || (s.score === a.score && String(s.lancamento.mes) > String(a.lancamento.mes))) porCompra.set(s.chave, s);
    }
    return [...porCompra.values()].map(({ chave, ...s }) => s).sort((a, b) => b.score - a.score).slice(0, todas ? 30 : 8);
  };

  /** Vincula automaticamente quando há um candidato claro. Nunca mexe em vínculo manual. */
  function autoVincular(nota, estado) {
    if (nota.vinculo_tipo === 'manual') return;
    if (nota.forma === 'dinheiro' || nota.forma === 'pix') { if (nota.vinculo_tipo === 'auto') { nota.vinculo = ''; nota.vinculo_tipo = ''; } return; }
    if (nota.vinculo && estado.lancamentos.some(l => l.id === nota.vinculo)) return;
    const s = RX.sugestoesDeVinculo(nota, { estado });
    const melhor = s[0], segundo = s[1];
    if (melhor && melhor.score >= 0.7 && (!segundo || melhor.score - segundo.score >= 0.12)) { nota.vinculo = melhor.lancamento.id; nota.vinculo_tipo = 'auto'; }
    else if (nota.vinculo_tipo === 'auto') { nota.vinculo = ''; nota.vinculo_tipo = ''; }
  }
  RX.revincularNotas = (estado) => estado.notas.forEach(n => autoVincular(n, estado));

  function finalizar(n) {
    ['loja', 'cnpj', 'data', 'hora', 'forma', 'cartao_final', 'categoria', 'vinculo', 'vinculo_tipo', 'arquivo'].forEach(k => { if (n[k] == null) n[k] = ''; });
    if (typeof n.total === 'string') { // "1.234,56", "32,00", "R$ 32" → número
      const t = n.total.replace(/[^\d,.-]/g, '');
      n.total = /,\d{1,2}$/.test(t) ? Number(t.replace(/\./g, '').replace(',', '.')) : Number(t.replace(/,/g, ''));
    }
    n.total = n.total != null && n.total !== '' && isFinite(n.total) && Number(n.total) > 0 ? r2(Number(n.total)) : null;
    n.itens = (n.itens || []).filter(i => i && i.descricao);
    n.forma = n.forma in FORMAS ? n.forma : '';
    if (!n.categoria && RX.categorizar) n.categoria = RX.categorizar({ descricao: [n.loja, ...n.itens.map(i => i.descricao)].join(' '), valor: n.total || 1, tipo: 'compra' });
    if (n.categoria === 'Outros' && n.itens.some(i => /[aá]gua|g[aá]s|botij/i.test(i.descricao))) n.categoria = 'Casa';
    const faltando = [!n.loja && 'loja', !n.data && 'data', !(n.total > 0) && 'total'].filter(Boolean);
    n.revisar = n.revisar || faltando.length > 0;
    n.avisos = [...new Set([...(n.avisos || []), ...faltando.map(f => `Não consegui ler ${f === 'total' ? 'o total' : 'a ' + f}.`)])];
    n.mes = (n.data || '').slice(0, 7);
    return n;
  }

  /** Recebe resultados de RX.lerNota (ou objetos já prontos) e guarda. Notas repetidas são ignoradas. */
  RX.adicionarNotas = function (resultados) {
    const estado = RX.estado();
    const chave = (n) => [semAcento(n.cnpj || n.loja), n.data, n.hora, n.total].join('|');
    const existentes = new Set(estado.notas.map(chave));
    const arquivos = new Set(estado.notas.map(n => n.arquivo).filter(Boolean));
    const novas = [];
    for (const r of resultados) {
      if (!r || !r.ok) continue;
      const n = finalizar({ ...r.nota, id: 'nota-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7), criada_em: new Date().toISOString() });
      if ((n.arquivo && arquivos.has(n.arquivo)) || existentes.has(chave(n))) { r.repetida = true; continue; }
      autoVincular(n, estado);
      estado.notas.push(n); novas.push(n);
    }
    RX._salvar(); RX.atualizar();
    return novas;
  };

  RX.notas = () => RX.estado().notas.map(n => ({ ...n }));
  const achar = (id) => RX.estado().notas.find(n => n.id === id);

  RX.vincularNota = function (id, lancamentoId) {
    const n = achar(id); if (!n) return;
    n.vinculo = lancamentoId || '';
    n.vinculo_tipo = 'manual'; // escolha da pessoa (inclusive "sem vínculo"): nunca revincular sozinho
    RX._salvar(); RX.atualizar();
  };
  RX.editarNota = function (id, campos) {
    const n = achar(id); if (!n) return;
    const permitidos = ['loja', 'cnpj', 'data', 'hora', 'total', 'forma', 'cartao_final', 'categoria', 'itens'];
    const importantes = ['loja', 'data', 'total', 'forma', 'itens'].some(k => k in campos);
    permitidos.forEach(k => { if (k in campos) n[k] = campos[k]; });
    if (importantes) { n.revisar = false; n.avisos = []; }
    finalizar(n);
    if (n.vinculo_tipo !== 'manual') autoVincular(n, RX.estado());
    RX._salvar(); RX.atualizar();
  };
  RX.removerNota = function (id) {
    const e = RX.estado(); e.notas = e.notas.filter(n => n.id !== id);
    RX._salvar(); RX.atualizar();
  };
  /** Despesa digitada à mão (ex.: pagamento em dinheiro sem nota). */
  RX.novaNota = function (campos) {
    const [n] = RX.adicionarNotas([{ ok: true, nota: { origem: 'manual', arquivo: '', itens: [], ...campos } }]);
    return n;
  };

  /** Texto seguro para uma célula de CSV: o que começa com = + - @ (ou tab/enter) seria lido como fórmula
      pelo Excel/Sheets — descrições de loja vêm de fora e podem trazer "=HYPERLINK(...)". Número negativo continua número. */
  RX.celulaCSV = RX.celulaCSV || function (v) {
    v = v == null ? '' : String(v);
    return /^[=+\-@\t\r]/.test(v) && !/^-?\d+(\.\d+)?$/.test(v) ? "'" + v : v;
  };

  RX.csvNotas = function () {
    const cols = ['data', 'hora', 'loja', 'cnpj', 'total', 'forma', 'cartao_final', 'categoria', 'origem', 'arquivo', 'vinculo'];
    const esc = (v) => { v = RX.celulaCSV(v); return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return [cols.join(','), ...RX.estado().notas.map(n => cols.map(c => esc(n[c])).join(','))].join('\n');
  };
})(window);
