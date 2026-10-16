/* Vínculo nota ↔ lançamento do cartão (app/notas.js). */
import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { carregar, simples } = require('../carregar.js');

let RX, estado;
const lanc = (o) => ({ banco: 'Caixa', cartao: '1111', mes: '2026-10', parcela: '', tipo: 'compra', descricao: 'LOJA', estabelecimento: 'Loja', ...o });

beforeEach(() => {
  RX = carregar(['app/categorias.js', 'app/notas.js']);
  estado = { faturas: [], lancamentos: [], notas: [] };
  RX.estado = () => estado;
  RX._salvar = () => {};
  RX.atualizar = () => {};
});
const nota = (campos) => simples(RX.novaNota({ loja: 'Loja Exemplo', data: '2026-09-12', total: 89.9, forma: 'credito', ...campos }));
const doEstado = (id) => simples(estado.notas.find(n => n.id === id));

describe('vínculo automático', () => {
  it('liga quando o valor é igual e a data está perto', () => {
    estado.lancamentos.push(lanc({ id: 'a', data: '2026-09-13', valor: 89.9, descricao: 'LOJA EXEMPLO' }));
    const n = nota();
    expect(n.vinculo).toBe('a');
    expect(n.vinculo_tipo).toBe('auto');
  });
  it('não liga com dois candidatos empatados', () => {
    estado.lancamentos.push(lanc({ id: 'a', data: '2026-09-13', valor: 89.9 }), lanc({ id: 'b', data: '2026-09-13', valor: 89.9 }));
    expect(nota({ loja: 'Outra' }).vinculo).toBe('');
  });
  it('nunca liga Pix nem dinheiro', () => {
    estado.lancamentos.push(lanc({ id: 'a', data: '2026-09-12', valor: 89.9, descricao: 'LOJA EXEMPLO' }));
    expect(nota({ forma: 'pix' }).vinculo).toBe('');
    expect(nota({ forma: 'dinheiro', hora: '10:00' }).vinculo).toBe('');
  });
  it('não desfaz a escolha manual da pessoa', () => {
    estado.lancamentos.push(lanc({ id: 'a', data: '2026-09-13', valor: 89.9, descricao: 'LOJA EXEMPLO' }));
    const n = nota();
    RX.vincularNota(n.id, ''); // "não está no cartão"
    RX.editarNota(n.id, { categoria: 'Casa' });
    RX.revincularNotas(estado);
    expect(doEstado(n.id)).toMatchObject({ vinculo: '', vinculo_tipo: 'manual' });
  });
  it('não liga um lançamento que já é de outra nota', () => {
    estado.lancamentos.push(lanc({ id: 'a', data: '2026-09-13', valor: 89.9, descricao: 'LOJA EXEMPLO' }));
    nota();
    expect(nota({ hora: '18:00', loja: 'Loja Exemplo 2' }).vinculo).toBe('');
  });
});

describe('compra parcelada (nota traz o total, a fatura traz a parcela)', () => {
  it('Caixa/PicPay: data da compra na parcela 2/10 → liga pelo total', () => {
    estado.lancamentos.push(lanc({ id: 'p', data: '2026-08-05', valor: 150, parcela: '2/10', descricao: 'MP*LOJA' }));
    const n = nota({ data: '2026-08-05', total: 1500 });
    expect(n.vinculo).toBe('p');
    const s = simples(RX.sugestoesDeVinculo(doEstado(n.id), { estado }));
    expect(s[0].motivos[0]).toMatch(/^10x = R\$\s1\.500,00$/);
  });
  it('Nubank: data da cobrança (parcela 3/12 dois meses depois) também acha a compra', () => {
    estado.lancamentos.push(lanc({ banco: 'Nubank', id: 'p', data: '2026-09-08', valor: 50, parcela: '3/12', descricao: 'Escola Exemplo' }));
    expect(nota({ loja: 'Escola Exemplo', data: '2026-07-08', total: 600 }).vinculo).toBe('p');
  });
  it('a mesma compra em duas faturas vira uma sugestão só', () => {
    estado.lancamentos.push(
      lanc({ id: 'p2', mes: '2026-10', data: '2026-08-05', valor: 40, parcela: '2/10', descricao: 'FOTOGRAFIA EXEMPLO' }),
      lanc({ id: 'p3', mes: '2026-11', data: '2026-08-05', valor: 40, parcela: '3/10', descricao: 'FOTOGRAFIA EXEMPLO' }));
    const n = nota({ forma: '', loja: 'Fotografia Exemplo', data: '2026-08-05', total: 400 });
    const s = simples(RX.sugestoesDeVinculo(doEstado(n.id), { estado }));
    expect(s.map(x => x.lancamento.id)).toEqual(['p3']);
  });
});

describe('dados da nota', () => {
  it('total digitado em pt-BR vira número', () => {
    expect(nota({ total: '1.234,56' }).total).toBe(1234.56);
    expect(nota({ total: 'R$ 32', hora: '1' }).total).toBe(32);
  });
  it('nota sem total pede revisão e avisa', () => {
    const n = nota({ total: '' });
    expect(n.revisar).toBe(true);
    expect(n.avisos).toContain('Não consegui ler o total.');
  });
  it('a mesma nota duas vezes é ignorada', () => {
    nota(); nota();
    expect(estado.notas).toHaveLength(1);
  });
  it('CSV não deixa nome de loja virar fórmula de planilha', () => {
    nota({ loja: '=HYPERLINK("http://exemplo.invalid";"x")' });
    nota({ loja: '+SOMA(1;2)', hora: '2' });
    nota({ loja: '@cmd', hora: '3' });
    const linhas = RX.csvNotas().split('\n').slice(1).join('\n');
    expect(linhas).not.toMatch(/(^|,)"?[=+@]/m);
    expect(RX.celulaCSV('-12.5')).toBe('-12.5'); // estorno continua número
    expect(RX.celulaCSV('-SOMA()')).toBe("'-SOMA()");
  });
  it('CSV escapa vírgulas e aspas', () => {
    nota({ loja: 'Loja "Boa", Ltda' });
    expect(RX.csvNotas().split('\n')[1]).toContain('"Loja ""Boa"", Ltda"');
  });
});
