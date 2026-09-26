/**
 * React hook for the real-time Socket.IO connection.
 *
 * Handles three reliability concerns:
 *  1. Reconnection after token refresh — when Apollo silently refreshes the JWT,
 *     `accessToken` in the auth store changes, the effect re-runs, a new Socket.IO
 *     connection is created with the fresh token, and we automatically re-join ALL
 *     tracked rooms and re-register any active event callbacks.
 *  2. Race-condition on first connection — `unirseAPedido` checks the Set before
 *     emitting so the `join_pedido` event is sent exactly once per unique room;
 *     the `connect` handler re-emits all tracked rooms on every (re)connection.
 *  3. Listener continuity — callbacks stored in refs are re-registered on every new
 *     socket instance, so callers never need to know when the socket was recreated.
 *
 * Multiple rooms are supported — callers may call `unirseAPedido` for as many order
 * IDs as needed (e.g. from a list page); each is remembered and re-joined on reconnect.
 *
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {{ unirseAPedido, onEstadoActualizado, onRepartidorAsignado }}
 */
import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/auth.store';
import { useGuestStore } from '../store/guest.store';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:4000';

type EstadoPayload = { pedidoId: number; estatusNuevo: string; timestamp: string };
type RepartidorPayload = { pedidoId: number; nombreRepartidor: string };

/**
 * Opens a Socket.IO connection authenticated with the JWT or guest token, reconnecting
 * automatically when either token changes. Tracks all joined order rooms in a Set so
 * they can be re-joined on each new connection. Active event callbacks are persisted
 * in refs and re-registered on every new socket instance.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {{ unirseAPedido: Function; onEstadoActualizado: Function; onRepartidorAsignado: Function }}
 *   - unirseAPedido(pedidoId): emits `join_pedido` once per unique ID; re-emitted on reconnect.
 *   - onEstadoActualizado(callback): subscribes to `pedido:estado_actualizado`; returns unsubscribe fn.
 *   - onRepartidorAsignado(callback): subscribes to `pedido:asignado_repartidor`; returns unsubscribe fn.
 */
export function useSocket() {
  const socketRef = useRef<Socket | null>(null);

  // All rooms this socket instance should be in. A Set prevents duplicate joins.
  const joinedRoomsRef = useRef<Set<number>>(new Set());

  // Persist active callbacks so they can be re-registered on a new socket instance.
  const estadoCallbackRef = useRef<((data: EstadoPayload) => void) | null>(null);
  const repartidorCallbackRef = useRef<((data: RepartidorPayload) => void) | null>(null);

  const { accessToken } = useAuthStore();
  const { guestToken } = useGuestStore();

  useEffect(() => {
    const socket = io(WS_URL, {
      autoConnect: true,
      auth: {
        token: accessToken ?? undefined,
        guestToken: guestToken ?? undefined,
      },
    });

    // On every (re)connection, re-join all rooms the caller has registered.
    socket.on('connect', () => {
      joinedRoomsRef.current.forEach((id) => {
        socket.emit('join_pedido', id);
      });
    });

    // Re-register any callbacks that were active before this socket was created.
    if (estadoCallbackRef.current) {
      socket.on('pedido:estado_actualizado', estadoCallbackRef.current);
    }
    if (repartidorCallbackRef.current) {
      socket.on('pedido:asignado_repartidor', repartidorCallbackRef.current);
    }

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [accessToken, guestToken]);

  /**
   * Joins the Socket.IO room for the given order. Emits `join_pedido` only the first
   * time (subsequent calls for the same ID are no-ops). The ID is kept in the Set so
   * it is automatically re-joined after any reconnection.
   * @param {number} pedidoId - Order ID whose room to join.
   */
  const unirseAPedido = useCallback((pedidoId: number) => {
    if (joinedRoomsRef.current.has(pedidoId)) return;
    joinedRoomsRef.current.add(pedidoId);
    socketRef.current?.emit('join_pedido', pedidoId);
  }, []);

  /**
   * Subscribes to the `pedido:estado_actualizado` event. The callback is stored in a
   * ref so it survives socket recreations; the returned function unsubscribes.
   * @param {(data: EstadoPayload) => void} callback - Handler called on each event.
   * @returns {() => void} Unsubscribe function.
   */
  const onEstadoActualizado = useCallback(
    (callback: (data: EstadoPayload) => void) => {
      estadoCallbackRef.current = callback;
      socketRef.current?.on('pedido:estado_actualizado', callback);
      return () => {
        estadoCallbackRef.current = null;
        socketRef.current?.off('pedido:estado_actualizado', callback);
      };
    },
    [],
  );

  /**
   * Subscribes to the `pedido:asignado_repartidor` event. The callback is stored in a
   * ref so it survives socket recreations; the returned function unsubscribes.
   * @param {(data: RepartidorPayload) => void} callback - Handler called on each event.
   * @returns {() => void} Unsubscribe function.
   */
  const onRepartidorAsignado = useCallback(
    (callback: (data: RepartidorPayload) => void) => {
      repartidorCallbackRef.current = callback;
      socketRef.current?.on('pedido:asignado_repartidor', callback);
      return () => {
        repartidorCallbackRef.current = null;
        socketRef.current?.off('pedido:asignado_repartidor', callback);
      };
    },
    [],
  );

  return { unirseAPedido, onEstadoActualizado, onRepartidorAsignado };
}
