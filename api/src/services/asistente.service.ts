/**
 * DulceBot AI assistant service: builds the RAG-augmented prompt per role, runs the
 * Groq function-calling loop and executes the server-side tools.
 * Each staff role receives a tailored tool set and system-prompt context so the
 * assistant behaves as a specialist for that role, not a generic chatbot.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { PrismaClient } from '@prisma/client';
import { llamarGroq, esError, GroqTool } from '../lib/groq.js';
import { buscarChunksRelevantes } from '../lib/rag.js';
import { agregarMensaje, obtenerHistorial } from '../lib/chat-history.js';
import { verificarOwnership } from './pedido.service.js';

const prisma = new PrismaClient();

/**
 * A product line the assistant asks the frontend to add to the customer's cart.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @property {number} productoId - Product ID.
 * @property {string} nombre - Product name.
 * @property {number} precio - Unit price in MXN.
 * @property {number} cantidad - Quantity to add.
 * @property {boolean} esEncargo - Whether the product is made-to-order.
 * @property {string | null} imagenUrl - Product image URL.
 */
export interface ItemCarritoChat {
  productoId: number;
  nombre: string;
  precio: number;
  cantidad: number;
  esEncargo: boolean;
  imagenUrl: string | null;
}

/**
 * Result of executing a tool: text for the model plus an optional UI action and payload.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @property {string} resultado - Text result sent back to the model.
 * @property {string} [accion] - UI action for the frontend.
 * @property {Record<string, unknown>} [datosEncargo] - Custom-order data.
 * @property {ItemCarritoChat[]} [itemsCarrito] - Products to add to the cart.
 * @property {number} [pedidoId] - Order the frontend should show.
 * @property {string[]} [fuentesUsadas] - Knowledge-base files consulted (buscar_en_menu only).
 */
interface ResultadoTool {
  resultado: string;
  accion?: string;
  datosEncargo?: Record<string, unknown>;
  itemsCarrito?: ItemCarritoChat[];
  pedidoId?: number;
  fuentesUsadas?: string[];
}

/** Words ignored when matching a product name. */
const STOPWORDS = new Set(['de', 'del', 'con', 'la', 'las', 'el', 'los', 'y', 'un', 'una', 'unos', 'unas', 'sin']);

/**
 * Normalizes text into comparable tokens: lowercase, no accents, no stopwords.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string} texto - Text to tokenize.
 * @returns {string[]} The normalized tokens.
 */
function tokenizar(texto: string): string[] {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map((t) => (t.length > 3 ? t.replace(/(es|s)$/, '') : t));
}

/**
 * Finds the active product that best matches a free-text name.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string} nombre - Product name as written by the customer or the model.
 * @returns {Promise<{ producto?: Producto; candidatos: Producto[] }>} The match or candidates.
 */
async function buscarProducto(nombre: string) {
  const productos = await prisma.producto.findMany({ where: { activo: true } });
  const tokensQuery = tokenizar(nombre);
  if (tokensQuery.length === 0) return { producto: undefined, candidatos: [] };

  const puntuados = productos
    .map((p) => {
      const tokensNombre = tokenizar(p.nombre);
      const coincidencias = tokensQuery.filter((t) => tokensNombre.includes(t)).length;
      return { p, score: coincidencias / tokensQuery.length, exacto: tokensNombre.length === tokensQuery.length };
    })
    .filter((x) => x.score >= 0.5);

  if (puntuados.length === 0) return { producto: undefined, candidatos: [] };
  const max = Math.max(...puntuados.map((x) => x.score));
  const mejores = puntuados.filter((x) => x.score === max);
  if (mejores.length === 1) return { producto: mejores[0].p, candidatos: [] };
  const exactos = mejores.filter((x) => x.exacto);
  if (exactos.length === 1) return { producto: exactos[0].p, candidatos: [] };
  return { producto: undefined, candidatos: mejores.map((x) => x.p) };
}

/**
 * Removes Markdown emphasis the model adds despite the prompt.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string} texto - Model reply.
 * @returns {string} Plain-text reply.
 */
function limpiarMarkdown(texto: string): string {
  return texto
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\p{Emoji_Presentation}/gu, '')
    .replace(/\p{Extended_Pictographic}/gu, '');
}

// ── Tool definitions ──────────────────────────────────────────────────────────

const T_BUSCAR_MENU: GroqTool = {
  type: 'function',
  function: {
    name: 'buscar_en_menu',
    description: 'Busca productos REALES en el menú por nombre o categoría. Úsala cuando alguien pregunte qué vendemos, qué hay disponible o cuál es el precio de algo. Es la fuente de verdad del catálogo.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Término de búsqueda' } },
      required: ['query'],
    },
  },
};

