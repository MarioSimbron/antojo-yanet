/**
 * Unit tests for the JWT helpers: valid access/refresh tokens, tampered signatures and
 * using an access token as a refresh token.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { describe, it, expect } from 'vitest';
import { generarAccessToken, generarRefreshToken, verificarToken } from '../../src/lib/jwt';

const payload = { usuarioId: 1, rol: 'CLIENTE' };

describe('JWT', () => {
  it('genera y verifica un access token válido', () => {
    const token = generarAccessToken(payload);
    const result = verificarToken(token, 'access');
    expect(result.usuarioId).toBe(1);
    expect(result.rol).toBe('CLIENTE');
  });

  it('genera y verifica un refresh token válido', () => {
    const token = generarRefreshToken(payload);
    const result = verificarToken(token, 'refresh');
    expect(result.usuarioId).toBe(1);
  });

  it('lanza error con firma inválida', () => {
    const token = generarAccessToken(payload);
    expect(() => verificarToken(token + 'tampered', 'access')).toThrow();
  });

  it('lanza error usando access token como refresh', () => {
    const token = generarAccessToken(payload);
    expect(() => verificarToken(token, 'refresh')).toThrow();
  });
});
