/**
 * Unit tests for the Groq SDK wrapper: missing key returns a GroqError, not a thrown
 * exception; the success path and SDK error path are covered with mocks.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the groq-sdk module so no network calls are made
const mockCreate = vi.fn();
vi.mock('groq-sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));

import { llamarGroq, esError } from '../../src/lib/groq';

// ── esError helper ─────────────────────────────────────────────────────────────

describe('groq — esError', () => {
  it('reconoce un GroqError por su campo type', () => {
    expect(esError({ type: 'groq_error', message: 'down' })).toBe(true);
  });

  it('rechaza objetos sin type groq_error', () => {
    expect(esError({ choices: [] })).toBe(false);
    expect(esError(null)).toBe(false);
    expect(esError(undefined)).toBe(false);
    expect(esError('error')).toBe(false);
  });
});

// ── llamarGroq — clave ausente ─────────────────────────────────────────────────

describe('groq — llamarGroq sin GROQ_API_KEY', () => {
  const originalKey = process.env.GROQ_API_KEY;

  beforeEach(() => {
    delete process.env.GROQ_API_KEY;
  });

  afterEach(() => {
    if (originalKey !== undefined) process.env.GROQ_API_KEY = originalKey;
  });

  it('retorna GroqError cuando no hay API key — no lanza excepción', async () => {
    const result = await llamarGroq([{ role: 'user', content: 'hola' }]);
    expect(esError(result)).toBe(true);
    expect((result as { type: string; message: string }).message).toBeTruthy();
  });
});

// ── llamarGroq — con API key y SDK mockeado ────────────────────────────────────

describe('groq — llamarGroq con SDK mockeado', () => {
  const originalKey = process.env.GROQ_API_KEY;

  beforeEach(() => {
    process.env.GROQ_API_KEY = 'test-key-mock';
    mockCreate.mockReset();
  });

  afterEach(() => {
    if (originalKey !== undefined) process.env.GROQ_API_KEY = originalKey;
    else delete process.env.GROQ_API_KEY;
  });

  it('retorna la respuesta del SDK cuando la llamada tiene éxito', async () => {
    const fakeCompletion = {
      id: 'test-id',
      choices: [{ message: { role: 'assistant', content: 'Hola!' }, finish_reason: 'stop', index: 0 }],
    };
    mockCreate.mockResolvedValue(fakeCompletion);

    const result = await llamarGroq([{ role: 'user', content: 'test' }]);
    expect(esError(result)).toBe(false);
  });

  it('retorna GroqError cuando el SDK lanza una excepción', async () => {
    mockCreate.mockRejectedValue(new Error('network error'));

    const result = await llamarGroq([{ role: 'user', content: 'test' }]);
    expect(esError(result)).toBe(true);
    expect((result as { type: string; message: string }).type).toBe('groq_error');
  });
});