const T_AGREGAR_CARRITO: GroqTool = {
  type: 'function',
  function: {
    name: 'agregar_al_carrito',
    description: 'Agrega productos del menú al carrito del cliente. Úsala siempre que el cliente pida o acepte comprar productos. Es la ÚNICA forma de agregar productos; el cliente confirma el pedido en el checkout.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'Productos a agregar',
          items: {
            type: 'object',
            properties: {
              producto: { type: 'string', description: 'Nombre del producto tal como lo dijo el cliente' },
              cantidad: { type: 'number', description: 'Cantidad de piezas (entero ≥ 1)' },
            },
            required: ['producto', 'cantidad'],
          },
        },
      },
      required: ['items'],
    },
  },
};

const T_CONSULTAR_PEDIDO: GroqTool = {
  type: 'function',
  function: {
    name: 'consultar_pedido',
    description: 'Consulta el estatus actual de un pedido por su ID.',
    parameters: {
      type: 'object',
      properties: { pedidoId: { type: 'number', description: 'ID del pedido' } },
      required: ['pedidoId'],
    },
  },
};

const T_CONSULTAR_STOCK: GroqTool = {
  type: 'function',
  function: {
    name: 'consultar_stock',
    description: 'Consulta la disponibilidad en inventario de un producto. Útil para saber cuántas piezas quedan antes de hacer una venta o tarea de producción.',
    parameters: {
      type: 'object',
      properties: {
        productoId: { type: 'number', description: 'ID del producto (opcional)' },
        nombre: { type: 'string', description: 'Nombre o parte del nombre del producto' },
      },
    },
  },
};

const T_INICIAR_ENCARGO: GroqTool = {
  type: 'function',
  function: {
    name: 'iniciar_encargo',
    description: 'Recopila los datos de un encargo personalizado (pastel con diseño, rosca, etc.). NO crea ningún pedido; guarda la solicitud para que el equipo la revise.',
    parameters: {
      type: 'object',
      properties: {
        producto: { type: 'string', description: 'Tipo de producto a encargar' },
        fechaDeseada: { type: 'string', description: 'Fecha deseada en formato YYYY-MM-DD' },
        personas: { type: 'number', description: 'Cantidad de personas a servir' },
        detalles: { type: 'string', description: 'Detalles del encargo (sabor, decoración, leyenda, etc.)' },
      },
      required: ['producto'],
    },
  },
};

const T_LISTAR_PEDIDOS: GroqTool = {
  type: 'function',
  function: {
    name: 'listar_pedidos_activos',
    description: 'Lista pedidos activos (no entregados ni cancelados). Acepta filtro por estatus y/o tipo de entrega. Úsala para ver el estado de la operación, cuántos pedidos hay pendientes, cuáles están listos para entrega, etc.',
    parameters: {
      type: 'object',
      properties: {
        estatus: {
          type: 'string',
          description: 'Filtra por estatus: PENDIENTE, EN_PREPARACION, LISTO, EN_CAMINO, SOLICITUD_CANCELACION. Omite para ver todos.',
        },
        tipoEntrega: {
          type: 'string',
          description: 'Filtra por tipo: DOMICILIO o MOSTRADOR. Omite para ver ambos.',
        },
      },
    },
  },
};

const T_CAMBIAR_ESTATUS: GroqTool = {
  type: 'function',
  function: {
    name: 'cambiar_estatus_pedido',
    description: 'Cambia el estatus de un pedido. Solo disponible para staff con los permisos correspondientes.',
    parameters: {
      type: 'object',
      properties: {
        pedidoId: { type: 'number', description: 'ID del pedido' },
        nuevoEstatus: {
          type: 'string',
          enum: ['EN_PREPARACION', 'LISTO', 'EN_CAMINO', 'ENTREGADO', 'CANCELADO'],
          description: 'Nuevo estatus a asignar',
        },
        nota: { type: 'string', description: 'Nota opcional para el historial' },
      },
      required: ['pedidoId', 'nuevoEstatus'],
    },
  },
};

const T_MIS_PEDIDOS_ASIGNADOS: GroqTool = {
  type: 'function',
  function: {
    name: 'mis_pedidos_asignados',
    description: 'Lista los pedidos de domicilio asignados al repartidor en sesión que aún no han sido entregados. Úsala cuando el repartidor pregunte cuáles son sus entregas, qué tiene pendiente o cuántos pedidos lleva.',
    parameters: { type: 'object', properties: {} },
  },
};

const T_MIS_TAREAS: GroqTool = {
  type: 'function',
  function: {
    name: 'mis_tareas',
    description: 'Lista las tareas de producción activas (PROPUESTA, PENDIENTE, EN_PROCESO). Úsala cuando el maestro panadero pregunte qué tiene que producir, cuántas tareas hay pendientes o en qué está trabajando.',
    parameters: {
      type: 'object',
      properties: {
        estatus: {
          type: 'string',
          description: 'Filtra por estatus: PROPUESTA, PENDIENTE, EN_PROCESO. Omite para ver todas las activas.',
        },
      },
    },
  },
};

