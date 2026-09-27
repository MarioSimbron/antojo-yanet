/**
 * Purchase-list page where staff add raw-material purchase requests and admins
 * track and fulfill them. Staff see only their own submissions; admins see all.
 * Includes an inline "create insumo" dialog so users can register a new ingredient
 * without leaving the page (auto-selects the new insumo after creation).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {JSX.Element} The purchase-list management page.
 */
import { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useAuthStore } from '../store/auth.store';

// ── GraphQL operations ─────────────────────────────────────────────────────────

const LISTA_COMPRAS_QUERY = gql`
  query ListaCompras($estatus: String) {
    listaCompras(estatus: $estatus) {
      id nombre cantidad unidad prioridad notas estatus creadoPorId createdAt
      creadoPor { id nombre }
      insumo { id nombre }
    }
  }
`;

const INSUMOS_QUERY = gql`
  query InsumosParaCompra {
    insumos { id nombre unidad stockActual stockMinimo }
  }
`;

const CREAR_ITEM = gql`
  mutation CrearItemCompra($input: CrearItemCompraInput!) {
    crearItemCompra(input: $input) {
      id nombre cantidad unidad prioridad estatus
    }
  }
`;

const ACTUALIZAR_ITEM = gql`
  mutation ActualizarItemCompra($id: Int!, $estatus: String!) {
    actualizarItemCompra(id: $id, estatus: $estatus) {
      id estatus
    }
  }
`;

const CREAR_INSUMO = gql`
  mutation CrearInsumoDesdeCompra($input: CrearInsumoInput!) {
    crearInsumo(input: $input) {
      id nombre unidad stockActual stockMinimo
    }
  }
`;

// ── Types ──────────────────────────────────────────────────────────────────────

interface Insumo {
  id: number;
  nombre: string;
  unidad: string;
  stockActual: number;
  stockMinimo: number;
}

interface ItemCompra {
  id: number;
  nombre: string;
  cantidad: number;
  unidad: string;
  prioridad: string;
  notas?: string;
  estatus: string;
  creadoPorId: number;
  createdAt: string;
  creadoPor: { id: number; nombre: string };
  insumo?: { id: number; nombre: string };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PRIORIDAD_COLOR: Record<string, 'error' | 'warning' | 'default'> = {
  ALTA: 'error',
  MEDIA: 'warning',
  BAJA: 'default',
};

const ESTATUS_COLOR: Record<string, 'default' | 'info' | 'success'> = {
  PENDIENTE: 'default',
  EN_PROCESO: 'info',
  SURTIDO: 'success',
};

const ESTATUS_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  SURTIDO: 'Surtido',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function ListaCompraPage() {
  const { usuario } = useAuthStore();
  const esAdmin = usuario?.rol === 'ADMIN';

  const { data, loading, refetch } = useQuery<{ listaCompras: ItemCompra[] }>(LISTA_COMPRAS_QUERY, {
    fetchPolicy: 'cache-and-network',
  });
  const { data: insumosData, refetch: refetchInsumos } = useQuery<{ insumos: Insumo[] }>(INSUMOS_QUERY, {
    fetchPolicy: 'cache-and-network',
  });
  const [crearItem, { loading: creando }] = useMutation(CREAR_ITEM, {
    onCompleted: () => { refetch(); resetForm(); },
  });
  const [actualizarItem] = useMutation(ACTUALIZAR_ITEM, { onCompleted: () => refetch() });

  const [crearInsumo, { loading: creandoInsumo }] = useMutation<{
    crearInsumo: Insumo;
  }>(CREAR_INSUMO, {
    onCompleted: (data) => {
      const nuevo = data.crearInsumo;
      // Optimistically add new insumo to the cached list and auto-select it
      void refetchInsumos();
      setInsumoId(nuevo.id);
      setNombre(nuevo.nombre);
      setUnidad(nuevo.unidad);
      setNuevoInsumoOpen(false);
      resetNuevoInsumo();
    },
    onError: (err) => setSnackMsg(err.message),
  });

  const [snackMsg, setSnackMsg] = useState('');

  // Form state
  const [insumoId, setInsumoId] = useState<number | ''>('');
  const [nombre, setNombre] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [unidad, setUnidad] = useState('');
  const [prioridad, setPrioridad] = useState('MEDIA');
  const [notas, setNotas] = useState('');

  // "Crear insumo nuevo" dialog state
  const [nuevoInsumoOpen, setNuevoInsumoOpen] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoUnidad, setNuevoUnidad] = useState('');
  const [nuevoStockMinimo, setNuevoStockMinimo] = useState('');

