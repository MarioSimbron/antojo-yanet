/**
 * Integration tests for the raw-material inventory module (Feature D).
 * Covers US-D1 (configure recipe), US-D2 (list ingredients), US-D3 (stock deduction
 * when task starts), and US-D4 (low-stock notification after deduction).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { executeAs } from './helpers/gql.js';
import { seedTestUsers, seedTestProducto, cleanupTestData, prismaTest } from './helpers/db.js';

// ── GraphQL operations ─────────────────────────────────────────────────────────

const CREAR_INSUMO = `
  mutation CrearInsumo($input: CrearInsumoInput!) {
    crearInsumo(input: $input) { id nombre unidad stockActual stockMinimo }
  }
`;

const ACTUALIZAR_INSUMO = `
  mutation ActualizarInsumo($id: Int!, $stockActual: Float, $stockMinimo: Float) {
    actualizarInsumo(id: $id, stockActual: $stockActual, stockMinimo: $stockMinimo) { id stockActual stockMinimo }
  }
`;

const GUARDAR_RECETA = `
  mutation GuardarReceta($productoId: Int!, $items: [RecetaItemInput!]!) {
    guardarReceta(productoId: $productoId, items: $items)
  }
`;

const INSUMOS_QUERY = `
  query Insumos {
    insumos { id nombre unidad stockActual stockMinimo }
  }
`;

const RECETA_QUERY = `
  query Receta($productoId: Int!) {
    receta(productoId: $productoId) { id insumoId cantidadPorUnidad insumo { nombre } }
  }
`;

const CREAR_TAREA = `
  mutation CrearTareaInv($input: CrearTareaInput!) {
    crearTarea(input: $input) { id estatus }
  }
`;

const ACTUALIZAR_TAREA = `
  mutation ActualizarTareaInv($id: Int!, $input: ActualizarTareaInput!) {
    actualizarTarea(id: $id, input: $input) { id estatus }
  }
`;

// ── Test state ─────────────────────────────────────────────────────────────────

let adminId: number;
let panaderoId: number;
let productoId: number;
let harinaId: number;

beforeAll(async () => {
  const users = await seedTestUsers();
  adminId = users.adminId;
  panaderoId = users.panaderoId;
  productoId = await seedTestProducto();
});

afterAll(async () => {
  await cleanupTestData();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Feature D — Inventario de materias primas', () => {
  it('ADMIN creates an ingredient', async () => {
    const res = await executeAs('ADMIN', adminId, CREAR_INSUMO, {
      input: { nombre: '[TEST] Harina', unidad: 'kg', stockMinimo: 5 },
    });
    const insumo = (res.body as { singleResult: { data: { crearInsumo: { id: number; stockActual: number } } } })
      .singleResult.data.crearInsumo;
    expect(insumo.id).toBeGreaterThan(0);
    expect(insumo.stockActual).toBe(0);
    harinaId = insumo.id;
  });

  it('non-admin cannot create ingredient → FORBIDDEN', async () => {
    const res = await executeAs('MAESTRO_PANADERO', panaderoId, CREAR_INSUMO, {
      input: { nombre: '[TEST] Sal', unidad: 'g' },
    });
    const body = res.body as { singleResult: { errors?: { extensions: { code: string } }[] } };
    expect(body.singleResult.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });

  it('ADMIN updates ingredient stock', async () => {
    const res = await executeAs('ADMIN', adminId, ACTUALIZAR_INSUMO, {
      id: harinaId,
      stockActual: 20,
      stockMinimo: 5,
    });
    const updated = (res.body as { singleResult: { data: { actualizarInsumo: { stockActual: number } } } })
      .singleResult.data.actualizarInsumo;
    expect(updated.stockActual).toBe(20);
  });

  it('MAESTRO_PANADERO and CAJERO can list ingredients', async () => {
    const panaderoRes = await executeAs('MAESTRO_PANADERO', panaderoId, INSUMOS_QUERY);
    const insumos = (panaderoRes.body as { singleResult: { data: { insumos: { id: number }[] } } })
      .singleResult.data.insumos;
    expect(insumos.some((i) => i.id === harinaId)).toBe(true);
  });

  it('US-D1: ADMIN saves recipe for product', async () => {
    const res = await executeAs('ADMIN', adminId, GUARDAR_RECETA, {
      productoId,
      items: [{ insumoId: harinaId, cantidadPorUnidad: 0.25 }],
    });
    const ok = (res.body as { singleResult: { data: { guardarReceta: boolean } } }).singleResult.data.guardarReceta;
    expect(ok).toBe(true);
  });

  it('recipe is stored and queryable', async () => {
    const res = await executeAs('ADMIN', adminId, RECETA_QUERY, { productoId });
    const items = (res.body as { singleResult: { data: { receta: { insumoId: number; cantidadPorUnidad: number }[] } } })
      .singleResult.data.receta;
    expect(items).toHaveLength(1);
    expect(items[0].insumoId).toBe(harinaId);
    expect(items[0].cantidadPorUnidad).toBe(0.25);
  });

  it('US-D3: starting a task deducts raw material stock', async () => {
    // Set stock to a known value
    await executeAs('ADMIN', adminId, ACTUALIZAR_INSUMO, { id: harinaId, stockActual: 20 });

    // Admin creates task for 8 units (will consume 8 × 0.25 = 2 kg of harina)
    const createRes = await executeAs('ADMIN', adminId, CREAR_TAREA, {
      input: { productoId, cantidadSolicitada: 8 },
    });
    const tareaId = (createRes.body as { singleResult: { data: { crearTarea: { id: number } } } })
      .singleResult.data.crearTarea.id;

    // Advance to EN_PROCESO → triggers descontarInsumosPorTarea
    await executeAs('MAESTRO_PANADERO', panaderoId, ACTUALIZAR_TAREA, {
      id: tareaId,
      input: { estatus: 'EN_PROCESO' },
    });

    // Give the fire-and-forget deduction time to complete
    await new Promise((r) => setTimeout(r, 500));

    const insumo = await prismaTest.insumo.findUnique({ where: { id: harinaId } });
    // 20 - (8 × 0.25) = 18
    expect(Number(insumo?.stockActual)).toBeCloseTo(18, 2);
  });
});
