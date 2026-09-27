/**
 * Web Push notification service. Wraps the web-push library with VAPID credentials
 * from environment variables and provides helpers to notify a role, a single user,
 * or a guest. All helpers also persist the notification to the database so the
 * in-app notification center can display it.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import webPush from 'web-push';
import { PrismaClient, Rol } from '@prisma/client';

const prisma = new PrismaClient();

webPush.setVapidDetails(
  process.env.VAPID_EMAIL ?? 'mailto:admin@example.com',
  process.env.VAPID_PUBLIC_KEY ?? '',
  process.env.VAPID_PRIVATE_KEY ?? '',
);

/**
 * Payload sent inside every push notification.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @property {string} titulo - Notification title.
 * @property {string} cuerpo - Notification body.
 * @property {string} [url] - Optional URL to open when the notification is clicked.
 * @property {object} [data] - Extra data forwarded to the service worker.
 */
export interface PushPayload {
  titulo: string;
  cuerpo: string;
  url?: string;
  data?: Record<string, unknown>;
}

/**
 * Injected by socket.service.ts to emit socket events without creating a circular
 * import between push.ts and socket.service.ts.
 */
let emitNotificacionFn: ((room: string, data: unknown) => void) | null = null;

/**
 * Registers the function used to broadcast `notificacion:nueva` events via Socket.IO.
 * Must be called once from socket.service.ts after the IO server is created.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {((room: string, data: unknown) => void) | null} fn - Emitter function.
 * @returns {void}
 */
export function registrarNotificacionEmitter(
  fn: ((room: string, data: unknown) => void) | null,
): void {
  emitNotificacionFn = fn;
}

/**
 * Sends a Web Push notification to every subscription belonging to users with the
 * given role and persists one Notificacion record per user so the in-app center
 * can display it. Expired or invalid push subscriptions are silently skipped.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {Rol} rol - Target role (e.g. 'ADMIN', 'MAESTRO_PANADERO').
 * @param {PushPayload} payload - Notification content.
 * @returns {Promise<void>}
 */
export async function notificarRol(rol: Rol, payload: PushPayload): Promise<void> {
  const usuarios = await prisma.usuario.findMany({
    where: { rol },
    select: { id: true, pushSubscriptions: true },
  });

  // Persist one Notificacion per user and emit to their personal socket room
  await Promise.all(
    usuarios.map(async (u) => {
      const notificacion = await prisma.notificacion.create({
        data: {
          usuarioId: u.id,
          titulo: payload.titulo,
          cuerpo: payload.cuerpo,
          url: payload.url ?? null,
        },
      });
      emitNotificacionFn?.(`usuario:${u.id}`, notificacion);
    }),
  );

  // Web push — only for users who have active subscriptions (existing behavior)
  const allSubs = usuarios.flatMap((u) => u.pushSubscriptions);
  const results = await Promise.allSettled(
    allSubs.map((s) =>
      webPush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
      ),
    ),
  );
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`[push] notificarRol(${rol}) sub[${allSubs[i]?.id}] failed:`, r.reason);
    }
  });
}

/**
 * Sends a Web Push notification to every subscription belonging to a specific user
 * and persists a Notificacion record so the in-app center can display it.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {number} usuarioId - Target user ID.
 * @param {PushPayload} payload - Notification content.
 * @returns {Promise<void>}
 */
export async function notificarUsuario(usuarioId: number, payload: PushPayload): Promise<void> {
  // Persist and emit to personal room
  const notificacion = await prisma.notificacion.create({
    data: {
      usuarioId,
      titulo: payload.titulo,
      cuerpo: payload.cuerpo,
      url: payload.url ?? null,
    },
  });
  emitNotificacionFn?.(`usuario:${usuarioId}`, notificacion);

  // Web push (existing behavior)
  const subs = await prisma.pushSubscription.findMany({ where: { usuarioId } });
  const results = await Promise.allSettled(
    subs.map((s) =>
      webPush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
      ),
    ),
  );
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`[push] notificarUsuario(${usuarioId}) sub[${subs[i]?.id}] failed:`, r.reason);
    }
  });
}

/**
 * Persists a notification for a guest user identified by their guest token and emits
 * a socket event to the order room the guest has already joined via `join_pedido`.
 * Guests never receive Web Push; the in-app notification center is their only channel.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string} guestToken - Guest token stored on the order.
 * @param {number} pedidoId - Order ID used to target socket room `pedido:<id>`.
 * @param {PushPayload} payload - Notification content.
 * @returns {Promise<void>}
 */
export async function notificarGuest(
  guestToken: string,
  pedidoId: number,
  payload: PushPayload,
): Promise<void> {
  const notificacion = await prisma.notificacion.create({
    data: {
      guestToken,
      titulo: payload.titulo,
      cuerpo: payload.cuerpo,
      url: payload.url ?? null,
    },
  });
  // Guests join the pedido room, so we emit there
  emitNotificacionFn?.(`pedido:${pedidoId}`, notificacion);
}
