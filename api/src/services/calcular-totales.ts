/**
 * Pure order-totals calculation (subtotal, delivery fee and deposit).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { GraphQLError } from 'graphql';

/**
 * Minimal order line needed to compute totals.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @property {number} cantidad - Quantity ordered.
 * @property {number} precioUnitario - Unit price in MXN.
 * @property {boolean} esEncargo - Whether the product is a custom (made-to-order) item.
 */
export interface ItemInput {
  cantidad: number;
  precioUnitario: number;
  esEncargo: boolean;
}

/**
 * Computed monetary totals for an order, all in MXN.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @property {number} subtotal - Sum of quantity × unit price.
 * @property {number} costoEnvio - Delivery fee ($30 for DOMICILIO, otherwise 0).
 * @property {number} total - Subtotal plus delivery fee.
 * @property {number} montoDeposito - Required deposit amount (custom orders only).
 * @property {number} porcentajeDeposito - Deposit percentage (50 or 0).
 */
export interface Totales {
  subtotal: number;
  costoEnvio: number;
  total: number;
  montoDeposito: number;
  porcentajeDeposito: number;
}

/**
 * Calculates order totals: subtotal, +$30 MXN for home delivery and a 50% deposit when
 * the order contains custom items. Amounts are rounded to 2 decimals.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {ItemInput[]} items - Order lines (must be all stock or all custom).
 * @param {'MOSTRADOR' | 'DOMICILIO'} tipoEntrega - Delivery type.
 * @returns {Totales} The computed totals.
 * @throws {GraphQLError} MEZCLA_NO_PERMITIDA if stock and custom items are mixed.
 */
export function calcularTotales(
  items: ItemInput[],
  tipoEntrega: 'MOSTRADOR' | 'DOMICILIO',
): Totales {
  const tieneEncargo = items.some((i) => i.esEncargo);
  const tieneStock = items.some((i) => !i.esEncargo);

  if (tieneEncargo && tieneStock) {
    throw new GraphQLError('No se pueden mezclar items de encargo y de stock en un mismo pedido', {
      extensions: { code: 'MEZCLA_NO_PERMITIDA' },
    });
  }

  const subtotal = items.reduce((acc, i) => acc + i.cantidad * i.precioUnitario, 0);
  const costoEnvio = tipoEntrega === 'DOMICILIO' ? 30 : 0;
  const baseTotal = subtotal + costoEnvio;

  let montoDeposito = 0;
  let porcentajeDeposito = 0;

  if (tieneEncargo) {
    porcentajeDeposito = 50;
    montoDeposito = Math.round((baseTotal * 0.5) * 100) / 100;
  }

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    costoEnvio,
    total: Math.round(baseTotal * 100) / 100,
    montoDeposito,
    porcentajeDeposito,
  };
}
