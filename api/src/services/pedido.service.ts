/**
 * Order service: creation, status changes, cancellation workflow, ownership checks and
 * real-time event emission.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { PrismaClient, EstatusPedido, TipoEntrega, FormaPago, Prisma } from '@prisma/client';
import { GraphQLError } from 'graphql';
import { calcularTotales } from './calcular-totales.js';
import { puedeTransicionar } from './pedido-state-machine.js';
import { generarMenuMd } from '../lib/menu-generator.js';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

// Event emitter — wired to Socket.IO in phase F5
let emitirEventoFn: ((evento: string, room: string, data: unknown) => void) | null = null;

/**
 * Registers the function used to broadcast order events (injected by the Socket.IO
 * service to avoid a circular dependency).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {((evento: string, room: string, data: unknown) => void) | null} fn - Emitter function.
 * @returns {void}
 */
export function registrarEmitter(fn: typeof emitirEventoFn) {
  emitirEventoFn = fn;
}

/**
 * Emits an event to a room through the registered emitter; no-op if none is registered.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string} evento - Event name.
 * @param {string} room - Target room (e.g. `pedido:12`).
 * @param {unknown} data - Event payload.
 * @returns {void}
 */
function emitir(evento: string, room: string, data: unknown) {
  emitirEventoFn?.(evento, room, data);
}

/**
 * Loads an order with its items (and products), status history and invoice.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {number} id - Order ID.
 * @returns {Promise<Pedido | null>} The order with relations, or null if not found.
 */
function pedidoConRelaciones(id: number) {
  return prisma.pedido.findUnique({
    where: { id },
    include: { items: { include: { producto: true } }, historial: true, factura: true },
  });
}

/**
 * Shared ownership check (IDOR protection) reused by the `pedido` query, the assistant's
 * `consultar_pedido` tool and the WebSocket `join_pedido` event. Staff roles always pass.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {{ usuarioId: number | null; guestToken: string | null }} pedido - Order owner fields.
 * @param {{ usuarioId: number; rol: string }} [auth] - Authenticated user (JWT), if any.
 * @param {string} [guestToken] - Guest token, if any.
 * @returns {boolean} true if the caller may access the order.
 */
export function verificarOwnership(
  pedido: { usuarioId: number | null; guestToken: string | null },
  auth?: { usuarioId: number; rol: string },
  guestToken?: string,
): boolean {
  const rolesStaff = ['ADMIN', 'CAJERO', 'MAESTRO_PANADERO', 'REPARTIDOR'];
  if (auth && rolesStaff.includes(auth.rol)) return true;
  if (auth && pedido.usuarioId === auth.usuarioId) return true;
  if (guestToken && pedido.guestToken === guestToken) return true;
  return false;
}

/**
 * Creates an order for a guest or an authenticated user. Validates products, rejects
 * mixed stock/custom carts, enforces the 48h–30d window for custom orders, computes
 * totals and records the first status history entry.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {object} input - Order data (items, delivery type, address, payment method,
 *   estimated delivery date and customer contact data for guests).
 * @param {{ usuarioId: number; rol: string }} [auth] - Authenticated user, if any.
 * @param {string} [guestToken] - Guest token; a new one is generated if missing for guests.
 * @returns {Promise<Pedido>} The created order with items, history and invoice.
 * @throws {GraphQLError} PRODUCTO_INVALIDO, MEZCLA_NO_PERMITIDA, FECHA_INVALIDA,
 *   FECHA_REQUERIDA or DATOS_INCOMPLETOS.
 */
