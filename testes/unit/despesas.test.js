/* Cálculo da visão Despesas (app/despesas-calculo.js).
   Regra: despesa é o que você COMPROU no mês. No cartão, entra no mês da compra pelo valor total
   (parcelada também, uma vez só) e é paga numa fatura; no Pix/dinheiro/débito já saiu da conta.
   Estornos descontam; tarifas e juros ficam à parte. */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { carregar, simples } = require('../carregar.js');

const RX = carregar(['app/despesas-calculo.js']);
const HOJE = '2026-10-14';

// Faturas fictícias: Caixa fecha dia 1 (outubro e setembro carregadas), Nubank fecha dia 8 (só outubro).
const faturas = [
  { banco: 'Caixa', mes: '2026-09', fechamento: '2026-09-01', vencimento: '2026-09-11', paga: 'sim' },
  { banco: 'Caixa', mes: '2026-10', fechamento: '2026-10-01', vencimento: '2026-10-11', paga: '' },
  { banco: 'Nubank', mes: '2026-10', fechamento: '2026-10-08', vencimento: '2026-10-15', paga: '' }
];
let seq = 0;
const L = (o) => ({ id: 'l' + (++seq), banco: 'Caixa', cartao: '1111', mes: '2026-10', parcela: '', tipo: 'compra', categoria: 'Outros', descricao: 'LOJA ' + seq, ...o });
const nota = (o) => ({ id: 'n' + (++seq), loja: 'Loja', forma: 'credito', vinculo: '', vinculo_tipo: '', revisar: false, categoria: 'Outros', ...o, mes: (o.data || '').slice(0, 7) });

const lancamentos = [
  L({ data: '2026-09-05', valor: 200, categoria: 'Mercado', descricao: 'MERCADO EXEMPLO' }),
  // parcelada 10x de 120,00 comprada em abril: parcelas 5/10 (set) e 6/10 (out) → uma compra de 1.200 em abril
  L({ mes: '2026-09', data: '2026-04-28', valor: 120, parcela: '5/10', descricao: 'LOJA DE TINTAS' }),
  L({ mes: '2026-10', data: '2026-04-28', valor: 120, parcela: '6/10', descricao: 'LOJA DE TINTAS' }),
  // Nubank imprime a data da cobrança: 3/12 em 08/09 → compra em 08/07
  L({ banco: 'Nubank', data: '2026-09-08', valor: 50, parcela: '3/12', descricao: 'Escola Exemplo', categoria: 'Educação' }),
  L({ data: '2026-09-20', valor: -30, tipo: 'estorno', descricao: 'ESTORNO LOJA' }),
  L({ data: '2026-10-01', valor: 30, tipo: 'anuidade', parcela: '10/12', descricao: 'ANUIDADE DIFERENCIADA' }),
  L({ data: '2026-10-01', valor: -10, tipo: 'estorno', descricao: 'CASHBACK ANUIDADE' }),
  L({ banco: 'Nubank', data: '2026-09-20', valor: 3.5, tipo: 'iof', descricao: 'IOF de "Streaming"' }),
  L({ id: 'ligado', data: '2026-09-12', valor: 89.9, descricao: 'LOJA ONLINE' })
];
const notas = [
  nota({ loja: 'Revestimentos Exemplo', data: '2026-10-20', total: 1759 }),        // crédito, fatura ainda não chegou
  nota({ loja: 'Mercadinho', data: '2026-10-12', total: 27.5, forma: 'dinheiro' }),
  nota({ loja: 'Maria Exemplo', data: '2026-09-10', total: 450, forma: 'pix' }),
  nota({ loja: 'Loja Online', data: '2026-09-12', total: 89.9, vinculo: 'ligado', vinculo_tipo: 'auto' }),
  nota({ loja: 'Sem total', data: '2026-09-15', total: null, forma: 'dinheiro', revisar: true })
];
const calc = (mes) => RX.calcularDespesas({ faturas, lancamentos, notas, mes, hoje: HOJE });

