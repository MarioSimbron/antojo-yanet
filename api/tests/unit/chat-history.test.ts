/**
 * Unit tests for in-memory chat history: appending messages, truncation at 10 turns
 * and isolation between sessions.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { describe, it, expect } from 'vitest';
import { agregarMensaje, obtenerHistorial } from '../../src/lib/chat-history';

describe('chatHistory', () => {
  it('retorna arreglo vacío para una sesión nueva', () => {
    expect(obtenerHistorial('session-new-xyz')).toEqual([]);
  });

  it('agrega mensajes y los recupera en orden', () => {
    agregarMensaje('s1', 'user', 'Hola');
    agregarMensaje('s1', 'assistant', 'Bienvenido');
    const h = obtenerHistorial('s1');
    expect(h).toHaveLength(2);
    expect(h[0]).toEqual({ rol: 'user', contenido: 'Hola' });
    expect(h[1]).toEqual({ rol: 'assistant', contenido: 'Bienvenido' });
  });

  it('aísla el historial por sessionId', () => {
    agregarMensaje('sA', 'user', 'Sesión A');
    agregarMensaje('sB', 'user', 'Sesión B');
    expect(obtenerHistorial('sA').at(-1)?.contenido).toBe('Sesión A');
    expect(obtenerHistorial('sB').at(-1)?.contenido).toBe('Sesión B');
  });

  it('trunca a los últimos 10 turnos (20 mensajes)', () => {
    const sid = 'trunc-session';
    for (let i = 0; i < 15; i++) {
      agregarMensaje(sid, 'user', `user-${i}`);
      agregarMensaje(sid, 'assistant', `bot-${i}`);
    }
    const h = obtenerHistorial(sid);
    expect(h).toHaveLength(20);
    // The oldest messages should have been dropped
    expect(h[0].contenido).toBe('user-5');
    expect(h[h.length - 1].contenido).toBe('bot-14');
  });
});
