/**
 * Idempotent database seed: upserts the full product catalog (by SKU) and one
 * test user per role (by email). Safe to run on every container start because
 * upsert only creates rows that do not exist yet.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Curated Unsplash image URLs, one per visual category.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const IMG = {
  concha:     'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600&fit=crop&q=80',
  cuerno:     'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&fit=crop&q=80',
  rol:        'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=600&fit=crop&q=80',
  polvoron:   'https://images.unsplash.com/photo-1606787366850-de6330128bfc?w=600&fit=crop&q=80',
  oreja:      'https://images.unsplash.com/photo-1528975604071-b4dc52a2d18c?w=600&fit=crop&q=80',
  empanada:   'https://images.unsplash.com/photo-1620921568790-c80f986a6c97?w=600&fit=crop&q=80',
  especial:   'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=600&fit=crop&q=80',
  pastel:     'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&fit=crop&q=80',
  rosca:      'https://images.unsplash.com/photo-1574085733277-851d9d856a3a?w=600&fit=crop&q=80',
  galleta:    'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=600&fit=crop&q=80',
  cafe:       'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&fit=crop&q=80',
  chocolate:  'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=600&fit=crop&q=80',
  pan:        'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&fit=crop&q=80',
  churro:     'https://images.unsplash.com/photo-1624204386084-dd7ce4a3d5b0?w=600&fit=crop&q=80',
  muffin:     'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=600&fit=crop&q=80',
  brownie:    'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?w=600&fit=crop&q=80',
  bebida:     'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&fit=crop&q=80',
};

/**
 * Full product catalog for Antojo de Yanet — a traditional Mexican bakery.
 * Covers pan dulce casero, pasteles, bebidas, galletas, churros, muffins,
 * brownies, pays and made-to-order encargos (140+ SKUs).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const productos = [
  // ── Conchas (8) ──────────────────────────────────────────────────────────────
  { sku: 'CON-VAN-01', nombre: 'Concha vainilla',         descripcion: 'Clásica concha de vainilla con costra crujiente',              precio: '18.00', categoria: 'Conchas',    stockDisponible: 30, imagenUrl: IMG.concha },
  { sku: 'CON-CHO-01', nombre: 'Concha chocolate',        descripcion: 'Concha con costra de chocolate oscuro',                        precio: '18.00', categoria: 'Conchas',    stockDisponible: 25, imagenUrl: IMG.concha },
  { sku: 'CON-FAY-01', nombre: 'Concha fresa',            descripcion: 'Concha con costra de fresa rosa',                              precio: '20.00', categoria: 'Conchas',    stockDisponible: 20, imagenUrl: IMG.concha },
  { sku: 'CON-NAT-01', nombre: 'Concha natural',          descripcion: 'Concha sin costra, pan suave y esponjoso',                     precio: '15.00', categoria: 'Conchas',    stockDisponible: 15, imagenUrl: IMG.concha },
  { sku: 'CON-LIM-01', nombre: 'Concha limón',            descripcion: 'Concha con costra de limón y chispas amarillas',               precio: '20.00', categoria: 'Conchas',    stockDisponible: 18, imagenUrl: IMG.concha },
  { sku: 'CON-NAR-01', nombre: 'Concha naranja',          descripcion: 'Concha con costra de naranja y ralladura',                     precio: '20.00', categoria: 'Conchas',    stockDisponible: 15, imagenUrl: IMG.concha },
  { sku: 'CON-MAT-01', nombre: 'Concha matcha',           descripcion: 'Concha moderna con costra de té matcha',                       precio: '22.00', categoria: 'Conchas',    stockDisponible: 12, imagenUrl: IMG.concha },
  { sku: 'CON-TIN-01', nombre: 'Concha tinta violeta',    descripcion: 'Concha con costra teñida de violeta, sabor uva',               precio: '22.00', categoria: 'Conchas',    stockDisponible: 10, imagenUrl: IMG.concha },

  // ── Cuernos (5) ──────────────────────────────────────────────────────────────
  { sku: 'CUE-MAR-01', nombre: 'Cuerno mantequilla',      descripcion: 'Cuerno hojaldrado con mantequilla',                            precio: '22.00', categoria: 'Cuernos',    stockDisponible: 20, imagenUrl: IMG.cuerno },
  { sku: 'CUE-CHO-01', nombre: 'Cuerno chocolate',        descripcion: 'Cuerno bañado en chocolate oscuro',                            precio: '25.00', categoria: 'Cuernos',    stockDisponible: 15, imagenUrl: IMG.cuerno },
  { sku: 'CUE-CAN-01', nombre: 'Cuerno canela',           descripcion: 'Cuerno con relleno de canela y azúcar',                        precio: '22.00', categoria: 'Cuernos',    stockDisponible: 12, imagenUrl: IMG.cuerno },
  { sku: 'CUE-VAN-01', nombre: 'Cuerno vainilla',         descripcion: 'Cuerno hojaldrado con crema de vainilla',                      precio: '24.00', categoria: 'Cuernos',    stockDisponible: 10, imagenUrl: IMG.cuerno },
  { sku: 'CUE-JAM-01', nombre: 'Cuernito jamón y queso',  descripcion: 'Cuerno salado relleno de jamón y queso derretido',             precio: '28.00', categoria: 'Cuernos',    stockDisponible: 14, imagenUrl: IMG.cuerno },

  // ── Orejas (3) ───────────────────────────────────────────────────────────────
  { sku: 'ORE-NAT-01', nombre: 'Oreja clásica',           descripcion: 'Hojaldrada crujiente con azúcar',                              precio: '16.00', categoria: 'Orejas',     stockDisponible: 25, imagenUrl: IMG.oreja },
  { sku: 'ORE-CHO-01', nombre: 'Oreja chocolate',         descripcion: 'Oreja con chispas de chocolate',                               precio: '18.00', categoria: 'Orejas',     stockDisponible: 20, imagenUrl: IMG.oreja },
  { sku: 'ORE-CAR-01', nombre: 'Oreja caramelizada',      descripcion: 'Oreja bañada en caramelo crujiente',                           precio: '20.00', categoria: 'Orejas',     stockDisponible: 18, imagenUrl: IMG.oreja },

  // ── Roles (4) ─────────────────────────────────────────────────────────────────
  { sku: 'ROL-CAN-01', nombre: 'Rol de canela clásico',   descripcion: 'Rol suave con canela y betún de azúcar',                       precio: '28.00', categoria: 'Roles',      stockDisponible: 10, imagenUrl: IMG.rol },
  { sku: 'ROL-CHO-01', nombre: 'Rol de chocolate',        descripcion: 'Rol con relleno de crema de chocolate',                        precio: '30.00', categoria: 'Roles',      stockDisponible:  8, imagenUrl: IMG.rol },
  { sku: 'ROL-MAZ-01', nombre: 'Rol de mazapán',          descripcion: 'Rol dulce con pasta de mazapán',                               precio: '32.00', categoria: 'Roles',      stockDisponible:  6, imagenUrl: IMG.rol },
  { sku: 'ROL-LIM-01', nombre: 'Rol de limón',            descripcion: 'Rol suave con glaseado de limón',                              precio: '28.00', categoria: 'Roles',      stockDisponible:  8, imagenUrl: IMG.rol },

  // ── Polvorones (5) ───────────────────────────────────────────────────────────
  { sku: 'POL-NAT-01', nombre: 'Polvorón natural',        descripcion: 'Galleta arenosa tradicional con azúcar glass',                 precio: '12.00', categoria: 'Polvorones', stockDisponible: 40, imagenUrl: IMG.polvoron },
  { sku: 'POL-CAN-01', nombre: 'Polvorón canela',         descripcion: 'Polvorón con canela y nuez',                                   precio: '14.00', categoria: 'Polvorones', stockDisponible: 35, imagenUrl: IMG.polvoron },
  { sku: 'POL-VAN-01', nombre: 'Polvorón vainilla',       descripcion: 'Polvorón con esencia de vainilla',                             precio: '12.00', categoria: 'Polvorones', stockDisponible: 38, imagenUrl: IMG.polvoron },
  { sku: 'POL-CHO-01', nombre: 'Polvorón chocolate',      descripcion: 'Polvorón de chocolate oscuro',                                 precio: '15.00', categoria: 'Polvorones', stockDisponible: 30, imagenUrl: IMG.polvoron },
  { sku: 'POL-LIM-01', nombre: 'Polvorón limón',          descripcion: 'Polvorón con ralladura de limón y azúcar glass',               precio: '14.00', categoria: 'Polvorones', stockDisponible: 32, imagenUrl: IMG.polvoron },

  // ── Empanadas (5) ─────────────────────────────────────────────────────────────
  { sku: 'EMP-PIL-01', nombre: 'Empanada piña',           descripcion: 'Empanada dulce de piña con glaseado',                          precio: '20.00', categoria: 'Empanadas',  stockDisponible: 15, imagenUrl: IMG.empanada },
  { sku: 'EMP-CAL-01', nombre: 'Empanada calabaza',       descripcion: 'Empanada de temporada con dulce de calabaza',                  precio: '22.00', categoria: 'Empanadas',  stockDisponible: 10, imagenUrl: IMG.empanada },
  { sku: 'EMP-NUE-01', nombre: 'Empanada nuez',           descripcion: 'Empanada con nuez y piloncillo',                               precio: '24.00', categoria: 'Empanadas',  stockDisponible: 12, imagenUrl: IMG.empanada },
  { sku: 'EMP-MAN-01', nombre: 'Empanada manzana',        descripcion: 'Empanada de manzana con canela',                               precio: '22.00', categoria: 'Empanadas',  stockDisponible: 14, imagenUrl: IMG.empanada },
  { sku: 'EMP-CAP-01', nombre: 'Empanada capulines',      descripcion: 'Empanada de temporada con mermelada de capulín',               precio: '24.00', categoria: 'Empanadas',  stockDisponible:  8, imagenUrl: IMG.empanada },

  // ── Galletas (6) ─────────────────────────────────────────────────────────────
  { sku: 'GAL-CHO-01', nombre: 'Galleta choco chips',     descripcion: 'Galleta suave con chispas de chocolate',                       precio: '18.00', categoria: 'Galletas',   stockDisponible: 30, imagenUrl: IMG.galleta },
  { sku: 'GAL-MAN-01', nombre: 'Galleta mantequilla',     descripcion: 'Galleta crujiente de mantequilla con azúcar',                  precio: '15.00', categoria: 'Galletas',   stockDisponible: 35, imagenUrl: IMG.galleta },
  { sku: 'GAL-AVE-01', nombre: 'Galleta avena',           descripcion: 'Galleta integral de avena y miel',                             precio: '20.00', categoria: 'Galletas',   stockDisponible: 28, imagenUrl: IMG.galleta },
  { sku: 'GAL-NAV-01', nombre: 'Galleta navideña decorada', descripcion: 'Galleta de mantequilla con glasé de colores',                precio: '25.00', categoria: 'Galletas',   stockDisponible: 15, imagenUrl: IMG.galleta },
  { sku: 'GAL-JAM-01', nombre: 'Galleta jamoncillo',      descripcion: 'Galleta con pasta de jamoncillo de leche',                     precio: '22.00', categoria: 'Galletas',   stockDisponible: 20, imagenUrl: IMG.galleta },
  { sku: 'GAL-CHB-01', nombre: 'Galleta chocolate blanco', descripcion: 'Galleta con chispas de chocolate blanco y macadamia',         precio: '22.00', categoria: 'Galletas',   stockDisponible: 18, imagenUrl: IMG.galleta },

  // ── Pan casero tradicional mexicano (30) ─────────────────────────────────────
  { sku: 'PAN-OJO-01', nombre: 'OJO',                     descripcion: 'Pan de ojo de Buey, clásico del norte de México',              precio: '10.00', categoria: 'Pan',        stockDisponible: 20, imagenUrl: IMG.pan },
  { sku: 'PAN-YOY-01', nombre: 'YOYO',                    descripcion: 'Pan Yoyo, suave y esponjoso',                                  precio: '15.00', categoria: 'Pan',        stockDisponible: 18, imagenUrl: IMG.pan },
  { sku: 'PAN-MAN-01', nombre: 'Mantecada',               descripcion: 'Mantecada de vainilla con papel encerado, esponjosa y húmeda', precio: '14.00', categoria: 'Pan',        stockDisponible: 25, imagenUrl: IMG.pan },
  { sku: 'PAN-PUE-01', nombre: 'Puerquito de piloncillo', descripcion: 'Pan dulce en forma de cerdito con piloncillo y jengibre',      precio: '12.00', categoria: 'Pan',        stockDisponible: 30, imagenUrl: IMG.pan },
  { sku: 'PAN-BIG-01', nombre: 'Bigote',                  descripcion: 'Pan de mantequilla en forma de bigote con cobertura de cacao', precio: '16.00', categoria: 'Pan',        stockDisponible: 20, imagenUrl: IMG.pan },
  { sku: 'PAN-GEN-01', nombre: 'Gendarme',                descripcion: 'Pan redondo con betún de azúcar y ajonjolí encima',           precio: '15.00', categoria: 'Pan',        stockDisponible: 18, imagenUrl: IMG.pan },
  { sku: 'PAN-NOV-01', nombre: 'Novio',                   descripcion: 'Pan de mantequilla alargado con betún rosa',                   precio: '16.00', categoria: 'Pan',        stockDisponible: 15, imagenUrl: IMG.pan },
  { sku: 'PAN-BES-01', nombre: 'Beso',                    descripcion: 'Sandwich de dos polvorones con betún de cajeta al centro',     precio: '18.00', categoria: 'Pan',        stockDisponible: 20, imagenUrl: IMG.pan },
  { sku: 'PAN-CAC-01', nombre: 'Caracol de canela',       descripcion: 'Pan enrollado con canela, azúcar y betún',                    precio: '22.00', categoria: 'Pan',        stockDisponible: 12, imagenUrl: IMG.pan },
  { sku: 'PAN-CAQ-01', nombre: 'Caracol de queso',        descripcion: 'Pan enrollado con queso crema y azúcar',                      precio: '24.00', categoria: 'Pan',        stockDisponible: 10, imagenUrl: IMG.pan },
  { sku: 'PAN-CAM-01', nombre: 'Campechana',              descripcion: 'Hojaldre con piloncillo, crujiente y caramelizada',            precio: '20.00', categoria: 'Pan',        stockDisponible: 16, imagenUrl: IMG.oreja },
  { sku: 'PAN-HOJ-01', nombre: 'Hojaldra',                descripcion: 'Pan hojaldrado dulce, ligero y crujiente',                    precio: '18.00', categoria: 'Pan',        stockDisponible: 15, imagenUrl: IMG.oreja },
  { sku: 'PAN-COC-01', nombre: 'Cocol de anís',           descripcion: 'Pan de anís con piloncillo, forma romboidal',                  precio: '10.00', categoria: 'Pan',        stockDisponible: 25, imagenUrl: IMG.pan },
  { sku: 'PAN-YEM-01', nombre: 'Pan de yema',             descripcion: 'Pan esponjoso hecho con yemas de huevo y azúcar',             precio: '14.00', categoria: 'Pan',        stockDisponible: 20, imagenUrl: IMG.pan },
  { sku: 'PAN-NAT-01', nombre: 'Pan de nata',             descripcion: 'Pan suave con nata de leche, sabor tradicional',              precio: '16.00', categoria: 'Pan',        stockDisponible: 18, imagenUrl: IMG.pan },
  { sku: 'PAN-SEM-01', nombre: 'Semita de piloncillo',    descripcion: 'Pan plano dulce con piloncillo y canela, estilo oaxaqueño',   precio: '18.00', categoria: 'Pan',        stockDisponible: 12, imagenUrl: IMG.pan },
  { sku: 'PAN-GAR-01', nombre: 'Garibaldi',               descripcion: 'Panqué de mantequilla bañado en mermelada y grageas de colores', precio: '22.00', categoria: 'Pan',   stockDisponible: 14, imagenUrl: IMG.pan },
  { sku: 'PAN-MED-01', nombre: 'Media luna',              descripcion: 'Pan en forma de media luna con mantequilla y azúcar glass',   precio: '18.00', categoria: 'Pan',        stockDisponible: 20, imagenUrl: IMG.cuerno },
  { sku: 'PAN-ELO-01', nombre: 'Elotito',                 descripcion: 'Pan dulce en forma de elote, hecho con masa de maíz',         precio: '14.00', categoria: 'Pan',        stockDisponible: 15, imagenUrl: IMG.pan },
  { sku: 'PAN-GOR-01', nombre: 'Gordita de piloncillo',   descripcion: 'Gordita dulce de harina con piloncillo y anís',               precio: '12.00', categoria: 'Pan',        stockDisponible: 20, imagenUrl: IMG.pan },
  { sku: 'PAN-BOR-01', nombre: 'Borracho de naranja',     descripcion: 'Bizcocho esponjoso bañado en almíbar de naranja y ron',       precio: '22.00', categoria: 'Pan',        stockDisponible: 10, imagenUrl: IMG.pan },
  { sku: 'PAN-CUA-01', nombre: 'Cuadrito de ajonjolí',    descripcion: 'Pan cuadrado con costra de ajonjolí tostado y piloncillo',    precio: '14.00', categoria: 'Pan',        stockDisponible: 18, imagenUrl: IMG.pan },
  { sku: 'PAN-TRE-01', nombre: 'Trenza de queso y canela', descripcion: 'Pan trenzado dulce con queso crema y canela',                precio: '35.00', categoria: 'Pan',        stockDisponible:  8, imagenUrl: IMG.pan },
  { sku: 'PAN-VOL-01', nombre: 'Volcán de chocolate',     descripcion: 'Pan individual de chocolate con corazón fundido de cajeta',   precio: '32.00', categoria: 'Pan',        stockDisponible: 10, imagenUrl: IMG.brownie },
  { sku: 'PAN-QUE-01', nombre: 'Quequito de vainilla',    descripcion: 'Panqué individual de vainilla con betún de queso crema',      precio: '20.00', categoria: 'Pan',        stockDisponible: 15, imagenUrl: IMG.muffin },
  { sku: 'PAN-QUC-01', nombre: 'Quequito de chocolate',   descripcion: 'Panqué individual de chocolate con chispas',                  precio: '22.00', categoria: 'Pan',        stockDisponible: 12, imagenUrl: IMG.muffin },
  { sku: 'PAN-PAN-01', nombre: 'Panqué de plátano',       descripcion: 'Rebanada de panqué húmedo de plátano macho con nuez',         precio: '25.00', categoria: 'Pan',        stockDisponible: 10, imagenUrl: IMG.pan },
  { sku: 'PAN-PNA-01', nombre: 'Panqué de naranja',       descripcion: 'Rebanada de panqué cítrico con ralladura de naranja',         precio: '22.00', categoria: 'Pan',        stockDisponible: 12, imagenUrl: IMG.pan },
  { sku: 'PAN-DON-01', nombre: 'Donut glaseado',          descripcion: 'Dona esponjosa con glaseado de vainilla',                     precio: '20.00', categoria: 'Pan',        stockDisponible: 15, imagenUrl: IMG.pan },
  { sku: 'PAN-DOC-01', nombre: 'Donut de chocolate',      descripcion: 'Dona con cobertura de chocolate oscuro',                      precio: '22.00', categoria: 'Pan',        stockDisponible: 12, imagenUrl: IMG.pan },
  { sku: 'PAN-DOJ-01', nombre: 'Donut relleno de cajeta', descripcion: 'Dona rellena de cajeta de leche de cabra',                    precio: '24.00', categoria: 'Pan',        stockDisponible: 10, imagenUrl: IMG.pan },
  { sku: 'PAN-PUC-01', nombre: 'Cuernito de azúcar',      descripcion: 'Cuernito de pan suave rodado en azúcar cristalizada',         precio: '12.00', categoria: 'Pan',        stockDisponible: 22, imagenUrl: IMG.cuerno },

  // ── Churros (5) ──────────────────────────────────────────────────────────────
  { sku: 'CHU-CLA-01', nombre: 'Churro clásico',          descripcion: 'Churro frito con azúcar y canela, crujiente por fuera',       precio: '18.00', categoria: 'Churros',    stockDisponible: 20, imagenUrl: IMG.churro },
  { sku: 'CHU-CAJ-01', nombre: 'Churro con cajeta',       descripcion: 'Churro relleno de cajeta de leche de cabra',                  precio: '22.00', categoria: 'Churros',    stockDisponible: 15, imagenUrl: IMG.churro },
  { sku: 'CHU-CHO-01', nombre: 'Churro relleno chocolate', descripcion: 'Churro crujiente relleno de ganache de chocolate',           precio: '24.00', categoria: 'Churros',    stockDisponible: 12, imagenUrl: IMG.churro },
  { sku: 'CHU-BUN-01', nombre: 'Buñuelo',                 descripcion: 'Buñuelo redondo y crujiente con azúcar y canela',             precio: '15.00', categoria: 'Churros',    stockDisponible: 18, imagenUrl: IMG.churro },
  { sku: 'CHU-BUV-01', nombre: 'Buñuelo de viento',       descripcion: 'Buñuelo ligero y esponjoso bañado en miel de piloncillo',     precio: '18.00', categoria: 'Churros',    stockDisponible: 12, imagenUrl: IMG.churro },

  // ── Muffins & Cupcakes (8) ───────────────────────────────────────────────────
  { sku: 'MUF-ARA-01', nombre: 'Muffin de arándano',      descripcion: 'Muffin esponjoso con arándanos frescos y azúcar glass',       precio: '28.00', categoria: 'Muffins',    stockDisponible: 15, imagenUrl: IMG.muffin },
  { sku: 'MUF-CHO-01', nombre: 'Muffin de chocolate',     descripcion: 'Muffin húmedo de chocolate oscuro con chips',                 precio: '28.00', categoria: 'Muffins',    stockDisponible: 15, imagenUrl: IMG.muffin },
  { sku: 'MUF-ZAR-01', nombre: 'Muffin de zanahoria',     descripcion: 'Muffin de zanahoria con canela y betún de queso crema',       precio: '30.00', categoria: 'Muffins',    stockDisponible: 12, imagenUrl: IMG.muffin },
  { sku: 'MUF-LIM-01', nombre: 'Muffin de limón',         descripcion: 'Muffin cítrico con glaseado de limón y ralladura',            precio: '28.00', categoria: 'Muffins',    stockDisponible: 12, imagenUrl: IMG.muffin },
  { sku: 'CUP-VAN-01', nombre: 'Cupcake de vainilla',     descripcion: 'Cupcake con betún de buttercream de vainilla decorado',       precio: '32.00', categoria: 'Muffins',    stockDisponible: 10, imagenUrl: IMG.muffin },
  { sku: 'CUP-CHO-01', nombre: 'Cupcake de chocolate',    descripcion: 'Cupcake de chocolate con betún de ganache y decoración',      precio: '32.00', categoria: 'Muffins',    stockDisponible: 10, imagenUrl: IMG.muffin },
  { sku: 'CUP-VEL-01', nombre: 'Cupcake red velvet',      descripcion: 'Cupcake red velvet con betún de queso crema',                 precio: '35.00', categoria: 'Muffins',    stockDisponible:  8, imagenUrl: IMG.muffin },
  { sku: 'CUP-LIM-01', nombre: 'Cupcake de limón',        descripcion: 'Cupcake de limón con merengue tostado en la punta',           precio: '34.00', categoria: 'Muffins',    stockDisponible:  8, imagenUrl: IMG.muffin },

  // ── Brownies & Pays (8) ──────────────────────────────────────────────────────
  { sku: 'BRO-CHO-01', nombre: 'Brownie de chocolate',    descripcion: 'Brownie fudgy de chocolate oscuro belga',                     precio: '30.00', categoria: 'Brownies',   stockDisponible: 12, imagenUrl: IMG.brownie },
  { sku: 'BRO-NUE-01', nombre: 'Brownie de nuez y cajeta', descripcion: 'Brownie de chocolate con nuez y hilo de cajeta',             precio: '35.00', categoria: 'Brownies',   stockDisponible: 10, imagenUrl: IMG.brownie },
  { sku: 'BRO-MEN-01', nombre: 'Brownie menta y chocolate', descripcion: 'Brownie de chocolate con betún de menta fresca',            precio: '32.00', categoria: 'Brownies',   stockDisponible:  8, imagenUrl: IMG.brownie },
  { sku: 'PAY-MAN-01', nombre: 'Pay de manzana (rebanada)', descripcion: 'Rebanada de pay de manzana con canela y base de mantequilla', precio: '38.00', categoria: 'Brownies', stockDisponible: 10, imagenUrl: IMG.especial },
  { sku: 'PAY-LIM-01', nombre: 'Pay de limón (rebanada)',  descripcion: 'Rebanada de pay de limón con merengue italiano',             precio: '38.00', categoria: 'Brownies',   stockDisponible: 10, imagenUrl: IMG.especial },
  { sku: 'PAY-QUE-01', nombre: 'Pay de queso (rebanada)',  descripcion: 'Rebanada de cheesecake clásico con coulis de fresa',         precio: '40.00', categoria: 'Brownies',   stockDisponible:  8, imagenUrl: IMG.especial },
  { sku: 'PAY-CAP-01', nombre: 'Pay de capuchino (rebanada)', descripcion: 'Rebanada de pay de café con base de galleta de chocolate', precio: '42.00', categoria: 'Brownies',  stockDisponible:  6, imagenUrl: IMG.especial },
  { sku: 'PAY-NUE-01', nombre: 'Pay de nuez (rebanada)',   descripcion: 'Rebanada de pay de nuez al estilo sureño con piloncillo',    precio: '40.00', categoria: 'Brownies',   stockDisponible:  6, imagenUrl: IMG.especial },

  // ── Especiales (4) ───────────────────────────────────────────────────────────
  { sku: 'ESP-TRE-01', nombre: 'Tres leches rebanada',    descripcion: 'Rebanada de pastel tres leches artesanal',                    precio: '40.00', categoria: 'Especiales', stockDisponible:  5, imagenUrl: IMG.pastel },
  { sku: 'ESP-CRO-01', nombre: 'Croissant artesanal',     descripcion: 'Croissant hojaldrado con mantequilla francesa',               precio: '38.00', categoria: 'Especiales', stockDisponible:  8, imagenUrl: IMG.cuerno },
  { sku: 'ESP-PUM-01', nombre: 'Pan de muerto chico',     descripcion: 'Pan de muerto individual con azúcar y anís',                  precio: '35.00', categoria: 'Especiales', stockDisponible:  0, activo: false, imagenUrl: IMG.rosca },
  { sku: 'ESP-ROC-01', nombre: 'Rosca de reyes individual', descripcion: 'Roscón pequeño con frutos secos y muñeco',                  precio: '45.00', categoria: 'Especiales', stockDisponible:  0, activo: false, imagenUrl: IMG.rosca },

  // ── Bebidas (15) ─────────────────────────────────────────────────────────────
  { sku: 'BEB-CAF-01', nombre: 'Café americano',          descripcion: 'Café negro preparado al momento',                             precio: '25.00', categoria: 'Bebidas',    stockDisponible: 50, imagenUrl: IMG.cafe },
  { sku: 'BEB-CAP-01', nombre: 'Capuchino',               descripcion: 'Espresso con leche vaporizada y espuma',                     precio: '35.00', categoria: 'Bebidas',    stockDisponible: 50, imagenUrl: IMG.cafe },
  { sku: 'BEB-OLL-01', nombre: 'Café de olla',            descripcion: 'Café tradicional hervido con canela y piloncillo',            precio: '22.00', categoria: 'Bebidas',    stockDisponible: 40, imagenUrl: IMG.cafe },
  { sku: 'BEB-CAL-01', nombre: 'Café con leche',          descripcion: 'Café fuerte con leche caliente y azúcar',                    precio: '28.00', categoria: 'Bebidas',    stockDisponible: 40, imagenUrl: IMG.cafe },
  { sku: 'BEB-CHO-01', nombre: 'Chocolate caliente',      descripcion: 'Chocolate artesanal con leche y canela',                     precio: '30.00', categoria: 'Bebidas',    stockDisponible: 40, imagenUrl: IMG.chocolate },
  { sku: 'BEB-CHF-01', nombre: 'Chocolate mexicano frío', descripcion: 'Chocolate abuelita batido con leche fría y hielo',           precio: '30.00', categoria: 'Bebidas',    stockDisponible: 30, imagenUrl: IMG.chocolate },
  { sku: 'BEB-ATG-01', nombre: 'Atole de guayaba',        descripcion: 'Atole casero de maíz con guayaba',                           precio: '28.00', categoria: 'Bebidas',    stockDisponible: 20, imagenUrl: IMG.bebida },
  { sku: 'BEB-ATV-01', nombre: 'Atole de vainilla',       descripcion: 'Atole casero de maíz con vainilla',                          precio: '25.00', categoria: 'Bebidas',    stockDisponible: 25, imagenUrl: IMG.bebida },
  { sku: 'BEB-ATF-01', nombre: 'Atole de fresa',          descripcion: 'Atole casero de maíz con fresa natural',                     precio: '28.00', categoria: 'Bebidas',    stockDisponible: 18, imagenUrl: IMG.bebida },
  { sku: 'BEB-ATM-01', nombre: 'Atole de maíz',           descripcion: 'Atole de champurrado con maíz y chocolate',                  precio: '25.00', categoria: 'Bebidas',    stockDisponible: 20, imagenUrl: IMG.bebida },
  { sku: 'BEB-JAM-01', nombre: 'Agua de jamaica',         descripcion: 'Agua de jamaica fría con limón y azúcar',                    precio: '20.00', categoria: 'Bebidas',    stockDisponible: 30, imagenUrl: IMG.bebida },
  { sku: 'BEB-HOR-01', nombre: 'Agua de horchata',        descripcion: 'Horchata artesanal de arroz con canela y vainilla',           precio: '22.00', categoria: 'Bebidas',    stockDisponible: 25, imagenUrl: IMG.bebida },
  { sku: 'BEB-JUG-01', nombre: 'Jugo de naranja natural', descripcion: 'Jugo exprimido al momento',                                  precio: '30.00', categoria: 'Bebidas',    stockDisponible: 20, imagenUrl: IMG.cafe },
  { sku: 'BEB-LIC-01', nombre: 'Licuado de plátano',      descripcion: 'Licuado de plátano con leche, miel y un toque de vainilla',  precio: '28.00', categoria: 'Bebidas',    stockDisponible: 15, imagenUrl: IMG.bebida },
  { sku: 'BEB-MAN-01', nombre: 'Té de manzanilla',        descripcion: 'Infusión de manzanilla con miel y limón',                    precio: '18.00', categoria: 'Bebidas',    stockDisponible: 30, imagenUrl: IMG.bebida },

  // ── Pasteles (encargo, 22) ────────────────────────────────────────────────────
  { sku: 'ENC-TRL-01', nombre: 'Pastel tres leches (completo)', descripcion: 'Pastel tres leches de 20cm para 10 personas',           precio: '420.00', categoria: 'Pasteles', stockDisponible: 0, requiereEncargo: true, imagenUrl: IMG.pastel },
  { sku: 'ENC-CHO-01', nombre: 'Pastel de chocolate oscuro',    descripcion: 'Pastel de chocolate belga 20cm, betún de ganache',      precio: '480.00', categoria: 'Pasteles', stockDisponible: 0, requiereEncargo: true, imagenUrl: IMG.pastel },
  { sku: 'ENC-VAN-01', nombre: 'Pastel de vainilla con fresas', descripcion: 'Pastel esponjoso de vainilla con crema y fresas frescas', precio: '460.00', categoria: 'Pasteles', stockDisponible: 0, requiereEncargo: true, imagenUrl: IMG.pastel },
  { sku: 'ENC-VEL-01', nombre: 'Pastel red velvet',             descripcion: 'Pastel red velvet de 20cm con betún de queso crema',   precio: '500.00', categoria: 'Pasteles', stockDisponible: 0, requiereEncargo: true, imagenUrl: IMG.pastel },
  { sku: 'ENC-ZAR-01', nombre: 'Pastel de zanahoria',           descripcion: 'Pastel de zanahoria con betún de queso crema y nuez',  precio: '470.00', categoria: 'Pasteles', stockDisponible: 0, requiereEncargo: true, imagenUrl: IMG.pastel },
  { sku: 'ENC-NUE-01', nombre: 'Pastel de nuez y cajeta',       descripcion: 'Pastel de nuez bañado en cajeta de leche, 20cm',       precio: '520.00', categoria: 'Pasteles', stockDisponible: 0, requiereEncargo: true, imagenUrl: IMG.pastel },
  { sku: 'ENC-OPE-01', nombre: 'Pastel ópera',                  descripcion: 'Capas de bizcocho, café y ganache, estilo francés',    precio: '580.00', categoria: 'Pasteles', stockDisponible: 0, requiereEncargo: true, imagenUrl: IMG.pastel },
  { sku: 'ENC-LIM-01', nombre: 'Pastel de limón con merengue',  descripcion: 'Pastel cítrico de limón con merengue italiano tostado', precio: '490.00', categoria: 'Pasteles', stockDisponible: 0, requiereEncargo: true, imagenUrl: IMG.pastel },
  { sku: 'ENC-CEB-01', nombre: 'Pastel cebra',                  descripcion: 'Pastel bicolor vainilla y chocolate con efecto cebra', precio: '480.00', categoria: 'Pasteles', stockDisponible: 0, requiereEncargo: true, imagenUrl: IMG.pastel },
  { sku: 'ENC-QUE-01', nombre: 'Pastel de queso con durazno',   descripcion: 'Cheesecake horneado con mermelada de durazno encima',  precio: '510.00', categoria: 'Pasteles', stockDisponible: 0, requiereEncargo: true, imagenUrl: IMG.pastel },
  { sku: 'ENC-BOD-01', nombre: 'Pastel de boda (dos pisos)',     descripcion: 'Pastel nupcial de dos pisos, sabor y decoración a elegir', precio: '2800.00', categoria: 'Pasteles', stockDisponible: 0, requiereEncargo: true, imagenUrl: IMG.pastel },
  { sku: 'ENC-PIN-01', nombre: 'Pastel de piñata',               descripcion: 'Pastel sorpresa con relleno de dulces en su interior', precio: '650.00', categoria: 'Pasteles', stockDisponible: 0, requiereEncargo: true, imagenUrl: IMG.pastel },
  { sku: 'ENC-INF-01', nombre: 'Pastel de cumpleaños infantil',  descripcion: 'Pastel 20cm con decoración personalizada para niños', precio: '490.00', categoria: 'Pasteles', stockDisponible: 0, requiereEncargo: true, imagenUrl: IMG.pastel },
  { sku: 'ENC-CAR-01', nombre: 'Carlota de limón',               descripcion: 'Postre de galletas María con crema de limón, refrescante', precio: '380.00', categoria: 'Pasteles', stockDisponible: 0, requiereEncargo: true, imagenUrl: IMG.pastel },
  { sku: 'ENC-GNY-01', nombre: 'Gelatina de mosaico',            descripcion: 'Gelatina de leche con cubos de colores y leche condensada', precio: '280.00', categoria: 'Pasteles', stockDisponible: 0, requiereEncargo: true, imagenUrl: IMG.especial },
  { sku: 'ENC-GQF-01', nombre: 'Gelatina de queso con fruta',    descripcion: 'Gelatina cremosa de queso philadelphia con fruta de temporada', precio: '320.00', categoria: 'Pasteles', stockDisponible: 0, requiereEncargo: true, imagenUrl: IMG.especial },
  { sku: 'ENC-PNY-01', nombre: 'Pay de queso NY (completo)',      descripcion: 'Cheesecake estilo Nueva York completo, 22cm',         precio: '580.00', categoria: 'Pasteles', stockDisponible: 0, requiereEncargo: true, imagenUrl: IMG.especial },
  { sku: 'ENC-PMC-01', nombre: 'Pay de manzana (completo)',       descripcion: 'Pay de manzana con canela, malla de masa, 22cm',     precio: '420.00', categoria: 'Pasteles', stockDisponible: 0, requiereEncargo: true, imagenUrl: IMG.especial },
  // Pre-existing pasteles personalizados
  { sku: 'ENC-PAS-01', nombre: 'Pastel personalizado (chico)',    descripcion: 'Pastel 20cm para 10 personas, sabor a elegir',        precio: '450.00', categoria: 'Pasteles', stockDisponible: 0, requiereEncargo: true, imagenUrl: IMG.pastel },
  { sku: 'ENC-PAS-02', nombre: 'Pastel personalizado (mediano)',  descripcion: 'Pastel 25cm para 20 personas, sabor a elegir',        precio: '750.00', categoria: 'Pasteles', stockDisponible: 0, requiereEncargo: true, imagenUrl: IMG.pastel },
  { sku: 'ENC-PAS-03', nombre: 'Pastel personalizado (grande)',   descripcion: 'Pastel 30cm para 35 personas, sabor a elegir',        precio: '1100.00', categoria: 'Pasteles', stockDisponible: 0, requiereEncargo: true, imagenUrl: IMG.pastel },
  { sku: 'ENC-PAS-04', nombre: 'Pastel quinceañera (3 pisos)',    descripcion: 'Pastel 35cm de 3 pisos para quinceañera, diseño personalizado', precio: '2200.00', categoria: 'Pasteles', stockDisponible: 0, requiereEncargo: true, imagenUrl: IMG.pastel },

  // ── Encargos de caja (8) ──────────────────────────────────────────────────────
  { sku: 'ENC-CON-01', nombre: 'Caja de conchas x12',            descripcion: 'Docena de conchas surtidas (vainilla, chocolate, fresa)', precio: '200.00', categoria: 'Encargos', stockDisponible: 0, requiereEncargo: true, imagenUrl: IMG.concha },
  { sku: 'ENC-POL-01', nombre: 'Caja de polvorones x24',         descripcion: 'Caja decorada de 24 polvorones surtidos, ideal para regalo', precio: '320.00', categoria: 'Encargos', stockDisponible: 0, requiereEncargo: true, imagenUrl: IMG.polvoron },
  { sku: 'ENC-GAL-01', nombre: 'Caja galletas decoradas x20',    descripcion: 'Caja de 20 galletas decoradas con el diseño que elijas', precio: '480.00', categoria: 'Encargos', stockDisponible: 0, requiereEncargo: true, imagenUrl: IMG.galleta },
  { sku: 'ENC-PUM-01', nombre: 'Pan de muerto familiar',         descripcion: 'Pan de muerto grande 30cm para 8-10 porciones',       precio: '280.00', categoria: 'Encargos', stockDisponible: 0, requiereEncargo: true, imagenUrl: IMG.rosca },
  { sku: 'ENC-ROC-01', nombre: 'Rosca de reyes grande',          descripcion: 'Rosca para 15-20 personas con frutos secos y 3 muñecos', precio: '650.00', categoria: 'Encargos', stockDisponible: 0, requiereEncargo: true, imagenUrl: IMG.rosca },
  { sku: 'ENC-DON-01', nombre: 'Caja de donas x12',              descripcion: 'Docena de donas surtidas: glaseadas, chocolate y cajeta', precio: '240.00', categoria: 'Encargos', stockDisponible: 0, requiereEncargo: true, imagenUrl: IMG.pan },
  { sku: 'ENC-CUR-01', nombre: 'Caja de cuernos surtidos x12',   descripcion: 'Docena de cuernos: mantequilla, chocolate y canela',  precio: '280.00', categoria: 'Encargos', stockDisponible: 0, requiereEncargo: true, imagenUrl: IMG.cuerno },
  { sku: 'ENC-CAN-01', nombre: 'Canasta navideña surtida',        descripcion: 'Canasta con pan dulce, polvorones y chocolates artesanales', precio: '850.00', categoria: 'Encargos', stockDisponible: 0, requiereEncargo: true, imagenUrl: IMG.rosca },
];

/**
 * Test users — one per role — with plain-text passwords hashed at seed time.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const usuarios = [
  { nombre: 'Admin Yanet',      email: 'admin@antojo.mx',       password: 'Admin123!',    rol: 'ADMIN'           as const },
  { nombre: 'Maestro Panadero', email: 'panadero@antojo.mx',    password: 'Pan123!',      rol: 'MAESTRO_PANADERO' as const },
  { nombre: 'Cajero Uno',       email: 'cajero@antojo.mx',      password: 'Cajero123!',   rol: 'CAJERO'          as const },
  { nombre: 'Repartidor Uno',   email: 'repartidor@antojo.mx',  password: 'Rep123!',      rol: 'REPARTIDOR'      as const },
  { nombre: 'Cliente Prueba',   email: 'cliente@antojo.mx',     password: 'Cliente123!',  rol: 'CLIENTE'         as const },
];

/**
 * Runs the seed: upserts every product by SKU and every test user by email.
 * Idempotent — re-running only refreshes the imagenUrl of existing products.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {Promise<void>}
 */
async function main() {
  console.log('Iniciando seed...');

  for (const p of productos) {
    await prisma.producto.upsert({
      where:  { sku: p.sku },
      update: { imagenUrl: p.imagenUrl ?? null },
      create: {
        sku:             p.sku,
        nombre:          p.nombre,
        descripcion:     p.descripcion,
        precio:          p.precio,
        categoria:       p.categoria,
        stockDisponible: p.stockDisponible,
        requiereEncargo: p.requiereEncargo ?? false,
        activo:          p.activo ?? true,
        imagenUrl:       p.imagenUrl ?? null,
      },
    });
  }

  console.log(`Productos insertados/actualizados: ${productos.length}`);

  for (const u of usuarios) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.usuario.upsert({
      where:  { email: u.email },
      update: {},
      create: { nombre: u.nombre, email: u.email, passwordHash, rol: u.rol },
    });
  }

  console.log(`Usuarios insertados: ${usuarios.length}`);
  console.log('Seed completado.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