const T_REPORTE_VENTAS: GroqTool = {
  type: 'function',
  function: {
    name: 'ver_reporte_ventas',
    description: 'Muestra un resumen de ventas: ingresos totales, número de pedidos entregados, ticket promedio y los 5 productos más vendidos del período.',
    parameters: {
      type: 'object',
      properties: {
        dias: {
          type: 'number',
          description: 'Período en días hacia atrás desde hoy (ej. 7 para la última semana, 30 para el último mes). Por defecto 7.',
        },
      },
    },
  },
};

// ── Tool sets per role ─────────────────────────────────────────────────────────

/**
 * Returns the set of tools available for a given role.
 * Guests and customers get the full shopping toolkit.
 * Each staff role gets a curated set aligned with their responsibilities.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string | undefined} rol - User role or undefined for guest.
 * @returns {GroqTool[]} The tools to pass to the Groq call.
 */
function obtenerToolsPorRol(rol: string | undefined): GroqTool[] {
  switch (rol) {
    case 'REPARTIDOR':
      return [T_BUSCAR_MENU, T_CONSULTAR_PEDIDO, T_MIS_PEDIDOS_ASIGNADOS, T_CAMBIAR_ESTATUS];
    case 'MAESTRO_PANADERO':
      return [T_BUSCAR_MENU, T_CONSULTAR_STOCK, T_MIS_TAREAS, T_CAMBIAR_ESTATUS];
    case 'CAJERO':
      return [T_BUSCAR_MENU, T_CONSULTAR_STOCK, T_CONSULTAR_PEDIDO, T_LISTAR_PEDIDOS, T_CAMBIAR_ESTATUS];
    case 'ADMIN':
      return [
        T_BUSCAR_MENU, T_AGREGAR_CARRITO, T_CONSULTAR_PEDIDO, T_CONSULTAR_STOCK,
        T_INICIAR_ENCARGO, T_LISTAR_PEDIDOS, T_CAMBIAR_ESTATUS, T_MIS_TAREAS, T_REPORTE_VENTAS,
      ];
    default:
      // CLIENTE or guest
      return [T_BUSCAR_MENU, T_AGREGAR_CARRITO, T_CONSULTAR_PEDIDO, T_CONSULTAR_STOCK, T_INICIAR_ENCARGO];
  }
}

// ── Dynamic REGLA #2 ─────────────────────────────────────────────────────────

/**
 * Builds the REGLA #2 block listing only the tools the model actually has access to.
 * A full static list would cause the model to try calling tools it was not given,
 * triggering Groq API errors when those tools are absent from the tools array.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {GroqTool[]} tools - The tool set for the current role.
 * @returns {string} The REGLA #2 block with only the relevant tool descriptions.
 */
function buildRegla2(tools: GroqTool[]): string {
  const names = new Set(tools.map((t) => t.function.name));
  const lines: string[] = ['== REGLA #2 — HERRAMIENTAS SON LA FUENTE DE VERDAD =='];
  if (names.has('buscar_en_menu'))         lines.push('- Qué vendemos / precios: buscar_en_menu.');
  if (names.has('consultar_stock'))        lines.push('- Stock: consultar_stock.');
  if (names.has('consultar_pedido'))       lines.push('- Pedido específico: consultar_pedido.');
  if (names.has('iniciar_encargo'))        lines.push('- Encargos personalizados: iniciar_encargo.');
  if (names.has('agregar_al_carrito'))     lines.push('- Agregar al carrito: agregar_al_carrito (ÚNICA forma; nunca digas que algo se agregó sin haberla llamado).');
  if (names.has('listar_pedidos_activos')) lines.push('- Pedidos activos: listar_pedidos_activos.');
  if (names.has('mis_pedidos_asignados'))  lines.push('- Mis entregas asignadas: mis_pedidos_asignados.');
  if (names.has('mis_tareas'))             lines.push('- Tareas de producción: mis_tareas.');
  if (names.has('ver_reporte_ventas'))     lines.push('- Reporte de ventas: ver_reporte_ventas.');
  if (names.has('cambiar_estatus_pedido')) lines.push('- Cambiar estatus de pedido: cambiar_estatus_pedido.');
  lines.push('Solo usa las herramientas listadas arriba. Si el usuario pide algo que requiere una herramienta que no tienes, dile brevemente que esa función no está disponible para tu rol.');
  return lines.join('\n');
}

// ── Role-specific system-prompt context ───────────────────────────────────────

/**
 * Builds the role-specific context block injected into the system prompt.
 * This is the section that tells DulceBot WHO it is talking to and WHAT it can help with.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {{ usuarioId: number; rol: string } | undefined} auth - Authenticated user.
 * @returns {string} The role context block to insert in the system prompt.
 */
