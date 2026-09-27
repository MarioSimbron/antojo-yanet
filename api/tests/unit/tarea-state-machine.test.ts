/**
 * Unit tests for the task state machine: valid transitions, role guards,
 * terminal states, and the proposal approval/rejection workflow (Feature B).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { describe, it, expect } from 'vitest';
import { puedeTransicionarTarea } from '../../src/services/tarea-state-machine';

describe('tareaStateMachine', () => {
  // ── Admin-created tasks (start as PENDIENTE) ─────────────────────────────

  it('PENDIENTE → EN_PROCESO ✓ (admin)', () => {
    expect(puedeTransicionarTarea('PENDIENTE', 'EN_PROCESO', 'ADMIN')).toBe(true);
  });

  it('PENDIENTE → EN_PROCESO ✓ (panadero starting their own task)', () => {
    expect(puedeTransicionarTarea('PENDIENTE', 'EN_PROCESO', 'MAESTRO_PANADERO')).toBe(true);
  });

  it('PENDIENTE → COMPLETADA ✓ (skip EN_PROCESO)', () => {
    expect(puedeTransicionarTarea('PENDIENTE', 'COMPLETADA', 'MAESTRO_PANADERO')).toBe(true);
  });

  it('PENDIENTE → CANCELADA ✓ (admin cancels)', () => {
    expect(puedeTransicionarTarea('PENDIENTE', 'CANCELADA', 'ADMIN')).toBe(true);
  });

  it('EN_PROCESO → COMPLETADA ✓', () => {
    expect(puedeTransicionarTarea('EN_PROCESO', 'COMPLETADA', 'MAESTRO_PANADERO')).toBe(true);
  });

  it('EN_PROCESO → CANCELADA ✓', () => {
    expect(puedeTransicionarTarea('EN_PROCESO', 'CANCELADA', 'ADMIN')).toBe(true);
  });

  // ── Proposal workflow (Feature B) ────────────────────────────────────────

  it('PROPUESTA → PENDIENTE ✓ (admin approves)', () => {
    expect(puedeTransicionarTarea('PROPUESTA', 'PENDIENTE', 'ADMIN')).toBe(true);
  });

  it('PROPUESTA → RECHAZADA ✓ (admin rejects)', () => {
    expect(puedeTransicionarTarea('PROPUESTA', 'RECHAZADA', 'ADMIN')).toBe(true);
  });

  it('PROPUESTA → PENDIENTE ✗ (panadero cannot approve own proposal)', () => {
    expect(puedeTransicionarTarea('PROPUESTA', 'PENDIENTE', 'MAESTRO_PANADERO')).toBe(false);
  });

  it('PROPUESTA → RECHAZADA ✗ (panadero cannot reject own proposal)', () => {
    expect(puedeTransicionarTarea('PROPUESTA', 'RECHAZADA', 'MAESTRO_PANADERO')).toBe(false);
  });

  // ── Terminal states ───────────────────────────────────────────────────────

  it('COMPLETADA is terminal — no further transitions', () => {
    expect(puedeTransicionarTarea('COMPLETADA', 'PENDIENTE', 'ADMIN')).toBe(false);
    expect(puedeTransicionarTarea('COMPLETADA', 'EN_PROCESO', 'ADMIN')).toBe(false);
  });

  it('CANCELADA is terminal', () => {
    expect(puedeTransicionarTarea('CANCELADA', 'PENDIENTE', 'ADMIN')).toBe(false);
    expect(puedeTransicionarTarea('CANCELADA', 'EN_PROCESO', 'MAESTRO_PANADERO')).toBe(false);
  });

  it('RECHAZADA is terminal', () => {
    expect(puedeTransicionarTarea('RECHAZADA', 'PENDIENTE', 'ADMIN')).toBe(false);
    expect(puedeTransicionarTarea('RECHAZADA', 'PROPUESTA', 'ADMIN')).toBe(false);
  });

  // ── Invalid forward skips ─────────────────────────────────────────────────

  it('EN_PROCESO → PENDIENTE ✗ (cannot go backwards)', () => {
    expect(puedeTransicionarTarea('EN_PROCESO', 'PENDIENTE', 'ADMIN')).toBe(false);
  });

  it('PENDIENTE → PROPUESTA ✗ (cannot regress to proposal)', () => {
    expect(puedeTransicionarTarea('PENDIENTE', 'PROPUESTA', 'ADMIN')).toBe(false);
  });
});
