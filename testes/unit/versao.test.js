/* Versão da release automática (ferramentas/versao.js). */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { proximaVersao } = require('../../ferramentas/versao.js');

describe('próxima versão', () => {
  it('primeira release = versão do package.json', () => {
    expect(proximaVersao('0.2.0', [])).toBe('0.2.0');
  });
  it('versão já publicada → sobe o último número', () => {
    expect(proximaVersao('0.2.0', ['v0.2.0'])).toBe('0.2.1');
    expect(proximaVersao('0.2.0', ['v0.2.0', 'v0.2.1', 'v0.2.2'])).toBe('0.2.3');
  });
  it('package.json maior que a última release → usa o package.json', () => {
    expect(proximaVersao('0.3.0', ['v0.2.0', 'v0.2.7'])).toBe('0.3.0');
    expect(proximaVersao('1.0.0', ['v0.9.4'])).toBe('1.0.0');
  });
  it('compara números, não texto (0.10 > 0.9)', () => {
    expect(proximaVersao('0.2.0', ['v0.9.0', 'v0.10.0'])).toBe('0.10.1');
  });
  it('ignora tags que não são versão e recusa versão inválida', () => {
    expect(proximaVersao('0.2.0', ['teste', 'v1', 'v0.2.0'])).toBe('0.2.1');
    expect(() => proximaVersao('dois', [])).toThrow(/inválida/);
  });
});
