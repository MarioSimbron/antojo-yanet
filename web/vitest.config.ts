/**
 * Vitest config for the frontend: jsdom environment, global test APIs, the jest-dom
 * setup file and V8 coverage over src/.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
    },
  },
});
