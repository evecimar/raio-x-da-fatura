#!/usr/bin/env node
/* Versão da próxima release: usada pelo GitHub Actions a cada merge na main.
   O tipo da mudança vem do nome da branch do pull request:
     feat/<descricao>  nova funcionalidade → sobe o 2º número  (0.2.4 → 0.3.0)
     fix/<descricao>   correção de erro    → sobe o 3º número  (0.2.4 → 0.2.5)
     docs/, ci/, test/, chore/, refactor/  → não gera release (o site é publicado de novo, com a mesma versão)
   A versão do package.json é a base: se for maior que a última release, ela é usada como está (para pular para 1.0.0).
   Uso: node ferramentas/versao.js <branch>   → imprime a próxima versão (ex.: 0.3.0) ou nada, se não gera release
        node ferramentas/versao.js --checar <branch>  → sai com erro se o nome da branch não segue o padrão
   (lê as tags com `git tag --list "v*"`) */
const { execSync } = require('node:child_process');
const path = require('node:path');

/** Nome de branch aceito nos pull requests: tipo/descricao-curta (minúsculas, números e hífen). */
const NOME_DE_BRANCH = /^(feat|fix|docs|ci|test|chore|refactor)\/[a-z0-9]+(-[a-z0-9]+)*$/;

const ler = (v) => { const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(v).trim()); return m ? [+m[1], +m[2], +m[3]] : null; };
const comparar = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** @param {string} branch @returns {'feat'|'fix'|''} */
function tipoDaBranch(branch) {
  const m = /^(feat|fix)\/./.exec(String(branch || ''));
  return m ? /** @type {'feat'|'fix'} */ (m[1]) : '';
}

/** Branch citada na mensagem do merge do GitHub ("Merge pull request #5 from dono/feat/x"), ou ''. */
function branchDoMerge(mensagem) {
  const m = /^Merge pull request #\d+ from [^/\s]+\/(\S+)/.exec(String(mensagem || ''));
  return m ? m[1] : '';
}

/**
 * @param {string} base versão do package.json @param {string[]} tags tags existentes (ex.: ['v0.2.0'])
 * @param {'feat'|'fix'|''} tipo @returns {string} a próxima versão, ou '' se esse tipo não gera release
 */
function proximaVersao(base, tags, tipo) {
  const b = ler(base);
  if (!b) throw new Error(`versão inválida no package.json: "${base}"`);
  if (tipo !== 'feat' && tipo !== 'fix') return '';
  const publicadas = tags.map(ler).filter(Boolean).sort(comparar);
  const ultima = publicadas[publicadas.length - 1];
  if (!ultima || comparar(b, ultima) > 0) return b.join('.');
  return (tipo === 'feat' ? [ultima[0], ultima[1] + 1, 0] : [ultima[0], ultima[1], ultima[2] + 1]).join('.');
}

module.exports = { proximaVersao, tipoDaBranch, branchDoMerge, NOME_DE_BRANCH };

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === '--checar') {
    const nome = args[1] || '';
    if (!NOME_DE_BRANCH.test(nome)) {
      console.error(`Nome de branch fora do padrão: "${nome}".\n` +
        'Use tipo/descricao-curta, em minúsculas e com hífen. Tipos: feat (funcionalidade nova, sobe 0.X.0), ' +
        'fix (correção, sobe 0.0.X), docs, ci, test, chore, refactor (sem release). Ex.: feat/despesa-recorrente, fix/nubank-total.\n' +
        'Para corrigir: crie a branch com o nome certo a partir desta, faça push e abra outro pull request.');
      process.exit(1);
    }
    process.exit(0);
  }
  const pkg = require(path.join(__dirname, '..', 'package.json'));
  const tags = execSync('git tag --list "v*"', { encoding: 'utf8' }).split('\n').filter(Boolean);
  process.stdout.write(proximaVersao(pkg.version, tags, tipoDaBranch(args[0])) + '\n');
}
