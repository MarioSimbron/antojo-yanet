import { useState, useRef, useEffect } from 'react';
import { useMutation, gql } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import {
  Avatar, Box, CircularProgress, Divider, Fab, Grow, IconButton, Paper, Stack, TextField, Typography,
} from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import { useCarritoStore, type BorradorEncargoChat } from '../store/carrito.store';
import { useAuthStore } from '../store/auth.store';

/**
 * GraphQL mutation that sends a message to the DulceBot assistant.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const CHAT_MUTATION = gql`
  mutation Chat($mensaje: String!, $sessionId: String!) {
    chatAsistente(mensaje: $mensaje, sessionId: $sessionId) {
      respuesta accion
      datosEncargo { producto fechaDeseada personas detalles }
      itemsCarrito { productoId nombre precio cantidad esEncargo imagenUrl }
      pedidoId
      fuentesUsadas
    }
  }
`;

/**
 * A chat message shown in the widget.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @property {'user' | 'assistant'} rol - Who sent the message.
 * @property {string} texto - Message text.
 * @property {string[]} [fuentes] - RAG source files used to answer (assistant only).
 */
interface Mensaje {
  rol: 'user' | 'assistant';
  texto: string;
  fuentes?: string[];
}

/**
 * A product the assistant added to the cart, as returned by chatAsistente.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @property {number} productoId - Product ID.
 * @property {string} nombre - Product name.
 * @property {number} precio - Unit price in MXN.
 * @property {number} cantidad - Quantity to add.
 * @property {boolean} esEncargo - Whether the product is made-to-order.
 * @property {string | null} imagenUrl - Product image URL.
 */
interface ItemCarritoChat {
  productoId: number;
  nombre: string;
  precio: number;
  cantidad: number;
  esEncargo: boolean;
  imagenUrl: string | null;
}

/**
 * Custom-order data returned by chatAsistente when DulceBot prepares an encargo.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @property {string} producto - Catalogue product name.
 * @property {string} fechaDeseada - Requested date (YYYY-MM-DD) or empty if unknown/invalid.
 * @property {number} personas - Number of people to serve (0 if not given).
 * @property {string} detalles - Flavour, decoration, message, etc.
 */
interface DatosEncargoChat {
  producto: string;
  fechaDeseada: string;
  personas: number;
  detalles: string;
}

/**
 * Turns the encargo data from the chat into the checkout pre-fill draft.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {DatosEncargoChat | null | undefined} datos - Data returned by chatAsistente.
 * @returns {BorradorEncargoChat} Date and notes for the checkout form.
 */
function borradorEncargo(datos: DatosEncargoChat | null | undefined): BorradorEncargoChat {
  if (!datos) return {};
  const notas = [datos.personas > 0 ? `Para ${datos.personas} personas.` : '', datos.detalles]
    .filter(Boolean)
    .join(' ');
  return { fechaDeseada: datos.fechaDeseada || undefined, notas: notas || undefined };
}

/**
 * Returns the opening message DulceBot shows when the chat panel is first opened.
 * The message is tailored to the user's role so staff immediately know what they
 * can ask the assistant, while guests get a warm shopping welcome.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string | undefined} rol - The logged-in user's role, or undefined for guest.
 * @param {string | undefined} nombre - The logged-in user's name, for a personal greeting.
 * @returns {string} The greeting message.
 */
