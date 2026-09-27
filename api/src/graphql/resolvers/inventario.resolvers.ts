/**
 * GraphQL resolvers for the raw-material inventory module (Feature D).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { GraphQLContext } from '../../middleware/auth.js';
import { requireRole } from '../../lib/guards.js';
import {
  listarInsumos,
  crearInsumo,
  actualizarInsumo,
  guardarReceta,
  obtenerReceta,
} from '../../services/inventario.service.js';

/**
 * Resolver map for the raw-material inventory module.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
export const inventarioResolvers = {
  Query: {
    /**
     * Returns all raw-material ingredients (ADMIN, MAESTRO_PANADERO, CAJERO).
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {unknown} __ - Arguments (none).
     * @param {GraphQLContext} ctx - Resolver context.
     * @returns {Promise<Insumo[]>} Alphabetically sorted ingredient list.
     */
    insumos: (_: unknown, __: unknown, ctx: GraphQLContext) => {
      requireRole(ctx, ['ADMIN', 'MAESTRO_PANADERO', 'CAJERO']);
      return listarInsumos();
    },

    /**
     * Returns the Bill-of-Materials recipe for a product (ADMIN, MAESTRO_PANADERO).
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {{ productoId: number }} args - Product ID.
     * @param {GraphQLContext} ctx - Resolver context.
     * @returns {Promise<RecetaItem[]>} Recipe items with ingredient data.
     */
    receta: (_: unknown, { productoId }: { productoId: number }, ctx: GraphQLContext) => {
      requireRole(ctx, ['ADMIN', 'MAESTRO_PANADERO']);
      return obtenerReceta(productoId);
    },
  },

  Mutation: {
    /**
     * Creates a new raw-material ingredient (ADMIN only).
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {{ input: { nombre: string; unidad: string; stockMinimo?: number } }} args - Ingredient data.
     * @param {GraphQLContext} ctx - Resolver context; requires ADMIN role.
     * @returns {Promise<Insumo>} The created ingredient.
     */
    crearInsumo: (
      _: unknown,
      { input }: { input: { nombre: string; unidad: string; stockMinimo?: number } },
      ctx: GraphQLContext,
    ) => {
      requireRole(ctx, ['ADMIN']);
      return crearInsumo(input);
    },

    /**
     * Updates an ingredient's stock values (ADMIN only).
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {{ id: number; stockActual?: number; stockMinimo?: number }} args - Fields to update.
     * @param {GraphQLContext} ctx - Resolver context; requires ADMIN role.
     * @returns {Promise<Insumo>} The updated ingredient.
     */
    actualizarInsumo: (
      _: unknown,
      { id, stockActual, stockMinimo }: { id: number; stockActual?: number; stockMinimo?: number },
      ctx: GraphQLContext,
    ) => {
      requireRole(ctx, ['ADMIN']);
      return actualizarInsumo(id, { stockActual, stockMinimo });
    },

    /**
     * Replaces the full recipe for a product (ADMIN only).
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {{ productoId: number; items: { insumoId: number; cantidadPorUnidad: number }[] }} args - Recipe data.
     * @param {GraphQLContext} ctx - Resolver context; requires ADMIN role.
     * @returns {Promise<boolean>} True on success.
     */
    guardarReceta: (
      _: unknown,
      { productoId, items }: { productoId: number; items: { insumoId: number; cantidadPorUnidad: number }[] },
      ctx: GraphQLContext,
    ) => {
      requireRole(ctx, ['ADMIN']);
      return guardarReceta(productoId, items);
    },
  },
};
