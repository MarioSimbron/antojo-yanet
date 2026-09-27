/**
 * GraphQL type definitions for the purchase-list module (Feature C).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
export const listaCompraTypeDefs = `#graphql
  type ListaCompra {
    id: Int!
    nombre: String!
    cantidad: Float!
    unidad: String!
    prioridad: String!
    notas: String
    estatus: String!
    creadoPorId: Int!
    insumoId: Int
    createdAt: String!
    creadoPor: Usuario!
    insumo: Insumo
  }

  input CrearItemCompraInput {
    nombre: String!
    cantidad: Float!
    unidad: String!
    prioridad: String
    notas: String
    insumoId: Int
  }

  extend type Query {
    listaCompras(estatus: String): [ListaCompra!]!
  }

  extend type Mutation {
    crearItemCompra(input: CrearItemCompraInput!): ListaCompra!
    actualizarItemCompra(id: Int!, estatus: String!): ListaCompra!
  }
` as string;
