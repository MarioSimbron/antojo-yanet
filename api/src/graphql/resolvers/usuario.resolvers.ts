/**
 * GraphQL resolvers for employee management (ADMIN-only).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { GraphQLContext } from '../../middleware/auth.js';
import { requireRole } from '../../lib/guards.js';
import { listarEmpleados, crearEmpleado, actualizarEmpleado } from '../../services/usuario.service.js';

/**
 * Resolver map for the usuario module (staff CRUD).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
export const usuarioResolvers = {
  Query: {
    /**
     * Returns all staff users. ADMIN only.
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {unknown} __ - Arguments (none).
     * @param {GraphQLContext} ctx - Resolver context; requires ADMIN role.
     * @returns {Promise<Usuario[]>} List of staff users.
     */
    usuarios: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      requireRole(ctx, ['ADMIN']);
      return listarEmpleados();
    },
  },

  Mutation: {
    /**
     * Creates a new staff user account. ADMIN only.
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {{ input: EmpleadoInput }} args - Employee data including plain-text password.
     * @param {GraphQLContext} ctx - Resolver context; requires ADMIN role.
     * @returns {Promise<Usuario>} The created user.
     */
    crearEmpleado: async (
      _: unknown,
      { input }: { input: { nombre: string; email: string; password: string; telefono?: string; rol: string } },
      ctx: GraphQLContext,
    ) => {
      requireRole(ctx, ['ADMIN']);
      return crearEmpleado(input);
    },

    /**
     * Updates an existing employee's name, email, phone and role. ADMIN only.
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {{ id: number; input: ActualizarEmpleadoInput }} args - Employee ID and updated fields.
     * @param {GraphQLContext} ctx - Resolver context; requires ADMIN role.
     * @returns {Promise<Usuario>} The updated user.
     */
    actualizarEmpleado: async (
      _: unknown,
      { id, input }: { id: number; input: { nombre: string; email: string; telefono?: string; rol: string } },
      ctx: GraphQLContext,
    ) => {
      requireRole(ctx, ['ADMIN']);
      return actualizarEmpleado(id, input);
    },
  },
};
