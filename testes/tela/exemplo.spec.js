/* Página de exemplo (dados fictícios de dados/exemplo.js): todos os meses e as duas visões,
   em computador e celular; diálogos de nota, vínculo e edição. No exemplo nada é gravado. */
const { test } = require('@playwright/test');
const { url, vigiarErros, telaSaudavel, visao, expect } = require('./ajuda');

test.describe('exemplo', () => {
  let erros;
  test.beforeEach(async ({ page }) => {
    erros = vigiarErros(page);
    await page.goto(url('exemplo.html'));
    await expect(page.locator('#rx-controles select')).toBeVisible();
  });
  test.afterEach(() => expect(erros, 'erros de console').toEqual([]));

  test('cada mês, nas visões Faturas e Despesas', async ({ page }) => {
    const meses = await page.$$eval('#rx-controles option', o => o.map(x => x.value));
    expect(meses.length).toBeGreaterThan(1);
    for (const m of meses) {
      await page.selectOption('#rx-controles select', m);
      await telaSaudavel(page, `Faturas ${m}`);
      await visao(page, 'despesas');
      await expect(page.locator('#rx-visao-despesas')).toBeVisible();
      await expect(page.locator('#rx-visao-faturas')).toBeHidden();
      await telaSaudavel(page, `Despesas ${m}`);
      await visao(page, 'faturas');
    }
  });

  test('"Todos os meses" não mostra o gráfico dia a dia', async ({ page }) => {
    await page.selectOption('#rx-controles select', '*');
    await expect(page.locator('#rx-mes')).toContainText('Todos os meses');
    await expect(page.locator('#dia-a-dia')).toBeHidden();
  });

  test('indicador de nota na tabela abre a nota', async ({ page }) => {
    await page.selectOption('#rx-controles select', '*');
    const chip = page.locator('#tx .rx-nota-chip').first();
    await expect(chip).toBeVisible();
    await chip.click();
    await expect(page.locator('#dp-dlg-ver')).toBeVisible();
    await telaSaudavel(page, 'nota aberta');
    await page.click('#dp-dlg-ver [data-fechar]');
    await expect(page.locator('#dp-dlg-ver')).toBeHidden();
  });

  test('vincular nota a um lançamento pela busca', async ({ page }) => {
    await page.selectOption('#rx-controles select', '*');
    await visao(page, 'despesas');
    const ligadas = page.locator('#dp-notas .dp-vinc.on');
    const antes = await ligadas.count();
    await page.locator('#dp-notas .dp-vinc:not(.on) button').first().click();
    await expect(page.locator('#dp-dlg-vinc')).toBeVisible();
    await page.fill('#dp-vinc-q', 'a');
    await expect(page.locator('#dp-vinc-res .dp-cand').first()).toBeVisible();
    await telaSaudavel(page, 'vínculo aberto');
    await page.locator('#dp-vinc-res .dp-cand').first().click();
    await expect(page.locator('#dp-dlg-vinc')).toBeHidden();
    await expect(ligadas).toHaveCount(antes + 1);
  });

  test('corrigir, adicionar e remover nota', async ({ page }) => {
    await page.selectOption('#rx-controles select', '*');
    await visao(page, 'despesas');
    const notas = page.locator('#dp-notas > li.dp-nota');
    const n = await notas.count();
    // a nota sem total pede atenção; corrigir tira o aviso
    await page.locator('#dp-notas li.dp-nota.revisar .dp-nota-acoes .dp-btn').first().click();
    await expect(page.locator('#dp-dlg-edit')).toBeVisible();
    await page.fill('#dp-dlg-edit [name=loja]', 'Mercadinho Teste');
    await page.fill('#dp-dlg-edit [name=total]', '45,67');
    await page.click('#dp-edit-ok');
    await expect(page.locator('#dp-dlg-edit')).toBeHidden();
    await expect(page.locator('#dp-notas')).toContainText('Mercadinho Teste');
    await telaSaudavel(page, 'depois de editar');
    // despesa à mão: sem dados mostra o que falta; com dados, entra na lista
    await page.click('#dp-nova');
    await page.click('#dp-edit-ok');
    await expect(page.locator('#dp-edit-erro')).toBeVisible();
    await page.fill('#dp-dlg-edit [name=loja]', 'Feira Teste');
    await page.fill('#dp-dlg-edit [name=total]', '12,50');
    await page.fill('#dp-dlg-edit [name=data]', '2026-09-20');
    await page.click('#dp-edit-ok');
    await expect(notas).toHaveCount(n + 1);
    // remover pede confirmação na própria linha
    await notas.filter({ hasText: 'Feira Teste' }).locator('.dp-perigo').click();
    await page.click('#dp-notas .dp-perigo-on');
    await expect(notas).toHaveCount(n);
    await telaSaudavel(page, 'depois das ações');
  });

  test('dica "compras do mês anterior" leva ao mês da compra', async ({ page }) => {
    const meses = await page.$$eval('#rx-controles option', o => o.map(x => x.value).filter(v => v !== '*'));
    await page.selectOption('#rx-controles select', meses[meses.length - 2]);
    await visao(page, 'despesas');
    const antes = await page.innerText('#rx-mes');
    await page.click('#dp-dica button');
    await expect(page.locator('#rx-mes')).not.toHaveText(antes);
    await expect(page.locator('#rx-mes')).toContainText('compras de');
    await telaSaudavel(page, 'mês da compra pela dica');
  });
});
