/**
 * GraphQL resolvers for the production-task module.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { EstatusTarea } from '@prisma/client';
import { GraphQLContext } from '../../middleware/auth.js';
import { requireRole, requireAuth } from '../../lib/guards.js';
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
     * Returns the pending/in-progress task queue visible to the maestro panadero.
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {unknown} __ - Arguments (none).
     * @param {GraphQLContext} ctx - Resolver context; requires MAESTRO_PANADERO role.
     * @returns {Promise<TareaProduccion[]>} Active tasks with product data.
     */
    misTareas: (_: unknown, __: unknown, ctx: GraphQLContext) => {
      requireRole(ctx, ['MAESTRO_PANADERO', 'ADMIN']);
      return listarMisTareas();
    },
  },

  Mutation: {
    /**
     * Creates a production task and notifies all maestro panadero users (ADMIN only).
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {{ input: { productoId: number; cantidadSolicitada: number; notas?: string } }} args - Task data.
     * @param {GraphQLContext} ctx - Resolver context; requires ADMIN role.
     * @returns {Promise<TareaProduccion>} The created task.
     */
    crearTarea: (
      _: unknown,
      { input }: { input: { productoId: number; cantidadSolicitada: number; notas?: string } },
      ctx: GraphQLContext,
    ) => {
      const auth = requireRole(ctx, ['ADMIN']);
      return crearTarea(input, auth.usuarioId);
    },

    /**
     * Maestro panadero updates a task's status (EN_PROCESO or COMPLETADA). On
     * COMPLETADA the product's stock is incremented and the admin is notified.
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
      requireRole(ctx, ['MAESTRO_PANADERO', 'ADMIN']);
      return actualizarTarea(id, input);
    },

    /**
     * Cancels a pending task (ADMIN only).
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
