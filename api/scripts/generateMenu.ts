/**
 * Generates api/docs/menu.md from the live database so DulceBot always has
 * an up-to-date product catalog for RAG without manual maintenance.
 *
 * Run order: migrate → seed → generateMenu → dev
 *
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {Promise<void>}
 */
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

/**
 * Display order for product categories in the generated menu.
 * Categories not in this list are appended at the end in alphabetical order.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const CATEGORY_ORDER: string[] = [
  'Conchas',
  'Cuernos',
  'Orejas',
  'Roles',
  'Polvorones',
  'Empanadas',
  'Galletas',
  'Pan',
  'Churros',
  'Muffins',
  'Brownies',
  'Especiales',
  'Bebidas',
  'Pasteles',
  'Encargos',
];

/**
 * Formats a Decimal (stored as string by Prisma) as a Mexican peso price.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string | number | { toString(): string }} value - Raw price value from Prisma
 * @returns {string} Formatted price string, e.g. "$18.00"
 */
function formatPrice(value: { toString(): string }): string {
  return `$${parseFloat(value.toString()).toFixed(2)}`;
}

/**
 * Sorts category names using CATEGORY_ORDER as the primary key, then
 * alphabetically for any unlisted categories.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string} a - First category name
 * @param {string} b - Second category name
 * @returns {number} Comparison result for Array.sort
 */
function sortCategories(a: string, b: string): number {
  const ia = CATEGORY_ORDER.indexOf(a);
  const ib = CATEGORY_ORDER.indexOf(b);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  return a.localeCompare(b, 'es');
}

/**
 * Builds and writes the menu markdown file from the current DB state.
 * Active products are grouped by category and rendered as markdown tables.
 * Encargo items show a note instead of stock info.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {Promise<void>}
 */
async function main(): Promise<void> {
  const productos = await prisma.producto.findMany({
    where:   { activo: true },
    orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }],
  });

  // Group by category
  const porCategoria = new Map<string, typeof productos>();
  for (const p of productos) {
    const cat = p.categoria;
    if (!porCategoria.has(cat)) porCategoria.set(cat, []);
    porCategoria.get(cat)!.push(p);
  }

  const categorias = [...porCategoria.keys()].sort(sortCategories);

  const lines: string[] = [
    '# Menú — Antojo de Yanet',
    '',
    'Panadería artesanal mexicana. Todo el pan se hornea a diario con recetas tradicionales.',
    '',
    '---',
    '',
  ];

  for (const cat of categorias) {
    const items = porCategoria.get(cat)!;
    lines.push(`## ${cat}`, '');
    lines.push('| Producto | Descripción | Precio |');
    lines.push('|---|---|---|');

    for (const p of items) {
      const precio = p.requiereEncargo
        ? '*encargo previo*'
        : p.stockDisponible === 0
          ? '*temporada*'
          : formatPrice(p.precio);
      const desc = (p.descripcion ?? '').replace(/\|/g, '–');
      lines.push(`| ${p.nombre} | ${desc} | ${precio} |`);
    }

    lines.push('');
  }

  lines.push(
    '---',
    '',
    '## Notas importantes',
    '',
    '- **Encargos**: los pasteles y cajas especiales requieren pedido previo con mínimo 24 horas de anticipación.',
    '- **Pan de temporada**: pan de muerto (octubre–noviembre), rosca de reyes (diciembre–enero).',
    '- **Disponibilidad**: el pan casero se hornea cada mañana; el stock puede agotarse.',
    '- **Personalización**: los pasteles de encargo pueden llevar nombre, decoración y sabor a elección del cliente.',
    '',
  );

  const outputPath = join(__dirname, '..', 'docs', 'menu.md');
  writeFileSync(outputPath, lines.join('\n'), 'utf-8');

  console.log(`menu.md generado con ${productos.length} productos en ${categorias.length} categorías.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
