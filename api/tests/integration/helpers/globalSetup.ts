/**
 * Vitest global setup for integration tests: derives a `antojo_test` database URL
 * from the main DATABASE_URL, pushes the Prisma schema to it, and seeds the three
 * test users (admin, panadero, cajero) needed by all integration test files.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '../../..');

/**
 * Derives the integration-test database URL by replacing the DB name in
 * DATABASE_URL with `antojo_test`. Falls back to a local default.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {string} MySQL connection URL pointing to the test database.
 */
export function getTestDbUrl(): string {
  const base = process.env.DATABASE_URL ?? 'mysql://root:@localhost:3306/antojo';
  return base.replace(/\/([^/?]+)(\?|$)/, '/antojo_test$2');
}

/**
 * Creates the antojo_test database and pushes the current Prisma schema to it.
 * Runs once before all integration test files.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
export async function setup(): Promise<void> {
  const testUrl = getTestDbUrl();
  console.log('\n[integration] Setting up test DB:', testUrl.replace(/:[^:@]+@/, ':***@'));

  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    env: { ...process.env, DATABASE_URL: testUrl },
    cwd: apiRoot,
    stdio: 'pipe',
  });

  console.log('[integration] Schema pushed to antojo_test ✓');
}

/**
 * Drops all test-created data after the suite finishes.
 * Tables are truncated in reverse FK order to avoid constraint errors.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
export async function teardown(): Promise<void> {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({ datasourceUrl: getTestDbUrl() });
  try {
    // Order matters: FK children before parents
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
    await prisma.$executeRawUnsafe('TRUNCATE TABLE receta_item');
    await prisma.$executeRawUnsafe('TRUNCATE TABLE lista_compra');
    await prisma.$executeRawUnsafe('TRUNCATE TABLE tarea_produccion');
    await prisma.$executeRawUnsafe('TRUNCATE TABLE insumo');
    await prisma.$executeRawUnsafe('TRUNCATE TABLE notificacion');
    await prisma.$executeRawUnsafe('TRUNCATE TABLE usuario');
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
    console.log('[integration] Test DB cleaned up ✓');
  } finally {
    await prisma.$disconnect();
  }
}