  const insumos = insumosData?.insumos ?? [];

  /**
   * Resets the new-insumo dialog fields to empty.
   */
  const resetNuevoInsumo = () => {
    setNuevoNombre(''); setNuevoUnidad(''); setNuevoStockMinimo('');
  };

  /**
   * Resets the add-item form to its empty state.
   */
  const resetForm = () => {
    setInsumoId(''); setNombre(''); setCantidad(''); setUnidad(''); setPrioridad('MEDIA'); setNotas('');
  };

  /**
   * When an existing insumo is selected from the dropdown, auto-fills nombre and unidad.
   * @param {number | ''} id - Selected insumo id or empty string.
   */
  const handleSelectInsumo = (id: number | '') => {
    setInsumoId(id);
    if (id === '') return;
    const ins = insumos.find((i) => i.id === id);
    if (ins) {
      setNombre(ins.nombre);
      setUnidad(ins.unidad);
    }
  };

  /**
   * Submits the new purchase request.
   */
  const handleCrear = async () => {
    if (!nombre.trim() || !cantidad || !unidad.trim()) {
      setSnackMsg('Nombre, cantidad y unidad son obligatorios.');
      return;
    }
    await crearItem({
      variables: {
        input: {
          nombre: nombre.trim(),
          cantidad: parseFloat(cantidad),
          unidad: unidad.trim(),
          prioridad,
          notas: notas.trim() || undefined,
          insumoId: insumoId !== '' ? insumoId : undefined,
        },
      },
    });
  };

  /**
   * Advances an item's status to the next stage.
   * @param {ItemCompra} item - The item to advance.
   */
  const handleAvanzar = async (item: ItemCompra) => {
    const next = item.estatus === 'PENDIENTE' ? 'EN_PROCESO' : 'SURTIDO';
    await actualizarItem({ variables: { id: item.id, estatus: next } });
  };

  const items = data?.listaCompras ?? [];

