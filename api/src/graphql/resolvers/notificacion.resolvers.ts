/**
 * GraphQL resolvers for the in-app notification center.
 * All operations are scoped to the caller's identity: authenticated users are
 * matched by usuarioId; guests are matched by their guestToken.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { PrismaClient } from '@prisma/client';
import { GraphQLError } from 'graphql';
import { GraphQLContext } from '../../middleware/auth.js';

const prisma = new PrismaClient();

/**
 * Builds a Prisma `where` clause that scopes the query to the calling identity.
 * @param {GraphQLContext} ctx - GraphQL resolver context.
 * @returns {{ usuarioId: number } | { guestToken: string }} Ownership filter.
 * @throws {GraphQLError} UNAUTHENTICATED when neither a JWT user nor a guest token is present.
 */
function whereForCaller(ctx: GraphQLContext): { usuarioId: number } | { guestToken: string } {
  if (ctx.usuario) return { usuarioId: ctx.usuario.usuarioId };
  if (ctx.guestToken) return { guestToken: ctx.guestToken };
  throw new GraphQLError('No autenticado', { extensions: { code: 'UNAUTHENTICATED' } });
}

export const notificacionResolvers = {
  Query: {
    /**
     * Returns the last 50 notifications for the calling user or guest, ordered newest first.
     * @param {unknown} _ - Unused parent.
     * @param {{ soloNoLeidas?: boolean }} args - Optional filter to return only unread items.
     * @param {GraphQLContext} ctx - Resolver context with identity data.
     * @returns {Promise<Notificacion[]>} List of notifications.
     */
    misNotificaciones: async (
      _: unknown,
      { soloNoLeidas }: { soloNoLeidas?: boolean },
      ctx: GraphQLContext,
    ) => {
      const where = {
        ...whereForCaller(ctx),
        ...(soloNoLeidas ? { leida: false } : {}),
      };
      return prisma.notificacion.findMany({
        where,
        orderBy: { creadaEn: 'desc' },
        take: 50,
      });
    },
  },

  Mutation: {
    /**
     * Marks a single notification as read. Uses updateMany with the caller's ownership
     * filter so the operation is a no-op when the notification belongs to someone else.
     * @param {unknown} _ - Unused parent.
     * @param {{ id: number }} args - ID of the notification to mark.
     * @param {GraphQLContext} ctx - Resolver context with identity data.
     * @returns {Promise<boolean>} True when the notification was found and updated.
     */
    marcarLeida: async (
      _: unknown,
      { id }: { id: number },
      ctx: GraphQLContext,
    ) => {
      const result = await prisma.notificacion.updateMany({
        where: { id, ...whereForCaller(ctx) },
        data: { leida: true },
      });
      return result.count > 0;
    },

    /**
     * Marks every unread notification as read for the current user or guest.
     * @param {unknown} _ - Unused parent.
     * @param {unknown} __ - Unused args.
     * @param {GraphQLContext} ctx - Resolver context with identity data.
     * @returns {Promise<boolean>} Always true.
     */
    marcarTodasLeidas: async (
      _: unknown,
      __: unknown,
      ctx: GraphQLContext,
    ) => {
      await prisma.notificacion.updateMany({
        where: { ...whereForCaller(ctx), leida: false },
        data: { leida: true },
      });
      return true;
    },
  },

  Notificacion: {
    /**
     * Serializes the Date field to an ISO 8601 string for GraphQL transport.
     * @param {{ creadaEn: Date }} parent - Parent notification object from Prisma.
     * @returns {string} ISO date string.
     */
    creadaEn: (parent: { creadaEn: Date }) => parent.creadaEn.toISOString(),
  },
};
