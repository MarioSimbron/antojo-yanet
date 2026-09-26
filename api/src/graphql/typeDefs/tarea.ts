/**
 * GraphQL type definitions for the production-task module.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
export const tareaTypeDefs = `#graphql
  enum EstatusTarea {
    PENDIENTE
    EN_PROCESO
    COMPLETADA
    CANCELADA
  }

  type TareaProduccion {
    id: Int!
    productoId: Int!
    producto: Producto!
    cantidadSolicitada: Int!
    cantidadProducida: Int
    estatus: EstatusTarea!
    notas: String
    asignadoPorId: Int!
    createdAt: String!
    updatedAt: String!
  }

  input CrearTareaInput {
    productoId: Int!
    cantidadSolicitada: Int!
    notas: String
  }

  input ActualizarTareaInput {
    estatus: EstatusTarea!
    cantidadProducida: Int
  }

  extend type Query {
    """Lista todas las tareas de producción (ADMIN/CAJERO)."""
    tareas: [TareaProduccion!]!
    """Lista las tareas asignadas al maestro panadero autenticado."""
    misTareas: [TareaProduccion!]!
  }

  extend type Mutation {
    """Crea una tarea de producción y notifica al maestro panadero (ADMIN only)."""
    crearTarea(input: CrearTareaInput!): TareaProduccion!
    """El maestro actualiza el estatus de una tarea suya (EN_PROCESO o COMPLETADA)."""
    actualizarTarea(id: Int!, input: ActualizarTareaInput!): TareaProduccion!
    """Admin cancela una tarea pendiente."""
    cancelarTarea(id: Int!): TareaProduccion!
  }
`;
