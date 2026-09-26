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
import { useCarritoStore } from '../store/carrito.store';

/**
 * GraphQL mutation that sends a message to the Yanet assistant.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const CHAT_MUTATION = gql`
  mutation Chat($mensaje: String!, $sessionId: String!) {
    chatAsistente(mensaje: $mensaje, sessionId: $sessionId) {
      respuesta accion
      datosEncargo { producto fechaDeseada personas detalles }
      itemsCarrito { productoId nombre precio cantidad esEncargo imagenUrl }
      pedidoId
    }
  }
`;

/**
 * A chat message shown in the widget.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @property {'user' | 'assistant'} rol - Who sent the message.
 * @property {string} texto - Message text.
 */
interface Mensaje {
  rol: 'user' | 'assistant';
  texto: string;
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
 * Floating chat button (MUI Fab) and animated panel for talking to DulceBot. Sends messages through
 * the chatAsistente mutation, shows a typing indicator and navigates according to the
 * returned action (ABRIR_CHECKOUT, VER_PEDIDO, VER_MENU) while keeping the panel open;
 * it only closes when the user clicks the close button or the Fab.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {JSX.Element} The chat widget.
 */
export default function ChatWidget() {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    { rol: 'assistant', texto: '¡Hola! Soy DulceBot 🍞 ¿En qué te puedo ayudar hoy?' },
  ]);
  const [input, setInput] = useState('');
  const [cargando, setCargando] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const sessionId = getSessionId();

  const [enviarMensaje] = useMutation(CHAT_MUTATION);
  const agregarItem = useCarritoStore((s) => s.agregarItem);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, abierto]);

  /**
   * Sends the current input to the assistant, appends the reply (or a friendly error
   * message) to the conversation and runs the returned UI action.
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
      setMensajes((m) => [...m, { rol: 'assistant', texto: r.respuesta }]);

      // Navigate in the background; the panel stays open so the conversation continues.
      if (r.accion === 'ABRIR_CHECKOUT') {
        navigate('/checkout');
      } else if (r.accion === 'VER_PEDIDO' && r.pedidoId) {
        navigate(`/seguimiento/${r.pedidoId}`);
      } else if (r.accion === 'VER_MENU') {
        navigate('/menu');
      }

      // Products Yanet added are put in the cart; the customer confirms in checkout.
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
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', bgcolor: 'primary.main', color: 'primary.contrastText', px: 2, py: 1.5 }}>
            <Avatar src="/dulcebot.svg" alt="DulceBot" sx={{ width: 36, height: 36, bgcolor: 'transparent' }} />
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="subtitle2">DulceBot</Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                Asistente de la panadería
              </Typography>
            </Box>
            <IconButton size="small" color="inherit" onClick={() => setAbierto(false)} aria-label="Cerrar chat">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>

          <Stack spacing={1.5} sx={{ p: 2, height: 320, overflowY: 'auto', overflowX: 'hidden', bgcolor: 'background.default' }}>
            {mensajes.map((m, i) => (
              <Box key={i} sx={{ display: 'flex', justifyContent: m.rol === 'user' ? 'flex-end' : 'flex-start' }}>
                <Paper
                  elevation={0}
                  sx={{
                    maxWidth: '80%',
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
              </Box>
            ))}
            {cargando && (
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', color: 'text.secondary' }}>
                <CircularProgress size={14} color="inherit" />
                <Typography variant="caption">DulceBot está escribiendo…</Typography>
              </Stack>
            )}
            <div ref={bottomRef} />
          </Stack>

          <Divider />
          <Stack direction="row" spacing={1} sx={{ p: 1.5 }}>
            <TextField
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleEnviar()}
              placeholder="Escribe tu mensaje…"
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
