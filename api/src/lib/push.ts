/**
 * Web Push notification service. Wraps the web-push library with VAPID credentials
 * from environment variables and provides helpers to notify a role or a single user.
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
 * Sends a Web Push notification to every subscription belonging to users with the
 * given role. Expired or invalid subscriptions are silently skipped.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {Rol} rol - Target role (e.g. 'ADMIN', 'MAESTRO_PANADERO').
 * @param {PushPayload} payload - Notification content.
 * @returns {Promise<void>}
 */
export async function notificarRol(rol: Rol, payload: PushPayload): Promise<void> {
  const subs = await prisma.pushSubscription.findMany({
    where: { usuario: { rol } },
  });
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
      console.error(`[push] notificarRol(${rol}) sub[${subs[i]?.id}] failed:`, r.reason);
    }
  });
}

/**
 * Sends a Web Push notification to every subscription belonging to a specific user.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {number} usuarioId - Target user ID.
 * @param {PushPayload} payload - Notification content.
 * @returns {Promise<void>}
 */
export async function notificarUsuario(usuarioId: number, payload: PushPayload): Promise<void> {
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
