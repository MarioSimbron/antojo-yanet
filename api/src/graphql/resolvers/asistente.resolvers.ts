/**
 * GraphQL resolvers for the AI assistant.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { GraphQLContext } from '../../middleware/auth.js';
import { procesarMensajeChat } from '../../services/asistente.service.js';

/**
 * Resolver map for the assistant module.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
export const asistenteResolvers = {
  Mutation: {
    /**
     * Sends a message to DulceBot and returns her reply plus the UI action to perform.
     * Works for guests and authenticated users.
     * @author Mario Simbron Gonzalez <simbron420@gmail.com>
     * @param {unknown} _ - Parent (unused).
     * @param {{ mensaje: string; sessionId: string }} args - User message and chat session ID.
     * @param {GraphQLContext} ctx - Resolver context (user and/or guest token).
     * @returns {Promise<RespuestaChat>} Reply text, action, optional datosEncargo,
     *   itemsCarrito (products to add to the cart) and pedidoId.
     */
    chatAsistente: async (
      _: unknown,
      { mensaje, sessionId }: { mensaje: string; sessionId: string },
      ctx: GraphQLContext,
    ) => {
      const { respuesta, accion, datosEncargo, itemsCarrito, pedidoId, fuentesUsadas } =
        await procesarMensajeChat(mensaje, sessionId, ctx.usuario, ctx.guestToken);
      return {
        respuesta,
        accion,
        datosEncargo: datosEncargo ?? null,
        itemsCarrito: itemsCarrito ?? null,
        pedidoId: pedidoId ?? null,
        fuentesUsadas: fuentesUsadas ?? null,
      };
    },
  },
};
