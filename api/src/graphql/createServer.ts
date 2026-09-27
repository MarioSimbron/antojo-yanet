/**
 * Builds and returns a configured ApolloServer instance with the full merged
 * schema and resolver map. Kept separate from index.ts so integration tests
 * can import it without triggering Express, Socket.IO or the RAG loader.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { ApolloServer } from '@apollo/server';
import { mergeTypeDefs, mergeResolvers } from '@graphql-tools/merge';

import { usuarioTypeDefs } from './typeDefs/usuario.js';
import { authTypeDefs } from './typeDefs/auth.js';
import { productoTypeDefs } from './typeDefs/producto.js';
import { pedidoTypeDefs } from './typeDefs/pedido.js';
import { asistenteTypeDefs } from './typeDefs/asistente.js';
import { tareaTypeDefs } from './typeDefs/tarea.js';
import { notificacionTypeDefs } from './typeDefs/notificacion.js';
import { inventarioTypeDefs } from './typeDefs/inventario.js';
import { listaCompraTypeDefs } from './typeDefs/listaCompra.js';

import { authResolvers } from './resolvers/auth.resolvers.js';
import { usuarioResolvers } from './resolvers/usuario.resolvers.js';
import { productoResolvers } from './resolvers/producto.resolvers.js';
import { pedidoResolvers } from './resolvers/pedido.resolvers.js';
import { asistenteResolvers } from './resolvers/asistente.resolvers.js';
import { tareaResolvers } from './resolvers/tarea.resolvers.js';
import { notificacionResolvers } from './resolvers/notificacion.resolvers.js';
import { inventarioResolvers } from './resolvers/inventario.resolvers.js';
import { listaCompraResolvers } from './resolvers/listaCompra.resolvers.js';

/** Root types that every module extends with `extend type Query/Mutation`. */
const baseTypeDefs = `#graphql
  type Query { _empty: String }
  type Mutation { _empty: String }
`;

/**
 * Constructs a ready-to-start ApolloServer with the full application schema.
 * Caller is responsible for calling `server.start()` before use.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {ApolloServer} The configured server (not yet started).
 */
export function buildApolloServer() {
  const typeDefs = mergeTypeDefs([
    baseTypeDefs,
    usuarioTypeDefs,
    authTypeDefs,
    productoTypeDefs,
    pedidoTypeDefs,
    asistenteTypeDefs,
    tareaTypeDefs,
    notificacionTypeDefs,
    inventarioTypeDefs,
    listaCompraTypeDefs,
  ]);

  const resolvers = mergeResolvers([
    authResolvers,
    usuarioResolvers,
    productoResolvers,
    pedidoResolvers,
    asistenteResolvers,
    tareaResolvers,
    notificacionResolvers,
    inventarioResolvers,
    listaCompraResolvers,
  ]);

  return new ApolloServer({ typeDefs, resolvers });
}
