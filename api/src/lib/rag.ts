/**
 * Lightweight in-memory RAG: loads the markdown files in /docs, splits them into
 * chunks and ranks chunks by keyword relevance.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import fs from 'fs/promises';
import path from 'path';

/**
 * A piece of a knowledge-base document.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @property {string} fuente - Source file name.
 * @property {string} texto - Chunk text.
 */
export interface Chunk {
  fuente: string;
  texto: string;
}

let chunks: Chunk[] = [];

/**
 * Reads every .md file in /docs and splits it into chunks by markdown heading
 * (#, ## or ###), discarding very short fragments. Replaces the in-memory index.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {Promise<Chunk[]>} The loaded chunks (empty if /docs does not exist).
 */
export async function cargarDocumentos(): Promise<Chunk[]> {
  const docsDir = path.join(process.cwd(), 'docs');
  let archivos: string[] = [];
  try {
    archivos = await fs.readdir(docsDir);
  } catch {
    return [];
  }

  const nuevosChunks: Chunk[] = [];
  for (const archivo of archivos.filter((f) => f.endsWith('.md'))) {
    const contenido = await fs.readFile(path.join(docsDir, archivo), 'utf-8');
    // Split by sections (#, ## or ### headings)
    const secciones = contenido.split(/\n(?=#{1,3} )/);
    for (const seccion of secciones) {
      if (seccion.trim().length > 20) {
        nuevosChunks.push({ fuente: archivo, texto: seccion.trim() });
      }
    }
  }

  chunks = nuevosChunks;
  return chunks;
}

/**
 * Keyword relevance score: +1 per query term found in the text, +2 extra when the
 * term appears in a heading.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string} query - Search query.
 * @param {string} texto - Chunk text to score.
 * @returns {number} Relevance score (0 = no match).
 */
function tfidfScore(query: string, texto: string): number {
  const queryTerms = query.toLowerCase().split(/\s+/);
  const textoLower = texto.toLowerCase();
  let score = 0;
  for (const term of queryTerms) {
    if (textoLower.includes(term)) score += 1;
    // Bonus for terms found in headings
    if (textoLower.match(new RegExp(`^#{1,3}.*${term}`, 'm'))) score += 2;
  }
  return score;
}

/**
 * Returns the chunks most relevant to a query.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string} query - Search query.
 * @param {number} [top=3] - Maximum number of chunks to return.
 * @returns {Chunk[]} Matching chunks sorted by descending relevance.
 */
export function buscarChunksRelevantes(query: string, top = 3): Chunk[] {
  if (chunks.length === 0) return [];
  return [...chunks]
    .map((c) => ({ chunk: c, score: tfidfScore(query, c.texto) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, top)
    .map((x) => x.chunk);
}
