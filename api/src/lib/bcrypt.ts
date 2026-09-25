/**
 * Password hashing helpers built on bcryptjs.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import bcrypt from 'bcryptjs';

/**
 * Hashes a plain-text password with bcrypt (10 salt rounds).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string} plain - Plain-text password.
 * @returns {Promise<string>} The bcrypt hash.
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

/**
 * Compares a plain-text password against a stored bcrypt hash.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string} plain - Plain-text password to check.
 * @param {string} hash - Stored bcrypt hash.
 * @returns {Promise<boolean>} true if the password matches the hash.
 */
export async function compararPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
