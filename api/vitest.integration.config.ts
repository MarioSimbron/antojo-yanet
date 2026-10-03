/**
 * Vitest configuration for integration tests. Targets the `antojo_test` database
 * derived from DATABASE_URL, runs schema setup in globalSetup, and uses a longer
 * timeout to accommodate real DB round-trips.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { defineConfig } from 'vitest/config';
import 'dotenv/config';

/** Derives the test database URL by replacing the DB name in DATABASE_URL. */
function getTestDbUrl(): string {
  const base = process.env.DATABASE_URL ?? 'postgresql://postgres:secret@localhost:5432/antojo';
  return base.replace(/\/([^/?]+)(\?|$)/, '/antojo_test$2');
}

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.integration.test.ts'],
    globals: true,
    environment: 'node',
    globalSetup: ['tests/integration/helpers/globalSetup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Override DATABASE_URL so every test file and its imports see the test DB
    env: {
      DATABASE_URL: getTestDbUrl(),
    },
    // Run integration test files sequentially to avoid cross-file state conflicts
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
