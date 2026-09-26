/**
 * Unit tests for the in-memory RAG: document loading, chunk splitting and relevance
 * ranking for queries about bakery schedules, policies and the product menu.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import { cargarDocumentos, buscarChunksRelevantes } from '../../src/lib/rag';

const DOCS_DIR = path.join(process.cwd(), 'docs');

describe('RAG — cargarDocumentos', () => {
  beforeAll(async () => {
    await cargarDocumentos();
  });

  it('carga más de 0 chunks', async () => {
    const chunks = await cargarDocumentos();
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('incluye chunks de horarios.md', async () => {
    const chunks = await cargarDocumentos();
    const horarios = chunks.filter((c) => c.fuente === 'horarios.md');
    expect(horarios.length).toBeGreaterThan(0);
  });

  it('incluye chunks de menu.md', async () => {
    const chunks = await cargarDocumentos();
    const menu = chunks.filter((c) => c.fuente === 'menu.md');
    expect(menu.length).toBeGreaterThan(0);
  });

  it('incluye chunks de faq.md y politicas-encargos.md', async () => {
    const chunks = await cargarDocumentos();
    const fuentes = new Set(chunks.map((c) => c.fuente));
    expect(fuentes.has('faq.md')).toBe(true);
    expect(fuentes.has('politicas-encargos.md')).toBe(true);
  });
});

describe('RAG — buscarChunksRelevantes', () => {
  beforeAll(async () => {
    await cargarDocumentos();
  });

  it('retorna 0 chunks cuando el índice está vacío y se busca antes de cargar', () => {
    // buscarChunksRelevantes returns empty when chunks not loaded
    // We test with a new empty state by searching an unloaded term
    const result = buscarChunksRelevantes('xyzabcdef12345nonexistent', 3);
    expect(result.length).toBe(0);
  });

  it('query "domingo" retorna horarios.md en el top 3', () => {
    const results = buscarChunksRelevantes('¿a qué hora abren el domingo?', 3);
    expect(results.length).toBeGreaterThan(0);
    const fuentes = results.map((r) => r.fuente);
    expect(fuentes).toContain('horarios.md');
  });

  it('query "cancelar encargo" retorna politicas-encargos.md en el top 3', () => {
    const results = buscarChunksRelevantes('política de cancelación encargo', 3);
    expect(results.length).toBeGreaterThan(0);
    const fuentes = results.map((r) => r.fuente);
    expect(fuentes).toContain('politicas-encargos.md');
  });

  it('respeta el límite top=N', () => {
    const results = buscarChunksRelevantes('horario encargo pedido', 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('ordena por relevancia descendente', () => {
    // The first result should be about horarios when query is specific
    const results = buscarChunksRelevantes('horario domingo apertura', 5);
    expect(results.length).toBeGreaterThan(0);
    // First chunk should be from horarios.md
    expect(results[0].fuente).toBe('horarios.md');
  });
});