describe('mês de setembro', () => {
  const C = calc('2026-09');
  it('compras pelo mês da compra; estorno desconta; nota ligada não soma de novo', () => {
    // 200 + 89,90 (lançamento ligado à nota) − 30 de estorno; Pix 450 fora do cartão
    expect(C.totCompras).toBe(289.9);
    expect(C.totEstornos).toBe(-30);
    expect(C.totCartao).toBe(259.9);
    expect(C.totFora).toBe(450);
    expect(C.total).toBe(709.9);
  });
  it('tarifas e juros ficam à parte (IOF, anuidade e o crédito de anuidade)', () => {
    expect(C.totTarifas).toBe(23.5); // IOF 3,50 + anuidade 30 − cashback 10
    expect(calc('2026-10').totTarifas).toBe(0);
    // anuidade e cashback lançados no fechamento (01/10) contam no ciclo da fatura: setembro
    const set = simples(C.tarifas.map(t => t.descricao)).sort();
    expect(set).toEqual(['ANUIDADE DIFERENCIADA', 'CASHBACK ANUIDADE', 'IOF de "Streaming"']);
  });
  it('nota sem total aparece em "precisa da sua atenção"', () => {
    expect(simples(C.revisar.map(n => n.loja))).toEqual(['Sem total']);
  });
  it('setembro está completo para a Caixa, mas falta a fatura de setembro do Nubank', () => {
    expect(simples(C.faltaFatura('2026-09'))).toEqual(['Nubank']);
  });
});

describe('mês de outubro (compra no crédito que vai para a próxima fatura)', () => {
  const C = calc('2026-10');
  it('compra no crédito sem fatura ainda conta em outubro, pendente da próxima fatura', () => {
    expect(C.totPend).toBe(1759);
    expect(C.totFora).toBe(27.5);
    expect(C.total).toBe(1786.5);
    const P = simples(RX.comoVaiSerPago(C));
    expect(P.pendentes).toBe(1759);
    expect(P.fora).toEqual([{ forma: 'dinheiro', valor: 27.5, quantidade: 1 }]);
  });
  it('outubro é parcial: as faturas que cobrem os dias 2 a 14 ainda não chegaram', () => {
    expect(C.parcial('2026-10')).toBe(true);
  });
});

describe('compra parcelada', () => {
  it('entra uma vez, pelo total, no mês da compra (PicPay/Caixa: data impressa é a da compra)', () => {
    const C = calc('2026-04');
    expect(simples(C.compras.map(c => [c.l.descricao, c.valor, c.n, c.de]))).toEqual([['LOJA DE TINTAS', 1200, 6, 10]]);
    expect(C.totCompras).toBe(1200);
  });
  it('Nubank: a data é a da cobrança, então a compra foi n−1 meses antes', () => {
    const C = calc('2026-07');
    expect(C.totCompras).toBe(600);
    expect(calc('2026-09').compras.some(c => c.l.descricao === 'Escola Exemplo')).toBe(false);
  });
  it('"Como vai ser pago": parcela na fatura de outubro, resto em outras faturas', () => {
    const P = simples(RX.comoVaiSerPago(calc('2026-04')));
    expect(P.faturas.map(f => [f.banco, f.mes, f.valor])).toEqual([['Caixa', '2026-10', 120]]);
    expect(P.outras).toBe(1080);
    expect(P.ultimoMesParcela).toBe('2027-02');
  });
});

describe('todos os meses', () => {
  const C = calc('*');
  it('soma tudo uma vez só', () => {
    // compras: 200 + 1200 + 600 + 89,90 = 2.089,90; estorno −30; pendente 1.759; fora: 27,50 + 450
    expect(C.todos).toBe(true);
    expect(C.totCompras).toBe(2089.9);
    expect(C.total).toBeCloseTo(2089.9 - 30 + 1759 + 27.5 + 450, 2);
  });
  it('mês a mês bate com o total', () => {
    const meses = simples(RX.despesasPorMes(C));
    expect(meses.map(m => m.mes)).toEqual(['2026-10', '2026-09', '2026-07', '2026-04']);
    expect(meses.find(m => m.mes === '2026-09')).toMatchObject({ cartao: 259.9, fora: 450, total: 709.9 });
    expect(meses.reduce((t, m) => t + m.total, 0)).toBeCloseTo(C.total, 2);
  });
  it('por categoria, do maior para o menor', () => {
    const cats = simples(RX.despesasPorCategoria(C)).map(c => c.c);
    expect(cats[0]).toBe('Outros');
    expect(cats).toContain('Educação');
    expect(cats).toContain('Mercado');
  });
});

