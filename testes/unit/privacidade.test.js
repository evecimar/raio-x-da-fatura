/* Verificador de privacidade (ferramentas/verificar-privacidade.js). Os documentos "reais" aqui são
   montados na hora a partir de números de exemplo, nunca de dados de alguém. */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { analisar, cpfValido, cnpjValido, luhn } = require('../../ferramentas/verificar-privacidade.js');

const txt = (s) => Buffer.from(s, 'utf8');
// Os padrões "proibidos" são montados em partes, para este arquivo não acusar a si mesmo no `npm run privacidade`.
const junta = (...p) => p.join('');
const CARTAO = ['5555', '5555', '5555', '4444'].join(' ');
const EMAIL = junta('fulano', '@', 'gmail', '.com');
const CHAVE_NFE = ['3226', '1011', '2223', '3300', '0181', '6500', '1000', '0012', '3410', '0000', '1234'].join(' ');
const PIX = junta('E', '18236120', '202610141022', 's0123456789');
// CPF/CNPJ válidos gerados a partir de uma base qualquer (calcula os dígitos verificadores)
function gerarCpf(base9) {
  const d = base9.split('').map(Number);
  for (const n of [9, 10]) { let s = 0; for (let i = 0; i < n; i++) s += d[i] * (n + 1 - i); const r = (s * 10) % 11; d.push(r === 10 ? 0 : r); }
  return d.join('');
}

describe('verificador de privacidade', () => {
  it('reconhece CPF, CNPJ e cartão válidos', () => {
    expect(cpfValido(gerarCpf('987654321'))).toBe(true);
    expect(cpfValido(junta('987.654.321', '-01'))).toBe(false);
    expect(cnpjValido('11.222.333/0001-81')).toBe(true);
    expect(luhn('4111 1111 1111 1111')).toBe(true);
  });
  it('acusa CPF válido, cartão e e-mail pessoal em qualquer arquivo de texto', () => {
    const cpf = gerarCpf('987654321');
    const p = analisar('app/qualquer.js', txt(`// cliente ${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)} cartão ${CARTAO} ${EMAIL}`));
    expect(p.join(' | ')).toMatch(/CPF válido.*cartão.*e-mail/);
  });
  it('deixa passar os exemplos fictícios conhecidos e códigos de produto', () => {
    expect(analisar('testes/casos/notas/danfe.txt', txt('CNPJ 11.222.333/0001-81\n1001  PISO   69072200 0500 5405 M2\n1234 5678 9012 3456 7890 1234 5678 9012 3456 7890 1234'))).toEqual([]);
    expect(analisar('README.md', txt('escreva para noreply@anthropic.com ou 123456789+evecimar@users.noreply.github.com'))).toEqual([]);
  });
  it('barra documentos pela extensão e pelo conteúdo, mesmo renomeados', () => {
    expect(analisar('faturas/outubro.PDF', txt('x'))).toContain('extensão de documento/exportação');
    expect(analisar('app/foto.bak', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toContain('conteúdo é JPEG');
    expect(analisar('docs/x.md', txt('%PDF-1.7 ...'))).toContain('conteúdo é PDF');
    expect(analisar('raio-x-da-fatura-backup.json', txt('{}'))).toContain('JSON fora da lista (backup do app?)');
    expect(analisar('notas/cupom.txt', txt('TOTAL 10,00'))).toContain('XML/TXT fora de testes/casos/notas/');
    expect(analisar('package.json', txt('{}'))).toEqual([]);
  });
  it('acusa chave de NF-e e ID de Pix que não são os de exemplo', () => {
    expect(analisar('a.js', txt(CHAVE_NFE))).toContain('chave de NF-e (44 dígitos)');
    expect(analisar('a.js', txt(PIX))).toContain('ID de transação Pix');
    expect(analisar('a.js', txt('E00000000202610141022abcdefabcde'))).toEqual([]);
  });
});
