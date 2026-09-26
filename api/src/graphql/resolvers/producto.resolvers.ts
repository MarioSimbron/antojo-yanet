/**
 * GraphQL resolvers for the product catalog.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { PrismaClient } from '@prisma/client';
import { GraphQLError } from 'graphql';
import { GraphQLContext } from '../../middleware/auth.js';
import { requireRole } from '../../lib/guards.js';
import { generarMenuMd } from '../../lib/menu-generator.js';

const prisma = new PrismaClient();

/**
 * Resolver map for the product module.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
export const productoResolvers = {
  Query: {
    /**
     * Lists active products, optionally filtered by category and by immediate
     * availability (in stock and not made-to-order).
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {{ categoria?: string; soloDisponibles?: boolean }} args - Optional filters.
     * @returns {Promise<Producto[]>} Products sorted by category and name.
     */
    menu: async (
      _: unknown,
      { categoria, soloDisponibles }: { categoria?: string; soloDisponibles?: boolean },
    ) => {
      return prisma.producto.findMany({
        where: {
          activo: true,
          ...(categoria ? { categoria } : {}),
          ...(soloDisponibles ? { stockDisponible: { gt: 0 }, requiereEncargo: false } : {}),
        },
        orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }],
      });
    },

    /**
     * Fetches a single product by ID.
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {{ id: number }} args - Product ID.
     * @returns {Promise<Producto | null>} The product, or null if it does not exist.
     */
    producto: (_: unknown, { id }: { id: number }) => {
      return prisma.producto.findUnique({ where: { id } });
    },

    /**
     * Lists the distinct categories present among active products.
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @returns {Promise<string[]>} Category names sorted alphabetically.
     */
    categorias: async () => {
      const rows = await prisma.producto.findMany({
        where: { activo: true },
        select: { categoria: true },
        distinct: ['categoria'],
        orderBy: { categoria: 'asc' },
      });
      return rows.map((r) => r.categoria);
    },

    /**
     * Returns ALL products (active and inactive) for admin management. ADMIN only.
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {unknown} __ - Arguments (none).
     * @param {GraphQLContext} ctx - Resolver context; requires the ADMIN role.
     * @returns {Promise<Producto[]>} All products sorted by category and name.
     */
    productos: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      requireRole(ctx, ['ADMIN']);
      return prisma.producto.findMany({ orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }] });
    },
  },

  Mutation: {
    /**
     * Creates a product (ADMIN only) and regenerates menu.md.
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {{ input: ProductoInput }} args - Product data.
     * @param {GraphQLContext} ctx - Resolver context; requires the ADMIN role.
     * @returns {Promise<Producto>} The created product.
     * @throws {GraphQLError} SKU_DUPLICADO if the SKU already exists.
     */
    crearProducto: async (
      _: unknown,
      { input }: { input: Record<string, unknown> },
      ctx: GraphQLContext,
    ) => {
      requireRole(ctx, ['ADMIN']);
      try {
        const producto = await prisma.producto.create({ data: input as never });
        await generarMenuMd();
        return producto;
      } catch (e: unknown) {
        const err = e as { code?: string };
        if (err?.code === 'P2002') {
          throw new GraphQLError('El SKU ya existe', { extensions: { code: 'SKU_DUPLICADO' } });
        }
        throw e;
      }
    },

    /**
     * Partially updates a product (ADMIN only) and regenerates menu.md.
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {{ id: number; input: ActualizarProductoInput }} args - Product ID and fields to change.
     * @param {GraphQLContext} ctx - Resolver context; requires the ADMIN role.
     * @returns {Promise<Producto>} The updated product.
     * @throws {GraphQLError} NOT_FOUND if the product does not exist.
     */
    actualizarProducto: async (
      _: unknown,
      { id, input }: { id: number; input: Record<string, unknown> },
      ctx: GraphQLContext,
    ) => {
      requireRole(ctx, ['ADMIN']);
      try {
        const producto = await prisma.producto.update({ where: { id }, data: input as never });
        await generarMenuMd();
        return producto;
      } catch (e: unknown) {
        const err = e as { code?: string };
        if (err?.code === 'P2025') {
          throw new GraphQLError('Producto no encontrado', {
            extensions: { code: 'NOT_FOUND' },
          });
        }
        throw e;
      }
    },

    /**
     * Hard-deletes a product by ID (ADMIN only). Only safe when no order items
     * reference the product; otherwise the DB will throw a foreign-key error.
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {{ id: number }} args - Product ID to delete.
     * @param {GraphQLContext} ctx - Resolver context; requires the ADMIN role.
     * @returns {Promise<boolean>} Always true on success.
     * @throws {GraphQLError} NOT_FOUND if the product does not exist.
     * @throws {GraphQLError} TIENE_PEDIDOS if order items still reference this product.
     */
    eliminarProducto: async (_: unknown, { id }: { id: number }, ctx: GraphQLContext) => {
      requireRole(ctx, ['ADMIN']);
      try {
        await prisma.producto.delete({ where: { id } });
        await generarMenuMd();
        return true;
      } catch (e: unknown) {
        const err = e as { code?: string };
        if (err?.code === 'P2025') {
          throw new GraphQLError('Producto no encontrado', { extensions: { code: 'NOT_FOUND' } });
        }
        if (err?.code === 'P2003') {
          throw new GraphQLError('El producto tiene pedidos asociados y no puede eliminarse', {
            extensions: { code: 'TIENE_PEDIDOS' },
          });
        }
        throw e;
      }
    },
  },
};
