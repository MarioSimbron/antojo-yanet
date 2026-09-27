/**
 * JWT helpers for issuing and verifying access and refresh tokens. Secrets and
 * expirations come from environment variables (defaults: 15m / 7d).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import jwt from 'jsonwebtoken';

/**
 * Claims stored inside every token.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @property {number} usuarioId - User ID.
 * @property {string} rol - User role.
 */
export interface TokenPayload {
  usuarioId: number;
  rol: string;
}

const accessSecret = () => process.env.JWT_SECRET ?? 'dev_secret_access';
const refreshSecret = () => process.env.JWT_REFRESH_SECRET ?? 'dev_secret_refresh';
const accessExpires = () => process.env.JWT_ACCESS_EXPIRES ?? '4h';
const refreshExpires = () => process.env.JWT_REFRESH_EXPIRES ?? '7d';

/**
 * Signs a short-lived access token.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {TokenPayload} payload - Claims to embed.
 * @returns {string} The signed JWT.
 */
export function generarAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, accessSecret(), { expiresIn: accessExpires() } as jwt.SignOptions);
}

/**
 * Signs a long-lived refresh token with a separate secret.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {TokenPayload} payload - Claims to embed.
 * @returns {string} The signed JWT.
 */
export function generarRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, refreshSecret(), { expiresIn: refreshExpires() } as jwt.SignOptions);
}

/**
 * Verifies a token's signature and expiration using the secret for its type.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string} token - JWT to verify.
 * @param {'access' | 'refresh'} tipo - Token type, selects the secret.
 * @returns {TokenPayload} The decoded claims.
 * @throws {Error} If the token is invalid or expired.
 */
export function verificarToken(token: string, tipo: 'access' | 'refresh'): TokenPayload {
  const secret = tipo === 'access' ? accessSecret() : refreshSecret();
  return jwt.verify(token, secret) as TokenPayload;
}
