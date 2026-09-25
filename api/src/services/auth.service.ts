/**
 * Authentication service: registration, login, token refresh and merging of guest
 * orders into a user account.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { GraphQLError } from 'graphql';
import { PrismaClient } from '@prisma/client';
import { hashPassword, compararPassword } from '../lib/bcrypt.js';
import { generarAccessToken, generarRefreshToken, verificarToken } from '../lib/jwt.js';

const prisma = new PrismaClient();

/**
 * Reassigns unowned guest orders to a user account, matching by guest token and/or
 * email, and clears `guestToken` so the old token no longer grants access.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {object} params - Merge parameters.
 * @param {number} params.usuarioId - ID of the account that will own the orders.
 * @param {string} [params.guestToken] - Guest token whose orders should be migrated.
 * @param {string} [params.email] - Email whose unowned orders should be migrated.
 * @returns {Promise<void>} Resolves when the update finishes (no-op if no criteria given).
 */
export async function mergeGuestOrders(params: {
  usuarioId: number;
  guestToken?: string;
  email?: string;
}) {
  const { usuarioId, guestToken, email } = params;
  const conditions = [];
  if (guestToken) conditions.push({ guestToken });
  if (email) conditions.push({ email, usuarioId: null });
  if (conditions.length === 0) return;

  await prisma.pedido.updateMany({
    where: { AND: [{ usuarioId: null }, { OR: conditions }] },
    data: { usuarioId, guestToken: null },
  });
}

/**
 * Registers a new CLIENTE account, hashes its password, merges previous guest orders
 * with the same email and issues a token pair.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {object} input - Registration data.
 * @param {string} input.nombre - Full name.
 * @param {string} input.email - Email (must be unique).
 * @param {string} input.password - Plain-text password.
 * @param {string} [input.telefono] - Phone number.
 * @returns {Promise<{ accessToken: string; refreshToken: string; usuario: Usuario }>} Auth payload.
 * @throws {GraphQLError} EMAIL_DUPLICADO if the email is already registered.
 */
export async function registrar(input: {
  nombre: string;
  email: string;
  password: string;
  telefono?: string;
}) {
  const existe = await prisma.usuario.findUnique({ where: { email: input.email } });
  if (existe) {
    throw new GraphQLError('El correo ya está registrado', {
      extensions: { code: 'EMAIL_DUPLICADO' },
    });
  }

  const passwordHash = await hashPassword(input.password);
  const usuario = await prisma.usuario.create({
    data: {
      nombre: input.nombre,
      email: input.email,
      passwordHash,
      telefono: input.telefono,
      rol: 'CLIENTE',
    },
  });

  // Automatically merge previous guest orders placed with the same email
  await mergeGuestOrders({ usuarioId: usuario.id, email: input.email });

  const payload = { usuarioId: usuario.id, rol: usuario.rol };
  return {
    accessToken: generarAccessToken(payload),
    refreshToken: generarRefreshToken(payload),
    usuario,
  };
}

/**
 * Authenticates a user by email and password. Returns the same generic error whether
 * the email exists or not, to avoid account enumeration.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string} email - User email.
 * @param {string} password - Plain-text password.
 * @returns {Promise<{ accessToken: string; refreshToken: string; usuario: Usuario }>} Auth payload.
 * @throws {GraphQLError} INVALID_CREDENTIALS if the credentials do not match.
 */
export async function login(email: string, password: string) {
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario) {
    throw new GraphQLError('Credenciales inválidas', {
      extensions: { code: 'INVALID_CREDENTIALS' },
    });
  }

  const valido = await compararPassword(password, usuario.passwordHash);
  if (!valido) {
    throw new GraphQLError('Credenciales inválidas', {
      extensions: { code: 'INVALID_CREDENTIALS' },
    });
  }

  const payload = { usuarioId: usuario.id, rol: usuario.rol };
  return {
    accessToken: generarAccessToken(payload),
    refreshToken: generarRefreshToken(payload),
    usuario,
  };
}

/**
 * Validates a refresh token and issues a new access/refresh token pair.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string} token - Refresh token (JWT).
 * @returns {Promise<{ accessToken: string; refreshToken: string; usuario: Usuario }>} New auth payload.
 * @throws {GraphQLError} TOKEN_INVALIDO if the token is invalid, expired or its user no longer exists.
 */
export async function refreshTokens(token: string) {
  let payload: ReturnType<typeof verificarToken>;
  try {
    payload = verificarToken(token, 'refresh');
  } catch {
    throw new GraphQLError('Token inválido o expirado', {
      extensions: { code: 'TOKEN_INVALIDO' },
    });
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: payload.usuarioId } });
  if (!usuario) {
    throw new GraphQLError('Usuario no encontrado', {
      extensions: { code: 'TOKEN_INVALIDO' },
    });
  }

  const newPayload = { usuarioId: usuario.id, rol: usuario.rol };
  return {
    accessToken: generarAccessToken(newPayload),
    refreshToken: generarRefreshToken(newPayload),
    usuario,
  };
}
