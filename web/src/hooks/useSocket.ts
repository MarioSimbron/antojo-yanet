/**
 * React hook for the real-time Socket.IO connection.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/auth.store';
import { useGuestStore } from '../store/guest.store';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:4000';

/**
 * Opens a Socket.IO connection authenticated with the JWT or guest token (reconnecting
 * when either changes) and exposes helpers to join an order room and subscribe to its events.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {{ unirseAPedido: Function; onEstadoActualizado: Function; onRepartidorAsignado: Function }}
 *   - unirseAPedido(pedidoId): emits `join_pedido` for the given order.
 *   - onEstadoActualizado(callback): subscribes to `pedido:estado_actualizado`; returns an unsubscribe function.
 *   - onRepartidorAsignado(callback): subscribes to `pedido:asignado_repartidor`; returns an unsubscribe function.
 */
export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
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
    socketRef.current = socket;
    return () => {
      socket.disconnect();
    };
  }, [accessToken, guestToken]);

  const unirseAPedido = useCallback((pedidoId: number) => {
    socketRef.current?.emit('join_pedido', pedidoId);
  }, []);

  const onEstadoActualizado = useCallback(
    (callback: (data: { pedidoId: number; estatusNuevo: string; timestamp: string }) => void) => {
      socketRef.current?.on('pedido:estado_actualizado', callback);
      return () => {
        socketRef.current?.off('pedido:estado_actualizado', callback);
      };
    },
    [],
  );

  const onRepartidorAsignado = useCallback(
    (callback: (data: { pedidoId: number; nombreRepartidor: string }) => void) => {
      socketRef.current?.on('pedido:asignado_repartidor', callback);
      return () => {
        socketRef.current?.off('pedido:asignado_repartidor', callback);
      };
    },
    [],
  );

  return { unirseAPedido, onEstadoActualizado, onRepartidorAsignado };
}
