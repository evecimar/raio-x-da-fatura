/* Carrega os scripts do app (scripts clássicos que penduram tudo em window.RaioX) num ambiente
   isolado do Node, do mesmo jeito que o navegador faz com <script src>. Cada chamada cria um
   RaioX novo, então um teste não vaza estado para outro. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const RAIZ = path.resolve(__dirname, '..');

/** Scripts de leitura de fatura, na mesma ordem do index.html. */
const LEITORES = ['app/leitores/comum.js', 'app/categorias.js',
  ...fs.readdirSync(path.join(RAIZ, 'app/leitores')).filter(f => f.endsWith('.js') && f !== 'comum.js').sort().map(f => 'app/leitores/' + f)];

/**
 * @param {string[]} arquivos caminhos relativos à raiz do projeto
 * @param {object} [extras] variáveis globais extras (ex.: stubs)
 * @returns {any} o objeto RaioX montado
 */
function carregar(arquivos, extras = {}) {
  const ctx = vm.createContext({ console, setTimeout, clearTimeout, queueMicrotask, structuredClone, URL, TextDecoder, TextEncoder, ...extras });
  ctx.window = ctx;
  ctx.globalThis = ctx;
  for (const a of arquivos) {
    const codigo = fs.readFileSync(path.join(RAIZ, a), 'utf8');
    vm.runInContext(codigo, ctx, { filename: path.join(RAIZ, a) });
  }
  return ctx.RaioX;
}

/** Copia um valor do ambiente isolado para objetos comuns do Node (para comparar com toEqual). */
const simples = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

module.exports = { carregar, simples, LEITORES, RAIZ };
