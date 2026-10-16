import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['testes/unit/**/*.test.js'], environment: 'node' }
});