function buildContextoRol(auth?: { usuarioId: number; rol: string }): string {
  if (!auth) return '';

  switch (auth.rol) {
    case 'CAJERO':
      return `
== MODO CAJERO (ID: ${auth.usuarioId}) ==
Estás asistiendo a un CAJERO de la panadería. Su trabajo: gestionar el flujo de pedidos durante el turno.
Lo que puede pedirte:
- Ver cuántos pedidos hay activos o por estatus (usa listar_pedidos_activos).
- Ver pedidos LISTO con entrega DOMICILIO que necesitan repartidor asignado: llama listar_pedidos_activos con estatus="LISTO" y tipoEntrega="DOMICILIO".
- Consultar un pedido específico por ID (usa consultar_pedido — puedes ver cualquier pedido, no solo los tuyos).
- Verificar stock de un producto antes de venderlo en mostrador (usa consultar_stock).
- Avanzar el estatus de un pedido cuando corresponda (usa cambiar_estatus_pedido).
- Buscar qué productos o precios tenemos disponibles (usa buscar_en_menu).
Responde de forma directa y profesional. No ofrezcas agregar productos al carrito del cajero ni hablar de encargos personalizados para él.`;

    case 'REPARTIDOR':
      return `
== MODO REPARTIDOR (ID: ${auth.usuarioId}) ==
Estás asistiendo a un REPARTIDOR. Su trabajo: recoger pedidos LISTO y entregarlos a domicilio.
Lo que puede pedirte:
- Ver sus entregas asignadas pendientes (usa mis_pedidos_asignados — SIEMPRE úsala cuando pregunte qué tiene pendiente o cuántos pedidos lleva).
- Marcar un pedido como EN_CAMINO cuando lo recogió, o ENTREGADO cuando lo entregó (usa cambiar_estatus_pedido).
- Consultar la dirección o datos de un pedido específico (usa consultar_pedido).
- Ver qué productos existen si tiene alguna duda del pedido (usa buscar_en_menu).
Restricciones: solo puede cambiar estatus a EN_CAMINO o ENTREGADO. No puede cancelar pedidos ni cambiarlos a otros estatus — si intenta algo fuera de eso, dile que esa acción corresponde a otro rol.
Responde de forma concisa y operativa.`;

    case 'MAESTRO_PANADERO':
      return `
== MODO MAESTRO PANADERO (ID: ${auth.usuarioId}) ==
Estás asistiendo al MAESTRO PANADERO. Su trabajo: ejecutar la producción diaria de pan y pasteles.
Lo que puede pedirte:
- Ver sus tareas de producción activas (usa mis_tareas — SIEMPRE úsala cuando pregunte qué tiene que producir, qué hay pendiente o en qué debería enfocarse hoy).
- Consultar cuántas piezas de un producto hay en stock (usa consultar_stock — útil para saber si ya hay suficiente o si necesita producir más).
- Avanzar el estatus de un pedido a EN_PREPARACION o LISTO cuando corresponda (usa cambiar_estatus_pedido).
- Buscar detalles de un producto (ingredientes por descripción, categoría, etc.) usando buscar_en_menu.
- Ayudarlo a redactar una propuesta de tarea o lista de producción: cuando pida esto, consolida la info de mis_tareas y consultar_stock para darle un plan claro en texto, sin crear nada en el sistema.
Responde con lenguaje de producción (cantidades, prioridades, estatus de tareas). No ofrezcas agregar al carrito ni hablar de encargos para él.`;

    case 'ADMIN':
      return `
== MODO ADMIN (ID: ${auth.usuarioId}) ==
Estás asistiendo al ADMINISTRADOR. Tiene acceso total al sistema.
Lo que puede pedirte:
- Resumen de ventas (usa ver_reporte_ventas con el periodo en días que pida).
- Ver pedidos activos, filtrar por estatus o tipo de entrega (usa listar_pedidos_activos).
- Consultar o cambiar el estatus de cualquier pedido.
- Ver tareas de producción activas (usa mis_tareas).
- Consultar stock de cualquier producto.
- Buscar productos en el menú o agregar al carrito si lo pide.
- Iniciar un encargo personalizado.
Responde de forma ejecutiva: primero el dato clave, luego el detalle si lo pide. No lo lleves al checkout a menos que explícitamente quiera comprar algo para él.`;

    default:
      return '';
  }
}

// ── Tool executor ─────────────────────────────────────────────────────────────

/**
 * Executes a tool requested by the model on the server.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string} nombre - Tool name requested by the model.
 * @param {Record<string, unknown>} args - Parsed JSON arguments from the tool call.
 * @param {{ usuarioId: number; rol: string }} [auth] - Authenticated user, if any.
 * @param {string} [guestToken] - Guest token of the current visitor, if any.
 * @returns {Promise<ResultadoTool>} Text result plus optional UI action and payload.
 */
