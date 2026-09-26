/**
 * DulceBot AI assistant service: builds the RAG-augmented prompt, runs the Groq
 * function-calling loop and executes the server-side tools.
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
 */
interface ResultadoTool {
  resultado: string;
  accion?: string;
  datosEncargo?: Record<string, unknown>;
  itemsCarrito?: ItemCarritoChat[];
  pedidoId?: number;
}

/**
 * Words ignored when matching a product name.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const STOPWORDS = new Set(['de', 'del', 'con', 'la', 'las', 'el', 'los', 'y', 'un', 'una', 'unos', 'unas', 'sin']);

/**
 * Normalizes text into comparable tokens: lowercase, no accents, no stopwords and a
 * naive singular form, so "Galletas choco chips" and "Galleta choco chip" match.
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
 * Finds the active product that best matches a free-text name. Returns the single best
 * match, or the list of tied candidates when the name is ambiguous.
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
 * Removes the Markdown emphasis some models add despite the prompt, since the chat
 * widget renders plain text (e.g. "**10** unidades" becomes "10 unidades").
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string} texto - Model reply.
 * @returns {string} The reply without bold/italic/heading markers.
 */
function limpiarMarkdown(texto: string): string {
  return texto
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/^#{1,6}\s+/gm, '');
}

/**
 * Function-calling tool definitions exposed to the Groq model: consultar_pedido,
 * consultar_stock, agregar_al_carrito, iniciar_encargo and buscar_en_menu.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const tools: GroqTool[] = [
  {
    type: 'function',
    function: {
      name: 'agregar_al_carrito',
      description:
        'Agrega productos del menú al carrito del cliente. Úsala siempre que el cliente pida, quiera o acepte comprar productos. Es la ÚNICA forma de agregar productos; el cliente confirma el pedido después en el checkout.',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            description: 'Productos a agregar',
            items: {
              type: 'object',
              properties: {
                producto: {
                  type: 'string',
                  description:
                    'El producto con las palabras que usó el cliente (ej. "conchas", "rol de canela"). No lo sustituyas por otro producto que veas en el contexto: si es ambiguo, la herramienta devuelve las opciones para que el cliente elija.',
                },
                cantidad: { type: 'number', description: 'Cantidad de piezas (entero ≥ 1)' },
              },
              required: ['producto', 'cantidad'],
            },
          },
        },
        required: ['items'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_pedido',
      description: 'Consulta el estatus actual de un pedido del cliente',
      parameters: {
        type: 'object',
        properties: {
          pedidoId: { type: 'number', description: 'ID del pedido' },
        },
        required: ['pedidoId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_stock',
      description: 'Consulta la disponibilidad en inventario de un producto',
      parameters: {
        type: 'object',
        properties: {
          productoId: { type: 'number', description: 'ID del producto' },
          nombre: { type: 'string', description: 'Nombre o parte del nombre del producto' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'iniciar_encargo',
      description:
        'Recopila los datos de un encargo personalizado que NO está en el menú (ej. un pastel con diseño especial). No crea ningún pedido ni agrega nada al carrito. Para productos del menú usa agregar_al_carrito.',
      parameters: {
        type: 'object',
        properties: {
          producto: { type: 'string', description: 'Tipo de producto a encargar' },
          fechaDeseada: { type: 'string', description: 'Fecha deseada en formato YYYY-MM-DD' },
          personas: { type: 'number', description: 'Cantidad de personas a servir' },
          detalles: { type: 'string', description: 'Detalles adicionales del encargo' },
        },
        required: ['producto'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_en_menu',
      description: 'Busca productos REALES en el menú por nombre o categoría. Úsala cuando el cliente pregunte qué vendemos, qué hay disponible, qué categorías existen o cuál es el precio de algo. Es la fuente de verdad del catálogo; nunca respondas sobre el menú sin haberla consultado o sin tener el dato en el contexto RAG.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Término de búsqueda' },
        },
        required: ['query'],
      },
    },
  },
];

/**
 * Executes a tool requested by the model on the server. `consultar_pedido` reuses the
 * shared ownership check so other customers' orders are never leaked (IDOR protection).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string} nombre - Tool name requested by the model.
 * @param {Record<string, unknown>} args - Parsed JSON arguments from the tool call.
 * @param {{ usuarioId: number; rol: string }} [auth] - Authenticated user, if any.
 * @param {string} [guestToken] - Guest token of the current visitor, if any.
 * @returns {Promise<ResultadoTool>} Text result to send back to the model, plus an
 *   optional UI action and payload (cart items, custom-order data or order ID).
 */
