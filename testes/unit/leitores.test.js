/* Cada leitor de banco tem um caso fictício em testes/casos/faturas/<banco>.js.
   Para todos os casos, o resultado tem que: ser reconhecido pelo banco certo, ter a soma dos lançamentos
   igual ao total da fatura, ter os campos do contrato e bater com o que o caso espera. */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { carregar, simples, LEITORES } = require('../carregar.js');

const pasta = path.join(__dirname, '../casos/faturas');
const casos = fs.readdirSync(pasta).filter(f => f.endsWith('.js')).map(f => ({ nome: f.replace(/\.js$/, ''), ...require(path.join(pasta, f)) }));

const ISO = /^\d{4}-\d{2}-\d{2}$/;

describe.each(casos)('leitor $nome', (caso) => {
  const RX = carregar(LEITORES);
  const r = simples(RX.lerFatura(caso.paginas, caso.arquivo));

  it('reconhece o banco', () => {
    expect(r.ok, r.motivo).toBe(true);
    expect(r.banco).toBe(caso.esperado.banco);
  });

  it('soma dos lançamentos = total da fatura', () => {
    expect(r.conferencia.confere, `soma ${r.conferencia.soma} ≠ total ${r.conferencia.total}`).toBe(true);
    expect(r.conferencia.diferenca).toBe(0);
  });

  it('lê os dados da fatura', () => {
    expect(r.fatura).toMatchObject(caso.esperado.fatura);
  });

  it('lê os lançamentos esperados', () => {
    expect(r.lancamentos).toHaveLength(caso.esperado.quantidade);
    for (const e of caso.esperado.lancamentos) {
      const achado = r.lancamentos.find(l => l.data === e.data && l.descricao === e.descricao);
      expect(achado, `lançamento ${e.data} ${e.descricao}`).toBeDefined();
      expect(achado).toMatchObject(e);
    }
  });

  it('cumpre o contrato de lançamento', () => {
    expect(r.problemas).toEqual([]);
    const ids = new Set();
    for (const l of r.lancamentos) {
      expect(l.data).toMatch(ISO);
      expect(l.data <= r.fatura.vencimento).toBe(true);
      expect(typeof l.valor).toBe('number');
      expect(Number.isFinite(l.valor)).toBe(true);
      expect(['compra', 'estorno', 'iof', 'anuidade', 'encargo']).toContain(l.tipo);
      expect(l.parcela).toMatch(/^(\d+\/\d+)?$/);
      expect(['sim', 'nao']).toContain(l.adicional);
      expect(l.categoria).toBeTruthy();
      expect(l.mes).toBe(r.fatura.mes);
      expect(ids.has(l.id)).toBe(false); ids.add(l.id);
    }
  });

  it('nenhum outro leitor reconhece este PDF', () => {
    const texto = RX.util.textoCompleto(caso.paginas);
    const quem = RX.leitores.filter(l => l.reconhece(texto)).map(l => l.banco);
    expect(quem).toEqual([caso.esperado.banco]);
  });
});

describe('contrato de plugin', () => {
  const RX = carregar(['app/leitores/comum.js']);
  const leitor = (o) => ({ id: 'teste', banco: 'Banco Teste', reconhece: () => false, ler: () => ({ fatura: {}, lancamentos: [] }), ...o });

  it('recusa leitor mal formado com mensagem clara', () => {
    expect(() => RX.registrarLeitor(leitor({ id: 'Banco Teste' }))).toThrow(/id tem que ser curto/);
    expect(() => RX.registrarLeitor(leitor({ banco: '' }))).toThrow(/nome do banco/);
    expect(() => RX.registrarLeitor(leitor({ ler: 'x' }))).toThrow(/funções/);
  });
  it('recusa dois leitores com o mesmo id', () => {
    RX.registrarLeitor(leitor({ id: 'repetido' }));
    expect(() => RX.registrarLeitor(leitor({ id: 'repetido' }))).toThrow(/já existe/);
  });
  it('aponta problemas no que o leitor devolveu', () => {
    const p = RX.validarLeitura({
      fatura: { vencimento: '15/10/2026', total: '10,00' },
      lancamentos: [{ data: '2026-13', descricao: 'X', valor: '1,00', parcela: '3 de 10', tipo: 'outro' }]
    });
    expect(p.join(' | ')).toMatch(/vencimento.*total.*data.*valor.*parcela.*tipo/);
  });
  it('erro dentro do leitor vira motivo legível, sem derrubar o app', () => {
    const R = carregar(['app/leitores/comum.js']);
    R.registrarLeitor(leitor({ id: 'quebrado', reconhece: () => true, ler: () => { throw new Error('layout novo'); } }));
    const r = R.lerFatura([[]], 'x.pdf');
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/layout novo/);
  });
});
