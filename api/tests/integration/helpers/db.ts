/**
 * Prisma client and seed helpers for integration tests. All operations target
 * the `antojo_test` database derived from the main DATABASE_URL.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { getTestDbUrl } from './globalSetup.js';

/** Prisma client targeting the integration test database. */
export const prismaTest = new PrismaClient({ datasourceUrl: getTestDbUrl() });

/**
 * Seeds the three test users required by integration tests and returns their IDs.
 * Uses upsert by email so the function is safe to call multiple times.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {{ adminId: number; panaderoId: number; cajeroId: number }} Seeded user IDs.
 */
export async function seedTestUsers(): Promise<{
  adminId: number;
  panaderoId: number;
  cajeroId: number;
}> {
  const hash = await bcrypt.hash('test1234', 4);

  const admin = await prismaTest.usuario.upsert({
    where: { email: 'test.admin@antojo.test' },
    update: {},
    create: { nombre: 'Test Admin', email: 'test.admin@antojo.test', passwordHash: hash, rol: 'ADMIN' },
  });

  const panadero = await prismaTest.usuario.upsert({
    where: { email: 'test.panadero@antojo.test' },
    update: {},
    create: { nombre: 'Test Panadero', email: 'test.panadero@antojo.test', passwordHash: hash, rol: 'MAESTRO_PANADERO' },
  });

  const cajero = await prismaTest.usuario.upsert({
    where: { email: 'test.cajero@antojo.test' },
    update: {},
    create: { nombre: 'Test Cajero', email: 'test.cajero@antojo.test', passwordHash: hash, rol: 'CAJERO' },
  });

  return { adminId: admin.id, panaderoId: panadero.id, cajeroId: cajero.id };
}

/**
 * Seeds a minimal product for use in task-related tests.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {Promise<number>} The seeded product's ID.
 */
export async function seedTestProducto(): Promise<number> {
  const producto = await prismaTest.producto.upsert({
    where: { sku: 'TEST-INT-01' },
    update: {},
    create: {
      sku: 'TEST-INT-01',
      nombre: 'Concha de prueba',
      descripcion: 'Producto para tests de integración',
      precio: 18,
      categoria: 'Test',
      stockDisponible: 50,
    },
  });
  return producto.id;
}

/**
 * Deletes all rows created during a test run, in FK-safe order.
 * Call from `afterAll` in each integration test file.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
export async function cleanupTestData(): Promise<void> {
  await prismaTest.recetaItem.deleteMany({ where: { producto: { sku: 'TEST-INT-01' } } });
  await prismaTest.tareaProduccion.deleteMany({ where: { producto: { sku: 'TEST-INT-01' } } });
  await prismaTest.listaCompra.deleteMany({ where: { creadoPor: { email: { endsWith: '@antojo.test' } } } });
  await prismaTest.insumo.deleteMany({ where: { nombre: { startsWith: '[TEST]' } } });
  await prismaTest.notificacion.deleteMany({ where: { usuario: { email: { endsWith: '@antojo.test' } } } });
  await prismaTest.producto.deleteMany({ where: { sku: 'TEST-INT-01' } });
  await prismaTest.usuario.deleteMany({ where: { email: { endsWith: '@antojo.test' } } });
}
