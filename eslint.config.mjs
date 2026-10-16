import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['vendor/**', 'node_modules/**', 'dist/**', 'dados/exemplo.js', 'index.html', 'exemplo.html', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended,
  {
    // App: scripts clássicos do navegador que compartilham window.RaioX
    files: ['app/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser, d3: 'readonly', dash: 'readonly', pdfjsLib: 'readonly', Tesseract: 'readonly', RaioX: 'writable' }
    },
    rules: {
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-useless-escape': 'off' // muitas expressões regulares de texto de PDF; escapar a mais não faz mal
    }
  },
  {
    files: ['ferramentas/**/*.js', 'testes/**/*.js', '*.config.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: { ...globals.node } },
    rules: { 'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }] }
  },
  {
    files: ['testes/unit/**/*.test.js', 'testes/tela/**/*.js', '**/*.mjs'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.node } }
  },
  {
    // o navegador roda este código dentro de page.evaluate()
    files: ['testes/tela/**/*.js'],
    languageOptions: { globals: { ...globals.browser, RaioX: 'readonly' } }
  }
];
