/* Armazenamento no navegador: migração da versão antiga (localStorage), gravar e reabrir, arquivos originais,
   backup de ida e volta, "Apagar tudo" e o plano B sem IndexedDB. Só dados fictícios. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('@playwright/test');
const { url, arquivosFicticios, vigiarErros, lerArquivos, expect } = require('./ajuda');

test.describe.configure({ mode: 'serial' });

const contar = (page) => page.evaluate(async () => ({
  f: RaioX.estado().faturas.length, l: RaioX.estado().lancamentos.length, n: RaioX.estado().notas.length,
  o: (await RaioX.armazem.listarOriginais()).length
}));

test('migra os dados da versão antiga (localStorage) sem perder "Já paguei"', async ({ page }) => {
  const erros = vigiarErros(page);
  await page.goto(url('index.html'));
  await page.evaluate(() => localStorage.setItem('raio-x-da-fatura:v1', JSON.stringify({ versao: 2,
    faturas: [{ mes: '2026-10', banco: 'Banco Teste', total: '10.00', vencimento: '2026-10-15', paga: 'sim' }],
    lancamentos: [{ id: 't1', mes: '2026-10', banco: 'Banco Teste', data: '2026-09-20', descricao: 'Teste', valor: '10.00', tipo: 'compra' }], notas: [] })));
  await page.reload();
  await expect.poll(() => page.evaluate(() => RaioX.estado().faturas.length)).toBe(1);
  expect(await page.evaluate(() => RaioX.armazem.modo())).toBe('indexeddb');
  expect(await page.evaluate(() => RaioX.estado().faturas[0].paga)).toBe('sim');
  expect(await page.evaluate(() => localStorage.getItem('raio-x-da-fatura:v1'))).toBeNull();
  expect(erros).toEqual([]);
});

test('reabre igual, faz backup, apaga tudo e restaura', async ({ page }) => {
  const erros = vigiarErros(page);
  await page.goto(url('index.html'));
  await lerArquivos(page, arquivosFicticios());
  await page.click('#rx-abrir-painel');
  const antes = await contar(page);
  expect(antes).toMatchObject({ f: 3, n: 1, o: 4 });

  await page.evaluate(() => RaioX.armazem.esperar());
  await page.reload();
  await expect.poll(() => contar(page)).toEqual(antes);

  await page.getByRole('button', { name: 'Dados e backup' }).click();
  const [baixado] = await Promise.all([page.waitForEvent('download'), page.click('#rx-dados-backup')]);
  const arq = path.join(os.tmpdir(), `rx-backup-${Date.now()}.json`);
  await baixado.saveAs(arq);
  const bk = JSON.parse(fs.readFileSync(arq, 'utf8'));
  expect(bk).toMatchObject({ app: 'raio-x-da-fatura' });
  expect(bk.faturas).toHaveLength(antes.f);
  expect(bk.originais).toHaveLength(antes.o);

  await page.click('#rx-dados-limpar');
  await page.click('#rx-dados-limpar'); // confirma
  await expect(page.locator('#rx-dados')).toBeHidden(); // terminou de apagar
  await page.reload();
  await expect.poll(() => contar(page)).toEqual({ f: 0, l: 0, n: 0, o: 0 });

  await page.setInputFiles('#rx-backup-input', arq);
  await expect.poll(() => contar(page), { timeout: 15_000 }).toEqual(antes);
  await page.reload();
  await expect.poll(() => contar(page)).toEqual(antes);
  fs.unlinkSync(arq);
  expect(erros).toEqual([]);
});

test('sem IndexedDB, usa localStorage e reabre', async ({ browser }) => {
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { value: undefined }); });
  const page = await ctx.newPage();
  const erros = vigiarErros(page);
  await page.goto(url('index.html'));
  await lerArquivos(page, arquivosFicticios().filter(a => a.endsWith('.pdf')).slice(0, 1));
  await page.click('#rx-abrir-painel');
  await page.evaluate(() => RaioX.armazem.esperar());
  await page.reload();
  await expect.poll(() => page.evaluate(() => RaioX.armazem.modo() === 'localstorage' && RaioX.temDados())).toBe(true);
  expect(erros).toEqual([]);
  await ctx.close();
});

test('backup adulterado não consegue rodar script pelo "ver original" nem quebrar o app', async ({ page, context }) => {
  const erros = vigiarErros(page);
  await page.goto(url('index.html'));
  const html = Buffer.from('<script>window.opener && (window.opener.document.title = "INVADIDO"); document.title = "INVADIDO"</script>').toString('base64');
  const backup = {
    app: 'raio-x-da-fatura', formato: 1,
    faturas: [{ mes: '2026-10', banco: 'Banco Teste', total: '10.00', vencimento: '2026-10-15', arquivo_id: 'orig-x' }, null, 'lixo'],
    lancamentos: [{ id: 't1', mes: '2026-10', banco: 'Banco Teste', data: '2026-09-20', descricao: 'Teste', valor: '10.00', tipo: 'compra' }],
    notas: [null, { id: 'n1', loja: 'Loja', data: '2026-09-20', total: 5, forma: 'pix', itens: 'não é lista', avisos: 'nem isto', arquivo_id: 'orig-y' }],
    originais: [
      { id: 'orig-x', nome: 'fatura.pdf', tipo: 'text/html', base64: html },
      { id: 'orig-y', nome: 'pagina.html', tipo: 'text/html', base64: html },
      { id: { truque: 1 }, base64: html }
    ]
  };
  await page.setInputFiles('#rx-backup-input', { name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await expect.poll(() => page.evaluate(() => RaioX.estado().faturas.length)).toBe(1);
  expect(await page.evaluate(() => RaioX.estado().notas.map(n => [Array.isArray(n.itens), Array.isArray(n.avisos)]))).toEqual([[true, true]]);
  await page.evaluate(() => RaioX.armazem.esperar());
  // o tipo guardado foi corrigido: "fatura.pdf" vira PDF, "pagina.html" vira download
  expect(await page.evaluate(async () => (await RaioX.armazem.listarOriginais()).map(o => [o.id, o.tipo]).sort())).toEqual([['orig-x', 'application/pdf'], ['orig-y', 'application/octet-stream']]);
  const [baixado] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => RaioX.abrirOriginal('orig-y'))]);
  expect(baixado.suggestedFilename()).toBe('pagina.html');
  const abas = [];
  context.on('page', p => abas.push(p));
  await page.evaluate(() => RaioX.abrirOriginal('orig-x'));
  await page.waitForTimeout(800);
  for (const a of abas) {
    await a.waitForLoadState().catch(() => {});
    // o script do "original" não roda: a aba nova não muda de título e não tem acesso à aba do app
    expect(await a.title().catch(() => '')).not.toBe('INVADIDO');
    expect(await a.evaluate(() => window.opener === null).catch(() => true)).toBe(true);
  }
  expect(await page.title()).not.toBe('INVADIDO');
  await page.reload();
  await expect(page.locator('body')).toBeVisible();
  expect(erros).toEqual([]);
});
