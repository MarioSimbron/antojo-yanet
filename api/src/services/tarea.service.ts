/**
 * Production-task service: creation, status transitions, stock replenishment,
 * and the maestro-panadero task-proposal workflow (Feature B).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { PrismaClient, EstatusTarea } from '@prisma/client';
import { GraphQLError } from 'graphql';
import { notificarRol, notificarUsuario } from '../lib/push.js';
import { puedeTransicionarTarea } from './tarea-state-machine.js';

const prisma = new PrismaClient();

/** Include clause for tasks with their product relation. */
const CON_PRODUCTO = { include: { producto: true } } as const;

/**
 * Returns all production tasks ordered by creation date descending.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {Promise<TareaProduccion[]>} All tasks with product data.
 */
export async function listarTareas() {
  return prisma.tareaProduccion.findMany({
    ...CON_PRODUCTO,
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Returns the task queue visible to the maestro panadero: active tasks plus any
 * proposals they submitted that are awaiting admin approval or have been resolved.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {number} usuarioId - ID of the calling maestro panadero.
 * @returns {Promise<TareaProduccion[]>} Relevant tasks newest first.
 */
export async function listarMisTareas(usuarioId?: number) {
  return prisma.tareaProduccion.findMany({
    where: {
      estatus: { in: ['PROPUESTA', 'PENDIENTE', 'EN_PROCESO', 'RECHAZADA'] },
      ...(usuarioId ? { asignadoPorId: usuarioId } : {}),
    },
    ...CON_PRODUCTO,
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Creates a production task. When called by an admin the task starts as PENDIENTE
 * and all maestro panaderos are notified. When called by a maestro panadero the task
 * starts as PROPUESTA and only the admin is notified to review it (Feature B / US-B1).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {{ productoId: number; cantidadSolicitada: number; notas?: string }} input - Task data.
 * @param {number} creadorId - ID of the user creating the task.
 * @param {string} callerRol - Role of the caller ('ADMIN' | 'MAESTRO_PANADERO').
 * @returns {Promise<TareaProduccion>} The created task with product data.
 * @throws {GraphQLError} NOT_FOUND if the product does not exist.
 */
export async function crearTarea(
  input: { productoId: number; cantidadSolicitada: number; notas?: string },
  creadorId: number,
  callerRol: string,
) {
  const producto = await prisma.producto.findUnique({ where: { id: input.productoId } });
  if (!producto) {
    throw new GraphQLError('Producto no encontrado', { extensions: { code: 'NOT_FOUND' } });
  }

  const esPanadero = callerRol === 'MAESTRO_PANADERO';
  const estatus: EstatusTarea = esPanadero ? 'PROPUESTA' : 'PENDIENTE';

  const tarea = await prisma.tareaProduccion.create({
    data: {
      productoId: input.productoId,
      cantidadSolicitada: input.cantidadSolicitada,
      notas: input.notas ?? null,
      asignadoPorId: creadorId,
      estatus,
    },
    ...CON_PRODUCTO,
  });

  if (esPanadero) {
    // US-B1: Notify admin of the proposal
    void notificarRol('ADMIN', {
      titulo: '📋 Propuesta de tarea del panadero',
      cuerpo: `El maestro panadero propone producir ${input.cantidadSolicitada} piezas de ${producto.nombre}.`,
      url: '/dashboard/tareas',
      data: { tareaId: tarea.id },
    });
  } else {
    // Existing flow: notify all maestro panaderos of the new admin-created task
    void notificarRol('MAESTRO_PANADERO', {
      titulo: '🍞 Nueva tarea de producción',
      cuerpo: `Producir ${input.cantidadSolicitada} piezas de ${producto.nombre}`,
      url: '/dashboard/mis-tareas',
      data: { tareaId: tarea.id },
    });
  }

  return tarea;
}

/**
 * Updates a task's status, enforcing the proposal workflow for maestro panadero.
 * - PROPUESTA → PENDIENTE: admin approval; notifies the proposing panadero (US-B2).
 * - PROPUESTA → RECHAZADA: admin rejection; notifies the proposing panadero (US-B3).
 * - Any → EN_PROCESO: raw-material stock is deducted automatically (Feature D).
 * - Any → COMPLETADA: product stock is incremented; admin is notified.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {number} id - Task ID.
 * @param {{ estatus: EstatusTarea; cantidadProducida?: number }} input - New status and optional quantity.
 * @param {string} callerRol - Role of the caller.
 * @returns {Promise<TareaProduccion>} The updated task with product data.
 * @throws {GraphQLError} NOT_FOUND, TAREA_FINALIZADA or FORBIDDEN.
 */
export async function actualizarTarea(
  id: number,
  input: { estatus: EstatusTarea; cantidadProducida?: number },
  callerRol: string,
) {
  const tarea = await prisma.tareaProduccion.findUnique({ where: { id }, include: { producto: true } });
  if (!tarea) {
    throw new GraphQLError('Tarea no encontrada', { extensions: { code: 'NOT_FOUND' } });
  }

  if (!puedeTransicionarTarea(tarea.estatus, input.estatus, callerRol)) {
    const terminales: EstatusTarea[] = ['COMPLETADA', 'CANCELADA', 'RECHAZADA'];
    if (terminales.includes(tarea.estatus)) {
      throw new GraphQLError('La tarea ya está finalizada', { extensions: { code: 'TAREA_FINALIZADA' } });
    }
    if (tarea.estatus === 'PROPUESTA') {
      throw new GraphQLError('Solo el administrador puede aprobar o rechazar propuestas', {
        extensions: { code: 'FORBIDDEN' },
      });
    }
    throw new GraphQLError('Transición de estatus no permitida', { extensions: { code: 'INVALID_TRANSITION' } });
  }

  const producida = input.cantidadProducida ?? tarea.cantidadSolicitada;

  const updated = await prisma.$transaction(async (tx) => {
    if (input.estatus === 'COMPLETADA') {
      await tx.producto.update({
        where: { id: tarea.productoId },
        data: { stockDisponible: { increment: producida } },
      });
    }
    return tx.tareaProduccion.update({
      where: { id },
      data: {
        estatus: input.estatus,
        cantidadProducida: input.estatus === 'COMPLETADA' ? producida : tarea.cantidadProducida,
      },
      include: { producto: true },
    });
  });

  // US-B2: Admin approved the proposal → notify the proposing panadero
  if (tarea.estatus === 'PROPUESTA' && input.estatus === 'PENDIENTE') {
    void notificarUsuario(tarea.asignadoPorId, {
      titulo: `✅ Tu propuesta fue aprobada: ${tarea.producto.nombre}`,
      cuerpo: `El admin aprobó tu propuesta de producir ${tarea.cantidadSolicitada} piezas.`,
      url: '/dashboard/mis-tareas',
    });
  }

  // US-B3: Admin rejected the proposal → notify the proposing panadero
  if (tarea.estatus === 'PROPUESTA' && input.estatus === 'RECHAZADA') {
    void notificarUsuario(tarea.asignadoPorId, {
      titulo: `❌ Tu propuesta fue rechazada: ${tarea.producto.nombre}`,
      cuerpo: 'El admin no aprobó esta propuesta de producción.',
      url: '/dashboard/mis-tareas',
    });
  }

  // Feature D: Deduct raw-material stock when production starts
  if (input.estatus === 'EN_PROCESO') {
    // Import lazily to avoid circular dependencies
    const { descontarInsumosPorTarea } = await import('./inventario.service.js');
    void descontarInsumosPorTarea(id);
  }

  if (input.estatus === 'COMPLETADA') {
    void notificarRol('ADMIN', {
      titulo: '✅ Producción completada',
      cuerpo: `${producida} piezas de ${tarea.producto.nombre} listas. Stock actualizado.`,
      url: '/dashboard/tareas',
      data: { tareaId: id },
    });
  }

  return updated;
}

/**
 * Cancels a pending or in-progress task (ADMIN only). Notifies all maestro panaderos
 * that the task has been cancelled (US-MP2).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {number} id - Task ID.
 * @returns {Promise<TareaProduccion>} The cancelled task.
 * @throws {GraphQLError} NOT_FOUND or TAREA_FINALIZADA.
 */
export async function cancelarTarea(id: number) {
  const tarea = await prisma.tareaProduccion.findUnique({ where: { id } });
  if (!tarea) {
    throw new GraphQLError('Tarea no encontrada', { extensions: { code: 'NOT_FOUND' } });
  }
  const terminales: EstatusTarea[] = ['COMPLETADA', 'CANCELADA', 'RECHAZADA'];
  if (terminales.includes(tarea.estatus)) {
    throw new GraphQLError('La tarea ya está finalizada', { extensions: { code: 'TAREA_FINALIZADA' } });
  }
  const updated = await prisma.tareaProduccion.update({
    where: { id },
    data: { estatus: 'CANCELADA' },
    ...CON_PRODUCTO,
  });

  // US-MP2: Notify all maestro panaderos that the task was cancelled
  void notificarRol('MAESTRO_PANADERO', {
    titulo: `❌ Tarea cancelada: ${updated.producto.nombre}`,
    cuerpo: `La tarea de producir ${updated.cantidadSolicitada} piezas de ${updated.producto.nombre} fue cancelada.`,
    url: '/dashboard/mis-tareas',
  });

  return updated;
}

// Re-export for use in other services
export { notificarRol, notificarUsuario };
