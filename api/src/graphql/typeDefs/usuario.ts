/**
 * GraphQL schema for the public Usuario type and staff management operations.
 * The password hash is never exposed. The `usuarios` query and `crearEmpleado`/
 * `actualizarEmpleado` mutations are restricted to ADMIN callers.
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

  input EmpleadoInput {
    nombre: String!
    email: String!
    password: String!
    telefono: String
    rol: String!
  }

  input ActualizarEmpleadoInput {
    nombre: String!
    email: String!
    telefono: String
    rol: String!
  }

  extend type Query {
    usuarios: [Usuario!]!
  }

  extend type Mutation {
    crearEmpleado(input: EmpleadoInput!): Usuario!
    actualizarEmpleado(id: Int!, input: ActualizarEmpleadoInput!): Usuario!
  }
`;
