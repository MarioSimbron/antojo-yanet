/**
 * GraphQL type definitions for the in-app notification center.
 * Supports both authenticated users (JWT) and guests (X-Guest-Token header).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
export const notificacionTypeDefs = `#graphql
  type Notificacion {
    id: Int!
    titulo: String!
    cuerpo: String!
    url: String
    leida: Boolean!
    creadaEn: String!
  }

  extend type Query {
    """
    Returns the last 50 notifications for the calling user (JWT) or guest (X-Guest-Token).
    Pass soloNoLeidas: true to retrieve only unread entries.
    """
    misNotificaciones(soloNoLeidas: Boolean): [Notificacion!]!
  }

  extend type Mutation {
    """Marks a single notification as read. Returns false when not found or not owned."""
    marcarLeida(id: Int!): Boolean!

    """Marks every unread notification as read for the current user or guest."""
    marcarTodasLeidas: Boolean!
  }
`;