async function ejecutarTool(
  nombre: string,
  args: Record<string, unknown>,
  auth?: { usuarioId: number; rol: string },
  guestToken?: string,
): Promise<ResultadoTool> {
  const esStaff = auth && ['ADMIN', 'CAJERO', 'MAESTRO_PANADERO', 'REPARTIDOR'].includes(auth.rol);

  switch (nombre) {

    case 'agregar_al_carrito': {
      const pedidos = Array.isArray(args.items) ? (args.items as { producto?: unknown; cantidad?: unknown }[]) : [];
      const agregados: ItemCarritoChat[] = [];
      const problemas: string[] = [];

      for (const pedido of pedidos) {
        const nombreProducto = String(pedido.producto ?? '').trim();
        const cantidad = Math.floor(Number(pedido.cantidad));
        if (!nombreProducto) continue;
        if (!Number.isFinite(cantidad) || cantidad < 1) {
          problemas.push(`"${nombreProducto}": la cantidad debe ser al menos 1.`);
          continue;
        }
        const { producto, candidatos } = await buscarProducto(nombreProducto);
        if (!producto) {
          problemas.push(
            candidatos.length > 0
              ? `"${nombreProducto}" es ambiguo; pregunta al cliente cuál de estos quiere: ${candidatos.map((c) => c.nombre).join(', ')}.`
              : `"${nombreProducto}" no existe en el menú.`,
          );
          continue;
        }
        if (!producto.requiereEncargo && producto.stockDisponible < cantidad) {
          problemas.push(
            producto.stockDisponible > 0
              ? `${producto.nombre}: solo hay ${producto.stockDisponible} disponibles (pidió ${cantidad}).`
              : `${producto.nombre}: sin stock por hoy.`,
          );
          continue;
        }
        agregados.push({
          productoId: producto.id,
          nombre: producto.nombre,
          precio: Number(producto.precio),
          cantidad,
          esEncargo: producto.requiereEncargo,
          imagenUrl: producto.imagenUrl,
        });
      }

      const lineas: string[] = [];
      if (agregados.length > 0) {
        lineas.push(
          'Agregado al carrito (el cliente debe confirmar en el checkout):',
          ...agregados.map((i) => `- ${i.cantidad} x ${i.nombre} ($${i.precio.toFixed(2)} c/u)${i.esEncargo ? ' [encargo]' : ''}`),
        );
      }
      if (problemas.length > 0) lineas.push('NO se agregó:', ...problemas.map((p) => `- ${p}`));
      if (lineas.length === 0) lineas.push('No se indicó ningún producto; no se agregó nada.');

      return {
        resultado: lineas.join('\n'),
        accion: agregados.length > 0 ? 'AGREGAR_CARRITO' : 'NINGUNA',
        itemsCarrito: agregados.length > 0 ? agregados : undefined,
      };
    }

    case 'consultar_pedido': {
      const pedidoId = Number(args.pedidoId);
      const pedido = await prisma.pedido.findUnique({
        where: { id: pedidoId },
        include: {
          historial: { orderBy: { timestamp: 'desc' }, take: 1 },
          repartidor: { select: { nombre: true } },
        },
      });
      // Staff can see any order; clients only their own.
      if (!pedido || (!esStaff && !verificarOwnership(pedido, auth, guestToken))) {
        return { resultado: 'No encontré ese pedido. Verifica que el número sea correcto.', accion: 'NINGUNA' };
      }
      const detalles = [
        `Pedido #${pedido.id}`,
        `Cliente: ${pedido.nombreCliente}`,
        `Estatus: ${pedido.estatus}`,
        `Tipo: ${pedido.tipoEntrega}`,
        `Total: $${pedido.total} MXN`,
        pedido.repartidor ? `Repartidor: ${pedido.repartidor.nombre}` : null,
        pedido.direccion ? `Dirección: ${pedido.direccion}` : null,
      ].filter(Boolean).join(' | ');
      return { resultado: detalles, accion: 'VER_PEDIDO', pedidoId: pedido.id };
    }

    case 'consultar_stock': {
      const where: Record<string, unknown> = { activo: true };
      if (args.productoId) where.id = Number(args.productoId);
      if (args.nombre) where.nombre = { contains: String(args.nombre) };
      const productos = await prisma.producto.findMany({ where, take: 8 });
      if (productos.length === 0) return { resultado: 'No encontré ese producto en el catálogo.' };
      const resumen = productos
        .map((p) => {
          const stock = p.requiereEncargo ? 'encargo (sin stock físico)' : p.stockDisponible > 0 ? `${p.stockDisponible} disponibles` : 'sin stock hoy';
          return `${p.nombre}: ${stock} - $${p.precio}`;
        })
        .join('\n');
      return { resultado: resumen };
    }

    case 'iniciar_encargo': {
      const datosEncargo = {
        producto: String(args.producto ?? ''),
        fechaDeseada: String(args.fechaDeseada ?? ''),
        personas: Number(args.personas ?? 0),
        detalles: String(args.detalles ?? ''),
      };
      return {
        resultado:
          `Datos del encargo recopilados (${datosEncargo.producto}, fecha: ${datosEncargo.fechaDeseada || 'por definir'}, personas: ${datosEncargo.personas || 'no especificado'}). ` +
          'IMPORTANTE: NO se creó ningún pedido. Dile al cliente que el equipo de la panadería revisará su solicitud y se pondrá en contacto para confirmar disponibilidad y precio.',
        accion: 'NINGUNA',
        datosEncargo,
      };
    }

    case 'buscar_en_menu': {
      const chunks = await buscarChunksRelevantes(String(args.query ?? ''), 5, ['menu.md']);
      const resultado = chunks.map((c) => c.texto).join('\n\n');
      return {
        resultado: resultado || 'No encontré información sobre eso en el menú.',
        accion: 'VER_MENU',
        fuentesUsadas: chunks.length > 0 ? [...new Set(chunks.map((c) => c.fuente))] : undefined,
      };
    }

    case 'listar_pedidos_activos': {
      const terminales = ['ENTREGADO', 'CANCELADO'];
      const where: Record<string, unknown> = { estatus: { notIn: terminales } };
      if (args.estatus) where.estatus = String(args.estatus);
      if (args.tipoEntrega) where.tipoEntrega = String(args.tipoEntrega);
      const pedidos = await prisma.pedido.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        take: 25,
        select: {
          id: true, nombreCliente: true, estatus: true,
          tipoEntrega: true, total: true, createdAt: true,
          repartidor: { select: { nombre: true } },
        },
      });
      if (pedidos.length === 0) return { resultado: 'No hay pedidos activos con ese filtro en este momento.', accion: 'NINGUNA' };
      const lineas = pedidos.map((p) => {
        const rep = p.repartidor ? ` [rep: ${p.repartidor.nombre}]` : '';
        return `#${p.id} ${p.nombreCliente} | ${p.estatus} | ${p.tipoEntrega}${rep} | $${p.total}`;
      });
      return { resultado: `Pedidos activos (${pedidos.length}):\n${lineas.join('\n')}`, accion: 'NINGUNA' };
    }

    case 'cambiar_estatus_pedido': {
      if (!auth) return { resultado: 'No tienes permisos para cambiar el estatus de pedidos.', accion: 'NINGUNA' };
      const pedidoId = Number(args.pedidoId);
      const nuevoEstatus = String(args.nuevoEstatus);
      const nota = args.nota ? String(args.nota) : undefined;
      try {
        const { actualizarEstatus } = await import('./pedido.service.js');
        const actualizado = await actualizarEstatus(
          pedidoId,
          nuevoEstatus as import('@prisma/client').EstatusPedido,
          auth.usuarioId,
          auth.rol,
          nota,
        );
        return { resultado: `Pedido #${actualizado.id} actualizado a ${actualizado.estatus}.`, accion: 'NINGUNA', pedidoId: actualizado.id };
      } catch (e: unknown) {
        return { resultado: `No se pudo actualizar: ${e instanceof Error ? e.message : String(e)}`, accion: 'NINGUNA' };
      }
    }

    case 'mis_pedidos_asignados': {
      if (!auth) return { resultado: 'No tienes sesión activa.', accion: 'NINGUNA' };
      const pedidos = await prisma.pedido.findMany({
        where: {
          repartidorId: auth.usuarioId,
          estatus: { notIn: ['ENTREGADO', 'CANCELADO'] },
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true, nombreCliente: true, estatus: true, direccion: true, telefono: true, total: true },
      });
      if (pedidos.length === 0) {
        return { resultado: 'No tienes pedidos asignados en este momento. Espera a que el cajero te asigne uno.', accion: 'NINGUNA' };
      }
      const lineas = pedidos.map(
        (p) => `#${p.id} | ${p.nombreCliente} | ${p.estatus} | ${p.direccion ?? 'sin dirección'} | Tel: ${p.telefono} | $${p.total}`,
      );
      return { resultado: `Tus entregas asignadas (${pedidos.length}):\n${lineas.join('\n')}`, accion: 'NINGUNA' };
    }

    case 'mis_tareas': {
      const estatusActivos = ['PROPUESTA', 'PENDIENTE', 'EN_PROCESO'];
      const where: Record<string, unknown> = { estatus: { in: estatusActivos } };
      if (args.estatus && typeof args.estatus === 'string' && estatusActivos.includes(args.estatus)) {
        where.estatus = args.estatus;
      }
      const tareas = await prisma.tareaProduccion.findMany({
        where,
        orderBy: [{ estatus: 'asc' }, { createdAt: 'asc' }],
        include: { producto: { select: { nombre: true } } },
        take: 20,
      });
      if (tareas.length === 0) return { resultado: 'No hay tareas de producción activas en este momento.', accion: 'NINGUNA' };
      const lineas = tareas.map((t) => {
        const avance = t.cantidadProducida != null ? ` (producidas: ${t.cantidadProducida}/${t.cantidadSolicitada})` : ` (solicitadas: ${t.cantidadSolicitada})`;
        return `#${t.id} | ${t.producto.nombre}${avance} | ${t.estatus}${t.notas ? ` | Nota: ${t.notas}` : ''}`;
      });
      return { resultado: `Tareas de producción activas (${tareas.length}):\n${lineas.join('\n')}`, accion: 'NINGUNA' };
    }

    case 'ver_reporte_ventas': {
      const dias = Number(args.dias ?? 7);
      const desde = new Date();
      desde.setDate(desde.getDate() - dias);
      const pedidos = await prisma.pedido.findMany({
        where: { estatus: 'ENTREGADO', createdAt: { gte: desde } },
        include: { items: { include: { producto: { select: { nombre: true } } } } },
      });
      if (pedidos.length === 0) {
        return { resultado: `No hay pedidos entregados en los últimos ${dias} días.`, accion: 'NINGUNA' };
      }
      const totalIngresos = pedidos.reduce((sum, p) => sum + Number(p.total), 0);
      const ticketPromedio = totalIngresos / pedidos.length;
      // Count product occurrences
      const conteo: Record<string, { nombre: string; cantidad: number }> = {};
      for (const pedido of pedidos) {
        for (const item of pedido.items) {
          const key = String(item.productoId);
          if (!conteo[key]) conteo[key] = { nombre: item.producto.nombre, cantidad: 0 };
          conteo[key].cantidad += item.cantidad;
        }
      }
      const top5 = Object.values(conteo)
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 5)
        .map((x, i) => `${i + 1}. ${x.nombre} (${x.cantidad} piezas)`);
      const resumen = [
        `Reporte últimos ${dias} días:`,
        `- Pedidos entregados: ${pedidos.length}`,
        `- Ingresos totales: $${totalIngresos.toFixed(2)} MXN`,
        `- Ticket promedio: $${ticketPromedio.toFixed(2)} MXN`,
        `- Top 5 productos:`,
        ...top5.map((l) => `  ${l}`),
      ].join('\n');
      return { resultado: resumen, accion: 'NINGUNA' };
    }

    default:
      return { resultado: 'Acción no reconocida.' };
  }
}