  return (
    <Box>
      <Typography variant="h5" component="h1" gutterBottom>
        Lista de compras
      </Typography>

      {/* ── Add item form ────────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }} gutterBottom>
          Agregar solicitud
        </Typography>
        <Stack spacing={2}>
          <FormControl size="small" fullWidth>
            <InputLabel>Vincular a insumo del inventario (opcional)</InputLabel>
            <Select<number | '' | '__nuevo__'>
              label="Vincular a insumo del inventario (opcional)"
              value={insumoId}
              onChange={(e) => {
                if (e.target.value === '__nuevo__') {
                  setNuevoInsumoOpen(true);
                } else {
                  handleSelectInsumo(e.target.value as number | '');
                }
              }}
            >
              <MenuItem value="">— Sin vincular —</MenuItem>
              {insumos.map((ins) => (
                <MenuItem key={ins.id} value={ins.id}>
                  {ins.nombre} (stock: {ins.stockActual} {ins.unidad})
                </MenuItem>
              ))}
              <Divider />
              <MenuItem value="__nuevo__" sx={{ color: 'primary.main', fontWeight: 600 }}>
                ＋ Crear insumo nuevo…
              </MenuItem>
            </Select>
          </FormControl>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Nombre del insumo *"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              size="small"
              fullWidth
            />
            <TextField
              label="Cantidad *"
              type="number"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              size="small"
              sx={{ minWidth: 120 }}
            />
            <TextField
              label="Unidad *"
              value={unidad}
              onChange={(e) => setUnidad(e.target.value)}
              size="small"
              sx={{ minWidth: 120 }}
              placeholder="kg, litros, piezas…"
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Urgencia</InputLabel>
              <Select
                label="Urgencia"
                value={prioridad}
                onChange={(e) => setPrioridad(e.target.value)}
              >
                <MenuItem value="ALTA">Alta</MenuItem>
                <MenuItem value="MEDIA">Media</MenuItem>
                <MenuItem value="BAJA">Baja</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Notas adicionales"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              size="small"
              fullWidth
            />
          </Stack>
          <Box>
            <Button
              variant="contained"
              onClick={() => void handleCrear()}
              disabled={creando}
            >
              Agregar
            </Button>
          </Box>
        </Stack>
      </Paper>

      <Divider sx={{ mb: 2 }} />

      {/* ── Item list ────────────────────────────────────────────────── */}
      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }} gutterBottom>
        {esAdmin ? 'Todas las solicitudes' : 'Mis solicitudes'}
      </Typography>
      {loading && items.length === 0 ? (
        <CircularProgress size={24} />
      ) : items.length === 0 ? (
        <Alert severity="info">No hay solicitudes de compra.</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Insumo</TableCell>
                <TableCell>Cantidad</TableCell>
                <TableCell>Urgencia</TableCell>
                <TableCell>Estatus</TableCell>
                {esAdmin && <TableCell>Solicitado por</TableCell>}
                {esAdmin && <TableCell align="right">Acción</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Box>
                      {item.nombre}
                      {item.insumo && (
                        <Typography variant="caption" sx={{ display: 'block' }} color="success.main">
                          ↗ actualiza inventario: {item.insumo.nombre}
                        </Typography>
                      )}
                      {item.notas && (
                        <Typography variant="caption" sx={{ display: 'block' }} color="text.secondary">
                          {item.notas}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {item.cantidad} {item.unidad}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={item.prioridad}
                      color={PRIORIDAD_COLOR[item.prioridad] ?? 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={ESTATUS_LABEL[item.estatus] ?? item.estatus}
                      color={ESTATUS_COLOR[item.estatus] ?? 'default'}
                      size="small"
                    />
                  </TableCell>
                  {esAdmin && <TableCell>{item.creadoPor.nombre}</TableCell>}
                  {esAdmin && (
                    <TableCell align="right">
                      {item.estatus !== 'SURTIDO' && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => void handleAvanzar(item)}
                        >
                          {item.estatus === 'PENDIENTE' ? 'Procesar' : 'Marcar surtido'}
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ── Create new insumo dialog ──────────────────────────────── */}
      <Dialog
        open={nuevoInsumoOpen}
        onClose={() => { setNuevoInsumoOpen(false); resetNuevoInsumo(); }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Crear nuevo insumo</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Nombre del insumo *"
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              size="small"
              fullWidth
              autoFocus
            />
            <TextField
              label="Unidad *"
              value={nuevoUnidad}
              onChange={(e) => setNuevoUnidad(e.target.value)}
              size="small"
              fullWidth
              placeholder="kg, litros, piezas…"
            />
            <TextField
              label="Stock mínimo"
              type="number"
              value={nuevoStockMinimo}
              onChange={(e) => setNuevoStockMinimo(e.target.value)}
              size="small"
              fullWidth
              placeholder="0"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setNuevoInsumoOpen(false); resetNuevoInsumo(); }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disabled={creandoInsumo || !nuevoNombre.trim() || !nuevoUnidad.trim()}
            onClick={() => {
              void crearInsumo({
                variables: {
                  input: {
                    nombre: nuevoNombre.trim(),
                    unidad: nuevoUnidad.trim(),
                    stockMinimo: nuevoStockMinimo ? parseFloat(nuevoStockMinimo) : 0,
                  },
                },
              });
            }}
          >
            {creandoInsumo ? 'Creando…' : 'Crear y vincular'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(snackMsg)}
        autoHideDuration={4000}
        onClose={() => setSnackMsg('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="warning" onClose={() => setSnackMsg('')}>
          {snackMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
