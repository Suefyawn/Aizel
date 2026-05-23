import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Vitest config for unit + integration tests. Phase 6.8.
// Co-locate tests as *.test.ts(x) next to source, or under tests/unit.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'tests/unit/**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', '.next/**', 'tests/e2e/**'],
    setupFiles: ['tests/setup.ts'],
  },
});
