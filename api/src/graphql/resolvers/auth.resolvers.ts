/**
 * GraphQL resolvers for authentication and the current user.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { PrismaClient } from '@prisma/client';
import { GraphQLError } from 'graphql';
import { GraphQLContext } from '../../middleware/auth.js';
import { requireAuth } from '../../lib/guards.js';
import { registrar, login, refreshTokens, mergeGuestOrders } from '../../services/auth.service.js';

const prisma = new PrismaClient();

/**
 * Resolver map for the auth module.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
export const authResolvers = {
  Query: {
    /**
     * Returns the authenticated user, including their loyalty points balance.
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {unknown} __ - Arguments (none).
     * @param {GraphQLContext} ctx - Resolver context; requires a valid JWT.
     * @returns {Promise<Usuario | null>} The current user.
     */
    yo: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const auth = requireAuth(ctx);
      return prisma.usuario.findUnique({ where: { id: auth.usuarioId } });
    },
  },

  Mutation: {
    /**
     * Registers a new customer account.
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {{ input: RegistroInput }} args - Name, email, password and optional phone.
     * @returns {Promise<AuthPayload>} Access token, refresh token and the new user.
     */
    registro: async (_: unknown, { input }: { input: { nombre: string; email: string; password: string; telefono?: string } }) => {
      return registrar(input);
    },

    /**
     * Logs a user in with email and password.
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {{ email: string; password: string }} args - Credentials.
     * @returns {Promise<AuthPayload>} Access token, refresh token and the user.
     */
    login: async (_: unknown, { email, password }: { email: string; password: string }) => {
      return login(email, password);
    },

    /**
     * Exchanges a valid refresh token for a new token pair.
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {{ token: string }} args - Refresh token.
     * @returns {Promise<AuthPayload>} New access token, refresh token and the user.
     */
    refreshToken: async (_: unknown, { token }: { token: string }) => {
      return refreshTokens(token);
    },

    /**
     * Moves the orders placed with a guest token to the authenticated account.
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {{ guestToken: string }} args - Guest token whose orders will be migrated.
     * @param {GraphQLContext} ctx - Resolver context; requires a valid JWT.
     * @returns {Promise<boolean>} Always true on success.
     */
    migrarGuestACuenta: async (
      _: unknown,
      { guestToken }: { guestToken: string },
      ctx: GraphQLContext,
    ) => {
      const auth = requireAuth(ctx);
      await mergeGuestOrders({ usuarioId: auth.usuarioId, guestToken });
      return true;
    },
  },
};
