#!/usr/bin/env node
/* Monta index.html e exemplo.html a partir das partes em app/ e ferramentas/.
   Uso: npm run montar
   Os leitores de app/leitores/ entram sozinhos (em ordem alfabética, depois do comum.js).
   Sempre grava com quebra de linha \n, para o arquivo sair igual no Windows, Mac e Linux. */
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = (f) => fs.readFileSync(path.join(raiz, f), 'utf8').replace(/\r\n/g, '\n');
const existe = (f) => fs.existsSync(path.join(raiz, f));

const inicio = ler('ferramentas/inicio.html');
const painel = ler('app/painel.html');
const despesas = existe('app/despesas.html') ? ler('app/despesas.html') : '';
const LEITORES = ['app/pdf-texto.js', 'app/leitores/comum.js', 'app/categorias.js',
  ...fs.readdirSync(path.join(raiz, 'app/leitores')).filter(f => f.endsWith('.js') && f !== 'comum.js').sort().map(f => 'app/leitores/' + f)];

function pagina(exemplo) {
  let scripts = ['vendor/d3.min.js'];
  scripts = scripts.concat(exemplo ? ['dados/exemplo.js'] : ['vendor/pdf.min.js', 'vendor/pdf.worker.min.js', ...LEITORES, 'app/notas-leitura.js']);
  scripts.push('app/armazenamento.js', 'app/motor.js', 'app/notas.js', 'app/painel.js');
  if (existe('app/despesas.js')) scripts.push('app/despesas-calculo.js', 'app/despesas.js');
  scripts.push('app/inicio.js');
  const tags = scripts.map(s => `<script src="${s}"></script>`).join('\n');
  const titulo = exemplo ? 'Raio-X da Fatura · exemplo' : 'Raio-X da Fatura';
  const cssDesp = existe('app/despesas.css') ? '\n<link rel="stylesheet" href="app/despesas.css">' : '';
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo}</title>
<meta name="description" content="Raio-X da Fatura: leia as faturas de cartão da sua pasta e veja quanto pagar, o que pagar primeiro e onde cortar. Open source e 100% offline.">
<link rel="stylesheet" href="app/tema.css">
<link rel="stylesheet" href="app/estilo.css">
<link rel="stylesheet" href="app/inicio.css">${cssDesp}
</head>
<body>
${exemplo ? '' : inicio}
<div id="dash-root" hidden>
${painel}
${despesas}
</div>
${tags}
</body>
</html>
`;
}

fs.writeFileSync(path.join(raiz, 'index.html'), pagina(false));
fs.writeFileSync(path.join(raiz, 'exemplo.html'), pagina(true));
console.log('index.html e exemplo.html montados.');
