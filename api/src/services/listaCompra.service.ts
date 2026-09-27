/**
 * Purchase-list service: staff members add raw-material purchase requests; admin
 * tracks and fulfills them. When an item is marked SURTIDO, the linked ingredient's
 * stock is automatically incremented (Feature C + Feature D / US-D5).
 * Real-time updates are broadcast via Socket.IO using the registered emitter so all
 * connected staff see changes instantly without polling.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { PrismaClient, EstatusCompra, PrioridadCompra } from '@prisma/client';
import { GraphQLError } from 'graphql';
import { notificarRol, notificarUsuario } from '../lib/push.js';
import { reponerInsumo } from './inventario.service.js';

/** Emitter registered by socket.service.ts to broadcast list changes. */
let emitirFn: ((evento: string, room: string, data: unknown) => void) | null = null;

/**
 * Registers the Socket.IO emitter so the service can broadcast real-time events.
 * Called once during server startup from socket.service.ts.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {(evento: string, room: string, data: unknown) => void} fn - Emitter function.
 */
export function registrarListaCompraEmitter(
  fn: (evento: string, room: string, data: unknown) => void,
) {
  emitirFn = fn;
}

/** Broadcasts `listaCompra:actualizada` to all staff roles. */
function emitirActualizada() {
  for (const rol of ['ADMIN', 'MAESTRO_PANADERO', 'CAJERO']) {
    emitirFn?.('listaCompra:actualizada', `rol:${rol}`, {});
  }
}

const prisma = new PrismaClient();

/**
 * Returns purchase-list items. Admins see everything; maestro panaderos and cajeros
 * only see their own submissions. Optionally filtered by status.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {{ usuarioId: number; rol: string }} auth - Caller identity.
 * @param {string} [estatus] - Optional status filter.
 * @returns {Promise<ListaCompra[]>} Matching items with creator data.
 */
export async function listarCompras(
  auth: { usuarioId: number; rol: string },
  estatus?: string,
) {
  const esAdmin = auth.rol === 'ADMIN';
  return prisma.listaCompra.findMany({
    where: {
      ...(esAdmin ? {} : { creadoPorId: auth.usuarioId }),
      ...(estatus ? { estatus: estatus as EstatusCompra } : {}),
    },
    include: { creadoPor: true, insumo: true },
    orderBy: [{ prioridad: 'asc' }, { createdAt: 'desc' }],
  });
}

/**
 * Creates a purchase-list item and notifies the admin (US-LC1).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {{ nombre: string; cantidad: number; unidad: string; prioridad?: string; notas?: string; insumoId?: number }} input - Item data.
 * @param {{ usuarioId: number; rol: string }} auth - Caller identity.
 * @returns {Promise<ListaCompra>} The created item.
 */
export async function crearItemCompra(
  input: {
    nombre: string;
    cantidad: number;
    unidad: string;
    prioridad?: string;
    notas?: string;
    insumoId?: number;
  },
  auth: { usuarioId: number; rol: string },
) {
  const item = await prisma.listaCompra.create({
    data: {
      nombre: input.nombre,
      cantidad: input.cantidad,
      unidad: input.unidad,
      prioridad: (input.prioridad as PrioridadCompra) ?? 'MEDIA',
      notas: input.notas ?? null,
      insumoId: input.insumoId ?? null,
      creadoPorId: auth.usuarioId,
    },
    include: { creadoPor: true, insumo: true },
  });

  void notificarRol('ADMIN', {
    titulo: `🛒 Nueva solicitud de compra`,
    cuerpo: `${item.creadoPor.nombre} solicitó "${item.nombre}" (${item.cantidad} ${item.unidad}).`,
    url: '/dashboard/compras',
  });

  emitirActualizada();
  return item;
}

/**
 * Updates a purchase-list item's status (ADMIN only). When moved to SURTIDO with a
 * linked ingredient, the ingredient's stock is automatically incremented (US-D5).
 * Notifies the creator on EN_PROCESO (US-LC2) and SURTIDO (US-LC3).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {number} id - Item ID.
 * @param {string} estatus - New status ('EN_PROCESO' | 'SURTIDO').
 * @returns {Promise<ListaCompra>} The updated item.
 * @throws {GraphQLError} NOT_FOUND if the item does not exist, or ESTADO_INVALIDO if already SURTIDO.
 */
export async function actualizarItemCompra(id: number, estatus: string) {
  const item = await prisma.listaCompra.findUnique({
    where: { id },
    include: { creadoPor: true, insumo: true },
  });
  if (!item) {
    throw new GraphQLError('Ítem no encontrado', { extensions: { code: 'NOT_FOUND' } });
  }
  if (item.estatus === 'SURTIDO') {
    throw new GraphQLError('Este ítem ya fue surtido', { extensions: { code: 'ESTADO_INVALIDO' } });
  }

  const updated = await prisma.listaCompra.update({
    where: { id },
    data: { estatus: estatus as EstatusCompra },
    include: { creadoPor: true, insumo: true },
  });

  if (estatus === 'EN_PROCESO') {
    // US-LC2: notify the creator
    void notificarUsuario(item.creadoPorId, {
      titulo: `🛒 El admin está gestionando tu solicitud`,
      cuerpo: `Tu solicitud de "${item.nombre}" está siendo procesada.`,
      url: '/dashboard/compras',
    });
  }

  if (estatus === 'SURTIDO') {
    // US-LC3: notify the creator
    void notificarUsuario(item.creadoPorId, {
      titulo: `✅ "${item.nombre}" ya fue surtido`,
      cuerpo: `Se recibieron ${item.cantidad} ${item.unidad} de ${item.nombre}.`,
      url: '/dashboard/compras',
    });
    // US-D5: automatically restock the linked ingredient if present
    if (item.insumoId) {
      await reponerInsumo(item.insumoId, Number(item.cantidad));
    }
  }

  emitirActualizada();
  return updated;
}
