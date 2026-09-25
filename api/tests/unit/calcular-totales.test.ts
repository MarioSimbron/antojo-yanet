/**
 * Unit tests for calcularTotales: stock-only, home delivery fee, 50% deposit on custom
 * orders and rejection of mixed stock/custom carts.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { describe, it, expect } from 'vitest';
import { calcularTotales } from '../../src/services/calcular-totales';

describe('calcularTotales', () => {
  it('solo stock, mostrador — sin envío ni depósito', () => {
    const r = calcularTotales(
      [{ cantidad: 2, precioUnitario: 18, esEncargo: false }],
      'MOSTRADOR',
    );
    expect(r.subtotal).toBe(36);
    expect(r.costoEnvio).toBe(0);
    expect(r.total).toBe(36);
    expect(r.montoDeposito).toBe(0);
  });

  it('solo stock, domicilio — agrega $30', () => {
    const r = calcularTotales(
      [{ cantidad: 1, precioUnitario: 100, esEncargo: false }],
      'DOMICILIO',
    );
    expect(r.total).toBe(130);
    expect(r.costoEnvio).toBe(30);
  });

  it('solo encargo — calcula depósito 50%', () => {
    const r = calcularTotales(
      [{ cantidad: 1, precioUnitario: 450, esEncargo: true }],
      'MOSTRADOR',
    );
    expect(r.montoDeposito).toBe(225);
    expect(r.porcentajeDeposito).toBe(50);
  });

  it('mezcla stock + encargo — lanza MEZCLA_NO_PERMITIDA', () => {
    expect(() =>
      calcularTotales(
        [
          { cantidad: 1, precioUnitario: 18, esEncargo: false },
          { cantidad: 1, precioUnitario: 450, esEncargo: true },
        ],
        'MOSTRADOR',
      ),
    ).toThrow('MEZCLA_NO_PERMITIDA');
  });
});
