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
      // Thresholds apply only to the modules that have unit/integration tests.
      // Integration tests for resolvers and services are in later phases (F12+).
      thresholds: {
        'src/lib/jwt.ts': { lines: 70, functions: 70, branches: 70 },
        'src/lib/rag.ts': { lines: 70, functions: 70, branches: 70 },
        'src/lib/chat-history.ts': { lines: 70, functions: 70, branches: 70 },
        'src/lib/groq.ts': { lines: 70, functions: 70, branches: 70 },
        'src/services/calcular-totales.ts': { lines: 70, functions: 70, branches: 70 },
        'src/services/pedido-state-machine.ts': { lines: 70, functions: 70, branches: 70 },
      },
      include: ['src/**/*.ts'],
    },
  },
});
