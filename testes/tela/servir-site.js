/* Monta o site como no GitHub Pages (empacotar.js --site, com a CSP) e serve por HTTP para os testes de tela.
   Uso pelo Playwright (webServer em playwright.config.js). */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const raiz = path.resolve(__dirname, '../..');
const versao = require(path.join(raiz, 'package.json')).version;
const pasta = path.join(raiz, execFileSync(process.execPath, [path.join(raiz, 'ferramentas/empacotar.js'), versao, '--site'], { cwd: raiz, encoding: 'utf8' }).trim());
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8' };
const porta = Number(process.env.PORTA_SITE || 4173);

http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
  const arq = path.join(pasta, rel);
  if (!arq.startsWith(pasta) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq)] || 'application/octet-stream' });
  fs.createReadStream(arq).pipe(res);
}).listen(porta, () => console.log(`site em http://localhost:${porta}/`));
