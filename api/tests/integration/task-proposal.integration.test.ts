/**
 * Integration tests for the task-proposal workflow (Feature B).
 * Covers US-B1 (panadero proposes), US-B2 (admin approves), US-B3 (admin rejects)
 * and the FORBIDDEN guard when a panadero tries to resolve their own proposal.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { executeAs, stopServer } from './helpers/gql.js';
import { seedTestUsers, seedTestProducto, cleanupTestData } from './helpers/db.js';

// ── GraphQL operations ─────────────────────────────────────────────────────────

const CREAR_TAREA = `
  mutation CrearTarea($input: CrearTareaInput!) {
    crearTarea(input: $input) { id estatus cantidadSolicitada }
  }
`;

const ACTUALIZAR_TAREA = `
  mutation ActualizarTarea($id: Int!, $input: ActualizarTareaInput!) {
    actualizarTarea(id: $id, input: $input) { id estatus }
  }
`;

const MIS_TAREAS = `
  query MisTareas {
    misTareas { id estatus producto { nombre } }
  }
`;

// ── Test state ─────────────────────────────────────────────────────────────────

let adminId: number;
let panaderoId: number;
let productoId: number;

beforeAll(async () => {
  const users = await seedTestUsers();
  adminId = users.adminId;
  panaderoId = users.panaderoId;
  productoId = await seedTestProducto();
});

afterAll(async () => {
  await cleanupTestData();
  await stopServer();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Feature B — Task proposal workflow', () => {
  it('US-B1: panadero creates task → estatus PROPUESTA', async () => {
    const res = await executeAs('MAESTRO_PANADERO', panaderoId, CREAR_TAREA, {
      input: { productoId, cantidadSolicitada: 10 },
    });
    const result = (res.body as { singleResult: { data: { crearTarea: { estatus: string } } } }).singleResult;
    expect(result.data.crearTarea.estatus).toBe('PROPUESTA');
  });

  it('admin creates task → estatus PENDIENTE (unchanged behavior)', async () => {
    const res = await executeAs('ADMIN', adminId, CREAR_TAREA, {
      input: { productoId, cantidadSolicitada: 5, notas: 'Tarea directa' },
    });
    const result = (res.body as { singleResult: { data: { crearTarea: { estatus: string } } } }).singleResult;
    expect(result.data.crearTarea.estatus).toBe('PENDIENTE');
  });

  it('US-B2: admin approves proposal → estatus PENDIENTE', async () => {
    // Create a fresh proposal
    const createRes = await executeAs('MAESTRO_PANADERO', panaderoId, CREAR_TAREA, {
      input: { productoId, cantidadSolicitada: 8 },
    });
    const tareaId = (createRes.body as { singleResult: { data: { crearTarea: { id: number } } } })
      .singleResult.data.crearTarea.id;

    const approveRes = await executeAs('ADMIN', adminId, ACTUALIZAR_TAREA, {
      id: tareaId,
      input: { estatus: 'PENDIENTE' },
    });
    const result = (approveRes.body as { singleResult: { data: { actualizarTarea: { estatus: string } } } }).singleResult;
    expect(result.data.actualizarTarea.estatus).toBe('PENDIENTE');
  });

  it('US-B3: admin rejects proposal → estatus RECHAZADA', async () => {
    const createRes = await executeAs('MAESTRO_PANADERO', panaderoId, CREAR_TAREA, {
      input: { productoId, cantidadSolicitada: 3 },
    });
    const tareaId = (createRes.body as { singleResult: { data: { crearTarea: { id: number } } } })
      .singleResult.data.crearTarea.id;

    const rejectRes = await executeAs('ADMIN', adminId, ACTUALIZAR_TAREA, {
      id: tareaId,
      input: { estatus: 'RECHAZADA' },
    });
    const result = (rejectRes.body as { singleResult: { data: { actualizarTarea: { estatus: string } } } }).singleResult;
    expect(result.data.actualizarTarea.estatus).toBe('RECHAZADA');
  });

  it('panadero cannot approve own proposal → FORBIDDEN error', async () => {
    const createRes = await executeAs('MAESTRO_PANADERO', panaderoId, CREAR_TAREA, {
      input: { productoId, cantidadSolicitada: 2 },
    });
    const tareaId = (createRes.body as { singleResult: { data: { crearTarea: { id: number } } } })
      .singleResult.data.crearTarea.id;

    const res = await executeAs('MAESTRO_PANADERO', panaderoId, ACTUALIZAR_TAREA, {
      id: tareaId,
      input: { estatus: 'PENDIENTE' },
    });
    const body = res.body as { singleResult: { errors?: { extensions: { code: string } }[] } };
    expect(body.singleResult.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });

  it('misTareas returns admin tasks (PENDIENTE/EN_PROCESO) + own proposals for panadero', async () => {
    const res = await executeAs('MAESTRO_PANADERO', panaderoId, MIS_TAREAS);
    const tasks = (res.body as { singleResult: { data: { misTareas: { id: number }[] } } })
      .singleResult.data.misTareas;
    expect(Array.isArray(tasks)).toBe(true);
    // Should see at least the admin-created PENDIENTE task and the panadero's own proposals
    expect(tasks.length).toBeGreaterThan(0);
  });

  it('unauthenticated request → UNAUTHENTICATED error', async () => {
    const res = await executeAs(null, null, MIS_TAREAS);
    const body = res.body as { singleResult: { errors?: { extensions: { code: string } }[] } };
    expect(body.singleResult.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });
});
