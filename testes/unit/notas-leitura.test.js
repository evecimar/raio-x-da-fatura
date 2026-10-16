/* Leitura de notas: XML (NF-e/NFC-e), DANFE em PDF, comprovante de Pix e cupom (texto do OCR).
   Os arquivos em testes/casos/notas/ são fictícios. */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { carregar, simples } = require('../carregar.js');
const { DOMParser } = require('@xmldom/xmldom');

const caso = (f) => fs.readFileSync(path.join(__dirname, '../casos/notas', f), 'utf8');
const RX = carregar(['app/categorias.js', 'app/notas-leitura.js'], { DOMParser });
const lerTexto = (f, origem = 'pdf') => simples(RX.lerNotaTexto(caso(f), { arquivo: f, origem }));

describe('XML de NFC-e', () => {
  const r = simples(RX.lerNotaXML(caso('nfce-ficticia.xml'), 'nfce.xml'));
  it('lê loja, CNPJ, data, total e forma de pagamento', () => {
    expect(r.ok).toBe(true);
    expect(r.nota).toMatchObject({ loja: 'Supermercado Bom Preco', cnpj: '11.222.333/0001-81', data: '2026-09-18', hora: '19:42', total: 64.78, forma: 'credito', documento: 'NFC-e' });
  });
  it('itens somam o total', () => {
    expect(r.nota.itens).toHaveLength(3);
    expect(r.nota.itens[1]).toMatchObject({ qtd: 2, unitario: 8.49, total: 16.98 });
    expect(r.nota.itens.reduce((t, i) => t + i.total, 0)).toBeCloseTo(64.78, 2);
  });
  it('recusa XML que não é nota', () => {
    expect(RX.lerNotaXML('<?xml version="1.0"?><outro/>', 'x.xml').ok).toBe(false);
  });
});

describe('DANFE (NF-e em PDF)', () => {
  const r = lerTexto('danfe.txt');
  it('pega o emitente (não o destinatário) e o total da nota', () => {
    expect(r.ok).toBe(true);
    expect(r.nota).toMatchObject({ loja: 'Casa dos Pisos Exemplo Ltda', cnpj: '11.222.333/0001-81', data: '2026-10-20', total: 1759, documento: 'NF-e' });
    expect(JSON.stringify(r.nota)).not.toMatch(/FULANO|000\.000\.000/i);
  });
  it('lê a tabela de produtos com quantidade fracionada', () => {
    expect(r.nota.itens).toEqual([
      { descricao: 'Piso Ceramico 50x50 Branco', qtd: 50, unitario: 30, total: 1500, unidade: 'M2' },
      { descricao: 'Argamassa Ac1 20kg', qtd: 10, unitario: 25.9, total: 259, unidade: 'UN' }
    ]);
    expect(r.nota.avisos).toEqual([]);
  });
  it('sem bloco de pagamento, a forma fica em branco para a pessoa dizer', () => {
    expect(r.nota.forma).toBe('');
  });
});

describe('comprovante de Pix', () => {
  it('lê quem recebeu, valor, data e hora (sem CPF nem pagador)', () => {
    const r = lerTexto('pix.txt');
    expect(r.nota).toMatchObject({ loja: 'Maria Exemplo Silva', total: 150, data: '2026-10-14', hora: '10:22', forma: 'pix', categoria: 'Transferências e Pix', revisar: false });
    expect(JSON.stringify(r.nota)).not.toMatch(/123\.456|Ana Exemplo|E0000/);
  });
  it('nunca guarda o nome de quem PAGOU (a própria pessoa) como loja', () => {
    const a = lerTexto('pix-pagador-primeiro.txt');
    expect(a.nota).toMatchObject({ loja: 'Feira do Bairro Exemplo', total: 75, forma: 'pix' });
    const b = lerTexto('pix-favorecido.txt');
    expect(b.nota).toMatchObject({ loja: 'Padaria Exemplo', total: 40 });
    expect(JSON.stringify([a.nota, b.nota])).not.toMatch(/Ana Exemplo/);
  });
  it('Pix de pagamento de fatura pede revisão (senão conta duas vezes)', () => {
    const r = lerTexto('pix-fatura.txt');
    expect(r.nota.revisar).toBe(true);
    expect(r.nota.avisos[0]).toMatch(/fatura/);
  });
});

describe('cupom lido por foto (texto do OCR)', () => {
  const r = lerTexto('cupom.txt', 'foto');
  it('lê loja, data, hora, total e dinheiro', () => {
    expect(r.nota).toMatchObject({ loja: 'Mercadinho Exemplo', data: '2026-10-21', hora: '09:15', total: 28.5, forma: 'dinheiro' });
  });
  it('nota de foto sempre pede conferência', () => {
    expect(r.nota.revisar).toBe(true);
  });
  it('texto que não é nota é recusado', () => {
    expect(RX.lerNotaTexto('Lista de compras: pão, leite').ok).toBe(false);
  });
});
