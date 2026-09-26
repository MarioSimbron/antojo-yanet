/**
 * Admin page for managing production tasks: lists all tasks and allows creating new
 * ones or cancelling pending ones.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControl, InputLabel, MenuItem, Select, Snackbar,
  Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CancelIcon from '@mui/icons-material/Cancel';

const TAREAS_QUERY = gql`
  query Tareas {
    tareas {
      id estatus cantidadSolicitada cantidadProducida notas createdAt
      producto { id nombre categoria }
    }
  }
`;

const PRODUCTOS_QUERY = gql`
  query ProductosParaTarea {
    productos { id nombre categoria activo }
  }
`;

const CREAR_TAREA = gql`
  mutation CrearTarea($input: CrearTareaInput!) {
    crearTarea(input: $input) { id }
  }
`;

const CANCELAR_TAREA = gql`
  mutation CancelarTarea($id: Int!) {
    cancelarTarea(id: $id) { id estatus }
  }
`;

const ESTATUS_COLOR: Record<string, 'default' | 'warning' | 'success' | 'error'> = {
  PENDIENTE: 'warning',
  EN_PROCESO: 'default',
  COMPLETADA: 'success',
  CANCELADA: 'error',
};

const ESTATUS_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
};

function fmtFecha(iso: string) {
  const ms = Number(iso);
  const d = Number.isFinite(ms) && ms > 0 ? new Date(ms) : new Date(iso);
  return d.toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * Production task management page for admins: task list + create/cancel dialogs.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {JSX.Element}
 */
export default function TareasAdminPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [productoId, setProductoId] = useState<number | ''>('');
  const [cantidad, setCantidad] = useState('');
  const [notas, setNotas] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, msg: '', ok: true });

  const { data, loading, error, refetch } = useQuery(TAREAS_QUERY, { fetchPolicy: 'cache-and-network' });
  const { data: prodData } = useQuery(PRODUCTOS_QUERY, { fetchPolicy: 'cache-and-network' });

  const [crearTarea, { loading: creando }] = useMutation(CREAR_TAREA, {
    onCompleted: () => {
      setDialogOpen(false);
      setProductoId('');
      setCantidad('');
      setNotas('');
      setSnackbar({ open: true, msg: 'Tarea creada y maestro notificado', ok: true });
      void refetch();
    },
    onError: (e) => setSnackbar({ open: true, msg: e.message, ok: false }),
  });

  const [cancelarTarea] = useMutation(CANCELAR_TAREA, {
    onCompleted: () => {
      setSnackbar({ open: true, msg: 'Tarea cancelada', ok: true });
      void refetch();
    },
    onError: (e) => setSnackbar({ open: true, msg: e.message, ok: false }),
  });

  const handleCrear = () => {
    if (!productoId || !cantidad || Number(cantidad) < 1) return;
    void crearTarea({ variables: { input: { productoId: Number(productoId), cantidadSolicitada: Number(cantidad), notas: notas || undefined } } });
  };

  const productos = (prodData?.productos ?? []) as { id: number; nombre: string; categoria: string; activo: boolean }[];
  const tareas = (data?.tareas ?? []) as {
    id: number; estatus: string; cantidadSolicitada: number; cantidadProducida: number | null;
    notas: string | null; createdAt: string; producto: { id: number; nombre: string; categoria: string };
  }[];

  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h1">Tareas de Producción</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          Nueva tarea
        </Button>
      </Stack>

      {loading && <CircularProgress />}
      {error && <Alert severity="error">Error al cargar tareas.</Alert>}

      {!loading && tareas.length === 0 && (
        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 6 }}>
          No hay tareas de producción.
        </Typography>
      )}

      {tareas.length > 0 && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>Producto</TableCell>
              <TableCell>Solicitado</TableCell>
              <TableCell>Producido</TableCell>
              <TableCell>Notas</TableCell>
              <TableCell>Estatus</TableCell>
              <TableCell>Creada</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {tareas.map((t) => (
              <TableRow key={t.id} hover>
                <TableCell>{t.id}</TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{t.producto.nombre}</Typography>
                  <Typography variant="caption" color="text.secondary">{t.producto.categoria}</Typography>
                </TableCell>
                <TableCell>{t.cantidadSolicitada}</TableCell>
                <TableCell>{t.cantidadProducida ?? '—'}</TableCell>
                <TableCell sx={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.notas ?? '—'}
                </TableCell>
                <TableCell>
                  <Chip label={ESTATUS_LABEL[t.estatus] ?? t.estatus} color={ESTATUS_COLOR[t.estatus] ?? 'default'} size="small" />
                </TableCell>
                <TableCell>{fmtFecha(t.createdAt)}</TableCell>
                <TableCell>
                  {(t.estatus === 'PENDIENTE' || t.estatus === 'EN_PROCESO') && (
                    <Button size="small" color="error" startIcon={<CancelIcon />}
                      onClick={() => void cancelarTarea({ variables: { id: t.id } })}>
                      Cancelar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nueva tarea de producción</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Producto</InputLabel>
              <Select value={productoId} label="Producto" onChange={(e) => setProductoId(e.target.value as number)}>
                {productos.map((p) => (
                  <MenuItem key={p.id} value={p.id}>{p.nombre} — {p.categoria}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Cantidad a producir"
              type="number"
              size="small"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />
            <TextField
              label="Notas / instrucciones (opcional)"
              multiline
              rows={3}
              size="small"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleCrear} disabled={creando || !productoId || !cantidad}>
            Crear y notificar
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
        <Alert severity={snackbar.ok ? 'success' : 'error'} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
