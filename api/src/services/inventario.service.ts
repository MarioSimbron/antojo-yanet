/**
 * Raw-material inventory service: stock deduction when production starts and
 * stock replenishment when a purchase-list item is marked as received (Feature D).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { PrismaClient } from '@prisma/client';
import { GraphQLError } from 'graphql';
import { notificarRol } from '../lib/push.js';

const prisma = new PrismaClient();

/**
 * Deducts raw-material stock for all ingredients defined in the product's recipe when
 * a production task transitions to EN_PROCESO. After deduction, any ingredient that
 * falls at or below its minimum stock triggers a notification to ADMIN and MAESTRO_PANADERO
 * (Feature D / US-D3, US-D4).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {number} tareaId - ID of the production task that started.
 * @returns {Promise<void>}
 */
export async function descontarInsumosPorTarea(tareaId: number): Promise<void> {
  const tarea = await prisma.tareaProduccion.findUnique({
    where: { id: tareaId },
    include: {
      producto: {
        include: { recetaItems: { include: { insumo: true } } },
      },
    },
  });
  if (!tarea || tarea.producto.recetaItems.length === 0) return;

  const cantidad = tarea.cantidadSolicitada;

  await prisma.$transaction(
    tarea.producto.recetaItems.map((item) =>
      prisma.insumo.update({
        where: { id: item.insumoId },
        data: { stockActual: { decrement: Number(item.cantidadPorUnidad) * cantidad } },
      }),
    ),
  );

  // Check each ingredient for low-stock and notify if needed (US-D4)
  const actualizados = await prisma.insumo.findMany({
    where: { id: { in: tarea.producto.recetaItems.map((i) => i.insumoId) } },
  });

  for (const insumo of actualizados) {
    if (Number(insumo.stockActual) <= Number(insumo.stockMinimo)) {
      void notificarRol('ADMIN', {
        titulo: `⚠️ Stock bajo: ${insumo.nombre}`,
        cuerpo: `Quedan ${insumo.stockActual} ${insumo.unidad} de ${insumo.nombre} (mínimo: ${insumo.stockMinimo}).`,
        url: '/dashboard/inventario',
      });
      void notificarRol('MAESTRO_PANADERO', {
        titulo: `⚠️ Stock bajo: ${insumo.nombre}`,
        cuerpo: `Quedan ${insumo.stockActual} ${insumo.unidad} de ${insumo.nombre}.`,
        url: '/dashboard/inventario',
      });
    }
  }
}

/**
 * Increments a raw-material ingredient's stock when its corresponding purchase-list
 * item is marked as SURTIDO (Feature D / US-D5).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {number} insumoId - ID of the ingredient to restock.
 * @param {number} cantidad - Amount received to add to the current stock.
 * @returns {Promise<void>}
 */
export async function reponerInsumo(insumoId: number, cantidad: number): Promise<void> {
  await prisma.insumo.update({
    where: { id: insumoId },
    data: { stockActual: { increment: cantidad } },
  });
}

/**
 * Returns all raw-material ingredients ordered alphabetically.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {Promise<Insumo[]>} Full list of ingredients.
 */
export async function listarInsumos() {
  return prisma.insumo.findMany({ orderBy: { nombre: 'asc' } });
}

/**
 * Creates a new raw-material ingredient (ADMIN only).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {{ nombre: string; unidad: string; stockMinimo?: number }} input - Ingredient data.
 * @returns {Promise<Insumo>} The created ingredient.
 */
export async function crearInsumo(input: { nombre: string; unidad: string; stockMinimo?: number }) {
  return prisma.insumo.create({
    data: {
      nombre: input.nombre,
      unidad: input.unidad,
      stockMinimo: input.stockMinimo ?? 0,
    },
  });
}

/**
 * Updates an ingredient's stock values (ADMIN only).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {number} id - Ingredient ID.
 * @param {{ stockActual?: number; stockMinimo?: number }} input - Fields to update.
 * @returns {Promise<Insumo>} The updated ingredient.
 * @throws {GraphQLError} NOT_FOUND if the ingredient does not exist.
 */
export async function actualizarInsumo(
  id: number,
  input: { stockActual?: number; stockMinimo?: number },
) {
  const existe = await prisma.insumo.findUnique({ where: { id } });
  if (!existe) {
    throw new GraphQLError('Insumo no encontrado', { extensions: { code: 'NOT_FOUND' } });
  }
  return prisma.insumo.update({ where: { id }, data: input });
}

/**
 * Replaces the full Bill-of-Materials recipe for a product in a single transaction.
 * Deletes existing recipe items and inserts the new set (ADMIN only).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {number} productoId - Product whose recipe is being saved.
 * @param {{ insumoId: number; cantidadPorUnidad: number }[]} items - New recipe items.
 * @returns {Promise<boolean>} True on success.
 */
export async function guardarReceta(
  productoId: number,
  items: { insumoId: number; cantidadPorUnidad: number }[],
): Promise<boolean> {
  await prisma.$transaction([
    prisma.recetaItem.deleteMany({ where: { productoId } }),
    prisma.recetaItem.createMany({
      data: items.map((i) => ({ productoId, insumoId: i.insumoId, cantidadPorUnidad: i.cantidadPorUnidad })),
    }),
  ]);
  return true;
}

/**
 * Returns the recipe items (ingredients + quantities) for a given product.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {number} productoId - Product ID.
 * @returns {Promise<RecetaItem[]>} Recipe items with ingredient data.
 */
export async function obtenerReceta(productoId: number) {
  return prisma.recetaItem.findMany({
    where: { productoId },
    include: { insumo: true },
  });
}