async function ejecutarTool(
  nombre: string,
  args: Record<string, unknown>,
  auth?: { usuarioId: number; rol: string },
  guestToken?: string,
): Promise<ResultadoTool> {
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
          'Agregado al carrito del cliente (aún NO es un pedido; el cliente debe confirmarlo en el checkout):',
          ...agregados.map((i) => `- ${i.cantidad} x ${i.nombre} ($${i.precio.toFixed(2)} c/u)${i.esEncargo ? ' [encargo]' : ''}`),
        );
      }
      if (problemas.length > 0) {
        lineas.push('NO se agregó:', ...problemas.map((p) => `- ${p}`));
      }
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
        include: { historial: { orderBy: { timestamp: 'desc' }, take: 1 } },
      });
      if (!pedido || !verificarOwnership(pedido, auth, guestToken)) {
        return {
          resultado: 'No encontré información sobre ese pedido. Verifica que el número sea correcto.',
          accion: 'NINGUNA',
        };
      }
      return {
        resultado: `Pedido #${pedido.id}: estatus ${pedido.estatus}, total $${pedido.total} MXN.`,
        accion: 'VER_PEDIDO',
        pedidoId: pedido.id,
      };
    }

    case 'consultar_stock': {
      const where: Record<string, unknown> = { activo: true };
      if (args.productoId) where.id = Number(args.productoId);
      if (args.nombre) where.nombre = { contains: String(args.nombre) };
      const productos = await prisma.producto.findMany({ where, take: 5 });
      if (productos.length === 0) return { resultado: 'No encontré ese producto en el menú.' };
      const resumen = productos
        .map((p) => `${p.nombre}: ${p.stockDisponible > 0 ? `${p.stockDisponible} disponibles` : 'sin stock'} - $${p.precio}`)
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
          `Datos del encargo personalizado recopilados (${datosEncargo.producto}). ` +
          'IMPORTANTE: NO se creó ningún pedido ni se agregó nada al carrito. Explica al cliente ' +
          'que el equipo de la panadería revisará su solicitud, o que si el producto está en el ' +
          'menú (categoría Encargos) puedes agregarlo a su carrito.',
        accion: 'NINGUNA',
        datosEncargo,
      };
    }

    case 'buscar_en_menu': {
      const chunks = buscarChunksRelevantes(String(args.query ?? ''), 3);
      const resultado = chunks.map((c) => c.texto).join('\n\n');
      return {
        resultado: resultado || 'No encontré información sobre eso en el menú.',
        accion: 'VER_MENU',
      };
    }

    default:
      return { resultado: 'Acción no reconocida.' };
  }
}

