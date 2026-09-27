/**
 * Inventory page showing finished-product stock and raw-material ingredient levels.
 * Accessible to ADMIN, MAESTRO_PANADERO and CAJERO. Admins can create new ingredients
 * and edit stock values inline; all roles can navigate to the purchase list.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {JSX.Element} The inventory management page.
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
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Paper,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';

// ── GraphQL operations ─────────────────────────────────────────────────────────

const PRODUCTOS_QUERY = gql`
  query ProductosInventario {
    productos {
      id nombre stockDisponible
    }
  }
`;

const INSUMOS_QUERY = gql`
  query Insumos {
    insumos {
      id nombre unidad stockActual stockMinimo
    }
  }
`;

const ACTUALIZAR_INSUMO = gql`
  mutation ActualizarInsumo($id: Int!, $stockActual: Float, $stockMinimo: Float) {
    actualizarInsumo(id: $id, stockActual: $stockActual, stockMinimo: $stockMinimo) {
      id stockActual stockMinimo
    }
  }
`;

const CREAR_INSUMO = gql`
  mutation CrearInsumoDesdeInventario($input: CrearInsumoInput!) {
    crearInsumo(input: $input) {
      id nombre unidad stockActual stockMinimo
    }
  }
`;

// ── Types ──────────────────────────────────────────────────────────────────────

interface Producto {
  id: number;
  nombre: string;
  stockDisponible: number;
}

interface Insumo {
  id: number;
  nombre: string;
  unidad: string;
  stockActual: number;
  stockMinimo: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns a chip color for a product's stock level.
 * @param {number} stock - Current stock.
 * @returns {'error' | 'warning' | 'success'} MUI color.
 */
function colorProducto(stock: number): 'error' | 'warning' | 'success' {
  if (stock === 0) return 'error';
  if (stock <= 10) return 'warning';
  return 'success';
}

/**
 * Returns a chip color for an ingredient's stock vs minimum.
 * @param {number} actual - Current stock.
 * @param {number} minimo - Minimum threshold.
 * @returns {'error' | 'success'} MUI color.
 */
function colorInsumo(actual: number, minimo: number): 'error' | 'success' {
  return actual <= minimo ? 'error' : 'success';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function InventarioPage() {
  const { usuario } = useAuthStore();
  const navigate = useNavigate();
  const esAdmin = usuario?.rol === 'ADMIN';

  const { data: prodData, loading: prodLoading } = useQuery<{ productos: Producto[] }>(PRODUCTOS_QUERY, {
    fetchPolicy: 'cache-and-network',
  });
  const { data: insData, loading: insLoading, refetch: refetchInsumos } = useQuery<{ insumos: Insumo[] }>(INSUMOS_QUERY, {
    fetchPolicy: 'cache-and-network',
  });
  const [actualizarInsumo] = useMutation(ACTUALIZAR_INSUMO, { onCompleted: () => refetchInsumos() });
  const [crearInsumo, { loading: creandoInsumo }] = useMutation(CREAR_INSUMO, {
    onCompleted: () => { void refetchInsumos(); setCrearOpen(false); resetCrear(); },
  });

  const [editando, setEditando] = useState<Insumo | null>(null);
  const [stockActual, setStockActual] = useState('');
  const [stockMinimo, setStockMinimo] = useState('');

  // "Nuevo insumo" dialog state
  const [crearOpen, setCrearOpen] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoUnidad, setNuevoUnidad] = useState('');
  const [nuevoStockMinimo, setNuevoStockMinimo] = useState('');

  /**
   * Resets the create-insumo dialog fields to empty.
   */
  const resetCrear = () => { setNuevoNombre(''); setNuevoUnidad(''); setNuevoStockMinimo(''); };

  /**
   * Opens the edit dialog for an ingredient, pre-filling current values.
   * @param {Insumo} insumo - The ingredient to edit.
   */
  const handleEditar = (insumo: Insumo) => {
    setEditando(insumo);
    setStockActual(String(insumo.stockActual));
    setStockMinimo(String(insumo.stockMinimo));
  };

  /**
   * Saves the edited stock values and closes the dialog.
   */
  const handleGuardar = async () => {
    if (!editando) return;
    await actualizarInsumo({
      variables: {
        id: editando.id,
        stockActual: parseFloat(stockActual),
        stockMinimo: parseFloat(stockMinimo),
      },
    });
    setEditando(null);
  };

  return (
    <Box>
      <Typography variant="h5" component="h1" gutterBottom>
        Inventario
      </Typography>

      {/* ── Productos terminados ─────────────────────────────────────── */}
      <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
        Productos terminados
      </Typography>
      {prodLoading && !prodData ? (
        <CircularProgress size={24} />
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 4 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Producto</TableCell>
                <TableCell align="right">Stock disponible</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(prodData?.productos ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.nombre}</TableCell>
                  <TableCell align="right">
                    <Chip
                      label={`${p.stockDisponible} piezas`}
                      color={colorProducto(p.stockDisponible)}
                      size="small"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ── Materias primas ──────────────────────────────────────────── */}
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="h6">Materias primas</Typography>
        {esAdmin && (
          <Button variant="contained" size="small" onClick={() => setCrearOpen(true)}>
            ＋ Nuevo insumo
          </Button>
        )}
      </Stack>
      {insLoading && !insData ? (
        <CircularProgress size={24} />
      ) : (insData?.insumos ?? []).length === 0 ? (
        <Alert severity="info">No hay insumos registrados aún.</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Insumo</TableCell>
                <TableCell>Unidad</TableCell>
                <TableCell align="right">Stock actual</TableCell>
                <TableCell align="right">Mínimo</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(insData?.insumos ?? []).map((ins) => (
                <TableRow key={ins.id}>
                  <TableCell>{ins.nombre}</TableCell>
                  <TableCell>{ins.unidad}</TableCell>
                  <TableCell align="right">
                    <Chip
                      label={ins.stockActual}
                      color={colorInsumo(ins.stockActual, ins.stockMinimo)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">{ins.stockMinimo}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                      {esAdmin && (
                        <Button size="small" variant="outlined" onClick={() => handleEditar(ins)}>
                          Editar
                        </Button>
                      )}
                      <Button
                        size="small"
                        variant="outlined"
                        color="secondary"
                        onClick={() => navigate('/dashboard/compras')}
                      >
                        Pedir más
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ── Create insumo dialog (ADMIN only) ───────────────────────── */}
      <Dialog open={crearOpen} onClose={() => { setCrearOpen(false); resetCrear(); }} maxWidth="xs" fullWidth>
        <DialogTitle>Nuevo insumo</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Nombre *"
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
          <Button onClick={() => { setCrearOpen(false); resetCrear(); }}>Cancelar</Button>
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
            {creandoInsumo ? 'Guardando…' : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Edit dialog (ADMIN only) ─────────────────────────────────── */}
      <Dialog open={Boolean(editando)} onClose={() => setEditando(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Editar stock: {editando?.nombre}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Stock actual"
              type="number"
              value={stockActual}
              onChange={(e) => setStockActual(e.target.value)}
              size="small"
              fullWidth
            />
            <TextField
              label="Stock mínimo"
              type="number"
              value={stockMinimo}
              onChange={(e) => setStockMinimo(e.target.value)}
              size="small"
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditando(null)}>Cancelar</Button>
          <Button variant="contained" onClick={() => void handleGuardar()}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
