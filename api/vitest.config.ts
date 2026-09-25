/**
 * Vitest config for the API: Node environment, global test APIs and V8 coverage with
 * a 70% minimum threshold on lines, functions and branches.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
      },
      include: ['src/**/*.ts'],
    },
  },
});