/**
 * Processes one chat message: retrieves relevant RAG chunks, builds the system prompt
 * with the session history, calls Groq and, if tools are requested, executes all of them
 * and makes a second call for the final answer. Stores both turns in the session history.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string} mensaje - The user's message.
 * @param {string} sessionId - Chat session identifier used to keep history.
 * @param {{ usuarioId: number; rol: string }} [auth] - Authenticated user, if any.
 * @param {string} [guestToken] - Guest token of the current visitor, if any.
 * @returns {Promise<{ respuesta: string; accion: string; datosEncargo?: Record<string, unknown>; itemsCarrito?: ItemCarritoChat[]; pedidoId?: number }>}
 *   The assistant's reply, the UI action to perform and its optional payload.
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
}> {
  const chunks = buscarChunksRelevantes(mensaje, 5);
  const contextoRAG = chunks.map((c) => c.texto).join('\n\n');

  const systemPrompt = `Eres DulceBot, la asistente virtual de la panadería "Antojo de Yanet".
Personalidad: amigable, cálida, directa. Hablas como persona real en un chat, sin ser robótica.

== REGLA #1 — NUNCA INVENTES INFORMACIÓN ==
Esto es lo más importante. NUNCA menciones:
- Nombres de productos, sabores o variantes que no estén en el contexto RAG o en la respuesta de una herramienta.
- Precios que no vengan de una herramienta.
- "Packs", "combos" o categorías que no existan en el menú real.
Si no tienes la información, di "déjame revisar" y usa la herramienta buscar_en_menu o agregar_al_carrito.

== REGLA #2 — HERRAMIENTAS SON LA ÚNICA FUENTE DE VERDAD ==
- Para saber QUÉ vendemos: usa buscar_en_menu.
- Para AGREGAR al carrito: usa agregar_al_carrito (es la ÚNICA forma; nunca digas que algo se agregó sin haberla llamado).
- Para STOCK de un producto: usa consultar_stock.
- Para PEDIDOS: usa consultar_pedido.
- Para ENCARGOS personalizados (pasteles con diseño, etc.): usa iniciar_encargo.

== REGLA #3 — FLUJO DE COMPRA ==
- Nunca confirmes que registraste, creaste o confirmaste un pedido. Solo agregas al carrito.
- El cliente confirma su pedido en el checkout (el sitio lo lleva ahí automáticamente).
- Si la herramienta reporta ambigüedad (varios productos similares), presenta exactamente las
  opciones que devolvió la herramienta y pide al cliente que elija una.
- Si el cliente pide "surtido" o "varios sabores", llama a agregar_al_carrito con el nombre
  genérico (ej. "concha") y deja que la herramienta resuelva qué opciones hay realmente.

== REGLA #4 — FORMATO ==
- Solo texto plano. Sin Markdown, sin negritas, sin tablas, sin bloques de código.
- Para listas usa guiones simples (- item). Máximo 6 elementos por lista.
- Respuestas breves: 1-2 oraciones para saludos y preguntas simples.

== REGLA #5 — TEMAS FUERA DE ALCANCE ==
Redirige únicamente si el tema es completamente ajeno al negocio (política, deportes, tecnología, etc.).
Para comentarios personales o inapropiados, responde con amabilidad pero firmeza, sin entrar en el tema.
Ejemplo de redirección: "Eso está fuera de mi área, pero con gusto te ayudo con nuestro menú o un encargo. ¿Qué se te antoja?"

== CONTEXTO DEL MENÚ (extracto RAG — usa esto como referencia, no como lista completa) ==
${contextoRAG || 'Sin contexto RAG disponible. Usa buscar_en_menu para consultar el menú real.'}`;

  const historial = obtenerHistorial(sessionId);
  const messages: import('../lib/groq.js').GroqMessage[] = [
    { role: 'system', content: systemPrompt },
    ...historial.map((m) => ({ role: m.rol as 'user' | 'assistant', content: m.contenido })),
    { role: 'user', content: mensaje },
  ];

  agregarMensaje(sessionId, 'user', mensaje);

  const resultado = await llamarGroq(messages, tools);

  if (esError(resultado)) {
    return { respuesta: resultado.message, accion: 'NINGUNA' };
  }

  const choice = resultado.choices[0];

  if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls?.length) {
    // Run every tool the model requested (it may call several in parallel) and merge
    // their UI effects: cart items accumulate, the last non-NINGUNA action wins.
    const toolMessages: import('../lib/groq.js').GroqMessage[] = [];
    const resultados: ResultadoTool[] = [];
    for (const toolCall of choice.message.tool_calls) {
      let toolArgs: Record<string, unknown> = {};
      try {
        toolArgs = JSON.parse(toolCall.function.arguments);
      } catch {
        // empty args
      }
      console.log(`[asistente] tool ${toolCall.function.name}`, JSON.stringify(toolArgs));
      const r = await ejecutarTool(toolCall.function.name, toolArgs, auth, guestToken);
      resultados.push(r);
      toolMessages.push({ role: 'tool', tool_call_id: toolCall.id, content: r.resultado });
    }

    const itemsCarrito = resultados.flatMap((r) => r.itemsCarrito ?? []);
    const accion =
      [...resultados].reverse().find((r) => r.accion && r.accion !== 'NINGUNA')?.accion ?? 'NINGUNA';
    const efectos = {
      accion,
      datosEncargo: resultados.find((r) => r.datosEncargo)?.datosEncargo,
      itemsCarrito: itemsCarrito.length > 0 ? itemsCarrito : undefined,
      pedidoId: resultados.find((r) => r.pedidoId)?.pedidoId,
    };

    // Second Groq call with the tool results
    const messages2: import('../lib/groq.js').GroqMessage[] = [
      ...messages,
      choice.message as import('../lib/groq.js').GroqMessage,
      ...toolMessages,
    ];

    const resultado2 = await llamarGroq(messages2);
    const respuesta = limpiarMarkdown(
      esError(resultado2)
        ? resultados.map((r) => r.resultado).join('\n')
        : (resultado2.choices[0].message.content ?? resultados.map((r) => r.resultado).join('\n')),
    );
    agregarMensaje(sessionId, 'assistant', respuesta);
    return { respuesta, ...efectos };
  }

  const respuesta = limpiarMarkdown(choice.message.content ?? 'No pude procesar tu mensaje.');
  agregarMensaje(sessionId, 'assistant', respuesta);
  return { respuesta, accion: 'NINGUNA' };
}
