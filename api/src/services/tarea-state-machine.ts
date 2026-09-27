/**
 * Pure task state machine (no database access) that defines which status
 * transitions are valid and who may perform them.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { EstatusTarea } from '@prisma/client';

/**
 * Transition table: { from: [to...] }.
 * PROPUESTA transitions are restricted to ADMIN via puedeTransicionarTarea.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const transiciones: Partial<Record<EstatusTarea, EstatusTarea[]>> = {
  PROPUESTA: ['PENDIENTE', 'RECHAZADA'],
  PENDIENTE: ['EN_PROCESO', 'COMPLETADA', 'CANCELADA'],
  EN_PROCESO: ['COMPLETADA', 'CANCELADA'],
};

/** Terminal statuses from which no further transitions are allowed. */
const terminales: EstatusTarea[] = ['COMPLETADA', 'CANCELADA', 'RECHAZADA'];

/**
 * Checks whether a task may move from its current status to a new one,
 * taking the caller's role into account.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {EstatusTarea} actual - Current task status.
 * @param {EstatusTarea} nuevo - Requested new status.
 * @param {string} callerRol - Role of the user requesting the transition.
 * @returns {boolean} true if the transition is allowed, false otherwise.
 */
export function puedeTransicionarTarea(
  actual: EstatusTarea,
  nuevo: EstatusTarea,
  callerRol: string,
): boolean {
  if (terminales.includes(actual)) return false;
  if (actual === 'PROPUESTA' && callerRol !== 'ADMIN') return false;
  const permitidos = transiciones[actual] ?? [];
  return permitidos.includes(nuevo);
}
