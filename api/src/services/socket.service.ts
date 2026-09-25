/**
 * Socket.IO service: socket authentication, per-order rooms and real-time event emission.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { Server as IOServer, Socket } from 'socket.io';
import http from 'http';
import { verificarToken } from '../lib/jwt.js';
import { verificarOwnership } from './pedido.service.js';
import { PrismaClient } from '@prisma/client';
import { registrarEmitter } from './pedido.service.js';

const prisma = new PrismaClient();

/**
 * Starts Socket.IO on the existing HTTP server. Authenticates each handshake with a JWT
 * or guest token, handles `join_pedido` with the shared ownership check and registers
 * the emitter used by the order service.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {http.Server} server - HTTP server shared with Express.
 * @returns {IOServer} The configured Socket.IO server.
 */
export function iniciarSocketIO(server: http.Server): IOServer {
  const io = new IOServer(server, {
    cors: { origin: process.env.CORS_ORIGIN, methods: ['GET', 'POST'] },
  });

  // Socket authentication middleware
  io.use((socket, next) => {
    const auth = socket.handshake.auth;
    const token: string = auth.token ?? '';
    const guestToken: string = auth.guestToken ?? '';

    if (token) {
      try {
        const payload = verificarToken(token, 'access');
        socket.data.usuario = payload;
        return next();
      } catch {
        // invalid token, fall through to check for a guestToken
      }
    }

    if (guestToken) {
      socket.data.guestToken = guestToken;
      return next();
    }

    return next(new Error('Autenticación requerida'));
  });

  io.on('connection', (socket: Socket) => {
    socket.on('join_pedido', async (pedidoId: number) => {
      const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId } });
      if (!pedido) {
        socket.emit('error', 'Pedido no encontrado');
        return;
      }
      if (!verificarOwnership(pedido, socket.data.usuario, socket.data.guestToken)) {
        socket.emit('error', 'No tienes acceso a este pedido');
        return;
      }
      socket.join(`pedido:${pedidoId}`);
    });

    socket.on('disconnect', () => {
      // The socket leaves all rooms automatically on disconnect
    });
  });

  // Register the emitter function in the order service
  registrarEmitter((evento, room, data) => {
    io.to(room).emit(evento, data);
  });

  return io;
}

/**
 * Emits a `chat:nueva_respuesta` event with an assistant reply to a room.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {IOServer} io - Socket.IO server.
 * @param {string} destino - Target room (order or chat session).
 * @param {Record<string, unknown>} payload - Reply payload.
 * @returns {void}
 */
export function emitirRespuestaChat(
  io: IOServer,
  destino: string,
  payload: Record<string, unknown>,
) {
  io.to(destino).emit('chat:nueva_respuesta', payload);
}
