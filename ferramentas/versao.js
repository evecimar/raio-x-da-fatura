#!/usr/bin/env node
/* Versão da próxima release: usada pelo GitHub Actions a cada merge na main.
   Regra: a versão do package.json é a base. Se ela ainda não foi publicada, a release é ela mesma;
   se já foi (ou se já existe uma maior), sobe o último número (0.2.0 → 0.2.1 → 0.2.2...).
   Para uma versão "grande" (0.3.0, 1.0.0), mude a versão no package.json dentro do pull request.
   Uso: node ferramentas/versao.js            → imprime a próxima versão, ex.: 0.2.1
        (lê as tags com `git tag --list "v*"`) */
const { execSync } = require('node:child_process');
const path = require('node:path');

const ler = (v) => { const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(v).trim()); return m ? [+m[1], +m[2], +m[3]] : null; };
const comparar = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** @param {string} base versão do package.json @param {string[]} tags tags existentes (ex.: ['v0.2.0']) @returns {string} */
function proximaVersao(base, tags) {
  const b = ler(base);
  if (!b) throw new Error(`versão inválida no package.json: "${base}"`);
  const publicadas = tags.map(ler).filter(Boolean).sort(comparar);
  const ultima = publicadas[publicadas.length - 1];
  if (!ultima || comparar(b, ultima) > 0) return b.join('.');
  return [ultima[0], ultima[1], ultima[2] + 1].join('.');
}

module.exports = { proximaVersao };

if (require.main === module) {
  const pkg = require(path.join(__dirname, '..', 'package.json'));
  const tags = execSync('git tag --list "v*"', { encoding: 'utf8' }).split('\n').filter(Boolean);
  process.stdout.write(proximaVersao(pkg.version, tags) + '\n');
}
