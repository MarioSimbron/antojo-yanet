/**
 * Pure order state machine (no database access) that defines which status
 * transitions are valid.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { EstatusPedido, TipoEntrega } from '@prisma/client';

/**
 * Transition table: { from: [to...] }.
 * SOLICITUD_CANCELACION is reachable from any non-terminal status.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const transiciones: Partial<Record<EstatusPedido, EstatusPedido[]>> = {
  PENDIENTE: ['EN_PREPARACION', 'SOLICITUD_CANCELACION', 'CANCELADO'],
  ESPERANDO_CONFIRMACION: ['EN_PREPARACION', 'SOLICITUD_CANCELACION', 'CANCELADO'],
  EN_PREPARACION: ['LISTO', 'SOLICITUD_CANCELACION'],
  LISTO: ['EN_CAMINO', 'ENTREGADO', 'SOLICITUD_CANCELACION'],
  EN_CAMINO: ['ENTREGADO', 'SOLICITUD_CANCELACION'],
  SOLICITUD_CANCELACION: ['CANCELADO', 'EN_PREPARACION', 'PENDIENTE', 'ESPERANDO_CONFIRMACION', 'LISTO', 'EN_CAMINO'],
};

/**
 * Terminal statuses: no further transitions are allowed from them.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const terminales: EstatusPedido[] = ['ENTREGADO', 'CANCELADO'];

/**
 * Extra order data needed to evaluate a transition.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @property {TipoEntrega} tipoEntrega - Delivery type (EN_CAMINO only applies to DOMICILIO).
 */
export interface ContextoTransicion {
  tipoEntrega: TipoEntrega;
}

/**
 * Checks whether an order may move from its current status to a new one.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {EstatusPedido} actual - Current order status.
 * @param {EstatusPedido} nuevo - Requested new status.
 * @param {ContextoTransicion} ctx - Order context (delivery type).
 * @returns {boolean} true if the transition is allowed, false otherwise.
 */
export function puedeTransicionar(
  actual: EstatusPedido,
  nuevo: EstatusPedido,
  ctx: ContextoTransicion,
): boolean {
  if (terminales.includes(actual)) return false;

  // EN_CAMINO only applies to home-delivery orders
  if (nuevo === 'EN_CAMINO' && ctx.tipoEntrega !== 'DOMICILIO') return false;

  const permitidos = transiciones[actual] ?? [];
  return permitidos.includes(nuevo);
}
