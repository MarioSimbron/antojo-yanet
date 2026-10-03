/**
 * Vitest configuration for LLM evaluations. These suites call the real Groq API, so
 * they are kept out of `npm test` (different file suffix: *.eval.ts) and run on demand
 * with `npm run eval`. Long timeouts absorb the free-tier rate-limit back-off.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { defineConfig } from 'vitest/config';
import 'dotenv/config';

export default defineConfig({
  test: {
    include: ['tests/eval/**/*.eval.ts'],
    globals: true,
    environment: 'node',
    testTimeout: 30 * 60 * 1000,
    hookTimeout: 5 * 60 * 1000,
  },
});
