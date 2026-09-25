/**
 * GraphQL schema for the public Usuario type (the password hash is never exposed).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
export const usuarioTypeDefs = `#graphql
  type Usuario {
    id: Int!
    nombre: String!
    email: String!
    telefono: String
    rol: String!
    puntosSaldo: Int!
    createdAt: String!
  }
`;
