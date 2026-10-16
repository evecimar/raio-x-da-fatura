// Testes de tela: abrem index.html / exemplo.html direto do disco (file://), como a pessoa usa.
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'testes/tela',
  globalSetup: require.resolve('./testes/tela/preparar.js'),
  timeout: 90_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Chromium já instalado em outro lugar (ex.: CHROMIUM=/caminho/chrome)
    launchOptions: process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}
  },
  // O site do GitHub Pages (com a CSP), servido por HTTP para testes/tela/site.spec.js
  webServer: {
    command: 'node testes/tela/servir-site.js',
    url: `http://localhost:${process.env.PORTA_SITE || 4173}/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  },
  projects: [
    { name: 'computador', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    // armazenamento não depende da largura da tela: roda só no computador
    { name: 'celular', testIgnore: /armazenamento|site/, use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 900 }, hasTouch: true } },
    // celular pequeno: pega estouro de largura que fontes diferentes (Windows, Linux, Android) podem causar
    { name: 'celular-pequeno', testIgnore: /armazenamento|leitura|site|reais/, use: { ...devices['Desktop Chrome'], viewport: { width: 340, height: 800 }, hasTouch: true } }
  ]
});
