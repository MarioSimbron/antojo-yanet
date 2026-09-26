/**
 * Production-task service: creation, status transitions and stock replenishment.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { PrismaClient, EstatusTarea } from '@prisma/client';
import { GraphQLError } from 'graphql';
import { notificarRol, notificarUsuario } from '../lib/push.js';

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
 * Returns all tasks assigned by a specific admin, used by the maestro panadero to
 * see their own queue.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {number} adminId - ID of the admin who created the tasks (unused in maestro view).
 * @returns {Promise<TareaProduccion[]>} Pending and in-progress tasks newest first.
 */
export async function listarMisTareas() {
  return prisma.tareaProduccion.findMany({
    where: { estatus: { in: ['PENDIENTE', 'EN_PROCESO'] } },
    ...CON_PRODUCTO,
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Creates a production task and sends a push notification to all maestro panadero users.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {{ productoId: number; cantidadSolicitada: number; notas?: string }} input - Task data.
 * @param {number} adminId - ID of the admin creating the task.
 * @returns {Promise<TareaProduccion>} The created task with product data.
 * @throws {GraphQLError} NOT_FOUND if the product does not exist.
 */
export async function crearTarea(
  input: { productoId: number; cantidadSolicitada: number; notas?: string },
  adminId: number,
) {
  const producto = await prisma.producto.findUnique({ where: { id: input.productoId } });
  if (!producto) {
    throw new GraphQLError('Producto no encontrado', { extensions: { code: 'NOT_FOUND' } });
  }

  const tarea = await prisma.tareaProduccion.create({
    data: {
      productoId: input.productoId,
      cantidadSolicitada: input.cantidadSolicitada,
      notas: input.notas ?? null,
      asignadoPorId: adminId,
    },
    ...CON_PRODUCTO,
  });

  void notificarRol('MAESTRO_PANADERO', {
    titulo: '🍞 Nueva tarea de producción',
    cuerpo: `Producir ${input.cantidadSolicitada} piezas de ${producto.nombre}`,
    url: '/dashboard/mis-tareas',
    data: { tareaId: tarea.id },
  });

  return tarea;
}

/**
 * Updates a task's status. When marked COMPLETADA, increments the product's stock and
 * notifies the admin. Only non-terminal tasks may be updated.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {number} id - Task ID.
 * @param {{ estatus: EstatusTarea; cantidadProducida?: number }} input - New status and optional quantity.
 * @returns {Promise<TareaProduccion>} The updated task with product data.
 * @throws {GraphQLError} NOT_FOUND or TAREA_FINALIZADA.
 */
export async function actualizarTarea(
  id: number,
  input: { estatus: EstatusTarea; cantidadProducida?: number },
) {
  const tarea = await prisma.tareaProduccion.findUnique({ where: { id }, include: { producto: true } });
  if (!tarea) {
    throw new GraphQLError('Tarea no encontrada', { extensions: { code: 'NOT_FOUND' } });
  }
  if (tarea.estatus === 'COMPLETADA' || tarea.estatus === 'CANCELADA') {
    throw new GraphQLError('La tarea ya está finalizada', { extensions: { code: 'TAREA_FINALIZADA' } });
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
 * Cancels a pending task (ADMIN only).
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
  if (tarea.estatus === 'COMPLETADA' || tarea.estatus === 'CANCELADA') {
    throw new GraphQLError('La tarea ya está finalizada', { extensions: { code: 'TAREA_FINALIZADA' } });
  }
  return prisma.tareaProduccion.update({
    where: { id },
    data: { estatus: 'CANCELADA' },
    ...CON_PRODUCTO,
  });
}

// Re-export for use in other services
export { notificarRol, notificarUsuario };
