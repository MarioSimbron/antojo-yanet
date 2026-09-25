/**
 * Authorization guards for GraphQL resolvers.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { GraphQLError } from 'graphql';
import { GraphQLContext } from '../middleware/auth.js';

/**
 * Ensures the request carries an authenticated user.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {GraphQLContext} ctx - Resolver context.
 * @returns {TokenPayload} The authenticated user's token payload.
 * @throws {GraphQLError} UNAUTHENTICATED if there is no valid user.
 */
export function requireAuth(ctx: GraphQLContext) {
  if (!ctx.usuario) {
    throw new GraphQLError('No autenticado', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return ctx.usuario;
}

/**
 * Ensures the request carries an authenticated user with one of the given roles.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {GraphQLContext} ctx - Resolver context.
 * @param {string[]} roles - Roles allowed to proceed.
 * @returns {TokenPayload} The authenticated user's token payload.
 * @throws {GraphQLError} UNAUTHENTICATED if there is no user, FORBIDDEN if the role is not allowed.
 */
export function requireRole(ctx: GraphQLContext, roles: string[]) {
  const usuario = requireAuth(ctx);
  if (!roles.includes(usuario.rol)) {
    throw new GraphQLError('Acceso denegado', {
      extensions: { code: 'FORBIDDEN' },
    });
  }
  return usuario;
}
