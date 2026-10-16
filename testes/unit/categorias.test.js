/* Categorias e nome limpo do estabelecimento (app/categorias.js).
   Ao mudar uma regra, acrescente aqui a descrição que motivou a mudança: assim nenhuma regra nova
   quebra uma antiga sem ninguém perceber. */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { carregar } = require('../carregar.js');
const RX = carregar(['app/categorias.js']);

const compra = (descricao) => ({ descricao, valor: 10, tipo: 'compra' });

describe('categorizar', () => {
  it.each([
    ['TikTok Shop *TikTok Shop', 'Compras online'],
    ['MERCADOLIVRE*LOJAPARC02/10', 'Compras online'],
    ['Anthropic* Claude Sub', 'Assinaturas digitais'],
    ['APPLE.COM/BILL', 'Assinaturas digitais'],
    ['IFD*RESTAURANTE EXEMPLO', 'Alimentação fora'],
    ['SUMUP *AUTO POSTO EXEMPLO', 'Combustível'],
    ['FARMACIA EXEMPLO 12 B', 'Farmácia e saúde'],
    ['MERCADO DO BAIRRO', 'Mercado'],
    ['REVESTIMENTOS EXEMPLO', 'Casa'],
    ['CENTRO DE PNEUS', 'Veículo'],
    ['ESCOLA EXEMPLO', 'Educação'],
    ['ESTUDIO DE FOTOGRAFIA', 'Serviços'],
    ['LOJA QUE NINGUEM CONHECE', 'Outros']
  ])('%s → %s', (desc, cat) => {
    expect(RX.categorizar(compra(desc))).toBe(cat);
  });
  it('estornos e tarifas têm categoria própria', () => {
    expect(RX.categorizar({ descricao: 'LOJA', valor: -5, tipo: 'estorno' })).toBe('Créditos e estornos');
    expect(RX.categorizar({ descricao: 'IOF', valor: 1, tipo: 'iof' })).toBe('Taxas, IOF e juros');
  });
});

describe('estabelecimento', () => {
  it.each([
    ['TikTok Shop *TikTok Shop', 'TikTok Shop'],
    ['MP*PADARIAEXEMPLO', 'Padariaexemplo'],
    ['DL*TikTok Shop G', 'TikTok Shop'],
    ['IOF de "Anthropic* Claude Sub"', 'Claude (Anthropic)'],
    ['FARMACIA EXEMPLO 12 B', 'Farmacia Exemplo'],
    ['Mercado Bom Preço', 'Mercado Bom Preço']
  ])('%s → %s', (desc, nome) => {
    expect(RX.estabelecimento(desc)).toBe(nome);
  });
});
