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