export async function crearPedido(
  input: {
    items: { productoId: number; cantidad: number; mensajePersonalizado?: string }[];
    tipoEntrega: string;
    direccion?: string;
    formaPago: string;
    fechaEntregaEstimada?: string;
    nombreCliente?: string;
    email?: string;
    telefono?: string;
    notasEncargo?: string;
    imagenRefUrl?: string;
  },
  auth?: { usuarioId: number; rol: string },
  guestToken?: string,
) {
  const productos = await prisma.producto.findMany({
    where: { id: { in: input.items.map((i) => i.productoId) }, activo: true },
  });

  if (productos.length !== input.items.length) {
    throw new GraphQLError('Uno o más productos no existen o están inactivos', {
      extensions: { code: 'PRODUCTO_INVALIDO' },
    });
  }

  const itemsConDatos = input.items.map((i) => {
    const prod = productos.find((p) => p.id === i.productoId)!;
    return {
      productoId: i.productoId,
      cantidad: i.cantidad,
      precioUnitario: Number(prod.precio),
      esEncargo: prod.requiereEncargo,
      mensajePersonalizado: i.mensajePersonalizado,
    };
  });

  const totales = calcularTotales(
    itemsConDatos.map((i) => ({
      cantidad: i.cantidad,
      precioUnitario: i.precioUnitario,
      esEncargo: i.esEncargo,
    })),
    input.tipoEntrega as TipoEntrega,
  );

  const tieneEncargo = itemsConDatos.some((i) => i.esEncargo);

  // Validate the 48h–30d window for custom orders
  if (tieneEncargo && input.fechaEntregaEstimada) {
    const fecha = new Date(input.fechaEntregaEstimada);
    const ahora = new Date();
    const diffMs = fecha.getTime() - ahora.getTime();
    const diffH = diffMs / 3_600_000;
    const diffD = diffMs / 86_400_000;
    if (diffH < 48 || diffD > 30) {
      throw new GraphQLError('La fecha de entrega debe ser entre 48h y 30 días desde ahora', {
        extensions: { code: 'FECHA_INVALIDA' },
      });
    }
  }

  if (tieneEncargo && !input.fechaEntregaEstimada) {
    throw new GraphQLError('Los pedidos de encargo requieren fecha de entrega estimada', {
      extensions: { code: 'FECHA_REQUERIDA' },
    });
  }

  let nombreCliente = input.nombreCliente;
  let email = input.email;
  let telefono = input.telefono;

  if (auth) {
    const usuario = await prisma.usuario.findUnique({ where: { id: auth.usuarioId } });
    nombreCliente = nombreCliente ?? usuario?.nombre ?? '';
    email = email ?? usuario?.email ?? '';
    telefono = telefono ?? usuario?.telefono ?? '';
  }

  if (!nombreCliente || !email || !telefono) {
    throw new GraphQLError('Nombre, email y teléfono son requeridos', {
      extensions: { code: 'DATOS_INCOMPLETOS' },
    });
  }

  const estatusInicial: EstatusPedido = tieneEncargo ? 'ESPERANDO_CONFIRMACION' : 'PENDIENTE';

  const pedido = await prisma.pedido.create({
    data: {
      usuarioId: auth?.usuarioId ?? null,
      guestToken: auth ? null : (guestToken ?? uuidv4()),
      nombreCliente,
      email,
      telefono,
      tipoEntrega: input.tipoEntrega as TipoEntrega,
      direccion: input.direccion,
      formaPago: input.formaPago as FormaPago,
      estatus: estatusInicial,
      subtotal: totales.subtotal,
      costoEnvio: totales.costoEnvio,
      total: totales.total,
      montoDeposito: totales.montoDeposito,
      porcentajeDeposito: totales.porcentajeDeposito,
      fechaEntregaEstimada: input.fechaEntregaEstimada
        ? new Date(input.fechaEntregaEstimada)
        : null,
      notasEncargo: input.notasEncargo ?? null,
      imagenRefUrl: input.imagenRefUrl ?? null,
      items: {
        create: itemsConDatos.map((i) => ({
          productoId: i.productoId,
          cantidad: i.cantidad,
          precioUnitario: i.precioUnitario,
          esEncargo: i.esEncargo,
          mensajePersonalizado: i.mensajePersonalizado,
        })),
      },
      historial: {
        create: [{ estatus: estatusInicial, actorId: auth?.usuarioId ?? null }],
      },
    },
    include: { items: { include: { producto: true } }, historial: true, factura: true },
  });

  return pedido;
}

