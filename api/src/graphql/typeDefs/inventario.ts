/**
 * GraphQL type definitions for the raw-material inventory module (Feature D).
 * Exposes Insumo CRUD, recipe (BOM) management, and product stock queries.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
export const inventarioTypeDefs = `#graphql
  type Insumo {
    id: Int!
    nombre: String!
    unidad: String!
    stockActual: Float!
    stockMinimo: Float!
  }

  type RecetaItem {
    id: Int!
    productoId: Int!
    insumoId: Int!
    cantidadPorUnidad: Float!
    insumo: Insumo!
  }

  input CrearInsumoInput {
    nombre: String!
    unidad: String!
    stockMinimo: Float
  }

  input RecetaItemInput {
    insumoId: Int!
    cantidadPorUnidad: Float!
  }

  extend type Query {
    insumos: [Insumo!]!
    receta(productoId: Int!): [RecetaItem!]!
  }

  extend type Mutation {
    crearInsumo(input: CrearInsumoInput!): Insumo!
    actualizarInsumo(id: Int!, stockActual: Float, stockMinimo: Float): Insumo!
    guardarReceta(productoId: Int!, items: [RecetaItemInput!]!): Boolean!
  }
` as string;
