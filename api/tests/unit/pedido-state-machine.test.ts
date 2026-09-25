/**
 * Unit tests for the order state machine: valid stock and custom flows, EN_CAMINO only
 * for home delivery, and terminal statuses (ENTREGADO, CANCELADO).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { describe, it, expect } from 'vitest';
import { puedeTransicionar } from '../../src/services/pedido-state-machine';

const ctxMostrador = { tipoEntrega: 'MOSTRADOR' as const };
const ctxDomicilio = { tipoEntrega: 'DOMICILIO' as const };

describe('pedidoStateMachine', () => {
  it('PENDIENTE → EN_PREPARACION ✓', () => {
    expect(puedeTransicionar('PENDIENTE', 'EN_PREPARACION', ctxMostrador)).toBe(true);
  });

  it('PENDIENTE → SOLICITUD_CANCELACION ✓', () => {
    expect(puedeTransicionar('PENDIENTE', 'SOLICITUD_CANCELACION', ctxMostrador)).toBe(true);
  });

  it('LISTO → EN_CAMINO solo si DOMICILIO', () => {
    expect(puedeTransicionar('LISTO', 'EN_CAMINO', ctxMostrador)).toBe(false);
    expect(puedeTransicionar('LISTO', 'EN_CAMINO', ctxDomicilio)).toBe(true);
  });

  it('ENTREGADO es terminal — no permite transiciones', () => {
    expect(puedeTransicionar('ENTREGADO', 'CANCELADO', ctxMostrador)).toBe(false);
    expect(puedeTransicionar('ENTREGADO', 'EN_CAMINO', ctxDomicilio)).toBe(false);
  });

  it('CANCELADO es terminal', () => {
    expect(puedeTransicionar('CANCELADO', 'PENDIENTE', ctxMostrador)).toBe(false);
  });

  it('ESPERANDO_CONFIRMACION → EN_PREPARACION ✓', () => {
    expect(puedeTransicionar('ESPERANDO_CONFIRMACION', 'EN_PREPARACION', ctxMostrador)).toBe(true);
  });

  it('EN_PREPARACION → LISTO ✓', () => {
    expect(puedeTransicionar('EN_PREPARACION', 'LISTO', ctxMostrador)).toBe(true);
  });

  it('LISTO → ENTREGADO sin pasar por EN_CAMINO (mostrador) ✓', () => {
    expect(puedeTransicionar('LISTO', 'ENTREGADO', ctxMostrador)).toBe(true);
  });
});
