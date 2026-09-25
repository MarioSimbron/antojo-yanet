/**
 * GraphQL schema for the AI assistant: DatosEncargo, ItemCarritoChat, RespuestaChat, the AccionChat enum
 * and the `chatAsistente(mensaje, sessionId)` mutation.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
export const asistenteTypeDefs = `#graphql
  type DatosEncargo {
    producto: String
    fechaDeseada: String
    personas: Int
    detalles: String
  }

  type ItemCarritoChat {
    productoId: Int!
    nombre: String!
    precio: Float!
    cantidad: Int!
    esEncargo: Boolean!
    imagenUrl: String
  }

  type RespuestaChat {
    respuesta: String!
    accion: AccionChat!
    datosEncargo: DatosEncargo
    itemsCarrito: [ItemCarritoChat!]
    pedidoId: Int
  }

  enum AccionChat {
    NINGUNA
    ABRIR_CHECKOUT
    VER_PEDIDO
    VER_MENU
    AGREGAR_CARRITO
  }

  extend type Mutation {
    chatAsistente(mensaje: String!, sessionId: String!): RespuestaChat!
  }
`;
