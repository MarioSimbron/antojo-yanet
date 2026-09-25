/**
 * Zustand store for the shopping cart, persisted in localStorage under "carrito".
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * A product line in the cart.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @property {number} productoId - Product ID.
 * @property {string} nombre - Product name.
 * @property {number} precio - Unit price in MXN.
 * @property {number} cantidad - Quantity.
 * @property {boolean} esEncargo - Whether the product is made-to-order.
 * @property {string} [imagenUrl] - Product image URL.
 */
export interface ItemCarrito {
  productoId: number;
  nombre: string;
  precio: number;
  cantidad: number;
  esEncargo: boolean;
  imagenUrl?: string;
}

/**
 * Shape of the cart store: items plus their actions.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @property {ItemCarrito[]} items - Items in the cart.
 * @property {Function} agregarItem - Adds a product or increments its quantity (by 1 unless
 *   a quantity is given).
 * @property {Function} quitarItem - Removes a product from the cart.
 * @property {Function} actualizarCantidad - Sets a quantity (≤ 0 removes the item).
 * @property {Function} limpiarCarrito - Empties the cart.
 * @property {Function} calcularSubtotal - Returns the sum of price × quantity.
 */
interface CarritoStore {
  items: ItemCarrito[];
  agregarItem: (item: Omit<ItemCarrito, 'cantidad'>, cantidad?: number) => void;
  quitarItem: (productoId: number) => void;
  actualizarCantidad: (productoId: number, cantidad: number) => void;
  limpiarCarrito: () => void;
  calcularSubtotal: () => number;
}

/**
 * Cart store hook.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {CarritoStore} The cart state and actions.
 */
export const useCarritoStore = create<CarritoStore>()(
  persist(
    (set, get) => ({
      items: [],
      agregarItem: (item, cantidad = 1) => {
        const items = get().items;
        const existente = items.find((i) => i.productoId === item.productoId);
        if (existente) {
          set({
            items: items.map((i) =>
              i.productoId === item.productoId ? { ...i, cantidad: i.cantidad + cantidad } : i,
            ),
          });
        } else {
          set({ items: [...items, { ...item, cantidad }] });
        }
      },
      quitarItem: (productoId) =>
        set({ items: get().items.filter((i) => i.productoId !== productoId) }),
      actualizarCantidad: (productoId, cantidad) => {
        if (cantidad <= 0) {
          set({ items: get().items.filter((i) => i.productoId !== productoId) });
        } else {
          set({
            items: get().items.map((i) =>
              i.productoId === productoId ? { ...i, cantidad } : i,
            ),
          });
        }
      },
      limpiarCarrito: () => set({ items: [] }),
      calcularSubtotal: () =>
        get().items.reduce((acc, i) => acc + i.precio * i.cantidad, 0),
    }),
    { name: 'carrito' },
  ),
);

/**
 * Splits the cart into stock items and made-to-order items, since each group must be
 * sent as a separate order.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {ItemCarrito[]} items - Cart items.
 * @returns {{ itemsStock: ItemCarrito[]; itemsEncargo: ItemCarrito[] }} The two groups.
 */
export function separarCarrito(items: ItemCarrito[]) {
  return {
    itemsStock: items.filter((i) => !i.esEncargo),
    itemsEncargo: items.filter((i) => i.esEncargo),
  };
}
