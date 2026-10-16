/* Opcional: lê as SUAS faturas e notas de verdade pelo index.html (elas ficam no seu computador, fora do git).
   Sem a pasta faturas/ (ou RX_FATURAS), é pulado. Nada de trace, captura ou vídeo aqui:
   eles gravariam suas faturas em test-results/. */
const { test } = require('@playwright/test');
const { url, vigiarErros, telaSaudavel, visao, expect } = require('./ajuda');
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

const fs = require('node:fs');
const path = require('node:path');
const pastaReal = process.env.RX_FATURAS || path.join(__dirname, '../../faturas');
const reais = fs.existsSync(pastaReal) ? fs.readdirSync(pastaReal).filter(f => /\.(pdf|xml|jpe?g|png|webp)$/i.test(f)).map(f => path.join(pastaReal, f)) : [];

test('suas faturas reais (pasta faturas/ ou RX_FATURAS)', async ({ page }) => {
  test.skip(!reais.length, 'sem pasta faturas/');
  test.setTimeout(240_000);
  const erros = vigiarErros(page);
  await page.goto(url('index.html'));
  await page.setInputFiles('#rx-arquivos-input', reais);
  await expect(page.locator('#rx-resumo')).toBeVisible({ timeout: 200_000 });
  // nota de foto pede conferência (aviso) e tudo bem; fatura com aviso = soma não bateu
  const ruins = (await page.locator('.rx-arq:not(.ok)').allInnerTexts()).filter(t => !/\nNota ·/.test(t));
  expect(ruins, 'arquivos com problema').toEqual([]);
  await page.click('#rx-abrir-painel');
  const meses = await page.$$eval('#rx-controles option', o => o.map(x => x.value));
  for (const m of meses) {
    await page.selectOption('#rx-controles select', m);
    await telaSaudavel(page, `Faturas ${m}`);
    await visao(page, 'despesas');
    await telaSaudavel(page, `Despesas ${m}`);
    await visao(page, 'faturas');
  }
  expect(erros).toEqual([]);
});
