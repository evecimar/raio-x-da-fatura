/* Antes dos testes de tela, gera em testes/.gerado/ (fora do git):
   - um PDF fictício por banco (a partir de testes/casos/faturas/<banco>.js; variações de layout ficam só nos testes de lógica);
   - uma "foto" fictícia de cupom (o texto de testes/casos/notas/cupom.txt desenhado numa imagem), para o OCR. */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('@playwright/test');
const { gerarPdf } = require('../casos/gerar-pdf.js');

module.exports = async (config) => {
  const saida = path.join(__dirname, '../.gerado');
  fs.mkdirSync(saida, { recursive: true });
  const pasta = path.join(__dirname, '../casos/faturas');
  // Um PDF por banco: só o caso principal (<banco>.js). Variações de layout (<banco>-<variação>.js) ficam nos testes de lógica.
  for (const f of fs.readdirSync(pasta).filter(f => /^[a-z0-9]+\.js$/.test(f))) {
    const caso = require(path.join(pasta, f));
    fs.writeFileSync(path.join(saida, caso.arquivo), await gerarPdf(caso));
  }
  const cupom = fs.readFileSync(path.join(__dirname, '../casos/notas/cupom.txt'), 'utf8').trim().split('\n');
  const esc = (s) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const opcoes = (config && config.projects && config.projects[0] && config.projects[0].use && config.projects[0].use.launchOptions) || {};
  const navegador = await chromium.launch(opcoes);
  const pagina = await navegador.newPage({ viewport: { width: 900, height: 120 + cupom.length * 60 } });
  await pagina.setContent(`<body style="margin:0;padding:30px 40px;background:#f4f4f0;font:34px/60px monospace;color:#111">${cupom.map(l => `<div>${esc(l)}</div>`).join('')}</body>`);
  await pagina.screenshot({ path: path.join(saida, 'cupom-ficticio.png') });
  await navegador.close();
};