/**
 * Roles allowed to move an order into each target status.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const rolesPermitidosPorTransicion: Partial<Record<EstatusPedido, string[]>> = {
  EN_PREPARACION: ['CAJERO', 'MAESTRO_PANADERO', 'ADMIN'],
  LISTO: ['MAESTRO_PANADERO', 'ADMIN'],
  EN_CAMINO: ['CAJERO', 'ADMIN', 'REPARTIDOR'],
  ENTREGADO: ['CAJERO', 'ADMIN', 'REPARTIDOR'],
  CANCELADO: ['ADMIN', 'CAJERO'],
};

/**
 * Changes an order's status after validating the state machine and the actor's role.
 * Records history, credits loyalty points on ENTREGADO and emits
 * `pedido:estado_actualizado` to the order's room.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {number} pedidoId - Order ID.
 * @param {EstatusPedido} nuevoEstatus - Target status.
 * @param {number} actorId - ID of the staff user performing the change.
 * @param {string} rol - Role of the actor.
 * @param {string} [nota] - Optional note stored in the history entry.
 * @returns {Promise<Pedido>} The updated order with relations.
 * @throws {GraphQLError} NOT_FOUND, TRANSICION_INVALIDA or FORBIDDEN.
 */
export async function actualizarEstatus(
  pedidoId: number,
  nuevoEstatus: EstatusPedido,
  actorId: number,
  rol: string,
  nota?: string,
) {
  const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId } });
  if (!pedido) {
    throw new GraphQLError('Pedido no encontrado', { extensions: { code: 'NOT_FOUND' } });
  }

  if (!puedeTransicionar(pedido.estatus, nuevoEstatus, { tipoEntrega: pedido.tipoEntrega })) {
    throw new GraphQLError('Transición de estatus no permitida', {
      extensions: { code: 'TRANSICION_INVALIDA' },
    });
  }

  const rolesPermitidos = rolesPermitidosPorTransicion[nuevoEstatus];
  if (rolesPermitidos && !rolesPermitidos.includes(rol)) {
    throw new GraphQLError('Tu rol no permite esta transición', {
      extensions: { code: 'FORBIDDEN' },
    });
  }

  const updated = await prisma.pedido.update({
    where: { id: pedidoId },
    data: {
      estatus: nuevoEstatus,
      historial: { create: [{ estatus: nuevoEstatus, actorId, nota }] },
    },
    include: { items: { include: { producto: true } }, historial: true, factura: true },
  });

  // Credit loyalty points when the order reaches ENTREGADO
  if (nuevoEstatus === 'ENTREGADO' && updated.usuarioId) {
    const puntosGanados = Math.floor(Number(updated.total) / 10);
    if (puntosGanados > 0) {
      await prisma.usuario.update({
        where: { id: updated.usuarioId },
        data: { puntosSaldo: { increment: puntosGanados } },
      });
    }
  }

  emitir('pedido:estado_actualizado', `pedido:${pedidoId}`, {
    pedidoId,
    estatusNuevo: nuevoEstatus,
    timestamp: new Date().toISOString(),
  });

  return updated;
}

/**
 * Customer cancellation request. A stock order still PENDIENTE is cancelled right away;
 * any other non-terminal order moves to SOLICITUD_CANCELACION for staff review.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {number} pedidoId - Order ID.
 * @param {string} motivo - Cancellation reason provided by the customer.
 * @param {{ usuarioId: number; rol: string }} [auth] - Authenticated user, if any.
 * @param {string} [guestToken] - Guest token, if any.
 * @returns {Promise<Pedido>} The updated order with relations.
 * @throws {GraphQLError} NOT_FOUND, FORBIDDEN or NO_CANCELABLE.
 */
