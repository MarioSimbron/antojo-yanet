/**
 * Hook that registers the service worker, requests push notification permission and
 * saves the PushSubscription to the API. Must only be called for authenticated staff
 * users (the API endpoint requires a valid JWT).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/auth.store';

const API_BASE = (import.meta.env.VITE_API_URL as string)?.replace('/graphql', '') ?? 'http://localhost:4000';
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

/**
 * Converts a base64url-encoded VAPID public key string to a Uint8Array suitable for
 * the PushManager.subscribe() applicationServerKey parameter.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string} base64String - Base64url-encoded VAPID public key.
 * @returns {Uint8Array} The decoded key bytes.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/**
 * Registers the push service worker, requests notification permission and sends the
 * resulting PushSubscription to the API. Runs once per component mount.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {void}
 */
export function usePushNotifications(): void {
  const accessToken = useAuthStore((s) => s.accessToken);
  const registrado = useRef(false);

  useEffect(() => {
    if (!accessToken || registrado.current) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (!VAPID_PUBLIC_KEY) return;

    registrado.current = true;

    const registrar = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        await navigator.serviceWorker.ready;

        const keyBytes = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer,
        });

        const subJson = sub.toJSON();
        await fetch(`${API_BASE}/push/suscribir`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({
            endpoint: subJson.endpoint,
            keys: { p256dh: subJson.keys?.p256dh, auth: subJson.keys?.auth },
          }),
        });
      } catch {
        // Push setup is best-effort — failures do not affect the app
      }
    };

    void registrar();
  }, [accessToken]);
}
