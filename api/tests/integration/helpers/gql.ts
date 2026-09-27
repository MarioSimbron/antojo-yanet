/**
 * GraphQL test helper: builds and caches the Apollo Server, then exposes
 * `executeAs` to run operations against it with a pre-injected context so
 * integration tests never need real JWT tokens.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { ApolloServer } from '@apollo/server';
import type { Request } from 'express';
import type { GraphQLContext } from '../../../src/middleware/auth.js';

let server: ApolloServer<GraphQLContext> | null = null;

/**
 * Returns the cached ApolloServer instance, starting it on first call.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {Promise<ApolloServer<GraphQLContext>>} Ready-to-use server.
 */
async function getServer(): Promise<ApolloServer<GraphQLContext>> {
  if (!server) {
    const { buildApolloServer } = await import('../../../src/graphql/createServer.js');
    server = buildApolloServer() as ApolloServer<GraphQLContext>;
    await server.start();
  }
  return server;
}

/**
 * Stops the cached Apollo Server. Call in `afterAll` of the last test file.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
export async function stopServer(): Promise<void> {
  if (server) {
    await server.stop();
    server = null;
  }
}

/**
 * Executes a GraphQL operation as the given user role. Injects the context
 * directly, bypassing HTTP and JWT verification.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string | null} rol - Role to inject ('ADMIN', 'MAESTRO_PANADERO', 'CAJERO') or null for unauthenticated.
 * @param {number | null} usuarioId - User ID to inject, or null for unauthenticated.
 * @param {string} query - GraphQL query or mutation string.
 * @param {Record<string, unknown>} [variables] - Optional variables.
 * @returns The Apollo response (body.singleResult for assertions).
 */
export async function executeAs(
  rol: string | null,
  usuarioId: number | null,
  query: string,
  variables?: Record<string, unknown>,
) {
  const s = await getServer();
  const contextValue: GraphQLContext = {
    usuario: rol && usuarioId ? { usuarioId, rol } : undefined,
    req: {} as Request,
  };
  return s.executeOperation({ query, variables }, { contextValue });
}
