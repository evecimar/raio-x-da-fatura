#!/usr/bin/env node
/* Monta a pasta que vai na release: só o que a pessoa precisa para usar o app (abre com duplo clique).
   Uso: node ferramentas/empacotar.js <versão> [--site]   → cria dist/raio-x-da-fatura-<versão>/
   --site acrescenta a política de segurança (CSP) usada no GitHub Pages. */
const fs = require('node:fs');
const path = require('node:path');

const versao = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(versao || '')) { console.error('Uso: node ferramentas/empacotar.js 0.2.0'); process.exit(1); }
const raiz = path.resolve(__dirname, '..');
const nome = `raio-x-da-fatura-${versao}`;
const destino = path.join(raiz, 'dist', nome);
fs.rmSync(destino, { recursive: true, force: true });
fs.mkdirSync(destino, { recursive: true });

const ITENS = ['index.html', 'exemplo.html', 'app', 'dados', 'vendor', 'LICENSE', 'README.md'];
for (const item of ITENS) {
  fs.cpSync(path.join(raiz, item), path.join(destino, item), {
    recursive: true,
    filter: (origem) => !origem.endsWith('.d.ts') // tipos são só para desenvolver
  });
}
// Site (GitHub Pages): Content-Security-Policy que proíbe a página de falar com qualquer servidor.
// Mesmo que um dia entre um bug ou um script malicioso, o navegador bloqueia o envio dos dados.
// (Só no site: por file:// a política 'self' não se comporta igual em todos os navegadores.)
const CSP = "default-src 'none'; script-src 'self' blob: 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self' blob: data:; " +
  "img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; font-src 'self'; frame-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'";
if (process.argv.includes('--site')) {
  for (const pagina of ['index.html', 'exemplo.html']) {
    const f = path.join(destino, pagina);
    const html = fs.readFileSync(f, 'utf8');
    fs.writeFileSync(f, html.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="${CSP}">\n<meta name="referrer" content="no-referrer">`));
  }
}
fs.writeFileSync(path.join(destino, 'LEIA-ME.txt'),
  `Raio-X da Fatura ${versao}\n\nAbra o arquivo index.html com um duplo clique (Chrome, Edge ou Firefox).\n` +
  `Quer ver antes? Abra exemplo.html (dados inventados).\nTudo funciona sem internet: nada sai do seu computador.\n`);
console.log(path.relative(raiz, destino));
