/**
 * GraphQL authentication middleware: builds the per-request context from the
 * Authorization and X-Guest-Token headers.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { Request } from 'express';
import { verificarToken, TokenPayload } from '../lib/jwt.js';

/**
 * Context object passed to every GraphQL resolver.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @property {TokenPayload} [usuario] - Decoded access token, if a valid one was sent.
 * @property {string} [guestToken] - Guest token from the X-Guest-Token header, if any.
 * @property {Request} req - The underlying Express request.
 */
export interface GraphQLContext {
  usuario?: TokenPayload;
  guestToken?: string;
  req: Request;
}

/**
 * Builds the GraphQL context. An invalid or expired token never throws: the context is
 * simply left without a user and each resolver decides whether that is an error.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {{ req: Request }} params - Object containing the Express request.
 * @returns {GraphQLContext} The resolver context.
 */
export function buildContext({ req }: { req: Request }): GraphQLContext {
  const ctx: GraphQLContext = { req };

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      ctx.usuario = verificarToken(token, 'access');
    } catch {
      // invalid/expired token — context stays empty, the resolver decides
    }
  }

  const guestToken = req.headers['x-guest-token'];
  if (typeof guestToken === 'string' && guestToken.length > 0) {
    ctx.guestToken = guestToken;
  }

  return ctx;
}
