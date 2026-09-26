/**
 * Idempotent database seed: upserts the product catalog (by SKU) and one test user
 * per role (by email).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ── Curated Unsplash image URLs per bakery category ──────────────────────────
const IMG = {
  concha:    'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600&fit=crop&q=80',
  cuerno:    'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&fit=crop&q=80',
  rol:       'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=600&fit=crop&q=80',
  polvoron:  'https://images.unsplash.com/photo-1606787366850-de6330128bfc?w=600&fit=crop&q=80',
  oreja:     'https://images.unsplash.com/photo-1528975604071-b4dc52a2d18c?w=600&fit=crop&q=80',
  empanada:  'https://images.unsplash.com/photo-1620921568790-c80f986a6c97?w=600&fit=crop&q=80',
  especial:  'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=600&fit=crop&q=80',
  pastel:    'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&fit=crop&q=80',
  rosca:     'https://images.unsplash.com/photo-1574085733277-851d9d856a3a?w=600&fit=crop&q=80',
  galleta:   'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=600&fit=crop&q=80',
  cafe:      'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&fit=crop&q=80',
  chocolate: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=600&fit=crop&q=80',
};

/**
 * Seed product catalog grouped by category. Items with `requiereEncargo: true` are
 * made-to-order; items with `activo: false` are seasonal and hidden by default.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const productos = [
  // ── Conchas ──────────────────────────────────────────────────────────────────
  { sku: 'CON-VAN-01', nombre: 'Concha vainilla', descripcion: 'Clásica concha de vainilla con costra crujiente', precio: '18.00', categoria: 'Conchas', stockDisponible: 30, imagenUrl: IMG.concha },
  { sku: 'CON-CHO-01', nombre: 'Concha chocolate', descripcion: 'Concha con costra de chocolate', precio: '18.00', categoria: 'Conchas', stockDisponible: 25, imagenUrl: IMG.concha },
  { sku: 'CON-FAY-01', nombre: 'Concha fresa', descripcion: 'Concha con costra de fresa rosa', precio: '20.00', categoria: 'Conchas', stockDisponible: 20, imagenUrl: IMG.concha },
  { sku: 'CON-NAT-01', nombre: 'Concha natural', descripcion: 'Concha sin costra, pan suave', precio: '15.00', categoria: 'Conchas', stockDisponible: 15, imagenUrl: IMG.concha },
  { sku: 'CON-LIM-01', nombre: 'Concha limón', descripcion: 'Concha con costra de limón y chispas amarillas', precio: '20.00', categoria: 'Conchas', stockDisponible: 18, imagenUrl: IMG.concha },

  // ── Cuernos ──────────────────────────────────────────────────────────────────
  { sku: 'CUE-MAR-01', nombre: 'Cuerno mantequilla', descripcion: 'Cuerno hojaldrado con mantequilla', precio: '22.00', categoria: 'Cuernos', stockDisponible: 20, imagenUrl: IMG.cuerno },
  { sku: 'CUE-CHO-01', nombre: 'Cuerno chocolate', descripcion: 'Cuerno bañado en chocolate oscuro', precio: '25.00', categoria: 'Cuernos', stockDisponible: 15, imagenUrl: IMG.cuerno },
  { sku: 'CUE-CAR-01', nombre: 'Cuerno canela', descripcion: 'Cuerno con relleno de canela y azúcar', precio: '22.00', categoria: 'Cuernos', stockDisponible: 12, imagenUrl: IMG.cuerno },

  // ── Roles ─────────────────────────────────────────────────────────────────────
  { sku: 'ROL-CAN-01', nombre: 'Rol de canela clásico', descripcion: 'Rol suave con canela y betún de azúcar', precio: '28.00', categoria: 'Roles', stockDisponible: 10, imagenUrl: IMG.rol },
  { sku: 'ROL-CHO-01', nombre: 'Rol de chocolate', descripcion: 'Rol con relleno de crema de chocolate', precio: '30.00', categoria: 'Roles', stockDisponible: 8, imagenUrl: IMG.rol },
  { sku: 'ROL-MAZ-01', nombre: 'Rol de mazapán', descripcion: 'Rol dulce con pasta de mazapán', precio: '32.00', categoria: 'Roles', stockDisponible: 6, imagenUrl: IMG.rol },

  // ── Polvorones ───────────────────────────────────────────────────────────────
  { sku: 'POL-NAT-01', nombre: 'Polvorón natural', descripcion: 'Galleta arenosa tradicional con azúcar glass', precio: '12.00', categoria: 'Polvorones', stockDisponible: 40, imagenUrl: IMG.polvoron },
  { sku: 'POL-CAN-01', nombre: 'Polvorón canela', descripcion: 'Polvorón con canela y nuez', precio: '14.00', categoria: 'Polvorones', stockDisponible: 35, imagenUrl: IMG.polvoron },
  { sku: 'POL-VAN-01', nombre: 'Polvorón vainilla', descripcion: 'Polvorón con esencia de vainilla', precio: '12.00', categoria: 'Polvorones', stockDisponible: 38, imagenUrl: IMG.polvoron },
  { sku: 'POL-CHO-01', nombre: 'Polvorón chocolate', descripcion: 'Polvorón de chocolate oscuro', precio: '15.00', categoria: 'Polvorones', stockDisponible: 30, imagenUrl: IMG.polvoron },

  // ── Orejas ────────────────────────────────────────────────────────────────────
  { sku: 'ORE-NAT-01', nombre: 'Oreja clásica', descripcion: 'Hojaldrada crujiente con azúcar', precio: '16.00', categoria: 'Orejas', stockDisponible: 25, imagenUrl: IMG.oreja },
  { sku: 'ORE-CHO-01', nombre: 'Oreja chocolate', descripcion: 'Oreja con chispas de chocolate', precio: '18.00', categoria: 'Orejas', stockDisponible: 20, imagenUrl: IMG.oreja },

  // ── Empanadas ─────────────────────────────────────────────────────────────────
  { sku: 'EMP-PIL-01', nombre: 'Empanada piña', descripcion: 'Empanada dulce de piña con glaseado', precio: '20.00', categoria: 'Empanadas', stockDisponible: 15, imagenUrl: IMG.empanada },
  { sku: 'EMP-CAL-01', nombre: 'Empanada calabaza', descripcion: 'Empanada de temporada con dulce de calabaza', precio: '22.00', categoria: 'Empanadas', stockDisponible: 10, imagenUrl: IMG.empanada },
  { sku: 'EMP-NUE-01', nombre: 'Empanada nuez', descripcion: 'Empanada con nuez y piloncillo', precio: '24.00', categoria: 'Empanadas', stockDisponible: 12, imagenUrl: IMG.empanada },
  { sku: 'EMP-MAN-01', nombre: 'Empanada manzana', descripcion: 'Empanada de manzana con canela', precio: '22.00', categoria: 'Empanadas', stockDisponible: 14, imagenUrl: IMG.empanada },

  // ── Specialty breads ─────────────────────────────────────────────────────────
  { sku: 'ESP-PUM-01', nombre: 'Pan de muerto chico', descripcion: 'Pan de muerto individual con azúcar y anís', precio: '35.00', categoria: 'Especiales', stockDisponible: 0, activo: false, imagenUrl: IMG.rosca },
  { sku: 'ESP-ROC-01', nombre: 'Rosca de reyes individual', descripcion: 'Roscón pequeño con frutos secos y muñeco', precio: '45.00', categoria: 'Especiales', stockDisponible: 0, activo: false, imagenUrl: IMG.rosca },
  { sku: 'ESP-TRE-01', nombre: 'Tres leches rebanada', descripcion: 'Rebanada de pastel tres leches artesanal', precio: '40.00', categoria: 'Especiales', stockDisponible: 5, imagenUrl: IMG.pastel },

  // ── Custom orders (requiereEncargo = true) ───────────────────────────────────
  { sku: 'ENC-PAS-01', nombre: 'Pastel personalizado (chico)', descripcion: 'Pastel 20cm para 10 personas, sabor a elegir', precio: '450.00', categoria: 'Encargos', stockDisponible: 0, requiereEncargo: true, imagenUrl: IMG.pastel },
  { sku: 'ENC-PAS-02', nombre: 'Pastel personalizado (mediano)', descripcion: 'Pastel 25cm para 20 personas, sabor a elegir', precio: '750.00', categoria: 'Encargos', stockDisponible: 0, requiereEncargo: true, imagenUrl: IMG.pastel },
  { sku: 'ENC-PAS-03', nombre: 'Pastel personalizado (grande)', descripcion: 'Pastel 30cm para 35 personas, sabor a elegir', precio: '1100.00', categoria: 'Encargos', stockDisponible: 0, requiereEncargo: true, imagenUrl: IMG.pastel },
  { sku: 'ENC-ROC-01', nombre: 'Rosca de reyes grande', descripcion: 'Rosca para 15-20 personas con frutos secos y 3 muñecos', precio: '650.00', categoria: 'Encargos', stockDisponible: 0, requiereEncargo: true, imagenUrl: IMG.rosca },
  { sku: 'ENC-PUM-01', nombre: 'Pan de muerto familiar', descripcion: 'Pan de muerto grande 30cm para 8-10 porciones', precio: '280.00', categoria: 'Encargos', stockDisponible: 0, requiereEncargo: true, imagenUrl: IMG.rosca },
  { sku: 'ENC-CON-01', nombre: 'Caja de conchas x12', descripcion: 'Docena de conchas surtidas (vainilla, chocolate, fresa)', precio: '200.00', categoria: 'Encargos', stockDisponible: 0, requiereEncargo: true, imagenUrl: IMG.concha },
  { sku: 'ENC-POL-01', nombre: 'Caja de polvorones x24', descripcion: 'Caja decorada de 24 polvorones surtidos, ideal para regalo', precio: '320.00', categoria: 'Encargos', stockDisponible: 0, requiereEncargo: true, imagenUrl: IMG.polvoron },

  // ── Drinks ────────────────────────────────────────────────────────────────────
  { sku: 'BEB-CAF-01', nombre: 'Café americano', descripcion: 'Café negro preparado al momento', precio: '25.00', categoria: 'Bebidas', stockDisponible: 50, imagenUrl: IMG.cafe },
  { sku: 'BEB-CAP-01', nombre: 'Capuchino', descripcion: 'Espresso con leche vaporizada y espuma', precio: '35.00', categoria: 'Bebidas', stockDisponible: 50, imagenUrl: IMG.cafe },
  { sku: 'BEB-CHO-01', nombre: 'Chocolate caliente', descripcion: 'Chocolate artesanal con leche y canela', precio: '30.00', categoria: 'Bebidas', stockDisponible: 40, imagenUrl: IMG.chocolate },
  { sku: 'BEB-ATE-01', nombre: 'Atole de guayaba', descripcion: 'Atole casero de maíz con guayaba', precio: '28.00', categoria: 'Bebidas', stockDisponible: 20, imagenUrl: IMG.chocolate },
  { sku: 'BEB-ATE-02', nombre: 'Atole de vainilla', descripcion: 'Atole casero de maíz con vainilla', precio: '25.00', categoria: 'Bebidas', stockDisponible: 25, imagenUrl: IMG.chocolate },

  // ── Cookies ──────────────────────────────────────────────────────────────────
  { sku: 'GAL-CHO-01', nombre: 'Galleta choco chips', descripcion: 'Galleta suave con chispas de chocolate', precio: '18.00', categoria: 'Galletas', stockDisponible: 30, imagenUrl: IMG.galleta },
  { sku: 'GAL-MAN-01', nombre: 'Galleta mantequilla', descripcion: 'Galleta crujiente de mantequilla con azúcar', precio: '15.00', categoria: 'Galletas', stockDisponible: 35, imagenUrl: IMG.galleta },
  { sku: 'GAL-AVE-01', nombre: 'Galleta avena', descripcion: 'Galleta integral de avena y miel', precio: '20.00', categoria: 'Galletas', stockDisponible: 28, imagenUrl: IMG.galleta },
  { sku: 'GAL-NAV-01', nombre: 'Galleta navideña decorada', descripcion: 'Galleta de mantequilla con glasé de colores', precio: '25.00', categoria: 'Galletas', stockDisponible: 15, imagenUrl: IMG.galleta },

  // ── Extra items ───────────────────────────────────────────────────────────────
  { sku: 'CON-NAR-01', nombre: 'Concha naranja', descripcion: 'Concha con costra de naranja y ralladura', precio: '20.00', categoria: 'Conchas', stockDisponible: 15, imagenUrl: IMG.concha },
  { sku: 'CON-MAT-01', nombre: 'Concha matcha', descripcion: 'Concha moderna con costra de té matcha', precio: '22.00', categoria: 'Conchas', stockDisponible: 12, imagenUrl: IMG.concha },
  { sku: 'CON-TIN-01', nombre: 'Concha tinta violeta', descripcion: 'Concha con costra teñida de violeta, sabor uva', precio: '22.00', categoria: 'Conchas', stockDisponible: 10, imagenUrl: IMG.concha },
  { sku: 'ROL-LIM-01', nombre: 'Rol de limón', descripcion: 'Rol suave con glaseado de limón', precio: '28.00', categoria: 'Roles', stockDisponible: 8, imagenUrl: IMG.rol },
  { sku: 'CUE-VAN-01', nombre: 'Cuerno vainilla', descripcion: 'Cuerno hojaldrado con crema de vainilla', precio: '24.00', categoria: 'Cuernos', stockDisponible: 10, imagenUrl: IMG.cuerno },
  { sku: 'ENC-PAS-04', nombre: 'Pastel quince años (grande)', descripcion: 'Pastel 35cm de 3 pisos para quinceañera, diseño personalizado', precio: '2200.00', categoria: 'Encargos', stockDisponible: 0, requiereEncargo: true, imagenUrl: IMG.pastel },
  { sku: 'ENC-GAL-01', nombre: 'Caja galletas decoradas x20', descripcion: 'Caja de 20 galletas decoradas con el diseño que elijas', precio: '480.00', categoria: 'Encargos', stockDisponible: 0, requiereEncargo: true, imagenUrl: IMG.galleta },
  { sku: 'BEB-JUG-01', nombre: 'Jugo de naranja natural', descripcion: 'Jugo exprimido al momento', precio: '30.00', categoria: 'Bebidas', stockDisponible: 20, imagenUrl: IMG.cafe },
  { sku: 'ESP-CRO-01', nombre: 'Croissant artesanal', descripcion: 'Croissant hojaldrado con mantequilla francesa', precio: '38.00', categoria: 'Especiales', stockDisponible: 8, imagenUrl: IMG.cuerno },
  { sku: 'GAL-JAM-01', nombre: 'Galleta jamoncillo', descripcion: 'Galleta con pasta de jamoncillo de leche', precio: '22.00', categoria: 'Galletas', stockDisponible: 20, imagenUrl: IMG.galleta },
  { sku: 'EMP-CAP-01', nombre: 'Empanada capulines', descripcion: 'Empanada de temporada con mermelada de capulín', precio: '24.00', categoria: 'Empanadas', stockDisponible: 8, imagenUrl: IMG.empanada },
  { sku: 'ORE-CAR-01', nombre: 'Oreja caramelizada', descripcion: 'Oreja bañada en caramelo crujiente', precio: '20.00', categoria: 'Orejas', stockDisponible: 18, imagenUrl: IMG.oreja },
  { sku: 'POL-LIM-01', nombre: 'Polvorón limón', descripcion: 'Polvorón con ralladura de limón y azúcar glass', precio: '14.00', categoria: 'Polvorones', stockDisponible: 32, imagenUrl: IMG.polvoron },
];

/**
 * Test users, one per role, with plain-text passwords that are hashed when seeding.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const usuarios = [
  { nombre: 'Admin Yanet', email: 'admin@antojo.mx', password: 'Admin123!', rol: 'ADMIN' as const },
  { nombre: 'Maestro Panadero', email: 'panadero@antojo.mx', password: 'Pan123!', rol: 'MAESTRO_PANADERO' as const },
  { nombre: 'Cajero Uno', email: 'cajero@antojo.mx', password: 'Cajero123!', rol: 'CAJERO' as const },
  { nombre: 'Repartidor Uno', email: 'repartidor@antojo.mx', password: 'Rep123!', rol: 'REPARTIDOR' as const },
  { nombre: 'Cliente Prueba', email: 'cliente@antojo.mx', password: 'Cliente123!', rol: 'CLIENTE' as const },
];

/**
 * Runs the seed: upserts every product by SKU and every test user by email. Existing
 * rows are updated with the latest imagenUrl so re-running the seed refreshes images.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {Promise<void>} Resolves when all upserts have finished.
 */
async function main() {
  console.log('Iniciando seed...');

  for (const p of productos) {
    await prisma.producto.upsert({
      where: { sku: p.sku },
      update: { imagenUrl: p.imagenUrl ?? null },
      create: {
        sku: p.sku,
        nombre: p.nombre,
        descripcion: p.descripcion,
        precio: p.precio,
        categoria: p.categoria,
        stockDisponible: p.stockDisponible,
        requiereEncargo: p.requiereEncargo ?? false,
        activo: p.activo ?? true,
        imagenUrl: p.imagenUrl ?? null,
      },
    });
  }

  console.log(`Productos actualizados: ${productos.length}`);

  for (const u of usuarios) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.usuario.upsert({
      where: { email: u.email },
      update: {},
      create: {
        nombre: u.nombre,
        email: u.email,
        passwordHash,
        rol: u.rol,
      },
    });
  }

  console.log('Seed completado.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
