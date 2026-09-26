/**
 * Generates docs/menu.md from the active products so the RAG knowledge base always
 * reflects the current catalog.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs/promises';

const prisma = new PrismaClient();

/**
 * Renders every active product (grouped by category, with price, availability and
 * custom-order flag) as markdown and writes it to docs/menu.md.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {Promise<void>} Resolves once the file has been written.
 */
export async function generarMenuMd(): Promise<void> {
  const productos = await prisma.producto.findMany({
    where: { activo: true },
    orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }],
  });

  const categorias = [...new Set(productos.map((p) => p.categoria))];
  const lineas: string[] = ['# Menú — Antojo de Yanet', ''];

  for (const cat of categorias) {
    lineas.push(`## ${cat}`, '');
    const items = productos.filter((p) => p.categoria === cat);
    for (const p of items) {
      const disponible = p.stockDisponible > 0 ? 'Disponible' : 'Sin stock';
      const encargo = p.requiereEncargo ? ' · Requiere encargo previo' : '';
      lineas.push(`### ${p.nombre}`);
      lineas.push(`- **Precio:** $${p.precio} MXN`);
      lineas.push(`- **Disponibilidad:** ${disponible}${encargo}`);
      if (p.descripcion) lineas.push(`- ${p.descripcion}`);
      lineas.push('');
    }
  }

  const docsDir = path.join(process.cwd(), 'docs');
  await fs.mkdir(docsDir, { recursive: true });
  await fs.writeFile(path.join(docsDir, 'menu.md'), lineas.join('\n'), 'utf-8');
  console.log(`menu.md generado: ${productos.length} productos`);
}
