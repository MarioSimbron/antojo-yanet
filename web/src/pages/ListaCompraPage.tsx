/**
 * Purchase-list page where staff add raw-material purchase requests and admins
 * track and fulfill them. Staff see only their own submissions; admins see all.
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

// ── Types ──────────────────────────────────────────────────────────────────────

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
  const [crearItem, { loading: creando }] = useMutation(CREAR_ITEM, {
    onCompleted: () => { refetch(); resetForm(); },
  });
  const [actualizarItem] = useMutation(ACTUALIZAR_ITEM, { onCompleted: () => refetch() });

  const [snackMsg, setSnackMsg] = useState('');

  // Form state
  const [nombre, setNombre] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [unidad, setUnidad] = useState('');
  const [prioridad, setPrioridad] = useState('MEDIA');
  const [notas, setNotas] = useState('');

  /**
   * Resets the add-item form to its empty state.
   */
  const resetForm = () => {
    setNombre(''); setCantidad(''); setUnidad(''); setPrioridad('MEDIA'); setNotas('');
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
