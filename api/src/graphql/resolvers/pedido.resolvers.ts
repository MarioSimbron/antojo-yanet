/**
 * GraphQL resolvers for orders: lookups, staff listings, sales report and the order
 * lifecycle mutations.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { PrismaClient, EstatusPedido } from '@prisma/client';
import { GraphQLError } from 'graphql';
import { GraphQLContext } from '../../middleware/auth.js';
import { requireAuth, requireRole } from '../../lib/guards.js';
import {
  crearPedido,
  actualizarEstatus,
  solicitarCancelacion,
  resolverCancelacion,
  verificarOwnership,
} from '../../services/pedido.service.js';

const prisma = new PrismaClient();

/**
 * Prisma `include` clause that loads an order's items (with product), history and invoice.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {object} The include object.
 */
function incluirRelaciones() {
  return { items: { include: { producto: true } }, historial: true, factura: true };
}

/**
 * Resolver map for the order module.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
export const pedidoResolvers = {
  Query: {
    /**
     * Fetches an order only if the caller owns it (JWT or guest token) or is staff.
     * Returns null instead of an error so the order's existence is never leaked.
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {{ id: number; token?: string }} args - Order ID and optional guest token from the URL.
     * @param {GraphQLContext} ctx - Resolver context.
     * @returns {Promise<Pedido | null>} The order, or null if missing or not accessible.
     */
    pedido: async (
      _: unknown,
      { id, token }: { id: number; token?: string },
      ctx: GraphQLContext,
    ) => {
      const pedido = await prisma.pedido.findUnique({
        where: { id },
        include: incluirRelaciones(),
      });
      if (!pedido) return null;
      if (!verificarOwnership(pedido, ctx.usuario, token ?? ctx.guestToken)) return null;
      return pedido;
    },

    /**
     * Lists the authenticated user's orders, newest first.
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {unknown} __ - Arguments (none).
     * @param {GraphQLContext} ctx - Resolver context; requires a valid JWT.
     * @returns {Promise<Pedido[]>} The user's orders.
     */
    misPedidos: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const auth = requireAuth(ctx);
      return prisma.pedido.findMany({
        where: { usuarioId: auth.usuarioId },
        include: incluirRelaciones(),
        orderBy: { createdAt: 'desc' },
      });
    },

    /**
     * Staff order listing, optionally filtered by status. Delivery drivers only see
     * the orders assigned to them.
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {{ estatus?: string }} args - Optional status filter.
     * @param {GraphQLContext} ctx - Resolver context; requires a staff role.
     * @returns {Promise<Pedido[]>} Matching orders, newest first.
     */
    pedidos: async (
      _: unknown,
      { estatus }: { estatus?: string },
      ctx: GraphQLContext,
    ) => {
      const auth = requireRole(ctx, ['ADMIN', 'MAESTRO_PANADERO', 'CAJERO', 'REPARTIDOR']);
      const where: Record<string, unknown> = {};
      if (estatus) where.estatus = estatus as EstatusPedido;
      if (auth.rol === 'REPARTIDOR') where.repartidorId = auth.usuarioId;
      return prisma.pedido.findMany({
        where,
        include: incluirRelaciones(),
        orderBy: { createdAt: 'desc' },
      });
    },

    /**
     * Sales report over delivered orders (ADMIN only): total revenue, order count,
     * average ticket and the top 10 best-selling products.
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {{ desde?: string; hasta?: string }} args - Optional ISO date range.
     * @param {GraphQLContext} ctx - Resolver context; requires the ADMIN role.
     * @returns {Promise<ReporteVentas>} The aggregated report.
     */
    reporteVentas: async (
      _: unknown,
      { desde, hasta }: { desde?: string; hasta?: string },
      ctx: GraphQLContext,
    ) => {
      requireRole(ctx, ['ADMIN']);
      const where: Record<string, unknown> = { estatus: 'ENTREGADO' };
      if (desde || hasta) {
        where.createdAt = {
          ...(desde ? { gte: new Date(desde) } : {}),
          ...(hasta ? { lte: new Date(hasta) } : {}),
        };
      }

      const pedidos = await prisma.pedido.findMany({
        where,
        select: { total: true, items: { select: { productoId: true, cantidad: true, producto: { select: { nombre: true } } } } },
      });

      const totalIngresos = pedidos.reduce((acc, p) => acc + Number(p.total), 0);
      const totalPedidosCount = pedidos.length;
      const ticketPromedio = totalPedidosCount ? totalIngresos / totalPedidosCount : 0;

      const conteo: Record<number, { nombre: string; total: number }> = {};
      for (const p of pedidos) {
        for (const item of p.items) {
          if (!conteo[item.productoId]) {
            conteo[item.productoId] = { nombre: item.producto?.nombre ?? '', total: 0 };
          }
          conteo[item.productoId].total += item.cantidad;
        }
      }

      const topProductos = Object.entries(conteo)
        .map(([id, v]) => ({ productoId: Number(id), nombre: v.nombre, totalVendidos: v.total }))
        .sort((a, b) => b.totalVendidos - a.totalVendidos)
        .slice(0, 10);

      return {
        totalIngresos: totalIngresos.toFixed(2),
        totalPedidos: totalPedidosCount,
        ticketPromedio: ticketPromedio.toFixed(2),
        topProductos,
      };
    },
  },

  Mutation: {
    /**
     * Creates an order as a guest or authenticated user.
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {{ input: CrearPedidoInput }} args - Order data.
     * @param {GraphQLContext} ctx - Resolver context (user and/or guest token).
     * @returns {Promise<Pedido>} The created order.
     */
    crearPedido: async (
      _: unknown,
      { input }: { input: Parameters<typeof crearPedido>[0] },
      ctx: GraphQLContext,
    ) => {
      return crearPedido(input, ctx.usuario, ctx.guestToken);
    },

    /**
     * Changes an order's status (staff only), subject to the state machine and role matrix.
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {{ pedidoId: number; estatus: string; nota?: string }} args - Order, target status and note.
     * @param {GraphQLContext} ctx - Resolver context; requires a staff role.
     * @returns {Promise<Pedido>} The updated order.
     */
    actualizarEstatusPedido: async (
      _: unknown,
      { pedidoId, estatus, nota }: { pedidoId: number; estatus: string; nota?: string },
      ctx: GraphQLContext,
    ) => {
      const auth = requireRole(ctx, ['ADMIN', 'CAJERO', 'MAESTRO_PANADERO', 'REPARTIDOR']);
      return actualizarEstatus(
        pedidoId,
        estatus as EstatusPedido,
        auth.usuarioId,
        auth.rol,
        nota,
      );
    },

    /**
     * Customer request to cancel their own order.
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {{ pedidoId: number; motivo: string }} args - Order ID and cancellation reason.
     * @param {GraphQLContext} ctx - Resolver context (owner via JWT or guest token).
     * @returns {Promise<Pedido>} The order, now CANCELADO or SOLICITUD_CANCELACION.
     */
    solicitarCancelacion: async (
      _: unknown,
      { pedidoId, motivo }: { pedidoId: number; motivo: string },
      ctx: GraphQLContext,
    ) => {
      return solicitarCancelacion(pedidoId, motivo, ctx.usuario, ctx.guestToken);
    },

    /**
     * Staff approval or rejection of a pending cancellation request (ADMIN/CAJERO).
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {{ pedidoId: number; decision: string }} args - Order ID and APROBAR/RECHAZAR.
     * @param {GraphQLContext} ctx - Resolver context; requires ADMIN or CAJERO.
     * @returns {Promise<Pedido>} The updated order.
     */
    resolverCancelacion: async (
      _: unknown,
      { pedidoId, decision }: { pedidoId: number; decision: string },
      ctx: GraphQLContext,
    ) => {
      const auth = requireRole(ctx, ['ADMIN', 'CAJERO']);
      return resolverCancelacion(pedidoId, decision as 'APROBAR' | 'RECHAZAR', auth.usuarioId);
    },

    /**
     * Assigns a delivery driver to a LISTO home-delivery order (ADMIN/CAJERO).
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {{ pedidoId: number; repartidorId: number }} args - Order ID and driver user ID.
     * @param {GraphQLContext} ctx - Resolver context; requires ADMIN or CAJERO.
     * @returns {Promise<Pedido>} The updated order.
     * @throws {GraphQLError} ESTADO_INVALIDO if the order is not LISTO/DOMICILIO,
     *   ROL_INVALIDO if the user is not a REPARTIDOR.
     */
    asignarRepartidor: async (
      _: unknown,
      { pedidoId, repartidorId }: { pedidoId: number; repartidorId: number },
      ctx: GraphQLContext,
    ) => {
      requireRole(ctx, ['ADMIN', 'CAJERO']);
      const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId } });
      if (!pedido || pedido.estatus !== 'LISTO' || pedido.tipoEntrega !== 'DOMICILIO') {
        throw new GraphQLError('El pedido debe estar en LISTO y ser de tipo DOMICILIO', {
          extensions: { code: 'ESTADO_INVALIDO' },
        });
      }
      const repartidor = await prisma.usuario.findUnique({ where: { id: repartidorId } });
      if (!repartidor || repartidor.rol !== 'REPARTIDOR') {
        throw new GraphQLError('El usuario no es un repartidor válido', {
          extensions: { code: 'ROL_INVALIDO' },
        });
      }
      const updated = await prisma.pedido.update({
        where: { id: pedidoId },
        data: { repartidorId },
        include: incluirRelaciones(),
      });
      return updated;
    },

    /**
     * Updates the estimated delivery time in minutes. Only the assigned driver or an
     * ADMIN may do it.
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {{ pedidoId: number; minutos: number }} args - Order ID and minutes.
     * @param {GraphQLContext} ctx - Resolver context; requires a valid JWT.
     * @returns {Promise<Pedido>} The updated order.
     * @throws {GraphQLError} NOT_FOUND, SIN_REPARTIDOR or FORBIDDEN.
     */
    actualizarTiempoEstimado: async (
      _: unknown,
      { pedidoId, minutos }: { pedidoId: number; minutos: number },
      ctx: GraphQLContext,
    ) => {
      const auth = requireAuth(ctx);
      const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId } });
      if (!pedido) {
        throw new GraphQLError('Pedido no encontrado', { extensions: { code: 'NOT_FOUND' } });
      }
      if (!pedido.repartidorId) {
        throw new GraphQLError('El pedido no tiene repartidor asignado', {
          extensions: { code: 'SIN_REPARTIDOR' },
        });
      }
      if (auth.rol !== 'ADMIN' && pedido.repartidorId !== auth.usuarioId) {
        throw new GraphQLError('Solo el repartidor asignado puede actualizar el tiempo', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
      return prisma.pedido.update({
        where: { id: pedidoId },
        data: { tiempoEstimadoMinutos: minutos },
        include: incluirRelaciones(),
      });
    },

    /**
     * Redeems loyalty points on one of the user's open orders (every 100 points = $10 MXN),
     * deducting the points used and recalculating the order total.
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {{ pedidoId: number }} args - Order ID.
     * @param {GraphQLContext} ctx - Resolver context; requires a valid JWT.
     * @returns {Promise<Pedido>} The updated order with the discount applied.
     * @throws {GraphQLError} NOT_FOUND, ESTADO_INVALIDO or SALDO_INSUFICIENTE.
     */
    canjearPuntos: async (
      _: unknown,
      { pedidoId }: { pedidoId: number },
      ctx: GraphQLContext,
    ) => {
      const auth = requireAuth(ctx);
      const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId } });
      if (!pedido || pedido.usuarioId !== auth.usuarioId) {
        throw new GraphQLError('Pedido no encontrado', { extensions: { code: 'NOT_FOUND' } });
      }
      const terminales: EstatusPedido[] = ['ENTREGADO', 'CANCELADO'];
      if (terminales.includes(pedido.estatus)) {
        throw new GraphQLError('No se pueden canjear puntos en un pedido finalizado', {
          extensions: { code: 'ESTADO_INVALIDO' },
        });
      }
      const usuario = await prisma.usuario.findUnique({ where: { id: auth.usuarioId } });
      if (!usuario || usuario.puntosSaldo < 100) {
        throw new GraphQLError('Saldo de puntos insuficiente (mínimo 100)', {
          extensions: { code: 'SALDO_INSUFICIENTE' },
        });
      }
      const descuento = Math.floor(usuario.puntosSaldo / 100) * 10;
      const nuevoTotal = Math.max(0, Number(pedido.total) - descuento);
      await prisma.usuario.update({
        where: { id: auth.usuarioId },
        data: { puntosSaldo: { decrement: Math.floor(usuario.puntosSaldo / 100) * 100 } },
      });
      return prisma.pedido.update({
        where: { id: pedidoId },
        data: { descuentoPuntos: descuento, total: nuevoTotal },
        include: incluirRelaciones(),
      });
    },

    /**
     * Requests a CFDI invoice for an order the caller owns.
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {{ pedidoId: number; input: FacturaInput }} args - Order ID and tax data (RFC, business name, CFDI use).
     * @param {GraphQLContext} ctx - Resolver context (owner via JWT or guest token).
     * @returns {Promise<FacturaCFDI>} The created invoice record.
     * @throws {GraphQLError} NOT_FOUND or FORBIDDEN.
     */
    solicitarFactura: async (
      _: unknown,
      { pedidoId, input }: { pedidoId: number; input: { rfc: string; razonSocial: string; usoCFDI: string } },
      ctx: GraphQLContext,
    ) => {
      const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId } });
      if (!pedido) {
        throw new GraphQLError('Pedido no encontrado', { extensions: { code: 'NOT_FOUND' } });
      }
      if (!verificarOwnership(pedido, ctx.usuario, ctx.guestToken)) {
        throw new GraphQLError('No tienes acceso a este pedido', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
      return prisma.facturaCFDI.create({
        data: { pedidoId, rfc: input.rfc, razonSocial: input.razonSocial, usoCFDI: input.usoCFDI },
      });
    },
  },
};
