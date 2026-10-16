/* index.html de verdade: lê os PDFs fictícios gerados (um por banco) e uma NFC-e fictícia,
   como a pessoa faria escolhendo a pasta, e confere o painel e a visão Despesas. */
const { test } = require('@playwright/test');
const { url, arquivosFicticios, vigiarErros, telaSaudavel, lerArquivos, visao, expect } = require('./ajuda');

test('lê as faturas e a nota da pasta e mostra o painel', async ({ page }) => {
  const erros = vigiarErros(page);
  await page.goto(url('index.html'));
  await lerArquivos(page, arquivosFicticios());

  // cada arquivo lido com sucesso; faturas com soma conferida
  const arquivos = page.locator('.rx-arq');
  await expect(arquivos).toHaveCount(4);
  await expect(page.locator('.rx-arq:not(.ok)')).toHaveCount(0);
  const lidos = (await arquivos.allInnerTexts()).join(' | ');
  for (const banco of ['Nubank', 'PicPay', 'Caixa']) expect(lidos).toContain(banco);
  await expect(page.locator('#rx-resumo')).toContainText('3 faturas e 1 nota');

  await page.click('#rx-abrir-painel');
  await expect(page.locator('#dash-root')).toBeVisible();
  const total = await page.evaluate(() => RaioX.estado().faturas.reduce((t, f) => t + Number(f.total), 0));
  expect(total).toBeCloseTo(559.85 + 386.15 + 749.88, 2);
  await telaSaudavel(page, 'painel');

  await visao(page, 'despesas');
  await expect(page.locator('#rx-visao-despesas')).toBeVisible();
  await telaSaudavel(page, 'despesas');
  await page.selectOption('#rx-controles select', '*');
  await expect(page.locator('#dp-notas')).toContainText('Supermercado Bom Preco');
  await telaSaudavel(page, 'despesas, todos os meses');

  expect(erros).toEqual([]);
});

test('nenhum pedido de rede: as faturas nunca saem do computador (vale também para o site no GitHub Pages)', async ({ page }) => {
  const fora = [];
  page.on('request', r => { if (!/^(file|blob|data):/.test(r.url())) fora.push(r.url()); });
  await page.goto(url('index.html'));
  await lerArquivos(page, arquivosFicticios());
  await page.click('#rx-abrir-painel');
  await visao(page, 'despesas');
  await page.goto(url('exemplo.html'));
  await expect(page.locator('#rx-controles select')).toBeVisible();
  expect(fora, 'pedidos para fora do computador').toEqual([]);
});

test('arquivo que não é fatura nem nota aparece com o motivo, sem quebrar', async ({ page }) => {
  const erros = vigiarErros(page);
  await page.goto(url('index.html'));
  await lerArquivos(page, [{ name: 'lista.xml', mimeType: 'application/xml', buffer: Buffer.from('<?xml version="1.0"?><lista><item>pão</item></lista>') }]);
  await expect(page.locator('.rx-arq').first()).not.toHaveClass(/\bok\b/);
  expect(erros).toEqual([]);
});
