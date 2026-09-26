/**
 * GraphQL schema for the product catalog: Producto, ProductoInput,
 * ActualizarProductoInput, the menu/producto/categorias queries and the
 * crearProducto/actualizarProducto mutations.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
export const productoTypeDefs = `#graphql
  type Producto {
    id: Int!
    sku: String!
    nombre: String!
    descripcion: String
    precio: String!
    categoria: String!
    imagenUrl: String
    activo: Boolean!
    stockDisponible: Int!
    requiereEncargo: Boolean!
    temporadaInicio: String
    temporadaFin: String
    createdAt: String!
  }

  input ProductoInput {
    sku: String!
    nombre: String!
    descripcion: String
    precio: String!
    categoria: String!
    imagenUrl: String
    activo: Boolean
    stockDisponible: Int
    requiereEncargo: Boolean
    temporadaInicio: String
    temporadaFin: String
  }

  input ActualizarProductoInput {
    nombre: String
    descripcion: String
    precio: String
    categoria: String
    imagenUrl: String
    activo: Boolean
    stockDisponible: Int
    requiereEncargo: Boolean
    temporadaInicio: String
    temporadaFin: String
  }

  extend type Query {
    menu(categoria: String, soloDisponibles: Boolean): [Producto!]!
    producto(id: Int!): Producto
    categorias: [String!]!
    productos: [Producto!]!
  }

  extend type Mutation {
    crearProducto(input: ProductoInput!): Producto!
    actualizarProducto(id: Int!, input: ActualizarProductoInput!): Producto!
    eliminarProducto(id: Int!): Boolean!
  }
`;