function getSaludo(rol: string | undefined, nombre: string | undefined): string {
  const primerNombre = nombre?.split(' ')[0] ?? '';
  switch (rol) {
    case 'REPARTIDOR':
      return `Hola${primerNombre ? `, ${primerNombre}` : ''}. Soy DulceBot. Puedo mostrarte tus entregas asignadas, ayudarte a actualizar el estatus de un pedido o consultar la dirección de entrega. ¿Que necesitas?`;
    case 'MAESTRO_PANADERO':
      return `Hola${primerNombre ? `, ${primerNombre}` : ''}. Soy DulceBot. Puedo mostrarte tus tareas de producción, consultar el stock de ingredientes o ayudarte a organizar tu turno. ¿Por donde empezamos?`;
    case 'CAJERO':
      return `Hola${primerNombre ? `, ${primerNombre}` : ''}. Soy DulceBot. Puedo darte un resumen de pedidos activos, mostrarte cuales están listos para entrega a domicilio, consultar disponibilidad de productos o ayudarte a gestionar el estatus de un pedido. ¿Que necesitas?`;
    case 'ADMIN':
      return `Hola${primerNombre ? `, ${primerNombre}` : ''}. Soy DulceBot. Tienes acceso completo: reportes de ventas, pedidos activos, tareas de producción, stock, encargos y más. ¿Con que te ayudo?`;
    case 'CLIENTE':
      return `Hola${primerNombre ? `, ${primerNombre}` : ''}. Soy DulceBot, la asistente de Antojo de Yanet. Puedo ayudarte a encontrar pan, agregar productos a tu carrito o iniciar un encargo especial. ¿Que se te antoja hoy?`;
    default:
      return '¡Hola! Soy DulceBot, la asistente de Antojo de Yanet. Puedo ayudarte a ver el menu, agregar pan a tu carrito o hacer un encargo especial. ¿En que te puedo ayudar?';
  }
}

/**
 * Returns a context-aware placeholder for the chat input field.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string | undefined} rol - The logged-in user's role.
 * @returns {string} Placeholder text.
 */
function getPlaceholder(rol: string | undefined): string {
  switch (rol) {
    case 'REPARTIDOR':   return 'ej. ¿Cuáles son mis entregas de hoy?';
    case 'MAESTRO_PANADERO': return 'ej. ¿Qué tareas tengo pendientes?';
    case 'CAJERO':       return 'ej. ¿Cuántos pedidos hay listos?';
    case 'ADMIN':        return 'ej. ¿Cuáles son las ventas de esta semana?';
    default:             return 'ej. ¿Qué conchas tienen hoy?';
  }
}

/**
 * Returns the chat session ID stored in localStorage, creating a UUID v4 on first use.
 * Falls back to a fresh (non-persisted) UUID if localStorage is unavailable.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {string} The chat session ID.
 */
function getSessionId(): string {
  try {
    let id = localStorage.getItem('chatSessionId');
    if (!id) {
      id = uuidv4();
      localStorage.setItem('chatSessionId', id);
    }
    return id;
  } catch {
    return uuidv4();
  }
}

/**
 * Floating chat button (MUI Fab) and animated panel for talking to DulceBot.
 * Sends messages through the chatAsistente mutation, shows a typing indicator and
 * navigates according to the returned action (AGREGAR_CARRITO, ABRIR_ENCARGO, VER_PEDIDO,
 * VER_MENU). ABRIR_ENCARGO opens the checkout with the encargo date and details pre-filled.
 * The greeting and input placeholder adapt automatically to the user's role.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {JSX.Element} The chat widget.
 */