describe('despesa no crédito parcelada (digitada à mão)', () => {
  const U = RX;
  it('número de parcelas: só no crédito, de 1 a 48', () => {
    expect(U.parcelasDaNota({ forma: 'credito', parcelas: 10 })).toBe(10);
    expect(U.parcelasDaNota({ forma: 'credito', parcelas: '6' })).toBe(6);
    expect(U.parcelasDaNota({ forma: 'credito' })).toBe(1);
    expect(U.parcelasDaNota({ forma: 'pix', parcelas: 10 })).toBe(1);
    expect(U.parcelasDaNota({ forma: 'credito', parcelas: 0 })).toBe(1);
    expect(U.parcelasDaNota({ forma: 'credito', parcelas: 99 })).toBe(1);
    expect(U.parcelasDaNota({ forma: 'credito', parcelas: '2x; alert(1)' })).toBe(1);
  });
  it('divide o total em parcelas que somam o total (o centavo que sobra vai na 1ª)', () => {
    expect(simples(U.valoresDasParcelas(1000, 3))).toEqual([333.34, 333.33, 333.33]);
    expect(simples(U.valoresDasParcelas(1290, 10))).toEqual(Array(10).fill(129));
    expect(simples(U.valoresDasParcelas(50, 1))).toEqual([50]);
  });
  it('conta pelo total no mês da compra (a regra de Despesas não muda)', () => {
    const movel = nota({ loja: 'Móveis Exemplo', data: '2026-10-20', total: 1290, parcelas: 10, cartao_final: '1111' });
    const C = RX.calcularDespesas({ faturas, lancamentos, notas: [movel], mes: '2026-10', hoje: HOJE });
    expect(C.totPend).toBe(1290);
    expect(C.total).toBe(1290);
  });
  it('"Como vai ser pago": 1ª parcela na próxima fatura, o resto em outras faturas', () => {
    const movel = nota({ loja: 'Móveis Exemplo', data: '2026-10-20', total: 1290, parcelas: 10, cartao_final: '1111' });
    const P = simples(RX.comoVaiSerPago(RX.calcularDespesas({ faturas, lancamentos, notas: [movel], mes: '2026-10', hoje: HOJE })));
    expect(P.pendentes).toBe(129);
    expect(P.outras).toBe(1161);
    expect(P.ultimoMesParcela).toBe('2027-08'); // Caixa fecha dia 1: compra de 20/10 cai na fatura de novembro
  });
});

