/**
 * Integration tests for the purchase-list workflow (Feature C).
 * Covers US-LC1 (create request), US-LC2 (admin processes), US-LC3 (admin marks as filled),
 * and the visibility rule: non-admin users only see their own items.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { executeAs } from './helpers/gql.js';
import { seedTestUsers, cleanupTestData } from './helpers/db.js';

// ── GraphQL operations ─────────────────────────────────────────────────────────

const CREAR_ITEM = `
  mutation CrearItemCompra($input: CrearItemCompraInput!) {
    crearItemCompra(input: $input) { id nombre estatus prioridad }
  }
`;

const ACTUALIZAR_ITEM = `
  mutation ActualizarItemCompra($id: Int!, $estatus: String!) {
    actualizarItemCompra(id: $id, estatus: $estatus) { id estatus }
  }
`;

const LISTA_COMPRAS = `
  query ListaCompras {
    listaCompras { id nombre estatus creadoPorId }
  }
`;

// ── Test state ─────────────────────────────────────────────────────────────────

let adminId: number;
let panaderoId: number;
let cajeroId: number;

beforeAll(async () => {
  const users = await seedTestUsers();
  adminId = users.adminId;
  panaderoId = users.panaderoId;
  cajeroId = users.cajeroId;
});

afterAll(async () => {
  await cleanupTestData();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Feature C — Lista de compras', () => {
  it('US-LC1: panadero creates purchase request → estatus PENDIENTE', async () => {
    const res = await executeAs('MAESTRO_PANADERO', panaderoId, CREAR_ITEM, {
      input: { nombre: 'Harina de trigo', cantidad: 10, unidad: 'kg', prioridad: 'ALTA' },
    });
    const result = (res.body as { singleResult: { data: { crearItemCompra: { estatus: string; prioridad: string } } } }).singleResult;
    expect(result.data.crearItemCompra.estatus).toBe('PENDIENTE');
    expect(result.data.crearItemCompra.prioridad).toBe('ALTA');
  });

  it('cajero can also create purchase requests', async () => {
    const res = await executeAs('CAJERO', cajeroId, CREAR_ITEM, {
      input: { nombre: 'Azúcar', cantidad: 5, unidad: 'kg' },
    });
    const result = (res.body as { singleResult: { data: { crearItemCompra: { id: number } } } }).singleResult;
    expect(result.data.crearItemCompra.id).toBeGreaterThan(0);
  });

  it('admin sees all purchase requests', async () => {
    const res = await executeAs('ADMIN', adminId, LISTA_COMPRAS);
    const items = (res.body as { singleResult: { data: { listaCompras: { id: number }[] } } })
      .singleResult.data.listaCompras;
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  it('panadero only sees their own requests', async () => {
    // Create a request as panadero and one as cajero
    await executeAs('MAESTRO_PANADERO', panaderoId, CREAR_ITEM, {
      input: { nombre: 'Mantequilla', cantidad: 2, unidad: 'kg' },
    });

    const res = await executeAs('MAESTRO_PANADERO', panaderoId, LISTA_COMPRAS);
    const items = (res.body as { singleResult: { data: { listaCompras: { creadoPorId: number }[] } } })
      .singleResult.data.listaCompras;

    // Every returned item must belong to the panadero
    expect(items.every((i) => i.creadoPorId === panaderoId)).toBe(true);
  });

  it('US-LC2 + US-LC3: admin advances item PENDIENTE → EN_PROCESO → SURTIDO', async () => {
    // Create a request to advance
    const createRes = await executeAs('MAESTRO_PANADERO', panaderoId, CREAR_ITEM, {
      input: { nombre: 'Sal', cantidad: 1, unidad: 'kg' },
    });
    const itemId = (createRes.body as { singleResult: { data: { crearItemCompra: { id: number } } } })
      .singleResult.data.crearItemCompra.id;

    // Admin marks EN_PROCESO
    const enProcesoRes = await executeAs('ADMIN', adminId, ACTUALIZAR_ITEM, {
      id: itemId,
      estatus: 'EN_PROCESO',
    });
    expect(
      (enProcesoRes.body as { singleResult: { data: { actualizarItemCompra: { estatus: string } } } })
        .singleResult.data.actualizarItemCompra.estatus
    ).toBe('EN_PROCESO');

    // Admin marks SURTIDO
    const surtidoRes = await executeAs('ADMIN', adminId, ACTUALIZAR_ITEM, {
      id: itemId,
      estatus: 'SURTIDO',
    });
    expect(
      (surtidoRes.body as { singleResult: { data: { actualizarItemCompra: { estatus: string } } } })
        .singleResult.data.actualizarItemCompra.estatus
    ).toBe('SURTIDO');
  });

  it('non-admin cannot update item status → FORBIDDEN', async () => {
    const createRes = await executeAs('MAESTRO_PANADERO', panaderoId, CREAR_ITEM, {
      input: { nombre: 'Levadura', cantidad: 0.5, unidad: 'kg' },
    });
    const itemId = (createRes.body as { singleResult: { data: { crearItemCompra: { id: number } } } })
      .singleResult.data.crearItemCompra.id;

    const res = await executeAs('MAESTRO_PANADERO', panaderoId, ACTUALIZAR_ITEM, {
      id: itemId,
      estatus: 'EN_PROCESO',
    });
    const body = res.body as { singleResult: { errors?: { extensions: { code: string } }[] } };
    expect(body.singleResult.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });
});