export default function ChatWidget() {
  const usuario = useAuthStore((s) => s.usuario);
  const rol = usuario?.rol;
  const nombre = usuario?.nombre;

  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    { rol: 'assistant', texto: getSaludo(rol, nombre) },
  ]);
  const [input, setInput] = useState('');
  const [cargando, setCargando] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const sessionId = getSessionId();

  // Reset greeting when the logged-in user changes (login / logout).
  useEffect(() => {
    setMensajes([{ rol: 'assistant', texto: getSaludo(rol, nombre) }]);
  }, [rol, nombre]);

  const [enviarMensaje] = useMutation(CHAT_MUTATION);
  const agregarItem = useCarritoStore((s) => s.agregarItem);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, abierto]);

  /**
   * Sends the current input to the assistant, appends the reply to the conversation
   * and runs the returned UI action (add to cart, navigate, etc.).
   * @author Mario Simbron Gonzalez <simbron420@gmail.com>
   * @returns {Promise<void>}
   */
  const handleEnviar = async () => {
    if (!input.trim() || cargando) return;
    const texto = input.trim();
    setInput('');
    setMensajes((m) => [...m, { rol: 'user', texto }]);
    setCargando(true);

    try {
      const { data } = await enviarMensaje({ variables: { mensaje: texto, sessionId } });
      const r = data?.chatAsistente;
      setMensajes((m) => [
        ...m,
        { rol: 'assistant', texto: r.respuesta, fuentes: r.fuentesUsadas ?? [] },
      ]);

      // Add items before navigating so the checkout already sees them on mount.
      for (const item of (r.itemsCarrito ?? []) as ItemCarritoChat[]) {
        agregarItem(
          {
            productoId: item.productoId,
            nombre: item.nombre,
            precio: item.precio,
            esEncargo: item.esEncargo,
            imagenUrl: item.imagenUrl ?? undefined,
          },
          item.cantidad,
        );
      }

      if (r.accion === 'ABRIR_CHECKOUT') navigate('/checkout');
      else if (r.accion === 'ABRIR_ENCARGO') navigate('/checkout', { state: { encargoChat: borradorEncargo(r.datosEncargo) } });
      else if (r.accion === 'VER_PEDIDO' && r.pedidoId) navigate(`/seguimiento/${r.pedidoId}`);
      else if (r.accion === 'VER_MENU') navigate('/menu');
    } catch {
      setMensajes((m) => [
        ...m,
        { rol: 'assistant', texto: 'En este momento no puedo responder. Intenta de nuevo en un momento.' },
      ]);
    } finally {
      setCargando(false);
    }
  };

  return (
    <Box sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1300, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1.5 }}>
      <Grow in={abierto} unmountOnExit style={{ transformOrigin: 'bottom right' }}>
        <Paper elevation={8} sx={{ width: 340, maxWidth: 'calc(100vw - 48px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 3 }}>

          {/* Header */}
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', bgcolor: 'primary.main', color: 'primary.contrastText', px: 2, py: 1.5 }}>
            <Avatar src="/dulcebot-avatar.webp" alt="DulceBot" sx={{ width: 36, height: 36 }} />
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="subtitle2">DulceBot</Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                {rol === 'REPARTIDOR' && 'Asistente de entregas'}
                {rol === 'MAESTRO_PANADERO' && 'Asistente de produccion'}
                {rol === 'CAJERO' && 'Asistente de caja'}
                {rol === 'ADMIN' && 'Asistente de administracion'}
                {(!rol || rol === 'CLIENTE') && 'Asistente de la panaderia'}
              </Typography>
            </Box>
            <IconButton size="small" color="inherit" onClick={() => setAbierto(false)} aria-label="Cerrar chat">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>

          {/* Messages */}
          <Stack spacing={1.5} sx={{ p: 2, height: 320, overflowY: 'auto', overflowX: 'hidden', bgcolor: 'background.default' }}>
            {mensajes.map((m, i) => (
              <Box key={i} sx={{ display: 'flex', justifyContent: m.rol === 'user' ? 'flex-end' : 'flex-start' }}>
                <Box sx={{ maxWidth: '80%', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Paper
                    elevation={0}
                    sx={{
                      px: 1.5,
                      py: 1,
                      borderRadius: 2.5,
                      ...(m.rol === 'user'
                        ? { bgcolor: 'primary.main', color: 'primary.contrastText', borderBottomRightRadius: 4 }
                        : { bgcolor: 'background.paper', borderBottomLeftRadius: 4 }),
                    }}
                  >
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                      {m.texto}
                    </Typography>
                  </Paper>
                  {m.rol === 'assistant' && m.fuentes && m.fuentes.length > 0 && (
                    <Typography variant="caption" sx={{ color: 'text.disabled', pl: 0.5 }}>
                      Fuentes: {m.fuentes.map((f) => f.replace('.md', '')).join(' · ')}
                    </Typography>
                  )}
                </Box>
              </Box>
            ))}
            {cargando && (
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', color: 'text.secondary' }}>
                <CircularProgress size={14} color="inherit" />
                <Typography variant="caption">DulceBot esta escribiendo...</Typography>
              </Stack>
            )}
            <div ref={bottomRef} />
          </Stack>

          <Divider />

          {/* Input */}
          <Stack direction="row" spacing={1} sx={{ p: 1.5 }}>
            <TextField
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleEnviar()}
              placeholder={getPlaceholder(rol)}
              size="small"
              fullWidth
              autoFocus
            />
            <IconButton color="primary" onClick={handleEnviar} disabled={cargando || !input.trim()} aria-label="Enviar">
              <SendIcon />
            </IconButton>
          </Stack>
        </Paper>
      </Grow>

      <Fab color="primary" onClick={() => setAbierto(!abierto)} aria-label="Chat con DulceBot">
        {abierto ? <CloseIcon /> : <ChatIcon />}
      </Fab>
    </Box>
  );
}