describe('próximos meses (o que esperar pagar)', () => {
  // Caixa (final 1111) fecha dia 1: setembro paga, outubro e novembro carregadas e em aberto. Nubank: outubro já paga.
  const fP = [
    { banco: 'Caixa', mes: '2026-09', fechamento: '2026-09-01', vencimento: '2026-09-11', paga: 'sim', total: 900 },
    { banco: 'Caixa', mes: '2026-10', fechamento: '2026-10-01', vencimento: '2026-10-11', paga: '', total: 1500 },
    { banco: 'Caixa', mes: '2026-11', fechamento: '2026-11-01', vencimento: '2026-11-11', paga: '', total: 300 },
    { banco: 'Nubank', mes: '2026-10', fechamento: '2026-10-08', vencimento: '2026-10-15', paga: 'sim', total: 800 }
  ];
  const lP = [
    L({ id: 'tinta6', mes: '2026-10', data: '2026-04-28', valor: 120, parcela: '6/10', descricao: 'LOJA DE TINTAS' }),
    L({ id: 'tinta7', mes: '2026-11', data: '2026-04-28', valor: 120, parcela: '7/10', descricao: 'LOJA DE TINTAS' }),
    L({ banco: 'Nubank', cartao: '2222', mes: '2026-10', data: '2026-10-02', valor: 50, parcela: '3/3', descricao: 'CURSO' }), // acabou
    L({ id: 'avista', mes: '2026-10', data: '2026-09-15', valor: 80 })
  ];
  const nP = [
    nota({ loja: 'Móveis Exemplo', data: '2026-10-20', total: 1290, parcelas: 10, cartao_final: '1111' }),
    nota({ loja: 'TV Exemplo', data: '2026-10-05', total: 1000, parcelas: 3 }),                       // cartão desconhecido
    nota({ loja: 'Ligada', data: '2026-09-15', total: 400, parcelas: 5, vinculo: 'avista', vinculo_tipo: 'manual' }),
    nota({ loja: 'Não está no cartão', data: '2026-10-10', total: 600, parcelas: 6, vinculo_tipo: 'manual' }),
    nota({ loja: 'Pix', data: '2026-10-10', total: 70, forma: 'pix' }),
    nota({ loja: 'Antiga', data: '2026-03-10', total: 400, parcelas: 4, cartao_final: '1111' })      // já acabou de pagar
  ];
  const R = simples(RX.proximosMeses({ faturas: fP, lancamentos: lP, notas: nP, hoje: '2026-10-23' }));
  const mes = (m) => R.meses.find(x => x.mes === m);
  const desc = (m) => mes(m).itens.map(i => [i.tipo, i.descricao, i.parcela, i.valor]);

  it('vai do mês atual até a última parcela', () => {
    expect(R.meses.map(m => m.mes)).toEqual(['2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05', '2027-06', '2027-07', '2027-08']);
  });
  it('faturas carregadas em aberto entram pelo total; as já pagas não', () => {
    expect(desc('2026-10')).toEqual([['fatura', 'Fatura Caixa', '', 1500]]);
    expect(mes('2026-11').itens.filter(i => i.tipo === 'fatura').map(i => i.valor)).toEqual([300]);
  });
  it('parcelas do cartão continuam depois da última fatura carregada do banco', () => {
    expect(mes('2026-12').itens.find(i => i.tipo === 'parcela')).toMatchObject({ descricao: 'LOJA DE TINTAS', parcela: '8/10', valor: 120, banco: 'Caixa' });
    expect(mes('2027-02').itens.find(i => i.tipo === 'parcela')).toMatchObject({ parcela: '10/10' });
    expect(mes('2027-03').itens.some(i => i.descricao === 'LOJA DE TINTAS')).toBe(false);
    expect(R.meses.some(m => m.itens.some(i => i.descricao === 'CURSO'))).toBe(false);
  });
  it('despesa digitada no crédito: parcelas a partir da fatura em que a compra cai', () => {
    // Caixa fecha dia 1: compra de 20/10 cai na fatura de novembro; 10x de 129
    expect(mes('2026-11').itens.find(i => i.descricao === 'Móveis Exemplo')).toMatchObject({ tipo: 'nota', parcela: '1/10', valor: 129, banco: 'Caixa', estimado: false });
    expect(mes('2027-08').itens.find(i => i.descricao === 'Móveis Exemplo')).toMatchObject({ parcela: '10/10' });
    // cartão desconhecido: estima a fatura do mês seguinte
    expect(mes('2026-11').itens.find(i => i.descricao === 'TV Exemplo')).toMatchObject({ parcela: '1/3', valor: 333.34, estimado: true });
    expect(mes('2027-01').itens.find(i => i.descricao === 'TV Exemplo')).toMatchObject({ parcela: '3/3', valor: 333.33 });
  });
  it('não conta de novo nota ligada, nota fora do cartão, Pix nem parcelas que já passaram', () => {
    const nomes = new Set(R.meses.flatMap(m => m.itens.map(i => i.descricao)));
    ['Ligada', 'Não está no cartão', 'Pix', 'Antiga'].forEach(n => expect(nomes.has(n)).toBe(false));
  });
  it('totais por mês e geral', () => {
    expect(mes('2026-11').total).toBe(762.34);
    expect(mes('2026-12').total).toBe(582.33);
    expect(mes('2027-02').total).toBe(249);
    expect(R.total).toBe(4450);
  });
});

describe('utilidades', () => {
  const U = RX.despesasUtil;
  it('soma meses sem passar do fim do mês', () => {
    expect(U.addMeses('2026-01-31', 1)).toBe('2026-02-28');
    expect(U.addMeses('2026-03-15', -3)).toBe('2025-12-15');
    expect(U.addMesesMes('2026-12', 1)).toBe('2027-01');
  });
  it('reconhece tarifas', () => {
    expect(U.ehTarifa({ tipo: 'iof', valor: 1 })).toBe(true);
    expect(U.ehTarifa({ tipo: 'estorno', valor: -5, descricao: 'ESTORNO ANUIDADE' })).toBe(true);
    expect(U.ehTarifa({ tipo: 'estorno', valor: -5, descricao: 'ESTORNO LOJA' })).toBe(false);
  });
});
