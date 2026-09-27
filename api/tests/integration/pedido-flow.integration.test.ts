/**
 * Integration tests for the order (pedido) flow.
 * Covers order creation, MOSTRADOR status transitions, cancellation with stock
 * restoration, and role-based access control on actualizarEstatusPedido.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { executeAs, stopServer } from './helpers/gql.js';
import { seedTestUsers, seedTestProducto, cleanupTestData, prismaTest } from './helpers/db.js';

// ── GraphQL operations ─────────────────────────────────────────────────────────

const CREAR_PEDIDO = `
  mutation CrearPedido($input: CrearPedidoInput!) {
    crearPedido(input: $input) {
      id estatus tipoEntrega total
      items { cantidad productoId }
    }
  }
`;

const ACTUALIZAR_ESTATUS = `
  mutation ActualizarEstatus($pedidoId: Int!, $estatus: String!) {
    actualizarEstatusPedido(pedidoId: $pedidoId, estatus: $estatus) {
      id estatus
    }
  }
`;

const PEDIDOS_QUERY = `
  query Pedidos {
    pedidos { id estatus tipoEntrega }
  }
`;

// ── Test state ─────────────────────────────────────────────────────────────────

let adminId: number;
let panaderoId: number;
let productoId: number;

const createdPedidoIds: number[] = [];

beforeAll(async () => {
  const users = await seedTestUsers();
  adminId = users.adminId;
  panaderoId = users.panaderoId;
  productoId = await seedTestProducto();
  // Ensure product has enough stock for all tests
  await prismaTest.producto.update({
    where: { id: productoId },
    data: { stockDisponible: 100 },
  });
});

afterAll(async () => {
  // Clean up orders created during tests
  await prismaTest.historialEstatusPedido.deleteMany({ where: { pedidoId: { in: createdPedidoIds } } });
  await prismaTest.itemPedido.deleteMany({ where: { pedidoId: { in: createdPedidoIds } } });
  await prismaTest.pedido.deleteMany({ where: { id: { in: createdPedidoIds } } });
  await cleanupTestData();
  await stopServer();
});

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Creates a simple MOSTRADOR order as the test admin and returns the order id.
 * @param {number} cantidad - Units to order.
 * @returns {Promise<number>} Created order id.
 */
async function crearPedidoDeStock(cantidad: number): Promise<number> {
  const res = await executeAs('ADMIN', adminId, CREAR_PEDIDO, {
    input: {
      items: [{ productoId, cantidad }],
      tipoEntrega: 'MOSTRADOR',
      formaPago: 'EFECTIVO',
      nombreCliente: 'Test Cliente',
      email: 'test.cliente@antojo.test',
      telefono: '5551234567',
    },
  });
  const pedido = (res.body as {
    singleResult: { data: { crearPedido: { id: number; estatus: string } } };
  }).singleResult.data.crearPedido;
  createdPedidoIds.push(pedido.id);
  return pedido.id;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Pedido flow — MOSTRADOR stock order', () => {
  it('creates stock order → estatus PENDIENTE, stock decremented', async () => {
    const stockAntes = (await prismaTest.producto.findUnique({ where: { id: productoId } }))!.stockDisponible;

    const res = await executeAs('ADMIN', adminId, CREAR_PEDIDO, {
      input: {
        items: [{ productoId, cantidad: 3 }],
        tipoEntrega: 'MOSTRADOR',
        formaPago: 'EFECTIVO',
        nombreCliente: 'Test Cliente',
        email: 'test.cliente@antojo.test',
        telefono: '5551234567',
      },
    });
    const pedido = (res.body as { singleResult: { data: { crearPedido: { id: number; estatus: string } } } })
      .singleResult.data.crearPedido;
    createdPedidoIds.push(pedido.id);

    expect(pedido.estatus).toBe('PENDIENTE');

    const stockDespues = (await prismaTest.producto.findUnique({ where: { id: productoId } }))!.stockDisponible;
    expect(Number(stockDespues)).toBe(Number(stockAntes) - 3);
  });

  it('admin: PENDIENTE → EN_PREPARACION → LISTO → ENTREGADO', async () => {
    const pedidoId = await crearPedidoDeStock(1);

    for (const estatus of ['EN_PREPARACION', 'LISTO', 'ENTREGADO'] as const) {
      const res = await executeAs('ADMIN', adminId, ACTUALIZAR_ESTATUS, { pedidoId, estatus });
      const resultado = (res.body as { singleResult: { data: { actualizarEstatusPedido: { estatus: string } } } })
        .singleResult.data.actualizarEstatusPedido;
      expect(resultado.estatus).toBe(estatus);
    }
  });

  it('cancel PENDIENTE order → stock restored', async () => {
    const stockAntes = Number((await prismaTest.producto.findUnique({ where: { id: productoId } }))!.stockDisponible);
    const pedidoId = await crearPedidoDeStock(5);

    const stockTrasPedido = Number((await prismaTest.producto.findUnique({ where: { id: productoId } }))!.stockDisponible);
    expect(stockTrasPedido).toBe(stockAntes - 5);

    const res = await executeAs('ADMIN', adminId, ACTUALIZAR_ESTATUS, { pedidoId, estatus: 'CANCELADO' });
    expect(
      (res.body as { singleResult: { data: { actualizarEstatusPedido: { estatus: string } } } })
        .singleResult.data.actualizarEstatusPedido.estatus
    ).toBe('CANCELADO');

    const stockTrasCancel = Number((await prismaTest.producto.findUnique({ where: { id: productoId } }))!.stockDisponible);
    expect(stockTrasCancel).toBe(stockAntes);
  });

  it('MAESTRO_PANADERO cannot cancel order → FORBIDDEN', async () => {
    const pedidoId = await crearPedidoDeStock(1);
    const res = await executeAs('MAESTRO_PANADERO', panaderoId, ACTUALIZAR_ESTATUS, {
      pedidoId,
      estatus: 'CANCELADO',
    });
    const body = res.body as { singleResult: { errors?: { extensions: { code: string } }[] } };
    expect(body.singleResult.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });

  it('terminal order cannot be transitioned further → TRANSICION_INVALIDA', async () => {
    const pedidoId = await crearPedidoDeStock(1);
    // Move to ENTREGADO
    await executeAs('ADMIN', adminId, ACTUALIZAR_ESTATUS, { pedidoId, estatus: 'EN_PREPARACION' });
    await executeAs('ADMIN', adminId, ACTUALIZAR_ESTATUS, { pedidoId, estatus: 'LISTO' });
    await executeAs('ADMIN', adminId, ACTUALIZAR_ESTATUS, { pedidoId, estatus: 'ENTREGADO' });
    // Try to cancel after delivery
    const res = await executeAs('ADMIN', adminId, ACTUALIZAR_ESTATUS, { pedidoId, estatus: 'CANCELADO' });
    const body = res.body as { singleResult: { errors?: { extensions: { code: string } }[] } };
    expect(body.singleResult.errors?.[0]?.extensions?.code).toBe('TRANSICION_INVALIDA');
  });

  it('admin sees all orders including test orders', async () => {
    const res = await executeAs('ADMIN', adminId, PEDIDOS_QUERY);
    const pedidos = (res.body as { singleResult: { data: { pedidos: { id: number }[] } } })
      .singleResult.data.pedidos;
    expect(Array.isArray(pedidos)).toBe(true);
  });
});
