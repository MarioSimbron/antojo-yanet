/**
 * In-memory chat history per session, truncated to the last 10 turns.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */

/**
 * A single chat message stored in a session history.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @property {'user' | 'assistant'} rol - Who sent the message.
 * @property {string} contenido - Message text.
 */
interface Mensaje {
  rol: 'user' | 'assistant';
  contenido: string;
}

const historiales = new Map<string, Mensaje[]>();
const MAX_TURNOS = 10;

/**
 * Appends a message to a session's history, keeping only the last MAX_TURNOS turns
 * (MAX_TURNOS × 2 messages).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string} sessionId - Chat session identifier.
 * @param {'user' | 'assistant'} rol - Who sent the message.
 * @param {string} contenido - Message text.
 * @returns {void}
 */
export function agregarMensaje(sessionId: string, rol: 'user' | 'assistant', contenido: string) {
  const historial = historiales.get(sessionId) ?? [];
  historial.push({ rol, contenido });
  if (historial.length > MAX_TURNOS * 2) {
    historial.splice(0, historial.length - MAX_TURNOS * 2);
  }
  historiales.set(sessionId, historial);
}

/**
 * Returns the stored history for a session.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string} sessionId - Chat session identifier.
 * @returns {Mensaje[]} The session messages, oldest first (empty if none).
 */
export function obtenerHistorial(sessionId: string): Mensaje[] {
  return historiales.get(sessionId) ?? [];
}
