/**
 * GraphQL resolvers for the purchase-list module (Feature C).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { GraphQLContext } from '../../middleware/auth.js';
import { requireRole } from '../../lib/guards.js';
import {
  listarCompras,
  crearItemCompra,
  actualizarItemCompra,
} from '../../services/listaCompra.service.js';

/**
 * Resolver map for the purchase-list module.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
export const listaCompraResolvers = {
  Query: {
    /**
     * Returns purchase-list items. ADMIN sees all; others see only their own.
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {{ estatus?: string }} args - Optional status filter.
     * @param {GraphQLContext} ctx - Resolver context; requires ADMIN, MAESTRO_PANADERO or CAJERO.
     * @returns {Promise<ListaCompra[]>} Matching items with creator and ingredient data.
     */
    listaCompras: (
      _: unknown,
      { estatus }: { estatus?: string },
      ctx: GraphQLContext,
    ) => {
      const auth = requireRole(ctx, ['ADMIN', 'MAESTRO_PANADERO', 'CAJERO']);
      return listarCompras(auth, estatus);
    },
  },

  Mutation: {
    /**
     * Creates a purchase-list item and notifies the admin (US-LC1).
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {{ input: { nombre: string; cantidad: number; unidad: string; prioridad?: string; notas?: string; insumoId?: number } }} args - Item data.
     * @param {GraphQLContext} ctx - Resolver context; requires ADMIN, MAESTRO_PANADERO or CAJERO.
     * @returns {Promise<ListaCompra>} The created item.
     */
    crearItemCompra: (
      _: unknown,
      { input }: { input: { nombre: string; cantidad: number; unidad: string; prioridad?: string; notas?: string; insumoId?: number } },
      ctx: GraphQLContext,
    ) => {
      const auth = requireRole(ctx, ['ADMIN', 'MAESTRO_PANADERO', 'CAJERO']);
      return crearItemCompra(input, auth);
    },

    /**
     * Updates a purchase-list item's status (ADMIN only). Triggers stock replenishment
     * when marked SURTIDO if an ingredient is linked (US-D5).
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {{ id: number; estatus: string }} args - Item ID and new status.
     * @param {GraphQLContext} ctx - Resolver context; requires ADMIN role.
     * @returns {Promise<ListaCompra>} The updated item.
     */
    actualizarItemCompra: (
      _: unknown,
      { id, estatus }: { id: number; estatus: string },
      ctx: GraphQLContext,
    ) => {
      requireRole(ctx, ['ADMIN']);
      return actualizarItemCompra(id, estatus);
    },
  },
};
