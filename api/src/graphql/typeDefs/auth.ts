/**
 * GraphQL schema for authentication: AuthPayload, RegistroInput, the `yo` query and
 * the registro/login/refreshToken/migrarGuestACuenta mutations.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
export const authTypeDefs = `#graphql
  type AuthPayload {
    accessToken: String!
    refreshToken: String!
    usuario: Usuario!
  }

  input RegistroInput {
    nombre: String!
    email: String!
    password: String!
    telefono: String
  }

  extend type Query {
    yo: Usuario
  }

  extend type Mutation {
    registro(input: RegistroInput!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    refreshToken(token: String!): AuthPayload!
    migrarGuestACuenta(guestToken: String!): Boolean!
  }
`;
