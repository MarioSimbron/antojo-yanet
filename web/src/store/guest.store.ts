/**
 * Zustand store for the anonymous guest token (UUID v4), persisted in localStorage and
 * mirrored to the "guestToken" key read by the Apollo link.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

/**
 * Shape of the guest store.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @property {string} guestToken - Current guest token.
 * @property {Function} limpiarGuestToken - Replaces the token with a fresh one.
 */
interface GuestStore {
  guestToken: string;
  limpiarGuestToken: () => void;
}

/**
 * Guest store hook. Generates a token on first use and re-syncs it to localStorage
 * after rehydration.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {GuestStore} The guest token and its reset action.
 */
export const useGuestStore = create<GuestStore>()(
  persist(
    (set) => ({
      guestToken: uuidv4(),
      limpiarGuestToken: () => {
        const newToken = uuidv4();
        localStorage.setItem('guestToken', newToken);
        set({ guestToken: newToken });
      },
    }),
    {
      name: 'guest-store',
      onRehydrateStorage: () => (state) => {
        if (state) {
          localStorage.setItem('guestToken', state.guestToken);
        }
      },
    },
  ),
);
