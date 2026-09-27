/**
 * GraphQL resolvers for the product catalog.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { PrismaClient } from '@prisma/client';
import { GraphQLError } from 'graphql';
import { GraphQLContext } from '../../middleware/auth.js';
import { requireRole } from '../../lib/guards.js';
import { generarMenuMd } from '../../lib/menu-generator.js';
import { cargarDocumentos } from '../../lib/rag.js';

const prisma = new PrismaClient();

/**
 * Converts a string to title case: each word's first letter is uppercased and the
 * rest are lowercased. Handles multi-word category names (e.g. "pan dulce" → "Pan Dulce").
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string} str - Raw string to transform.
 * @returns {string} Title-cased string.
 */
function toTitleCase(str: string): string {
  return str
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

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
      const catNorm = categoria ? toTitleCase(categoria) : undefined;
      return prisma.producto.findMany({
        where: {
          activo: true,
          ...(catNorm ? { categoria: catNorm } : {}),
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
        orderBy: { categoria: 'asc' },
      });
      // Normalize to title case and deduplicate (handles legacy rows stored in all-caps)
      const seen = new Set<string>();
      const result: string[] = [];
      for (const r of rows) {
        const norm = toTitleCase(r.categoria);
        if (!seen.has(norm)) { seen.add(norm); result.push(norm); }
      }
      return result;
    },

    /**
     * Returns ALL products (active and inactive) for staff management.
     * ADMIN sees all for full CRUD; MAESTRO_PANADERO sees the list to propose tasks.
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {unknown} __ - Arguments (none).
     * @param {GraphQLContext} ctx - Resolver context; requires ADMIN or MAESTRO_PANADERO role.
     * @returns {Promise<Producto[]>} All products sorted by category and name.
     */
    productos: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      requireRole(ctx, ['ADMIN', 'MAESTRO_PANADERO']);
      const rows = await prisma.producto.findMany({ orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }] });
      return rows.map((p) => ({ ...p, categoria: toTitleCase(p.categoria) }));
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
        const data = { ...input } as Record<string, unknown>;
        if (typeof data.categoria === 'string') data.categoria = toTitleCase(data.categoria);
        const producto = await prisma.producto.create({ data: data as never });
        await generarMenuMd();
        void cargarDocumentos();
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
        const data = { ...input } as Record<string, unknown>;
        if (typeof data.categoria === 'string') data.categoria = toTitleCase(data.categoria);
        const producto = await prisma.producto.update({ where: { id }, data: data as never });
        await generarMenuMd();
        void cargarDocumentos();
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
        void cargarDocumentos();
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