// ── Main chat processor ───────────────────────────────────────────────────────

/**
 * Processes one chat message: retrieves relevant RAG chunks, builds the role-specific
 * system prompt with session history, calls Groq with the appropriate tool set,
 * executes all requested tools and makes a second call for the final answer.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string} mensaje - The user's message.
 * @param {string} sessionId - Chat session identifier used to keep history.
 * @param {{ usuarioId: number; rol: string }} [auth] - Authenticated user, if any.
 * @param {string} [guestToken] - Guest token of the current visitor, if any.
 * @returns {Promise<{ respuesta: string; accion: string; datosEncargo?: Record<string, unknown>; itemsCarrito?: ItemCarritoChat[]; pedidoId?: number; fuentesUsadas?: string[] }>}
 */
export async function procesarMensajeChat(
  mensaje: string,
  sessionId: string,
  auth?: { usuarioId: number; rol: string },
  guestToken?: string,
): Promise<{
  respuesta: string;
  accion: string;
  datosEncargo?: Record<string, unknown>;
  itemsCarrito?: ItemCarritoChat[];
  pedidoId?: number;
  fuentesUsadas?: string[];
}> {
  const toolsActivos = obtenerToolsPorRol(auth?.rol);
  const chunks = await buscarChunksRelevantes(mensaje, 5);
  const fuentesUsadas: string[] = [];
  const contextoRAG = chunks.map((c) => c.texto).join('\n\n');
  const contextoRol = buildContextoRol(auth);

  const systemPrompt = `Eres DulceBot, la asistente virtual de la panadería "Antojo de Yanet".
Personalidad: amigable, cálida, directa. Hablas como persona real en un chat, sin ser robótica ni usar lenguaje corporativo.
${contextoRol}
== REGLA #1 — NUNCA INVENTES DATOS ESPECÍFICOS ==
NUNCA inventes precios, cantidades de stock o características de un producto que no aparezcan en el contexto RAG o en la respuesta de una herramienta.
Si no tienes el dato exacto, usa la herramienta correspondiente antes de responder.
SÍ puedes reconocer categorías: si el RAG muestra "## Conchas" con varios productos, puedes decir "Sí vendemos pan dulce — tenemos conchas, por ejemplo."
VARIACIONES DE NOMBRE — CRÍTICO: los clientes añaden "de" que no está en el catálogo.
  - "Galleta de jamoncillo" → catálogo: "Galleta jamoncillo"  ← MISMO producto
  - "Concha de vainilla"   → catálogo: "Concha vainilla"      ← MISMO producto
  - "Churro de chocolate"  → catálogo: "Churro chocolate"     ← MISMO producto
  Si el catálogo lista "X Y" y el cliente pide "X de Y", son idénticos. Reporta siempre el nombre EXACTO del catálogo.

== REGLA #1B — CARRITO DIRECTO (solo compra explícita) ==
Llama a agregar_al_carrito SIN buscar primero SOLO cuando el cliente tiene intención clara de comprar. Las señales son:
  - Verbo de compra: "quiero", "agrega", "ponme", "dame", "añade" + nombre de producto
  - Selección de una lista que acabas de mostrar: el cliente responde solo con el nombre de un producto de tu respuesta anterior
NO aplica para preguntas de disponibilidad o precio:
  - "¿vendes pan?" → buscar_en_menu con query "pan"
  - "¿tienen conchas?" → buscar_en_menu con query "conchas"
  - "¿cuánto cuesta el churro?" → buscar_en_menu con query "churro"
El sistema de búsqueda maneja variaciones de nombre (quita "de", stop-words) — no necesitas confirmar existencia antes de intentar agregar.

${buildRegla2(toolsActivos)}

== REGLA #3 — AMBIGÜEDAD (CRÍTICA) ==
Cuando agregar_al_carrito devuelva "X es ambiguo; pregunta al cliente cuál de estos quiere: A, B, C",
copia LITERALMENTE esa lista. NUNCA agregues, inventes ni parafrasees opciones.

== REGLA #4 — ENCARGOS ==
Cuando uses iniciar_encargo: NUNCA digas que el encargo quedó "registrado" o "confirmado".
Dile al cliente: "Tu solicitud fue recibida. El equipo te contactará para confirmar disponibilidad y precio."

== REGLA #5 — FORMATO ==
Solo texto plano. Sin Markdown, sin negritas, sin tablas, sin emojis.
Para listas usa guiones simples (- item). Máximo 6 elementos por lista antes de ofrecer ver más.
Respuestas cortas y directas: 1-2 oraciones para saludos y preguntas simples.

== REGLA #6 — LÍMITES DEL ROL ==
Eres una asistente de panadería, no una persona con vida propia.
- Preguntas personales: responde en una oración y redirige al negocio.
- Contenido inapropiado: responde con firmeza y brevedad, sin entrar en el tema.
- Temas ajenos al negocio: "Eso está fuera de mi área. ¿En qué puedo ayudarte con la panadería?"

== CONTEXTO DEL MENÚ (RAG — referencia rápida, no lista completa) ==
${contextoRAG || 'Sin contexto RAG disponible. Usa buscar_en_menu para consultar el menú real.'}`;

  const historial = obtenerHistorial(sessionId);
  const messages: import('../lib/groq.js').GroqMessage[] = [
    { role: 'system', content: systemPrompt },
    ...historial.map((m) => ({ role: m.rol as 'user' | 'assistant', content: m.contenido })),
    { role: 'user', content: mensaje },
  ];

  agregarMensaje(sessionId, 'user', mensaje);

  const resultado = await llamarGroq(messages, toolsActivos);

  if (esError(resultado)) {
    return { respuesta: resultado.message, accion: 'NINGUNA', fuentesUsadas };
  }

  const choice = resultado.choices[0];

  if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls?.length) {
    const toolMessages: import('../lib/groq.js').GroqMessage[] = [];
    const resultados: ResultadoTool[] = [];

    for (const toolCall of choice.message.tool_calls) {
      let toolArgs: Record<string, unknown> = {};
      try { toolArgs = JSON.parse(toolCall.function.arguments); } catch { /* empty */ }
      console.log(`[asistente] tool ${toolCall.function.name}`, JSON.stringify(toolArgs));
      const r = await ejecutarTool(toolCall.function.name, toolArgs, auth, guestToken);
      resultados.push(r);
      toolMessages.push({ role: 'tool', tool_call_id: toolCall.id, content: r.resultado });
    }

    fuentesUsadas.push(...new Set(resultados.flatMap((r) => r.fuentesUsadas ?? [])));

    const itemsCarrito = resultados.flatMap((r) => r.itemsCarrito ?? []);
    const accion = [...resultados].reverse().find((r) => r.accion && r.accion !== 'NINGUNA')?.accion ?? 'NINGUNA';
    const efectos = {
      accion,
      datosEncargo: resultados.find((r) => r.datosEncargo)?.datosEncargo,
      itemsCarrito: itemsCarrito.length > 0 ? itemsCarrito : undefined,
      pedidoId: resultados.find((r) => r.pedidoId)?.pedidoId,
    };

    const toolResultsText = toolMessages.map((m) => (typeof m.content === 'string' ? m.content : '')).join('\n');
    const hayAmbiguedad = toolResultsText.includes('es ambiguo; pregunta al cliente cuál de estos quiere:');
    const recordatorioAmbiguedad: import('../lib/groq.js').GroqMessage[] = hayAmbiguedad
      ? [{ role: 'system', content: 'RECORDATORIO: muestra al cliente ÚNICAMENTE las opciones textuales de la herramienta. No inventes ni agregues ninguna opción adicional.' }]
      : [];

    const messages2: import('../lib/groq.js').GroqMessage[] = [
      ...messages,
      choice.message as import('../lib/groq.js').GroqMessage,
      ...toolMessages,
      ...recordatorioAmbiguedad,
    ];

    const resultado2 = await llamarGroq(messages2);
    const respuesta = limpiarMarkdown(
      esError(resultado2)
        ? resultados.map((r) => r.resultado).join('\n')
        : (resultado2.choices[0].message.content ?? resultados.map((r) => r.resultado).join('\n')),
    );
    agregarMensaje(sessionId, 'assistant', respuesta);
    return { respuesta, ...efectos, fuentesUsadas };
  }

  const respuesta = limpiarMarkdown(choice.message.content ?? 'No pude procesar tu mensaje.');
  agregarMensaje(sessionId, 'assistant', respuesta);
  return { respuesta, accion: 'NINGUNA', fuentesUsadas };
}
