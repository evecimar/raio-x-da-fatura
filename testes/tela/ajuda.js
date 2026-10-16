/* Utilidades dos testes de tela. */
const path = require('node:path');
const fs = require('node:fs');
const { expect } = require('@playwright/test');

const RAIZ = path.resolve(__dirname, '../..');
const url = (arquivo) => 'file://' + path.join(RAIZ, arquivo).replace(/\\/g, '/');
const GERADO = path.join(RAIZ, 'testes/.gerado');
/** PDFs fictícios gerados por preparar.js + a NFC-e fictícia. */
const arquivosFicticios = () => [
  ...fs.readdirSync(GERADO).filter(f => f.endsWith('.pdf')).map(f => path.join(GERADO, f)),
  path.join(RAIZ, 'testes/casos/notas/nfce-ficticia.xml')
];

/** Junta erros de console e exceções da página; o teste falha no fim se houver algum. */
function vigiarErros(page) {
  const erros = [];
  page.on('pageerror', e => erros.push(e.message));
  page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  return erros;
}

/** A tela não pode mostrar NaN/undefined nem rolar para os lados. */
async function telaSaudavel(page, onde) {
  const txt = await page.innerText('#dash-root');
  expect(txt, `${onde}: texto sem NaN/undefined`).not.toMatch(/NaN|undefined|Invalid Date/);
  const { sw, w } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
  expect(sw, `${onde}: sem rolagem horizontal`).toBeLessThanOrEqual(w);
}

/** Lê arquivos pela tela inicial do index.html e espera o resumo. */
async function lerArquivos(page, arquivos) {
  await page.setInputFiles('#rx-arquivos-input', arquivos);
  await expect(page.locator('#rx-resumo')).toBeVisible({ timeout: 60_000 });
}

const visao = (page, v) => page.click(`#rx-visoes [data-visao=${v}]`);

module.exports = { url, arquivosFicticios, vigiarErros, telaSaudavel, lerArquivos, visao, expect };
