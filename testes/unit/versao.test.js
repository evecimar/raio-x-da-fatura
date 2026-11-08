/* Versão da release automática (ferramentas/versao.js).
   Regra: branch feat/* sobe o 2º número (nova funcionalidade), fix/* sobe o 3º (correção);
   outras (docs/, ci/, test/, chore/, refactor/) não geram release. */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { proximaVersao, tipoDaBranch, branchDoMerge, NOME_DE_BRANCH } = require('../../ferramentas/versao.js');

describe('tipo da mudança pelo nome da branch', () => {
  it('feat/ → feat, fix/ → fix, o resto não gera release', () => {
    expect(tipoDaBranch('feat/despesa-recorrente')).toBe('feat');
    expect(tipoDaBranch('fix/nubank-soma')).toBe('fix');
    expect(tipoDaBranch('docs/readme')).toBe('');
    expect(tipoDaBranch('ci/versao-pela-branch')).toBe('');
    expect(tipoDaBranch('feature/x')).toBe('');
    expect(tipoDaBranch('')).toBe('');
  });
  it('nome de branch válido: tipo/descricao-curta, minúsculas e hífen', () => {
    for (const ok of ['feat/despesa-recorrente', 'fix/nubank-soma', 'docs/contribuindo', 'ci/release', 'test/caixa', 'chore/deps', 'refactor/leitores'])
      expect(NOME_DE_BRANCH.test(ok), ok).toBe(true);
    for (const ruim of ['main', 'feature/x', 'feat/', 'Feat/x', 'feat/Despesa', 'feat/despesa_nova', 'fix/a/b', 'claude/abc'])
      expect(NOME_DE_BRANCH.test(ruim), ruim).toBe(false);
  });
  it('acha a branch na mensagem do merge do GitHub', () => {
    expect(branchDoMerge('Merge pull request #5 from evecimar/feat/despesa-recorrente\n\nDespesa recorrente')).toBe('feat/despesa-recorrente');
    expect(branchDoMerge('Corrige algo (#7)')).toBe('');
  });
});

describe('próxima versão', () => {
  const tags = ['v0.2.0', 'v0.2.1', 'v0.2.4', 'v0.2.3'];
  it('feat sobe o 2º número e zera o 3º', () => {
    expect(proximaVersao('0.2.0', tags, 'feat')).toBe('0.3.0');
    expect(proximaVersao('0.2.0', ['v0.3.0', 'v0.3.2'], 'feat')).toBe('0.4.0');
  });
  it('fix sobe o 3º número', () => {
    expect(proximaVersao('0.2.0', tags, 'fix')).toBe('0.2.5');
    expect(proximaVersao('0.2.0', ['v0.3.0'], 'fix')).toBe('0.3.1');
  });
  it('outros tipos: sem release', () => {
    expect(proximaVersao('0.2.0', tags, '')).toBe('');
  });
  it('primeira release = versão do package.json', () => {
    expect(proximaVersao('0.2.0', [], 'fix')).toBe('0.2.0');
    expect(proximaVersao('0.2.0', [], 'feat')).toBe('0.2.0');
  });
  it('package.json maior que a última release → usa o package.json (para pular para 1.0.0)', () => {
    expect(proximaVersao('1.0.0', ['v0.9.4'], 'fix')).toBe('1.0.0');
    expect(proximaVersao('0.3.0', ['v0.2.7'], 'feat')).toBe('0.3.0');
  });
  it('compara números, não texto (0.10 > 0.9)', () => {
    expect(proximaVersao('0.2.0', ['v0.9.0', 'v0.10.0'], 'fix')).toBe('0.10.1');
  });
  it('ignora tags que não são versão e recusa versão inválida', () => {
    expect(proximaVersao('0.2.0', ['teste', 'v1', 'v0.2.0'], 'fix')).toBe('0.2.1');
    expect(() => proximaVersao('dois', [], 'fix')).toThrow(/inválida/);
  });
});
