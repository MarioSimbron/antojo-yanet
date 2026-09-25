/**
 * Zustand store for the authenticated session, persisted in localStorage.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Authenticated user data kept on the client.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @property {number} id - User ID.
 * @property {string} nombre - Full name.
 * @property {string} email - Email.
 * @property {string} rol - Role (ADMIN, CAJERO, CLIENTE, ...).
 * @property {number} puntosSaldo - Loyalty points balance.
 */
interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  puntosSaldo: number;
}

/**
 * Shape of the auth store: session state plus its actions.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @property {Usuario | null} usuario - Current user, or null when logged out.
 * @property {string | null} accessToken - JWT access token.
 * @property {string | null} refreshToken - JWT refresh token.
 * @property {Function} login - Saves the session after a successful login/registration.
 * @property {Function} logout - Clears the session, guest token and cart.
 * @property {Function} setUsuario - Replaces the stored user data.
 */
interface AuthStore {
  usuario: Usuario | null;
  accessToken: string | null;
  refreshToken: string | null;
  login: (data: { usuario: Usuario; accessToken: string; refreshToken: string }) => void;
  logout: () => void;
  setUsuario: (usuario: Usuario) => void;
}

/**
 * Auth store hook. `login` also mirrors the access token to localStorage for the Apollo
 * link; `logout` removes the access token, guest token and cart (the cart is kept on login).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {AuthStore} The store state and actions.
 */
export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      usuario: null,
      accessToken: null,
      refreshToken: null,
      login: ({ usuario, accessToken, refreshToken }) => {
        localStorage.setItem('accessToken', accessToken);
        set({ usuario, accessToken, refreshToken });
      },
      logout: () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('guestToken');
        localStorage.removeItem('carrito');
        set({ usuario: null, accessToken: null, refreshToken: null });
      },
      setUsuario: (usuario) => set({ usuario }),
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({
        usuario: state.usuario,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    },
  ),
);
