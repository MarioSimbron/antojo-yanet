/**
 * GraphQL schema for orders: Pedido, ItemPedido, HistorialEstatus, FacturaCFDI,
 * ReporteVentas, their inputs, the order queries (pedido, misPedidos, pedidos,
 * reporteVentas) and the order lifecycle mutations.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
export const pedidoTypeDefs = `#graphql
  type ItemPedido {
    id: Int!
    productoId: Int!
    producto: Producto
    cantidad: Int!
    precioUnitario: String!
    esEncargo: Boolean!
    mensajePersonalizado: String
  }

  type HistorialEstatus {
    id: Int!
    estatus: String!
    timestamp: String!
    actorId: Int
    nota: String
  }

  type FacturaCFDI {
    id: Int!
    rfc: String!
    razonSocial: String!
    usoCFDI: String!
  }

  type Pedido {
    id: Int!
    usuarioId: Int
    guestToken: String
    nombreCliente: String!
    email: String!
    telefono: String!
    tipoEntrega: String!
    direccion: String
    formaPago: String!
    estatus: String!
    subtotal: String!
    costoEnvio: String!
    descuentoPuntos: String!
    montoDeposito: String!
    porcentajeDeposito: String!
    total: String!
    fechaEntregaEstimada: String
    repartidorId: Int
    tiempoEstimadoMinutos: Int
    cancelacionMotivo: String
    notasEncargo: String
    imagenRefUrl: String
    createdAt: String!
    items: [ItemPedido!]!
    historial: [HistorialEstatus!]!
    factura: FacturaCFDI
  }

  type ReporteVentas {
    totalIngresos: String!
    totalPedidos: Int!
    ticketPromedio: String!
    topProductos: [ProductoVendido!]!
  }

  type ProductoVendido {
    productoId: Int!
    nombre: String!
    totalVendidos: Int!
  }

  input ItemPedidoInput {
    productoId: Int!
    cantidad: Int!
    mensajePersonalizado: String
  }

  input CrearPedidoInput {
    items: [ItemPedidoInput!]!
    tipoEntrega: String!
    direccion: String
    formaPago: String!
    fechaEntregaEstimada: String
    nombreCliente: String
    email: String
    telefono: String
    notasEncargo: String
    imagenRefUrl: String
  }

  input FacturaInput {
    rfc: String!
    razonSocial: String!
    usoCFDI: String!
  }

  extend type Query {
    pedido(id: Int!, token: String): Pedido
    misPedidos: [Pedido!]!
    pedidos(estatus: String): [Pedido!]!
    reporteVentas(desde: String, hasta: String): ReporteVentas!
  }

  extend type Mutation {
    crearPedido(input: CrearPedidoInput!): Pedido!
    actualizarEstatusPedido(pedidoId: Int!, estatus: String!, nota: String): Pedido!
    solicitarCancelacion(pedidoId: Int!, motivo: String!): Pedido!
    resolverCancelacion(pedidoId: Int!, decision: String!): Pedido!
    asignarRepartidor(pedidoId: Int!, repartidorId: Int!): Pedido!
    actualizarTiempoEstimado(pedidoId: Int!, minutos: Int!): Pedido!
    canjearPuntos(pedidoId: Int!): Pedido!
    solicitarFactura(pedidoId: Int!, input: FacturaInput!): FacturaCFDI!
  }
`;