export async function solicitarCancelacion(
  pedidoId: number,
  motivo: string,
  auth?: { usuarioId: number; rol: string },
  guestToken?: string,
) {
  const pedido = await pedidoConRelaciones(pedidoId);
  if (!pedido) {
    throw new GraphQLError('Pedido no encontrado', { extensions: { code: 'NOT_FOUND' } });
  }

  if (!verificarOwnership(pedido, auth, guestToken)) {
    throw new GraphQLError('No tienes acceso a este pedido', {
      extensions: { code: 'FORBIDDEN' },
    });
  }

  const terminales: EstatusPedido[] = ['ENTREGADO', 'CANCELADO'];
  if (terminales.includes(pedido.estatus)) {
    throw new GraphQLError('Este pedido no puede cancelarse', {
      extensions: { code: 'NO_CANCELABLE' },
    });
  }

  // Stock order in PENDIENTE → auto-approved
  const tieneEncargo = pedido.items.some((i) => i.esEncargo);
  const autoAprobar = pedido.estatus === 'PENDIENTE' && !tieneEncargo;
  const nuevoEstatus: EstatusPedido = autoAprobar ? 'CANCELADO' : 'SOLICITUD_CANCELACION';

  return prisma.pedido.update({
    where: { id: pedidoId },
    data: {
      estatus: nuevoEstatus,
      cancelacionMotivo: motivo,
      historial: {
        create: [{ estatus: nuevoEstatus, actorId: auth?.usuarioId ?? null, nota: motivo }],
      },
    },
    include: { items: { include: { producto: true } }, historial: true, factura: true },
  });
}

/**
 * Staff resolution of a pending cancellation request. APROBAR cancels the order and,
 * for custom orders more than 72h away, issues a 90-day coupon for the deposit amount.
 * RECHAZAR restores the last status recorded before the request.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {number} pedidoId - Order ID.
 * @param {'APROBAR' | 'RECHAZAR'} decision - Staff decision.
 * @param {number} actorId - ID of the staff user resolving the request.
 * @returns {Promise<Pedido>} The updated order with relations.
 * @throws {GraphQLError} ESTADO_INVALIDO if the order is missing or not in SOLICITUD_CANCELACION.
 */
export async function resolverCancelacion(
  pedidoId: number,
  decision: 'APROBAR' | 'RECHAZAR',
  actorId: number,
) {
  const pedido = await pedidoConRelaciones(pedidoId);
  if (!pedido || pedido.estatus !== 'SOLICITUD_CANCELACION') {
    throw new GraphQLError('Pedido no encontrado o no está en solicitud de cancelación', {
      extensions: { code: 'ESTADO_INVALIDO' },
    });
  }

  if (decision === 'APROBAR') {
    // Issue a coupon if it is a custom order and delivery is more than 72h away
    const tieneEncargo = pedido.items.some((i) => i.esEncargo);
    if (tieneEncargo && pedido.fechaEntregaEstimada) {
      const diffH =
        (pedido.fechaEntregaEstimada.getTime() - Date.now()) / 3_600_000;
      if (diffH > 72) {
        const codigo = `CUP-${uuidv4().slice(0, 8).toUpperCase()}`;
        await prisma.cupon.create({
          data: {
            codigo,
            usuarioId: pedido.usuarioId,
            montoOriginal: pedido.montoDeposito,
            saldoDisponible: pedido.montoDeposito,
            fechaExpiracion: new Date(Date.now() + 90 * 86_400_000),
          },
        });
      }
    }

    return prisma.pedido.update({
      where: { id: pedidoId },
      data: {
        estatus: 'CANCELADO',
        historial: { create: [{ estatus: 'CANCELADO', actorId }] },
      },
      include: { items: { include: { producto: true } }, historial: true, factura: true },
    });
  }

  // RECHAZAR — restore the status the order had before SOLICITUD_CANCELACION
  const historial = pedido.historial.sort((a, b) => a.id - b.id);
  const previo = [...historial]
    .reverse()
    .find((h) => h.estatus !== 'SOLICITUD_CANCELACION' && h.estatus !== 'CANCELADO');
  const estatusAnterior: EstatusPedido = previo?.estatus ?? 'PENDIENTE';

  return prisma.pedido.update({
    where: { id: pedidoId },
    data: {
      estatus: estatusAnterior,
      historial: { create: [{ estatus: estatusAnterior, actorId }] },
    },
    include: { items: { include: { producto: true } }, historial: true, factura: true },
  });
}
