/**
 * Service layer for staff (employee) management. All write operations are
 * intended to be called only from ADMIN-guarded resolvers.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { GraphQLError } from 'graphql';
import { PrismaClient, Rol } from '@prisma/client';
import { hashPassword } from '../lib/bcrypt.js';

const prisma = new PrismaClient();

const ROLES_STAFF: string[] = ['ADMIN', 'MAESTRO_PANADERO', 'CAJERO', 'REPARTIDOR'];

/**
 * Returns all staff users (any role except CLIENTE), ordered by creation date descending.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {Promise<Usuario[]>} Array of staff users.
 */
export async function listarEmpleados() {
  return prisma.usuario.findMany({
    where: { rol: { in: ROLES_STAFF as Rol[] } },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Creates a new staff user account with the supplied role. Rejects CLIENTE as a target
 * role and throws if the email is already taken.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {object} input - Employee data.
 * @param {string} input.nombre - Full name.
 * @param {string} input.email - Unique email.
 * @param {string} input.password - Plain-text password (will be hashed).
 * @param {string} [input.telefono] - Optional phone number.
 * @param {string} input.rol - Staff role (ADMIN, MAESTRO_PANADERO, CAJERO, REPARTIDOR).
 * @returns {Promise<Usuario>} The created user.
 * @throws {GraphQLError} ROL_INVALIDO if rol is not a staff role.
 * @throws {GraphQLError} EMAIL_DUPLICADO if the email is already registered.
 */
export async function crearEmpleado(input: {
  nombre: string;
  email: string;
  password: string;
  telefono?: string;
  rol: string;
}) {
  if (!ROLES_STAFF.includes(input.rol)) {
    throw new GraphQLError('Rol no permitido para empleados', {
      extensions: { code: 'ROL_INVALIDO' },
    });
  }

  const existe = await prisma.usuario.findUnique({ where: { email: input.email } });
  if (existe) {
    throw new GraphQLError('El correo ya está registrado', {
      extensions: { code: 'EMAIL_DUPLICADO' },
    });
  }

  const passwordHash = await hashPassword(input.password);
  return prisma.usuario.create({
    data: {
      nombre: input.nombre,
      email: input.email,
      passwordHash,
      telefono: input.telefono,
      rol: input.rol as Rol,
    },
  });
}

/**
 * Updates an existing employee's profile fields. Does not change their password.
 * Rejects CLIENTE as a target role and throws if the new email belongs to another user.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {number} id - ID of the employee to update.
 * @param {object} input - Updated fields.
 * @param {string} input.nombre - Full name.
 * @param {string} input.email - Email (must remain unique across other users).
 * @param {string} [input.telefono] - Optional phone number.
 * @param {string} input.rol - Staff role.
 * @returns {Promise<Usuario>} The updated user.
 * @throws {GraphQLError} ROL_INVALIDO if rol is not a staff role.
 * @throws {GraphQLError} EMAIL_DUPLICADO if the email belongs to another user.
 */
export async function actualizarEmpleado(
  id: number,
  input: { nombre: string; email: string; telefono?: string; rol: string },
) {
  if (!ROLES_STAFF.includes(input.rol)) {
    throw new GraphQLError('Rol no permitido para empleados', {
      extensions: { code: 'ROL_INVALIDO' },
    });
  }

  const otro = await prisma.usuario.findFirst({
    where: { email: input.email, NOT: { id } },
  });
  if (otro) {
    throw new GraphQLError('El correo ya está registrado', {
      extensions: { code: 'EMAIL_DUPLICADO' },
    });
  }

  return prisma.usuario.update({
    where: { id },
    data: {
      nombre: input.nombre,
      email: input.email,
      telefono: input.telefono ?? null,
      rol: input.rol as Rol,
    },
  });
}
