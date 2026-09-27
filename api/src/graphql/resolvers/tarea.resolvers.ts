/**
 * GraphQL resolvers for the production-task module.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { EstatusTarea } from '@prisma/client';
import { GraphQLContext } from '../../middleware/auth.js';
import { requireRole } from '../../lib/guards.js';
import {
  listarTareas,
  listarMisTareas,
  crearTarea,
  actualizarTarea,
  cancelarTarea,
} from '../../services/tarea.service.js';

/**
 * Resolver map for the production-task module.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
export const tareaResolvers = {
  Query: {
    /**
     * Returns all production tasks, newest first (ADMIN / CAJERO only).
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {unknown} __ - Arguments (none).
     * @param {GraphQLContext} ctx - Resolver context; requires ADMIN or CAJERO role.
     * @returns {Promise<TareaProduccion[]>} All tasks with product data.
     */
    tareas: (_: unknown, __: unknown, ctx: GraphQLContext) => {
      requireRole(ctx, ['ADMIN', 'CAJERO']);
      return listarTareas();
    },

    /**
     * Returns the task queue visible to the maestro panadero: active tasks plus
     * proposals they submitted. The caller's own tasks are filtered when they are
     * a maestro panadero; admins see everything.
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {unknown} __ - Arguments (none).
     * @param {GraphQLContext} ctx - Resolver context; requires MAESTRO_PANADERO or ADMIN.
     * @returns {Promise<TareaProduccion[]>} Relevant tasks with product data.
     */
    misTareas: (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const auth = requireRole(ctx, ['MAESTRO_PANADERO', 'ADMIN']);
      const usuarioId = auth.rol === 'MAESTRO_PANADERO' ? auth.usuarioId : undefined;
      return listarMisTareas(usuarioId);
    },
  },

  Mutation: {
    /**
     * Creates a production task. ADMIN → task starts as PENDIENTE, maestros are notified.
     * MAESTRO_PANADERO → task starts as PROPUESTA, admin is notified to review (US-B1).
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {{ input: { productoId: number; cantidadSolicitada: number; notas?: string } }} args - Task data.
     * @param {GraphQLContext} ctx - Resolver context; requires ADMIN or MAESTRO_PANADERO role.
     * @returns {Promise<TareaProduccion>} The created task.
     */
    crearTarea: (
      _: unknown,
      { input }: { input: { productoId: number; cantidadSolicitada: number; notas?: string } },
      ctx: GraphQLContext,
    ) => {
      const auth = requireRole(ctx, ['ADMIN', 'MAESTRO_PANADERO']);
      return crearTarea(input, auth.usuarioId, auth.rol);
    },

    /**
     * Updates a task's status. Admins may approve (PENDIENTE) or reject (RECHAZADA) proposals.
     * Maestros may advance their own tasks to EN_PROCESO or COMPLETADA.
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {{ id: number; input: { estatus: EstatusTarea; cantidadProducida?: number } }} args - Task ID and new status.
     * @param {GraphQLContext} ctx - Resolver context; requires MAESTRO_PANADERO or ADMIN.
     * @returns {Promise<TareaProduccion>} The updated task.
     */
    actualizarTarea: (
      _: unknown,
      { id, input }: { id: number; input: { estatus: EstatusTarea; cantidadProducida?: number } },
      ctx: GraphQLContext,
    ) => {
      const auth = requireRole(ctx, ['MAESTRO_PANADERO', 'ADMIN']);
      return actualizarTarea(id, input, auth.rol);
    },

    /**
     * Cancels a pending task and notifies all maestro panaderos (ADMIN only, US-MP2).
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {{ id: number }} args - Task ID.
     * @param {GraphQLContext} ctx - Resolver context; requires ADMIN role.
     * @returns {Promise<TareaProduccion>} The cancelled task.
     */
    cancelarTarea: (_: unknown, { id }: { id: number }, ctx: GraphQLContext) => {
      requireRole(ctx, ['ADMIN']);
      return cancelarTarea(id);
    },
  },
};
